const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const API_PREFIX = '/api';
const PORT = Number(process.env.PORT || process.env.WEBSITES_PORT || 3000);
const HOST = '0.0.0.0';

const app = express();
const APFS_DEBUG = process.env.APFS_DEBUG === '1';

if (APFS_DEBUG) {
    app.use((req, res, next) => {
        console.log('[APFS HIT]', new Date().toISOString(), req.method, req.originalUrl);
        console.log('[AUTH CHECK before routes]', req.method, req.originalUrl, 'authHeader:', req.headers.authorization);
        console.log('[APFS] APFS_DEBUG=', APFS_DEBUG ? '1' : '0');
        console.log('[APFS] env PORT=', process.env.PORT, 'WEBSITES_PORT=', process.env.WEBSITES_PORT);
        next();
    });
}
// =========================
// MIDDLEWARE
// =========================

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

// =========================
// JSON DB HELPERS
// =========================

// Detect Azure App Service
const IS_AZURE = !!process.env.WEBSITE_SITE_NAME || !!process.env.WEBSITE_INSTANCE_ID;

// Azure persistent storage is under /home
// Local dev should keep db.json next to backend/server.js
const DATA_DIR = IS_AZURE ? '/home/apfs-data' : __dirname;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_FILE = path.join(DATA_DIR, 'db.json');

console.log('[APFS] DB_FILE =', DB_FILE);

function emptyDb() {
    return {
        users: [],
        forecastRecords: [],
        recordHistory: [],
        apfs_organization: []   // ✅ adding this
    };
}


function loadData() {
    if (!fs.existsSync(DB_FILE)) return emptyDb();

    const raw = fs.readFileSync(DB_FILE, 'utf8').trim();
    if (!raw) return emptyDb();

    const data = JSON.parse(raw);

    if (!data.users) data.users = [];
    if (!data.forecastRecords) data.forecastRecords = [];
    if (!data.recordHistory) data.recordHistory = [];
    if (!data.apfs_organization) data.apfs_organization = [];

    // ✅ ADD THESE
    if (!data.offices) data.offices = [];
    //if (!data.lookupTables) data.lookupTables = {}; // only if you use it elsewhere

    return data;
}

function saveData(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}


// =========================
// USER HELPERS

function findUserByEmail(data, emailRaw) {
    const email = String(emailRaw || '').trim().toLowerCase();
    if (!email) return null;
    return data.users.find((u) => String(u.email || '').trim().toLowerCase() === email);
}

function sanitizeUser(user) {
    if (!user) return user;
    const { password, passwordHash, ...safe } = user;
    return safe;
}

function getCurrentUser(req, db) {
    const userId = Number(req.header('x-user-id'));
    if (!userId) return null;
    return db.users?.find((u) => Number(u.id) === userId) ?? null;
}

function fullName(u) {
    const n = `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim();
    return n || u?.email || 'Unknown User';
}

// =========================
// FORECAST SECURITY HELPERS
// =========================

function getRoleSet(user) {
    const set = new Set();

    if (user?.role) set.add(String(user.role).trim().toLowerCase());

    if (Array.isArray(user?.roles)) {
        for (const r of user.roles) set.add(String(r).trim().toLowerCase());
    }

    if (user?.is_super_admin === true) set.add('super admin');

    return set;
}

function isAdmin(user) {
    const roles = getRoleSet(user);
    return roles.has('admin');
}

function isSuperAdmin(user) {
    const roles = getRoleSet(user);

    // accept common variants
    return (
        roles.has('super admin') ||
        roles.has('superadmin') ||
        roles.has('super_admin') ||
        roles.has('super-admin')
    );
}

function getVisibleForecastRecords(user, records) {
    const rows = Array.isArray(records) ? records : [];
    if (isSuperAdmin(user)) return rows;
    return rows.filter((r) => r.component === user.component);
}

function canAccessForecastRecord(user, record) {
    if (!user || !record) return false;
    if (isSuperAdmin(user)) return true;
    return record.component === user.component;
}

function requireForecastAccess(req, res, me, record) {
    if (!canAccessForecastRecord(me, record)) {
        return res.status(403).json({ message: 'Forbidden' });
    }
    return null;
}

function buildLatestActivityMap(db) {
    const history = Array.isArray(db.recordHistory) ? db.recordHistory : [];
    const latestByForecastId = new Map(); // forecast_id -> time (ISO)

    for (const h of history) {
        if (Number(h.latest) !== 1) continue;
        latestByForecastId.set(Number(h.forecast_id), h.time);
    }
    return latestByForecastId;
}

function getLastActivityTime(record, latestByForecastId) {
    return (
        latestByForecastId.get(Number(record.id)) ||
        record.updatedAt ||
        record.createdAt ||
        ''
    );
}

function normOffice(v) {
    return String(v ?? '').trim().toLowerCase();
}

function scopeOfficesToUser(offices, user) {
    if (!user) return [];
    if (isSuperAdmin(user)) return offices;

    // Admin rule: only offices for their org
    if (isAdmin(user)) {
        const orgId = user.organization_id;
        return offices.filter(o => Number(o.organization_id) === Number(orgId));
    }

    // default: safest behavior (or tailor for other roles)
    return [];
}

//Logging helper
function dbg(...args) {
    if (APFS_DEBUG) console.log('[APFS DEBUG]', ...args);
}

function summarizeOrgCounts(rows) {
    const counts = new Map();
    for (const r of rows) {
        const k = String(r?.organization_id);
        counts.set(k, (counts.get(k) || 0) + 1);
    }
    // top 10 orgs by count
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
}

function requireCurrentUser(req, res, db) {
    const me = getCurrentUser(req, db);
    if (!me) {
        res.status(401).json({ message: 'Unauthorized' });
        return null;
    }
    return me;
}

// =========================   

// =========================
// USERS API Calls
// =========================

app.get(`${API_PREFIX}/users`, (req, res) => {
    const db = loadData();

    const me = getCurrentUser(req, db);
    if (!me) return res.status(401).json({ error: 'Unauthorized' });


    let users = Array.isArray(db.users) ? db.users : [];

    // If the caller is an Admin, only show users in their same component
    if (me && me.role === 'Admin') {
        const myComponent = String(me.component || '').trim();
        users = users.filter(u => String(u.component || '').trim() === myComponent);
    }

    res.json(users.map(sanitizeUser));
});


app.post(`${API_PREFIX}/users`, (req, res) => {
    const db = loadData();
    const body = req.body || {};
    const now = Date.now();

    // ✅ organization_id (phase 1)
    const orgRaw = body.organization_id;
    const orgId =
        orgRaw === undefined || orgRaw === null || orgRaw === ''
            ? undefined
            : Number(orgRaw);

    if (orgId !== undefined && !Number.isFinite(orgId)) {
        return res.status(400).json({ message: 'organization_id must be a number' });
    }

    const user = {
        id: now,
        firstName: String(body.firstName ?? '').trim(),
        lastName: String(body.lastName ?? '').trim(),
        title: String(body.title ?? '').trim(),
        email: String(body.email ?? '').trim(),
        employeeType: String(body.employeeType ?? '').trim(),
        component: String(body.component ?? '').trim(),
        organization_id: orgId, // ✅ add
        role: String(body.role ?? '').trim(),
        office: String(body.office ?? '').trim(),
        isActive: false,
    };

    if (!user.email) return res.status(400).json({ message: 'email is required' });

    db.users = Array.isArray(db.users) ? db.users : [];
    db.users.push(user);
    saveData(db);

    res.status(201).json(sanitizeUser(user));
});


app.patch(`${API_PREFIX}/users/:id`, (req, res) => {
    const db = loadData();
    const me = getCurrentUser(req, db);

    if (!me || me.role !== 'Admin') {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
        return res.status(400).json({ message: 'Invalid user id' });
    }

    db.users = Array.isArray(db.users) ? db.users : [];
    const idx = db.users.findIndex(u => Number(u.id) === id);
    if (idx === -1) {
        return res.status(404).json({ message: 'User not found' });
    }

    const adminComponent = String(me.component || '').trim();
    const targetComponent = String(db.users[idx].component || '').trim();
    if (adminComponent && targetComponent && adminComponent !== targetComponent) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const body = req.body || {};

    const allowed = [
        'firstName',
        'lastName',
        'title',
        'email',
        'employeeType',
        'component',
        'organization_id',
        'role',
        'office',
        'isActive',
    ];

    const patch = {};
    for (const k of allowed) {
        if (k in body) patch[k] = body[k];
    }

    if ('isActive' in patch) patch.isActive = patch.isActive === true;

    if ('organization_id' in patch) {
        const n = Number(patch.organization_id);
        if (!Number.isFinite(n)) {
            return res.status(400).json({ message: 'organization_id must be a number' });
        }
        patch.organization_id = n;
    }

    db.users[idx] = { ...db.users[idx], ...patch };
    saveData(db);

    res.json(sanitizeUser(db.users[idx]));
});



// =========================
// APFS + HISTORY HELPERS
// =========================

function getFiscalYear(date = new Date()) {
    const year = date.getFullYear();
    return date.getMonth() + 1 >= 10 ? year + 1 : year;
}

function normalizeComponentCode(component) {
    return String(component || 'UNK')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '')
        .replace(/[^A-Z0-9_-]/g, '');
}

function generateApfsNumber({ component }) {
    const fy = getFiscalYear();
    const comp = normalizeComponentCode(component);
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `4SITE-${fy}-${comp}-${rand}`;
}

function normalizeLane(raw) {
    const s = String(raw ?? '').toLowerCase();
    if (s.includes('publish')) return 'published';
    if (s.includes('coordinator')) return 'coordinator';
    if (s.includes('contract')) return 'contracting';
    if (s.includes('require')) return 'requirements';
    return 'draft';
}

function laneOrderKey(raw) {
    const lane = normalizeLane(raw);
    if (lane === 'draft') return 0;
    if (lane === 'requirements') return 1;
    if (lane === 'contracting') return 2;
    if (lane === 'coordinator') return 3;
    if (lane === 'published') return 4;
    return 99;
}

function previousLaneValue(raw) {
    const lane = normalizeLane(raw);
    if (lane === 'coordinator') return 'Contracting';
    if (lane === 'contracting') return 'Requirements';
    if (lane === 'requirements') return 'Draft';
    return null;
}

function clearLatestHistoryFlag(db, forecastId) {
    db.recordHistory = Array.isArray(db.recordHistory) ? db.recordHistory : [];
    db.recordHistory = db.recordHistory.map((h) =>
        Number(h.forecast_id) === Number(forecastId) ? { ...h, latest: 0 } : h
    );
}

function makeHistoryRow({
    forecastId,
    user,
    comment,
    assignmentDisplay,
    assignmentId,
    previousStateId,
    newStateId,
    latest,
}) {
    return {
        id: Date.now(),
        time: new Date().toISOString(),
        user_display: user?.email ?? 'Unknown',
        user_comment: comment ?? '',
        assignment_display: assignmentDisplay ?? null,
        assignment_id: assignmentId ?? null,
        forecast_id: Number(forecastId),
        previous_state_id: previousStateId ?? null,
        new_state_id: newStateId ?? null,
        latest: latest ? 1 : 0,
        user_id: user?.id ? String(user.id) : null,
    };
}

function getHistoryForRecord(db, forecastId) {
    return (db.recordHistory || [])
        .filter((h) => Number(h.forecast_id) === Number(forecastId))
        .sort((a, b) => new Date(b.time) - new Date(a.time));
}

//Added helper for normalizing boolean values from various inputs (e.g., query params, request body)
//02/13/2026
//TBrown
function toInt(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function normalizeBool01(v, defaultVal = 1) {
    if (v === 0 || v === "0" || v === false || v === "false") return 0;
    if (v === 1 || v === "1" || v === true || v === "true") return 1;
    return defaultVal;
}



// =========================
// HEALTH
// =========================

app.get(`${API_PREFIX}/health`, (req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() });
});

// =========================
// AUTH (DEV)
// =========================

app.post(`${API_PREFIX}/auth/login`, (req, res) => {
    const db = loadData();
    const user = findUserByEmail(db, req.body?.email);
    if (!user || user.isActive === false) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json({ token: 'dev-token', user: sanitizeUser(user) });
});

app.get(`${API_PREFIX}/auth/me`, (req, res) => {
    const db = loadData();
    const user = findUserByEmail(db, req.header('x-user-email'));
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    res.json({ user: sanitizeUser(user) });
});




// =========================
// FORECAST RECORDS
// ROUTES
// GET    /api/forecast-records
// POST   /api/forecast-records
// PUT    /api/forecast-records/:id
// DELETE /api/forecast-records/:id
// POST   /api/forecast-records/:id/claim
// POST   /api/forecast-records/:id/unclaim

// =========================

//Helper to parse boolean query parameters (e.g., ?force=true)
// =========================
// SECURITY HELPERS
// =========================

// CLAIMED BY ME
app.get(`${API_PREFIX}/forecast-records/claimed`, (req, res) => {
    const db = loadData();
    const me = getCurrentUser(req, db);
    if (!me) return res.status(401).json({ message: 'Not authenticated' });

    const visible = getVisibleForecastRecords(me, db.forecastRecords || []);
    const myId = String(me.id);

    const rows = visible.filter(r => String(r.assignedToUserId ?? '') === myId);

    res.json({ rows, total: rows.length });
});

// OFFICE-RELATED (e.g., for office-specific queues)
app.get(`${API_PREFIX}/forecast-records/office`, (req, res) => {
    const db = loadData();
    const me = getCurrentUser(req, db);
    if (!me) return res.status(401).json({ message: 'Not authenticated' });

    const all = db.forecastRecords || [];
    const visible = getVisibleForecastRecords(me, all); // ✅ visible is defined here

    console.log('[OFFICE VIEW] me:', {
        id: me.id,
        email: me.email,
        office: me.office,
        component: me.component,
        role: me.role
    });

    console.log('[OFFICE VIEW] counts:', {
        all: all.length,
        visible: visible.length
    });

    console.log('[OFFICE VIEW] sample visible office fields:', visible.slice(0, 5).map(r => ({
        id: r.id,
        component: r.component,
        requirementsOffice: r.requirementsOffice,
        contractingOffice: r.contractingOffice,
        coordinatorOffice: r.coordinatorOffice,
    })));

    const myOffice = String(me.office ?? '').trim().toLowerCase();

    const rows = visible.filter(r => {
        const reqOffice = String(r.requirementsOffice ?? '').trim().toLowerCase();
        const conOffice = String(r.contractingOffice ?? '').trim().toLowerCase();
        const coordOffice = String(r.coordinatorOffice ?? '').trim().toLowerCase();

        return reqOffice === myOffice || conOffice === myOffice || coordOffice === myOffice;
    });

    console.log('[OFFICE VIEW] matched rows:', rows.length);

    res.json({ rows, total: rows.length });
});

// RECENT ACTIVITY (SORTED BY LAST HISTORY ENTRY)
app.get(`${API_PREFIX}/forecast-records/activity`, (req, res) => {
    const db = loadData();
    const me = getCurrentUser(req, db);
    if (!me) return res.status(401).json({ message: 'Not authenticated' });

    const visible = getVisibleForecastRecords(me, db.forecastRecords || []);

    const latestByForecastId = buildLatestActivityMap(db);

    const rows = [...visible].sort((a, b) => {
        const aT = getLastActivityTime(a, latestByForecastId);
        const bT = getLastActivityTime(b, latestByForecastId);
        return new Date(bT) - new Date(aT);
    });

    const limit = Number(req.query.limit);
    const finalRows = Number.isFinite(limit) && limit > 0 ? rows.slice(0, limit) : rows;

    res.json({ rows: finalRows, total: finalRows.length });
});

// LIST
app.get(`${API_PREFIX}/forecast-records`, (req, res) => {
    const db = loadData();
    const me = getCurrentUser(req, db);

    if (!me) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    console.log(
        'GET /forecast-records - user:',
        me.email,
        'role:',
        me.role,
        'component:',
        me.component
    );

    const allRecords = db.forecastRecords || [];

    const rows = getVisibleForecastRecords(me, allRecords);

    res.json({ rows, total: rows.length });
});


/* =========================================================
   REPORTING HELPERS
   Shared filters + Timeliness + Business Process
   ========================================================= */

function parseCsvParam(v) {
    return String(v ?? '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
}

function parseDateOnly(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function parseDateTime(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

function isOnOrAfter(date, min) {
    if (!min) return true;
    if (!date) return false;
    return date.getTime() >= min.getTime();
}

function isOnOrBefore(date, max) {
    if (!max) return true;
    if (!date) return false;
    return date.getTime() <= max.getTime();
}

function parseAwardDateToUtc(s) {
    if (!s) return null;
    const raw = String(s).trim();
    if (!raw) return null;

    const mmddyyyy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mmddyyyy) {
        const mm = Number(mmddyyyy[1]);
        const dd = Number(mmddyyyy[2]);
        const yyyy = Number(mmddyyyy[3]);
        const dt = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0, 0));
        return Number.isNaN(dt.getTime()) ? null : dt;
    }

    const iso = new Date(raw);
    if (Number.isNaN(iso.getTime())) return null;

    return new Date(Date.UTC(
        iso.getUTCFullYear(),
        iso.getUTCMonth(),
        iso.getUTCDate(),
        0, 0, 0, 0
    ));
}

function diffDaysUtc(a, b) {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((a.getTime() - b.getTime()) / msPerDay);
}

function bucketFor(daysToAward) {
    if (daysToAward == null) return 'MISSING_DATES';
    if (daysToAward < 0) return 'PAST_DUE';
    if (daysToAward <= 30) return 'DUE_0_30';
    if (daysToAward <= 60) return 'DUE_31_60';
    if (daysToAward <= 90) return 'DUE_61_90';
    if (daysToAward <= 180) return 'DUE_91_180';
    return 'DUE_181_PLUS';
}

function isPublishedRecord(record) {
    const s = String(record?.workflowStatus ?? record?.status ?? '').trim().toLowerCase();
    return s === 'published';
}

function getRecordActivityTimes(db, forecastId) {
    const history = Array.isArray(db.recordHistory) ? db.recordHistory : [];

    return history
        .filter(h => Number(h.forecast_id) === Number(forecastId) && h.time)
        .map(h => parseDateOnly(h.time))
        .filter(Boolean)
        .sort((a, b) => a.getTime() - b.getTime());
}

function hasActivityInWindow(db, record, start, end) {
    if (!start && !end) return true;

    const activityTimes = getRecordActivityTimes(db, record.id);

    if (!activityTimes.length) {
        const fallback = parseDateOnly(record.updatedAt || record.createdAt);
        return isOnOrAfter(fallback, start) && isOnOrBefore(fallback, end);
    }

    return activityTimes.some(dt => isOnOrAfter(dt, start) && isOnOrBefore(dt, end));
}

function getPublishedDate(db, record) {
    const history = Array.isArray(db.recordHistory) ? db.recordHistory : [];

    const publishEvent = history
        .filter(h => Number(h.forecast_id) === Number(record.id))
        .filter(h => Number(h.new_state_id) === 4)
        .sort((a, b) => new Date(a.time) - new Date(b.time))[0];

    if (publishEvent?.time) {
        return parseDateOnly(publishEvent.time);
    }

    return parseDateOnly(record.updatedAt);
}

function matchesAny(value, allowed) {
    if (!allowed?.length) return true;
    const v = String(value ?? '').trim().toLowerCase();
    return allowed.some(x => String(x).trim().toLowerCase() === v);
}

function validateReportDateFilters(query) {
    const startDate = parseDateOnly(query.startDate);
    const endDate = parseDateOnly(query.endDate);
    const creationDateAfter = parseDateOnly(query.creationDateAfter);
    const creationDateBefore = parseDateOnly(query.creationDateBefore);

    if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
        return { error: 'endDate cannot be before startDate' };
    }

    if (creationDateAfter && creationDateBefore && creationDateBefore.getTime() < creationDateAfter.getTime()) {
        return { error: 'creationDateBefore cannot be before creationDateAfter' };
    }

    return {
        error: null,
        startDate,
        endDate,
        creationDateAfter,
        creationDateBefore,
    };
}

function filterReportRows(db, me, rawRows, query) {
    const validated = validateReportDateFilters(query);
    if (validated.error) {
        return { error: validated.error };
    }

    const components = parseCsvParam(query.components);
    const requirementsOffices = parseCsvParam(query.requirementsOffices);
    const contractingOffices = parseCsvParam(query.contractingOffices);
    const coordinatorOffices = parseCsvParam(query.coordinatorOffices);
    const fiscalYears = parseCsvParam(query.fiscalYears);

    let rows = getVisibleForecastRecords(me, rawRows || []);

    if (components.length) {
        rows = rows.filter(r => matchesAny(r.component, components));
    }

    if (requirementsOffices.length) {
        rows = rows.filter(r => matchesAny(r.requirementsOffice, requirementsOffices));
    }

    if (contractingOffices.length) {
        rows = rows.filter(r => matchesAny(r.contractingOffice, contractingOffices));
    }

    if (coordinatorOffices.length) {
        rows = rows.filter(r => matchesAny(r.coordinatorOffice, coordinatorOffices));
    }

    if (fiscalYears.length) {
        rows = rows.filter(r =>
            fiscalYears.some(fy => String(r.fiscalYear ?? '').trim() === String(fy).trim())
        );
    }

    if (validated.creationDateAfter || validated.creationDateBefore) {
        rows = rows.filter(r => {
            const created = parseDateOnly(r.createdAt);
            return isOnOrAfter(created, validated.creationDateAfter)
                && isOnOrBefore(created, validated.creationDateBefore);
        });
    }

    if (validated.startDate || validated.endDate) {
        rows = rows.filter(r => hasActivityInWindow(db, r, validated.startDate, validated.endDate));
    }

    return {
        error: null,
        rows,
        filtersApplied: {
            components,
            requirementsOffices,
            contractingOffices,
            coordinatorOffices,
            fiscalYears,
            startDate: query.startDate ?? '',
            endDate: query.endDate ?? '',
            creationDateAfter: query.creationDateAfter ?? '',
            creationDateBefore: query.creationDateBefore ?? '',
        }
    };
}

/* =========================================================
   TIMELINESS
   ========================================================= */

function summarizeTimelinessRows(db, records) {
    const counts = {
        MISSING_DATES: 0,
        PAST_DUE: 0,
        DUE_0_30: 0,
        DUE_31_60: 0,
        DUE_61_90: 0,
        DUE_91_180: 0,
        DUE_181_PLUS: 0,
    };

    const rowsByBucket = {
        MISSING_DATES: [],
        PAST_DUE: [],
        DUE_0_30: [],
        DUE_31_60: [],
        DUE_61_90: [],
        DUE_91_180: [],
        DUE_181_PLUS: [],
    };

    const totalVisible = records.length;
    const published = records.filter(isPublishedRecord);
    const totalPublished = published.length;
    const denom = totalPublished || 1;

    for (const r of published) {
        const award = parseAwardDateToUtc(r.anticipatedAwardDate || r.anticipated_award_date);
        const publishedDate = getPublishedDate(db, r);

        let bucket = 'MISSING_DATES';
        if (award && publishedDate) {
            bucket = bucketFor(diffDaysUtc(award, publishedDate));
        }

        counts[bucket]++;

        rowsByBucket[bucket].push({
            apfsNumber: String(r.apfsNumber ?? r.id ?? ''),
            recordId: Number(r.id),
            component: String(r.component ?? '').trim(),
            office: String(r.requirementsOffice ?? '').trim(),
            anticipatedAwardDate: String(r.anticipatedAwardDate ?? r.anticipated_award_date ?? '').trim(),
            publishedDate: publishedDate ? publishedDate.toISOString().slice(0, 10) : '',
            createdAt: String(r.createdAt ?? '').trim(),
            updatedAt: String(r.updatedAt ?? '').trim(),
            workflowStatus: String(r.workflowStatus ?? r.status ?? '').trim(),
        });
    }

    return {
        totalVisible,
        totalPublished,
        buckets: {
            MISSING_DATES: { count: counts.MISSING_DATES, percentOfPublished: +((counts.MISSING_DATES * 100) / denom).toFixed(1) },
            PAST_DUE: { count: counts.PAST_DUE, percentOfPublished: +((counts.PAST_DUE * 100) / denom).toFixed(1) },
            DUE_0_30: { count: counts.DUE_0_30, percentOfPublished: +((counts.DUE_0_30 * 100) / denom).toFixed(1) },
            DUE_31_60: { count: counts.DUE_31_60, percentOfPublished: +((counts.DUE_31_60 * 100) / denom).toFixed(1) },
            DUE_61_90: { count: counts.DUE_61_90, percentOfPublished: +((counts.DUE_61_90 * 100) / denom).toFixed(1) },
            DUE_91_180: { count: counts.DUE_91_180, percentOfPublished: +((counts.DUE_91_180 * 100) / denom).toFixed(1) },
            DUE_181_PLUS: { count: counts.DUE_181_PLUS, percentOfPublished: +((counts.DUE_181_PLUS * 100) / denom).toFixed(1) },
        },
        rowsByBucket,
    };
}

/* =========================================================
   BUSINESS PROCESS
   ========================================================= */

const WORKFLOW_STATE = {
    NEW: 0,
    REQUIREMENTS: 1,
    CONTRACTING: 2,
    COORDINATOR: 3,
    PUBLISHED: 4,
};

function getCurrentStateId(record) {
    const raw = String(record?.workflowStatus ?? record?.status ?? '').trim().toLowerCase();

    if (raw === 'new') return WORKFLOW_STATE.NEW;
    if (raw === 'requirements') return WORKFLOW_STATE.REQUIREMENTS;
    if (raw === 'contracting') return WORKFLOW_STATE.CONTRACTING;
    if (raw === 'apfs coordinator') return WORKFLOW_STATE.COORDINATOR;
    if (raw === 'published') return WORKFLOW_STATE.PUBLISHED;

    return null;
}

function getBusinessSectionMeta(sectionKey) {
    const map = {
        requirements: {
            key: 'requirements',
            label: 'Requirements',
            stateId: WORKFLOW_STATE.REQUIREMENTS,
        },
        contracting: {
            key: 'contracting',
            label: 'Contracting',
            stateId: WORKFLOW_STATE.CONTRACTING,
        },
        coordinator: {
            key: 'coordinator',
            label: 'APFS Coordinator',
            stateId: WORKFLOW_STATE.COORDINATOR,
        },
        published: {
            key: 'published',
            label: 'Published',
            stateId: WORKFLOW_STATE.PUBLISHED,
        },
    };

    return map[String(sectionKey || '').trim().toLowerCase()] || null;
}

function getHistoryForForecast(db, forecastId) {
    const history = Array.isArray(db.recordHistory) ? db.recordHistory : [];

    return history
        .filter(h => Number(h.forecast_id) === Number(forecastId) && h.time)
        .slice()
        .sort((a, b) => new Date(a.time) - new Date(b.time));
}

function isForwardApproval(fromState, toState) {
    return (
        (fromState === WORKFLOW_STATE.REQUIREMENTS && toState === WORKFLOW_STATE.CONTRACTING) ||
        (fromState === WORKFLOW_STATE.CONTRACTING && toState === WORKFLOW_STATE.COORDINATOR) ||
        (fromState === WORKFLOW_STATE.COORDINATOR && toState === WORKFLOW_STATE.PUBLISHED)
    );
}

function isBackwardRejection(fromState, toState) {
    return Number.isFinite(fromState) &&
        Number.isFinite(toState) &&
        toState < fromState;
}

function findMostRecentEntryTime(history, laneStateId, upToIndex) {
    for (let i = upToIndex; i >= 0; i--) {
        const h = history[i];
        if (Number(h.new_state_id) !== Number(laneStateId)) continue;
        const dt = parseDateTime(h.time);
        if (dt) return dt;
    }
    return null;
}

function formatDuration(ms, emptyLabel) {
    if (!Number.isFinite(ms) || ms < 0) {
        return emptyLabel || '';
    }

    let totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    totalSeconds -= days * 86400;
    const hrs = Math.floor(totalSeconds / 3600);
    totalSeconds -= hrs * 3600;
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds - mins * 60;

    return `${days} Days ${hrs} Hrs ${mins} Min ${secs} Sec`;
}

function getLaneExitEvents(history, fromStateId, mode) {
    const out = [];

    for (let i = 0; i < history.length; i++) {
        const h = history[i];
        const prev = Number(h.previous_state_id);
        const next = Number(h.new_state_id);

        if (prev !== Number(fromStateId)) continue;

        const exitTime = parseDateTime(h.time);
        if (!exitTime) continue;

        const entryTime = findMostRecentEntryTime(history, fromStateId, i);
        if (!entryTime) continue;

        const approval = mode === 'approved' && isForwardApproval(prev, next);
        const rejection = mode === 'rejected' && isBackwardRejection(prev, next);

        if (!approval && !rejection) continue;

        out.push({
            historyId: Number(h.id),
            previousStateId: prev,
            newStateId: next,
            entryTime,
            exitTime,
            elapsedMs: exitTime.getTime() - entryTime.getTime(),
            userComment: String(h.user_comment ?? '').trim(),
        });
    }

    return out;
}

function toBusinessProcessDetailRow(record, extra = {}) {
    return {
        recordId: Number(record.id),
        apfsNumber: String(record.apfsNumber ?? ''),
        component: String(record.component ?? ''),
        requirementsOffice: String(record.requirementsOffice ?? ''),
        contractingOffice: String(record.contractingOffice ?? ''),
        coordinatorOffice: String(record.coordinatorOffice ?? ''),
        requirementsTitle: String(record.requirementsTitle ?? ''),
        workflowStatus: String(record.workflowStatus ?? record.status ?? ''),
        createdAt: String(record.createdAt ?? ''),
        updatedAt: String(record.updatedAt ?? ''),
        enteredAt: extra.enteredAt ?? '',
        exitedAt: extra.exitedAt ?? '',
        elapsedDisplay: extra.elapsedDisplay ?? '',
    };
}

function buildBusinessSection(db, rows, sectionMeta) {
    const approvedEvents = [];
    const rejectedEvents = [];
    let currentCount = 0;
    let touchedCount = 0;

    for (const record of rows) {
        const currentStateId = getCurrentStateId(record);
        if (currentStateId === sectionMeta.stateId) {
            currentCount++;
        }

        const history = getHistoryForForecast(db, record.id);

        const touched = history.some(h =>
            Number(h.previous_state_id) === sectionMeta.stateId ||
            Number(h.new_state_id) === sectionMeta.stateId
        );
        if (touched) {
            touchedCount++;
        }

        approvedEvents.push(
            ...getLaneExitEvents(history, sectionMeta.stateId, 'approved').map(e => ({
                record,
                ...e
            }))
        );

        rejectedEvents.push(
            ...getLaneExitEvents(history, sectionMeta.stateId, 'rejected').map(e => ({
                record,
                ...e
            }))
        );
    }

    const avgApprovalMs = approvedEvents.length
        ? Math.round(approvedEvents.reduce((sum, e) => sum + e.elapsedMs, 0) / approvedEvents.length)
        : null;

    const avgRejectionMs = rejectedEvents.length
        ? Math.round(rejectedEvents.reduce((sum, e) => sum + e.elapsedMs, 0) / rejectedEvents.length)
        : null;

    return {
        label: sectionMeta.label,
        totalApprovals: approvedEvents.length,
        avgApprovalDisplay: approvedEvents.length
            ? formatDuration(avgApprovalMs, 'No Average Approval Time')
            : 'No Average Approval Time',
        totalRejections: rejectedEvents.length,
        avgRejectionDisplay: rejectedEvents.length
            ? formatDuration(avgRejectionMs, 'No Average Rejected Time')
            : 'No Average Rejected Time',
        currentCount,
        touchedCount,
    };
}

function summarizeBusinessProcessRows(db, rows) {
    return {
        sections: {
            requirements: buildBusinessSection(db, rows, getBusinessSectionMeta('requirements')),
            contracting: buildBusinessSection(db, rows, getBusinessSectionMeta('contracting')),
            coordinator: buildBusinessSection(db, rows, getBusinessSectionMeta('coordinator')),
            published: buildBusinessSection(db, rows, getBusinessSectionMeta('published')),
        }
    };
}

function getBusinessProcessDetailRows(db, rows, sectionKey, metricKey) {
    const sectionMeta = getBusinessSectionMeta(sectionKey);
    if (!sectionMeta) return [];

    const metric = String(metricKey ?? '').trim().toLowerCase();
    const out = [];

    for (const record of rows) {
        const history = getHistoryForForecast(db, record.id);

        if (metric === 'approved' || metric === 'rejected') {
            const events = getLaneExitEvents(history, sectionMeta.stateId, metric);

            for (const e of events) {
                out.push(toBusinessProcessDetailRow(record, {
                    enteredAt: e.entryTime ? e.entryTime.toISOString() : '',
                    exitedAt: e.exitTime ? e.exitTime.toISOString() : '',
                    elapsedDisplay: formatDuration(
                        e.elapsedMs,
                        metric === 'approved' ? 'No Average Approval Time' : 'No Average Rejected Time'
                    ),
                }));
            }
        } else if (metric === 'current') {
            const currentStateId = getCurrentStateId(record);
            if (currentStateId === sectionMeta.stateId) {
                out.push(toBusinessProcessDetailRow(record, {
                    elapsedDisplay: '',
                }));
            }
        } else if (metric === 'touched') {
            const touched = history.some(h =>
                Number(h.previous_state_id) === sectionMeta.stateId ||
                Number(h.new_state_id) === sectionMeta.stateId
            );

            if (touched) {
                out.push(toBusinessProcessDetailRow(record, {
                    elapsedDisplay: '',
                }));
            }
        }
    }

    out.sort((a, b) => String(a.apfsNumber).localeCompare(String(b.apfsNumber)));
    return out;
}

/* =========================================================
   REFACTORED TIMELINESS ENDPOINT
   ========================================================= */

app.get(`${API_PREFIX}/forecast-records/timeliness-report`, (req, res) => {
    const db = loadData();
    const me = getCurrentUser(req, db);
    if (!me) return res.status(401).json({ message: 'Not authenticated' });

    const filtered = filterReportRows(db, me, db.forecastRecords || [], req.query);
    if (filtered.error) {
        return res.status(400).json({ message: filtered.error });
    }

    const summary = summarizeTimelinessRows(db, filtered.rows);

    return res.json({
        filtersApplied: filtered.filtersApplied,
        ...summary
    });
});

/* =========================================================
   BUSINESS PROCESS SUMMARY ENDPOINT
   ========================================================= */

app.get(`${API_PREFIX}/forecast-records/business-process-report`, (req, res) => {
    const db = loadData();
    const me = getCurrentUser(req, db);
    if (!me) return res.status(401).json({ message: 'Not authenticated' });

    const filtered = filterReportRows(db, me, db.forecastRecords || [], req.query);
    if (filtered.error) {
        return res.status(400).json({ message: filtered.error });
    }

    const summary = summarizeBusinessProcessRows(db, filtered.rows);

    return res.json({
        filtersApplied: filtered.filtersApplied,
        ...summary
    });
});

/* =========================================================
   BUSINESS PROCESS DETAIL ENDPOINT
   ========================================================= */

app.get(`${API_PREFIX}/forecast-records/business-process-report/details`, (req, res) => {
    const db = loadData();
    const me = getCurrentUser(req, db);
    if (!me) return res.status(401).json({ message: 'Not authenticated' });

    const section = String(req.query.section ?? '').trim().toLowerCase();
    const metric = String(req.query.metric ?? '').trim().toLowerCase();

    const validSections = ['requirements', 'contracting', 'coordinator', 'published'];
    const validMetrics = ['approved', 'rejected', 'current', 'touched'];

    if (!validSections.includes(section)) {
        return res.status(400).json({ message: 'Invalid section' });
    }

    if (!validMetrics.includes(metric)) {
        return res.status(400).json({ message: 'Invalid metric' });
    }

    const filtered = filterReportRows(db, me, db.forecastRecords || [], req.query);
    if (filtered.error) {
        return res.status(400).json({ message: filtered.error });
    }

    const detailRows = getBusinessProcessDetailRows(db, filtered.rows, section, metric);

    return res.json({
        filtersApplied: filtered.filtersApplied,
        section,
        metric,
        count: detailRows.length,
        rows: detailRows,
    });
});

// GET ONE (WITH HISTORY)
app.get(`${API_PREFIX}/forecast-records/:id`, (req, res) => {
    const db = loadData();
    const me = getCurrentUser(req, db);
    if (!me) return res.status(401).json({ message: 'Not authenticated' });

    console.log(
        'GET /forecast-records/:id - user:',
        me.email,
        'role:',
        me.role,
        'component:',
        me.component
    );

    const id = Number(req.params.id);
    const record = (db.forecastRecords || []).find((r) => Number(r.id) === id);
    if (!record) return res.status(404).json({ error: 'Not found' });

    const blocked = requireForecastAccess(req, res, me, record);
    if (blocked) return;

    const history = getHistoryForRecord(db, id);
    res.json({ ...record, history });
});

/*
app.post(`${API_PREFIX}/forecast-records`, (req, res) => {
    const db = loadData();
    const me = getCurrentUser(req, db);
    if (!me) return res.status(401).json({ message: 'Not authenticated' });

    const now = new Date().toISOString();
    const record = {
        ...req.body,
        id: Date.now(),
        component: me.component,
        apfsNumber: generateApfsNumber({ component: me.component }),
        workflowStatus: 'Draft',
        status: 'Draft',
        createdAt: now,
        updatedAt: now,
        assignedToUserId: null,
        assignedToName: null,
        assignedAt: null,
    };

    db.forecastRecords = Array.isArray(db.forecastRecords) ? db.forecastRecords : [];
    db.recordHistory = Array.isArray(db.recordHistory) ? db.recordHistory : [];

    clearLatestHistoryFlag(db, record.id);

    const historyRow = makeHistoryRow({
        forecastId: record.id,
        user: me,
        comment: 'Created',
        previousStateId: null,
        newStateId: 0,
        latest: true,
    });

    db.forecastRecords.push(record);
    db.recordHistory.push(historyRow);
    saveData(db);

    res.status(201).json({ ...record, history: [historyRow] });
});*/


app.post(`${API_PREFIX}/forecast-records`, (req, res) => {
    const db = loadData();
    const me = getCurrentUser(req, db);
    if (!me) return res.status(401).json({ message: 'Not authenticated' });

    const now = new Date().toISOString();

    // Server-owned fields: prevent spoofing
    const body = { ...(req.body || {}) };
    delete body.assignedToUserId;
    delete body.assignedToName;
    delete body.assignedAt;

    const record = {
        ...body,
        id: Date.now(),
        component: me.component,
        apfsNumber: generateApfsNumber({ component: me.component }),
        workflowStatus: 'Draft',
        status: 'Draft',
        createdAt: now,
        updatedAt: now,

        // ✅ Claim by default on create
        assignedToUserId: me.id,
        assignedToName: `${me.firstName ?? ''} ${me.lastName ?? ''}`.trim() || me.email,
        assignedAt: now,
    };

    db.forecastRecords = Array.isArray(db.forecastRecords) ? db.forecastRecords : [];
    db.recordHistory = Array.isArray(db.recordHistory) ? db.recordHistory : [];

    clearLatestHistoryFlag(db, record.id);

    const createdRow = makeHistoryRow({
        forecastId: record.id,
        user: me,
        comment: 'Created',
        previousStateId: null,
        newStateId: 0,
        latest: false, // not latest because we’ll add Claimed after it
    });

    const claimedRow = makeHistoryRow({
        forecastId: record.id,
        user: me,
        comment: 'Claimed',
        previousStateId: 0,
        newStateId: 0,
        latest: true,
        assignmentId: me.id,
        assignmentDisplay: `${me.firstName ?? ''} ${me.lastName ?? ''}`.trim() || me.email,
    });

    db.forecastRecords.push(record);
    db.recordHistory.push(createdRow, claimedRow);
    saveData(db);

    res.status(201).json({ ...record, history: [createdRow, claimedRow] });
});

// UPDATE (SAVE DRAFT / EDIT)
app.put(`${API_PREFIX}/forecast-records/:id`, (req, res) => {
    const db = loadData();
    const me = getCurrentUser(req, db);
    if (!me) return res.status(401).json({ message: 'Not authenticated' });

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' });

    const idx = (db.forecastRecords || []).findIndex((r) => Number(r.id) === id);
    if (idx === -1) return res.status(404).json({ message: 'Not found' });

    const existing = db.forecastRecords[idx];

    const blocked = requireForecastAccess(req, res, me, existing);
    if (blocked) return;

    const now = new Date().toISOString();

    const updated = {
        ...existing,
        ...req.body,

        // protected / server-owned
        id: existing.id,
        component: existing.component,
        apfsNumber: existing.apfsNumber,

        // protect assignment fields (claim/unclaim owns these)
        assignedToUserId: existing.assignedToUserId ?? null,
        assignedToName: existing.assignedToName ?? null,
        assignedAt: existing.assignedAt ?? null,

        // keep workflow fields unless explicitly sent (optional)
        workflowStatus: req.body?.workflowStatus ?? existing.workflowStatus,
        status: req.body?.status ?? req.body?.workflowStatus ?? existing.status,

        updatedAt: now,
    };

    db.forecastRecords[idx] = updated;
    saveData(db);

    res.json({ ...updated, history: getHistoryForRecord(db, id) });
});


// TRANSITION
app.post(`${API_PREFIX}/forecast-records/:id/transition`, (req, res) => {
    console.group('[TRANSITION]');
    console.log('recordId:', req.params.id);
    console.log('x-user-id:', req.header('x-user-id'));
    console.log('body:', req.body);

    const db = loadData();
    const me = getCurrentUser(req, db);
    if (!me) return res.status(401).json({ message: 'Not authenticated' });

    const id = Number(req.params.id);
    const r = (db.forecastRecords || []).find((x) => Number(x.id) === id);
    if (!r) return res.status(404).json({ message: 'Not found' });

    const blocked = requireForecastAccess(req, res, me, r);
    if (blocked) return;

    const from = r.workflowStatus;
    const to = String(req.body?.to ?? '').trim();
    if (!to) return res.status(400).json({ message: 'Missing "to"' });

    r.workflowStatus = to;
    r.status = to;
    r.updatedAt = new Date().toISOString();

    clearLatestHistoryFlag(db, id);

    db.recordHistory.push(
        makeHistoryRow({
            forecastId: id,
            user: me,
            comment: req.body?.comment ?? `Transitioned to ${to}`,
            assignmentDisplay: r.assignedToName ?? null,
            assignmentId: r.assignedToUserId ?? null,
            previousStateId: laneOrderKey(from),
            newStateId: laneOrderKey(to),
            latest: true,
        })
    );

    saveData(db);
    res.json({ ...r, history: getHistoryForRecord(db, id) });
});

// REJECT
app.post(`${API_PREFIX}/forecast-records/:id/reject`, (req, res) => {
    const db = loadData();
    const me = getCurrentUser(req, db);
    if (!me) return res.status(401).json({ message: 'Not authenticated' });

    const id = Number(req.params.id);
    const r = (db.forecastRecords || []).find((x) => Number(x.id) === id);
    if (!r) return res.status(404).json({ message: 'Not found' });

    const blocked = requireForecastAccess(req, res, me, r);
    if (blocked) return;

    const prev = previousLaneValue(r.workflowStatus);
    if (!prev) return res.status(409).json({ message: 'Cannot reject' });

    clearLatestHistoryFlag(db, id);

    db.recordHistory.push(
        makeHistoryRow({
            forecastId: id,
            user: me,
            comment: req.body?.comment,
            assignmentDisplay: r.assignedToName ?? null,
            assignmentId: r.assignedToUserId ?? null,
            previousStateId: laneOrderKey(r.workflowStatus),
            newStateId: laneOrderKey(prev),
            latest: true,
        })
    );

    r.workflowStatus = prev;
    r.status = prev;
    r.updatedAt = new Date().toISOString();
    r.assignedToUserId = null;
    r.assignedToName = null;
    r.assignedAt = null;

    saveData(db);
    res.json({ ...r, history: getHistoryForRecord(db, id) });
});

// =========================
// CLAIM / UNCLAIM
// =========================

// CLAIM
app.post(`${API_PREFIX}/forecast-records/:id/claim`, (req, res) => {
    const db = loadData();
    const me = getCurrentUser(req, db);
    if (!me) return res.status(401).json({ message: 'Not authenticated' });

    const id = Number(req.params.id);
    const idx = (db.forecastRecords || []).findIndex((r) => Number(r.id) === id);
    if (idx === -1) return res.status(404).json({ error: 'Forecast record not found' });

    const existing = db.forecastRecords[idx];

    const blocked = requireForecastAccess(req, res, me, existing);
    if (blocked) return;

    const requesterId = req.body?.userId ?? null;
    const force = !!req.body?.force;

    if (!requesterId) return res.status(400).json({ error: 'userId is required' });

    const user = (db.users || []).find((u) => String(u.id) === String(requesterId));
    if (!user || user.isActive === false) return res.status(401).json({ error: 'Unauthorized' });

    const now = new Date().toISOString();

    const currentAssignee = existing.assignedToUserId ? String(existing.assignedToUserId) : null;
    const meId = String(user.id);

    if (currentAssignee && currentAssignee === meId) {
        return res.json({ ...existing, history: getHistoryForRecord(db, id) });
    }

    if (currentAssignee && currentAssignee !== meId && !force) {
        return res.status(409).json({
            error: 'Forecast record already claimed',
            assignedToUserId: existing.assignedToUserId,
            assignedToName: existing.assignedToName,
            assignedAt: existing.assignedAt,
        });
    }

    const claimed = {
        ...existing,
        assignedToUserId: meId,
        assignedToName: fullName(user),
        assignedAt: now,
        updatedAt: now,
    };

    clearLatestHistoryFlag(db, id);
    db.recordHistory.push(
        makeHistoryRow({
            forecastId: id,
            user: me,
            comment: currentAssignee ? 'Reassigned (forced claim)' : 'Claimed',
            assignmentDisplay: claimed.assignedToName,
            assignmentId: claimed.assignedToUserId,
            previousStateId: laneOrderKey(existing.workflowStatus ?? existing.status),
            newStateId: laneOrderKey(claimed.workflowStatus ?? claimed.status),
            latest: true,
        })
    );

    db.forecastRecords[idx] = claimed;
    saveData(db);

    res.json({ ...claimed, history: getHistoryForRecord(db, id) });
});

// UNCLAIM
app.post(`${API_PREFIX}/forecast-records/:id/unclaim`, (req, res) => {
    const db = loadData();
    const me = getCurrentUser(req, db);
    if (!me) return res.status(401).json({ message: 'Not authenticated' });

    const id = Number(req.params.id);
    const idx = (db.forecastRecords || []).findIndex((r) => Number(r.id) === id);
    if (idx === -1) return res.status(404).json({ error: 'Forecast record not found' });

    const existing = db.forecastRecords[idx];

    const blocked = requireForecastAccess(req, res, me, existing);
    if (blocked) return;

    const requesterId = req.body?.userId ?? null;
    const force = !!req.body?.force;

    const currentAssignee = existing.assignedToUserId ? String(existing.assignedToUserId) : null;

    if (currentAssignee && !force && requesterId && String(currentAssignee) !== String(requesterId)) {
        return res.status(403).json({ error: 'Only the assignee can unclaim this record' });
    }

    const now = new Date().toISOString();

    const unclaimed = {
        ...existing,
        assignedToUserId: null,
        assignedToName: null,
        assignedAt: null,
        updatedAt: now,
    };

    clearLatestHistoryFlag(db, id);
    db.recordHistory.push(
        makeHistoryRow({
            forecastId: id,
            user: me,
            comment: 'Unassigned',
            assignmentDisplay: null,
            assignmentId: null,
            previousStateId: laneOrderKey(existing.workflowStatus ?? existing.status),
            newStateId: laneOrderKey(unclaimed.workflowStatus ?? unclaimed.status),
            latest: true,
        })
    );

    db.forecastRecords[idx] = unclaimed;
    saveData(db);

    res.json({ ...unclaimed, history: getHistoryForRecord(db, id) });
});


// OPTIONAL: alias if your client uses /unassign
app.post(`${API_PREFIX}/forecast-records/:id/unassign`, (req, res) => {
    // call the same handler by rewriting the URL to /unclaim
    req.url = req.url.replace('/unassign', '/unclaim');
    app._router.handle(req, res);
});

//Delete Record
app.delete(`${API_PREFIX}/forecast-records/:id`, (req, res) => {
    const db = loadData();
    const me = getCurrentUser(req, db);
    if (!me) return res.status(401).json({ message: 'Not authenticated' });

    const id = Number(req.params.id);
    const userId = req.query.userId != null ? Number(req.query.userId) : null;
    const force = String(req.query.force).toLowerCase() === 'true';

    const rec = (db.forecastRecords || []).find((r) => Number(r.id) === id);
    if (!rec) return res.status(404).json({ message: 'Record not found' });

    const blocked = requireForecastAccess(req, res, me, rec);
    if (blocked) return;

    const assigned = rec.assignedToUserId != null ? Number(rec.assignedToUserId) : null;

    // if assigned to someone else, block (super admin can still be blocked here unless force logic says otherwise)
    if (assigned != null && userId != null && assigned !== userId) {
        return res.status(403).json({ message: 'Only assignee can delete' });
    }

    // if assigned and not forcing, require force
    if (assigned != null && !force) {
        return res.status(409).json({ message: 'Force delete required for assigned record' });
    }

    db.forecastRecords = (db.forecastRecords || []).filter((r) => Number(r.id) !== id);

    clearLatestHistoryFlag(db, id);
    db.recordHistory = Array.isArray(db.recordHistory) ? db.recordHistory : [];
    db.recordHistory.push(
        makeHistoryRow({
            forecastId: id,
            user: me,
            comment: force ? 'Force deleted record' : 'Deleted record',
            assignmentDisplay: rec.assignedToName ?? null,
            assignmentId: rec.assignedToUserId ?? null,
            previousStateId: laneOrderKey(rec.workflowStatus ?? rec.status),
            newStateId: laneOrderKey(rec.workflowStatus ?? rec.status),
            latest: true,
        })
    );

    saveData(db);
    return res.json({ ok: true });
});


///APFS Organization Routes

//APFS Organization Tree Structure
// =========================
// APFS ORGANIZATION TREE
// =========================

app.get(`${API_PREFIX}/apfs-organization/tree`, (req, res) => {
    const data = loadData();
    const onlyActive = String(req.query.active ?? '') === '1';
    const rootId =
        req.query.rootId !== undefined && String(req.query.rootId).trim() !== ''
            ? Number(String(req.query.rootId).trim())
            : null;
    const rows = Array.isArray(data.apfs_organization) ? data.apfs_organization : [];

    // normalize + optionally filter active
    const normalized = rows
        .map(r => ({
            id: Number(r.id),
            name: r.name ?? '',
            acronym: r.acronym ?? '',
            full_name: r.full_name ?? '',
            active: r.active === 0 ? 0 : 1,
            parent_id: (r.parent_id === null || r.parent_id === undefined || r.parent_id === '') ? null : Number(r.parent_id),
        }))
        .filter(r => !onlyActive || r.active === 1);

    // index by parent_id
    const childrenByParent = new Map(); // key: parent_id (number|null), val: node[]
    for (const r of normalized) {
        const key = r.parent_id ?? null;
        if (!childrenByParent.has(key)) childrenByParent.set(key, []);
        childrenByParent.get(key).push({ ...r, children: [] });
    }

    // stable sort children under each parent
    for (const [key, list] of childrenByParent.entries()) {
        list.sort((a, b) => {
            // sort by full_name then name then id
            const fa = (a.full_name || '').toLowerCase();
            const fb = (b.full_name || '').toLowerCase();
            if (fa < fb) return -1;
            if (fa > fb) return 1;
            const na = (a.name || '').toLowerCase();
            const nb = (b.name || '').toLowerCase();
            const c = na.localeCompare(nb);
            if (c !== 0) return c;
            return a.id - b.id;
        });
    }

    // link nodes into a tree
    const byId = new Map();
    for (const list of childrenByParent.values()) {
        for (const n of list) byId.set(n.id, n);
    }

    // attach children to parents
    for (const n of byId.values()) {
        const kids = childrenByParent.get(n.id) || [];
        n.children = kids;
    }

    // roots are parent_id === null (or missing parents -> treated as roots)
    let roots = childrenByParent.get(null) || [];

    // if there are orphans (parent_id points to missing id), lift them to roots
    const orphanRoots = [];
    for (const n of byId.values()) {
        if (n.parent_id !== null && !byId.has(n.parent_id)) {
            orphanRoots.push(n);
        }
    }
    if (orphanRoots.length) {
        // avoid duplicates if something already in roots
        const rootIds = new Set(roots.map(r => r.id));
        for (const o of orphanRoots) {
            if (!rootIds.has(o.id)) roots.push(o);
        }
        roots.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    }

    // optional: return only a subtree
    if (rootId !== null) {
        const node = byId.get(rootId);
        if (!node) return res.status(404).json({ message: 'Root org not found' });
        return res.json(node);
    }

    res.json(roots);
});

// =========================
// APFS ORGANIZATION TREE (SCOPED)
// - Admin: returns ONLY their component subtree (single node)
// - Super Admin: returns ALL organizations (array of root nodes)
// =========================
app.get(`${API_PREFIX}/apfs-organization/tree/scoped`, (req, res) => {
    const db = loadData();

    const me = getCurrentUser(req, db);
    if (!me) return res.status(401).json({ error: 'Unauthorized' });

    // Role gates (use your helpers; avoids brittle string compares)
    const isSA = typeof isSuperAdmin === 'function' ? isSuperAdmin(me) : false;
    const isAdminRole = String(me.role || '').trim().toLowerCase() === 'admin';

    // Only Admin / Super Admin
    if (!isAdminRole && !isSA) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const onlyActive = String(req.query.active ?? '') === '1';
    const rows = Array.isArray(db.apfs_organization) ? db.apfs_organization : [];

    // Normalize rows
    const normalized = rows
        .map(r => ({
            id: Number(r.id),
            name: r.name ?? '',
            acronym: r.acronym ?? '',
            full_name: r.full_name ?? '',
            active: Number(r.active) === 0 ? 0 : 1,
            parent_id:
                r.parent_id === null || r.parent_id === undefined || r.parent_id === ''
                    ? null
                    : Number(r.parent_id),
        }))
        .filter(r => Number.isFinite(r.id))
        .filter(r => !onlyActive || r.active === 1);

    // Build byId map
    const byId = new Map();
    for (const r of normalized) byId.set(r.id, { ...r, children: [] });

    // Attach children + collect roots
    const roots = [];
    for (const node of byId.values()) {
        if (node.parent_id !== null && byId.has(node.parent_id)) {
            byId.get(node.parent_id).children.push(node);
        } else {
            roots.push(node);
        }
    }

    // Sort recursively
    const sortTree = (nodes) => {
        nodes.sort((a, b) => {
            const fa = (a.full_name || '').toLowerCase();
            const fb = (b.full_name || '').toLowerCase();
            if (fa < fb) return -1;
            if (fa > fb) return 1;

            const na = (a.name || '').toLowerCase();
            const nb = (b.name || '').toLowerCase();
            const c = na.localeCompare(nb);
            if (c !== 0) return c;

            return a.id - b.id;
        });
        for (const n of nodes) sortTree(n.children);
    };

    // ✅ Super Admin sees EVERYTHING (full forest)
    if (isSA) {
        sortTree(roots);
        return res.json(roots); // array of root nodes
        // If you prefer one consistent shape, change to: return res.json({ roots });
    }

    // ✅ Admin sees ONLY their component subtree
    const myComponent = String(me.component || '').trim();
    if (!myComponent) return res.status(400).json({ error: 'Missing user component' });

    // Find the component root node (match acronym first, then name)
    const root =
        normalized.find(r => String(r.acronym).trim() === myComponent) ??
        normalized.find(r => String(r.name).trim() === myComponent);

    if (!root) return res.json([]); // component doesn't map to an org root

    const scopedRoot = byId.get(root.id);
    if (!scopedRoot) return res.json([]);

    sortTree(scopedRoot.children);

    return res.json(scopedRoot); // single node (component root + children)
});


// GET by id
app.get(`${API_PREFIX}/apfs-organization/:id`, (req, res) => {
    const data = loadData();
    const rows = Array.isArray(data.apfs_organization) ? data.apfs_organization : [];
    const id = Number(req.params.id);

    const found = rows.find(r => Number(r.id) === id);
    if (!found) return res.status(404).json({ message: 'Org not found' });

    return res.json(found);
});

// CREATE
app.post(`${API_PREFIX}/apfs-organization`, (req, res) => {
    const data = loadData();
    const rows = Array.isArray(data.apfs_organization) ? data.apfs_organization : [];

    const full_name = String(req.body.full_name ?? '').trim();
    if (!full_name) return res.status(400).json({ message: 'full_name is required' });

    const name = String(req.body.name ?? '').trim();
    const acronym = String(req.body.acronym ?? '').trim();
    const active = Number(req.body.active) === 0 ? 0 : 1;

    const parent_id_raw = req.body.parent_id;
    const parent_id =
        parent_id_raw === null || parent_id_raw === undefined || String(parent_id_raw).trim() === ''
            ? null
            : Number(parent_id_raw);

    // Optional: validate parent exists (if provided)
    if (parent_id !== null && !rows.some(r => Number(r.id) === parent_id)) {
        return res.status(400).json({ message: 'parent_id does not exist' });
    }

    const id = Date.now();

    const created = {
        id,
        full_name,
        name,
        acronym,
        active,
        parent_id,
    };

    rows.push(created);
    data.apfs_organization = rows;
    saveData(data);

    return res.status(201).json(created);
});

// UPDATE
app.put(`${API_PREFIX}/apfs-organization/:id`, (req, res) => {
    const data = loadData();
    const rows = Array.isArray(data.apfs_organization) ? data.apfs_organization : [];
    const id = Number(req.params.id);

    const idx = rows.findIndex(r => Number(r.id) === id);
    if (idx === -1) return res.status(404).json({ message: 'Org not found' });

    const full_name = String(req.body.full_name ?? '').trim();
    if (!full_name) return res.status(400).json({ message: 'full_name is required' });

    const name = String(req.body.name ?? '').trim();
    const acronym = String(req.body.acronym ?? '').trim();
    const active = Number(req.body.active) === 0 ? 0 : 1;

    const parent_id_raw = req.body.parent_id;
    const parent_id =
        parent_id_raw === null || parent_id_raw === undefined || String(parent_id_raw).trim() === ''
            ? null
            : Number(parent_id_raw);

    if (parent_id !== null) {
        if (parent_id === id) return res.status(400).json({ message: 'parent_id cannot equal id' });
        if (!rows.some(r => Number(r.id) === parent_id)) {
            return res.status(400).json({ message: 'parent_id does not exist' });
        }
    }

    const updated = {
        ...rows[idx],
        full_name,
        name,
        acronym,
        active,
        parent_id,
    };

    rows[idx] = updated;
    data.apfs_organization = rows;
    saveData(data);

    return res.json(updated);
});

// =========================
// PUBLIC ORG OPTIONS (for unauthenticated request form)
// Returns a flat list for dropdowns: [{ id, full_name }]
// =========================
app.get(`${API_PREFIX}/public/apfs-organization/options`, (req, res) => {
    const data = loadData();
    const onlyActive = String(req.query.active ?? '') === '1';

    const rows = Array.isArray(data.apfs_organization) ? data.apfs_organization : [];

    const options = rows
        .map(r => ({
            id: Number(r.id),
            full_name: String(r.full_name ?? '').trim(),
            active: Number(r.active) === 0 ? 0 : 1,
        }))
        .filter(o => Number.isFinite(o.id) && !!o.full_name)
        .filter(o => !onlyActive || o.active === 1)
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
        .map(o => ({ id: o.id, full_name: o.full_name })); // sanitize output

    res.json(options);
});


// =============================
// OFFICES (CRUD)
// Table in db.json: "offices": []
// Columns:
// id, name, full_name, active, office_assignment_permissions_level_id, organization_id, aac_code
// =============================

// OPTIONS (public)
// GET /public/offices/options?active=1&organizationId=2
app.get(`${API_PREFIX}/public/offices/options`, (req, res) => {
    const data = loadData();
    const onlyActive = String(req.query.active ?? '') === '1';
    const organizationId = Number(req.query.organizationId);

    const roleRaw = String(req.query.role ?? '').trim().toLowerCase();

    // normalize role -> level id (tolerant)
    const roleToLevel = (role) => {
        if (!role) return null;

        // normalize whitespace
        const r = role.replace(/\s+/g, ' ').trim();

        // fuzzy contains matching
        if (r.includes('require')) return 1;
        if (r.includes('contract')) return 2;
        if (r.includes('coordinator')) return 3;

        return null;
    };

    const roleLevel = roleToLevel(roleRaw);
    console.log('[public/offices/options] role debug:', { roleRaw, roleLevel });

    const rows = Array.isArray(data.offices) ? data.offices : [];

    console.log('[public/offices/options] FULL offices array:\n',
        JSON.stringify(rows, null, 2)
    );
    console.log('[public/offices/options] totals', {
        rows: rows.length,
        sampleOrgIds: Array.from(new Set(rows.slice(0, 20).map(r => r.organization_id))).slice(0, 10),
        sampleActive: Array.from(new Set(rows.slice(0, 20).map(r => r.active))).slice(0, 10),
        sampleLevels: Array.from(new Set(rows.slice(0, 20).map(r => r.office_assignment_permissions_level_id))).slice(0, 10),
    });


    const sample = rows.filter(r => Number(r.organization_id) === 71).slice(0, 5);
    console.log('[public/offices/options] raw org 71 sample:', sample.map(r => ({
        id: r.id,
        organization_id: r.organization_id,
        office_assignment_permissions_level_id: r.office_assignment_permissions_level_id,
        keys: Object.keys(r)
    })));
    let options = rows
        .map(r => ({
            id: Number(r.id),
            full_name: String(r.full_name ?? '').trim(),
            active: Number(r.active) === 0 ? 0 : 1,
            organization_id: Number(r.organization_id),
            level_id: Number(r.office_assignment_permissions_level_id),
        }))
        .filter(o => Number.isFinite(o.id) && !!o.full_name)
        .filter(o => !Number.isFinite(organizationId) || o.organization_id === organizationId)
        .filter(o => !onlyActive || o.active === 1);

    console.log('[public/offices/options] mapped sample', options.slice(0, 15));

    // ✅ role filter (if provided and recognized)
    if (roleLevel != null) {
        options = options.filter(o => o.level_id === roleLevel);
    }

    options = options
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
        .map(o => ({ id: o.id, full_name: o.full_name, organization_id: o.organization_id, office_assignment_permissions_level_id: o.level_id })); // sanitize output
    console.log('[public/offices/options] after filters', {
        onlyActive,
        organizationId,
        roleLevel,
        count: options.length,
        distinctLevels: Array.from(new Set(options.map(o => o.office_assignment_permissions_level_id))),
        sample: options.slice(0, 15).map(o => ({
            id: o.id,
            full_name: o.full_name,
            organization_id: o.organization_id,
            level: o.office_assignment_permissions_level_id,
        }))
    });

    //tap(rows => console.log('[officeOptions$ rows]', rows))
    res.json(options);
});


// =========================
// OFFICES
// =========================

// LIST
// GET /api/offices?active=1&search=acq
app.get(`${API_PREFIX}/offices`, (req, res) => {
    const db = loadData();
    const offices = Array.isArray(db.offices) ? db.offices : [];

    const me = requireCurrentUser(req, res, db);
    if (!me) return;

    let scoped = scopeOfficesToUser(offices, me);

    // Optional filters
    if (req.query.active !== undefined) {
        const active = Number(req.query.active);
        if (active === 0 || active === 1) {
            scoped = scoped.filter(o => Number(o.active) === active);
        }
    }

    // ✅ ADD THIS
    const orgRaw = req.query.organization_id ?? req.query.organizationId;
    if (orgRaw !== undefined) {
        const orgId = Number(orgRaw);
        if (Number.isFinite(orgId)) {
            scoped = scoped.filter(o => Number(o.organization_id) === orgId);
        }
    }

    if (req.query.search) {
        const q = String(req.query.search).trim().toLowerCase();
        scoped = scoped.filter(o => {
            const name = String(o.name ?? '').toLowerCase();
            const full = String(o.full_name ?? '').toLowerCase();
            const aac = String(o.aac_code ?? '').toLowerCase();
            return name.includes(q) || full.includes(q) || aac.includes(q);
        });
    }

    res.json(scoped);
});

// READ ONE
// GET /api/offices/:id
app.get(`${API_PREFIX}/offices/:id`, (req, res) => {
    const db = loadData();
    const offices = Array.isArray(db.offices) ? db.offices : [];

    const me = requireCurrentUser(req, res, db);
    if (!me) return;

    const id = Number(req.params.id);
    const office = offices.find(o => Number(o.id) === id);
    if (!office) return res.status(404).json({ message: 'Office not found' });

    if (isSuperAdmin(me)) return res.json(office);

    if (isAdmin(me) && Number(office.organization_id) === Number(me.organization_id)) {
        return res.json(office);
    }

    return res.status(403).json({ message: 'Forbidden' });
});

// CREATE
// POST /api/offices
// body: { name, full_name, active?, office_assignment_permissions_level_id, organization_id?, aac_code? }
app.post(`${API_PREFIX}/offices`, (req, res) => {
    const db = loadData();
    if (!Array.isArray(db.offices)) db.offices = [];
    const rows = db.offices;

    const me = requireCurrentUser(req, res, db);
    if (!me) return;

    const name = String(req.body?.name ?? '').trim();
    const full_name = String(req.body?.full_name ?? '').trim();
    const requestedOrgId = Number(req.body?.organization_id);
    const office_assignment_permissions_level_id = Number(req.body?.office_assignment_permissions_level_id);
    const aac_code = String(req.body?.aac_code ?? '').trim();
    const active = Number(req.body?.active) === 0 ? 0 : 1;

    if (!name) return res.status(400).json({ message: 'name is required' });
    if (!full_name) return res.status(400).json({ message: 'full_name is required' });
    if (!Number.isFinite(office_assignment_permissions_level_id)) {
        return res.status(400).json({ message: 'office_assignment_permissions_level_id is required' });
    }

    // Org scope enforcement
    let organization_id;

    if (isSuperAdmin(me)) {
        organization_id = requestedOrgId;
        if (!Number.isFinite(organization_id)) {
            return res.status(400).json({ message: 'organization_id is required' });
        }
    } else if (isAdmin(me)) {
        if (!Number.isFinite(Number(me.organization_id))) {
            return res.status(403).json({ message: 'Admin user missing organization assignment' });
        }
        organization_id = Number(me.organization_id); // force it
    } else {
        return res.status(403).json({ message: 'Forbidden' });
    }

    // Prevent duplicates in same org by name
    const dupe = rows.some(r =>
        Number(r.organization_id) === Number(organization_id) &&
        String(r.name ?? '').trim().toLowerCase() === name.toLowerCase()
    );
    if (dupe) return res.status(409).json({ message: 'Office already exists in this organization' });

    const nextId = rows.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1;

    const created = {
        id: nextId,
        name,
        full_name,
        active,
        office_assignment_permissions_level_id,
        organization_id,
        aac_code,
    };

    rows.push(created);
    saveData(db);

    res.status(201).json(created);
});

// UPDATE
// PUT /api/offices/:id
app.put(`${API_PREFIX}/offices/:id`, (req, res) => {
    const db = loadData();
    if (!Array.isArray(db.offices)) db.offices = [];
    const rows = db.offices;

    const me = requireCurrentUser(req, res, db);
    if (!me) return;

    const id = Number(req.params.id);
    const idx = rows.findIndex(o => Number(o.id) === id);
    if (idx === -1) return res.status(404).json({ message: 'Office not found' });

    const existing = rows[idx];

    if (!isSuperAdmin(me)) {
        if (!isAdmin(me)) return res.status(403).json({ message: 'Forbidden' });

        if (Number(existing.organization_id) !== Number(me.organization_id)) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        // Prevent org move attempts
        if ('organization_id' in req.body && Number(req.body.organization_id) !== Number(existing.organization_id)) {
            return res.status(403).json({ message: 'Cannot change organization_id' });
        }
    }

    const updated = {
        ...existing,
        ...req.body,
        id: existing.id,
        // ensure Admin can't slip it in via spread
        organization_id: existing.organization_id,
    };

    rows[idx] = updated;
    saveData(db);

    res.json(updated);
});

// SOFT DELETE (Deactivate)
// DELETE /api/offices/:id
app.delete(`${API_PREFIX}/offices/:id`, (req, res) => {
    const db = loadData();
    if (!Array.isArray(db.offices)) db.offices = [];
    const rows = db.offices;

    const me = requireCurrentUser(req, res, db);
    if (!me) return;

    const id = Number(req.params.id);
    const idx = rows.findIndex(r => Number(r.id) === id);
    if (idx === -1) return res.status(404).json({ message: 'Office not found' });

    const existing = rows[idx];

    if (!isSuperAdmin(me)) {
        if (!isAdmin(me)) return res.status(403).json({ message: 'Forbidden' });
        if (Number(existing.organization_id) !== Number(me.organization_id)) {
            return res.status(403).json({ message: 'Forbidden' });
        }
    }

    rows[idx] = { ...existing, active: 0 };
    saveData(db);

    res.json({ message: 'Office deactivated', id });
});


// =========================
// SERVE ANGULAR APP
// =========================

// =========================
// SERVE ANGULAR APP
// =========================

const angularDistPath = path.join(__dirname, '..', 'dist', 'fourSite', 'browser');

console.log('[APFS] angularDistPath =', angularDistPath);
console.log('[APFS] index exists =', fs.existsSync(path.join(angularDistPath, 'index.html')));

// Serve Angular static files
app.use(express.static(angularDistPath));

// Angular SPA fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(angularDistPath, 'index.html'));
});

// =========================
// START SERVER
// =========================

app.listen(PORT, HOST, () => {
    console.log(`[APFS] listening on http://${HOST}:${PORT}`);
});