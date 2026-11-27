{
const CFG=window.DAANAV_CONFIG||{};
const LAST="daanav-last-user",GUEST="daanav-guest";
let authOpen=false;
const isGuest=()=>!!(user&&user.guest);
function guestFlag(){try{return localStorage.getItem(GUEST)==="1"}catch(e){return false}}
function enterGuest(){try{localStorage.setItem(GUEST,"1")}catch(e){}user={id:"guest",guest:true,name:"",email:"",providers:[]};authOpen=false;authMsg="";tab="workout";loadCache();setSync("idle");render();window.scrollTo(0,0)}
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
  document.documentElement.dataset.theme=t;
  setTimeout(()=>fitText(),0);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>fitText());
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
function queue(){save();if(isGuest())return;lbSoon();setSync(navigator.onLine?"saving":"offline");clearTimeout(flushTimer);flushTimer=setTimeout(flush,700)}

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
  if(!fdb||!user||isGuest()||flushing)return;
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
  if(!fdb||!user||isGuest()||!navigator.onLine)return;
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
    return (user.name||isGuest()?'':nameCard(true))+dateCard+'<section class="card"><h2>Pick a body part</h2><p class="sub">You can add more body parts once you’ve started.</p><div class="parts">'+
      PARTS.map(p=>'<button class="part" data-start="'+p+'"><b>'+p+'</b><small>'+lastTrained(p)+'</small></button>').join("")+
      '</div></section><section class="card"><h3>This week</h3><div class="tiles">'+tile("Workouts",ws.length)+tile("Volume",fmt(ws.reduce((a,w)=>a+volOf(w),0))+" kg")+'</div></section>';
  }
  if(A.cur!=null&&A.ex[A.cur]) return viewLogger(A);
  setHead(long(A.date)+(A.past?" · past workout":""),A.parts.join(" + "));
  const part=pickPart&&A.parts.includes(pickPart)?pickPart:A.parts[A.parts.length-1];
  const doneNames=A.ex.filter(e=>e.sets.length).map(e=>e.name);
  const first=!A.ex.some(e=>e.sets.length);
  const todayK=dkey(new Date());
  let h='<section class="card datecard"><div class="daterow"><h3>Workout date</h3><label class="chip datepick on"><span>'+(A.date===todayK?"Today":esc(short(A.date)))+'</span>'+
    '<input type="date" id="actDateIn" max="'+todayK+'" min="2015-01-01" value="'+A.date+'" aria-label="Change workout date"></label></div>'+
    (A.past?'<div class="durrow"><label for="actMinsIn">How long was it?</label><span><input type="number" id="actMinsIn" inputmode="numeric" min="5" max="300" step="5" value="'+(A.mins||60)+'"> min</span></div>':'')+'</section>';
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
    return '<button class="ex'+(done?" done":"")+'" data-ex="'+esc(n)+'" data-part="'+part+'"><span class="thumb" aria-hidden="true">'+(exData(n)?'<img src="'+exData(n).img[0]+'" alt="" loading="lazy">':figSvg(n,part,false))+'</span><span class="exn"><b>'+esc(n)+'</b><small>'+hint+'</small></span><span class="go">›</span></button>';
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
  let h='<section class="card"><div class="form"><button class="fig2" data-zoom="1" aria-label="Open how-to for '+esc(E.name)+'">'+photoHtml(E.name,E.part,false)+'<span class="zoomhint" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5M11 8v6M8 11h6"/></svg></span></button><div><b>How to</b><p>'+esc(figCue(E.name,E.part))+'</p>'+
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
/* ---------- Consistency: calendar + week streak ---------- */
/* Activity icons. Every workout is "gym" today; yoga, running etc. can add their own icon here. */
const ACT_ICON={gym:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></svg>'};
const actOf=w=>(w&&w.type)||"gym";
const actIcon=t=>ACT_ICON[t]||ACT_ICON.gym;
const dayAct=k=>{const w=S.workouts.find(x=>x.date===k);return actOf(w)};
const trainedDays=()=>new Set(S.workouts.map(w=>w.date));
function weekStreak(){
  const wk=new Set(S.workouts.map(w=>weekOf(w.date))),d=parse(weekOf(dkey(new Date())));
  if(!wk.has(dkey(d)))d.setDate(d.getDate()-7);
  let n=0;while(wk.has(dkey(d))){n++;d.setDate(d.getDate()-7)}return n;
}
function bestWeekStreak(){
  const ws=[...new Set(S.workouts.map(w=>weekOf(w.date)))].sort();let best=0,run=0,prev=null;
  for(const k of ws){let nx=null;if(prev){const p=parse(prev);p.setDate(p.getDate()+7);nx=dkey(p)}run=nx===k?run+1:1;best=Math.max(best,run);prev=k}
  return best;
}
const monthDays=ym=>{let n=0;trainedDays().forEach(k=>{if(k.slice(0,7)===ym)n++});return n};
const monthName=(ym,o)=>{const[y,m]=ym.split("-").map(Number);return new Date(y,m-1,1).toLocaleDateString(undefined,o||{month:"long",year:"numeric"})};
function calHtml(ym,small){
  const[y,m]=ym.split("-").map(Number),lead=(new Date(y,m-1,1).getDay()+6)%7,n=new Date(y,m,0).getDate(),t=trainedDays(),today=dkey(new Date());
  let h='<div class="cal'+(small?' sm':'')+'" role="grid" aria-label="'+esc(monthName(ym))+'">'+["M","T","W","T","F","S","S"].map(l=>'<b aria-hidden="true">'+l+'</b>').join("");
  for(let i=0;i<lead;i++)h+='<span class="pad"></span>';
  for(let d=1;d<=n;d++){const k=ym+"-"+pad(d),on=t.has(k),tag=on&&!small?"button":"span";
    h+='<'+tag+(on&&!small?' data-calday="'+k+'"':'')+' class="'+[on?"on":"",k===today?"today":"",k>today?"fut":""].join(" ").trim()+'" aria-label="'+esc(short(k))+(on?', workout':'')+'">'+(on?'<i>'+actIcon(dayAct(k))+'</i>':'<em>'+d+'</em>')+'</'+tag+'>'}
  return h+'</div>';
}
let calYm=null;
function consistencyCard(){
  const cur=monthOf(dkey(new Date()));if(!calYm||calYm>cur)calYm=cur;
  const first=S.workouts.length?sorted()[0].date.slice(0,7):cur,st=weekStreak(),md=monthDays(calYm);
  return '<section class="card"><h3>Consistency</h3><div class="tiles c3">'+
    tile("Week streak",st,'<em>'+(st?"in a row":"train to start")+'</em>')+
    tile("Days trained",md,'<em>'+(calYm===cur?"this month":"in "+monthName(calYm,{month:"short"}))+'</em>')+
    tile("Best streak",bestWeekStreak(),'<em>weeks</em>')+'</div>'+
    '<div class="calnav"><button data-calm="-1" aria-label="Previous month"'+(calYm<=first?" disabled":"")+'>‹</button><b>'+esc(monthName(calYm))+'</b><button data-calm="1" aria-label="Next month"'+(calYm>=cur?" disabled":"")+'>›</button></div>'+
    calHtml(calYm)+'<p class="sub" style="margin:10px 0 0">A week counts toward your streak if you train at least once in it. Tap a marked day to open that workout.</p></section>';
}
/* Getting stronger: best estimated 1RM (or reps, for bodyweight) this period vs everything before it. */
function strongerCard(cur,c){
  const before={},now={};
  for(const w of S.workouts){const k=keyOf(w),tgt=k===cur?now:k<cur?before:null;if(!tgt)continue;
    for(const e of w.ex)for(const st of e.sets){const bw=!st.w,v=bw?st.r:e1rm(st);const o=tgt[e.name];
      if(!o||(o.bw&&!bw)||(o.bw===bw&&v>o.v))tgt[e.name]={v,bw}}}
  const rows=Object.keys(now).map(n=>{const a=now[n],b=before[n];const same=b&&b.bw===a.bw;return{n,a,d:same?a.v-b.v:null}});
  if(!rows.length)return '<section class="card"><h3>Getting stronger</h3><p class="sub">Train '+(period==="week"?"this week":"this month")+' to see which lifts went up.</p></section>';
  rows.sort((x,y)=>(y.d==null?-1e9:y.d)-(x.d==null?-1e9:x.d)||x.n.localeCompare(y.n));
  const comp=rows.filter(r=>r.d!=null),up=comp.filter(r=>r.d>0.01).length;
  const val=r=>r.a.bw?pl(r.a.v,"rep"):kg(Math.round(r.a.v*2)/2)+' kg';
  const dl=r=>r.d==null?'<span class="mute">first time</span>':Math.abs(r.d)<0.01?'<span class="mute">same</span>':'<span class="'+(r.d>0?"up":"down")+'">'+(r.d>0?"▲ +":"▼ ")+(r.a.bw?Math.abs(Math.round(r.d))+(Math.abs(Math.round(r.d))===1?" rep":" reps"):kg(Math.round(Math.abs(r.d)*2)/2)+' kg')+'</span>';
  return '<section class="card"><h3>Getting stronger</h3><p class="sub">'+(comp.length?'<b>'+up+' of '+comp.length+'</b> lifts beat your previous best '+(period==="week"?"this week":"this month")+'. ':'')+'Compared using estimated 1-rep max (best reps for bodyweight moves).</p>'+
    '<div class="strong">'+rows.slice(0,6).map(r=>'<div><span class="sn">'+esc(r.n)+'</span><b class="num">'+val(r)+'</b>'+dl(r)+'</div>').join("")+'</div>'+
    (rows.length>6?'<p class="sub" style="margin:8px 0 0">+'+(rows.length-6)+' more below in Personal records.</p>':'')+'</section>';
}
/* Hard sets per muscle this week, against the common 10–20 sets/week guideline. */
function muscleSetsCard(){
  const wk=weekOf(dkey(new Date())),sets={};
  for(const w of S.workouts)if(weekOf(w.date)===wk)for(const e of w.ex)sets[e.part]=(sets[e.part]||0)+e.sets.length;
  const parts=Object.keys(LIB),max=Math.max(24,...Object.values(sets));
  const tag=v=>v===0?'<span class="mute">–</span>':v<10?'<span class="lo">'+v+'</span>':v<=20?'<span class="ok">'+v+'</span>':'<span class="hi">'+v+'</span>';
  return '<section class="card"><h3>Sets per muscle this week</h3><p class="sub">Most lifters grow best with about <b>10–20 sets per muscle each week</b>. The shaded band shows that range.</p>'+
    '<div class="msets">'+parts.map(k=>{const v=sets[k]||0;return '<div class="hrow"><span>'+k+'</span><span class="track band" style="--b0:'+(10/max*100)+'%;--b1:'+(20/max*100)+'%"><i class="'+(v<10?"lo":v<=20?"ok":"hi")+'" style="width:'+(v/max*100)+'%"></i></span>'+tag(v)+'</div>'}).join("")+'</div>'+
    '<p class="sub legend"><span class="lo">●</span> under 10 &nbsp; <span class="ok">●</span> 10–20 &nbsp; <span class="hi">●</span> over 20</p></section>';
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
    tile("New PRs",prsIn(cur),'<em>heavier than ever before</em>')+tile("Workouts",c.n,chip(ch(c.n,p.n),lbl))+
    tile("Sets",c.sets,chip(ch(c.sets,p.sets),lbl))+tile("Volume (kg)",fmt(c.vol),'<em class="note">weight × reps</em>'+chip(ch(c.vol,p.vol),lbl))+'</div>'+
    '<button class="btn wide sharebtn recapbtn" data-act="sharerecap">'+SHARE_ICON+'Share my '+(period==="week"?"week":"month")+' to story</button></section>';
  h+=consistencyCard();
  h+=strongerCard(cur,c);
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
  h+=muscleSetsCard();
  const max=Math.max(1,...keys.map(k=>by[k].vol));
  h+='<section class="card"><h3>Volume per '+period+'</h3><p class="sub">Weight × reps, added up across all sets. Useful for comparing the same kind of workout over time. Heavy leg moves count far more than arm moves, and bodyweight moves count as 0.</p><div class="bars">'+keys.map((k,i)=>
    '<div class="bar'+(k===cur?" cur":"")+'"><i style="height:'+(by[k].vol/max*100)+'%">'+(by[k].vol?'<b>'+(by[k].vol>=1000?(by[k].vol/1000).toFixed(1)+"k":fmt(by[k].vol))+'</b>':'')+'</i><span>'+plabel(k,i,keys)+'</span></div>').join("")+'</div></section>';
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
  let h='<button class="card pastbtn" data-act="logpast"><span class="pbi" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4M12 13v4M10 15h4"/></svg></span>'+
    '<span class="pbt"><b>Log a past workout</b><small>Forgot to log a session? Add it for any earlier day.</small></span><span class="go" aria-hidden="true">›</span></button>';
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
const SIGNOUT_ICON='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/></svg>';
function guestBanner(compact){
  return '<section class="card guestnote'+(compact?' compact':'')+'"><div class="gn-t"><b>You’re trying Daanav</b><small>Workouts are saved only on this phone. Sign up free to keep your progress safe and track it on any device.</small></div>'+
    '<button class="btn gn-b" data-act="guestsignup">Sign up free</button></section>';
}
function viewGuestAccount(){
  setHead("Account","Trying without an account");
  const n=S.workouts.length;
  let h='<section class="card guestnote big"><div class="gn-t"><b>Sign up free to monitor your progress properly</b><small>Right now '+(n?n+' workout'+(n===1?' is':'s are'):'everything is')+' saved only on this phone. Clearing Safari data or losing the phone loses it. Create a free account and your workouts so far move into it automatically.</small></div>'+
    '<button class="btn wide" data-act="guestsignup">Create free account</button><button class="link" data-act="guestsignin" style="margin-top:6px">I already have an account · Sign in</button></section>';
  const ct=curTheme();
  h+='<section class="card"><h3>Theme</h3><div class="themes" role="radiogroup" aria-label="App theme">'+THEMES.map(t=>
    '<button class="theme" role="radio" aria-checked="'+(t.id===ct)+'" data-themepick="'+t.id+'"><span class="sw" style="background:'+t.bg+';color:'+t.fg+';font:'+t.font+'">Aa</span>'+
    '<span><b>'+t.name+(t.id==="red"?' <small style="display:inline;font-weight:600">· default</small>':'')+'</b><small>'+t.desc+'</small></span>'+
    '<span class="tick" aria-hidden="true">'+(t.id===ct?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>':'')+'</span></button>').join("")+'</div></section>';
  h+='<section class="card"><button class="btn danger wide" data-act="guestexit">'+SIGNOUT_ICON+'Leave trial mode</button><p class="sub" style="margin:10px 0 0">Your trial workouts stay on this phone and come back if you try again or sign up.</p></section>';
  return h;
}
function viewAccount(){
  if(isGuest())return viewGuestAccount();
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
  h+='<section class="card"><button class="btn danger wide" data-act="signout">'+SIGNOUT_ICON+'Sign out</button>'+
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
function saveLast(){if(isGuest())return;try{localStorage.setItem(LAST,JSON.stringify(user))}catch(e){}}

/* ---------- Undo toast ---------- */
let undoFn=null,toastTimer=null;
function toast(msg,fn){
  const t=document.getElementById("toast");document.getElementById("toastMsg").textContent=msg;
  undoFn=fn;document.getElementById("toastUndo").hidden=!fn;t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{t.hidden=true;undoFn=null},6000);
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
  if(isGuest())h+='<section class="card tryapp"><button class="btn ghost wide" data-act="guestback">← Back to the app</button><p class="sub" style="margin:10px 0 0">Your trial workouts move into your account when you sign up or sign in.</p></section>';
  else if(authMode!=="forgot"&&CONF.general.guestMode)h+='<section class="card tryapp"><b>Just want to look around?</b><p class="sub">Try Daanav without an account. Your workouts stay on this phone, and you can sign up any time to keep them.</p><button class="btn ghost wide" data-act="guesttry">Try without signing up</button></section>';
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
  const signedIn=!!user&&authMode!=="reset"&&!(isGuest()&&authOpen);
  document.body.classList.toggle("noauth",!signedIn);
  setSync(syncState);
  document.getElementById("hello").textContent=signedIn&&firstName()?"Hi, "+firstName():"";
  const mb=document.getElementById("menuBtn");mb.hidden=!signedIn;
  document.getElementById("backBtn").hidden=!(signedIn&&["account","plans","invite","admin"].includes(tab));
  if(signedIn){const nm=isGuest()?"G":((user.name||user.email||"D").trim()[0]||"D").toUpperCase();mb.querySelector(".av").textContent=nm}
  if(!signedIn){app.innerHTML=viewAuth();return}
  if(tab==="admin"&&!isAdmin())tab="account";
  if(tab==="invite"&&(isGuest()||!(CONF.referral.enabled||isAdmin())))tab="account";
  if(tab==="plans"&&!(CONF.pricing.enabled||isAdmin()))tab="account";
  const v=tab==="leaderboard"?viewLeaderboard():tab==="workout"?viewWorkout():tab==="progress"?viewProgress():tab==="history"?viewHistory():tab==="admin"?viewAdmin():tab==="plans"?viewPlans():tab==="invite"?viewInvite():viewAccount();
  const ann=CONF.general.announcement&&tab!=="admin"?'<section class="card announce" role="status">'+esc(CONF.general.announcement)+'</section>':'';
  app.innerHTML=ann+(isGuest()&&!["account","plans"].includes(tab)?guestBanner(tab!=="workout"):'')+v;
  fitText(app);
  document.querySelectorAll("nav button").forEach(b=>{b.classList.toggle("on",b.dataset.tab===tab);b.setAttribute("aria-current",b.dataset.tab===tab?"page":"false")});
  ro.disconnect();const f=document.getElementById("fig");if(f){ro.observe(f);drawChart()}
  msgText="";
}
/* ---------- Back button / swipe-back: every screen and pop-up gets a history entry ---------- */
const NAV=window.history;let skipPop=0;
const navState=()=>NAV.state||{};
function navPush(extra){try{NAV.pushState(Object.assign({tab},extra||{}),"")}catch(e){}}
function navReplace(st){try{NAV.replaceState(st,"")}catch(e){}}
function navPopIf(key,val){if(navState()[key]===val){skipPop++;NAV.back()}}
try{NAV.replaceState({tab:"workout",root:1},"")}catch(e){}
addEventListener("popstate",e=>{
  if(skipPop){skipPop--;return}
  const st=e.state||{},sh=document.getElementById("share"),z=document.getElementById("zoom"),ce=document.getElementById("cele");
  if(!sh.hidden){sh.hidden=true;return}
  if(!z.hidden){closeZoom(true);return}
  if(!drawer.hidden){closeDrawer(true);return}
  if(!ce.hidden){closeCele(true);return}
  if(!user){if(authMode!=="signin"){authMode="signin";authMsg="";render()}return}
  if(isGuest()&&authOpen){authOpen=false;authMsg="";render();return}
  const A=S.active;
  if(A&&A.cur!=null&&tab==="workout"&&!st.ex){cleanActive();markState();render();window.scrollTo(0,0);return}
  const t=st.tab||"workout";
  if(t!==tab)go(t,true);else render();
});
function goBack(){const s=navState();if(!s.root&&s.tab===tab)NAV.back();else go("workout")}
function go(t,noPush){if(!noPush&&t!==tab)try{NAV.pushState({tab:t},"")}catch(e){}tab=t;render();window.scrollTo(0,0);app.classList.remove("enter");void app.offsetWidth;app.classList.add("enter");clearTimeout(go.t);go.t=setTimeout(()=>app.classList.remove("enter"),700)}
function startWorkout(p){
  const today=dkey(new Date()),past=logDate&&logDate<today?logDate:null;
  S.active=past?{id:uid(),date:past,start:parse(past).setHours(18,0,0,0),past:true,mins:Math.max(5,Math.min(300,pastMins||60)),parts:[p],ex:[],cur:null}
    :{id:uid(),date:today,start:Date.now(),parts:[p],ex:[],cur:null};
  logDate=null;pickPart=p;showAllParts=false;markState();render();window.scrollTo(0,0);
}
function openEx(name,part){
  const A=S.active;let i=A.ex.findIndex(e=>e.name===name);
  if(i<0){A.ex.push({name,part,sets:[]});i=A.ex.length-1}
  A.cur=i;draft={w:"",r:""};navPush({ex:1});markState();render();window.scrollTo(0,0);
}
function cleanActive(){const A=S.active;A.ex=A.ex.filter(e=>e.sets.length);A.cur=null}
/* ---------- Auto-fit: shrink labels and numbers until they fit on one line ---------- */
const FIT=".part b,.tile b,.cele .stat b";
function fitText(root){
  (root||document).querySelectorAll(FIT).forEach(el=>{
    el.style.fontSize="";
    let fs=parseFloat(getComputedStyle(el).fontSize),guard=0;
    while(el.scrollWidth>el.clientWidth+0.5&&fs>11&&guard++<40){fs-=1;el.style.fontSize=fs+"px"}
  });
}
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>fitText());
addEventListener("resize",()=>{clearTimeout(fitText.t);fitText.t=setTimeout(()=>fitText(),120)});

/* ---------- Exercise photos (start ↔ end crossfade) ---------- */
function exData(name){return window.EXDATA&&EXDATA[name]||null}
function photoHtml(name,part,big){
  const d=exData(name);
  if(!d)return figSvg(name,part,true);
  return '<span class="ph'+(big?" big":"")+'"><img src="'+d.img[0]+'" alt="'+esc(name)+', start position"'+(big?'':' loading="lazy"')+'><img class="ph-b" src="'+d.img[1]+'" alt="'+esc(name)+', end position"'+(big?'':' loading="lazy"')+'></span>';
}

/* ---------- How-to zoom ---------- */
function openZoom(name,part){
  const z=document.getElementById("zoom"),mus=figMuscles(name,part),L=figMuscleLabel;
  z.innerHTML='<div class="zwrap"><div class="zbar"><b>'+esc(name)+'</b><button class="zclose" data-zclose="1" aria-label="Close">×</button></div>'+
    '<div class="zstage">'+photoHtml(name,part,true)+'</div>'+
    (exData(name)?'<div class="seg zseg" role="group" aria-label="Show position"><button data-zpos="play" class="on">Play</button><button data-zpos="0">Start</button><button data-zpos="1">End</button></div>':'')+
    '<div class="zcard"><h3>How to</h3>'+(exData(name)?'<ol>'+exData(name).steps.map(s=>'<li>'+esc(s)+'</li>').join("")+'</ol>':'<p>'+esc(figCue(name,part))+'</p>')+'</div>'+
    '<div class="zcard"><h3>Muscles worked</h3><div class="zmus">'+mus.map(m=>'<span>'+L[m]+'</span>').join("")+'</div></div>'+
    '<div class="zcard"><h3>Tips</h3><ul>'+figTips(name,part).map(t=>'<li>'+esc(t)+'</li>').join("")+'</ul></div>'+
    '<button class="btn wide" data-zclose="1">Got it</button></div>';
  z.hidden=false;document.body.classList.add("celebrating");z.scrollTop=0;navPush({ov:"zoom"});
  setTimeout(()=>{const b=z.querySelector(".zclose");if(b)b.focus({preventScroll:true})},50);
}
function closeZoom(fromPop){const z=document.getElementById("zoom");if(z.hidden)return;if(fromPop!==true)navPopIf("ov","zoom");z.hidden=true;z.innerHTML="";document.body.classList.remove("celebrating");render()}
document.getElementById("zoom").addEventListener("click",e=>{
  if(e.target.closest("[data-zclose]")||e.target.id==="zoom"){closeZoom();return}
  const p=e.target.closest("[data-zpos]");if(!p)return;
  const z=document.getElementById("zoom"),ph=z.querySelector(".ph");if(!ph)return;
  z.querySelectorAll("[data-zpos]").forEach(b=>b.classList.toggle("on",b===p));
  ph.classList.remove("show0","show1");if(p.dataset.zpos!=="play")ph.classList.add("show"+p.dataset.zpos);
});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeZoom()});

/* ---------- Workout-complete celebration ---------- */
let celeData=null,celeRun=0,celeRaf=0;
function celebrate(d){celeData=d;celeRun=0;showCele();navPush({ov:"cele"})}
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
  const dots='<div class="dots">'+["M","T","W","T","F","S","S"].map((l,i)=>'<i class="'+(d.days[i]?"on":"")+'" style="animation-delay:'+(1.5+i*.08)+'s">'+(d.days[i]?actIcon("gym"):l)+'</i>').join("")+'</div>';
  el.innerHTML='<div class="fx" aria-hidden="true">'+fx+'</div><div class="wrap"><div class="hero" aria-hidden="true">'+hero+'</div>'+
    '<div class="kick">'+esc(H.kick)+'</div><h2 id="celeTitle">'+H.h+'</h2><p class="say up1 d1">'+esc(msg)+'</p>'+
    '<div class="stats"><div class="stat up1 d2"><span>Total lifted</span><b><span data-to="'+d.vol+'">0</span><small> kg</small></b></div>'+
    '<div class="stat up1 d2"><span>Sets</span><b data-to="'+d.sets+'">0</b></div>'+
    '<div class="stat up1 d3"><span>Time</span><b><span data-to="'+d.mins+'">0</span><small> min</small></b></div>'+
    '<div class="stat hot up1 d3"><span>New PRs</span><b data-to="'+d.prs.length+'">0</b></div></div>'+
    (d.prs.length?'<div class="prs up1 d4">'+d.prs.slice(0,3).map(p=>'<div><span>'+esc(p.name)+'</span><b>'+wl(p.w)+' × '+p.r+' · +'+kg(p.delta)+' kg</b></div>').join("")+'</div>':'')+
    '<div class="week up1 d5">'+(d.week===1?"1st":d.week===2?"2nd":d.week===3?"3rd":d.week+"th")+' workout '+(d.past&&weekOf(d.date)!==weekOf(dkey(new Date()))?"that week":"this week")+dots+'<div class="streak"><span><b>'+d.streak+'</b> week streak</span><span><b>'+d.monthDays+'</b> '+(d.monthDays===1?"day":"days")+' in '+esc(monthName(monthOf(d.date),{month:"long"}))+'</span></div></div>'+
    '<div class="acts up1 d5"><button class="btn wide sharebtn" data-cele="share">'+SHARE_ICON+'Share to your story</button><button class="btn wide ghostc" data-cele="done">Done</button><button class="link" data-cele="replay">Replay celebration</button></div></div>';
  el.hidden=false;document.body.classList.add("celebrating");el.scrollTop=0;
  el.setAttribute("aria-labelledby","celeTitle");
  const still=matchMedia("(prefers-reduced-motion: reduce)").matches,nums=[...el.querySelectorAll("[data-to]")],t0=performance.now()+700;
  cancelAnimationFrame(celeRaf);
  const step=now=>{const p=still?1:Math.max(0,Math.min(1,(now-t0)/1300)),e=1-Math.pow(1-p,3);
    nums.forEach(n=>n.textContent=fmt(+n.dataset.to*e));if(p<1)celeRaf=requestAnimationFrame(step);else fitText(el)};
  celeRaf=requestAnimationFrame(step);
  try{if(navigator.vibrate)navigator.vibrate([30,40,60])}catch(e){}
  setTimeout(()=>{const b=el.querySelector('[data-cele="done"]');if(b)b.focus({preventScroll:true})},1600);
}
function closeCele(fromPop){if(fromPop!==true)navPopIf("ov","cele");const el=document.getElementById("cele");el.hidden=true;el.innerHTML="";document.body.classList.remove("celebrating");cancelAnimationFrame(celeRaf);go("workout",true)}
document.getElementById("cele").addEventListener("click",e=>{const b=e.target.closest("[data-cele]");if(!b)return;if(b.dataset.cele==="done")closeCele();else if(b.dataset.cele==="share")openShare(workoutSpec(celeData));else{celeRun++;showCele()}});

/* ---------- Share workout as an Instagram / WhatsApp story image ---------- */
const APP_URL="aggvishal.github.io/daanav";
const SHARE_ICON='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>';
let shareBlob=null,shareUrl="";
const STORY={
  red:{bg:["#3A0A12","#140A0C"],ink:"#FFFFFF",mute:"rgba(255,255,255,.62)",acc:"#E11D2E",accInk:"#FFFFFF",hot:"#F5B83D",hotInk:"#3A2300",card:"rgba(255,255,255,.07)",line:"rgba(255,255,255,.12)",disp:"800 {s}px 'Barlow Condensed',sans-serif",h:["DAANAV","UNLEASHED"]},
  iron:{bg:["#1A1A20","#0E0E11"],ink:"#F4F1EC",mute:"rgba(244,241,236,.6)",acc:"#FF5A1F",accInk:"#0E0E11",hot:"#FFB020",hotInk:"#0E0E11",card:"rgba(255,255,255,.06)",line:"rgba(255,255,255,.1)",disp:"400 {s}px Anton,Impact,sans-serif",h:["BEAST","MODE."]},
  chalk:{bg:["#D4FF3A","#C6F22A"],ink:"#0B0B0B",mute:"rgba(11,11,11,.6)",acc:"#0B0B0B",accInk:"#D4FF3A",hot:"#0B0B0B",hotInk:"#D4FF3A",card:"rgba(11,11,11,.07)",line:"rgba(11,11,11,.14)",disp:"900 {s}px Archivo,sans-serif",h:["SESSION","CRUSHED."]}};
function rrect(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
function fitFont(c,txt,tpl,size,max){let s=size;c.font=tpl.replace("{s}",s);while(s>20&&c.measureText(txt).width>max){s-=2;c.font=tpl.replace("{s}",s)}return s}
/* A story spec: {dateLabel,kicker,h:[l1,l2],stats:[[label,value,unit,hot]],ym,cal:[days],mark:[days],streak,monthDays,rowsTitle,rows:[{name,right,badge}]} */
function workoutSpec(d){
  const prN=new Set(d.prs.map(p=>p.name));
  return{dateLabel:long(d.date).toUpperCase(),kicker:(d.parts.join(" + ")+" DAY").toUpperCase(),
    stats:[["LIFTED",fmt(d.vol),"kg"],["SETS",String(d.sets),""],["TIME",String(d.mins),"min"],["PRs",String(d.prs.length),"",d.prs.length>0]],
    ym:monthOf(d.date),cal:d.cal||[],mark:[+d.date.slice(8)],streak:d.streak,monthDays:d.monthDays,
    rows:(d.ex||[]).slice().sort((a,b)=>prN.has(b.name)-prN.has(a.name)).slice(0,4).map(r=>({name:r.name,right:(r.w?kg(r.w)+" kg":"BW")+" × "+r.r,badge:prN.has(r.name)?"PR":""}))};
}
async function drawStory(sp){
  const t=curTheme(),P=STORY[t],W=1080,H=1920,BODY="{s}px Inter,Barlow,sans-serif";
  try{if(document.fonts){await Promise.all([document.fonts.load(P.disp.replace("{s}",100)),document.fonts.load("600 40px Inter"),document.fonts.load("800 40px Inter")])}}catch(e){}
  const cv=document.createElement("canvas");cv.width=W;cv.height=H;const c=cv.getContext("2d");
  const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,P.bg[0]);g.addColorStop(1,P.bg[1]);c.fillStyle=g;c.fillRect(0,0,W,H);
  c.save();c.globalAlpha=t==="chalk"?.08:.18;c.fillStyle=t==="chalk"?"#0B0B0B":P.acc;
  for(let i=0;i<4;i++){c.beginPath();c.moveTo(W-420+i*110,0);c.lineTo(W-360+i*110,0);c.lineTo(W+40+i*110,520);c.lineTo(W-20+i*110,520);c.closePath();c.fill()}
  c.restore();
  const X=80,IW=W-160;c.textBaseline="alphabetic";
  // brand row
  c.fillStyle=P.acc;rrect(c,X,250,64,64,16);c.fill();
  c.strokeStyle=P.accInk;c.lineWidth=6;c.lineCap="round";c.beginPath();
  [[X+18,268,X+18,296],[X+46,268,X+46,296],[X+10,276,X+10,288],[X+54,276,X+54,288],[X+18,282,X+46,282]].forEach(a=>{c.moveTo(a[0],a[1]);c.lineTo(a[2],a[3])});c.stroke();
  c.fillStyle=P.ink;c.font=P.disp.replace("{s}",54);c.fillText("DAANAV",X+86,302);
  c.fillStyle=P.mute;c.font="600 "+BODY.replace("{s}",32);c.textAlign="right";fitFont(c,sp.dateLabel,"600 "+BODY,32,IW-330);c.fillText(sp.dateLabel,X+IW,298);c.textAlign="left";
  // kicker + headline
  c.fillStyle=t==="chalk"?P.ink:P.hot;fitFont(c,sp.kicker,"800 "+BODY,36,IW);c.fillText(sp.kicker,X,430);
  const HL=sp.h||P.h;c.fillStyle=P.ink;
  const hs=Math.min(fitFont(c,HL[0],P.disp,t==="iron"?140:150,IW),fitFont(c,HL[1],P.disp,t==="iron"?140:150,IW));c.font=P.disp.replace("{s}",hs);
  c.fillText(HL[0],X,430+hs*.98);c.fillStyle=t==="chalk"?P.ink:P.acc;c.fillText(HL[1],X,430+hs*1.9);
  // stats: one row of four
  let y=430+hs*1.9+60;const gap=20,cw=(IW-gap*3)/4,ch=170;
  sp.stats.forEach((st,i)=>{const sx=X+i*(cw+gap),hot=!!st[3];
    c.fillStyle=hot?P.hot:P.card;rrect(c,sx,y,cw,ch,28);c.fill();
    c.fillStyle=hot?P.hotInk:P.mute;fitFont(c,st[0],"700 "+BODY,24,cw-40);c.fillText(st[0],sx+24,y+46);
    c.fillStyle=hot?P.hotInk:P.ink;const ns=fitFont(c,st[1],P.disp,80,cw-48);c.font=P.disp.replace("{s}",ns);c.fillText(st[1],sx+24,y+126);
    if(st[2]){c.fillStyle=hot?P.hotInk:P.mute;c.font="700 "+BODY.replace("{s}",24);c.fillText(st[2],sx+24,y+156)}});
  y+=ch+30;
  // consistency: month calendar + week streak
  const cy=y,chh=410;c.fillStyle=P.card;rrect(c,X,cy,IW,chh,32);c.fill();
  const ym=sp.ym,[yy,mm]=ym.split("-").map(Number),lead=(new Date(yy,mm-1,1).getDay()+6)%7,nd=new Date(yy,mm,0).getDate(),on=new Set(sp.cal||[]),mk=new Set(sp.mark||[]),pitch=52,cs=44,gx=X+34,gy=cy+78;
  c.textAlign="center";c.fillStyle=P.mute;c.font="700 "+BODY.replace("{s}",24);
  ["M","T","W","T","F","S","S"].forEach((l,i)=>c.fillText(l,gx+i*pitch+cs/2,cy+56));
  for(let dd=1;dd<=nd;dd++){const ix=(lead+dd-1)%7,iy=Math.floor((lead+dd-1)/7),cx=gx+ix*pitch,cyy=gy+iy*pitch;
    if(on.has(dd)){c.fillStyle=t==="chalk"?"#0B0B0B":P.acc;rrect(c,cx,cyy,cs,cs,12);c.fill();
      c.strokeStyle=t==="chalk"?"#D4FF3A":P.accInk;c.lineWidth=4;c.lineCap="round";c.beginPath();
      [[13,14,13,30],[31,14,31,30],[8,18,8,26],[36,18,36,26],[13,22,31,22]].forEach(q=>{c.moveTo(cx+q[0],cyy+q[1]);c.lineTo(cx+q[2],cyy+q[3])});c.stroke()}
    else{c.strokeStyle=P.line;c.lineWidth=2;rrect(c,cx+1,cyy+1,cs-2,cs-2,12);c.stroke();c.fillStyle=P.mute;c.font="600 "+BODY.replace("{s}",20);c.fillText(String(dd),cx+cs/2,cyy+29)}
    if(mk.has(dd)){c.strokeStyle=P.hot;c.lineWidth=4;rrect(c,cx-5,cyy-5,cs+10,cs+10,15);c.stroke()}}
  c.textAlign="left";
  const rx=gx+7*pitch+40,rw=X+IW-30-rx,stk=sp.streak||0;
  c.fillStyle=P.mute;c.font="700 "+BODY.replace("{s}",24);c.fillText("CONSISTENCY",rx,cy+80);
  const sN=String(stk);c.fillStyle=t==="chalk"?P.ink:P.acc;const sz=fitFont(c,sN,P.disp,130,rw*0.5);c.font=P.disp.replace("{s}",sz);c.fillText(sN,rx,cy+215);
  const sw2=c.measureText(sN).width;c.fillStyle=P.ink;c.font="800 "+BODY.replace("{s}",30);c.fillText(stk===1?"WEEK":"WEEKS",rx+sw2+16,cy+175);c.fillText("STREAK",rx+sw2+16,cy+213);
  const dl=pl(sp.monthDays||0,"day")+" trained";c.fillStyle=P.ink;fitFont(c,dl,"800 "+BODY,38,rw);c.fillText(dl,rx,cy+300);
  c.fillStyle=P.mute;c.font="600 "+BODY.replace("{s}",28);c.fillText("in "+monthName(ym,{month:"long"}),rx,cy+342);
  y=cy+chh+80;
  // rows (exercises / strength gains)
  const maxY=1490;
  (sp.rows||[]).forEach(r=>{if(y>maxY)return;
    c.strokeStyle=P.line;c.lineWidth=2;c.beginPath();c.moveTo(X,y-54);c.lineTo(X+IW,y-54);c.stroke();
    c.font="800 "+BODY.replace("{s}",38);const rw2=c.measureText(r.right).width;
    let lx=X;if(r.badge){c.font="800 "+BODY.replace("{s}",24);const bw=c.measureText(r.badge).width+40;c.fillStyle=P.hot;rrect(c,X,y-34,bw,44,22);c.fill();c.fillStyle=P.hotInk;c.fillText(r.badge,X+20,y-4);lx=X+bw+16}
    c.fillStyle=P.ink;fitFont(c,r.name,"700 "+BODY,38,IW-rw2-(lx-X)-30);c.fillText(r.name,lx,y);
    c.font="800 "+BODY.replace("{s}",38);c.textAlign="right";c.fillStyle=t==="chalk"?P.ink:P.acc;c.fillText(r.right,X+IW,y);c.textAlign="left";y+=80});
  // promo footer (kept above the bottom ~250px Instagram covers)
  const py=1530;c.fillStyle=P.acc;rrect(c,X,py,IW,150,36);c.fill();
  c.fillStyle=P.accInk;fitFont(c,"Track your gym progress — free","800 "+BODY,40,IW-80);c.fillText("Track your gym progress — free",X+40,py+64);
  c.globalAlpha=.85;c.font="600 "+BODY.replace("{s}",36);c.fillText(APP_URL,X+40,py+118);c.globalAlpha=1;
  return new Promise(r=>cv.toBlob(r,"image/png"));
}
/* Weekly / monthly recap story from the Progress tab. */
function recapSpec(per){
  const today=dkey(new Date()),key=per==="week"?weekOf(today):monthOf(today),inP=w=>(per==="week"?weekOf(w.date):monthOf(w.date))===key;
  const ws=S.workouts.filter(inP),days=new Set(ws.map(w=>w.date)),vol=ws.reduce((a,w)=>a+volOf(w),0),sets=ws.reduce((a,w)=>a+allSets(w).length,0);
  let prs=0;{const best={},hit=new Set();for(const w of sorted())for(const e of w.ex)for(const s of e.sets){const b=best[e.name]||0;if(inP(w)&&b>0&&s.w>b)hit.add(e.name);if(s.w>b)best[e.name]=s.w}prs=hit.size}
  // strength gains: best e1RM in period vs before
  const before={},now={};for(const w of S.workouts){const tgt=inP(w)?now:w.date<(per==="week"?key:key+"-01")?before:null;if(!tgt)continue;
    for(const e of w.ex)for(const st of e.sets){if(!st.w)continue;const v=e1rm(st);if(!tgt[e.name]||v>tgt[e.name])tgt[e.name]=v}}
  const gains=Object.keys(now).filter(n=>before[n]&&now[n]-before[n]>0.01).map(n=>({name:n,right:"+"+kg(Math.round((now[n]-before[n])*2)/2)+" kg",badge:"▲ 1RM"})).sort((a,b)=>parseFloat(b.right.slice(1))-parseFloat(a.right.slice(1)));
  const rows=gains.length?gains.slice(0,3):Object.keys(now).slice(0,3).map(n=>({name:n,right:kg(Math.round(now[n]*2)/2)+" kg",badge:"1RM"}));
  const ym=monthOf(today),mk=[];
  if(per==="week"){const d=parse(key);for(let i=0;i<7;i++){const k=dkey(d);if(k.slice(0,7)===ym)mk.push(+k.slice(8));d.setDate(d.getDate()+1)}}
  const wkLabel=per==="week"?"WEEK OF "+short(key).toUpperCase():monthName(ym).toUpperCase();
  const H={red:per==="week"?["MY WEEK","IN IRON."]:["MY MONTH","IN IRON."],iron:per==="week"?["WEEKLY","GRIND."]:["MONTHLY","GRIND."],chalk:per==="week"?["WEEK","RECAP."]:["MONTH","RECAP."]}[curTheme()];
  return{dateLabel:wkLabel,kicker:(per==="week"?"THIS WEEK":"THIS MONTH")+" · "+pl(ws.length,"WORKOUT").toUpperCase(),h:H,
    stats:[["WORKOUTS",String(ws.length),""],["DAYS",String(days.size),""],["PRs",String(prs),"",prs>0],["VOLUME",vol>=1e5?(vol/1000).toFixed(0)+"k":fmt(vol),"kg"]],
    ym,cal:[...trainedDays()].filter(k=>k.slice(0,7)===ym).map(k=>+k.slice(8)),mark:mk,streak:weekStreak(),monthDays:monthDays(ym),rows,count:ws.length};
}
let shareSpec=null;
async function openShare(spec){
  shareSpec=spec||workoutSpec(celeData);
  const ov=document.getElementById("share");
  ov.innerHTML='<div class="sh-card"><p class="sh-load">Making your story…</p></div>';ov.hidden=false;navPush({ov:"share"});
  shareBlob=null;try{shareBlob=await drawStory(shareSpec)}catch(e){}
  if(!shareBlob){ov.innerHTML='<div class="sh-card"><p>Couldn’t make the image on this device.</p><button class="btn wide" data-sh="close">Close</button></div>';return}
  if(shareUrl)URL.revokeObjectURL(shareUrl);shareUrl=URL.createObjectURL(shareBlob);
  const f=new File([shareBlob],"daanav-workout.png",{type:"image/png"});
  const can=!!(navigator.canShare&&navigator.canShare({files:[f]}));
  ov.innerHTML='<div class="sh-card"><img class="sh-img" src="'+shareUrl+'" alt="Your workout story image"><p class="sh-tip">'+(can?'Tap <b>Share</b>, then pick <b>Instagram</b> → Stories, or <b>WhatsApp</b> → My status.':'Save the image, then add it to your Instagram or WhatsApp story.')+'</p>'+
    (can?'<button class="btn wide sharebtn" data-sh="go">'+SHARE_ICON+'Share</button>':'')+
    '<a class="btn wide '+(can?'ghostc':'sharebtn')+'" data-sh="save" href="'+shareUrl+'" download="daanav-workout.png">Save image</a>'+
    '<button class="link" data-sh="close">Close</button></div>';
}
document.getElementById("share").addEventListener("click",e=>{
  const ov=e.currentTarget,b=e.target.closest("[data-sh]");
  if(!b){if(e.target===ov){ov.hidden=true;navPopIf("ov","share")}return}
  if(b.dataset.sh==="close"){ov.hidden=true;navPopIf("ov","share");return}
  if(b.dataset.sh==="go"&&shareBlob){
    const f=new File([shareBlob],"daanav-workout.png",{type:"image/png"});
    navigator.share({files:[f],title:"My Daanav progress"}).then(()=>{ov.hidden=true;navPopIf("ov","share")}).catch(()=>{});
  }
});

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
  celebrate({past:!!A.past,date:w.date,vol:volOf(w),sets:allSets(w).length,mins:Math.max(1,Math.round((w.end-(w.start||w.end))/60000)),prs:prDetail,parts:w.parts,week:inWeek.length,days,streak:weekStreak(),monthDays:monthDays(monthOf(w.date)),cal:[...trainedDays()].filter(k=>k.slice(0,7)===monthOf(w.date)).map(k=>+k.slice(8)),ex:w.ex.map(e=>{const t=e.sets.reduce((m,s)=>s.w>m.w||(s.w===m.w&&s.r>m.r)?s:m,e.sets[0]);return{name:e.name,w:t.w,r:t.r,n:e.sets.length}}),dayName:parse(w.date).toLocaleDateString(undefined,{weekday:"long"})});
  render();
}
app.addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;
  const d=b.dataset,A=S.active;
  if(d.auth){if(d.auth==="signin")navPopIf("auth",authMode);else if(authMode==="signin")navPush({auth:d.auth});else navReplace(Object.assign({},navState(),{auth:d.auth}));authMode=d.auth;authMsg="";render();return}
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
  if(d.lbp){lbPeriod=d.lbp;render();return}
  if(d.lbm){lbMetric=d.lbm;render();return}
  if(d.calm){const[y,m]=calYm.split("-").map(Number),nd=new Date(y,m-1+(+d.calm),1);calYm=nd.getFullYear()+"-"+pad(nd.getMonth()+1);render();return}
  if(d.calday){const w=S.workouts.find(x=>x.date===d.calday);if(w){openId=w.id;go("history");setTimeout(()=>{const el=document.querySelector('[data-open="'+w.id+'"]');if(el)el.scrollIntoView({block:"center"})},60)}return}
  if(d.delw){
    const w=S.workouts.find(x=>x.id===d.delw);if(!w)return;
    S.workouts=S.workouts.filter(x=>x!==w);openId=null;markDel(w.id);render();
    toast("Workout deleted",()=>{if(!S.workouts.some(x=>x.id===w.id))S.workouts.push(w);markUp(w.id);render()});return}
  switch(d.act){
    case"logset":{
      const w=parseFloat(String(draft.w).replace(",",".")),r=parseInt(draft.r,10);
      if(!(w>=0)||!(r>0)){msgText="Enter a weight (0 for bodyweight) and at least 1 rep.";render();return}
      A.ex[A.cur].sets.push({w:Math.round(w*100)/100,r});popSet=true;markState();render();break}
    case"doneex":cleanActive();draft={w:"",r:""};markState();render();window.scrollTo(0,0);navPopIf("ex",1);break;
    case"backex":cleanActive();markState();render();navPopIf("ex",1);break;
    case"finish":finish();break;
    case"toggleParts":showAllParts=!showAllParts;render();break;
    case"discard":{const prev=S.active;S.active=null;pickPart=null;markState();render();window.scrollTo(0,0);
      toast("Workout discarded",()=>{if(!S.active){S.active=prev;markState();render()}});break}
    case"syncnow":setSync("saving");syncNow();break;
    case"signout":signOut();break;
    case"shareinvite":shareInvite();break;
    case"lbjoin":lbJoin();break;
    case"lbleave":lbLeave();break;
    case"sharerecap":{const sp=recapSpec(period);if(!sp.count){toast("Log a workout "+(period==="week"?"this week":"this month")+" first",null);break}openShare(sp);break}
    case"guesttry":enterGuest();break;
    case"guestsignup":navPush({auth:"open"});authOpen=true;authMode="signup";authMsg="";render();window.scrollTo(0,0);break;
    case"guestsignin":navPush({auth:"open"});authOpen=true;authMode="signin";authMsg="";render();window.scrollTo(0,0);break;
    case"guestback":navPopIf("auth","open");authOpen=false;authMsg="";render();window.scrollTo(0,0);break;
    case"guestexit":leaveGuest();break;
    case"logpast":
      if(S.active){go("workout");toast("Finish or discard your current workout first",null);break}
      logDate=dkey(new Date(Date.now()-864e5));go("workout");break;
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
  if(e.target.id==="actDateIn"&&S.active){
    const v=e.target.value,today=dkey(new Date()),A=S.active;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||v>today){render();return}
    if(v===today){if(A.past){A.past=false;delete A.mins;A.start=Date.now()}A.date=today}
    else{A.date=v;A.past=true;A.mins=A.mins||60;A.start=parse(v).setHours(18,0,0,0)}
    markState();render();return}
  if(e.target.id==="actMinsIn"&&S.active){const n=parseInt(e.target.value,10);S.active.mins=n>0?Math.max(5,Math.min(300,n)):60;markState();return}
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
/* Move workouts logged in trial mode into the account the person just signed up / in with. */
function mergeGuest(){
  let g=null;try{g=JSON.parse(localStorage.getItem("daanav-v1:guest")||"null")}catch(e){}
  try{localStorage.removeItem(GUEST)}catch(e){}
  if(!g||!Array.isArray(g.workouts))return;
  let moved=0;
  for(const w of g.workouts)if(w&&w.id&&!S.workouts.some(x=>x.id===w.id)){S.workouts.push(w);S.pending.up[w.id]=++ver;moved++}
  let st=false;
  if(g.custom)for(const k of Object.keys(g.custom)){const add=(g.custom[k]||[]).filter(x=>!((S.custom[k]||[]).includes(x)));if(add.length){S.custom[k]=(S.custom[k]||[]).concat(add);st=true}}
  if(g.active&&!S.active){S.active=g.active;st=true}
  if(st)S.pending.state=++ver;
  save();
  try{localStorage.removeItem("daanav-v1:guest")}catch(e){}
  if(moved)setTimeout(()=>toast(moved+" trial workout"+(moved===1?"":"s")+" added to your account",null),300);
}
function handleSession(u){
  ready=true;
  if(!u){if(isGuest()){render();return}if(guestFlag()){enterGuest();return}if(user){user=null;S=blank()}render();return}
  if(user&&user.id===u.id){if(!user.providers||!user.providers.length){user.providers=u.providers||[];user.phone=u.phone||user.phone}user.emailVerified=user.emailVerified||!!u.verified;return}
  user={id:u.id,email:u.email||"",name:u.name||pendingName||"",phone:u.phone||"",providers:u.providers||[],emailVerified:!!u.verified};pendingName="";
  authOpen=false;
  saveLast();
  loadCache();mergeGuest();authMsg="";render();
  syncNow();
  setTimeout(()=>touchProfile(u.created),1500);
  lbRows=null;lbLoaded=false;lbLast="";setTimeout(()=>lbPublish(),4000);
}
/* ---------- Leaderboard (opt-in): each member publishes a small summary to leaderboard/{uid} ---------- */
let lbPeriod="week",lbMetric="days",lbRows=null,lbLoaded=false,lbBusy=false,lbMsg="",lbTimer=null,lbLast="";
const lbJoined=()=>!!(S.profile&&S.profile.lb);
const LB_METRICS=[["days","Days trained","days"],["streak","Streak","weeks"],["prs","PRs","PRs"],["vol","Volume","kg"]];
function prsWhere(pred){const best={},hit=new Set();for(const w of sorted())for(const e of w.ex)for(const s of e.sets){const b=best[e.name]||0;if(pred(w)&&b>0&&s.w>b)hit.add(e.name);if(s.w>b)best[e.name]=s.w}return hit.size}
function lbName(){const n=(user&&user.name||"").trim().split(/\s+/);return n[0]?(n[0]+(n[1]?" "+n[1][0].toUpperCase()+".":"")).slice(0,24):"Lifter"}
function lbSummary(){
  const today=dkey(new Date()),wk=weekOf(today),mo=monthOf(today),pw=w=>weekOf(w.date)===wk,pm=w=>monthOf(w.date)===mo;
  const f=pred=>{const ws=S.workouts.filter(pred);return{d:new Set(ws.map(w=>w.date)).size,n:ws.length,v:Math.round(ws.reduce((a,w)=>a+volOf(w),0))}},a=f(pw),b=f(pm);
  return{name:lbName(),wk,wDays:a.d,wWorkouts:a.n,wVol:a.v,wPRs:prsWhere(pw),mo,mDays:b.d,mWorkouts:b.n,mVol:b.v,mPRs:prsWhere(pm),streak:weekStreak(),streakWk:wk};
}
function lbSoon(){if(!lbJoined()||isGuest())return;clearTimeout(lbTimer);lbTimer=setTimeout(lbPublish,3000)}
async function lbPublish(force){
  if(!fdb||!user||isGuest()||!lbJoined()||!navigator.onLine)return;
  const sum=lbSummary(),sig=JSON.stringify(sum);if(!force&&sig===lbLast)return;
  try{await timeout(FB.setDoc(FB.doc(fdb,"leaderboard",user.id),Object.assign(sum,{updatedAt:stamp()})),10000);lbLast=sig;
    if(lbRows){lbRows=lbRows.filter(r=>r.id!==user.id).concat([Object.assign({id:user.id},lbSummary())]);if(tab==="leaderboard")render()}}catch(e){}
}
async function lbLoad(){
  if(lbLoaded||!fdb||isGuest())return;lbLoaded=true;
  try{const qs=await timeout(FB.getDocs(FB.collection(fdb,"leaderboard")),12000);lbRows=qs.docs.map(d=>Object.assign({id:d.id},d.data()));lbMsg=""}
  catch(e){lbRows=[];lbMsg=/permission/.test(e&&e.code||"")?"The leaderboard isn’t switched on in the database yet.":"Couldn’t load the leaderboard. Check your connection."}
  if(tab==="leaderboard")render();
}
function lbVal(r,m,per){
  const today=dkey(new Date()),wk=weekOf(today),mo=monthOf(today),pd=parse(wk);pd.setDate(pd.getDate()-7);const prev=dkey(pd);
  if(m==="streak")return r.streakWk===wk||r.streakWk===prev?(+r.streak||0):0;
  const w=per==="week",ok=w?r.wk===wk:r.mo===mo;if(!ok)return 0;
  return +(w?{days:r.wDays,prs:r.wPRs,vol:r.wVol}[m]:{days:r.mDays,prs:r.mPRs,vol:r.mVol}[m])||0;
}
const I_TROPHY='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 21h8M9 17h6"/></svg>';
function viewLeaderboard(){
  setHead("Leaderboard","Compete with the crew");
  let h='<div class="seg" role="tablist"><button class="'+(lbPeriod==="week"?"on":"")+'" data-lbp="week">This week</button><button class="'+(lbPeriod==="month"?"on":"")+'" data-lbp="month">This month</button></div>'+
    '<div class="admtabs lbm">'+LB_METRICS.map(([id,l])=>'<button class="chip'+(lbMetric===id?' on':'')+'" data-lbm="'+id+'">'+l+'</button>').join("")+'</div>';
  if(isGuest())return h+'<section class="card lbjoin"><span class="lbicon">'+I_TROPHY+'</span><h3>Compete with other lifters</h3><p class="sub">See who trains the most days, keeps the longest streak and hits the most PRs. Sign up free to join the leaderboard.</p><button class="btn wide" data-act="guestsignup">Sign up free</button></section>';
  lbLoad();
  if(!lbJoined())h+='<section class="card lbjoin"><span class="lbicon">'+I_TROPHY+'</span><h3>Join the leaderboard</h3><p class="sub">Other Daanav users will see your name as <b>'+esc(lbName())+'</b> and your totals: days trained, streak, PRs and volume. Your workouts and exercises stay private. You can leave any time.</p><button class="btn wide" data-act="lbjoin"'+(lbBusy?" disabled":"")+'>'+(lbBusy?"Joining…":"Join the leaderboard")+'</button></section>';
  const M=LB_METRICS.find(x=>x[0]===lbMetric);
  h+='<section class="card"><h3>'+M[1]+(lbMetric==="streak"?' <small class="mute">· weeks in a row</small>':' <small class="mute">· '+(lbPeriod==="week"?"this week":"this month")+'</small>')+'</h3>';
  if(!lbRows)h+='<p class="sub">Loading…</p>';
  else{
    let rows=lbRows.slice();if(lbJoined()){rows=rows.filter(r=>r.id!==user.id);rows.push(Object.assign({id:user.id},lbSummary()))}
    const tb=r=>{const w=lbPeriod==="week",okp=w?r.wk===weekOf(dkey(new Date())):r.mo===monthOf(dkey(new Date()));return okp?(+(w?r.wWorkouts:r.mWorkouts)||0)*1e9+(+(w?r.wVol:r.mVol)||0):0};
    rows=rows.map(r=>({r,v:lbVal(r,lbMetric,lbPeriod),t:tb(r)})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v||b.t-a.t||String(a.r.name).localeCompare(String(b.r.name)));
    if(!rows.length)h+='<p class="sub">Nobody on the board yet. Log a workout and be the first!</p>';
    else{let rank=0,prevV=null;
      h+='<ol class="lb">'+rows.slice(0,50).map((x,i)=>{if(x.v!==prevV){rank=i+1;prevV=x.v}const me=user&&x.r.id===user.id;
        return '<li class="'+(me?"me":"")+(rank<=3?" top r"+rank:"")+'"><span class="rk">'+rank+'</span><span class="av sm">'+esc((String(x.r.name||"?").trim()[0]||"?").toUpperCase())+'</span><span class="nm">'+esc(x.r.name||"Lifter")+(me?' <small>You</small>':'')+'</span><b class="num">'+(lbMetric==="vol"?fmt(x.v):x.v)+'<small> '+(lbMetric==="vol"?"kg":lbMetric==="days"?(x.v===1?"day":"days"):lbMetric==="streak"?(x.v===1?"wk":"wks"):"")+'</small></b></li>'}).join("")+'</ol>';
      if(lbJoined()&&!rows.some(x=>x.r.id===user.id))h+='<p class="sub" style="margin:10px 0 0">You’re not on this board yet. Train '+(lbPeriod==="week"?"this week":"this month")+' to get on it.</p>';
    }
    if(lbMsg)h+='<p class="msg">'+esc(lbMsg)+'</p>';
  }
  if(lbMetric==="vol")h+='<p class="sub" style="margin:10px 0 0">Volume favours heavy leg days. Days trained and streak are the fairest ways to compete.</p>';
  h+='</section>';
  if(lbJoined())h+='<p style="text-align:center;margin:4px 0 0"><button class="link" data-act="lbleave">Leave the leaderboard</button></p>';
  return h;
}
async function lbJoin(){
  if(!navigator.onLine){toast("You’re offline. Connect to join.",null);return}
  lbBusy=true;render();
  S.profile=Object.assign({},S.profile,{lb:true});markState();
  await lbPublish(true);lbBusy=false;lbLoaded=false;lbLoad();render();toast("You’re on the leaderboard",null);
}
async function lbLeave(){
  S.profile=Object.assign({},S.profile,{lb:false});markState();lbLast="";
  try{await timeout(FB.deleteDoc(FB.doc(fdb,"leaderboard",user.id)),10000)}catch(e){}
  if(lbRows)lbRows=lbRows.filter(r=>r.id!==user.id);render();toast("You left the leaderboard",null);
}
/* ---------- App config: pricing, offers, coupons, referrals (edited in Admin) ---------- */
const ADMIN_EMAIL="aggarwalvishal904@gmail.com";
const isAdmin=()=>!!(user&&!user.guest&&String(user.email||"").toLowerCase()===ADMIN_EMAIL);
const CONF_KEY="daanav-conf",REF_KEY="daanav-ref";
const CUR_SYM={INR:"₹",USD:"$",EUR:"€",GBP:"£"};
function defConf(){return{
  pricing:{enabled:false,currency:"INR",trialDays:7,plans:[
    {id:"monthly",name:"Monthly",price:199,months:1,active:true},
    {id:"quarterly",name:"3 months",price:499,months:3,active:true},
    {id:"yearly",name:"Yearly",price:1499,months:12,active:true},
    {id:"lifetime",name:"Lifetime",price:3999,months:0,active:false}]},
  offer:{active:false,percent:20,label:"Launch offer",endsOn:""},
  referral:{enabled:false,rewardDays:30,friendPercent:10},
  general:{guestMode:true,announcement:""}}}
function mergeConf(d){
  const b=defConf();if(!d||typeof d!=="object")return b;
  for(const k of["pricing","offer","referral","general"])if(d[k]&&typeof d[k]==="object")Object.assign(b[k],d[k]);
  const pl=d.pricing&&Array.isArray(d.pricing.plans)?d.pricing.plans:[];
  b.pricing.plans=defConf().pricing.plans.map(p=>Object.assign(p,pl.find(x=>x&&x.id===p.id)||{}));
  return b;
}
let CONF=defConf();
try{CONF=mergeConf(JSON.parse(localStorage.getItem(CONF_KEY)||"null"))}catch(e){}
try{const r=new URLSearchParams(location.search).get("ref");if(r){localStorage.setItem(REF_KEY,r.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,12));window.history.replaceState(null,"",location.pathname)}}catch(e){}
const confRef=()=>FB.doc(fdb,"config","app");
async function loadConf(){
  if(!fdb||!navigator.onLine)return;
  try{const s=await timeout(FB.getDoc(confRef()),10000);CONF=mergeConf(s.exists()?s.data():null);try{localStorage.setItem(CONF_KEY,JSON.stringify(CONF))}catch(e){}render()}catch(e){}
}
const offerLive=()=>!!(CONF.offer.active&&CONF.offer.percent>0&&(!CONF.offer.endsOn||CONF.offer.endsOn>=dkey(new Date())));
const money=v=>(CUR_SYM[CONF.pricing.currency]||CONF.pricing.currency+" ")+(Math.round(v*100)/100).toLocaleString("en-IN");
const refCode=()=>user&&!user.guest?String(user.id).replace(/[^A-Za-z0-9]/g,"").slice(0,6).toUpperCase():"";
const inviteLink=()=>location.origin+location.pathname+"?ref="+refCode();
function priceAfter(p,coupon){
  let v=p.price;
  if(offerLive())v=v*(1-CONF.offer.percent/100);
  if(coupon)v=coupon.type==="flat"?v-coupon.value:v*(1-coupon.value/100);
  return Math.max(0,Math.round(v));
}
/* A small profile doc per user, so the admin can see sign-ups and referrals. */
async function touchProfile(created){
  if(!fdb||!user||user.guest)return;
  const d={name:user.name||"",email:user.email||"",refCode:refCode(),lastSeen:stamp()};
  if(created)d.joined=created;
  let ref="";try{ref=localStorage.getItem(REF_KEY)||""}catch(e){}
  const fresh=created&&Date.now()-Date.parse(created)<30*60000;
  if(ref&&ref!==refCode()&&fresh)d.referredBy=ref;
  try{await timeout(FB.setDoc(FB.doc(fdb,"users",user.id),d,{merge:true}),10000);if(ref)localStorage.removeItem(REF_KEY)}catch(e){}
}

/* ---------- Side menu ---------- */
const I_USER='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>';
const I_SHIELD='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>';
const I_GIFT='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13M12 8c-2-4-6-4-6-1.5S10 8 12 8zm0 0c2-4 6-4 6-1.5S14 8 12 8z"/></svg>';
const I_TAG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/></svg>';
function drawerHtml(){
  const g=isGuest(),nm=g?"Guest":(user.name||"Your account"),sub=g?"Trying without an account":(user.email||"");
  const it=(id,icon,label,note)=>'<button class="dr-it'+(tab===id?' on':'')+'" data-dr="'+id+'">'+icon+'<span><b>'+label+'</b><small>'+note+'</small></span><i aria-hidden="true">›</i></button>';
  let h='<div class="dr-head"><span class="av" aria-hidden="true">'+esc((nm.trim()[0]||"D").toUpperCase())+'</span><span class="dr-who"><b>'+esc(nm)+'</b><small>'+esc(sub)+'</small></span>'+
    '<button class="dr-x" data-dr="close" aria-label="Close menu"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="dr-list">';
  h+=it("account",I_USER,"Account",g?"Theme, sign up":"Profile, theme, password");
  if(CONF.pricing.enabled||isAdmin())h+=it("plans",I_TAG,"Plans",CONF.pricing.enabled?(offerLive()?CONF.offer.percent+"% off · "+esc(CONF.offer.label):"Daanav Pro"):"Hidden from users (admin preview)");
  if(!g&&(CONF.referral.enabled||isAdmin()))h+=it("invite",I_GIFT,"Invite friends",CONF.referral.enabled?"Earn "+pl(CONF.referral.rewardDays,"free day"):"Off for users (admin preview)");
  if(isAdmin())h+=it("admin",I_SHIELD,"Admin","Pricing, offers, coupons, referrals, users");
  h+='</div><div class="dr-foot">'+(g?'<button class="btn wide" data-dr="signup">Sign up free</button><button class="btn danger wide" data-dr="guestexit">'+SIGNOUT_ICON+'Leave trial mode</button>'
    :'<button class="btn danger wide" data-dr="signout">'+SIGNOUT_ICON+'Sign out</button>')+'</div>';
  return h;
}
const drawer=document.getElementById("drawer");
function openDrawer(){if(!user)return;navPush({ov:"drawer"});drawer.querySelector(".dr-panel").innerHTML=drawerHtml();drawer.hidden=false;void drawer.offsetWidth;drawer.classList.add("open");document.body.classList.add("drawer-open");
  setTimeout(()=>{const x=drawer.querySelector(".dr-x");if(x)x.focus({preventScroll:true})},50)}
function closeDrawer(fromPop){if(fromPop!==true)navPopIf("ov","drawer");drawer.classList.remove("open");document.body.classList.remove("drawer-open");setTimeout(()=>{if(!drawer.classList.contains("open"))drawer.hidden=true},260)}
function leaveGuest(){try{localStorage.removeItem(GUEST)}catch(e){}user=null;S=blank();tab="workout";authOpen=false;authMode="signin";authMsg="";render();window.scrollTo(0,0)}
document.getElementById("menuBtn").addEventListener("click",openDrawer);
document.getElementById("backBtn").addEventListener("click",goBack);
drawer.addEventListener("click",e=>{
  if(e.target===drawer){closeDrawer();return}
  const b=e.target.closest("[data-dr]");if(!b)return;const a=b.dataset.dr;
  if(a==="close"||a==="signout"||a==="guestexit"){closeDrawer();if(a==="signout")signOut();else if(a==="guestexit")leaveGuest();return}
  if(a==="signup"){navReplace({tab,auth:"open"});closeDrawer(true);authOpen=true;authMode="signup";authMsg="";render();window.scrollTo(0,0);return}
  if(a==="admin")admLoaded={};
  if(a===tab){closeDrawer();return}
  navReplace({tab:a});closeDrawer(true);go(a,true);
});
addEventListener("keydown",e=>{if(e.key==="Escape"&&!drawer.hidden)closeDrawer()});

/* ---------- Plans (what users see) ---------- */
let couponIn="",couponOk=null,couponMsg="",couponBusy=false;
function viewPlans(){
  setHead(CONF.pricing.enabled?"Plans":"Plans · admin preview","Daanav Pro");
  const plans=CONF.pricing.plans.filter(p=>p.active&&p.price>0);
  let h=CONF.pricing.enabled?'':'<section class="card note-admin"><b>Only you can see this page.</b> Turn on “Show Plans to users” in Admin → Pricing when you’re ready.</section>';
  if(offerLive())h+='<section class="card offerband"><b>'+esc(CONF.offer.label||"Special offer")+' · '+CONF.offer.percent+'% off</b>'+(CONF.offer.endsOn?'<small>Ends '+long(CONF.offer.endsOn)+'</small>':'')+'</section>';
  h+='<section class="card"><h3>Choose a plan</h3>'+(CONF.pricing.trialDays>0?'<p class="sub">Start with a <b>'+pl(CONF.pricing.trialDays,"day")+' free trial</b>. Cancel any time.</p>':'')+'<div class="plans">';
  if(!plans.length)h+='<p class="sub">No plans are available right now.</p>';
  for(const p of plans){const now=priceAfter(p,couponOk),cut=now<p.price;
    h+='<div class="plan'+(p.id==="yearly"?' best':'')+'">'+(p.id==="yearly"?'<span class="pbadge">Best value</span>':'')+'<b class="pn">'+esc(p.name)+'</b>'+
      '<div class="pp"><span class="num">'+money(now)+'</span>'+(cut?'<s>'+money(p.price)+'</s>':'')+'</div>'+
      '<small>'+(!p.months?'one-time payment · yours forever':p.months>1?money(Math.round(now/p.months))+' per month':'per month')+'</small></div>'}
  h+='</div><form id="couponForm" class="coupon"><input type="text" id="couponCode" maxlength="20" autocapitalize="characters" placeholder="Coupon code" value="'+esc(couponIn)+'"><button class="btn" type="submit"'+(couponBusy?" disabled":"")+'>'+(couponBusy?"…":"Apply")+'</button></form>'+
    '<p class="msg'+(couponOk?' okmsg':'')+'">'+esc(couponMsg)+'</p>'+
    '<button class="btn wide" disabled style="margin-top:6px">Payments open soon</button><p class="sub" style="margin:8px 0 0;text-align:center">You won’t be charged yet. Everything stays free until payments open.</p></section>';
  return h;
}
async function applyCoupon(code){
  code=String(code||"").toUpperCase().replace(/[^A-Z0-9]/g,"");couponIn=code;couponOk=null;
  if(!code){couponMsg="Enter a coupon code.";render();return}
  if(isGuest()){couponMsg="Sign up free to use a coupon.";render();return}
  if(!fdb||!navigator.onLine){couponMsg="You’re offline. Connect to the internet to check the coupon.";render();return}
  couponBusy=true;couponMsg="";render();
  try{const s=await timeout(FB.getDoc(FB.doc(fdb,"coupons",code)),10000);const c=s.exists()?s.data():null;
    if(!c||!c.active)couponMsg="That coupon isn’t valid.";
    else if(c.expiresOn&&c.expiresOn<dkey(new Date()))couponMsg="That coupon has expired.";
    else if(c.maxUses&&(c.used||0)>=c.maxUses)couponMsg="That coupon has been fully used.";
    else{couponOk={type:c.type==="flat"?"flat":"percent",value:+c.value||0};couponMsg="Coupon applied: "+(couponOk.type==="flat"?money(couponOk.value)+" off":couponOk.value+"% off")+"."}
  }catch(e){couponMsg="Couldn’t check the coupon. Try again."}
  couponBusy=false;render();
}

/* ---------- Invite friends ---------- */
function viewInvite(){
  setHead(CONF.referral.enabled?"Invite friends":"Invite · admin preview","Train together");
  const r=CONF.referral;
  let h=r.enabled?'':'<section class="card note-admin"><b>Only you can see this page.</b> Turn on referrals in Admin → Referrals to show it to users.</section>';
  h+='<section class="card invite"><h3>Bring your gym buddies</h3><p class="sub">'+
    (r.rewardDays>0?'You get <b>'+pl(r.rewardDays,"free day")+'</b> of Daanav Pro for every friend who signs up with your link'+(r.friendPercent>0?', and they get <b>'+r.friendPercent+'% off</b> their first plan':'')+'.':'Share your link so friends can track their workouts too.')+'</p>'+
    '<div class="reflink"><span class="num">'+esc(inviteLink().replace(/^https?:\/\//,""))+'</span></div><p class="sub" style="margin:8px 0 0">Your code: <b class="num">'+refCode()+'</b></p>'+
    '<button class="btn wide sharebtn" data-act="shareinvite" style="margin-top:12px">'+SHARE_ICON+'Share invite link</button><p class="msg">'+esc(inviteMsg)+'</p></section>';
  inviteMsg="";
  return h;
}
let inviteMsg="";
function shareInvite(){
  const r=CONF.referral,url=inviteLink();
  const text="I track my gym progress on Daanav — sets, PRs and strength gains. Join me"+(r.friendPercent>0?" and get "+r.friendPercent+"% off":"")+": ";
  if(navigator.share){navigator.share({title:"Daanav",text,url}).catch(()=>{});return}
  try{navigator.clipboard.writeText(text+url).then(()=>{inviteMsg="Link copied. Paste it in WhatsApp or anywhere.";render()},()=>{inviteMsg=url;render()})}catch(e){inviteMsg=url;render()}
}

/* ---------- Admin ---------- */
let admSub="pricing",admMsg={},admCoupons=null,admUsers=null,admLoaded={},admBusy=false,admQ="";
const ADM_TABS=[["pricing","Pricing"],["offers","Offers"],["coupons","Coupons"],["referrals","Referrals"],["users","Users"],["general","General"]];
const sw=(name,on,label,note)=>'<label class="swrow"><span><b>'+label+'</b>'+(note?'<small>'+note+'</small>':'')+'</span><span class="sw"><input type="checkbox" name="'+name+'"'+(on?" checked":"")+'><i></i></span></label>';
const fnum=(name,val,label,attrs)=>'<label class="fl">'+label+'</label><input type="number" inputmode="decimal" name="'+name+'" value="'+esc(String(val))+'" '+(attrs||"")+'>';
const amsg=k=>'<p class="msg'+(admMsg[k]&&admMsg[k].ok?' okmsg':'')+'">'+esc(admMsg[k]?admMsg[k].t:"")+'</p>';
function admErr(e){const c=e&&e.code||"";return /permission/.test(c)?"Permission denied. Publish the new Firestore rules (see README) and make sure this email is verified.":"Couldn’t save: "+errText(e)}
async function saveConf(next,k){
  if(!navigator.onLine){admMsg[k]={t:"You’re offline. Connect to save."};render();return}
  admBusy=true;render();
  try{await timeout(FB.setDoc(confRef(),Object.assign(clean(next),{updatedAt:stamp(),updatedBy:user.email})),12000);CONF=mergeConf(next);try{localStorage.setItem(CONF_KEY,JSON.stringify(CONF))}catch(e){}admMsg[k]={t:"Saved. Users get this the next time they open the app.",ok:true}}
  catch(e){admMsg[k]={t:admErr(e)}}
  admBusy=false;render();
}
async function admLoad(what){
  if(admLoaded[what]||!fdb)return;admLoaded[what]=1;
  try{const qs=await timeout(FB.getDocs(FB.collection(fdb,what)),12000);const rows=qs.docs.map(d=>Object.assign({id:d.id},d.data()));
    if(what==="coupons")admCoupons=rows.sort((a,b)=>a.id.localeCompare(b.id));else admUsers=rows;}
  catch(e){admMsg[what]={t:admErr(e).replace("Couldn’t save","Couldn’t load")};if(what==="coupons")admCoupons=[];else admUsers=[]}
  if(tab==="admin")render();
}
const tsDate=v=>{if(!v)return"";const ms=typeof v==="string"?Date.parse(v):v.toMillis?v.toMillis():v.seconds?v.seconds*1000:+v;return ms?short(dkey(new Date(ms))):""};
function viewAdmin(){
  setHead("Admin","Control room");
  const pw=(user.providers||[]).includes("password")&&!(user.providers||[]).includes("google.com");
  if(pw&&!user.emailVerified)return '<section class="card"><h3>Verify your email to unlock Admin</h3><p class="sub">For security, admin changes only work from a verified email. We’ll send a link to <b>'+esc(user.email)+'</b>. Or sign in with Google using this email instead.</p>'+
    '<button class="btn wide" data-adm="verify">Send verification email</button><button class="btn ghost wide" data-adm="verified" style="margin-top:8px">I’ve verified it</button>'+amsg("verify")+'</section>';
  let h='<div class="admtabs" role="tablist">'+ADM_TABS.map(([id,l])=>'<button class="chip'+(admSub===id?' on':'')+'" role="tab" aria-selected="'+(admSub===id)+'" data-admsub="'+id+'">'+l+'</button>').join("")+'</div>';
  const P=CONF.pricing,O=CONF.offer,R=CONF.referral,G=CONF.general,dis=admBusy?" disabled":"";
  const saveBtn=lbl=>'<button class="btn wide" type="submit" style="margin-top:14px"'+dis+'>'+(admBusy?"Saving…":lbl||"Save")+'</button>';
  if(admSub==="pricing"){
    h+='<section class="card"><h3>Pricing</h3><form id="admPricing">'+sw("enabled",P.enabled,"Show Plans to users","Adds “Plans” to everyone’s menu. Payments aren’t connected yet, so nobody is charged.")+
      '<div class="row2"><div><label class="fl">Currency</label><select name="currency">'+Object.keys(CUR_SYM).map(c=>'<option'+(c===P.currency?" selected":"")+'>'+c+'</option>').join("")+'</select></div><div>'+fnum("trialDays",P.trialDays,"Free trial (days)",'min="0" max="90" step="1"')+'</div></div>'+
      '<h4 class="sh">Plans</h4>'+P.plans.map(p=>'<div class="planrow"><span class="sw"><input type="checkbox" name="on_'+p.id+'"'+(p.active?" checked":"")+' aria-label="'+esc(p.name)+' on"><i></i></span>'+
        '<input type="text" name="name_'+p.id+'" maxlength="24" value="'+esc(p.name)+'" aria-label="Plan name"><span class="cur">'+(CUR_SYM[P.currency]||"")+'</span><input type="number" inputmode="decimal" name="price_'+p.id+'" min="0" step="1" value="'+p.price+'" aria-label="'+esc(p.name)+' price"><small>'+(p.months?p.months+' mo':'once')+'</small></div>').join("")+
      saveBtn("Save pricing")+amsg("pricing")+'</form></section>';
    h+='<section class="card"><h3>Preview</h3><p class="sub">What users see on the Plans page right now'+(offerLive()?', with the '+O.percent+'% offer applied':'')+'.</p><div class="plans">'+P.plans.filter(p=>p.active).map(p=>'<div class="plan"><b class="pn">'+esc(p.name)+'</b><div class="pp"><span class="num">'+money(priceAfter(p))+'</span>'+(priceAfter(p)<p.price?'<s>'+money(p.price)+'</s>':'')+'</div></div>').join("")+'</div><button class="btn ghost wide" data-tab-go="plans" style="margin-top:12px">Open Plans page</button></section>';
  }else if(admSub==="offers"){
    h+='<section class="card"><h3>Sitewide offer</h3><p class="sub">A discount on every plan, shown as a banner on the Plans page. Coupons apply on top of it.</p><form id="admOffer">'+sw("active",O.active,"Offer is on","")+
      '<label class="fl">Offer name</label><input type="text" name="label" maxlength="40" value="'+esc(O.label)+'" placeholder="e.g. Diwali offer">'+
      '<div class="row2"><div>'+fnum("percent",O.percent,"Discount (%)",'min="1" max="90" step="1"')+'</div><div><label class="fl">Ends on (optional)</label><input type="date" name="endsOn" value="'+esc(O.endsOn)+'"></div></div>'+
      saveBtn("Save offer")+amsg("offers")+'</form><p class="sub" style="margin:10px 0 0">Status: <b>'+(offerLive()?"Live":O.active?"Ended":"Off")+'</b></p></section>';
  }else if(admSub==="coupons"){
    admLoad("coupons");
    h+='<section class="card"><h3>New coupon</h3><form id="admCoupon"><label class="fl">Code</label><input type="text" name="code" maxlength="20" autocapitalize="characters" placeholder="e.g. FIT50" required>'+
      '<div class="row2"><div><label class="fl">Type</label><select name="type"><option value="percent">% off</option><option value="flat">Amount off</option></select></div><div>'+fnum("value","","Value",'min="1" step="1" required')+'</div></div>'+
      '<div class="row2"><div>'+fnum("maxUses","","Max uses (blank = no limit)",'min="1" step="1"')+'</div><div><label class="fl">Expires on (optional)</label><input type="date" name="expiresOn"></div></div>'+
      '<label class="fl">Note (only you see this)</label><input type="text" name="note" maxlength="60" placeholder="e.g. For my gym batch">'+saveBtn("Create coupon")+amsg("coupons")+'</form></section>';
    h+='<section class="card"><h3>Coupons'+(admCoupons?' <small class="mute">('+admCoupons.length+')</small>':'')+'</h3>';
    if(!admCoupons)h+='<p class="sub">Loading…</p>';
    else if(!admCoupons.length)h+='<p class="sub">No coupons yet.</p>';
    else h+='<div class="clist">'+admCoupons.map(c=>{const exp=c.expiresOn&&c.expiresOn<dkey(new Date());
      return '<div class="crow'+(c.active&&!exp?'':' off')+'"><div><b class="num">'+esc(c.id)+'</b><small>'+(c.type==="flat"?money(c.value)+" off":c.value+"% off")+' · used '+(c.used||0)+(c.maxUses?'/'+c.maxUses:'')+(c.expiresOn?' · '+(exp?'expired ':'until ')+short(c.expiresOn):'')+(c.note?' · '+esc(c.note):'')+'</small></div>'+
        '<span class="sw"><input type="checkbox" data-adm-ctoggle="'+esc(c.id)+'"'+(c.active?" checked":"")+' aria-label="'+esc(c.id)+' active"><i></i></span><button class="cdel" data-adm-cdel="'+esc(c.id)+'" aria-label="Delete '+esc(c.id)+'"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button></div>'}).join("")+'</div>';
    h+='<p class="sub" style="margin:10px 0 0">“Used” counts go up once payments are connected.</p></section>';
  }else if(admSub==="referrals"){
    admLoad("users");
    h+='<section class="card"><h3>Referrals</h3><form id="admRef">'+sw("enabled",R.enabled,"Referrals are on","Adds “Invite friends” to everyone’s menu with their own link.")+
      '<div class="row2"><div>'+fnum("rewardDays",R.rewardDays,"Reward for inviter (free days)",'min="0" max="365" step="1"')+'</div><div>'+fnum("friendPercent",R.friendPercent,"Friend’s discount (%)",'min="0" max="90" step="1"')+'</div></div>'+
      saveBtn("Save referrals")+amsg("referrals")+'</form><p class="sub" style="margin:10px 0 0">Rewards are recorded now and applied once payments are connected.</p></section>';
    if(admUsers){const by={};for(const u of admUsers)if(u.referredBy)by[u.referredBy]=(by[u.referredBy]||0)+1;
      const top=Object.entries(by).sort((a,b)=>b[1]-a[1]),name=c=>{const u=admUsers.find(x=>x.refCode===c);return u?(u.name||u.email):"Unknown"};
      h+='<section class="card"><h3>Referral stats</h3><div class="tiles">'+tile("Referred sign-ups",Object.values(by).reduce((a,b)=>a+b,0))+tile("Active referrers",top.length)+'</div>'+
        (top.length?'<table class="stack" style="margin-top:10px"><thead><tr><th>Referrer</th><th class="r">Code</th><th class="r">Sign-ups</th></tr></thead><tbody>'+top.slice(0,20).map(([c,n])=>'<tr><td>'+esc(name(c))+'</td><td class="r num" data-l="Code">'+esc(c)+'</td><td class="r num" data-l="Sign-ups">'+n+'</td></tr>').join("")+'</tbody></table>':'<p class="sub" style="margin-top:10px">No referred sign-ups yet.</p>')+amsg("users")+'</section>'}
    else h+='<section class="card"><p class="sub">Loading stats…</p></section>';
  }else if(admSub==="users"){
    admLoad("users");
    if(!admUsers)h+='<section class="card"><p class="sub">Loading users…</p>'+amsg("users")+'</section>';
    else{const wk=Date.now()-7*864e5,ms=v=>!v?0:typeof v==="string"?Date.parse(v):v.toMillis?v.toMillis():v.seconds?v.seconds*1000:+v;
      const q=admQ.toLowerCase(),list=admUsers.filter(u=>!q||(u.name||"").toLowerCase().includes(q)||(u.email||"").toLowerCase().includes(q)).sort((a,b)=>ms(b.joined)-ms(a.joined));
      h+='<section class="card"><div class="tiles">'+tile("Users",admUsers.length)+tile("Active this week",admUsers.filter(u=>ms(u.lastSeen)>wk).length)+tile("New this week",admUsers.filter(u=>ms(u.joined)>wk).length)+tile("Referred",admUsers.filter(u=>u.referredBy).length)+'</div></section>'+
        '<section class="card"><input type="text" id="admQ" placeholder="Search name or email" value="'+esc(admQ)+'"><div class="ulist">'+(list.length?list.slice(0,200).map(u=>'<div class="urow"><span class="av sm">'+esc(((u.name||u.email||"?").trim()[0]||"?").toUpperCase())+'</span><div><b>'+esc(u.name||"No name")+'</b><small>'+esc(u.email||"")+'</small></div><small class="r">Joined '+(tsDate(u.joined)||"–")+'<br>Seen '+(tsDate(u.lastSeen)||"–")+'</small></div>').join(""):'<p class="sub">No users match.</p>')+'</div>'+
        '<p class="sub" style="margin:10px 0 0">Users appear here after they open the updated app once. Guests (no account) aren’t listed.</p>'+amsg("users")+'</section>'}
  }else{
    h+='<section class="card"><h3>General</h3><form id="admGen">'+sw("guestMode",G.guestMode,"Allow trying without an account","Shows “Try without signing up” on the sign-in screen.")+
      '<label class="fl">Announcement banner (optional)</label><textarea name="announcement" maxlength="160" rows="3" placeholder="e.g. New: share your workouts to Instagram!">'+esc(G.announcement)+'</textarea><small class="mute">Shown at the top of the app for everyone. Leave empty to hide.</small>'+
      saveBtn("Save")+amsg("general")+'</form></section>'+
      '<section class="card"><h3>Admin access</h3><p class="sub">Only <b>'+ADMIN_EMAIL+'</b> can open Admin. This is set in the app code and enforced by the Firestore rules.</p></section>';
  }
  admMsg={};
  return h;
}
const fv=(f,n)=>f.elements[n]?f.elements[n].value:"";
const fn=(f,n,lo,hi)=>{const v=parseFloat(fv(f,n));return isFinite(v)?Math.max(lo,Math.min(hi,v)):lo};
app.addEventListener("submit",e=>{
  const f=e.target,id=f.id;
  if(id==="couponForm"){e.preventDefault();applyCoupon(fv(f,"couponCode")||document.getElementById("couponCode").value);return}
  if(!/^adm/.test(id)||!isAdmin())return;
  e.preventDefault();
  const C=clean(CONF);
  if(id==="admPricing"){C.pricing.enabled=f.elements.enabled.checked;C.pricing.currency=fv(f,"currency");C.pricing.trialDays=Math.round(fn(f,"trialDays",0,90));
    C.pricing.plans=C.pricing.plans.map(p=>Object.assign(p,{active:f.elements["on_"+p.id].checked,name:(fv(f,"name_"+p.id).trim()||p.name).slice(0,24),price:Math.round(fn(f,"price_"+p.id,0,1e6))}));saveConf(C,"pricing")}
  else if(id==="admOffer"){C.offer={active:f.elements.active.checked,label:fv(f,"label").trim().slice(0,40),percent:Math.round(fn(f,"percent",1,90)),endsOn:fv(f,"endsOn")};saveConf(C,"offers")}
  else if(id==="admRef"){C.referral={enabled:f.elements.enabled.checked,rewardDays:Math.round(fn(f,"rewardDays",0,365)),friendPercent:Math.round(fn(f,"friendPercent",0,90))};saveConf(C,"referrals")}
  else if(id==="admGen"){C.general={guestMode:f.elements.guestMode.checked,announcement:fv(f,"announcement").trim().slice(0,160)};saveConf(C,"general")}
  else if(id==="admCoupon")createCoupon(f);
});
async function createCoupon(f){
  const code=fv(f,"code").toUpperCase().replace(/[^A-Z0-9]/g,""),type=fv(f,"type")==="flat"?"flat":"percent",value=Math.round(fn(f,"value",0,type==="flat"?1e6:100));
  if(code.length<3){admMsg.coupons={t:"Use at least 3 letters or numbers for the code."};render();return}
  if(!(value>0)){admMsg.coupons={t:"Enter a value above 0."};render();return}
  if(admCoupons&&admCoupons.some(c=>c.id===code)){admMsg.coupons={t:code+" already exists."};render();return}
  const mu=parseInt(fv(f,"maxUses"),10),c={code,type,value,maxUses:mu>0?mu:0,used:0,expiresOn:fv(f,"expiresOn")||"",note:fv(f,"note").trim().slice(0,60),active:true,createdAt:stamp()};
  admBusy=true;render();
  try{await timeout(FB.setDoc(FB.doc(fdb,"coupons",code),c),12000);admCoupons=(admCoupons||[]).concat([Object.assign({id:code},c)]).sort((a,b)=>a.id.localeCompare(b.id));admMsg.coupons={t:code+" created.",ok:true}}
  catch(e){admMsg.coupons={t:admErr(e)}}
  admBusy=false;render();
}
app.addEventListener("click",async e=>{
  const b=e.target.closest("[data-admsub],[data-adm],[data-adm-cdel]");if(!b)return;
  if(b.dataset.admsub){admSub=b.dataset.admsub;render();return}
  if(b.dataset.admCdel){if(!isAdmin())return;const id=b.dataset.admCdel,c=admCoupons.find(x=>x.id===id);
    try{await timeout(FB.deleteDoc(FB.doc(fdb,"coupons",id)),12000);admCoupons=admCoupons.filter(x=>x.id!==id);render();
      toast(id+" deleted",async()=>{const d=Object.assign({},c);delete d.id;try{await FB.setDoc(FB.doc(fdb,"coupons",id),d);admCoupons=admCoupons.concat([c]).sort((a,b)=>a.id.localeCompare(b.id));render()}catch(e2){}})}
    catch(err){admMsg.coupons={t:admErr(err)};render()}return}
  const a=b.dataset.adm,u=fbAuth&&fbAuth.currentUser;
  if(a==="verify"){try{await FB.sendEmailVerification(u);admMsg.verify={t:"Link sent to "+user.email+". Open it, then tap “I’ve verified it”.",ok:true}}catch(err){admMsg.verify={t:friendly(err)}}render()}
  if(a==="verified"){try{await u.reload();await u.getIdToken(true);user.emailVerified=!!fbAuth.currentUser.emailVerified;if(!user.emailVerified)admMsg.verify={t:"Not verified yet. Open the link in the email first."}}catch(err){admMsg.verify={t:friendly(err)}}render()}
});
app.addEventListener("change",async e=>{
  const t=e.target;if(!t.dataset||!t.dataset.admCtoggle||!isAdmin())return;
  const id=t.dataset.admCtoggle,c=admCoupons.find(x=>x.id===id);if(!c)return;
  try{await timeout(FB.setDoc(FB.doc(fdb,"coupons",id),{active:t.checked},{merge:true}),12000);c.active=t.checked}catch(err){t.checked=!t.checked;admMsg.coupons={t:admErr(err)}}
  render();
});
app.addEventListener("input",e=>{if(e.target.id==="admQ"){admQ=e.target.value;const pos=e.target.selectionStart;render();const q=document.getElementById("admQ");if(q){q.focus();try{q.setSelectionRange(pos,pos)}catch(x){}}}});

const FIREBASE_SDK="12.19.0";
async function boot(){
  if(guestFlag()){ready=true;enterGuest()}
  const fc=CFG.firebase||{};
  if(!fc.apiKey||!fc.projectId||/YOUR[-_]/i.test(JSON.stringify(fc))){bootError="Open config.js and paste your Firebase web app config, then upload the files again.";render();return}
  try{
    const u=n=>"https://www.gstatic.com/firebasejs/"+FIREBASE_SDK+"/firebase-"+n+".js";
    const[A,Au,F]=await Promise.all([import(u("app")),import(u("auth")),import(u("firestore"))]);
    FB=Object.assign({},A,Au,F);
  }catch(e){
    let last=null;try{last=JSON.parse(localStorage.getItem(LAST)||"null")}catch(e2){}
    if(guestFlag()){ready=true;enterGuest();return}
    if(last&&last.id){ready=true;user=last;loadCache();setSync("offline");render();
      addEventListener("online",()=>location.reload(),{once:true});return}
    bootError="Couldn’t load the sign-in library. Check your internet connection and reload the app.";render();return;
  }
  const fapp=FB.initializeApp(fc);
  fbAuth=FB.getAuth(fapp);fdb=FB.getFirestore(fapp);
  render();
  FB.onAuthStateChanged(fbAuth,u=>setTimeout(()=>handleSession(u?{id:u.uid,email:u.email||"",name:u.displayName||"",phone:u.phoneNumber||"",providers:(u.providerData||[]).map(p=>p.providerId),verified:!!u.emailVerified,created:u.metadata&&u.metadata.creationTime||""}:null),0));
  loadConf();
  addEventListener("online",()=>{setSync("saving");syncNow()});
  addEventListener("offline",()=>setSync("offline"));
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&user)syncNow()});
}
if("serviceWorker" in navigator&&location.protocol==="https:")navigator.serviceWorker.register("sw.js").catch(()=>{});
boot();
}

// Stop iOS double-tap / pinch zoom so quick taps on +/- just change the value.
document.addEventListener("dblclick", e => e.preventDefault(), { passive: false });
document.addEventListener("gesturestart", e => e.preventDefault(), { passive: false });
