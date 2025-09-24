(function () {
  const container = document.querySelector('[data-results]');
  const fallback = document.querySelector('[data-empty-state]');
  const storageBase = resolveStorageBase();

  if (!container) return;

  try {
    const raw = sessionStorage.getItem('sporty:lastResult');
    if (!raw) {
      if (fallback) fallback.hidden = false;
      return;
    }

    const data = JSON.parse(raw);
    const matches = Array.isArray(data.matches) ? data.matches : [];

    if (!matches.length) {
      if (fallback) fallback.hidden = false;
      return;
    }

    const fragment = document.createDocumentFragment();

    matches.forEach((match, index) => {
      const rank = index + 1;
      const body = match.optimal_body || {};
      const spec = body.spec || {};
      const sport = body.sport || {};
      const hierarchy = Array.isArray(body.category_hierarchy) ? body.category_hierarchy : [];
      const cardMedia = spec.media && spec.media.card ? spec.media.card : null;
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
  } catch (error) {
    console.error('Unable to parse stored result', error);
    if (fallback) fallback.hidden = false;
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
    const sportLevel = hierarchy.find((item) => item.key === 'sport');
    const others = hierarchy.filter((item) => item.key !== 'sport');

    if (!sportLevel && !sportName) {
      return hierarchy;
    }

    const result = [];

    if (sportLevel) {
      result.push(sportLevel);
    } else if (sportName) {
      result.push({ key: 'sport', name: sportName, description: '' });
    }

    return result.concat(others);
  }
})();
