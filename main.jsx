
import React, { useMemo, useState } from "react";
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
  { id:"dashboard", label:"Dashboard", icon:Home },
  { id:"habitations", label:"Habitations", icon:Building2 },
  { id:"parameters", label:"Parameters", icon:SlidersHorizontal },
  { id:"gis", label:"GIS Map", icon:Map },
  { id:"uploads", label:"Data Upload", icon:UploadCloud },
  { id:"validation", label:"Validation", icon:FileCheck2 },
  { id:"waste", label:"Waste Simulation", icon:Activity },
  { id:"forecast", label:"20-Year Forecast", icon:LineChart },
  { id:"scenarios", label:"Scenarios", icon:AlertTriangle },
  { id:"sensitivity", label:"Sensitivity", icon:SlidersHorizontal },
  { id:"budget", label:"Budget & Optimization", icon:BarChart3 },
  { id:"reports", label:"Reports", icon:FileText },
  { id:"assistant", label:"Ask SWMS", icon:Bot },
];

const ROLES = ["Municipal Admin", "Planner", "Researcher"];

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
  ["habitation_data.csv","Validated","Today"],
  ["gis_layers.zip","Validating","Today"],
  ["industry_data.xlsx","Validated","Yesterday"],
  ["terrain_data.shp","Failed","Apr 05"],
];

function forecastRows() {
  const rows = [];
  const baseYear = 2026;
  const perCapita = 0.673; // demo assumption; clearly labelled in UI
  for (let i = 0; i <= 20; i++) {
    const population = Math.round(habitationData.population * Math.pow(1 + habitationData.growth/100, i));
    const waste = population * perCapita / 1000;
    const collection = waste * (habitationData.collection/100);
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
  const [page, setPage] = useState("dashboard");
  const [role, setRole] = useState("Municipal Admin");
  const [habitation, setHabitation] = useState("Demo Village");
  const [sidebar, setSidebar] = useState(true);
  const [toast, setToast] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Demography");
  const [layers, setLayers] = useState({roads:true, water:true, settlements:true, terrain:true});
  const [scenario, setScenario] = useState("Normal");
  const [populationChange, setPopulationChange] = useState(0);
  const [rainfall, setRainfall] = useState(0);
  const [query, setQuery] = useState("");

  const rows = useMemo(() => forecastRows(), []);
  const last = rows[20];

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  };

  const navigate = (id) => {
    setPage(id);
    window.scrollTo({top:0, behavior:"smooth"});
  };

  return (
    <div className="app-shell">
      {sidebar && <Sidebar page={page} navigate={navigate} role={role} />}
      <div className={sidebar ? "main-shell" : "main-shell full"}>
        <Topbar
          habitation={habitation}
          setHabitation={setHabitation}
          role={role}
          setRole={setRole}
          onMenu={() => setSidebar(v=>!v)}
          notify={notify}
        />
        <main className="content">
          {page === "dashboard" && <Dashboard navigate={navigate} />}
          {page === "habitations" && <Habitations navigate={navigate} notify={notify}/>}
          {page === "parameters" && <Parameters selected={selectedCategory} setSelected={setSelectedCategory} notify={notify}/>}
          {page === "gis" && <GIS layers={layers} setLayers={setLayers} />}
          {page === "uploads" && <Uploads notify={notify}/>}
          {page === "validation" && <Validation />}
          {page === "waste" && <WasteDashboard rows={rows} />}
          {page === "forecast" && <Forecast rows={rows} notify={notify}/>}
          {page === "scenarios" && <Scenarios scenario={scenario} setScenario={setScenario} populationChange={populationChange} setPopulationChange={setPopulationChange} rainfall={rainfall} setRainfall={setRainfall} notify={notify}/>}
          {page === "sensitivity" && <Sensitivity notify={notify}/>}
          {page === "budget" && <Budget />}
          {page === "reports" && <Reports notify={notify}/>}
          {page === "assistant" && <Assistant query={query} setQuery={setQuery} rows={rows}/>}
        </main>
      </div>
      {toast && <div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
    </div>
  );
}

function Sidebar({page,navigate,role}) {
  return <aside className="sidebar">
    <div className="brand">
      <div className="brand-mark"><Leaf size={22}/></div>
      <div><strong>SWMS</strong><span>Smart Waste Management Simulator</span></div>
    </div>
    <div className="role-mini"><ShieldCheck size={14}/><span>{role}</span></div>
    <nav>
      {NAV.map(({id,label,icon:Icon}) => <button key={id} className={page===id ? "nav-item active" : "nav-item"} onClick={()=>navigate(id)}>
        <Icon size={18}/><span>{label}</span>
      </button>)}
    </nav>
    <div className="sidebar-bottom">
      <button className="nav-item"><Settings size={18}/><span>Settings</span></button>
      <div className="help-box"><CircleHelp size={18}/><div><b>Need help?</b><span>Use simple labels and visual status.</span></div></div>
    </div>
  </aside>
}

function Topbar({habitation,setHabitation,role,setRole,onMenu,notify}) {
  return <header className="topbar">
    <button className="icon-button mobile-menu" onClick={onMenu}><Menu size={20}/></button>
    <div className="select-wrap"><Map size={15}/><select value={habitation} onChange={e=>setHabitation(e.target.value)}><option>Demo Village</option><option>Demo Ward</option><option>Demo Town</option></select></div>
    <div className="top-actions">
      <span className="role-label">Role</span>
      <div className="select-wrap role-select"><Users size={14}/><select value={role} onChange={e=>setRole(e.target.value)}>{ROLES.map(r=><option key={r}>{r}</option>)}</select></div>
      <button className="icon-button" onClick={()=>notify("No new notifications")}><Bell size={18}/></button>
      <div className="avatar">SA</div>
    </div>
  </header>
}

function PageHeader({eyebrow,title,description,action}) {
  return <div className="page-header">
    <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>
    {action}
  </div>
}

function KPI({label,value,sub,icon:Icon,tone="green"}) {
  return <div className="kpi">
    <div className={"kpi-icon "+tone}><Icon size={19}/></div>
    <div><span>{label}</span><strong>{value}</strong>{sub && <small>{sub}</small>}</div>
  </div>
}

function Dashboard({navigate}) {
  return <div>
    <PageHeader eyebrow="OVERVIEW" title="Good morning, Admin" description="A clear view of habitation data, map status and waste-management readiness." action={<button className="button primary" onClick={()=>navigate("forecast")}><Zap size={16}/> Run 20-Year Forecast</button>}/>
    <div className="kpi-grid">
      <KPI label="Data Readiness" value="92%" sub="6 of 7 categories ready" icon={Gauge}/>
      <KPI label="Validation Confidence" value="88%" sub="1,240 rows checked" icon={ShieldCheck}/>
      <KPI label="Population" value="12,480" sub="+1.2% annual growth" icon={Users}/>
      <KPI label="Waste Generated" value="8.4 t/day" sub="Demo baseline" icon={Leaf}/>
    </div>
    <div className="dashboard-grid">
      <div className="panel map-panel">
        <PanelTitle title="Habitation map" meta="4 layers active" action={<button className="text-button" onClick={()=>navigate("gis")}>Open GIS <ChevronDown size={14}/></button>}/>
        <MiniMap layers={{roads:true,water:true,settlements:true,terrain:true}}/>
      </div>
      <div className="panel">
        <PanelTitle title="Data readiness by category" meta="Last checked today"/>
        <div className="readiness-list">
          {categories.map(([name,pct])=><div className="readiness-row" key={name}><div><span>{name}</span><b>{pct}%</b></div><div className="progress"><i style={{width:pct+"%"}}/></div></div>)}
        </div>
      </div>
    </div>
    <div className="three-grid">
      <div className="panel chart-panel">
        <PanelTitle title="Waste generation trend" meta="Monthly"/>
        <SimpleChart/>
      </div>
      <div className="panel">
        <PanelTitle title="20-year outlook" meta="2026–2046"/>
        <div className="outlook"><div className="outlook-number">{(8.4* Math.pow(1.012,20)).toFixed(1)} <span>t/day</span></div><span className="muted">Projected daily waste at the demo growth assumption.</span><button className="button secondary full-width" onClick={()=>navigate("forecast")}>View forecast</button></div>
      </div>
      <div className="panel">
        <PanelTitle title="Quick actions"/>
        <div className="quick-actions">
          <button onClick={()=>navigate("uploads")}><UploadCloud/>Upload data</button>
          <button onClick={()=>navigate("validation")}><FileCheck2/>Check validation</button>
          <button onClick={()=>navigate("gis")}><Map/>View map</button>
          <button onClick={()=>navigate("scenarios")}><AlertTriangle/>Test scenario</button>
        </div>
      </div>
    </div>
  </div>
}

function PanelTitle({title,meta,action}) { return <div className="panel-title"><div><h3>{title}</h3>{meta && <span>{meta}</span>}</div>{action}</div> }

function MiniMap({layers}) {
  return <div className="mini-map">
    <svg viewBox="0 0 800 330" preserveAspectRatio="none">
      <rect width="800" height="330" fill="#dbe5dc"/>
      <path d="M0 250 C130 185 210 300 330 225 S560 90 800 170 L800 330 L0 330Z" fill="#a9c8d3"/>
      <path d="M-20 60 C160 125 230 40 370 105 S620 200 820 90" fill="none" stroke="#e7eee5" strokeWidth="22"/>
      {layers.roads && <g stroke="#8d9a92" strokeWidth="4" opacity=".9"><path d="M20 290 L170 180 L330 220 L470 70 L780 120"/><path d="M80 40 L220 120 L410 100 L610 250"/><path d="M310 320 L350 220 L470 170 L720 285"/></g>}
      {layers.terrain && <g fill="none" stroke="#6f9276" strokeWidth="2" opacity=".55"><ellipse cx="230" cy="165" rx="130" ry="70"/><ellipse cx="230" cy="165" rx="95" ry="50"/><ellipse cx="230" cy="165" rx="60" ry="32"/></g>}
      {layers.settlements && <g fill="#5c7663" opacity=".8">{[120,155,185,220,255,300,330,360,395,440,500,560,620].map((x,i)=><rect key={i} x={x} y={130+(i%4)*24} width="16" height="10" rx="2"/>)}</g>}
      {layers.water && <path d="M570 0 C520 90 650 110 570 180 C520 225 650 260 610 330" fill="none" stroke="#4b7c94" strokeWidth="12" opacity=".8"/>}
      <circle cx="398" cy="160" r="10" fill="#2f5d50" stroke="white" strokeWidth="5"/>
    </svg>
    <div className="map-legend"><span><i className="dot road"/>Roads</span><span><i className="dot water"/>Water</span><span><i className="dot settlement"/>Settlements</span><span><i className="dot terrain"/>Terrain</span></div>
  </div>
}

function SimpleChart() {
  return <div className="simple-chart">
    <svg viewBox="0 0 700 210" preserveAspectRatio="none">
      <line x1="35" y1="180" x2="680" y2="180" stroke="#dcd9cf"/><line x1="35" y1="30" x2="35" y2="180" stroke="#dcd9cf"/>
      <path d="M35 155 C100 145 120 148 180 132 S270 135 330 112 S420 105 480 92 S580 82 680 58" fill="none" stroke="#2f5d50" strokeWidth="4"/>
      <path d="M35 164 C100 158 120 160 180 151 S270 148 330 137 S420 133 480 121 S580 118 680 101" fill="none" stroke="#3e6e8e" strokeWidth="3"/>
    </svg>
    <div className="chart-legend"><span><i className="line green"/>Generated</span><span><i className="line blue"/>Collected</span></div>
  </div>
}

function Habitations({navigate,notify}) {
  const items = [
    ["Demo Village","Village","92%"],["Demo Ward","Ward","70%"],["Demo Town","Town","60%"],["Demo City","City","50%"]
  ];
  return <div><PageHeader eyebrow="HABITATIONS" title="Select a habitation" description="Choose the village, ward, town or city you want to plan for." action={<button className="button primary" onClick={()=>notify("Create habitation form opened")}>+ New habitation</button>}/>
    <div className="searchbar"><Search size={18}/><input placeholder="Search habitations"/></div>
    <div className="habitation-grid">{items.map(([name,type,pct],i)=><button className="hab-card" key={name} onClick={()=>notify(name+" selected")}>
      <div className="hab-image"><Map size={28}/></div><div className="hab-info"><div><h3>{name}</h3><span>{type} · Karnataka, India</span></div><b>{pct}</b></div><div className="progress"><i style={{width:pct}}/></div><small>Data readiness</small>
    </button>)}</div>
    <div className="panel notice"><ShieldCheck size={20}/><div><b>Why readiness matters</b><span>Only validated and available data should feed the simulation. Missing inputs are shown before a forecast is run.</span></div></div>
  </div>
}

function Parameters({selected,setSelected,notify}) {
  const cat = categories.find(c=>c[0]===selected) || categories[0];
  return <div><PageHeader eyebrow="PARAMETERS" title="Habitation parameters" description="Manage the seven categories that describe the selected habitation." action={<button className="button secondary" onClick={()=>notify("Parameter history opened")}>View history</button>}/>
    <div className="category-grid">{categories.map(([name,pct])=><button key={name} onClick={()=>setSelected(name)} className={selected===name?"category-card selected":"category-card"}><span>{name}</span><b>{pct}%</b><div className="progress"><i style={{width:pct+"%"}}/></div></button>)}</div>
    <div className="panel parameter-panel"><PanelTitle title={selected} meta={`${cat[1]}% data readiness`} action={<button className="button primary" onClick={()=>notify(selected+" saved")}>Save changes</button>}/>
      <div className="field-grid">{cat[2].map((field,i)=><label className="field" key={field}><span>{field}</span><input defaultValue={
        field==="Population"?"12,480":field==="Population Density"?"670":field==="Annual Growth Rate"?"1.2":field==="Floating Population"?"8":field==="Annual Rainfall"?"1,850":field==="Per-Capita Income"?"₹18,000":"Available"
      }/><small>Source: habitation dataset · Last updated today</small></label>)}</div>
    </div>
  </div>
}

function GIS({layers,setLayers}) {
  const names = [["roads","Roads",Globe2],["water","Water Bodies",Waves],["settlements","Settlements",Building2],["terrain","Terrain",Layers3]];
  return <div><PageHeader eyebrow="GIS MAP" title="Geographical layers" description="Explore roads, settlements, water bodies and terrain for the selected habitation." action={<button className="button secondary"><Download size={16}/> Export view</button>}/>
    <div className="gis-layout"><div className="panel gis-map"><div className="map-toolbar"><span><Map size={16}/> Demo Village</span><div><button className="icon-button">+</button><button className="icon-button">−</button></div></div><MiniMap layers={layers}/><div className="map-note">Schematic demonstration layer. Connect to the GIS API for live GeoJSON/Map data.</div></div>
      <div className="panel layer-panel"><PanelTitle title="Layers" meta="Toggle visibility"/>
        {names.map(([key,label,Icon])=><label className="layer-row" key={key}><span><Icon size={18}/>{label}</span><input type="checkbox" checked={layers[key]} onChange={e=>setLayers({...layers,[key]:e.target.checked})}/></label>)}
        <div className="divider"/>
        <h4>Layer status</h4><StatusRow label="Roads" status="Ready"/><StatusRow label="Water bodies" status="Ready"/><StatusRow label="Settlements" status="Ready"/><StatusRow label="Terrain" status="Processing"/>
      </div>
    </div>
  </div>
}

function StatusRow({label,status}) { return <div className="status-row"><span>{label}</span><span className={"badge "+status.toLowerCase().replace(" ","-")}>{status}</span></div> }

function Uploads({notify}) {
  const [drag,setDrag] = useState(false);
  return <div><PageHeader eyebrow="DATA UPLOAD" title="Upload habitation data" description="Add structured parameter files or GIS datasets for validation and integration."/>
    <div className="upload-grid"><div className={"upload-zone "+(drag?"drag":"")} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);notify("Demo file received for validation")}}>
      <UploadCloud size={44}/><h3>Drop a dataset here</h3><p>or choose a file from your device</p><button className="button primary" onClick={()=>notify("File picker opened")}>Choose file</button><small>CSV · XLSX · GeoJSON · Shapefile ZIP</small></div>
      <div className="panel"><PanelTitle title="Recent uploads" meta="Latest activity"/>{demoUploads.map(([file,status,date])=><div className="upload-row" key={file}><div><FileText size={18}/><span>{file}</span></div><StatusRow label="" status={status}/><small>{date}</small></div>)}</div></div>
    <div className="panel notice"><ShieldCheck size={20}/><div><b>Validation before simulation</b><span>Uploaded data is checked for missing or incorrect values before it becomes simulation input.</span></div></div>
  </div>
}

function Validation() {
  const issues = [
    ["18","Population","Missing Value","Population is blank"],
    ["47","Rainfall","Invalid Value","Negative value"],
    ["102","Industry Type","Unknown Value","Not in allowed list"]
  ];
  return <div><PageHeader eyebrow="VALIDATION" title="Validation results" description="Review data-quality issues before running a simulation."/>
    <div className="kpi-grid three"><KPI label="Total rows" value="1,240" icon={Database}/><KPI label="Valid rows" value="1,237" icon={CheckCircle2}/><KPI label="Rows with issues" value="3" icon={AlertTriangle} tone="amber"/></div>
    <div className="panel"><PanelTitle title="Validation issues" meta="3 issues require attention"/><div className="table-wrap"><table><thead><tr><th>Row</th><th>Field</th><th>Issue type</th><th>Details</th></tr></thead><tbody>{issues.map(r=><tr key={r[0]}>{r.map((x,i)=><td key={i}>{i===2?<span className="badge failed">{x}</span>:x}</td>)}</tr>)}</tbody></table></div></div>
  </div>
}

function WasteDashboard({rows}) {
  const current=rows[0];
  return <div><PageHeader eyebrow="WASTE SIMULATION" title="Waste management overview" description="Track generation, collection, treatment and disposal for the selected habitation." action={<button className="button secondary"><RefreshCw size={16}/> Refresh data</button>}/>
    <div className="kpi-grid four"><KPI label="Waste generated" value={`${current.waste} t/day`} icon={Leaf}/><KPI label="Waste collected" value={`${current.collection} t/day`} icon={CheckCircle2}/><KPI label="Waste treated" value={`${current.treatment} t/day`} icon={Activity}/><KPI label="Waste disposed" value={`${current.disposal} t/day`} icon={Database}/></div>
    <div className="two-grid"><div className="panel chart-panel"><PanelTitle title="Waste management trend" meta="Forecast-ready view"/><WasteChart rows={rows}/></div><div className="panel"><PanelTitle title="Capacity snapshot"/><Capacity label="Collection efficiency" value={82}/><Capacity label="Treatment capacity used" value={61}/><Capacity label="Landfill capacity pressure" value={38}/><div className="notice compact"><AlertTriangle size={18}/><span>Capacity indicators are demo values until the simulation API supplies live results.</span></div></div></div>
  </div>
}

function Capacity({label,value}) { return <div className="capacity"><div><span>{label}</span><b>{value}%</b></div><div className="progress"><i style={{width:value+"%"}}/></div></div> }

function WasteChart({rows}) {
  const max=Math.max(...rows.slice(0,10).map(r=>r.waste));
  return <div className="bars">{rows.slice(0,10).map((r,i)=><div className="bar-col" key={r.year}><div className="bar" style={{height:(r.waste/max*150)+"px"}} title={`${r.year}: ${r.waste} t/day`}/><span>{r.year}</span></div>)}</div>
}

function Forecast({rows,notify}) {
  const [years,setYears]=useState(20);
  const view=rows.slice(0,years+1);
  const lastRow=view[view.length-1];
  return <div><PageHeader eyebrow="FORECAST" title="20-year waste forecast" description="A transparent, simulation-ready projection using the selected habitation inputs." action={<button className="button primary" onClick={()=>notify("Forecast recalculated from current inputs")}>Run forecast</button>}/>
    <div className="assumption-strip"><span><b>Base year</b> 2026</span><span><b>Population</b> 12,480</span><span><b>Growth</b> 1.2%</span><span><b>Waste assumption</b> 0.673 kg/person/day</span></div>
    <div className="forecast-controls"><span>Forecast period</span>{[5,10,15,20].map(n=><button className={years===n?"chip active":"chip"} onClick={()=>setYears(n)} key={n}>{n} years</button>)}</div>
    <div className="panel"><PanelTitle title="Population & waste projection" meta={`${2026}–${2026+years}`}/><ForecastChart rows={view}/></div>
    <div className="panel"><PanelTitle title="Year-by-year results" meta="Calculated demo projection"/><div className="table-wrap"><table><thead><tr><th>Year</th><th>Population</th><th>Waste/day</th><th>Collected</th><th>Treated</th><th>Disposed</th></tr></thead><tbody>{view.map(r=><tr key={r.year}><td>{r.year}</td><td>{r.population.toLocaleString()}</td><td>{r.waste}</td><td>{r.collection}</td><td>{r.treatment}</td><td>{r.disposal}</td></tr>)}</tbody></table></div></div>
    <div className="two-grid"><div className="panel"><h3>20-year endpoint</h3><div className="big-number">{lastRow.population.toLocaleString()} <span>people</span></div><p className="muted">{lastRow.waste} t/day estimated waste at the displayed assumption.</p></div><div className="panel"><h3>Assumptions & data source</h3><p className="muted">Population and growth are habitation inputs. Waste is calculated from the clearly displayed demo per-capita assumption. Replace the demo service with the simulation API for production results.</p></div></div>
  </div>
}

function ForecastChart({rows}) {
  const max=Math.max(...rows.map(r=>r.waste));
  const points=rows.map((r,i)=>`${30+i*(640/(rows.length-1))},${180-(r.waste/max*145)}`).join(" ");
  return <div className="forecast-chart"><svg viewBox="0 0 700 220" preserveAspectRatio="none"><line x1="30" y1="180" x2="670" y2="180" stroke="#dcd9cf"/><polyline points={points} fill="none" stroke="#2f5d50" strokeWidth="4"/>{rows.filter((_,i)=>i%5===0||i===rows.length-1).map(r=>{const i=rows.indexOf(r); return <g key={r.year}><circle cx={30+i*(640/(rows.length-1))} cy={180-(r.waste/max*145)} r="5" fill="#2f5d50"/><text x={30+i*(640/(rows.length-1))} y="207" textAnchor="middle" fontSize="12" fill="#64736d">{r.year}</text></g>})}</svg><div className="chart-caption"><span><i className="line green"/>Estimated waste generation</span><span>Unit: tonnes/day</span></div></div>
}

function Scenarios({scenario,setScenario,populationChange,setPopulationChange,rainfall,setRainfall,notify}) {
  const options=["Normal","Population Growth","Heavy Monsoon","Flood","Road Blockage","Infrastructure Disruption","Custom Scenario"];
  const impact = scenario==="Normal" ? 0 : scenario==="Flood" ? 20 : scenario==="Heavy Monsoon" ? 12 : scenario==="Road Blockage" ? 10 : 7;
  return <div><PageHeader eyebrow="SCENARIOS" title="Test future conditions" description="Compare normal planning with extreme or unexpected conditions." action={<button className="button primary" onClick={()=>notify(`${scenario} scenario calculated`)}>Run scenario</button>}/>
    <div className="scenario-layout"><div className="panel"><PanelTitle title="Scenario type"/><div className="scenario-list">{options.map(o=><button className={scenario===o?"scenario-option active":"scenario-option"} onClick={()=>setScenario(o)} key={o}><span className="scenario-icon">{o==="Flood"?<Waves size={18}/>:o==="Road Blockage"?<AlertTriangle size={18}/>:<Activity size={18}/>}</span>{o}<ChevronDown size={16}/></button>)}</div></div>
      <div className="panel"><PanelTitle title="Scenario inputs" meta={scenario}/><Slider label="Population change" value={populationChange} min={-20} max={30} setValue={setPopulationChange}/><Slider label="Rainfall change" value={rainfall} min={-20} max={50} setValue={setRainfall}/><Slider label="Collection capacity impact" value={scenario==="Normal"?0:-impact} min={-50} max={10} setValue={()=>{}} disabled={scenario!=="Custom Scenario"}/><div className="divider"/><div className="compare-grid"><div><span>Normal collection</span><b>82%</b></div><div><span>{scenario} collection</span><b>{Math.max(30,82-impact)}%</b></div></div></div></div>
    <div className="panel"><PanelTitle title="Scenario impact" meta="Illustrative comparison"/><div className="impact-grid"><Impact label="Waste demand" value={`+${impact}%`}/><Impact label="Collection pressure" value={`+${impact+3}%`}/><Impact label="Treatment pressure" value={`+${Math.max(1,impact-2)}%`}/><Impact label="Cost pressure" value={`+${impact+5}%`}/></div></div>
  </div>
}

function Slider({label,value,min,max,setValue,disabled}) { return <label className="slider-row"><div><span>{label}</span><b>{value>0?"+":""}{value}%</b></div><input type="range" min={min} max={max} value={value} disabled={disabled} onChange={e=>setValue(+e.target.value)}/></label> }
function Impact({label,value}) { return <div className="impact"><span>{label}</span><strong>{value}</strong><small>Compared with normal</small></div> }

function Sensitivity({notify}) {
  const [pop,setPop]=useState(0), [waste,setWaste]=useState(0), [rain,setRain]=useState(0);
  return <div><PageHeader eyebrow="SENSITIVITY" title="Explore parameter changes" description="Change one or more assumptions and see how planning pressure responds." action={<button className="button primary" onClick={()=>notify("Sensitivity test calculated")}>Run test</button>}/>
    <div className="two-grid"><div className="panel"><PanelTitle title="Test inputs"/><Slider label="Population" value={pop} min={-20} max={20} setValue={setPop}/><Slider label="Waste generation" value={waste} min={-20} max={30} setValue={setWaste}/><Slider label="Rainfall" value={rain} min={-20} max={50} setValue={setRain}/></div><div className="panel"><PanelTitle title="Result preview"/><Impact label="Waste generation" value={`${pop+waste>0?"+":""}${pop+waste}%`}/><Impact label="Collection demand" value={`+${Math.max(0,pop+waste+3)}%`}/><Impact label="Treatment demand" value={`+${Math.max(0,pop+waste+1)}%`}/></div></div>
  </div>
}

function Budget() {
  return <div><PageHeader eyebrow="PLANNING & COST" title="Budget & optimization" description="View multi-year planning costs and capacity requirements."/>
    <div className="kpi-grid three"><KPI label="20-year estimated cost" value="₹4.8 Cr" icon={BarChart3}/><KPI label="Capital expenditure" value="₹2.1 Cr" icon={Building2}/><KPI label="Operational expenditure" value="₹2.7 Cr" icon={Activity}/></div>
    <div className="two-grid"><div className="panel"><PanelTitle title="Cost by period"/><div className="cost-bars">{[["2026",1.2],["2030",1.8],["2035",2.4],["2040",3.5],["2046",4.8]].map(([y,v])=><div key={y}><span>{y}</span><div className="cost-bar"><i style={{width:(v/4.8*100)+"%"}}/></div><b>₹{v} Cr</b></div>)}</div></div><div className="panel"><PanelTitle title="Planning priorities"/><div className="priority"><span>Collection fleet</span><b>High</b></div><div className="priority"><span>Treatment capacity</span><b>High</b></div><div className="priority"><span>Landfill capacity</span><b>Medium</b></div><div className="priority"><span>GIS route analysis</span><b>Future</b></div></div></div>
  </div>
}

function Reports({notify}) {
  return <div><PageHeader eyebrow="REPORTS" title="Reports & visual summaries" description="Turn simulation outputs into clear planning documents." action={<button className="button primary" onClick={()=>notify("Report export prepared")}> <Download size={16}/> Export report</button>}/>
    <div className="report-grid">{["Habitation summary","Data readiness report","GIS layer report","20-year forecast","Scenario comparison","Budget summary"].map((x,i)=><div className="report-card" key={x}><div className="report-icon"><FileText size={22}/></div><div><h3>{x}</h3><span>Updated from current demo data</span></div><button className="icon-button" onClick={()=>notify(x+" opened")}><MoreHorizontal size={18}/></button></div>)}</div>
  </div>
}

function Assistant({query,setQuery,rows}) {
  const [messages,setMessages]=useState([{from:"bot",text:"Hello. I can explain the current habitation data and forecast. Try asking about waste after 10 years, a scenario, or capacity."}]);
  const answer = (q) => {
    const lower=q.toLowerCase();
    if(lower.includes("10 years")) return `Using the current demo assumptions, estimated waste in 2036 is about ${rows[10].waste} tonnes/day. This uses the 1.2% population growth input and the displayed per-capita waste assumption.`;
    if(lower.includes("20 years")) return `By 2046, the demo projection reaches about ${rows[20].waste} tonnes/day. This is a transparent demo calculation, not a live simulation-engine result.`;
    if(lower.includes("flood")) return "A flood scenario can be configured with rainfall and collection-capacity changes. Run the scenario screen to compare normal and flood conditions.";
    if(lower.includes("cost") || lower.includes("budget")) return "The budget screen currently shows demo planning figures. Connect the optimization API before treating these as production cost results.";
    return "I can help with 20-year forecasts, waste generation, collection, treatment, disposal, scenarios and budget assumptions.";
  };
  const ask=()=>{if(!query.trim())return; const q=query.trim(); setMessages(m=>[...m,{from:"user",text:q},{from:"bot",text:answer(q)}]); setQuery("")};
  return <div><PageHeader eyebrow="CONVERSATIONAL INTERFACE" title="Ask SWMS" description="Ask questions about the selected habitation and its simulation outputs."/>
    <div className="assistant-layout"><div className="panel chat"><div className="chat-head"><Bot size={20}/><div><b>SWMS Assistant</b><span>Connected to current frontend data</span></div></div><div className="messages">{messages.map((m,i)=><div className={m.from==="bot"?"msg bot":"msg user"} key={i}>{m.text}</div>)}</div><div className="chat-input"><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&ask()} placeholder="Ask: What will waste be after 10 years?"/><button className="button primary" onClick={ask}>Ask</button></div></div><div className="panel"><PanelTitle title="Try asking"/>{["What will the estimated waste be after 10 years?","What happens during a flood?","How much treatment capacity is needed?","What is the 20-year cost?"].map(q=><button className="suggestion" key={q} onClick={()=>setQuery(q)}>{q}<ChevronDown size={15}/></button>)}</div></div>
  </div>
}

createRoot(document.getElementById("root")).render(<App />);
