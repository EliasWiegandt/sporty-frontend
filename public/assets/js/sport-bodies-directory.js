(function () {
  const grid = document.querySelector('[data-directory-grid]');
  const countEl = document.querySelector('[data-directory-count]');
  const searchEl = document.getElementById('sport-body-search');
  if (!grid || !countEl || !searchEl) return;

  let items = [];

  function resolveStorageBase() {
    if (
      typeof window !== 'undefined' &&
      window.SPORTY_CONFIG &&
      typeof window.SPORTY_CONFIG.SUPABASE_STORAGE_URL === 'string'
    ) {
      return window.SPORTY_CONFIG.SUPABASE_STORAGE_URL.replace(/\/$/, '');
    }
    return '';
  }

  function resolveMediaUrl(path) {
    if (!path) return null;
    const value = String(path);
    if (/^https?:\/\//i.test(value)) return value;
    const storageBase = resolveStorageBase();
    if (!storageBase) return value.startsWith('/') ? value : `/${value}`;
    return `${storageBase}/${value.replace(/^\/+/g, '')}`;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function render(list) {
    countEl.textContent = `${list.length} profile${list.length === 1 ? '' : 's'}`;
    if (!list.length) {
      grid.innerHTML = '<article class="card-shell"><p class="card-copy">No pages match this search.</p></article>';
      return;
    }
    grid.innerHTML = list
      .map((item) => {
        const mediaPath = resolveMediaUrl(item?.hero_media?.path);
        const mediaAlt = item?.hero_media?.alt || item.title;
        return `
          <article class="card-shell sport-body-directory-card">
            ${
              mediaPath
                ? `<div class="sport-body-directory-card__media"><img class="sport-body-directory-card__image" src="${escapeHtml(mediaPath)}" alt="${escapeHtml(mediaAlt)}" loading="lazy"/><div class="sport-body-directory-card__placeholder" hidden>Image unavailable</div></div>`
                : `<div class="sport-body-directory-card__placeholder">Image unavailable</div>`
            }
            <h2 class="card-title">${escapeHtml(item.title || item.slug || `Body ${item.id}`)}</h2>
            <p class="card-copy">${escapeHtml(item.summary || `${item.sport_slug || ''} / ${item.category_slug || ''}`)}</p>
            <div class="sport-body-directory-card__meta">
              <span class="source-chip source-chip-ok">${escapeHtml(item.sport_slug || 'sport')}</span>
              <span class="source-chip source-chip-ok">${escapeHtml(item.category_slug || 'category')}</span>
              ${Array.isArray(item.cohort_items)
                ? item.cohort_items
                    .map((entry) => `<span class="source-chip source-chip-ok">${escapeHtml(`${entry.label}: ${entry.value}`)}</span>`)
                    .join('')
                : ''}
            </div>
            <div>
              <a class="btn-pill btn-pill-secondary btn-pill-sm" href="${escapeHtml(item.canonical_path || '#')}">Read about this sport body</a>
            </div>
          </article>
        `;
      })
      .join('');

    grid.querySelectorAll('.sport-body-directory-card__image').forEach((img) => {
      img.addEventListener('error', () => {
        const media = img.closest('.sport-body-directory-card__media');
        const fallback = media ? media.querySelector('.sport-body-directory-card__placeholder') : null;
        img.setAttribute('hidden', 'hidden');
        if (fallback) fallback.hidden = false;
      });
    });
  }

  function applySearch() {
    const q = searchEl.value.trim().toLowerCase();
    if (!q) {
      render(items);
      return;
    }
    const filtered = items.filter((item) => {
      const cohortText = Array.isArray(item.cohort_items)
        ? item.cohort_items.map((entry) => `${entry.key} ${entry.label} ${entry.value}`).join(' ')
        : '';
      const haystack = [item.title, item.slug, item.sport_slug, item.category_slug, cohortText].join(' ').toLowerCase();
      return haystack.includes(q);
    });
    render(filtered);
  }

  searchEl.addEventListener('input', applySearch);

  fetch('/api/sport-bodies')
    .then((resp) => (resp.ok ? resp.json() : Promise.reject(new Error('directory fetch failed'))))
    .then((payload) => {
      items = Array.isArray(payload?.items) ? payload.items : [];
      render(items);
    })
    .catch((error) => {
      console.error('[Sporty] Failed to load sport body directory', error);
      countEl.textContent = '0 profiles';
      grid.innerHTML = '<article class="card-shell"><p class="card-copy">Failed to load profiles. Try again.</p></article>';
    });
})();
