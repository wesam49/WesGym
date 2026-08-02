
/* WesGym Update 2 — daily planning, date navigation, exercise management and visual progress */
(() => {
  let selectedDate = new Date();
  let selectedMode = 'actual';

  function iso(d = selectedDate) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function fromIso(k){ const [y,m,d]=k.split('-').map(Number); return new Date(y,m-1,d,12); }
  function shiftDate(days){ selectedDate.setDate(selectedDate.getDate()+days); renderDayExperience(); }
  function isFuture(k){ return fromIso(k) > fromIso(key()); }
  function ensureStructures(){
    db.dayPlans = db.dayPlans || {};
    db.days = db.days || {};
    db.customExercises = db.customExercises || [];
    db.workouts = db.workouts || [];
  }
  function planFor(k){
    return db.dayPlans[k] || {
      date:k,
      weight:null,
      calories:db.settings.goalCalories,
      protein:db.settings.goalProtein,
      carbs:db.settings.goalCarbs,
      fat:db.settings.goalFat,
      steps:db.settings.goalSteps,
      gym:false,
      workoutName:''
    };
  }
  function actualFor(k){ return db.days[k] || {date:k}; }

  function classify(metric, actual, planned){
    if(actual===null || actual===undefined || actual==='' || !Number.isFinite(+actual)) return 'neutral';
    actual=+actual; planned=+planned;
    if(!Number.isFinite(planned) || planned===0) return 'neutral';
    if(metric==='weight'){
      const diff=actual-planned;
      if(diff<=.2) return 'good';
      if(diff<=.6) return 'mid';
      return 'bad';
    }
    if(metric==='calories'){
      const ratio=actual/planned;
      if(ratio>=.85 && ratio<=1.05) return 'good';
      if(ratio>=.7 && ratio<=1.15) return 'mid';
      return 'bad';
    }
    if(metric==='protein' || metric==='steps'){
      const ratio=actual/planned;
      if(ratio>=1) return 'good';
      if(ratio>=.85) return 'mid';
      return 'bad';
    }
    return 'neutral';
  }
  function stateIcon(c){ return c==='good'?'↑':c==='bad'?'↓':'•'; }
  function scoreFor(k){
    const p=planFor(k), a=actualFor(k);
    const values=[
      classify('weight',a.weight,p.weight),
      classify('calories',a.calories,p.calories),
      classify('protein',a.protein,p.protein),
      classify('steps',a.steps,p.steps)
    ].filter(x=>x!=='neutral');
    if(p.gym){
      const trained=db.workouts.some(w=>key(new Date(w.date))===k);
      values.push(trained?'good':'bad');
    }
    if(!values.length) return null;
    const points={good:100,mid:70,bad:25};
    return Math.round(values.reduce((s,x)=>s+points[x],0)/values.length);
  }
  function scoreClass(score){ return score===null?'empty':score>=85?'good':score>=60?'mid':'bad'; }

  function mountDashboard(){
    const dash=document.querySelector('#dashboard');
    if(!dash) return;
    dash.innerHTML=`
      <div class="daily-hero" id="dashboardToday"></div>
      <div class="card">
        <div class="head"><div><h2>Deine Tage</h2><p>Plan und Ist auf einen Blick</p></div><button class="small" id="openTodayEditor">Heute öffnen</button></div>
        <div class="dashboard-date-row" id="dashboardDateRow"></div>
      </div>
      <div class="card">
        <div class="head"><div><h2>Gewichtsprognose</h2><p>Auf Basis deiner echten Einträge</p></div></div>
        <div class="prediction"><div><span>Realer Trend</span><b id="realPred">–</b><small>in 30 Tagen</small></div><div><span>Kalorienmodell</span><b id="theoryPred">–</b><small>in 30 Tagen</small></div></div>
        <p id="predText" class="note"></p>
      </div>`;
    document.querySelector('#openTodayEditor').onclick=()=>{
      selectedDate=new Date();
      openPage('diary');
      renderDayExperience();
    };
  }

  function dashboardMetric(label, actual, planned, metric, suffix=''){
    const c=classify(metric,actual,planned);
    return `<div class="compare-card ${c}"><span class="state">${stateIcon(c)}</span><div class="label">${label}</div><div class="value">${actual??'–'}${suffix}</div><div class="sub">Plan ${planned??'–'}${suffix}</div></div>`;
  }

  function renderDashboardV2(){
    const k=key(), p=planFor(k),a=actualFor(k),score=scoreFor(k);
    const workoutsToday=db.workouts.filter(w=>key(new Date(w.date))===k);
    const hero=document.querySelector('#dashboardToday');
    if(hero){
      hero.innerHTML=`
        <div class="daily-hero-top">
          <div><p>${new Date().toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'})}</p><h2>Heute</h2></div>
          <div class="score-ring" style="--score:${score??0}%"><div><b>${score??'–'}${score!==null?'%':''}</b><small>Tages-Score</small></div></div>
        </div>
        <div class="metric-cards">
          ${dashboardMetric('Gewicht',a.weight,p.weight,'weight',' kg')}
          ${dashboardMetric('Kalorien',a.calories,p.calories,'calories','')}
          ${dashboardMetric('Protein',a.protein,p.protein,'protein',' g')}
          ${dashboardMetric('Schritte',a.steps,p.steps,'steps','')}
          <div class="compare-card ${p.gym?(workoutsToday.length?'good':'bad'):'neutral'}"><span class="state">${p.gym?(workoutsToday.length?'✓':'!'):'•'}</span><div class="label">Training</div><div class="value">${workoutsToday.length?'Erledigt':p.gym?'Geplant':'Ruhetag'}</div><div class="sub">${p.workoutName||''}</div></div>
        </div>`;
    }
    const row=document.querySelector('#dashboardDateRow');
    if(row){
      row.innerHTML='';
      for(let i=-3;i<=3;i++){
        const d=new Date();d.setDate(d.getDate()+i);const dk=key(d),sc=scoreFor(dk),cl=scoreClass(sc);
        const card=document.createElement('button');
        card.className=`dashboard-mini-day ${cl}`;
        card.innerHTML=`<span>${d.toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'})}</span><strong>${sc??'–'}${sc!==null?'%':''}</strong><b>${actualFor(dk).weight?f(actualFor(dk).weight,1)+' kg':'Keine Daten'}</b>`;
        card.onclick=()=>{selectedDate=d;openPage('diary');renderDayExperience()};
        row.appendChild(card);
      }
    }
    predictions(sortedDays().filter(x=>x.weight));
  }

  function mountDiary(){
    const host=document.querySelector('#diary');
    if(!host) return;
    host.innerHTML=`<div id="dayExperience" class="day-shell"></div>`;
    renderDayExperience();
  }

  function renderDayExperience(){
    const host=document.querySelector('#dayExperience');
    if(!host)return;
    const k=iso(),p=planFor(k),a=actualFor(k),score=scoreFor(k);
    host.innerHTML=`
      <div class="day-nav-card">
        <div class="day-nav-head">
          <button id="previousDay">‹</button>
          <div class="day-date"><b>${selectedDate.toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'})}</b><span>${k===key()?'Heute':isFuture(k)?'Geplant':'Vergangener Tag'}</span></div>
          <button id="nextDay">›</button>
        </div>
        <div class="day-strip" id="dayStrip"></div>
      </div>
      <div class="plan-actual-toggle"><button data-mode="plan" class="${selectedMode==='plan'?'active':''}">Geplant</button><button data-mode="actual" class="${selectedMode==='actual'?'active':''}">Tatsächlich</button></div>
      <div class="daily-hero">
        <div class="daily-hero-top"><div><p>${selectedMode==='plan'?'Dein Tagesplan':'Plan vs. tatsächliche Werte'}</p><h2>${selectedMode==='plan'?'Geplant':'Tagesergebnis'}</h2></div>
        <div class="score-ring" style="--score:${score??0}%"><div><b>${score??'–'}${score!==null?'%':''}</b><small>Score</small></div></div></div>
        <div class="metric-cards">
          ${dashboardMetric('Gewicht',selectedMode==='plan'?p.weight:a.weight,p.weight,'weight',' kg')}
          ${dashboardMetric('Kalorien',selectedMode==='plan'?p.calories:a.calories,p.calories,'calories','')}
          ${dashboardMetric('Protein',selectedMode==='plan'?p.protein:a.protein,p.protein,'protein',' g')}
          ${dashboardMetric('Schritte',selectedMode==='plan'?p.steps:a.steps,p.steps,'steps','')}
        </div>
      </div>
      <div class="day-form-card">
        <h3>${selectedMode==='plan'?'Plan bearbeiten':'Tatsächliche Werte'}</h3>
        <p>${selectedMode==='plan'?'Du kannst auch zukünftige Tage planen.':'Vergangene und heutige Werte können jederzeit korrigiert werden.'}</p>
        <form id="v2DayForm" class="day-editor">
          <label>Gewicht (kg)<input id="v2Weight" type="number" step="0.1" value="${valueOf(selectedMode==='plan'?p.weight:a.weight)}"></label>
          <label>Kalorien<input id="v2Calories" type="number" value="${valueOf(selectedMode==='plan'?p.calories:a.calories)}"></label>
          <label>Protein (g)<input id="v2Protein" type="number" value="${valueOf(selectedMode==='plan'?p.protein:a.protein)}"></label>
          <label>Kohlenhydrate (g)<input id="v2Carbs" type="number" value="${valueOf(selectedMode==='plan'?p.carbs:a.carbs)}"></label>
          <label>Fett (g)<input id="v2Fat" type="number" value="${valueOf(selectedMode==='plan'?p.fat:a.fat)}"></label>
          <label>Schritte<input id="v2Steps" type="number" value="${valueOf(selectedMode==='plan'?p.steps:a.steps)}"></label>
          ${selectedMode==='plan'?`<label class="full gym-switch"><span>Gym geplant</span><input id="v2Gym" class="switch" type="checkbox" ${p.gym?'checked':''}></label><label class="full">Trainingstag / Notiz<input id="v2WorkoutName" value="${escapeHtml(p.workoutName||'')}"></label>`:''}
          <button class="save-day" type="submit">Speichern</button>
          <button class="delete-day" id="deleteSelectedDay" type="button">Daten dieses Tages löschen</button>
        </form>
      </div>`;
    document.querySelector('#previousDay').onclick=()=>shiftDate(-1);
    document.querySelector('#nextDay').onclick=()=>shiftDate(1);
    document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{selectedMode=b.dataset.mode;renderDayExperience()});
    renderDayStrip();
    document.querySelector('#v2DayForm').onsubmit=saveSelectedDay;
    document.querySelector('#deleteSelectedDay').onclick=deleteSelectedDay;
  }
  function valueOf(v){ return v===null||v===undefined?'':v; }
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }

  function renderDayStrip(){
    const strip=document.querySelector('#dayStrip');if(!strip)return;
    for(let i=-3;i<=3;i++){
      const d=new Date(selectedDate);d.setDate(d.getDate()+i);const k=key(d),sc=scoreFor(k);
      const b=document.createElement('button');b.className=`day-chip ${i===0?'selected':''} status-${scoreClass(sc)}`;
      b.innerHTML=`<span>${d.toLocaleDateString('de-DE',{weekday:'short'})}</span><b>${d.getDate()}</b><small>${sc===null?'–':sc+'%'}</small>`;
      b.onclick=()=>{selectedDate=d;renderDayExperience()};strip.appendChild(b);
    }
  }

  function readField(id){ const v=parseFloat(document.querySelector(id).value); return Number.isFinite(v)?v:null; }
  function saveSelectedDay(e){
    e.preventDefault();const k=iso();
    const payload={date:k,weight:readField('#v2Weight'),calories:readField('#v2Calories'),protein:readField('#v2Protein'),carbs:readField('#v2Carbs'),fat:readField('#v2Fat'),steps:readField('#v2Steps')};
    if(selectedMode==='plan'){
      db.dayPlans[k]={...planFor(k),...payload,gym:document.querySelector('#v2Gym').checked,workoutName:document.querySelector('#v2WorkoutName').value.trim()};
    }else{
      db.days[k]={...actualFor(k),...payload};
    }
    save();toast('Tag gespeichert');renderDayExperience();renderDashboardV2();
  }
  function deleteSelectedDay(){
    if(!confirm('Daten dieses Tages wirklich löschen?'))return;
    const k=iso();
    if(selectedMode==='plan')delete db.dayPlans[k];else delete db.days[k];
    save();renderDayExperience();renderDashboardV2();toast('Tagesdaten gelöscht');
  }

  function customOnlyLibrary(){ library=[...(db.customExercises||[])]; }

  function renderExercisesV2(){
    customOnlyLibrary();
    const q=(document.querySelector('#exerciseSearch')?.value||'').toLowerCase();
    const grid=document.querySelector('#exerciseGrid');const filters=document.querySelector('#filters');
    if(!grid||!filters)return;
    filters.innerHTML='';
    grid.innerHTML=library.length?library.filter(e=>e.name.toLowerCase().includes(q)||e.muscle.toLowerCase().includes(q)).map(e=>`
      <div class="exerciseCard">
        <div class="exerciseVisual">${e.icon||'🏋️'}</div>
        <div class="exerciseBody"><h3>${escapeHtml(e.name)}</h3><p>${escapeHtml(e.muscle)} · ${escapeHtml(e.equipment)}</p>
          <div class="exercise-manage-actions"><button class="exercise-edit" data-edit-ex="${e.id}">Bearbeiten</button><button class="exercise-delete" data-delete-ex="${e.id}">Löschen</button></div>
        </div>
      </div>`).join(''):'<p class="note">Noch keine Übungen. Füge deine erste eigene Übung hinzu.</p>';
    document.querySelectorAll('[data-edit-ex]').forEach(b=>b.onclick=()=>editExercise(b.dataset.editEx));
    document.querySelectorAll('[data-delete-ex]').forEach(b=>b.onclick=()=>deleteExercise(b.dataset.deleteEx));
  }

  function editExercise(id){
    const x=db.customExercises.find(e=>e.id===id);if(!x)return;
    openModal(`<h2>Übung bearbeiten</h2><form id="editExForm" class="form"><label class="full">Name<input id="eeName" value="${escapeHtml(x.name)}" required></label><label>Muskelgruppe<input id="eeMuscle" value="${escapeHtml(x.muscle)}" required></label><label>Gerät<input id="eeEquipment" value="${escapeHtml(x.equipment)}" required></label><label class="full">Symbol<input id="eeIcon" value="${escapeHtml(x.icon||'🏋️')}"></label><button class="primary full">Speichern</button></form>`);
    document.querySelector('#editExForm').onsubmit=e=>{e.preventDefault();Object.assign(x,{name:document.querySelector('#eeName').value.trim(),muscle:document.querySelector('#eeMuscle').value.trim(),equipment:document.querySelector('#eeEquipment').value.trim(),icon:document.querySelector('#eeIcon').value||'🏋️'});save();customOnlyLibrary();closeModal();renderExercisesV2();renderGym();toast('Übung geändert')};
  }
  function deleteExercise(id){
    const used=(db.plans||[]).some(p=>p.exercises.some(e=>e.id===id));
    const message=used?'Diese Übung wird in einem Trainingsplan verwendet. Aus der Bibliothek und allen Plänen löschen?':'Übung wirklich löschen?';
    if(!confirm(message))return;
    db.customExercises=db.customExercises.filter(e=>e.id!==id);
    db.plans=(db.plans||[]).map(p=>({...p,exercises:p.exercises.filter(e=>e.id!==id)}));
    save();customOnlyLibrary();renderExercisesV2();renderGym();toast('Übung gelöscht');
  }

  function workoutSetsCount(w){return w.exercises.reduce((s,e)=>s+e.sets.filter(x=>x.done).length,0)}
  function workoutPRCount(w){
    let count=0;
    w.exercises.forEach(e=>{
      const before=db.workouts.filter(x=>new Date(x.date)<new Date(w.date)).flatMap(x=>x.exercises.filter(y=>y.id===e.id).flatMap(y=>y.sets.filter(s=>s.done).map(s=>(s.weight||0)*(1+(s.reps||0)/30))));
      const old=Math.max(0,...before);
      const now=Math.max(0,...e.sets.filter(s=>s.done).map(s=>(s.weight||0)*(1+(s.reps||0)/30)));
      if(now>old&&now>0)count++;
    });
    return count;
  }
  function renderWorkoutHistoryV2(){
    const host=document.querySelector('#workoutHistory');if(!host)return;
    host.innerHTML=db.workouts.length?[...db.workouts].reverse().map(w=>`
      <div class="workout-history-card">
        <div><h3>${escapeHtml(w.name)}</h3><p>${new Date(w.date).toLocaleDateString('de-DE')} · ${Math.round((w.duration||0)/60)} Min. · ${w.exercises.length} Übungen · ${workoutSetsCount(w)} Sätze${workoutPRCount(w)?' · '+workoutPRCount(w)+' PR':''}</p></div>
        <div class="history-actions"><button class="details-btn" data-workout-details="${w.id}">Details</button><button class="delete-workout-btn" data-delete-workout="${w.id}">Löschen</button></div>
      </div>`).join(''):'<p class="note">Noch keine Trainings.</p>';
    document.querySelectorAll('[data-delete-workout]').forEach(b=>b.onclick=()=>{if(confirm('Dieses Training wirklich löschen?')){db.workouts=db.workouts.filter(w=>w.id!==b.dataset.deleteWorkout);save();renderWorkoutHistoryV2();renderProgressPage();renderDashboardV2();toast('Training gelöscht')}});
    document.querySelectorAll('[data-workout-details]').forEach(b=>b.onclick=()=>showWorkoutDetails(b.dataset.workoutDetails));
  }
  function showWorkoutDetails(id){
    const w=db.workouts.find(x=>x.id===id);if(!w)return;
    openModal(`<h2>${escapeHtml(w.name)}</h2><p class="note">${new Date(w.date).toLocaleString('de-DE')} · ${Math.round((w.duration||0)/60)} Min.</p>${w.exercises.map(e=>`<div class="reportBox"><b>${escapeHtml(ex(e.id).name)}</b><br>${e.sets.filter(s=>s.done).map((s,i)=>`Satz ${i+1}: ${f(s.weight,1)} kg × ${s.reps}`).join('<br>')||'Keine abgeschlossenen Sätze'}</div>`).join('')}`);
  }

  function bestSet(exerciseEntry){
    return exerciseEntry.sets.filter(s=>s.done).sort((a,b)=>((b.weight||0)*(1+(b.reps||0)/30))-((a.weight||0)*(1+(a.reps||0)/30)))[0]||null;
  }
  function sessionsForExercise(id){
    return db.workouts.filter(w=>w.exercises.some(e=>e.id===id)).map(w=>({workout:w,exercise:w.exercises.find(e=>e.id===id)})).sort((a,b)=>new Date(b.workout.date)-new Date(a.workout.date));
  }
  function compareSession(current,previous){
    if(!current||!previous)return 'mid';
    const c=bestSet(current.exercise),p=bestSet(previous.exercise);if(!c||!p)return 'mid';
    const cs=(c.weight||0)*(1+(c.reps||0)/30),ps=(p.weight||0)*(1+(p.reps||0)/30);
    if(cs>ps*1.015)return 'good';
    if(cs<ps*.985)return 'bad';
    return 'mid';
  }
  function renderProgressPage(){
    const reports=document.querySelector('#reports');if(!reports)return;
    customOnlyLibrary();
    reports.innerHTML=`<div class="card"><div class="head"><div><h2>Übungsfortschritt</h2><p>Grün = besser, Rot = schwächer, Grau = stabil</p></div></div><div id="exerciseProgressList" class="progress-list"></div></div>`;
    const list=document.querySelector('#exerciseProgressList');
    const used=library.filter(e=>sessionsForExercise(e.id).length);
    list.innerHTML=used.length?used.map(e=>{
      const sessions=sessionsForExercise(e.id),state=compareSession(sessions[0],sessions[1]),latest=bestSet(sessions[0].exercise);
      const labels={good:'Fortschritt',bad:'Rückgang',mid:'Stabil'};
      return `<button class="progress-card" data-progress-ex="${e.id}" style="text-align:left;width:100%">
        <div class="progress-head"><div><h3>${escapeHtml(e.name)}</h3><p>${sessions.length} Einheiten · zuletzt ${new Date(sessions[0].workout.date).toLocaleDateString('de-DE')}</p></div><span class="progress-badge ${state}">${labels[state]}</span></div>
        <div class="session-compare"><div class="session-row ${state}"><span class="date">Letztes Mal</span><b>${latest?f(latest.weight,1)+' kg × '+latest.reps:'–'}</b><span class="arrow">${state==='good'?'↑':state==='bad'?'↓':'→'}</span></div></div>
      </button>`}).join(''):'<p class="note">Sobald du Übungen trainierst, erscheint hier der visuelle Vergleich.</p>';
    document.querySelectorAll('[data-progress-ex]').forEach(b=>b.onclick=()=>showExerciseProgress(b.dataset.progressEx));
  }
  function showExerciseProgress(id){
    const e=ex(id),sessions=sessionsForExercise(id).slice(0,20);
    openModal(`<h2>${escapeHtml(e.name)}</h2><p class="note">Vergleich deiner letzten Einheiten</p><div class="session-compare">${sessions.map((s,i)=>{
      const state=compareSession(s,sessions[i+1]),best=bestSet(s.exercise);
      return `<div class="session-row ${state}"><span class="date">${new Date(s.workout.date).toLocaleDateString('de-DE')}</span><b>${best?f(best.weight,1)+' kg × '+best.reps:'–'}</b><span class="arrow">${i===sessions.length-1?'•':state==='good'?'↑':state==='bad'?'↓':'→'}</span></div>`}).join('')}</div>`);
  }

  // Preserve app navigation while replacing selected pages.
  const originalOpenPage=openPage;
  openPage=function(name){
    originalOpenPage(name);
    if(name==='dashboard')renderDashboardV2();
    if(name==='diary')renderDayExperience();
    if(name==='exercises')renderExercisesV2();
    if(name==='reports')renderProgressPage();
    if(name==='gym')renderWorkoutHistoryV2();
  };

  const originalRenderAll=renderAll;
  renderAll=function(){
    originalRenderAll();
    renderDashboardV2();
    renderExercisesV2();
    renderWorkoutHistoryV2();
  };

  document.addEventListener('DOMContentLoaded',()=>{
    ensureStructures();
    customOnlyLibrary();
    mountDashboard();
    mountDiary();
    renderDashboardV2();
    renderExercisesV2();
    renderWorkoutHistoryV2();
    save();
  });
})();