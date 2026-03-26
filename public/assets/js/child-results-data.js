(function () {
  const CACHE = {
    normalizedResult: null,
    loadPromise: null,
  };

  function getRunId() {
    const params = new URLSearchParams(window.location.search || '');
    return params.get('id');
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
        // Continue to session check.
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

  async function fetchChildRunById(runId) {
    const sportyApp = window.SportyApp || window.sportyApp;
    const auth = await waitForAuthReady();
    const hasSession = Boolean(
      sportyApp && sportyApp.getSession && sportyApp.getSession() && sportyApp.getSession().user
    );
    if (!hasSession) {
      console.error('[Sporty] Child-run fetch skipped: auth session unavailable', {
        runId,
        phase: auth.phase,
      });
      return null;
    }
    const client = sportyApp && sportyApp.getClient ? sportyApp.getClient() : null;
    if (!client) return null;

    const { data, error } = await client
      .from('child_forecast_runs')
      .select(
        'id,child_age_years,child_age_group_label,child_sex,child_race,adult_age_group_label,weight_scenario,measurement_results,metadata,forecasted_at'
      )
      .eq('id', runId)
      .single();

    if (error) throw error;
    return data || null;
  }

  function normalizeChildRun(run) {
    if (!run || typeof run !== 'object') return null;
    const metadata = run.metadata && typeof run.metadata === 'object' ? run.metadata : {};
    return {
      run_id: run.id || null,
      child_age_years: run.child_age_years,
      child_age_group: {
        label: run.child_age_group_label || '—',
      },
      adult_age_group: {
        label: run.adult_age_group_label || '—',
      },
      weight_scenario: run.weight_scenario || null,
      results: run.measurement_results || {},
      past_sports: Array.isArray(metadata.past_sports) ? metadata.past_sports : [],
      premium_analysis: metadata.child_premium_analysis || null,
      recommendation:
        metadata.recommendation_overview && typeof metadata.recommendation_overview === 'object'
          ? metadata.recommendation_overview
          : null,
      request_payload: {
        race: run.child_race || metadata.child_stats_cohort?.race || null,
        sex: run.child_sex || metadata.child_stats_cohort?.sex || null,
        past_sports: Array.isArray(metadata.past_sports) ? metadata.past_sports : [],
      },
      forecasted_at: run.forecasted_at || null,
    };
  }

  async function loadNormalizedResult() {
    if (CACHE.normalizedResult) return CACHE.normalizedResult;
    if (CACHE.loadPromise) return CACHE.loadPromise;

    CACHE.loadPromise = (async () => {
      const runId = getRunId();
      if (!runId) return null;
      const run = await fetchChildRunById(runId);
      const normalized = normalizeChildRun(run);
      CACHE.normalizedResult = normalized;
      return normalized;
    })();

    try {
      return await CACHE.loadPromise;
    } finally {
      CACHE.loadPromise = null;
    }
  }

  window.SportyChildResultsData = {
    getRunId,
    loadNormalizedResult,
  };
})();
