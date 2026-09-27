
import React, { useMemo, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity, AlertTriangle, BarChart3, Bell, Bot, Building2, CalendarDays,
  CheckCircle2, ChevronDown, CircleHelp, Database, Download, FileCheck2,
  FileText, Gauge, Globe2, Home, Layers3, Leaf, LineChart, Map,
  Menu, MoreHorizontal, Pencil, RefreshCw, Search, Settings, ShieldCheck,
  SlidersHorizontal, UploadCloud, Users, Waves, X, Zap
} from "lucide-react";
import "./styles.css";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "habitations", label: "Habitations", icon: Building2 },
  { id: "parameters", label: "Parameters", icon: SlidersHorizontal },
  { id: "gis", label: "GIS Map", icon: Map },
  { id: "uploads", label: "Data Upload", icon: UploadCloud },
  { id: "validation", label: "Validation", icon: FileCheck2 },
  { id: "waste", label: "Waste Simulation", icon: Activity },
  { id: "forecast", label: "20-Year Forecast", icon: LineChart },
  { id: "scenarios", label: "Scenarios", icon: AlertTriangle },
  { id: "sensitivity", label: "Sensitivity", icon: SlidersHorizontal },
  { id: "budget", label: "Budget & Optimization", icon: BarChart3 },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "assistant", label: "Ask SWMS", icon: Bot },
  { id: "approvals", label: "Approvals", icon: ShieldCheck },
];

const habitationData = {
  name: "Demo Village",
  location: "Karnataka, India",
  population: 12480,
  growth: 1.2,
  density: 670,
  floating: 8,
  area: 18.6,
  waste: 8.4,
  collection: 82,
  treatment: 61,
  disposal: 8,
};

const categories = [
  ["Demography", 92, ["Population", "Population Density", "Annual Growth Rate", "Floating Population"]],
  ["Community Infrastructure", 90, ["Road Coverage", "Residential Zones", "Industrial Zones", "Schools", "Collection Vehicles"]],
  ["Industrial Activities", 85, ["Organized Industry", "Unorganized Industry", "Industrial Waste", "Hazardous Share"]],
  ["Natural Resources", 92, ["Annual Rainfall", "Water Bodies", "Forest Cover", "Sensitive Areas"]],
  ["Terrain", 88, ["Slope", "Soil Type", "Wind Condition", "Flood Prone"]],
  ["Economic Conditions", 80, ["Per-Capita Income", "Annual Budget", "Willingness to Pay", "Cost Constraint"]],
  ["Cultural Significance", 78, ["Diet Type", "Segregation Adherence", "Festival Spike", "Local Practices"]],
];

const demoUploads = [
  ["habitation_data.csv", "Validated", "Today"],
  ["gis_layers.zip", "Validating", "Today"],
  ["industry_data.xlsx", "Validated", "Yesterday"],
  ["terrain_data.shp", "Failed", "Apr 05"],
];

const STORAGE_KEY = "swms-manual-data";
const SESSION_KEY = "swms-session";
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

const defaultEntry = {
  habitation: "Demo Village",
  location: "Karnataka, India",
  population: 12480,
  growthRate: 1.2,
  rainfallMm: 1850,
  wasteTonnesPerDay: 8.4,
  collectionEfficiency: 82,
  treatmentEfficiency: 61,
};

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

function getSavedEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [defaultEntry];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : [defaultEntry];
  } catch {
    return [defaultEntry];
  }
}

async function fetchDataRecords(session) {
  try {
    const response = await fetch(`${API_BASE}/api/data-records`, { headers: { Authorization: `Bearer ${session.accessToken}` } });
    if (!response.ok) return [];
    const payload = await response.json();
    const records = Array.isArray(payload?.data) ? payload.data : [];
    return records.length ? records : [defaultEntry];
  } catch {
    return getSavedEntries();
  }
}

async function saveDataRecord(payload, session) {
  const response = await fetch(`${API_BASE}/api/data-records`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken}` },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result?.error?.message || "Unable to save this data record.");
  }
  return result.data;
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

function forecastRows(record = habitationData) {
  const rows = [];
  const baseYear = 2026;
  const perCapita = 0.673; // demo assumption; clearly labelled in UI
  const safeRecord = {
    ...habitationData,
    ...record,
    population: Number(record.population || habitationData.population),
    growth: Number(record.growth || habitationData.growth),
    collection: Number(record.collection || habitationData.collection),
    treatment: Number(record.treatment || habitationData.treatment),
  };

  for (let i = 0; i <= 20; i++) {
    const population = Math.round(safeRecord.population * Math.pow(1 + safeRecord.growth / 100, i));
    const waste = population * perCapita / 1000;
    const collection = waste * (safeRecord.collection / 100);
    const treatment = collection * 0.61;
    const disposal = Math.max(collection - treatment, 0);
    rows.push({
      year: baseYear + i,
      population,
      waste: +waste.toFixed(2),
      collection: +collection.toFixed(2),
      treatment: +treatment.toFixed(2),
      disposal: +disposal.toFixed(2),
    });
  }
  return rows;
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
  return <AuthenticatedApp session={session} onSignOut={() => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  }} />;
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login" ? { email: form.email, password: form.password } : form;
      const response = await fetch(`${API_BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error?.message || "Request failed.");
      if (mode === "login") onAuthenticated(result.data);
      else { setMode("login"); setMessage("Account created. Sign in now for basic read-only access; an administrator must activate your account before you can create or edit data."); }
    } catch (requestError) {
      setError(requestError instanceof TypeError && requestError.message === "Failed to fetch"
        ? `Cannot reach the SWMS API at ${API_BASE}. Start it with: npm run dev:api`
        : requestError.message);
    }
    finally { setBusy(false); }
  }

  return <div className="auth-shell"><form className="auth-card" onSubmit={submit}>
    <div className="brand"><div className="brand-mark"><Leaf size={22} /></div><div><strong>SWMS</strong><span>Secure planning workspace</span></div></div>
    <div className="eyebrow">{mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}</div>
    <h1>{mode === "login" ? "Sign in to SWMS" : "Request an account"}</h1>
    <p>{mode === "login" ? "Use your approved stakeholder account to access planning data." : "New accounts start as inactive researchers until an administrator approves them."}</p>
    {mode === "register" && <label>Full name<input required minLength="2" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>}
    <label>Email<input required type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label>
    <label>Password<input required minLength="8" type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /></label>
    {error && <div className="form-error">{error}</div>}{message && <div className="form-message">{message}</div>}
    <button className="button primary full-width" disabled={busy}>{busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create researcher account"}</button>
    <button type="button" className="text-button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setMessage(""); }}>{mode === "login" ? "Need an account? Register" : "Already registered? Sign in"}</button>
  </form></div>;
}

function AuthenticatedApp({ session, onSignOut }) {
  const [page, setPage] = useState("dashboard");
  const role = session.user.role;
  const isPending = session.user.isActive === false;
  const isReadOnly = isPending || role === "researcher";
  const [habitation, setHabitation] = useState("Demo Village");
  const [sidebar, setSidebar] = useState(true);
  const [toast, setToast] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Demography");
  const [layers, setLayers] = useState({ roads: true, water: true, settlements: true, terrain: true });
  const [scenario, setScenario] = useState("Normal");
  const [populationChange, setPopulationChange] = useState(0);
  const [rainfall, setRainfall] = useState(0);
  const [query, setQuery] = useState("");
  const [activeRecord, setActiveRecord] = useState(() => readActiveRecord());
  const [habitations, setHabitations] = useState([]);
  const [selectedHabitationId, setSelectedHabitationId] = useState("");

  useEffect(() => {
    apiRequest("/api/habitations", session)
      .then((items) => {
        setHabitations(items);
        setSelectedHabitationId((current) => current || items[0]?.id || "");
      })
      .catch(() => notify("Unable to load habitations from the server."));
  }, [session]);

  const selectedHabitation = habitations.find((item) => item.id === selectedHabitationId);

  const currentHabitation = useMemo(() => ({
    ...habitationData,
    ...(activeRecord || {})
  }), [activeRecord]);

  const rows = useMemo(() => forecastRows(currentHabitation), [currentHabitation]);
  const last = rows[20];

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  };

  const navigate = (id) => {
    setPage(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="app-shell">
      {sidebar && <Sidebar page={page} navigate={navigate} role={role} isPending={isPending} />}
      <div className={sidebar ? "main-shell" : "main-shell full"}>
        <Topbar
          habitation={habitation}
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
          {isPending && <div className="pending-banner"><ShieldCheck size={18} /><span><strong>Account pending approval.</strong> You have basic read-only access. An administrator must activate your account before you can create or edit data.</span></div>}
          {page === "dashboard" && <Dashboard navigate={navigate} record={currentHabitation} isPending={isReadOnly} user={session.user} />}
          {page === "habitations" && <Habitations navigate={navigate} notify={notify} session={session} habitations={habitations} setHabitations={setHabitations} setSelectedHabitationId={setSelectedHabitationId} isPending={isReadOnly} />}
          {page === "parameters" && <Parameters selected={selectedCategory} setSelected={setSelectedCategory} notify={notify} session={session} habitation={selectedHabitation} isPending={isReadOnly} />}
          {page === "gis" && <GIS layers={layers} setLayers={setLayers} notify={notify} session={session} habitation={selectedHabitation} canEdit={!isReadOnly} />}
          {page === "uploads" && <Uploads notify={notify} onApplyRecord={setActiveRecord} session={session} habitation={selectedHabitation} canEdit={!isReadOnly} />}
          {page === "validation" && <Validation />}
          {page === "waste" && <WasteDashboard rows={rows} record={currentHabitation} />}
          {page === "forecast" && <Forecast rows={rows} notify={notify} record={currentHabitation} />}
          {page === "scenarios" && <Scenarios scenario={scenario} setScenario={setScenario} populationChange={populationChange} setPopulationChange={setPopulationChange} rainfall={rainfall} setRainfall={setRainfall} notify={notify} />}
          {page === "sensitivity" && <Sensitivity notify={notify} />}
          {page === "budget" && <Budget />}
          {page === "reports" && <Reports notify={notify} />}
          {page === "assistant" && <Assistant query={query} setQuery={setQuery} rows={rows} />}
          {page === "approvals" && role === "admin" && <Approvals session={session} notify={notify} />}
        </main>
      </div>
      {toast && <div className="toast"><CheckCircle2 size={17} />{toast}</div>}
    </div>
  );
}

function Sidebar({ page, navigate, role, isPending }) {
  const readOnlyPages = new Set(["dashboard", "habitations", "parameters", "gis", "forecast", "reports"]);
  const visibleNav = NAV.filter(item => {
    if (item.id === "approvals") return role === "admin";
    if (isPending || role === "researcher") return readOnlyPages.has(item.id);
    return true;
  });
  return <aside className="sidebar">
    <div className="brand">
      <div className="brand-mark"><Leaf size={22} /></div>
      <div><strong>SWMS</strong><span>Smart Waste Management Simulator</span></div>
    </div>
    <div className="role-mini"><ShieldCheck size={14} /><span>{role}</span></div>
    <nav>
      {visibleNav.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? "nav-item active" : "nav-item"} onClick={() => navigate(id)}>
        <Icon size={18} /><span>{label}</span>
      </button>)}
    </nav>
    <div className="sidebar-bottom">
      <button className="nav-item"><Settings size={18} /><span>Settings</span></button>
      <div className="help-box"><CircleHelp size={18} /><div><b>Need help?</b><span>Use simple labels and visual status.</span></div></div>
    </div>
  </aside>
}

function Topbar({ habitations, selectedHabitationId, setSelectedHabitationId, role, user, onMenu, notify, onSignOut }) {
  return <header className="topbar">
    <button className="icon-button mobile-menu" onClick={onMenu}><Menu size={20} /></button>
    <div className="select-wrap"><Map size={15} /><select value={selectedHabitationId} onChange={e => setSelectedHabitationId(e.target.value)}><option value="">Select habitation</option>{habitations.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
    <div className="top-actions">
      <div className="select-wrap role-select"><ShieldCheck size={14} /><span>{role}</span></div>
      <button className="icon-button" onClick={() => notify("No new notifications")}><Bell size={18} /></button>
      <div className="avatar" title={user.name}>{user.name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase()}</div>
      <button className="text-button" onClick={onSignOut}>Sign out</button>
    </div>
  </header>
}

function PageHeader({ eyebrow, title, description, action }) {
  return <div className="page-header">
    <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>
    {action}
  </div>
}

function KPI({ label, value, sub, icon: Icon, tone = "green" }) {
  return <div className="kpi">
    <div className={"kpi-icon " + tone}><Icon size={19} /></div>
    <div><span>{label}</span><strong>{value}</strong>{sub && <small>{sub}</small>}</div>
  </div>
}

function Dashboard({ navigate, record, isPending, user }) {
  const populationLabel = formatNumber(record.population);
  const wasteLabel = `${Number(record.waste || 0).toFixed(1)} t/day`;
  return <div>
    <PageHeader eyebrow="OVERVIEW" title={`Good morning, ${user.name.split(/\s+/)[0]}`} description="A clear view of habitation data, map status and waste-management readiness." action={<button className="button primary" onClick={() => navigate("forecast")}><Zap size={16} /> Run 20-Year Forecast</button>} />
    <div className="kpi-grid">
      <KPI label="Data Readiness" value="92%" sub="6 of 7 categories ready" icon={Gauge} />
      <KPI label="Validation Confidence" value="88%" sub="1,240 rows checked" icon={ShieldCheck} />
      <KPI label="Population" value={populationLabel} sub={`+${Number(record.growth || 0).toFixed(1)}% annual growth`} icon={Users} />
      <KPI label="Waste Generated" value={wasteLabel} sub="Current active record" icon={Leaf} />
    </div>
    <div className="dashboard-grid">
      <div className="panel map-panel">
        <PanelTitle title="Habitation map" meta="4 layers active" action={<button className="text-button" onClick={() => navigate("gis")}>Open GIS <ChevronDown size={14} /></button>} />
        <MiniMap layers={{ roads: true, water: true, settlements: true, terrain: true }} />
      </div>
      <div className="panel">
        <PanelTitle title="Data readiness by category" meta="Last checked today" />
        <div className="readiness-list">
          {categories.map(([name, pct]) => <div className="readiness-row" key={name}><div><span>{name}</span><b>{pct}%</b></div><div className="progress"><i style={{ width: pct + "%" }} /></div></div>)}
        </div>
      </div>
    </div>
    <div className="three-grid">
      <div className="panel chart-panel">
        <PanelTitle title="Waste generation trend" meta="Monthly" />
        <SimpleChart />
      </div>
      <div className="panel">
        <PanelTitle title="20-year outlook" meta="2026–2046" />
        <div className="outlook"><div className="outlook-number">{(8.4 * Math.pow(1.012, 20)).toFixed(1)} <span>t/day</span></div><span className="muted">Projected daily waste at the demo growth assumption.</span><button className="button secondary full-width" onClick={() => navigate("forecast")}>View forecast</button></div>
      </div>
      <div className="panel">
        <PanelTitle title="Quick actions" />
        <div className="quick-actions">
          {!isPending && <button onClick={() => navigate("uploads")}><UploadCloud />Upload data</button>}
          {!isPending && <button onClick={() => navigate("uploads")}><Pencil />Insert data</button>}
          <button onClick={() => navigate("validation")}><FileCheck2 />Check validation</button>
          <button onClick={() => navigate("scenarios")}><AlertTriangle />Test scenario</button>
        </div>
      </div>
    </div>
  </div>
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
  </div>
}

function SimpleChart() {
  return <div className="simple-chart">
    <svg viewBox="0 0 700 210" preserveAspectRatio="none">
      <line x1="35" y1="180" x2="680" y2="180" stroke="#dcd9cf" /><line x1="35" y1="30" x2="35" y2="180" stroke="#dcd9cf" />
      <path d="M35 155 C100 145 120 148 180 132 S270 135 330 112 S420 105 480 92 S580 82 680 58" fill="none" stroke="#2f5d50" strokeWidth="4" />
      <path d="M35 164 C100 158 120 160 180 151 S270 148 330 137 S420 133 480 121 S580 118 680 101" fill="none" stroke="#3e6e8e" strokeWidth="3" />
    </svg>
    <div className="chart-legend"><span><i className="line green" />Generated</span><span><i className="line blue" />Collected</span></div>
  </div>
}

function Habitations({ navigate, notify, session, habitations, setHabitations, setSelectedHabitationId, isPending }) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", type: "village", latitude: "", longitude: "" });
  const visible = habitations.filter(item => item.name.toLowerCase().includes(search.toLowerCase()));

  async function createHabitation(event) {
    event.preventDefault();
    try {
      const created = await apiRequest("/api/habitations", session, { method: "POST", body: JSON.stringify({ ...form, latitude: Number(form.latitude), longitude: Number(form.longitude) }) });
      setHabitations(current => [created, ...current]);
      setSelectedHabitationId(created.id);
      setShowForm(false);
      setForm({ name: "", type: "village", latitude: "", longitude: "" });
      notify(`${created.name} created.`);
    } catch (error) { notify(error.message); }
  }

  return <div><PageHeader eyebrow="HABITATIONS" title="Select a habitation" description="Choose the village, ward, town or city you want to plan for." action={!isPending && <button className="button primary" onClick={() => setShowForm(value => !value)}>+ New habitation</button>} />
    {showForm && <form className="panel manual-entry-form" onSubmit={createHabitation}><div className="form-grid"><label className="field"><span>Name</span><input required minLength="2" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label><label className="field"><span>Type</span><select value={form.type} onChange={event => setForm({ ...form, type: event.target.value })}><option value="village">Village</option><option value="ward">Ward</option><option value="town">Town</option><option value="city">City</option></select></label><label className="field"><span>Latitude</span><input required type="number" step="any" min="-90" max="90" value={form.latitude} onChange={event => setForm({ ...form, latitude: event.target.value })} /></label><label className="field"><span>Longitude</span><input required type="number" step="any" min="-180" max="180" value={form.longitude} onChange={event => setForm({ ...form, longitude: event.target.value })} /></label></div><div className="form-actions"><button type="button" className="button secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="button primary">Create habitation</button></div></form>}
    <div className="searchbar"><Search size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search habitations" /></div>
    <div className="habitation-grid">{visible.map(item => <button className="hab-card" key={item.id} onClick={() => { setSelectedHabitationId(item.id); navigate("dashboard"); }}>
      <div className="hab-image"><Map size={28} /></div><div className="hab-info"><div><h3>{item.name}</h3><span>{item.type} · {Number(item.latitude).toFixed(3)}, {Number(item.longitude).toFixed(3)}</span></div><b>Live</b></div><div className="progress"><i style={{ width: "100%" }} /></div><small>Server record</small>
    </button>)}</div>
    <div className="panel notice"><ShieldCheck size={20} /><div><b>Why readiness matters</b><span>Only validated and available data should feed the simulation. Missing inputs are shown before a forecast is run.</span></div></div>
  </div>
}

function Parameters({ selected, setSelected, notify, session, habitation, isPending }) {
  const categoryKeys = { Demography: "demography", "Community Infrastructure": "infrastructure", "Industrial Activities": "industrial", "Natural Resources": "natural_resource", Terrain: "terrain", "Economic Conditions": "economic", "Cultural Significance": "cultural" };
  const fieldMap = {
    demography: [["population", "Population", "number"], ["populationDensityPerSqKm", "Population density", "number"], ["growthRatePct", "Annual growth rate (%)", "number"], ["floatingPopPct", "Floating population (%)", "number"], ["householdSize", "Household size", "number"], ["literacyPct", "Literacy (%)", "number"]],
    infrastructure: [["roadCoveragePct", "Road coverage (%)", "number"], ["roadsAlleysCount", "Roads and alleys", "number"], ["residentialZonePct", "Residential zones (%)", "number"], ["industrialZonePct", "Industrial zones (%)", "number"], ["schoolsCount", "Schools", "number"], ["clinicsCount", "Clinics", "number"], ["collectionVehicles", "Collection vehicles", "number"]],
    industrial: [["industrialWasteTonnesPerDay", "Industrial waste (t/day)", "number"], ["hazardousSharePct", "Hazardous share (%)", "number"]],
    natural_resource: [["annualRainfallMm", "Annual rainfall (mm)", "number"], ["waterBodiesCount", "Water bodies", "number"], ["forestCoverPct", "Forest cover (%)", "number"]],
    terrain: [["slope", "Slope", "text"], ["soilType", "Soil type", "text"], ["windCondition", "Wind condition", "text"], ["accessibility", "Accessibility", "text"]],
    economic: [["perCapitaIncomeAnnual", "Per-capita income", "number"], ["annualBudgetInr", "Annual budget", "number"], ["willingnessToPayPct", "Willingness to pay (%)", "number"]],
    cultural: [["segregationAdherencePct", "Segregation adherence (%)", "number"], ["festivalSpikePct", "Festival spike (%)", "number"], ["localPracticeNotes", "Local practice notes", "text"]]
  };
  const category = categoryKeys[selected] || "demography";
  const fields = fieldMap[category];
  const [values, setValues] = useState({});
  const [version, setVersion] = useState(undefined);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!habitation?.id) return;
    setLoading(true);
    apiRequest(`/api/habitations/${habitation.id}/parameters/${category}`, session)
      .then(row => { const next = {}; fields.forEach(([key]) => { const snake = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`); next[key] = row[snake] ?? ""; }); setValues(next); setVersion(row.version); })
      .catch(() => { setValues({}); setVersion(undefined); })
      .finally(() => setLoading(false));
  }, [habitation?.id, category]);

  async function save() {
    const payload = { ...values, ...(version ? { expectedVersion: version } : {}) };
    fields.forEach(([key, , type]) => { if (type === "number" && payload[key] !== "") payload[key] = Number(payload[key]); });
    try {
      const result = await apiRequest(`/api/habitations/${habitation.id}/parameters/${category}`, session, { method: "PUT", body: JSON.stringify(payload) });
      setVersion(result.version); notify(`${selected} saved.`);
    } catch (error) { notify(error.message); }
  }

  const cat = categories.find(c => c[0] === selected) || categories[0];
  return <div><PageHeader eyebrow="PARAMETERS" title="Habitation parameters" description={habitation ? `Editing ${habitation.name}. Changes are versioned and audited.` : "Select a server habitation before editing parameters."} action={<button className="button secondary" disabled={!habitation} onClick={() => notify("History is available from the audit log API.")}>View history</button>} />
    <div className="category-grid">{categories.map(([name, pct]) => <button key={name} onClick={() => setSelected(name)} className={selected === name ? "category-card selected" : "category-card"}><span>{name}</span><b>{pct}%</b><div className="progress"><i style={{ width: pct + "%" }} /></div></button>)}</div>
    <div className="panel parameter-panel"><PanelTitle title={selected} meta={loading ? "Loading server values..." : habitation ? `Version ${version || 1}` : "No habitation selected"} action={<button className="button primary" disabled={!habitation || loading || isPending} onClick={save}>{isPending ? "Pending approval" : "Save changes"}</button>} />
      <div className="field-grid">{fields.map(([key, label, type]) => <label className="field" key={key}><span>{label}</span><input type={type} value={values[key] ?? ""} onChange={event => setValues({ ...values, [key]: event.target.value })} /><small>{habitation ? "Server value · audited on save" : "Select a habitation first"}</small></label>)}</div>
    </div>
  </div>;
}

function GIS({ layers, setLayers, notify, session, habitation, canEdit }) {
  const [items, setItems] = useState([]);
  const [file, setFile] = useState(null);
  const [layerType, setLayerType] = useState("settlement");
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState("");
  const names = [["road", "Roads", "roads", Globe2], ["water_body", "Water bodies", "water", Waves], ["settlement", "Settlements", "settlements", Building2], ["terrain", "Terrain", "terrain", Layers3], ["boundary", "Boundaries", "boundary", Map]];

  useEffect(() => {
    if (!habitation?.id) { setItems([]); return; }
    let active = true;
    const load = () => apiRequest(`/api/habitations/${habitation.id}/map-layers`, session)
      .then(data => { if (active) { setItems(data); setError(""); } })
      .catch(err => { if (active) setError(err.message); });
    load();
    const timer = window.setInterval(load, 2500);
    return () => { active = false; window.clearInterval(timer); };
  }, [habitation?.id, session]);

  async function uploadLayer(event) {
    event.preventDefault();
    if (!file || !habitation?.id) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.append("layerType", layerType);
      body.append("file", file);
      const response = await fetch(`${API_BASE}/api/habitations/${habitation.id}/map-layers`, {
        method: "POST", headers: { Authorization: `Bearer ${session.accessToken}` }, body
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error?.message || "Map layer upload failed.");
      setFile(null);
      event.currentTarget.reset();
      notify(`${file.name} uploaded; processing started.`);
      const fresh = await apiRequest(`/api/habitations/${habitation.id}/map-layers`, session);
      setItems(fresh);
    } catch (err) { notify(err.message); }
    finally { setBusy(false); }
  }

  const visibleLayers = items.filter(item => {
    const toggle = { road: "roads", water_body: "water", settlement: "settlements", terrain: "terrain", boundary: "boundary" }[item.layer_type];
    return layers[toggle] !== false && item.status === "ready";
  });
  const geojson = visibleLayers.map(item => {
    try { return typeof item.geometry_geojson === "string" ? JSON.parse(item.geometry_geojson) : item.geometry_geojson; }
    catch { return null; }
  }).filter(Boolean);

  return <div><PageHeader eyebrow="GIS MAP" title="Geographical layers" description={`Uploaded spatial data for ${habitation?.name || "the selected habitation"}.`} />
    <div className="gis-layout"><div className="panel gis-map"><div className="map-toolbar"><span><Map size={16} /> {habitation?.name || "No habitation selected"}</span><div><button className="icon-button" aria-label="Zoom in" onClick={() => setZoom(value => Math.min(value * 1.25, 4))}>+</button><button className="icon-button" aria-label="Zoom out" onClick={() => setZoom(value => Math.max(value / 1.25, 0.5))}>−</button></div></div>
      {habitation ? <GeometryMap data={geojson} zoom={zoom} /> : <div className="map-empty">Select a habitation to view its map layers.</div>}
      <div className="map-note">Map geometry is rendered from processed GeoJSON layers. Use zoom controls to inspect uploaded features.</div>
    </div>
      <div className="panel layer-panel"><PanelTitle title="Layers" meta={`${items.length} uploaded`} />
        {names.map(([key, label, toggleKey, Icon]) => <label className="layer-row" key={key}><span><Icon size={18} />{label}</span><input type="checkbox" checked={layers[toggleKey] !== false} onChange={e => setLayers({ ...layers, [toggleKey]: e.target.checked })} /></label>)}
        <div className="divider" /><h4>Uploaded layers</h4>
        {!items.length && <p className="muted">No map layers uploaded yet.</p>}
        {items.map(item => <div className="gis-layer-item" key={item.id}><div><strong>{item.layer_type.replaceAll("_", " ")}</strong><small>{new Date(item.uploaded_at).toLocaleString()}</small></div><StatusRow label="" status={item.status} />{item.failure_reason && <small className="form-error-text">{item.failure_reason}</small>}</div>)}
        {canEdit && <form className="gis-upload-form" onSubmit={uploadLayer}><div className="divider" /><h4>Upload map data</h4>
          <label className="field"><span>Layer type</span><select value={layerType} onChange={e => setLayerType(e.target.value)}><option value="road">Road</option><option value="water_body">Water body</option><option value="terrain">Terrain</option><option value="settlement">Settlement</option><option value="boundary">Boundary</option></select></label>
          <label className="field"><span>GeoJSON, JSON, SHP or ZIP (max 50 MB)</span><input required type="file" accept=".geojson,.json,.shp,.zip" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
          <label className="field"><span>GeoJSON, JSON, SHP or ZIP (max 50 MB)</span><input key={file ? file.name : "empty"} required type="file" accept=".geojson,.json,.shp,.zip" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
          <button className="button primary" disabled={!habitation || !file || busy}><UploadCloud size={15} />{busy ? "Uploading..." : "Upload layer"}</button>
          {error && <small className="form-error-text">{error}</small>}
        </form>}
      </div>
    </div>
  </div>
}

function GeometryMap({ data, zoom }) {
  const coordinates = [];
  const collect = value => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") coordinates.push(value);
    else value.forEach(collect);
  };
  const visit = geometry => {
    if (!geometry) return;
    if (geometry.type === "FeatureCollection") geometry.features?.forEach(visit);
    else if (geometry.type === "Feature") visit(geometry.geometry);
    else if (geometry.type === "GeometryCollection") geometry.geometries?.forEach(visit);
    else collect(geometry.coordinates);
  };
  data.forEach(visit);
  if (!coordinates.length) return <div className="map-empty">No processed geometry to display.</div>;
  const extent = coordinates.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point[0]), maxX: Math.max(bounds.maxX, point[0]),
    minY: Math.min(bounds.minY, point[1]), maxY: Math.max(bounds.maxY, point[1])
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
  const { minX, maxX, minY, maxY } = extent;
  const padX = Math.max((maxX - minX) * 0.08, 0.0001), padY = Math.max((maxY - minY) * 0.08, 0.0001);
  const bounds = { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY };
  const project = ([x, y]) => [40 + (x - bounds.minX) / (bounds.maxX - bounds.minX) * 720, 40 + (bounds.maxY - y) / (bounds.maxY - bounds.minY) * 440];
  const renderGeometry = (geometry, index = 0) => {
    if (!geometry) return null;
    if (geometry.type === "FeatureCollection") return geometry.features?.map(renderGeometry);
    if (geometry.type === "Feature") return renderGeometry(geometry.geometry, index);
    if (geometry.type === "GeometryCollection") return geometry.geometries?.map(renderGeometry);
    const color = ["#286b57", "#287a9b", "#b35f2a", "#4e6c87", "#8c4d4d"][index % 5];
    const line = points => points.map(project).map((point, i) => `${i ? "L" : "M"}${point[0]},${point[1]}`).join(" ");
    if (geometry.type === "Point") { const [cx, cy] = project(geometry.coordinates); return <circle key={`${index}-${cx}-${cy}`} cx={cx} cy={cy} r="6" fill={color} stroke="#fff" strokeWidth="2" />; }
    if (geometry.type === "MultiPoint") return geometry.coordinates.map((point, i) => { const [cx, cy] = project(point); return <circle key={`${index}-${i}`} cx={cx} cy={cy} r="5" fill={color} stroke="#fff" strokeWidth="2" />; });
    const paths = geometry.type === "LineString" ? [geometry.coordinates] : geometry.type === "MultiLineString" ? geometry.coordinates : geometry.type === "Polygon" ? geometry.coordinates : geometry.type === "MultiPolygon" ? geometry.coordinates.flat() : [];
    return paths.map((points, i) => <path key={`${index}-${i}`} d={`${line(points)}${["Polygon", "MultiPolygon"].includes(geometry.type) ? " Z" : ""}`} fill={["Polygon", "MultiPolygon"].includes(geometry.type) ? `${color}33` : "none"} stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke" />);
  };
  return <div className="mini-map geometry-map"><svg viewBox="0 0 800 520" role="img" aria-label="Uploaded GIS feature map"><rect width="800" height="520" fill="#edf0e9" /><g transform={`translate(${400 * (1 - zoom)},${260 * (1 - zoom)}) scale(${zoom})`}>{data.map((geometry, index) => renderGeometry(geometry, index))}</g></svg></div>;
}

function StatusRow({ label, status }) { return <div className="status-row"><span>{label}</span><span className={"badge " + status.toLowerCase().replace(" ", "-")}>{status}</span></div> }

function Uploads({ notify, onApplyRecord, session, habitation, canEdit }) {
  const [drag, setDrag] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(defaultEntry);
  const [datasetFile, setDatasetFile] = useState(null);
  const [category, setCategory] = useState("demography");
  const [datasetUploads, setDatasetUploads] = useState([]);
  const [uploadBusy, setUploadBusy] = useState(false);

  useEffect(() => {
    async function loadRecords() {
      const records = await fetchDataRecords(session);
      setEntries(records);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    }
    loadRecords();
  }, [session]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    if (!datasetUploads.some(item => ["pending", "validating"].includes(item.status))) return;
    const timer = window.setInterval(() => {
      datasetUploads.filter(item => ["pending", "validating"].includes(item.status)).forEach(item => {
        apiRequest(`/api/uploads/${item.id}`, session)
          .then(result => setDatasetUploads(current => current.map(row => row.id === item.id ? { ...row, status: result.status, rowCount: result.rowCount, validRowCount: result.validRowCount } : row)))
          .catch(() => { });
      });
    }, 2000);
    return () => window.clearInterval(timer);
  }, [datasetUploads, session]);

  const handleFieldChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const applyRecordToDashboard = (record) => {
    const payload = {
      name: record.habitation,
      habitation: record.habitation,
      location: record.location,
      population: Number(record.population || 0),
      growth: Number(record.growthRate ?? record.growth ?? 0),
      waste: Number(record.wasteTonnesPerDay ?? record.waste ?? 0),
      collection: Number(record.collectionEfficiency ?? record.collection ?? 0),
      treatment: Number(record.treatmentEfficiency ?? record.treatment ?? 0),
    };

    localStorage.setItem("swms-active-record", JSON.stringify(payload));
    onApplyRecord?.(payload);
    notify(`${record.habitation} applied to the dashboard.`);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const habitation = form.habitation.trim();
    const location = form.location.trim();

    if (!habitation || !location) {
      notify("Please provide a habitation name and location.");
      return;
    }

    const payload = {
      habitation,
      location,
      population: Number(form.population),
      growthRate: Number(form.growthRate),
      rainfallMm: Number(form.rainfallMm),
      wasteTonnesPerDay: Number(form.wasteTonnesPerDay),
      collectionEfficiency: Number(form.collectionEfficiency),
      treatmentEfficiency: Number(form.treatmentEfficiency)
    };

    const errors = [];
    if (!Number.isFinite(payload.population) || payload.population <= 0) errors.push("Population is required and must be greater than zero.");
    if (!Number.isFinite(payload.growthRate) || payload.growthRate < -50 || payload.growthRate > 50) errors.push("Growth rate must be between -50 and 50.");
    if (!Number.isFinite(payload.rainfallMm) || payload.rainfallMm < 0 || payload.rainfallMm > 20000) errors.push("Rainfall must be between 0 and 20000 mm.");
    if (!Number.isFinite(payload.wasteTonnesPerDay) || payload.wasteTonnesPerDay < 0 || payload.wasteTonnesPerDay > 50000) errors.push("Waste must be between 0 and 50000 tonnes per day.");
    if (!Number.isFinite(payload.collectionEfficiency) || payload.collectionEfficiency < 0 || payload.collectionEfficiency > 100) errors.push("Collection efficiency must be between 0 and 100.");
    if (!Number.isFinite(payload.treatmentEfficiency) || payload.treatmentEfficiency < 0 || payload.treatmentEfficiency > 100) errors.push("Treatment efficiency must be between 0 and 100.");

    if (errors.length) {
      notify(errors[0]);
      return;
    }

    try {
      const savedEntry = await saveDataRecord(payload, session);
      setEntries((current) => [savedEntry, ...current]);
      setForm(defaultEntry);
      setShowForm(false);
      notify(`${habitation} saved and available for dashboard use.`);
    } catch (error) {
      notify(error.message || "Unable to save the entered record.");
    }
  };

  async function uploadDataset(file) {
    if (!file || !habitation?.id) return;
    setUploadBusy(true);
    const body = new FormData();
    body.append("habitationId", habitation.id);
    body.append("category", category);
    body.append("file", file);
    try {
      const response = await fetch(`${API_BASE}/api/uploads`, { method: "POST", headers: { Authorization: `Bearer ${session.accessToken}` }, body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error?.message || "Dataset upload failed.");
      setDatasetUploads(current => [{ id: result.data.id, filename: result.data.originalFilename || file.name, status: result.data.status }, ...current]);
      setDatasetFile(null);
      notify(`${file.name} uploaded; validation started.`);
    } catch (error) { notify(error.message || "Unable to upload file."); }
    finally { setUploadBusy(false); }
  }

  return <div><PageHeader eyebrow="DATA UPLOAD" title="Upload habitation data" description="Add structured parameter files, GIS datasets, or manual records for real end-user planning." />
    <div className="upload-grid"><div className={"upload-zone " + (drag ? "drag" : "")} onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); const file = e.dataTransfer.files?.[0]; if (file) { setDatasetFile(file); uploadDataset(file); } }}>
      <UploadCloud size={44} /><h3>Upload a dataset</h3><p>Choose a CSV or XLSX file from your device</p>
      <label className="field upload-field"><span>Parameter category</span><select value={category} onChange={e => setCategory(e.target.value)}><option value="demography">Demography</option><option value="infrastructure">Infrastructure</option><option value="industrial">Industrial</option><option value="natural_resource">Natural resources</option><option value="terrain">Terrain</option><option value="economic">Economic</option><option value="cultural">Cultural</option></select></label>
      {canEdit ? <><label className="button primary file-picker"><UploadCloud size={15} />Choose file<input type="file" accept=".csv,.xlsx" onChange={e => { const file = e.target.files?.[0]; if (file) { setDatasetFile(file); uploadDataset(file); e.target.value = ""; } }} /></label><small>CSV or XLSX · maximum 20 MB · {habitation?.name || "select a habitation first"}</small>{datasetFile && uploadBusy && <small>Uploading {datasetFile.name}...</small>}</> : <small>Your role has read-only access to uploaded data.</small>}
      {!habitation && <small className="form-error-text">Select a habitation in the top bar before uploading.</small>}
    </div>
      <div className="panel"><PanelTitle title="Manual data entry" meta={`${entries.length} saved entries`} action={canEdit && <button className="button primary" onClick={() => setShowForm(v => !v)}>{showForm ? "Hide form" : "Insert data"}</button>} />
        {showForm && canEdit && <form className="manual-entry-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="field"><span>Habitation</span><input value={form.habitation} onChange={e => handleFieldChange("habitation", e.target.value)} /></label>
            <label className="field"><span>Location</span><input value={form.location} onChange={e => handleFieldChange("location", e.target.value)} /></label>
            <label className="field"><span>Population</span><input type="number" value={form.population} onChange={e => handleFieldChange("population", e.target.value)} /></label>
            <label className="field"><span>Annual growth (%)</span><input type="number" step="0.1" value={form.growthRate} onChange={e => handleFieldChange("growthRate", e.target.value)} /></label>
            <label className="field"><span>Rainfall (mm)</span><input type="number" value={form.rainfallMm} onChange={e => handleFieldChange("rainfallMm", e.target.value)} /></label>
            <label className="field"><span>Waste (t/day)</span><input type="number" step="0.1" value={form.wasteTonnesPerDay} onChange={e => handleFieldChange("wasteTonnesPerDay", e.target.value)} /></label>
            <label className="field"><span>Collection efficiency (%)</span><input type="number" value={form.collectionEfficiency} onChange={e => handleFieldChange("collectionEfficiency", e.target.value)} /></label>
            <label className="field"><span>Treatment efficiency (%)</span><input type="number" value={form.treatmentEfficiency} onChange={e => handleFieldChange("treatmentEfficiency", e.target.value)} /></label>
          </div>
          <div className="form-actions"><button type="button" className="button secondary" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="button primary">Save record</button></div>
        </form>}
        <div className="entry-list">{entries.map((entry) => <div className="entry-item" key={entry.id ?? `${entry.habitation}-${entry.location}`}>
          <div>
            <strong>{entry.habitation}</strong>
            <span>{entry.location}</span>
          </div>
          <div className="entry-meta">
            <small>{entry.population?.toLocaleString()} people · {entry.wasteTonnesPerDay ?? entry.waste ?? 0} t/day</small>
            <button className="text-button" onClick={() => applyRecordToDashboard(entry)}>Apply to dashboard</button>
          </div>
        </div>)}</div>
      </div>
    </div>
    <div className="panel"><PanelTitle title="Recent uploads" meta={`${datasetUploads.length} this session`} />{datasetUploads.length ? datasetUploads.map(item => <div className="upload-row" key={item.id}><div><FileText size={18} /><span>{item.filename}{Number.isInteger(item.rowCount) ? ` · ${item.validRowCount}/${item.rowCount} valid rows` : ""}</span></div><StatusRow label="" status={item.status} /><small>{item.status}</small></div>) : <p className="muted">Your uploaded files and validation results will appear here.</p>}</div>
    <div className="panel notice"><ShieldCheck size={20} /><div><b>Validation before simulation</b><span>Uploaded data is checked for missing or incorrect values before it becomes simulation input.</span></div></div>
  </div>
}

function Validation() {
  const issues = [
    ["18", "Population", "Missing Value", "Population is blank"],
    ["47", "Rainfall", "Invalid Value", "Negative value"],
    ["102", "Industry Type", "Unknown Value", "Not in allowed list"]
  ];
  return <div><PageHeader eyebrow="VALIDATION" title="Validation results" description="Review data-quality issues before running a simulation." />
    <div className="kpi-grid three"><KPI label="Total rows" value="1,240" icon={Database} /><KPI label="Valid rows" value="1,237" icon={CheckCircle2} /><KPI label="Rows with issues" value="3" icon={AlertTriangle} tone="amber" /></div>
    <div className="panel"><PanelTitle title="Validation issues" meta="3 issues require attention" /><div className="table-wrap"><table><thead><tr><th>Row</th><th>Field</th><th>Issue type</th><th>Details</th></tr></thead><tbody>{issues.map(r => <tr key={r[0]}>{r.map((x, i) => <td key={i}>{i === 2 ? <span className="badge failed">{x}</span> : x}</td>)}</tr>)}</tbody></table></div></div>
  </div>
}

function Approvals({ session, notify }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try { setUsers(await apiRequest("/api/users/pending", session)); setError(""); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [session]);

  async function approve(user) {
    try {
      await apiRequest(`/api/users/${user.id}/activate`, session, { method: "PATCH", body: JSON.stringify({ isActive: true, role: roles[user.id] || user.role }) });
      setUsers(current => current.filter(item => item.id !== user.id));
      notify(`${user.name} approved.`);
    } catch (err) { notify(err.message); }
  }

  return <div><PageHeader eyebrow="ADMINISTRATION" title="Account approvals" description="Review registration requests and assign an access role." action={<button className="button secondary" onClick={load}><RefreshCw size={15} /> Refresh</button>} />
    {error && <div className="form-error">{error}</div>}
    <div className="panel"><PanelTitle title="Pending accounts" meta={loading ? "Loading..." : `${users.length} awaiting approval`} />
      {loading ? <p className="muted">Loading requests...</p> : users.length === 0 ? <p className="muted">There are no accounts waiting for approval.</p> : <div className="approval-list">{users.map(user => <div className="approval-row" key={user.id}><div><strong>{user.name}</strong><span>{user.email}</span></div><label className="field"><span>Role</span><select value={roles[user.id] || user.role} onChange={event => setRoles(current => ({ ...current, [user.id]: event.target.value }))}><option value="researcher">Researcher</option><option value="planner">Planner</option><option value="admin">Admin</option></select></label><button className="button primary" onClick={() => approve(user)}><CheckCircle2 size={15} />Approve</button></div>)}</div>}
    </div>
  </div>;
}

function WasteDashboard({ rows, record }) {
  const current = rows[0];
  return <div><PageHeader eyebrow="WASTE SIMULATION" title="Waste management overview" description="Track generation, collection, treatment and disposal for the selected habitation." action={<button className="button secondary"><RefreshCw size={16} /> Refresh data</button>} />
    <div className="kpi-grid four"><KPI label="Waste generated" value={`${Number(record.waste || current.waste).toFixed(1)} t/day`} icon={Leaf} /><KPI label="Waste collected" value={`${Number(record.collection || current.collection).toFixed(1)} t/day`} icon={CheckCircle2} /><KPI label="Waste treated" value={`${Number(record.treatment || current.treatment).toFixed(1)} t/day`} icon={Activity} /><KPI label="Waste disposed" value={`${Number(record.disposal || current.disposal).toFixed(1)} t/day`} icon={Database} /></div>
    <div className="two-grid"><div className="panel chart-panel"><PanelTitle title="Waste management trend" meta="Forecast-ready view" /><WasteChart rows={rows} /></div><div className="panel"><PanelTitle title="Capacity snapshot" /><Capacity label="Collection efficiency" value={82} /><Capacity label="Treatment capacity used" value={61} /><Capacity label="Landfill capacity pressure" value={38} /><div className="notice compact"><AlertTriangle size={18} /><span>Capacity indicators are demo values until the simulation API supplies live results.</span></div></div></div>
  </div>
}

function Capacity({ label, value }) { return <div className="capacity"><div><span>{label}</span><b>{value}%</b></div><div className="progress"><i style={{ width: value + "%" }} /></div></div> }

function WasteChart({ rows }) {
  const max = Math.max(...rows.slice(0, 10).map(r => r.waste));
  return <div className="bars">{rows.slice(0, 10).map((r, i) => <div className="bar-col" key={r.year}><div className="bar" style={{ height: (r.waste / max * 150) + "px" }} title={`${r.year}: ${r.waste} t/day`} /><span>{r.year}</span></div>)}</div>
}

function Forecast({ rows, notify, record }) {
  const [years, setYears] = useState(20);
  const view = rows.slice(0, years + 1);
  const lastRow = view[view.length - 1];
  return <div><PageHeader eyebrow="FORECAST" title="20-year waste forecast" description="A transparent, simulation-ready projection using the selected habitation inputs." action={<button className="button primary" onClick={() => notify("Forecast recalculated from current inputs")}>Run forecast</button>} />
    <div className="assumption-strip"><span><b>Base year</b> 2026</span><span><b>Population</b> {formatNumber(record.population)}</span><span><b>Growth</b> {Number(record.growth || 0).toFixed(1)}%</span><span><b>Waste assumption</b> 0.673 kg/person/day</span></div>
    <div className="forecast-controls"><span>Forecast period</span>{[5, 10, 15, 20].map(n => <button className={years === n ? "chip active" : "chip"} onClick={() => setYears(n)} key={n}>{n} years</button>)}</div>
    <div className="panel"><PanelTitle title="Population & waste projection" meta={`${2026}–${2026 + years}`} /><ForecastChart rows={view} /></div>
    <div className="panel"><PanelTitle title="Year-by-year results" meta="Calculated demo projection" /><div className="table-wrap"><table><thead><tr><th>Year</th><th>Population</th><th>Waste/day</th><th>Collected</th><th>Treated</th><th>Disposed</th></tr></thead><tbody>{view.map(r => <tr key={r.year}><td>{r.year}</td><td>{r.population.toLocaleString()}</td><td>{r.waste}</td><td>{r.collection}</td><td>{r.treatment}</td><td>{r.disposal}</td></tr>)}</tbody></table></div></div>
    <div className="two-grid"><div className="panel"><h3>20-year endpoint</h3><div className="big-number">{lastRow.population.toLocaleString()} <span>people</span></div><p className="muted">{lastRow.waste} t/day estimated waste at the displayed assumption.</p></div><div className="panel"><h3>Assumptions & data source</h3><p className="muted">Population and growth are habitation inputs. Waste is calculated from the clearly displayed demo per-capita assumption. Replace the demo service with the simulation API for production results.</p></div></div>
  </div>
}

function ForecastChart({ rows }) {
  const max = Math.max(...rows.map(r => r.waste));
  const points = rows.map((r, i) => `${30 + i * (640 / (rows.length - 1))},${180 - (r.waste / max * 145)}`).join(" ");
  return <div className="forecast-chart"><svg viewBox="0 0 700 220" preserveAspectRatio="none"><line x1="30" y1="180" x2="670" y2="180" stroke="#dcd9cf" /><polyline points={points} fill="none" stroke="#2f5d50" strokeWidth="4" />{rows.filter((_, i) => i % 5 === 0 || i === rows.length - 1).map(r => { const i = rows.indexOf(r); return <g key={r.year}><circle cx={30 + i * (640 / (rows.length - 1))} cy={180 - (r.waste / max * 145)} r="5" fill="#2f5d50" /><text x={30 + i * (640 / (rows.length - 1))} y="207" textAnchor="middle" fontSize="12" fill="#64736d">{r.year}</text></g> })}</svg><div className="chart-caption"><span><i className="line green" />Estimated waste generation</span><span>Unit: tonnes/day</span></div></div>
}

function Scenarios({ scenario, setScenario, populationChange, setPopulationChange, rainfall, setRainfall, notify }) {
  const options = ["Normal", "Population Growth", "Heavy Monsoon", "Flood", "Road Blockage", "Infrastructure Disruption", "Custom Scenario"];
  const impact = scenario === "Normal" ? 0 : scenario === "Flood" ? 20 : scenario === "Heavy Monsoon" ? 12 : scenario === "Road Blockage" ? 10 : 7;
  return <div><PageHeader eyebrow="SCENARIOS" title="Test future conditions" description="Compare normal planning with extreme or unexpected conditions." action={<button className="button primary" onClick={() => notify(`${scenario} scenario calculated`)}>Run scenario</button>} />
    <div className="scenario-layout"><div className="panel"><PanelTitle title="Scenario type" /><div className="scenario-list">{options.map(o => <button className={scenario === o ? "scenario-option active" : "scenario-option"} onClick={() => setScenario(o)} key={o}><span className="scenario-icon">{o === "Flood" ? <Waves size={18} /> : o === "Road Blockage" ? <AlertTriangle size={18} /> : <Activity size={18} />}</span>{o}<ChevronDown size={16} /></button>)}</div></div>
      <div className="panel"><PanelTitle title="Scenario inputs" meta={scenario} /><Slider label="Population change" value={populationChange} min={-20} max={30} setValue={setPopulationChange} /><Slider label="Rainfall change" value={rainfall} min={-20} max={50} setValue={setRainfall} /><Slider label="Collection capacity impact" value={scenario === "Normal" ? 0 : -impact} min={-50} max={10} setValue={() => { }} disabled={scenario !== "Custom Scenario"} /><div className="divider" /><div className="compare-grid"><div><span>Normal collection</span><b>82%</b></div><div><span>{scenario} collection</span><b>{Math.max(30, 82 - impact)}%</b></div></div></div></div>
    <div className="panel"><PanelTitle title="Scenario impact" meta="Illustrative comparison" /><div className="impact-grid"><Impact label="Waste demand" value={`+${impact}%`} /><Impact label="Collection pressure" value={`+${impact + 3}%`} /><Impact label="Treatment pressure" value={`+${Math.max(1, impact - 2)}%`} /><Impact label="Cost pressure" value={`+${impact + 5}%`} /></div></div>
  </div>
}

function Slider({ label, value, min, max, setValue, disabled }) { return <label className="slider-row"><div><span>{label}</span><b>{value > 0 ? "+" : ""}{value}%</b></div><input type="range" min={min} max={max} value={value} disabled={disabled} onChange={e => setValue(+e.target.value)} /></label> }
function Impact({ label, value }) { return <div className="impact"><span>{label}</span><strong>{value}</strong><small>Compared with normal</small></div> }

function Sensitivity({ notify }) {
  const [pop, setPop] = useState(0), [waste, setWaste] = useState(0), [rain, setRain] = useState(0);
  return <div><PageHeader eyebrow="SENSITIVITY" title="Explore parameter changes" description="Change one or more assumptions and see how planning pressure responds." action={<button className="button primary" onClick={() => notify("Sensitivity test calculated")}>Run test</button>} />
    <div className="two-grid"><div className="panel"><PanelTitle title="Test inputs" /><Slider label="Population" value={pop} min={-20} max={20} setValue={setPop} /><Slider label="Waste generation" value={waste} min={-20} max={30} setValue={setWaste} /><Slider label="Rainfall" value={rain} min={-20} max={50} setValue={setRain} /></div><div className="panel"><PanelTitle title="Result preview" /><Impact label="Waste generation" value={`${pop + waste > 0 ? "+" : ""}${pop + waste}%`} /><Impact label="Collection demand" value={`+${Math.max(0, pop + waste + 3)}%`} /><Impact label="Treatment demand" value={`+${Math.max(0, pop + waste + 1)}%`} /></div></div>
  </div>
}

function Budget() {
  return <div><PageHeader eyebrow="PLANNING & COST" title="Budget & optimization" description="View multi-year planning costs and capacity requirements." />
    <div className="kpi-grid three"><KPI label="20-year estimated cost" value="₹4.8 Cr" icon={BarChart3} /><KPI label="Capital expenditure" value="₹2.1 Cr" icon={Building2} /><KPI label="Operational expenditure" value="₹2.7 Cr" icon={Activity} /></div>
    <div className="two-grid"><div className="panel"><PanelTitle title="Cost by period" /><div className="cost-bars">{[["2026", 1.2], ["2030", 1.8], ["2035", 2.4], ["2040", 3.5], ["2046", 4.8]].map(([y, v]) => <div key={y}><span>{y}</span><div className="cost-bar"><i style={{ width: (v / 4.8 * 100) + "%" }} /></div><b>₹{v} Cr</b></div>)}</div></div><div className="panel"><PanelTitle title="Planning priorities" /><div className="priority"><span>Collection fleet</span><b>High</b></div><div className="priority"><span>Treatment capacity</span><b>High</b></div><div className="priority"><span>Landfill capacity</span><b>Medium</b></div><div className="priority"><span>GIS route analysis</span><b>Future</b></div></div></div>
  </div>
}

function Reports({ notify }) {
  return <div><PageHeader eyebrow="REPORTS" title="Reports & visual summaries" description="Turn simulation outputs into clear planning documents." action={<button className="button primary" onClick={() => notify("Report export prepared")}> <Download size={16} /> Export report</button>} />
    <div className="report-grid">{["Habitation summary", "Data readiness report", "GIS layer report", "20-year forecast", "Scenario comparison", "Budget summary"].map((x, i) => <div className="report-card" key={x}><div className="report-icon"><FileText size={22} /></div><div><h3>{x}</h3><span>Updated from current demo data</span></div><button className="icon-button" onClick={() => notify(x + " opened")}><MoreHorizontal size={18} /></button></div>)}</div>
  </div>
}

function Assistant({ query, setQuery, rows }) {
  const [messages, setMessages] = useState([{ from: "bot", text: "Hello. I can explain the current habitation data and forecast. Try asking about waste after 10 years, a scenario, or capacity." }]);
  const answer = (q) => {
    const lower = q.toLowerCase();
    if (lower.includes("10 years")) return `Using the current demo assumptions, estimated waste in 2036 is about ${rows[10].waste} tonnes/day. This uses the 1.2% population growth input and the displayed per-capita waste assumption.`;
    if (lower.includes("20 years")) return `By 2046, the demo projection reaches about ${rows[20].waste} tonnes/day. This is a transparent demo calculation, not a live simulation-engine result.`;
    if (lower.includes("flood")) return "A flood scenario can be configured with rainfall and collection-capacity changes. Run the scenario screen to compare normal and flood conditions.";
    if (lower.includes("cost") || lower.includes("budget")) return "The budget screen currently shows demo planning figures. Connect the optimization API before treating these as production cost results.";
    return "I can help with 20-year forecasts, waste generation, collection, treatment, disposal, scenarios and budget assumptions.";
  };
  const ask = () => { if (!query.trim()) return; const q = query.trim(); setMessages(m => [...m, { from: "user", text: q }, { from: "bot", text: answer(q) }]); setQuery("") };
  return <div><PageHeader eyebrow="CONVERSATIONAL INTERFACE" title="Ask SWMS" description="Ask questions about the selected habitation and its simulation outputs." />
    <div className="assistant-layout"><div className="panel chat"><div className="chat-head"><Bot size={20} /><div><b>SWMS Assistant</b><span>Connected to current frontend data</span></div></div><div className="messages">{messages.map((m, i) => <div className={m.from === "bot" ? "msg bot" : "msg user"} key={i}>{m.text}</div>)}</div><div className="chat-input"><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && ask()} placeholder="Ask: What will waste be after 10 years?" /><button className="button primary" onClick={ask}>Ask</button></div></div><div className="panel"><PanelTitle title="Try asking" />{["What will the estimated waste be after 10 years?", "What happens during a flood?", "How much treatment capacity is needed?", "What is the 20-year cost?"].map(q => <button className="suggestion" key={q} onClick={() => setQuery(q)}>{q}<ChevronDown size={15} /></button>)}</div></div>
  </div>
}

createRoot(document.getElementById("root")).render(<App />);
