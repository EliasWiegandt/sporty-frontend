(function () {
  const impactSection = document.querySelector('[data-impact-summary]');
  const impactBar = document.querySelector('[data-impact-bar]');
  const impactLegend = document.querySelector('[data-impact-legend]');
  const matchesSection = document.querySelector('[data-results-matches]');
  const matchGrid = document.querySelector('[data-match-grid]');
  const highlightsSection = document.querySelector('[data-results-highlights]');
  const highlightsList = document.querySelector('[data-highlights-list]');
  const metricsSection = document.querySelector('[data-results-metrics]');
  const componentsTableEl = document.querySelector('[data-components-table]');
  const measurementsTableEl = document.querySelector('[data-measurements-table]');
  const fallback = document.querySelector('[data-empty-state]');
  const messageEl = document.querySelector('[data-results-message]');
  const historySection = document.querySelector('[data-history-picker]');
  const historySelect = document.querySelector('[data-history-select]');
  const historyRefreshBtn = document.querySelector('[data-history-refresh]');
  const storageBase = resolveStorageBase();
  const sportyApp = window.SportyApp;

  if (!matchesSection && !impactSection && !metricsSection && !fallback) {
    return;
  }

  let sportySnapshot = { user: null, hasConsent: false };
  let historyEntries = [];

  const sessionResult = readSessionResult();
  if (sessionResult) {
    displayResult(sessionResult);
  } else {
    showFallback();
  }

  if (sportyApp && sportyApp.ready) {
    sportyApp.ready.then(() => {
      if (typeof sportyApp.onAuthChange === 'function') {
        sportyApp.onAuthChange((snapshot) => {
          sportySnapshot = snapshot;
          updateMessage(snapshot);
          if (snapshot.user) {
            if (snapshot.hasConsent) {
              loadHistory(true);
            } else {
              historyEntries = [];
              hideHistory();
              if (!readSessionResult()) {
                showFallback();
              }
            }
          } else {
            historyEntries = [];
            hideHistory();
            if (!readSessionResult()) {
              showFallback();
            }
          }
        });
      } else {
        updateMessage(sportySnapshot);
      }
    });
  } else {
    updateMessage(sportySnapshot);
  }

  if (historySelect) {
    historySelect.addEventListener('change', () => {
      const selectedId = historySelect.value;
      const entry = historyEntries.find((item) => item.id === selectedId);
      if (entry && entry.summary) {
        displayResult(entry.summary);
      }
    });
  }

  if (historyRefreshBtn) {
    historyRefreshBtn.addEventListener('click', () => loadHistory(true));
  }

  function readSessionResult() {
    try {
      const raw = sessionStorage.getItem('sporty:lastResult');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      console.error('Unable to parse stored result', error);
      return null;
    }
  }

  async function loadHistory(force = false) {
    if (!sportyApp || !sportySnapshot.user || typeof sportyApp.fetchRecommendations !== 'function') {
      hideHistory();
      return [];
    }

    if (!force && historyEntries.length) {
      showHistory();
      return historyEntries;
    }

    try {
      const results = await sportyApp.fetchRecommendations(25);
      historyEntries = (results || []).map((entry) => ({
        id: entry.id,
        created_at: entry.created_at,
        summary: normalizeSummary(entry.summary),
      }));
      populateHistory(historyEntries);
      if (historyEntries.length) {
        showHistory();
        const latest = historyEntries[0];
        historySelect.value = latest.id;
        displayResult(latest.summary);
      } else {
        hideHistory();
      }
      return historyEntries;
    } catch (error) {
      console.error('Failed to load recommendation history', error);
      hideHistory();
      return [];
    }
  }

  function populateHistory(entries) {
    if (!historySelect) return;
    historySelect.innerHTML = '';
    entries.forEach((entry) => {
      const option = document.createElement('option');
      const created = entry.created_at ? new Date(entry.created_at) : null;
      const label = created
        ? created.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'Saved result';
      option.value = entry.id;
      option.textContent = label;
      historySelect.appendChild(option);
    });
  }

  function showHistory() {
    if (historySection) historySection.hidden = false;
    if (historySelect) historySelect.disabled = false;
  }

  function hideHistory() {
    if (historySection) historySection.hidden = true;
    if (historySelect) historySelect.disabled = true;
  }

  function updateMessage(snapshot) {
    if (!messageEl) return;
    if (snapshot && snapshot.user) {
      if (snapshot.hasConsent) {
        messageEl.textContent = 'You are signed in. Select any saved run from the list below.';
      } else {
        messageEl.textContent = 'Grant data-retention consent from your profile to start saving runs automatically.';
      }
    } else {
      messageEl.textContent = 'Sign in to automatically store each run and revisit them anytime.';
    }
  }

  function displayResult(data) {
    if (!data || !Array.isArray(data.matches) || !data.matches.length) {
      showFallback();
      return;
    }

    hideFallback();

    const matches = data.matches.slice(0, 3);
    const topMatch = matches[0];
    const metricsData = extractMetrics(topMatch ? topMatch.score_breakdown : null);

    renderImpact(metricsData.componentsData);
    renderMatches(matches);
    renderHighlights(topMatch, metricsData);
    renderTables(metricsData);
  }

  function renderImpact(components) {
    if (!impactSection || !impactBar || !impactLegend) return;
    if (!components || !components.length) {
      impactSection.hidden = true;
      impactBar.innerHTML = '';
      impactLegend.innerHTML = '';
      return;
    }

    const totalWeight = components.reduce((sum, entry) => {
      const weight = typeof entry.weight === 'number' ? entry.weight : null;
      if (weight !== null && !Number.isNaN(weight)) return sum + Math.max(weight, 0);
      if (typeof entry.scoreNormalized === 'number') return sum + Math.max(entry.scoreNormalized, 0);
      return sum + 1;
    }, 0) || components.length;

    impactBar.innerHTML = components
      .map((entry, index) => {
        const weightValue = typeof entry.weight === 'number' ? Math.max(entry.weight, 0) : null;
        const base = weightValue !== null && !Number.isNaN(weightValue) ? weightValue : (entry.scoreNormalized || 1);
        const ratio = base / totalWeight;
        const flexValue = Math.max(ratio, 0.08);
        const color = pickComponentColor(entry.key, index);
        return `<div class="impact-bar__segment" style="flex:${flexValue}; background:${color};" aria-label="${escapeHtml(entry.label)}" data-label="${escapeHtml(entry.label.slice(0, 8))}"></div>`;
      })
      .join('');

    impactLegend.innerHTML = components
      .map((entry, index) => {
        const color = pickComponentColor(entry.key, index);
        const display = entry.displayWeight || entry.displayScore || '—';
        return `<li><span style="background:${color};"></span>${escapeHtml(entry.label)} · ${escapeHtml(display)}</li>`;
      })
      .join('');

    impactSection.hidden = false;
  }

  function renderMatches(matches) {
    if (!matchesSection || !matchGrid) return;
    if (!matches || !matches.length) {
      matchesSection.hidden = true;
      matchGrid.innerHTML = '';
      return;
    }

    const cards = matches.map((match, index) => buildMatchCard(match, index + 1)).join('');
    matchGrid.innerHTML = cards;
    matchesSection.hidden = false;
  }

  function buildMatchCard(match, rank) {
    const body = match.optimal_body || {};
    const spec = body.spec || {};
    const sport = body.sport || {};
    const hierarchy = Array.isArray(body.category_hierarchy) ? body.category_hierarchy : [];
    const cardMedia = match.media && match.media.card ? match.media.card : spec.media && spec.media.card ? spec.media.card : null;
    const imageUrl = resolveMediaUrl(cardMedia, storageBase);
    const imageAlt = cardMedia && cardMedia.alt ? cardMedia.alt : 'Sport illustration';
    const subtitle = formatHierarchySubtitle(hierarchy, sport.name || body.sport_slug);
    const metricsData = extractMetrics(match.score_breakdown || {});
    const topMeasurements = (metricsData.measurements || []).slice(0, 3);
    const summary = spec.rationale || spec.description || match.summary || 'Body alignment and biomechanics support this sport.';
    const score = formatScore(match);
    const mediaMarkup = imageUrl
      ? `<div class="match-card__media"><img class="match-card__image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(imageAlt)}" loading="lazy" /></div>`
      : `<div class="match-card__media match-card__media--empty"><span class="match-card__placeholder">Image coming soon · ${escapeHtml(sport.name || 'Sport')}</span></div>`;

    return `
      <article class="match-card">
        <header class="match-card__header">
          <span class="match-card__rank">#${rank}</span>
          <div>
            <h3>${escapeHtml(sport.name || body.sport_slug || 'Sport match')}</h3>
            ${subtitle ? `<p class="match-card__subtitle">${escapeHtml(subtitle)}</p>` : ''}
          </div>
          <span class="match-card__score">${score !== null ? escapeHtml(String(score)) : '—'}</span>
        </header>
        ${mediaMarkup}
        <p class="match-card__summary">${escapeHtml(truncateText(summary, 160))}</p>
        <ul class="match-card__list">
          ${topMeasurements.length
            ? topMeasurements.map((entry) => `<li>${escapeHtml(entry.label)} · ${escapeHtml(entry.displayScore)}</li>`).join('')
            : '<li>Weighing body metrics only for now. Premium inputs add more nuance.</li>'}
        </ul>
      </article>
    `;
  }

  function renderHighlights(match, metricsData) {
    if (!highlightsSection || !highlightsList) return;
    const highlights = gatherHighlights(match, metricsData);
    if (!highlights.length) {
      highlightsSection.hidden = true;
      highlightsList.innerHTML = '';
      return;
    }

    highlightsList.innerHTML = highlights
      .slice(0, 3)
      .map((text, index) => `<li class="results-highlights__item"><span>${index + 1}.</span><span>${escapeHtml(text)}</span></li>`)
      .join('');
    highlightsSection.hidden = false;
  }

  function gatherHighlights(match, metricsData) {
    const result = [];
    if (!match) return result;
    const spec = match.optimal_body && match.optimal_body.spec ? match.optimal_body.spec : {};

    if (Array.isArray(match.highlights)) {
      result.push(...match.highlights);
    }
    if (Array.isArray(spec.highlights)) {
      result.push(...spec.highlights);
    }
    if (spec.tagline) {
      result.push(spec.tagline);
    }

    const measurementEntries = (metricsData && metricsData.measurements) || [];
    measurementEntries.slice(0, 3).forEach((entry) => {
      if (entry.displayScore) {
        result.push(`${entry.label} aligned at ${entry.displayScore}`);
      }
    });

    const filtered = Array.from(new Set(result.map((item) => (item || '').trim()))).filter(Boolean);
    if (!filtered.length) {
      filtered.push('Strong overall body alignment drove this recommendation.');
      filtered.push('Update measurements after a training block to see how your matches evolve.');
    }
    return filtered;
  }

  function renderTables(metricsData) {
    if (!metricsSection) return;
    const hasComponents = Boolean(metricsData.componentsTable);
    const hasMeasurements = Boolean(metricsData.measurementsTable);

    if (componentsTableEl) {
      componentsTableEl.hidden = !hasComponents;
      componentsTableEl.innerHTML = metricsData.componentsTable || '';
    }
    if (measurementsTableEl) {
      measurementsTableEl.hidden = !hasMeasurements;
      measurementsTableEl.innerHTML = metricsData.measurementsTable || '';
    }

    metricsSection.hidden = !(hasComponents || hasMeasurements);
  }

  function showFallback() {
    if (fallback) fallback.hidden = false;
    [matchesSection, impactSection, highlightsSection, metricsSection].forEach((section) => {
      if (section) section.hidden = true;
    });
    if (matchGrid) matchGrid.innerHTML = '';
    if (componentsTableEl) componentsTableEl.innerHTML = '';
    if (measurementsTableEl) measurementsTableEl.innerHTML = '';
    if (impactBar) impactBar.innerHTML = '';
    if (impactLegend) impactLegend.innerHTML = '';
    if (highlightsList) highlightsList.innerHTML = '';
  }

  function hideFallback() {
    if (fallback) fallback.hidden = true;
  }

  function extractMetrics(breakdown) {
    const componentsData = [];
    const measurements = [];

    if (breakdown && typeof breakdown === 'object') {
      const components = breakdown.components && typeof breakdown.components === 'object' ? breakdown.components : null;
      if (components) {
        Object.entries(components).forEach(([key, info]) => {
          const scoreNormalized = normalizePercentValue(info && info.score);
          const weightNormalized = normalizePercentValue(info && info.weight);
          componentsData.push({
            key,
            label: formatComponent(key),
            scoreNormalized: scoreNormalized !== null ? scoreNormalized / 100 : null,
            displayScore: scoreNormalized !== null ? `${scoreNormalized}%` : null,
            weight: typeof info?.weight === 'number' ? info.weight : null,
            displayWeight: weightNormalized !== null ? `${weightNormalized}%` : null,
          });
        });
      }

      const metricsSource = breakdown.metrics && typeof breakdown.metrics === 'object' ? breakdown.metrics : null;
      const sourceEntries = metricsSource ? Object.entries(metricsSource) : [];
      sourceEntries.forEach(([key, value]) => {
        const normalized = normalizePercentValue(value);
        if (normalized !== null) {
          measurements.push({
            key,
            label: formatMetric(key),
            score: normalized,
            displayScore: `${normalized}%`,
          });
        }
      });
    }

    measurements.sort((a, b) => (b.score || 0) - (a.score || 0));

    const componentsTable = componentsData.length
      ? buildComponentsTable(componentsData)
      : '';
    const measurementsTable = measurements.length
      ? buildMeasurementsTable(measurements)
      : '';

    return { componentsData, measurements, componentsTable, measurementsTable };
  }

  function buildComponentsTable(components) {
    const rows = components
      .map((entry) => `
        <tr>
          <th scope="row">${escapeHtml(entry.label)}</th>
          <td>${escapeHtml(entry.displayScore || '—')}</td>
          <td>${escapeHtml(entry.displayWeight || '—')}</td>
        </tr>
      `)
      .join('');
    return `
      <table>
        <caption>Signal contributions</caption>
        <thead>
          <tr>
            <th scope="col">Signal</th>
            <th scope="col">Score</th>
            <th scope="col">Weight</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function buildMeasurementsTable(entries) {
    const rows = entries
      .map((entry) => `
        <tr>
          <th scope="row">${escapeHtml(entry.label)}</th>
          <td>${escapeHtml(entry.displayScore)}</td>
        </tr>
      `)
      .join('');
    return `
      <table>
        <caption>Measurement alignment</caption>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function formatScore(match) {
    if (!match) return null;
    const raw = match.score ?? match.fit_score ?? match.total_score ?? (match.score_breakdown && match.score_breakdown.total);
    const normalized = normalizePercentValue(raw);
    return normalized !== null ? `${normalized}%` : null;
  }

  function normalizePercentValue(value) {
    if (value === null || typeof value === 'undefined') return null;
    const num = Number(value);
    if (Number.isNaN(num)) return null;
    if (!Number.isFinite(num)) return null;
    if (Math.abs(num) <= 1) {
      return Math.round(num * 100);
    }
    return Math.round(num);
  }

  function formatHierarchySubtitle(hierarchy, fallbackName) {
    if (!Array.isArray(hierarchy) || !hierarchy.length) return fallbackName || '';
    const names = hierarchy
      .filter((item) => item && item.key !== 'sport' && item.name)
      .map((item) => item.name);
    return names.join(' · ');
  }

  function pickComponentColor(key, index) {
    const palette = {
      body: '#0f766e',
      preferences: '#f97316',
      goals: '#6366f1',
      injuries: '#ef4444',
      past_sports: '#14b8a6',
      default: ['#0f766e', '#2563eb', '#f97316', '#14b8a6', '#9333ea'],
    };
    if (key && palette[key]) return palette[key];
    return palette.default[index % palette.default.length];
  }

  function truncateText(text, maxLength) {
    if (!text) return '';
    const normalized = String(text).trim();
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, maxLength - 1).trim()}…`;
  }

  function resolveStorageBase() {
    if (typeof self !== 'undefined' && self.SPORTY_CONFIG && typeof self.SPORTY_CONFIG.SUPABASE_STORAGE_URL === 'string') {
      return self.SPORTY_CONFIG.SUPABASE_STORAGE_URL.replace(/\/$/, '');
    }
    if (typeof self !== 'undefined' && typeof self.SUPABASE_STORAGE_URL === 'string') {
      return self.SUPABASE_STORAGE_URL.replace(/\/$/, '');
    }
    return '';
  }

  function resolveMediaUrl(card, base) {
    if (!card) return null;
    if (card.url) return card.url;
    if (!card.path) return null;
    const cleanedPath = card.path.replace(/^\/+/g, '');
    if (base) return `${base}/${cleanedPath}`;
    if (/^https?:/i.test(card.path)) return card.path;
    return null;
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

  function formatMetric(metric) {
    switch (metric) {
      case 'height_cm':
        return 'Height';
      case 'weight_kg':
        return 'Weight';
      case 'arm_span_cm':
        return 'Arm span';
      case 'leg_inseam_cm':
        return 'Leg inseam';
      case 'shoulder_width_cm':
        return 'Shoulder width';
      case 'hip_width_cm':
        return 'Hip width';
      case 'hand_length_cm':
        return 'Hand length';
      case 'foot_length_cm':
        return 'Foot length';
      default:
        return metric;
    }
  }

  function formatComponent(name) {
    switch (name) {
      case 'body':
        return 'Body alignment';
      case 'preferences':
        return 'Preferences';
      case 'goals':
        return 'Goals';
      case 'injuries':
        return 'Injuries';
      case 'past_sports':
        return 'Past sports';
      default:
        return name.charAt(0).toUpperCase() + name.slice(1);
    }
  }

  function normalizeSummary(summary) {
    if (!summary) return { matches: [] };
    if (summary.matches && Array.isArray(summary.matches)) {
      return summary;
    }
    try {
      const parsed = typeof summary === 'string' ? JSON.parse(summary) : summary;
      return parsed && parsed.matches ? parsed : { matches: [] };
    } catch (error) {
      return { matches: [] };
    }
  }
})();
