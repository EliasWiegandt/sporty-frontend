(function () {
  const STORAGE_KEY = "sporty:lastResult";
  const container = document.querySelector("[data-results-container]");
  const emptyState = document.querySelector("[data-empty-state]");

  // Configuration
  const storageBase = resolveStorageBase();

  init().catch((error) => {
    console.error("[Sporty] Failed to init free results page", error);
    showEmptyState();
  });

  async function init() {
    if (window.sportyResultsInitialized) {
      return;
    }
    window.sportyResultsInitialized = true;

    const data = await loadResultData();
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

  async function loadResultData() {
    const fromSession = readSessionResult();
    if (fromSession) return fromSession;
    return await fetchResultById();
  }

  async function waitForAuthReady() {
    const sportyApp = window.SportyApp || window.sportyApp;
    if (!sportyApp) {
      return { ready: false, hasSession: false, phase: 'no-sporty-app' };
    }
    if (sportyApp.ready && typeof sportyApp.ready.then === 'function') {
      try {
        await sportyApp.ready;
      } catch (_) {
        // Continue to session check; auth bootstrap may still succeed.
      }
    }
    const directSession = sportyApp.getSession ? sportyApp.getSession() : null;
    if (directSession && directSession.user) {
      return { ready: true, hasSession: true, phase: 'ready-direct' };
    }
    if (typeof sportyApp.onAuthChange !== 'function') {
      return { ready: true, hasSession: false, phase: 'ready-no-auth-listener' };
    }
    return await new Promise((resolve) => {
      let done = false;
      const finish = (payload) => {
        if (done) return;
        done = true;
        if (typeof unsubscribe === 'function') unsubscribe();
        clearTimeout(timer);
        resolve(payload);
      };
      const unsubscribe = sportyApp.onAuthChange((snap) => {
        const hasSession = Boolean(snap && snap.session && snap.session.user);
        if (hasSession) {
          finish({ ready: true, hasSession: true, phase: 'auth-change' });
        }
      });
      const timer = setTimeout(() => {
        const session = sportyApp.getSession ? sportyApp.getSession() : null;
        finish({
          ready: true,
          hasSession: Boolean(session && session.user),
          phase: 'auth-timeout',
        });
      }, 3000);
    });
  }

  async function fetchResultById() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      const id = params.get("id");
      if (!id) return null;

      const sportyApp = window.SportyApp || window.sportyApp;
      const auth = await waitForAuthReady();
      const hasSession = Boolean(sportyApp && sportyApp.getSession && sportyApp.getSession() && sportyApp.getSession().user);
      if (!hasSession) {
        console.error("[Sporty] Free fetch skipped: auth session unavailable", {
          runId: id,
          hasSession,
          phase: auth.phase,
        });
        return null;
      }
      const client = sportyApp && sportyApp.getClient ? sportyApp.getClient() : null;
      if (!client) return null;

      const { data, error } = await client
        .from("recommendations")
        .select("result_payload,summary")
        .eq("id", id)
        .single();
      if (error) throw error;

      if (data && data.result_payload) return data.result_payload;
      if (data && data.summary) {
        if (typeof data.summary === "object") return data.summary;
        return JSON.parse(data.summary);
      }
      return null;
    } catch (error) {
      console.error("[Sporty] Failed to fetch free analysis by id", {
        runId: new URLSearchParams(window.location.search || "").get("id"),
        phase: "db-fetch",
        errorCode: error && error.code ? error.code : null,
        errorMessage: error && error.message ? error.message : String(error),
      });
      return null;
    }
  }

  function readSessionResult() {
    try {
      const raw = sessionStorage.getItem("sporty:lastResult");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      console.error("Unable to parse stored result", error);
      return null;
    }
  }

  function showEmptyState() {
    if (container) container.hidden = true;
    if (emptyState) emptyState.hidden = false;
  }

  function renderMatches(matches) {
    if (!container) return;
    container.innerHTML = "";
    container.hidden = false;
    console.log("Rendering matches:", matches.length);

    matches.forEach((match, index) => {
      console.log("Rendering match index:", index);
      try {
        const card = buildMatchCard(match, index + 1);
        container.appendChild(card);
        console.log("Appended card for match index:", index);
      } catch (e) {
        console.error("Error rendering match index:", index, e);
      }
    });
  }

  function buildMatchCard(match, rank) {
    const card = document.createElement("article");
    card.className = "match-card";

    const body = match.optimal_body || {};
    const spec = body.spec || {};
    const sport = body.sport || {};
    const subcategory = body.subcategory || {};

    // 1. Header
    const scoreRaw = match.score ?? match.fit_score ?? 0;
    const scorePercent = Math.round(scoreRaw * 100);
    const title =
      subcategory.name ||
      body.category_slug ||
      sport.name ||
      body.sport_slug ||
      "Sport match";

    const header = document.createElement("header");
    header.className = "match-card__header";
    header.innerHTML = `
      <div class="match-card__rank-badge">${rank}</div>
      <div class="match-card__title-group">
        <h3 class="match-card__title">${escapeHtml(title)}</h3>
        <span class="match-card__score">${scorePercent}% Match</span>
      </div>
    `;
    card.appendChild(header);

    // 2. Image
    const cardMedia =
      match.media && match.media.card
        ? match.media.card
        : spec.media && spec.media.card
          ? spec.media.card
          : null;
    const imageUrl = resolveMediaUrl(cardMedia, storageBase);
    if (imageUrl) {
      const imageAlt =
        (cardMedia && typeof cardMedia.alt === "string" && cardMedia.alt.trim()
          ? cardMedia.alt
          : title);
      const imgContainer = document.createElement("figure");
      imgContainer.className = "match-card__image-container";
      imgContainer.innerHTML = `<img src="${escapeHtml(
        imageUrl
      )}" alt="${escapeHtml(
        imageAlt
      )}" class="match-card__image" loading="lazy" />`;
      card.appendChild(imgContainer);
    }

    // 3. Descriptions
    const descriptions = document.createElement("div");
    descriptions.className = "match-card__descriptions";

    // 2.5 Sport Details (Category Hierarchy in canonical YAML order)
    const hierarchy = Array.isArray(subcategory.hierarchy)
      ? subcategory.hierarchy
      : [];
    if (hierarchy.length > 0) {
      const detailsContainer = document.createElement("div");
      detailsContainer.className = "match-card__desc-block";
      // Note: match-card__desc-block already has padding, bg, border, radius defined in CSS
      // We add specific spacing for the list items
      const listContainer = document.createElement("div");
      listContainer.className = "space-y-1 text-sm";

      const header = document.createElement("h4");
      header.textContent = "Sport";
      detailsContainer.appendChild(header);
      detailsContainer.appendChild(listContainer);

      hierarchy.forEach((entry) => {
        if (!entry || !entry.name) return;

        const row = document.createElement("div");
        row.className =
          "match-card__detail-row group relative flex items-center";

        const key = String(entry.key || "").trim();
        if (!key) return;
        const label = key.charAt(0).toUpperCase() + key.slice(1);
        const value = entry.name;
        const description = entry.description;

        row.innerHTML = `
          <span class="font-medium text-slate-700 w-24 shrink-0">${label}:</span>
          <span class="text-slate-900 truncate mr-1">${escapeHtml(value)}</span>
        `;

        if (description) {
          const iconContainer = document.createElement("div");
          iconContainer.className = "relative flex items-center";

          const icon = document.createElement("span");
          icon.className =
            "cursor-help text-slate-400 hover:text-slate-600 transition-colors";
          icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
             <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
           </svg>`;

          const tooltip = document.createElement("div");
          tooltip.className =
            "absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 leading-snug";
          tooltip.textContent = description;

          // Arrow
          const arrow = document.createElement("div");
          arrow.className =
            "absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-800";
          tooltip.appendChild(arrow);

          iconContainer.appendChild(icon);
          iconContainer.appendChild(tooltip);
          row.appendChild(iconContainer);
        }
        listContainer.appendChild(row);
      });
      descriptions.appendChild(detailsContainer);
    } else if (subcategory && subcategory.slug) {
      console.warn("[Sporty][taxonomy-order-missing]", {
        slug: subcategory.slug,
      });
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

    const bodyHref = buildSportBodyHref(body, subcategory);
    if (bodyHref) {
      const ctaWrap = document.createElement("div");
      ctaWrap.className = "mt-4 flex justify-center";
      ctaWrap.innerHTML = `<a class="btn-pill btn-pill-secondary btn-pill-sm" href="${escapeHtml(
        bodyHref
      )}">Read more about this body</a>`;
      card.appendChild(ctaWrap);
    }

    // 4. Factors (Top 5 + Expand)
    const factors = extractFactors(match);
    if (factors.length > 0) {
      const totalContribution = factors.reduce(
        (sum, f) => sum + (f.match_contribution || 0),
        0
      );
      const totalPct = Math.round(totalContribution * 100);

      const factorsSection = document.createElement("div");
      factorsSection.className = "match-card__factors";
      factorsSection.innerHTML = `
        <div class="flex flex-col mb-2">
          <h4 class="m-0">Body Proportion Factors</h4>
          <span class="text-xs text-slate-500 uppercase tracking-wider font-medium mt-0.5">
            Total Match contribution <span class="font-bold text-slate-900">${totalPct}%</span>
          </span>
        </div>
        `;

      const list = document.createElement("ul");
      list.className = "factor-list";

      const visibleFactors = factors.slice(0, 5);
      const hiddenFactors = factors.slice(5);

      visibleFactors.forEach((f) => list.appendChild(createFactorItem(f)));

      if (hiddenFactors.length > 0) {
        const hiddenContainer = document.createElement("div");
        hiddenContainer.className = "factor-list--hidden";
        hiddenContainer.hidden = false;
        hiddenFactors.forEach((f) =>
          hiddenContainer.appendChild(createFactorItem(f))
        );
        list.appendChild(hiddenContainer);

        const toggleBtn = document.createElement("button");
        toggleBtn.className = "btn-ghost btn-sm factor-toggle";
        toggleBtn.textContent = "Show less";
        toggleBtn.onclick = () => {
          const isHidden = hiddenContainer.hidden;
          hiddenContainer.hidden = !isHidden;
          toggleBtn.textContent = isHidden ? "Show less" : "Show all factors";
        };
        factorsSection.appendChild(list);
        factorsSection.appendChild(toggleBtn);
      } else {
        factorsSection.appendChild(list);
      }
      card.appendChild(factorsSection);
    }

    // 5. Past Sport Factors
    const pastSports = match.score_breakdown?.details?.past_sports || [];
    if (pastSports.length > 0) {
      // Sort by contribution
      pastSports.sort(
        (a, b) => (b.match_contribution || 0) - (a.match_contribution || 0)
      );

      const totalContribution = pastSports.reduce(
        (sum, p) => sum + (p.match_contribution || 0),
        0
      );
      const totalPct = Math.round(totalContribution * 100);

      const pastSection = document.createElement("div");
      pastSection.className = "match-card__factors mt-4"; // Add margin top
      pastSection.innerHTML = `
        <div class="flex flex-col mb-2">
          <h4 class="m-0">Past Sport Factors</h4>
          <span class="text-xs text-slate-500 uppercase tracking-wider font-medium mt-0.5">
            Total Match contribution <span class="font-bold text-slate-900">${totalPct}%</span>
          </span>
        </div>
        `;

      const list = document.createElement("ul");
      list.className = "factor-list";
      pastSports.forEach((sport) => {
        list.appendChild(createPastSportItem(sport));
      });
      pastSection.appendChild(list);
      card.appendChild(pastSection);
    }

    return card;
  }

  function createFactorItem(factor) {
    const li = document.createElement("li");
    li.className = "factor-row group relative"; // Added group relative for tooltip

    // Left Column: Label + Importance + Tooltip
    const leftCol = document.createElement("div");
    leftCol.className = "factor-col-left";

    const labelContainer = document.createElement("div");
    labelContainer.className = "flex items-center gap-2 mb-1";

    const label = document.createElement("span");
    label.className =
      "font-medium text-slate-900 cursor-help border-b border-dotted border-slate-400";
    label.textContent = factor.label;
    labelContainer.appendChild(label);

    // Info Icon
    if (factor.reasoning) {
      const icon = document.createElement("span");
      icon.className = "text-slate-400 cursor-help";
      icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
      </svg>`;
      labelContainer.appendChild(icon);
    }
    leftCol.appendChild(labelContainer);

    // Values (User vs Cohort)
    const values = document.createElement("div");
    values.className = "text-xs text-slate-500 mb-1"; // Added mb-1 for spacing
    let valueHtml = `You: <span class="font-bold">${factor.user_value}</span>`;
    if (factor.cohort_mean) {
      valueHtml += ` - Ideal: <span class="font-bold">${factor.cohort_mean}</span>`;
    }
    values.innerHTML = valueHtml;
    leftCol.appendChild(values);

    // Importance Badge (New Line)
    if (factor.importance) {
      const importanceContainer = document.createElement("div");
      importanceContainer.className =
        "text-xs text-slate-500 flex items-center gap-1";

      const importanceLabel = document.createElement("span");
      importanceLabel.textContent = "Success impact:";
      importanceContainer.appendChild(importanceLabel);

      const badge = document.createElement("span");
      const imp = factor.importance.toLowerCase();
      let badgeClass =
        "text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider ";
      // Importance is a positive indicator of "this matters a lot".
      // Risk/negative signals (e.g. injury risk) use separate red-toned badges elsewhere.
      if (imp === "high") badgeClass += "bg-emerald-100 text-emerald-700";
      else if (imp === "medium") badgeClass += "bg-amber-100 text-amber-700";
      else badgeClass += "bg-slate-100 text-slate-600";

      badge.className = badgeClass;
      badge.textContent = imp;
      importanceContainer.appendChild(badge);

      leftCol.appendChild(importanceContainer);
    }

    // Tooltip (Reasoning)
    if (factor.reasoning) {
      const tooltip = document.createElement("div");
      tooltip.className = "factor-tooltip";
      tooltip.textContent = factor.reasoning;

      const arrow = document.createElement("div");
      arrow.className = "factor-tooltip-arrow";
      tooltip.appendChild(arrow);

      // Append to label so it's positioned relative to it?
      // Or append to li (which is relative) and center it.
      // The CSS assumes li is relative.
      li.appendChild(tooltip);
    }

    li.appendChild(leftCol);

    // Right Column: Header + Bar + Contribution %
    const rightCol = document.createElement("div");
    rightCol.className = "flex flex-col items-end justify-center ml-4 shrink-0";

    // Header
    const header = document.createElement("span");
    header.className =
      "text-[9px] text-slate-400 uppercase tracking-wider font-medium mb-0.5";
    header.textContent = "Match Contribution";
    rightCol.appendChild(header);

    // Bar Row
    const barRow = document.createElement("div");
    barRow.className = "flex items-center gap-3";

    const barContainer = document.createElement("div");
    barContainer.className = "factor-bar-container";

    const barFill = document.createElement("div");
    barFill.className = "factor-bar-fill";
    // Contribution is e.g. 0.12 -> 12%
    // We scale it visually. Let's say max possible contribution for a single factor is around 15-20%.
    // So we might want to scale it up a bit for visibility, or just use raw %.
    // Let's use raw % for width, maybe capped at 100.
    // Actually, if top factor is 12%, a 12% width bar looks small.
    // Maybe we normalize against the top factor in the list?
    // For now, let's just do percentage * 4 to fill the space better, or just use the raw value if we want strict accuracy.
    // User asked: "vertical bar showing the match contribution is the highest for the top match and then decreasing"
    // Let's try a multiplier of 300 to make 0.1 (10%) -> 30% width.
    const widthPct = Math.min(100, Math.round(factor.match_contribution * 400));
    barFill.style.width = `${widthPct}% `;
    barContainer.appendChild(barFill);

    const pctLabel = document.createElement("span");
    pctLabel.className = "text-xs font-bold text-slate-700 w-8 text-right";
    pctLabel.textContent = `${Math.round(factor.match_contribution * 100)}% `;

    barRow.appendChild(barContainer);
    barRow.appendChild(pctLabel);

    rightCol.appendChild(barRow);
    li.appendChild(rightCol);

    return li;
  }

  function extractFactors(match) {
    const breakdown = match.score_breakdown || {};
    const factors = [];

    // Helper to format labels
    const formatLabel = (key) =>
      key
        .replace(/_/g, " ")
        .replace(" cm", "")
        .replace(/\b\w/g, (l) => l.toUpperCase());

    // 1. Measurements
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
            type: "measurement",
          });
        }
      });
    }

    // 2. Traits (if any)
    if (
      breakdown.details &&
      breakdown.details.traits &&
      breakdown.details.traits.body
    ) {
      Object.entries(breakdown.details.traits.body).forEach(([key, val]) => {
        const score = val.fit_score ?? val.score;
        if (score !== undefined) {
          factors.push({
            key,
            label: formatLabel(key),
            score: score,
            match_contribution: 0, // Traits don't have this yet in free match
            user_value: val.value,
            importance: val.importance,
            reasoning: val.reasoning,
            type: "trait",
          });
        }
      });
    }

    // Sort by match_contribution descending
    return factors.sort((a, b) => b.match_contribution - a.match_contribution);
  }

  function createPastSportItem(sport) {
    const li = document.createElement("li");
    li.className = "factor-row group relative";

    // Left Column: Label (Sport Name)
    const leftCol = document.createElement("div");
    leftCol.className = "factor-col-left";

    const labelContainer = document.createElement("div");
    labelContainer.className = "flex items-center gap-2";

    const label = document.createElement("span");
    label.className = "font-medium text-slate-900";
    // Prefer subcategory slug, otherwise format label/id.
    const name =
      sport.sport_subcategory_slug ||
      sport.sport_label ||
      sport.sport_subcategory_id ||
      "Sport";
    label.textContent = name
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
    labelContainer.appendChild(label);

    if (sport.layman_reasoning) {
      const icon = document.createElement("span");
      icon.className = "text-slate-400 cursor-help";
      icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
      </svg>`;
      labelContainer.appendChild(icon);

      const tooltip = document.createElement("div");
      tooltip.className = "factor-tooltip";
      tooltip.textContent = sport.layman_reasoning;
      const arrow = document.createElement("div");
      arrow.className = "factor-tooltip-arrow";
      tooltip.appendChild(arrow);
      li.appendChild(tooltip);
    }

    leftCol.appendChild(labelContainer);

    li.appendChild(leftCol);

    // Right Column: Header + Bar + Contribution %
    const rightCol = document.createElement("div");
    rightCol.className = "flex flex-col items-end justify-center ml-4 shrink-0";

    // Header
    const header = document.createElement("span");
    header.className =
      "text-[9px] text-slate-400 uppercase tracking-wider font-medium mb-0.5";
    header.textContent = "Match Contribution";
    rightCol.appendChild(header);

    // Bar Row
    const barRow = document.createElement("div");
    barRow.className = "flex items-center gap-3";

    const barContainer = document.createElement("div");
    barContainer.className = "factor-bar-container";

    const barFill = document.createElement("div");

    const pctLabel = document.createElement("span");
    pctLabel.className = "text-xs font-bold w-8 text-right";

    // Check if data is missing
    if (sport.data_missing || sport.correlation === null) {
      barFill.className = "factor-bar-fill bg-slate-200"; // Gray out the bar
      barFill.style.width = "0%";
      pctLabel.className = "text-xs font-bold text-slate-400 w-8 text-right";
      pctLabel.textContent = "N/A";
    } else {
      barFill.className = "factor-bar-fill";
      // Scale visually similar to body factors
      const widthPct = Math.min(
        100,
        Math.round((sport.match_contribution || 0) * 400)
      );
      barFill.style.width = `${widthPct}%`;
      pctLabel.className = "text-xs font-bold text-slate-700 w-8 text-right";
      pctLabel.textContent = `${Math.round(
        (sport.match_contribution || 0) * 100
      )}%`;
    }

    barContainer.appendChild(barFill);

    barRow.appendChild(barContainer);
    barRow.appendChild(pctLabel);

    rightCol.appendChild(barRow);
    li.appendChild(rightCol);

    return li;
  }

  // Helpers
  function resolveStorageBase() {
    if (
      typeof self !== "undefined" &&
      self.SPORTY_CONFIG &&
      typeof self.SPORTY_CONFIG.SUPABASE_STORAGE_URL === "string"
    ) {
      return self.SPORTY_CONFIG.SUPABASE_STORAGE_URL.replace(/\/$/, "");
    }
    return "";
  }

  function resolveMediaUrl(card, base) {
    if (!card) return null;
    if (card.url) return card.url;
    if (!card.path) return null;
    const cleanedPath = card.path.replace(/^\/+/g, "");
    if (base) return `${base}/${cleanedPath}`;
    return null;
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function buildSportBodyHref(body, subcategory) {
    if (!body || body.id === undefined || body.id === null) return null;
    const rawSlug = subcategory?.name || body.category_slug || body.sport_slug || "body";
    const slug = slugify(rawSlug) || "body";
    return `/sport-bodies/${slug}-${body.id}`;
  }

  function escapeHtml(value) {
    return (value || "")
      .toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Initialize
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
