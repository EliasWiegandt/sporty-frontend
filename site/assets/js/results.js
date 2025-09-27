(function () {
  const container = document.querySelector('[data-results]');
  const fallback = document.querySelector('[data-empty-state]');
  const messageEl = document.querySelector('[data-results-message]');
  const historySection = document.querySelector('[data-history-picker]');
  const historySelect = document.querySelector('[data-history-select]');
  const historyRefreshBtn = document.querySelector('[data-history-refresh]');
  const storageBase = resolveStorageBase();
  const sportyApp = window.SportyApp;

  if (!container) return;

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
    const fragment = document.createDocumentFragment();

    data.matches.forEach((match, index) => {
      const rank = index + 1;
      const body = match.optimal_body || {};
      const spec = body.spec || {};
      const sport = body.sport || {};
      const hierarchy = Array.isArray(body.category_hierarchy) ? body.category_hierarchy : [];
      const cardMedia = match.media && match.media.card ? match.media.card : spec.media && spec.media.card ? spec.media.card : null;
      const imageUrl = resolveMediaUrl(cardMedia, storageBase);
      const imageAlt = cardMedia && cardMedia.alt ? cardMedia.alt : 'Sports image';

      const roleNames = hierarchy
        .filter((level) => level.key !== 'sport' && level.name)
        .map((level) => level.name);
      const subtitle = roleNames.length ? roleNames.join(' · ') : '';

      const article = document.createElement('article');
      article.className = 'card result-card';
      const mediaMarkup = imageUrl
        ? `<img class="result-card__image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(imageAlt)}" loading="lazy" />`
        : placeholderFigure(sport.name || body.sport_slug || 'sport');

      article.innerHTML = `
        <header class="result-card__header">
          <span class="result-card__rank">#${rank}</span>
          <div>
            <h3>${escapeHtml(sport.name || body.sport_slug || 'Sport match')}</h3>
            ${subtitle ? `<p class="result-card__roles">${escapeHtml(subtitle)}</p>` : ''}
          </div>
        </header>
        ${mediaMarkup}
        ${renderHierarchyDetails(hierarchy, sport.name || body.sport_slug)}
        ${renderRationale(spec)}
        ${renderAthletes(spec.example_athletes)}
        ${renderMetrics(match.score_breakdown)}
      `;

      fragment.appendChild(article);
    });

    container.innerHTML = '';
    container.appendChild(fragment);
  }

  function showFallback() {
    if (fallback) fallback.hidden = false;
    container.innerHTML = '';
  }

  function hideFallback() {
    if (fallback) fallback.hidden = true;
  }

  function renderHierarchyDetails(hierarchy, sportName) {
    if (!Array.isArray(hierarchy) || !hierarchy.length) {
      return '';
    }

    const ordered = orderHierarchy(hierarchy, sportName);

    const items = ordered
      .filter((item) => item && (item.name || item.description))
      .map((item) => {
        const name = escapeHtml(item.name || '') || item.key;
        const description = escapeHtml(item.description || '');
        return `
          <div class="result-card__details-item">
            <strong>${name}</strong>
            ${description ? `<p>${description}</p>` : ''}
          </div>
        `;
      })
      .join('');

    return items ? `<section class="result-card__section result-card__details">${items}</section>` : '';
  }

  function renderRationale(spec) {
    const text = escapeHtml(spec.rationale || spec.description || 'Description coming soon.');
    return `
      <section class="result-card__section result-card__rationale">
        <h4>Physical characteristics</h4>
        <p>${text}</p>
      </section>
    `;
  }

  function placeholderFigure(label) {
    const safeLabel = escapeHtml(label || 'sport');
    return `
      <figure class="image-placeholder result-card__image" aria-label="Placeholder image for ${safeLabel}">
        <span>Image placeholder — ${safeLabel} in action.</span>
      </figure>
    `;
  }

  function renderAthletes(athletes) {
    if (!Array.isArray(athletes) || !athletes.length) {
      return '';
    }

    const list = athletes.map((name) => `<li>${escapeHtml(name)}</li>`).join('');
    return `
      <section class="result-card__section">
        <h4>Example athletes</h4>
        <ul class="result-card__athletes">${list}</ul>
      </section>
    `;
  }

  function renderMetrics(breakdown) {
    if (!breakdown) return '';

    const rows = Object.entries(breakdown)
      .sort(([, a], [, b]) => (b || 0) - (a || 0))
      .map(([metric, score]) => `
        <tr>
          <th scope="row">${formatMetric(metric)}</th>
          <td>${score || 0}</td>
        </tr>
      `)
      .join('');

    return `
      <section class="result-card__section result-card__section--stretch">
        <h4>How your measurements matched</h4>
        <table class="table result-card__table">
          <tbody>${rows}</tbody>
        </table>
      </section>
    `;
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

    const cleanedPath = card.path.replace(/^\/+/, '');
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

  function orderHierarchy(hierarchy, sportName) {
    const sport = hierarchy.find((item) => item.key === 'sport');
    const rest = hierarchy.filter((item) => item.key !== 'sport');
    const ordered = [];
    if (sport) ordered.push(sport);
    ordered.push(...rest);
    if (!ordered.length && sportName) {
      ordered.push({ key: 'sport', name: sportName });
    }
    return ordered;
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
