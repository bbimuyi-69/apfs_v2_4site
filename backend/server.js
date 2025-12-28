const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

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
// USER ROUTES
// =========================
app.get('/users', (req, res) => {
    const data = loadData();
    res.json(data.users);
});

app.get('/users/:id', (req, res) => {
    const userId = Number(req.params.id);
    const data = loadData();
    const user = data.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
});

app.post('/users', (req, res) => {
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

// GET all forecast records
app.get('/forecast-records', (req, res) => {
    const data = loadData();
    res.json(data.forecastRecords);
});

// GET one forecast record
app.get('/forecast-records/:id', (req, res) => {
    const recordId = Number(req.params.id);
    const data = loadData();

    const record = data.forecastRecords.find(r => r.id === recordId);
    if (!record) {
        return res.status(404).json({ error: 'Forecast record not found' });
    }

    res.json(record);
});

// CREATE forecast record
app.post('/forecast-records', (req, res) => {
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

        ...req.body
    };

    data.forecastRecords.push(newRecord);
    saveData(data);
    res.status(201).json(newRecord);
});

// UPDATE forecast record
app.put('/forecast-records/:id', (req, res) => {
    const recordId = Number(req.params.id);
    const data = loadData();

    const idx = data.forecastRecords.findIndex(r => r.id === recordId);
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
app.post('/forecast-records/:id/submit', (req, res) => {
    const recordId = Number(req.params.id);
    const data = loadData();

    const idx = data.forecastRecords.findIndex(r => r.id === recordId);
    if (idx === -1) {
        return res.status(404).json({ error: 'Forecast record not found' });
    }

    const existing = data.forecastRecords[idx];
    const submitted = {
        ...existing,
        status: 'Submitted',
        submittedAt: new Date().toISOString(),
        submittedBy: req.body?.submittedBy ?? null,
        updatedAt: new Date().toISOString(),
    };

    data.forecastRecords[idx] = submitted;
    saveData(data);
    res.json(submitted);
});

// =========================
// CLAIM / UNCLAIM
// =========================

// CLAIM a forecast record
app.post('/forecast-records/:id/claim', (req, res) => {
    const recordId = Number(req.params.id);
    const data = loadData();

    const idx = data.forecastRecords.findIndex(r => r.id === recordId);
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
app.post('/forecast-records/:id/unclaim', (req, res) => {
    const recordId = Number(req.params.id);
    const data = loadData();

    const idx = data.forecastRecords.findIndex(r => r.id === recordId);
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

    const unclaimed = {
        ...existing,
        assignedToUserId: null,
        assignedToName: null,
        assignedAt: null,
        updatedAt: new Date().toISOString(),
    };

    data.forecastRecords[idx] = unclaimed;
    saveData(data);
    res.json(unclaimed);
});

// =========================
// START SERVER
// =========================
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
