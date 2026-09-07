const KEY='wesgym_simple_2_0';const defaults={plan:{startDate:'',startWeight:null,maintenanceCalories:2600,plannedCalories:1800,goalWeight:null},days:{}};let db=load();const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
document.addEventListener('DOMContentLoaded',()=>{initNav();initActions();renderAll();if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{})});
function clone(x){return JSON.parse(JSON.stringify(x))}function load(){try{const x=JSON.parse(localStorage.getItem(KEY));return x?{...clone(defaults),...x,plan:{...defaults.plan,...(x.plan||{})}}:clone(defaults)}catch{return clone(defaults)}}function save(){localStorage.setItem(KEY,JSON.stringify(db))}function dateKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}function parseDate(k){const[y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d,12)}function fmt(v,d=0){return Number.isFinite(+v)?(+v).toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d}):'–'}function num(id){const v=parseFloat($(id).value);return Number.isFinite(v)?v:null}function toast(t){const x=$('#toast');x.textContent=t;x.classList.remove('hidden');clearTimeout(x._t);x._t=setTimeout(()=>x.classList.add('hidden'),2200)}function openModal(h){$('#modalBody').innerHTML=h;$('#modal').classList.remove('hidden')}function closeModal(){$('#modal').classList.add('hidden')}
function initNav(){$$('.bottom-nav button').forEach(b=>b.onclick=()=>openPage(b.dataset.page))}function openPage(n){$$('.page').forEach(p=>p.classList.toggle('active',p.id===n));$$('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===n));$('#pageTitle').textContent={today:'Heute',history:'Verlauf',plan:'Plan'}[n];if(n==='today')renderToday();if(n==='history')renderHistory();if(n==='plan')renderPlan()}function initActions(){$('#todayForm').onsubmit=saveToday;$('#planForm').onsubmit=savePlan;$('#exportBtn').onclick=exportData;$('#importInput').onchange=importData;$('#resetBtn').onclick=()=>{if(confirm('Alle Daten wirklich löschen?')){localStorage.removeItem(KEY);location.reload()}};$$('[data-close]').forEach(x=>x.onclick=closeModal)}function renderAll(){$('#headerDate').textContent=new Date().toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'});renderToday();renderHistory();renderPlan()}
function expectedWeight(k){const p=db.plan;if(!p.startDate||!Number.isFinite(+p.startWeight)||!Number.isFinite(+p.maintenanceCalories)||!Number.isFinite(+p.plannedCalories))return null;const days=Math.floor((parseDate(k)-parseDate(p.startDate))/86400000);if(days<0)return null;return +p.startWeight-((+p.maintenanceCalories-(+p.plannedCalories))*days/7700)}function actual(k){return db.days[k]||{date:k}}function statusFor(k){const a=actual(k).weight,p=expectedWeight(k);if(!Number.isFinite(+a)||!Number.isFinite(+p))return{className:'neutral',text:'Noch keine Daten'};const diff=+a-+p;if(Math.abs(diff)<=.15)return{className:'mid',text:'Im Plan'};if(diff<0)return{className:'good',text:`${fmt(Math.abs(diff),1)} kg vor dem Plan`};return{className:'bad',text:`${fmt(diff,1)} kg hinter dem Plan`}}
function trendText(k){const end=parseDate(k),entries=[];for(let i=6;i>=0;i--){const d=new Date(end);d.setDate(d.getDate()-i);const dk=dateKey(d),w=actual(dk).weight;if(Number.isFinite(+w))entries.push({date:dk,weight:+w})}if(entries.length<2)return'Noch nicht verfügbar';const change=entries.at(-1).weight-entries[0].weight;if(Math.abs(change)<0.05)return'±0,0 kg';return`${change>0?'+':'−'}${fmt(Math.abs(change),1)} kg`}
function planPrediction(days){const entries=Object.values(db.days).filter(d=>Number.isFinite(+d.weight)).sort((a,b)=>a.date.localeCompare(b.date)),latest=entries.at(-1),base=latest?.weight??db.plan.startWeight;if(!Number.isFinite(+base))return null;const deficit=(+db.plan.maintenanceCalories||0)-(+db.plan.plannedCalories||0);return +base-(deficit*days/7700)}
function actualPrediction(days){const c=Object.values(db.days).filter(d=>Number.isFinite(+d.calories)&&+d.calories>0).sort((a,b)=>a.date.localeCompare(b.date)).slice(-7),w=Object.values(db.days).filter(d=>Number.isFinite(+d.weight)).sort((a,b)=>a.date.localeCompare(b.date)),base=w.at(-1)?.weight??db.plan.startWeight;if(!Number.isFinite(+base)||!c.length)return null;const avg=c.reduce((s,d)=>s+(+d.calories),0)/c.length,def=(+db.plan.maintenanceCalories||0)-avg;return +base-(def*days/7700)}
function renderToday(){const k=dateKey(),a=actual(k),p=expectedWeight(k),s=statusFor(k),def=(+db.plan.maintenanceCalories||0)-(+db.plan.plannedCalories||0);$('#todayCard').innerHTML=`<section class="hero"><div class="hero-top"><div><div><span class="big-weight">${Number.isFinite(+a.weight)?fmt(a.weight,1):'–'}</span> <span class="unit">kg</span></div><div class="plan-status ${s.className}">${s.text}</div></div><div class="hero-side"><span>Soll heute</span><strong>${Number.isFinite(+p)?fmt(p,1)+' kg':'–'}</strong></div></div><div class="stat-grid"><div class="stat"><span>7-Tage-Trend</span><strong>${trendText(k)}</strong><small>in den letzten 7 Tagen</small></div><div class="stat"><span>Defizit geplant</span><strong>${fmt(def)} kcal</strong><small>pro Tag</small></div><div class="stat"><span>Plan in 30 Tagen</span><strong>${planPrediction(30)?fmt(planPrediction(30),1)+' kg':'–'}</strong></div><div class="stat"><span>Aktuelle Prognose</span><strong>${actualPrediction(30)?fmt(actualPrediction(30),1)+' kg':'–'}</strong><small>nach echten Kalorien</small></div></div></section>`;$('#todayWeight').value=a.weight??'';$('#todayCalories').value=a.calories??'';const strip=$('#recentDays');strip.innerHTML='';for(let i=-5;i<=1;i++){const d=new Date();d.setDate(d.getDate()+i);const dk=dateKey(d),st=statusFor(dk),day=actual(dk),plan=expectedWeight(dk),b=document.createElement('button');b.className=`day-mini ${st.className}`;b.innerHTML=`<span>${d.toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'})}</span><strong>${Number.isFinite(+day.weight)?fmt(day.weight,1)+' kg':'–'}</strong><small>${Number.isFinite(+plan)?'Soll '+fmt(plan,1)+' kg':'Kein Plan'}</small>`;b.onclick=()=>editDay(dk);strip.appendChild(b)}}
function saveToday(e){e.preventDefault();const k=dateKey();db.days[k]={...actual(k),date:k,weight:num('#todayWeight'),calories:num('#todayCalories')};save();renderAll();toast('Heute gespeichert')}
function renderHistory(){const all=Object.values(db.days).sort((a,b)=>b.date.localeCompare(a.date));$('#historyList').innerHTML=all.length?all.map(d=>{const st=statusFor(d.date),plan=expectedWeight(d.date);return `<div class="history-card ${st.className}"><div class="history-top"><div><h3>${parseDate(d.date).toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'})}</h3><p>${Number.isFinite(+d.calories)?fmt(d.calories)+' kcal':'Keine Kalorien'}</p></div><span class="history-status ${st.className}">${st.text}</span></div><div class="history-values"><div><span>Soll</span><strong>${Number.isFinite(+plan)?fmt(plan,1)+' kg':'–'}</strong></div><div><span>Ist</span><strong>${Number.isFinite(+d.weight)?fmt(d.weight,1)+' kg':'–'}</strong></div></div><div class="history-actions"><button class="edit-btn" data-edit="${d.date}">Bearbeiten</button><button class="delete-btn" data-delete="${d.date}">Löschen</button></div></div>`}).join(''):'<p>Noch keine Einträge.</p>';$$('[data-edit]').forEach(b=>b.onclick=()=>editDay(b.dataset.edit));$$('[data-delete]').forEach(b=>b.onclick=()=>deleteDay(b.dataset.delete))}
function editDay(k){const d=actual(k),plan=expectedWeight(k);openModal(`<h2>${parseDate(k).toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'})}</h2><p>Sollgewicht: ${Number.isFinite(+plan)?fmt(plan,1)+' kg':'–'}</p><form id="editDayForm" class="form"><label>Gewicht (kg)<input id="editWeight" type="number" step="0.1" value="${d.weight??''}"></label><label>Kalorien<input id="editCalories" type="number" value="${d.calories??''}"></label><button class="primary">Speichern</button></form>`);$('#editDayForm').onsubmit=e=>{e.preventDefault();db.days[k]={date:k,weight:num('#editWeight'),calories:num('#editCalories')};save();closeModal();renderAll();toast('Tag gespeichert')}}function deleteDay(k){if(!confirm('Diesen Tag wirklich löschen?'))return;delete db.days[k];save();renderAll();toast('Tag gelöscht')}
function renderPlan(){const p=db.plan;$('#startDate').value=p.startDate||dateKey();$('#startWeight').value=p.startWeight??'';$('#maintenanceCalories').value=p.maintenanceCalories??'';$('#plannedCalories').value=p.plannedCalories??'';$('#goalWeight').value=p.goalWeight??'';const box=$('#planSummary');if(!Number.isFinite(+p.startWeight)||!p.startDate||!Number.isFinite(+p.maintenanceCalories)||!Number.isFinite(+p.plannedCalories)){box.innerHTML='<div class="summary-item"><span>Status</span><strong>Plan noch nicht vollständig</strong></div>';return}const def=+p.maintenanceCalories-+p.plannedCalories,weekly=def*7/7700;let goal='–';if(Number.isFinite(+p.goalWeight)&&def>0&&+p.goalWeight<+p.startWeight){const days=Math.ceil((+p.startWeight-+p.goalWeight)*7700/def),d=parseDate(p.startDate);d.setDate(d.getDate()+days);goal=d.toLocaleDateString('de-DE')}box.innerHTML=`<div class="summary-item"><span>Defizit pro Tag</span><strong>${fmt(def)} kcal</strong></div><div class="summary-item"><span>Tempo</span><strong>≈ ${fmt(weekly,2)} kg / Woche</strong></div><div class="summary-item"><span>Geplant in 30 Tagen</span><strong>${fmt(+p.startWeight-(def*30/7700),1)} kg</strong></div><div class="summary-item"><span>Zieltermin</span><strong>${goal}</strong></div>`}
function savePlan(e){e.preventDefault();db.plan={startDate:$('#startDate').value,startWeight:num('#startWeight'),maintenanceCalories:num('#maintenanceCalories'),plannedCalories:num('#plannedCalories'),goalWeight:num('#goalWeight')};save();renderAll();toast('Plan gespeichert')}
function exportData(){const b=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`WesGym-Backup-${dateKey()}.json`;a.click();URL.revokeObjectURL(a.href)}function importData(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{db=JSON.parse(r.result);save();location.reload()}catch{toast('Ungültige Datei')}};r.readAsText(f)}
/* Goal-first update 3.0 */
db.gym=db.gym||{weekdays:[],calories:300};

function gymDay(k){return (db.gym.weekdays||[]).includes(parseDate(k).getDay())}
function planDeficitFor(k){return ((+db.plan.maintenanceCalories||0)-(+db.plan.plannedCalories||0))+(gymDay(k)?(+db.gym.calories||0):0)}
function goalDateOriginal(){
  const p=db.plan;
  if(!p.startDate||!Number.isFinite(+p.startWeight)||!Number.isFinite(+p.goalWeight)||+p.goalWeight>=+p.startWeight)return null;
  let k=p.startDate,w=+p.startWeight,guard=0;
  while(w>+p.goalWeight&&guard<2000){w-=planDeficitFor(k)/7700;const d=parseDate(k);d.setDate(d.getDate()+1);k=dateKey(d);guard++}
  return guard<2000?k:null;
}
function accumulatedDeviation(){
  const p=db.plan;if(!p.startDate)return 0;let total=0;
  Object.values(db.days).forEach(d=>{
    if(d.date<p.startDate||d.date>dateKey())return;
    if(Number.isFinite(+d.calories))total+=(+d.calories-(+p.plannedCalories||0));
    if(gymDay(d.date)&&d.gymDone!==true)total+=(+db.gym.calories||0);
  });
  return total;
}
function avgPlannedDeficit(){
  const base=(+db.plan.maintenanceCalories||0)-(+db.plan.plannedCalories||0);
  return base+((db.gym.weekdays||[]).length*(+db.gym.calories||0)/7);
}
function goalDateCurrent(){
  const orig=goalDateOriginal();if(!orig)return null;
  const avg=avgPlannedDeficit();if(avg<=0)return orig;
  const shift=Math.round(accumulatedDeviation()/avg);
  const d=parseDate(orig);d.setDate(d.getDate()+shift);return dateKey(d);
}
function dayShift(){const a=goalDateOriginal(),b=goalDateCurrent();if(!a||!b)return null;return Math.round((parseDate(b)-parseDate(a))/86400000)}
function latestKnownWeight(){const arr=Object.values(db.days).filter(d=>Number.isFinite(+d.weight)).sort((a,b)=>a.date.localeCompare(b.date));return arr.at(-1)?.weight??db.plan.startWeight}
function goalProgress(){const s=+db.plan.startWeight,g=+db.plan.goalWeight,c=+latestKnownWeight();if(!Number.isFinite(s)||!Number.isFinite(g)||!Number.isFinite(c)||s===g)return 0;return Math.max(0,Math.min(100,(s-c)/(s-g)*100))}
function todayCalorieImpact(){
  const d=actual(dateKey()),planned=+db.plan.plannedCalories||0;
  const cal=Number.isFinite(+d.calories)?+d.calories-planned:0;
  const missed=gymDay(dateKey())&&d.gymDone!==true?(+db.gym.calories||0):0;
  return{cal,missed,total:cal+missed};
}
function expectedWeight(k){
  const p=db.plan;if(!p.startDate||!Number.isFinite(+p.startWeight)||parseDate(k)<parseDate(p.startDate))return null;
  let cur=p.startDate,w=+p.startWeight,guard=0;
  while(cur<k&&guard<2000){w-=planDeficitFor(cur)/7700;const d=parseDate(cur);d.setDate(d.getDate()+1);cur=dateKey(d);guard++}
  return w;
}
function renderToday(){
  const k=dateKey(),a=actual(k),p=expectedWeight(k),st=statusFor(k),orig=goalDateOriginal(),cur=goalDateCurrent(),shift=dayShift(),prog=goalProgress(),cw=latestKnownWeight(),remaining=Number.isFinite(+cw)&&Number.isFinite(+db.plan.goalWeight)?Math.max(0,+cw-(+db.plan.goalWeight)):null,impact=todayCalorieImpact();
  $('#todayCard').innerHTML=`<section class="hero"><div class="goal-head"><div><span class="eyebrow">Aktuelles Gewicht</span><div><span class="big-weight">${Number.isFinite(+a.weight)?fmt(a.weight,1):fmt(cw,1)}</span> <span class="unit">kg</span></div><div class="plan-status ${st.className}">${st.text}</div></div><div class="hero-side"><span>Ziel</span><strong>${Number.isFinite(+db.plan.goalWeight)?fmt(db.plan.goalWeight,1)+' kg':'–'}</strong></div></div><div class="goal-progress"><i style="width:${prog}%"></i></div><div class="goal-meta"><span>${fmt(prog)} % geschafft</span><span>${Number.isFinite(+remaining)?fmt(remaining,1)+' kg übrig':'–'}</span></div><div class="goal-dates"><div class="goal-date"><span>Geplanter Zieltermin</span><strong>${orig?parseDate(orig).toLocaleDateString('de-DE'):'–'}</strong></div><div class="goal-date"><span>Aktueller Zieltermin</span><strong>${cur?parseDate(cur).toLocaleDateString('de-DE'):'–'}</strong></div></div><div class="date-shift ${shift===null?'neutral':shift>0?'bad':shift<0?'good':'mid'}">${shift===null?'Noch kein Vergleich':shift>0?`+${shift} Tage später`:shift<0?`${Math.abs(shift)} Tage früher`:'Zieltermin unverändert'}</div><div class="impact-box"><div class="impact ${impact.cal>100?'bad':impact.cal<-100?'good':'mid'}"><span>Essen heute</span><strong>${impact.cal>0?'+':''}${fmt(impact.cal)} kcal</strong><small>gegenüber deinem Plan</small></div><div class="impact ${impact.missed>0?'bad':'good'}"><span>Training heute</span><strong>${gymDay(k)?(a.gymDone===true?'Erledigt':'Noch offen'):'Kein Gym geplant'}</strong><small>${gymDay(k)?`Planwert ${fmt(db.gym.calories)} kcal`:''}</small></div></div><div class="mini-status">Sollgewicht heute: ${Number.isFinite(+p)?fmt(p,1)+' kg':'–'}</div></section>`;
  $('#todayWeight').value=a.weight??'';$('#todayCalories').value=a.calories??'';
  const gw=$('#gymTodayWrap');gw.classList.toggle('hidden',!gymDay(k));if(gymDay(k)){ $('#gymBurnLabel').textContent=`ca. ${fmt(db.gym.calories)} kcal im Plan`;$('#gymDone').checked=a.gymDone===true}
  const strip=$('#recentDays');strip.innerHTML='';
  for(let i=-5;i<=1;i++){const d=new Date();d.setDate(d.getDate()+i);const dk=dateKey(d),x=actual(dk),ss=statusFor(dk),b=document.createElement('button');b.className=`day-mini ${ss.className}`;b.innerHTML=`<span>${d.toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'})}${gymDay(dk)?(x.gymDone===true?' · Gym ✓':' · Gym'):''}</span><strong>${Number.isFinite(+x.weight)?fmt(x.weight,1)+' kg':'–'}</strong><small>${ss.text}</small>`;b.onclick=()=>editDay(dk);strip.appendChild(b)}
}
function saveToday(e){e.preventDefault();const k=dateKey();db.days[k]={...actual(k),date:k,weight:num('#todayWeight'),calories:num('#todayCalories'),gymDone:gymDay(k)?$('#gymDone').checked:null};save();renderAll();toast('Tag gespeichert')}
function renderPlan(){
  const p=db.plan;$('#startDate').value=p.startDate||dateKey();$('#startWeight').value=p.startWeight??'';$('#maintenanceCalories').value=p.maintenanceCalories??'';$('#plannedCalories').value=p.plannedCalories??'';$('#goalWeight').value=p.goalWeight??'';
  $('#gymCalories').value=db.gym.calories??300;
  $('#weekdayPicker').innerHTML=['So','Mo','Di','Mi','Do','Fr','Sa'].map((n,i)=>`<button type="button" class="weekday-btn ${(db.gym.weekdays||[]).includes(i)?'active':''}" data-gym-day="${i}">${n}</button>`).join('');
  $$('[data-gym-day]').forEach(b=>b.onclick=()=>b.classList.toggle('active'));
  renderPlanSummary();
}
function renderPlanSummary(){
  const box=$('#planSummary'),orig=goalDateOriginal(),cur=goalDateCurrent(),shift=dayShift(),base=(+db.plan.maintenanceCalories||0)-(+db.plan.plannedCalories||0),gymAvg=(db.gym.weekdays||[]).length*(+db.gym.calories||0)/7;
  box.innerHTML=`<div class="summary-item"><span>Basisdefizit</span><strong>${fmt(base)} kcal / Tag</strong></div><div class="summary-item"><span>Gym im Wochenschnitt</span><strong>+${fmt(gymAvg)} kcal / Tag</strong></div><div class="summary-item"><span>Geplanter Zieltermin</span><strong>${orig?parseDate(orig).toLocaleDateString('de-DE'):'–'}</strong></div><div class="summary-item"><span>Aktueller Zieltermin</span><strong>${cur?parseDate(cur).toLocaleDateString('de-DE'):'–'}</strong></div><div class="summary-item"><span>Abweichung</span><strong>${shift===null?'–':shift>0?`+${shift} Tage`:shift<0?`${Math.abs(shift)} Tage früher`:'Im Plan'}</strong></div>`;
}
function saveGymPlan(){db.gym.weekdays=$$('[data-gym-day].active').map(b=>+b.dataset.gymDay);db.gym.calories=num('#gymCalories')||0;save();renderAll();toast('Trainingstage gespeichert')}

document.addEventListener('DOMContentLoaded',()=>{$('#saveGymPlan')?.addEventListener('click',saveGymPlan)});


/* Goal 4.0 — theoretical calorie-derived weight */
function calorieModelWeight(k=dateKey()){
  const p=db.plan;
  if(!p.startDate||!Number.isFinite(+p.startWeight)||parseDate(k)<parseDate(p.startDate))return null;
  let cur=p.startDate, energyDeficit=0, guard=0;
  while(cur<=k&&guard<2500){
    const d=actual(cur);
    const eaten=Number.isFinite(+d.calories)?+d.calories:(+p.plannedCalories||0);
    const gymBurn=gymDay(cur)&&d.gymDone===true?(+db.gym.calories||0):0;
    energyDeficit+=(+p.maintenanceCalories||0)-eaten+gymBurn;
    const next=parseDate(cur);next.setDate(next.getDate()+1);cur=dateKey(next);guard++;
  }
  return +p.startWeight-energyDeficit/7700;
}
function calorieModelStats(k=dateKey()){
  const p=db.plan;
  if(!p.startDate)return{logged:0,missing:0,total:0};
  let cur=p.startDate,logged=0,missing=0,total=0,guard=0;
  while(cur<=k&&guard<2500){
    total++;
    if(Number.isFinite(+actual(cur).calories))logged++;else missing++;
    const next=parseDate(cur);next.setDate(next.getDate()+1);cur=dateKey(next);guard++;
  }
  return{logged,missing,total};
}
function calorieVsPlanStatus(k=dateKey()){
  const c=calorieModelWeight(k),p=expectedWeight(k);
  if(!Number.isFinite(+c)||!Number.isFinite(+p))return{className:'neutral',text:'Noch keine Berechnung',diff:null};
  const diff=+c-+p;
  if(Math.abs(diff)<=.05)return{className:'mid',text:'Kalorienmodell genau im Plan',diff};
  if(diff<0)return{className:'good',text:`Kalorienmodell ${fmt(Math.abs(diff),1)} kg vor dem Plan`,diff};
  return{className:'bad',text:`Kalorienmodell ${fmt(diff,1)} kg hinter dem Plan`,diff};
}
function scaleVsCalorieText(k=dateKey()){
  const scale=actual(k).weight,model=calorieModelWeight(k);
  if(!Number.isFinite(+scale)||!Number.isFinite(+model))return'Differenz noch nicht verfügbar';
  const diff=+scale-+model;
  if(Math.abs(diff)<.05)return'Waage und Kalorienmodell liegen gleich';
  return`Waage ${diff>0?fmt(diff,1)+' kg höher':fmt(Math.abs(diff),1)+' kg niedriger'} als das Kalorienmodell`;
}
function calorieProgress(){
  const s=+db.plan.startWeight,g=+db.plan.goalWeight,c=+calorieModelWeight(dateKey());
  if(!Number.isFinite(s)||!Number.isFinite(g)||!Number.isFinite(c)||s===g)return 0;
  return Math.max(0,Math.min(100,(s-c)/(s-g)*100));
}

renderToday=function(){
  const k=dateKey(),a=actual(k),planW=expectedWeight(k),scaleStatus=statusFor(k),
        orig=goalDateOriginal(),cur=goalDateCurrent(),shift=dayShift(),
        modelW=calorieModelWeight(k),modelStatus=calorieVsPlanStatus(k),
        prog=calorieProgress(),remaining=Number.isFinite(+modelW)&&Number.isFinite(+db.plan.goalWeight)?Math.max(0,+modelW-(+db.plan.goalWeight)):null,
        impact=todayCalorieImpact(),coverage=calorieModelStats(k);

  $('#todayCard').innerHTML=`<section class="hero">
    <div class="goal-head">
      <div>
        <span class="eyebrow">Kaloriengewicht · theoretisch</span>
        <div><span class="big-weight">${Number.isFinite(+modelW)?fmt(modelW,1):'–'}</span> <span class="unit">kg</span></div>
        <div class="plan-status ${modelStatus.className}">${modelStatus.text}</div>
      </div>
      <div class="hero-side"><span>Ziel</span><strong>${Number.isFinite(+db.plan.goalWeight)?fmt(db.plan.goalWeight,1)+' kg':'–'}</strong></div>
    </div>

    <div class="goal-progress"><i style="width:${prog}%"></i></div>
    <div class="goal-meta"><span>${fmt(prog)} % theoretisch geschafft</span><span>${Number.isFinite(+remaining)?fmt(remaining,1)+' kg bis Ziel':'–'}</span></div>

    <div class="weight-trio">
      <div class="weight-tile plan"><span>Soll laut Plan</span><strong>${Number.isFinite(+planW)?fmt(planW,1)+' kg':'–'}</strong><small>bei geplanten Kalorien</small></div>
      <div class="weight-tile model"><span>Nach Kalorien</span><strong>${Number.isFinite(+modelW)?fmt(modelW,1)+' kg':'–'}</strong><small>Energiebilanz-Modell</small></div>
      <div class="weight-tile scale"><span>Waage</span><strong>${Number.isFinite(+a.weight)?fmt(a.weight,1)+' kg':'–'}</strong><small>${scaleVsCalorieText(k)}</small></div>
    </div>

    <div class="goal-dates">
      <div class="goal-date"><span>Geplanter Zieltermin</span><strong>${orig?parseDate(orig).toLocaleDateString('de-DE'):'–'}</strong></div>
      <div class="goal-date"><span>Aktueller Zieltermin</span><strong>${cur?parseDate(cur).toLocaleDateString('de-DE'):'–'}</strong></div>
    </div>
    <div class="date-shift ${shift===null?'neutral':shift>0?'bad':shift<0?'good':'mid'}">${shift===null?'Noch kein Vergleich':shift>0?`+${shift} Tage später`:shift<0?`${Math.abs(shift)} Tage früher`:'Zieltermin unverändert'}</div>

    <div class="impact-box">
      <div class="impact ${impact.cal>100?'bad':impact.cal<-100?'good':'mid'}"><span>Essen heute</span><strong>${impact.cal>0?'+':''}${fmt(impact.cal)} kcal</strong><small>gegenüber deinem Plan</small></div>
      <div class="impact ${impact.missed>0?'bad':'good'}"><span>Training heute</span><strong>${gymDay(k)?(a.gymDone===true?'Erledigt':'Noch offen'):'Kein Gym geplant'}</strong><small>${gymDay(k)?`Planwert ${fmt(db.gym.calories)} kcal`:''}</small></div>
    </div>

    <div class="model-note">
      <b>${scaleVsCalorieText(k)}</b>
      <span>Das Kaloriengewicht ist ein theoretisches Energiebilanz-Modell. Die Waage kann durch Wasser, Salz, Glykogen und Magen-/Darminhalt abweichen.</span>
      <small>${coverage.logged} von ${coverage.total} Tagen mit echten Kalorienwerten${coverage.missing?` · ${coverage.missing} fehlende Tage wurden mit Plan-Kalorien gerechnet`:''}</small>
    </div>
  </section>`;

  $('#todayWeight').value=a.weight??'';
  $('#todayCalories').value=a.calories??'';

  const gw=$('#gymTodayWrap');
  gw.classList.toggle('hidden',!gymDay(k));
  if(gymDay(k)){
    $('#gymBurnLabel').textContent=`ca. ${fmt(db.gym.calories)} kcal im Plan`;
    $('#gymDone').checked=a.gymDone===true;
  }

  const strip=$('#recentDays');strip.innerHTML='';
  for(let i=-5;i<=1;i++){
    const d=new Date();d.setDate(d.getDate()+i);
    const dk=dateKey(d),x=actual(dk),ss=statusFor(dk),cm=calorieModelWeight(dk),b=document.createElement('button');
    b.className=`day-mini ${ss.className}`;
    b.innerHTML=`<span>${d.toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'})}${gymDay(dk)?(x.gymDone===true?' · Gym ✓':' · Gym'):''}</span><strong>${Number.isFinite(+cm)?fmt(cm,1)+' kg':'–'}</strong><small>Kaloriengewicht · Waage ${Number.isFinite(+x.weight)?fmt(x.weight,1):'–'}</small>`;
    b.onclick=()=>editDay(dk);
    strip.appendChild(b);
  }
};

renderHistory=function(){
  const all=Object.values(db.days).sort((a,b)=>b.date.localeCompare(a.date));
  $('#historyList').innerHTML=all.length?all.map(d=>{
    const st=statusFor(d.date),plan=expectedWeight(d.date),model=calorieModelWeight(d.date),gym=gymDay(d.date);
    return `<div class="history-card ${st.className}">
      <div class="history-top"><div><h3>${parseDate(d.date).toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'})}</h3><p>${Number.isFinite(+d.calories)?fmt(d.calories)+' kcal':'Keine Kalorien'}${gym?` · Gym ${d.gymDone===true?'✓':'✕'}`:''}</p></div><span class="history-status ${st.className}">${st.text}</span></div>
      <div class="history-values history-three">
        <div><span>Soll</span><strong>${Number.isFinite(+plan)?fmt(plan,1)+' kg':'–'}</strong></div>
        <div><span>Kaloriengewicht</span><strong>${Number.isFinite(+model)?fmt(model,1)+' kg':'–'}</strong></div>
        <div><span>Waage</span><strong>${Number.isFinite(+d.weight)?fmt(d.weight,1)+' kg':'–'}</strong></div>
      </div>
      <div class="history-actions"><button class="edit-btn" data-edit="${d.date}">Bearbeiten</button><button class="delete-btn" data-delete="${d.date}">Löschen</button></div>
    </div>`;
  }).join(''):'<p>Noch keine Einträge.</p>';
  $$('[data-edit]').forEach(b=>b.onclick=()=>editDay(b.dataset.edit));
  $$('[data-delete]').forEach(b=>b.onclick=()=>deleteDay(b.dataset.delete));
};


/* Goal 4.1 — dynamic time progress */
function totalDaysBetween(a,b){
  if(!a||!b)return null;
  return Math.max(0,Math.round((parseDate(b)-parseDate(a))/86400000));
}
function elapsedPlanDays(){
  const s=db.plan.startDate;
  if(!s)return null;
  return Math.max(0,totalDaysBetween(s,dateKey()));
}
function dynamicTimeProgress(){
  const s=db.plan.startDate, currentTarget=goalDateCurrent();
  if(!s||!currentTarget)return{pct:0,elapsed:null,total:null,remaining:null};
  const elapsed=Math.max(0,totalDaysBetween(s,dateKey()));
  const total=Math.max(1,totalDaysBetween(s,currentTarget));
  const remaining=Math.max(0,totalDaysBetween(dateKey(),currentTarget));
  const pct=Math.max(0,Math.min(100,(elapsed/total)*100));
  return{pct,elapsed,total,remaining};
}
function plannedTimeProgress(){
  const s=db.plan.startDate, plannedTarget=goalDateOriginal();
  if(!s||!plannedTarget)return{pct:0,elapsed:null,total:null,remaining:null};
  const elapsed=Math.max(0,totalDaysBetween(s,dateKey()));
  const total=Math.max(1,totalDaysBetween(s,plannedTarget));
  const remaining=Math.max(0,totalDaysBetween(dateKey(),plannedTarget));
  const pct=Math.max(0,Math.min(100,(elapsed/total)*100));
  return{pct,elapsed,total,remaining};
}

/* Wrap the existing renderToday to add time-progress visualization */
const _renderToday_40 = renderToday;
renderToday=function(){
  _renderToday_40();

  const hero=$('#todayCard .hero');
  if(!hero)return;

  const currentTP=dynamicTimeProgress();
  const plannedTP=plannedTimeProgress();
  const shift=dayShift();

  const timeBlock=document.createElement('div');
  timeBlock.className='time-progress-block';
  timeBlock.innerHTML=`
    <div class="time-progress-head">
      <div>
        <span class="eyebrow">Zeitfortschritt bis zum Ziel</span>
        <strong>${currentTP.remaining===null?'–':currentTP.remaining+' Tage übrig'}</strong>
      </div>
      <span class="time-percent">${fmt(currentTP.pct)} %</span>
    </div>
    <div class="time-progress-track"><i style="width:${currentTP.pct}%"></i></div>
    <div class="time-progress-meta">
      <span>${currentTP.elapsed===null?'–':currentTP.elapsed+' Tage geschafft'}</span>
      <span>${currentTP.total===null?'–':currentTP.total+' Tage Gesamtstrecke'}</span>
    </div>
    <div class="time-compare-grid">
      <div class="time-mini">
        <span>Originaler Plan</span>
        <strong>${plannedTP.remaining===null?'–':plannedTP.remaining+' Tage'}</strong>
        <small>${fmt(plannedTP.pct)} % Zeitfortschritt</small>
      </div>
      <div class="time-mini current ${shift>0?'bad':shift<0?'good':'mid'}">
        <span>Aktuelle Prognose</span>
        <strong>${currentTP.remaining===null?'–':currentTP.remaining+' Tage'}</strong>
        <small>${shift===null?'Noch kein Vergleich':shift>0?`+${shift} Tage später`:shift<0?`${Math.abs(shift)} Tage früher`:'Im Zeitplan'}</small>
      </div>
    </div>
    <p class="time-explain">Dieser Fortschritt reagiert auf deine echte Kalorienbilanz und den aktuellen prognostizierten Zieltermin. Wenn sich dein Zieltermin nach hinten verschiebt, kann die Prozentzahl sinken; wenn du Zeit aufholst, steigt sie schneller.</p>
  `;

  const goalDates=hero.querySelector('.goal-dates');
  if(goalDates) goalDates.before(timeBlock);
  else hero.appendChild(timeBlock);
};


/* Goal 4.2 — add practical scale progress line */
function actualScaleWeightForProgress(){
  const todayW = actual(dateKey()).weight;
  if(Number.isFinite(+todayW)) return +todayW;
  const arr = Object.values(db.days).filter(d=>Number.isFinite(+d.weight)).sort((a,b)=>a.date.localeCompare(b.date));
  return Number.isFinite(+arr.at(-1)?.weight) ? +arr.at(-1).weight : null;
}
function actualScaleProgress(){
  const s=+db.plan.startWeight,g=+db.plan.goalWeight,w=actualScaleWeightForProgress();
  if(!Number.isFinite(s)||!Number.isFinite(g)||!Number.isFinite(w)||s===g){
    return {pct:0,lost:null,total:null,remaining:null,weight:null};
  }
  const lost = s - w;
  const total = s - g;
  const remaining = Math.max(0, w - g);
  const pct = Math.max(0, Math.min(100, (lost/total)*100));
  return {pct,lost,total,remaining,weight:w};
}

const _renderToday_41 = renderToday;
renderToday = function(){
  _renderToday_41();

  const hero = $('#todayCard .hero');
  if(!hero) return;

  const scale = actualScaleProgress();
  const goalMeta = hero.querySelector('.goal-meta');
  if(!goalMeta) return;

  const block = document.createElement('div');
  block.className = 'scale-progress-block';
  block.innerHTML = `
    <div class="scale-progress-head">
      <div>
        <span class="eyebrow">Fortschritt laut Waage</span>
        <strong>${Number.isFinite(+scale.weight) ? fmt(scale.weight,1)+' kg aktuell' : 'Noch kein Waagenwert'}</strong>
      </div>
      <span class="scale-percent">${fmt(scale.pct)} %</span>
    </div>
    <div class="scale-progress-track"><i style="width:${scale.pct}%"></i></div>
    <div class="scale-progress-meta">
      <span>${scale.lost===null ? '–' : fmt(scale.lost,1)+' kg geschafft'}</span>
      <span>${scale.remaining===null ? '–' : fmt(scale.remaining,1)+' kg bis Ziel'}</span>
    </div>
  `;

  const existing = hero.querySelector('.scale-progress-block');
  if(existing) existing.remove();
  goalMeta.after(block);
};
