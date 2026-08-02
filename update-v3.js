
/* WesGym Update 3 — automatic weight plan from calorie deficit */
(() => {
  function ensureWeightPlanSettings(){
    db.weightPlan = db.weightPlan || {
      startDate: key(),
      startWeight: null,
      maintenanceCalories: db.settings?.maintenance || 2600,
      plannedCalories: db.settings?.goalCalories || 1800,
      goalWeight: db.settings?.goalWeight || null
    };
  }

  function parseDate(k){
    const [y,m,d]=k.split('-').map(Number);
    return new Date(y,m-1,d,12);
  }

  function daysBetween(a,b){
    return Math.floor((parseDate(b)-parseDate(a))/86400000);
  }

  function expectedWeightFor(k){
    ensureWeightPlanSettings();
    const p=db.weightPlan;
    if(!p.startDate || !Number.isFinite(+p.startWeight)) return null;
    const day=daysBetween(p.startDate,k);
    if(day<0) return null;
    const deficit=(+p.maintenanceCalories||0)-(+p.plannedCalories||0);
    return +p.startWeight-(deficit*day/7700);
  }

  function expectedAverageFor(endKey,days=7){
    const end=parseDate(endKey), vals=[];
    for(let i=days-1;i>=0;i--){
      const d=new Date(end); d.setDate(d.getDate()-i);
      const v=expectedWeightFor(key(d));
      if(Number.isFinite(v)) vals.push(v);
    }
    return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;
  }

  function actualAverageFor(endKey,days=7){
    const end=parseDate(endKey), vals=[];
    for(let i=days-1;i>=0;i--){
      const d=new Date(end); d.setDate(d.getDate()-i);
      const v=db.days[key(d)]?.weight;
      if(Number.isFinite(+v) && +v>0) vals.push(+v);
    }
    return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;
  }

  function planStatusText(actual,expected){
    if(!Number.isFinite(+actual) || !Number.isFinite(+expected)) return {text:'Noch keine Vergleichsdaten',className:'neutral'};
    const diff=+actual-+expected;
    if(Math.abs(diff)<=0.15) return {text:'Im Plan',className:'mid'};
    if(diff<0) return {text:`${f(Math.abs(diff),1)} kg vor dem Plan`,className:'good'};
    return {text:`${f(diff,1)} kg hinter dem Plan`,className:'bad'};
  }

  function trendStatusText(k){
    const actual=actualAverageFor(k,7), expected=expectedAverageFor(k,7);
    if(!Number.isFinite(actual) || !Number.isFinite(expected)) return {text:'7-Tage-Trend noch nicht verfügbar',className:'neutral'};
    const diff=actual-expected;
    if(Math.abs(diff)<=0.15) return {text:'7-Tage-Trend: im Plan',className:'mid'};
    if(diff<0) return {text:`7-Tage-Trend: ${f(Math.abs(diff),1)} kg vor dem Plan`,className:'good'};
    return {text:`7-Tage-Trend: ${f(diff,1)} kg hinter dem Plan`,className:'bad'};
  }

  function mountWeightPlanSettings(){
    const settings=document.querySelector('#settings');
    if(!settings || document.querySelector('#weightPlanCard')) return;
    const card=document.createElement('div');
    card.className='card';
    card.id='weightPlanCard';
    card.innerHTML=`
      <div class="head"><div><h2>Gewichtsplan</h2><p>Automatisch aus deinem Kaloriendefizit</p></div></div>
      <form id="weightPlanForm" class="form">
        <label>Startdatum<input id="wpStartDate" type="date"></label>
        <label>Startgewicht (kg)<input id="wpStartWeight" type="number" step="0.1"></label>
        <label>Erhaltungskalorien<input id="wpMaintenance" type="number"></label>
        <label>Geplante Tageskalorien<input id="wpCalories" type="number"></label>
        <label class="full">Zielgewicht (optional)<input id="wpGoalWeight" type="number" step="0.1"></label>
        <button class="primary full">Gewichtsplan speichern</button>
      </form>
      <div id="weightPlanSummary" class="reportBox" style="margin-top:14px"></div>`;
    settings.prepend(card);
    document.querySelector('#weightPlanForm').onsubmit=saveWeightPlan;
    fillWeightPlanSettings();
  }

  function fillWeightPlanSettings(){
    ensureWeightPlanSettings();
    const p=db.weightPlan;
    const map={
      wpStartDate:p.startDate,
      wpStartWeight:p.startWeight,
      wpMaintenance:p.maintenanceCalories,
      wpCalories:p.plannedCalories,
      wpGoalWeight:p.goalWeight
    };
    Object.entries(map).forEach(([id,v])=>{const el=document.querySelector('#'+id);if(el)el.value=v??''});
    renderWeightPlanSummary();
  }

  function saveWeightPlan(e){
    e.preventDefault();
    db.weightPlan={
      startDate:document.querySelector('#wpStartDate').value || key(),
      startWeight:parseFloat(document.querySelector('#wpStartWeight').value),
      maintenanceCalories:parseFloat(document.querySelector('#wpMaintenance').value),
      plannedCalories:parseFloat(document.querySelector('#wpCalories').value),
      goalWeight:parseFloat(document.querySelector('#wpGoalWeight').value) || null
    };
    db.settings.maintenance=db.weightPlan.maintenanceCalories;
    db.settings.goalCalories=db.weightPlan.plannedCalories;
    save();
    renderWeightPlanSummary();
    renderDashboardV2?.();
    renderDayExperience?.();
    toast('Gewichtsplan gespeichert');
  }

  function renderWeightPlanSummary(){
    const box=document.querySelector('#weightPlanSummary'); if(!box)return;
    ensureWeightPlanSettings();
    const p=db.weightPlan;
    if(!Number.isFinite(+p.startWeight) || !Number.isFinite(+p.maintenanceCalories) || !Number.isFinite(+p.plannedCalories)){
      box.innerHTML='<b>Noch unvollständig</b><br>Bitte Startgewicht, Erhaltungskalorien und geplante Kalorien eintragen.';
      return;
    }
    const deficit=(+p.maintenanceCalories)-(+p.plannedCalories);
    const weekly=deficit*7/7700;
    let goalText='';
    if(Number.isFinite(+p.goalWeight) && deficit>0){
      const days=Math.ceil((+p.startWeight-+p.goalWeight)*7700/deficit);
      if(days>=0){
        const d=parseDate(p.startDate); d.setDate(d.getDate()+days);
        goalText=`<br>Ziel voraussichtlich am ${d.toLocaleDateString('de-DE')}`;
      }
    }
    box.innerHTML=`<b>${f(deficit)} kcal Defizit pro Tag</b><br>≈ ${f(weekly,2)} kg pro Woche${goalText}`;
  }

  function injectAutomaticExpectedWeight(){
    const k = typeof iso==='function' ? iso() : key();
    const expected=expectedWeightFor(k);
    const actual=db.days[k]?.weight;
    const daily=planStatusText(actual,expected);
    const trend=trendStatusText(k);

    const cards=document.querySelectorAll('#dayExperience .compare-card');
    cards.forEach(card=>{
      const label=card.querySelector('.label')?.textContent;
      if(label==='Gewicht'){
        const val=card.querySelector('.value');
        const sub=card.querySelector('.sub');
        if(selectedMode==='plan' && val) val.textContent=Number.isFinite(expected)?`${f(expected,1)} kg`:'–';
        if(sub) sub.textContent=Number.isFinite(expected)?`Plan ${f(expected,1)} kg`:'Plan noch nicht eingerichtet';
        card.classList.remove('good','bad','mid','neutral');
        card.classList.add(daily.className);
      }
    });

    const planWeightInput=document.querySelector('#v2Weight');
    if(selectedMode==='plan' && planWeightInput){
      planWeightInput.value=Number.isFinite(expected)?f(expected,2).replace(',','.'):'';
      planWeightInput.disabled=true;
      const label=planWeightInput.closest('label');
      if(label) label.firstChild.textContent='Gewicht automatisch (kg)';
    }

    let status=document.querySelector('#automaticWeightStatus');
    if(!status){
      status=document.createElement('div');
      status.id='automaticWeightStatus';
      status.className='day-form-card';
      const hero=document.querySelector('#dayExperience .daily-hero');
      hero?.insertAdjacentElement('afterend',status);
    }
    status.innerHTML=`
      <h3>Gewichtsstatus</h3>
      <p>Automatische Soll-Kurve aus deinem Kaloriendefizit</p>
      <div class="metric-cards">
        <div class="compare-card ${daily.className}"><div class="label">Tagesvergleich</div><div class="value">${daily.text}</div><div class="sub">Soll ${Number.isFinite(expected)?f(expected,1)+' kg':'–'} · Ist ${Number.isFinite(+actual)?f(+actual,1)+' kg':'–'}</div></div>
        <div class="compare-card ${trend.className}"><div class="label">Gesamttrend</div><div class="value">${trend.text}</div><div class="sub">Bewertung über 7 Tage</div></div>
      </div>`;
  }

  function injectDashboardWeightStatus(){
    const k=key(),expected=expectedWeightFor(k),actual=db.days[k]?.weight;
    const daily=planStatusText(actual,expected),trend=trendStatusText(k);
    const hero=document.querySelector('#dashboardToday');
    if(!hero)return;
    let box=document.querySelector('#dashboardWeightPlanStatus');
    if(!box){
      box=document.createElement('div');
      box.id='dashboardWeightPlanStatus';
      box.className='metric-cards';
      hero.appendChild(box);
    }
    box.innerHTML=`
      <div class="compare-card ${daily.className}"><div class="label">Gewicht heute</div><div class="value">${daily.text}</div><div class="sub">Soll ${Number.isFinite(expected)?f(expected,1)+' kg':'–'} · Ist ${Number.isFinite(+actual)?f(+actual,1)+' kg':'–'}</div></div>
      <div class="compare-card ${trend.className}"><div class="label">7-Tage-Trend</div><div class="value">${trend.text}</div><div class="sub">Wichtiger als ein einzelner Tag</div></div>`;
  }

  // Override plan weight source so the user never enters it manually
  const oldPlanFor = typeof planFor==='function' ? planFor : null;
  if(oldPlanFor){
    planFor = function(k){
      const p=oldPlanFor(k);
      const expected=expectedWeightFor(k);
      return {...p,weight:expected};
    };
  }

  const oldRenderDayExperience = typeof renderDayExperience==='function' ? renderDayExperience : null;
  if(oldRenderDayExperience){
    renderDayExperience=function(){
      oldRenderDayExperience();
      injectAutomaticExpectedWeight();
    };
  }

  const oldRenderDashboardV2 = typeof renderDashboardV2==='function' ? renderDashboardV2 : null;
  if(oldRenderDashboardV2){
    renderDashboardV2=function(){
      oldRenderDashboardV2();
      injectDashboardWeightStatus();
    };
  }

  const oldOpenPage = openPage;
  openPage=function(name){
    oldOpenPage(name);
    if(name==='settings'){mountWeightPlanSettings();fillWeightPlanSettings()}
  };

  document.addEventListener('DOMContentLoaded',()=>{
    ensureWeightPlanSettings();
    mountWeightPlanSettings();
    if(!db.weightPlan.startWeight){
      const latest=sortedDays().filter(d=>d.weight).at(-1);
      if(latest){
        db.weightPlan.startWeight=latest.weight;
        db.weightPlan.startDate=latest.date;
        save();
      }
    }
    renderWeightPlanSummary();
    injectDashboardWeightStatus();
    injectAutomaticExpectedWeight();
  });
})();