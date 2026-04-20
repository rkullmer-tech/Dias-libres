import { useState, useMemo, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── SUPABASE ──────────────────────────────────────────────────────────────────
const SB = createClient(
  "https://ecqoamcgzyjiuhuorbmi.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjcW9hbWNnenlqaXVodW9yYm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDk0MDUsImV4cCI6MjA4OTUyNTQwNX0.s2pYVqwVDgOO4isSykA0YBaWHP75cio40eEmGqDYEVo"
);

// ─── FESTIVOS CHILE ───────────────────────────────────────────────────────────
const FESTIVOS = new Set([
  "2025-01-01","2025-04-18","2025-04-19","2025-05-01","2025-05-21",
  "2025-06-20","2025-06-29","2025-07-16","2025-08-15","2025-09-18",
  "2025-09-19","2025-10-12","2025-10-31","2025-11-01","2025-11-16",
  "2025-12-08","2025-12-25",
  "2026-01-01","2026-04-03","2026-04-04","2026-05-01","2026-05-21",
  "2026-06-29","2026-07-16","2026-08-15","2026-09-18","2026-09-19",
]);
const esDom  = s => new Date(s+"T12:00:00").getDay()===0;
const esFest = s => FESTIVOS.has(s);
const esDia  = s => esDom(s)||esFest(s);

// ─── CAMPOS INICIALES (se vuelven estado dinámico en App) ───────────────────
const CAMPOS_INIT = [
  {id:"A",nombre:"Linco",      color:"#0ea5e9"},
  {id:"B",nombre:"Junco",      color:"#10b981"},
  {id:"C",nombre:"JCL",        color:"#f59e0b"},
  {id:"D",nombre:"Las Palomas",color:"#e879f9"},
];
const COLORES = ["#0ea5e9","#10b981","#f59e0b","#e879f9","#f43f5e","#8b5cf6","#14b8a6","#fb923c"];

// ─── USUARIOS ─────────────────────────────────────────────────────────────────
const USUARIOS_INIT = [
  {id:"maestro",nombre:"Administrador",rol:"maestro",campoId:null,pass:"admin123",av:"⬡",orden:null},
  {id:"a1",nombre:"José",   rol:"campo",campoId:"A",pass:"jose",      dias:0,activo:true,av:"JO",orden:1},
  {id:"a2",nombre:"Jorge",  rol:"campo",campoId:"A",pass:"jorge",     dias:0,activo:true,av:"JG",orden:2},
  {id:"a3",nombre:"Pablo",  rol:"campo",campoId:"A",pass:"pablo",     dias:0,activo:true,av:"PB",orden:3},
  {id:"a4",nombre:"Mario",  rol:"campo",campoId:"A",pass:"mario",     dias:0,activo:true,av:"MA",orden:null},
  {id:"b1",nombre:"Jaime P",   rol:"campo",campoId:"B",pass:"jaimep",   dias:0,activo:true,av:"JP",orden:1},
  {id:"b2",nombre:"Jaime E",   rol:"campo",campoId:"B",pass:"jaimee",   dias:0,activo:true,av:"JE",orden:2},
  {id:"b3",nombre:"Alejandro", rol:"campo",campoId:"B",pass:"alejandro",dias:0,activo:true,av:"AL",orden:3},
  {id:"c1",nombre:"Jorge",  rol:"campo",campoId:"C",pass:"jorgec",   dias:0,activo:true,av:"JG",orden:1},
  {id:"c2",nombre:"Máximo", rol:"campo",campoId:"C",pass:"maximo",   dias:0,activo:true,av:"MX",orden:2},
  {id:"c3",nombre:"Felipe", rol:"campo",campoId:"C",pass:"felipe",   dias:0,activo:true,av:"FE",orden:3},
  {id:"d1",nombre:"Gastón", rol:"campo",campoId:"D",pass:"gaston",   dias:0,activo:true,av:"GA",orden:1},
  {id:"d2",nombre:"Adrián", rol:"campo",campoId:"D",pass:"adrian",   dias:0,activo:true,av:"AD",orden:2},
  {id:"d3",nombre:"Juan",   rol:"campo",campoId:"D",pass:"juan",     dias:0,activo:true,av:"JU",orden:3},
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const getHoy  = () => new Date().toISOString().split("T")[0];
const addDays = (s,n) => { const d=new Date(s+"T12:00:00"); d.setDate(d.getDate()+n); return d.toISOString().split("T")[0]; };
const difDias = (a,b) => Math.round((new Date(b+"T12:00:00")-new Date(a+"T12:00:00"))/86400000)+1;
const pad2    = n => String(n).padStart(2,"0");
const MESES   = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MAX_ADL = 3;

// ─── VALIDADOR ────────────────────────────────────────────────────────────────
function validar(sol, usuarios, reservas, bloqs) {
  const u = usuarios.find(x=>x.id===sol.uid);
  if (!u||!u.activo) return {ok:false,msg:"Trabajador no activo"};
  const h = getHoy();
  if (sol.fi<h) return {ok:false,msg:"No se pueden pedir fechas pasadas"};
  if (sol.fi>addDays(h,14)) return {ok:false,msg:"Máximo 2 semanas de anticipación",cod:"ANTICIPACION"};
  const dias = difDias(sol.fi,sol.ff);
  if (dias<=0) return {ok:false,msg:"Fechas inválidas"};
  if (dias>3)  return {ok:false,msg:"Máximo 3 días consecutivos",cod:"CONSECUTIVOS"};
  if (u.dias-dias < -MAX_ADL) return {ok:false,msg:`Límite adelanto: máx ${MAX_ADL} días (saldo: ${u.dias})`,cod:"ADELANTO"};
  for (let i=0;i<dias;i++) {
    const f=addDays(sol.fi,i);
    if (bloqs[u.campoId]?.[f]) return {ok:false,msg:`Fecha ${f} bloqueada`,cod:"BLOQUEADO"};
  }
  const equipo   = usuarios.filter(x=>x.campoId===u.campoId&&x.activo);
  const ausentes = reservas.filter(s=>s.estado==="OK"&&s.uid!==sol.uid&&equipo.some(x=>x.id===s.uid)&&s.fi<=sol.ff&&s.ff>=sol.fi).length;
  const presentes= equipo.length-ausentes-1;
  const minReq   = equipo.length<=3?2:Math.ceil(equipo.length*0.6);
  if (presentes<minReq) return {ok:false,msg:`Deben quedar mínimo ${minReq} presentes`,cod:"COBERTURA"};
  return {ok:true};
}

// ─── ORDEÑA ───────────────────────────────────────────────────────────────────
function calcOrdeña(fecha, campoId, usuarios, reservas) {
  const eq  = usuarios.filter(u=>u.campoId===campoId&&u.activo&&u.orden);
  const aus = new Set(reservas.filter(s=>s.estado==="OK"&&s.fi<=fecha&&s.ff>=fecha&&usuarios.find(u=>u.id===s.uid)?.campoId===campoId).map(s=>s.uid));
  const t1=eq.find(u=>u.orden===1), t2=eq.find(u=>u.orden===2), rep=eq.find(u=>u.orden===3);
  const t1ok=t1&&!aus.has(t1.id), t2ok=t2&&!aus.has(t2.id), repok=rep&&!aus.has(rep.id);
  const act=[t1ok&&t1,t2ok&&t2].filter(Boolean);
  const nec=act.length<2&&repok;
  return {t1:t1?{...t1,aus:!t1ok}:null,t2:t2?{...t2,aus:!t2ok}:null,rep:rep?{...rep,entra:nec,aus:aus.has(rep.id)}:null,nec};
}

// ─── DÍAS ESPECIALES PASADOS ──────────────────────────────────────────────────
function diasEspPasados() {
  const lista=[], h=new Date(), desde=new Date(addDays(getHoy(),-60)+"T12:00:00"), d=new Date(desde);
  while(d<=h){const s=d.toISOString().split("T")[0];if(esDia(s))lista.push(s);d.setDate(d.getDate()+1);}
  return lista;
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS=`
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  html,body,#root{width:100%;min-height:100vh;background:#06090f}
  ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#06090f}::-webkit-scrollbar-thumb{background:#1c2a3a;border-radius:3px}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  @keyframes slideUp{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:translateY(0)}}
  @keyframes toastIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
  @keyframes carga{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
  .fade{animation:fadeUp .3s ease}.trh:hover{background:#111827!important}

  /* ── MÓVIL ── */
  @media(max-width:768px){
    .desk-only{display:none!important}
    .main-wrap{margin-left:0!important;padding:16px 14px 90px!important;width:100%!important}
    .mob-nav{display:flex!important}
    .login-wrap{width:94vw!important;max-width:420px}
    .modal-inner{width:96vw!important;max-width:460px;padding:20px 16px!important;border-radius:16px!important}
    table{font-size:11px}
    .hide-mob{display:none!important}
    .mob-card{margin-bottom:10px;border-radius:14px!important}
    .mob-grid-2{grid-template-columns:1fr!important}
    .mob-grid-4{grid-template-columns:repeat(2,1fr)!important}
    h1{font-size:20px!important}
    .mob-btn{min-height:44px;font-size:14px!important;padding:12px 18px!important}
    .mob-fab{
      position:fixed;bottom:80px;right:16px;z-index:90;
      width:56px;height:56px;border-radius:28px;
      background:linear-gradient(135deg,#0ea5e9,#10b981);
      border:none;color:#fff;font-size:28px;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 4px 20px rgba(14,165,233,.4);cursor:pointer;
    }
    .mob-section-title{font-size:10px!important;padding:10px 14px 6px!important}
    .mob-user-card{padding:14px!important}
    .mob-stat{padding:12px!important}
    input,select{font-size:16px!important;padding:12px!important}
  }
  @media(min-width:769px){
    .mob-nav{display:none!important}
    .mob-fab{display:none!important}
  }
  .mob-nav{
    position:fixed;bottom:0;left:0;right:0;
    background:#090d16;border-top:1px solid #1c2a3a;
    z-index:100;padding:8px 0 env(safe-area-inset-bottom,8px);
    justify-content:space-around;align-items:center;
  }
  .mob-nav-btn{
    display:flex;flex-direction:column;align-items:center;gap:3px;
    background:none;border:none;cursor:pointer;padding:4px 6px;
    font-family:'Syne',sans-serif;font-size:9px;font-weight:700;
    color:#4b5563;min-width:50px;transition:all .15s;border-radius:10px;
    -webkit-tap-highlight-color:transparent;
  }
  .mob-nav-btn.active{color:#0ea5e9;background:#0ea5e918}
  .mob-nav-btn .icon{font-size:20px;line-height:1}
  .mob-nav-btn:active{transform:scale(.92)}
`;

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const S={
  page:{minHeight:"100vh",width:"100%",background:"#06090f",color:"#e2e8f0",fontFamily:"'Syne','Segoe UI',sans-serif",display:"flex"},
  side:{width:220,background:"#090d16",borderRight:"1px solid #161f2e",display:"flex",flexDirection:"column",position:"fixed",inset:"0 auto 0 0",zIndex:50},
  main:{marginLeft:220,flex:1,padding:"28px 32px",minHeight:"100vh",width:"calc(100% - 220px)"},
  card:{background:"#0d1117",border:"1px solid #161f2e",borderRadius:20,padding:"28px"},
  lw:{width:400,animation:"fadeUp .4s ease"},
  nb:{width:"100%",display:"flex",alignItems:"center",padding:"9px 12px",borderRadius:10,border:"none",fontSize:12,marginBottom:2,cursor:"pointer",fontFamily:"'Syne',sans-serif",transition:"all .15s",justifyContent:"space-between"},
  nb2:{background:"#0d1117",border:"1px solid #161f2e",color:"#4b5563",width:30,height:30,borderRadius:8,fontSize:16,cursor:"pointer"},
  lbl:{display:"block",fontSize:9,color:"#4b5563",fontWeight:700,marginBottom:6,letterSpacing:1,textTransform:"uppercase"},
  inp:{width:"100%",background:"#111827",border:"1px solid #1c2a3a",color:"#e2e8f0",padding:"9px 12px",borderRadius:8,fontSize:13,fontFamily:"'Syne',sans-serif"},
  td:{padding:"10px 13px"},
  bp:{background:"linear-gradient(135deg,#0ea5e9,#6366f1)",border:"none",color:"#fff",padding:"10px 22px",borderRadius:10,fontWeight:700,fontSize:13,fontFamily:"'Syne',sans-serif",cursor:"pointer"},
  bs:{background:"transparent",border:"1px solid #1c2a3a",color:"#4b5563",padding:"9px 20px",borderRadius:10,fontWeight:700,fontSize:13,fontFamily:"'Syne',sans-serif",cursor:"pointer"},
  bf:{width:"100%",padding:"12px",background:"linear-gradient(135deg,#0ea5e9,#10b981)",border:"none",borderRadius:12,color:"#fff",fontWeight:700,fontSize:14,fontFamily:"'Syne',sans-serif",cursor:"pointer"},
};
const ba=(c,bg,b)=>({background:bg,border:`1px solid ${b}`,color:c,fontSize:11,padding:"4px 10px",borderRadius:6,fontWeight:700,cursor:"pointer"});

// ─── COMPONENTES ─────────────────────────────────────────────────────────────
function Vaca({size=16}){return <span style={{fontSize:size,lineHeight:1,flexShrink:0}}>🐄</span>;}
function Av({av,color,sz}){return <div style={{width:sz,height:sz,borderRadius:sz/3,background:`${color}22`,border:`1px solid ${color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:sz*.32,fontWeight:700,color,flexShrink:0,fontFamily:"'JetBrains Mono',monospace"}}>{av}</div>;}
function Th({children}){return <th style={{padding:"9px 13px",textAlign:"left",fontSize:9,color:"#374151",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>{children}</th>;}
function Chip({label,color}){return <span style={{background:`${color}22`,border:`1px solid ${color}44`,color,fontSize:9,padding:"2px 8px",borderRadius:20,fontWeight:700}}>{label}</span>;}
function SDot({activo}){return <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:6,height:6,borderRadius:"50%",background:activo?"#4ade80":"#ef4444"}}/><span style={{fontSize:8,color:activo?"#4ade80":"#ef4444",fontWeight:700}}>{activo?"ACTIVO":"AUSENTE"}</span></div>;}
function Badge({estado,cod,sm}){
  const m={OK:{bg:"#0d3320",c:"#4ade80",b:"#1a6640"},Bloqueada:{bg:"#2a1500",c:"#fb923c",b:"#5a3000"},Cancelada:{bg:"#3a1010",c:"#f87171",b:"#6a2020"}}[estado]||{bg:"#111",c:"#aaa",b:"#333"};
  return <div><span style={{background:m.bg,color:m.c,border:`1px solid ${m.b}`,padding:sm?"1px 7px":"3px 10px",borderRadius:20,fontSize:sm?8:10,fontWeight:700}}>{estado}</span>{cod&&!sm&&<div style={{fontSize:8,color:"#fb923c",marginTop:2}}>🔒{cod}</div>}</div>;
}
function PTitle({title,sub,inline}){return <div style={{marginBottom:inline?0:24}}><h1 style={{fontSize:24,fontWeight:800,color:"#f9fafb",letterSpacing:-0.5}}>{title}</h1><p style={{color:"#374151",fontSize:11,marginTop:3}}>{sub}</p></div>;}
function Modal({children,onClose}){return <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300}}><div onClick={e=>e.stopPropagation()} className="modal-inner" style={{background:"#0d1117",border:"1px solid #1c2a3a",borderRadius:20,padding:"24px 28px",width:460,maxWidth:"95vw",animation:"slideUp .25s ease"}}>{children}</div></div>;}
function RolTag({orden}){
  if(!orden) return null;
  const m={1:{c:"#fbbf24",l:"Titular 1"},2:{c:"#fbbf24",l:"Titular 2"},3:{c:"#60b4ff",l:"Reemplazante"}}[orden];
  return <span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:9,color:m.c,fontWeight:700}}><Vaca size={11}/>{m.l}</span>;
}

// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [session, setSession]   = useState(null);
  const [lid,     setLid]       = useState("");
  const [lpw,     setLpw]       = useState("");
  const [lerr,    setLerr]      = useState("");
  const [campos,  setCampos]    = useState([]);
  const [users,   setUsers]     = useState([]);
  const [res,     setRes]       = useState([]);
  const [bloqs,   setBloqs]     = useState({});
  const [acred,   setAcred]     = useState({});
  const [tab,     setTab]       = useState("cal");
  const [modal,   setModal]     = useState(null);
  const [form,    setForm]      = useState({});
  const [mform,   setMform]     = useState({campoId:"",fecha:"",uids:[]});
  const [toast,   setToast]     = useState(null);
  const [mes,     setMes]       = useState(()=>{const d=new Date();return{y:d.getFullYear(),m:d.getMonth()};});
  const [selDia,  setSelDia]    = useState(null);
  const [cargando,setCargando]  = useState(true);
  const [errorDB, setErrorDB]   = useState(null);

  const tip = (msg,tipo="ok") => {setToast({msg,tipo});setTimeout(()=>setToast(null),3500);};

  // ── CARGAR DATOS DESDE SUPABASE ──────────────────────────────────────────
  const cargarTodo = useCallback(async () => {
    try {
      setCargando(true);
      const [rCampos, rUsers, rRes, rBloqs, rAcred] = await Promise.all([
        SB.from("campos").select("*").order("creado_en"),
        SB.from("usuarios").select("*").order("creado_en"),
        SB.from("reservas").select("*").order("creado_en", {ascending:false}),
        SB.from("bloqueos").select("*"),
        SB.from("acreditaciones").select("*"),
      ]);
      if (rCampos.error) throw rCampos.error;
      if (rUsers.error)  throw rUsers.error;
      if (rRes.error)    throw rRes.error;

      // Mapear campos
      setCampos(rCampos.data.map(c=>({id:c.id,nombre:c.nombre,color:c.color})));

      // Mapear usuarios
      // Auto-desactivar si licencia activa, reactivar si licencia venció
      const hoyDate = getHoy();
      const usuariosMapeados = rUsers.data.map(u=>({
        id:u.id, nombre:u.nombre, rol:u.rol, campoId:u.campo_id,
        pass:u.pass, av:u.av||u.nombre.substring(0,2).toUpperCase(),
        orden:u.orden, dias:u.dias,
        activo: u.licencia_fin && u.licencia_fin >= hoyDate && u.licencia_inicio && u.licencia_inicio <= hoyDate ? false : u.activo,
        licenciaInicio:u.licencia_inicio||null,
        licenciaFin:u.licencia_fin||null,
        motivoInactivo:u.motivo_inactivo||null,
      }));
      // Actualizar en BD los que reactivaron automáticamente
      for(const u of usuariosMapeados){
        const orig = rUsers.data.find(x=>x.id===u.id);
        if(orig && orig.licencia_fin && orig.licencia_fin < hoyDate && !orig.activo){
          await SB.from("usuarios").update({activo:true,licencia_inicio:null,licencia_fin:null,motivo_inactivo:null}).eq("id",u.id);
        }
      }
      setUsers(usuariosMapeados);

      // Mapear reservas
      setRes(rRes.data.map(r=>({
        id:r.id, uid:r.uid, fi:r.fi, ff:r.ff, dias:r.dias,
        fecha:r.fecha, estado:r.estado, bloqueo:r.bloqueo, adminForced:r.admin_forced
      })));

      // Mapear bloqueos → { campoId: { fecha: true } }
      const bloqObj = {};
      (rBloqs.data||[]).forEach(b=>{
        if(!bloqObj[b.campo_id]) bloqObj[b.campo_id]={};
        bloqObj[b.campo_id][b.fecha]=true;
      });
      setBloqs(bloqObj);

      // Mapear acreditaciones → { campoId: { fecha: { ok, exc, fp } } }
      const acredObj = {};
      (rAcred.data||[]).forEach(a=>{
        if(!acredObj[a.campo_id]) acredObj[a.campo_id]={};
        acredObj[a.campo_id][a.fecha]={ok:true, exc:a.excepciones||[], fp:a.fecha_proceso, manual:a.manual, uids:a.uids_manual};
      });
      setAcred(acredObj);

      setErrorDB(null);
    } catch(e) {
      console.error("Error cargando datos:", e);
      setErrorDB("Error conectando con la base de datos. Verifica tu conexión.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarTodo(); }, [cargarTodo]);
  const esM = session?.rol==="maestro";
  const miC = campos.find(c=>c.id===session?.campoId);
  const miEq= useMemo(()=>session?.campoId?users.filter(u=>u.campoId===session.campoId):[],[session,users]);
  const acc = esM?"#0ea5e9":miC?.color||"#0ea5e9";

  const diasEsp = useMemo(()=>diasEspPasados(),[]);
  const pends   = useMemo(()=>{
    const h=getHoy(),r={};
    campos.forEach(c=>{r[c.id]=diasEsp.filter(f=>addDays(f,1)<=h&&!acred[c.id]?.[f]);});
    return r;
  },[diasEsp,acred]);
  const totPend = Object.values(pends).reduce((a,v)=>a+v.length,0);

  const doLogin=()=>{
    // Admin: nombre "administrador" o "admin", pass admin123
    if(lid.trim().toLowerCase()==="administrador"||lid.trim().toLowerCase()==="admin"){
      if(lpw===users.find(u=>u.id==="maestro")?.pass||lpw==="admin123"){
        setSession(users.find(u=>u.id==="maestro")||{id:"maestro",nombre:"Administrador",rol:"maestro",campoId:null,pass:"admin123",av:"⬡",orden:null});
        setTab("overview");setLerr("");return;
      } else {setLerr("Contraseña incorrecta");return;}
    }
    // Trabajador: buscar por nombre (sin tildes, minúsculas) y contraseña
    const nombreNorm = s=>s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
    const u=users.find(x=>x.rol==="campo"&&nombreNorm(x.nombre)===nombreNorm(lid.trim())&&x.pass===lpw.trim());
    if(!u){setLerr("Nombre o contraseña incorrectos");return;}
    setSession(u);setTab("cal");setLerr("");
  };

  const crearRes=async()=>{
    const{fi,ff}=form;
    if(!fi||!ff){tip("Seleccione fechas","err");return;}
    const dias=difDias(fi,ff);
    const base={id:Date.now(),uid:session.id,fi,ff,dias,fecha:getHoy(),bloqueo:null};
    const v=validar(base,users,res,bloqs);
    if(!v.ok){
      await SB.from("reservas").insert({uid:session.id,fi,ff,dias,fecha:getHoy(),estado:"Bloqueada",bloqueo:v.cod||"RESTRICCION"});
      tip(v.msg,"warn");
    } else {
      await SB.from("reservas").insert({uid:session.id,fi,ff,dias,fecha:getHoy(),estado:"OK"});
      await SB.from("usuarios").update({dias:users.find(u=>u.id===session.id).dias-dias}).eq("id",session.id);
      tip(`✓ Reservado ${fi}${dias>1?" → "+ff:""}`, "ok");
    }
    await cargarTodo();
    setModal(null);setForm({});
  };

  const cancelRes=async(id)=>{
    const s=res.find(x=>x.id===id);
    if(!s||s.estado!=="OK") return;
    const u=users.find(x=>x.id===s.uid);
    await SB.from("reservas").update({estado:"Cancelada"}).eq("id",id);
    await SB.from("usuarios").update({dias:Math.min((u?.dias||0)+s.dias,30)}).eq("id",s.uid);
    await cargarTodo();
    tip("Reserva cancelada · saldo devuelto","warn");
  };

  const eliminarRes=async(id)=>{
    await SB.from("reservas").delete().eq("id",id);
    await cargarTodo();
    tip("Registro eliminado","ok");
  };

  const procAcred=async(campoId,fecha,excIds=[])=>{
    const afectados=users.filter(u=>u.campoId===campoId&&u.activo&&!excIds.includes(u.id));
    for(const u of afectados){
      await SB.from("usuarios").update({dias:Math.min(u.dias+1,30)}).eq("id",u.id);
    }
    await SB.from("acreditaciones").upsert({campo_id:campoId,fecha,excepciones:excIds,manual:false,fecha_proceso:getHoy()},{onConflict:"campo_id,fecha"});
    await cargarTodo();
  };
  const procTodos=async(cid)=>{
    const p=pends[cid]||[];
    if(!p.length){tip("Sin pendientes","warn");return;}
    for(const f of p) await procAcred(cid,f,[]);
    tip(`${p.length} día(s) acreditado(s) en ${campos.find(c=>c.id===cid)?.nombre}`,"ok");
  };
  const revertAcred=async(cid,fecha)=>{
    const r=acred[cid]?.[fecha];if(!r)return;
    const eq=users.filter(u=>u.campoId===cid&&u.activo);
    const af=r.uids||eq.filter(u=>!r.exc?.includes(u.id)).map(u=>u.id);
    for(const uid of af){
      const u=users.find(x=>x.id===uid);
      if(u) await SB.from("usuarios").update({dias:Math.max(u.dias-1,-MAX_ADL)}).eq("id",uid);
    }
    await SB.from("acreditaciones").delete().eq("campo_id",cid).eq("fecha",fecha);
    await cargarTodo();
    tip("Acreditación revertida","warn");
  };
  const acredMan=async()=>{
    const{campoId,fecha,uids}=mform;
    if(!campoId||!fecha){tip("Complete los campos","err");return;}
    const todos=users.filter(u=>u.campoId===campoId&&u.activo).map(u=>u.id);
    const recep=uids.length>0?uids:todos;
    for(const uid of recep){
      const u=users.find(x=>x.id===uid);
      if(u) await SB.from("usuarios").update({dias:Math.min(u.dias+1,30)}).eq("id",uid);
    }
    await SB.from("acreditaciones").upsert({campo_id:campoId,fecha,excepciones:[],manual:true,uids_manual:recep,fecha_proceso:getHoy()},{onConflict:"campo_id,fecha"});
    await cargarTodo();
    tip(`+1 día a ${recep.length} trabajador(es)`,"ok");
    setMform({campoId:"",fecha:"",uids:[]});setModal(null);
  };
  const ajustar=async()=>{
    const{uid,cantidad,op}=form;
    if(!uid||!cantidad){tip("Complete los campos","err");return;}
    const u=users.find(x=>x.id===uid);
    if(!u){tip("Trabajador no encontrado","err");return;}
    const nuevo=op==="+"?u.dias+(+cantidad):u.dias-(+cantidad);
    await SB.from("usuarios").update({dias:nuevo}).eq("id",uid);
    await cargarTodo();
    tip("Saldo actualizado","ok");setModal(null);setForm({});
  };

  const reservaAdmin=async()=>{
    const{uid,fi,ff}=form;
    if(!uid||!fi||!ff){tip("Complete todos los campos","err");return;}
    const dias=difDias(fi,ff);
    if(dias<=0){tip("Fechas inválidas","err");return;}
    await SB.from("reservas").insert({uid,fi,ff,dias,fecha:getHoy(),estado:"OK",admin_forced:true});
    await cargarTodo();
    tip("Reservado por admin sin restricciones","ok");
    setModal(null);setForm({});
  };
  const togBloq=async(cid,f)=>{
    if(bloqs[cid]?.[f]){
      await SB.from("bloqueos").delete().eq("campo_id",cid).eq("fecha",f);
    } else {
      await SB.from("bloqueos").insert({campo_id:cid,fecha:f});
    }
    await cargarTodo();
  };

  const calDias=useMemo(()=>{
    const{y,m}=mes,prim=new Date(y,m,1).getDay(),tot=new Date(y,m+1,0).getDate(),d=[];
    for(let i=0;i<(prim===0?6:prim-1);i++)d.push(null);
    for(let x=1;x<=tot;x++)d.push(`${y}-${pad2(m+1)}-${pad2(x)}`);
    return d;
  },[mes]);

  const ausEnDia=(fecha)=>{
    const scope=esM?users:miEq;
    return res.filter(s=>s.estado==="OK"&&s.fi<=fecha&&s.ff>=fecha&&scope.some(u=>u.id===s.uid)).map(s=>users.find(u=>u.id===s.uid)).filter(Boolean);
  };

  // ── PANTALLA DE CARGA ──
  if(cargando) return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center",flexDirection:"column",gap:20}}>
      <style>{CSS}</style>
      <div style={{fontSize:11,letterSpacing:4,color:"#374151",fontWeight:700}}>SISTEMA FAENA</div>
      <div style={{fontSize:36,fontWeight:800,color:"#f9fafb",letterSpacing:-1}}>DÍAS LIBRES</div>
      <div style={{width:200,height:3,background:"#161f2e",borderRadius:2,overflow:"hidden",marginTop:8}}>
        <div style={{width:"60%",height:"100%",background:"linear-gradient(90deg,#0ea5e9,#10b981)",borderRadius:2,animation:"carga 1.2s ease-in-out infinite"}}/>
      </div>
      <div style={{fontSize:11,color:"#374151",marginTop:4}}>Conectando con la base de datos…</div>
      {errorDB&&<div style={{color:"#f87171",fontSize:12,marginTop:8,background:"#3a1010",padding:"10px 16px",borderRadius:8,border:"1px solid #6a2020"}}>{errorDB}</div>}
      <style>{`@keyframes carga{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
    </div>
  );

  // ── LOGIN ──
  if(!session) return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <style>{CSS}</style>
      <div className="login-wrap" style={{width:380,animation:"fadeUp .4s ease"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:28,fontWeight:800,color:"#f9fafb",letterSpacing:1,lineHeight:1.2}}>DIAS CAMPO VERDE</div>
          <div style={{width:50,height:3,background:"linear-gradient(90deg,#0ea5e9,#10b981)",margin:"14px auto 0",borderRadius:2}}/>
        </div>
        <div style={S.card}>
          <div style={{marginBottom:16}}>
            <label style={S.lbl}>Usuario</label>
            <input
              value={lid}
              onChange={e=>setLid(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&doLogin()}
              style={S.inp}
              placeholder="Escribe tu nombre"
              autoComplete="username"
            />
          </div>
          <div style={{marginBottom:20}}>
            <label style={S.lbl}>Contraseña</label>
            <input
              type="password"
              value={lpw}
              onChange={e=>setLpw(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&doLogin()}
              style={S.inp}
              placeholder="••••••"
              autoComplete="current-password"
            />
          </div>
          {lerr&&<div style={{color:"#f87171",fontSize:12,marginBottom:12,textAlign:"center",background:"#3a1010",border:"1px solid #6a2020",borderRadius:8,padding:"8px"}}>{lerr}</div>}
          <button onClick={doLogin} style={{...S.bf,minHeight:50,fontSize:16}} className="mob-btn">Ingresar →</button>
        </div>
      </div>
    </div>
  );

  const navItems=esM
    ?[{id:"overview",icon:"◈",label:"Resumen"},{id:"reservas",icon:"◉",label:"Reservas"},{id:"cal",icon:"◬",label:"Calendario"},{id:"campos",icon:"⬡",label:"Campos"},{id:"usuarios",icon:"◎",label:"Usuarios"},{id:"gcampos",icon:"◼",label:"Gestión Campos"},{id:"acreditar",icon:"★",label:"Acreditar",badge:totPend},{id:"bloqs",icon:"⬢",label:"Bloqueos"}]
    :[{id:"cal",icon:"◬",label:"Mi Calendario"},{id:"equipo",icon:"◉",label:"Mi Equipo"},{id:"misres",icon:"◈",label:"Mis Reservas"}];

  return (
    <div style={S.page}>
      <style>{CSS}</style>

      {/* SIDEBAR */}
      <aside className="desk-only" style={S.side}>
        <div style={{padding:"20px 14px 14px",borderBottom:"1px solid #161f2e"}}>
          <div style={{fontSize:9,letterSpacing:4,color:"#374151",fontWeight:700}}>SISTEMA</div>
          <div style={{fontSize:16,fontWeight:800,color:"#f9fafb",letterSpacing:0}}>DIAS CAMPO VERDE</div>
          {miC&&<div style={{marginTop:7,display:"inline-flex",alignItems:"center",gap:5,background:`${miC.color}18`,border:`1px solid ${miC.color}33`,borderRadius:7,padding:"3px 9px"}}><div style={{width:5,height:5,borderRadius:"50%",background:miC.color}}/><span style={{fontSize:11,color:miC.color,fontWeight:700}}>{miC.nombre}</span></div>}
          {esM&&<div style={{marginTop:7,display:"inline-flex",alignItems:"center",gap:5,background:"#1c2a1c",border:"1px solid #2a4a2a",borderRadius:7,padding:"3px 9px"}}><span style={{fontSize:11,color:"#4ade80",fontWeight:700}}>⬡ Admin</span></div>}
        </div>
        <div style={{padding:"10px 14px",borderBottom:"1px solid #161f2e",display:"flex",alignItems:"center",gap:9}}>
          <Av av={session.av} color={acc} sz={34}/>
          <div><div style={{fontSize:12,fontWeight:700,color:"#f9fafb"}}>{session.nombre}</div>{!esM&&<div style={{fontSize:9,color:"#374151",marginTop:1}}>Turno Día</div>}</div>
        </div>
        {!esM&&(()=>{
          const u=users.find(x=>x.id===session.id);
          const saldo=u?.dias??0,ad=saldo<0;
          return (
            <div style={{padding:"9px 14px",borderBottom:"1px solid #161f2e"}}>
              <div style={{background:ad?"#2a1500":`${acc}18`,border:`1px solid ${ad?"#5a3000":acc+"33"}`,borderRadius:9,padding:"9px 12px",textAlign:"center"}}>
                <div style={{fontSize:26,fontWeight:800,color:ad?"#fb923c":acc,lineHeight:1}}>{saldo}</div>
                <div style={{fontSize:8,color:"#4b5563",marginTop:2}}>{ad?"DÍAS ADELANTADOS":"DÍAS LIBRES"}</div>
                {ad&&<div style={{fontSize:8,color:"#fb923c",marginTop:2}}>{Math.abs(saldo)}/{MAX_ADL} máx.</div>}
              </div>
              {session.orden&&(
                <div style={{marginTop:7,textAlign:"center"}}>
                  {session.orden===1&&<div style={{fontSize:10,color:"#fbbf24",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:4}}><Vaca size={13}/>Titular 1</div>}
                  {session.orden===2&&<div style={{fontSize:10,color:"#fbbf24",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:4}}><Vaca size={13}/>Titular 2</div>}
                  {session.orden===3&&<div style={{fontSize:10,color:"#60b4ff",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:4}}><Vaca size={13}/>Reemplazante</div>}
                </div>
              )}
            </div>
          );
        })()}
        <nav style={{flex:1,padding:"9px 7px"}}>
          {navItems.map(n=>(
            <button key={n.id} onClick={()=>setTab(n.id)} style={{...S.nb,background:tab===n.id?`${acc}18`:"transparent",color:tab===n.id?acc:"#4b5563",fontWeight:tab===n.id?700:500,borderLeft:tab===n.id?`3px solid ${acc}`:"3px solid transparent"}}>
              <span style={{display:"flex",alignItems:"center",gap:7}}><span>{n.icon}</span>{n.label}</span>
              {n.badge>0&&<span style={{background:"#f59e0b",color:"#000",fontSize:9,fontWeight:800,borderRadius:20,padding:"1px 6px"}}>{n.badge}</span>}
            </button>
          ))}
        </nav>
        <div style={{padding:"9px 11px",borderTop:"1px solid #161f2e",display:"flex",flexDirection:"column",gap:7}}>
          {!esM&&<button onClick={()=>{setForm({});setModal("nueva");}} style={{...S.bf,background:`linear-gradient(135deg,${acc},${acc}99)`,fontSize:12,padding:"8px"}}>+ Reservar Día Libre</button>}
          {esM&&<button onClick={()=>{setForm({});setModal("resAdmin");}} style={{...S.bf,background:"linear-gradient(135deg,#059669,#047857)",fontSize:11,padding:"8px"}}>+ Reservar (sin restricciones)</button>}
          {esM&&<button onClick={()=>{setForm({paso:1,respuesta:"",nuevaClave:"",confirmar:""});setModal("cambiarClaveAdmin");}} style={{...S.bs,fontSize:11,padding:"6px",color:"#60b4ff",borderColor:"#1c3a5a"}}>🔑 Cambiar mi clave</button>}
          <button onClick={()=>setSession(null)} style={{...S.bs,fontSize:11,padding:"6px"}}>Salir</button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="main-wrap" style={S.main}>

        {/* OVERVIEW */}
        {tab==="overview"&&esM&&(
          <div className="fade">
            <PTitle title="RESUMEN GENERAL" sub="Todos los campos"/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:22}}>
              {campos.map(c=>{
                const tw=users.filter(u=>u.campoId===c.id);
                return (
                  <div key={c.id} style={{background:"#0d1117",border:`1px solid ${c.color}33`,borderRadius:14,padding:"16px",position:"relative",overflow:"hidden"}}>
                    <div style={{position:"absolute",top:0,right:0,width:55,height:55,borderRadius:"0 14px 0 55px",background:`${c.color}08`}}/>
                    <div style={{fontSize:9,fontWeight:700,color:c.color,letterSpacing:2,marginBottom:7}}>{c.nombre}</div>
                    <div style={{fontSize:28,fontWeight:800,color:"#f9fafb",lineHeight:1}}>{tw.filter(u=>u.activo).length}</div>
                    <div style={{fontSize:8,color:"#4b5563",marginTop:2}}>activos / {tw.length}</div>
                    <div style={{marginTop:9,display:"flex",gap:5,flexWrap:"wrap"}}>
                      <Chip label={`${tw.reduce((a,u)=>a+Math.max(u.dias,0),0)} días`} color={c.color}/>
                      {(pends[c.id]?.length||0)>0&&<Chip label={`${pends[c.id].length} pend.`} color="#f59e0b"/>}
                    </div>
                  </div>
                );
              })}
            </div>
            {campos.map(c=>(
              <div key={c.id} style={{background:"#0d1117",border:`1px solid ${c.color}22`,borderRadius:12,marginBottom:12,overflow:"hidden"}}>
                <div style={{padding:"11px 16px",borderBottom:`1px solid ${c.color}22`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontWeight:700,color:c.color,fontSize:11,letterSpacing:1}}>{c.nombre}</span>
                  <button onClick={()=>{setForm({campoId:c.id,op:"+"});setModal("ajustar");}} style={{background:`${c.color}18`,border:`1px solid ${c.color}44`,color:c.color,fontSize:10,padding:"3px 10px",borderRadius:7,fontWeight:700,cursor:"pointer"}}>Ajustar</button>
                </div>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr style={{borderBottom:"1px solid #161f2e"}}>{["Trabajador","Ordeña","Estado","Días"].map(h=><Th key={h}>{h}</Th>)}</tr></thead>
                  <tbody>{users.filter(u=>u.campoId===c.id).map(u=>(
                    <tr key={u.id} className="trh" style={{borderBottom:"1px solid #090d14"}}>
                      <td style={S.td}><div style={{display:"flex",alignItems:"center",gap:7}}><Av av={u.av} color={c.color} sz={24}/><span style={{fontSize:12,color:"#e2e8f0",fontWeight:600}}>{u.nombre}</span></div></td>
                      <td style={S.td}><RolTag orden={u.orden}/></td>
                      <td style={S.td}><SDot activo={u.activo}/></td>
                      <td style={S.td}><span style={{fontSize:20,fontWeight:800,color:u.dias<0?"#fb923c":c.color,fontFamily:"'JetBrains Mono',monospace"}}>{u.dias}</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {/* RESERVAS */}
        {tab==="reservas"&&esM&&(
          <div className="fade">
            <PTitle title="RESERVAS" sub="Historial global · Solo el admin puede cancelar"/>
            {campos.map(c=>{
              const rc=res.filter(s=>users.find(u=>u.id===s.uid)?.campoId===c.id);
              return (
                <div key={c.id} style={{marginBottom:18}}>
                  <div style={{fontSize:9,fontWeight:700,color:c.color,letterSpacing:2,marginBottom:7}}>{c.nombre} · {rc.length}</div>
                  <div style={{background:"#0d1117",border:`1px solid ${c.color}22`,borderRadius:12,overflow:"hidden"}}>
                    <table style={{width:"100%",borderCollapse:"collapse"}}>
                      <thead><tr style={{borderBottom:"1px solid #161f2e"}}>{["Trabajador","Período","Días","Fecha","Estado","Acción"].map(h=><Th key={h}>{h}</Th>)}</tr></thead>
                      <tbody>{rc.length===0
                        ?<tr><td colSpan={6} style={{padding:18,textAlign:"center",color:"#374151",fontSize:11}}>Sin reservas</td></tr>
                        :rc.map(s=>{
                          const u=users.find(x=>x.id===s.uid);
                          return (
                            <tr key={s.id} className="trh" style={{borderBottom:"1px solid #090d14"}}>
                              <td style={S.td}><div style={{display:"flex",alignItems:"center",gap:7}}><Av av={u?.av} color={c.color} sz={22}/><span style={{fontSize:11,color:"#e2e8f0"}}>{u?.nombre}</span></div></td>
                              <td style={{...S.td,fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:"#4b5563"}}>{s.fi} → {s.ff}</td>
                              <td style={S.td}><span style={{fontSize:17,fontWeight:800,color:"#94a3b8",fontFamily:"'JetBrains Mono',monospace"}}>{s.dias}</span></td>
                              <td style={{...S.td,fontSize:10,color:"#374151"}}>{s.fecha}</td>
                              <td style={S.td}><Badge estado={s.estado} cod={s.bloqueo}/></td>
                              <td style={S.td}>
                                <div style={{display:"flex",gap:5}}>
                                  {s.estado==="OK"&&s.ff>=getHoy()&&<button onClick={()=>cancelRes(s.id)} style={ba("#f87171","#3a1010","#6a2020")}>Cancelar</button>}
                                  {(s.estado==="Cancelada"||s.estado==="Bloqueada"||(s.estado==="OK"&&s.ff<getHoy()))&&(
                                    <button onClick={async()=>{if(window.confirm("¿Eliminar este registro?"))await eliminarRes(s.id);}} style={ba("#94a3b8","#1a1a2e","#2a2a3e")}>🗑</button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      }</tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CAMPOS */}
        {tab==="campos"&&esM&&(
          <div className="fade">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
              <PTitle title="CAMPOS" sub="Roles de ordeña · Saldos" inline/>
              <button onClick={()=>{setForm({op:"+"});setModal("ajustar");}} style={{...S.bp,background:"linear-gradient(135deg,#7c3aed,#6d28d9)"}}>Ajustar Días</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:16}}>
              {campos.map(c=>(
                <div key={c.id} style={{background:"#0d1117",border:`1px solid ${c.color}33`,borderRadius:16}}>
                  <div style={{padding:"13px 16px",borderBottom:`1px solid ${c.color}22`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{fontSize:12,fontWeight:700,color:c.color,letterSpacing:1}}>{c.nombre}</div>
                    <div style={{fontSize:20,fontWeight:800,color:c.color}}>{users.filter(u=>u.campoId===c.id&&u.activo).length}</div>
                  </div>
                  {users.filter(u=>u.campoId===c.id).map(u=>(
                    <div key={u.id} style={{padding:"10px 16px",borderBottom:"1px solid #090d14",display:"flex",alignItems:"center",gap:9,opacity:u.activo?1:0.5}}>
                      <Av av={u.av} color={c.color} sz={30}/>
                      <div style={{flex:1}}><div style={{fontSize:12,fontWeight:700,color:"#e2e8f0"}}>{u.nombre}</div><RolTag orden={u.orden}/></div>
                      <span style={{fontSize:20,fontWeight:800,color:u.dias<0?"#fb923c":c.color,fontFamily:"'JetBrains Mono',monospace"}}>{u.dias}</span>
                      <SDot activo={u.activo}/>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* USUARIOS — gestión completa */}
        {tab==="usuarios"&&esM&&(
          <div className="fade">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
              <PTitle title="GESTIÓN DE USUARIOS" sub="Editar nombre · Cambiar clave · Reasignar campo · Cambiar rol de ordeña · Agregar trabajador" inline/>
              <button onClick={()=>{setForm({modo:"nuevo",campoId:"",nombre:"",pass:"",orden:null,activo:true});setModal("editUser");}} style={{...S.bp,background:"linear-gradient(135deg,#059669,#047857)"}}>+ Agregar Trabajador</button>
            </div>
            {campos.map(c=>{
              const tw=users.filter(u=>u.campoId===c.id);
              return (
                <div key={c.id} style={{background:"#0d1117",border:`1px solid ${c.color}33`,borderRadius:16,marginBottom:16,overflow:"hidden"}}>
                  <div style={{padding:"13px 18px",borderBottom:`1px solid ${c.color}22`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{fontSize:12,fontWeight:700,color:c.color,letterSpacing:1}}>{c.nombre} · {tw.filter(u=>u.activo).length} activos</div>
                    <button onClick={()=>{setForm({modo:"nuevo",campoId:c.id,nombre:"",pass:"",orden:null,activo:true});setModal("editUser");}} style={{background:`${c.color}18`,border:`1px solid ${c.color}44`,color:c.color,fontSize:10,padding:"4px 10px",borderRadius:7,fontWeight:700,cursor:"pointer"}}>+ Agregar</button>
                  </div>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr style={{borderBottom:"1px solid #161f2e"}}>
                      {["Trabajador","Campo","Rol Ordeña","Contraseña","Estado","Días","Editar"].map(h=><Th key={h}>{h}</Th>)}
                    </tr></thead>
                    <tbody>{tw.map(u=>(
                      <tr key={u.id} className="trh" style={{borderBottom:"1px solid #090d14",opacity:u.activo?1:0.55}}>
                        <td style={S.td}><div style={{display:"flex",alignItems:"center",gap:8}}><Av av={u.av||u.nombre.substring(0,2).toUpperCase()} color={c.color} sz={30}/><div><div style={{fontSize:12,color:"#f9fafb",fontWeight:700}}>{u.nombre}</div><div style={{fontSize:9,color:"#374151"}}>ID: {u.id}</div></div></div></td>
                        <td style={S.td}><span style={{fontSize:11,color:c.color,fontWeight:700}}>{c.nombre}</span></td>
                        <td style={S.td}><RolTag orden={u.orden}/>{!u.orden&&<span style={{fontSize:9,color:"#374151"}}>Sin rol</span>}</td>
                        <td style={{...S.td,fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"#4b5563"}}>{u.pass}</td>
                        <td style={S.td}><SDot activo={u.activo}/></td>
                        <td style={S.td}><span style={{fontSize:16,fontWeight:800,color:u.dias<0?"#fb923c":c.color,fontFamily:"'JetBrains Mono',monospace"}}>{u.dias}</span></td>
                        <td style={S.td}>
                          <button onClick={()=>{setForm({modo:"editar",uid:u.id,nombre:u.nombre,pass:u.pass,campoId:u.campoId,orden:u.orden,activo:u.activo,licenciaInicio:u.licenciaInicio||"",licenciaFin:u.licenciaFin||"",motivoInactivo:u.motivoInactivo||""});setModal("editUser");}}
                            style={{background:"#1a2a3a",border:"1px solid #1c3a5a",color:"#60b4ff",fontSize:11,padding:"4px 10px",borderRadius:6,fontWeight:700,cursor:"pointer"}}>✎ Editar</button>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}

        {/* GESTIÓN DE CAMPOS */}
        {tab==="gcampos"&&esM&&(
          <div className="fade">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
              <PTitle title="GESTIÓN DE CAMPOS" sub="Crear nuevos campos · Editar nombre · Eliminar" inline/>
              <button onClick={()=>{setForm({modo:"nuevoCampo",nombre:"",color:COLORES[campos.length%COLORES.length]});setModal("editCampo");}} style={{...S.bp,background:"linear-gradient(135deg,#059669,#047857)"}}>+ Nuevo Campo</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:16}}>
              {campos.map((c,idx)=>(
                <div key={c.id} style={{background:"#0d1117",border:`1px solid ${c.color}33`,borderRadius:16,overflow:"hidden"}}>
                  <div style={{padding:"14px 18px",borderBottom:`1px solid ${c.color}22`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:12,height:12,borderRadius:"50%",background:c.color,flexShrink:0}}/>
                      <div>
                        <div style={{fontSize:14,fontWeight:800,color:c.color,letterSpacing:0.5}}>{c.nombre}</div>
                        <div style={{fontSize:9,color:"#374151",marginTop:1}}>{users.filter(u=>u.campoId===c.id&&u.activo).length} trabajadores activos</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:7}}>
                      <button onClick={()=>{setForm({modo:"editCampo",cid:c.id,nombre:c.nombre,color:c.color});setModal("editCampo");}} style={{background:`${c.color}18`,border:`1px solid ${c.color}44`,color:c.color,fontSize:10,padding:"4px 10px",borderRadius:7,fontWeight:700,cursor:"pointer"}}>✎ Editar</button>
                    </div>
                  </div>
                  {/* Trabajadores del campo */}
                  <div style={{padding:"10px 16px"}}>
                    {users.filter(u=>u.campoId===c.id).length===0
                      ?<div style={{fontSize:11,color:"#374151",padding:"8px 0"}}>Sin trabajadores asignados</div>
                      :users.filter(u=>u.campoId===c.id).map(u=>(
                        <div key={u.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7,opacity:u.activo?1:0.5}}>
                          <Av av={u.av} color={c.color} sz={26}/>
                          <div style={{flex:1}}>
                            <div style={{fontSize:11,fontWeight:700,color:"#e2e8f0"}}>{u.nombre}</div>
                            <div style={{fontSize:9,color:"#374151"}}>{u.pass} · <RolTag orden={u.orden}/></div>
                          </div>
                          <SDot activo={u.activo}/>
                        </div>
                      ))
                    }
                  </div>
                  {/* Paleta de color */}
                  <div style={{padding:"10px 16px",borderTop:"1px solid #161f2e",display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:9,color:"#374151",fontWeight:700,marginRight:4}}>COLOR</span>
                    {COLORES.map(col=>(
                      <div key={col} onClick={async()=>{await SB.from('campos').update({color:col}).eq('id',c.id);await cargarTodo();}}
                        style={{width:16,height:16,borderRadius:"50%",background:col,cursor:"pointer",border:`2px solid ${c.color===col?"#fff":"transparent"}`,transition:"all .15s"}}/>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ACREDITAR */}
        {tab==="acreditar"&&esM&&(
          <div className="fade">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
              <PTitle title="ACREDITAR DÍAS" sub="Automático domingos/festivos · Manual disponible" inline/>
              <button onClick={()=>{setMform({campoId:"",fecha:"",uids:[]});setModal("manual");}} style={{...S.bp,background:"linear-gradient(135deg,#7c3aed,#6d28d9)"}}>+ Manual</button>
            </div>
            {totPend>0&&(
              <div style={{background:"#2a1a00",border:"1px solid #5a3800",borderRadius:12,padding:"13px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:22}}>⚡</span>
                <div style={{flex:1}}><div style={{fontWeight:700,color:"#fb923c",fontSize:13}}>{totPend} día(s) pendiente(s) de acreditar</div><div style={{fontSize:10,color:"#4b5563",marginTop:2}}>Domingos/festivos sin procesar</div></div>
                <button onClick={()=>campos.forEach(c=>{if(pends[c.id]?.length)procTodos(c.id);})} style={{...S.bp,background:"linear-gradient(135deg,#d97706,#b45309)",fontSize:11,whiteSpace:"nowrap"}}>Acreditar Todos</button>
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:13,marginBottom:18}}>
              {campos.map(c=>{
                const pd=pends[c.id]||[];
                const pr=Object.entries(acred[c.id]||{}).filter(([,v])=>v.ok);
                return (
                  <div key={c.id} style={{background:"#0d1117",border:`1px solid ${c.color}33`,borderRadius:14,overflow:"hidden"}}>
                    <div style={{padding:"11px 15px",borderBottom:`1px solid ${c.color}22`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:c.color,letterSpacing:1}}>{c.nombre}</div>
                        <div style={{fontSize:8,color:"#374151",marginTop:1}}>{pd.length>0?<span style={{color:"#fb923c"}}>⚡{pd.length} pend.</span>:<span style={{color:"#4ade80"}}>✓ Al día</span>}</div>
                      </div>
                      {pd.length>0&&<button onClick={async()=>procTodos(c.id)} style={{background:`${c.color}22`,border:`1px solid ${c.color}44`,color:c.color,fontSize:10,padding:"3px 9px",borderRadius:7,fontWeight:700,cursor:"pointer"}}>+{pd.length}</button>}
                    </div>
                    {pd.length>0&&(
                      <div style={{padding:"8px 14px",borderBottom:`1px solid ${c.color}11`}}>
                        {pd.map(f=>(
                          <div key={f} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#111827",borderRadius:7,padding:"5px 9px",marginBottom:4}}>
                            <div><span style={{fontSize:11,color:"#f9fafb",fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{f}</span><span style={{fontSize:8,marginLeft:5,color:esDom(f)?"#60b4ff":"#fbbf24",fontWeight:700}}>{esDom(f)?"DOM":"FES"}</span></div>
                            <div style={{display:"flex",gap:4}}>
                              <button onClick={()=>{setForm({campoId:c.id,fechaExc:f,excIds:[]});setModal("excepcion");}} style={{background:"#1a2a3a",border:"1px solid #1c2a3a",color:"#94a3b8",fontSize:9,padding:"2px 6px",borderRadius:5,cursor:"pointer"}}>Exc.</button>
                              <button onClick={async()=>{await procAcred(c.id,f,[]);tip("Acreditado","ok");}} style={ba("#4ade80","#0d3320","#1a6640")}>✓</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{padding:"8px 14px"}}>
                      <div style={{fontSize:8,color:"#4b5563",fontWeight:700,letterSpacing:1,marginBottom:5}}>ÚLTIMOS</div>
                      {pr.length===0?<div style={{fontSize:10,color:"#374151"}}>Sin registros</div>
                        :pr.slice(-3).reverse().map(([f,r])=>(
                          <div key={f} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4,fontSize:10}}>
                            <div><span style={{color:"#e2e8f0",fontFamily:"'JetBrains Mono',monospace"}}>{f}</span>{r.manual&&<span style={{color:"#a78bfa",fontSize:8,marginLeft:4}}>MAN</span>}{r.exc?.length>0&&<span style={{color:"#fb923c",fontSize:8,marginLeft:4}}>-{r.exc.length}exc</span>}</div>
                            <button onClick={()=>revertAcred(c.id,f)} style={{background:"none",border:"none",color:"#374151",fontSize:10,cursor:"pointer"}}>↩</button>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{background:"#0d1117",border:"1px solid #1c2a3a",borderRadius:14,padding:"16px"}}>
              <div style={{fontWeight:700,color:"#f9fafb",marginBottom:12,fontSize:12}}>Saldos actuales</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
                {campos.map(c=>(
                  <div key={c.id} style={{borderLeft:`3px solid ${c.color}`,paddingLeft:10}}>
                    <div style={{fontSize:8,fontWeight:700,color:c.color,letterSpacing:2,marginBottom:7}}>{c.nombre}</div>
                    {users.filter(u=>u.campoId===c.id).map(u=>(
                      <div key={u.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5,opacity:u.activo?1:0.4}}>
                        <div style={{display:"flex",alignItems:"center",gap:5}}><Av av={u.av} color={c.color} sz={19}/><span style={{fontSize:10,color:"#e2e8f0"}}>{u.nombre}</span></div>
                        <span style={{fontSize:14,fontWeight:800,color:u.dias<0?"#fb923c":c.color,fontFamily:"'JetBrains Mono',monospace"}}>{u.dias}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* BLOQUEOS */}
        {tab==="bloqs"&&esM&&(
          <div className="fade">
            <PTitle title="BLOQUEOS" sub="Bloquear fechas por campo"/>
            <div style={{background:"#0d1117",border:"1px solid #1c2a3a",borderRadius:14,padding:"16px",marginBottom:12}}>
              <div style={{display:"flex",gap:7,marginBottom:14,flexWrap:"wrap"}}>
                {campos.map(c=><button key={c.id} onClick={()=>setForm(p=>({...p,blkC:c.id}))} style={{padding:"5px 13px",borderRadius:18,border:`1px solid ${form.blkC===c.id?c.color:c.color+"44"}`,background:form.blkC===c.id?`${c.color}22`:"transparent",color:form.blkC===c.id?c.color:"#4b5563",fontSize:11,fontWeight:700,cursor:"pointer"}}>{c.nombre}</button>)}
              </div>
              {form.blkC&&(()=>{
                return (
                  <>
                    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:11}}>
                      <button onClick={()=>setMes(p=>{const d=new Date(p.y,p.m-1);return{y:d.getFullYear(),m:d.getMonth()};})} style={S.nb2}>‹</button>
                      <span style={{fontWeight:800,color:"#f9fafb",fontSize:13,minWidth:140,textAlign:"center"}}>{MESES[mes.m]} {mes.y}</span>
                      <button onClick={()=>setMes(p=>{const d=new Date(p.y,p.m+1);return{y:d.getFullYear(),m:d.getMonth()};})} style={S.nb2}>›</button>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
                      {["L","M","X","J","V","S","D"].map(d=><div key={d} style={{textAlign:"center",fontSize:8,color:"#374151",fontWeight:700,padding:"3px 0"}}>{d}</div>)}
                      {calDias.map((f,i)=>{
                        if(!f) return <div key={i}/>;
                        const blq=bloqs[form.blkC]?.[f],fest=esDia(f);
                        return <div key={f} onClick={()=>togBloq(form.blkC,f)} style={{padding:"5px 2px",textAlign:"center",borderRadius:6,cursor:"pointer",background:blq?"#3a1010":fest?"#1a2a0a":"#111827",border:`1px solid ${blq?"#ef4444":fest?"#4ade8044":"#161f2e"}`,color:blq?"#f87171":fest?"#86efac":"#6b7280",fontSize:11,fontWeight:700,transition:"all .15s"}}>
                          {+f.split("-")[2]}
                          {fest&&!blq&&<div style={{fontSize:6,color:"#4ade80"}}>D/F</div>}
                          {blq&&<div style={{fontSize:6,color:"#ef4444"}}>BLQ</div>}
                        </div>;
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
            <div style={{background:"#0d1117",border:"1px solid #1c2a3a",borderRadius:12,padding:"14px"}}>
              <div style={{fontWeight:700,color:"#f9fafb",marginBottom:9,fontSize:11}}>Fechas bloqueadas</div>
              {campos.every(c=>!Object.keys(bloqs[c.id]||{}).length)&&<div style={{fontSize:11,color:"#374151"}}>Ninguna</div>}
              {campos.map(c=>{
                const fs=Object.keys(bloqs[c.id]||{}).sort();
                if(!fs.length) return null;
                return <div key={c.id} style={{marginBottom:9}}><div style={{fontSize:9,color:c.color,fontWeight:700,marginBottom:4}}>{c.nombre}</div><div style={{display:"flex",flexWrap:"wrap",gap:4}}>{fs.map(f=><div key={f} style={{background:"#3a1010",border:"1px solid #6a2020",borderRadius:5,padding:"2px 7px",fontSize:9,color:"#f87171",display:"flex",alignItems:"center",gap:4}}>{f}<button onClick={()=>togBloq(c.id,f)} style={{background:"none",border:"none",color:"#f87171",cursor:"pointer",fontSize:10}}>×</button></div>)}</div></div>;
              })}
            </div>
          </div>
        )}

        {/* CALENDARIO */}
        {tab==="cal"&&(
          <div className="fade">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
              <PTitle title={esM?"CALENDARIO GLOBAL":"MI CALENDARIO"} sub={esM?"Ausencias · todos los campos":`${miC?.nombre} · Ordeña y ausencias`} inline/>
              {!esM&&<button onClick={()=>{setForm({});setModal("nueva");}} style={{...S.bp,background:`linear-gradient(135deg,${acc},${acc}99)`,fontSize:12}}>+ Reservar</button>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:14}}>
              <button onClick={()=>setMes(p=>{const d=new Date(p.y,p.m-1);return{y:d.getFullYear(),m:d.getMonth()};})} style={S.nb2}>‹</button>
              <span style={{fontWeight:800,fontSize:19,color:"#f9fafb",minWidth:160,textAlign:"center"}}>{MESES[mes.m]} {mes.y}</span>
              <button onClick={()=>setMes(p=>{const d=new Date(p.y,p.m+1);return{y:d.getFullYear(),m:d.getMonth()};})} style={S.nb2}>›</button>
            </div>
            {!esM&&(
              <div style={{display:"flex",gap:12,marginBottom:11,flexWrap:"wrap",alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"#4b5563"}}><Vaca size={14}/>Titular ordeña</div>
                <div style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"#60b4ff"}}><Vaca size={14}/>Reemplazante</div>
                <div style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"#4b5563"}}><div style={{width:9,height:9,borderRadius:2,background:"#4ade8033",border:"1px solid #4ade8055"}}/>Dom/Festivo</div>
                <div style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"#4b5563"}}><div style={{width:9,height:9,borderRadius:2,background:"#ef444422",border:"1px solid #ef444444"}}/>Bloqueado</div>
              </div>
            )}
            <div style={{background:"#0d1117",border:"1px solid #1c2a3a",borderRadius:18,overflow:"hidden"}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:"1px solid #161f2e"}}>
                {["LUN","MAR","MIÉ","JUE","VIE","SÁB","DOM"].map(d=><div key={d} style={{padding:"9px 0",textAlign:"center",fontSize:8,fontWeight:700,color:"#374151",letterSpacing:1}}>{d}</div>)}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
                {calDias.map((fecha,i)=>{
                  if(!fecha) return <div key={i} style={{minHeight:90,borderRight:"1px solid #0d1117",borderBottom:"1px solid #0d1117"}}/>;
                  const aus=ausEnDia(fecha);
                  const blq=esM?campos.some(c=>bloqs[c.id]?.[fecha]):!!bloqs[session?.campoId]?.[fecha];
                  const fest=esDia(fecha);
                  const esHoy=fecha===getHoy();
                  const ord=!esM&&session?.campoId?calcOrdeña(fecha,session.campoId,users,res):null;
                  return (
                    <div key={fecha} onClick={()=>setSelDia(selDia===fecha?null:fecha)} style={{minHeight:90,padding:"5px 4px",borderRight:"1px solid #111827",borderBottom:"1px solid #111827",background:blq?"#1a0808":esHoy?"#0a1e30":fest?"#0a1a0a":"transparent",cursor:"pointer",transition:"background .15s"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                        <div style={{fontSize:10,fontWeight:700,color:esHoy?"#0ea5e9":blq?"#6a2020":fest?"#86efac":"#374151"}}>{+fecha.split("-")[2]}</div>
                        {fest&&!blq&&<div style={{fontSize:6,color:"#4ade80",fontWeight:700}}>{esDom(fecha)?"D":"F"}</div>}
                        {blq&&<div style={{fontSize:6,color:"#ef4444",fontWeight:700}}>BLQ</div>}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:2}}>
                        {aus.slice(0,2).map(u=>{const cc=campos.find(c=>c.id===u.campoId)?.color||"#666";return <div key={u.id} style={{background:`${cc}22`,border:`1px solid ${cc}44`,borderRadius:3,padding:"0px 3px",fontSize:7,color:cc,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.nombre.split(" ")[0]}</div>;})}
                        {aus.length>2&&<div style={{fontSize:6,color:"#374151"}}>+{aus.length-2}</div>}
                      </div>
                      {ord&&(
                        <div style={{marginTop:2,borderTop:"1px solid #161f2e",paddingTop:2}}>
                          {[ord.t1,ord.t2].filter(Boolean).map(t=>(
                            <div key={t.id} style={{display:"flex",alignItems:"center",gap:1,opacity:t.aus?0.3:1}}>
                              <Vaca size={10}/>
                              <span style={{fontSize:7,color:t.aus?"#6a2020":"#fbbf24",fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:45}}>{t.nombre.split(" ")[0]}</span>
                            </div>
                          ))}
                          {ord.nec&&ord.rep&&!ord.rep.aus&&(
                            <div style={{display:"flex",alignItems:"center",gap:1}}>
                              <Vaca size={10}/>
                              <span style={{fontSize:7,color:"#60b4ff",fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:45}}>{ord.rep.nombre.split(" ")[0]}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {selDia&&(()=>{
              const au=ausEnDia(selDia);
              const ord=!esM&&session?.campoId?calcOrdeña(selDia,session.campoId,users,res):null;
              const fest=esDia(selDia);
              return (
                <div style={{background:"#0d1117",border:"1px solid #1c2a3a",borderRadius:14,padding:"16px 20px",marginTop:12,animation:"fadeUp .2s ease"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                    <div>
                      <div style={{fontSize:18,fontWeight:800,color:"#f9fafb"}}>{selDia}</div>
                      {fest&&<div style={{fontSize:10,color:"#4ade80",fontWeight:700,marginTop:2}}>{esDom(selDia)?"☀ Domingo":"★ Festivo"} · +1 día libre</div>}
                    </div>
                    <button onClick={()=>setSelDia(null)} style={{background:"none",border:"none",color:"#4b5563",fontSize:18,cursor:"pointer"}}>×</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:ord?"1fr 1fr":"1fr",gap:16}}>
                    <div>
                      <div style={{fontSize:8,fontWeight:700,color:"#4b5563",letterSpacing:1,marginBottom:7}}>AUSENCIAS ({au.length})</div>
                      {au.length===0?<div style={{fontSize:11,color:"#374151"}}>Todos presentes</div>:au.map(u=>{const cc=campos.find(c=>c.id===u.campoId)?.color||"#666";return <div key={u.id} style={{display:"flex",alignItems:"center",gap:7,marginBottom:6}}><Av av={u.av} color={cc} sz={24}/><div><div style={{fontSize:11,color:"#e2e8f0",fontWeight:600}}>{u.nombre}</div><div style={{fontSize:8,color:cc}}>{campos.find(c=>c.id===u.campoId)?.nombre}</div></div></div>;})}
                    </div>
                    {ord&&(
                      <div>
                        <div style={{fontSize:8,fontWeight:700,color:"#4b5563",letterSpacing:1,marginBottom:7}}>ORDEÑA</div>
                        {[{l:"Titular 1",u:ord.t1,rep:false},{l:"Titular 2",u:ord.t2,rep:false},{l:"Reemplazante",u:ord.rep,rep:true,si:true}]
                          .filter(r=>r.u&&(!r.si||ord.nec))
                          .map(r=>(
                            <div key={r.l} style={{display:"flex",alignItems:"center",gap:9,marginBottom:9,opacity:r.u.aus?0.35:1}}>
                              <div style={{position:"relative"}}>
                                <Av av={r.u.av} color={r.rep?"#60b4ff":acc} sz={34}/>
                                <div style={{position:"absolute",bottom:-3,right:-3}}><Vaca size={14}/></div>
                              </div>
                              <div>
                                <div style={{fontSize:8,color:r.rep?"#60b4ff":"#fbbf24",fontWeight:700,display:"flex",alignItems:"center",gap:3}}><Vaca size={9}/>{r.l}</div>
                                <div style={{fontSize:12,color:r.u.aus?"#f87171":"#f9fafb",fontWeight:700,marginTop:1}}>{r.u.nombre}</div>
                                {r.u.aus&&<div style={{fontSize:8,color:"#f87171"}}>— Ausente</div>}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* MI EQUIPO */}
        {tab==="equipo"&&!esM&&(
          <div className="fade">
            <PTitle title="MI EQUIPO" sub={`${miC?.nombre} · Solo ves a tus compañeros`}/>
            <div style={{background:`${acc}0d`,border:`1px solid ${acc}33`,borderRadius:11,padding:"11px 14px",marginBottom:16,display:"flex",alignItems:"center",gap:11}}>
              <span style={{fontSize:18}}>📋</span>
              <div><div style={{fontWeight:700,color:acc,fontSize:12}}>Regla de cobertura</div><div style={{fontSize:10,color:"#4b5563",marginTop:2}}>Equipo {miEq.filter(u=>u.activo).length} · mín. 2 presentes · máx. 2 sem. anticipación · máx. {MAX_ADL} días adelantables</div></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:11}}>
              {miEq.map(u=>{
                const esYo=u.id===session.id;
                const rs=res.filter(s=>s.uid===u.id).slice(0,2);
                return (
                  <div key={u.id} style={{background:"#0d1117",border:`1px solid ${esYo?acc+"55":"#161f2e"}`,borderRadius:13,padding:"13px",opacity:u.activo?1:0.5}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:9}}>
                      <div style={{display:"flex",alignItems:"center",gap:7}}>
                        <Av av={u.av} color={acc} sz={34}/>
                        <div><div style={{fontSize:12,fontWeight:700,color:"#f9fafb"}}>{u.nombre}{esYo&&<span style={{fontSize:8,color:acc,marginLeft:3}}>TÚ</span>}</div><RolTag orden={u.orden}/></div>
                      </div>
                      <SDot activo={u.activo}/>
                    </div>
                    <div style={{background:`${acc}18`,border:`1px solid ${acc}33`,borderRadius:7,padding:"7px",textAlign:"center",marginBottom:7}}>
                      <div style={{fontSize:20,fontWeight:800,color:u.dias<0?"#fb923c":acc,lineHeight:1}}>{u.dias}</div>
                      <div style={{fontSize:7,color:"#4b5563"}}>DÍAS LIBRES</div>
                    </div>
                    {rs.length>0&&<div style={{borderTop:"1px solid #161f2e",paddingTop:6}}>{rs.map(s=><div key={s.id} style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#4b5563",marginBottom:2}}><span>{s.fi} → {s.ff}</span><Badge estado={s.estado} sm/></div>)}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MIS RESERVAS */}
        {tab==="misres"&&!esM&&(
          <div className="fade">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
              <PTitle title="MIS RESERVAS" sub="Reserva automática si cumple restricciones" inline/>
              <button onClick={()=>{setForm({});setModal("nueva");}} style={{...S.bp,background:`linear-gradient(135deg,${acc},${acc}99)`}}>+ Nueva</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:9,marginBottom:16}}>
              {[{icon:"⏰",label:"Máx. anticipación",v:"2 semanas",c:"#0ea5e9"},{icon:"📅",label:"Máx. consecutivos",v:"3 días",c:acc},{icon:"👷",label:"Mín. presentes",v:`2 de ${miEq.filter(u=>u.activo).length}`,c:"#4ade80"},{icon:"⚡",label:"Días adelantables",v:`${MAX_ADL}`,c:"#fb923c"}].map(r=>(
                <div key={r.label} style={{background:"#0d1117",border:`1px solid ${r.c}33`,borderRadius:9,padding:"11px 13px"}}>
                  <div style={{fontSize:15,marginBottom:3}}>{r.icon}</div>
                  <div style={{fontSize:15,fontWeight:800,color:r.c}}>{r.v}</div>
                  <div style={{fontSize:8,color:"#374151",marginTop:1}}>{r.label}</div>
                </div>
              ))}
            </div>
            <div style={{background:"#0d1117",border:"1px solid #161f2e",borderRadius:12,overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{borderBottom:"1px solid #161f2e"}}>{["Período","Días","Solicitado","Estado","Bloqueo"].map(h=><Th key={h}>{h}</Th>)}</tr></thead>
                <tbody>
                  {res.filter(s=>s.uid===session.id).length===0
                    ?<tr><td colSpan={5} style={{padding:28,textAlign:"center",color:"#374151",fontSize:11}}>Sin reservas aún</td></tr>
                    :res.filter(s=>s.uid===session.id).map(s=>(
                      <tr key={s.id} className="trh" style={{borderBottom:"1px solid #090d14"}}>
                        <td style={{...S.td,fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:"#4b5563"}}>{s.fi} → {s.ff}</td>
                        <td style={S.td}><span style={{fontSize:18,fontWeight:800,color:acc,fontFamily:"'JetBrains Mono',monospace"}}>{s.dias}</span></td>
                        <td style={{...S.td,fontSize:10,color:"#374151"}}>{s.fecha}</td>
                        <td style={S.td}><Badge estado={s.estado} cod={s.bloqueo}/></td>
                        <td style={{...S.td,fontSize:9,color:"#fb923c"}}>{s.bloqueo||""}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL NUEVA RESERVA */}
      {modal==="nueva"&&(
        <Modal onClose={()=>setModal(null)}>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:9,letterSpacing:3,color:acc,fontWeight:700}}>RESERVA AUTOMÁTICA</div>
            <div style={{fontSize:19,fontWeight:800,color:"#f9fafb",marginTop:3}}>Día Libre</div>
            <div style={{fontSize:10,color:"#374151",marginTop:4}}>Queda reservado al instante si cumple restricciones</div>
          </div>
          {[{label:"Fecha inicio",f:"fi"},{label:"Fecha fin",f:"ff"}].map(({label,f})=>(
            <div key={f} style={{marginBottom:13}}>
              <label style={S.lbl}>{label}</label>
              <input type="date" min={getHoy()} max={addDays(getHoy(),14)} value={form[f]||""} onChange={e=>setForm(p=>({...p,[f]:e.target.value}))} style={S.inp}/>
            </div>
          ))}
          {form.fi&&form.ff&&(()=>{
            const dias=difDias(form.fi,form.ff);
            const eq=miEq.filter(u=>u.activo);
            const aus=res.filter(s=>s.estado==="OK"&&s.uid!==session.id&&miEq.some(u=>u.id===s.uid)&&s.fi<=form.ff&&s.ff>=form.fi).length;
            const pres=eq.length-aus-1;
            const covOk=pres>=2;
            const saldo=users.find(u=>u.id===session.id)?.dias??0;
            const rSaldo=saldo-dias;
            const salOk=rSaldo>=-MAX_ADL;
            const ok=covOk&&salOk;
            return (
              <div style={{marginBottom:13,background:ok?"#0d3320":"#3a1010",border:`1px solid ${ok?"#1a6640":"#6a2020"}`,borderRadius:8,padding:"9px 12px",fontSize:11}}>
                <div style={{color:covOk?"#4ade80":"#f87171"}}>{covOk?"✓":"✗"} {dias} día(s) · {pres} compañero(s) presentes</div>
                <div style={{color:salOk?"#4ade80":"#f87171",marginTop:3}}>{salOk?"✓":"✗"} Saldo: {saldo} → {rSaldo}{rSaldo<0&&<span style={{color:"#fb923c"}}> ⚡adelanto {Math.abs(rSaldo)}/{MAX_ADL}</span>}</div>
                {ok&&<div style={{color:"#4ade80",fontWeight:700,marginTop:4,fontSize:10}}>⚡ Se reservará automáticamente</div>}
              </div>
            );
          })()}
          <div style={{display:"flex",gap:9,justifyContent:"flex-end"}}>
            <button onClick={()=>setModal(null)} style={S.bs}>Cancelar</button>
            <button onClick={crearRes} style={{...S.bp,background:`linear-gradient(135deg,${acc},${acc}99)`}}>Reservar</button>
          </div>
        </Modal>
      )}

      {/* MODAL EXCEPCIONES */}
      {modal==="excepcion"&&(
        <Modal onClose={()=>setModal(null)}>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:9,letterSpacing:3,color:"#fb923c",fontWeight:700}}>EXCEPCIONES</div>
            <div style={{fontSize:17,fontWeight:800,color:"#f9fafb",marginTop:3}}>{form.fechaExc} · {campos.find(c=>c.id===form.campoId)?.nombre}</div>
            <div style={{fontSize:10,color:"#4b5563",marginTop:4}}>Marca quién <strong style={{color:"#f87171"}}>NO trabajó</strong> ese día</div>
          </div>
          <div style={{marginBottom:14,display:"flex",flexDirection:"column",gap:6}}>
            {users.filter(u=>u.campoId===form.campoId&&u.activo).map(u=>{
              const exc=form.excIds?.includes(u.id);
              return <div key={u.id} onClick={()=>setForm(p=>({...p,excIds:exc?p.excIds.filter(x=>x!==u.id):[...(p.excIds||[]),u.id]}))} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 11px",borderRadius:8,cursor:"pointer",background:exc?"#3a1010":"#111827",border:`1px solid ${exc?"#6a2020":"#1c2a3a"}`}}><Av av={u.av} color={campos.find(c=>c.id===form.campoId)?.color} sz={28}/><span style={{flex:1,fontSize:12,fontWeight:600,color:exc?"#f87171":"#e2e8f0"}}>{u.nombre}</span><span style={{fontSize:10,color:exc?"#f87171":"#4ade80",fontWeight:700}}>{exc?"✗ No trabajó":"✓ Trabajó"}</span></div>;
            })}
          </div>
          <div style={{fontSize:10,color:"#4b5563",marginBottom:13,background:"#111827",borderRadius:7,padding:"7px 10px"}}>
            Se acreditará a <strong style={{color:"#4ade80"}}>{users.filter(u=>u.campoId===form.campoId&&u.activo&&!form.excIds?.includes(u.id)).length}</strong> trabajadores
          </div>
          <div style={{display:"flex",gap:9,justifyContent:"flex-end"}}>
            <button onClick={()=>setModal(null)} style={S.bs}>Cancelar</button>
            <button onClick={async()=>{await procAcred(form.campoId,form.fechaExc,form.excIds||[]);tip("Acreditado","ok");setModal(null);}} style={{...S.bp,background:"linear-gradient(135deg,#d97706,#b45309)"}}>Confirmar</button>
          </div>
        </Modal>
      )}

      {/* MODAL MANUAL */}
      {modal==="manual"&&(
        <Modal onClose={()=>setModal(null)}>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:9,letterSpacing:3,color:"#a78bfa",fontWeight:700}}>MANUAL</div>
            <div style={{fontSize:17,fontWeight:800,color:"#f9fafb",marginTop:3}}>Acreditar Día Libre</div>
          </div>
          <div style={{marginBottom:11}}>
            <label style={S.lbl}>Campo</label>
            <select value={mform.campoId} onChange={e=>setMform(p=>({...p,campoId:e.target.value,uids:[]}))} style={S.inp}><option value="">Seleccionar…</option>{campos.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
          </div>
          <div style={{marginBottom:11}}>
            <label style={S.lbl}>Fecha</label>
            <input type="date" value={mform.fecha} onChange={e=>setMform(p=>({...p,fecha:e.target.value}))} style={S.inp}/>
          </div>
          {mform.campoId&&(
            <div style={{marginBottom:13}}>
              <label style={S.lbl}>Quiénes reciben (vacío = todos)</label>
              <div style={{display:"flex",flexDirection:"column",gap:5,marginTop:4}}>
                {users.filter(u=>u.campoId===mform.campoId&&u.activo).map(u=>{
                  const todos=users.filter(x=>x.campoId===mform.campoId&&x.activo).map(x=>x.id);
                  const sel=mform.uids.length===0||mform.uids.includes(u.id);
                  return <div key={u.id} onClick={()=>{const c=mform.uids.length===0?todos:mform.uids;const n=c.includes(u.id)?c.filter(x=>x!==u.id):[...c,u.id];setMform(p=>({...p,uids:n.length===todos.length?[]:n}));}} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 9px",borderRadius:7,cursor:"pointer",background:sel?"#0d3320":"#111827",border:`1px solid ${sel?"#1a6640":"#1c2a3a"}`}}><Av av={u.av} color={campos.find(c=>c.id===mform.campoId)?.color} sz={22}/><span style={{flex:1,fontSize:11,color:sel?"#4ade80":"#4b5563",fontWeight:600}}>{u.nombre}</span><span style={{fontSize:10,color:sel?"#4ade80":"#374151"}}>{sel?"✓":""}</span></div>;
                })}
              </div>
            </div>
          )}
          <div style={{display:"flex",gap:9,justifyContent:"flex-end"}}>
            <button onClick={()=>setModal(null)} style={S.bs}>Cancelar</button>
            <button onClick={acredMan} style={{...S.bp,background:"linear-gradient(135deg,#7c3aed,#6d28d9)"}}>+1 Día</button>
          </div>
        </Modal>
      )}

      {/* MODAL AJUSTAR SALDO */}
      {modal==="ajustar"&&esM&&(
        <Modal onClose={()=>setModal(null)}>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:9,letterSpacing:3,color:"#a78bfa",fontWeight:700}}>ADMIN · SIN RESTRICCIONES</div>
            <div style={{fontSize:17,fontWeight:800,color:"#f9fafb",marginTop:3}}>Ajustar Saldo de Días</div>
            <div style={{fontSize:10,color:"#4b5563",marginTop:4}}>El administrador puede acreditar o descontar cualquier cantidad sin límites.</div>
          </div>
          <div style={{marginBottom:11}}>
            <label style={S.lbl}>Campo</label>
            <select value={form.campoId||""} onChange={e=>setForm(p=>({...p,campoId:e.target.value,uid:""}))} style={S.inp}><option value="">Seleccionar…</option>{campos.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
          </div>
          {form.campoId&&<div style={{marginBottom:11}}><label style={S.lbl}>Trabajador</label><select value={form.uid||""} onChange={e=>setForm(p=>({...p,uid:e.target.value}))} style={S.inp}><option value="">Seleccionar…</option>{users.filter(u=>u.campoId===form.campoId).map(u=><option key={u.id} value={u.id}>{u.nombre} ({u.dias} días)</option>)}</select></div>}
          <div style={{marginBottom:11}}>
            <label style={S.lbl}>Operación</label>
            <select value={form.op||"+"} onChange={e=>setForm(p=>({...p,op:e.target.value}))} style={S.inp}><option value="+">Acreditar (+)</option><option value="-">Descontar (−)</option></select>
          </div>
          <div style={{marginBottom:16}}>
            <label style={S.lbl}>Cantidad de días</label>
            <input type="number" min="1" value={form.cantidad||""} onChange={e=>setForm(p=>({...p,cantidad:e.target.value}))} style={S.inp}/>
          </div>
          {form.uid&&form.cantidad&&(
            <div style={{marginBottom:14,background:"#1a0d3a",border:"1px solid #3a1a6a",borderRadius:8,padding:"8px 12px",fontSize:11,color:"#c4b5fd"}}>
              Saldo actual: <strong>{users.find(u=>u.id===form.uid)?.dias??0}</strong> → resultante: <strong>{(users.find(u=>u.id===form.uid)?.dias??0)+(form.op==="+"?+(form.cantidad||0):-(form.cantidad||0))}</strong>
            </div>
          )}
          <div style={{display:"flex",gap:9,justifyContent:"flex-end"}}>
            <button onClick={()=>setModal(null)} style={S.bs}>Cancelar</button>
            <button onClick={ajustar} style={{...S.bp,background:"linear-gradient(135deg,#7c3aed,#6d28d9)"}}>Guardar</button>
          </div>
        </Modal>
      )}

      {/* MODAL RESERVA ADMIN — sin restricciones */}
      {modal==="resAdmin"&&esM&&(
        <Modal onClose={()=>setModal(null)}>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:9,letterSpacing:3,color:"#4ade80",fontWeight:700}}>ADMIN · SIN RESTRICCIONES</div>
            <div style={{fontSize:17,fontWeight:800,color:"#f9fafb",marginTop:3}}>Reservar Día Libre</div>
            <div style={{fontSize:10,color:"#4b5563",marginTop:4}}>El administrador puede reservar días sin validar cobertura, saldo, anticipación ni bloqueos.</div>
          </div>
          <div style={{marginBottom:11}}>
            <label style={S.lbl}>Campo</label>
            <select value={form.campoId||""} onChange={e=>setForm(p=>({...p,campoId:e.target.value,uid:""}))} style={S.inp}><option value="">Seleccionar…</option>{campos.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
          </div>
          {form.campoId&&(
            <div style={{marginBottom:11}}>
              <label style={S.lbl}>Trabajador</label>
              <select value={form.uid||""} onChange={e=>setForm(p=>({...p,uid:e.target.value}))} style={S.inp}><option value="">Seleccionar…</option>{users.filter(u=>u.campoId===form.campoId).map(u=><option key={u.id} value={u.id}>{u.nombre} ({u.dias} días saldo)</option>)}</select>
            </div>
          )}
          <div style={{marginBottom:11}}>
            <label style={S.lbl}>Fecha inicio</label>
            <input type="date" value={form.fi||""} onChange={e=>setForm(p=>({...p,fi:e.target.value}))} style={S.inp}/>
          </div>
          <div style={{marginBottom:14}}>
            <label style={S.lbl}>Fecha fin</label>
            <input type="date" value={form.ff||""} onChange={e=>setForm(p=>({...p,ff:e.target.value}))} style={S.inp}/>
          </div>
          {form.fi&&form.ff&&form.uid&&(()=>{
            const dias=difDias(form.fi,form.ff);
            const saldo=users.find(u=>u.id===form.uid)?.dias??0;
            return dias>0&&(
              <div style={{marginBottom:14,background:"#0d3320",border:"1px solid #1a6640",borderRadius:8,padding:"8px 12px",fontSize:11,color:"#4ade80"}}>
                {dias} día(s) · Saldo actual: {saldo} — no se descuenta automáticamente
              </div>
            );
          })()}
          <div style={{display:"flex",gap:9,justifyContent:"flex-end"}}>
            <button onClick={()=>setModal(null)} style={S.bs}>Cancelar</button>
            <button onClick={reservaAdmin} style={{...S.bp,background:"linear-gradient(135deg,#059669,#047857)"}}>Reservar Sin Restricciones</button>
          </div>
        </Modal>
      )}

      {/* MODAL EDITAR / CREAR CAMPO */}
      {modal==="editCampo"&&esM&&(
        <Modal onClose={()=>setModal(null)}>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:9,letterSpacing:3,color:"#4ade80",fontWeight:700}}>ADMIN · GESTIÓN DE CAMPOS</div>
            <div style={{fontSize:17,fontWeight:800,color:"#f9fafb",marginTop:3}}>{form.modo==="nuevoCampo"?"Nuevo Campo":"Editar Campo"}</div>
          </div>
          <div style={{marginBottom:14}}>
            <label style={S.lbl}>Nombre del campo</label>
            <input value={form.nombre||""} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))} style={S.inp} placeholder="Ej: Campo Sur, La Esperanza…"/>
          </div>
          <div style={{marginBottom:18}}>
            <label style={S.lbl}>Color identificador</label>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:6}}>
              {COLORES.map(col=>(
                <div key={col} onClick={()=>setForm(p=>({...p,color:col}))} style={{width:30,height:30,borderRadius:8,background:col,cursor:"pointer",border:`3px solid ${form.color===col?"#fff":"transparent"}`,transition:"all .15s",boxShadow:form.color===col?"0 0 0 2px #fff4":"none"}}/>
              ))}
            </div>
            {form.color&&<div style={{marginTop:8,display:"inline-flex",alignItems:"center",gap:8,background:`${form.color}22`,border:`1px solid ${form.color}44`,borderRadius:8,padding:"5px 12px"}}><div style={{width:10,height:10,borderRadius:"50%",background:form.color}}/><span style={{fontSize:11,color:form.color,fontWeight:700}}>{form.nombre||"Vista previa"}</span></div>}
          </div>
          {form.modo==="editCampo"&&(
            <div style={{marginBottom:14,background:"#3a1010",border:"1px solid #6a2020",borderRadius:8,padding:"10px 13px",fontSize:11,color:"#f87171"}}>
              <strong>Eliminar campo:</strong> Solo si no tiene trabajadores asignados.
              {users.filter(u=>u.campoId===form.cid).length===0
                ?<button onClick={async()=>{await SB.from("campos").delete().eq("id",form.cid);await cargarTodo();tip("Campo eliminado","warn");setModal(null);setForm({});}} style={{marginLeft:10,background:"#6a2020",border:"none",color:"#fff",fontSize:10,padding:"3px 9px",borderRadius:5,cursor:"pointer"}}>Eliminar</button>
                :<span style={{color:"#fb923c",marginLeft:6}}>({users.filter(u=>u.campoId===form.cid).length} trabajadores asignados)</span>
              }
            </div>
          )}
          <div style={{display:"flex",gap:9,justifyContent:"flex-end"}}>
            <button onClick={()=>setModal(null)} style={S.bs}>Cancelar</button>
            <button onClick={async()=>{
              if(!form.nombre?.trim()){tip("Ingrese un nombre","err");return;}
              if(form.modo==="nuevoCampo"){
                const newId="C"+Date.now().toString().slice(-6);
                await SB.from("campos").insert({id:newId,nombre:form.nombre.trim(),color:form.color||"#0ea5e9"});
                await cargarTodo();
                tip(`Campo "${form.nombre}" creado`,"ok");
              } else {
                await SB.from("campos").update({nombre:form.nombre.trim(),color:form.color}).eq("id",form.cid);
                await cargarTodo();
                tip("Campo actualizado","ok");
              }
              setModal(null);setForm({});
            }} style={{...S.bp,background:"linear-gradient(135deg,#059669,#047857)"}}>
              {form.modo==="nuevoCampo"?"Crear Campo":"Guardar"}
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL EDITAR / AGREGAR USUARIO */}
      {modal==="editUser"&&esM&&(
        <Modal onClose={()=>setModal(null)}>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:9,letterSpacing:3,color:"#4ade80",fontWeight:700}}>ADMIN · GESTIÓN DE USUARIOS</div>
            <div style={{fontSize:17,fontWeight:800,color:"#f9fafb",marginTop:3}}>{form.modo==="nuevo"?"Agregar Trabajador":"Editar Trabajador"}</div>
          </div>

          {/* Nombre */}
          <div style={{marginBottom:11}}>
            <label style={S.lbl}>Nombre completo</label>
            <input value={form.nombre||""} onChange={e=>setForm(p=>({...p,nombre:e.target.value,av:e.target.value.split(" ").map(w=>w[0]).join("").substring(0,2).toUpperCase()}))} style={S.inp} placeholder="Ej: Juan Pérez"/>
          </div>

          {/* Contraseña */}
          <div style={{marginBottom:11}}>
            <label style={S.lbl}>Contraseña de acceso</label>
            <input value={form.pass||""} onChange={e=>setForm(p=>({...p,pass:e.target.value}))} style={S.inp} placeholder="Ej: juan123"/>
          </div>

          {/* Campo */}
          <div style={{marginBottom:11}}>
            <label style={S.lbl}>Campo asignado</label>
            <select value={form.campoId||""} onChange={e=>setForm(p=>({...p,campoId:e.target.value}))} style={S.inp}>
              <option value="">Sin campo asignado</option>
              {campos.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          {/* Rol ordeña */}
          <div style={{marginBottom:11}}>
            <label style={S.lbl}>Rol de ordeña</label>
            <select value={form.orden===null||form.orden===undefined?"":form.orden} onChange={e=>setForm(p=>({...p,orden:e.target.value===""?null:+e.target.value}))} style={S.inp}>
              <option value="">Sin rol de ordeña</option>
              <option value="1">🐄 Titular 1 (ordeña principal)</option>
              <option value="2">🐄 Titular 2 (ordeña principal)</option>
              <option value="3">🐄 Reemplazante (ordeña cuando falta titular)</option>
            </select>
            {form.campoId&&form.orden&&(()=>{
              const conflicto=users.find(u=>u.campoId===form.campoId&&u.orden===+form.orden&&u.id!==form.uid);
              return conflicto?<div style={{fontSize:9,color:"#fb923c",marginTop:4}}>⚠ {conflicto.nombre} ya tiene este rol en {campos.find(c=>c.id===form.campoId)?.nombre}</div>:null;
            })()}
          </div>

          {/* Estado activo */}
          {form.modo==="editar"&&(
            <>
              <div style={{marginBottom:14}}>
                <label style={S.lbl}>Estado</label>
                <div style={{display:"flex",gap:8}}>
                  {[{v:true,l:"Activo en faena",c:"#4ade80"},{v:false,l:"Inactivo",c:"#f87171"}].map(o=>(
                    <div key={String(o.v)} onClick={()=>setForm(p=>({...p,activo:o.v,licenciaInicio:o.v?null:p.licenciaInicio,licenciaFin:o.v?null:p.licenciaFin,motivoInactivo:o.v?null:p.motivoInactivo}))} style={{flex:1,padding:"9px 12px",borderRadius:8,cursor:"pointer",textAlign:"center",background:form.activo===o.v?`${o.c}18`:"#111827",border:`1px solid ${form.activo===o.v?o.c:"#1c2a3a"}`,color:form.activo===o.v?o.c:"#4b5563",fontSize:11,fontWeight:700}}>
                      {o.l}
                    </div>
                  ))}
                </div>
              </div>
              {form.activo===false&&(
                <div style={{background:"#1a0d0d",border:"1px solid #3a1a1a",borderRadius:10,padding:"14px",marginBottom:14}}>
                  <div style={{fontSize:10,color:"#f87171",fontWeight:700,letterSpacing:1,marginBottom:10}}>🏥 LICENCIA MÉDICA</div>
                  <div style={{marginBottom:10}}>
                    <label style={S.lbl}>Motivo</label>
                    <input value={form.motivoInactivo||""} onChange={e=>setForm(p=>({...p,motivoInactivo:e.target.value}))} style={S.inp} placeholder="Ej: Licencia médica, Accidente laboral…"/>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <div>
                      <label style={S.lbl}>Fecha inicio</label>
                      <input type="date" value={form.licenciaInicio||""} onChange={e=>setForm(p=>({...p,licenciaInicio:e.target.value}))} style={S.inp}/>
                    </div>
                    <div>
                      <label style={S.lbl}>Fecha fin (retorno)</label>
                      <input type="date" value={form.licenciaFin||""} onChange={e=>setForm(p=>({...p,licenciaFin:e.target.value}))} style={S.inp}/>
                    </div>
                  </div>
                  {form.licenciaFin&&<div style={{fontSize:9,color:"#fb923c",marginTop:8}}>⚡ Al llegar la fecha de retorno el trabajador se reactivará automáticamente</div>}
                </div>
              )}
            </>
          )}

          <div style={{display:"flex",gap:9,justifyContent:"flex-end",marginTop:6}}>
            <button onClick={()=>setModal(null)} style={S.bs}>Cancelar</button>
            {form.modo==="editar"&&(
              <button onClick={async()=>{
                if(window.confirm("¿Eliminar este trabajador permanentemente? También se eliminarán sus reservas.")){
                  await SB.from("reservas").delete().eq("uid",form.uid);
                  await SB.from("usuarios").delete().eq("id",form.uid);
                  await cargarTodo();
                  tip("Trabajador eliminado","warn");setModal(null);setForm({});
                }
              }} style={{...S.bs,color:"#f87171",borderColor:"#6a2020"}}>Eliminar</button>
            )}
            <button onClick={async()=>{
              if(!form.nombre?.trim()){tip("Ingrese un nombre","err");return;}
              if(!form.pass?.trim()){tip("Ingrese una contraseña","err");return;}
              if(form.modo==="nuevo"){
                const newId="u"+Date.now().toString().slice(-8);
                const av=(form.nombre||"").split(" ").map(w=>w[0]).join("").substring(0,2).toUpperCase()||"??";
                await SB.from("usuarios").insert({id:newId,nombre:form.nombre.trim(),rol:"campo",campo_id:form.campoId||null,pass:form.pass.trim(),dias:0,activo:true,av,orden:form.orden??null});
                await cargarTodo();
                tip(`Trabajador ${form.nombre} agregado`,"ok");
              } else {
                const av=(form.nombre||"").split(" ").map(w=>w[0]).join("").substring(0,2).toUpperCase()||"??";
                await SB.from("usuarios").update({
                  nombre:form.nombre.trim(),
                  pass:form.pass.trim(),
                  campo_id:form.campoId||null,
                  orden:form.orden??null,
                  activo:form.activo,
                  av,
                  licencia_inicio:form.licenciaInicio||null,
                  licencia_fin:form.licenciaFin||null,
                  motivo_inactivo:form.motivoInactivo||null,
                }).eq("id",form.uid);
                await cargarTodo();
                tip(`Trabajador actualizado`,"ok");
              }
              setModal(null);setForm({});
            }} style={{...S.bp,background:"linear-gradient(135deg,#059669,#047857)"}}>
              {form.modo==="nuevo"?"Agregar":"Guardar Cambios"}
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL CAMBIAR CLAVE ADMIN */}
      {modal==="cambiarClaveAdmin"&&esM&&(
        <Modal onClose={()=>setModal(null)}>
          <div style={{marginBottom:18}}>
            <div style={{fontSize:9,letterSpacing:3,color:"#60b4ff",fontWeight:700}}>SEGURIDAD · ADMINISTRADOR</div>
            <div style={{fontSize:17,fontWeight:800,color:"#f9fafb",marginTop:3}}>Cambiar Contraseña</div>
          </div>

          {/* Paso 1: pregunta de seguridad */}
          {form.paso===1&&(
            <>
              <div style={{background:"#0d1f35",border:"1px solid #1c3a5a",borderRadius:10,padding:"14px 16px",marginBottom:18}}>
                <div style={{fontSize:10,color:"#60b4ff",fontWeight:700,marginBottom:6,letterSpacing:1}}>PREGUNTA DE SEGURIDAD</div>
                <div style={{fontSize:14,color:"#f9fafb",fontWeight:600}}>¿Cuál es el nombre de tu mascota?</div>
              </div>
              <div style={{marginBottom:16}}>
                <label style={S.lbl}>Respuesta</label>
                <input
                  value={form.respuesta||""}
                  onChange={e=>setForm(p=>({...p,respuesta:e.target.value}))}
                  onKeyDown={e=>e.key==="Enter"&&(async()=>{
                    if((form.respuesta||"").trim().toLowerCase()==="kugo"){
                      setForm(p=>({...p,paso:2}));
                    } else {
                      tip("Respuesta incorrecta","err");
                    }
                  })()}
                  style={S.inp}
                  placeholder="Escribe tu respuesta…"
                  autoComplete="off"
                />
              </div>
              {form.errorSeg&&<div style={{color:"#f87171",fontSize:11,marginBottom:12,textAlign:"center"}}>Respuesta incorrecta</div>}
              <div style={{display:"flex",gap:9,justifyContent:"flex-end"}}>
                <button onClick={()=>setModal(null)} style={S.bs}>Cancelar</button>
                <button onClick={()=>{
                  if((form.respuesta||"").trim().toLowerCase()==="kugo"){
                    setForm(p=>({...p,paso:2,errorSeg:false}));
                  } else {
                    setForm(p=>({...p,errorSeg:true}));
                    tip("Respuesta de seguridad incorrecta","err");
                  }
                }} style={{...S.bp,background:"linear-gradient(135deg,#0ea5e9,#0284c7)"}}>Verificar →</button>
              </div>
            </>
          )}

          {/* Paso 2: ingresar nueva clave */}
          {form.paso===2&&(
            <>
              <div style={{background:"#0d3320",border:"1px solid #1a6640",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:11,color:"#4ade80"}}>
                ✓ Identidad verificada — ingresa tu nueva contraseña
              </div>
              <div style={{marginBottom:13}}>
                <label style={S.lbl}>Nueva contraseña</label>
                <input
                  type="password"
                  value={form.nuevaClave||""}
                  onChange={e=>setForm(p=>({...p,nuevaClave:e.target.value}))}
                  style={S.inp}
                  placeholder="Mínimo 4 caracteres"
                  autoComplete="new-password"
                />
              </div>
              <div style={{marginBottom:16}}>
                <label style={S.lbl}>Confirmar contraseña</label>
                <input
                  type="password"
                  value={form.confirmar||""}
                  onChange={e=>setForm(p=>({...p,confirmar:e.target.value}))}
                  onKeyDown={e=>e.key==="Enter"&&(async()=>{
                    if(!form.nuevaClave||form.nuevaClave.length<4){tip("Mínimo 4 caracteres","err");return;}
                    if(form.nuevaClave!==form.confirmar){tip("Las contraseñas no coinciden","err");return;}
                    setUsers(p=>p.map(u=>u.id==="maestro"?{...u,pass:form.nuevaClave}:u));
                    tip("Contraseña actualizada correctamente","ok");
                    setModal(null);setForm({});
                  })()}
                  style={{...S.inp,borderColor:form.confirmar&&form.confirmar!==form.nuevaClave?"#ef4444":"#1c2a3a"}}
                  placeholder="Repite la contraseña"
                  autoComplete="new-password"
                />
                {form.confirmar&&form.confirmar!==form.nuevaClave&&(
                  <div style={{fontSize:9,color:"#f87171",marginTop:4}}>Las contraseñas no coinciden</div>
                )}
              </div>
              <div style={{display:"flex",gap:9,justifyContent:"flex-end"}}>
                <button onClick={()=>setForm(p=>({...p,paso:1,respuesta:"",nuevaClave:"",confirmar:""}))} style={S.bs}>← Volver</button>
                <button onClick={()=>{
                  if(!form.nuevaClave||form.nuevaClave.length<4){tip("Mínimo 4 caracteres","err");return;}
                  if(form.nuevaClave!==form.confirmar){tip("Las contraseñas no coinciden","err");return;}
                  setUsers(p=>p.map(u=>u.id==="maestro"?{...u,pass:form.nuevaClave}:u));
                  tip("Contraseña actualizada correctamente","ok");
                  setModal(null);setForm({});
                }} style={{...S.bp,background:"linear-gradient(135deg,#0ea5e9,#0284c7)"}}>Guardar Nueva Clave</button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* ── BARRA NAVEGACIÓN MÓVIL ── */}
      {session&&(
        <>
          {/* FAB reservar para trabajadores */}
          {!esM&&(
            <button className="mob-fab" onClick={()=>{setForm({});setModal("nueva");}}>+</button>
          )}
          <nav className="mob-nav">
            {navItems.slice(0,4).map(n=>(
              <button key={n.id} className={`mob-nav-btn${tab===n.id?" active":""}`} onClick={()=>setTab(n.id)} style={{position:"relative"}}>
                <span className="icon">{n.icon}</span>
                <span>{n.label.split(" ")[0]}</span>
                {n.badge>0&&<span style={{background:"#f59e0b",color:"#000",fontSize:8,fontWeight:800,borderRadius:20,padding:"1px 5px",position:"absolute",top:0,right:4}}>{n.badge}</span>}
              </button>
            ))}
            {navItems.length>4&&(
              <button className={`mob-nav-btn${[...navItems.slice(4)].some(n=>n.id===tab)?" active":""}`} onClick={()=>{
                const next=navItems.slice(4).find(n=>n.id!==tab)||navItems[4];
                setTab(next.id);
              }} style={{position:"relative"}}>
                <span className="icon">⋯</span>
                <span>Más</span>
              </button>
            )}
            <button className="mob-nav-btn" onClick={()=>setSession(null)}>
              <span className="icon">⏻</span>
              <span>Salir</span>
            </button>
          </nav>
        </>
      )}

      {/* TOAST */}
      {toast&&(
        <div style={{position:"fixed",bottom:"calc(env(safe-area-inset-bottom, 0px) + 80px)",right:14,left:14,zIndex:9999,textAlign:"center",background:toast.tipo==="ok"?"#0d3320":toast.tipo==="warn"?"#2a1a00":"#3a1010",border:`1px solid ${toast.tipo==="ok"?"#1a6640":toast.tipo==="warn"?"#5a3800":"#6a2020"}`,color:toast.tipo==="ok"?"#4ade80":toast.tipo==="warn"?"#fb923c":"#f87171",padding:"11px 18px",borderRadius:11,fontSize:13,fontWeight:700,animation:"toastIn .3s ease",maxWidth:320,boxShadow:"0 8px 28px rgba(0,0,0,.6)"}}>
          {toast.tipo==="ok"?"✓ ":toast.tipo==="warn"?"⚠ ":"✗ "}{toast.msg}
        </div>
      )}
    </div>
  );
}
