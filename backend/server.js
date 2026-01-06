// server.js (drop-in)
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

// CORS (lock down later for prod)
app.use(cors({ origin: true, credentials: true }));

// JSON parsing
app.use(express.json());

// Disable caching (prevents confusing dev caching issues)
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

// =========================
// JSON DB HELPERS
// =========================

const DB_FILE = path.join(__dirname, 'db.json');

function loadData() {
    if (!fs.existsSync(DB_FILE)) {
        return { users: [], forecastRecords: [] };
    }

    const raw = fs.readFileSync(DB_FILE, 'utf8').trim();
    if (!raw) return { users: [], forecastRecords: [] };

    const data = JSON.parse(raw);
    if (!data.users) data.users = [];
    if (!data.forecastRecords) data.forecastRecords = [];
    return data;
}

function saveData(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function findUserByEmail(data, emailRaw) {
    const email = String(emailRaw || '').trim().toLowerCase();
    if (!email) return null;

    return data.users.find(
        (u) => String(u.email || '').trim().toLowerCase() === email
    );
}

function sanitizeUser(user) {
    if (!user) return user;
    const { password, passwordHash, ...safe } = user;
    return safe;
}

// =========================
// HEALTH
// =========================

app.get(`${API_PREFIX}/health`, (req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() });
});

// =========================
// AUTH ROUTES (DEV MODE)
// =========================

// Login by email (dev-only; Okta/JWT later)
app.post(`${API_PREFIX}/auth/login`, (req, res) => {
    const { email } = req.body || {};
    const data = loadData();

    const user = findUserByEmail(data, email);
    if (!user || user.isActive === false) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.json({
        token: 'dev-token',
        user: sanitizeUser(user),
    });
});

// Who-am-I endpoint
app.get(`${API_PREFIX}/auth/me`, (req, res) => {
    const data = loadData();

    const email =
        req.header('x-user-email') ||
        req.query.email;

    const user = findUserByEmail(data, email);
    if (!user || user.isActive === false) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    res.json({ user: sanitizeUser(user) });
});

// =========================
// USER ROUTES
// =========================

app.get(`${API_PREFIX}/users`, (req, res) => {
    const data = loadData();
    res.json(data.users.map(sanitizeUser));
});

app.get(`${API_PREFIX}/users/:id`, (req, res) => {
    const userId = Number(req.params.id);
    const data = loadData();

    const user = data.users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json(sanitizeUser(user));
});

app.get(`${API_PREFIX}/users/by-email/:email`, (req, res) => {
    const data = loadData();
    const user = findUserByEmail(data, req.params.email);

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(sanitizeUser(user));
});

app.post(`${API_PREFIX}/users`, (req, res) => {
    const data = loadData();

    const newUser = {
        ...req.body,
        id: Date.now(),
    };

    data.users.push(newUser);
    saveData(data);

    res.status(201).json(sanitizeUser(newUser));
});

// =========================
// FORECAST RECORD ROUTES
// =========================

// GET all forecast records (queryable)
app.get(`${API_PREFIX}/forecast-records`, (req, res) => {
    const data = loadData();
    let rows = Array.isArray(data.forecastRecords)
        ? [...data.forecastRecords]
        : [];

    const {
        status = 'All',
        assigned = 'all',
        q = '',
        page = '1',
        pageSize = '25',
        sort = 'updatedAt:desc',
    } = req.query;

    const normalizeStatus = (r) => {
        if (r?.status) return r.status;
        if (r?.submittedAt || r?.submittedBy) return 'Submitted';
        return 'Draft';
    };

    rows = rows.map((r) => ({ ...r, status: normalizeStatus(r) }));

    if (status !== 'All') {
        rows = rows.filter((r) => String(r.status) === String(status));
    }

    if (assigned === 'claimed') {
        rows = rows.filter((r) => !!r.assignedToUserId);
    } else if (assigned === 'unclaimed') {
        rows = rows.filter((r) => !r.assignedToUserId);
    }

    const needle = String(q).trim().toLowerCase();
    if (needle) {
        rows = rows.filter((r) => {
            const hay =
                `${r.apfsNumber ?? ''} ${r.requirementsTitle ?? ''} ${r.title ?? ''}`
                    .toLowerCase();
            return hay.includes(needle);
        });
    }

    const [fieldRaw, dirRaw] = String(sort).split(':');
    const field = fieldRaw === 'createdAt' ? 'createdAt' : 'updatedAt';
    const dir = dirRaw === 'asc' ? 'asc' : 'desc';

    rows.sort((a, b) => {
        const av = new Date(a?.[field] ?? 0).getTime();
        const bv = new Date(b?.[field] ?? 0).getTime();
        return dir === 'asc' ? av - bv : bv - av;
    });

    const p = Math.max(1, parseInt(page, 10));
    const ps = Math.max(1, parseInt(pageSize, 10));
    const start = (p - 1) * ps;

    res.json(rows.slice(start, start + ps));
});

// GET one forecast record
app.get(`${API_PREFIX}/forecast-records/:id`, (req, res) => {
    const recordId = Number(req.params.id);
    const data = loadData();

    const record = data.forecastRecords.find((r) => r.id === recordId);
    if (!record) {
        return res.status(404).json({ error: 'Forecast record not found' });
    }

    res.json(record);
});

// CREATE forecast record
app.post(`${API_PREFIX}/forecast-records`, (req, res) => {
    const data = loadData();
    const now = new Date().toISOString();

    const newRecord = {
        id: Date.now(),
        status: req.body?.status ?? 'Draft',
        createdAt: now,
        updatedAt: now,

        assignedToUserId: null,
        assignedToName: null,
        assignedAt: null,

        ...req.body,
    };

    data.forecastRecords.push(newRecord);
    saveData(data);

    res.status(201).json(newRecord);
});

// UPDATE forecast record
app.put(`${API_PREFIX}/forecast-records/:id`, (req, res) => {
    const recordId = Number(req.params.id);
    const data = loadData();

    const idx = data.forecastRecords.findIndex((r) => r.id === recordId);
    if (idx === -1) {
        return res.status(404).json({ error: 'Forecast record not found' });
    }

    const existing = data.forecastRecords[idx];

    const updated = {
        ...existing,
        ...req.body,
        id: existing.id,
        updatedAt: new Date().toISOString(),
    };

    data.forecastRecords[idx] = updated;
    saveData(data);

    res.json(updated);
});

// SUBMIT forecast record
app.post(`${API_PREFIX}/forecast-records/:id/submit`, (req, res) => {
    const recordId = Number(req.params.id);
    const data = loadData();

    const idx = data.forecastRecords.findIndex((r) => r.id === recordId);
    if (idx === -1) {
        return res.status(404).json({ error: 'Forecast record not found' });
    }

    const now = new Date().toISOString();
    const existing = data.forecastRecords[idx];

    const submitted = {
        ...existing,
        status: 'Submitted',
        submittedAt: now,
        submittedBy: req.body?.submittedBy ?? null,
        updatedAt: now,
    };

    data.forecastRecords[idx] = submitted;
    saveData(data);

    res.json(submitted);
});

// =========================
// CLAIM / UNCLAIM
// =========================

app.post(`${API_PREFIX}/forecast-records/:id/claim`, (req, res) => {
    const recordId = Number(req.params.id);
    const data = loadData();

    const idx = data.forecastRecords.findIndex((r) => r.id === recordId);
    if (idx === -1) {
        return res.status(404).json({ error: 'Forecast record not found' });
    }

    const existing = data.forecastRecords[idx];
    if (existing.assignedToUserId) {
        return res.status(409).json({
            error: 'Forecast record already claimed',
            assignedToUserId: existing.assignedToUserId,
            assignedToName: existing.assignedToName,
            assignedAt: existing.assignedAt,
        });
    }

    const now = new Date().toISOString();

    const claimed = {
        ...existing,
        assignedToUserId: req.body?.userId ?? null,
        assignedToName: req.body?.userName ?? null,
        assignedAt: now,
        updatedAt: now,
    };

    data.forecastRecords[idx] = claimed;
    saveData(data);

    res.json(claimed);
});

app.post(`${API_PREFIX}/forecast-records/:id/unclaim`, (req, res) => {
    const recordId = Number(req.params.id);
    const data = loadData();

    const idx = data.forecastRecords.findIndex((r) => r.id === recordId);
    if (idx === -1) {
        return res.status(404).json({ error: 'Forecast record not found' });
    }

    const existing = data.forecastRecords[idx];
    const requesterId = req.body?.userId ?? null;
    const force = !!req.body?.force;

    if (
        existing.assignedToUserId &&
        !force &&
        requesterId &&
        existing.assignedToUserId !== requesterId
    ) {
        return res.status(403).json({
            error: 'Only the assignee can unclaim this record',
        });
    }

    const now = new Date().toISOString();

    const unclaimed = {
        ...existing,
        assignedToUserId: null,
        assignedToName: null,
        assignedAt: null,
        updatedAt: now,
    };

    data.forecastRecords[idx] = unclaimed;
    saveData(data);

    res.json(unclaimed);
});

// =========================
// DELETE forecast record
// =========================

app.delete(`${API_PREFIX}/forecast-records/:id`, (req, res) => {
    const recordId = Number(req.params.id);
    if (!Number.isFinite(recordId)) {
        return res.status(400).json({ error: 'Invalid record id' });
    }

    const data = loadData();
    const idx = data.forecastRecords.findIndex(r => Number(r.id) === recordId);

    if (idx === -1) {
        return res.status(404).json({ error: 'Forecast record not found' });
    }

    data.forecastRecords.splice(idx, 1);
    saveData(data);

    res.status(204).send();
});

// =========================
// START SERVER
// =========================

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
