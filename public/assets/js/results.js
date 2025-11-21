(function () {
  const STORAGE_KEY = 'sporty:lastResult';
  const container = document.querySelector('[data-results-container]');
  const emptyState = document.querySelector('[data-empty-state]');

  // Configuration
  const storageBase = resolveStorageBase();

  function init() {
    if (window.sportyResultsInitialized) {
      return;
    }
    window.sportyResultsInitialized = true;

    const data = readSessionResult();
    if (!data || !data.matches || data.matches.length === 0) {
      showEmptyState();
      return;
    }

    // Sort by score descending
    const sortedMatches = data.matches.sort((a, b) => {
      const scoreA = a.score ?? a.fit_score ?? 0;
      const scoreB = b.score ?? b.fit_score ?? 0;
      return scoreB - scoreA;
    });

    // Take top 3 distinct matches (distinct by optimal body ID)
    const distinctMatches = [];
    const seenBodies = new Set();
    for (const match of sortedMatches) {
      const id = match.optimal_body?.id;
      if (id && !seenBodies.has(id)) {
        seenBodies.add(id);
        distinctMatches.push(match);
      }
      if (distinctMatches.length >= 3) break;
    }

    if (distinctMatches.length === 0) {
      showEmptyState();
      return;
    }

    renderMatches(distinctMatches);
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

  function showEmptyState() {
    if (container) container.hidden = true;
    if (emptyState) emptyState.hidden = false;
  }

  function renderMatches(matches) {
    if (!container) return;
    container.innerHTML = '';
    container.hidden = false;
    console.log('Rendering matches:', matches.length);

    matches.forEach((match, index) => {
      console.log('Rendering match index:', index);
      try {
        const card = buildMatchCard(match, index + 1);
        container.appendChild(card);
        console.log('Appended card for match index:', index);
      } catch (e) {
        console.error('Error rendering match index:', index, e);
      }
    });
  }

  function buildMatchCard(match, rank) {
    const card = document.createElement('article');
    card.className = 'match-card';

    const body = match.optimal_body || {};
    const spec = body.spec || {};
    const sport = body.sport || {};
    const subcategory = body.subcategory || {};

    // 1. Header
    const scoreRaw = match.score ?? match.fit_score ?? 0;
    const scorePercent = Math.round(scoreRaw * 100);
    const title = subcategory.name || body.category_slug || sport.name || body.sport_slug || 'Sport match';

    const header = document.createElement('header');
    header.className = 'match-card__header';
    header.innerHTML = `
      <div class="match-card__rank-badge">#${rank}</div>
      <div class="match-card__title-group">
        <h3 class="match-card__title">${escapeHtml(title)}</h3>
        <span class="match-card__score">${scorePercent}% Match</span>
      </div>
    `;
    card.appendChild(header);

    // 2. Image
    const cardMedia = match.media && match.media.card ? match.media.card : spec.media && spec.media.card ? spec.media.card : null;
    const imageUrl = resolveMediaUrl(cardMedia, storageBase);
    if (imageUrl) {
      const imgContainer = document.createElement('div');
      imgContainer.className = 'match-card__image-container';
      imgContainer.innerHTML = `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" loading="lazy" />`;
      card.appendChild(imgContainer);
    }

    // 3. Descriptions
    const descriptions = document.createElement('div');
    descriptions.className = 'match-card__descriptions';

    const sportDesc = subcategory.description || sport.description;
    if (sportDesc) {
      descriptions.innerHTML += `
        <div class="match-card__desc-block">
          <h4>The Sport</h4>
          <p>${escapeHtml(sportDesc)}</p>
        </div>
      `;
    }

    const bodyReasoning = spec.rationale || spec.overall_description;
    if (bodyReasoning) {
      descriptions.innerHTML += `
        <div class="match-card__desc-block">
          <h4>Why you fit</h4>
          <p>${escapeHtml(bodyReasoning)}</p>
        </div>
      `;
    }
    card.appendChild(descriptions);

    // 4. Factors (Top 5 + Expand)
    const factors = extractFactors(match);
    if (factors.length > 0) {
      const factorsSection = document.createElement('div');
      factorsSection.className = 'match-card__factors';
      factorsSection.innerHTML = `<h4>Top Match Factors</h4>`;

      const list = document.createElement('ul');
      list.className = 'factor-list';

      const visibleFactors = factors.slice(0, 5);
      const hiddenFactors = factors.slice(5);

      visibleFactors.forEach(f => list.appendChild(createFactorItem(f)));

      if (hiddenFactors.length > 0) {
        const hiddenContainer = document.createElement('div');
        hiddenContainer.className = 'factor-list--hidden';
        hiddenContainer.hidden = true;
        hiddenFactors.forEach(f => hiddenContainer.appendChild(createFactorItem(f)));
        list.appendChild(hiddenContainer);

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'btn-ghost btn-sm factor-toggle';
        toggleBtn.textContent = `Show ${hiddenFactors.length} more factors`;
        toggleBtn.onclick = () => {
          const isHidden = hiddenContainer.hidden;
          hiddenContainer.hidden = !isHidden;
          toggleBtn.textContent = isHidden ? 'Show less' : `Show ${hiddenFactors.length} more factors`;
        };
        factorsSection.appendChild(list);
        factorsSection.appendChild(toggleBtn);
      } else {
        factorsSection.appendChild(list);
      }

      card.appendChild(factorsSection);
    }

    // 5. Past Sports
    const pastSports = match.past_sports || [];
    if (pastSports.length > 0) {
      const pastSection = document.createElement('div');
      pastSection.className = 'match-card__past-sports';
      pastSection.innerHTML = `<h4>Past Experience</h4>`;
      const pastList = document.createElement('ul');
      pastList.className = 'past-sport-list';

      pastSports.forEach(ps => {
        const li = document.createElement('li');
        const label = ps.sport_label || ps.label || 'Sport';
        // Use fit_score or score if available, else just list it
        const psScore = ps.fit_score ?? ps.score;
        const psScoreText = psScore ? `(${Math.round(psScore * 100)}% transfer)` : '';
        li.textContent = `${label} ${psScoreText}`;
        pastList.appendChild(li);
      });
      pastSection.appendChild(pastList);
      card.appendChild(pastSection);
    }

    return card;
  }

  function createFactorItem(factor) {
    const li = document.createElement('li');
    li.className = 'factor-item';
    const label = document.createElement('span');
    label.className = 'factor-label';
    label.textContent = factor.label;

    const value = document.createElement('span');
    value.className = 'factor-value';
    // Show user value if available, else fit score
    if (factor.user_value) {
      value.textContent = `${factor.user_value}`;
    } else if (factor.displayScore) {
      value.textContent = factor.displayScore;
    } else {
      value.textContent = 'Match';
    }

    li.appendChild(label);
    li.appendChild(value);
    return li;
  }

  function extractFactors(match) {
    const breakdown = match.score_breakdown || {};
    const spec = match.optimal_body?.spec || {};
    const factors = [];

    // Helper to format labels
    const formatLabel = (key) => key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    // 1. Measurements
    if (breakdown.metrics) {
      Object.entries(breakdown.metrics).forEach(([key, val]) => {
        if (val.fit_score !== undefined) {
          factors.push({
            key,
            label: formatLabel(key),
            score: val.fit_score,
            displayScore: `${Math.round(val.fit_score * 100)}%`,
            user_value: val.user_value,
            type: 'measurement'
          });
        }
      });
    }

    // 2. Traits
    if (breakdown.details && breakdown.details.traits && breakdown.details.traits.body) {
      Object.entries(breakdown.details.traits.body).forEach(([key, val]) => {
        const score = val.fit_score ?? val.score;
        if (score !== undefined) {
          factors.push({
            key,
            label: formatLabel(key),
            score: score,
            displayScore: `${Math.round(score * 100)}%`,
            user_value: val.value, // e.g. "low", "ectomorph"
            type: 'trait'
          });
        }
      });
    }

    // Sort by score descending
    return factors.sort((a, b) => b.score - a.score);
  }

  // Helpers
  function resolveStorageBase() {
    if (typeof self !== 'undefined' && self.SPORTY_CONFIG && typeof self.SPORTY_CONFIG.SUPABASE_STORAGE_URL === 'string') {
      return self.SPORTY_CONFIG.SUPABASE_STORAGE_URL.replace(/\/$/, '');
    }
    return '';
  }

  function resolveMediaUrl(card, base) {
    if (!card) return null;
    if (card.url) return card.url;
    if (!card.path) return null;
    const cleanedPath = card.path.replace(/^\/+/g, '');
    if (base) return `${base}/${cleanedPath}`;
    return null;
  }

  function escapeHtml(value) {
    return (value || '').toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
