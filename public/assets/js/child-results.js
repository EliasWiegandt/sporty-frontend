(function () {
  const summaryEl = document.querySelector('[data-summary]');
  const summaryCopyEl = document.querySelector('[data-summary-copy]');
  const summaryMetaEl = document.querySelector('[data-summary-meta]');
  const resultsEl = document.querySelector('[data-forecast-results]');
  const emptyStateEl = document.querySelector('[data-empty-state]');
  const premiumSection = document.querySelector('[data-premium-section]');
  const premiumTitleEl = document.querySelector('[data-premium-title]');
  const premiumReasonEl = document.querySelector('[data-premium-reason]');
  const premiumCreditWrap = document.querySelector('[data-premium-credit]');
  const premiumCreditAdult = document.querySelector('[data-premium-credit-adult]');
  const premiumCreditChild = document.querySelector('[data-premium-credit-child]');
  const premiumComponentsEl = document.querySelector('[data-premium-components]');
  const premiumPreferencesEl = document.querySelector('[data-premium-preferences]');
  const premiumGoalsEl = document.querySelector('[data-premium-goals]');
  const premiumInjuriesEl = document.querySelector('[data-premium-injuries]');
  const premiumNextStepsEl = document.querySelector('[data-premium-next-steps]');
  const premiumMatchesEl = document.querySelector('[data-premium-matches]');
  const premiumCta = document.querySelector('[data-premium-cta]');
  const premiumPastSportsEl = document.querySelector('[data-premium-past-sports]');

  const rawResult = sessionStorage.getItem('sporty:lastChildForecast');
  if (!rawResult) {
    showEmpty();
    return;
  }

  let result;
  try {
    result = JSON.parse(rawResult);
  } catch (error) {
    console.error('Failed to parse stored child forecast', error);
    showEmpty();
    return;
  }

  const rawRequest = sessionStorage.getItem('sporty:lastChildForecastRequest');
  let requestPayload = null;
  if (rawRequest) {
    try {
      requestPayload = JSON.parse(rawRequest);
    } catch (error) {
      console.warn('Failed to parse stored child forecast request', error);
    }
  }

  const pastSportLabels = new Map();
  if (requestPayload && Array.isArray(requestPayload.past_sports)) {
    requestPayload.past_sports.forEach((entry) => {
      if (!entry || !entry.sport_subcategory_id) return;
      const label = entry.sport_label || entry.label || entry.sport_subcategory_id;
      pastSportLabels.set(entry.sport_subcategory_id, label);
    });
  }

  renderSummary(result, requestPayload);
  renderMeasurements(result);
  renderPremium(result.premium_analysis);

  if (premiumCta) {
    premiumCta.hidden = Boolean(result.premium_analysis);
  }

  function showEmpty() {
    if (emptyStateEl) emptyStateEl.hidden = false;
    if (summaryEl) summaryEl.hidden = true;
    if (resultsEl) resultsEl.hidden = true;
  }

  function renderPremium(premium) {
    if (!premiumSection) return;
    if (!premium) {
      premiumSection.hidden = true;
      return;
    }

    premiumSection.hidden = false;
    if (premiumTitleEl) {
      premiumTitleEl.textContent = premium.suggested_sport || 'Premium sport suggestions';
    }
    if (premiumReasonEl) {
      premiumReasonEl.textContent = premium.reason || 'Premium analysis applied to the forecasted adult build.';
    }

    if (premium.credit && premiumCreditWrap) {
      premiumCreditWrap.hidden = false;
      if (premiumCreditAdult) {
        const adultCredits = premium.credit.totals && premium.credit.totals.adult !== undefined
          ? premium.credit.totals.adult
          : '—';
        premiumCreditAdult.textContent = `Adult credits: ${adultCredits}`;
      }
      if (premiumCreditChild) {
        const childCredits = premium.credit.totals && premium.credit.totals.child !== undefined
          ? premium.credit.totals.child
          : premium.credit.remaining_after;
        premiumCreditChild.textContent = `Child credits: ${childCredits}`;
      }
    } else if (premiumCreditWrap) {
      premiumCreditWrap.hidden = true;
    }

    renderSimpleList(premiumComponentsEl, premium.component_impacts, (item) => {
      const strong = document.createElement('strong');
      strong.textContent = `${item.component || 'Component'} · ${formatPercent(item.weight_percent)} weight`;
      const meta = document.createElement('div');
      meta.className = 'premium-item__meta';
      if (item.score_percent !== undefined && item.score_percent !== null) {
        meta.appendChild(createMetaChip(`Score ${formatPercent(item.score_percent)}`));
      }
      const summary = document.createElement('p');
      summary.style.margin = '0';
      summary.textContent = item.summary || '';
      return [strong, meta, summary];
    });

    renderSimpleList(premiumPreferencesEl, premium.preference_alignment, (item) => {
      const title = document.createElement('strong');
      title.textContent = item.name || item.preference_id;
      const meta = document.createElement('div');
      meta.className = 'premium-item__meta';
      if (item.priority) meta.appendChild(createMetaChip(`Priority: ${item.priority}`));
      if (item.alignment) meta.appendChild(createMetaChip(`Alignment: ${item.alignment}`));
      if (item.score_percent !== undefined && item.score_percent !== null) {
        meta.appendChild(createMetaChip(`Score ${formatPercent(item.score_percent)}`));
      }
      const summary = document.createElement('p');
      summary.style.margin = '0';
      summary.textContent = item.summary || '';
      return [title, meta, summary];
    });

    renderSimpleList(premiumGoalsEl, premium.goal_alignment, (item) => {
      const title = document.createElement('strong');
      title.textContent = item.name || item.goal_id;
      const meta = document.createElement('div');
      meta.className = 'premium-item__meta';
      if (item.priority) meta.appendChild(createMetaChip(`Priority: ${item.priority}`));
      if (item.alignment) meta.appendChild(createMetaChip(`Alignment: ${item.alignment}`));
      if (item.score_percent !== undefined && item.score_percent !== null) {
        meta.appendChild(createMetaChip(`Score ${formatPercent(item.score_percent)}`));
      }
      const summary = document.createElement('p');
      summary.style.margin = '0';
      summary.textContent = item.summary || '';
      return [title, meta, summary];
    });

    renderSimpleList(premiumInjuriesEl, premium.injury_considerations, (item) => {
      const title = document.createElement('strong');
      title.textContent = item.injury_name || item.injury_id;
      const meta = document.createElement('div');
      meta.className = 'premium-item__meta';
      if (item.severity) meta.appendChild(createMetaChip(`Severity: ${item.severity}`));
      if (item.alignment) {
        Object.entries(item.alignment).forEach(([key, value]) => {
          meta.appendChild(createMetaChip(`${key}: ${value}`));
        });
      }
      if (item.score_percent !== undefined && item.score_percent !== null) {
        meta.appendChild(createMetaChip(`Score ${formatPercent(item.score_percent)}`));
      }
      if (item.notes) meta.appendChild(createMetaChip(`Notes: ${item.notes}`));
      const summary = document.createElement('p');
      summary.style.margin = '0';
      summary.textContent = item.guidance || '';
      return [title, meta, summary];
    });

    renderSimpleList(premiumNextStepsEl, premium.next_steps, (item) => {
      const title = document.createElement('strong');
      title.textContent = item.title || 'Next step';
      const summary = document.createElement('p');
      summary.style.margin = '0';
      summary.textContent = item.description || '';
      return [title, summary];
    });

    renderSimpleList(premiumPastSportsEl, premium.past_sports && premium.past_sports.length ? premium.past_sports : result.past_sports, (item) => {
      const title = document.createElement('strong');
      const label =
        item.sport_label ||
        pastSportLabels.get(item.sport_subcategory_id) ||
        item.sport_subcategory_id ||
        'Sport';
      title.textContent = label;
      const meta = document.createElement('div');
      meta.className = 'premium-item__meta';
      if (item.years_played !== undefined && item.years_played !== null) {
        meta.appendChild(createMetaChip(`${item.years_played} yrs`));
      }
      if (item.age_started_years !== undefined && item.age_started_years !== null) {
        meta.appendChild(createMetaChip(`Started at ${item.age_started_years}`));
      }
      if (item.intensity) {
        meta.appendChild(createMetaChip(`Intensity: ${item.intensity}`));
      }
      if (typeof item.liked === 'boolean') {
        meta.appendChild(createMetaChip(item.liked ? 'Enjoyed' : 'Did not enjoy'));
      }
      if (typeof item.had_flair === 'boolean') {
        meta.appendChild(createMetaChip(item.had_flair ? 'Felt natural' : 'No flair'));
      }
      if (typeof item.achieved_skill === 'boolean') {
        meta.appendChild(createMetaChip(item.achieved_skill ? 'Built skill' : 'Still learning'));
      }
      return [title, meta];
    });

    if (premiumMatchesEl) {
      premiumMatchesEl.innerHTML = '';
      const matches = premium.matches || [];
      if (!matches.length) {
        const empty = document.createElement('p');
        empty.textContent = 'No sport matches returned for this premium run.';
        premiumMatchesEl.appendChild(empty);
      } else {
        matches.forEach((match, index) => {
          const card = document.createElement('div');
          card.className = 'premium-item';
          const title = document.createElement('strong');
          const sportName = ((match.optimal_body || {}).sport_slug || 'Sport').replace(/[-_]/g, ' ');
          title.textContent = `${index + 1}. ${sportName}`;
          card.appendChild(title);
          const summary = document.createElement('p');
          summary.style.margin = '0';
          summary.textContent = ((match.optimal_body || {}).spec || {}).rationale || 'This sport aligns with the projected build.';
          card.appendChild(summary);
          premiumMatchesEl.appendChild(card);
        });
      }
    }
  }

  function renderSimpleList(root, items, renderFn) {
    if (!root) return;
    root.innerHTML = '';
    if (!items || !items.length) {
      const li = document.createElement('li');
      li.className = 'premium-item';
      li.textContent = 'No inputs supplied.';
      root.appendChild(li);
      return;
    }
    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'premium-item';
      const parts = renderFn(item) || [];
      parts.forEach((part) => {
        if (!part) return;
        li.appendChild(part);
      });
      root.appendChild(li);
    });
  }

  function createMetaChip(label) {
    const span = document.createElement('span');
    span.textContent = label;
    return span;
  }

  function renderSummary(res, payload) {
    if (!summaryEl || !summaryCopyEl || !summaryMetaEl) return;

    summaryEl.hidden = false;
    if (emptyStateEl) emptyStateEl.hidden = true;

    const childAge = res.child_age_years
      ? `${Number(res.child_age_years).toFixed(2)} years`
      : 'Unknown age';

    const scenario = res.weight_scenario
      ? res.weight_scenario.replace(/_/g, ' ')
      : 'child only';

    summaryCopyEl.textContent = `Projected adult metrics using the ${scenario} weighting scenario. Child age: ${childAge}.`;

    summaryMetaEl.innerHTML = '';
    const entries = [
      {
        label: 'Child cohort',
        value: res.child_age_group?.label || '—',
      },
      {
        label: 'Adult cohort',
        value: res.adult_age_group?.label || '25-35 years',
      },
      {
        label: 'Ethnicity',
        value: payload?.ethnicity || 'General population',
      },
    ];

    if (payload?.guardian_user_id) {
      entries.push({
        label: 'Guardian user id',
        value: payload.guardian_user_id,
      });
    }

    entries.forEach((entry) => {
      const dt = document.createElement('dt');
      dt.textContent = entry.label;
      const dd = document.createElement('dd');
      dd.textContent = entry.value;
      summaryMetaEl.appendChild(dt);
      summaryMetaEl.appendChild(dd);
    });
  }

  function renderMeasurements(res) {
    if (!resultsEl) return;

    const measurements = res.results || {};
    const entries = Object.keys(measurements);
    if (!entries.length) {
      showEmpty();
      return;
    }

    resultsEl.innerHTML = '';
    resultsEl.hidden = false;

    entries.forEach((key) => {
      const measurement = measurements[key];
      const card = document.createElement('article');
      card.className = 'measurement-card';

      const header = document.createElement('div');
      header.className = 'measurement-header';

      const title = document.createElement('h3');
      title.textContent = formatMeasurementLabel(key);
      header.appendChild(title);

      const forecastTag = document.createElement('span');
      forecastTag.textContent = measurement.forecast_value
        ? `${Number(measurement.forecast_value).toFixed(1)} cm forecast`
        : 'Insufficient data';
      forecastTag.style.fontWeight = '600';
      header.appendChild(forecastTag);

      card.appendChild(header);

      const context = document.createElement('p');
      const adultMean = measurement.adult_mean
        ? `${Number(measurement.adult_mean).toFixed(1)} cm mean`
        : '—';
      const adultStd = measurement.adult_std_dev
        ? `${Number(measurement.adult_std_dev).toFixed(1)} cm σ`
        : '—';
      context.textContent = `Adult cohort: ${adultMean}, ${adultStd}. Weighted C-score: ${
        measurement.weighted_c_score !== null &&
        measurement.weighted_c_score !== undefined
          ? Number(measurement.weighted_c_score).toFixed(3)
          : '—'
      }.`;
      card.appendChild(context);

      const table = document.createElement('table');
      table.className = 'contrib-table';

      table.innerHTML = `
        <thead>
          <tr>
            <th>Source</th>
            <th>Value</th>
            <th>C-score</th>
            <th>Weight</th>
            <th>Contribution</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;

      const tbody = table.querySelector('tbody');
      (measurement.sources || []).forEach((src) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${formatSourceLabel(src.source)}</td>
          <td>${formatOptionalNumber(src.value)}</td>
          <td>${formatOptionalNumber(src.c_score, 3)}</td>
          <td>${formatOptionalNumber(src.applied_weight, 2)}</td>
          <td>${formatOptionalNumber(src.contribution_units)}</td>
        `;
        tbody.appendChild(tr);
      });

      card.appendChild(table);
      resultsEl.appendChild(card);
    });
  }

  function formatMeasurementLabel(key) {
    return key
      .replace('_cm', '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function formatSourceLabel(source) {
    return source.charAt(0).toUpperCase() + source.slice(1);
  }

  function formatOptionalNumber(value, digits = 1) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '—';
    }
    return Number(value).toFixed(digits);
  }

  function formatPercent(value) {
    if (value === null || value === undefined) return '0%';
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return '0%';
    return `${numeric.toFixed(1)}%`;
  }
})();
