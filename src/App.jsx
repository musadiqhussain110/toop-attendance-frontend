import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Check, Users, BarChart3, Plus, Trash2, Search, ChevronLeft, ChevronRight,
  Download, X, Pencil, CalendarDays, LogOut, LogIn, ShieldCheck, KeyRound,
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

function BrandStyles() {
  return (
    <style>{`
      .toop-btn{background:${TOOP_RED};color:#fff;transition:background .15s}
      .toop-btn:hover{background:${TOOP_RED_DARK}}
      .toop-btn:disabled{opacity:.45;cursor:not-allowed}
      .toop-tab-active{background:${TOOP_RED};color:#fff}
      .toop-soft{background:${TOOP_RED_SOFT};color:${TOOP_RED_DARK}}
      .toop-text{color:${TOOP_RED}}
    `}</style>
  );
}

/* ================================================================== */
/*  API layer — MongoDB/Backend is now the source of truth             */
/* ================================================================== */

const API_BASE = `${(import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "")}/api`;
const TOKEN_KEY = "toop_token";

const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch (_) { return null; }
};

const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (_) {}
};

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401) setToken(null);
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

const api = {
  async login(username, password) {
    const { token, user } = await request("/auth/login", {
      method: "POST",
      auth: false,
      body: { username, password },
    });
    setToken(token);
    return user;
  },
  logout() {
    setToken(null);
  },
  me: () => request("/auth/me"),
  changePassword: (currentPassword, newPassword) =>
    request("/auth/change-password", { method: "POST", body: { currentPassword, newPassword } }),

  listUsers: () => request("/users"),
  createUser: (user) => request("/users", { method: "POST", body: user }),
  updateUser: (id, patch) => request(`/users/${id}`, { method: "PUT", body: patch }),
  resetUserPassword: (id, password) =>
    request(`/users/${id}/reset-password`, { method: "POST", body: { password } }),
  deleteUser: (id) => request(`/users/${id}`, { method: "DELETE" }),

  myMonth: (month) => request(`/attendance/me?month=${encodeURIComponent(month)}`),
  checkIn: () => request("/attendance/checkin", { method: "POST" }),
  checkOut: () => request("/attendance/checkout", { method: "POST" }),
  day: (date) => request(`/attendance/day?date=${encodeURIComponent(date)}`),
  summary: (month) => request(`/attendance/summary?month=${encodeURIComponent(month)}`),
  setEntry: (entry) => request("/attendance", { method: "PUT", body: entry }),
  removeEntry: (userId, date) =>
    request(`/attendance?userId=${encodeURIComponent(userId)}&date=${encodeURIComponent(date)}`, { method: "DELETE" }),
};

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
const toMonthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const formatLong = (d) => `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
const nowHHMM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const sameDay = (a, b) => toDateKey(a) === toDateKey(b);

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

const sourceLabel = (record) => record?.source === "self" ? "Employee marked" : record?.source === "admin" ? "Admin marked" : "Marked";
const fmtMarkedAt = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

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

function ErrorBox({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="mb-4 flex items-start justify-between gap-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-100">
      <span>{message}</span>
      {onClose && <button onClick={onClose} className="rounded-md p-1 hover:bg-rose-100"><X className="h-4 w-4" /></button>}
    </div>
  );
}

function StatusPicker({ value, onChange, disabled }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {STATUSES.map((opt) => {
        const active = value === opt.key;
        return (
          <button key={opt.key} onClick={() => onChange(opt.key)} disabled={disabled}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${active ? `${opt.solid} text-white shadow-sm` : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function TimedDetail({ record, onIn, onOut, onNote, busy }) {
  const s = STATUS_MAP[record.status] || STATUS_MAP.present;
  const mins = workedMinutes(record);
  const markedAt = fmtMarkedAt(record.updatedAt || record.createdAt || record.markedAt);
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:flex-wrap sm:items-center">
      {s.timed && (
        <>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            <ArrowRightCircle className="h-4 w-4 text-emerald-500" /> In
            <input type="time" value={record.inTime || ""} disabled={busy} onChange={(e) => onIn(e.target.value)}
              className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:border-slate-400 focus:outline-none" />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            <ArrowLeftCircle className="h-4 w-4 text-rose-500" /> Out
            <input type="time" value={record.outTime || ""} disabled={busy} onChange={(e) => onOut(e.target.value)}
              className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:border-slate-400 focus:outline-none" />
          </label>
          <span className="text-xs font-medium text-slate-500">{fmtDuration(mins)}</span>
        </>
      )}
      <input type="text" value={record.note || ""} disabled={busy} onChange={(e) => onNote(e.target.value)}
        placeholder={record.status === "absent" || record.status === "leave" ? "Reason (optional)" : "Note (optional)"}
        className="flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-slate-400 focus:outline-none" />
      <span className={`inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${s.soft}`}>
        <span className={`h-2 w-2 rounded-full ${s.dot}`} /> {s.label}
      </span>
      <span className="self-start rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
        {sourceLabel(record)}{markedAt ? ` · ${markedAt}` : ""}
      </span>
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
/*  Root                                                              */
/* ================================================================== */

export default function TOOPAttendancePortal() {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState("");

  const logout = useCallback(() => {
    api.logout();
    setSession(null);
    setEmployees([]);
  }, []);

  const refreshEmployees = useCallback(async () => {
    const { users } = await api.listUsers();
    setEmployees((users || []).filter((u) => u.role === "employee"));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (getToken()) {
          const { user } = await api.me();
          if (!cancelled) {
            setSession(user);
            if (user.role === "admin") {
              const { users } = await api.listUsers();
              if (!cancelled) setEmployees((users || []).filter((u) => u.role === "employee"));
            }
          }
        }
      } catch (err) {
        setToken(null);
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (booting) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="h-5 w-5 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" /> Loading portal…
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <LoginScreen
        onSubmit={async (u, p) => {
          try {
            setError("");
            const user = await api.login(u, p);
            setSession(user);
            if (user.role === "admin") await refreshEmployees();
            return null;
          } catch (err) {
            return err.message || "Login failed.";
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen text-slate-900" style={{ backgroundColor: "#FAF7F6" }}>
      <BrandStyles />
      <TopBar session={session} onLogout={logout} />
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <ErrorBox message={error} onClose={() => setError("")} />
        {session.role === "admin" ? (
          <AdminApp
            session={session}
            employees={employees}
            refreshEmployees={refreshEmployees}
            onError={(msg) => setError(msg)}
          />
        ) : (
          <EmployeeApp me={session} onError={(msg) => setError(msg)} />
        )}
        <footer className="mt-10 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
          <Lock className="h-3.5 w-3.5" /> Connected to TOOP backend and MongoDB Atlas.
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
          <h1 className="text-lg font-bold tracking-tight">TOOP Attendance Portal</h1>
          <p className="text-xs font-medium uppercase tracking-widest" style={{ color: TOOP_RED }}>Ars longa, vita brevis</p>
          <p className="mt-1 text-sm text-slate-500">Sign in to view your attendance</p>
        </div>

        <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-sm">
          <label className="mb-1 block text-xs font-medium text-slate-600">Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
            autoCapitalize="none" placeholder="Enter your username"
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
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Employee app                                                      */
/* ================================================================== */

function EmployeeApp({ me, onError }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [records, setRecords] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const year = cursor.getFullYear(), month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthKey = toMonthKey(cursor);
  const today = new Date();
  const todayKey = toDateKey(today);
  const todayRec = records.find((r) => r.date === todayKey);

  const loadMonth = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.myMonth(monthKey);
      setRecords(data.records || []);
      setPolicy(data.policy || null);
    } catch (err) {
      onError(err.message || "Could not load your attendance.");
    } finally {
      setLoading(false);
    }
  }, [monthKey, onError]);

  useEffect(() => { loadMonth(); }, [loadMonth]);

  const history = useMemo(() => {
    const rows = [];
    let totalMins = 0; const tally = { present: 0, late: 0, halfday: 0, leave: 0, absent: 0 };
    for (let d = daysInMonth; d >= 1; d--) {
      const k = `${year}-${pad(month + 1)}-${pad(d)}`;
      const r = records.find((x) => x.date === k);
      if (r) {
        rows.push({ ...r, date: new Date(year, month, d) });
        if (tally[r.status] !== undefined) tally[r.status]++;
        totalMins += workedMinutes(r);
      }
    }
    return { rows, totalMins, tally };
  }, [records, year, month, daysInMonth]);

  const shiftMonth = (n) => setCursor(new Date(year, month + n, 1));

  const doCheckIn = async () => {
    try {
      setBusy(true);
      await api.checkIn();
      await loadMonth();
    } catch (err) { onError(err.message || "Check-in failed."); }
    finally { setBusy(false); }
  };

  const doCheckOut = async () => {
    try {
      setBusy(true);
      await api.checkOut();
      await loadMonth();
    } catch (err) { onError(err.message || "Check-out failed."); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Avatar name={me.name} uid={me._id} size="h-12 w-12" />
          <div>
            <div className="text-lg font-bold leading-tight">{me.name}</div>
            <div className="text-xs text-slate-500">{me.empId}{me.empId && me.dept ? " · " : ""}{me.dept}</div>
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <div className="text-xs font-medium text-slate-500">{formatLong(today)}</div>
          {!todayRec ? (
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-sm text-slate-600">You haven't checked in yet. Late is decided by the backend{policy?.lateAfter ? ` after ${policy.lateAfter}` : ""}.</span>
              <button onClick={doCheckIn} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60">
                <ArrowRightCircle className="h-4 w-4" /> Check in
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${STATUS_MAP[todayRec.status]?.soft || STATUS_MAP.present.soft}`}>
                  <span className={`h-2 w-2 rounded-full ${STATUS_MAP[todayRec.status]?.dot || STATUS_MAP.present.dot}`} /> {STATUS_MAP[todayRec.status]?.label || todayRec.status}
                </span>
                {STATUS_MAP[todayRec.status]?.timed && (
                  <span className="text-sm text-slate-600">In {todayRec.inTime || "—"} · Out {todayRec.outTime || "—"} · {fmtDuration(workedMinutes(todayRec))}</span>
                )}
                <span className="text-xs font-medium text-slate-400">{sourceLabel(todayRec)}{fmtMarkedAt(todayRec.createdAt) ? ` at ${fmtMarkedAt(todayRec.createdAt)}` : ""}</span>
              </div>
              {STATUS_MAP[todayRec.status]?.timed && !todayRec.outTime && (
                <button onClick={doCheckOut} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 disabled:opacity-60">
                  <ArrowLeftCircle className="h-4 w-4" /> Check out
                </button>
              )}
              {STATUS_MAP[todayRec.status]?.timed && todayRec.outTime && <div className="text-sm font-medium text-emerald-600">Checked out for the day.</div>}
            </div>
          )}
        </div>
      </div>

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

      {loading ? <EmptyState title="Loading records" body="Please wait…" icon={CalendarDays} /> : history.rows.length === 0 ? (
        <EmptyState title="No records this month" body="Nothing has been logged for you yet." icon={CalendarDays} />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">In</th><th className="px-4 py-3 font-medium">Out</th>
              <th className="px-4 py-3 text-right font-medium">Hours</th>
            </tr></thead>
            <tbody>{history.rows.map((r) => (
              <tr key={r._id || r.date.toISOString()} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-3 text-slate-700">{WEEKDAYS[r.date.getDay()]} {pad(r.date.getDate())}</td>
                <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${STATUS_MAP[r.status]?.soft || STATUS_MAP.present.soft}`}><span className={`h-1.5 w-1.5 rounded-full ${STATUS_MAP[r.status]?.dot || STATUS_MAP.present.dot}`} />{STATUS_MAP[r.status]?.label || r.status}</span></td>
                <td className="px-4 py-3 text-slate-600">{r.inTime || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{r.outTime || "—"}</td>
                <td className="px-4 py-3 text-right text-slate-700">{fmtDuration(workedMinutes(r))}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Admin app                                                         */
/* ================================================================== */

function AdminApp({ session, employees, refreshEmployees, onError }) {
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
      {tab === "today" && <AdminToday employees={employees} onError={onError} />}
      {tab === "records" && <RecordsView onError={onError} />}
      {tab === "people" && <PeopleView session={session} employees={employees} refreshEmployees={refreshEmployees} onError={onError} />}
    </div>
  );
}

function AdminToday({ employees, onError }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState([]);
  const [busy, setBusy] = useState(false);
  const dateKey = toDateKey(selectedDate);
  const isToday = sameDay(selectedDate, new Date());

  const recordMap = useMemo(() => {
    const map = {};
    for (const r of records) {
      const id = typeof r.user === "object" ? r.user?._id : r.user;
      if (id) map[id] = r;
    }
    return map;
  }, [records]);

  const loadDay = useCallback(async () => {
    try {
      const data = await api.day(dateKey);
      setRecords(data.records || []);
    } catch (err) { onError(err.message || "Could not load day records."); }
  }, [dateKey, onError]);

  useEffect(() => { loadDay(); }, [loadDay]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => e.name.toLowerCase().includes(q) || (e.empId || "").toLowerCase().includes(q) || (e.dept || "").toLowerCase().includes(q));
  }, [employees, search]);

  const counts = useMemo(() => {
    const c = { present: 0, late: 0, halfday: 0, leave: 0, absent: 0, unmarked: 0 };
    employees.forEach((e) => { const r = recordMap[e._id]; if (r && c[r.status] !== undefined) c[r.status]++; else c.unmarked++; });
    return c;
  }, [employees, recordMap]);

  const shift = (n) => { const d = new Date(selectedDate); d.setDate(d.getDate() + n); setSelectedDate(d); };

  const setStatus = async (employee, status) => {
    try {
      setBusy(true);
      const existing = recordMap[employee._id];
      if (existing && existing.status === status) {
        await api.removeEntry(employee._id, dateKey);
      } else {
        const opt = STATUS_MAP[status];
        await api.setEntry({
          userId: employee._id,
          date: dateKey,
          status,
          inTime: opt.timed ? (existing?.inTime || nowHHMM()) : "",
          outTime: opt.timed ? (existing?.outTime || "") : "",
          note: existing?.note || "",
        });
      }
      await loadDay();
    } catch (err) { onError(err.message || "Could not update attendance."); }
    finally { setBusy(false); }
  };

  const updateField = async (employee, field, value) => {
    const existing = recordMap[employee._id];
    if (!existing) return;
    try {
      setBusy(true);
      await api.setEntry({
        userId: employee._id,
        date: dateKey,
        status: existing.status,
        inTime: field === "inTime" ? value : (existing.inTime || ""),
        outTime: field === "outTime" ? value : (existing.outTime || ""),
        note: field === "note" ? value : (existing.note || ""),
      });
      await loadDay();
    } catch (err) { onError(err.message || "Could not update record."); }
    finally { setBusy(false); }
  };

  const markAllPresent = async () => {
    try {
      setBusy(true);
      await Promise.all(employees.map((e) => recordMap[e._id] ? Promise.resolve() : api.setEntry({ userId: e._id, date: dateKey, status: "present", inTime: nowHHMM(), outTime: "", note: "" })));
      await loadDay();
    } catch (err) { onError(err.message || "Could not mark all present."); }
    finally { setBusy(false); }
  };

  const clearDay = async () => {
    try {
      setBusy(true);
      await Promise.all(records.map((r) => api.removeEntry(typeof r.user === "object" ? r.user._id : r.user, dateKey)));
      await loadDay();
    } catch (err) { onError(err.message || "Could not clear day."); }
    finally { setBusy(false); }
  };

  const exportDay = () => {
    const rows = [["Date", "Name", "ID", "Department", "Status", "In", "Out", "Hours", "Marked by", "Marked at", "Note"]];
    employees.forEach((e) => {
      const r = recordMap[e._id];
      rows.push([dateKey, e.name, e.empId || "", e.dept || "", r ? STATUS_MAP[r.status]?.label || r.status : "Unmarked", r?.inTime || "", r?.outTime || "", fmtDuration(workedMinutes(r)), r ? sourceLabel(r) : "", fmtMarkedAt(r?.updatedAt || r?.createdAt), r?.note || ""]);
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

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={markAllPresent} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"><Check className="h-4 w-4" /> Mark all present</button>
        <button onClick={exportDay} className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"><Download className="h-4 w-4" /> Export day</button>
        <button onClick={clearDay} disabled={busy || records.length === 0} className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-rose-600 ring-1 ring-slate-200 hover:bg-rose-50 disabled:opacity-60"><X className="h-4 w-4" /> Clear day</button>
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, ID, team…" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-slate-400 focus:outline-none sm:w-64" />
        </div>
      </div>

      {employees.length === 0 ? <EmptyState title="No employees yet" body="Add your team in the People tab to start taking attendance." /> : filtered.length === 0 ? <EmptyState title="No matches" body="No one matches your search." icon={Search} /> : (
        <ul className="space-y-2">{filtered.map((e) => {
          const record = recordMap[e._id];
          return (
            <li key={e._id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={e.name} uid={e._id} />
                  <div><div className="font-semibold leading-tight">{e.name}</div><div className="text-xs text-slate-500">{e.empId}{e.empId && e.dept ? " · " : ""}{e.dept}</div></div>
                </div>
                <StatusPicker value={record?.status} disabled={busy} onChange={(s) => setStatus(e, s)} />
              </div>
              {record && <TimedDetail record={record} busy={busy} onIn={(v) => updateField(e, "inTime", v)} onOut={(v) => updateField(e, "outTime", v)} onNote={(v) => updateField(e, "note", v)} />}
            </li>
          );
        })}</ul>
      )}
    </div>
  );
}

/* ---- Records ---- */

function RecordsView({ onError }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const monthKey = toMonthKey(cursor);

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.summary(monthKey);
      setSummary(data.summary || []);
    } catch (err) { onError(err.message || "Could not load summary."); }
    finally { setLoading(false); }
  }, [monthKey, onError]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const totalsMarked = summary.reduce((a, r) => a + (r.marked || 0), 0);
  const shiftMonth = (n) => setCursor(new Date(year, month + n, 1));

  const exportMonth = () => {
    const rows = [["Name", "ID", "Department", "Present", "Late", "Half day", "Leave", "Absent", "Days marked", "Hours", "Attendance %"]];
    summary.forEach((r) => rows.push([r.user?.name || "", r.user?.empId || "", r.user?.dept || "", r.present, r.late, r.halfday, r.leave, r.absent, r.marked, fmtDuration(r.minutes || 0), r.rate == null ? "—" : r.rate + "%"]));
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

      {loading ? <EmptyState title="Loading summary" body="Please wait…" /> : summary.length === 0 ? <EmptyState title="Nothing to summarize" body="Add employees and take attendance to see monthly records." /> : totalsMarked === 0 ? <EmptyState title="No records this month" body={`No attendance has been marked in ${MONTHS[month]} ${year} yet.`} icon={CalendarDays} /> : (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Employee</th>
              {STATUSES.map((s) => <th key={s.key} className="px-3 py-3 text-center font-medium">{s.short}</th>)}
              <th className="px-3 py-3 text-center font-medium">Hrs</th>
              <th className="px-4 py-3 text-right font-medium">Attendance</th>
            </tr></thead>
            <tbody>{summary.map((r) => (
              <tr key={r.user?._id || r.user?.username} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3"><div className="flex items-center gap-3"><Avatar name={r.user?.name} uid={r.user?._id} size="h-8 w-8" /><div><div className="font-medium leading-tight">{r.user?.name}</div><div className="text-xs text-slate-500">{r.user?.dept}</div></div></div></td>
                <td className="px-3 py-3 text-center text-slate-700">{r.present}</td>
                <td className="px-3 py-3 text-center text-slate-700">{r.late}</td>
                <td className="px-3 py-3 text-center text-slate-700">{r.halfday}</td>
                <td className="px-3 py-3 text-center text-slate-700">{r.leave}</td>
                <td className="px-3 py-3 text-center text-slate-700">{r.absent}</td>
                <td className="px-3 py-3 text-center text-slate-600">{fmtDuration(r.minutes || 0)}</td>
                <td className="px-4 py-3 text-right">{r.rate == null ? <span className="text-slate-400">—</span> : <div className="flex items-center justify-end gap-2"><div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${r.rate >= 90 ? "bg-emerald-500" : r.rate >= 75 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${r.rate}%` }} /></div><span className="w-9 text-right font-semibold text-slate-900">{r.rate}%</span></div>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-400">P · Present · L · Late · HD · Half day · Lv · Leave · A · Absent. Attendance % counts present, late and half days against all marked days.</p>
    </div>
  );
}

/* ---- People + credentials ---- */

function PeopleView({ session, employees, refreshEmployees, onError }) {
  const [name, setName] = useState(""); const [empId, setEmpId] = useState(""); const [dept, setDept] = useState("");
  const [username, setUsername] = useState(""); const [password, setPassword] = useState("");
  const [editing, setEditing] = useState(null); const [draft, setDraft] = useState({});
  const [confirmDel, setConfirmDel] = useState(null);
  const [currentAdminPw, setCurrentAdminPw] = useState(""); const [adminPw, setAdminPw] = useState(""); const [adminMsg, setAdminMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || !username.trim() || !password.trim()) { onError("Name, username and password are required."); return; }
    if (password.trim().length < 6) { onError("Password must be at least 6 characters."); return; }
    try {
      setBusy(true);
      await api.createUser({ name: name.trim(), empId: empId.trim(), dept: dept.trim(), username: username.trim(), password: password.trim(), role: "employee" });
      setName(""); setEmpId(""); setDept(""); setUsername(""); setPassword("");
      await refreshEmployees();
    } catch (err) { onError(err.message || "Could not add employee."); }
    finally { setBusy(false); }
  };

  const saveEdit = async (id) => {
    if (!draft.name?.trim()) { onError("Name is required."); return; }
    try {
      setBusy(true);
      await api.updateUser(id, { name: draft.name.trim(), empId: draft.empId.trim(), dept: draft.dept.trim(), username: draft.username.trim() });
      if (draft.password && draft.password.trim()) await api.resetUserPassword(id, draft.password.trim());
      setEditing(null);
      await refreshEmployees();
    } catch (err) { onError(err.message || "Could not update employee."); }
    finally { setBusy(false); }
  };

  const removeEmployee = async (id) => {
    try {
      setBusy(true);
      await api.deleteUser(id);
      setConfirmDel(null);
      await refreshEmployees();
    } catch (err) { onError(err.message || "Could not remove employee."); }
    finally { setBusy(false); }
  };

  const updateAdminPassword = async () => {
    if (!currentAdminPw || !adminPw) { setAdminMsg("Enter current and new password."); return; }
    if (adminPw.trim().length < 6) { setAdminMsg("Use at least 6 characters."); return; }
    try {
      setBusy(true);
      await api.changePassword(currentAdminPw, adminPw.trim());
      setCurrentAdminPw(""); setAdminPw(""); setAdminMsg("Admin password updated.");
    } catch (err) { setAdminMsg(err.message || "Could not update admin password."); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700"><ShieldCheck className="h-4 w-4 text-indigo-500" /> Admin account</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="text-sm text-slate-600">Username: <span className="font-medium text-slate-900">{session?.username}</span></div>
          <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
            <input type="password" value={currentAdminPw} onChange={(e) => setCurrentAdminPw(e.target.value)} placeholder="Current password" className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />
            <input type="password" value={adminPw} onChange={(e) => setAdminPw(e.target.value)} placeholder="New admin password" className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />
            <button onClick={updateAdminPassword} disabled={busy} className="toop-btn rounded-lg px-3 py-2 text-sm font-medium">Update</button>
          </div>
        </div>
        {adminMsg && <div className={`mt-2 text-xs font-medium ${adminMsg.includes("updated") ? "text-emerald-600" : "text-rose-600"}`}>{adminMsg}</div>}
      </div>

      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Add an employee</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="sm:col-span-3 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />
          <input value={empId} onChange={(e) => setEmpId(e.target.value)} placeholder="ID" className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />
          <input value={dept} onChange={(e) => setDept(e.target.value)} placeholder="Department" className="sm:col-span-3 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" placeholder="Username" className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="sm:col-span-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />
          <button onClick={submit} disabled={busy || !name.trim() || !username.trim() || !password.trim()} className="toop-btn sm:col-span-1 flex items-center justify-center rounded-lg px-3 py-2 shadow-sm"><Plus className="h-5 w-5" /></button>
        </div>
        <p className="mt-2 text-xs text-slate-400">Username and password are required. Employee will be saved in MongoDB through the backend.</p>
      </div>

      {employees.length === 0 ? <EmptyState title="No employees yet" body="Add your first team member above." /> : (
        <ul className="space-y-2">{employees.map((e) => {
          const isEditing = editing === e._id;
          return (
            <li key={e._id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 shadow-sm">
              {isEditing ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-center">
                  <input value={draft.name} onChange={(ev) => setDraft({ ...draft, name: ev.target.value })} className="sm:col-span-3 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" placeholder="Full name" />
                  <input value={draft.empId} onChange={(ev) => setDraft({ ...draft, empId: ev.target.value })} className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" placeholder="ID" />
                  <input value={draft.dept} onChange={(ev) => setDraft({ ...draft, dept: ev.target.value })} className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" placeholder="Dept" />
                  <input value={draft.username} onChange={(ev) => setDraft({ ...draft, username: ev.target.value })} autoCapitalize="none" className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" placeholder="Username" />
                  <input type="password" value={draft.password} onChange={(ev) => setDraft({ ...draft, password: ev.target.value })} className="sm:col-span-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" placeholder="New pw" />
                  <div className="sm:col-span-2 flex gap-2">
                    <button onClick={() => saveEdit(e._id)} disabled={busy} className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">Save</button>
                    <button onClick={() => setEditing(null)} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={e.name} uid={e._id} />
                    <div>
                      <div className="font-semibold leading-tight">{e.name}</div>
                      <div className="text-xs text-slate-500">{e.empId}{e.empId && e.dept ? " · " : ""}{e.dept}{e.username ? <span className="ml-1 text-slate-400">· @{e.username}</span> : null}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditing(e._id); setDraft({ name: e.name, empId: e.empId || "", dept: e.dept || "", username: e.username || "", password: "" }); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => setConfirmDel(e._id)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              )}
              {confirmDel === e._id && (
                <div className="mt-3 flex flex-col gap-2 rounded-lg bg-rose-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-rose-700">Remove {e.name} from the roster?</span>
                  <div className="flex gap-2">
                    <button onClick={() => removeEmployee(e._id)} disabled={busy} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60">Remove</button>
                    <button onClick={() => setConfirmDel(null)} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">Keep</button>
                  </div>
                </div>
              )}
            </li>
          );
        })}</ul>
      )}
    </div>
  );
}
