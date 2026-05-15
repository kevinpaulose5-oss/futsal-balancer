import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://xjcspcnvyvoyecldeqtx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqY3NwY252eXZveWVjbGRlcXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MjM2NjUsImV4cCI6MjA5NDM5OTY2NX0.4xf-aoR-64ZIsGv_ogqwSksLOQgJt8nfat3O9qKKy6s";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN_PASSWORD = "futsal123";
const COLORS = ["#1D9E75","#185FA5","#D85A30","#D4537E","#7F77DD"];
const TEAM_NAMES = ["Team A","Team B","Team C","Team D","Team E"];

function balanceTeams(players, n) {
  const sorted = [...players].sort((a,b) => b.rating - a.rating);
  const teams = Array.from({length:n}, ()=>[]);
  const sums = Array(n).fill(0);
  sorted.forEach((p,i) => {
    const snake = Math.floor(i/n) % 2 === 0;
    let pick = snake ? 0 : n-1;
    for (let t = 0; t < n; t++) {
      const idx = snake ? t : n-1-t;
      if (sums[idx] < sums[pick]) pick = idx;
    }
    teams[pick].push(p);
    sums[pick] += p.rating;
  });
  return teams;
}

function avg(team) {
  if (!team.length) return "0.0";
  return (team.reduce((s,p)=>s+p.rating,0)/team.length).toFixed(1);
}

function StarRating({value, onChange}) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{display:"flex",gap:1,flexWrap:"wrap"}}>
      {[1,2,3,4,5,6,7,8,9,10].map(n=>(
        <span key={n}
          onMouseEnter={()=>onChange&&setHover(n)}
          onMouseLeave={()=>onChange&&setHover(0)}
          onClick={()=>onChange&&onChange(n)}
          style={{fontSize:22,cursor:onChange?"pointer":"default",color:(hover||value)>=n?"#EF9F27":"#ddd",lineHeight:1,userSelect:"none"}}>★</span>
      ))}
    </div>
  );
}

function RatingBadge({r}) {
  const bg = r>=8?"#EAF3DE":r>=5?"#FAEEDA":"#FAECE7";
  const color = r>=8?"#3B6D11":r>=5?"#854F0B":"#993C1D";
  return <div style={{fontSize:13,fontWeight:600,width:28,height:28,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",background:bg,color,flexShrink:0}}>{r}</div>;
}

function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [tab, setTab] = useState("roster");
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState(null);
  const [numTeams, setNumTeams] = useState(3);
  const [newName, setNewName] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [editId, setEditId] = useState(null);
  const [editRating, setEditRating] = useState(5);
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const { data: p } = await supabase.from("players").select("*").order("rating", {ascending:false});
    if (p) setPlayers(p);
    const { data: c } = await supabase.from("config").select("*").eq("id",1).single();
    if (c) { setNumTeams(c.num_teams); setTeams(c.teams_json ? JSON.parse(c.teams_json) : null); }
    setLoading(false);
  }

  async function addPlayer() {
    if (!newName.trim()) return;
    const { data } = await supabase.from("players").insert({name:newName.trim(), rating:newRating, attending:false}).select().single();
    if (data) setPlayers(prev => [...prev, data].sort((a,b)=>b.rating-a.rating));
    setNewName(""); setNewRating(5);
  }

  async function removePlayer(id) {
    await supabase.from("players").delete().eq("id",id);
    setPlayers(prev => prev.filter(p=>p.id!==id));
  }

  async function saveEdit(id) {
    await supabase.from("players").update({rating:editRating}).eq("id",id);
    setPlayers(prev => prev.map(p=>p.id===id?{...p,rating:editRating}:p).sort((a,b)=>b.rating-a.rating));
    setEditId(null);
  }

  async function toggleAttend(id, current) {
    await supabase.from("players").update({attending:!current}).eq("id",id);
    setPlayers(prev => prev.map(p=>p.id===id?{...p,attending:!current}:p));
    setTeams(null);
    await supabase.from("config").update({teams_json:null}).eq("id",1);
  }

  async function saveNumTeams(n) {
    setNumTeams(n); setTeams(null);
    await supabase.from("config").update({num_teams:n, teams_json:null}).eq("id",1);
  }

  async function generate(shuffle) {
    let present = players.filter(p=>p.attending);
    if (shuffle) for(let i=present.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[present[i],present[j]]=[present[j],present[i]];}
    const t = balanceTeams(present, numTeams);
    setTeams(t);
    await supabase.from("config").update({teams_json:JSON.stringify(t)}).eq("id",1);
    setTab("teams");
  }

  function login() {
    if (pwInput === ADMIN_PASSWORD) { setIsAdmin(true); setShowLogin(false); setPwError(false); setPwInput(""); }
    else setPwError(true);
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});
  }

  const attendingCount = players.filter(p=>p.attending).length;

  const c = {
    card: {background:"#fff",border:"0.5px solid #e5e5e0",borderRadius:12,padding:"0.875rem 1rem",marginBottom:8},
    row: {display:"flex",alignItems:"center",gap:10},
    name: {flex:1,fontSize:15,fontWeight:500,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},
    input: {padding:"9px 12px",borderRadius:8,border:"1px solid #ddd",fontSize:15,flex:1,minWidth:0,outline:"none"},
    btn: (color,bg)=>({padding:"7px 14px",borderRadius:8,border:`1px solid ${color||"#ddd"}`,background:bg||"transparent",color:color||"#333",cursor:"pointer",fontSize:14,fontWeight:500}),
    bigBtn: (color,bg)=>({padding:"11px 22px",borderRadius:10,border:`1px solid ${color||"#999"}`,background:bg||"transparent",color:color||"#333",cursor:"pointer",fontSize:15,fontWeight:600}),
    tab: (a)=>({padding:"8px 16px",borderRadius:8,border:`1px solid ${a?"#333":"#ddd"}`,background:a?"#fff":"transparent",color:a?"#111":"#666",cursor:"pointer",fontSize:14,fontWeight:a?500:400}),
    pill: (active)=>({fontSize:13,padding:"6px 14px",borderRadius:20,border:`1px solid ${active?"#1D9E75":"#ddd"}`,color:active?"#0F6E56":"#555",background:active?"#E1F5EE":"#f5f5f0",cursor:"pointer"}),
    teamCard: (i)=>({background:"#fff",border:`2px solid ${COLORS[i]}`,borderRadius:12,padding:"0.875rem 1rem",flex:"1 1 140px",minWidth:0}),
    overlay: {position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999},
    modal: {background:"#fff",borderRadius:16,padding:"1.5rem",maxWidth:300,width:"90%",textAlign:"center"},
    checkbox: {width:20,height:20,cursor:"pointer",accentColor:"#1D9E75",flexShrink:0},
  };

  if (loading) return <div style={{padding:"2rem",textAlign:"center",color:"#888"}}>Loading...</div>;

  return (
    <div style={{fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",maxWidth:640,margin:"0 auto",padding:"1rem 0.75rem"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1.25rem",flexWrap:"wrap",gap:8}}>
        <h1 style={{fontSize:22,fontWeight:700,margin:0}}>⚽ Futsal Balancer</h1>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <span style={c.pill(false)} onClick={()=>setShowShare(true)}>📱 Share</span>
          {isAdmin
            ? <span style={c.pill(true)} onClick={()=>setIsAdmin(false)}>Admin ✓ · Log out</span>
            : <span style={c.pill(false)} onClick={()=>setShowLogin(v=>!v)}>🔒 Admin</span>}
        </div>
      </div>

      {showLogin && !isAdmin && (
        <div style={{...c.card,marginBottom:12}}>
          <p style={{marginBottom:10,fontSize:14,color:"#555"}}>Enter admin password</p>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <input style={c.input} type="password" placeholder="Password" value={pwInput}
              onChange={e=>setPwInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} autoFocus />
            <button style={c.btn("#185FA5")} onClick={login}>Login</button>
            <button style={c.btn()} onClick={()=>{setShowLogin(false);setPwError(false);setPwInput("")}}>✕</button>
          </div>
          {pwError && <p style={{marginTop:8,fontSize:13,color:"#A32D2D"}}>Incorrect password</p>}
        </div>
      )}

      <div style={{display:"flex",gap:6,marginBottom:"1.25rem",flexWrap:"wrap"}}>
        {["roster","matchday","teams"].map(t=>(
          <button key={t} style={c.tab(tab===t)} onClick={()=>setTab(t)}>
            {t==="roster"?`Roster (${players.length})`:t==="matchday"?"Matchday":"Teams"}
          </button>
        ))}
      </div>

      {tab==="roster" && (
        <div>
          {isAdmin && (
            <div style={{...c.card,marginBottom:12}}>
              <p style={{marginBottom:10,fontSize:14,fontWeight:600}}>Add player</p>
              <input style={{...c.input,width:"100%",marginBottom:10}} placeholder="Player name"
                value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addPlayer()} />
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
                <span style={{fontSize:13,color:"#555"}}>Rating:</span>
                <StarRating value={newRating} onChange={setNewRating} />
                <span style={{fontSize:14,fontWeight:600}}>{newRating}/10</span>
              </div>
              <button style={c.btn("#185FA5","#EBF4FD")} onClick={addPlayer}>Add player</button>
            </div>
          )}
          {players.length===0 && <p style={{color:"#888",fontSize:14}}>{isAdmin?"Add your first player above!":"No players yet."}</p>}
          {players.map(p=>(
            <div key={p.id} style={c.card}>
              <div style={c.row}>
                {isAdmin && <RatingBadge r={p.rating} />}
                <span style={c.name}>{p.name}</span>
                {!isAdmin && <span style={{fontSize:13,color:"#aaa"}}>⭐ Hidden</span>}
                {isAdmin && editId!==p.id && <button style={{...c.btn(),padding:"4px 10px",fontSize:13}} onClick={()=>{setEditId(p.id);setEditRating(p.rating)}}>Edit</button>}
                {isAdmin && <button style={{...c.btn("#A32D2D"),padding:"4px 10px",fontSize:13}} onClick={()=>removePlayer(p.id)}>Remove</button>}
              </div>
              {isAdmin && editId===p.id && (
                <div style={{marginTop:10,paddingTop:10,borderTop:"0.5px solid #eee"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
                    <StarRating value={editRating} onChange={setEditRating} />
                    <span style={{fontSize:14,fontWeight:600}}>{editRating}/10</span>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button style={c.btn("#1D9E75","#E1F5EE")} onClick={()=>saveEdit(p.id)}>Save</button>
                    <button style={c.btn()} onClick={()=>setEditId(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab==="matchday" && (
        <div>
          {isAdmin && (
            <div style={{...c.card,marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <span style={{fontSize:14,fontWeight:600}}>Number of teams:</span>
                {[2,3,4,5].map(n=>(
                  <button key={n} style={{...c.btn(numTeams===n?"#185FA5":"#ddd",numTeams===n?"#EBF4FD":"transparent"),padding:"5px 14px"}} onClick={()=>saveNumTeams(n)}>{n}</button>
                ))}
              </div>
            </div>
          )}
          {!isAdmin && <div style={{...c.card,marginBottom:12}}><span style={{fontSize:14,color:"#555"}}>Today: <strong>{numTeams} teams</strong> · {attendingCount} players attending</span></div>}
          <p style={{margin:"0 0 10px",fontSize:14,color:"#555"}}>{isAdmin?"Tap to mark who's coming:":"Today's attendance:"}</p>
          {players.length===0 && <p style={{color:"#888",fontSize:14}}>No players in roster yet.</p>}
          {players.map(p=>(
            <div key={p.id} style={{...c.card,opacity:p.attending?1:0.55,cursor:isAdmin?"pointer":"default"}} onClick={()=>isAdmin&&toggleAttend(p.id,p.attending)}>
              <div style={c.row}>
                {isAdmin
                  ? <input type="checkbox" style={c.checkbox} checked={!!p.attending} onChange={()=>toggleAttend(p.id,p.attending)} onClick={e=>e.stopPropagation()} />
                  : <span style={{fontSize:16,flexShrink:0}}>{p.attending?"✅":"⬜"}</span>}
                <span style={c.name}>{p.name}</span>
              </div>
            </div>
          ))}
          {isAdmin && (
            <div style={{marginTop:14,display:"flex",gap:10,flexWrap:"wrap"}}>
              <button style={c.bigBtn("#1D9E75","#E1F5EE")} onClick={()=>generate(false)} disabled={attendingCount<numTeams}>
                Generate {numTeams} teams
              </button>
              {teams && <button style={c.bigBtn()} onClick={()=>setTab("teams")}>View teams →</button>}
            </div>
          )}
          {isAdmin && attendingCount<numTeams && players.length>0 && (
            <p style={{fontSize:13,color:"#A32D2D",marginTop:8}}>Need at least {numTeams} players attending.</p>
          )}
        </div>
      )}

      {tab==="teams" && (
        <div>
          {!teams && <p style={{color:"#888",fontSize:14}}>{isAdmin?"Go to Matchday to generate teams.":"No teams yet — check back soon."}</p>}
          {teams && (
            <>
              <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:14}}>
                {teams.map((team,i)=>(
                  <div key={i} style={c.teamCard(i)}>
                    <div style={{fontSize:15,fontWeight:700,color:COLORS[i],marginBottom:4}}>{TEAM_NAMES[i]}</div>
                    {isAdmin && <div style={{fontSize:12,color:"#888",marginBottom:10}}>Avg {avg(team)}</div>}
                    {team.map(p=>(
                      <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:"0.5px solid #eee"}}>
                        {isAdmin && <RatingBadge r={p.rating} />}
                        <span style={{fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              {isAdmin && <button style={c.bigBtn()} onClick={()=>generate(true)}>🔀 Reshuffle</button>}
            </>
          )}
        </div>
      )}

      {showShare && (
        <div style={c.overlay} onClick={()=>setShowShare(false)}>
          <div style={c.modal} onClick={e=>e.stopPropagation()}>
            <p style={{marginBottom:6,fontSize:16,fontWeight:700}}>Share with teammates</p>
            <p style={{marginBottom:14,fontSize:13,color:"#555"}}>They'll see the teams in view-only mode. Ratings are hidden.</p>
            <div style={{background:"#f5f5f0",borderRadius:8,padding:"10px 12px",fontSize:12,color:"#333",wordBreak:"break-all",textAlign:"left",marginBottom:12}}>
              {window.location.href}
            </div>
            <button style={{...c.bigBtn("#185FA5","#EBF4FD"),width:"100%",marginBottom:8}} onClick={copyLink}>
              {copied?"✓ Copied!":"Copy link"}
            </button>
            <p style={{marginTop:8,fontSize:12,color:"#aaa"}}>Tap outside to close</p>
          </div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
