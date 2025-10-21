(function () {
  const form = document.querySelector('[data-child-intake-form]');
  if (!form) return;

  const sportyApp = window.SportyApp;
  const statusEl = form.querySelector('[data-status]');
  const submitBtn = form.querySelector('[data-submit]');
  const resetBtn = form.querySelector('[data-reset]');
  const bannerEl = document.querySelector('[data-child-banner]');
  const guardianField = form.elements.guardian_user_id;

  function setStatus(message, type = 'info') {
    if (!statusEl) return;
    statusEl.innerHTML = message
      ? `<div class="status status--${type}">${message}</div>`
      : '';
  }

  function collectMeasurements(group) {
    const fields = form.querySelectorAll(`[data-group="${group}"][data-measurement]`);
    const output = {};
    fields.forEach((field) => {
      const key = field.getAttribute('data-measurement');
      if (!key) return;
      const raw = field.value.trim();
      if (!raw) {
        output[key] = null;
        return;
      }
      const value = Number(raw);
      output[key] = Number.isFinite(value) ? value : null;
    });
    return output;
  }

  function hasAnyMeasurement(measurements) {
    return Object.values(measurements).some((value) => value !== null && value !== undefined);
  }

  function normalizeEthnicity(value) {
    if (!value) return null;
    if (value.toLowerCase() === 'general population') return null;
    return value;
  }

  function isTestBranch() {
    const host = window.location.hostname;
    return (
      host.includes('localhost') ||
      host.includes('127.0.0.1') ||
      host.endsWith('.test') ||
      host.includes('preview')
    );
  }

  function populateGroup(group, values) {
    Object.entries(values || {}).forEach(([key, value]) => {
      const field = form.querySelector(`[data-group="${group}"][data-measurement="${key}"]`);
      if (field) {
        field.value = value ?? '';
      }
    });
  }

  function prefillForTest() {
    const preset = {
      child_id: '5d9dc9fd-9f5b-4b5d-b4db-77056db48e5d',
      guardian_user_id: '',
      birthdate: '2017-06-15',
      sex: 'female',
      ethnicity: 'caucasian',
      adult_age_group: '25-35 years',
      child: {
        weight_kg: 36.4,
        height_cm: 132.2,
        arm_span_cm: 134.0,
        leg_inseam_cm: 66.4,
        shoulder_width_cm: 34.5,
        hip_width_cm: 32.8,
        hand_length_cm: 16.2,
        foot_length_cm: 21.1,
      },
      mother: {
        weight_kg: 62.5,
        height_cm: 167.2,
        arm_span_cm: 167.8,
        leg_inseam_cm: 78.4,
        shoulder_width_cm: 42.3,
        hip_width_cm: 39.6,
        hand_length_cm: 17.4,
        foot_length_cm: 24.0,
      },
      father: {
        weight_kg: 82.1,
        height_cm: 184.6,
        arm_span_cm: 185.4,
        leg_inseam_cm: 86.7,
        shoulder_width_cm: 46.8,
        hip_width_cm: 41.5,
        hand_length_cm: 19.7,
        foot_length_cm: 27.8,
      },
    };

    form.elements.child_id.value = preset.child_id;
    if (form.elements.guardian_user_id) {
      form.elements.guardian_user_id.value = preset.guardian_user_id;
    }
    form.elements.birthdate.value = preset.birthdate;
    form.elements.sex.value = preset.sex;
    if (form.elements.ethnicity) {
      form.elements.ethnicity.value = preset.ethnicity || '';
    }
    form.elements.adult_age_group.value = preset.adult_age_group;

    populateGroup('child', preset.child);
    populateGroup('mother', preset.mother);
    populateGroup('father', preset.father);

    if (bannerEl) {
      bannerEl.innerHTML =
        'Using the seeded Sporty family. Submit the form to generate and store a forecast run.';
    }
  }

  function resetForm() {
    form.reset();
    setStatus('');
    if (isTestBranch()) {
      prefillForTest();
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!submitBtn) return;

    const childId = form.elements.child_id.value.trim();
    const birthdate = form.elements.birthdate.value;
    const sex = form.elements.sex.value;

    if (!childId || !birthdate || !sex) {
      setStatus('Child ID, birthdate, and sex are required.', 'error');
      return;
    }

    const payload = {
      child_id: childId,
      guardian_user_id: form.elements.guardian_user_id
        ? form.elements.guardian_user_id.value.trim() || null
        : null,
      birthdate,
      sex,
      ethnicity: normalizeEthnicity(form.elements.ethnicity?.value),
      adult_age_group: form.elements.adult_age_group.value,
      measurements: collectMeasurements('child'),
    };

    const motherMeasurements = collectMeasurements('mother');
    if (hasAnyMeasurement(motherMeasurements)) {
      payload.mother = {
        display_name: 'Test Mom',
        measurements: motherMeasurements,
      };
    }

    const fatherMeasurements = collectMeasurements('father');
    if (hasAnyMeasurement(fatherMeasurements)) {
      payload.father = {
        display_name: 'Test Dad',
        measurements: fatherMeasurements,
      };
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Forecasting…';
    setStatus('Computing forecast…', 'info');

    try {
      const response = await fetch('/api/forecast-child', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const bodyText = await response.text();
      let resultJson = null;
      try {
        resultJson = JSON.parse(bodyText);
      } catch (error) {
        console.warn('Unable to parse forecast response JSON', error);
      }

      if (!response.ok) {
        let detail = 'Unable to generate forecast right now.';
        try {
          const json = resultJson || JSON.parse(bodyText);
          detail = json.detail || detail;
        } catch (_) {}
        throw new Error(detail);
      }

      const serialized = resultJson ? JSON.stringify(resultJson) : bodyText;
      sessionStorage.setItem('sporty:lastChildForecast', serialized);
      sessionStorage.setItem('sporty:lastChildForecastRequest', JSON.stringify(payload));

      window.location.assign('/child-results');
    } catch (error) {
      console.error('Child forecast failed', error);
      setStatus(error.message || 'Unexpected error, please try again.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Forecast future body';
      return;
    }
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetForm();
    });
  }

  if (isTestBranch()) {
    prefillForTest();
  }

  if (sportyApp && sportyApp.ready) {
    sportyApp.ready.then(() => {
      if (typeof sportyApp.onAuthChange === 'function') {
        sportyApp.onAuthChange((snapshot) => {
          if (snapshot && snapshot.user && guardianField && !guardianField.value) {
            guardianField.value = snapshot.user.id;
          }
        });
      }
    });
  }
})();
