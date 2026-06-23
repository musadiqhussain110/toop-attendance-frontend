import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Check, Clock, Users, BarChart3, Plus, Trash2, Search, ChevronLeft, ChevronRight,
  Download, X, Pencil, CalendarDays, Feather, LogOut, LogIn, ShieldCheck, KeyRound,
  ArrowRightCircle, ArrowLeftCircle, Lock,
} from "lucide-react";
import toopLogo from "./toop.png";
/* ================================================================== */
/*  TOOP brand                                                        */
/* ================================================================== */

const TOOP_RED = "#D93A2C";
const TOOP_RED_DARK = "#B22F23";
const TOOP_RED_SOFT = "#FBEAE8";

function ToopMark({ className = "h-12 w-12" }) {
  return (
    <img
src={toopLogo}
      alt="TOOP — The Order of Pen"
      className={`${className} object-contain select-none`}
      draggable="false"
    />
  );
}
/* Brand chrome that Tailwind core classes can't express (exact red + hover). */
function BrandStyles() {
  return (
    <style>{`
      .toop-btn{background:${TOOP_RED};color:#fff;transition:background .15s}
      .toop-btn:hover{background:${TOOP_RED_DARK}}
      .toop-btn:disabled{opacity:.45}
      .toop-tab-active{background:${TOOP_RED};color:#fff}
      .toop-soft{background:${TOOP_RED_SOFT};color:${TOOP_RED_DARK}}
      .toop-text{color:${TOOP_RED}}
    `}</style>
  );
}

/* ================================================================== */
/*  Constants & helpers                                               */
/* ================================================================== */

const STATUSES = [
  { key: "present", label: "Present",  short: "P",  timed: true,  solid: "bg-emerald-500", soft: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  { key: "late",    label: "Late",     short: "L",  timed: true,  solid: "bg-amber-500",   soft: "bg-amber-50 text-amber-700 ring-amber-200",       dot: "bg-amber-500" },
  { key: "halfday", label: "Half day", short: "HD", timed: true,  solid: "bg-sky-500",     soft: "bg-sky-50 text-sky-700 ring-sky-200",             dot: "bg-sky-500" },
  { key: "leave",   label: "Leave",    short: "Lv", timed: false, solid: "bg-violet-500",  soft: "bg-violet-50 text-violet-700 ring-violet-200",    dot: "bg-violet-500" },
  { key: "absent",  label: "Absent",   short: "A",  timed: false, solid: "bg-rose-500",    soft: "bg-rose-50 text-rose-700 ring-rose-200",          dot: "bg-rose-500" },
];
const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.key, s]));

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

const pad = (n) => String(n).padStart(2, "0");
const toDateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const formatLong = (d) => `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
const nowHHMM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const sameDay = (a, b) => toDateKey(a) === toDateKey(b);
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : "u" + Date.now() + Math.random().toString(36).slice(2, 8);

// Prototype policy only. In production this must come from the backend .env, not the browser.
const LATE_AFTER = "09:15";
const hhmmToMinutes = (t) => {
  if (!/^\d{2}:\d{2}$/.test(String(t || ""))) return null;
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + m;
};
const isLateCheckIn = (time) => {
  const checkedAt = hhmmToMinutes(time);
  const lateAfter = hhmmToMinutes(LATE_AFTER);
  return checkedAt != null && lateAfter != null && checkedAt > lateAfter;
};
const sourceLabel = (record) => record?.source === "self" ? "Employee marked" : record?.source === "admin" ? "Admin marked" : "Marked";
const fmtMarkedAt = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const AVATAR_COLORS = ["bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500"];
const colorFor = (s) => AVATAR_COLORS[[...(s || "x")].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
const initials = (name) => (name || "").trim().split(/\s+/).slice(0, 2).map((w) => (w[0] || "").toUpperCase()).join("") || "?";

const workedMinutes = (rec) => {
  if (!rec || !rec.inTime || !rec.outTime) return 0;
  const [ih, im] = rec.inTime.split(":").map(Number);
  const [oh, om] = rec.outTime.split(":").map(Number);
  const m = (oh * 60 + om) - (ih * 60 + im);
  return m > 0 ? m : 0;
};
const fmtDuration = (m) => (m ? `${Math.floor(m / 60)}h ${pad(m % 60)}m` : "—");

/* Not real security — a digest so passwords aren't stored as plain text in a prototype.
   Real auth must hash + verify on a server (bcrypt) and never trust the client. */
async function hashPassword(pw) {
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("toop::" + pw));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch (_) {}
  let h = 0; for (let i = 0; i < pw.length; i++) h = (h * 31 + pw.charCodeAt(i)) | 0;
  return "f" + (h >>> 0).toString(16);
}

const SEED = [
  { uid: "seed-1", name: "Ayesha Khan",  empId: "E-001", dept: "Visa Processing",  username: "ayesha" },
  { uid: "seed-2", name: "Bilal Ahmed",  empId: "E-002", dept: "Ticketing",        username: "bilal" },
  { uid: "seed-3", name: "Sana Malik",   empId: "E-003", dept: "Umrah Packages",   username: "sana" },
  { uid: "seed-4", name: "Hamza Sheikh", empId: "E-004", dept: "Sales",            username: "hamza" },
  { uid: "seed-5", name: "Fatima Noor",  empId: "E-005", dept: "Customer Support", username: "fatima" },
];

const store = {
  async get(key, shared = true) {
    try {
      if (typeof window !== "undefined" && window.storage) {
        const r = await window.storage.get(key, shared);
        return r ? r.value : null;
      }
    } catch (_) {}
    return null;
  },
  async set(key, value, shared = true) {
    try {
      if (typeof window !== "undefined" && window.storage) await window.storage.set(key, value, shared);
    } catch (e) { console.error("Storage write failed:", e); }
  },
};
const parse = (raw) => { try { return raw ? JSON.parse(raw) : null; } catch (_) { return null; } };

const downloadCSV = (filename, rows) => {
  const csv = rows.map((r) => r.map((c) => {
    const s = String(c ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

/* ================================================================== */
/*  Small UI pieces                                                   */
/* ================================================================== */

function Avatar({ name, uid: u, size = "h-10 w-10" }) {
  return (
    <div className={`${size} ${colorFor(u || name)} shrink-0 rounded-full flex items-center justify-center text-white text-sm font-semibold shadow-sm`}>
      {initials(name)}
    </div>
  );
}

function EmptyState({ title, body, icon: Icon = Users }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 p-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <Icon className="h-6 w-6 text-slate-400" />
      </div>
      <div className="font-semibold text-slate-700">{title}</div>
      <div className="mt-1 text-sm text-slate-500">{body}</div>
    </div>
  );
}

function StatusPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {STATUSES.map((opt) => {
        const active = value === opt.key;
        return (
          <button key={opt.key} onClick={() => onChange(opt.key)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${active ? `${opt.solid} text-white shadow-sm` : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function TimedDetail({ record, onIn, onOut, onNote }) {
  const s = STATUS_MAP[record.status];
  const mins = workedMinutes(record);
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:flex-wrap sm:items-center">
      {s.timed && (
        <>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            <ArrowRightCircle className="h-4 w-4 text-emerald-500" /> In
            <input type="time" value={record.inTime || ""} onChange={(e) => onIn(e.target.value)}
              className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:border-slate-400 focus:outline-none" />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            <ArrowLeftCircle className="h-4 w-4 text-rose-500" /> Out
            <input type="time" value={record.outTime || ""} onChange={(e) => onOut(e.target.value)}
              className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:border-slate-400 focus:outline-none" />
          </label>
          <span className="text-xs font-medium text-slate-500">{fmtDuration(mins)}</span>
        </>
      )}
      <input type="text" value={record.note || ""} onChange={(e) => onNote(e.target.value)}
        placeholder={record.status === "absent" || record.status === "leave" ? "Reason (optional)" : "Note (optional)"}
        className="flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-slate-400 focus:outline-none" />
      <span className={`inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${s.soft}`}>
        <span className={`h-2 w-2 rounded-full ${s.dot}`} /> {s.label}
      </span>
      <span className="self-start rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
        {sourceLabel(record)}{fmtMarkedAt(record.markedAt) ? ` · ${fmtMarkedAt(record.markedAt)}` : ""}
      </span>
    </div>
  );
}

/* ================================================================== */
/*  Root                                                              */
/* ================================================================== */

export default function TOOPAttendancePortal() {
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState({}); // { dateKey: { uid: {status,inTime,outTime,note,source,markedAt} } }
  const [admin, setAdmin] = useState(null);          // { username, passHash }
  const [session, setSession] = useState(null);      // { role, uid, name } — memory only

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let emps = parse(await store.get("toop:employees"));
      const att = parse(await store.get("toop:attendance")) || {};
      let adm = parse(await store.get("toop:admin"));

      if (!Array.isArray(emps) || emps.length === 0) {
        emps = [];
        for (const s of SEED) emps.push({ ...s, passHash: await hashPassword("toop123") });
        store.set("toop:employees", JSON.stringify(emps));
      }
      if (!adm) {
        adm = { username: "admin", passHash: await hashPassword("admin123") };
        store.set("toop:admin", JSON.stringify(adm));
      }
      if (cancelled) return;
      setEmployees(emps); setAttendance(att); setAdmin(adm); setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const persistEmployees = useCallback((list) => store.set("toop:employees", JSON.stringify(list)), []);
  const persistAttendance = useCallback((map) => store.set("toop:attendance", JSON.stringify(map)), []);

  /* attendance mutations (explicit dateKey) */
  const setStatus = useCallback((dateKey, u, status) => {
    setAttendance((prev) => {
      const day = { ...(prev[dateKey] || {}) };
      const existing = day[u];
      if (existing && existing.status === status) delete day[u];
      else {
        const s = STATUS_MAP[status];
        day[u] = {
          status,
          inTime: s.timed ? (existing?.inTime || nowHHMM()) : "",
          outTime: s.timed ? (existing?.outTime || "") : "",
          note: existing?.note || "",
          source: "admin",
          markedAt: new Date().toISOString(),
        };
      }
      const next = { ...prev, [dateKey]: day };
      persistAttendance(next); return next;
    });
  }, [persistAttendance]);

  const updateField = useCallback((dateKey, u, field, value) => {
    setAttendance((prev) => {
      const day = { ...(prev[dateKey] || {}) };
      if (!day[u]) return prev;
      day[u] = { ...day[u], [field]: value, updatedAt: new Date().toISOString() };
      const next = { ...prev, [dateKey]: day };
      persistAttendance(next); return next;
    });
  }, [persistAttendance]);

  const selfCheckIn = useCallback((dateKey, u) => {
    setAttendance((prev) => {
      const day = { ...(prev[dateKey] || {}) };
      if (!day[u]) {
        const inTime = nowHHMM();
        day[u] = {
          status: isLateCheckIn(inTime) ? "late" : "present",
          inTime,
          outTime: "",
          note: "",
          source: "self",
          markedAt: new Date().toISOString(),
        };
      }
      const next = { ...prev, [dateKey]: day };
      persistAttendance(next); return next;
    });
  }, [persistAttendance]);

  const markAllPresent = useCallback((dateKey) => {
    setAttendance((prev) => {
      const day = { ...(prev[dateKey] || {}) };
      employees.forEach((e) => {
        if (!day[e.uid]) day[e.uid] = {
          status: "present",
          inTime: nowHHMM(),
          outTime: "",
          note: "",
          source: "admin",
          markedAt: new Date().toISOString(),
        };
      });
      const next = { ...prev, [dateKey]: day };
      persistAttendance(next); return next;
    });
  }, [employees, persistAttendance]);

  const clearDay = useCallback((dateKey) => {
    setAttendance((prev) => { const next = { ...prev }; delete next[dateKey]; persistAttendance(next); return next; });
  }, [persistAttendance]);

  /* roster + credential mutations */
  const addEmployee = useCallback(async (emp, password) => {
    const passHash = await hashPassword(password && password.trim() ? password.trim() : "toop123");
    setEmployees((prev) => { const next = [...prev, { ...emp, uid: uid(), passHash }]; persistEmployees(next); return next; });
  }, [persistEmployees]);

  const editEmployee = useCallback((u, patch) => {
    setEmployees((prev) => { const next = prev.map((e) => (e.uid === u ? { ...e, ...patch } : e)); persistEmployees(next); return next; });
  }, [persistEmployees]);

  const setEmployeePassword = useCallback(async (u, pw) => {
    const passHash = await hashPassword(pw);
    setEmployees((prev) => { const next = prev.map((e) => (e.uid === u ? { ...e, passHash } : e)); persistEmployees(next); return next; });
  }, [persistEmployees]);

  const removeEmployee = useCallback((u) => {
    setEmployees((prev) => { const next = prev.filter((e) => e.uid !== u); persistEmployees(next); return next; });
  }, [persistEmployees]);

  const changeAdminPassword = useCallback(async (pw) => {
    const passHash = await hashPassword(pw);
    setAdmin((prev) => { const next = { ...prev, passHash }; store.set("toop:admin", JSON.stringify(next)); return next; });
  }, []);

  const attemptLogin = useCallback(async (username, password) => {
    const u = (username || "").trim().toLowerCase();
    const h = await hashPassword(password || "");
    if (admin && u === admin.username.toLowerCase() && h === admin.passHash) return { role: "admin", uid: "admin", name: "Administrator" };
    const emp = employees.find((e) => (e.username || "").toLowerCase() === u && e.passHash === h);
    if (emp) return { role: "employee", uid: emp.uid, name: emp.name };
    return null;
  }, [admin, employees]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="h-5 w-5 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" /> Loading portal…
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen onSubmit={async (u, p) => { const s = await attemptLogin(u, p); if (s) { setSession(s); return null; } return "Incorrect username or password."; }} />;
  }

  const me = session.role === "employee" ? employees.find((e) => e.uid === session.uid) : null;

  return (
    <div className="min-h-screen text-slate-900" style={{ backgroundColor: "#FAF7F6" }}>
      <BrandStyles />
      <TopBar session={session} onLogout={() => setSession(null)} />
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        {session.role === "admin" ? (
          <AdminApp
            employees={employees} attendance={attendance}
            admin={admin} changeAdminPassword={changeAdminPassword}
            setStatus={setStatus} updateField={updateField} markAllPresent={markAllPresent} clearDay={clearDay}
            addEmployee={addEmployee} editEmployee={editEmployee} removeEmployee={removeEmployee} setEmployeePassword={setEmployeePassword}
          />
        ) : (
          <EmployeeApp me={me} attendance={attendance} selfCheckIn={selfCheckIn} updateField={updateField} />
        )}
        <footer className="mt-10 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
          <Lock className="h-3.5 w-3.5" /> Prototype access control — not server-grade security. Keep sensitive data out until this is on a backend.
        </footer>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Top bar + Login                                                   */
/* ================================================================== */

function TopBar({ session, onLogout }) {
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
<div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-visible">
            <ToopMark className="h-16 w-16 scale-[1.45]" />
          </div>
          <div>
            <div className="text-sm font-bold leading-tight tracking-tight">TOOP Attendance Portal</div>
            <div className="text-xs text-slate-500">The Order of Pen</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-sm font-semibold leading-tight">{session.name}</div>
            <div className="inline-flex items-center gap-1 text-xs text-slate-500">
              {session.role === "admin" ? <ShieldCheck className="h-3.5 w-3.5" style={{ color: TOOP_RED }} /> : <Users className="h-3.5 w-3.5" />}
              {session.role === "admin" ? "Administrator" : "Employee"}
            </div>
          </div>
          <button onClick={onLogout} className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function LoginScreen({ onSubmit }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  const submit = async () => {
    if (!username.trim() || !password) { setError("Enter your username and password."); return; }
    setBusy(true); setError("");
    const err = await onSubmit(username, password);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(to bottom, #F3E9E7, #FAF7F6)" }}>
      <BrandStyles />
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
  <div className="mb-5 mt-10 flex h-32 w-32 items-center justify-center overflow-visible">
    <ToopMark className="h-28 w-28 scale-[1.25]" />
  </div>

  <h1 className="text-lg font-bold tracking-tight">
    TOOP Attendance Portal
  </h1>

  <p className="text-xs font-medium uppercase tracking-widest" style={{ color: TOOP_RED }}>
    Ars longa, vita brevis
  </p>

  <p className="mt-1 text-sm text-slate-500">
    Sign in to view your attendance
  </p>
</div>
        <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-sm">
          <label className="mb-1 block text-xs font-medium text-slate-600">Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
            autoCapitalize="none" placeholder="e.g. ayesha or admin"
            className="mb-4 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-slate-400 focus:outline-none" />

          <label className="mb-1 block text-xs font-medium text-slate-600">Password</label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:border-slate-400 focus:outline-none" />
          </div>

          {error && <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</div>}

          <button onClick={submit} disabled={busy}
            className="toop-btn mt-5 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm">
            <LogIn className="h-4 w-4" /> {busy ? "Signing in…" : "Sign in"}
          </button>

          <button onClick={() => setShowDemo((v) => !v)} className="mt-4 w-full text-center text-xs text-slate-400 hover:text-slate-600">
            {showDemo ? "Hide demo accounts" : "Show demo accounts"}
          </button>
          {showDemo && (
            <div className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <div className="font-semibold text-slate-700">Admin</div>
              <div>admin / admin123</div>
              <div className="mt-2 font-semibold text-slate-700">Employees</div>
              <div>ayesha · bilal · sana · hamza · fatima</div>
              <div>password: toop123</div>
              <div className="mt-2 text-slate-400">Change these before real use.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Employee app (self-service)                                       */
/* ================================================================== */

function EmployeeApp({ me, attendance, selfCheckIn, updateField }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  if (!me) return <EmptyState title="Account not found" body="Your employee record was removed. Contact your administrator." icon={Lock} />;

  const today = new Date();
  const todayKey = toDateKey(today);
  const todayRec = attendance[todayKey]?.[me.uid];
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const history = useMemo(() => {
    const rows = [];
    let totalMins = 0; const tally = { present: 0, late: 0, halfday: 0, leave: 0, absent: 0 };
    for (let d = daysInMonth; d >= 1; d--) {
      const k = `${year}-${pad(month + 1)}-${pad(d)}`;
      const r = attendance[k]?.[me.uid];
      if (r) { rows.push({ date: new Date(year, month, d), ...r }); if (tally[r.status] !== undefined) tally[r.status]++; totalMins += workedMinutes(r); }
    }
    return { rows, totalMins, tally };
  }, [attendance, me.uid, year, month, daysInMonth]);

  const shiftMonth = (n) => setCursor(new Date(year, month + n, 1));

  return (
    <div className="space-y-5">
      {/* Today card */}
      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Avatar name={me.name} uid={me.uid} size="h-12 w-12" />
          <div>
            <div className="text-lg font-bold leading-tight">{me.name}</div>
            <div className="text-xs text-slate-500">{me.empId}{me.empId && me.dept ? " · " : ""}{me.dept}</div>
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <div className="text-xs font-medium text-slate-500">{formatLong(today)}</div>
          {!todayRec ? (
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-sm text-slate-600">You haven't checked in yet. Check-ins after {LATE_AFTER} are marked late automatically.</span>
              <button onClick={() => selfCheckIn(todayKey, me.uid)} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
                <ArrowRightCircle className="h-4 w-4" /> Check in
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${STATUS_MAP[todayRec.status].soft}`}>
                  <span className={`h-2 w-2 rounded-full ${STATUS_MAP[todayRec.status].dot}`} /> {STATUS_MAP[todayRec.status].label}
                </span>
                {STATUS_MAP[todayRec.status].timed && (
                  <span className="text-sm text-slate-600">
                    In {todayRec.inTime || "—"} · Out {todayRec.outTime || "—"} · {fmtDuration(workedMinutes(todayRec))}
                  </span>
                )}
                <span className="text-xs font-medium text-slate-400">{sourceLabel(todayRec)}{fmtMarkedAt(todayRec.markedAt) ? ` at ${fmtMarkedAt(todayRec.markedAt)}` : ""}</span>
              </div>
              {STATUS_MAP[todayRec.status].timed && !todayRec.outTime && (
                <button onClick={() => updateField(todayKey, me.uid, "outTime", nowHHMM())} className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-700">
                  <ArrowLeftCircle className="h-4 w-4" /> Check out
                </button>
              )}
              {STATUS_MAP[todayRec.status].timed && todayRec.outTime && (
                <div className="text-sm font-medium text-emerald-600">Checked out for the day.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* My month */}
      <div className="flex items-center justify-between rounded-2xl bg-white p-4 ring-1 ring-slate-200 shadow-sm">
        <button onClick={() => shiftMonth(-1)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><ChevronLeft className="h-5 w-5" /></button>
        <div className="text-base font-semibold">My record · {MONTHS[month]} {year}</div>
        <button onClick={() => shiftMonth(1)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><ChevronRight className="h-5 w-5" /></button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryTile label="Present" value={history.tally.present + history.tally.late + history.tally.halfday} accent="text-emerald-600" />
        <SummaryTile label="Leave" value={history.tally.leave} accent="text-violet-600" />
        <SummaryTile label="Absent" value={history.tally.absent} accent="text-rose-600" />
        <SummaryTile label="Hours" value={fmtDuration(history.totalMins)} accent="text-slate-900" />
      </div>

      {history.rows.length === 0 ? (
        <EmptyState title="No records this month" body="Nothing has been logged for you yet." icon={CalendarDays} />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">In</th><th className="px-4 py-3 font-medium">Out</th>
              <th className="px-4 py-3 text-right font-medium">Hours</th>
            </tr></thead>
            <tbody>
              {history.rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 text-slate-700">{WEEKDAYS[r.date.getDay()]} {pad(r.date.getDate())}</td>
                  <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${STATUS_MAP[r.status].soft}`}><span className={`h-1.5 w-1.5 rounded-full ${STATUS_MAP[r.status].dot}`} />{STATUS_MAP[r.status].label}</span></td>
                  <td className="px-4 py-3 text-slate-600">{r.inTime || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{r.outTime || "—"}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{fmtDuration(workedMinutes(r))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryTile({ label, value, accent }) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-bold ${accent}`}>{value}</div>
    </div>
  );
}

/* ================================================================== */
/*  Admin app                                                         */
/* ================================================================== */

function AdminApp(props) {
  const [tab, setTab] = useState("today");
  return (
    <div className="space-y-6">
      <nav className="inline-flex rounded-xl bg-white ring-1 ring-slate-200 p-1 shadow-sm">
        {[
          { k: "today", label: "Today", icon: CalendarDays },
          { k: "records", label: "Records", icon: BarChart3 },
          { k: "people", label: "People", icon: Users },
        ].map(({ k, label, icon: Icon }) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${tab === k ? "toop-tab-active shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}>
            <Icon className="h-4 w-4" /><span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </nav>
      {tab === "today" && <AdminToday {...props} />}
      {tab === "records" && <RecordsView employees={props.employees} attendance={props.attendance} />}
      {tab === "people" && <PeopleView {...props} />}
    </div>
  );
}

function AdminToday({ employees, attendance, setStatus, updateField, markAllPresent, clearDay }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [search, setSearch] = useState("");
  const dateKey = toDateKey(selectedDate);
  const dayRecords = attendance[dateKey] || {};
  const isToday = sameDay(selectedDate, new Date());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => e.name.toLowerCase().includes(q) || (e.empId || "").toLowerCase().includes(q) || (e.dept || "").toLowerCase().includes(q));
  }, [employees, search]);

  const counts = useMemo(() => {
    const c = { present: 0, late: 0, halfday: 0, leave: 0, absent: 0, unmarked: 0 };
    employees.forEach((e) => { const r = dayRecords[e.uid]; if (r && c[r.status] !== undefined) c[r.status]++; else c.unmarked++; });
    return c;
  }, [employees, dayRecords]);

  const shift = (n) => { const d = new Date(selectedDate); d.setDate(d.getDate() + n); setSelectedDate(d); };

  const exportDay = () => {
    const rows = [["Date", "Name", "ID", "Department", "Status", "In", "Out", "Hours", "Marked by", "Marked at", "Note"]];
    employees.forEach((e) => {
      const r = dayRecords[e.uid];
      rows.push([dateKey, e.name, e.empId || "", e.dept || "", r ? STATUS_MAP[r.status].label : "Unmarked", r?.inTime || "", r?.outTime || "", fmtDuration(workedMinutes(r)), r ? sourceLabel(r) : "", fmtMarkedAt(r?.markedAt), r?.note || ""]);
    });
    downloadCSV(`toop-attendance-${dateKey}.csv`, rows);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><ChevronLeft className="h-5 w-5" /></button>
          <div className="min-w-[180px] text-center">
            <div className="text-base font-semibold">{formatLong(selectedDate)}</div>
            {isToday && <div className="text-xs font-medium text-emerald-600">Today</div>}
          </div>
          <button onClick={() => shift(1)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><ChevronRight className="h-5 w-5" /></button>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={dateKey} onChange={(e) => { const [y, m, d] = e.target.value.split("-").map(Number); if (y && m && d) setSelectedDate(new Date(y, m - 1, d)); }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none" />
          {!isToday && <button onClick={() => setSelectedDate(new Date())} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">Today</button>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <div key={s.key} className="flex items-center gap-2 rounded-full bg-white ring-1 ring-slate-200 px-3 py-1.5 shadow-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} /><span className="text-sm text-slate-600">{s.label}</span><span className="text-sm font-semibold">{counts[s.key]}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 rounded-full bg-white ring-1 ring-slate-200 px-3 py-1.5 shadow-sm">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" /><span className="text-sm text-slate-600">Unmarked</span><span className="text-sm font-semibold">{counts.unmarked}</span>
        </div>
      </div>

      <div className="rounded-xl bg-white px-4 py-3 text-xs font-medium text-slate-500 ring-1 ring-slate-200 shadow-sm">
        Employee dashboard only allows self check-in/check-out. Admin can correct status, mark half day, leave or absent. Late is auto-detected after <span className="font-semibold text-slate-700">{LATE_AFTER}</span>.
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => markAllPresent(dateKey)} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"><Check className="h-4 w-4" /> Mark all present</button>
        <button onClick={exportDay} className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"><Download className="h-4 w-4" /> Export day</button>
        <button onClick={() => clearDay(dateKey)} className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-rose-600 ring-1 ring-slate-200 hover:bg-rose-50"><X className="h-4 w-4" /> Clear day</button>
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, ID, team…" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-slate-400 focus:outline-none sm:w-64" />
        </div>
      </div>

      {employees.length === 0 ? (
        <EmptyState title="No employees yet" body="Add your team in the People tab to start taking attendance." />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matches" body="No one matches your search." icon={Search} />
      ) : (
        <ul className="space-y-2">
          {filtered.map((e) => {
            const record = dayRecords[e.uid];
            return (
              <li key={e.uid} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={e.name} uid={e.uid} />
                    <div><div className="font-semibold leading-tight">{e.name}</div><div className="text-xs text-slate-500">{e.empId}{e.empId && e.dept ? " · " : ""}{e.dept}</div></div>
                  </div>
                  <StatusPicker value={record?.status} onChange={(s) => setStatus(dateKey, e.uid, s)} />
                </div>
                {record && (
                  <TimedDetail record={record}
                    onIn={(v) => updateField(dateKey, e.uid, "inTime", v)}
                    onOut={(v) => updateField(dateKey, e.uid, "outTime", v)}
                    onNote={(v) => updateField(dateKey, e.uid, "note", v)} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---- Records ---- */

function RecordsView({ employees, attendance }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthKeys = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => `${year}-${pad(month + 1)}-${pad(i + 1)}`), [year, month, daysInMonth]);

  const summary = useMemo(() => employees.map((e) => {
    const row = { uid: e.uid, name: e.name, empId: e.empId, dept: e.dept, present: 0, late: 0, halfday: 0, leave: 0, absent: 0, mins: 0 };
    monthKeys.forEach((k) => { const r = attendance[k]?.[e.uid]; if (r && row[r.status] !== undefined) { row[r.status]++; row.mins += workedMinutes(r); } });
    const marked = row.present + row.late + row.halfday + row.leave + row.absent;
    const here = row.present + row.late + row.halfday;
    row.marked = marked; row.rate = marked ? Math.round((here / marked) * 100) : null;
    return row;
  }), [employees, monthKeys, attendance]);

  const totalsMarked = summary.reduce((a, r) => a + r.marked, 0);
  const shiftMonth = (n) => setCursor(new Date(year, month + n, 1));

  const exportMonth = () => {
    const rows = [["Name", "ID", "Department", "Present", "Late", "Half day", "Leave", "Absent", "Days marked", "Hours", "Attendance %"]];
    summary.forEach((r) => rows.push([r.name, r.empId || "", r.dept || "", r.present, r.late, r.halfday, r.leave, r.absent, r.marked, fmtDuration(r.mins), r.rate == null ? "—" : r.rate + "%"]));
    downloadCSV(`toop-summary-${year}-${pad(month + 1)}.csv`, rows);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => shiftMonth(-1)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><ChevronLeft className="h-5 w-5" /></button>
          <div className="min-w-[160px] text-center text-base font-semibold">{MONTHS[month]} {year}</div>
          <button onClick={() => shiftMonth(1)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><ChevronRight className="h-5 w-5" /></button>
        </div>
        <button onClick={exportMonth} className="flex items-center gap-1.5 self-start rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"><Download className="h-4 w-4" /> Export summary</button>
      </div>

      {employees.length === 0 ? (
        <EmptyState title="Nothing to summarize" body="Add employees and take attendance to see monthly records." />
      ) : totalsMarked === 0 ? (
        <EmptyState title="No records this month" body={`No attendance has been marked in ${MONTHS[month]} ${year} yet.`} icon={CalendarDays} />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Employee</th>
              {STATUSES.map((s) => <th key={s.key} className="px-3 py-3 text-center font-medium">{s.short}</th>)}
              <th className="px-3 py-3 text-center font-medium">Hrs</th>
              <th className="px-4 py-3 text-right font-medium">Attendance</th>
            </tr></thead>
            <tbody>
              {summary.map((r) => (
                <tr key={r.uid} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><Avatar name={r.name} uid={r.uid} size="h-8 w-8" /><div><div className="font-medium leading-tight">{r.name}</div><div className="text-xs text-slate-500">{r.dept}</div></div></div></td>
                  <td className="px-3 py-3 text-center text-slate-700">{r.present}</td>
                  <td className="px-3 py-3 text-center text-slate-700">{r.late}</td>
                  <td className="px-3 py-3 text-center text-slate-700">{r.halfday}</td>
                  <td className="px-3 py-3 text-center text-slate-700">{r.leave}</td>
                  <td className="px-3 py-3 text-center text-slate-700">{r.absent}</td>
                  <td className="px-3 py-3 text-center text-slate-600">{fmtDuration(r.mins)}</td>
                  <td className="px-4 py-3 text-right">
                    {r.rate == null ? <span className="text-slate-400">—</span> : (
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${r.rate >= 90 ? "bg-emerald-500" : r.rate >= 75 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${r.rate}%` }} /></div>
                        <span className="w-9 text-right font-semibold text-slate-900">{r.rate}%</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-400">P · Present · L · Late · HD · Half day · Lv · Leave · A · Absent. Attendance % counts present, late and half days against all marked days.</p>
    </div>
  );
}

/* ---- People + credentials ---- */

function PeopleView({ employees, admin, addEmployee, editEmployee, removeEmployee, setEmployeePassword, changeAdminPassword }) {
  const [name, setName] = useState(""); const [empId, setEmpId] = useState(""); const [dept, setDept] = useState("");
  const [username, setUsername] = useState(""); const [password, setPassword] = useState("");
  const [editing, setEditing] = useState(null); const [draft, setDraft] = useState({});
  const [confirmDel, setConfirmDel] = useState(null);
  const [adminPw, setAdminPw] = useState(""); const [adminMsg, setAdminMsg] = useState("");

  const submit = () => {
    if (!name.trim()) return;
    addEmployee({ name: name.trim(), empId: empId.trim(), dept: dept.trim(), username: username.trim() }, password);
    setName(""); setEmpId(""); setDept(""); setUsername(""); setPassword("");
  };

  const saveEdit = async (u) => {
    if (!draft.name.trim()) return;
    editEmployee(u, { name: draft.name.trim(), empId: draft.empId.trim(), dept: draft.dept.trim(), username: draft.username.trim() });
    if (draft.password && draft.password.trim()) await setEmployeePassword(u, draft.password.trim());
    setEditing(null);
  };

  return (
    <div className="space-y-5">
      {/* Admin account */}
      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700"><ShieldCheck className="h-4 w-4 text-indigo-500" /> Admin account</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="text-sm text-slate-600">Username: <span className="font-medium text-slate-900">{admin?.username}</span></div>
          <div className="flex flex-1 items-center gap-2">
            <input type="password" value={adminPw} onChange={(e) => setAdminPw(e.target.value)} placeholder="New admin password" className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />
            <button onClick={async () => { if (adminPw.trim().length < 4) { setAdminMsg("Use at least 4 characters."); return; } await changeAdminPassword(adminPw.trim()); setAdminPw(""); setAdminMsg("Admin password updated."); }}
              className="toop-btn rounded-lg px-3 py-2 text-sm font-medium">Update</button>
          </div>
        </div>
        {adminMsg && <div className="mt-2 text-xs font-medium text-emerald-600">{adminMsg}</div>}
      </div>

      {/* Add employee */}
      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Add an employee</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="sm:col-span-3 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />
          <input value={empId} onChange={(e) => setEmpId(e.target.value)} placeholder="ID" className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />
          <input value={dept} onChange={(e) => setDept(e.target.value)} placeholder="Department" className="sm:col-span-3 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" placeholder="Username" className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="sm:col-span-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />
          <button onClick={submit} disabled={!name.trim()} className="toop-btn sm:col-span-1 flex items-center justify-center rounded-lg px-3 py-2 shadow-sm"><Plus className="h-5 w-5" /></button>
        </div>
        <p className="mt-2 text-xs text-slate-400">Leave password blank to default to <span className="font-medium">toop123</span>. Username is what the employee signs in with.</p>
      </div>

      {employees.length === 0 ? (
        <EmptyState title="No employees yet" body="Add your first team member above." />
      ) : (
        <ul className="space-y-2">
          {employees.map((e) => {
            const isEditing = editing === e.uid;
            return (
              <li key={e.uid} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 shadow-sm">
                {isEditing ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-center">
                    <input value={draft.name} onChange={(ev) => setDraft({ ...draft, name: ev.target.value })} className="sm:col-span-3 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" placeholder="Full name" />
                    <input value={draft.empId} onChange={(ev) => setDraft({ ...draft, empId: ev.target.value })} className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" placeholder="ID" />
                    <input value={draft.dept} onChange={(ev) => setDraft({ ...draft, dept: ev.target.value })} className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" placeholder="Dept" />
                    <input value={draft.username} onChange={(ev) => setDraft({ ...draft, username: ev.target.value })} autoCapitalize="none" className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" placeholder="Username" />
                    <input value={draft.password} onChange={(ev) => setDraft({ ...draft, password: ev.target.value })} className="sm:col-span-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" placeholder="New pw" />
                    <div className="sm:col-span-2 flex gap-2">
                      <button onClick={() => saveEdit(e.uid)} className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">Save</button>
                      <button onClick={() => setEditing(null)} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={e.name} uid={e.uid} />
                      <div>
                        <div className="font-semibold leading-tight">{e.name}</div>
                        <div className="text-xs text-slate-500">{e.empId}{e.empId && e.dept ? " · " : ""}{e.dept}{e.username ? <span className="ml-1 text-slate-400">· @{e.username}</span> : null}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditing(e.uid); setDraft({ name: e.name, empId: e.empId || "", dept: e.dept || "", username: e.username || "", password: "" }); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => setConfirmDel(e.uid)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                )}
                {confirmDel === e.uid && (
                  <div className="mt-3 flex flex-col gap-2 rounded-lg bg-rose-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-rose-700">Remove {e.name} from the roster?</span>
                    <div className="flex gap-2">
                      <button onClick={() => { removeEmployee(e.uid); setConfirmDel(null); }} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700">Remove</button>
                      <button onClick={() => setConfirmDel(null)} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">Keep</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
