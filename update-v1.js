/* WesGym Update 1: personal plans only, real calorie model, delete/cancel workouts */
(() => {
  const UPDATE_KEY = 'wesgym_update_v1_applied';

  if (!localStorage.getItem(UPDATE_KEY)) {
    db.plans = (db.plans || []).filter(p => !['push', 'pull', 'legs'].includes(p.id));
    db.workouts = db.workouts || [];
    db.customExercises = db.customExercises || [];
    save();
    localStorage.setItem(UPDATE_KEY, '1');
  }

  library = [...(db.customExercises || [])];

  const originalStartSession = startSession;
  startSession = function () {
    if (!db.plans.length) {
      toast('Bitte zuerst einen Trainingstag erstellen.');
      return;
    }
    originalStartSession();
    addCancelTrainingButton();
  };

  function addCancelTrainingButton() {
    const finish = document.querySelector('#finishSession');
    if (!finish || document.querySelector('#cancelSession')) return;
    const button = document.createElement('button');
    button.id = 'cancelSession';
    button.className = 'outlineDanger wide';
    button.type = 'button';
    button.textContent = 'Training abbrechen';
    button.onclick = cancelSession;
    finish.insertAdjacentElement('afterend', button);
  }

  function cancelSession() {
    if (!session || !confirm('Training wirklich abbrechen? Es wird nicht gespeichert.')) return;
    clearInterval(sessionTick);
    clearInterval(restTick);
    session = null;
    document.querySelector('#activeSession')?.classList.add('hidden');
    document.querySelector('#sessionSetup')?.classList.remove('hidden');
    document.querySelector('#cancelSession')?.remove();
    toast('Training verworfen');
  }

  const originalRenderPlans = renderPlans;
  renderPlans = function () {
    originalRenderPlans();
    const list = document.querySelector('#planList');
    if (list && !db.plans.length) {
      list.innerHTML = '<p class="note">Noch keine Trainingstage. Tippe auf „＋ Tag“ und erstelle deinen eigenen Plan.</p>';
    }
  };

  const originalRenderGym = renderGym;
  renderGym = function () {
    originalRenderGym();
    const select = document.querySelector('#planSelect');
    const start = document.querySelector('#startSession');
    if (select && !db.plans.length) select.innerHTML = '<option>Kein Trainingstag vorhanden</option>';
    if (start) start.disabled = !db.plans.length;
  };

  renderWorkoutHistory = function () {
    const target = document.querySelector('#workoutHistory');
    if (!target) return;
    target.innerHTML = db.workouts.length
      ? [...db.workouts].reverse().map(w => `
        <div>
          <div><b>${w.name}</b><small>${new Date(w.date).toLocaleDateString('de-DE')} · ${Math.round((w.duration || 0) / 60)} Min.</small></div>
          <div style="text-align:right"><b>${f(w.volume || 0)} kg</b><small>Volumen</small></div>
          <button class="small" data-delete-workout="${w.id}">Löschen</button>
        </div>`).join('')
      : '<p class="note">Noch keine Trainings.</p>';

    document.querySelectorAll('[data-delete-workout]').forEach(button => {
      button.onclick = () => {
        if (!confirm('Dieses Training wirklich löschen?')) return;
        db.workouts = db.workouts.filter(w => w.id !== button.dataset.deleteWorkout);
        save();
        renderWorkoutHistory();
        renderDashboard();
        renderReports();
        toast('Training gelöscht');
      };
    });
  };

  predictions = function (weights) {
    const latestWeight = weights.at(-1)?.weight;
    const realEl = document.querySelector('#realPred');
    const theoryEl = document.querySelector('#theoryPred');
    const textEl = document.querySelector('#predText');

    if (!latestWeight) {
      realEl.textContent = theoryEl.textContent = '–';
      textEl.textContent = 'Bitte zuerst dein aktuelles Gewicht eintragen.';
      return;
    }

    const recentWeights = weights.slice(-21);
    const movingAverage = moving(recentWeights);
    const points = movingAverage.map((y, x) => ({ x, y })).filter(p => Number.isFinite(p.y));
    const real30 = latestWeight + slope(points) * 30;

    const recentDays = lastDays(14);
    const calorieEntries = recentDays.map(d => d.calories).filter(v => Number.isFinite(v) && v > 0);
    const stepEntries = recentDays.map(d => d.steps).filter(v => Number.isFinite(v) && v > 0);

    realEl.textContent = points.length >= 7 ? f(real30, 1) + ' kg' : '–';

    if (!calorieEntries.length || !db.settings.maintenance) {
      theoryEl.textContent = '–';
      textEl.textContent = 'Für das Kalorienmodell fehlen Kalorien- oder Erhaltungskalorien-Daten.';
      return;
    }

    const averageCalories = avg(calorieEntries);
    const averageSteps = stepEntries.length ? avg(stepEntries) : db.settings.goalSteps;
    const stepAdjustment = (averageSteps - db.settings.goalSteps) * 0.035;
    const estimatedTDEE = Math.max(1200, db.settings.maintenance + stepAdjustment);
    const dailyDeficit = estimatedTDEE - averageCalories;

    const projected = days => latestWeight - (dailyDeficit * days / 7700);
    const theory7 = projected(7);
    const theory30 = projected(30);
    const theory90 = projected(90);

    theoryEl.textContent = f(theory30, 1) + ' kg';

    const basis = `Basis: ${f(latestWeight, 1)} kg · Ø ${f(averageCalories)} kcal · geschätzter Verbrauch ${f(estimatedTDEE)} kcal.`;
    const horizons = ` Prognose: 7 Tage ${f(theory7, 1)} kg, 30 Tage ${f(theory30, 1)} kg, 90 Tage ${f(theory90, 1)} kg.`;
    const comparison = points.length >= 7
      ? (Math.abs(real30 - theory30) > 1.5
          ? ' Der reale Verlauf weicht deutlich ab; Wassergewicht oder unvollständige Einträge können die Ursache sein.'
          : ' Realer Verlauf und Kalorienmodell liegen nah beieinander.')
      : ' Für den realen Trend werden mindestens 7 Gewichtseinträge benötigt.';

    textEl.textContent = basis + horizons + comparison;
  };

  document.addEventListener('DOMContentLoaded', () => {
    addCancelTrainingButton();
    const subtitle = document.querySelector('#exercises .head p');
    if (subtitle) subtitle.textContent = 'Nur deine eigenen Übungen';
  });
})();