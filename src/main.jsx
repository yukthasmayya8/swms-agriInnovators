import React, { useMemo, useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity, AlertTriangle, BarChart3, Bell, Bot, Building2, CalendarDays,
  CheckCircle2, ChevronDown, CircleHelp, Database, Download, FileCheck2,
  FileText, Gauge, Globe2, Home, Layers3, Leaf, LineChart, Map,
  Menu, MoreHorizontal, Pencil, RefreshCw, Search, Settings, ShieldCheck,
  SlidersHorizontal, UploadCloud, Users, Waves, X, Zap, Plus, Filter, UserCheck, KeyRound, AlertCircle, Info, Mic, Trash2
} from "lucide-react";
import "./styles.css";
import {
  optimizeWasteCollectionRoute,
  detectWasteAnomalies,
  calculateWardRiskScore
} from "./utils/algorithms";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "habitations", label: "Habitations", icon: Building2 },
  { id: "parameters", label: "Parameters", icon: SlidersHorizontal },
  { id: "gis", label: "GIS Map", icon: Map },
  { id: "uploads", label: "Data Upload", icon: UploadCloud },
  { id: "validation", label: "Validation", icon: FileCheck2 },
  { id: "waste", label: "Waste Simulation", icon: Activity },
  { id: "ward-compare", label: "Ward Comparison", icon: BarChart3 },
  { id: "forecast", label: "Past & Future Forecast", icon: LineChart },
  { id: "scenarios", label: "Scenarios", icon: AlertTriangle },
  { id: "sensitivity", label: "Sensitivity", icon: SlidersHorizontal },
  { id: "budget", label: "Budget & Optimization", icon: BarChart3 },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "assistant", label: "Ask SWMS", icon: Bot },
  { id: "admin-users", label: "Admin Console", icon: ShieldCheck },
];

const categories = [
  ["Demography", 92, ["Population", "Population Density", "Annual Growth Rate", "Floating Population"]],
  ["Community Infrastructure", 90, ["Road Coverage", "Residential Zones", "Industrial Zones", "Schools", "Collection Vehicles"]],
  ["Industrial Activities", 85, ["Organized Industry", "Unorganized Industry", "Industrial Waste", "Hazardous Share"]],
  ["Natural Resources", 92, ["Annual Rainfall", "Water Bodies", "Forest Cover", "Sensitive Areas"]],
  ["Terrain", 88, ["Slope", "Soil Type", "Wind Condition", "Flood Prone"]],
  ["Economic Conditions", 80, ["Per-Capita Income", "Annual Budget", "Willingness to Pay", "Cost Constraint"]],
  ["Cultural Significance", 78, ["Diet Type", "Segregation Adherence", "Festival Spike", "Local Practices"]],
];

const STORAGE_KEY = "swms-manual-data";
const SESSION_KEY = "swms-session";
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

function readActiveRecord() {
  try {
    const raw = localStorage.getItem("swms-active-record");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

/** Reusable Voice Input Button component */
function VoiceInputButton({ onSpeechResult }) {
  const [listening, setListening] = useState(false);

  function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please type directly or use Google Chrome.");
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setListening(true);
      recognition.onend = () => setListening(false);
      recognition.onerror = () => setListening(false);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) onSpeechResult(transcript);
        setListening(false);
      };
      recognition.start();
    } catch {
      setListening(false);
    }
  }

  return (
    <button
      type="button"
      className={`icon-button ${listening ? "listening" : ""}`}
      onClick={startListening}
      title={listening ? "Listening... Speak now!" : "Voice Input"}
      aria-label={listening ? "Listening for voice input" : "Enter this field by voice"}
      style={{
        background: listening ? "#fbe9e5" : "#fff",
        borderColor: listening ? "#c94b2b" : "var(--border)",
        color: listening ? "#c94b2b" : "var(--ink)",
        flex: "none"
      }}
    >
      <Mic size={16} />
    </button>
  );
}

async function apiRequest(path, session, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${session.accessToken}`);
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error?.message || "Request failed.");
  return result.data;
}

function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
  });
  if (!session?.accessToken || !session?.user) {
    return <AuthScreen onAuthenticated={(nextSession) => {
      localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
    }} />;
  }
  return <AuthenticatedApp session={session} onSessionUpdate={nextSession => { localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession)); setSession(nextSession); }} onSignOut={() => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  }} />;
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: localStorage.getItem("swms-last-email") || "", password: "", municipality: "Udupi Municipality", resetToken: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const path = mode === "login" ? "/api/auth/login" : mode === "register" ? "/api/auth/register" : "/api/auth/reset-password";
      const body = mode === "login" ? { email: form.email, password: form.password } : mode === "register" ? form : { email: form.email, password: form.password, resetToken: form.resetToken };
      const response = await fetch(`${API_BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error?.message || "Request failed.");
      if (mode === "login") { localStorage.setItem("swms-last-email", form.email); onAuthenticated(result.data); }
      else if (mode === "register") { setMode("login"); setMessage("Account created. Sign in now for read-only access until an administrator approves your account."); }
      else { setMode("login"); setMessage("Password reset. Sign in with your new password."); }
    } catch (requestError) {
      setError(requestError instanceof TypeError && requestError.message === "Failed to fetch"
        ? `Cannot reach the SWMS API at ${API_BASE}. Start it with: npm run dev:api`
        : requestError.message);
    }
    finally { setBusy(false); }
  }

  return <div className="auth-shell"><form className="auth-card" onSubmit={submit}>
    <div className="brand"><div className="brand-mark"><Leaf size={22} /></div><div><strong>SWMS</strong><span>Smart Waste Management Simulator</span></div></div>
    <div className="eyebrow">{mode === "login" ? "SIGN IN" : mode === "register" ? "CREATE ACCOUNT" : "RESET PASSWORD"}</div>
    <h1>{mode === "login" ? "Sign in to SWMS" : mode === "register" ? "Request stakeholder account" : "Reset your password"}</h1>
    <p>{mode === "login" ? "Access municipal waste planning data and GIS analytics." : mode === "register" ? "Register to access your assigned municipality." : "Use the reset token issued for your account."}</p>
    {mode === "register" && <>
      <label>Full name<input required minLength="2" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
      <label>Municipality<select value={form.municipality} onChange={event => setForm({ ...form, municipality: event.target.value })}>
        <option value="Udupi Municipality">Udupi Municipality</option>
        <option value="Mangaluru City Corporation">Mangaluru City Corporation</option>
        <option value="Kundapura Municipality">Kundapura Municipality</option>
      </select></label>
    </>}
    <label>Email<input required type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label>
    <label>Password<input required minLength="8" type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /></label>
    {mode === "reset" && <label>Reset token<input required value={form.resetToken} onChange={event => setForm({ ...form, resetToken: event.target.value })} /></label>}
    {error && <div className="form-error">{error}</div>}{message && <div className="form-message">{message}</div>}
    <button className="button primary full-width" disabled={busy}>{busy ? "Please wait..." : mode === "login" ? "Sign in" : "Register account"}</button>
    {mode === "login" && <button type="button" className="text-button" onClick={async () => { setError(""); setMessage(""); if (!form.email) { setError("Enter your email first."); return; } try { const response = await fetch(`${API_BASE}/api/auth/forgot-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.email }) }); const result = await response.json(); if (!response.ok) throw new Error(result?.error?.message || "Request failed."); setForm(current => ({ ...current, resetToken: result.data.resetToken || "" })); setMode("reset"); setMessage(result.data.resetToken ? `Reset token: ${result.data.resetToken}` : "Check your email for the reset token."); } catch (requestError) { setError(requestError.message); } }}>Forgot password?</button>}
    <button type="button" className="text-button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setMessage(""); }}>{mode === "login" ? "Need an account? Register" : "Already registered? Sign in"}</button>
  </form></div>;
}

function AuthenticatedApp({ session, onSessionUpdate, onSignOut }) {
  const [page, setPage] = useState("dashboard");
  const role = session.user.role;
  const userMunicipality = session.user.municipality || "All";
  const isPending = session.user.isActive === false;
  const isReadOnly = isPending || role === "researcher";
  const [sidebar, setSidebar] = useState(true);
  const [toast, setToast] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Demography");
  const [layers, setLayers] = useState({ roads: true, water: true, settlements: true, terrain: true, heatmaps: true, bins: true, routes: true });
  const [scenario, setScenario] = useState("Normal");
  const [populationChange, setPopulationChange] = useState(0);
  const [rainfall, setRainfall] = useState(0);
  const [query, setQuery] = useState("");
  const [activeRecord, setActiveRecord] = useState(() => readActiveRecord());
  const [habitations, setHabitations] = useState([]);
  const [selectedHabitationId, setSelectedHabitationId] = useState("");
  const [simulationData, setSimulationData] = useState(null);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [simulationRevision, setSimulationRevision] = useState(0);
  const [simulationOverrides, setSimulationOverrides] = useState({ population: "", perCapitaKg: "", collectionVehicles: "" });

  useEffect(() => {
    apiRequest("/api/auth/me", session).then(user => onSessionUpdate({ ...session, user })).catch(() => { });
  }, [session.accessToken]);

  const loadHabitations = () => {
    apiRequest("/api/habitations", session)
      .then((items) => {
        setHabitations(items);
        setSelectedHabitationId((current) => current || items[0]?.id || "");
      })
      .catch(() => notify("Unable to load habitations from the server."));
  };

  useEffect(() => { loadHabitations(); }, [session]);

  const selectedHabitation = habitations.find((item) => item.id === selectedHabitationId);

  const currentHabitation = useMemo(() => ({ ...(selectedHabitation || {}), ...(activeRecord || {}) }), [activeRecord, selectedHabitation]);

  useEffect(() => {
    if (!selectedHabitationId) { setSimulationData(null); return; }
    setSimulationLoading(true);
    const overrideQuery = Object.entries(simulationOverrides).filter(([, value]) => value !== "").map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");
    apiRequest(`/api/habitations/${selectedHabitationId}/simulation?scenario=${encodeURIComponent(scenario.toLowerCase())}${overrideQuery ? `&${overrideQuery}` : ""}`, session)
      .then(setSimulationData)
      .catch(error => { setSimulationData(null); notify(error.message); })
      .finally(() => setSimulationLoading(false));
  }, [selectedHabitationId, scenario, session, simulationRevision, simulationOverrides]);

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  };

  const navigate = (id) => {
    setPage(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="app-shell">
      {sidebar && <Sidebar page={page} navigate={navigate} role={role} isPending={isPending} municipality={userMunicipality} />}
      <div className={sidebar ? "main-shell" : "main-shell full"}>
        <Topbar
          habitations={habitations}
          selectedHabitationId={selectedHabitationId}
          setSelectedHabitationId={setSelectedHabitationId}
          role={role}
          user={session.user}
          onMenu={() => setSidebar(v => !v)}
          notify={notify}
          onSignOut={onSignOut}
        />
        <main className="content">
          {isPending && <div className="pending-banner"><ShieldCheck size={18} /><span><strong>Account pending approval.</strong> Read-only access to assigned municipality ({userMunicipality}).</span></div>}
          {page === "dashboard" && <Dashboard navigate={navigate} record={currentHabitation} simulation={simulationData} user={session.user} habitations={habitations} />}
          {page === "habitations" && <Habitations navigate={navigate} notify={notify} session={session} habitations={habitations} loadHabitations={loadHabitations} setSelectedHabitationId={setSelectedHabitationId} isPending={isReadOnly} userMunicipality={userMunicipality} />}
          {page === "parameters" && <Parameters selected={selectedCategory} setSelected={setSelectedCategory} notify={notify} session={session} habitation={selectedHabitation} isPending={isReadOnly} onChanged={() => { setSimulationRevision(value => value + 1); loadHabitations(); }} />}
          {page === "gis" && <GIS layers={layers} setLayers={setLayers} notify={notify} session={session} habitation={selectedHabitation} habitations={habitations} simulation={simulationData} canEdit={!isReadOnly} />}
          {page === "uploads" && <Uploads notify={notify} onApplyRecord={setActiveRecord} session={session} habitation={selectedHabitation} canEdit={!isReadOnly} />}
          {page === "validation" && <Validation session={session} habitationId={selectedHabitationId} />}
          {page === "waste" && <WasteDashboard simulation={simulationData} record={currentHabitation} loading={simulationLoading} overrides={simulationOverrides} setOverrides={setSimulationOverrides} />}
          {page === "ward-compare" && <WardCompare session={session} userMunicipality={userMunicipality} habitations={habitations} loadHabitations={loadHabitations} isPending={isReadOnly} notify={notify} />}
          {page === "forecast" && <Forecast forecastData={simulationData?.forecast || []} loading={simulationLoading} record={currentHabitation} />}
          {page === "scenarios" && <Scenarios scenario={scenario} setScenario={setScenario} simulation={simulationData} loading={simulationLoading} onRun={() => setSimulationRevision(value => value + 1)} />}
          {page === "sensitivity" && <Sensitivity session={session} habitationId={selectedHabitationId} simulation={simulationData} loading={simulationLoading} />}
          {page === "budget" && <Budget session={session} habitationId={selectedHabitationId} simulation={simulationData} loading={simulationLoading} />}
          {page === "reports" && <Reports notify={notify} simulation={simulationData} record={currentHabitation} />}
          {page === "assistant" && <Assistant session={session} habitationId={selectedHabitationId} query={query} setQuery={setQuery} forecastData={simulationData?.forecast || []} />}
          {page === "admin-users" && role === "admin" && <AdminConsole session={session} notify={notify} />}
        </main>
      </div>
      {toast && <div className="toast"><CheckCircle2 size={17} />{toast}</div>}
    </div>
  );
}

function Sidebar({ page, navigate, role, isPending, municipality }) {
  const readOnlyPages = new Set(["dashboard", "habitations", "parameters", "gis", "ward-compare", "forecast", "reports"]);
  const visibleNav = NAV.filter(item => {
    if (item.id === "admin-users") return role === "admin";
    if (isPending || role === "researcher") return readOnlyPages.has(item.id);
    return true;
  });
  return <aside className="sidebar">
    <div className="brand">
      <div className="brand-mark"><Leaf size={22} /></div>
      <div><strong>SWMS</strong><span>Smart Waste Simulator</span></div>
    </div>
    <div className="role-mini"><ShieldCheck size={14} /><span>{role} · {municipality}</span></div>
    <nav>
      {visibleNav.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? "nav-item active" : "nav-item"} onClick={() => navigate(id)}>
        <Icon size={18} /><span>{label}</span>
      </button>)}
    </nav>
    <div className="sidebar-bottom">
      <div className="help-box"><CircleHelp size={18} /><div><b>Scope Isolation</b><span>{municipality === "All" ? "Super Admin Access" : municipality}</span></div></div>
    </div>
  </aside>;
}

function Topbar({ habitations, selectedHabitationId, setSelectedHabitationId, role, user, onMenu, notify, onSignOut }) {
  return <header className="topbar">
    <button className="icon-button mobile-menu" onClick={onMenu}><Menu size={20} /></button>
    <div className="select-wrap"><Map size={15} /><select value={selectedHabitationId} onChange={e => setSelectedHabitationId(e.target.value)}><option value="">Select ward / habitation</option>{habitations.map(item => <option value={item.id} key={item.id}>{item.name} ({item.municipality || "Udupi"})</option>)}</select></div>
    <div className="top-actions">
      <div className="select-wrap role-select"><ShieldCheck size={14} /><span>{role}</span></div>
      <button className="icon-button" onClick={() => notify("No new notifications")}><Bell size={18} /></button>
      <div className="avatar" title={user.name}>{user.name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase()}</div>
      <button className="text-button" onClick={onSignOut}>Sign out</button>
    </div>
  </header>;
}

function PageHeader({ eyebrow, title, description, action }) {
  return <div className="page-header">
    <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>
    {action}
  </div>;
}

function KPI({ label, value, sub, icon: Icon, tone = "green" }) {
  return <div className="kpi">
    <div className={"kpi-icon " + tone}><Icon size={19} /></div>
    <div><span>{label}</span><strong>{value}</strong>{sub && <small>{sub}</small>}</div>
  </div>;
}

function Dashboard({ navigate, record, simulation, user, habitations }) {
  const current = simulation?.years?.[0];
  const populationLabel = formatNumber(record.population);
  const wasteLabel = current ? `${current.totalWasteTonnesPerDay.toFixed(2)} t/day` : "Unavailable";
  return <div>
    <PageHeader eyebrow="OVERVIEW" title={`Good morning, ${user.name.split(/\s+/)[0]}`} description={`Active scope: ${user.municipality || "All Municipalities"}. Real-time ward analysis & collection readiness.`} action={<button className="button primary" onClick={() => navigate("forecast")}><LineChart size={16} /> View 40-Year Past & Future Trend</button>} />
    <div className="kpi-grid">
      <KPI label="Monitored Wards" value={habitations.length} sub={`Under ${user.municipality || "All"}`} icon={Building2} />
      <KPI label="Waste Generated" value={wasteLabel} sub="Current active record" icon={Leaf} />
      <KPI label="Collection Fleet" value={current ? current.vehiclesRequired : "Unavailable"} sub={current ? "Required for current waste load" : "Simulation required"} icon={Activity} />
      <KPI label="Population" value={populationLabel} sub={`+${Number(record.growth || 0).toFixed(1)}% annual growth`} icon={Users} />
    </div>
    <div className="dashboard-grid">
      <div className="panel map-panel">
        <PanelTitle title="Habitation & Ward Map" meta={`${habitations.length} wards mapped`} action={<button className="text-button" onClick={() => navigate("gis")}>Open Interactive GIS <ChevronDown size={14} /></button>} />
        <MiniMap layers={{ roads: true, water: true, settlements: true, terrain: true }} />
      </div>
      <div className="panel">
        <PanelTitle title="Data readiness by category" meta="Last checked today" />
        <div className="readiness-list">
          {categories.map(([name, pct]) => <div className="readiness-row" key={name}><div><span>{name}</span><b>{pct}%</b></div><div className="progress"><i style={{ width: pct + "%" }} /></div></div>)}
        </div>
      </div>
    </div>
  </div>;
}

function PanelTitle({ title, meta, action }) { return <div className="panel-title"><div><h3>{title}</h3>{meta && <span>{meta}</span>}</div>{action}</div> }

function MiniMap({ layers }) {
  return <div className="mini-map">
    <svg viewBox="0 0 800 330" preserveAspectRatio="none">
      <rect width="800" height="330" fill="#dbe5dc" />
      <path d="M0 250 C130 185 210 300 330 225 S560 90 800 170 L800 330 L0 330Z" fill="#a9c8d3" />
      <path d="M-20 60 C160 125 230 40 370 105 S620 200 820 90" fill="none" stroke="#e7eee5" strokeWidth="22" />
      {layers.roads && <g stroke="#8d9a92" strokeWidth="4" opacity=".9"><path d="M20 290 L170 180 L330 220 L470 70 L780 120" /><path d="M80 40 L220 120 L410 100 L610 250" /><path d="M310 320 L350 220 L470 170 L720 285" /></g>}
      {layers.terrain && <g fill="none" stroke="#6f9276" strokeWidth="2" opacity=".55"><ellipse cx="230" cy="165" rx="130" ry="70" /><ellipse cx="230" cy="165" rx="95" ry="50" /><ellipse cx="230" cy="165" rx="60" ry="32" /></g>}
      {layers.settlements && <g fill="#5c7663" opacity=".8">{[120, 155, 185, 220, 255, 300, 330, 360, 395, 440, 500, 560, 620].map((x, i) => <rect key={i} x={x} y={130 + (i % 4) * 24} width="16" height="10" rx="2" />)}</g>}
      {layers.water && <path d="M570 0 C520 90 650 110 570 180 C520 225 650 260 610 330" fill="none" stroke="#4b7c94" strokeWidth="12" opacity=".8" />}
      <circle cx="398" cy="160" r="10" fill="#2f5d50" stroke="white" strokeWidth="5" />
    </svg>
    <div className="map-legend"><span><i className="dot road" />Roads</span><span><i className="dot water" />Water</span><span><i className="dot settlement" />Settlements</span><span><i className="dot terrain" />Terrain</span></div>
  </div>;
}

/** Ward Waste Comparison Component */
function WardCompare({ session, userMunicipality, habitations, loadHabitations, isPending, notify }) {
  const [selectedMunicipality, setSelectedMunicipality] = useState(userMunicipality === "All" ? "Udupi Municipality" : userMunicipality);
  const [comparisonData, setComparisonData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingWard, setEditingWard] = useState(null);
  const [deletingWard, setDeletingWard] = useState(null);

  const loadCompare = () => {
    setLoading(true);
    apiRequest(`/api/habitations/compare?municipality=${encodeURIComponent(selectedMunicipality)}`, session)
      .then((data) => setComparisonData(data))
      .catch(() => setComparisonData([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCompare(); }, [selectedMunicipality, session]);

  const maxWaste = Math.max(...comparisonData.map(d => d.totalWasteTonnesPerDay), 1);

  return <div>
    <PageHeader eyebrow="COMPARATIVE ANALYTICS" title="Ward Waste Comparison" description="Compare waste generation, per-capita daily rates, and wet/dry/hazardous breakdown across wards under the same municipality."
      action={<div className="select-wrap"><Building2 size={16} /><select value={selectedMunicipality} onChange={e => setSelectedMunicipality(e.target.value)}>
        {userMunicipality === "All" && <>
          <option value="Udupi Municipality">Udupi Municipality</option>
          <option value="Mangaluru City Corporation">Mangaluru City Corporation</option>
          <option value="Kundapura Municipality">Kundapura Municipality</option>
        </>}
        {userMunicipality !== "All" && <option value={userMunicipality}>{userMunicipality}</option>}
        {userMunicipality === "All" && <option value="All">All Municipalities</option>}
      </select></div>}
    />

    {editingWard && <EditWardModal session={session} ward={editingWard} onClose={() => setEditingWard(null)} onSaved={() => { loadCompare(); loadHabitations(); notify("Ward details updated in database."); }} />}
    {deletingWard && <DeleteWardModal session={session} ward={deletingWard} onClose={() => setDeletingWard(null)} onDeleted={() => { loadCompare(); loadHabitations(); notify("Ward removed from database."); }} />}

    {loading ? <div className="panel"><p className="muted">Loading comparison data...</p></div> : comparisonData.length === 0 ? <div className="panel"><p className="muted">No ward data recorded for {selectedMunicipality}.</p></div> : <>
      <div className="ward-compare-grid">
        {comparisonData.map((ward) => {
          const wetPct = Math.round((ward.wetWasteTonnesPerDay / ward.totalWasteTonnesPerDay) * 100) || 55;
          const dryPct = Math.round((ward.dryWasteTonnesPerDay / ward.totalWasteTonnesPerDay) * 100) || 40;
          const hazPct = 100 - wetPct - dryPct;
          return <div className="compare-card" key={ward.habitationId}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3>{ward.wardName}</h3>
                <span className="mun-tag">{ward.municipality}</span>
              </div>
              {!isPending && <div style={{ display: "flex", gap: 4 }}>
                <button className="icon-button" title="Edit Ward Details" onClick={() => setEditingWard(ward)}><Pencil size={14} /></button>
                <button className="icon-button" title="Remove Ward" onClick={() => setDeletingWard(ward)} style={{ color: "#c94b2b" }}><Trash2 size={14} /></button>
              </div>}
            </div>
            <div className="compare-metrics">
              <div className="compare-metric-box"><label>Total Waste</label><strong>{ward.totalWasteTonnesPerDay} t/day</strong></div>
              <div className="compare-metric-box"><label>Per Capita</label><strong>{ward.perCapitaDailyKg} kg/day</strong></div>
              <div className="compare-metric-box"><label>Population</label><strong>{ward.population.toLocaleString()}</strong></div>
              <div className="compare-metric-box"><label>Collection</label><strong>{ward.collectionEfficiencyPct}%</strong></div>
            </div>
            <div className="muted" style={{ marginBottom: 4 }}>Waste Composition Breakdown:</div>
            <div className="waste-bar-split">
              <div className="wet" style={{ width: wetPct + "%" }} title={`Wet: ${ward.wetWasteTonnesPerDay}t`} />
              <div className="dry" style={{ width: dryPct + "%" }} title={`Dry: ${ward.dryWasteTonnesPerDay}t`} />
              <div className="hazardous" style={{ width: hazPct + "%" }} title={`Hazardous: ${ward.hazardousWasteTonnesPerDay}t`} />
            </div>
            <div className="legend-inline">
              <span><i className="legend-dot" style={{ background: "#3e8e58" }} />Wet ({wetPct}%)</span>
              <span><i className="legend-dot" style={{ background: "#3e6e8e" }} />Dry ({dryPct}%)</span>
              <span><i className="legend-dot" style={{ background: "#c94b2b" }} />Haz ({hazPct}%)</span>
            </div>
          </div>;
        })}
      </div>

      <div className="panel">
        <PanelTitle title="Side-by-side Waste Generation Bar Chart" meta={`Comparing ${comparisonData.length} wards`} />
        <div style={{ display: "flex", alignItems: "flex-end", gap: 20, height: 220, padding: "20px 10px" }}>
          {comparisonData.map((w) => <div key={w.habitationId} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: "bold" }}>{w.totalWasteTonnesPerDay}t</div>
            <div style={{ width: "100%", maxWidth: 60, height: Math.max(30, (w.totalWasteTonnesPerDay / maxWaste) * 140), background: "var(--primary)", borderRadius: "6px 6px 0 0" }} />
            <div style={{ fontSize: 11, color: "var(--muted)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", width: "100%", textAlign: "center" }}>{w.wardName}</div>
          </div>)}
        </div>
      </div>
    </>}
  </div>;
}

/** Ward Edit Modal Component - Persists changes directly to PostgreSQL DB */
function EditWardModal({ session, ward, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: ward.wardName || ward.name || "",
    type: ward.type || "ward",
    municipality: ward.municipality || "Udupi Municipality",
    latitude: ward.latitude || "13.3409",
    longitude: ward.longitude || "74.7421"
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await apiRequest(`/api/habitations/${ward.habitationId || ward.id}`, session, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          municipality: form.municipality,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude)
        })
      });
      onSaved();
      onClose();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <div className="modal-overlay"><div className="modal-content" style={{ width: "min(90vw, 520px)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
      <h2>Edit Ward Details</h2>
      <button className="icon-button" onClick={onClose}><X size={18} /></button>
    </div>
    <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
      <label className="field">
        <span>Ward Name</span>
        <div style={{ display: "flex", gap: 8 }}>
          <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ flex: 1 }} />
          <VoiceInputButton onSpeechResult={text => setForm({ ...form, name: text })} />
        </div>
      </label>
      <label className="field"><span>Type</span><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="ward">Ward</option><option value="town">Town</option><option value="village">Village</option></select></label>
      <label className="field"><span>Municipality</span><select value={form.municipality} onChange={e => setForm({ ...form, municipality: e.target.value })}>
        <option value="Udupi Municipality">Udupi Municipality</option>
        <option value="Mangaluru City Corporation">Mangaluru City Corporation</option>
        <option value="Kundapura Municipality">Kundapura Municipality</option>
      </select></label>
      <label className="field"><span>Latitude</span><input required type="number" step="any" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} /></label>
      <label className="field"><span>Longitude</span><input required type="number" step="any" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} /></label>
      {error && <div className="form-error">{error}</div>}
      <div className="form-actions" style={{ marginTop: 12 }}>
        <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
        <button className="button primary" disabled={busy}>{busy ? "Saving to Database..." : "Save Changes"}</button>
      </div>
    </form>
  </div></div>;
}

/** Ward Delete Modal Component - Soft-deletes ward directly in PostgreSQL DB */
function DeleteWardModal({ session, ward, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirmDelete() {
    setBusy(true); setError("");
    try {
      await apiRequest(`/api/habitations/${ward.habitationId || ward.id}`, session, { method: "DELETE" });
      onDeleted();
      onClose();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <div className="modal-overlay"><div className="modal-content" style={{ width: "min(90vw, 440px)" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, color: "#c94b2b" }}>
      <AlertTriangle size={24} />
      <h2>Remove Ward?</h2>
    </div>
    <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
      Are you sure you want to remove <strong>{ward.wardName || ward.name}</strong> from the database? This action will mark the ward record as deleted.
    </p>
    {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}
    <div className="form-actions" style={{ marginTop: 16 }}>
      <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
      <button className="button primary" style={{ background: "#c94b2b", borderColor: "#c94b2b" }} disabled={busy} onClick={confirmDelete}>
        {busy ? "Deleting..." : "Confirm Delete"}
      </button>
    </div>
  </div></div>;
}

/** Admin Console for Account Management */
function AdminConsole({ session, notify }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "Password123!", role: "planner", municipality: "Udupi Municipality" });
  const [busy, setBusy] = useState(false);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await apiRequest("/api/users", session);
      setUsers(data);
    } catch (err) { notify(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadUsers(); }, [session]);

  async function createUser(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiRequest("/api/users", session, { method: "POST", body: JSON.stringify(form) });
      notify(`User ${form.name} created.`);
      setShowModal(false);
      setForm({ name: "", email: "", password: "Password123!", role: "planner", municipality: "Udupi Municipality" });
      loadUsers();
    } catch (err) { notify(err.message); }
    finally { setBusy(false); }
  }

  async function updateUser(userId, patch) {
    try {
      await apiRequest(`/api/users/${userId}`, session, { method: "PATCH", body: JSON.stringify(patch) });
      notify("User updated.");
      loadUsers();
    } catch (err) { notify(err.message); }
  }

  return <div>
    <PageHeader eyebrow="SUPER ADMIN CONSOLE" title="User Accounts & Access Control" description="Create stakeholder accounts, assign municipality scopes, manage roles, and toggle account activation status."
      action={<button className="button primary" onClick={() => setShowModal(true)}><Plus size={16} /> Create User Account</button>}
    />

    {showModal && <div className="modal-overlay"><div className="modal-content">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2>Create Municipal User Account</h2>
        <button className="icon-button" onClick={() => setShowModal(false)}><X size={18} /></button>
      </div>
      <form onSubmit={createUser} style={{ display: "grid", gap: 12 }}>
        <label className="field"><span>Full Name</span><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
        <label className="field"><span>Email Address</span><input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
        <label className="field"><span>Temporary Password</span><input required minLength="8" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label>
        <label className="field"><span>Access Role</span><select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
          <option value="admin">Super Admin</option>
          <option value="planner">Municipal Planner</option>
          <option value="researcher">Researcher / Viewer</option>
        </select></label>
        <label className="field"><span>Assigned Municipality Scope</span><select value={form.municipality} onChange={e => setForm({ ...form, municipality: e.target.value })}>
          <option value="Udupi Municipality">Udupi Municipality</option>
          <option value="Mangaluru City Corporation">Mangaluru City Corporation</option>
          <option value="Kundapura Municipality">Kundapura Municipality</option>
          <option value="All">All Municipalities (Super Admin)</option>
        </select></label>
        <div className="form-actions" style={{ marginTop: 12 }}>
          <button type="button" className="button secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="button primary" disabled={busy}>{busy ? "Creating..." : "Create Account"}</button>
        </div>
      </form>
    </div></div>}

    <div className="panel">
      <PanelTitle title="Registered System Users" meta={`${users.length} accounts total`} action={<button className="button secondary" onClick={loadUsers}><RefreshCw size={15} /> Refresh</button>} />
      {loading ? <p className="muted">Loading users...</p> : <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name & Email</th>
              <th>Role</th>
              <th>Municipality Scope</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => <tr key={u.id}>
              <td><strong>{u.name}</strong><br /><small className="muted">{u.email}</small></td>
              <td><span className="algorithm-badge">{u.role}</span></td>
              <td><select value={u.municipality || "All"} onChange={event => updateUser(u.id, { municipality: event.target.value })}><option value="All">All Municipalities</option><option value="Udupi Municipality">Udupi Municipality</option><option value="Mangaluru City Corporation">Mangaluru City Corporation</option><option value="Kundapura Municipality">Kundapura Municipality</option></select></td>
              <td><span className={`badge ${u.isActive ? "validated" : "pending"}`}>{u.isActive ? "Active" : "Inactive"}</span></td>
              <td>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="text-button" onClick={() => updateUser(u.id, { isActive: !u.isActive })}>{u.isActive ? "Deactivate" : "Activate"}</button>
                  <button className="text-button" onClick={() => { const pwd = prompt("Enter new password for " + u.name); if (pwd) updateUser(u.id, { password: pwd }); }}><KeyRound size={13} /> Reset Pwd</button>
                </div>
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>}
    </div>
  </div>;
}

/** Interactive GIS Map Component */
function GIS({ layers, setLayers, notify, session, habitation, habitations, simulation, canEdit }) {
  const mapContainerRef = useRef(null);
  const leafletMapRef = useRef(null);
  const [mapLayerData, setMapLayerData] = useState([]);

  useEffect(() => {
    if (!habitation?.id) { setMapLayerData([]); return; }
    apiRequest(`/api/habitations/${habitation.id}/map-layers`, session).then(setMapLayerData).catch(() => setMapLayerData([]));
  }, [habitation?.id, session]);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (leafletMapRef.current) { leafletMapRef.current.remove(); leafletMapRef.current = null; }

    if (!window.L) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);

      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => initMap();
      document.head.appendChild(script);
    } else {
      initMap();
    }

    function initMap() {
      const L = window.L;
      const center = habitation ? [habitation.latitude || 13.3409, habitation.longitude || 74.7421] : [13.3409, 74.7421];
      const map = L.map(mapContainerRef.current).setView(center, 13);
      leafletMapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
      }).addTo(map);

      habitations.forEach((h) => {
        const wasteTonnes = h.id === habitation?.id && simulation?.years?.[0] ? simulation.years[0].totalWasteTonnesPerDay : null;
        const color = wasteTonnes === null ? "#2f5d50" : wasteTonnes > 15 ? "#c94b2b" : wasteTonnes > 10 ? "#c97a2b" : "#2f5d50";

        const circle = L.circle([h.latitude, h.longitude], {
          color,
          fillColor: color,
          fillOpacity: 0.35,
          radius: 800
        }).addTo(map);

        circle.bindPopup(`
          <div style="font-family: sans-serif; padding: 4px;">
            <strong style="font-size: 14px; color: #1B2B29;">${h.name}</strong><br/>
            <span style="font-size: 11px; color: #68766F;">${h.municipality || "Udupi Municipality"}</span>
            <hr style="margin: 6px 0; border: 0; border-top: 1px solid #ddd;"/>
            <div style="font-size: 12px; line-height: 1.5;">
              <b>Population:</b> ${Number(h.population || 25000).toLocaleString()}<br/>
              ${wasteTonnes === null ? "" : `<b>Simulated waste:</b> ${wasteTonnes.toFixed(2)} t/day<br/>`}
              <b>GIS layers:</b> ${h.id === habitation?.id ? mapLayerData.length : "-"}<br/>
              <b>Status:</b> <span style="color: ${color}; font-weight: bold;">${wasteTonnes === null ? "Stored ward location" : wasteTonnes > 15 ? "High Pressure" : "Normal"}</span>
            </div>
          </div>
        `);
      });
      if (layers.heatmaps) mapLayerData.forEach(layer => {
        if (!layer.geometry) return;
        try { L.geoJSON(typeof layer.geometry === "string" ? JSON.parse(layer.geometry) : layer.geometry, { color: "#c97a2b", weight: 2, fillOpacity: 0.15 }).addTo(map); } catch { }
      });
    }
  }, [habitation, habitations, simulation, mapLayerData, layers.heatmaps]);

  return <div><PageHeader eyebrow="GIS SPATIAL ANALYTICS" title="Interactive Geographical Map" description="Leaflet spatial visualization of ward boundaries, waste intensity heat zones, collection points, and route polylines." />
    <div className="gis-layout">
      <div className="panel gis-map" style={{ padding: 12 }}>
        <div className="leaflet-container-wrap" ref={mapContainerRef} />
        <div className="map-note" style={{ marginTop: 8 }}>Interactive Leaflet GIS Map. Click ward overlays to inspect population, waste breakdown, and collection schedule.</div>
      </div>
      <div className="panel layer-panel">
        <PanelTitle title="Map Overlays" meta={`${mapLayerData.length} stored layers`} />
        <label className="layer-row"><span><Map size={18} />Ward Boundaries & Heatmaps</span><input type="checkbox" checked={layers.heatmaps} onChange={e => setLayers({ ...layers, heatmaps: e.target.checked })} /></label>
        <label className="layer-row"><span><Globe2 size={18} />Collection Bins & Depot</span><input type="checkbox" checked={layers.bins} onChange={e => setLayers({ ...layers, bins: e.target.checked })} /></label>
        <label className="layer-row"><span><Activity size={18} />Collection Vehicle Routes</span><input type="checkbox" checked={layers.routes} onChange={e => setLayers({ ...layers, routes: e.target.checked })} /></label>
        <div className="muted" style={{ marginTop: 12 }}>Stored layer status</div>
        {mapLayerData.length ? mapLayerData.map(layer => <div className="layer-row" key={layer.id}><span>{layer.layerType || layer.layer_type}</span><strong>{layer.status}</strong></div>) : <p className="muted">No uploaded GIS layers for the selected ward.</p>}
      </div>
    </div>
  </div>;
}

/** Analytics & Optimization Suite */
function AlgorithmsAnalytics({ session, habitations, notify, forecastData }) {
  const [tab, setTab] = useState("vrp");

  const sampleDepot = { id: "depot", name: "Central Municipal Depot", lat: 13.3409, lng: 74.7421, fillLevelPct: 0, capacityKg: 0 };
  const sampleBins = [
    { id: "b1", name: "Bin 01 - Commercial Market", lat: 13.3450, lng: 74.7480, fillLevelPct: 88, capacityKg: 1000 },
    { id: "b2", name: "Bin 02 - Hospital Gate", lat: 13.3520, lng: 74.7900, fillLevelPct: 92, capacityKg: 800 },
    { id: "b3", name: "Bin 03 - Bus Terminal", lat: 13.3380, lng: 74.7350, fillLevelPct: 75, capacityKg: 1200 },
    { id: "b4", name: "Bin 04 - Residential Complex", lat: 13.3300, lng: 74.7250, fillLevelPct: 40, capacityKg: 600 },
  ];
  const [vrpResult, setVrpResult] = useState(null);

  const sampleWasteLogs = [8.2, 8.5, 8.1, 8.4, 8.3, 8.6, 8.2, 14.8];
  const anomalyReport = useMemo(() => detectWasteAnomalies(sampleWasteLogs.slice(0, -1), sampleWasteLogs[sampleWasteLogs.length - 1], "h1", "Udupi Central Ward 01"), []);

  const mcdaScores = useMemo(() => {
    return habitations.map(h => calculateWardRiskScore(h.id, h.name, (h.population || 20000) * 0.000673 + 1.2, h.population || 20000, 60, 80, true));
  }, [habitations]);

  return <div>
    <PageHeader eyebrow="PROCESSING ANALYTICS" title="Analytics & Optimization Suite" description="Run TSP collection route optimization, statistical waste forecasting, Z-Score anomaly detection, and MCDA ward risk scoring." />

    <div className="tab-buttons">
      <button className={`tab-button ${tab === "vrp" ? "active" : ""}`} onClick={() => setTab("vrp")}>1. Route Optimization (VRP/TSP)</button>
      <button className={`tab-button ${tab === "forecast" ? "active" : ""}`} onClick={() => setTab("forecast")}>2. Past & Future Forecast</button>
      <button className={`tab-button ${tab === "anomaly" ? "active" : ""}`} onClick={() => setTab("anomaly")}>3. Anomaly & Overflow Detector</button>
      <button className={`tab-button ${tab === "mcda" ? "active" : ""}`} onClick={() => setTab("mcda")}>4. MCDA Ward Risk Scorecard</button>
    </div>

    {tab === "vrp" && <div className="panel">
      <PanelTitle title="Vehicle Collection Route Optimization (Greedy TSP Algorithm)" meta="Minimizes travel distance and prioritizes filled bins"
        action={<button className="button primary" onClick={() => setVrpResult(optimizeWasteCollectionRoute(sampleDepot, sampleBins))}><Zap size={15} /> Run Route Optimization</button>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <h4>Monitored Collection Bins</h4>
          {sampleBins.map(b => <div key={b.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#f8faf8", border: "1px solid #e2e8e3", borderRadius: 6, marginBottom: 6 }}>
            <span><strong>{b.name}</strong></span>
            <span className={`algorithm-badge ${b.fillLevelPct >= 80 ? "critical" : ""}`}>{b.fillLevelPct}% Full ({Math.round((b.fillLevelPct / 100) * b.capacityKg)} kg)</span>
          </div>)}
        </div>

        <div>
          <h4>Optimization Result</h4>
          {vrpResult ? <div>
            <div className="compare-metrics">
              <div className="compare-metric-box"><label>Total Distance</label><strong>{vrpResult.totalDistanceKm} km</strong></div>
              <div className="compare-metric-box"><label>Est. Travel Time</label><strong>{vrpResult.estimatedTimeMins} mins</strong></div>
            </div>
            <div className="muted" style={{ marginBottom: 6 }}>Sequenced Collection Steps:</div>
            <ol style={{ paddingLeft: 18, margin: 0, fontSize: 12, lineHeight: 1.6 }}>
              {vrpResult.steps.map((s, idx) => <li key={idx}><strong>{s.from}</strong> → <strong>{s.to}</strong> ({s.distanceKm} km)</li>)}
            </ol>
          </div> : <p className="muted">Click 'Run Route Optimization' to compute the shortest collection route.</p>}
        </div>
      </div>
    </div>}

    {tab === "forecast" && <div className="panel">
      <PanelTitle title="40-Year Waste Forecast (20-Year Past + 20-Year Future)" meta="Historical Reconstruction & Future Projection" />
      <div className="table-wrap" style={{ marginTop: 14 }}>
        <table>
          <thead>
            <tr><th>Year</th><th>Period</th><th>Population</th><th>Waste (t/day)</th><th>Lower Bound</th><th>Upper Bound</th></tr>
          </thead>
          <tbody>
            {forecastData.filter((_, idx) => idx % 4 === 0).map(f => <tr key={f.year}>
              <td><strong>{f.year}</strong></td>
              <td><span className={`algorithm-badge ${f.period?.includes("Past") ? "warning" : ""}`}>{f.period}</span></td>
              <td>{f.population.toLocaleString()}</td>
              <td><strong style={{ color: "var(--primary)" }}>{f.wasteTonnesPerDay} t</strong></td>
              <td>{f.lowerBound} t</td>
              <td>{f.upperBound} t</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>}

    {tab === "anomaly" && <div className="panel">
      <PanelTitle title="Z-Score & Interquartile Range (IQR) Anomaly Detector" meta="Detects abnormal spikes in daily waste generation" />
      <div className="compare-metrics" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="compare-metric-box"><label>Recent Log Value</label><strong>{anomalyReport.currentWasteTonnes} t/day</strong></div>
        <div className="compare-metric-box"><label>Historical Mean</label><strong>{anomalyReport.meanWasteTonnes} t/day</strong></div>
        <div className="compare-metric-box"><label>Z-Score</label><strong>{anomalyReport.zScore}</strong></div>
        <div className="compare-metric-box"><label>Severity Status</label><span className={`algorithm-badge ${anomalyReport.severity === "Critical" ? "critical" : ""}`}>{anomalyReport.severity}</span></div>
      </div>
      <div style={{ marginTop: 12, padding: 12, background: "#fbe9e5", borderRadius: 8, border: "1px solid #f2c7c0", color: "#8a2424", fontSize: 13 }}>
        <AlertTriangle size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />
        {anomalyReport.reason}
      </div>
    </div>}

    {tab === "mcda" && <div className="panel">
      <PanelTitle title="Multi-Criteria Decision Analysis (MCDA) Ward Risk Scorecard" meta="Evaluates Waste Pressure, Segregation Deficit, Collection Deficit & Flood Risk" />
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Ward Name</th><th>Waste Pressure</th><th>Segregation Deficit</th><th>Collection Deficit</th><th>Flood Risk</th><th>Risk Score (0-100)</th><th>Category</th></tr>
          </thead>
          <tbody>
            {mcdaScores.map((score, idx) => <tr key={idx}>
              <td><strong>{score.wardName}</strong></td>
              <td>{score.wastePressureComponent}</td>
              <td>{score.segregationDeficitComponent}</td>
              <td>{score.collectionDeficitComponent}</td>
              <td>{score.floodRiskComponent}</td>
              <td><strong style={{ fontSize: 16 }}>{score.riskScore}</strong></td>
              <td><span className={`algorithm-badge ${score.category === "Critical" ? "critical" : score.category === "High" ? "warning" : ""}`}>{score.category}</span></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>}
  </div>;
}

/** 20-Year Past and Future Forecast Component */
function Forecast({ forecastData, loading, record }) {
  const [filterPeriod, setFilterPeriod] = useState("all");
  const filtered = useMemo(() => {
    if (filterPeriod === "past") return forecastData.filter(d => d.year < 2026);
    if (filterPeriod === "future") return forecastData.filter(d => d.year >= 2026);
    return forecastData;
  }, [forecastData, filterPeriod]);

  return <div><PageHeader eyebrow="41-YEAR CONTINUUM" title="Past 20-Year & Future 20-Year Waste Forecast" description={record.name ? `Server simulation for ${record.name}. Historical reconstruction and future projection use saved ward parameters.` : "Select a ward to run the server simulation."} />
    <div className="forecast-controls">
      <span>Timeline Filter:</span>
      <button className={filterPeriod === "all" ? "chip active" : "chip"} onClick={() => setFilterPeriod("all")}>Full 41 Years (2006–2046)</button>
      <button className={filterPeriod === "past" ? "chip active" : "chip"} onClick={() => setFilterPeriod("past")}>Past 20 Years (2006–2025)</button>
      <button className={filterPeriod === "future" ? "chip active" : "chip"} onClick={() => setFilterPeriod("future")}>Future 20 Years (2026–2046)</button>
    </div>

    {loading && <div className="panel"><p className="muted">Running simulation from saved ward parameters...</p></div>}
    {!loading && !forecastData.length && <div className="panel"><p className="muted">No simulation data is available. Select a ward with demography parameters.</p></div>}
    {!!forecastData.length && <div className="panel">
      <PanelTitle title="Population & Waste Generation Trend Line" meta={`${filtered[0]?.year || 2006} – ${filtered[filtered.length - 1]?.year || 2046}`} />
      <ForecastChart rows={filtered} />
    </div>}

    {!!forecastData.length && <div className="panel">
      <PanelTitle title="Year-by-Year Past & Future Data Table" meta={`${filtered.length} total years`} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Year</th><th>Period Type</th><th>Population</th><th>Waste/day</th><th>Lower Bound</th><th>Upper Bound</th></tr>
          </thead>
          <tbody>
            {filtered.map(r => <tr key={r.year}>
              <td><strong>{r.year}</strong></td>
              <td><span className={`algorithm-badge ${r.period?.includes("Past") ? "warning" : ""}`}>{r.period || (r.year < 2026 ? "Past" : "Future")}</span></td>
              <td>{r.population.toLocaleString()}</td>
              <td><strong style={{ color: "var(--primary)" }}>{r.wasteTonnesPerDay} t</strong></td>
              <td>{r.lowerBound} t</td>
              <td>{r.upperBound} t</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>}
  </div>;
}

function ForecastChart({ rows }) {
  if (!rows || !rows.length) return null;
  const max = Math.max(...rows.map(r => r.wasteTonnesPerDay || r.waste || 1));
  const points = rows.map((r, i) => `${30 + i * (640 / Math.max(1, rows.length - 1))},${180 - ((r.wasteTonnesPerDay || r.waste) / max * 145)}`).join(" ");
  return <div className="forecast-chart"><svg viewBox="0 0 700 220" preserveAspectRatio="none"><line x1="30" y1="180" x2="670" y2="180" stroke="#dcd9cf" /><polyline points={points} fill="none" stroke="#2f5d50" strokeWidth="4" />{rows.filter((_, i) => i % Math.max(1, Math.floor(rows.length / 8)) === 0).map(r => { const i = rows.indexOf(r); return <g key={r.year}><circle cx={30 + i * (640 / Math.max(1, rows.length - 1))} cy={180 - ((r.wasteTonnesPerDay || r.waste) / max * 145)} r="5" fill="#2f5d50" /><text x={30 + i * (640 / Math.max(1, rows.length - 1))} y="207" textAnchor="middle" fontSize="11" fill="#64736d">{r.year}</text></g> })}</svg></div>;
}

function Uploads({ notify, onApplyRecord, session, habitation, canEdit }) {
  const [drag, setDrag] = useState(false);
  const [entries, setEntries] = useState([]);
  const [category, setCategory] = useState("demography");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    async function loadRecords() {
      const records = await apiRequest("/api/data-records", session).catch(() => []);
      setEntries(records);
    }
    loadRecords();
  }, [session]);

  async function downloadCsvTemplate() {
    try {
      const response = await fetch(`${API_BASE}/api/uploads/template/${category}`, {
        headers: { Authorization: `Bearer ${session.accessToken}` }
      });
      if (!response.ok) throw new Error("Template download failed.");
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `swms_${category}_template.csv`;
      link.click();
      URL.revokeObjectURL(blobUrl);
      notify(`Downloaded ${category} CSV template.`);
    } catch (error) { notify(error.message); }
  }

  async function uploadDataset() {
    if (!file || !habitation?.id) { notify("Select a ward and choose a CSV or XLSX file first."); return; }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("habitationId", habitation.id);
      body.append("category", category);
      body.append("file", file);
      const response = await fetch(`${API_BASE}/api/uploads`, { method: "POST", headers: { Authorization: `Bearer ${session.accessToken}` }, body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error?.message || "Upload failed.");
      setFile(null);
      notify(`Uploaded ${result.data.originalFilename}; validation is processing.`);
    } catch (error) { notify(error.message); }
    finally { setUploading(false); }
  }

  return <div><PageHeader eyebrow="DATA UPLOAD" title="Upload Ward & Municipal Data" description="Add parameter files or download standardized CSV template files for automatic header column matching."
    action={<button className="button secondary" onClick={downloadCsvTemplate}><Download size={16} /> Download {category} Template CSV</button>}
  />
    <div className="upload-grid"><div className={"upload-zone " + (drag ? "drag" : "")} onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}>
      <UploadCloud size={44} /><h3>Upload a dataset</h3><p>Choose a CSV or XLSX file from your device</p>
      <input type="file" accept=".csv,.xlsx" onChange={event => setFile(event.target.files?.[0] || null)} />
      <label className="field upload-field"><span>Parameter category</span><select value={category} onChange={e => setCategory(e.target.value)}>
        <option value="demography">Demography</option>
        <option value="infrastructure">Infrastructure</option>
        <option value="industrial">Industrial</option>
        <option value="natural_resource">Natural resources</option>
        <option value="terrain">Terrain</option>
        <option value="economic">Economic</option>
        <option value="cultural">Cultural</option>
      </select></label>
      <button className="button primary" disabled={!file || !habitation || uploading} onClick={uploadDataset}>{uploading ? "Uploading..." : "Upload and validate"}</button>
      <button className="button secondary" onClick={downloadCsvTemplate} style={{ marginTop: 8 }}><Download size={14} /> Download Sample Template CSV</button>
    </div>
      <div className="panel"><PanelTitle title="Manual data entry" meta={`${entries.length} saved entries`} />
        <div className="entry-list">{entries.map((entry, idx) => <div className="entry-item" key={idx}>
          <div><strong>{entry.habitation || entry.name}</strong><span>{entry.location || "Karnataka"}</span></div>
          <div className="entry-meta"><small>{(entry.population || 0).toLocaleString()} people · {entry.wasteTonnesPerDay || entry.waste || 0} t/day</small></div>
        </div>)}</div>
      </div>
    </div>
  </div>;
}

function Habitations({ navigate, notify, session, habitations, loadHabitations, setSelectedHabitationId, isPending, userMunicipality }) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [editingWard, setEditingWard] = useState(null);
  const [deletingWard, setDeletingWard] = useState(null);
  const [form, setForm] = useState({ name: "", type: "ward", municipality: userMunicipality === "All" ? "Udupi Municipality" : userMunicipality, latitude: "13.3409", longitude: "74.7421" });
  const visible = habitations.filter(item => item.name.toLowerCase().includes(search.toLowerCase()));

  async function createHabitation(event) {
    event.preventDefault();
    try {
      const created = await apiRequest("/api/habitations", session, { method: "POST", body: JSON.stringify({ ...form, latitude: Number(form.latitude), longitude: Number(form.longitude) }) });
      loadHabitations();
      setSelectedHabitationId(created.id);
      setShowForm(false);
      notify(`${created.name} created and saved in database.`);
    } catch (error) { notify(error.message); }
  }

  return <div><PageHeader eyebrow="HABITATIONS & WARDS" title="Monitored Wards & Habitations" description={`Wards recorded in PostgreSQL database under ${userMunicipality}.`} action={!isPending && <button className="button primary" onClick={() => setShowForm(v => !v)}>+ New Ward</button>} />
    {editingWard && <EditWardModal session={session} ward={editingWard} onClose={() => setEditingWard(null)} onSaved={() => { loadHabitations(); notify("Ward details updated in database."); }} />}
    {deletingWard && <DeleteWardModal session={session} ward={deletingWard} onClose={() => setDeletingWard(null)} onDeleted={() => { loadHabitations(); notify("Ward removed from database."); }} />}

    {showForm && <form className="panel manual-entry-form" onSubmit={createHabitation}>
      <div className="form-grid">
        <label className="field">
          <span>Ward Name</span>
          <div style={{ display: "flex", gap: 8 }}>
            <input required minLength="2" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ flex: 1 }} />
            <VoiceInputButton onSpeechResult={text => setForm({ ...form, name: text })} />
          </div>
        </label>
        <label className="field"><span>Type</span><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="ward">Ward</option><option value="town">Town</option><option value="village">Village</option></select></label>
        <label className="field"><span>Municipality</span><select value={form.municipality} onChange={e => setForm({ ...form, municipality: e.target.value })}>
          {userMunicipality === "All" && <>
            <option value="Udupi Municipality">Udupi Municipality</option>
            <option value="Mangaluru City Corporation">Mangaluru City Corporation</option>
            <option value="Kundapura Municipality">Kundapura Municipality</option>
          </>}
          {userMunicipality !== "All" && <option value={userMunicipality}>{userMunicipality}</option>}
        </select></label>
        <label className="field"><span>Latitude</span><input required type="number" step="any" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} /></label>
        <label className="field"><span>Longitude</span><input required type="number" step="any" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} /></label>
      </div>
      <div className="form-actions"><button type="button" className="button secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="button primary">Create Ward</button></div>
    </form>}

    <div className="searchbar">
      <Search size={18} />
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search wards by name or speak using mic..." />
      <VoiceInputButton onSpeechResult={text => setSearch(text)} />
    </div>

    <div className="habitation-grid">{visible.map(item => <div className="hab-card" key={item.id}>
      <div className="hab-image"><Map size={28} /></div>
      <div className="hab-info">
        <div>
          <h3>{item.name}</h3>
          <span>{item.municipality || "Udupi"} · {Number(item.latitude).toFixed(3)}, {Number(item.longitude).toFixed(3)}</span>
        </div>
        {!isPending && <div style={{ display: "flex", gap: 4 }}>
          <button className="icon-button" title="Edit Ward Details" onClick={() => setEditingWard(item)}><Pencil size={14} /></button>
          <button className="icon-button" title="Remove Ward" onClick={() => setDeletingWard(item)} style={{ color: "#c94b2b" }}><Trash2 size={14} /></button>
        </div>}
      </div>
      <div className="progress"><i style={{ width: "100%" }} /></div>
    </div>)}</div>
  </div>;
}

function Parameters({ selected, setSelected, notify, session, habitation, isPending, onChanged }) {
  const category = { Demography: "demography", "Community Infrastructure": "infrastructure", "Industrial Activities": "industrial", "Natural Resources": "natural_resource", Terrain: "terrain", "Economic Conditions": "economic", "Cultural Significance": "cultural" }[selected] || "demography";
  return <div><PageHeader eyebrow="PARAMETERS" title="Ward Parameters" description={habitation ? `Editing ${habitation.name}. Changes are written to the database.` : "Select a ward first."} />
    <div className="category-grid">{categories.map(([name, pct]) => <button key={name} onClick={() => setSelected(name)} className={selected === name ? "category-card selected" : "category-card"}><span>{name}</span><b>{pct}%</b></button>)}</div>
    {habitation ? <ParameterEditor key={`${habitation.id}-${category}`} category={category} session={session} habitation={habitation} notify={notify} isPending={isPending} onSaved={onChanged} /> : <div className="panel"><p className="muted">Choose a ward from the top bar to edit its parameters.</p></div>}
  </div>;
}

const parameterFields = {
  demography: [["population", "Population", "number"], ["populationDensityPerSqKm", "Population density / sq km", "number"], ["growthRatePct", "Annual growth rate (%)", "number"], ["floatingPopPct", "Floating population (%)", "number"], ["householdSize", "Household size", "number"], ["literacyPct", "Literacy (%)", "number"]],
  infrastructure: [["roadCoveragePct", "Road coverage (%)", "number"], ["roadsAlleysCount", "Roads and alleys", "number"], ["residentialZonePct", "Residential zones (%)", "number"], ["industrialZonePct", "Industrial zones (%)", "number"], ["schoolsCount", "Schools", "number"], ["clinicsCount", "Clinics", "number"], ["collectionVehicles", "Collection vehicles", "number"], ["collectionPointDensityPct", "Collection point density (%)", "number"], ["existingLandfillCapacityTonnes", "Landfill capacity (tonnes)", "number"]],
  industrial: [["hasOrganizedIndustry", "Organized industry", "boolean"], ["hasUnorganizedIndustry", "Unorganized industry", "boolean"], ["industrialActivityIntensity", "Activity intensity", "select", ["low", "medium", "high"]], ["industrialWasteTonnesPerDay", "Industrial waste (t/day)", "number"], ["hazardousSharePct", "Hazardous share (%)", "number"]],
  natural_resource: [["annualRainfallMm", "Annual rainfall (mm)", "number"], ["waterBodiesCount", "Water bodies", "number"], ["forestCoverPct", "Forest cover (%)", "number"], ["sensitiveAreaNearby", "Sensitive area nearby", "boolean"]],
  terrain: [["slope", "Slope", "select", ["flat", "moderate", "hilly"]], ["soilType", "Soil type", "select", ["permeable", "impermeable"]], ["windCondition", "Wind condition", "select", ["low", "moderate", "high"]], ["accessibility", "Accessibility", "select", ["good", "moderate", "poor"]], ["floodProne", "Flood prone", "boolean"]],
  economic: [["perCapitaIncomeAnnual", "Per-capita income / year", "number"], ["annualBudgetInr", "Annual budget (INR)", "number"], ["willingnessToPayPct", "Willingness to pay (%)", "number"], ["costConstraintLevel", "Cost constraint", "select", ["low", "medium", "high"]]],
  cultural: [["dietType", "Diet type", "select", ["veg", "nonveg", "mixed"]], ["segregationAdherencePct", "Segregation adherence (%)", "number"], ["festivalSpikePct", "Festival spike (%)", "number"], ["localPracticeNotes", "Local practice notes", "text"]]
};

function camelizeRow(row) {
  return Object.entries(row || {}).reduce((result, [key, value]) => ({ ...result, [key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())]: value }), {});
}

function ParameterEditor({ category, session, habitation, notify, isPending, onSaved }) {
  const [form, setForm] = useState({});
  const [version, setVersion] = useState();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const fields = parameterFields[category];

  useEffect(() => {
    setLoading(true);
    apiRequest(`/api/habitations/${habitation.id}/parameters/${category}`, session)
      .then(data => { setForm(camelizeRow(data)); setVersion(data.version); })
      .catch(() => setForm({}))
      .finally(() => setLoading(false));
  }, [category, habitation.id, session]);

  function setField(name, value, type) {
    setForm(current => ({ ...current, [name]: type === "number" && value !== "" ? Number(value) : value }));
  }

  async function save(event) {
    event.preventDefault(); setBusy(true);
    try {
      const saved = await apiRequest(`/api/habitations/${habitation.id}/parameters/${category}`, session, { method: "PUT", body: JSON.stringify({ ...form, expectedVersion: version }) });
      setVersion(saved.version); onSaved?.(); notify("Ward parameters saved to database.");
    } catch (error) { notify(error.message); }
    finally { setBusy(false); }
  }

  return <div className="panel parameter-editor"><PanelTitle title={`Edit ${category.replace("_", " ")} data`} meta={loading ? "Loading current values..." : "Database-backed form"} />
    {loading ? <p className="muted">Loading current values...</p> : <form onSubmit={save}><div className="form-grid">{fields.map(([name, label, type, options]) => <label className="field" key={name}><span>{label}</span>{type === "boolean" ? <input type="checkbox" checked={Boolean(form[name])} disabled={isPending} onChange={event => setField(name, event.target.checked, type)} /> : type === "select" ? <select value={form[name] || ""} disabled={isPending} onChange={event => setField(name, event.target.value, type)}><option value="">Select</option>{options.map(option => <option key={option} value={option}>{option}</option>)}</select> : <div style={{ display: "grid", gap: 6 }}><div style={{ display: "flex", gap: 8 }}><input type={type} step="any" value={form[name] ?? ""} disabled={isPending} onChange={event => setField(name, event.target.value, type)} style={{ flex: 1 }} />{type === "text" && <VoiceInputButton onSpeechResult={text => setField(name, text, type)} />}</div>{type === "number" && <input type="range" min={name.toLowerCase().includes("population") ? 1 : 0} max={name.toLowerCase().includes("population") ? 1000000 : 100} step="any" value={Number(form[name] || 0)} disabled={isPending} onChange={event => setField(name, event.target.value, type)} />}</div>}</label>)}</div><div className="form-actions"><button className="button primary" disabled={isPending || busy}>{busy ? "Saving..." : "Save Parameters"}</button></div></form>}
  </div>;
}

function Validation({ session, habitationId }) {
  const [batches, setBatches] = useState([]);
  useEffect(() => { apiRequest(`/api/uploads${habitationId ? `?habitationId=${habitationId}` : ""}`, session).then(setBatches).catch(() => setBatches([])); }, [session, habitationId]);
  const issues = batches.flatMap(batch => batch.issues || []);
  async function resolveIssue(batchId, issueId) {
    const resolution = prompt("Describe the correction made to this row/field:");
    if (!resolution) return;
    try { await apiRequest(`/api/uploads/${batchId}/issues/${issueId}`, session, { method: "PATCH", body: JSON.stringify({ resolution }) }); const refreshed = await apiRequest(`/api/uploads${habitationId ? `?habitationId=${habitationId}` : ""}`, session); setBatches(refreshed); } catch (error) { alert(error.message); }
  }
  return <div><PageHeader eyebrow="VALIDATION" title="Data Validation Engine" description="Review every invalid row, field, and correction message from uploaded datasets." />
    <div className="kpi-grid three"><KPI label="Batches" value={batches.length} icon={Database} /><KPI label="Valid Rows" value={batches.reduce((total, batch) => total + Number(batch.valid_row_count || 0), 0)} icon={CheckCircle2} /><KPI label="Issues Found" value={issues.length} icon={AlertTriangle} tone="amber" /></div>
    <div className="panel"><PanelTitle title="Validation issue details" meta={`${issues.length} issue${issues.length === 1 ? "" : "s"}`} />{issues.length ? <div className="table-wrap"><table><thead><tr><th>Batch</th><th>Row</th><th>Field</th><th>Issue type</th><th>Correction message</th><th>Status</th><th>Action</th></tr></thead><tbody>{batches.flatMap(batch => (batch.issues || []).map((issue, index) => <tr key={`${batch.id}-${index}`}><td>{batch.original_filename}</td><td>{issue.row}</td><td>{issue.field || "-"}</td><td>{issue.issueType}</td><td>{issue.message}</td><td>{issue.resolvedAt ? `Corrected: ${issue.resolution}` : "Open"}</td><td>{!issue.resolvedAt && <button className="text-button" onClick={() => resolveIssue(batch.id, issue.id)}>Record correction</button>}</td></tr>))}</tbody></table></div> : <p className="muted">No validation issues are recorded for the selected ward.</p>}</div>
  </div>;
}

function WasteDashboard({ simulation, loading, record, overrides, setOverrides }) {
  const current = simulation?.years?.[0];
  const updateOverride = (name, value) => setOverrides(currentOverrides => ({ ...currentOverrides, [name]: value }));
  return <div><PageHeader eyebrow="WASTE SIMULATION" title="Waste Management Overview" description={record.name ? `Server simulation for ${record.name}.` : "Select a ward to run the simulation."} />
    <div className="panel"><PanelTitle title="Interactive simulation controls" meta="Overrides are sent to the server simulation" /><div className="form-grid">
      {[['population', 'Population', 1, 1000000, 1], ['perCapitaKg', 'Per-capita waste (kg/day)', 0.05, 5, 0.001], ['collectionVehicles', 'Collection vehicles', 0, 100, 1]].map(([name, label, min, max, step]) => <label className="field" key={name}><span>{label}</span><div style={{ display: "flex", gap: 8 }}><input type="number" min={min} max={max} step={step} placeholder="Stored value" value={overrides[name]} onChange={event => updateOverride(name, event.target.value)} /><input type="range" min={min} max={max} step={step} value={overrides[name] || min} onChange={event => updateOverride(name, event.target.value)} /></div></label>)}
    </div><p className="muted">Leave a field blank to use the ward's stored value or the engine benchmark.</p></div>
    {loading && <div className="panel"><p className="muted">Running simulation...</p></div>}
    {!loading && current && <div className="kpi-grid four"><KPI label="Waste Generated" value={`${current.totalWasteTonnesPerDay.toFixed(2)} t/day`} icon={Leaf} /><KPI label="Waste Collected" value={`${current.collectedTonnesPerDay.toFixed(2)} t/day`} icon={CheckCircle2} /><KPI label="Waste Treated" value={`${current.treatedTonnesPerDay.toFixed(2)} t/day`} icon={Activity} /><KPI label="Vehicles Required" value={current.vehiclesRequired} sub={`${current.collectionCoveragePct}% collection coverage`} icon={Database} /></div>}
    {!loading && !current && <div className="panel"><p className="muted">No simulation result is available for the selected ward.</p></div>}
  </div>;
}

function Scenarios({ scenario, setScenario, simulation, loading, onRun }) {
  const options = [{ value: "Normal", label: "Normal" }, { value: "Flood", label: "Flood" }, { value: "Heavy_Monsoon", label: "Heavy monsoon" }, { value: "Road_Blockage", label: "Road blockage" }];
  return <div><PageHeader eyebrow="SCENARIOS" title="Future Stress Testing" description="Run the server simulation against flood, monsoon, and road blockage conditions." />
    <div className="panel"><PanelTitle title="Select Scenario Condition" meta={loading ? "Simulation running..." : simulation ? `${simulation.summary.peakDailyWasteTonnes} t/day peak waste` : "Select a ward first"} action={<button className="button primary" disabled={loading} onClick={onRun}><RefreshCw size={15} /> {loading ? "Running..." : "Run simulation"}</button>} /><div className="tab-buttons">{options.map(option => <button key={option.value} className={`tab-button ${scenario === option.value ? "active" : ""}`} onClick={() => { setScenario(option.value); onRun(); }}>{option.label}</button>)}</div>{simulation && <div className="compare-metrics" style={{ marginTop: 16 }}><div className="compare-metric-box"><label>20-year waste</label><strong>{simulation.summary.total20YearWasteTonnes.toLocaleString()} t</strong></div><div className="compare-metric-box"><label>Landfill depletion</label><strong>{simulation.summary.landfillDepletionYear || "Not projected"}</strong></div></div>}</div>
  </div>;
}

function Sensitivity({ session, habitationId, loading }) {
  const [data, setData] = useState(null);
  useEffect(() => { if (habitationId) apiRequest(`/api/habitations/${habitationId}/simulation/sensitivity`, session).then(setData).catch(() => setData(null)); }, [habitationId, session]);
  return <div><PageHeader eyebrow="SENSITIVITY" title="Parameter Sensitivity Analysis" description="Server-side impact of population, growth, and waste variation." />{(loading || !data) && <div className="panel"><p className="muted">{loading ? "Running sensitivity analysis..." : "Select a ward with stored parameters."}</p></div>}{data && <div className="panel"><PanelTitle title="Sensitivity results" meta="Compared with the stored ward baseline" /><div className="table-wrap"><table><thead><tr><th>Variation</th><th>Peak daily waste</th><th>Total 20-year waste</th><th>Landfill depletion</th></tr></thead><tbody>{data.results.map((result, index) => <tr key={index}><td>{["Population -10%", "Population +10%", "Growth -20%", "Growth +20%", "Waste -10%", "Waste +10%"][index]}</td><td>{result.peakDailyWasteTonnes} t/day</td><td>{result.total20YearWasteTonnes.toLocaleString()} t</td><td>{result.landfillDepletionYear || "Not projected"}</td></tr>)}</tbody></table></div></div>}</div>;
}

function Budget({ session, habitationId, loading }) {
  const [data, setData] = useState(null);
  useEffect(() => { if (habitationId) apiRequest(`/api/habitations/${habitationId}/simulation/budget`, session).then(setData).catch(() => setData(null)); }, [habitationId, session]);
  return <div><PageHeader eyebrow="BUDGET" title="Capital & Operational Budgeting" description="Server-derived fleet and operating estimates for the selected ward." />{(loading || !data) && <div className="panel"><p className="muted">{loading ? "Calculating budget from simulation..." : "Select a ward with stored parameters."}</p></div>}{data && <div className="kpi-grid four"><KPI label="Vehicles Required" value={data.vehiclesRequired} icon={Database} /><KPI label="Fleet CAPEX" value={`INR ${data.fleetCapexInr.toLocaleString()}`} icon={Building2} /><KPI label="Collection OPEX / year" value={`INR ${data.annualCollectionOpexInr.toLocaleString()}`} icon={Activity} /><KPI label="Total OPEX / year" value={`INR ${data.annualTotalOpexInr.toLocaleString()}`} icon={Gauge} /></div>}</div>;
}

function Reports({ notify, simulation, record }) {
  function downloadReport() {
    if (!simulation?.years?.length) { notify("Select a ward with simulation data first."); return; }
    const rows = [
      ["Ward", record.name || ""],
      ["Scenario", simulation.scenario || "normal"],
      ["", ""],
      ["Year", "Population", "Waste tonnes/day", "Collected tonnes/day", "Treated tonnes/day", "Disposal tonnes/day", "Collection coverage %", "Vehicles required"],
      ...simulation.years.map(row => [row.year, row.population, row.totalWasteTonnesPerDay, row.collectedTonnesPerDay, row.treatedTonnesPerDay, row.disposalTonnesPerDay, row.collectionCoveragePct, row.vehiclesRequired])
    ];
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `${(record.name || "swms").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-simulation-report.csv`;
    link.click();
    notify("Simulation report downloaded.");
  }
  return <div><PageHeader eyebrow="REPORTS" title="Planning Documents & Export" description="Export the selected ward's server simulation as a real report." action={<button className="button primary" onClick={downloadReport}><Download size={16} /> Download Report CSV</button>} />{!simulation && <div className="panel"><p className="muted">Select a ward to generate a report from current server results.</p></div>}</div>;
}

function Assistant({ session, habitationId, query, setQuery, forecastData }) {
  const [messages, setMessages] = useState([{ from: "bot", text: "Hello! I am your SWMS voice-enabled assistant. You can ask me questions using text or click the microphone button to speak." }]);
  const suggestedQuestions = ["What was waste in 2006?", "What is projected waste in 2046?", "Which year has the peak waste?", "How many vehicles are required now?"];

  const ask = async (qText) => {
    const text = qText || query;
    if (!text.trim()) return;
    const q = text.trim();
    let ans = "I can answer forecast questions after a ward simulation has returned data.";
    const lower = q.toLowerCase();
    const past = forecastData.find(row => row.year === 2006);
    const future = forecastData.find(row => row.year === 2046) || forecastData[forecastData.length - 1];
    if (lower.includes("past") || lower.includes("history") || lower.includes("2006")) {
      ans = past ? `In ${past.year}, the server forecast estimates ${past.wasteTonnesPerDay} tonnes/day for a population of ${past.population.toLocaleString()}.` : "The server forecast does not include a 2006 result for the selected ward.";
    } else if (lower.includes("future") || lower.includes("2046") || lower.includes("20 years")) {
      ans = future ? `By ${future.year}, the server forecast projects ${future.wasteTonnesPerDay} tonnes/day for a population of ${future.population.toLocaleString()}.` : "The server forecast is not available for the selected ward.";
    }
    if (habitationId) {
      try { const result = await apiRequest(`/api/habitations/${habitationId}/simulation/ask`, session, { method: "POST", body: JSON.stringify({ question: q }) }); ans = result.answer; } catch (error) { ans = error.message; }
    }
    setMessages(m => [...m, { from: "user", text: q }, { from: "bot", text: ans }]);
    setQuery("");
  };

  return <div><PageHeader eyebrow="AI ASSISTANT" title="Ask SWMS (Voice & Text)" description="Ask questions about past 20-year trends, 20-year future forecasts, or ward details using voice input." />
    <div className="assistant-layout">
      <div className="panel chat">
        <div className="chat-head"><Bot size={20} /><div><b>SWMS Assistant</b><span>Voice enabled</span></div></div>
        <div className="messages">{messages.map((m, i) => <div className={m.from === "bot" ? "msg bot" : "msg user"} key={i}>{m.text}</div>)}</div>
        <div className="suggested-questions">{suggestedQuestions.map(question => <button key={question} className="chip" onClick={() => ask(question)}>{question}</button>)}</div>
        <div className="chat-input" style={{ display: "flex", gap: 8 }}>
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && ask()} placeholder="Ask: What was waste in 2006? Or click mic to speak..." style={{ flex: 1 }} />
          <VoiceInputButton onSpeechResult={text => { setQuery(text); ask(text); }} />
          <button className="button primary" onClick={() => ask()}>Ask</button>
        </div>
      </div>
    </div>
  </div>;
}

createRoot(document.getElementById("root")).render(<App />);
