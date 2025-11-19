(function () {
  const root = document.querySelector('[data-premium-root]');
  if (!root) return;

  const hero = root.querySelector('[data-premium-hero]');
  const sportEl = hero ? hero.querySelector('[data-sport]') : null;
  const reasonEl = hero ? hero.querySelector('[data-reason]') : null;
  const creditSummaryEl = root.querySelector('[data-credit-summary]');
  const creditAdultEl = root.querySelector('[data-credit-adult]');
  const creditChildEl = root.querySelector('[data-credit-child]');
  const componentList = root.querySelector('[data-component-list]');
  const preferenceList = root.querySelector('[data-preference-list]');
  const goalList = root.querySelector('[data-goal-list]');
  const injuryList = root.querySelector('[data-injury-list]');
  const nextStepsList = root.querySelector('[data-next-steps]');
  const pastSportsList = root.querySelector('[data-past-sports]');
  const matchGrid = root.querySelector('[data-match-grid]');
  const measurementsContainer = root.querySelector('[data-premium-measurements]');
  const emptyState = root.querySelector('[data-empty-state]');
  const componentPalette = {
    body: '#0f766e',
    preferences: '#f97316',
    goals: '#6366f1',
    injuries: '#ef4444',
    past_sports: '#14b8a6',
    default: ['#0f766e', '#2563eb', '#f97316', '#14b8a6', '#9333ea'],
  };
  function pickComponentColor(key, index) {
    if (key && componentPalette[key]) return componentPalette[key];
    const palette = componentPalette.default;
    return palette[index % palette.length];
  }

  let parsed = null;
  const stored = sessionStorage.getItem('sporty:lastPremiumResult');
  if (stored) {
    try {
      parsed = JSON.parse(stored);
    } catch (error) {
      console.error('[Sporty] Failed to parse premium analysis payload', error);
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    if (emptyState) emptyState.hidden = false;
    return;
  }

  try {
    sessionStorage.removeItem('sporty:lastPremiumResult');
  } catch (error) {
    console.warn('[Sporty] Unable to clear premium result cache', error);
  }

  if (emptyState) emptyState.hidden = true;

  if (sportEl) {
    sportEl.textContent = parsed.suggested_sport || 'Premium analysis';
  }
  if (reasonEl) {
    reasonEl.textContent = parsed.reason || 'Detailed rationale will appear once the backend provides it.';
  }

  if (parsed.credit && creditSummaryEl) {
    creditSummaryEl.hidden = false;
    if (creditAdultEl) {
      const remainingAdult = parsed.credit.totals && parsed.credit.totals.adult !== undefined
        ? parsed.credit.totals.adult
        : parsed.credit.remaining_after;
      creditAdultEl.textContent = `Adult credits: ${remainingAdult}`;
    }
    if (creditChildEl && parsed.credit.totals) {
      creditChildEl.textContent = `Child credits: ${parsed.credit.totals.child ?? 0}`;
    }
  }

  renderComponentImpacts(parsed.component_impacts || []);
  renderAlignmentList(preferenceList, parsed.preference_alignment || [], 'preference_id');
  renderAlignmentList(goalList, parsed.goal_alignment || [], 'goal_id');
  renderInjuries(parsed.injury_considerations || []);
  renderNextSteps(parsed.next_steps || []);
  renderPastSports(parsed.past_sports || []);
  renderMatches(parsed.matches || []);
  renderPremiumMeasurements(parsed.matches || []);

  function renderComponentImpacts(components) {
    if (!componentList) return;
    componentList.innerHTML = '';
    if (!components.length) {
      const li = document.createElement('li');
      li.textContent = 'Component breakdown will appear once available.';
      componentList.appendChild(li);
      return;
    }
    components.forEach((component, index) => {
      const li = document.createElement('li');
      li.className = 'component-list__item';
      const color = pickComponentColor(component.component || component.key, index);
      const indicator = document.createElement('span');
      indicator.className = 'component-color';
      indicator.style.background = color;
      const label = document.createElement('span');
      label.className = 'component-list__label';
      const weightText = formatPercent(component.weight_percent);
      const scoreText = component.score_percent !== undefined && component.score_percent !== null
        ? `${component.score_percent.toFixed(1)}%`
        : '—';
      label.textContent = `${component.component || component.key || 'Component'} · Weight ${weightText} · Score ${scoreText}`;
      const summary = document.createElement('p');
      summary.className = 'component-list__summary';
      summary.textContent = component.summary || '';
      li.appendChild(indicator);
      li.appendChild(label);
      li.appendChild(summary);
      componentList.appendChild(li);
    });
  }

  function formatPercent(value) {
    if (value === null || value === undefined) return '0%';
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return '0%';
    return `${numeric.toFixed(1)}%`;
  }

  function renderAlignmentList(target, entries, keyField) {
    if (!target) return;
    target.innerHTML = '';
    if (!entries.length) {
      const li = document.createElement('li');
      li.className = 'alignment-item';
      li.textContent = 'No items captured yet.';
      target.appendChild(li);
      return;
    }
    entries.forEach((entry) => {
      const item = document.createElement('li');
      item.className = 'alignment-item';

      const title = document.createElement('strong');
      title.textContent = entry.name || entry[keyField] || 'Selection';
      item.appendChild(title);

      if (entry.summary) {
        const summary = document.createElement('p');
        summary.textContent = entry.summary;
        summary.style.margin = '0';
        item.appendChild(summary);
      }

      const meta = document.createElement('div');
      meta.className = 'alignment-item__meta';
      if (entry.priority) {
        const priority = document.createElement('span');
        priority.textContent = `Priority: ${entry.priority}`;
        meta.appendChild(priority);
      }
      if (entry.alignment) {
        const align = document.createElement('span');
        align.textContent = `Alignment: ${entry.alignment}`;
        meta.appendChild(align);
      }
      if (entry.score_percent !== undefined && entry.score_percent !== null) {
        const score = document.createElement('span');
        score.textContent = `Score: ${entry.score_percent.toFixed(1)}%`;
        meta.appendChild(score);
      }
      if (meta.children.length) {
        item.appendChild(meta);
      }

      target.appendChild(item);
    });
  }

  function renderInjuries(entries) {
    if (!injuryList) return;
    injuryList.innerHTML = '';
    if (!entries.length) {
      const li = document.createElement('li');
      li.className = 'alignment-item';
      li.textContent = 'No injury considerations supplied.';
      injuryList.appendChild(li);
      return;
    }
    entries.forEach((entry) => {
      const li = document.createElement('li');
      li.className = 'alignment-item';

      const title = document.createElement('strong');
      title.textContent = entry.injury_name || entry.injury_id || 'Injury';
      li.appendChild(title);

      const summary = document.createElement('p');
      summary.style.margin = '0';
      summary.textContent = entry.guidance || 'Monitor this area during training.';
      li.appendChild(summary);

      const meta = document.createElement('div');
      meta.className = 'alignment-item__meta';
      if (entry.severity) {
        const severity = document.createElement('span');
        severity.textContent = `Severity: ${entry.severity}`;
        meta.appendChild(severity);
      }
      if (entry.risk) {
        const risk = document.createElement('span');
        risk.textContent = `Risk level: ${entry.risk}`;
        meta.appendChild(risk);
      }
      if (entry.score_percent !== undefined && entry.score_percent !== null) {
        const score = document.createElement('span');
        score.textContent = `Score: ${entry.score_percent.toFixed(1)}%`;
        meta.appendChild(score);
      }
      if (entry.notes) {
        const notes = document.createElement('span');
        notes.textContent = `Notes: ${entry.notes}`;
        meta.appendChild(notes);
      }
      if (meta.children.length) li.appendChild(meta);

      injuryList.appendChild(li);
    });
  }

  function renderNextSteps(steps) {
    if (!nextStepsList) return;
    nextStepsList.innerHTML = '';
    if (!steps.length) {
      const li = document.createElement('li');
      li.className = 'next-step';
      li.textContent = 'Detailed coaching tasks will appear once available.';
      nextStepsList.appendChild(li);
      return;
    }
    steps.forEach((step) => {
      const li = document.createElement('li');
      li.className = 'next-step';
      const title = document.createElement('strong');
      title.textContent = step.title || 'Next action';
      li.appendChild(title);
      if (step.description) {
        const desc = document.createElement('p');
        desc.style.margin = '0';
        desc.textContent = step.description;
        li.appendChild(desc);
      }
      nextStepsList.appendChild(li);
    });
  }

  function renderPastSports(entries) {
    if (!pastSportsList) return;
    pastSportsList.innerHTML = '';
    if (!entries.length) {
      const li = document.createElement('li');
      li.className = 'alignment-item';
      li.textContent = 'Add past sports in intake to see carryover insights here.';
      pastSportsList.appendChild(li);
      return;
    }
    entries.forEach((entry) => {
      const li = document.createElement('li');
      li.className = 'alignment-item';
      const title = document.createElement('strong');
      title.textContent = entry.sport_subcategory_id || 'Past sport';
      li.appendChild(title);
      const meta = document.createElement('div');
      meta.className = 'alignment-item__meta';
      if (entry.years_played) {
        meta.appendChild(createMetaChip(`Years: ${entry.years_played}`));
      }
      if (entry.intensity) {
        meta.appendChild(createMetaChip(`Intensity: ${entry.intensity}`));
      }
      if (entry.liked !== undefined) {
        meta.appendChild(createMetaChip(entry.liked ? 'Enjoyed' : 'Did not enjoy'));
      }
      if (entry.had_flair !== undefined) {
        meta.appendChild(createMetaChip(entry.had_flair ? 'Felt natural' : 'Needs work'));
      }
      if (entry.achieved_skill !== undefined) {
        meta.appendChild(createMetaChip(entry.achieved_skill ? 'Skillful' : 'Developing'));
      }
      if (meta.children.length) li.appendChild(meta);
      pastSportsList.appendChild(li);
    });
  }

  function createMetaChip(label) {
    const span = document.createElement('span');
    span.textContent = label;
    return span;
  }

  function renderMatches(matches) {
    if (!matchGrid) return;
    matchGrid.innerHTML = '';
    if (!matches.length) {
      const div = document.createElement('div');
      div.className = 'alignment-item';
      div.textContent = 'No shortlisted sports returned.';
      matchGrid.appendChild(div);
      return;
    }
    matches.forEach((match, index) => {
      const card = document.createElement('article');
      card.className = 'match-card';

      const header = document.createElement('div');
      header.className = 'match-card__header';
      const rank = document.createElement('span');
      rank.className = 'match-card__rank';
      rank.textContent = `${index + 1}`;
      header.appendChild(rank);

      const titleWrap = document.createElement('div');
      const sportName = ((match.optimal_body || {}).sport_slug || 'Sport').replace(/[-_]/g, ' ');
      const h3 = document.createElement('h3');
      h3.textContent = sportName;
      titleWrap.appendChild(h3);
      const subtitle = document.createElement('p');
      subtitle.className = 'match-card__subtitle';
      subtitle.textContent = (match.optimal_body || {}).cohort || '';
      titleWrap.appendChild(subtitle);
      header.appendChild(titleWrap);

      const score = document.createElement('span');
      score.className = 'match-card__score';
      score.textContent = `${Math.round((match.score || 0) * 100)}%`;
      header.appendChild(score);

      card.appendChild(header);

      const summary = document.createElement('p');
      summary.className = 'match-card__summary';
      summary.textContent = ((match.optimal_body || {}).spec || {}).rationale || 'This sport aligns well with your profile.';
      card.appendChild(summary);

      matchGrid.appendChild(card);
    });
  }

  function renderPremiumMeasurements(matches) {
    if (!measurementsContainer) return;
    measurementsContainer.innerHTML = '';
    if (!matches.length) {
      const placeholder = document.createElement('p');
      placeholder.className = 'premium-measurement-empty';
      placeholder.textContent = 'Measurement and factor breakdowns appear alongside each premium match.';
      measurementsContainer.appendChild(placeholder);
      return;
    }
    matches.forEach((match, index) => {
      const detailEntries = match.score_breakdown?.measurements_detail || match.measurements_detail || [];
      const tableHtml = detailEntries.length
        ? buildMeasurementComparisonTableHtml(detailEntries)
        : '<p class="premium-measurement-card__empty">Measurement detail will arrive once available.</p>';
      const factorHtml = buildFactorListHtml(match);

      const card = document.createElement('article');
      card.className = 'premium-measurement-card';

      const header = document.createElement('header');
      header.className = 'premium-measurement-card__header';
      const rank = document.createElement('span');
      rank.className = 'match-card__rank';
      rank.textContent = `#${index + 1}`;
      const titleGroup = document.createElement('div');
      const sportName = (match.optimal_body?.sport?.name || match.optimal_body?.sport_slug || 'Sport').replace(/[-_]/g, ' ');
      const h3 = document.createElement('h3');
      h3.textContent = sportName;
      titleGroup.appendChild(h3);
      const cohortLabel = document.createElement('p');
      cohortLabel.className = 'match-card__subtitle';
      cohortLabel.textContent = match.optimal_body?.spec?.cohort || '';
      titleGroup.appendChild(cohortLabel);
      header.appendChild(rank);
      header.appendChild(titleGroup);
      const score = document.createElement('span');
      score.className = 'match-card__score';
      const rawScore = match.score ?? match.fit_score ?? 0;
      const normalizedScore = normalizeExactScore(rawScore) ?? 0;
      score.textContent = `${Math.round(normalizedScore * 100)}%`;
      header.appendChild(score);

      card.appendChild(header);

      const tableWrapper = document.createElement('div');
      tableWrapper.className = 'premium-measurement-card__table';
      tableWrapper.innerHTML = tableHtml;
      card.appendChild(tableWrapper);

      if (factorHtml) {
        const factorWrapper = document.createElement('div');
        factorWrapper.className = 'premium-measurement-card__factors';
        factorWrapper.innerHTML = factorHtml;
        card.appendChild(factorWrapper);
      }

      measurementsContainer.appendChild(card);
    });
  }

  function buildFactorListHtml(match) {
    const factorList = match.factors || match.score_breakdown?.factors || [];
    if (!Array.isArray(factorList) || !factorList.length) return '';
    const rows = factorList
      .map((factor) => {
        const label = factor.name || factor.label || factor.key || 'Factor';
        const value = factor.value ?? factor.score_percent ?? factor.score ?? '';
        const detail = factor.detail || factor.summary || '';
        const displayValue = typeof value === 'number' ? `${Math.round(value)}%` : value;
        const meta = detail ? `<p class="premium-measurement-factor__meta">${escapeHtml(detail)}</p>` : '';
        return `
          <div class="premium-measurement-factor">
            <strong>${escapeHtml(label)}</strong>
            <span>${escapeHtml(displayValue)}</span>
            ${meta}
          </div>
        `;
      })
      .join('');
    return `<div class="premium-measurement-factor-list">${rows}</div>`;
  }

  function buildMeasurementComparisonTableHtml(entries) {
    if (!entries.length) return '';
    const rows = entries
      .slice(0, 5)
      .map((entry) => {
        const label = escapeHtml(entry.label || entry.key || 'Measurement');
        const userValue = escapeHtml(String(entry.user_value ?? entry.user_value_display ?? '—'));
        const cohortMean = escapeHtml(String(typeof entry.cohort_mean !== 'undefined' ? entry.cohort_mean : '—'));
        const cohortStd = entry.cohort_std_dev ? escapeHtml(String(entry.cohort_std_dev)) : null;
        const cohortText = cohortStd ? `${cohortMean} ± ${cohortStd}` : cohortMean;
        const fitValue = typeof entry.fit_score === 'number' ? entry.fit_score : typeof entry.fit === 'number' ? entry.fit : null;
        const fitPercent = fitValue !== null && Number.isFinite(fitValue) ? Math.max(0, Math.min(100, Math.round(fitValue))) : 0;
        const reasoning = entry.reasoning_short ? `<p class="results-metrics__note">${escapeHtml(entry.reasoning_short)}</p>` : '';
        return `
          <tr>
            <th scope="row">
              ${label}
              ${reasoning}
            </th>
            <td>${userValue}</td>
            <td>${cohortText}</td>
            <td>
              <div class="results-fit">
                <div class="results-fit__bar">
                  <div class="results-fit__bar-fill" style="width:${fitPercent}%;"></div>
                </div>
                <span class="results-fit__label">${fitPercent}%</span>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
    return `
      <table class="results-metrics__table-body">
        <caption>Measurement comparisons</caption>
        <thead>
          <tr>
            <th scope="col">Measurement</th>
            <th scope="col">You</th>
            <th scope="col">Optimal body</th>
            <th scope="col">Fit</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function normalizeExactScore(value) {
    if (value === null || value === undefined) return null;
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return null;
    return Math.min(1, Math.max(0, numeric));
  }

  function escapeHtml(value) {
    return (value || '')
      .toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
