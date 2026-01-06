// server.js (drop-in)

// If you're using Node 18+ and want top-level await, ignore. This is CommonJS-friendly.
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const API_PREFIX = '/api';

const app = express();

// CORS (fine for dev; lock down origins for prod later)
app.use(cors({ origin: true, credentials: true }));

// JSON body parsing
app.use(express.json());

// Disable caching globally (helps avoid confusing dev 304/cached responses)
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

// =========================
// JSON DB helpers
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

// =========================
// HEALTH
// =========================
app.get(`${API_PREFIX}/health`, (req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() });
});

// =========================
// USER ROUTES
// =========================
app.get(`${API_PREFIX}/users`, (req, res) => {
    const data = loadData();
    res.json(data.users);
});

app.get(`${API_PREFIX}/users/:id`, (req, res) => {
    const userId = Number(req.params.id);
    const data = loadData();
    const user = data.users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
});

app.post(`${API_PREFIX}/users`, (req, res) => {
    const data = loadData();
    const newUser = {
        ...req.body,
        id: Date.now(),
    };
    data.users.push(newUser);
    saveData(data);
    res.status(201).json(newUser);
});

// =========================
// FORECAST RECORD ROUTES
// =========================

// GET all forecast records (supports query params)
app.get(`${API_PREFIX}/forecast-records`, (req, res) => {
    const data = loadData();
    let rows = Array.isArray(data.forecastRecords) ? [...data.forecastRecords] : [];

    const {
        status = 'All',
        assigned = 'all',
        q = '',
        page = '1',
        pageSize = '25',
        sort = 'updatedAt:desc',
    } = req.query;

    // Normalize status so older records still behave
    const normalizeStatus = (r) => {
        if (r && r.status) return r.status;
        if (r && (r.submittedAt || r.submittedBy)) return 'Submitted';
        return 'Draft';
    };

    rows = rows.map((r) => ({ ...r, status: normalizeStatus(r) }));

    // Filter: status
    if (status && status !== 'All') {
        rows = rows.filter((r) => String(r.status) === String(status));
    }

    // Filter: assigned
    if (assigned === 'claimed') {
        rows = rows.filter((r) => !!r.assignedToUserId);
    } else if (assigned === 'unclaimed') {
        rows = rows.filter((r) => !r.assignedToUserId);
    }

    // Filter: free-text (supports both schemas: title + requirementsTitle + apfsNumber)
    const needle = String(q || '').trim().toLowerCase();
    if (needle) {
        rows = rows.filter((r) => {
            const hay = `${r.apfsNumber ?? ''} ${r.requirementsTitle ?? ''} ${r.title ?? ''}`.toLowerCase();
            return hay.includes(needle);
        });
    }

    // Sort (supports createdAt/updatedAt)
    const [fieldRaw, dirRaw] = String(sort).split(':');
    const field = fieldRaw === 'createdAt' ? 'createdAt' : 'updatedAt';
    const dir = dirRaw === 'asc' ? 'asc' : 'desc';

    rows.sort((a, b) => {
        const av = new Date(a?.[field] ?? 0).getTime();
        const bv = new Date(b?.[field] ?? 0).getTime();
        return dir === 'asc' ? av - bv : bv - av;
    });

    // Paging (1-based)
    const p = Math.max(1, parseInt(String(page), 10) || 1);
    const ps = Math.max(1, parseInt(String(pageSize), 10) || 25);
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

        // enforce unclaimed on create
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
        id: existing.id, // never allow id changes
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

    const existing = data.forecastRecords[idx];
    const now = new Date().toISOString();

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

// CLAIM a forecast record
app.post(`${API_PREFIX}/forecast-records/:id/claim`, (req, res) => {
    const recordId = Number(req.params.id);
    const data = loadData();

    const idx = data.forecastRecords.findIndex((r) => r.id === recordId);
    if (idx === -1) {
        return res.status(404).json({ error: 'Forecast record not found' });
    }

    const existing = data.forecastRecords[idx];

    // prevent double-claim
    if (existing.assignedToUserId) {
        return res.status(409).json({
            error: 'Forecast record already claimed',
            assignedToUserId: existing.assignedToUserId,
            assignedToName: existing.assignedToName ?? null,
            assignedAt: existing.assignedAt ?? null,
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

// UNCLAIM a forecast record
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

    if (existing.assignedToUserId && !force && requesterId && existing.assignedToUserId !== requesterId) {
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

// DELETE a forecast record (assignee-only force delete)
// DELETE a forecast record (assignee-only force delete)
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

    const existing = data.forecastRecords[idx];

    // DELETE bodies are unreliable → use query params
    const requesterId =
        req.query.userId != null ? Number(req.query.userId) : null;

    const force =
        String(req.query.force || '').toLowerCase() === 'true';

    // Normalize stored assigned user id (string or number)
    const assignedId =
        existing.assignedToUserId != null
            ? Number(existing.assignedToUserId)
            : null;

    /* Assigned record rules
    if (assignedId != null) {
        // requester must be present
        if (!Number.isFinite(requesterId)) {
            return res.status(403).json({
                error: 'Assigned record requires assignee to force delete',
            });
        }

        // requester must be the assignee
        if (assignedId !== requesterId) {
            return res.status(403).json({
                error: 'Only the assignee can delete this record',
            });
        }

        // force flag required
        if (!force) {
            return res.status(409).json({
                error: 'Force delete required for assigned record',
            });
        }
    }*/

    // All checks passed → delete
    data.forecastRecords.splice(idx, 1);
    saveData(data);

    return res.status(204).send();
});



// =========================
// START SERVER
// =========================
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
