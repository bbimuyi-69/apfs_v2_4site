// server.js (cleaned up / drop-in)
// CommonJS-friendly

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const API_PREFIX = '/api';
const PORT = 3000;

const app = express();

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

const DB_FILE = path.join(__dirname, 'db.json');

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
    return `APFS-${fy}-${comp}-${rand}`;
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

// LIST
app.get(`${API_PREFIX}/forecast-records`, (req, res) => {
    const db = loadData();
    const me = getCurrentUser(req, db);
    if (!me) return res.status(401).json({ message: 'Not authenticated' });

    const rows = (db.forecastRecords || []).filter((r) => r.component === me.component);
    res.json({ rows, total: rows.length });
});

// GET ONE (WITH HISTORY)
app.get(`${API_PREFIX}/forecast-records/:id`, (req, res) => {
    const db = loadData();
    const me = getCurrentUser(req, db);
    if (!me) return res.status(401).json({ message: 'Not authenticated' });

    const id = Number(req.params.id);
    const record = (db.forecastRecords || []).find((r) => Number(r.id) === id);
    if (!record) return res.status(404).json({ error: 'Not found' });
    if (record.component !== me.component) return res.status(403).json({ message: 'Forbidden' });

    const history = getHistoryForRecord(db, id);
    res.json({ ...record, history });
});

// CREATE
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
    if (existing.component !== me.component) return res.status(403).json({ message: 'Forbidden' });

    const now = new Date().toISOString();

    // client can update editable fields, but server protects core fields
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

    // Optional: add history row for "Updated" (commented out for now)
    // clearLatestHistoryFlag(db, id);
    // db.recordHistory.push(
    //   makeHistoryRow({
    //     forecastId: id,
    //     user: me,
    //     comment: 'Updated',
    //     assignmentDisplay: updated.assignedToName ?? null,
    //     assignmentId: updated.assignedToUserId ?? null,
    //     previousStateId: laneOrderKey(existing.workflowStatus ?? existing.status),
    //     newStateId: laneOrderKey(updated.workflowStatus ?? updated.status),
    //     latest: true,
    //   })
    // );
    // saveData(db);

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
    if (r.component !== me.component) return res.status(403).json({ message: 'Forbidden' });

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
    if (r.component !== me.component) return res.status(403).json({ message: 'Forbidden' });

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
    if (existing.component !== me.component) return res.status(403).json({ message: 'Forbidden' });

    const requesterId = req.body?.userId ?? null;
    const force = !!req.body?.force;

    if (!requesterId) return res.status(400).json({ error: 'userId is required' });

    // Trust user from DB
    const user = (db.users || []).find((u) => String(u.id) === String(requesterId));
    if (!user || user.isActive === false) return res.status(401).json({ error: 'Unauthorized' });

    const now = new Date().toISOString();

    const currentAssignee = existing.assignedToUserId ? String(existing.assignedToUserId) : null;
    const meId = String(user.id);

    // Idempotent
    if (currentAssignee && currentAssignee === meId) {
        return res.json({ ...existing, history: getHistoryForRecord(db, id) });
    }

    // Taken by someone else and not forcing
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

    // history
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
    if (existing.component !== me.component) return res.status(403).json({ message: 'Forbidden' });

    const requesterId = req.body?.userId ?? null;
    const force = !!req.body?.force;

    const currentAssignee = existing.assignedToUserId ? String(existing.assignedToUserId) : null;

    // If assigned and caller isn't assignee, block unless force
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
    const id = Number(req.params.id);
    const userId = req.query.userId != null ? Number(req.query.userId) : null;
    const force = String(req.query.force).toLowerCase() === 'true';

    const data = loadData();
    const rec = data.forecastRecords.find(r => Number(r.id) === id);

    if (!rec) return res.status(404).json({ message: 'Record not found' });

    const assigned = rec.assignedToUserId != null ? Number(rec.assignedToUserId) : null;

    // if assigned to someone else, block
    if (assigned != null && userId != null && assigned !== userId) {
        return res.status(403).json({ message: 'Only assignee can delete' });
    }

    // if assigned and not forcing, require force
    if (assigned != null && !force) {
        return res.status(409).json({ message: 'Force delete required for assigned record' });
    }

    data.forecastRecords = data.forecastRecords.filter(r => Number(r.id) !== id);

    // optional: history entry
    clearLatestHistoryFlag(data, id);
    data.recordHistory.push(
        makeHistoryRow({
            forecastId: id,
            user: getCurrentUser(req, data),
            comment: force ? 'Force deleted record' : 'Deleted record',
            assignmentDisplay: rec.assignedToName ?? null,
            assignmentId: rec.assignedToUserId ?? null,
            previousStateId: laneOrderKey(rec.workflowStatus ?? rec.status),
            newStateId: laneOrderKey(rec.workflowStatus ?? rec.status),
            latest: true,
        })
    );


    saveData(data);
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

// GET all by admin role and component
// GET org tree scoped to current admin's component
app.get(`${API_PREFIX}/apfs-organization/tree/scoped`, (req, res) => {
    const db = loadData();

    const me = getCurrentUser(req, db);
    if (!me) return res.status(401).json({ error: 'Unauthorized' });

    // Only Admins should use this (optional: allow APFS Coordinator too if you want)
    if (String(me.role) !== 'Admin') {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const myComponent = String(me.component || '').trim();
    if (!myComponent) return res.status(400).json({ error: 'Missing user component' });

    const onlyActive = String(req.query.active ?? '') === '1';

    const rows = Array.isArray(db.apfs_organization) ? db.apfs_organization : [];

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

    // Find the component root node (match acronym first, then name)
    const root = normalized.find(r => String(r.acronym).trim() === myComponent)
        ?? normalized.find(r => String(r.name).trim() === myComponent);

    if (!root) {
        // if component doesn't map to an org root, return empty tree instead of 404
        return res.json([]);
    }

    // Build byId map
    const byId = new Map();
    for (const r of normalized) byId.set(r.id, { ...r, children: [] });

    // Attach children
    const roots = [];
    for (const node of byId.values()) {
        if (node.parent_id !== null && byId.has(node.parent_id)) {
            byId.get(node.parent_id).children.push(node);
        } else {
            roots.push(node);
        }
    }

    // Sort recursively (same as before)
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

    // Return ONLY the subtree rooted at the admin's component org
    const scopedRoot = byId.get(root.id);
    if (!scopedRoot) return res.json([]);

    sortTree(scopedRoot.children);

    res.json(scopedRoot); // single node (component root + children)
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


// =========================
// START SERVER
// =========================

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Press Ctrl+C to stop the server');
});
