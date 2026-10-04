(()=>{
'use strict';

const KEY='wesgym_simple_2_0';
const defaults={
  plan:{startDate:'',startWeight:null,maintenanceCalories:2600,plannedCalories:1800,goalWeight:null},
  days:{},
  gym:{calories:300,weekdays:[],series:[],skips:[]},
  meta:{version:'5.1'}
};
let db=loadDb();
let calendarCursor=startOfMonth(new Date());
let selectedDate=dateKey();
let chartRange='30';
let forecastDays=30;

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];

function clone(x){return JSON.parse(JSON.stringify(x))}
function hasNum(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(+v)}
function validWeight(v){return hasNum(v)&&+v>0}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function fmt(v,d=0){return hasNum(v)?(+v).toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d}):'–'}
function signed(v,d=1,unit=''){if(!hasNum(v))return'–';if(Math.abs(+v)<.0001)return`±${fmt(0,d)}${unit}`;return`${+v>0?'+':'−'}${fmt(Math.abs(+v),d)}${unit}`}
function dateKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function parseDate(k){if(!k)return new Date();const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d,12)}
function addDays(k,n){const d=parseDate(k);d.setDate(d.getDate()+n);return dateKey(d)}
function daysBetween(a,b){return Math.round((parseDate(b)-parseDate(a))/86400000)}
function startOfMonth(d){return new Date(d.getFullYear(),d.getMonth(),1,12)}
function monday(k){const d=parseDate(k),wd=d.getDay()||7;d.setDate(d.getDate()-(wd-1));return dateKey(d)}
function prevDay(k){return addDays(k,-1)}
function formatDate(k,opt={day:'2-digit',month:'2-digit',year:'numeric'}){return parseDate(k).toLocaleDateString('de-DE',opt)}
function num(id){const el=$(id);if(!el)return null;const v=parseFloat(el.value);return Number.isFinite(v)?v:null}
function uid(){return `g${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`}
function actual(k){return db.days[k]||{date:k}}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.add('hidden'),2200)}
function openModal(html){$('#modalBody').innerHTML=html;$('#modal').classList.remove('hidden')}
function closeModal(){$('#modal').classList.add('hidden')}

function loadDb(){
  let raw=null;
  try{raw=JSON.parse(localStorage.getItem(KEY)||'null')}catch{}
  const x=raw&&typeof raw==='object'?raw:{};
  const out={...clone(defaults),...x,plan:{...defaults.plan,...(x.plan||{})},days:{...(x.days||{})},gym:{...defaults.gym,...(x.gym||{})},meta:{...defaults.meta,...(x.meta||{})}};
  out.gym.series=Array.isArray(out.gym.series)?out.gym.series:[];
  out.gym.skips=Array.isArray(out.gym.skips)?out.gym.skips:[];
  out.gym.weekdays=Array.isArray(out.gym.weekdays)?out.gym.weekdays:[];
  migrateOldWeekdays(out);
  Object.keys(out.days).forEach(k=>{out.days[k]={date:k,...out.days[k]}});
  return out;
}
function migrateOldWeekdays(out){
  if(out.gym.series.length||!out.gym.weekdays.length)return;
  const base=out.plan.startDate||dateKey();
  out.gym.weekdays.forEach(w=>{
    let k=base,guard=0;
    while(parseDate(k).getDay()!==+w&&guard<8){k=addDays(k,1);guard++}
    out.gym.series.push({id:uid(),type:'weekly',start:k,end:null,weekday:+w,name:'Training',time:'18:00',calories:+out.gym.calories||300});
  });
  out.gym.weekdays=[];
}
function save(){db.meta.version='5.1';localStorage.setItem(KEY,JSON.stringify(db))}

function isSkipped(seriesId,k){return db.gym.skips.some(x=>x.seriesId===seriesId&&x.date===k)}
function gymOccurrences(k){
  const out=[];
  for(const s of db.gym.series){
    if(!s||isSkipped(s.id,k))continue;
    if(s.type==='once'){
      if(s.date===k)out.push(s);
      continue;
    }
    if(s.type==='weekly'){
      if(!s.start||k<s.start)continue;
      if(s.end&&k>s.end)continue;
      const wd=hasNum(s.weekday)?+s.weekday:parseDate(s.start).getDay();
      if(parseDate(k).getDay()===wd)out.push(s);
    }
  }
  return out;
}
function gymDay(k){return gymOccurrences(k).length>0}
function gymBurnPlanned(k){return gymOccurrences(k).reduce((sum,s)=>sum+(hasNum(s.calories)?+s.calories:(+db.gym.calories||0)),0)}
function planBaseDeficit(){return (+db.plan.maintenanceCalories||0)-(+db.plan.plannedCalories||0)}
function plannedDeficit(k){return planBaseDeficit()+gymBurnPlanned(k)}

function plannedWeight(k){
  const p=db.plan;
  if(!p.startDate||!validWeight(p.startWeight)||parseDate(k)<parseDate(p.startDate))return null;
  let w=+p.startWeight,cur=p.startDate,guard=0;
  while(cur<=k&&guard<2500){w-=plannedDeficit(cur)/7700;cur=addDays(cur,1);guard++}
  return w;
}
function calorieModelWeight(k=dateKey()){
  const p=db.plan;
  if(!p.startDate||!validWeight(p.startWeight)||parseDate(k)<parseDate(p.startDate))return null;
  const today=dateKey();
  let w=+p.startWeight,cur=p.startDate,guard=0;
  while(cur<=k&&guard<2500){
    const d=actual(cur);
    if(cur===today&&!hasNum(d.calories)){cur=addDays(cur,1);guard++;continue}
    const eaten=hasNum(d.calories)?+d.calories:(+p.plannedCalories||0);
    const gymBurn=gymDay(cur)&&d.gymDone===true?gymBurnPlanned(cur):0;
    w-=((+p.maintenanceCalories||0)-eaten+gymBurn)/7700;
    cur=addDays(cur,1);guard++;
  }
  return w;
}
function calorieModelCoverage(k=dateKey()){
  const p=db.plan;if(!p.startDate)return{logged:0,total:0};
  let logged=0,total=0,cur=p.startDate,guard=0;
  while(cur<=k&&guard<2500){if(cur!==dateKey()||hasNum(actual(cur).calories)){total++;if(hasNum(actual(cur).calories))logged++}cur=addDays(cur,1);guard++}
  return{logged,total};
}
function allWeights(until=dateKey()){
  return Object.values(db.days).filter(d=>d.date<=until&&validWeight(d.weight)).sort((a,b)=>a.date.localeCompare(b.date));
}
function latestWeight(until=dateKey()){const a=allWeights(until);return a.length?+a.at(-1).weight:null}
function smoothedScaleWeight(until=dateKey()){
  const cutoff=addDays(until,-10);
  const a=allWeights(until).filter(d=>d.date>=cutoff).slice(-7);
  if(!a.length)return null;
  if(a.length<3)return +a.at(-1).weight;
  const vals=a.map(x=>+x.weight).sort((x,y)=>x-y);
  if(vals.length>=5){vals.shift();vals.pop()}
  return vals.reduce((s,v)=>s+v,0)/vals.length;
}
function progressPct(current){
  const s=+db.plan.startWeight,g=+db.plan.goalWeight;
  if(!validWeight(s)||!validWeight(g)||!validWeight(current)||s===g)return 0;
  return clamp((s-current)/(s-g)*100,0,100);
}
function originalGoalDate(){
  const p=db.plan;if(!p.startDate||!validWeight(p.startWeight)||!validWeight(p.goalWeight)||+p.goalWeight>=+p.startWeight)return null;
  let w=+p.startWeight,k=p.startDate,guard=0;
  while(w>+p.goalWeight&&guard<2500){w-=plannedDeficit(k)/7700;k=addDays(k,1);guard++}
  return guard<2500?k:null;
}
function projectFromWeight(baseWeight,fromDate,targetDate){
  if(!validWeight(baseWeight)||!targetDate||targetDate<fromDate)return null;
  let w=+baseWeight,k=addDays(fromDate,1),guard=0;
  while(k<=targetDate&&guard<2500){w-=plannedDeficit(k)/7700;k=addDays(k,1);guard++}
  return w;
}
function currentForecastBase(){return smoothedScaleWeight(dateKey())??calorieModelWeight(dateKey())??(+db.plan.startWeight||null)}
function currentGoalDate(){
  const p=db.plan,base=currentForecastBase();
  if(!validWeight(base)||!validWeight(p.goalWeight))return null;
  if(base<=+p.goalWeight)return dateKey();
  let w=base,k=dateKey(),guard=0;
  while(w>+p.goalWeight&&guard<2500){k=addDays(k,1);w-=plannedDeficit(k)/7700;guard++}
  return guard<2500?k:null;
}
function goalShiftDays(){const a=originalGoalDate(),b=currentGoalDate();return a&&b?daysBetween(a,b):null}
function forecastWeight(targetDate){return projectFromWeight(currentForecastBase(),dateKey(),targetDate)}
function forecastModelWeight(targetDate){return projectFromWeight(calorieModelWeight(dateKey()),dateKey(),targetDate)}
function planStatusToday(){
  const actualW=smoothedScaleWeight(dateKey())??latestWeight(dateKey()),planW=plannedWeight(dateKey());
  if(!validWeight(actualW)||!hasNum(planW))return{type:'neutral',text:'Noch nicht genug Gewichtsdaten',diff:null};
  const diff=actualW-planW;
  if(Math.abs(diff)<=.15)return{type:'good',text:'Du bist im Plan',diff};
  if(diff<0)return{type:'good',text:`${fmt(Math.abs(diff),1)} kg vor dem Plan`,diff};
  return{type:'bad',text:`${fmt(diff,1)} kg hinter dem Plan`,diff};
}
function calorieStatus(k){
  const c=actual(k).calories,p=+db.plan.plannedCalories||0;
  if(!hasNum(c))return'neutral';
  return +c<=p+100?'good':'bad';
}
function gymStatus(k){
  if(!gymDay(k))return'neutral';
  const d=actual(k);
  if(d.gymDone===true)return'good';
  if(k<dateKey())return'bad';
  return'open';
}
function calorieStreak(){
  let k=dateKey();
  if(!hasNum(actual(k).calories))k=addDays(k,-1);
  let n=0,guard=0;
  while(guard<1500){const d=actual(k);if(!hasNum(d.calories)||calorieStatus(k)!=='good')break;n++;k=addDays(k,-1);guard++}
  return n;
}
function weekGymStatus(ws){
  const we=addDays(ws,6),planned=[];
  for(let k=ws;k<=we;k=addDays(k,1))if(gymDay(k))planned.push(k);
  const done=planned.filter(k=>actual(k).gymDone===true);
  const future=planned.filter(k=>k>dateKey());
  return{planned:planned.length,done:done.length,future:future.length,success:planned.length>0&&done.length===planned.length&&future.length===0};
}
function gymWeekStreak(){
  let ws=monday(dateKey()),cur=weekGymStatus(ws),count=0;
  if(!cur.success)ws=addDays(ws,-7);
  for(let i=0;i<160;i++){
    const st=weekGymStatus(ws);
    if(!st.planned||!st.success)break;
    count++;ws=addDays(ws,-7);
  }
  return{weeks:count,current:cur};
}

function svgIcon(name){
  const map={
    scale:'<path d="M5 7h14l1 13H4L5 7Z"/><path d="M8 7a4 4 0 0 1 8 0"/><path d="m12 7 2-2"/>',
    model:'<path d="M7 4h10M6 8h12v12H6z"/><path d="M9 12h6M9 16h4"/>',
    calories:'<path d="M7 3v8M10 3v8M7 7h3M8.5 11v10M16 3v18M16 3c3 3 3 7 0 10"/>',
    gym:'<path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/>',
    calendar:'<path d="M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1z"/>',
    trend:'<path d="M4 18 9 12l4 3 7-9M4 21h16"/>',
    target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
    edit:'<path d="m4 20 4-1 10-10-3-3L5 16l-1 4Z"/><path d="m13 7 3 3"/>',
    trash:'<path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${map[name]||map.target}</svg>`;
}

function init(){
  migrateOldWeekdays(db);save();
  bindNavigation();bindActions();setHeader();renderAll();
  if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
}
function setHeader(){
  $('#headerDate').textContent=new Date().toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'});
}
function bindNavigation(){
  $$('.bottom-nav button').forEach(b=>b.addEventListener('click',()=>openPage(b.dataset.page)));
  $$('[data-analysis-tab]').forEach(b=>b.addEventListener('click',()=>openAnalysisTab(b.dataset.analysisTab)));
}
function openPage(name){
  $$('.page').forEach(p=>p.classList.toggle('active',p.id===name));
  $$('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===name));
  $('#pageTitle').textContent={home:'Heute',calendar:'Kalender',history:'Verlauf',analysis:'Analyse',plan:'Ziel & Plan'}[name]||'WesGym';
  if(name==='calendar')renderCalendar();
  if(name==='history')renderHistory();
  if(name==='analysis')renderAnalysis();
  if(name==='plan')renderPlan();
  window.scrollTo({top:0,behavior:'smooth'});
}
function openAnalysisTab(tab){
  $$('[data-analysis-tab]').forEach(b=>b.classList.toggle('active',b.dataset.analysisTab===tab));
  $('#analysisProgress').classList.toggle('active',tab==='progress');
  $('#analysisForecast').classList.toggle('active',tab==='forecast');
  if(tab==='forecast')renderForecast(); else renderAnalysisProgress();
}
function bindActions(){
  $('#todayForm').addEventListener('submit',saveToday);
  $('#editTodayLink').addEventListener('click',()=>openDayEditor(dateKey()));
  $('#quickAdd').addEventListener('click',()=>openDayEditor(dateKey()));
  $('#planForm').addEventListener('submit',savePlan);
  $('#trainingForm').addEventListener('submit',addTrainingFromPlan);
  $('#addTrainingBtn').addEventListener('click',openNewTrainingModal);
  $('#calendarPrev').addEventListener('click',()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1,12);renderCalendar()});
  $('#calendarNext').addEventListener('click',()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,1,12);renderCalendar()});
  $('#modal').addEventListener('click',e=>{if(e.target.matches('[data-close]'))closeModal()});
  $('#exportBtn').addEventListener('click',exportData);
  $('#importInput').addEventListener('change',importData);
  $('#resetBtn').addEventListener('click',resetData);
  $('#forecastDate').addEventListener('change',()=>{forecastDays=null;renderForecast()});
  $('#forecastButtons').addEventListener('click',e=>{const b=e.target.closest('[data-days]');if(!b)return;forecastDays=+b.dataset.days;$('#forecastDate').value='';renderForecast()});
  $('#chartRanges').addEventListener('click',e=>{const b=e.target.closest('[data-range]');if(!b)return;chartRange=b.dataset.range;renderAnalysisProgress()});
  $('#weightDateCalculator').addEventListener('change',renderWeightDateCalculator);
}
function renderAll(){renderHome();renderCalendar();renderHistory();renderAnalysis();renderPlan()}

function renderHome(){
  const start=validWeight(db.plan.startWeight)?+db.plan.startWeight:null;
  const goal=validWeight(db.plan.goalWeight)?+db.plan.goalWeight:null;
  const scale=latestWeight(dateKey());
  const model=calorieModelWeight(dateKey());
  const planToday=plannedWeight(dateKey());
  const scalePct=progressPct(scale),modelPct=progressPct(model),status=planStatusToday();
  const target=currentGoalDate(),orig=originalGoalDate(),shift=goalShiftDays();
  const displayCurrent=scale??model;
  $('#heroJourney').innerHTML=`
    <div class="journey-top"><div><span class="section-kicker">Gesamtfortschritt</span><strong>${validWeight(displayCurrent)?fmt(displayCurrent,1)+' kg':'Noch keine Daten'}</strong></div><div class="journey-percent">${fmt(scale!==null?scalePct:modelPct)}%</div></div>
    <div class="journey-track"><i style="width:${scale!==null?scalePct:modelPct}%"></i></div>
    <div class="journey-stats">
      <div class="journey-stat"><span>Startgewicht</span><strong>${start!==null?fmt(start,1)+' kg':'–'}</strong></div>
      <div class="journey-stat center"><span>Heute</span><strong>${validWeight(displayCurrent)?fmt(displayCurrent,1)+' kg':'–'}</strong></div>
      <div class="journey-stat end"><span>Zielgewicht</span><strong>${goal!==null?fmt(goal,1)+' kg':'–'}</strong></div>
    </div>
    <div class="journey-note ${status.type}">${status.text}${target?` · Zieltermin ${formatDate(target)}`:''}</div>`;
  $('#heroStatusText').textContent=shift===null?'Deine Daten zeigen dir, wo du heute wirklich stehst.':shift>0?`Die aktuelle Prognose liegt ${shift} Tage hinter dem ursprünglichen Plan.`:shift<0?`Die aktuelle Prognose liegt ${Math.abs(shift)} Tage vor dem ursprünglichen Plan.`:'Du liegst zeitlich genau auf deinem ursprünglichen Plan.';

  const total=start!==null&&goal!==null?start-goal:null;
  const scaleLost=start!==null&&scale!==null?start-scale:null;
  const modelLost=start!==null&&hasNum(model)?start-model:null;
  $('#homeTodayComparison').innerHTML=todayComparisonHtml(planToday,scale,model);
  $('#homeProgress').innerHTML=`
    ${progressCard('actual','Waage (tatsächlich)',scaleLost,scale,scalePct,total)}
    ${progressCard('model','Kalorienmodell',modelLost,model,modelPct,total)}`;

  const today=actual(dateKey());
  $('#todayWeight').value=validWeight(today.weight)?today.weight:'';
  $('#todayCalories').value=hasNum(today.calories)?today.calories:'';
  const gym=gymDay(dateKey());
  $('#todayGymBox').classList.toggle('hidden',!gym);
  if(gym){$('#todayGymDone').checked=today.gymDone===true;$('#todayGymText').textContent=today.gymDone===true?'Training erledigt':`${gymOccurrences(dateKey()).length} Training geplant`}

  const gs=gymWeekStreak(),cs=calorieStreak(),week=gs.current;
  $('#homeWeekSummary').innerHTML=`
    <div class="metric-card good"><span>Kalorien-Serie</span><strong>${cs} ${cs===1?'Tag':'Tage'}</strong><small>bis +100 kcal gilt als im Ziel</small></div>
    <div class="metric-card"><span>Training diese Woche</span><strong>${week.done}/${week.planned}</strong><small>${gs.weeks} ${gs.weeks===1?'Woche':'Wochen'} Gym-Serie</small></div>
    <div class="metric-card ${shift!==null&&shift>0?'bad':'good'}"><span>Zieltermin</span><strong>${target?formatDate(target,{day:'2-digit',month:'2-digit'}):'–'}</strong><small>${orig?`Plan ${formatDate(orig,{day:'2-digit',month:'2-digit'})}`:'Noch kein Zieltermin'}</small></div>`;
}
function todayComparisonHtml(plan,scale,model){
  const scaleDiff=validWeight(scale)&&hasNum(plan)?scale-plan:null;
  return `<div class="comparison-tile plan"><span>Soll heute</span><strong>${hasNum(plan)?fmt(plan,1)+' kg':'–'}</strong><small>automatisch aus deinem Plan</small></div><div class="comparison-tile actual"><span>Waage</span><strong>${validWeight(scale)?fmt(scale,1)+' kg':'–'}</strong><small>${scaleDiff===null?'letzter echter Wert':Math.abs(scaleDiff)<=.05?'genau im Soll':scaleDiff<0?fmt(Math.abs(scaleDiff),1)+' kg vor Soll':fmt(scaleDiff,1)+' kg über Soll'}</small></div><div class="comparison-tile model"><span>Kalorienmodell</span><strong>${hasNum(model)?fmt(model,1)+' kg':'–'}</strong><small>aus deiner Energiebilanz</small></div>`;
}

function progressCard(type,label,lost,current,pct,total){
  const remaining=validWeight(current)&&validWeight(db.plan.goalWeight)?Math.max(0,current-(+db.plan.goalWeight)):null;
  return `<div class="progress-card ${type}"><span class="label">${label}</span><div class="progress-main"><div><strong>${lost===null?'–':signed(-lost,1,' kg')}</strong><div class="progress-caption">${validWeight(current)?fmt(current,1)+' kg aktuell':'Noch kein Wert'}</div></div><div class="ring" style="--p:${pct}"><span>${fmt(pct)}%</span></div></div><div class="progress-bar"><i style="width:${pct}%"></i></div><div class="progress-caption">${remaining===null?'–':fmt(remaining,1)+' kg bis zum Ziel'}${hasNum(total)?` · von ${fmt(total,1)} kg Gesamtstrecke`:''}</div></div>`;
}
function saveToday(e){
  e.preventDefault();const k=dateKey(),old=actual(k),weight=num('#todayWeight'),cal=num('#todayCalories');
  if(weight!==null&&weight<=0)return toast('Bitte ein gültiges Gewicht eingeben');
  db.days[k]={...old,date:k,weight,calories:cal,gymDone:gymDay(k)?$('#todayGymDone').checked:null};
  save();renderAll();toast('Tag gespeichert');
}

function renderCalendar(){
  const title=calendarCursor.toLocaleDateString('de-DE',{month:'long',year:'numeric'});$('#calendarMonthTitle').textContent=title;
  const first=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth(),1,12);const jsDay=first.getDay()||7;const gridStart=new Date(first);gridStart.setDate(first.getDate()-(jsDay-1));
  const cells=[];
  for(let i=0;i<42;i++){
    const d=new Date(gridStart);d.setDate(gridStart.getDate()+i);const k=dateKey(d),inMonth=d.getMonth()===calendarCursor.getMonth(),today=k===dateKey(),sel=k===selectedDate;
    const cs=calorieStatus(k),gs=gymStatus(k),hasW=validWeight(actual(k).weight);
    const marks=[];if(hasNum(actual(k).calories))marks.push(`<i class="cal ${cs}"></i>`);if(gymDay(k))marks.push(`<i class="gym ${gs}"></i>`);if(hasW)marks.push('<i class="weight"></i>');
    cells.push(`<button type="button" class="calendar-day ${inMonth?'':'out'} ${today?'today':''} ${sel?'selected':''}" data-calendar-date="${k}"><span>${d.getDate()}</span><span class="day-markers">${marks.join('')}</span></button>`);
  }
  $('#calendarGrid').innerHTML=cells.join('');
  $$('[data-calendar-date]').forEach(b=>b.addEventListener('click',()=>{selectedDate=b.dataset.calendarDate;renderCalendar();renderSelectedDay()}));
  renderSelectedDay();renderSeriesList('#seriesList',false);
}
function renderSelectedDay(){
  const k=selectedDate,d=actual(k),plan=plannedWeight(k),model=calorieModelWeight(k),weight=validWeight(d.weight)?+d.weight:null;
  const diff=weight!==null&&hasNum(plan)?weight-plan:null;let status={type:'neutral',text:'Keine Gewichtsdaten'};
  if(diff!==null)status=Math.abs(diff)<=.15?{type:'good',text:'Im Plan'}:diff<0?{type:'good',text:`${fmt(Math.abs(diff),1)} kg vor Plan`}:{type:'bad',text:`${fmt(diff,1)} kg hinter Plan`};
  $('#selectedDayTitle').textContent=formatDate(k,{weekday:'long',day:'2-digit',month:'long'});
  const gym=gymDay(k),gs=gymStatus(k);
  $('#selectedDayCard').innerHTML=`<div class="selected-day-top"><strong>${formatDate(k,{day:'2-digit',month:'2-digit',year:'numeric'})}</strong><span class="status-pill ${status.type}">${status.text}</span></div><div class="selected-values"><div><span>Soll</span><strong>${hasNum(plan)?fmt(plan,1)+' kg':'–'}</strong></div><div><span>Kalorienmodell</span><strong>${hasNum(model)?fmt(model,1)+' kg':'–'}</strong></div><div><span>Waage</span><strong>${weight!==null?fmt(weight,1)+' kg':'–'}</strong></div></div><div class="history-meta"><span class="status-text ${calorieStatus(k)}">${hasNum(d.calories)?fmt(d.calories)+' kcal':'Keine Kalorien'}</span>${gym?`<span class="status-text ${gs==='open'?'neutral':gs}">${gs==='good'?'Training erledigt':gs==='bad'?'Training verpasst':'Training offen'}</span>`:''}</div><div class="selected-actions"><button class="edit" type="button" data-edit-selected>Tag bearbeiten</button>${gym?`<button class="training" type="button" data-toggle-training>${d.gymDone===true?'Als offen markieren':'Training erledigt'}</button><button class="edit" type="button" data-edit-training>Termin</button>`:''}</div>`;
  $('[data-edit-selected]')?.addEventListener('click',()=>openDayEditor(k));
  $('[data-toggle-training]')?.addEventListener('click',()=>{db.days[k]={...d,date:k,gymDone:d.gymDone===true?false:true};save();renderAll();toast('Training aktualisiert')});
  $('[data-edit-training]')?.addEventListener('click',()=>{const s=gymOccurrences(k)[0];if(!s)return;if(s.type==='once')openSeriesEditor(s.id);else openRecurringEditor(s,k)});
}

function renderSeriesList(selector,includeUpcoming=true){
  const el=$(selector);if(!el)return;
  const series=[...db.gym.series].filter(s=>!s.end||s.end>=dateKey()).sort((a,b)=>(a.start||a.date||'').localeCompare(b.start||b.date||''));
  if(!series.length){el.innerHTML='<div class="empty-state">Noch keine Trainingsserie geplant.</div>';return}
  el.innerHTML=series.map(s=>{
    const start=s.type==='once'?s.date:s.start;const recurring=s.type==='weekly';const detail=recurring?`Wöchentlich · ab ${formatDate(start,{day:'2-digit',month:'2-digit'})}`:`Einmalig · ${formatDate(start,{day:'2-digit',month:'2-digit'})}`;
    return `<div class="series-item"><div class="series-icon">${svgIcon('gym')}</div><div class="body"><strong>${s.name||'Training'}</strong><small>${detail}${s.time?` · ${s.time}`:''}${hasNum(s.calories)?` · ${fmt(s.calories)} kcal`:''}</small></div><button type="button" data-series-id="${s.id}">Bearbeiten</button></div>`;
  }).join('');
  $$(`${selector} [data-series-id]`).forEach(b=>b.addEventListener('click',()=>openSeriesEditor(b.dataset.seriesId)));
}

function renderHistory(){
  const gs=gymWeekStreak(),cs=calorieStreak();
  $('#streakCards').innerHTML=`
    <div class="streak-card cal"><div class="streak-icon">${svgIcon('calories')}</div><span>Kalorien-Serie</span><strong>${cs} ${cs===1?'Tag':'Tage'}</strong><small>Ein Tag bleibt grün bis einschließlich +100 kcal über deinem Ziel.</small></div>
    <div class="streak-card gym"><div class="streak-icon">${svgIcon('gym')}</div><span>Gym-Serie</span><strong>${gs.weeks} ${gs.weeks===1?'Woche':'Wochen'}</strong><small>${gs.current.planned?`${gs.current.done}/${gs.current.planned} geplante Trainings diese Woche erledigt.`:'Diese Woche ist kein Training geplant.'}</small></div>`;
  const entries=Object.values(db.days).filter(d=>hasNum(d.calories)||validWeight(d.weight)||d.gymDone!==undefined&&d.gymDone!==null).sort((a,b)=>b.date.localeCompare(a.date));
  $('#historyList').innerHTML=entries.length?entries.map(d=>historyCard(d)).join(''):'<div class="empty-state">Noch keine Einträge vorhanden.</div>';
  $$('#historyList [data-edit-day]').forEach(b=>b.addEventListener('click',()=>openDayEditor(b.dataset.editDay)));
}
function historyCard(d){
  const k=d.date,plan=plannedWeight(k),model=calorieModelWeight(k),weight=validWeight(d.weight)?+d.weight:null,diff=weight!==null&&hasNum(plan)?weight-plan:null;
  const planText=diff===null?'Kein Vergleich':Math.abs(diff)<=.15?'Im Plan':diff<0?`${fmt(Math.abs(diff),1)} kg vor dem Plan`:`${fmt(diff,1)} kg hinter dem Plan`;
  const planType=diff===null?'neutral':diff<=.15?'good':'bad',cs=calorieStatus(k),gs=gymStatus(k);
  return `<article class="history-item"><div class="history-head"><div><h3>${formatDate(k,{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'})}</h3><div class="history-meta"><span class="status-text ${cs}">${hasNum(d.calories)?fmt(d.calories)+' kcal':'Keine Kalorien'}</span>${gymDay(k)?`<span class="status-text ${gs==='open'?'neutral':gs}">${gs==='good'?'Training erledigt':gs==='bad'?'Training verpasst':'Training offen'}</span>`:''}</div></div><span class="status-pill ${planType}">${planText}</span></div><div class="history-values"><div><span>Soll</span><strong>${hasNum(plan)?fmt(plan,1)+' kg':'–'}</strong></div><div><span>Kalorienmodell</span><strong>${hasNum(model)?fmt(model,1)+' kg':'–'}</strong></div><div><span>Waage</span><strong>${weight!==null?fmt(weight,1)+' kg':'–'}</strong></div></div><div class="history-footer"><div><span class="tag ${cs}">Kalorien ${cs==='good'?'im Ziel':cs==='bad'?'über Ziel':'offen'}</span>${gymDay(k)?` <span class="tag ${gs==='open'?'neutral':gs}">Training ${gs==='good'?'erledigt':gs==='bad'?'verpasst':'offen'}</span>`:''}</div><button type="button" data-edit-day="${k}">Bearbeiten</button></div></article>`;
}

function renderAnalysis(){renderAnalysisProgress();renderForecast()}
function renderAnalysisProgress(){
  $$('#chartRanges [data-range]').forEach(b=>b.classList.toggle('active',b.dataset.range===chartRange));
  const today=dateKey();let start;
  if(chartRange==='all')start=db.plan.startDate||addDays(today,-30);else start=addDays(today,-(+chartRange-1));
  if(db.plan.startDate&&start<db.plan.startDate)start=db.plan.startDate;
  const points=buildChartSeries(start,today);
  $('#weightChart').innerHTML=weightChartSvg(points,start,today);
  const startW=validWeight(db.plan.startWeight)?+db.plan.startWeight:null,scale=latestWeight(),model=calorieModelWeight(),planToday=plannedWeight(today);
  $('#analysisTodayComparison').innerHTML=todayComparisonHtml(planToday,scale,model);
  const scaleLoss=startW!==null&&scale!==null?startW-scale:null,modelLoss=startW!==null&&hasNum(model)?startW-model:null;
  $('#analysisLossCards').innerHTML=`<div class="loss-card actual"><span>Waage (tatsächlich)</span><strong>${scaleLoss===null?'–':signed(-scaleLoss,1,' kg')}</strong><small>${scale!==null?`von ${fmt(startW,1)} auf ${fmt(scale,1)} kg · ${fmt(progressPct(scale))}% des Ziels`:'Noch kein Waagenwert'}</small><div class="progress-bar actual"><i style="width:${progressPct(scale)}%;background:linear-gradient(90deg,var(--green),var(--green-2))"></i></div></div><div class="loss-card model"><span>Kalorienmodell</span><strong>${modelLoss===null?'–':signed(-modelLoss,1,' kg')}</strong><small>${hasNum(model)?`von ${fmt(startW,1)} auf ${fmt(model,1)} kg · ${fmt(progressPct(model))}% des Ziels`:'Noch keine Berechnung'}</small><div class="progress-bar"><i style="width:${progressPct(model)}%;background:linear-gradient(90deg,var(--blue),var(--blue-2))"></i></div></div>`;
  const diff=scale!==null&&hasNum(model)?scale-model:null;
  $('#comparisonCard').innerHTML=`<div class="comparison-main"><div><span>Aktueller Abstand</span><strong>${diff===null?'–':signed(diff,1,' kg')}</strong></div><div><span>${diff===null?'Noch keine Vergleichsdaten':diff>0?'Waage über Modell':diff<0?'Waage unter Modell':'Gleichstand'}</span></div></div><p>${diff===null?'Sobald Gewicht und Kalorienmodell verfügbar sind, siehst du hier den Abstand.':`Die Waage kann kurzfristig durch Wasser, Salz, Glykogen und Magen-/Darminhalt vom Energiebilanz-Modell abweichen. Entscheidend ist die Entwicklung über mehrere Tage.`}</p>`;
  renderWeightDateCalculator();
}
function renderWeightDateCalculator(){
  const input=$('#weightDateCalculator'),box=$('#weightDateResult');
  if(!input||!box)return;
  const today=dateKey();
  input.min=today;
  if(!input.value)input.value=addDays(today,30);
  let target=input.value;
  if(target<today){target=today;input.value=target}
  const forecast=forecastWeight(target),plan=plannedWeight(target),model=forecastModelWeight(target),days=Math.max(0,daysBetween(today,target)),base=currentForecastBase();
  const change=validWeight(forecast)&&validWeight(base)?forecast-base:null;
  box.innerHTML=`<div class="date-calculator-hero"><span>Voraussichtliches Gewicht am ${formatDate(target)}</span><strong>${validWeight(forecast)?fmt(forecast,1)+' kg':'–'}</strong><small>${change===null?'Noch nicht genug Daten für eine Prognose':`${signed(change,1,' kg')} gegenüber deinem aktuellen Prognose-Startwert`}</small></div><div class="date-calculator-grid"><div><span>Soll laut Plan</span><strong>${hasNum(plan)?fmt(plan,1)+' kg':'–'}</strong><small>ohne tägliche Eingabe</small></div><div><span>Aktuelle Prognose</span><strong>${validWeight(forecast)?fmt(forecast,1)+' kg':'–'}</strong><small>Waagentrend + künftiger Plan</small></div><div><span>Kalorienmodell</span><strong>${hasNum(model)?fmt(model,1)+' kg':'–'}</strong><small>Modell + künftiger Plan</small></div></div><p>Für ${days} ${days===1?'Tag':'Tage'} in die Zukunft. Die Prognose ist eine Schätzung und kann durch Wasser, Aktivität und tatsächliche Kalorien abweichen.</p>`;
}

function buildChartSeries(start,end){
  const rows=[];for(let k=start;k<=end;k=addDays(k,1)){rows.push({date:k,plan:plannedWeight(k),model:calorieModelWeight(k),actual:validWeight(actual(k).weight)?+actual(k).weight:null})}return rows;
}
function weightChartSvg(rows,start,end){
  const vals=[];rows.forEach(r=>{['plan','model','actual'].forEach(k=>{if(hasNum(r[k]))vals.push(+r[k])})});if(!vals.length)return'<div class="chart-empty">Noch nicht genug Daten für einen Verlauf.</div>';
  const w=660,h=250,pad={l:38,r:15,t:18,b:32},min=Math.floor(Math.min(...vals,(+db.plan.goalWeight||999))-1),max=Math.ceil(Math.max(...vals)+1),span=Math.max(1,max-min),x=i=>pad.l+(i/(Math.max(1,rows.length-1)))*(w-pad.l-pad.r),y=v=>pad.t+(max-v)/span*(h-pad.t-pad.b);
  const pathFor=key=>{let d='',started=false;rows.forEach((r,i)=>{if(!hasNum(r[key])){started=false;return}const cmd=started?'L':'M';d+=`${cmd}${x(i).toFixed(1)},${y(+r[key]).toFixed(1)} `;started=true});return d};
  const grid=[0,.25,.5,.75,1].map(t=>{const yy=pad.t+t*(h-pad.t-pad.b),val=max-t*span;return `<line x1="${pad.l}" y1="${yy}" x2="${w-pad.r}" y2="${yy}" stroke="#e5ebf2"/><text x="4" y="${yy+4}" font-size="10" fill="#8391a3">${fmt(val,0)}</text>`}).join('');
  const labels=[0,Math.floor((rows.length-1)/2),rows.length-1].filter((v,i,a)=>a.indexOf(v)===i).map(i=>`<text x="${x(i)}" y="${h-8}" text-anchor="middle" font-size="9" fill="#8391a3">${formatDate(rows[i].date,{day:'2-digit',month:'2-digit'})}</text>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Gewichtsverlauf">${grid}<path d="${pathFor('plan')}" fill="none" stroke="#9aa8b8" stroke-width="2" stroke-dasharray="5 5"/><path d="${pathFor('model')}" fill="none" stroke="#1677ff" stroke-width="2.4"/><path d="${pathFor('actual')}" fill="none" stroke="#18a865" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${rows.map((r,i)=>hasNum(r.actual)?`<circle cx="${x(i)}" cy="${y(+r.actual)}" r="3.5" fill="#fff" stroke="#18a865" stroke-width="2"/>`:'').join('')}${labels}</svg><div class="chart-legend"><span><i class="legend-line actual"></i>Waage</span><span><i class="legend-line model"></i>Kalorienmodell</span><span><i class="legend-line plan"></i>Soll</span></div>`;
}

function renderForecast(){
  $$('#forecastButtons [data-days]').forEach(b=>b.classList.toggle('active',forecastDays!==null&&+b.dataset.days===forecastDays));
  let target;if(forecastDays!==null){target=addDays(dateKey(),forecastDays);$('#forecastDate').value=target}else target=$('#forecastDate').value||addDays(dateKey(),30);
  if(target<dateKey())target=dateKey();
  const f=forecastWeight(target),m=forecastModelWeight(target),p=plannedWeight(target),base=currentForecastBase(),change=validWeight(f)&&validWeight(base)?f-base:null,days=Math.max(0,daysBetween(dateKey(),target));
  $('#forecastHero').innerHTML=`<span class="forecast-label">Prognose in ${days} ${days===1?'Tag':'Tagen'} · ${formatDate(target)}</span><div class="forecast-weight">${validWeight(f)?fmt(f,1)+' kg':'–'}</div><span class="forecast-change ${change!==null&&change>0?'bad':''}">${change===null?'Noch keine Prognose':`${signed(change,1,' kg')} gegenüber heute`}</span><div class="forecast-note">Die Prognose startet beim geglätteten Waagengewicht und setzt voraus, dass du deinen aktuellen Kalorien- und Trainingsplan künftig einhältst. Das Kalorienmodell bleibt separat sichtbar.</div>`;
  $('#forecastChart').innerHTML=forecastChartSvg(target);
  const qs=[7,14,30,60];$('#forecastQuick').innerHTML=qs.map(n=>{const wk=forecastWeight(addDays(dateKey(),n)),chg=validWeight(wk)&&validWeight(base)?wk-base:null;return `<div class="forecast-mini"><span>in ${n} Tagen</span><strong>${validWeight(wk)?fmt(wk,1)+' kg':'–'}</strong><small>${chg===null?'–':signed(chg,1,' kg')}</small></div>`}).join('');
}
function forecastChartSvg(target){
  const today=dateKey(),total=Math.max(1,daysBetween(today,target)),steps=Math.min(90,total),rows=[];
  for(let i=0;i<=steps;i++){const k=addDays(today,Math.round(i*total/steps));rows.push({date:k,actual:forecastWeight(k),model:forecastModelWeight(k),plan:plannedWeight(k)})}
  if(!rows.length||!validWeight(rows.at(-1).actual))return'<div class="chart-empty">Noch keine Prognose möglich.</div>';
  const vals=[];rows.forEach(r=>['actual','model','plan'].forEach(k=>{if(hasNum(r[k]))vals.push(+r[k])}));if(validWeight(db.plan.goalWeight))vals.push(+db.plan.goalWeight);if(!vals.length)return'<div class="chart-empty">Noch keine Prognose möglich.</div>';
  const w=660,h=240,pad={l:38,r:15,t:18,b:32},min=Math.floor(Math.min(...vals)-1),max=Math.ceil(Math.max(...vals)+1),span=Math.max(1,max-min),x=i=>pad.l+(i/(rows.length-1))*(w-pad.l-pad.r),y=v=>pad.t+(max-v)/span*(h-pad.t-pad.b),path=key=>rows.map((r,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(+r[key]).toFixed(1)}`).join(' ');
  const grid=[0,.25,.5,.75,1].map(t=>{const yy=pad.t+t*(h-pad.t-pad.b),val=max-t*span;return `<line x1="${pad.l}" y1="${yy}" x2="${w-pad.r}" y2="${yy}" stroke="#e5ebf2"/><text x="4" y="${yy+4}" font-size="10" fill="#8391a3">${fmt(val,0)}</text>`}).join('');
  const goal=validWeight(db.plan.goalWeight)?`<line x1="${pad.l}" y1="${y(+db.plan.goalWeight)}" x2="${w-pad.r}" y2="${y(+db.plan.goalWeight)}" stroke="#18a865" stroke-width="1.5" stroke-dasharray="4 5"/>`:'';
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Gewichtsprognose">${grid}${goal}<path d="${path('plan')}" fill="none" stroke="#9aa8b8" stroke-width="2" stroke-dasharray="5 5"/><path d="${path('model')}" fill="none" stroke="#1677ff" stroke-width="2"/><path d="${path('actual')}" fill="none" stroke="#18a865" stroke-width="3"/><circle cx="${x(rows.length-1)}" cy="${y(+rows.at(-1).actual)}" r="5" fill="#18a865"/><text x="${x(rows.length-1)-5}" y="${Math.max(14,y(+rows.at(-1).actual)-10)}" text-anchor="end" font-size="11" font-weight="700" fill="#187a4d">${fmt(rows.at(-1).actual,1)} kg</text><text x="${pad.l}" y="${h-8}" font-size="9" fill="#8391a3">Heute</text><text x="${w-pad.r}" y="${h-8}" text-anchor="end" font-size="9" fill="#8391a3">${formatDate(target,{day:'2-digit',month:'2-digit'})}</text></svg><div class="chart-legend"><span><i class="legend-line actual"></i>Waagen-Prognose</span><span><i class="legend-line model"></i>Kalorienmodell</span><span><i class="legend-line plan"></i>Ursprünglicher Plan</span></div>`;
}

function renderPlan(){
  const p=db.plan;$('#startDate').value=p.startDate||dateKey();$('#startWeight').value=p.startWeight??'';$('#goalWeight').value=p.goalWeight??'';$('#maintenanceCalories').value=p.maintenanceCalories??'';$('#plannedCalories').value=p.plannedCalories??'';
  if(!$('#trainingDate').value)$('#trainingDate').value=dateKey();
  $('#trainingCalories').value=db.gym.calories??300;
  const def=planBaseDeficit(),weekly=def*7/7700,orig=originalGoalDate(),cur=currentGoalDate(),shift=goalShiftDays();
  $('#planSummary').innerHTML=`<div class="summary-box"><span>Basisdefizit</span><strong>${fmt(def)} kcal / Tag</strong></div><div class="summary-box"><span>Tempo ohne Gym</span><strong>≈ ${fmt(weekly,2)} kg / Woche</strong></div><div class="summary-box"><span>Geplanter Zieltermin</span><strong>${orig?formatDate(orig):'–'}</strong></div><div class="summary-box ${shift!==null&&shift>0?'bad':'good'}"><span>Aktueller Zieltermin</span><strong>${cur?formatDate(cur):'–'}</strong></div>`;
  renderSeriesList('#trainingUpcoming');
}
function savePlan(e){
  e.preventDefault();const p={startDate:$('#startDate').value,startWeight:num('#startWeight'),goalWeight:num('#goalWeight'),maintenanceCalories:num('#maintenanceCalories'),plannedCalories:num('#plannedCalories')};
  if(!p.startDate||!validWeight(p.startWeight)||!validWeight(p.goalWeight)||!hasNum(p.maintenanceCalories)||!hasNum(p.plannedCalories))return toast('Bitte den Plan vollständig ausfüllen');
  if(p.goalWeight>=p.startWeight)return toast('Zielgewicht muss unter dem Startgewicht liegen');
  db.plan=p;save();renderAll();toast('Plan gespeichert');
}
function addTrainingFromPlan(e){
  e.preventDefault();const date=$('#trainingDate').value,name=$('#trainingName').value.trim()||'Training',time=$('#trainingTime').value,repeat=$('#trainingRepeat').value,cal=num('#trainingCalories');
  if(!date)return toast('Bitte ein Startdatum wählen');
  const rec={id:uid(),type:repeat,name,time,calories:hasNum(cal)?cal:(+db.gym.calories||300)};
  if(repeat==='once')rec.date=date;else Object.assign(rec,{start:date,end:null,weekday:parseDate(date).getDay()});
  db.gym.calories=rec.calories;db.gym.series.push(rec);save();renderAll();toast(repeat==='weekly'?'Trainingsserie hinzugefügt':'Training hinzugefügt');
}
function openNewTrainingModal(){
  openModal(`<h2>Training hinzufügen</h2><p>Lege einen einzelnen Termin oder eine wöchentliche Serie an.</p><form id="modalNewTraining" class="modal-form"><label>Name<input id="mTrainName" value="Krafttraining" maxlength="40"></label><label>Startdatum<input id="mTrainDate" type="date" value="${selectedDate||dateKey()}"></label><label>Uhrzeit<input id="mTrainTime" type="time" value="18:00"></label><label>Wiederholung<select id="mTrainRepeat"><option value="weekly">Jede Woche</option><option value="once">Einmalig</option></select></label><label>Verbrauch (kcal)<input id="mTrainCal" type="number" value="${fmt(db.gym.calories||300)}" min="0"></label><button class="primary-button" type="submit">Hinzufügen</button></form>`);
  $('#modalNewTraining').addEventListener('submit',e=>{e.preventDefault();const date=$('#mTrainDate').value,repeat=$('#mTrainRepeat').value,rec={id:uid(),type:repeat,name:$('#mTrainName').value.trim()||'Training',time:$('#mTrainTime').value,calories:+$('#mTrainCal').value||0};if(repeat==='once')rec.date=date;else Object.assign(rec,{start:date,end:null,weekday:parseDate(date).getDay()});db.gym.series.push(rec);db.gym.calories=rec.calories;save();closeModal();renderAll();toast('Training hinzugefügt')});
}
function openSeriesEditor(id){
  const s=db.gym.series.find(x=>x.id===id);if(!s)return;
  if(s.type==='once'){
    openModal(`<h2>Training bearbeiten</h2><p>Einmaliger Termin</p><form id="editOnce" class="modal-form"><label>Name<input id="eoName" value="${escapeHtml(s.name||'Training')}"></label><label>Datum<input id="eoDate" type="date" value="${s.date}"></label><label>Uhrzeit<input id="eoTime" type="time" value="${s.time||'18:00'}"></label><label>Verbrauch (kcal)<input id="eoCal" type="number" value="${hasNum(s.calories)?s.calories:db.gym.calories}"></label><button class="primary-button" type="submit">Speichern</button><button id="deleteOnce" class="danger-button" type="button">Termin löschen</button></form>`);
    $('#editOnce').addEventListener('submit',e=>{e.preventDefault();s.name=$('#eoName').value.trim()||'Training';s.date=$('#eoDate').value;s.time=$('#eoTime').value;s.calories=+$('#eoCal').value||0;save();closeModal();renderAll();toast('Training geändert')});
    $('#deleteOnce').addEventListener('click',()=>{db.gym.series=db.gym.series.filter(x=>x.id!==id);save();closeModal();renderAll();toast('Training gelöscht')});return;
  }
  const occurrence=nextOccurrenceForSeries(s,dateKey())||s.start;
  openRecurringEditor(s,occurrence);
}
function nextOccurrenceForSeries(s,from){for(let k=from,i=0;i<370;i++,k=addDays(k,1))if(gymOccurrences(k).some(x=>x.id===s.id))return k;return null}
function openRecurringEditor(s,k){
  openModal(`<h2>Trainingsserie bearbeiten</h2><p>Ausgewählter Termin: ${formatDate(k,{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}</p><div class="modal-form"><label>Name<input id="erName" value="${escapeHtml(s.name||'Training')}"></label><label>Neues Datum<input id="erDate" type="date" value="${k}"></label><label>Uhrzeit<input id="erTime" type="time" value="${s.time||'18:00'}"></label><label>Verbrauch (kcal)<input id="erCal" type="number" value="${hasNum(s.calories)?s.calories:db.gym.calories}"></label><div class="modal-actions"><button id="saveFuture" class="secondary-button" type="button">Diesen + zukünftige ändern</button><button id="moveOne" class="secondary-button" type="button">Nur diesen Termin ändern</button><button id="deleteOne" class="danger-button" type="button">Nur diesen Termin löschen</button><button id="deleteFuture" class="danger-button" type="button">Diesen + zukünftige löschen</button></div></div>`);
  $('#saveFuture').addEventListener('click',()=>{const nk=$('#erDate').value;s.end=prevDay(k);db.gym.series.push({id:uid(),type:'weekly',start:nk,end:null,weekday:parseDate(nk).getDay(),name:$('#erName').value.trim()||'Training',time:$('#erTime').value,calories:+$('#erCal').value||0});save();closeModal();renderAll();toast('Zukünftige Serie geändert')});
  $('#moveOne').addEventListener('click',()=>{const nk=$('#erDate').value;if(!isSkipped(s.id,k))db.gym.skips.push({seriesId:s.id,date:k});db.gym.series.push({id:uid(),type:'once',date:nk,name:$('#erName').value.trim()||'Training',time:$('#erTime').value,calories:+$('#erCal').value||0});save();closeModal();renderAll();toast('Termin geändert')});
  $('#deleteOne').addEventListener('click',()=>{if(!isSkipped(s.id,k))db.gym.skips.push({seriesId:s.id,date:k});save();closeModal();renderAll();toast('Termin gelöscht')});
  $('#deleteFuture').addEventListener('click',()=>{s.end=prevDay(k);save();closeModal();renderAll();toast('Zukünftige Termine gelöscht')});
}
function openDayEditor(k){
  const d=actual(k),gym=gymDay(k);openModal(`<h2>${formatDate(k,{weekday:'long',day:'2-digit',month:'long'})}</h2><p>Trage Gewicht und Kalorien ein. Ein Kalorientag bleibt bis einschließlich +100 kcal im grünen Bereich.</p><form id="dayEditor" class="modal-form"><label>Gewicht (kg)<input id="edWeight" type="number" step="0.1" value="${validWeight(d.weight)?d.weight:''}"></label><label>Kalorien<input id="edCalories" type="number" value="${hasNum(d.calories)?d.calories:''}"></label>${gym?`<label class="toggle-row"><span>Training erledigt</span><input id="edGym" type="checkbox" ${d.gymDone===true?'checked':''}><i></i></label>`:''}<button class="primary-button" type="submit">Speichern</button><button id="deleteDay" class="danger-button" type="button">Tag löschen</button></form>`);
  $('#dayEditor').addEventListener('submit',e=>{e.preventDefault();const w=+$('#edWeight').value;if($('#edWeight').value&&w<=0)return toast('Gewicht muss größer als 0 sein');db.days[k]={...d,date:k,weight:$('#edWeight').value?+$('#edWeight').value:null,calories:$('#edCalories').value?+$('#edCalories').value:null,gymDone:gym?$('#edGym').checked:null};save();closeModal();renderAll();toast('Tag gespeichert')});
  $('#deleteDay').addEventListener('click',()=>{delete db.days[k];save();closeModal();renderAll();toast('Tag gelöscht')});
}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

function exportData(){const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`WesGym-5.0-Backup-${dateKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
function importData(e){const file=e.target.files?.[0];if(!file)return;const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);if(!x||typeof x!=='object')throw new Error();localStorage.setItem(KEY,JSON.stringify(x));location.reload()}catch{toast('Ungültige Backup-Datei')}};r.readAsText(file)}
function resetData(){if(!confirm('Alle WesGym-Daten wirklich löschen?'))return;localStorage.removeItem(KEY);location.reload()}

document.addEventListener('DOMContentLoaded',init);
})();
