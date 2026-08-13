const express = require("express");
const session = require("express-session");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "shreyash@8081";
const DB_FILE = path.join(__dirname, "data.json");

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = {
      students: [],
      candidates: [
        { id: 1, name: "Shreyash singh", position: "College President", className: "BCA 2rd Year" },
        { id: 2, name: "Utkarsh kumar", position: "College President", className: "BCA 2rd Year" },
        { id: 3, name: "Bikas vind", position: "College President", className: "BCA 2rd Year" }
      ],
      votes: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "replace-this-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: false }
}));

// Yahan public hata kar direct root directory set kar di hai kyunki index.html main folder mein hai
app.use(express.static(__dirname));

function student(req, res, next) {
  if (!req.session.student) return res.status(401).json({ error: "Please login first." });
  next();
}

function admin(req, res, next) {
  if (!req.session.admin) return res.status(401).json({ error: "Admin login required." });
  next();
}

app.post("/api/register", (req, res) => {
  const { studentId, name, password } = req.body;
  if (!studentId || !name || !password || password.length < 4)
    return res.status(400).json({ error: "Student ID, name and 4+ character password are required." });

  const db = loadDB();
  if (db.students.some(s => s.studentId === studentId.trim()))
    return res.status(409).json({ error: "Student ID already registered." });

  db.students.push({
    id: Date.now(),
    studentId: studentId.trim(),
    name: name.trim(),
    password,
    hasVoted: false
  });
  saveDB(db);
  res.json({ ok: true, message: "Registration successful. Please login." });
});

app.post("/api/login", (req, res) => {
  const db = loadDB();
  const s = db.students.find(x => x.studentId === req.body.studentId?.trim() && x.password === req.body.password);
  if (!s) return res.status(401).json({ error: "Invalid Student ID or password." });
  req.session.student = { id: s.id, studentId: s.studentId, name: s.name };
  res.json({ ok: true });
});

app.post("/api/logout", (req, res) => req.session.destroy(() => res.json({ ok: true })));

app.get("/api/me", (req, res) => {
  if (!req.session.student) return res.json({ loggedIn: false });
  const db = loadDB();
  const s = db.students.find(x => x.id === req.session.student.id);
  res.json({ loggedIn: true, student: { ...req.session.student, hasVoted: !!s?.hasVoted } });
});

app.get("/api/candidates", (req, res) => {
  const db = loadDB();
  res.json(db.candidates);
});

app.post("/api/vote", student, (req, res) => {
  const db.loadDB = loadDB;
  const db = loadDB();
  const s = db.students.find(x => x.id === req.session.student.id);
  const candidateId = Number(req.body.candidateId);

  if (!s) return res.status(401).json({ error: "Student not found." });
  if (s.hasVoted) return res.status(409).json({ error: "You have already voted." });
  if (!db.candidates.some(c => c.id === candidateId))
    return res.status(400).json({ error: "Invalid candidate." });

  db.votes.push({
    id: Date.now(),
    studentId: s.id,
    candidateId,
    createdAt: new Date().toISOString()
  });
  s.hasVoted = true;
  saveDB(db);
  res.json({ ok: true, message: "Your vote has been recorded successfully." });
});

app.post("/api/admin/login", (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD)
    return res.status(401).json({ error: "Wrong admin password." });
  req.session.admin = true;
  res.json({ ok: true });
});

app.get("/api/admin/results", admin, (req, res) => {
  const db = loadDB();
  const results = db.candidates.map(c => ({
    ...c,
    votes: db.votes.filter(v => v.candidateId === c.id).length
  })).sort((a,b) => b.votes - a.votes || a.name.localeCompare(b.name));

  res.json({
    results,
    totalVotes: db.votes.length,
    totalStudents: db.students.length
  });
});

app.listen(PORT, () => console.log(`College voting app running at http://localhost:${PORT}`));
