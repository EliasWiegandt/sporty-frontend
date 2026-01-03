(function () {
  const root = document.querySelector('[data-child-premium-root]');
  if (!root) return;

  const hero = root.querySelector('[data-hero]');
  const sportEl = root.querySelector('[data-sport]');
  const reasonEl = root.querySelector('[data-reason]');
  const creditWrap = root.querySelector('[data-credit]');
  const creditAdult = root.querySelector('[data-credit-adult]');
  const creditChild = root.querySelector('[data-credit-child]');
  const measurementSummaryEl = root.querySelector('[data-measurement-summary]');
  const emptyState = root.querySelector('[data-empty-state]');
  const resultsSection = root.querySelector('[data-results]');
  const componentList = root.querySelector('[data-component-list]');
  const preferenceList = root.querySelector('[data-preference-list]');
  const goalList = root.querySelector('[data-goal-list]');
  const injuryList = root.querySelector('[data-injury-list]');
  const pastSportsList = root.querySelector('[data-past-sports-list]');
  const nextStepsList = root.querySelector('[data-next-steps-list]');
  const matchGrid = root.querySelector('[data-match-grid]');

  const rawForecast = sessionStorage.getItem('sporty:lastChildForecast');
  const rawRequest = sessionStorage.getItem('sporty:lastChildForecastRequest');

  if (!rawForecast) {
    showEmptyState();
    return;
  }

  let forecast;
  let requestPayload = null;
  try {
    forecast = JSON.parse(rawForecast);
  } catch (error) {
    console.error('Unable to parse stored child forecast', error);
    showEmptyState();
    return;
  }

  if (rawRequest) {
    try {
      requestPayload = JSON.parse(rawRequest);
    } catch (error) {
      console.warn('Unable to parse stored child request', error);
    }
  }

  const premium = forecast && forecast.premium_analysis ? forecast.premium_analysis : null;
  if (!premium) {
    showEmptyState();
    return;
  }

  if (hero) hero.hidden = false;
  if (measurementSummaryEl) measurementSummaryEl.hidden = false;
  if (resultsSection) resultsSection.hidden = false;

  renderHero(premium);
  renderMeasurementSummary(forecast);
  renderComponentImpacts(componentList, premium.component_impacts);
  renderPreferenceAlignment(preferenceList, premium.preference_alignment);
  renderGoalAlignment(goalList, premium.goal_alignment);
  renderInjuryConsiderations(injuryList, premium.injury_considerations);
  renderPastSports(pastSportsList, premium.past_sports || forecast.past_sports, requestPayload);
  renderNextSteps(nextStepsList, premium.next_steps);
  renderMatches(matchGrid, premium.matches);

  function renderHero(data) {
    if (sportEl) {
      const sport = (data.suggested_sport || 'Premium sport guidance').replace(/[-_]/g, ' ');
      sportEl.textContent = `Premium matches for ${sport}`;
    }
    if (reasonEl) {
      reasonEl.textContent = data.reason || 'Premium signals blended with the projected adult build for this child.';
    }
    if (data.credit && creditWrap && creditAdult && creditChild) {
      const totals = data.credit.totals || {};
      creditWrap.hidden = false;
      creditAdult.textContent = `Adult credits: ${totals.adult ?? '—'}`;
      creditChild.textContent = `Child credits: ${totals.child ?? data.credit.remaining_after ?? '—'}`;
    }
  }

  function renderMeasurementSummary(result) {
    if (!measurementSummaryEl) return;
    const measurements = result?.results || {};
    const entries = [
      ['height_cm', 'Height', 'cm'],
      ['weight_kg', 'Weight', 'kg'],
      ['arm_span_cm', 'Arm span', 'cm'],
      ['leg_inseam_cm', 'Leg inseam', 'cm'],
      ['shoulder_width_cm', 'Shoulder width', 'cm'],
      ['pelvic_bone_width_cm', 'Pelvic bone width', 'cm'],
      ['hand_length_cm', 'Hand length', 'cm'],
      ['foot_length_cm', 'Foot length', 'cm'],
    ];

    measurementSummaryEl.innerHTML = '';
    entries.forEach(([key, label, unit]) => {
      const entry = measurements[key] || {};
      const value = entry.forecast_value ?? entry.input_value ?? entry.cohort_average;
      const card = document.createElement('div');
      card.className = 'summary-card';
      const labelSpan = document.createElement('span');
      labelSpan.className = 'label';
      labelSpan.textContent = label;
      const valueSpan = document.createElement('span');
      valueSpan.className = 'value';
      valueSpan.textContent = value == null ? '—' : `${Number(value).toFixed(1)} ${unit}`;
      card.appendChild(labelSpan);
      card.appendChild(valueSpan);
      measurementSummaryEl.appendChild(card);
    });
  }

  function renderComponentImpacts(root, components) {
    if (!root) return;
    root.innerHTML = '';
    if (!components || !components.length) {
      root.appendChild(createEmptyItem('No component impacts available.'));
      return;
    }
    components.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'list-card';
      const title = document.createElement('strong');
      title.className = 'font-semibold text-[var(--gray-12)]';
      title.textContent = item.component || 'Component';
      const meta = document.createElement('div');
      meta.className = 'meta-muted';
      meta.appendChild(createMetaChip(`Weight ${formatPercent(item.weight_percent)}`));
      if (item.score_percent != null) {
        meta.appendChild(createMetaChip(`Score ${formatPercent(item.score_percent)}`));
      }
      const summary = document.createElement('p');
      summary.className = 'text-muted text-sm';
      summary.textContent = item.summary || '';
      li.appendChild(title);
      li.appendChild(meta);
      li.appendChild(summary);
      root.appendChild(li);
    });
  }

  function renderPreferenceAlignment(root, items) {
    renderAlignmentList(root, items, 'No preferences supplied.');
  }

  function renderGoalAlignment(root, items) {
    renderAlignmentList(root, items, 'No goals supplied.');
  }

  function renderAlignmentList(root, items, emptyText) {
    if (!root) return;
    root.innerHTML = '';
    if (!items || !items.length) {
      root.appendChild(createEmptyItem(emptyText));
      return;
    }
    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'list-card';
      const title = document.createElement('strong');
      title.className = 'font-semibold text-[var(--gray-12)]';
      title.textContent = item.name || item.preference_id || item.goal_id || 'Entry';
      const meta = document.createElement('div');
      meta.className = 'meta-muted';
      if (item.priority) meta.appendChild(createMetaChip(`Priority: ${item.priority}`));
      if (item.alignment) meta.appendChild(createMetaChip(`Alignment: ${item.alignment}`));
      if (item.score_percent != null) meta.appendChild(createMetaChip(`Score ${formatPercent(item.score_percent)}`));
      const summary = document.createElement('p');
      summary.className = 'text-muted text-sm';
      summary.textContent = item.summary || '';
      li.appendChild(title);
      li.appendChild(meta);
      li.appendChild(summary);
      root.appendChild(li);
    });
  }

  function renderInjuryConsiderations(root, items) {
    if (!root) return;
    root.innerHTML = '';
    if (!items || !items.length) {
      root.appendChild(createEmptyItem('No injuries considered.'));
      return;
    }
    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'list-card';
      const title = document.createElement('strong');
      title.className = 'font-semibold text-[var(--gray-12)]';
      title.textContent = item.injury_name || item.injury_id || 'Injury';
      const meta = document.createElement('div');
      meta.className = 'meta-muted';
      if (item.severity) meta.appendChild(createMetaChip(`Severity: ${item.severity}`));
      if (item.alignment) {
        Object.entries(item.alignment).forEach(([key, value]) => {
          meta.appendChild(createMetaChip(`${key}: ${value}`));
        });
      }
      if (item.score_percent != null) meta.appendChild(createMetaChip(`Score ${formatPercent(item.score_percent)}`));
      if (item.notes) meta.appendChild(createMetaChip(`Notes: ${item.notes}`));
      const summary = document.createElement('p');
      summary.className = 'text-muted text-sm';
      summary.textContent = item.guidance || '';
      li.appendChild(title);
      li.appendChild(meta);
      li.appendChild(summary);
      root.appendChild(li);
    });
  }

  function renderPastSports(root, items, request) {
    if (!root) return;
    root.innerHTML = '';
    const labels = new Map();
    if (request && Array.isArray(request.past_sports)) {
      request.past_sports.forEach((entry) => {
        if (!entry || !entry.sport_subcategory_id) return;
        labels.set(entry.sport_subcategory_id, entry.sport_label || entry.sport_subcategory_id);
      });
    }
    if (!items || !items.length) {
      root.appendChild(createEmptyItem('No child past sports captured yet.'));
      return;
    }
    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'list-card';
      const title = document.createElement('strong');
      title.className = 'font-semibold text-[var(--gray-12)]';
      const label = item.sport_label || labels.get(item.sport_subcategory_id) || item.sport_subcategory_id || 'Sport';
      title.textContent = label;
      const meta = document.createElement('div');
      meta.className = 'meta-muted';
      if (item.years_played != null) meta.appendChild(createMetaChip(`${item.years_played} yrs`));
      if (item.age_started_years != null) meta.appendChild(createMetaChip(`Started @ ${item.age_started_years}`));
      if (item.intensity) meta.appendChild(createMetaChip(`Intensity: ${item.intensity}`));
      if (typeof item.liked === 'boolean') meta.appendChild(createMetaChip(item.liked ? 'Enjoyed' : 'Did not enjoy'));
      if (typeof item.had_flair === 'boolean') meta.appendChild(createMetaChip(item.had_flair ? 'Felt natural' : 'No flair'));
      if (typeof item.achieved_skill === 'boolean') meta.appendChild(createMetaChip(item.achieved_skill ? 'Built skill' : 'Still learning'));
      li.appendChild(title);
      li.appendChild(meta);
      root.appendChild(li);
    });
  }

  function renderNextSteps(root, items) {
    if (!root) return;
    root.innerHTML = '';
    if (!items || !items.length) {
      root.appendChild(createEmptyItem('No next steps provided yet.'));
      return;
    }
    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'list-card';
      const title = document.createElement('strong');
      title.className = 'font-semibold text-[var(--gray-12)]';
      title.textContent = item.title || 'Next step';
      const summary = document.createElement('p');
      summary.className = 'text-muted text-sm';
      summary.textContent = item.description || '';
      li.appendChild(title);
      li.appendChild(summary);
      root.appendChild(li);
    });
  }

  function renderMatches(root, matches) {
    if (!root) return;
    root.innerHTML = '';
    if (!matches || !matches.length) {
      const empty = document.createElement('p');
      empty.className = 'text-muted';
      empty.textContent = 'No sport matches returned for this premium run.';
      root.appendChild(empty);
      return;
    }
    matches.forEach((match, index) => {
      const card = document.createElement('div');
      card.className = 'match-card';
      const header = document.createElement('div');
      header.className = 'match-header';
      const rank = document.createElement('span');
      rank.className = 'match-rank';
      rank.textContent = index + 1;
      const title = document.createElement('h3');
      title.className = 'card-title';
      const sportName = ((match.optimal_body || {}).sport_slug || 'Sport').replace(/[-_]/g, ' ');
      title.textContent = sportName;
      const score = document.createElement('span');
      score.className = 'match-score';
      score.textContent = match.score != null ? `${Math.round(Number(match.score) * 100)}%` : '—';
      header.appendChild(rank);
      header.appendChild(title);
      header.appendChild(score);
      const summary = document.createElement('p');
      summary.className = 'text-muted text-sm';
      const spec = (match.optimal_body || {}).spec || {};
      summary.textContent = spec.rationale || spec.description || 'This sport aligns strongly with the projected adult build.';
      card.appendChild(header);
      card.appendChild(summary);
      root.appendChild(card);
    });
  }

  function createMetaChip(label) {
    const span = document.createElement('span');
    span.textContent = label;
    span.className = 'chip-muted';
    return span;
  }

  function createEmptyItem(message) {
    const li = document.createElement('li');
    li.className = 'list-card';
    li.textContent = message;
    return li;
  }

  function formatPercent(value) {
    if (value == null || Number.isNaN(Number(value))) return '0%';
    return `${Number(value).toFixed(1)}%`;
  }

  function showEmptyState() {
    if (emptyState) emptyState.hidden = false;
    if (resultsSection) resultsSection.hidden = true;
    if (hero) hero.hidden = true;
    if (measurementSummaryEl) measurementSummaryEl.hidden = true;
  }
})();
