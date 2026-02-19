(function () {
  const root = document.querySelector('[data-premium-root]');
  if (!root) return;

  const hero = root.querySelector('[data-premium-hero]');
  const reasonEl = hero ? hero.querySelector('[data-reason]') : null;
  const container = root.querySelector('[data-results-container]');
  const emptyState = root.querySelector('[data-empty-state]');
  const exportPdfButton = root.querySelector('[data-child-export-pdf]');
  const printReportRoot = root.querySelector('[data-child-print-report]');
  const subjectLabel = (root.getAttribute('data-subject-label') || 'You').trim() || 'You';
  const isChildResults = subjectLabel.toLowerCase() === 'child';
  const possessiveLabel = subjectLabel.toLowerCase() === 'you' ? 'Your' : `${subjectLabel}’s`;
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

  const SECTION_STATE = (function () {
    const store =
      window.__sportyPremiumSectionState ||
      (window.__sportyPremiumSectionState = Object.create(null));
    return {
      get(matchKey, sectionKey) {
        return Boolean(store[`${matchKey}:${sectionKey}`]);
      },
      set(matchKey, sectionKey, isOpen) {
        store[`${matchKey}:${sectionKey}`] = Boolean(isOpen);
      },
    };
  })();

  const STICKY_MIN_ITEMS = 8;

  init().catch((error) => {
    console.error('[Sporty] Failed to init premium results page', error);
    if (emptyState) emptyState.hidden = false;
  });

  async function init() {
    let parsed = null;
    const stored = sessionStorage.getItem('sporty:lastPremiumResult');
    if (stored) {
      try {
        parsed = JSON.parse(stored);
      } catch (error) {
        console.error('[Sporty] Failed to parse premium analysis payload', error);
      }
    }

    if (!parsed) {
      const params = new URLSearchParams(window.location.search || '');
      const id = params.get('id');
      if (id) {
        parsed = await fetchPremiumResultById(id);
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

    if (reasonEl) {
      reasonEl.textContent = parsed.reason || 'Based on your measurements and premium inputs.';
    }

    const matches = parsed.matches || [];
    renderMatches(matches);
    setupChildPdfExport(matches);
  }

  async function fetchPremiumResultById(id) {
    try {
      const sportyApp = window.SportyApp || window.sportyApp;
      const client = sportyApp && sportyApp.getClient ? sportyApp.getClient() : null;
      if (!client) return null;

      const { data, error } = await client
        .from('recommendations')
        .select('result_payload, summary')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data && data.result_payload) {
        return data.result_payload;
      }
      if (data && data.summary) {
        try {
          return JSON.parse(data.summary);
        } catch (_) {
          return null;
        }
      }
      return null;
    } catch (error) {
      console.error('[Sporty] Failed to fetch premium analysis by id', error);
      return null;
    }
  }

  function extractFactors(match) {
    const breakdown = match.score_breakdown || {};
    const factors = [];

    const formatLabel = (key) =>
      key
        .replace(/_/g, ' ')
        .replace(' cm', '')
        .replace(/\b\w/g, (l) => l.toUpperCase());

    if (breakdown.metrics) {
      Object.entries(breakdown.metrics).forEach(([key, val]) => {
        if (val.fit_score !== undefined) {
          factors.push({
            key,
            label: formatLabel(key),
            score: val.fit_score,
            match_contribution: val.match_contribution || 0,
            user_value: val.user_value,
            cohort_mean: val.cohort_mean,
            importance: val.importance,
            reasoning: val.reasoning,
            type: 'measurement',
          });
        }
      });
    }

    if (breakdown.details && breakdown.details.traits && breakdown.details.traits.body) {
      Object.entries(breakdown.details.traits.body).forEach(([key, val]) => {
        const score = val.fit_score ?? val.score;
        if (score !== undefined) {
          factors.push({
            key,
            label: formatLabel(key),
            score: score,
            match_contribution: 0,
            user_value: val.value,
            importance: val.importance,
            reasoning: val.reasoning,
            type: 'trait',
          });
        }
      });
    }

    return factors.sort((a, b) => b.match_contribution - a.match_contribution);
  }

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
    if (!container) return;
    container.innerHTML = '';
    if (!matches.length) {
      container.hidden = true;
      if (emptyState) emptyState.hidden = false;
      setChildExportState([]);
      return;
    }
    container.hidden = false;
    try {
      matches
        .slice()
        .sort((a, b) => (b.score ?? b.fit_score ?? 0) - (a.score ?? a.fit_score ?? 0))
        .forEach((match, index) => {
          try {
            const card = buildMatchCard(match, index + 1);
            container.appendChild(card);
          } catch (error) {
            console.error('[Sporty] Failed to render premium match card', error, match);
          }
        });
    } catch (error) {
      console.error('[Sporty] Failed to render premium matches', error);
      container.hidden = true;
      if (emptyState) emptyState.hidden = false;
      setChildExportState([]);
      return;
    }
    setChildExportState(matches);
  }

  function setupChildPdfExport(matches) {
    if (!isChildResults || !exportPdfButton) return;
    exportPdfButton.addEventListener('click', () => {
      if (exportPdfButton.disabled) return;
      renderChildPrintReport(matches);
      window.print();
    });
  }

  function setChildExportState(matches) {
    if (!isChildResults || !exportPdfButton) return;
    const topMatches = getTopMatches(matches);
    exportPdfButton.disabled = topMatches.length < 1;
    if (!topMatches.length) {
      exportPdfButton.setAttribute('aria-disabled', 'true');
      exportPdfButton.title = 'Run a child analysis first to export PDF results.';
      clearPrintReport();
      return;
    }
    exportPdfButton.removeAttribute('aria-disabled');
    exportPdfButton.removeAttribute('title');
  }

  function clearPrintReport() {
    if (!printReportRoot) return;
    printReportRoot.hidden = true;
    printReportRoot.innerHTML = '';
  }

  function getTopMatches(matches) {
    if (!Array.isArray(matches)) return [];
    return matches
      .slice()
      .sort((a, b) => (b.score ?? b.fit_score ?? 0) - (a.score ?? a.fit_score ?? 0))
      .slice(0, 3);
  }

  function renderChildPrintReport(matches) {
    if (!printReportRoot) return;
    const topMatches = getTopMatches(matches);
    if (!topMatches.length) {
      clearPrintReport();
      return;
    }
    const generatedAt = new Date().toLocaleString();
    const cardsHtml = topMatches
      .map((match, index) => {
        const body = match?.optimal_body || {};
        const sport = body?.sport || {};
        const subcategory = body?.subcategory || {};
        const title =
          subcategory.name || body.category_slug || sport.name || body.sport_slug || 'Sport match';
        const scoreRaw = match?.score ?? match?.fit_score ?? 0;
        const scorePercent = Math.round(Number(scoreRaw || 0) * 100);
        const sportDesc = subcategory.description || sport.description || '';
        const bodyDesc = body?.spec?.rationale || body?.spec?.overall_description || '';
        return `
          <article class="child-results-print-card">
            <h3>#${index + 1} ${escapeHtml(title)}</h3>
            <p><strong>Match score:</strong> ${scorePercent}%</p>
            ${sportDesc ? `<p>${escapeHtml(sportDesc)}</p>` : ''}
            ${bodyDesc ? `<p>${escapeHtml(bodyDesc)}</p>` : ''}
          </article>
        `;
      })
      .join('');

    printReportRoot.innerHTML = `
      <header class="child-results-print-header">
        <h1>Sporty Child Match Summary (Top 3)</h1>
        <p>Generated: ${escapeHtml(generatedAt)}</p>
        <p>Operational copy. Child results are deleted after 7 days.</p>
      </header>
      <section class="child-results-print-cards">
        ${cardsHtml}
      </section>
      <footer class="child-results-print-footer">
        Guardian-managed minor flow. Keep this PDF if you need records beyond 7 days.
      </footer>
    `;
    printReportRoot.hidden = false;
  }

  function buildMatchCard(match, rank) {
    const card = document.createElement('article');
    card.className = 'match-card';

    const body = match.optimal_body || {};
    const spec = body.spec || {};
    const sport = body.sport || {};
    const subcategory = body.subcategory || {};
    const matchKey = String(body.id ?? body.category_slug ?? body.sport_slug ?? rank);

    const scoreRaw = match.score ?? match.fit_score ?? 0;
    const scorePercent = Math.round(scoreRaw * 100);
    const title = subcategory.name || body.category_slug || sport.name || body.sport_slug || 'Sport match';

    const header = document.createElement('header');
    header.className = 'match-card__header';
    header.innerHTML = `
      <div class="match-card__rank-badge">${rank}</div>
      <div class="match-card__title-group">
        <h3 class="match-card__title">${escapeHtml(title)}</h3>
        <span class="match-card__score">${scorePercent}% Match</span>
      </div>
    `;
    const cautionLevel = getInjuryCautionLevel(match);
    if (cautionLevel) {
      const badge = document.createElement('span');
      if (cautionLevel === 'high') {
        badge.className =
          'text-[10px] px-2 py-1 rounded font-semibold uppercase tracking-wider bg-rose-100 text-rose-700';
        badge.textContent = 'High Injury Risk';
      } else {
        badge.className =
          'text-[10px] px-2 py-1 rounded font-semibold uppercase tracking-wider bg-amber-100 text-amber-700';
        badge.textContent = 'Injury Caution';
      }
      header.appendChild(badge);
    }
    card.appendChild(header);

    const cardMedia = match.media?.card || spec.media?.card || null;
    const imageUrl = resolveMediaUrl(cardMedia, resolveStorageBase());
    if (imageUrl) {
      const imageAlt =
        (cardMedia && typeof cardMedia.alt === 'string' && cardMedia.alt.trim()
          ? cardMedia.alt
          : title);
      const imgContainer = document.createElement('figure');
      imgContainer.className = 'match-card__image-container';
      imgContainer.innerHTML = `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(imageAlt)}" class="match-card__image" loading="lazy" />`;
      card.appendChild(imgContainer);
    }

    const descriptions = document.createElement('div');
    descriptions.className = 'match-card__descriptions';

    // Sport Details (Category Hierarchy in canonical YAML order)
    const hierarchy = Array.isArray(subcategory.hierarchy) ? subcategory.hierarchy : [];
    if (hierarchy.length > 0) {
      const detailsContainer = document.createElement('div');
      detailsContainer.className = 'match-card__desc-block';

      const listContainer = document.createElement('div');
      listContainer.className = 'space-y-1 text-sm';

      const detailHeader = document.createElement('h4');
      detailHeader.textContent = 'Sport';
      detailsContainer.appendChild(detailHeader);
      detailsContainer.appendChild(listContainer);

      hierarchy.forEach((entry) => {
        if (!entry || !entry.name) return;

        const row = document.createElement('div');
        row.className = 'match-card__detail-row group relative flex items-center';

        const key = String(entry.key || '').trim();
        if (!key) return;
        const label = key.charAt(0).toUpperCase() + key.slice(1);
        const value = entry.name;
        const description = entry.description;

        row.innerHTML = `
          <span class="font-medium text-slate-700 w-24 shrink-0">${escapeHtml(label)}:</span>
          <span class="text-slate-900 truncate mr-1">${escapeHtml(value)}</span>
        `;

        if (description) {
          const iconContainer = document.createElement('div');
          iconContainer.className = 'relative flex items-center';

          const icon = document.createElement('span');
          icon.className = 'cursor-help text-slate-400 hover:text-slate-600 transition-colors';
          icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
             <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
           </svg>`;

          const tooltip = document.createElement('div');
          tooltip.className =
            'absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 leading-snug';
          tooltip.textContent = description;

          const arrow = document.createElement('div');
          arrow.className =
            'absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-800';
          tooltip.appendChild(arrow);

          iconContainer.appendChild(icon);
          iconContainer.appendChild(tooltip);
          row.appendChild(iconContainer);
        }

        listContainer.appendChild(row);
      });

      descriptions.appendChild(detailsContainer);
    } else if (subcategory && subcategory.slug) {
      console.warn('[Sporty][taxonomy-order-missing]', { slug: subcategory.slug });
    }

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
          <h4>Athletes' bodies</h4>
          <p>${escapeHtml(bodyReasoning)}</p>
        </div>
      `;
    }
    card.appendChild(descriptions);

    const sectionsContainer = document.createElement('div');
    sectionsContainer.className = 'mt-4 flex flex-col gap-4';
    const sectionControllers = [];

    function createExpandableSection({ sectionKey, title, totalPct, isLong, contentEl }) {
      const wrapper = document.createElement('section');
      wrapper.className = 'match-card__factors';

      const contentId = `premium-${matchKey}-${sectionKey}-content`;
      const isOpen = SECTION_STATE.get(matchKey, sectionKey);
      const stickyClasses = [
        'sticky',
        'top-2',
        'z-10',
        'bg-white/90',
        'backdrop-blur',
        'border',
        'border-slate-100',
      ];

      const header = document.createElement('button');
      header.type = 'button';
      header.className =
        'w-full text-left flex items-start justify-between gap-4 rounded-lg hover:bg-slate-50 transition-colors';
      header.setAttribute('aria-controls', contentId);
      header.setAttribute('aria-expanded', String(isOpen));

      const left = document.createElement('div');
      left.className = 'flex flex-col py-2 px-2';
      left.innerHTML = `
        <h4 class="m-0">${escapeHtml(title)}</h4>
        <span class="text-xs text-slate-500 uppercase tracking-wider font-medium mt-0.5">
          Total Match contribution <span class="font-bold text-slate-900">${totalPct}%</span>
        </span>
      `;

      const right = document.createElement('div');
      right.className = 'flex items-center py-2 pr-2 shrink-0';
      right.innerHTML = `
        <svg viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5 text-slate-400 transition-transform">
          <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clip-rule="evenodd" />
        </svg>
      `;
      const chevron = right.querySelector('svg');

      header.appendChild(left);
      header.appendChild(right);
      wrapper.appendChild(header);

      const content = document.createElement('div');
      content.id = contentId;
      content.className = 'px-2 pb-2';
      content.hidden = !isOpen;
      wrapper.appendChild(content);

      if (isLong && isOpen) header.classList.add(...stickyClasses);

      if (isOpen && chevron) chevron.classList.add('rotate-180');

      const setOpen = (open) => {
        SECTION_STATE.set(matchKey, sectionKey, open);
        header.setAttribute('aria-expanded', String(open));
        content.hidden = !open;
        if (isLong) stickyClasses.forEach((cls) => header.classList.toggle(cls, open));
        if (chevron) chevron.classList.toggle('rotate-180', open);
      };

      header.addEventListener('click', () => setOpen(content.hidden));

      content.appendChild(contentEl);

      return { el: wrapper, setOpen };
    }

    // Body Proportion Factors (mirror free results)
    const factors = extractFactors(match);
    if (factors.length > 0) {
      const totalContribution = factors.reduce(
        (sum, f) => sum + (f.match_contribution || 0),
        0
      );
      const totalPct = Math.round(totalContribution * 100);

      const list = document.createElement('ul');
      list.className = 'factor-list';
      factors.forEach((f) => list.appendChild(createFactorItem(f)));

      const section = createExpandableSection({
        sectionKey: 'body',
        title: 'Body Proportion Factors',
        totalPct,
        isLong: factors.length >= STICKY_MIN_ITEMS,
        contentEl: list,
      });
      sectionControllers.push(section);
      sectionsContainer.appendChild(section.el);
    }

    // Past Sport Factors (mirror free results)
    const pastSports = match.score_breakdown?.details?.past_sports || [];
    if (pastSports.length > 0) {
      pastSports.sort((a, b) => (b.match_contribution || 0) - (a.match_contribution || 0));

      const totalContribution = pastSports.reduce((sum, p) => sum + (p.match_contribution || 0), 0);
      const totalPct = Math.round(totalContribution * 100);

      const list = document.createElement('ul');
      list.className = 'factor-list';
      pastSports.forEach((sport) => {
        list.appendChild(createPastSportItem(sport));
      });
      const section = createExpandableSection({
        sectionKey: 'past_sports',
        title: 'Past Sport Factors',
        totalPct,
        isLong: pastSports.length >= STICKY_MIN_ITEMS,
        contentEl: list,
      });
      sectionControllers.push(section);
      sectionsContainer.appendChild(section.el);
    }

    // Trait Factors (premium-only)
    const traitFactors = extractTraitFactors(match);
    if (traitFactors.length > 0) {
      const totalContribution = traitFactors.reduce(
        (sum, f) => sum + (f.match_contribution || 0),
        0
      );
      const totalPct = Math.round(totalContribution * 100);

      const list = document.createElement('ul');
      list.className = 'factor-list';
      traitFactors.forEach((f) => list.appendChild(createFactorItem(f)));

      const section = createExpandableSection({
        sectionKey: 'traits',
        title: 'Trait Factors',
        totalPct,
        isLong: traitFactors.length >= STICKY_MIN_ITEMS,
        contentEl: list,
      });
      sectionControllers.push(section);
      sectionsContainer.appendChild(section.el);
    }

    // Goal Factors (premium-only)
    const goalFactors = extractGoalFactors(match);
    if (goalFactors.length > 0) {
      const totalContribution = goalFactors.reduce((sum, f) => sum + (f.match_contribution || 0), 0);
      const totalPct = Math.round(totalContribution * 100);

      const list = document.createElement('ul');
      list.className = 'factor-list';
      goalFactors.forEach((f) => list.appendChild(createFactorItem(f)));

      const section = createExpandableSection({
        sectionKey: 'goals',
        title: 'Goal Factors',
        totalPct,
        isLong: goalFactors.length >= STICKY_MIN_ITEMS,
        contentEl: list,
      });
      sectionControllers.push(section);
      sectionsContainer.appendChild(section.el);
    }

    // Preference Factors (premium-only)
    const preferenceFactors = extractPreferenceFactors(match);
    if (preferenceFactors.length > 0) {
      const totalContribution = preferenceFactors.reduce((sum, f) => sum + (f.match_contribution || 0), 0);
      const totalPct = Math.round(totalContribution * 100);

      const list = document.createElement('ul');
      list.className = 'factor-list';
      preferenceFactors.forEach((f) => list.appendChild(createFactorItem(f)));

      const section = createExpandableSection({
        sectionKey: 'preferences',
        title: 'Preference Factors',
        totalPct,
        isLong: preferenceFactors.length >= STICKY_MIN_ITEMS,
        contentEl: list,
      });
      sectionControllers.push(section);
      sectionsContainer.appendChild(section.el);
    }

    // Injury Factors (premium-only)
    const injuryEntries = match.score_breakdown?.details?.injuries || [];
    if (injuryEntries.length > 0) {
      const totalContribution = injuryEntries.reduce(
        (sum, entry) => sum + (entry.match_contribution || 0),
        0
      );
      const totalPct = Math.round(totalContribution * 100);

      const list = document.createElement('ul');
      list.className = 'factor-list';

      injuryEntries
        .slice()
        .sort((a, b) => (b.match_contribution || 0) - (a.match_contribution || 0))
        .forEach((entry) => list.appendChild(buildInjuryFactorRow(entry)));
      const section = createExpandableSection({
        sectionKey: 'injuries',
        title: 'Injury Factors',
        totalPct,
        isLong: injuryEntries.length >= STICKY_MIN_ITEMS,
        contentEl: list,
      });
      sectionControllers.push(section);
      sectionsContainer.appendChild(section.el);
    }

    if (sectionControllers.length > 0) {
      const controls = document.createElement('div');
      controls.className = 'flex justify-end mt-2';

      const collapseAllBtn = document.createElement('button');
      collapseAllBtn.type = 'button';
      collapseAllBtn.className = 'btn-ghost btn-sm';
      collapseAllBtn.textContent = 'Collapse all';
      collapseAllBtn.addEventListener('click', () => {
        sectionControllers.forEach((controller) => controller.setOpen(false));
      });

      controls.appendChild(collapseAllBtn);
      card.appendChild(controls);
      card.appendChild(sectionsContainer);
    }

    return card;
  }

  function extractTraitFactors(match) {
    const breakdown = match.score_breakdown || {};
    const traitBody = breakdown.details?.traits?.body || {};

    const formatLabel = (key) =>
      key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());

    return Object.entries(traitBody)
      .map(([key, val]) => ({
        key,
        label: formatLabel(key),
        user_value: val.user_value ?? breakdown.details?.traits?.user?.[key],
        cohort_mean: val.value,
        importance: val.importance,
        reasoning: val.reasoning,
        match_contribution: val.match_contribution || 0,
        type: 'trait',
      }))
      .sort((a, b) => (b.match_contribution || 0) - (a.match_contribution || 0));
  }

  function extractGoalFactors(match) {
    const breakdown = match.score_breakdown || {};
    const goals = breakdown.details?.goals || [];

    const formatLabel = (key) =>
      (key || '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());

    return goals
      .map((item) => ({
        key: item.goal_id || item.id,
        label: formatLabel(item.name || item.goal_id || item.id || 'Goal'),
        user_value: item.priority,
        cohort_mean: item.alignment,
        alignment: item.alignment,
        priority: item.priority,
        reasoning: item.reasoning,
        match_contribution: item.match_contribution || 0,
        type: 'goal',
      }))
      .sort((a, b) => (b.match_contribution || 0) - (a.match_contribution || 0));
  }

  function extractPreferenceFactors(match) {
    const breakdown = match.score_breakdown || {};
    const prefs = breakdown.details?.preferences || [];

    const formatLabel = (key) =>
      (key || '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());

    return prefs
      .map((item) => ({
        key: item.preference_id || item.id,
        label: formatLabel(item.name || item.preference_id || item.id || 'Preference'),
        user_value: item.priority,
        cohort_mean: item.alignment,
        alignment: item.alignment,
        priority: item.priority,
        reasoning: item.reasoning,
        match_contribution: item.match_contribution || 0,
        type: 'preference',
      }))
      .sort((a, b) => (b.match_contribution || 0) - (a.match_contribution || 0));
  }

  function buildInjuryFactorRow(entry) {
    const li = document.createElement('li');
    // Avoid `group` here: the outer factor rows use `group` for their own tooltips.
    // If we keep it, all nested injury sub-tooltips would show at once on row hover.
    li.className = 'factor-row relative';

    const leftCol = document.createElement('div');
    leftCol.className = 'factor-col-left';

    const labelRow = document.createElement('div');
    labelRow.className = 'flex items-center gap-2 mb-1';

    const label = document.createElement('span');
    label.className = 'font-medium text-slate-900';
    const rawLabel = entry.injury_subcategory_name || entry.injury_subcategory_id || entry.injury_id || 'Injury';
    label.textContent = String(rawLabel).replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    labelRow.appendChild(label);
    leftCol.appendChild(labelRow);

    if (entry.severity) {
      const severityContainer = document.createElement('div');
      severityContainer.className = 'text-xs text-slate-500 flex items-center gap-1 mb-2';

      const severityLabel = document.createElement('span');
      severityLabel.textContent = 'Severity:';
      severityContainer.appendChild(severityLabel);

      severityContainer.appendChild(buildSeverityBadge(entry.severity));
      leftCol.appendChild(severityContainer);
    }

    const pairGrid = document.createElement('div');
    pairGrid.className = 'grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 items-center text-xs text-slate-600';

    // Right header row (single header for all three sub-bars)
    const spacer = document.createElement('div');
    spacer.textContent = '';
    pairGrid.appendChild(spacer);

    const header = document.createElement('div');
    header.className = 'text-[9px] text-slate-400 uppercase tracking-wider font-medium mb-0.5 text-right';
    header.textContent = 'Match Contribution';
    pairGrid.appendChild(header);

    const pairs = [
      {
        label: 'Risk factor',
        value: entry.risk,
        tone: 'risk',
        reasoning: entry.risk_reasoning,
        contribution:
          (entry.risk_match_contribution ?? 0) +
          (entry.risk_penalty_match_contribution ?? 0),
        short: 'Risk',
      },
      {
        label: 'Prevention factor',
        value: entry.prevention,
        tone: 'support',
        reasoning: entry.prevention_reasoning,
        contribution: entry.prevention_match_contribution ?? 0,
        short: 'Prevent',
      },
      {
        label: 'Heal factor',
        value: entry.heal,
        tone: 'support',
        reasoning: entry.heal_reasoning,
        contribution: entry.heal_match_contribution ?? 0,
        short: 'Heal',
      },
    ];

    pairs.forEach((pair) => {
      pairGrid.appendChild(
        buildInjurySubfactor({
          label: pair.label,
          value: pair.value,
          tone: pair.tone,
          reasoning: pair.reasoning,
        })
      );
      pairGrid.appendChild(buildMiniContributionBar(pair.short, pair.contribution));
    });

    leftCol.appendChild(pairGrid);
    li.appendChild(leftCol);
    return li;
  }

  function buildContributionColumn(contribution) {
    const rightCol = document.createElement('div');
    rightCol.className = 'flex flex-col items-end justify-center ml-4 shrink-0';

    const header = document.createElement('span');
    header.className = 'text-[9px] text-slate-400 uppercase tracking-wider font-medium mb-0.5';
    header.textContent = 'Match Contribution';
    rightCol.appendChild(header);

    const barRow = document.createElement('div');
    barRow.className = 'flex items-center gap-3';

    const barContainer = document.createElement('div');
    barContainer.className = 'factor-bar-container';

    const barFill = document.createElement('div');
    barFill.className = 'factor-bar-fill';
    const numericValue = Number(contribution || 0);
    const widthPct = Math.min(100, Math.round(Math.abs(numericValue) * 400));
    barFill.style.width = `${widthPct}% `;
    barFill.style.background = numericValue < 0 ? 'linear-gradient(90deg, #fb7185, #e11d48)' : '';
    barContainer.appendChild(barFill);

    const pctLabel = document.createElement('span');
    pctLabel.className = `text-xs font-bold w-10 text-right ${numericValue < 0 ? 'text-rose-700' : 'text-slate-700'}`;
    pctLabel.textContent = `${Math.round(numericValue * 100)}% `;

    barRow.appendChild(barContainer);
    barRow.appendChild(pctLabel);
    rightCol.appendChild(barRow);
    return rightCol;
  }

  function buildMiniContributionBar(label, value) {
    const barRow = document.createElement('div');
    barRow.className = 'flex items-center gap-2 justify-end';

    const miniLabel = document.createElement('span');
    miniLabel.className = 'text-[10px] text-slate-500 w-12 text-right';
    miniLabel.textContent = label;
    barRow.appendChild(miniLabel);

    const barContainer = document.createElement('div');
    barContainer.className = 'factor-bar-container';

    const barFill = document.createElement('div');
    barFill.className = 'factor-bar-fill';
    const numericValue = Number(value || 0);
    const widthPct = Math.min(100, Math.round(Math.abs(numericValue) * 400));
    barFill.style.width = `${widthPct}% `;
    barFill.style.background = numericValue < 0 ? 'linear-gradient(90deg, #fb7185, #e11d48)' : '';
    barContainer.appendChild(barFill);
    barRow.appendChild(barContainer);

    const pctLabel = document.createElement('span');
    pctLabel.className = `text-[11px] font-bold w-10 text-right ${numericValue < 0 ? 'text-rose-700' : 'text-slate-700'}`;
    pctLabel.textContent = `${Math.round(numericValue * 100)}% `;
    barRow.appendChild(pctLabel);

    return barRow;
  }

  function buildSeverityBadge(severity) {
    const badge = document.createElement('span');
    let badgeClass = 'text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider ';
    const sev = String(severity || '').toLowerCase();
    if (sev === 'severe') badgeClass += 'bg-rose-100 text-rose-700';
    else if (sev === 'mostly_healed') badgeClass += 'bg-emerald-100 text-emerald-700';
    else badgeClass += 'bg-amber-100 text-amber-700';
    badge.className = badgeClass;
    badge.textContent = sev.replace(/_/g, ' ');
    return badge;
  }

  function buildLevelBadge(value, tone) {
    const badge = document.createElement('span');
    const level = String(value || 'none').toLowerCase();

    // Base styling
    let cls = 'text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider ';
    if (tone === 'risk') {
      if (level === 'high') cls += 'bg-rose-100 text-rose-700';
      else if (level === 'medium') cls += 'bg-amber-100 text-amber-700';
      else if (level === 'low') cls += 'bg-slate-100 text-slate-700';
      else cls += 'bg-slate-50 text-slate-500';
    } else {
      if (level === 'high') cls += 'bg-emerald-100 text-emerald-700';
      else if (level === 'medium') cls += 'bg-teal-100 text-teal-700';
      else if (level === 'low') cls += 'bg-slate-100 text-slate-700';
      else cls += 'bg-slate-50 text-slate-500';
    }
    badge.className = cls;
    badge.textContent = level.replace(/_/g, ' ');
    return badge;
  }

  function buildInjurySubfactor({ label, value, tone, reasoning }) {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2';

    const title = document.createElement('span');
    title.className = 'text-slate-600';
    title.textContent = `${label}:`;
    row.appendChild(title);

    row.appendChild(buildLevelBadge(value, tone));

    if (reasoning) {
      const wrapper = document.createElement('span');
      wrapper.className = 'relative group flex items-center';

      const icon = document.createElement('span');
      icon.className = 'cursor-help text-slate-400 hover:text-slate-600 transition-colors';
      icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
      </svg>`;
      wrapper.appendChild(icon);

      const tooltip = document.createElement('div');
      tooltip.className =
        'absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 leading-snug';
      tooltip.textContent = reasoning;

      const arrow = document.createElement('div');
      arrow.className =
        'absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-800';
      tooltip.appendChild(arrow);

      wrapper.appendChild(tooltip);
      row.appendChild(wrapper);
    }

    return row;
  }

  function createFactorItem(factor) {
    const li = document.createElement('li');
    li.className = 'factor-row group relative';

    const leftCol = document.createElement('div');
    leftCol.className = 'factor-col-left';

    const labelContainer = document.createElement('div');
    labelContainer.className = 'flex items-center gap-2 mb-1';

    const label = document.createElement('span');
    label.className =
      'font-medium text-slate-900 cursor-help border-b border-dotted border-slate-400';
    label.textContent = factor.label;
    labelContainer.appendChild(label);

    if (factor.reasoning) {
      const icon = document.createElement('span');
      icon.className = 'text-slate-400 cursor-help';
      icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
      </svg>`;
      labelContainer.appendChild(icon);
    }
    leftCol.appendChild(labelContainer);

    if (factor.type === 'goal' || factor.type === 'preference') {
      const alignmentLine = document.createElement('div');
      alignmentLine.className = 'text-xs text-slate-500 mb-1';
      const alignment = factor.alignment ?? factor.cohort_mean;
      alignmentLine.innerHTML = `Sports alignment: <span class="font-bold">${escapeHtml(
        String(alignment || 'none').replace(/_/g, ' ')
      )}</span>`;
      leftCol.appendChild(alignmentLine);
    } else {
      const values = document.createElement('div');
      values.className = 'text-xs text-slate-500 mb-1';
      let valueHtml = `${escapeHtml(subjectLabel)}: <span class="font-bold">${escapeHtml(
        factor.user_value
      )}</span>`;
      if (factor.cohort_mean) {
        valueHtml += ` - Ideal: <span class="font-bold">${escapeHtml(factor.cohort_mean)}</span>`;
      }
      values.innerHTML = valueHtml;
      leftCol.appendChild(values);
    }

    if (factor.importance) {
      const importanceContainer = document.createElement('div');
      importanceContainer.className = 'text-xs text-slate-500 flex items-center gap-1';

      const importanceLabel = document.createElement('span');
      importanceLabel.textContent = 'Success impact:';
      importanceContainer.appendChild(importanceLabel);

      const badge = document.createElement('span');
      const imp = factor.importance.toLowerCase();
      let badgeClass = 'text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider ';
      // Importance is a positive indicator of "this matters a lot".
      // Risk/negative signals (e.g. injury risk) use separate red-toned badges.
      if (imp === 'high') badgeClass += 'bg-emerald-100 text-emerald-700';
      else if (imp === 'medium') badgeClass += 'bg-amber-100 text-amber-700';
      else badgeClass += 'bg-slate-100 text-slate-600';

      badge.className = badgeClass;
      badge.textContent = imp;
      importanceContainer.appendChild(badge);

      leftCol.appendChild(importanceContainer);
    }

    if ((factor.type === 'goal' || factor.type === 'preference') && factor.priority) {
      const priorityContainer = document.createElement('div');
      priorityContainer.className = 'text-xs text-slate-500 flex items-center gap-1';

      const priorityLabel = document.createElement('span');
      priorityLabel.textContent = `${possessiveLabel} priority:`;
      priorityContainer.appendChild(priorityLabel);

      const badge = document.createElement('span');
      let badgeClass = 'text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider ';
      const pr = String(factor.priority).toLowerCase();
      if (pr === 'must_have') badgeClass += 'bg-indigo-100 text-indigo-700';
      else badgeClass += 'bg-slate-100 text-slate-600';
      badge.className = badgeClass;
      badge.textContent = pr.replace(/_/g, ' ').toUpperCase();
      priorityContainer.appendChild(badge);

      leftCol.appendChild(priorityContainer);
    } else if (factor.priority) {
      const priorityContainer = document.createElement('div');
      priorityContainer.className = 'text-xs text-slate-500 flex items-center gap-1';

      const priorityLabel = document.createElement('span');
      priorityLabel.textContent = 'Priority:';
      priorityContainer.appendChild(priorityLabel);

      const badge = document.createElement('span');
      let badgeClass = 'text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider ';
      const pr = String(factor.priority).toLowerCase();
      if (pr === 'must_have') badgeClass += 'bg-indigo-100 text-indigo-700';
      else badgeClass += 'bg-slate-100 text-slate-600';
      badge.className = badgeClass;
      badge.textContent = pr.replace(/_/g, ' ');
      priorityContainer.appendChild(badge);

      leftCol.appendChild(priorityContainer);
    }

    if (factor.severity) {
      const severityContainer = document.createElement('div');
      severityContainer.className = 'text-xs text-slate-500 flex items-center gap-1';

      const severityLabel = document.createElement('span');
      severityLabel.textContent = 'Severity:';
      severityContainer.appendChild(severityLabel);

      severityContainer.appendChild(buildSeverityBadge(factor.severity));
      leftCol.appendChild(severityContainer);
    }

    if (factor.reasoning) {
      const tooltip = document.createElement('div');
      tooltip.className = 'factor-tooltip';
      tooltip.textContent = factor.reasoning;

      const arrow = document.createElement('div');
      arrow.className = 'factor-tooltip-arrow';
      tooltip.appendChild(arrow);

      li.appendChild(tooltip);
    }

    li.appendChild(leftCol);

    const rightCol = document.createElement('div');
    rightCol.className = 'flex flex-col items-end justify-center ml-4 shrink-0';

    const header = document.createElement('span');
    header.className = 'text-[9px] text-slate-400 uppercase tracking-wider font-medium mb-0.5';
    header.textContent = 'Match Contribution';
    rightCol.appendChild(header);

    const barRow = document.createElement('div');
    barRow.className = 'flex items-center gap-3';

    const barContainer = document.createElement('div');
    barContainer.className = 'factor-bar-container';

    const barFill = document.createElement('div');
    barFill.className = 'factor-bar-fill';
    const contribution = Number(factor.match_contribution || 0);
    const widthPct = Math.min(100, Math.round(Math.abs(contribution) * 400));
    barFill.style.width = `${widthPct}% `;
    barFill.style.background = contribution < 0 ? 'linear-gradient(90deg, #fb7185, #e11d48)' : '';
    barContainer.appendChild(barFill);

    const pctLabel = document.createElement('span');
    pctLabel.className = `text-xs font-bold w-10 text-right ${contribution < 0 ? 'text-rose-700' : 'text-slate-700'}`;
    pctLabel.textContent = `${Math.round(contribution * 100)}% `;

    barRow.appendChild(barContainer);
    barRow.appendChild(pctLabel);

    rightCol.appendChild(barRow);
    li.appendChild(rightCol);

    return li;
  }

  function createPastSportItem(sport) {
    const li = document.createElement('li');
    li.className = 'factor-row group relative';

    const leftCol = document.createElement('div');
    leftCol.className = 'factor-col-left';

    const labelContainer = document.createElement('div');
    labelContainer.className = 'flex items-center gap-2';

    const label = document.createElement('span');
    label.className = 'font-medium text-slate-900';
    const name = sport.sport_subcategory_slug || sport.sport_label || sport.sport_subcategory_id || 'Sport';
    label.textContent = name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    labelContainer.appendChild(label);

    if (sport.layman_reasoning) {
      const icon = document.createElement('span');
      icon.className = 'text-slate-400 cursor-help';
      icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
      </svg>`;
      labelContainer.appendChild(icon);

      const tooltip = document.createElement('div');
      tooltip.className = 'factor-tooltip';
      tooltip.textContent = sport.layman_reasoning;
      const arrow = document.createElement('div');
      arrow.className = 'factor-tooltip-arrow';
      tooltip.appendChild(arrow);
      li.appendChild(tooltip);
    }

    leftCol.appendChild(labelContainer);
    li.appendChild(leftCol);

    const rightCol = document.createElement('div');
    rightCol.className = 'flex flex-col items-end justify-center ml-4 shrink-0';

    const header = document.createElement('span');
    header.className = 'text-[9px] text-slate-400 uppercase tracking-wider font-medium mb-0.5';
    header.textContent = 'Match Contribution';
    rightCol.appendChild(header);

    const barRow = document.createElement('div');
    barRow.className = 'flex items-center gap-3';

    const barContainer = document.createElement('div');
    barContainer.className = 'factor-bar-container';

    const barFill = document.createElement('div');

    const pctLabel = document.createElement('span');
    pctLabel.className = 'text-xs font-bold w-8 text-right';

    if (sport.data_missing || sport.correlation === null) {
      barFill.className = 'factor-bar-fill bg-slate-200';
      barFill.style.width = '0%';
      pctLabel.className = 'text-xs font-bold text-slate-400 w-8 text-right';
      pctLabel.textContent = 'N/A';
    } else {
      barFill.className = 'factor-bar-fill';
      const widthPct = Math.min(100, Math.round((sport.match_contribution || 0) * 400));
      barFill.style.width = `${widthPct}%`;
      pctLabel.className = 'text-xs font-bold text-slate-700 w-8 text-right';
      pctLabel.textContent = `${Math.round((sport.match_contribution || 0) * 100)}%`;
    }

    barContainer.appendChild(barFill);

    barRow.appendChild(barContainer);
    barRow.appendChild(pctLabel);

    rightCol.appendChild(barRow);
    li.appendChild(rightCol);

    return li;
  }

  function getInjuryCautionLevel(match) {
    const entries = match?.score_breakdown?.details?.injuries || [];
    if (!Array.isArray(entries) || !entries.length) return null;
    if (entries.some((entry) => String(entry?.risk || '').toLowerCase() === 'high')) {
      return 'high';
    }
    if (entries.some((entry) => String(entry?.risk || '').toLowerCase() === 'medium')) {
      return 'medium';
    }
    return null;
  }

  function renderPremiumMeasurements(matches) {
    if (!measurementsContainer) return;
    measurementsContainer.innerHTML = '';
    if (!matches.length) return;
    matches.forEach((match, index) => {
      const detailEntries = match.score_breakdown?.measurements_detail || match.measurements_detail || [];
      const factors = extractFactors(match);
      match.factors = factors;
      const tableHtml = detailEntries.length
        ? buildMeasurementComparisonTableHtml(detailEntries)
        : '<p class="premium-measurement-card__empty">Measurement detail will arrive once available.</p>';
      const factorHtml = buildFactorListHtml(factors);

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

  function buildFactorListHtml(factorList) {
    if (!Array.isArray(factorList)) return '';
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

  function resolveStorageBase() {
    if (
      typeof self !== 'undefined' &&
      self.SPORTY_CONFIG &&
      typeof self.SPORTY_CONFIG.SUPABASE_STORAGE_URL === 'string'
    ) {
      return self.SPORTY_CONFIG.SUPABASE_STORAGE_URL.replace(/\/$/, '');
    }
    return '';
  }

  function resolveMediaUrl(card, base) {
    if (!card) return null;
    if (card.url) return card.url;
    if (!card.path) return null;
    const cleanedPath = card.path.replace(/^\/+/, '');
    if (base) return `${base}/${cleanedPath}`;
    return null;
  }
})();
