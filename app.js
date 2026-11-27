{
const CFG=window.DAANAV_CONFIG||{};
const LAST="daanav-last-user",GUEST="daanav-guest";
let authOpen=false;
const isGuest=()=>!!(user&&user.guest);
function guestFlag(){try{return localStorage.getItem(GUEST)==="1"}catch(e){return false}}
function enterGuest(keepTab){try{localStorage.setItem(GUEST,"1")}catch(e){}user={id:"guest",guest:true,name:"",email:"",providers:[]};authOpen=false;authMsg="";if(keepTab!==true)tab="home";loadCache();setSync("idle");render();window.scrollTo(0,0)}
const LIB={
  Chest:["Bench press","Incline bench press","Dumbbell bench press","Incline dumbbell press","Machine chest press","Chest fly (machine)","Cable crossover","Dumbbell pullover","Push-ups","Dips"],
  Back:["Deadlift","Pull-ups","Lat pulldown","Barbell row","Seated cable row","Dumbbell row","T-bar row","Face pull"],
  Shoulders:["Overhead press","Dumbbell shoulder press","Arnold press","Lateral raise","Front raise","Rear delt fly","Cable rear delt fly","Cable rear delt row","Face pull","Shrugs","Dumbbell shrug","Cable shrug","Upright row","Cable upright row","Farmer's walk"],
  Legs:["Squat","Leg press","Romanian deadlift","Walking lunges","Bulgarian split squat","Leg extension","Leg curl","Hip thrust","Calf raise"],
  Biceps:["Barbell curl","Dumbbell curl","Hammer curl","Preacher curl","Cable curl","Incline dumbbell curl"],
  Triceps:["Tricep pushdown","Overhead tricep extension","Skull crushers","Close-grip bench press","Tricep dips"],
  Core:["Hanging leg raise","Cable crunch","Ab wheel rollout","Russian twist","Crunches"],
  Forearms:["Wrist curl","Reverse wrist curl","Reverse curl","Hammer curl","Dumbbell wrist curl","Dumbbell reverse wrist curl","Behind-the-back wrist curl","Cable wrist curl","Wrist roller","Farmer's walk","Plate pinch"],
  Glutes:["Hip thrust","Glute bridge","Single-leg glute bridge","Cable kickback","Glute kickback","Sumo squat","Step-ups","Hip abduction (machine)","Hip adduction (machine)"]
};
LIB.Legs.splice(3,0,"Goblet squat");LIB.Back.splice(3,0,"Assisted pull-ups");
const PARTS=Object.keys(LIB);
/* Gender: "f" female, "m" male, "x" prefer not to say. Used only to order body parts and exercises. */
const G_OPTS=[["f","Female"],["m","Male"],["x","Prefer not to say"]];
const gender=()=>(S&&S.profile&&S.profile.gender)||"";
const FEM_PARTS=["Glutes","Legs","Back","Shoulders","Core","Biceps","Triceps","Forearms","Chest"];
const FEM_FIRST={Legs:["Hip thrust","Romanian deadlift","Goblet squat","Bulgarian split squat","Walking lunges"],Back:["Lat pulldown","Assisted pull-ups","Seated cable row","Dumbbell row"],Chest:["Push-ups","Dumbbell bench press","Incline dumbbell press","Machine chest press"],Shoulders:["Dumbbell shoulder press","Lateral raise","Rear delt fly"]};
const partsOrder=()=>gender()==="f"?FEM_PARTS:PARTS;
function libFor(part){const base=LIB[part]||[];if(gender()!=="f"||!FEM_FIRST[part])return base;const f=FEM_FIRST[part].filter(x=>base.includes(x));return f.concat(base.filter(x=>!f.includes(x)))}
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
let recsAll=false,editSet=null,logDate=null,pastMins=60,tab="home",period="week",pickPart=null,showAllParts=false,summary=null,openId=null,progEx=null,draft={w:"",r:""},msgText="",popSet=false;
let authEmail="",authName="",pendingName="",authGender="",pendingGender="",ready=false,FB=null,fbAuth=null,fdb=null,user=null,authMode="signin",authMsg="",authBusy=false,syncState="idle",syncErr="",flushing=false,flushTimer=null,ver=1,bootError="";

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
function queue(){save();if(isGuest())return;setSync(navigator.onLine?"saving":"offline");clearTimeout(flushTimer);flushTimer=setTimeout(flush,700)}

/* ---------- Cloud sync (Firebase Cloud Firestore) ----------
   Data layout:  users/{uid}/workouts/{workoutId}   one document per finished workout
                 users/{uid}/meta/state             custom exercises + workout in progress */
const clean=o=>JSON.parse(JSON.stringify(o==null?null:o));
const stamp=()=>FB.serverTimestamp();
const toDoc=w=>Object.assign(clean({date:w.date,startedAt:Math.round(+w.start||0),endedAt:Math.round(+w.end||0),parts:w.parts||[],exercises:w.ex||[],photo:!!w.photo}),{updatedAt:stamp()});
const fromDoc=(id,d)=>({id,date:d.date,start:+d.startedAt||0,end:+d.endedAt||0,parts:Array.isArray(d.parts)?d.parts:[],ex:Array.isArray(d.exercises)?d.exercises:[],photo:!!d.photo});
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
async function syncNow(){retryPhotos();await flush();await pull();if(hasPending())flush()}
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
function exercisesFor(part){return libFor(part).concat((S.custom[part]||[]).filter(n=>!LIB[part].includes(n)))}

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
      '<button class="chip datepick'+(ld&&ld!==yest?" on":"")+'" data-act="pickdate" data-for="log" aria-haspopup="dialog"><span>'+(ld&&ld!==yest?esc(short(ld)):"Earlier date")+'</span></button></div>'+
      (ld?'<p class="pastnote">Logging for <b>'+esc(long(ld))+'</b>.</p><div class="durrow"><label for="pastMinsIn">How long was it?</label><span><input type="number" id="pastMinsIn" inputmode="numeric" min="5" max="300" step="5" value="'+pastMins+'"> min</span></div>':'')+'</section>';
    return (gender()?'':genderCard())+(user.name||isGuest()?'':nameCard(true))+dateCard+'<section class="card"><h2>Pick a body part</h2><p class="sub">You can add more body parts once you’ve started.</p><div class="parts">'+
      partsOrder().map(p=>'<button class="part" data-start="'+p+'"><b>'+p+'</b><small>'+lastTrained(p)+'</small></button>').join("")+
      '</div></section><section class="card"><h3>This week</h3><div class="tiles">'+tile("Workouts",ws.length)+tile("Volume",fmt(ws.reduce((a,w)=>a+volOf(w),0))+" kg")+'</div></section>';
  }
  if(A.cur!=null&&A.ex[A.cur]) return viewLogger(A);
  setHead(A.edit?"Editing · "+long(A.date):long(A.date)+(A.past?" · past workout":""),A.parts.join(" + "));
  const part=pickPart&&A.parts.includes(pickPart)?pickPart:A.parts[A.parts.length-1];
  const doneNames=A.ex.filter(e=>e.sets.length).map(e=>e.name);
  const first=!A.ex.some(e=>e.sets.length);
  const todayK=dkey(new Date());
  let h='<section class="card datecard"><div class="daterow"><h3>Workout date</h3><button class="chip datepick on" data-act="pickdate" data-for="act" aria-haspopup="dialog" aria-label="Change workout date"><span>'+(A.date===todayK?"Today":esc(short(A.date)))+'</span></button></div>'+
    (A.past?'<div class="durrow"><label for="actMinsIn">How long was it?</label><span><input type="number" id="actMinsIn" inputmode="numeric" min="5" max="300" step="5" value="'+(A.mins||60)+'"> min</span></div>'
      :'<div class="durrow"><label for="actDurIn">Workout time<small>'+(A.manual?'Set by you':'Started '+new Date(A.start).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})+' · counting')+'</small></label><span><input type="number" id="actDurIn" inputmode="numeric" min="1" max="300" step="5" value="'+liveMins(A)+'"> min</span></div>')+'</section>';
  if(!first){
    h+='<section class="card"><h3>'+(A.edit?"Exercises in this workout":"Done so far")+'</h3>'+(A.edit?'<p class="sub">Tap an exercise to change, add or delete its sets.</p>':'')+'<div class="done-ex">'+A.ex.filter(e=>e.sets.length).map(e=>
      '<div class="done-wrap"><button class="done-row" data-ex="'+esc(e.name)+'" data-part="'+esc(e.part)+'"><span>'+esc(e.name)+'</span><span class="num">'+e.sets.map(s=>wl(s.w,1)+"×"+s.r).join(", ")+'</span><i aria-hidden="true">›</i></button>'+
      '<button class="x done-x" data-rmex="'+esc(e.name)+'" aria-label="Remove '+esc(e.name)+'">×</button></div>').join("")+'</div></section>';
  }
  h+='<section class="card"><h2>'+(first?"Choose your first exercise":"Choose your next exercise")+'</h2><p class="sub">Tap one to start logging sets.</p>';
  h+='<div class="chips">'+A.parts.map(p=>'<button class="chip'+(p===part?" on":"")+'" data-pick="'+p+'">'+p+'</button>').join("")+
     '<button class="chip" data-act="toggleParts">'+(showAllParts?"Close":"+ Body part")+'</button></div>';
  if(showAllParts){
    const rest=partsOrder().filter(p=>!A.parts.includes(p));
    h+=rest.length?'<div class="chips">'+rest.map(p=>'<button class="chip" data-addpart="'+p+'">+ '+p+'</button>').join("")+'</div>':'';
  }
  h+='<div class="exlist">'+exercisesFor(part).map(n=>{
    const hs=history(n,A.id,A.date),l=hs[hs.length-1],done=doneNames.includes(n);
    const hint=done?"Done today":l?"Last: "+bestOfSets(l.sets)+" · "+short(l.date):"Not logged yet";
    return '<button class="ex'+(done?" done":"")+'" data-ex="'+esc(n)+'" data-part="'+part+'"><span class="thumb" aria-hidden="true">'+(exData(n)?'<img src="'+exData(n).img[0]+'" alt="" loading="lazy">':figSvg(n,part,false))+'</span><span class="exn"><b>'+esc(n)+'</b><small>'+hint+'</small></span><span class="go">›</span></button>';
  }).join("")+'</div>';
  h+='<form id="customForm" style="margin-top:12px" class="row"><input type="text" id="customName" maxlength="50" placeholder="Add your own '+part.toLowerCase()+' exercise" aria-label="Custom exercise name"><button class="btn ghost" type="submit" style="flex:0 0 auto">Add</button></form></section>';
  h+='<div class="stickybar"><div class="row">'+(first?'':'<button class="btn" data-act="finish">'+(A.edit?"Save changes":"Finish workout")+'</button>')+
     '<button class="btn ghost" data-act="discard">'+(A.edit?"Cancel editing":"Discard workout")+'</button></div></div>';
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
    return '<div class="set'+(popSet&&i===E.sets.length-1?" new":"")+(editSet===i?" editing":"")+'"><span class="n">'+(i+1)+'</span><button class="v" data-editset="'+i+'" aria-label="Edit set '+(i+1)+'">'+(s.w?kg(s.w)+' <small>kg</small>':'<small>Bodyweight</small>')+' × '+s.r+' <small>reps</small><svg class="pen" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg></button>'+
      (isPR?'<span class="pr">PR</span>':'<span></span>')+'<button class="x" data-delset="'+i+'" aria-label="Delete set '+(i+1)+'">×</button></div>'}).join("")+'</div>';
  h+='<div class="steppers">'+stepper("w","Weight (kg)",2.5)+stepper("r","Reps",1)+'</div>';
  if(editSet!=null&&!E.sets[editSet])editSet=null;
  h+=editSet!=null?'<button class="btn wide log" data-act="logset">Update set '+(editSet+1)+'</button><button class="link" data-act="canceledit" style="display:block;margin:8px auto 0">Cancel editing set</button>'
    :'<button class="btn wide log" data-act="logset">Log set '+(E.sets.length+1)+'</button>';
  h+='<p class="msg" id="msg">'+esc(msgText)+'</p></section>';
  const changed=exChanged(A);
  h+='<div class="stickybar">'+(E.sets.length||!A.snapNew?'<p class="sub savenote">'+(changed?'Not saved yet. Going back without saving discards '+(A.snapNew?'this exercise':'these changes')+'.':'All sets saved.')+'</p>':'')+
     '<div class="row"><button class="btn blue" data-act="doneex"'+(E.sets.length?'':' disabled')+'>Save exercise</button>'+
     '<button class="btn ghost" data-act="backex">'+(A.snapNew?(E.sets.length?"Discard exercise":"Pick a different one"):(changed?"Discard changes":"Back"))+'</button></div></div>';
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
/* Every PR you've ever set: a heavier top set than all earlier sessions of that exercise. */
function prEvents(){const best={},out=[];for(const w of sorted())for(const e of w.ex){const top=e.sets.reduce((m,s)=>s.w>m.w||(s.w===m.w&&s.r>m.r)?s:m,e.sets[0]||{w:0,r:0}),b=best[e.name]||0;
  if(b>0&&top.w>b)out.push({name:e.name,part:e.part,w:top.w,r:top.r,prev:b,date:w.date,wid:w.id});if(top.w>b)best[e.name]=top.w}return out.reverse()}
let prScope="period";
function openPrs(){const box=document.getElementById("dpick");dp=null;box.hidden=false;navPush({ov:"dpick"});drawPrs()}
function drawPrs(){
  const box=document.getElementById("dpick"),cur=keyOf({date:dkey(new Date())}),all=prEvents(),list=prScope==="all"?all:all.filter(x=>keyOf({date:x.date})===cur);
  const lbl=period==="week"?"This week":"This month";
  let h='<div class="dp-card prs-card" role="dialog" aria-modal="true" aria-label="Personal records"><div class="prs-h"><h3>Your PRs</h3><button class="dr-x" data-dpclose="1" aria-label="Close"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>'+
    '<div class="seg"><button class="'+(prScope!=="all"?"on":"")+'" data-prscope="period">'+lbl+' ('+all.filter(x=>keyOf({date:x.date})===cur).length+')</button><button class="'+(prScope==="all"?"on":"")+'" data-prscope="all">All time ('+all.length+')</button></div><div class="prs-list">';
  if(!list.length)h+='<p class="sub" style="text-align:center;margin:24px 0">'+(prScope==="all"?"No PRs yet. Beat your best weight on any exercise to set one.":"No PRs "+lbl.toLowerCase()+" yet. Go lift something heavier!")+'</p>';
  let last="";
  for(const x of list){const mo=monthName(x.date.slice(0,7));if(prScope==="all"&&mo!==last){last=mo;h+='<h4 class="ugrp">'+esc(mo)+'</h4>'}
    h+='<button class="prs-row" data-prw="'+x.wid+'"><span class="prb">PR</span><span class="prs-n"><b>'+esc(x.name)+'</b><small>'+esc(relDay(x.date))+' · was '+kg(x.prev)+' kg</small></span><span class="prs-v"><b class="num">'+kg(x.w)+' kg × '+x.r+'</b><small class="up">+'+kg(Math.round((x.w-x.prev)*100)/100)+' kg</small></span></button>'}
  box.innerHTML=h+'</div></div>';
}
document.getElementById("dpick").addEventListener("click",e=>{
  const sc=e.target.closest("[data-prscope]");if(sc){e.stopImmediatePropagation();prScope=sc.dataset.prscope;drawPrs();return}
  const r=e.target.closest("[data-prw]");if(r){e.stopImmediatePropagation();const wid=r.dataset.prw;navReplace({tab});closeDatePicker(true);openId=wid;go("home");setTimeout(()=>{const el=document.querySelector('[data-open="'+wid+'"]');if(el)el.scrollIntoView({block:"center"})},80)}
},true);
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
  if(!S.workouts.length)return h+trophyCase()+'<section class="card empty"><h3>No workouts yet</h3><p>Log your first workout and your progress shows up here.</p><button class="btn" data-tab-go="workout">Start a workout</button></section>';
  h+=trophyCase();
  h+='<section class="card"><h3>'+(period==="week"?"This week":"This month")+'</h3><div class="tiles">'+
    '<button class="tile tilebtn" data-act="showprs" aria-label="See all your PRs"><span>New PRs</span><b class="num">'+prsIn(cur)+'</b><em>tap to see the list ›</em></button>'+tile("Workouts",c.n,chip(ch(c.n,p.n),lbl))+
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
  const rows=Object.entries(rec).sort((a,b)=>b[1].d.localeCompare(a[1].d)||a[0].localeCompare(b[0])),shown=recsAll?rows:rows.slice(0,6);
  h+='<section class="card"><div class="tro-head"><h3>Personal records</h3><button class="link" data-act="showprs">PR history</button></div><p class="sub">Your best set for every exercise, newest first.</p><table class="stack"><thead><tr><th>Exercise</th><th class="r">Best set</th><th class="r">Est. 1RM</th><th class="r">Date</th></tr></thead><tbody>'+
    shown.map(([n,r])=>'<tr><td>'+esc(n)+'</td><td data-l="Best set" class="r num">'+wl(r.w)+' × '+r.r+'</td><td data-l="Est. 1RM" class="r num">'+(r.w?kg(Math.round(r.rm*2)/2)+' kg':'–')+'</td><td data-l="Date" class="r">'+short(r.d)+'</td></tr>').join("")+'</tbody></table>'+
    (rows.length>6?'<button class="link tro-more" data-act="allrecs">'+(recsAll?"Show fewer":"Show all "+rows.length+" exercises")+'</button>':'')+'</section>';
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
/* ---------- Trophies: "you vs you" achievements, earned from your own history ---------- */
const TI={ // trophy glyphs (stroke icons)
  flame:'<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 1.5 1 3 2.5 3 5"/>',
  crown:'<path d="M4 18h16M5 18 3.5 8l5 4L12 5l3.5 7 5-4L19 18"/>',
  bolt:'<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>',
  mountain:'<path d="M3 20 10 8l4 6 2-3 5 9z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  moon:'<path d="M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z"/>',
  star:'<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  shield:'<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/>',
  wheel:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 4v6M12 14v6M4 12h6M14 12h6"/>',
  rise:'<path d="M4 18 10 12l4 4 6-8"/><path d="M15 8h5v5"/>',
  clock:'<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  phoenix:'<path d="M12 21c-4-2-7-6-6-11 2 2 4 2 6 0 2 2 4 2 6 0 1 5-2 9-6 11z"/><path d="M12 10V4"/>',
  db:'<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>'
};
const TROPHIES=[
  // Showing up
  {id:"awaken",cat:"Showing up",icon:"db",name:"Daanav Awakens",desc:"Finish your first workout",goal:1,val:s=>s.n},
  {id:"w10",cat:"Showing up",icon:"star",name:"Rising Daanav",desc:"Finish 10 workouts",goal:10,val:s=>s.n},
  {id:"w25",cat:"Showing up",icon:"shield",name:"Daanav Yoddha",desc:"Finish 25 workouts",goal:25,val:s=>s.n},
  {id:"w50",cat:"Showing up",icon:"shield",name:"Daanav Senapati",desc:"Finish 50 workouts",goal:50,val:s=>s.n},
  {id:"w100",cat:"Showing up",icon:"crown",name:"Daanav Raja",desc:"Finish 100 workouts",goal:100,val:s=>s.n},
  {id:"w250",cat:"Showing up",icon:"crown",name:"Maha Daanav",desc:"Finish 250 workouts",goal:250,val:s=>s.n},
  // Consistency
  {id:"s2",cat:"Consistency",icon:"flame",name:"First Spark",desc:"Train 2 weeks in a row",goal:2,val:s=>s.bestRun},
  {id:"s4",cat:"Consistency",icon:"flame",name:"Agni Streak",desc:"Train 4 weeks in a row",goal:4,val:s=>s.bestRun},
  {id:"s12",cat:"Consistency",icon:"flame",name:"Tapasya",desc:"Train 12 weeks in a row",goal:12,val:s=>s.bestRun},
  {id:"s26",cat:"Consistency",icon:"flame",name:"Akhand Daanav",desc:"Train 26 weeks in a row",goal:26,val:s=>s.bestRun},
  {id:"s52",cat:"Consistency",icon:"crown",name:"Amar Daanav",desc:"Train every week for a year",goal:52,val:s=>s.bestRun},
  {id:"m12",cat:"Consistency",icon:"sun",name:"Maas Daanav",desc:"Train 12 days in one month",goal:12,val:s=>s.bestMonth},
  {id:"m20",cat:"Consistency",icon:"sun",name:"Nitya Daanav",desc:"Train 20 days in one month",goal:20,val:s=>s.bestMonth},
  {id:"back",cat:"Consistency",icon:"phoenix",name:"Punar Janma",desc:"Come back after 2+ weeks off",goal:1,val:s=>s.comebacks},
  // Strength
  {id:"pr1",cat:"Strength",icon:"bolt",name:"Pehli Vijay",desc:"Set your first personal record",goal:1,val:s=>s.prs},
  {id:"pr10",cat:"Strength",icon:"bolt",name:"Vijay Daanav",desc:"Set 10 personal records",goal:10,val:s=>s.prs},
  {id:"pr25",cat:"Strength",icon:"bolt",name:"Digvijay",desc:"Set 25 personal records",goal:25,val:s=>s.prs},
  {id:"pr50",cat:"Strength",icon:"crown",name:"Chakravarti",desc:"Set 50 personal records",goal:50,val:s=>s.prs},
  {id:"g10",cat:"Strength",icon:"rise",name:"Shakti Surge",desc:"Grow any lift's 1-rep max by 10%",goal:10,val:s=>Math.floor(s.bestGain),unit:"%"},
  {id:"g25",cat:"Strength",icon:"rise",name:"Dugni Shakti",desc:"Grow any lift's 1-rep max by 25%",goal:25,val:s=>Math.floor(s.bestGain),unit:"%"},
  // Intensity
  {id:"v5k",cat:"Intensity",icon:"mountain",name:"Bhaari Din",desc:"Lift 5,000 kg in one workout",goal:5000,val:s=>s.maxVol,unit:"kg"},
  {id:"v10k",cat:"Intensity",icon:"mountain",name:"Parvat Uthao",desc:"Lift 10,000 kg in one workout",goal:10000,val:s=>s.maxVol,unit:"kg"},
  {id:"l1",cat:"Intensity",icon:"mountain",name:"Lakh Kilo Daanav",desc:"Lift 1,00,000 kg in total",goal:100000,val:s=>s.vol,unit:"kg"},
  {id:"l10",cat:"Intensity",icon:"crown",name:"Das Lakh Daanav",desc:"Lift 10,00,000 kg in total",goal:1000000,val:s=>s.vol,unit:"kg"},
  {id:"long",cat:"Intensity",icon:"clock",name:"Dheeraj",desc:"Train for 90 minutes in one go",goal:90,val:s=>s.maxMins,unit:"min"},
  // Variety & timing
  {id:"sarva",cat:"Variety",icon:"wheel",name:"Sarva Anga",desc:"Train 5 body parts in one week",goal:5,val:s=>s.bestWeekParts},
  {id:"astra",cat:"Variety",icon:"wheel",name:"Astra Collector",desc:"Do 20 different exercises",goal:20,val:s=>s.exCount},
  {id:"dawn",cat:"Variety",icon:"sun",name:"Brahma Muhurta",desc:"Start a workout before 7 am",goal:1,val:s=>s.early},
  {id:"night",cat:"Variety",icon:"moon",name:"Raatri Daanav",desc:"Start a workout after 9 pm",goal:1,val:s=>s.late}
];
/* Replays your workouts in date order and records the day each trophy was first earned. */
function trophyState(list){
  const ws=(list||S.workouts).slice().sort((a,b)=>a.date.localeCompare(b.date)||(a.start||0)-(b.start||0));
  const s={n:0,bestRun:0,bestMonth:0,comebacks:0,prs:0,bestGain:0,maxVol:0,vol:0,maxMins:0,bestWeekParts:0,exCount:0,early:0,late:0};
  const best={},first1={},max1={},months={},weekParts={},exs=new Set(),earned={};
  let run=0,lastWk=null,lastDate=null;
  for(const w of ws){
    s.n++;const wk=weekOf(w.date);
    if(wk!==lastWk){let nx=null;if(lastWk){const p=parse(lastWk);p.setDate(p.getDate()+7);nx=dkey(p)}run=nx===wk?run+1:1;lastWk=wk}
    s.bestRun=Math.max(s.bestRun,run);
    if(lastDate&&(parse(w.date)-parse(lastDate))/864e5>=14)s.comebacks++;
    if(lastDate!==w.date){const mo=monthOf(w.date);months[mo]=(months[mo]||0)+1;s.bestMonth=Math.max(s.bestMonth,months[mo])}
    lastDate=w.date;
    (weekParts[wk]=weekParts[wk]||new Set());(w.parts||[]).forEach(p=>weekParts[wk].add(p));s.bestWeekParts=Math.max(s.bestWeekParts,weekParts[wk].size);
    const v=volOf(w);s.vol+=v;s.maxVol=Math.max(s.maxVol,v);
    if(w.start&&w.end&&w.end>w.start)s.maxMins=Math.max(s.maxMins,Math.round((w.end-w.start)/60000));
    if(w.start){const hr=new Date(w.start).getHours();if(hr<7&&hr>=3)s.early=1;if(hr>=21)s.late=1}
    for(const e of w.ex||[]){exs.add(e.name);
      let top=0;for(const st of e.sets||[]){top=Math.max(top,+st.w||0);if(st.w>0){const r=e1rm(st);if(first1[e.name]==null)first1[e.name]=r;max1[e.name]=Math.max(max1[e.name]||0,r);
        if(first1[e.name]>0)s.bestGain=Math.max(s.bestGain,(max1[e.name]/first1[e.name]-1)*100)}}
      const b=best[e.name]||0;if(b>0&&top>b)s.prs++;if(top>b)best[e.name]=top}
    s.exCount=exs.size;
    for(const t of TROPHIES)if(!earned[t.id]&&t.val(s)>=t.goal)earned[t.id]=w.date;
  }
  return{s,earned};
}
function trophyIcon(t,cls){return '<span class="tro-i'+(cls?" "+cls:"")+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(TI[t.icon]||TI.star)+'</svg></span>'}
let trophyCat="All",troOpen={};
function trophyCase(){
  const {s,earned}=trophyState(),got=TROPHIES.filter(t=>earned[t.id]).length,cats=[...new Set(TROPHIES.map(t=>t.cat))];
  const order=(a,b)=>(!!earned[b.id])-(!!earned[a.id])||(earned[b.id]||"").localeCompare(earned[a.id]||"")||(Math.min(1,b.val(s)/b.goal)-Math.min(1,a.val(s)/a.goal));
  const card=t=>{const e=earned[t.id],v=Math.min(t.val(s),t.goal),pct=Math.round(v/t.goal*100);
    return '<div class="tro'+(e?' got':'')+'">'+trophyIcon(t)+'<b>'+esc(t.name)+'</b><small>'+esc(t.desc)+'</small>'+
      (e?'<em class="tro-date">Earned '+short(e)+'</em>':'<span class="tro-bar" aria-label="'+pct+'% done"><i style="width:'+pct+'%"></i></span><em class="tro-p">'+(t.unit==="kg"?fmt(Math.round(v)):v)+' / '+(t.unit==="kg"?fmt(t.goal):t.goal)+(t.unit?' '+t.unit:'')+'</em>')+'</div>'};
  let h='<section class="card trophies" id="trophies"><div class="tro-head"><h3>Trophy case</h3><span class="tro-count"><b>'+got+'</b>/'+TROPHIES.length+'</span></div>'+
    '<p class="sub">You vs you. Every trophy is earned from your own training.</p>'+
    '<div class="admtabs">'+["All",...cats].map(c=>'<button class="chip'+(trophyCat===c?' on':'')+'" data-trocat="'+c+'">'+c+'</button>').join("")+'</div>';
  if(trophyCat==="All"&&!troOpen.__all){
    const top=TROPHIES.slice().sort(order).slice(0,4);
    return h+'<div class="tro-grid">'+top.map(card).join("")+'</div><button class="link tro-more" data-tromore="__all">Show all '+TROPHIES.length+' trophies</button></section>';
  }
  for(const c of cats){if(trophyCat!=="All"&&trophyCat!==c)continue;
    const list=TROPHIES.filter(t=>t.cat===c).sort(order),n=list.filter(t=>earned[t.id]).length,open=!!troOpen[c],show=open?list:list.slice(0,4);
    h+='<div class="tro-cat"><div class="tro-ch"><b>'+c+'</b><span>'+n+'/'+list.length+'</span></div><div class="tro-grid">'+show.map(card).join("")+'</div>'+
      (list.length>4?'<button class="link tro-more" data-tromore="'+c+'" aria-expanded="'+open+'">'+(open?'Show less':'Show '+(list.length-4)+' more')+'</button>':'')+'</div>';
  }
  if(trophyCat==="All")h+='<button class="link tro-more" data-tromore="__all">Show fewer</button>';
  return h+'</section>';
}
function newTrophies(before,after){return TROPHIES.filter(t=>after[t.id]&&!before[t.id])}

/* ---------- Home: streak + your activity feed ---------- */
let homeShow=15;
function timeOfDay(w){if(!w.start)return"";const h=new Date(w.start).getHours();return h<5?"Night":h<12?"Morning":h<17?"Afternoon":h<21?"Evening":"Night"}
function relDay(k){const t=dkey(new Date()),y=new Date();y.setDate(y.getDate()-1);if(k===t)return"Today";if(k===dkey(y))return"Yesterday";return long(k)}
function viewHome(){
  setHead("Home","Your training");
  const ws=sorted().reverse(),st=weekStreak(),today=dkey(new Date()),wk=weekOf(today),days=[0,0,0,0,0,0,0];
  S.workouts.filter(x=>weekOf(x.date)===wk).forEach(x=>{days[(parse(x.date).getDay()+6)%7]=1});
  const nWeek=S.workouts.filter(x=>weekOf(x.date)===wk).length,ti=(parse(today).getDay()+6)%7;
  let h=(gender()?'':genderCard())+(user.name||isGuest()?'':nameCard(true));
  if(S.active)h+='<button class="card resume" data-tab-go="workout"><span class="pbi" aria-hidden="true">'+actIcon("gym")+'</span><span class="pbt"><b>Workout in progress</b><small>'+esc(S.active.parts.join(" + "))+' · '+pl(S.active.ex.reduce((a,e)=>a+e.sets.length,0),"set")+' so far</small></span><span class="go" aria-hidden="true">›</span></button>';
  h+='<section class="card streak-hero"><div class="sh-top"><div><span class="sh-n num">'+st+'</span><span class="sh-l">week<br>streak</span></div>'+
    '<div class="sh-side"><b class="num">'+nWeek+'</b><small>'+(nWeek===1?"workout":"workouts")+' this week</small><b class="num">'+monthDays(monthOf(today))+'</b><small>days this month</small></div></div>'+
    '<div class="sh-week">'+["M","T","W","T","F","S","S"].map((l,i)=>'<span class="'+(days[i]?"on":"")+(i===ti?" today":"")+'"><i>'+(days[i]?actIcon("gym"):"")+'</i><small>'+l+'</small></span>').join("")+'</div>'+
    '<p class="sub sh-msg">'+(nWeek?(st>1?"You’ve trained "+st+" weeks in a row. Keep the chain going.":"Nice! This week counts toward your streak."):(st?"Train this week to keep your "+st+"-week streak alive.":"One workout this week starts your streak."))+'</p></section>';
  const {earned}=trophyState(),recent=TROPHIES.filter(t=>earned[t.id]).sort((a,b)=>earned[b.id].localeCompare(earned[a.id])).slice(0,3);
  if(recent.length)h+='<button class="card tro-strip" data-tab-go="progress" data-scroll="trophies"><span class="tsl">Latest trophies</span><span class="tsr">'+recent.map(t=>trophyIcon(t,"sm")).join("")+'</span><span class="tsn">'+esc(recent[0].name)+'</span><span class="go" aria-hidden="true">›</span></button>';
  h+='<div class="feedhead"><h3>Your activity</h3><button class="link" data-act="logpast">+ Log a past workout</button></div>';
  if(!ws.length)return h+'<section class="card empty"><h3>No workouts yet</h3><p>Your finished workouts show up here, newest first.</p><button class="btn" data-tab-go="workout">Start your first workout</button></section>';
  const prSet=prMap();
  for(const w of ws.slice(0,homeShow)){
    const open=openId===w.id,mins=w.start&&w.end&&w.end>w.start?Math.round((w.end-w.start)/60000):0,prs=prSet[w.id]||[];
    const tod=timeOfDay(w),title=(tod?tod+" ":"")+w.parts.join(" + ");
    h+='<section class="card act'+(open?' open':'')+'"><button class="wk" data-open="'+w.id+'" aria-expanded="'+open+'">'+
      '<span class="act-h">'+avHtml(isGuest()?"G":(user.name||user.email),myPhoto(),"sm")+'<span><b>'+esc(firstName()||"You")+'</b><small>'+relDay(w.date)+'</small></span></span>'+
      '<span class="act-t">'+esc(title)+'</span>'+
      '<span class="act-s"><span><small>Time</small><b class="num">'+(mins?mins+' min':'–')+'</b></span><span><small>Sets</small><b class="num">'+allSets(w).length+'</b></span><span><small>Volume</small><b class="num">'+fmt(volOf(w))+' kg</b></span>'+(prs.length?'<span class="hot"><small>PRs</small><b class="num">'+prs.length+'</b></span>':'')+'</span>'+
      '<span class="act-x">'+w.ex.slice(0,open?99:3).map(e=>{const t=e.sets.reduce((m,s)=>s.w>m.w||(s.w===m.w&&s.r>m.r)?s:m,e.sets[0]);
        return '<span><i>'+esc(e.name)+(prs.includes(e.name)?' <em class="prb">PR</em>':'')+'</i><b class="num">'+(open?e.sets.map(s=>wl(s.w)+"×"+s.r).join(" · "):pl(e.sets.length,"set")+' · best '+(t.w?wl(t.w):"BW")+'×'+t.r)+'</b></span>'}).join("")+
      (!open&&w.ex.length>3?'<span class="more">+'+(w.ex.length-3)+' more</span>':'')+'</span></button>';
    const nTro=TROPHIES.filter(t=>earned[t.id]===w.date).length,ach=[prs.length?pl(prs.length,"PR"):"",nTro?nTro+(nTro===1?" trophy":" trophies"):""].filter(Boolean).join(" · ");
    const shareRow='<div class="act-f"><span class="act-ach">'+(ach?'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+TI.star+'</svg>'+ach:'')+'</span><button class="act-share" data-sharew="'+w.id+'" aria-label="Share this workout">'+SHARE_ICON+'Share</button></div>';
    if(w.photo||open)h+='<div class="act-ph" data-phw="'+w.id+'" data-mode="'+(open?"feed":"feed-ro")+'">'+photoSlot(w.id,open?"feed":"feed-ro")+'</div>';
    if(open)h+='<div class="row act-a"><button class="btn" data-editw="'+w.id+'">Edit workout</button><button class="btn ghost" data-delw="'+w.id+'">Delete</button></div>';
    h+=shareRow;
    h+='</section>';
  }
  if(ws.length>homeShow)h+='<button class="btn ghost wide" data-act="homemore">Show older workouts</button>';
  return h;
}
/* PRs per workout id (heavier top set than ever before for that exercise). */
function prMap(){const best={},out={};for(const w of sorted())for(const e of w.ex){const top=Math.max(0,...e.sets.map(s=>+s.w||0)),b=best[e.name]||0;if(b>0&&top>b)(out[w.id]=out[w.id]||[]).push(e.name);if(top>b)best[e.name]=top}return out}

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
  h+=(isGuest()?'<section class="card"><h3>Profile photo</h3>'+photoBlock("G")+'</section>':'')+genderSection();
  h+='<section class="card"><h3>Theme</h3><div class="themes" role="radiogroup" aria-label="App theme">'+THEMES.map(t=>
    '<button class="theme" role="radio" aria-checked="'+(t.id===ct)+'" data-themepick="'+t.id+'"><span class="sw" style="background:'+t.bg+';color:'+t.fg+';font:'+t.font+'">Aa</span>'+
    '<span><b>'+t.name+(t.id==="red"?' <small style="display:inline;font-weight:600">· default</small>':'')+'</b><small>'+t.desc+'</small></span>'+
    '<span class="tick" aria-hidden="true">'+(t.id===ct?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>':'')+'</span></button>').join("")+'</div></section>';
  h+='<section class="card"><button class="btn danger wide" data-act="guestexit">'+SIGNOUT_ICON+'Leave trial mode</button><p class="sub" style="margin:10px 0 0">Your trial workouts stay on this phone and come back if you try again or sign up.</p></section>';
  return h;
}
/* ---------- Profile photo: resized on the phone to a small square JPEG and kept with the profile ---------- */
const myPhoto=()=>(S.profile&&S.profile.photo)||(user&&!user.guest&&user.photoURL)||"";
const safePhoto=p=>typeof p==="string"&&(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p)||/^https:\/\/[^\s"'<>]+$/.test(p))?p:"";
function avHtml(name,photo,cls){
  const ph=safePhoto(photo),ini=esc(((String(name||"").trim()[0])||"?").toUpperCase());
  return '<span class="av'+(cls?" "+cls:"")+(ph?" pic":"")+'" aria-hidden="true">'+(ph?'<img src="'+esc(ph)+'" alt="" referrerpolicy="no-referrer" onerror="this.remove()">':'')+'<i>'+ini+'</i></span>';
}
/* Load any picked photo as an <img>. iPhone HEIC photos open natively in Safari; other browsers
   (Chrome, Edge, Firefox on laptops) can't, so we convert them with heic2any, loaded only when needed. */
const isHeic=f=>/hei[cf]/i.test(f.type||"")||/\.(heic|heif)$/i.test(f.name||"");
const isImageFile=f=>!!f&&(/^image\//.test(f.type||"")||isHeic(f)||/\.(jpe?g|png|webp|gif|avif)$/i.test(f.name||""));
let heicLib=null;
function loadHeicLib(){if(!heicLib)heicLib=new Promise((res,rej)=>{if(window.heic2any){res(window.heic2any);return}const sc=document.createElement("script");sc.src="vendor/heic2any.min.js";sc.onload=()=>window.heic2any?res(window.heic2any):rej(new Error("heic"));sc.onerror=()=>{heicLib=null;rej(new Error("heic"))};document.head.appendChild(sc)});return heicLib}
function imgFromBlob(b){return new Promise((res,rej)=>{const url=URL.createObjectURL(b),img=new Image();img.onload=()=>{res(img);setTimeout(()=>URL.revokeObjectURL(url),1000)};img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error("decode"))};img.src=url})}
async function loadImageFile(file){
  if(!isImageFile(file))throw new Error("type");
  try{return await imgFromBlob(file)}catch(e){if(!isHeic(file))throw e}
  toast("Converting your iPhone photo…",null);
  const conv=await loadHeicLib(),out=await conv({blob:file,toType:"image/jpeg",quality:.9});
  return imgFromBlob(Array.isArray(out)?out[0]:out);
}
function photoToDataUrl(file,size){
  return loadImageFile(file).then(img=>{const s=Math.min(img.naturalWidth,img.naturalHeight);if(!s)throw new Error("size");
    const cv=document.createElement("canvas");cv.width=cv.height=size;const c=cv.getContext("2d");
    c.imageSmoothingQuality="high";c.drawImage(img,(img.naturalWidth-s)/2,(img.naturalHeight-s)/2,s,s,0,0,size,size);
    return cv.toDataURL("image/jpeg",0.82)});
}
/* Pick → adjust (drag to move, pinch / slider to zoom) → Set as profile photo */
let crop=null;
async function setPhoto(file){
  let img;try{img=await loadImageFile(file)}catch(e){toast("Couldn’t open that photo. Try a JPG, PNG or HEIC photo.",null);return}
  const V=280;crop={img,V,z:1,dx:0,dy:0,ptrs:{},pinch:null};
  const box=document.getElementById("dpick");dp=null;
  box.innerHTML='<div class="dp-card crop-card" role="dialog" aria-modal="true" aria-label="Adjust profile photo"><h3>Adjust your photo</h3><p class="sub">Drag to move, pinch or use the slider to zoom.</p>'+
    '<div class="crop-v" id="cropV"><canvas id="cropC" width="'+V*2+'" height="'+V*2+'"></canvas><span class="crop-ring" aria-hidden="true"></span></div>'+
    '<div class="crop-z"><span aria-hidden="true">−</span><input type="range" id="cropZ" min="1" max="4" step="0.01" value="1" aria-label="Zoom"><span aria-hidden="true">+</span></div>'+
    '<button type="button" class="btn wide" data-cropset="1">Set as profile photo</button><button type="button" class="link" data-dpclose="1" style="display:block;margin:10px auto 0">Cancel</button></div>';
  box.hidden=false;navPush({ov:"dpick"});drawCrop();
  const v=document.getElementById("cropV");
  v.addEventListener("pointerdown",e=>{v.setPointerCapture(e.pointerId);crop.ptrs[e.pointerId]={x:e.clientX,y:e.clientY};if(Object.keys(crop.ptrs).length===2)crop.pinch=pinchDist()},{passive:true});
  v.addEventListener("pointermove",e=>{if(!crop||!crop.ptrs[e.pointerId])return;const p0=crop.ptrs[e.pointerId],n=Object.keys(crop.ptrs).length;
    if(n===1){crop.dx+=e.clientX-p0.x;crop.dy+=e.clientY-p0.y}
    crop.ptrs[e.pointerId]={x:e.clientX,y:e.clientY};
    if(n===2&&crop.pinch){const d=pinchDist();setZoom(crop.z*d/crop.pinch);crop.pinch=d}
    drawCrop()});
  const up=e=>{if(crop){delete crop.ptrs[e.pointerId];crop.pinch=null}};v.addEventListener("pointerup",up);v.addEventListener("pointercancel",up);
  v.addEventListener("wheel",e=>{e.preventDefault();setZoom(crop.z*(e.deltaY<0?1.08:1/1.08));drawCrop()},{passive:false});
  document.getElementById("cropZ").addEventListener("input",e=>{setZoom(+e.target.value);drawCrop()});
}
function pinchDist(){const p=Object.values(crop.ptrs);return Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)||1}
function setZoom(z){crop.z=Math.max(1,Math.min(4,z));const r=document.getElementById("cropZ");if(r)r.value=crop.z}
function cropGeom(size){const{img,V}=crop,k=size/V,s0=Math.max(V/img.naturalWidth,V/img.naturalHeight),s=s0*crop.z,w=img.naturalWidth*s,h=img.naturalHeight*s;
  crop.dx=Math.max(-(w-V)/2,Math.min((w-V)/2,crop.dx));crop.dy=Math.max(-(h-V)/2,Math.min((h-V)/2,crop.dy));
  return{x:((V-w)/2+crop.dx)*k,y:((V-h)/2+crop.dy)*k,w:w*k,h:h*k}}
function drawCrop(){const c=document.getElementById("cropC");if(!c||!crop)return;const x=c.getContext("2d"),g=cropGeom(c.width);x.fillStyle="#000";x.fillRect(0,0,c.width,c.height);x.imageSmoothingQuality="high";x.drawImage(crop.img,g.x,g.y,g.w,g.h)}
document.getElementById("dpick").addEventListener("click",e=>{
  if(!e.target.closest("[data-cropset]")||!crop)return;e.stopImmediatePropagation();
  const out=document.createElement("canvas");out.width=out.height=256;const x=out.getContext("2d"),g=cropGeom(256);x.imageSmoothingQuality="high";x.drawImage(crop.img,g.x,g.y,g.w,g.h);
  const d=out.toDataURL("image/jpeg",.85);crop=null;closeDatePicker();
  S.profile=Object.assign({},S.profile,{photo:d});markState();render();toast("Profile photo updated",null);pushPhoto();
},true);
function removePhoto(){const p=Object.assign({},S.profile);delete p.photo;S.profile=p;markState();render();toast("Photo removed",null);pushPhoto()}
/* Also show it on the leaderboard and in Admin (separate write so a missing rule can't block anything else). */
async function pushPhoto(){
  if(!fdb||!user||isGuest()||!navigator.onLine)return;const ph=safePhoto(myPhoto());
  try{await timeout(FB.setDoc(FB.doc(fdb,"users",user.id),{photo:ph},{merge:true}),10000)}catch(e){}
}
function photoBlock(name){
  const has=!!(S.profile&&S.profile.photo);
  return '<div class="pfp">'+avHtml(name,myPhoto(),"xl")+'<div class="pfp-b"><label class="btn ghost pfp-up"><input type="file" id="photoIn" accept="image/*,.heic,.heif">'+(myPhoto()?"Change photo":"Add photo")+'</label>'+
    (has?'<button class="link" data-act="rmphoto" type="button">Remove photo</button>':'')+'</div></div>';
}
function genderCard(){
  return '<section class="card gcard"><h3>Who’s training?</h3><p class="sub">We’ll put the body parts and exercises that suit you first. You can change this any time in Account.</p><div class="gopts">'+
    G_OPTS.map(([v,l])=>'<button class="btn ghost" data-gender="'+v+'">'+l+'</button>').join("")+'</div></section>';
}
function genderSection(){
  const g=gender();
  return '<section class="card"><h3>Training profile</h3><p class="sub">Used to suggest body parts and exercises. Everyone can still use every exercise.</p><div class="seg gseg" role="radiogroup" aria-label="Gender">'+
    G_OPTS.map(([v,l])=>'<button role="radio" aria-checked="'+(g===v)+'" class="'+(g===v?"on":"")+'" data-gender="'+v+'">'+l+'</button>').join("")+'</div></section>';
}
function viewAccount(){
  if(isGuest())return viewGuestAccount();
  setHead("Account",user.name||"Your account");
  const pv=user.providers||[],pw=pv.includes("password");
  const phone=acctDraft?acctDraft.ph:(S.profile&&S.profile.phone)||user.phone||"";
  const nmv=acctDraft?acctDraft.nm:user.name||"";
  let h='<section class="card"><h3>Profile</h3>'+photoBlock(nmv||user.email)+'<form id="profileForm">'+
    '<label class="fl" for="nm">Name</label><input type="text" id="nm" maxlength="40" autocomplete="name" placeholder="Your name" value="'+esc(nmv)+'">'+
    '<label class="fl" for="ph">Phone number</label><input type="tel" id="ph" maxlength="20" autocomplete="tel" inputmode="tel" placeholder="e.g. 98765 43210" value="'+esc(phone)+'">'+
    '<button class="btn wide" type="submit" style="margin-top:14px">Save</button></form><p class="msg">'+esc(acctMsg.name||"")+'</p>'+
    (user.email?'<dl class="facts"><div><dt>Email</dt><dd>'+esc(user.email)+'</dd></div></dl>':'')+'</section>';
  const ct=curTheme();
  h+=(isGuest()?'<section class="card"><h3>Profile photo</h3>'+photoBlock("G")+'</section>':'')+genderSection();
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
  if(authMode==="signup")h+='<label class="fl" for="au-name">Your name</label><input type="text" id="au-name" maxlength="40" autocomplete="name" value="'+esc(authName)+'">'+
    '<fieldset class="gpick"><legend class="fl">I am</legend>'+G_OPTS.map(([v,l])=>'<label><input type="radio" name="au-gender" value="'+v+'"'+(authGender===v?" checked":"")+'><span>'+l+'</span></label>').join("")+'</fieldset>';
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
  if(authMode==="signup"){const gr=document.querySelector('input[name="au-gender"]:checked');authGender=gr?gr.value:"";authName=((document.getElementById("au-name")||{}).value||"").trim().replace(/\s+/g," ").slice(0,40);
    if(!authName){authMsg="Enter your name.";render();return}}
  if(!/^\S+@\S+\.\S+$/.test(em||"")){authMsg="Enter a valid email address.";render();return}
  if(authMode!=="forgot"&&(!pass||pass.length<6)){authMsg="Password must be at least 6 characters.";render();return}
  if(!navigator.onLine){authMsg="You’re offline. Connect to the internet to sign in.";render();return}
  authBusy=true;authMsg="";render();
  try{
    if(authMode==="signin")await FB.signInWithEmailAndPassword(fbAuth,em,pass);
    else if(authMode==="signup"){
      pendingName=authName;pendingGender=authGender;
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
  if(signedIn){const nm=isGuest()?"G":(user.name||user.email||"D");const old=mb.querySelector(".av");const tmp=document.createElement("div");tmp.innerHTML=avHtml(nm,myPhoto());if(old.outerHTML!==tmp.firstChild.outerHTML)old.replaceWith(tmp.firstChild)}
  if(!signedIn){app.innerHTML=viewAuth();return}
  if(tab==="admin"&&!isAdmin())tab="account";
  if(tab==="invite"&&(isGuest()||!(CONF.referral.enabled||isAdmin())))tab="account";
  if(tab==="plans"&&!(CONF.pricing.enabled||isAdmin()))tab="account";
  if(!TABS.includes(tab))tab="home";
  const v=tab==="home"?viewHome():tab==="workout"?viewWorkout():tab==="progress"?viewProgress():tab==="admin"?viewAdmin():tab==="plans"?viewPlans():tab==="invite"?viewInvite():viewAccount();
  const ann=CONF.general.announcement&&tab!=="admin"?'<section class="card announce" role="status">'+esc(CONF.general.announcement)+'</section>':'';
  app.innerHTML=ann+(isGuest()&&!["account","plans"].includes(tab)?guestBanner(tab!=="home"):'')+v;
  fitText(app);syncUrl();document.body.classList.toggle("lifting",!!S.active);
  document.querySelectorAll("nav button").forEach(b=>{b.classList.toggle("on",b.dataset.tab===tab);b.setAttribute("aria-current",b.dataset.tab===tab?"page":"false")});
  ro.disconnect();const f=document.getElementById("fig");if(f){ro.observe(f);drawChart()}
  msgText="";
}
/* ---------- Back button / swipe-back: every screen and pop-up gets a history entry ---------- */
const NAV=window.history;let skipPop=0;
const navState=()=>NAV.state||{};
function navPush(extra){try{NAV.pushState(Object.assign({tab,d:(navState().d||1)+1},extra||{}),"")}catch(e){}}
function navReplace(st){try{NAV.replaceState(Object.assign({d:navState().d||1},st),"")}catch(e){}}
function navPopIf(key,val){if(navState()[key]===val){skipPop++;NAV.back()}}
/* Keep the current screen in the address (#progress, #admin/users …) so a refresh reopens it. */
const TABS=["home","workout","progress","account","plans","invite","admin"];
let bootAdmSub="";
{const h0=decodeURIComponent(location.hash.slice(1)).split("/");if(h0[0]==="history"||h0[0]==="leaderboard")h0[0]="home";if(TABS.includes(h0[0])){tab=h0[0];bootAdmSub=h0[1]||""}}
/* History is kept flat: [guard] → [Home] → [one page] (+ pop-ups on top).
   Back from any page lands on Home; back on Home stays on Home. */
try{const t0=tab,h0=location.hash,base=location.pathname+location.search;NAV.replaceState({guard:1,d:0},"",base);NAV.pushState({tab:"home",root:1,d:1},"",base);if(t0!=="home")NAV.pushState({tab:t0,d:2},"",base+h0)}catch(e){}
function goRootHome(){const d=navState().d||1;if(d>1){skipPop++;try{NAV.go(1-d)}catch(e){skipPop--}}if(tab!=="home")go("home",true);else render()}
function syncUrl(){
  let sub="";if(tab==="admin")try{sub="/"+admSub}catch(e){}
  const want=tab==="home"?"":"#"+tab+sub;
  if(location.hash!==want)try{NAV.replaceState(NAV.state,"",want||location.pathname+location.search)}catch(e){}
}
addEventListener("popstate",e=>{
  if(skipPop){skipPop--;syncUrl();return}
  const st=e.state||{},sh=document.getElementById("share"),z=document.getElementById("zoom"),ce=document.getElementById("cele");
  if(!sh.hidden){sh.hidden=true;return}
  if(!document.getElementById("dpick").hidden){closeDatePicker(true);return}
  if(!z.hidden){closeZoom(true);return}
  if(!drawer.hidden){closeDrawer(true);return}
  if(!ce.hidden){closeCele(true);return}
  if(!user){if(authMode!=="signin"){authMode="signin";authMsg="";render()}return}
  if(isGuest()&&authOpen){authOpen=false;authMsg="";render();return}
  const A=S.active;
  if(A&&A.cur!=null&&tab==="workout"&&!st.ex){discardExercise(true);return}
  if(st.guard){try{NAV.pushState({tab:"home",root:1,d:1},"")}catch(x){}if(tab!=="home")go("home",true);else render();return}
  if(st.root){if(tab!=="home")go("home",true);else render();return}
  // landed on a page entry from something deeper: always continue to Home
  const d=st.d||2;skipPop++;try{NAV.go(1-d)}catch(x){skipPop--}
  if(tab!=="home")go("home",true);else render();
});
function goBack(){goRootHome()}
function go(t,noPush){
  if(!noPush&&t!==tab){
    if(t==="home"){const d=navState().d||1;if(d>1){skipPop++;try{NAV.go(1-d)}catch(e){skipPop--}}}
    else{const s0=navState();try{if(s0.root||s0.guard)NAV.pushState({tab:t,d:2},"");else NAV.replaceState({tab:t,d:s0.d||2},"")}catch(e){}}
  }tab=t;render();window.scrollTo(0,0);app.classList.remove("enter");void app.offsetWidth;app.classList.add("enter");clearTimeout(go.t);go.t=setTimeout(()=>app.classList.remove("enter"),700)}
const liveMins=A=>A.manual?A.mins:Math.max(1,Math.round((Date.now()-A.start)/60000));
function startWorkout(p){
  const today=dkey(new Date()),past=logDate&&logDate<today?logDate:null;
  S.active=past?{id:uid(),date:past,start:parse(past).setHours(18,0,0,0),past:true,mins:Math.max(5,Math.min(300,pastMins||60)),parts:[p],ex:[],cur:null}
    :{id:uid(),date:today,start:Date.now(),parts:[p],ex:[],cur:null};
  logDate=null;pickPart=p;showAllParts=false;markState();render();window.scrollTo(0,0);
}
function editWorkout(wid){
  const w=S.workouts.find(x=>x.id===wid);if(!w)return;
  if(S.active){toast(S.active.edit?"You’re already editing a workout.":"Finish or discard your current workout first.",null);go("workout");return}
  const mins=w.start&&w.end&&w.end>w.start?Math.round((w.end-w.start)/60000):60;
  S.active={id:w.id,edit:w.id,date:w.date,start:w.start||parse(w.date).setHours(18,0,0,0),past:true,mins:Math.max(5,Math.min(300,mins)),parts:w.parts.slice(),ex:JSON.parse(JSON.stringify(w.ex)),cur:null};
  pickPart=w.parts[0];showAllParts=false;editSet=null;markState();go("workout");window.scrollTo(0,0);
}
function openEx(name,part){
  const A=S.active;let i=A.ex.findIndex(e=>e.name===name);
  A.snapNew=i<0;
  if(i<0){A.ex.push({name,part,sets:[]});i=A.ex.length-1}
  A.snap=JSON.stringify(A.ex[i].sets);
  A.cur=i;draft={w:"",r:""};editSet=null;navPush({ex:1});markState();render();window.scrollTo(0,0);
}
function exChanged(A){const E=A&&A.ex[A.cur];return !!E&&(A.snapNew?E.sets.length>0:JSON.stringify(E.sets)!==A.snap)}
function saveExercise(){const A=S.active;delete A.snap;delete A.snapNew;editSet=null;cleanActive();draft={w:"",r:""};markState();render();window.scrollTo(0,0);navPopIf("ex",1)}
function discardExercise(fromPop){
  const A=S.active;if(!A||A.cur==null)return;const E=A.ex[A.cur],had=exChanged(A);
  if(E){if(A.snapNew)A.ex.splice(A.cur,1);else if(A.snap!=null)E.sets=JSON.parse(A.snap)}
  delete A.snap;delete A.snapNew;editSet=null;cleanActive();draft={w:"",r:""};markState();render();window.scrollTo(0,0);
  if(fromPop!==true)navPopIf("ex",1);
  if(had)toast(E?(E.name+" not saved"):"Not saved",null);
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

/* ---------- "How long was your workout?" — shown before saving when everything was logged in a few minutes ---------- */
let finishConfirmed=false;
/* Finish → confirm with an editable workout time, then celebrate. */
function askFinish(){
  const A=S.active,box=document.getElementById("dpick");dp=null;
  const el=A.past?(A.mins||60):liveMins(A),sets=A.ex.reduce((x,e)=>x+e.sets.length,0),vol=A.ex.reduce((x,e)=>x+e.sets.reduce((y,s)=>y+s.w*s.r,0),0);
  const quick=!A.past&&!A.manual&&el<10&&sets>=4,def=quick?60:el;
  box.innerHTML='<div class="dp-card dur-card" role="dialog" aria-modal="true" aria-label="Finish workout"><h3>Finish workout?</h3>'+
    '<p class="fin-sum"><b>'+pl(A.ex.length,"exercise")+'</b> · <b>'+pl(sets,"set")+'</b>'+(vol?' · <b>'+fmt(Math.round(vol))+' kg</b>':'')+'</p>'+
    '<div class="durrow"><label for="durSheetIn">Workout time<small>'+(A.past?long(A.date):'Started '+new Date(A.start).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"}))+'</small></label><span><input type="number" id="durSheetIn" inputmode="numeric" min="1" max="300" step="5" value="'+def+'"> min</span></div>'+
    (quick?'<p class="sub fin-note">You logged everything in '+pl(el,"minute")+', so we’ve suggested 60 min. Change it to your real time.</p>':'')+
    '<div class="durpick">'+[30,45,60,75,90].map(m=>'<button type="button" class="chip'+(m===def?" on":"")+'" data-durq="'+m+'">'+m+' min</button>').join("")+'</div>'+
    '<button type="button" class="btn wide" data-durok="1" style="margin-top:12px">Finish & save</button>'+
    '<button type="button" class="link" data-dpclose="1" style="display:block;margin:10px auto 0">Keep training</button></div>';
  box.hidden=false;navPush({ov:"dpick"});
}
document.getElementById("dpick").addEventListener("click",e=>{
  const q=e.target.closest("[data-durq]");if(q){document.getElementById("durSheetIn").value=q.dataset.durq;document.querySelectorAll("[data-durq]").forEach(x=>x.classList.toggle("on",x===q));return}
  const ok=e.target.closest("[data-durok]"),keep=e.target.closest("[data-durkeep]");if(!ok&&!keep)return;
  e.stopImmediatePropagation();
  const A=S.active;if(!A)return;
  if(ok){const n=parseInt(document.getElementById("durSheetIn").value,10);if(n>0){A.mins=Math.max(1,Math.min(300,n));if(!A.past)A.manual=true}}
  navReplace({tab});closeDatePicker(true);finishConfirmed=true;finish();
},true);

/* ---------- Date picker (in-app, same on every phone and laptop) ---------- */
let dp=null;
function setActDate(v){
  const today=dkey(new Date()),A=S.active;if(!A||!/^\d{4}-\d{2}-\d{2}$/.test(v)||v>today)return;
  if(A.edit){const t=new Date(A.start||Date.now()),d=parse(v);d.setHours(t.getHours(),t.getMinutes(),0,0);A.date=v;A.start=+d;markState();return}
  if(v===today){if(A.past){A.past=false;delete A.mins;A.start=Date.now()}A.date=today}
  else{A.date=v;A.past=true;A.mins=A.mins||60;A.start=parse(v).setHours(18,0,0,0)}
  markState();
}
function openDatePicker(forWhat){
  const today=dkey(new Date()),y=new Date();y.setDate(y.getDate()-1);
  const max=forWhat==="log"?dkey(y):today,sel=forWhat==="log"?(logDate||""):(S.active&&S.active.date||today);
  dp={for:forWhat,max,sel,ym:(sel||max).slice(0,7)};
  document.getElementById("dpick").hidden=false;navPush({ov:"dpick"});drawDatePicker();
}
function drawDatePicker(){
  const el=document.getElementById("dpick");if(!dp)return;
  const[y,m]=dp.ym.split("-").map(Number),lead=(new Date(y,m-1,1).getDay()+6)%7,n=new Date(y,m,0).getDate(),t=trainedDays(),today=dkey(new Date());
  const maxYm=dp.max.slice(0,7),minYm="2015-01";
  let g='';for(let i=0;i<lead;i++)g+='<span class="pad"></span>';
  for(let d=1;d<=n;d++){const k=dp.ym+"-"+pad(d),dis=k>dp.max;
    g+='<button type="button" class="'+[t.has(k)?"has":"",k===dp.sel?"sel":"",k===today?"today":""].join(" ").trim()+'"'+(dis?' disabled':' data-dpday="'+k+'"')+' aria-label="'+esc(long(k))+(t.has(k)?", has a workout":"")+'">'+d+'</button>'}
  el.innerHTML='<div class="dp-card" role="dialog" aria-modal="true" aria-label="Pick the workout date"><h3>'+(dp.for==="log"?"Which day did you train?":"Change workout date")+'</h3>'+
    '<div class="calnav"><button type="button" data-dpm="-1" aria-label="Previous month"'+(dp.ym<=minYm?" disabled":"")+'>‹</button><b>'+esc(monthName(dp.ym))+'</b><button type="button" data-dpm="1" aria-label="Next month"'+(dp.ym>=maxYm?" disabled":"")+'>›</button></div>'+
    '<div class="cal dp">'+["M","T","W","T","F","S","S"].map(l=>'<b aria-hidden="true">'+l+'</b>').join("")+g+'</div>'+
    '<p class="sub dp-key"><span class="dot"></span> days you already logged</p>'+
    '<button type="button" class="btn ghost wide" data-dpclose="1">Cancel</button></div>';
}
function closeDatePicker(fromPop){const el=document.getElementById("dpick");if(el.hidden)return;crop=null;if(fromPop!==true)navPopIf("ov","dpick");el.hidden=true;el.innerHTML="";dp=null}
document.getElementById("dpick").addEventListener("click",e=>{
  const el=e.currentTarget;
  if(e.target===el||e.target.closest("[data-dpclose]")){closeDatePicker();return}
  const mb=e.target.closest("[data-dpm]");if(mb&&!mb.disabled){const[y,m]=dp.ym.split("-").map(Number),nd=new Date(y,m-1+(+mb.dataset.dpm),1);dp.ym=nd.getFullYear()+"-"+pad(nd.getMonth()+1);drawDatePicker();return}
  const db=e.target.closest("[data-dpday]");if(!db)return;
  const k=db.dataset.dpday,f=dp.for;closeDatePicker();
  if(f==="log"){logDate=k;msgText=""}else setActDate(k);
  render();
});

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
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeDatePicker();closeZoom()}});

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
    ((d.trophies||[]).length?'<div class="tro-won up1 d5"><span class="tw-l">Trophy unlocked</span>'+d.trophies.map(t=>'<div class="tw">'+trophyIcon(t)+'<span><b>'+esc(t.name)+'</b><small>'+esc(t.desc)+'</small></span></div>').join("")+'</div>':'')+
    (d.id?'<div class="cele-ph up1 d5" data-phw="'+d.id+'" data-mode="cele">'+photoSlot(d.id,"cele")+'</div>':'')+
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
function closeCele(fromPop){const el=document.getElementById("cele");el.hidden=true;el.innerHTML="";document.body.classList.remove("celebrating");cancelAnimationFrame(celeRaf);openId=null;goRootHome();window.scrollTo(0,0)}
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
/* ---------- Post-workout photos ----------
   Kept on the phone in IndexedDB (localStorage is too small for photos) and, when signed in,
   in users/{uid}/photos/{workoutId}. They're only downloaded when a workout is shown. */
const PH={},phLoading={};
const phKey=wid=>(user?user.id:"x")+":"+wid;
let idbP=null;
function idb(){if(!idbP)idbP=new Promise((res,rej)=>{try{const r=indexedDB.open("daanav-photos",1);r.onupgradeneeded=()=>r.result.createObjectStore("p");r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}catch(e){rej(e)}});return idbP}
async function idbOp(mode,fn){const db=await idb();return new Promise((res,rej)=>{const tx=db.transaction("p",mode),st=tx.objectStore("p"),q=fn(st);tx.oncomplete=()=>res(q&&q.result);tx.onerror=()=>rej(tx.error)})}
const idbGet=k=>idbOp("readonly",st=>st.get(k)).catch(()=>null);
const idbSet=(k,v)=>idbOp("readwrite",st=>st.put(v,k)).catch(()=>null);
const idbDel=k=>idbOp("readwrite",st=>st.delete(k)).catch(()=>null);
const phPendKey=()=>"daanav-photo-pending:"+(user?user.id:"x");
function phPending(){try{return JSON.parse(localStorage.getItem(phPendKey())||"{}")}catch(e){return{}}}
function phSetPending(o){try{localStorage.setItem(phPendKey(),JSON.stringify(o))}catch(e){}}
function workoutPhoto(w){
  if(!w||!w.photo)return"";if(PH[w.id])return PH[w.id];
  if(!phLoading[w.id]){phLoading[w.id]=1;(async()=>{
    let d=await idbGet(phKey(w.id));
    if(!d&&fdb&&user&&!isGuest()&&navigator.onLine){try{const sn=await timeout(FB.getDoc(FB.doc(fdb,"users",user.id,"photos",w.id)),12000);if(sn.exists()){d=sn.data().data;if(d)idbSet(phKey(w.id),d)}}catch(e){}}
    if(d){PH[w.id]=d}else phLoading[w.id]="none";refreshPhotos(w.id);
  })()}
  return"";
}
function refreshPhotos(wid){
  document.querySelectorAll('[data-phw="'+wid+'"]').forEach(el=>{el.innerHTML=photoSlot(wid,el.dataset.mode)});
}
async function uploadPhoto(wid){
  if(!fdb||!user||isGuest())return;const d=PH[wid]||await idbGet(phKey(wid)),pend=phPending();
  if(!navigator.onLine){pend[wid]=d?1:-1;phSetPending(pend);return}
  try{if(d)await timeout(FB.setDoc(FB.doc(fdb,"users",user.id,"photos",wid),{data:d,updatedAt:stamp()}),20000);else await timeout(FB.deleteDoc(FB.doc(fdb,"users",user.id,"photos",wid)),12000);delete pend[wid]}
  catch(e){pend[wid]=d?1:-1}
  phSetPending(pend);
}
function retryPhotos(){const p=phPending();Object.keys(p).forEach(uploadPhoto)}
async function setWorkoutPhoto(wid,file){
  const w=S.workouts.find(x=>x.id===wid);if(!w)return;
  let d;try{d=await photoToStory(file)}catch(e){toast("Couldn’t open that photo. Try a JPG, PNG or HEIC photo.",null);return}
  PH[wid]=d;idbSet(phKey(wid),d);if(!w.photo){w.photo=true;markUp(wid)}save();
  refreshPhotos(wid);toast("Photo added",null);uploadPhoto(wid);
}
function removeWorkoutPhoto(wid){
  const w=S.workouts.find(x=>x.id===wid);if(!w)return;
  delete PH[wid];idbDel(phKey(wid));w.photo=false;markUp(wid);refreshPhotos(wid);toast("Photo removed",null);uploadPhoto(wid);
}
/* Resize keeping the shape, longest side 1080px, JPEG — about 100–250 KB. */
function photoToStory(file){
  return loadImageFile(file).then(img=>{const W=img.naturalWidth,H=img.naturalHeight;if(!W||!H)throw new Error("size");
    const k=Math.min(1,1080/Math.max(W,H)),cv=document.createElement("canvas");cv.width=Math.round(W*k);cv.height=Math.round(H*k);
    const c=cv.getContext("2d");c.imageSmoothingQuality="high";c.drawImage(img,0,0,cv.width,cv.height);
    let q=.82,d=cv.toDataURL("image/jpeg",q);while(d.length>700000&&q>.4){q-=.1;d=cv.toDataURL("image/jpeg",q)}return d});
}
/* mode "cele" = celebration screen, "feed" = Home card */
function photoSlot(wid,mode){
  const w=S.workouts.find(x=>x.id===wid),ph=w?workoutPhoto(w):"";
  const cam='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="4"/></svg>';
  if(ph)return '<figure class="wph"><img src="'+esc(ph)+'" alt="Post-workout photo"></figure>'+
    (mode==="feed-ro"?'':'<div class="wph-a"><label class="link"><input type="file" accept="image/*,.heic,.heif" data-phin="'+wid+'">Change photo</label><button class="link" type="button" data-phrm="'+wid+'">Remove</button></div>');
  if(w&&w.photo&&phLoading[w.id]!=="none")return '<figure class="wph loading"><span>Loading photo…</span></figure>';
  if(w&&w.photo&&mode==="feed-ro")return '<p class="sub wph-miss">Photo is on another device and hasn’t synced yet.</p>';
  if(mode==="feed-ro")return"";
  return '<label class="wph-add'+(mode==="cele"?" big":"")+'"><input type="file" accept="image/*,.heic,.heif" data-phin="'+wid+'">'+cam+'<span><b>Add your post-workout photo</b><small>'+(mode==="cele"?"It goes on your story and your Home feed":"Show off the pump")+'</small></span></label>';
}
document.addEventListener("change",e=>{const t=e.target;if(t&&t.dataset&&t.dataset.phin){const f=t.files&&t.files[0];const wid=t.dataset.phin;t.value="";if(f)setWorkoutPhoto(wid,f)}});
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-phrm]");if(b){e.stopPropagation();removeWorkoutPhoto(b.dataset.phrm)}},true);

/* Story data for any saved workout (used by Share on the Home feed). */
function streakAt(date){const wk=new Set(S.workouts.filter(x=>x.date<=date).map(x=>weekOf(x.date))),d=parse(weekOf(date));let n=0;while(wk.has(dkey(d))){n++;d.setDate(d.getDate()-7)}return n}
function shareDataFor(w){
  const prs=[];for(const e of w.ex){const b=bestW(e.name,w.id,w.date),top=e.sets.reduce((m,s)=>s.w>m.w||(s.w===m.w&&s.r>m.r)?s:m,e.sets[0]);if(b>0&&top.w>b)prs.push({name:e.name,w:top.w,r:top.r})}
  const ym=monthOf(w.date),{earned}=trophyState();
  return{id:w.id,date:w.date,vol:volOf(w),sets:allSets(w).length,mins:w.start&&w.end&&w.end>w.start?Math.max(1,Math.round((w.end-w.start)/60000)):0,prs,parts:w.parts,
    streak:streakAt(w.date),monthDays:[...trainedDays()].filter(k=>k.slice(0,7)===ym&&k<=w.date).length,cal:[...trainedDays()].filter(k=>k.slice(0,7)===ym&&k<=w.date).map(k=>+k.slice(8)),
    trophies:TROPHIES.filter(t=>earned[t.id]===w.date).map(t=>({name:t.name,desc:t.desc,icon:t.icon})),
    ex:w.ex.map(e=>{const t=e.sets.reduce((m,s)=>s.w>m.w||(s.w===m.w&&s.r>m.r)?s:m,e.sets[0]);return{name:e.name,w:t.w,r:t.r,n:e.sets.length}})};
}
async function shareWorkout(wid){const w=S.workouts.find(x=>x.id===wid);if(!w)return;if(w.photo&&!PH[w.id]){const d=await idbGet(phKey(w.id));if(d)PH[w.id]=d}openShare(workoutSpec(shareDataFor(w)))}
function workoutSpec(d){
  const prN=new Set(d.prs.map(p=>p.name));
  return{photo:PH[d.id]||"",dateLabel:long(d.date).toUpperCase(),kicker:(d.parts.join(" + ")+" DAY").toUpperCase(),
    stats:[["LIFTED",fmt(d.vol),"kg"],["SETS",String(d.sets),""],["TIME",d.mins?String(d.mins):"–",d.mins?"min":""],["PRs",String(d.prs.length),"",d.prs.length>0]],
    ym:monthOf(d.date),cal:d.cal||[],mark:[+d.date.slice(8)],streak:d.streak,monthDays:d.monthDays,
    rows:(d.trophies||[]).map(t=>({name:t.name,right:"",badge:"TROPHY"})).concat((d.ex||[]).slice().sort((a,b)=>prN.has(b.name)-prN.has(a.name)).slice(0,4).map(r=>({name:r.name,right:(r.w?kg(r.w)+" kg":"BW")+" × "+r.r,badge:prN.has(r.name)?"PR":""})))};
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
  const HL=sp.h||P.h;let y;
  const pim=sp.photo?await new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=sp.photo}):null;
  if(pim){
    // post-workout photo with the headline on it
    const py=350,ph2=760;c.save();rrect(c,X,py,IW,ph2,36);c.clip();
    const k=Math.max(IW/pim.width,ph2/pim.height),dw=pim.width*k,dh=pim.height*k;c.drawImage(pim,X+(IW-dw)/2,py+(ph2-dh)/2,dw,dh);
    const gg=c.createLinearGradient(0,py+ph2*.42,0,py+ph2);gg.addColorStop(0,"rgba(0,0,0,0)");gg.addColorStop(1,"rgba(0,0,0,.82)");c.fillStyle=gg;c.fillRect(X,py,IW,ph2);c.restore();
    const hs=Math.min(fitFont(c,HL[0],P.disp,110,IW-80),fitFont(c,HL[1],P.disp,110,IW-80));
    const by=py+ph2-44;c.font=P.disp.replace("{s}",hs);c.fillStyle=t==="chalk"?"#D4FF3A":P.acc;c.fillText(HL[1],X+40,by);c.fillStyle="#fff";c.fillText(HL[0],X+40,by-hs*.92);
    c.fillStyle=t==="chalk"?"#D4FF3A":P.hot;fitFont(c,sp.kicker,"800 "+BODY,30,IW-80);c.fillText(sp.kicker,X+40,by-hs*1.92);
    y=py+ph2+36;
  }else{
  // kicker + headline
  c.fillStyle=t==="chalk"?P.ink:P.hot;fitFont(c,sp.kicker,"800 "+BODY,36,IW);c.fillText(sp.kicker,X,430);
  c.fillStyle=P.ink;
  const hs=Math.min(fitFont(c,HL[0],P.disp,t==="iron"?140:150,IW),fitFont(c,HL[1],P.disp,t==="iron"?140:150,IW));c.font=P.disp.replace("{s}",hs);
  c.fillText(HL[0],X,430+hs*.98);c.fillStyle=t==="chalk"?P.ink:P.acc;c.fillText(HL[1],X,430+hs*1.9);
  y=430+hs*1.9+60;
  }
  // stats: one row of four
  const gap=20,cw=(IW-gap*3)/4,ch=170;
  sp.stats.forEach((st,i)=>{const sx=X+i*(cw+gap),hot=!!st[3];
    c.fillStyle=hot?P.hot:P.card;rrect(c,sx,y,cw,ch,28);c.fill();
    c.fillStyle=hot?P.hotInk:P.mute;fitFont(c,st[0],"700 "+BODY,24,cw-40);c.fillText(st[0],sx+24,y+46);
    c.fillStyle=hot?P.hotInk:P.ink;const ns=fitFont(c,st[1],P.disp,80,cw-48);c.font=P.disp.replace("{s}",ns);c.fillText(st[1],sx+24,y+126);
    if(st[2]){c.fillStyle=hot?P.hotInk:P.mute;c.font="700 "+BODY.replace("{s}",24);c.fillText(st[2],sx+24,y+156)}});
  y+=ch+30;
  if(pim){
    // compact streak strip instead of the calendar
    c.fillStyle=P.card;rrect(c,X,y,IW,110,28);c.fill();
    c.fillStyle=t==="chalk"?"#0B0B0B":P.acc;rrect(c,X+24,y+23,64,64,16);c.fill();
    c.strokeStyle=t==="chalk"?"#D4FF3A":P.accInk;c.lineWidth=5;c.lineCap="round";c.beginPath();
    [[42,40,42,70],[70,40,70,70],[34,47,34,63],[78,47,78,63],[42,55,70,55]].forEach(q=>{c.moveTo(X+q[0],y+q[1]);c.lineTo(X+q[2],y+q[3])});c.stroke();
    const st=sp.streak||0,line=st+(st===1?" WEEK":" WEEKS")+" STREAK";c.fillStyle=P.ink;fitFont(c,line,P.disp,48,IW-140);c.fillText(line,X+112,y+62);
    c.fillStyle=P.mute;c.font="600 "+BODY.replace("{s}",26);c.fillText(pl(sp.monthDays||0,"day")+" trained in "+monthName(sp.ym,{month:"long"}),X+112,y+96);
    y+=110+80;
  }else{
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
  }
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
  if(A.edit){
    if(!A.ex.length){toast("Add at least one set, or delete the workout from Home.",null);render();return}
    const old=S.workouts.find(x=>x.id===A.edit);
    const w={id:A.edit,date:A.date,start:A.start,end:A.start+(A.mins||60)*60000,parts:A.parts.filter(p=>A.ex.some(e=>e.part===p)),ex:A.ex,photo:!!(old&&old.photo)};
    if(!w.parts.length)w.parts=A.parts;
    S.workouts=S.workouts.filter(x=>x.id!==A.edit).concat([w]);S.active=null;editSet=null;markUp(w.id);markState();
    openId=w.id;goRootHome();window.scrollTo(0,0);toast("Workout updated",null);return;
  }
  if(!A.ex.length){S.active=null;markState();render();return}
  if(!finishConfirmed){askFinish();return}
  finishConfirmed=false;
  if(!A.past&&A.manual){const end=Date.now();A.start=end-A.mins*60000;A.end=end}
  let prs=0;const prList=[];
  for(const e of A.ex){const b=bestW(e.name,A.id);if(b>0&&Math.max(...e.sets.map(s=>s.w))>b){prs++;prList.push(e.name)}}
  const w={id:A.id,date:A.date,start:A.start,end:A.past?A.start+A.mins*60000:(A.end||Date.now()),parts:A.parts.filter(p=>A.ex.some(e=>e.part===p)),ex:A.ex};
  if(!w.parts.length)w.parts=A.parts;
  const troBefore=trophyState().earned;
  S.workouts.push(w);S.active=null;
  const troWon=newTrophies(troBefore,trophyState().earned).map(t=>({name:t.name,desc:t.desc,icon:t.icon}));
  const prDetail=[];
  for(const e of w.ex){const b=bestW(e.name,w.id,w.date),top=e.sets.reduce((m,s)=>s.w>m.w||(s.w===m.w&&s.r>m.r)?s:m,e.sets[0]);if(b>0&&top.w>b)prDetail.push({name:e.name,w:top.w,r:top.r,delta:top.w-b})}
  const wk=weekOf(w.date),inWeek=S.workouts.filter(x=>weekOf(x.date)===wk),days=[0,0,0,0,0,0,0];
  inWeek.forEach(x=>{days[(parse(x.date).getDay()+6)%7]=1});
  markUp(w.id);markState();
  celebrate({id:w.id,trophies:troWon,past:!!A.past,date:w.date,vol:volOf(w),sets:allSets(w).length,mins:Math.max(1,Math.round((w.end-(w.start||w.end))/60000)),prs:prDetail,parts:w.parts,week:inWeek.length,days,streak:weekStreak(),monthDays:monthDays(monthOf(w.date)),cal:[...trainedDays()].filter(k=>k.slice(0,7)===monthOf(w.date)).map(k=>+k.slice(8)),ex:w.ex.map(e=>{const t=e.sets.reduce((m,s)=>s.w>m.w||(s.w===m.w&&s.r>m.r)?s:m,e.sets[0]);return{name:e.name,w:t.w,r:t.r,n:e.sets.length}}),dayName:parse(w.date).toLocaleDateString(undefined,{weekday:"long"})});
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
  if(d.tabGo){go(d.tabGo);if(d.scroll)setTimeout(()=>{const el=document.getElementById(d.scroll);if(el)el.scrollIntoView({block:"start",behavior:"smooth"})},50);return}
  if(d.trocat){trophyCat=d.trocat;render();return}
  if(d.sharew){shareWorkout(d.sharew);return}
  if(d.tromore){troOpen[d.tromore]=!troOpen[d.tromore];render();if(!troOpen[d.tromore]){const el=b.closest(".tro-cat");if(el)el.scrollIntoView({block:"nearest"})}return}
  if(d.pick){pickPart=d.pick;render();return}
  if(d.addpart){A.parts.push(d.addpart);pickPart=d.addpart;showAllParts=false;markState();render();return}
  if(d.ex){openEx(d.ex,d.part);return}
  if(d.step){const k=d.step,v=parseFloat(String(draft[k]).replace(",","."))||0,n=Math.max(0,Math.round((v+parseFloat(d.d))*100)/100);draft[k]=k==="r"?String(Math.round(n)):kg(n);render();return}
  if(d.rmex){const i=A.ex.findIndex(e=>e.name===d.rmex);if(i<0)return;const [gone]=A.ex.splice(i,1);markState();render();
    toast(gone.name+" removed",()=>{if(S.active&&!S.active.ex.some(e=>e.name===gone.name)){S.active.ex.splice(Math.min(i,S.active.ex.length),0,gone);markState();render()}});return}
  if(d.delset!=null){A.ex[A.cur].sets.splice(+d.delset,1);editSet=null;markState();render();return}
  if(d.editset!=null){const st=A.ex[A.cur].sets[+d.editset];if(st){editSet=+d.editset;draft={w:kg(st.w),r:String(st.r)};msgText="";render();const el=document.querySelector(".steppers");if(el)el.scrollIntoView({block:"center",behavior:"smooth"})}return}
  if(d.editw){editWorkout(d.editw);return}
  if(d.period){period=d.period;render();return}
  if(d.open){openId=openId===d.open?null:d.open;render();return}
  if(d.gender){const first=!gender();S.profile=Object.assign({},S.profile,{gender:d.gender});markState();render();if(first&&tab==="workout")toast("Thanks! Your exercises are set up.",null);return}
  if(d.calm){const[y,m]=calYm.split("-").map(Number),nd=new Date(y,m-1+(+d.calm),1);calYm=nd.getFullYear()+"-"+pad(nd.getMonth()+1);render();return}
  if(d.calday){const w=S.workouts.find(x=>x.date===d.calday);if(w){openId=w.id;go("home");setTimeout(()=>{const el=document.querySelector('[data-open="'+w.id+'"]');if(el)el.scrollIntoView({block:"center"})},60)}return}
  if(d.delw){
    const w=S.workouts.find(x=>x.id===d.delw);if(!w)return;
    S.workouts=S.workouts.filter(x=>x!==w);openId=null;markDel(w.id);render();
    toast("Workout deleted",()=>{if(!S.workouts.some(x=>x.id===w.id))S.workouts.push(w);markUp(w.id);render()});return}
  switch(d.act){
    case"logset":{
      const w=parseFloat(String(draft.w).replace(",",".")),r=parseInt(draft.r,10);
      if(!(w>=0)||!(r>0)){msgText="Enter a weight (0 for bodyweight) and at least 1 rep.";render();return}
      if(editSet!=null&&A.ex[A.cur].sets[editSet]){A.ex[A.cur].sets[editSet]={w:Math.round(w*100)/100,r};editSet=null;msgText="";const E2=A.ex[A.cur],ls=E2.sets[E2.sets.length-1];draft={w:kg(ls.w),r:String(ls.r)};markState();render();toast("Set updated",null);break}
      A.ex[A.cur].sets.push({w:Math.round(w*100)/100,r});popSet=true;markState();render();break}
    case"canceledit":{editSet=null;const E2=A.ex[A.cur],ls=E2.sets[E2.sets.length-1];draft=ls?{w:kg(ls.w),r:String(ls.r)}:{w:"",r:""};render();break}
    case"doneex":saveExercise();break;
    case"backex":discardExercise();break;
    case"finish":finish();break;
    case"toggleParts":showAllParts=!showAllParts;render();break;
    case"discard":{const prev=S.active;if(prev&&prev.edit){S.active=null;editSet=null;markState();goRootHome();toast("No changes saved",null);break}S.active=null;pickPart=null;markState();render();window.scrollTo(0,0);
      toast("Workout discarded",()=>{if(!S.active){S.active=prev;markState();render()}});break}
    case"syncnow":setSync("saving");syncNow();break;
    case"signout":signOut();break;
    case"shareinvite":shareInvite();break;
    case"homemore":homeShow+=15;render();break;
    case"showprs":prScope="period";openPrs();break;
    case"allrecs":recsAll=!recsAll;render();break;
    case"rmphoto":removePhoto();break;
    case"pickdate":openDatePicker(b.dataset.for);break;
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
  if(e.target.id==="photoIn"){const f=e.target.files&&e.target.files[0];e.target.value="";if(f)setPhoto(f);return}
  if(e.target.id==="exSel"){progEx=e.target.value;render();return}

  if(e.target.id==="actDurIn"&&S.active){const n=parseInt(e.target.value,10);if(n>0){S.active.mins=Math.max(1,Math.min(300,n));S.active.manual=true}else{delete S.active.manual}markState();render();return}
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
  user=null;S=blank();tab="home";summary=null;authMode="signin";authMsg="You’ve signed out.";setSync("idle");render();
  try{if(fbAuth)await FB.signOut(fbAuth)}catch(e){}
}
/* Move workouts logged in trial mode into the account the person just signed up / in with. */
function mergeGuest(){
  let g=null;try{g=JSON.parse(localStorage.getItem("daanav-v1:guest")||"null")}catch(e){}
  try{localStorage.removeItem(GUEST)}catch(e){}
  if(!g||!Array.isArray(g.workouts))return;
  let moved=0;
  for(const w of g.workouts)if(w&&w.id&&!S.workouts.some(x=>x.id===w.id)){S.workouts.push(w);S.pending.up[w.id]=++ver;moved++;
    if(w.photo){const wid=w.id;idbGet("guest:"+wid).then(d=>{if(d){PH[wid]=d;idbSet(phKey(wid),d).then(()=>uploadPhoto(wid));idbDel("guest:"+wid)}})}}
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
  if(!u){if(isGuest()){render();return}if(guestFlag()){enterGuest(true);return}if(user){user=null;S=blank()}render();return}
  if(user&&user.id===u.id){if(!user.providers||!user.providers.length){user.providers=u.providers||[];user.phone=u.phone||user.phone}user.emailVerified=user.emailVerified||!!u.verified;return}
  user={id:u.id,email:u.email||"",name:u.name||pendingName||"",phone:u.phone||"",providers:u.providers||[],emailVerified:!!u.verified,photoURL:u.photoURL||""};pendingName="";
  authOpen=false;
  saveLast();
  loadCache();mergeGuest();
  if(pendingGender&&!gender()){S.profile=Object.assign({},S.profile,{gender:pendingGender});markState()}pendingGender="";
  authMsg="";render();
  syncNow();
  setTimeout(()=>touchProfile(u.created),1500);
  setTimeout(()=>lbCleanup(),4000);
}
/* Leaderboard was removed (Daanav is "you vs you"). Clean up any entry a user published earlier. */
const lbJoined=()=>false;
async function lbCleanup(){
  if(!(S.profile&&S.profile.lb)||!fdb||isGuest())return;
  try{await timeout(FB.deleteDoc(FB.doc(fdb,"leaderboard",user.id)),10000);const p=Object.assign({},S.profile);delete p.lb;S.profile=p;markState()}catch(e){}
}
/* ---------- App config: pricing, offers, coupons, referrals (edited in Admin) ---------- */
const ADMIN_EMAIL="aggarwalvishal904@gmail.com";
const isAdmin=()=>!!(user&&!user.guest&&String(user.email||"").toLowerCase()===ADMIN_EMAIL);
const CONF_KEY="daanav-conf",REF_KEY="daanav-ref";
const CUR_SYM={INR:"₹",USD:"$",EUR:"€",GBP:"£"};
function defConf(){return{
  pricing:{enabled:false,currency:"INR",trialDays:7,plans:[
    {id:"monthly",name:"Monthly",price:199,months:1,active:true,tag:""},
    {id:"quarterly",name:"3 months",price:499,months:3,active:true,tag:""},
    {id:"yearly",name:"Yearly",price:1499,months:12,active:true,tag:"Best value"},
    {id:"lifetime",name:"Lifetime",price:3999,months:0,active:false,tag:"Best value"}]},
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
/* "Last used": refresh lastSeen when the app is opened or brought back, at most every 15 minutes. */
let seenAt=0;
async function touchSeen(){
  if(!fdb||!user||user.guest||!navigator.onLine||Date.now()-seenAt<15*60000)return;seenAt=Date.now();
  try{await timeout(FB.setDoc(FB.doc(fdb,"users",user.id),{lastSeen:stamp()},{merge:true}),10000)}catch(e){seenAt=0}
}
/* A small profile doc per user, so the admin can see sign-ups and referrals. */
async function touchProfile(created){
  if(!fdb||!user||user.guest)return;
  const d={name:user.name||"",email:user.email||"",refCode:refCode(),lastSeen:stamp()};
  if(created)d.joined=created;
  let ref="";try{ref=localStorage.getItem(REF_KEY)||""}catch(e){}
  const fresh=created&&Date.now()-Date.parse(created)<30*60000;
  if(ref&&ref!==refCode()&&fresh)d.referredBy=ref;
  try{await timeout(FB.setDoc(FB.doc(fdb,"users",user.id),d,{merge:true}),10000);seenAt=Date.now();if(ref)localStorage.removeItem(REF_KEY)}catch(e){}
}

/* ---------- Side menu ---------- */
const I_USER='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>';
const I_SHIELD='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>';
const I_GIFT='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13M12 8c-2-4-6-4-6-1.5S10 8 12 8zm0 0c2-4 6-4 6-1.5S14 8 12 8z"/></svg>';
const I_TAG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/></svg>';
function drawerHtml(){
  const g=isGuest(),nm=g?"Guest":(user.name||"Your account"),sub=g?"Trying without an account":(user.email||"");
  const it=(id,icon,label,note)=>'<button class="dr-it'+(tab===id?' on':'')+'" data-dr="'+id+'">'+icon+'<span><b>'+label+'</b><small>'+note+'</small></span><i aria-hidden="true">›</i></button>';
  let h='<div class="dr-head">'+avHtml(nm,myPhoto())+'<span class="dr-who"><b>'+esc(nm)+'</b><small>'+esc(sub)+'</small></span>'+
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
function leaveGuest(){try{localStorage.removeItem(GUEST)}catch(e){}user=null;S=blank();tab="home";authOpen=false;authMode="signin";authMsg="";render();window.scrollTo(0,0)}
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
    const tg=String(p.tag||"").trim(),dup=tg&&plans.slice(plans.indexOf(p)+1).some(q=>String(q.tag||"").trim().toLowerCase()===tg.toLowerCase());
    const tg2=dup?"":tg;
    h+='<div class="plan'+(tg2?' best':'')+'">'+(tg2?'<span class="pbadge">'+esc(tg2)+'</span>':'')+'<b class="pn">'+esc(p.name)+'</b>'+
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
let admSort="seen",admSub="pricing",admMsg={},admCoupons=null,admUsers=null,admLoaded={},admBusy=false,admQ="";
const ADM_TABS=[["pricing","Pricing"],["offers","Offers"],["coupons","Coupons"],["referrals","Referrals"],["users","Users"],["general","General"]];
if(ADM_TABS.some(t=>t[0]===bootAdmSub))admSub=bootAdmSub;
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
function ago(t){const m=Math.round((Date.now()-t)/60000);if(m<2)return"Active now";if(m<60)return m+" min ago";const h=Math.round(m/60);if(h<24)return h+(h===1?" hour ago":" hours ago");const d=Math.round(h/24);if(d===1)return"Yesterday";if(d<7)return d+" days ago";if(d<60)return Math.round(d/7)+(Math.round(d/7)===1?" week ago":" weeks ago");return short(dkey(new Date(t)))}
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
        '<input type="text" name="name_'+p.id+'" maxlength="24" value="'+esc(p.name)+'" aria-label="Plan name"><span class="cur">'+(CUR_SYM[P.currency]||"")+'</span><input type="number" inputmode="decimal" name="price_'+p.id+'" min="0" step="1" value="'+p.price+'" aria-label="'+esc(p.name)+' price"><small>'+(p.months?p.months+' mo':'once')+'</small>'+
        '<label class="ptag"><span>Tag</span><input type="text" name="tag_'+p.id+'" maxlength="20" list="tagIdeas" value="'+esc(p.tag||"")+'" placeholder="No tag" aria-label="'+esc(p.name)+' tag"></label></div>').join("")+
      '<datalist id="tagIdeas"><option value="Best value"><option value="Most popular"><option value="Save 40%"><option value="Limited offer"><option value="Recommended"></datalist>'+
      '<p class="sub" style="margin:6px 0 0">Tags show as a badge on the plan, like “Best value”. Leave empty for no badge. If two live plans have the same tag, only the lower one shows it.</p>'+
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
    else{const now=Date.now(),D=864e5,ms=v=>!v?0:typeof v==="string"?Date.parse(v)||0:v.toMillis?v.toMillis():v.seconds?v.seconds*1000:+v||0;
      const seen=u=>ms(u.lastSeen),cnt=t=>admUsers.filter(u=>seen(u)>now-t).length;
      const q=admQ.toLowerCase(),list=admUsers.filter(u=>!q||(u.name||"").toLowerCase().includes(q)||(u.email||"").toLowerCase().includes(q))
        .sort(admSort==="new"?(a,b)=>ms(b.joined)-ms(a.joined):(a,b)=>seen(b)-seen(a));
      const grp=u=>{const t=seen(u);return !t?"Never seen":t>now-D?"Active in the last 24 hours":t>now-7*D?"Active this week":t>now-30*D?"Active this month":"Not active for over a month"};
      h+='<section class="card"><h3>Who’s using Daanav</h3><div class="tiles">'+tile("Last 24 hours",cnt(D))+tile("Last 7 days",cnt(7*D))+tile("Last 30 days",cnt(30*D))+tile("All users",admUsers.length,'<em>'+admUsers.filter(u=>ms(u.joined)>now-7*D).length+' new this week</em>')+'</div></section>'+
        '<section class="card"><input type="text" id="admQ" placeholder="Search name or email" value="'+esc(admQ)+'">'+
        '<div class="seg" style="margin-top:10px"><button class="'+(admSort!=="new"?"on":"")+'" data-admsort="seen">Last used</button><button class="'+(admSort==="new"?"on":"")+'" data-admsort="new">Newest sign-ups</button></div><div class="ulist">';
      let last="";
      h+=list.length?list.slice(0,300).map(u=>{let hd="";if(admSort!=="new"){const g=grp(u);if(g!==last){last=g;hd='<h4 class="ugrp">'+g+'</h4>'}}
        const t=seen(u),live=t>now-15*60000;
        return hd+'<div class="urow">'+avHtml(u.name||u.email,u.photo,"sm"+(live?" live":""))+'<div><b>'+esc(u.name||"No name")+'</b><small>'+esc(u.email||"")+'</small></div>'+
          '<small class="r"><b class="ago'+(t>now-D?' hot':'')+'">'+(t?ago(t):"–")+'</b>Joined '+(tsDate(u.joined)||"–")+'</small></div>'}).join(""):'<p class="sub">No users match.</p>';
      h+='</div><p class="sub" style="margin:10px 0 0">“Last used” updates whenever someone opens the app (at most every 15 minutes). People appear after they open the updated app once. Guests aren’t listed.</p>'+amsg("users")+'</section>'}
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
    C.pricing.plans=C.pricing.plans.map(p=>Object.assign(p,{active:f.elements["on_"+p.id].checked,name:(fv(f,"name_"+p.id).trim()||p.name).slice(0,24),price:Math.round(fn(f,"price_"+p.id,0,1e6)),tag:fv(f,"tag_"+p.id).trim().slice(0,20)}));saveConf(C,"pricing")}
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
  const b=e.target.closest("[data-admsub],[data-admsort],[data-adm],[data-adm-cdel]");if(!b)return;
  if(b.dataset.admsub){admSub=b.dataset.admsub;if(admSub==="users"){admLoaded.users=0}render();return}
  if(b.dataset.admsort){admSort=b.dataset.admsort;render();return}
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
  if(guestFlag()){ready=true;enterGuest(true)}
  const fc=CFG.firebase||{};
  if(!fc.apiKey||!fc.projectId||/YOUR[-_]/i.test(JSON.stringify(fc))){bootError="Open config.js and paste your Firebase web app config, then upload the files again.";render();return}
  try{
    const u=n=>"https://www.gstatic.com/firebasejs/"+FIREBASE_SDK+"/firebase-"+n+".js";
    const[A,Au,F]=await Promise.all([import(u("app")),import(u("auth")),import(u("firestore"))]);
    FB=Object.assign({},A,Au,F);
  }catch(e){
    let last=null;try{last=JSON.parse(localStorage.getItem(LAST)||"null")}catch(e2){}
    if(guestFlag()){ready=true;enterGuest(true);return}
    if(last&&last.id){ready=true;user=last;loadCache();setSync("offline");render();
      addEventListener("online",()=>location.reload(),{once:true});return}
    bootError="Couldn’t load the sign-in library. Check your internet connection and reload the app.";render();return;
  }
  const fapp=FB.initializeApp(fc);
  fbAuth=FB.getAuth(fapp);fdb=FB.getFirestore(fapp);
  render();
  FB.onAuthStateChanged(fbAuth,u=>setTimeout(()=>handleSession(u?{id:u.uid,email:u.email||"",name:u.displayName||"",phone:u.phoneNumber||"",providers:(u.providerData||[]).map(p=>p.providerId),photoURL:u.photoURL||"",verified:!!u.emailVerified,created:u.metadata&&u.metadata.creationTime||""}:null),0));
  loadConf();
  addEventListener("online",()=>{setSync("saving");syncNow()});
  addEventListener("offline",()=>setSync("offline"));
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&user){syncNow();touchSeen()}});
}
if("serviceWorker" in navigator&&location.protocol==="https:")navigator.serviceWorker.register("sw.js").catch(()=>{});
boot();
}

// Stop iOS double-tap / pinch zoom so quick taps on +/- just change the value.
document.addEventListener("dblclick", e => e.preventDefault(), { passive: false });
document.addEventListener("gesturestart", e => e.preventDefault(), { passive: false });
