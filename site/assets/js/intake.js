(function () {
  const form = document.querySelector('[data-intake-form]');
  const statusEl = document.querySelector('[data-status]');
  const submitBtn = document.querySelector('[data-submit]');

  if (!form) return;

  function setStatus(html, type = 'info') {
    if (!statusEl) return;
    statusEl.innerHTML = html ? `<div class="status status--${type}">${html}</div>` : '';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!submitBtn) return;

    const fd = new FormData(form);
    const consent = fd.get('consent') === 'on';

    if (!consent) {
      setStatus('Please confirm you consent to us processing these details.', 'error');
      return;
    }

    const payload = {
      birthday: fd.get('birthday'),
      sex: fd.get('sex') || 'prefer_not_to_say',
      height_cm: Number(fd.get('height_cm')) || null,
      weight_kg: Number(fd.get('weight_kg')) || null,
      arm_span_cm: fd.get('arm_span_cm') ? Number(fd.get('arm_span_cm')) : null,
      leg_inseam_cm: fd.get('leg_inseam_cm') ? Number(fd.get('leg_inseam_cm')) : null,
      shoulder_width_cm: fd.get('shoulder_width_cm') ? Number(fd.get('shoulder_width_cm')) : null,
      hip_width_cm: fd.get('hip_width_cm') ? Number(fd.get('hip_width_cm')) : null,
      hand_length_cm: fd.get('hand_length_cm') ? Number(fd.get('hand_length_cm')) : null,
      foot_length_cm: fd.get('foot_length_cm') ? Number(fd.get('foot_length_cm')) : null,
    };

    if (!payload.birthday || !payload.height_cm || !payload.weight_kg) {
      setStatus('Birthday, height, and weight are required to generate a suggestion.', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Generating…';
    setStatus('Crunching the numbers…', 'info');

    try {
      const response = await fetch('/api/recommend-adult-free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const bodyText = await response.text();

      if (!response.ok) {
        let detail = 'We could not generate a suggestion right now.';
        try {
          const json = JSON.parse(bodyText);
          detail = json.detail || detail;
        } catch (_) {}
        throw new Error(detail);
      }

      sessionStorage.setItem('sporty:lastResult', bodyText);
      window.location.assign('/results.html');
    } catch (error) {
      setStatus(error.message || 'Unexpected error, please try again.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'See my matches';
    }
  });

  // Prefill measurements on test/staging branches for faster QA
  if (isTestBranch()) {
    prefillForTest();
  }

  function isTestBranch() {
    const host = window.location.hostname || '';
    return /test/i.test(host) || host.endsWith('.workers.dev') || host === 'localhost';
  }

  function prefillForTest() {
    const preset = {
      birthday: '1998-06-01',
      sex: 'female',
      height_cm: 178,
      weight_kg: 70,
      arm_span_cm: 182,
      leg_inseam_cm: 85,
      shoulder_width_cm: 42,
      hip_width_cm: 35,
      hand_length_cm: 19,
      foot_length_cm: 25,
      consent: true,
    };

    Object.entries(preset).forEach(([key, value]) => {
      const field = form.elements.namedItem(key);
      if (!field) return;

      if (field instanceof RadioNodeList) {
        field.value = value;
        return;
      }

      if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
        if (field.type === 'checkbox') {
          field.checked = Boolean(value);
        } else {
          field.value = value;
        }
      }
    });
  }

})();
