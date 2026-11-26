{
const CFG=window.DAANAV_CONFIG||{};
const LAST="daanav-last-user";
const LIB={
  Chest:["Bench press","Incline bench press","Dumbbell bench press","Incline dumbbell press","Machine chest press","Chest fly (machine)","Cable crossover","Push-ups","Dips"],
  Back:["Deadlift","Pull-ups","Lat pulldown","Barbell row","Seated cable row","Dumbbell row","T-bar row","Face pull"],
  Shoulders:["Overhead press","Dumbbell shoulder press","Arnold press","Lateral raise","Front raise","Rear delt fly","Shrugs"],
  Legs:["Squat","Leg press","Romanian deadlift","Walking lunges","Bulgarian split squat","Leg extension","Leg curl","Hip thrust","Calf raise"],
  Biceps:["Barbell curl","Dumbbell curl","Hammer curl","Preacher curl","Cable curl","Incline dumbbell curl"],
  Triceps:["Tricep pushdown","Overhead tricep extension","Skull crushers","Close-grip bench press","Tricep dips"],
  Core:["Hanging leg raise","Cable crunch","Ab wheel rollout","Russian twist","Crunches"]
};
const PARTS=Object.keys(LIB);
const app=document.getElementById("app");
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad=n=>String(n).padStart(2,"0");
const dkey=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const parse=k=>{const[y,m,d]=k.split("-").map(Number);return new Date(y,m-1,d,12)};
const weekOf=k=>{const d=parse(k);d.setDate(d.getDate()-((d.getDay()+6)%7));return dkey(d)};
const monthOf=k=>k.slice(0,7);
const fmt=n=>Math.round(n).toLocaleString("en-IN");
const kg=w=>(Math.round(w*100)/100).toString();
const wl=(w,c)=>w?kg(w)+(c?"":" kg"):(c?"BW":"Bodyweight");
const pl=(n,w)=>n+" "+w+(n===1?"":"s");
const short=k=>parse(k).toLocaleDateString(undefined,{day:"numeric",month:"short"});
const long=k=>parse(k).toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short",year:"numeric"});
const e1rm=s=>s.r<=0?0:s.r===1?s.w:s.w*(1+s.r/30);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);

const THEMES=[
  {id:"red",name:"Daanav Red",desc:"Deep red with gold for records",bg:"#140A0C",fg:"#E11D2E",font:"800 26px 'Barlow Condensed',sans-serif"},
  {id:"iron",name:"Iron",desc:"Dark charcoal with ember orange",bg:"#0E0E11",fg:"#FF5A1F",font:"400 26px Anton,Impact,sans-serif"},
  {id:"chalk",name:"Chalk",desc:"Bright and bold, volt lime on black",bg:"#D4FF3A",fg:"#0B0B0B",font:"900 26px Archivo,sans-serif"}];
const THEME_KEY="daanav-theme";
function curTheme(){const t=document.documentElement.dataset.theme;return THEMES.some(x=>x.id===t)?t:"red"}
function applyTheme(t){
  if(!THEMES.some(x=>x.id===t))t="red";
  if(document.documentElement.dataset.theme!==t&&window.Fig3D)Fig3D.resetTheme();
  document.documentElement.dataset.theme=t;
  try{localStorage.setItem(THEME_KEY,t)}catch(e){}
  const m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",{red:"#B3121F",iron:"#0E0E11",chalk:"#D4FF3A"}[t]);
}
const blank=()=>({workouts:[],active:null,custom:{},profile:{},pending:{up:{},del:{},state:0}});
let S=blank();
let logDate=null,pastMins=60,tab="workout",period="week",pickPart=null,showAllParts=false,summary=null,openId=null,progEx=null,draft={w:"",r:""},msgText="",popSet=false;
let authEmail="",authName="",pendingName="",ready=false,FB=null,fbAuth=null,fdb=null,user=null,authMode="signin",authMsg="",authBusy=false,syncState="idle",syncErr="",flushing=false,flushTimer=null,ver=1,bootError="";

/* ---------- Local cache (per user) ---------- */
const cacheKey=()=>"daanav-v1:"+(user?user.id:"none");
function loadCache(){
  S=blank();
  setTimeout(()=>{if(S.profile&&S.profile.theme)applyTheme(S.profile.theme)},0);
  try{const d=JSON.parse(localStorage.getItem(cacheKey())||"null");if(d&&Array.isArray(d.workouts)){Object.assign(S,d);S.pending=Object.assign(blank().pending,d.pending||{})}}catch(e){}
}
function save(){
  if(!user)return;
  try{localStorage.setItem(cacheKey(),JSON.stringify(S))}catch(e){msgText="Couldn’t save on this device. Storage may be full or turned off."}
}
const hasPending=()=>Object.keys(S.pending.up).length+Object.keys(S.pending.del).length+(S.pending.state?1:0)>0;
function markUp(id){S.pending.up[id]=++ver;delete S.pending.del[id];queue()}
function markDel(id){delete S.pending.up[id];S.pending.del[id]=1;queue()}
function markState(){S.pending.state=++ver;queue()}
function queue(){save();setSync(navigator.onLine?"saving":"offline");clearTimeout(flushTimer);flushTimer=setTimeout(flush,700)}

/* ---------- Cloud sync (Firebase Cloud Firestore) ----------
   Data layout:  users/{uid}/workouts/{workoutId}   one document per finished workout
                 users/{uid}/meta/state             custom exercises + workout in progress */
const clean=o=>JSON.parse(JSON.stringify(o==null?null:o));
const stamp=()=>FB.serverTimestamp();
const toDoc=w=>Object.assign(clean({date:w.date,startedAt:Math.round(+w.start||0),endedAt:Math.round(+w.end||0),parts:w.parts||[],exercises:w.ex||[]}),{updatedAt:stamp()});
const fromDoc=(id,d)=>({id,date:d.date,start:+d.startedAt||0,end:+d.endedAt||0,parts:Array.isArray(d.parts)?d.parts:[],ex:Array.isArray(d.exercises)?d.exercises:[]});
const wCol=()=>FB.collection(fdb,"users",user.id,"workouts");
const wDoc=id=>FB.doc(fdb,"users",user.id,"workouts",id);
const stateRef=()=>FB.doc(fdb,"users",user.id,"meta","state");
const timeout=(p,ms)=>Promise.race([p,new Promise((_,j)=>setTimeout(()=>j(new Error("the server took too long to answer")),ms||15000))]);
async function flush(){
  if(!fdb||!user||flushing)return;
  if(!hasPending()){setSync("synced");return}
  if(!navigator.onLine){setSync("offline");return}
  flushing=true;setSync("saving");
  try{
    const dels=Object.keys(S.pending.del),sent=Object.assign({},S.pending.up),ids=Object.keys(sent),sv=S.pending.state;
    const ops=[];
    for(const id of dels)ops.push(b=>b.delete(wDoc(id)));
    for(const id of ids){const w=S.workouts.find(x=>x.id===id);if(w)ops.push(b=>b.set(wDoc(id),toDoc(w)))}
    if(sv)ops.push(b=>b.set(stateRef(),{custom:clean(S.custom||{}),active:clean(S.active),profile:clean(S.profile||{}),updatedAt:stamp()}));
    for(let i=0;i<ops.length;i+=400){const b=FB.writeBatch(fdb);ops.slice(i,i+400).forEach(f=>f(b));await timeout(b.commit())}
    for(const id of dels)delete S.pending.del[id];
    for(const id of ids)if(S.pending.up[id]===sent[id])delete S.pending.up[id];
    if(sv&&S.pending.state===sv)S.pending.state=0;
    save();flushing=false;
    if(hasPending())return flush();
    setSync("synced");
  }catch(e){flushing=false;save();syncErr=errText(e);setSync(navigator.onLine?"error":"offline")}
}
async function pull(){
  if(!fdb||!user||!navigator.onLine)return;
  try{
    const[qs,st]=await timeout(Promise.all([FB.getDocs(wCol()),FB.getDoc(stateRef())]));
    const local=new Map(S.workouts.map(w=>[w.id,w]));
    const merged=qs.docs.filter(d=>!S.pending.del[d.id]).map(d=>S.pending.up[d.id]&&local.has(d.id)?local.get(d.id):fromDoc(d.id,d.data()));
    for(const id of Object.keys(S.pending.up))if(!merged.some(w=>w.id===id)&&local.has(id))merged.push(local.get(id));
    S.workouts=merged;
    if(!S.pending.state){
      if(st.exists()){const d=st.data();S.custom=d.custom||{};S.profile=d.profile&&typeof d.profile==="object"?d.profile:{};if(S.profile.theme)applyTheme(S.profile.theme);const act=d.active||null;
        if(JSON.stringify(act)!==JSON.stringify(S.active||null)){S.active=act;draft={w:"",r:""}}}
      else if(S.active||Object.keys(S.custom).length)markState();
    }
    save();
    if(!hasPending())setSync("synced");
    render();
  }catch(e){syncErr=errText(e);setSync(navigator.onLine?"error":"offline")}
}
function errText(e){
  const c=e&&e.code||"";
  if(c==="permission-denied"||c==="firestore/permission-denied")return"permission denied (check the Firestore rules)";
  if(c==="unavailable"||c==="firestore/unavailable")return"the server is unavailable";
  return e&&e.message?e.message:String(e);
}
async function syncNow(){await flush();await pull();if(hasPending())flush()}
function setSync(s){
  syncState=s;const el=document.getElementById("sync");if(!el)return;
  const t={synced:"Synced",saving:"Saving…",offline:"Offline · will sync",error:"Sync problem",idle:""}[s]||"";
  el.textContent=t;el.className="sync "+s;el.hidden=!t||!user||s==="synced";
  const m=document.getElementById("syncDetail");if(m)m.textContent=syncDetail();
}
function syncDetail(){
  if(syncState==="error")return"Couldn’t sync with your Daanav server ("+syncErr+"). Your changes are kept on this phone and will sync automatically.";
  if(syncState==="offline")return"You’re offline. Changes are kept on this phone and will sync when you’re back online.";
  if(syncState==="saving")return"Saving your latest changes…";
  return"Everything is saved to your account.";
}
const allSets=w=>w.ex.reduce((a,e)=>a.concat(e.sets),[]);
const volOf=w=>allSets(w).reduce((a,s)=>a+s.w*s.r,0);
const sorted=()=>S.workouts.slice().sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:a.start-b.start);

function history(name,excludeId,upTo){
  const out=[];
  for(const w of sorted()){if(w.id===excludeId||(upTo&&w.date>upTo))continue;for(const e of w.ex)if(e.name===name&&e.sets.length)out.push({date:w.date,sets:e.sets})}
  return out;
}
function bestW(name,excludeId,upTo){let b=0;for(const h of history(name,excludeId,upTo))for(const s of h.sets)if(s.w>b)b=s.w;return b}
function exercisesFor(part){return LIB[part].concat((S.custom[part]||[]).filter(n=>!LIB[part].includes(n)))}

function setHead(k,t){document.getElementById("kicker").textContent=k;document.getElementById("title").textContent=t}

/* ---------- Workout ---------- */
function viewWorkout(){
  const today=dkey(new Date());
  const A=S.active;
  if(!A){
    const ld=logDate&&logDate<today?logDate:null,yest=dkey(new Date(Date.now()-864e5));
    setHead(ld?"Logging a past workout":long(today),ld?"What did you train on "+parse(ld).toLocaleDateString(undefined,{weekday:"long"})+"?":"What are you training today?");
    const wk=weekOf(today),ws=S.workouts.filter(w=>weekOf(w.date)===wk);
    const dateCard='<section class="card datecard"><h3>Workout date</h3><div class="chips" role="radiogroup" aria-label="Workout date">'+
      '<button class="chip'+(!ld?" on":"")+'" role="radio" aria-checked="'+!ld+'" data-logdate="today">Today</button>'+
      '<button class="chip'+(ld===yest?" on":"")+'" role="radio" aria-checked="'+(ld===yest)+'" data-logdate="'+yest+'">Yesterday</button>'+
      '<label class="chip datepick'+(ld&&ld!==yest?" on":"")+'"><span>'+(ld&&ld!==yest?esc(short(ld)):"Earlier date")+'</span><input type="date" id="logDateIn" max="'+yest+'" min="2015-01-01" value="'+(ld||"")+'" aria-label="Pick an earlier date"></label></div>'+
      (ld?'<p class="pastnote">Logging for <b>'+esc(long(ld))+'</b>.</p><div class="durrow"><label for="pastMinsIn">How long was it?</label><span><input type="number" id="pastMinsIn" inputmode="numeric" min="5" max="300" step="5" value="'+pastMins+'"> min</span></div>':'')+'</section>';
    return (user.name?'':nameCard(true))+dateCard+'<section class="card"><h2>Pick a body part</h2><p class="sub">You can add more body parts once you’ve started.</p><div class="parts">'+
      PARTS.map(p=>'<button class="part" data-start="'+p+'"><b>'+p+'</b><small>'+lastTrained(p)+'</small></button>').join("")+
      '</div></section><section class="card"><h3>This week</h3><div class="tiles">'+tile("Workouts",ws.length)+tile("Volume",fmt(ws.reduce((a,w)=>a+volOf(w),0))+" kg")+'</div></section>';
  }
  if(A.cur!=null&&A.ex[A.cur]) return viewLogger(A);
  setHead(long(A.date)+(A.past?" · past workout":""),A.parts.join(" + "));
  const part=pickPart&&A.parts.includes(pickPart)?pickPart:A.parts[A.parts.length-1];
  const doneNames=A.ex.filter(e=>e.sets.length).map(e=>e.name);
  const first=!A.ex.some(e=>e.sets.length);
  let h='';
  if(!first){
    h+='<section class="card"><h3>Done so far</h3><div class="done-ex">'+A.ex.filter(e=>e.sets.length).map(e=>
      '<div><span>'+esc(e.name)+'</span><span class="num">'+e.sets.map(s=>wl(s.w,1)+"×"+s.r).join(", ")+'</span></div>').join("")+'</div></section>';
  }
  h+='<section class="card"><h2>'+(first?"Choose your first exercise":"Choose your next exercise")+'</h2><p class="sub">Tap one to start logging sets.</p>';
  h+='<div class="chips">'+A.parts.map(p=>'<button class="chip'+(p===part?" on":"")+'" data-pick="'+p+'">'+p+'</button>').join("")+
     '<button class="chip" data-act="toggleParts">'+(showAllParts?"Close":"+ Body part")+'</button></div>';
  if(showAllParts){
    const rest=PARTS.filter(p=>!A.parts.includes(p));
    h+=rest.length?'<div class="chips">'+rest.map(p=>'<button class="chip" data-addpart="'+p+'">+ '+p+'</button>').join("")+'</div>':'';
  }
  h+='<div class="exlist">'+exercisesFor(part).map(n=>{
    const hs=history(n,A.id,A.date),l=hs[hs.length-1],done=doneNames.includes(n);
    const hint=done?"Done today":l?"Last: "+bestOfSets(l.sets)+" · "+short(l.date):"Not logged yet";
    return '<button class="ex'+(done?" done":"")+'" data-ex="'+esc(n)+'" data-part="'+part+'"><span class="thumb" aria-hidden="true" data-thumb3d="'+esc(n)+'" data-part="'+part+'">'+figSvg(n,part,false)+'</span><span class="exn"><b>'+esc(n)+'</b><small>'+hint+'</small></span><span class="go">›</span></button>';
  }).join("")+'</div>';
  h+='<form id="customForm" style="margin-top:12px" class="row"><input type="text" id="customName" maxlength="50" placeholder="Add your own '+part.toLowerCase()+' exercise" aria-label="Custom exercise name"><button class="btn ghost" type="submit" style="flex:0 0 auto">Add</button></form></section>';
  h+='<div class="stickybar"><div class="row">'+(first?'':'<button class="btn" data-act="finish">Finish workout</button>')+
     '<button class="btn ghost" data-act="discard">Discard workout</button></div></div>';
  return h;
}
function lastTrained(p){
  const ws=sorted().filter(w=>w.parts.includes(p));
  if(!ws.length)return"Not trained yet";
  const k=ws[ws.length-1].date,days=Math.round((parse(dkey(new Date()))-parse(k))/864e5);
  return days===0?"Trained today":days===1?"Yesterday":days+" days ago";
}
function bestOfSets(sets){let b=sets[0];for(const s of sets)if(s.w>b.w||(s.w===b.w&&s.r>b.r))b=s;return wl(b.w)+" × "+b.r}

function viewLogger(A){
  const E=A.ex[A.cur];
  setHead(E.part+" · Exercise "+(A.ex.filter(e=>e.sets.length||e===E).indexOf(E)+1),E.name);
  const hs=history(E.name,A.id,A.date),l=hs[hs.length-1],prev=bestW(E.name,A.id,A.date);
  if(draft.w===""){const s=E.sets[E.sets.length-1]||(l&&l.sets[0]);draft.w=s?kg(s.w):"20";draft.r=s?String(s.r):"10"}
  let h='<section class="card"><div class="form"><button class="fig2" data-zoom="1" data-fig3d="'+esc(E.name)+'" data-part="'+E.part+'" aria-label="Open 3D how-to for '+esc(E.name)+'">'+figSvg(E.name,E.part,true)+'<span class="zoomhint" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5M11 8v6M8 11h6"/></svg></span></button><div><b>How to</b><p>'+esc(figCue(E.name,E.part))+'</p>'+
    '<p class="sub" style="margin:6px 0 0">'+(prev?'Best so far: <b class="num">'+kg(prev)+' kg</b>':'First time logging this')+'</p></div></div>';
  h+='<div class="last">'+(l?'<b>Last time, '+short(l.date)+':</b> <span class="num">'+l.sets.map(s=>wl(s.w,1)+"×"+s.r).join(" · ")+'</span>':'No previous sessions. Start with a weight you can do with good form.')+'</div>';
  h+='<div class="sets">'+E.sets.map((s,i)=>{
    const isPR=prev>0&&s.w>prev&&E.sets.findIndex(x=>x.w===s.w)===i&&Math.max(...E.sets.slice(0,i).map(x=>x.w),0)<s.w;
    return '<div class="set'+(popSet&&i===E.sets.length-1?" new":"")+'"><span class="n">'+(i+1)+'</span><span class="v">'+(s.w?kg(s.w)+' <small>kg</small>':'<small>Bodyweight</small>')+' × '+s.r+' <small>reps</small></span>'+
      (isPR?'<span class="pr">PR</span>':'<span></span>')+'<button class="x" data-delset="'+i+'" aria-label="Delete set '+(i+1)+'">×</button></div>'}).join("")+'</div>';
  h+='<div class="steppers">'+stepper("w","Weight (kg)",2.5)+stepper("r","Reps",1)+'</div>';
  h+='<button class="btn wide log" data-act="logset">Log set '+(E.sets.length+1)+'</button><p class="msg" id="msg">'+esc(msgText)+'</p></section>';
  h+='<div class="row" style="margin-bottom:8px"><button class="btn blue" data-act="doneex"'+(E.sets.length?'':' disabled')+'>Done, next exercise</button>'+
     '<button class="btn ghost" data-act="'+(E.sets.length?"finish":"backex")+'">'+(E.sets.length?"Finish workout":"Pick a different one")+'</button></div>';
  popSet=false;
  return h;
}
function stepper(k,label,step){
  return '<div class="step"><label for="in-'+k+'">'+label+'</label><div class="ctl"><button data-step="'+k+'" data-d="-'+step+'" aria-label="Less">−</button>'+
    '<input id="in-'+k+'" class="num" inputmode="decimal" value="'+esc(draft[k])+'" data-draft="'+k+'"><button data-step="'+k+'" data-d="'+step+'" aria-label="More">+</button></div></div>';
}
function tile(label,val,sub){return '<div class="tile"><span>'+label+'</span><b class="num">'+val+'</b>'+(sub||"")+'</div>'}

/* ---------- Progress ---------- */
function periodKeys(n){
  const out=[],d=new Date();d.setHours(12,0,0,0);
  if(period==="week"){d.setDate(d.getDate()-((d.getDay()+6)%7));for(let i=0;i<n;i++){out.unshift(dkey(d));d.setDate(d.getDate()-7)}}
  else{d.setDate(1);for(let i=0;i<n;i++){out.unshift(dkey(d).slice(0,7));d.setMonth(d.getMonth()-1)}}
  return out;
}
const keyOf=w=>period==="week"?weekOf(w.date):monthOf(w.date);
const plabel=(k,i,ks)=>period==="week"?(i===0||monthOf(k)!==monthOf(ks[i-1])?short(k):String(parse(k).getDate())):parse(k+"-01").toLocaleDateString(undefined,{month:"short"});
function prsIn(key){
  const best={};let n=0;const hit=new Set();
  for(const w of sorted()){const inP=keyOf(w)===key;
    for(const e of w.ex)for(const s of e.sets){const b=best[e.name]||0;if(inP&&b>0&&s.w>b)hit.add(e.name);if(s.w>b)best[e.name]=s.w}}
  return hit.size;
}
function viewProgress(){
  setHead("Progress",period==="week"?"Your weeks":"Your months");
  const keys=periodKeys(8),cur=keys[7],prv=keys[6];
  const by={};for(const k of keys)by[k]={vol:0,sets:0,n:0,parts:{}};
  for(const w of S.workouts){const k=keyOf(w);if(!by[k])continue;by[k].n++;by[k].vol+=volOf(w);
    for(const e of w.ex){by[k].sets+=e.sets.length;by[k].parts[e.part]=(by[k].parts[e.part]||0)+e.sets.length}}
  const c=by[cur],p=by[prv];
  const ch=(a,b)=>b?Math.round((a-b)/b*100):null;
  const chip=(v,lbl)=>v==null?'<em>no data for '+lbl+'</em>':'<em class="'+(v>=0?"up":"down")+'">'+(v>=0?"▲ ":"▼ ")+Math.abs(v)+'% vs '+lbl+'</em>';
  const lbl=period==="week"?"last week":"last month";
  let h='<div class="seg" role="tablist"><button class="'+(period==="week"?"on":"")+'" data-period="week">Weekly</button><button class="'+(period==="month"?"on":"")+'" data-period="month">Monthly</button></div>';
  if(!S.workouts.length)return h+'<section class="card empty"><h3>No workouts yet</h3><p>Log your first workout and your progress shows up here.</p><button class="btn" data-tab-go="workout">Start a workout</button></section>';
  h+='<section class="card"><h3>'+(period==="week"?"This week":"This month")+'</h3><div class="tiles">'+
    tile("Workouts",c.n,chip(ch(c.n,p.n),lbl))+tile("Volume (kg)",fmt(c.vol),chip(ch(c.vol,p.vol),lbl))+
    tile("Sets",c.sets,chip(ch(c.sets,p.sets),lbl))+tile("New PRs",prsIn(cur),'<em>heavier than ever before</em>')+'</div></section>';
  const max=Math.max(1,...keys.map(k=>by[k].vol));
  h+='<section class="card"><h3>Volume per '+period+'</h3><p class="sub">Weight × reps, added up across all sets.</p><div class="bars">'+keys.map((k,i)=>
    '<div class="bar'+(k===cur?" cur":"")+'"><i style="height:'+(by[k].vol/max*100)+'%">'+(by[k].vol?'<b>'+(by[k].vol>=1000?(by[k].vol/1000).toFixed(1)+"k":fmt(by[k].vol))+'</b>':'')+'</i><span>'+plabel(k,i,keys)+'</span></div>').join("")+'</div></section>';
  const parts=Object.entries(c.parts).sort((a,b)=>b[1]-a[1]),pm=Math.max(1,...parts.map(x=>x[1]));
  h+='<section class="card"><h3>Sets by body part, '+(period==="week"?"this week":"this month")+'</h3>'+(parts.length?parts.map(([k,v])=>
    '<div class="hrow"><span>'+k+'</span><span class="track"><i style="width:'+(v/pm*100)+'%"></i></span><span class="num">'+pl(v,"set")+'</span></div>').join(""):'<p class="sub">Nothing logged yet '+(period==="week"?"this week":"this month")+'.</p>')+'</section>';
  const names=[...new Set(sorted().flatMap(w=>w.ex.filter(e=>e.sets.length).map(e=>e.name)))].sort();
  if(!progEx||!names.includes(progEx)){const last=sorted().pop();progEx=last&&last.ex.length?last.ex[0].name:names[0]}
  const pts=history(progEx).map(x=>({d:x.date,top:Math.max(...x.sets.map(s=>s.w)),rm:Math.max(...x.sets.map(e1rm))}));
  h+='<section class="card"><h3>Strength by exercise</h3><select id="exSel" aria-label="Exercise">'+names.map(n=>'<option'+(n===progEx?" selected":"")+'>'+esc(n)+'</option>').join("")+'</select>';
  if(pts.length>=1){
    h+='<div class="fig" id="fig"><svg role="img" aria-label="Weight over time for '+esc(progEx)+'"></svg></div>';
    const a=pts[0],b=pts[pts.length-1],d=b.top-a.top;
    h+='<p class="delta">'+(pts.length<2?'One session so far. Log it again to see a trend.':'Top set: <b class="num">'+kg(a.top)+' → '+kg(b.top)+' kg</b> <span class="'+(d>=0?"up":"down")+'">('+(d>=0?"+":"")+kg(d)+' kg)</span> since '+short(a.d)+'. Estimated 1-rep max is now <b class="num">'+kg(Math.round(b.rm*2)/2)+' kg</b>.')+'</p>';
    h+='<p class="sub" style="margin:6px 0 0"><span style="color:var(--accent)">●</span> Top weight &nbsp; <span style="color:var(--chart2)">●</span> Estimated 1-rep max</p>';
  }
  h+='</section>';
  const rec={};for(const w of sorted())for(const e of w.ex)for(const s of e.sets){const r=rec[e.name];if(!r||s.w>r.w||(s.w===r.w&&s.r>r.r))rec[e.name]={w:s.w,r:s.r,d:w.date,rm:0};rec[e.name].rm=Math.max(rec[e.name].rm||0,e1rm(s))}
  const rows=Object.entries(rec).sort((a,b)=>a[0].localeCompare(b[0]));
  h+='<section class="card"><h3>Personal records</h3><table class="stack"><thead><tr><th>Exercise</th><th class="r">Best set</th><th class="r">Est. 1RM</th><th class="r">Date</th></tr></thead><tbody>'+
    rows.map(([n,r])=>'<tr><td>'+esc(n)+'</td><td data-l="Best set" class="r num">'+wl(r.w)+' × '+r.r+'</td><td data-l="Est. 1RM" class="r num">'+(r.w?kg(Math.round(r.rm*2)/2)+' kg':'–')+'</td><td data-l="Date" class="r">'+short(r.d)+'</td></tr>').join("")+'</tbody></table></section>';
  chartPts=pts;
  return h;
}
let chartPts=[];
function drawChart(){
  const fig=document.getElementById("fig");if(!fig)return;const s=fig.querySelector("svg");
  const W=fig.clientWidth,H=fig.clientHeight;if(!W)return;
  const P={l:40,r:14,t:14,b:28},pts=chartPts;
  const vals=pts.flatMap(p=>[p.top,p.rm]);let lo=Math.min(...vals),hi=Math.max(...vals);
  if(hi-lo<10){lo-=5;hi+=5}const padv=(hi-lo)*.12;lo=Math.max(0,lo-padv);hi+=padv;
  const x=i=>pts.length<2?(P.l+W-P.r)/2:P.l+i*(W-P.l-P.r)/(pts.length-1);
  const y=v=>P.t+(hi-v)/(hi-lo)*(H-P.t-P.b);
  let g="";
  for(let i=0;i<=3;i++){const v=lo+(hi-lo)*i/3,yy=y(v);
    g+='<line x1="'+P.l+'" x2="'+(W-P.r)+'" y1="'+yy+'" y2="'+yy+'" stroke="var(--line)"/><text x="'+(P.l-6)+'" y="'+(yy+4)+'" text-anchor="end" font-size="12" fill="var(--mute)">'+Math.round(v)+'</text>'}
  const line=(k,c)=>(pts.length>1?'<polyline fill="none" stroke="'+c+'" stroke-width="2.5" stroke-linejoin="round" points="'+pts.map((p,i)=>x(i)+","+y(p[k])).join(" ")+'"/>':'')+
    pts.map((p,i)=>'<circle cx="'+x(i)+'" cy="'+y(p[k])+'" r="'+(pts.length>30?2.5:4)+'" fill="'+c+'"/>').join("");
  g+=line("rm","var(--chart2)")+line("top","var(--accent)");
  const lab=(i,a)=>'<text x="'+x(i)+'" y="'+(H-8)+'" text-anchor="'+a+'" font-size="12" fill="var(--mute)">'+esc(short(pts[i].d))+'</text>';
  g+=pts.length<2?lab(0,"middle"):lab(0,"start")+lab(pts.length-1,"end");
  s.setAttribute("viewBox","0 0 "+W+" "+H);s.innerHTML=g;
}
const ro=new ResizeObserver(drawChart);

/* ---------- History ---------- */
function viewHistory(){
  setHead("History","Every session");
  const ws=sorted().reverse();
  let h='';
  if(!ws.length)h+='<section class="card empty"><h3>Nothing here yet</h3><p>Finished workouts show up here by date.</p><button class="btn" data-tab-go="workout">Start a workout</button></section>';
  let m="";
  for(const w of ws){
    const mk=monthOf(w.date);
    if(mk!==m){m=mk;const mw=ws.filter(x=>monthOf(x.date)===mk);
      h+='<p class="month">'+parse(mk+"-01").toLocaleDateString(undefined,{month:"long",year:"numeric"})+' · '+mw.length+' workout'+(mw.length>1?"s":"")+' · '+fmt(mw.reduce((a,x)=>a+volOf(x),0))+' kg</p>'}
    const open=openId===w.id;
    h+='<section class="card"><button class="wk" data-open="'+w.id+'" aria-expanded="'+open+'"><span class="top"><b>'+esc(w.parts.join(" + "))+'</b><span>'+long(w.date)+'</span></span><p class="num">'+
      w.ex.length+' exercise'+(w.ex.length>1?"s":"")+' · '+pl(allSets(w).length,"set")+' · '+fmt(volOf(w))+' kg</p></button>';
    if(open){
      h+='<div class="detail">'+w.ex.map(e=>'<div><b>'+esc(e.name)+'</b><span class="num">'+e.sets.map(s=>wl(s.w)+" × "+s.r).join(" · ")+'</span></div>').join("")+
        '<div class="row" style="margin-top:8px"><button class="btn ghost" data-delw="'+w.id+'">Delete workout</button></div></div>';
    }
    h+='</section>';
  }
  return h;
}

/* ---------- Render & actions ---------- */
/* ---------- Account ---------- */
let acctMsg={},acctBusy=false,acctDraft=null;
const firstName=()=>user&&user.name?user.name.trim().split(/\s+/)[0]:"";
function nameCard(prompt){
  return '<section class="card">'+(prompt?'<h2>What should we call you?</h2><p class="sub">Your name shows at the top of every page.</p>':'<h3>Profile</h3>')+
    '<form id="nameForm"><label class="fl" for="nm">Name</label><div class="row"><input type="text" id="nm" maxlength="40" autocomplete="name" placeholder="Your name" value="'+esc(user.name||"")+'">'+
    '<button class="btn" type="submit" style="flex:0 0 auto">Save</button></div></form><p class="msg">'+esc(acctMsg.name||"")+'</p>'+
    (prompt?'':'<p class="sub" style="margin:10px 0 0">Email: <b>'+esc(user.email||"")+'</b></p>')+'</section>';
}
function viewAccount(){
  setHead("Account",user.name||"Your account");
  const pv=user.providers||[],pw=pv.includes("password");
  const via=pw?"Email and password":pv.includes("google.com")?"Google":pv.includes("phone")?"Phone number":"Email and password";
  const phone=acctDraft?acctDraft.ph:(S.profile&&S.profile.phone)||user.phone||"";
  const nmv=acctDraft?acctDraft.nm:user.name||"";
  let h='<section class="card"><h3>Profile</h3><form id="profileForm">'+
    '<label class="fl" for="nm">Name</label><input type="text" id="nm" maxlength="40" autocomplete="name" placeholder="Your name" value="'+esc(nmv)+'">'+
    '<label class="fl" for="ph">Phone number</label><input type="tel" id="ph" maxlength="20" autocomplete="tel" inputmode="tel" placeholder="e.g. 98765 43210" value="'+esc(phone)+'">'+
    '<button class="btn wide" type="submit" style="margin-top:14px">Save</button></form><p class="msg">'+esc(acctMsg.name||"")+'</p>'+
    '<dl class="facts"><div><dt>Signed in with</dt><dd>'+via+'</dd></div>'+
    (user.email?'<div><dt>Email</dt><dd>'+esc(user.email)+'</dd></div>':'')+'</dl></section>';
  const ct=curTheme();
  h+='<section class="card"><h3>Theme</h3><div class="themes" role="radiogroup" aria-label="App theme">'+THEMES.map(t=>
    '<button class="theme" role="radio" aria-checked="'+(t.id===ct)+'" data-themepick="'+t.id+'"><span class="sw" style="background:'+t.bg+';color:'+t.fg+';font:'+t.font+'">Aa</span>'+
    '<span><b>'+t.name+(t.id==="red"?' <small style="display:inline;font-weight:600">· default</small>':'')+'</b><small>'+t.desc+'</small></span>'+
    '<span class="tick" aria-hidden="true">'+(t.id===ct?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>':'')+'</span></button>').join("")+'</div></section>';
  if(pw){
    h+='<section class="card"><h3>Change password</h3><form id="pwForm"><label class="fl" for="pw-cur">Current password</label><input type="password" id="pw-cur" autocomplete="current-password">'+
      '<label class="fl" for="pw-new">New password</label><input type="password" id="pw-new" minlength="6" autocomplete="new-password">'+
      '<button class="btn wide" type="submit" style="margin-top:14px"'+(acctBusy?" disabled":"")+'>'+(acctBusy?"Please wait…":"Change password")+'</button></form>'+
      '<p class="msg">'+esc(acctMsg.pw||"")+'</p><button class="link" data-act="resetmail" style="margin-top:6px">Forgot it? Email me a reset link</button><p class="msg">'+esc(acctMsg.reset||"")+'</p></section>';
  }
  h+='<section class="card"><button class="btn ghost wide" data-act="signout">Sign out</button>'+
    (hasPending()?'<p class="sub" style="margin:10px 0 0">Some changes are still waiting to sync. Daanav will try to save them before you sign out.</p>':'')+'</section>';
  acctMsg={};acctDraft=null;
  return h;
}
function normPhone(v){
  let p=String(v||"").replace(/[\s().-]/g,"");
  if(!p)return"";
  if(!p.startsWith("+")){p=p.replace(/^0+/,"");p=/^\d{10}$/.test(p)?"+91"+p:"+"+p}
  return /^\+\d{8,15}$/.test(p)?p:null;
}
async function saveProfile(){
  const n=(document.getElementById("nm").value||"").trim().replace(/\s+/g," ").slice(0,40);
  const raw=document.getElementById("ph").value,ph=normPhone(raw);
  if(!n||ph===null){acctDraft={nm:document.getElementById("nm").value,ph:raw};acctMsg.name=!n?"Enter your name.":"Enter a valid phone number, e.g. 98765 43210.";render();return}
  S.profile=Object.assign({},S.profile,{phone:ph});markState();
  await saveName(n);
}
async function saveName(given){
  const n=given||(document.getElementById("nm").value||"").trim().replace(/\s+/g," ").slice(0,40);
  if(!n){acctMsg.name="Enter your name.";render();return}
  user.name=n;saveLast();render();
  try{if(fbAuth&&fbAuth.currentUser)await FB.updateProfile(fbAuth.currentUser,{displayName:n});acctMsg.name="Saved.";}
  catch(e){acctMsg.name="Saved on this phone. It will update your account when you’re back online."}
  if(tab==="account")render();
}
async function changePassword(){
  const cur=document.getElementById("pw-cur").value,nw=document.getElementById("pw-new").value;
  if(!cur){acctMsg.pw="Enter your current password.";render();return}
  if(!nw||nw.length<6){acctMsg.pw="New password must be at least 6 characters.";render();return}
  if(!navigator.onLine){acctMsg.pw="You’re offline. Connect to the internet to change your password.";render();return}
  acctBusy=true;render();
  try{
    const u=fbAuth.currentUser;
    await FB.reauthenticateWithCredential(u,FB.EmailAuthProvider.credential(user.email,cur));
    await FB.updatePassword(u,nw);
    acctMsg.pw="Password changed.";
  }catch(e){acctMsg.pw=e&&/invalid-credential|wrong-password/.test(e.code||"")?"Your current password is wrong.":friendly(e)}
  acctBusy=false;render();
}
async function sendReset(email){
  try{await FB.sendPasswordResetEmail(fbAuth,email,{url:location.origin+location.pathname})}
  catch(e){if(/continue-uri|unauthorized-domain/.test(e&&e.code||""))await FB.sendPasswordResetEmail(fbAuth,email);else throw e}
}
function saveLast(){try{localStorage.setItem(LAST,JSON.stringify(user))}catch(e){}}

/* ---------- Undo toast ---------- */
let undoFn=null,toastTimer=null;
function toast(msg,fn){
  const t=document.getElementById("toast");document.getElementById("toastMsg").textContent=msg;
  undoFn=fn;t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{t.hidden=true;undoFn=null},6000);
}
document.getElementById("toastUndo").addEventListener("click",()=>{document.getElementById("toast").hidden=true;clearTimeout(toastTimer);const f=undoFn;undoFn=null;if(f)f()});

/* ---------- Sign-in screens ---------- */
const G_ICON='<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
function viewAuth(){
  if(!ready&&!bootError){setHead("Your gym log","Loading…");return '<section class="card empty"><p>Loading your workouts…</p></section>'}
  if(bootError){setHead("Your gym log","Setup needed");return '<section class="card"><h2>Almost there</h2><p class="sub">'+esc(bootError)+'</p></section>'}
  const M={
    signin:["Welcome back","Sign in to see your workouts on any device.","Sign in"],
    signup:["Create your account","Your workouts are saved to your account and sync across devices.","Create account"],
    forgot:["Reset password","We’ll email you a link to set a new password.","Send reset link"]}[authMode]||["Welcome back","","Sign in"];
  setHead("Your gym log",M[0]);
  let h='<section class="card">';
  if(authMode!=="forgot")h+='<p class="sub">'+M[1]+'</p><div class="socials"><button class="btn ghost wide social" data-act="google"'+(authBusy?" disabled":"")+'>'+G_ICON+'Continue with Google</button></div><div class="or"><span>or use email</span></div>';
  h+='<form id="authForm" novalidate>'+(authMode==="forgot"?'<p class="sub">'+M[1]+'</p>':'');
  if(authMode==="signup")h+='<label class="fl" for="au-name">Your name</label><input type="text" id="au-name" maxlength="40" autocomplete="name" value="'+esc(authName)+'">';
  h+='<label class="fl" for="au-email">Email</label><input type="email" id="au-email" autocomplete="email" inputmode="email" required value="'+esc(authEmail)+'">';
  if(authMode!=="forgot")h+='<label class="fl" for="au-pass">Password</label><input type="password" id="au-pass" minlength="6" required autocomplete="'+(authMode==="signin"?"current-password":"new-password")+'">';
  h+='<button class="btn wide" type="submit" style="margin-top:14px"'+(authBusy?" disabled":"")+'>'+(authBusy?"Please wait…":M[2])+'</button><p class="msg" id="authMsg">'+esc(authMsg)+'</p></form>';
  h+='<div class="authlinks">'+
    (authMode==="signin"?'<button class="link" data-auth="signup">New here? Create an account</button><button class="link" data-auth="forgot">Forgot password?</button>':'')+
    (authMode==="signup"||authMode==="forgot"?'<button class="link" data-auth="signin">Back to sign in</button>':'')+'</div></section>';
  return h;
}
async function googleSignIn(){
  if(!navigator.onLine){authMsg="You’re offline. Connect to the internet to sign in.";render();return}
  let pr;
  try{const prov=new FB.GoogleAuthProvider();prov.setCustomParameters({prompt:"select_account"});pr=FB.signInWithPopup(fbAuth,prov)}
  catch(e){authMsg=friendly(e);render();return}
  authBusy=true;authMsg="";render();
  try{await pr}catch(e){authMsg=friendly(e)}
  authBusy=false;render();
}
async function submitAuth(){
  const email=(document.getElementById("au-email")||{}).value,pass=(document.getElementById("au-pass")||{}).value;
  const em=email&&email.trim();
  authEmail=em||"";
  if(authMode==="signup"){authName=((document.getElementById("au-name")||{}).value||"").trim().replace(/\s+/g," ").slice(0,40);
    if(!authName){authMsg="Enter your name.";render();return}}
  if(!/^\S+@\S+\.\S+$/.test(em||"")){authMsg="Enter a valid email address.";render();return}
  if(authMode!=="forgot"&&(!pass||pass.length<6)){authMsg="Password must be at least 6 characters.";render();return}
  if(!navigator.onLine){authMsg="You’re offline. Connect to the internet to sign in.";render();return}
  authBusy=true;authMsg="";render();
  try{
    if(authMode==="signin")await FB.signInWithEmailAndPassword(fbAuth,em,pass);
    else if(authMode==="signup"){
      pendingName=authName;
      const cred=await FB.createUserWithEmailAndPassword(fbAuth,em,pass);
      try{await FB.updateProfile(cred.user,{displayName:authName})}catch(e){}
      if(user&&user.id===cred.user.uid&&!user.name){user.name=authName;saveLast()}
    }
    else{
      await sendReset(em);
      authMode="signin";authMsg="If that email has an account, a reset link is on its way. Check your spam folder too.";
    }
  }catch(e){authMsg=friendly(e)}
  authBusy=false;render();
}
function friendly(e){
  const c=(e&&e.code)||"";
  const M={
    "auth/invalid-credential":"Wrong email or password.","auth/invalid-login-credentials":"Wrong email or password.",
    "auth/wrong-password":"Wrong email or password.","auth/user-not-found":"Wrong email or password.",
    "auth/invalid-email":"That email address doesn’t look right.",
    "auth/email-already-in-use":"That email already has an account. Sign in instead.",
    "auth/weak-password":"Choose a stronger password (at least 6 characters).",
    "auth/too-many-requests":"Too many attempts. Wait a few minutes and try again.",
    "auth/network-request-failed":"Couldn’t reach the server. Check your connection and try again.",
    "auth/operation-not-allowed":"This sign-in method isn’t switched on yet. Turn it on in Firebase → Authentication → Sign-in method.",
    "auth/popup-closed-by-user":"","auth/cancelled-popup-request":"","auth/user-cancelled":"",
    "auth/popup-blocked":"The Google window was blocked. Allow pop-ups for this site and try again.",
    "auth/operation-not-supported-in-this-environment":"Google sign-in doesn’t work inside the Home Screen app. Open Daanav in Safari to use Google, or sign in with phone or email here.",
    "auth/web-storage-unsupported":"Google sign-in doesn’t work inside the Home Screen app. Open Daanav in Safari to use Google, or sign in with phone or email here.",
    "auth/unauthorized-domain":"This web address isn’t allowed in Firebase yet. Add it under Authentication → Settings → Authorized domains.",
    "auth/account-exists-with-different-credential":"This email already has an account with another sign-in method. Use that method instead.",
    "auth/admin-restricted-operation":"New sign-ups are turned off for this app.",
    "auth/user-disabled":"This account has been disabled.","auth/requires-recent-login":"Please sign out and sign in again, then retry."};
  return c in M?M[c]:((e&&e.message)||"Something went wrong. Please try again.");
}

function render(){
  const signedIn=!!user&&authMode!=="reset";
  document.body.classList.toggle("noauth",!signedIn);
  setSync(syncState);
  document.getElementById("hello").textContent=signedIn&&firstName()?"Hi, "+firstName():"";
  if(!signedIn){app.innerHTML=viewAuth();return}
  const v=tab==="workout"?viewWorkout():tab==="progress"?viewProgress():tab==="history"?viewHistory():viewAccount();
  app.innerHTML=v;
  if(window.Fig3D)try{Fig3D.hydrate(app)}catch(e){}
  document.querySelectorAll("nav button").forEach(b=>{b.classList.toggle("on",b.dataset.tab===tab);b.setAttribute("aria-current",b.dataset.tab===tab?"page":"false")});
  ro.disconnect();const f=document.getElementById("fig");if(f){ro.observe(f);drawChart()}
  msgText="";
}
function go(t){tab=t;render();window.scrollTo(0,0);app.classList.remove("enter");void app.offsetWidth;app.classList.add("enter");clearTimeout(go.t);go.t=setTimeout(()=>app.classList.remove("enter"),700)}
function startWorkout(p){
  const today=dkey(new Date()),past=logDate&&logDate<today?logDate:null;
  S.active=past?{id:uid(),date:past,start:parse(past).setHours(18,0,0,0),past:true,mins:Math.max(5,Math.min(300,pastMins||60)),parts:[p],ex:[],cur:null}
    :{id:uid(),date:today,start:Date.now(),parts:[p],ex:[],cur:null};
  logDate=null;pickPart=p;showAllParts=false;markState();render();window.scrollTo(0,0);
}
function openEx(name,part){
  const A=S.active;let i=A.ex.findIndex(e=>e.name===name);
  if(i<0){A.ex.push({name,part,sets:[]});i=A.ex.length-1}
  A.cur=i;draft={w:"",r:""};markState();render();window.scrollTo(0,0);
}
function cleanActive(){const A=S.active;A.ex=A.ex.filter(e=>e.sets.length);A.cur=null}
/* ---------- 3D how-to zoom ---------- */
function openZoom(name,part){
  const z=document.getElementById("zoom"),mus=figMuscles(name,part),L=figMuscleLabel;
  z.innerHTML='<div class="zwrap"><div class="zbar"><b>'+esc(name)+'</b><button class="zclose" data-zclose="1" aria-label="Close">×</button></div>'+
    '<div class="zstage" data-fig3d="'+esc(name)+'" data-part="'+part+'" data-interactive="1">'+figSvg(name,part,true)+'</div>'+
    '<p class="zhint">Drag to turn the figure</p>'+
    '<div class="zcard"><h3>How to</h3><p>'+esc(figCue(name,part))+'</p></div>'+
    '<div class="zcard"><h3>Muscles worked</h3><div class="zmus">'+mus.map(m=>'<span>'+L[m]+'</span>').join("")+'</div></div>'+
    '<div class="zcard"><h3>Tips</h3><ul>'+figTips(name,part).map(t=>'<li>'+esc(t)+'</li>').join("")+'</ul></div>'+
    '<button class="btn wide" data-zclose="1">Got it</button></div>';
  z.hidden=false;document.body.classList.add("celebrating");z.scrollTop=0;
  const st=z.querySelector(".zstage");if(window.Fig3D)Fig3D.mount(st,name,part,{interactive:true});
  setTimeout(()=>{const b=z.querySelector(".zclose");if(b)b.focus({preventScroll:true})},50);
}
function closeZoom(){const z=document.getElementById("zoom");if(z.hidden)return;z.hidden=true;z.innerHTML="";document.body.classList.remove("celebrating");render()}
document.getElementById("zoom").addEventListener("click",e=>{if(e.target.closest("[data-zclose]")||e.target.id==="zoom")closeZoom()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeZoom()});

/* ---------- Workout-complete celebration ---------- */
let celeData=null,celeRun=0,celeRaf=0;
function celebrate(d){celeData=d;celeRun=0;showCele()}
function showCele(){
  const d=celeData,el=document.getElementById("cele"),t=curTheme(),first=firstName();
  const msgs=[];
  if(d.prs.length)msgs.push((d.prs.length===1?"A new personal record":d.prs.length+" new personal records")+(d.past?" on "+short(d.date):" today")+(first?", "+first:"")+". "+d.prs[0].name+" is up "+kg(d.prs[0].delta)+" kg — that’s real strength.");
  msgs.push(fmt(d.vol)+" kg moved in "+pl(d.mins,"minute")+". "+["That’s the Daanav in you showing up.","Every plate you add is earned.","Strong work — recover well and come back hungry."][celeRun%3]);
  msgs.push(d.past?"Logged for "+long(d.date)+". Your history and progress charts are up to date.":d.week>=2?"That’s workout #"+d.week+" this week. Consistency is your superpower.":"First workout of the week done — the hardest one is behind you.");
  const msg=msgs[celeRun%msgs.length];
  const H={
    red:{kick:"Shabaash"+(first?", "+first:"")+"!",h:"Daanav<br><em>unleashed</em>"},
    iron:{kick:"Workout complete",h:"Beast<br><em>mode.</em>"},
    chalk:{kick:d.dayName+" · "+d.parts.join(" + "),h:"Session<br>crushed."}}[t];
  let hero="",fx="";
  if(t==="red"){
    hero='<svg class="rays" viewBox="0 0 260 260" aria-hidden="true"><g fill="rgba(245,184,61,.16)">'+[0,36,72,108,144,180,216,252,288,324].map(a=>'<path d="M130 130 L122 0 L138 0Z" transform="rotate('+a+' 130 130)"/>').join("")+'</g></svg><div class="medal"><div class="ribbon"></div><div class="disc"><svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="#5A3600" stroke-width="2.2" stroke-linecap="round"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></svg></div></div>';
    for(let i=0;i<18;i++)fx+='<span class="spark" style="left:'+((i*53)%100)+'%;animation-delay:'+((i*37)%300)/100+'s;animation-duration:'+(2.4+(i%4)*.4)+'s"></span>';
  }else if(t==="iron"){
    hero='<div class="glowbg"></div><div class="plate"><em>20 KG</em><i></i></div>';
    const c=["#FF5A1F","#FFB020","#F4F1EC","#FF8A5C","#6B6873"];
    for(let i=0;i<34;i++)fx+='<span class="conf" style="left:'+((i*37)%100)+'%;background:'+c[i%5]+';animation-delay:'+((i*53)%90)/100+'s;width:'+(6+(i%4)*2)+'px"></span>';
  }else{
    hero='<div class="stampbox"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>';
    const c=["#0B0B0B","#FFFFFF","#0B0B0B","#55534C"];
    for(let i=0;i<30;i++)fx+='<span class="conf" style="left:'+((i*41)%100)+'%;background:'+c[i%4]+';animation-delay:'+(.5+((i*29)%80)/100)+'s;border-radius:'+(i%3?"2px":"50%")+'"></span>';
  }
  const dots=t==="chalk"?'<div class="dots">'+["M","T","W","T","F","S","S"].map((l,i)=>'<i class="'+(d.days[i]?"on":"")+'" style="animation-delay:'+(1.5+i*.08)+'s">'+(d.days[i]?"✓":l)+'</i>').join("")+'</div>':"";
  el.innerHTML='<div class="fx" aria-hidden="true">'+fx+'</div><div class="wrap"><div class="hero" aria-hidden="true">'+hero+'</div>'+
    '<div class="kick">'+esc(H.kick)+'</div><h2 id="celeTitle">'+H.h+'</h2><p class="say up1 d1">'+esc(msg)+'</p>'+
    '<div class="stats"><div class="stat up1 d2"><span>Total lifted</span><b><span data-to="'+d.vol+'">0</span><small> kg</small></b></div>'+
    '<div class="stat up1 d2"><span>Sets</span><b data-to="'+d.sets+'">0</b></div>'+
    '<div class="stat up1 d3"><span>Time</span><b><span data-to="'+d.mins+'">0</span><small> min</small></b></div>'+
    '<div class="stat hot up1 d3"><span>New PRs</span><b data-to="'+d.prs.length+'">0</b></div></div>'+
    (d.prs.length?'<div class="prs up1 d4">'+d.prs.slice(0,3).map(p=>'<div><span>'+esc(p.name)+'</span><b>'+wl(p.w)+' × '+p.r+' · +'+kg(p.delta)+' kg</b></div>').join("")+'</div>':'')+
    '<div class="week up1 d5">'+(d.week===1?"1st":d.week===2?"2nd":d.week===3?"3rd":d.week+"th")+' workout '+(d.past&&weekOf(d.date)!==weekOf(dkey(new Date()))?"that week":"this week")+dots+'</div>'+
    '<div class="acts up1 d5"><button class="btn wide" data-cele="done">Done</button><button class="link" data-cele="replay">Replay celebration</button></div></div>';
  el.hidden=false;document.body.classList.add("celebrating");el.scrollTop=0;
  el.setAttribute("aria-labelledby","celeTitle");
  const still=matchMedia("(prefers-reduced-motion: reduce)").matches,nums=[...el.querySelectorAll("[data-to]")],t0=performance.now()+700;
  cancelAnimationFrame(celeRaf);
  const step=now=>{const p=still?1:Math.max(0,Math.min(1,(now-t0)/1300)),e=1-Math.pow(1-p,3);
    nums.forEach(n=>n.textContent=fmt(+n.dataset.to*e));if(p<1)celeRaf=requestAnimationFrame(step)};
  celeRaf=requestAnimationFrame(step);
  try{if(navigator.vibrate)navigator.vibrate([30,40,60])}catch(e){}
  setTimeout(()=>{const b=el.querySelector('[data-cele="done"]');if(b)b.focus({preventScroll:true})},1600);
}
function closeCele(){const el=document.getElementById("cele");el.hidden=true;el.innerHTML="";document.body.classList.remove("celebrating");cancelAnimationFrame(celeRaf);go("workout")}
document.getElementById("cele").addEventListener("click",e=>{const b=e.target.closest("[data-cele]");if(!b)return;if(b.dataset.cele==="done")closeCele();else{celeRun++;showCele()}});

function finish(){
  const A=S.active;cleanActive();
  if(!A.ex.length){S.active=null;markState();render();return}
  let prs=0;const prList=[];
  for(const e of A.ex){const b=bestW(e.name,A.id);if(b>0&&Math.max(...e.sets.map(s=>s.w))>b){prs++;prList.push(e.name)}}
  const w={id:A.id,date:A.date,start:A.start,end:A.past?A.start+A.mins*60000:Date.now(),parts:A.parts.filter(p=>A.ex.some(e=>e.part===p)),ex:A.ex};
  if(!w.parts.length)w.parts=A.parts;
  S.workouts.push(w);S.active=null;
  const prDetail=[];
  for(const e of w.ex){const b=bestW(e.name,w.id,w.date),top=e.sets.reduce((m,s)=>s.w>m.w||(s.w===m.w&&s.r>m.r)?s:m,e.sets[0]);if(b>0&&top.w>b)prDetail.push({name:e.name,w:top.w,r:top.r,delta:top.w-b})}
  const wk=weekOf(w.date),inWeek=S.workouts.filter(x=>weekOf(x.date)===wk),days=[0,0,0,0,0,0,0];
  inWeek.forEach(x=>{days[(parse(x.date).getDay()+6)%7]=1});
  markUp(w.id);markState();
  celebrate({past:!!A.past,date:w.date,vol:volOf(w),sets:allSets(w).length,mins:Math.max(1,Math.round((w.end-(w.start||w.end))/60000)),prs:prDetail,parts:w.parts,week:inWeek.length,days,dayName:parse(w.date).toLocaleDateString(undefined,{weekday:"long"})});
  render();
}
app.addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;
  const d=b.dataset,A=S.active;
  if(d.auth){authMode=d.auth;authMsg="";render();return}
  if(d.logdate){logDate=d.logdate==="today"?null:d.logdate;render();return}
  if(d.zoom){const A2=S.active;if(A2&&A2.ex[A2.cur])openZoom(A2.ex[A2.cur].name,A2.ex[A2.cur].part);return}
  if(d.themepick){applyTheme(d.themepick);S.profile=Object.assign({},S.profile,{theme:d.themepick});markState();render();return}
  if(d.start){startWorkout(d.start);return}
  if(d.tabGo){go(d.tabGo);return}
  if(d.pick){pickPart=d.pick;render();return}
  if(d.addpart){A.parts.push(d.addpart);pickPart=d.addpart;showAllParts=false;markState();render();return}
  if(d.ex){openEx(d.ex,d.part);return}
  if(d.step){const k=d.step,v=parseFloat(String(draft[k]).replace(",","."))||0,n=Math.max(0,Math.round((v+parseFloat(d.d))*100)/100);draft[k]=k==="r"?String(Math.round(n)):kg(n);render();return}
  if(d.delset!=null){A.ex[A.cur].sets.splice(+d.delset,1);markState();render();return}
  if(d.period){period=d.period;render();return}
  if(d.open){openId=openId===d.open?null:d.open;render();return}
  if(d.delw){
    const w=S.workouts.find(x=>x.id===d.delw);if(!w)return;
    S.workouts=S.workouts.filter(x=>x!==w);openId=null;markDel(w.id);render();
    toast("Workout deleted",()=>{if(!S.workouts.some(x=>x.id===w.id))S.workouts.push(w);markUp(w.id);render()});return}
  switch(d.act){
    case"logset":{
      const w=parseFloat(String(draft.w).replace(",",".")),r=parseInt(draft.r,10);
      if(!(w>=0)||!(r>0)){msgText="Enter a weight (0 for bodyweight) and at least 1 rep.";render();return}
      A.ex[A.cur].sets.push({w:Math.round(w*100)/100,r});popSet=true;markState();render();break}
    case"doneex":cleanActive();draft={w:"",r:""};markState();render();window.scrollTo(0,0);break;
    case"backex":cleanActive();markState();render();break;
    case"finish":finish();break;
    case"toggleParts":showAllParts=!showAllParts;render();break;
    case"discard":{const prev=S.active;S.active=null;pickPart=null;markState();render();window.scrollTo(0,0);
      toast("Workout discarded",()=>{if(!S.active){S.active=prev;markState();render()}});break}
    case"syncnow":setSync("saving");syncNow();break;
    case"signout":signOut();break;
    case"google":googleSignIn();break;

    case"resetmail":
      if(!navigator.onLine){acctMsg.reset="You’re offline. Connect to the internet first.";render();break}
      sendReset(user.email).then(()=>{acctMsg.reset="Reset link sent to "+user.email+". Check your spam folder too."}).catch(e=>{acctMsg.reset=friendly(e)}).then(()=>{if(tab==="account")render()});break;
  }
});
app.addEventListener("input",e=>{const k=e.target.dataset&&e.target.dataset.draft;if(k)draft[k]=e.target.value});
app.addEventListener("change",async e=>{
  if(e.target.id==="exSel"){progEx=e.target.value;render();return}
  if(e.target.id==="logDateIn"){const v=e.target.value,today=dkey(new Date());if(/^\d{4}-\d{2}-\d{2}$/.test(v)&&v<today){logDate=v}else if(v>=today){logDate=null;msgText=""}render();return}
  if(e.target.id==="pastMinsIn"){const n=parseInt(e.target.value,10);pastMins=n>0?Math.max(5,Math.min(300,n)):60;return}
});
app.addEventListener("submit",e=>{
  if(e.target.id==="authForm"){e.preventDefault();if(!authBusy)submitAuth();return}
  if(e.target.id==="nameForm"){e.preventDefault();saveName();return}
  if(e.target.id==="profileForm"){e.preventDefault();saveProfile();return}
  if(e.target.id==="pwForm"){e.preventDefault();if(!acctBusy)changePassword();return}
  if(e.target.id!=="customForm")return;e.preventDefault();
  const n=document.getElementById("customName").value.trim().replace(/\s+/g," ");if(!n)return;
  const A=S.active,part=pickPart&&A.parts.includes(pickPart)?pickPart:A.parts[A.parts.length-1];
  S.custom[part]=S.custom[part]||[];if(!S.custom[part].includes(n)&&!LIB[part].includes(n))S.custom[part].push(n);
  markState();openEx(n,part);
});
app.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.dataset&&e.target.dataset.draft){e.preventDefault();app.querySelector('[data-act="logset"]').click()}});
document.querySelector("nav").addEventListener("click",e=>{const b=e.target.closest("button");if(b){summary=null;go(b.dataset.tab)}});

/* ---------- Start-up ---------- */
async function signOut(){
  if(hasPending()&&navigator.onLine){setSync("saving");try{await timeout(flush(),6000)}catch(e){}}
  const id=user&&user.id;
  try{if(id)localStorage.removeItem("daanav-v1:"+id);localStorage.removeItem(LAST)}catch(e){}
  user=null;S=blank();tab="workout";summary=null;authMode="signin";authMsg="You’ve signed out.";setSync("idle");render();
  try{if(fbAuth)await FB.signOut(fbAuth)}catch(e){}
}
function handleSession(u){
  ready=true;
  if(!u){if(user){user=null;S=blank()}render();return}
  if(user&&user.id===u.id){if(!user.providers||!user.providers.length){user.providers=u.providers||[];user.phone=u.phone||user.phone}return}
  user={id:u.id,email:u.email||"",name:u.name||pendingName||"",phone:u.phone||"",providers:u.providers||[]};pendingName="";
  saveLast();
  loadCache();authMsg="";render();
  syncNow();
}
const FIREBASE_SDK="12.19.0";
async function boot(){
  const fc=CFG.firebase||{};
  if(!fc.apiKey||!fc.projectId||/YOUR[-_]/i.test(JSON.stringify(fc))){bootError="Open config.js and paste your Firebase web app config, then upload the files again.";render();return}
  try{
    const u=n=>"https://www.gstatic.com/firebasejs/"+FIREBASE_SDK+"/firebase-"+n+".js";
    const[A,Au,F]=await Promise.all([import(u("app")),import(u("auth")),import(u("firestore"))]);
    FB=Object.assign({},A,Au,F);
  }catch(e){
    let last=null;try{last=JSON.parse(localStorage.getItem(LAST)||"null")}catch(e2){}
    if(last&&last.id){ready=true;user=last;loadCache();setSync("offline");render();
      addEventListener("online",()=>location.reload(),{once:true});return}
    bootError="Couldn’t load the sign-in library. Check your internet connection and reload the app.";render();return;
  }
  const fapp=FB.initializeApp(fc);
  fbAuth=FB.getAuth(fapp);fdb=FB.getFirestore(fapp);
  render();
  FB.onAuthStateChanged(fbAuth,u=>setTimeout(()=>handleSession(u?{id:u.uid,email:u.email||"",name:u.displayName||"",phone:u.phoneNumber||"",providers:(u.providerData||[]).map(p=>p.providerId)}:null),0));
  addEventListener("online",()=>{setSync("saving");syncNow()});
  addEventListener("offline",()=>setSync("offline"));
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&user)syncNow()});
}
if("serviceWorker" in navigator&&location.protocol==="https:")navigator.serviceWorker.register("sw.js").catch(()=>{});
boot();
}
