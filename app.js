
const STORAGE_KEY='wesgym_1_0';
const weekdays=['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
const defaultDB={
  weightPlan:{startDate:'',startWeight:null,maintenanceCalories:2600,plannedCalories:1800,goalWeight:null},
  goals:{protein:180,carbs:150,fat:60,steps:10000,defaultRest:90},
  actualDays:{},
  dayPlans:{},
  plans:[],
  exercises:[],
  workouts:[]
};
let db=loadDB(), selectedDate=new Date(), selectedMode='actual', session=null, sessionTimer=null, restTimer=null, selectedRest=90;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

document.addEventListener('DOMContentLoaded',()=>{
  initNavigation();initTabs();initActions();renderAll();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
});

function clone(v){return JSON.parse(JSON.stringify(v))}
function loadDB(){try{const x=JSON.parse(localStorage.getItem(STORAGE_KEY));return x?{...clone(defaultDB),...x,weightPlan:{...defaultDB.weightPlan,...(x.weightPlan||{})},goals:{...defaultDB.goals,...(x.goals||{})}}:clone(defaultDB)}catch{return clone(defaultDB)}}
function saveDB(){localStorage.setItem(STORAGE_KEY,JSON.stringify(db))}
function dateKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function parseDate(k){const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d,12)}
function fmt(v,d=0){return Number.isFinite(+v)?(+v).toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d}):'–'}
function avg(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:null}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function num(id){const v=parseFloat($(id).value);return Number.isFinite(v)?v:null}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(t._x);t._x=setTimeout(()=>t.classList.add('hidden'),2200)}
function openModal(html){$('#modalBody').innerHTML=html;$('#modal').classList.remove('hidden')}
function closeModal(){$('#modal').classList.add('hidden')}

function initNavigation(){
  $$('.bottom-nav button').forEach(b=>b.onclick=()=>openPage(b.dataset.page));
}
function openPage(name){
  $$('.page').forEach(p=>p.classList.toggle('active',p.id===name));
  $$('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===name));
  const titles={dashboard:'Übersicht',diary:'Tagebuch',gym:'Gym',exercises:'Übungen',reports:'Fortschritt',settings:'Einstellungen'};
  $('#pageTitle').textContent=titles[name];
  if(name==='dashboard')renderDashboard();
  if(name==='diary')renderDayScreen();
  if(name==='gym')renderGym();
  if(name==='exercises')renderExercises();
  if(name==='reports')renderProgress();
  if(name==='settings')renderSettings();
}
function initTabs(){
  $$('[data-gym-tab]').forEach(b=>b.onclick=()=>{
    $$('[data-gym-tab]').forEach(x=>x.classList.toggle('active',x===b));
    $('#gymPlan').classList.toggle('hidden',b.dataset.gymTab!=='plan');
    $('#gymSession').classList.toggle('hidden',b.dataset.gymTab!=='session');
    $('#gymHistory').classList.toggle('hidden',b.dataset.gymTab!=='history');
    if(b.dataset.gymTab==='history')renderWorkoutHistory();
  });
}
function initActions(){
  $('#quickAdd').onclick=()=>{selectedDate=new Date();selectedMode='actual';openPage('diary')};
  $('#openToday').onclick=()=>{selectedDate=new Date();selectedMode='actual';openPage('diary')};
  $('#addPlanDay').onclick=()=>editPlan({id:'p'+Date.now(),name:'Neuer Tag',weekday:1,exercises:[]},true);
  $('#addExercise').onclick=()=>exerciseModal(null);
  $('#exerciseSearch').oninput=renderExercises;
  $('#startSession').onclick=startSession;
  $('#finishSession').onclick=finishSession;
  $('#cancelSession').onclick=cancelSession;
  $$('[data-rest]').forEach(b=>b.onclick=()=>{selectedRest=+b.dataset.rest;showRest(selectedRest)});
  $('#startRest').onclick=startRest;
  $('#weightPlanForm').onsubmit=saveWeightPlan;
  $('#dailyGoalsForm').onsubmit=saveGoals;
  $('#exportData').onclick=exportData;
  $('#importData').onchange=importData;
  $('#resetData').onclick=()=>{if(confirm('Alle Daten wirklich löschen?')){localStorage.removeItem(STORAGE_KEY);location.reload()}};
  $$('[data-close-modal]').forEach(x=>x.onclick=closeModal);
}
function renderAll(){
  $('#todayLabel').textContent=new Date().toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'});
  renderDashboard();renderDayScreen();renderGym();renderExercises();renderProgress();renderSettings();
}

function expectedWeight(k){
  const p=db.weightPlan;
  if(!p.startDate||!Number.isFinite(+p.startWeight)||!Number.isFinite(+p.maintenanceCalories)||!Number.isFinite(+p.plannedCalories))return null;
  const days=Math.floor((parseDate(k)-parseDate(p.startDate))/86400000);
  if(days<0)return null;
  return +p.startWeight-((+p.maintenanceCalories-(+p.plannedCalories))*days/7700);
}
function actualDay(k){return db.actualDays[k]||{date:k}}
function planDay(k){
  return {...{date:k,calories:db.weightPlan.plannedCalories,protein:db.goals.protein,carbs:db.goals.carbs,fat:db.goals.fat,steps:db.goals.steps,gym:false,workoutName:''},...(db.dayPlans[k]||{}),weight:expectedWeight(k)};
}
function classify(metric,a,p){
  if(!Number.isFinite(+a)||!Number.isFinite(+p))return'neutral';
  a=+a;p=+p;
  if(metric==='weight'){const d=a-p;if(Math.abs(d)<=.15)return'mid';return d<0?'good':'bad'}
  if(metric==='calories'){const r=a/p;if(r>=.85&&r<=1.05)return'good';if(r>=.7&&r<=1.15)return'mid';return'bad'}
  if(metric==='protein'||metric==='steps'){const r=a/p;if(r>=1)return'good';if(r>=.85)return'mid';return'bad'}
  return'neutral';
}
function scoreFor(k){
  const p=planDay(k),a=actualDay(k),values=[];
  for(const m of ['weight','calories','protein','steps']){const c=classify(m,a[m],p[m]);if(c!=='neutral')values.push(c)}
  if(p.gym){values.push(db.workouts.some(w=>dateKey(new Date(w.date))===k)?'good':'bad')}
  if(!values.length)return null;
  const pts={good:100,mid:70,bad:25};return Math.round(values.reduce((s,x)=>s+pts[x],0)/values.length);
}
function scoreClass(s){return s===null?'neutral':s>=85?'good':s>=60?'mid':'bad'}
function metricCard(label,a,p,metric,suffix=''){
  const c=classify(metric,a,p),icon=c==='good'?'↑':c==='bad'?'↓':'•';
  return `<div class="metric-card ${c}"><span class="state">${icon}</span><div class="label">${label}</div><div class="value">${Number.isFinite(+a)?fmt(a,metric==='weight'?1:0):'–'}${suffix}</div><div class="sub">Plan ${Number.isFinite(+p)?fmt(p,metric==='weight'?1:0):'–'}${suffix}</div></div>`;
}
function statusText(k){
  const a=actualDay(k).weight,p=expectedWeight(k);
  if(!Number.isFinite(+a)||!Number.isFinite(+p))return'Noch keine Gewichtsdaten';
  const d=+a-+p;if(Math.abs(d)<=.15)return'Im Plan';return d<0?`${fmt(Math.abs(d),1)} kg vor dem Plan`:`${fmt(d,1)} kg hinter dem Plan`;
}
function sevenDayStatus(k){
  const end=parseDate(k),actual=[],planned=[];
  for(let i=6;i>=0;i--){const d=new Date(end);d.setDate(d.getDate()-i);const dk=dateKey(d),a=actualDay(dk).weight,p=expectedWeight(dk);if(Number.isFinite(+a))actual.push(+a);if(Number.isFinite(+p))planned.push(+p)}
  if(actual.length<3||!planned.length)return'7-Tage-Trend noch nicht verfügbar';
  const d=avg(actual)-avg(planned);if(Math.abs(d)<=.15)return'7-Tage-Trend: im Plan';return d<0?`7-Tage-Trend: ${fmt(Math.abs(d),1)} kg vor dem Plan`:`7-Tage-Trend: ${fmt(d,1)} kg hinter dem Plan`;
}
function renderDashboard(){
  const k=dateKey(),a=actualDay(k),p=planDay(k),score=scoreFor(k),workout=db.workouts.some(w=>dateKey(new Date(w.date))===k);
  $('#dashboardToday').innerHTML=`<section class="day-hero">
    <div class="hero-top"><div><p>${new Date().toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'})}</p><h2>Heute</h2></div>
    <div class="score-ring" style="--score:${score??0}%"><div><b>${score??'–'}${score!==null?'%':''}</b><small>Tages-Score</small></div></div></div>
    <div class="metric-grid">
      ${metricCard('Gewicht',a.weight,p.weight,'weight',' kg')}
      ${metricCard('Kalorien',a.calories,p.calories,'calories')}
      ${metricCard('Protein',a.protein,p.protein,'protein',' g')}
      ${metricCard('Schritte',a.steps,p.steps,'steps')}
      <div class="metric-card ${p.gym?(workout?'good':'bad'):'neutral'}"><span class="state">${p.gym?(workout?'✓':'!'):'•'}</span><div class="label">Training</div><div class="value">${workout?'Erledigt':p.gym?'Geplant':'Ruhetag'}</div><div class="sub">${esc(p.workoutName)}</div></div>
      <div class="metric-card ${scoreClass(score)}"><div class="label">Gewichtsstatus</div><div class="value">${statusText(k)}</div><div class="sub">${sevenDayStatus(k)}</div></div>
    </div></section>`;
  const row=$('#dashboardDays');row.innerHTML='';
  for(let i=-3;i<=3;i++){const d=new Date();d.setDate(d.getDate()+i);const dk=dateKey(d),s=scoreFor(dk),card=document.createElement('button');card.className=`mini-day ${scoreClass(s)}`;card.innerHTML=`<span>${d.toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'})}</span><strong>${s??'–'}${s!==null?'%':''}</strong><b>${Number.isFinite(+actualDay(dk).weight)?fmt(actualDay(dk).weight,1)+' kg':'Keine Daten'}</b>`;card.onclick=()=>{selectedDate=d;openPage('diary')};row.appendChild(card)}
  renderPredictions();
}
function renderPredictions(){
  const p=db.weightPlan,latest=Object.values(db.actualDays).filter(d=>Number.isFinite(+d.weight)).sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
  const base=latest?.weight??p.startWeight,start=latest?.date??p.startDate;
  if(!Number.isFinite(+base)||!start){$('#pred7').textContent=$('#pred30').textContent=$('#pred90').textContent='–';$('#predictionText').textContent='Gewichtsplan zuerst einrichten.';return}
  const deficit=(+p.maintenanceCalories||0)-(+p.plannedCalories||0);
  const predict=days=>+base-(deficit*days/7700);
  $('#pred7').textContent=fmt(predict(7),1)+' kg';$('#pred30').textContent=fmt(predict(30),1)+' kg';$('#pred90').textContent=fmt(predict(90),1)+' kg';
  $('#predictionText').textContent=`Basis: ${fmt(base,1)} kg · tägliches Defizit ${fmt(deficit)} kcal · theoretisch ${fmt(deficit*7/7700,2)} kg pro Woche.`;
}

function renderDayScreen(){
  const host=$('#dayScreen');if(!host)return;const k=dateKey(selectedDate),p=planDay(k),a=actualDay(k),score=scoreFor(k);
  host.innerHTML=`<section class="day-nav-card">
    <div class="day-nav-head"><button id="prevDay">‹</button><div class="day-date"><b>${selectedDate.toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'})}</b><span>${k===dateKey()?'Heute':parseDate(k)>parseDate(dateKey())?'Geplant':'Vergangener Tag'}</span></div><button id="nextDay">›</button></div>
    <div id="dayStrip" class="day-strip"></div></section>
    <div class="mode-toggle"><button data-mode="plan" class="${selectedMode==='plan'?'active':''}">Geplant</button><button data-mode="actual" class="${selectedMode==='actual'?'active':''}">Tatsächlich</button></div>
    <section class="day-hero">
      <div class="hero-top"><div><p>${selectedMode==='plan'?'Dein Tagesplan':'Plan gegen tatsächliche Werte'}</p><h2>${selectedMode==='plan'?'Geplant':'Tagesergebnis'}</h2></div>
      <div class="score-ring" style="--score:${score??0}%"><div><b>${score??'–'}${score!==null?'%':''}</b><small>Score</small></div></div></div>
      <div class="metric-grid">
        ${metricCard('Gewicht',selectedMode==='plan'?p.weight:a.weight,p.weight,'weight',' kg')}
        ${metricCard('Kalorien',selectedMode==='plan'?p.calories:a.calories,p.calories,'calories')}
        ${metricCard('Protein',selectedMode==='plan'?p.protein:a.protein,p.protein,'protein',' g')}
        ${metricCard('Schritte',selectedMode==='plan'?p.steps:a.steps,p.steps,'steps')}
      </div>
    </section>
    <section class="editor-card">
      <div class="section-head"><div><h2>${selectedMode==='plan'?'Plan bearbeiten':'Tatsächliche Werte'}</h2><p>${selectedMode==='plan'?'Gewicht wird automatisch berechnet':'Vergangene Tage können korrigiert werden'}</p></div></div>
      <form id="dayForm" class="form-grid">
        <label>Gewicht (kg)<input id="dWeight" type="number" step="0.1" value="${selectedMode==='plan'?(Number.isFinite(+p.weight)?p.weight.toFixed(2):''):(a.weight??'')}" ${selectedMode==='plan'?'disabled':''}></label>
        <label>Kalorien<input id="dCalories" type="number" value="${selectedMode==='plan'?(p.calories??''):(a.calories??'')}"></label>
        <label>Protein (g)<input id="dProtein" type="number" value="${selectedMode==='plan'?(p.protein??''):(a.protein??'')}"></label>
        <label>Kohlenhydrate (g)<input id="dCarbs" type="number" value="${selectedMode==='plan'?(p.carbs??''):(a.carbs??'')}"></label>
        <label>Fett (g)<input id="dFat" type="number" value="${selectedMode==='plan'?(p.fat??''):(a.fat??'')}"></label>
        <label>Schritte<input id="dSteps" type="number" value="${selectedMode==='plan'?(p.steps??''):(a.steps??'')}"></label>
        ${selectedMode==='plan'?`<label class="full">Training geplant<select id="dGym"><option value="0" ${!p.gym?'selected':''}>Nein</option><option value="1" ${p.gym?'selected':''}>Ja</option></select></label><label class="full">Trainingstag / Notiz<input id="dWorkoutName" value="${esc(p.workoutName)}"></label>`:''}
        <button class="primary full">Speichern</button>
        <button id="deleteDay" type="button" class="outline-danger full">Daten dieses Tages löschen</button>
      </form>
      <div class="summary-box"><b>${statusText(k)}</b><br>${sevenDayStatus(k)}</div>
    </section>`;
  $('#prevDay').onclick=()=>{selectedDate.setDate(selectedDate.getDate()-1);renderDayScreen()};
  $('#nextDay').onclick=()=>{selectedDate.setDate(selectedDate.getDate()+1);renderDayScreen()};
  $$('[data-mode]').forEach(b=>b.onclick=()=>{selectedMode=b.dataset.mode;renderDayScreen()});
  $('#dayForm').onsubmit=saveDay;
  $('#deleteDay').onclick=deleteDay;
  renderDayStrip();
}
function renderDayStrip(){
  const strip=$('#dayStrip');strip.innerHTML='';
  for(let i=-3;i<=3;i++){const d=new Date(selectedDate);d.setDate(d.getDate()+i);const k=dateKey(d),s=scoreFor(k),b=document.createElement('button');b.className=`day-chip ${i===0?'selected':''} ${scoreClass(s)}`;b.innerHTML=`<span>${d.toLocaleDateString('de-DE',{weekday:'short'})}</span><b>${d.getDate()}</b><small>${s===null?'–':s+'%'}</small>`;b.onclick=()=>{selectedDate=d;renderDayScreen()};strip.appendChild(b)}
}
function saveDay(e){
  e.preventDefault();const k=dateKey(selectedDate),payload={date:k,calories:num('#dCalories'),protein:num('#dProtein'),carbs:num('#dCarbs'),fat:num('#dFat'),steps:num('#dSteps')};
  if(selectedMode==='plan'){db.dayPlans[k]={...db.dayPlans[k],...payload,gym:$('#dGym').value==='1',workoutName:$('#dWorkoutName').value.trim()}}
  else{db.actualDays[k]={...db.actualDays[k],...payload,weight:num('#dWeight')}}
  saveDB();toast('Tag gespeichert');renderDayScreen();renderDashboard();
}
function deleteDay(){
  if(!confirm('Daten dieses Tages wirklich löschen?'))return;const k=dateKey(selectedDate);if(selectedMode==='plan')delete db.dayPlans[k];else delete db.actualDays[k];saveDB();renderDayScreen();renderDashboard();toast('Tagesdaten gelöscht');
}

function ex(id){return db.exercises.find(e=>e.id===id)||{id,name:'Unbekannte Übung',muscle:'',equipment:'',icon:'🏋️'}}
function renderExercises(){
  const q=($('#exerciseSearch').value||'').toLowerCase(),filtered=db.exercises.filter(e=>e.name.toLowerCase().includes(q)||e.muscle.toLowerCase().includes(q)||e.equipment.toLowerCase().includes(q));
  $('#exerciseGrid').innerHTML=filtered.length?filtered.map(e=>`<div class="exercise-card"><div class="exercise-icon">${esc(e.icon||'🏋️')}</div><div class="exercise-body"><h3>${esc(e.name)}</h3><p>${esc(e.muscle)} · ${esc(e.equipment)}</p><div class="exercise-actions"><button class="edit-btn" data-edit-ex="${e.id}">Bearbeiten</button><button class="delete-btn" data-delete-ex="${e.id}">Löschen</button></div></div></div>`).join(''):'<p class="note">Noch keine Übungen. Füge deine erste eigene Übung hinzu.</p>';
  $$('[data-edit-ex]').forEach(b=>b.onclick=()=>exerciseModal(b.dataset.editEx));
  $$('[data-delete-ex]').forEach(b=>b.onclick=()=>deleteExercise(b.dataset.deleteEx));
}
function exerciseModal(id){
  const x=id?clone(ex(id)):{id:'e'+Date.now(),name:'',muscle:'',equipment:'',icon:'🏋️'};
  openModal(`<h2>${id?'Übung bearbeiten':'Neue Übung'}</h2><form id="exerciseForm" class="form-grid">
    <label class="full">Name<input id="exName" value="${esc(x.name)}" required></label>
    <label>Muskelgruppe<input id="exMuscle" value="${esc(x.muscle)}" required></label>
    <label>Gerät<input id="exEquipment" value="${esc(x.equipment)}" required></label>
    <label class="full">Symbol<input id="exIcon" value="${esc(x.icon)}"></label>
    <button class="primary full">Speichern</button></form>`);
  $('#exerciseForm').onsubmit=e=>{e.preventDefault();Object.assign(x,{name:$('#exName').value.trim(),muscle:$('#exMuscle').value.trim(),equipment:$('#exEquipment').value.trim(),icon:$('#exIcon').value||'🏋️'});db.exercises=id?db.exercises.map(y=>y.id===id?x:y):[...db.exercises,x];saveDB();closeModal();renderExercises();renderGym();toast('Übung gespeichert')};
}
function deleteExercise(id){
  const used=db.plans.some(p=>p.exercises.some(e=>e.id===id));
  if(!confirm(used?'Übung wird in einem Plan verwendet. Aus Bibliothek und allen Plänen löschen?':'Übung wirklich löschen?'))return;
  db.exercises=db.exercises.filter(e=>e.id!==id);db.plans=db.plans.map(p=>({...p,exercises:p.exercises.filter(e=>e.id!==id)}));saveDB();renderExercises();renderGym();toast('Übung gelöscht');
}

function renderGym(){
  renderPlans();renderSessionSelect();renderWorkoutHistory();
}
function renderPlans(){
  $('#planList').innerHTML=db.plans.length?[...db.plans].sort((a,b)=>a.weekday-b.weekday).map(p=>`<div class="plan-day"><div class="plan-head"><div><small>${weekdays[p.weekday]}</small><h3>${esc(p.name)}</h3></div><div><button class="small-btn" data-edit-plan="${p.id}">Bearbeiten</button> <button class="small-btn" data-delete-plan="${p.id}">×</button></div></div>${p.exercises.map(x=>`<div class="plan-ex"><span>${esc(ex(x.id).name)}</span><small>${x.sets} × ${x.reps}</small></div>`).join('')}</div>`).join(''):'<p class="note">Noch keine Trainingstage. Tippe auf „＋ Tag“.</p>';
  $$('[data-edit-plan]').forEach(b=>b.onclick=()=>editPlan(clone(db.plans.find(p=>p.id===b.dataset.editPlan)),false));
  $$('[data-delete-plan]').forEach(b=>b.onclick=()=>{if(confirm('Trainingstag löschen?')){db.plans=db.plans.filter(p=>p.id!==b.dataset.deletePlan);saveDB();renderGym()}});
}
function editPlan(p,isNew){
  openModal(`<h2>${isNew?'Trainingstag hinzufügen':'Trainingstag bearbeiten'}</h2><form id="planForm" class="form-grid">
    <label class="full">Name<input id="planName" value="${esc(p.name)}"></label>
    <label class="full">Wochentag<select id="planWeekday">${weekdays.map((w,i)=>`<option value="${i}" ${i===p.weekday?'selected':''}>${w}</option>`).join('')}</select></label>
    <div class="full"><b>Übungen</b><div id="planExercises"></div><button type="button" id="addExerciseToPlan" class="secondary wide">＋ Übung hinzufügen</button></div>
    <button class="primary full">Speichern</button></form>`);
  const redraw=()=>{$('#planExercises').innerHTML=p.exercises.map((x,i)=>`<div class="plan-ex"><span>${esc(ex(x.id).name)}<small>${x.sets} Sätze × ${x.reps} Wdh.</small></span><button type="button" class="small-btn" data-remove-plan-ex="${i}">×</button></div>`).join('');$$('[data-remove-plan-ex]').forEach(b=>b.onclick=()=>{p.exercises.splice(+b.dataset.removePlanEx,1);redraw()})};redraw();
  $('#addExerciseToPlan').onclick=()=>pickExercise(id=>{const sets=+prompt('Sätze?','3')||3,reps=+prompt('Wiederholungen?','10')||10;p.exercises.push({id,sets,reps});editPlan(p,isNew)});
  $('#planForm').onsubmit=e=>{e.preventDefault();p.name=$('#planName').value.trim()||'Training';p.weekday=+$('#planWeekday').value;if(isNew)db.plans.push(p);else db.plans=db.plans.map(x=>x.id===p.id?p:x);saveDB();closeModal();renderGym();toast('Trainingsplan gespeichert')};
}
function pickExercise(cb){
  openModal(`<h2>Übung auswählen</h2><div id="pickList"></div>`);
  $('#pickList').innerHTML=db.exercises.length?db.exercises.map(e=>`<div class="history-card"><div><h3>${esc(e.name)}</h3><p>${esc(e.muscle)}</p></div><button class="small-btn" data-pick="${e.id}">＋</button></div>`).join(''):'<p class="note">Lege zuerst eine eigene Übung an.</p>';
  $$('[data-pick]').forEach(b=>b.onclick=()=>cb(b.dataset.pick));
}
function renderSessionSelect(){
  $('#sessionPlanSelect').innerHTML=db.plans.length?db.plans.map(p=>`<option value="${p.id}">${weekdays[p.weekday]} – ${esc(p.name)}</option>`).join(''):'<option>Kein Trainingstag vorhanden</option>';
  $('#startSession').disabled=!db.plans.length;
}
function startSession(){
  const p=db.plans.find(x=>x.id===$('#sessionPlanSelect').value);if(!p)return;
  session={id:'w'+Date.now(),name:p.name,date:new Date().toISOString(),started:Date.now(),exercises:p.exercises.map(x=>({id:x.id,sets:Array.from({length:x.sets},()=>({weight:0,reps:x.reps,done:false}))}))};
  $('#sessionSetup').classList.add('hidden');$('#activeSession').classList.remove('hidden');$('#sessionName').textContent=p.name;renderSession();sessionTimer=setInterval(updateSessionTime,1000);updateSessionTime();
}
function lastPerformance(id){for(const w of [...db.workouts].reverse()){const e=w.exercises.find(x=>x.id===id);if(e)return e}return null}
function renderSession(){
  $('#sessionExercises').innerHTML=session.exercises.map((e,ei)=>{const meta=ex(e.id),prev=lastPerformance(e.id),prevText=prev?'Letztes Mal: '+prev.sets.filter(s=>s.done).map(s=>`${s.weight} kg × ${s.reps}`).join(' · '):'Noch keine vorherige Leistung',max=prev?Math.max(0,...prev.sets.map(s=>s.weight||0)):0,suggest=max?`Vorschlag: ${fmt(max+2.5,1)} kg testen, wenn die Technik sauber war.`:'Wähle ein Gewicht mit 1–2 Wiederholungen Reserve.';return `<section class="card session-exercise"><h3>${esc(meta.name)}</h3><p class="previous">${prevText}</p>${e.sets.map((s,si)=>`<div class="set-row"><b>${si+1}</b><input data-weight="${ei}-${si}" type="number" step="0.5" placeholder="kg"><input data-reps="${ei}-${si}" type="number" value="${s.reps}" placeholder="Wdh."><button data-done="${ei}-${si}" class="done-btn">✓</button></div>`).join('')}<p class="note">${suggest}</p></section>`}).join('');
  $$('[data-weight]').forEach(i=>i.onchange=()=>{const[a,b]=i.dataset.weight.split('-').map(Number);session.exercises[a].sets[b].weight=+i.value||0});
  $$('[data-reps]').forEach(i=>i.onchange=()=>{const[a,b]=i.dataset.reps.split('-').map(Number);session.exercises[a].sets[b].reps=+i.value||0});
  $$('[data-done]').forEach(b=>b.onclick=()=>{const[a,c]=b.dataset.done.split('-').map(Number);session.exercises[a].sets[c].done=!session.exercises[a].sets[c].done;b.classList.toggle('done');startRest()});
}
function updateSessionTime(){if(!session)return;const s=Math.floor((Date.now()-session.started)/1000);$('#sessionTime').textContent=`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
function showRest(s){$('#restTime').textContent=`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
function startRest(){clearInterval(restTimer);let left=selectedRest||db.goals.defaultRest;showRest(left);restTimer=setInterval(()=>{left--;showRest(left);if(left<=0){clearInterval(restTimer);navigator.vibrate?.([200,100,200]);toast('Pause beendet')}},1000)}
function finishSession(){
  if(!session||!confirm('Training abschließen?'))return;clearInterval(sessionTimer);clearInterval(restTimer);session.finished=Date.now();session.duration=Math.round((session.finished-session.started)/1000);db.workouts.push(session);saveDB();session=null;$('#activeSession').classList.add('hidden');$('#sessionSetup').classList.remove('hidden');renderAll();toast('Training gespeichert');
}
function cancelSession(){if(!session||!confirm('Training wirklich abbrechen? Es wird nicht gespeichert.'))return;clearInterval(sessionTimer);clearInterval(restTimer);session=null;$('#activeSession').classList.add('hidden');$('#sessionSetup').classList.remove('hidden');toast('Training verworfen')}
function workoutSets(w){return w.exercises.reduce((s,e)=>s+e.sets.filter(x=>x.done).length,0)}
function prCount(w){
  let c=0;for(const e of w.exercises){const before=db.workouts.filter(x=>new Date(x.date)<new Date(w.date)).flatMap(x=>x.exercises.filter(y=>y.id===e.id).flatMap(y=>y.sets.filter(s=>s.done).map(s=>(s.weight||0)*(1+(s.reps||0)/30))));const old=Math.max(0,...before),now=Math.max(0,...e.sets.filter(s=>s.done).map(s=>(s.weight||0)*(1+(s.reps||0)/30)));if(now>old&&now>0)c++}return c
}
function renderWorkoutHistory(){
  $('#workoutHistory').innerHTML=db.workouts.length?[...db.workouts].reverse().map(w=>`<div class="history-card"><div><h3>${esc(w.name)}</h3><p>${new Date(w.date).toLocaleDateString('de-DE')} · ${Math.round((w.duration||0)/60)} Min. · ${w.exercises.length} Übungen · ${workoutSets(w)} Sätze${prCount(w)?' · '+prCount(w)+' PR':''}</p></div><div class="history-actions"><button class="details-btn" data-details="${w.id}">Details</button><button class="delete-btn" data-delete-workout="${w.id}">Löschen</button></div></div>`).join(''):'<p class="note">Noch keine Trainings.</p>';
  $$('[data-delete-workout]').forEach(b=>b.onclick=()=>{if(confirm('Dieses Training wirklich löschen?')){db.workouts=db.workouts.filter(w=>w.id!==b.dataset.deleteWorkout);saveDB();renderWorkoutHistory();renderProgress();renderDashboard();toast('Training gelöscht')}});
  $$('[data-details]').forEach(b=>b.onclick=()=>showWorkoutDetails(b.dataset.details));
}
function showWorkoutDetails(id){
  const w=db.workouts.find(x=>x.id===id);if(!w)return;
  openModal(`<h2>${esc(w.name)}</h2><p class="note">${new Date(w.date).toLocaleString('de-DE')} · ${Math.round((w.duration||0)/60)} Min.</p>${w.exercises.map(e=>`<div class="summary-box"><b>${esc(ex(e.id).name)}</b><br>${e.sets.filter(s=>s.done).map((s,i)=>`Satz ${i+1}: ${fmt(s.weight,1)} kg × ${s.reps}`).join('<br>')||'Keine abgeschlossenen Sätze'}</div>`).join('')}`);
}

function bestSet(entry){return entry.sets.filter(s=>s.done).sort((a,b)=>((b.weight||0)*(1+(b.reps||0)/30))-((a.weight||0)*(1+(a.reps||0)/30)))[0]||null}
function sessionsFor(id){return db.workouts.filter(w=>w.exercises.some(e=>e.id===id)).map(w=>({workout:w,exercise:w.exercises.find(e=>e.id===id)})).sort((a,b)=>new Date(b.workout.date)-new Date(a.workout.date))}
function compare(cur,prev){
  if(!cur||!prev)return'mid';const c=bestSet(cur.exercise),p=bestSet(prev.exercise);if(!c||!p)return'mid';const cs=(c.weight||0)*(1+(c.reps||0)/30),ps=(p.weight||0)*(1+(p.reps||0)/30);if(cs>ps*1.015)return'good';if(cs<ps*.985)return'bad';return'mid';
}
function renderProgress(){
  const used=db.exercises.filter(e=>sessionsFor(e.id).length);
  $('#exerciseProgress').innerHTML=used.length?used.map(e=>{const s=sessionsFor(e.id),state=compare(s[0],s[1]),latest=bestSet(s[0].exercise),label={good:'Fortschritt',bad:'Rückgang',mid:'Stabil'}[state];return `<button class="progress-card" data-progress="${e.id}"><div class="progress-head"><div><h3>${esc(e.name)}</h3><p>${s.length} Einheiten · zuletzt ${new Date(s[0].workout.date).toLocaleDateString('de-DE')}</p></div><span class="progress-badge ${state}">${label}</span></div><div class="session-compare"><div class="session-row ${state}"><span class="date">Letztes Mal</span><b>${latest?fmt(latest.weight,1)+' kg × '+latest.reps:'–'}</b><span class="arrow">${state==='good'?'↑':state==='bad'?'↓':'→'}</span></div></div></button>`}).join(''):'<p class="note">Sobald du Übungen trainierst, erscheint hier der visuelle Vergleich.</p>';
  $$('[data-progress]').forEach(b=>b.onclick=()=>showProgress(b.dataset.progress));
}
function showProgress(id){
  const e=ex(id),s=sessionsFor(id).slice(0,30);
  openModal(`<h2>${esc(e.name)}</h2><p class="note">Vergleich deiner letzten Einheiten</p><div class="session-compare">${s.map((x,i)=>{const state=compare(x,s[i+1]),best=bestSet(x.exercise);return `<div class="session-row ${state}"><span class="date">${new Date(x.workout.date).toLocaleDateString('de-DE')}</span><b>${best?fmt(best.weight,1)+' kg × '+best.reps:'–'}</b><span class="arrow">${i===s.length-1?'•':state==='good'?'↑':state==='bad'?'↓':'→'}</span></div>`}).join('')}</div>`);
}

function renderSettings(){
  const p=db.weightPlan,g=db.goals;
  $('#startDate').value=p.startDate||dateKey();$('#startWeight').value=p.startWeight??'';$('#maintenanceCalories').value=p.maintenanceCalories??'';$('#plannedCalories').value=p.plannedCalories??'';$('#goalWeight').value=p.goalWeight??'';
  $('#goalProtein').value=g.protein;$('#goalCarbs').value=g.carbs;$('#goalFat').value=g.fat;$('#goalSteps').value=g.steps;$('#defaultRest').value=g.defaultRest;selectedRest=g.defaultRest;showRest(selectedRest);renderWeightSummary();
}
function saveWeightPlan(e){
  e.preventDefault();db.weightPlan={startDate:$('#startDate').value,startWeight:num('#startWeight'),maintenanceCalories:num('#maintenanceCalories'),plannedCalories:num('#plannedCalories'),goalWeight:num('#goalWeight')};saveDB();renderWeightSummary();renderDashboard();renderDayScreen();toast('Gewichtsplan gespeichert');
}
function saveGoals(e){
  e.preventDefault();db.goals={protein:num('#goalProtein')||0,carbs:num('#goalCarbs')||0,fat:num('#goalFat')||0,steps:num('#goalSteps')||0,defaultRest:num('#defaultRest')||90};saveDB();renderAll();toast('Ziele gespeichert');
}
function renderWeightSummary(){
  const p=db.weightPlan,box=$('#weightPlanSummary');
  if(!Number.isFinite(+p.startWeight)||!Number.isFinite(+p.maintenanceCalories)||!Number.isFinite(+p.plannedCalories)){box.innerHTML='<b>Noch unvollständig</b><br>Bitte Startgewicht, Erhaltungskalorien und geplante Kalorien eintragen.';return}
  const deficit=+p.maintenanceCalories-+p.plannedCalories,weekly=deficit*7/7700;let goal='';
  if(Number.isFinite(+p.goalWeight)&&deficit>0){const days=Math.ceil((+p.startWeight-+p.goalWeight)*7700/deficit);if(days>=0){const d=parseDate(p.startDate);d.setDate(d.getDate()+days);goal=`<br>Ziel voraussichtlich am ${d.toLocaleDateString('de-DE')}`}}
  box.innerHTML=`<b>${fmt(deficit)} kcal Defizit pro Tag</b><br>≈ ${fmt(weekly,2)} kg pro Woche${goal}`;
}
function exportData(){const b=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`WesGym-Backup-${dateKey()}.json`;a.click();URL.revokeObjectURL(a.href)}
function importData(e){const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=()=>{try{db=JSON.parse(r.result);saveDB();location.reload()}catch{toast('Ungültige Datei')}};r.readAsText(file)}
