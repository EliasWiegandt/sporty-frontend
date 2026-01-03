(function () {
  const root = document.querySelector("[data-child-forecast-root]");
  if (!root) return;

  const summaryEl = root.querySelector("[data-summary]");
  const summaryCopyEl = root.querySelector("[data-summary-copy]");
  const summaryMetaEl = root.querySelector("[data-summary-meta]");
  const resultsEl = root.querySelector("[data-forecast-results]");
  const emptyStateEl = root.querySelector("[data-empty-state]");

  const rawResult = sessionStorage.getItem("sporty:lastChildForecast");
  if (!rawResult) {
    showEmpty();
    return;
  }

  let result;
  try {
    result = JSON.parse(rawResult);
  } catch (error) {
    console.error("Failed to parse stored child forecast", error);
    showEmpty();
    return;
  }

  const rawRequest = sessionStorage.getItem("sporty:lastChildForecastRequest");
  let requestPayload = null;
  if (rawRequest) {
    try {
      requestPayload = JSON.parse(rawRequest);
    } catch (error) {
      console.warn("Failed to parse stored child forecast request", error);
    }
  }

  renderSummary(result, requestPayload);
  renderMeasurements(result);

  function showEmpty() {
    if (emptyStateEl) emptyStateEl.hidden = false;
    if (summaryEl) summaryEl.hidden = true;
    if (resultsEl) resultsEl.hidden = true;
  }

  function renderSummary(res, payload) {
    if (!summaryEl || !summaryCopyEl || !summaryMetaEl) return;

    summaryEl.hidden = false;
    if (emptyStateEl) emptyStateEl.hidden = true;

    const childAge = res.child_age_years
      ? `${Number(res.child_age_years).toFixed(2)} years`
      : "Unknown age";

    const scenario = res.weight_scenario
      ? res.weight_scenario.replace(/_/g, " ")
      : "child only";

    summaryCopyEl.textContent = `Projected adult metrics using the ${scenario} weighting scenario. Child age: ${childAge}.`;

    summaryMetaEl.innerHTML = "";
    const entries = [
      {
        label: "Child cohort",
        value: res.child_age_group?.label || "—",
      },
      {
        label: "Adult cohort",
        value: res.adult_age_group?.label || "25-35 years",
      },
      {
        label: "Ethnicity",
        value: payload?.ethnicity || "General population",
      },
    ];

    if (payload?.guardian_user_id) {
      entries.push({
        label: "Guardian user id",
        value: payload.guardian_user_id,
      });
    }

    entries.forEach((entry) => {
      const dt = document.createElement("dt");
      dt.textContent = entry.label;
      const dd = document.createElement("dd");
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

    resultsEl.innerHTML = "";
    resultsEl.hidden = false;

    entries.forEach((key) => {
      const measurement = measurements[key];
      const card = document.createElement("article");
      card.className = "card-measurement";

      const header = document.createElement("div");
      header.className = "flex flex-wrap items-center justify-between gap-3";

      const title = document.createElement("h3");
      title.textContent = formatMeasurementLabel(key);
      title.className = "card-title";
      header.appendChild(title);

      const forecastTag = document.createElement("span");
      forecastTag.textContent = measurement.forecast_value
        ? `${Number(measurement.forecast_value).toFixed(1)} cm forecast`
        : "Insufficient data";
      forecastTag.className = "chip-soft";
      header.appendChild(forecastTag);

      card.appendChild(header);

      const context = document.createElement("p");
      context.className = "text-muted text-sm";
      const adultMean = measurement.adult_mean
        ? `${Number(measurement.adult_mean).toFixed(1)} cm mean`
        : "—";
      const adultStd = measurement.adult_std_dev
        ? `${Number(measurement.adult_std_dev).toFixed(1)} cm σ`
        : "—";
      context.textContent = `Adult cohort: ${adultMean}, ${adultStd}. Weighted C-score: ${
        measurement.weighted_z_score !== null &&
        measurement.weighted_z_score !== undefined
          ? Number(measurement.weighted_z_score).toFixed(3)
          : "—"
      }.`;
      card.appendChild(context);

      const table = document.createElement("table");
      table.className = "contrib-table text-sm";

      table.innerHTML = `
        <thead class="text-xs uppercase tracking-[0.05em] text-[var(--gray-6)]">
          <tr>
            <th class="px-2 py-2 text-left">Source</th>
            <th class="px-2 py-2 text-right">Value</th>
            <th class="px-2 py-2 text-right">C-score</th>
            <th class="px-2 py-2 text-right">Weight</th>
            <th class="px-2 py-2 text-right">Contribution</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;

      const tbody = table.querySelector("tbody");
      (measurement.sources || []).forEach((src, rowIndex) => {
        const tr = document.createElement("tr");
        if (rowIndex % 2 === 1) {
          tr.classList.add("bg-[rgba(148,163,184,0.1)]");
        }

        const sourceCell = document.createElement("td");
        sourceCell.className = "px-2 py-2";
        sourceCell.textContent = formatSourceLabel(src.source);
        tr.appendChild(sourceCell);

        const valueCell = document.createElement("td");
        valueCell.className = "px-2 py-2 text-right";
        valueCell.textContent = formatOptionalNumber(src.value);
        tr.appendChild(valueCell);

        const scoreCell = document.createElement("td");
        scoreCell.className = "px-2 py-2 text-right";
        scoreCell.textContent = formatOptionalNumber(src.c_score, 3);
        tr.appendChild(scoreCell);

        const weightCell = document.createElement("td");
        weightCell.className = "px-2 py-2 text-right";
        weightCell.textContent = formatOptionalNumber(src.applied_weight, 2);
        tr.appendChild(weightCell);

        const contributionCell = document.createElement("td");
        contributionCell.className = "px-2 py-2 text-right";
        contributionCell.textContent = formatOptionalNumber(src.contribution_units);
        tr.appendChild(contributionCell);

        tbody.appendChild(tr);
      });

      card.appendChild(table);
      resultsEl.appendChild(card);
    });
  }

  function formatMeasurementLabel(key) {
    return key
      .replace("_cm", "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function formatSourceLabel(source) {
    return source.charAt(0).toUpperCase() + source.slice(1);
  }

  function formatOptionalNumber(value, digits = 1) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "—";
    }
    return Number(value).toFixed(digits);
  }

  function formatPercent(value) {
    if (value === null || value === undefined) return "0%";
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return "0%";
    return `${numeric.toFixed(1)}%`;
  }
})();
