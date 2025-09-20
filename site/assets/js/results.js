(function () {
  const container = document.querySelector('[data-results]');
  const fallback = document.querySelector('[data-empty-state]');

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

      const roleNames = hierarchy
        .filter((level) => level.key !== 'sport' && level.name)
        .map((level) => level.name);
      const subtitle = roleNames.length ? roleNames.join(' · ') : '';

      const article = document.createElement('article');
      article.className = 'card result-card';
      article.innerHTML = `
        <header class="result-card__header">
          <span class="result-card__rank">#${rank}</span>
          <div>
            <h3>${escapeHtml(sport.name || body.sport_slug || 'Sport match')}</h3>
            ${subtitle ? `<p class="result-card__roles">${escapeHtml(subtitle)}</p>` : ''}
          </div>
        </header>
        <figure class="image-placeholder result-card__image" aria-label="Placeholder image for ${escapeHtml(sport.name || body.sport_slug || 'sport')}">
          <span>Image placeholder — ${escapeHtml(sport.name || body.sport_slug || 'Sport')} in action.</span>
        </figure>
        ${renderHierarchyDetails(hierarchy)}
        <p class="result-card__rationale">${escapeHtml(spec.rationale || spec.description || 'Description coming soon.')}</p>
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

  function renderHierarchyDetails(hierarchy) {
    if (!Array.isArray(hierarchy) || !hierarchy.length) {
      return '';
    }

    const items = hierarchy
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

    return items
      ? `<section class="result-card__section result-card__details"><h4>Sport breakdown</h4>${items}</section>`
      : '';
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
})();
