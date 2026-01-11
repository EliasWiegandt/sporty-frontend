(function () {
  const root = document.querySelector("[data-child-forecast-root]");
  if (!root) return;

  const summaryEl = root.querySelector("[data-summary]");
  const summaryCopyEl = root.querySelector("[data-summary-copy]");
  const summaryMetaEl = root.querySelector("[data-summary-meta]");
  const resultsEl = root.querySelector("[data-forecast-results]");
  const emptyStateEl = root.querySelector("[data-empty-state]");

  const MEASUREMENT_ORDER = [
    "height_cm",
    "arm_span_cm",
    "leg_inseam_cm",
    "shoulder_width_cm",
    "pelvic_bone_width_cm",
    "torso_length_cm",
    "hand_length_cm",
    "foot_length_cm",
    "ankle_circumference_cm",
    "wrist_circumference_cm",
    "weight_kg",
  ];

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

    summaryCopyEl.textContent = `Projected adult metrics using the ${scenario} weighting scenario.`;

    summaryMetaEl.innerHTML = "";
    const entries = [
      {
        label: "Child age",
        value: childAge,
      },
      {
        label: "Child cohort",
        value: res.child_age_group?.label || "—",
      },
      {
        label: "Adult cohort",
        value: res.adult_age_group?.label || "25-35 years",
      },
      {
        label: "Weighting scenario",
        value: scenario,
      },
      {
        label: "Ethnicity",
        value: payload?.ethnicity || "General population",
      },
    ];

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
    const hasAny = measurements && Object.keys(measurements).length > 0;
    if (!hasAny) {
      showEmpty();
      return;
    }

    resultsEl.innerHTML = "";
    resultsEl.hidden = false;

    const section = document.createElement("section");
    section.className = "grid gap-4";

    const header = document.createElement("header");
    header.className = "space-y-1";

    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = "Forecasted measurements";
    header.appendChild(title);

    section.appendChild(header);

    const column = document.createElement("div");
    column.className = "grid gap-4";

    MEASUREMENT_ORDER.forEach((key) => {
      const measurement = measurements[key];
      if (!measurement) return;
      column.appendChild(buildMeasurementCard(key, measurement));
    });

    section.appendChild(column);
    resultsEl.appendChild(section);
  }

  function buildMeasurementCard(key, measurement) {
    const unit = key === "weight_kg" ? "kg" : "cm";
    const digits = digitsForMeasurement(key);
    const forecast =
      measurement.forecast_value !== null && measurement.forecast_value !== undefined
        ? Number(measurement.forecast_value)
        : null;
    const mean =
      measurement.adult_mean !== null && measurement.adult_mean !== undefined
        ? Number(measurement.adult_mean)
        : null;
    const std =
      measurement.adult_std_dev !== null && measurement.adult_std_dev !== undefined
        ? Number(measurement.adult_std_dev)
        : null;

    const card = document.createElement("article");
    card.className = "card-measurement";

    const header = document.createElement("div");
    header.className = "grid gap-3 md:grid-cols-[3fr_2fr] md:items-start";

    const left = document.createElement("div");
    left.className = "flex items-center gap-3";

    const title = document.createElement("h4");
    title.className = "card-title";
    title.textContent = formatMeasurementLabel(key);
    left.appendChild(title);

    const detailsToggle = document.createElement("button");
    detailsToggle.type = "button";
    detailsToggle.className = "btn-ghost btn-sm";
    detailsToggle.textContent = "Hide details";
    left.appendChild(detailsToggle);

    header.appendChild(left);

    card.appendChild(header);

    const childSource = (measurement.sources || []).find((src) => src.source === "child");
    const childValue =
      childSource && childSource.value !== null && childSource.value !== undefined
        ? Number(childSource.value)
        : null;
    const deltaBar = buildForecastDeltaBar({
      mean,
      forecast,
      childValue,
      std,
      unit,
      digits,
    });
    if (deltaBar) {
      deltaBar.classList.add("forecast-bar-wrap--inline");
      deltaBar.classList.add("md:w-[40%]");
      deltaBar.classList.add("md:justify-self-end");
      header.appendChild(deltaBar);
    }

    const details = document.createElement("div");
    details.hidden = false;
    details.className = "mt-4 grid gap-3 md:max-w-[50%]";

    const contributionsHeader = document.createElement("h5");
    contributionsHeader.className = "text-xs font-semibold uppercase tracking-[0.08em] text-slate-400";
    contributionsHeader.textContent =
      "Contributions to difference between child forecast and population average";
    details.appendChild(contributionsHeader);

    const contributions = Array.isArray(measurement.sources)
      ? measurement.sources
      : [];
    const contributionList = document.createElement("ul");
    contributionList.className = "grid gap-2";

    if (!contributions.length) {
      const empty = document.createElement("p");
      empty.className = "text-sm text-muted";
      empty.textContent = "Contribution breakdown unavailable for this measurement.";
      details.appendChild(empty);
    } else {
      const orderedSources = ["child", "mother", "father"];
      const maxAbs = Math.max(
        ...contributions.map((src) => Math.abs(Number(src.contribution_units) || 0))
      );
      const safeMax = maxAbs > 0 ? maxAbs : 1;

      orderedSources.forEach((sourceKey) => {
        const src = contributions.find((entry) => entry.source === sourceKey);
        if (!src) return;

        const row = document.createElement("li");
        row.className = "factor-row";

        const leftCol = document.createElement("div");
        leftCol.className = "factor-col-left";

        const label = document.createElement("div");
        label.className = "font-medium text-slate-900";
        label.textContent = formatSourceLabel(src.source);
        leftCol.appendChild(label);


        const rightCol = document.createElement("div");
        rightCol.className = "factor-col-right";

        const barContainer = document.createElement("div");
        barContainer.className = "factor-bar-container";

        const barFill = document.createElement("div");
        const contributionValue = Number(src.contribution_units) || 0;
        const widthPct = Math.min(100, Math.round((Math.abs(contributionValue) / safeMax) * 100));
        barFill.className =
          contributionValue < 0 ? "factor-bar-fill factor-bar-fill--negative" : "factor-bar-fill";
        barFill.style.width = `${widthPct}%`;
        barContainer.appendChild(barFill);

        const valueLabel = document.createElement("span");
        valueLabel.className = "text-xs font-semibold text-slate-700 w-16 text-right";
        valueLabel.textContent = formatSignedNumber(contributionValue, digits, unit);

        rightCol.appendChild(barContainer);
        rightCol.appendChild(valueLabel);

        row.appendChild(leftCol);
        row.appendChild(rightCol);
        contributionList.appendChild(row);
      });

      details.appendChild(contributionList);
    }
    card.appendChild(details);

    detailsToggle.addEventListener("click", () => {
      details.hidden = !details.hidden;
      detailsToggle.textContent = details.hidden ? "Details" : "Hide details";
      card.classList.toggle("details-hidden", details.hidden);
    });

    return card;
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

  function formatSignedNumber(value, digits, unit) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "—";
    }
    const numeric = Number(value);
    const sign = numeric > 0 ? "+" : numeric < 0 ? "-" : "";
    return `${sign}${Math.abs(numeric).toFixed(digits)} ${unit}`;
  }

  function digitsForMeasurement(key) {
    const step = {
      height_cm: 1,
      arm_span_cm: 1,
      leg_inseam_cm: 1,
      weight_kg: 0.5,
      shoulder_width_cm: 0.5,
      pelvic_bone_width_cm: 0.5,
      torso_length_cm: 0.5,
      hand_length_cm: 0.5,
      foot_length_cm: 0.5,
      ankle_circumference_cm: 0.5,
      wrist_circumference_cm: 0.5,
    }[key];
    return step && step < 1 ? 1 : 0;
  }

  function buildForecastDeltaBar({ mean, forecast, childValue, std, unit, digits }) {
    if (mean === null || mean === undefined) return null;
    if (forecast === null || forecast === undefined) return null;
    if (Number.isNaN(mean) || Number.isNaN(forecast)) return null;

    const delta = forecast - mean;
    const childDelta =
      childValue !== null && childValue !== undefined && !Number.isNaN(childValue)
        ? childValue - mean
        : null;
    const span = Math.max(
      Math.abs(delta),
      childDelta !== null ? Math.abs(childDelta) : 0,
      (std || 0) * 3,
      1
    );
    const widthPct = Math.min(50, (Math.abs(delta) / span) * 50);
    const rawMarkerPct = 50 + (delta >= 0 ? widthPct : -widthPct);
    const markerPct = clamp(rawMarkerPct, 4, 96);
    const barWidthPct = Math.abs(markerPct - 50);

    const wrapper = document.createElement("div");
    wrapper.className = "forecast-bar-wrap";

    const bar = document.createElement("div");
    bar.className = "forecast-bar";

    const mid = document.createElement("div");
    mid.className = "forecast-bar__mid";
    bar.appendChild(mid);

    const deltaBar = document.createElement("div");
    deltaBar.className =
      delta < 0 ? "forecast-bar__delta forecast-bar__delta--neg" : "forecast-bar__delta";
    if (delta >= 0) {
      deltaBar.style.left = "50%";
      deltaBar.style.width = `${barWidthPct}%`;
    } else {
      deltaBar.style.right = "50%";
      deltaBar.style.width = `${barWidthPct}%`;
    }
    bar.appendChild(deltaBar);

    const avgMarker = document.createElement("div");
    avgMarker.className = "forecast-bar__marker forecast-bar__marker--avg";
    avgMarker.style.left = "50%";
    bar.appendChild(avgMarker);

    const forecastMarker = document.createElement("div");
    forecastMarker.className = "forecast-bar__marker forecast-bar__marker--forecast";
    forecastMarker.style.left = `${markerPct}%`;
    bar.appendChild(forecastMarker);

    const avgLabel = document.createElement("div");
    avgLabel.className = "forecast-bar__label forecast-bar__label--avg";
    avgLabel.style.left = "50%";
    avgLabel.textContent = `Adult population average: ${mean.toFixed(digits)} ${unit}`;
    bar.appendChild(avgLabel);

    const deltaLabel = document.createElement("div");
    deltaLabel.className =
      delta < 0
        ? "forecast-bar__label forecast-bar__label--delta forecast-bar__label--delta-neg"
        : "forecast-bar__label forecast-bar__label--delta";
    const deltaMid = 50 + (markerPct - 50) / 2;
    deltaLabel.style.left = `${clamp(deltaMid, 8, 92)}%`;
    deltaLabel.textContent = `Δ ${formatSignedNumber(delta, digits, unit)}`;
    bar.appendChild(deltaLabel);

    const deltaLine = document.createElement("div");
    deltaLine.className =
      delta < 0
        ? "forecast-bar__line forecast-bar__line--delta forecast-bar__line--delta-neg"
        : "forecast-bar__line forecast-bar__line--delta";
    deltaLine.style.left = `${clamp(deltaMid, 8, 92)}%`;
    bar.appendChild(deltaLine);

    const forecastLabel = document.createElement("div");
    forecastLabel.className = "forecast-bar__label forecast-bar__label--forecast";
    forecastLabel.style.left = `${markerPct}%`;
    forecastLabel.textContent = `Child forecasted: ${forecast.toFixed(digits)} ${unit}`;
    bar.appendChild(forecastLabel);

    const forecastLine = document.createElement("div");
    forecastLine.className = "forecast-bar__line forecast-bar__line--forecast";
    forecastLine.style.left = `${markerPct}%`;
    bar.appendChild(forecastLine);

    if (childValue !== null && childValue !== undefined && !Number.isNaN(childValue)) {
      const childWidthPct = Math.min(50, (Math.abs(childDelta) / span) * 50);
      const childMarkerPct = 50 + (childDelta >= 0 ? childWidthPct : -childWidthPct);

      const childMarker = document.createElement("div");
      childMarker.className = "forecast-bar__marker forecast-bar__marker--child";
      childMarker.style.left = `${clamp(childMarkerPct, 4, 96)}%`;
      bar.appendChild(childMarker);

      const childLabel = document.createElement("div");
      childLabel.className = "forecast-bar__label forecast-bar__label--child";
      childLabel.style.left = `${clamp(childMarkerPct, 4, 96)}%`;
      childLabel.textContent = `Child currently: ${childValue.toFixed(digits)} ${unit}`;
      bar.appendChild(childLabel);
    }

    wrapper.appendChild(bar);

    return wrapper;
  }

  function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }
})();
