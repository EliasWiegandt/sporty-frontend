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

  function getUrlChildId() {
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get('child_id');
    } catch {
      return null;
    }
  }

  async function loadLatestMeasurementForAdult(client, userId) {
    const { data, error } = await client
      .from('measurements')
      .select('*')
      .eq('subject_type', 'adult')
      .eq('subject_user_id', userId)
      .order('measured_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function loadLatestMeasurementForChild(client, childId) {
    const { data, error } = await client
      .from('measurements')
      .select('*')
      .eq('subject_type', 'child')
      .eq('subject_child_id', childId)
      .order('measured_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function loadChildRecord(client, childId) {
    const { data, error } = await client
      .from('children')
      .select('id,name,birthdate,sex')
      .eq('id', childId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function loadFirstActiveChildForGuardian(client, userId) {
    const { data, error } = await client
      .from('guardianships')
      .select('child_id, child:children(id,name,birthdate,sex)')
      .eq('guardian_user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1);
    if (error) throw error;
    const row = (data || [])[0];
    if (!row) return null;
    return {
      child_id: row.child_id,
      child: row.child || null,
    };
  }

  async function loadMyBiologicalRole(client, userId, childId) {
    const { data, error } = await client
      .from('guardianships')
      .select('biological_role')
      .eq('guardian_user_id', userId)
      .eq('child_id', childId)
      .eq('status', 'active')
      .maybeSingle();
    if (error) throw error;
    return (data && data.biological_role) || null;
  }

  async function loadSharedParentMeasurements(client, childId) {
    const { data, error } = await client.rpc('get_child_parent_measurements', {
      p_child_id: childId,
    });
    if (error) throw error;
    return data || null;
  }

  function applyChildBasics(child) {
    if (!child) return;
    if (form.elements.birthdate && child.birthdate) {
      form.elements.birthdate.value = child.birthdate;
    }
    if (form.elements.sex && child.sex) {
      form.elements.sex.value = child.sex;
    }
  }

  function applyMeasurementRowToGroup(group, row) {
    if (!row) return;
    const allowed = [
      'height_cm',
      'weight_kg',
      'arm_span_cm',
      'leg_inseam_cm',
      'shoulder_width_cm',
      'pelvic_bone_width_cm',
      'hand_length_cm',
      'foot_length_cm',
      'torso_length_cm',
      'ankle_circumference_cm',
      'wrist_circumference_cm',
    ];
    const values = {};
    allowed.forEach((key) => {
      if (row[key] === undefined) return;
      values[key] = row[key];
    });
    populateGroup(group, values);
  }

  function resetForm() {
    form.reset();
    setStatus('');
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
    // no local defaults; prefer latest saved measurements when signed in
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

  if (sportyApp && sportyApp.ready) {
    sportyApp.ready.then(async () => {
      const client = sportyApp.getClient ? sportyApp.getClient() : null;
      const user = sportyApp.getUser ? sportyApp.getUser() : null;
      if (!client || !user || !user.id) return;

      if (guardianField && !guardianField.value) {
        guardianField.value = user.id;
      }

      try {
        let childId = getUrlChildId();
        if (!childId) {
          const first = await loadFirstActiveChildForGuardian(client, user.id);
          if (first && first.child_id) {
            childId = first.child_id;
          }
        }

        if (childId && form.elements.child_id && !form.elements.child_id.value) {
          form.elements.child_id.value = childId;
        }

        if (childId) {
          const childRecord = await loadChildRecord(client, childId);
          applyChildBasics(childRecord);

          const childMeasurement = await loadLatestMeasurementForChild(client, childId);
          applyMeasurementRowToGroup('child', childMeasurement);

          // Prefer shared parent measurements if the biological parents opted in.
          try {
            const shared = await loadSharedParentMeasurements(client, childId);
            if (shared && shared.mother) applyMeasurementRowToGroup('mother', shared.mother);
            if (shared && shared.father) applyMeasurementRowToGroup('father', shared.father);
          } catch (error) {
            console.warn('Unable to load shared parent measurements', error);
          }

          // Always prefill the current guardian's own parent block (if they are a biological parent),
          // even if sharing is not enabled.
          const biologicalRole = await loadMyBiologicalRole(client, user.id, childId);
          if (biologicalRole === 'mother' || biologicalRole === 'father') {
            const adultMeasurement = await loadLatestMeasurementForAdult(client, user.id);
            applyMeasurementRowToGroup(biologicalRole, adultMeasurement);
          }

          if (bannerEl) {
            const name = childRecord?.name ? `“${childRecord.name}”` : 'your child';
            bannerEl.textContent = `Prefilled from the latest saved measurements we can access for ${name}.`;
          }
        } else if (bannerEl) {
          bannerEl.textContent = 'Enter a Child ID to prefill saved measurements, or continue with manual entry.';
        }
      } catch (error) {
        console.warn('Unable to prefill child intake from saved measurements', error);
      }
    });
  }
})();
