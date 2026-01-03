(function () {
  const root = document.querySelector('[data-child-results-tabs-root]');
  if (!root) return;

  const buttons = Array.from(root.querySelectorAll('[data-tab-button]'));
  const panels = Array.from(root.querySelectorAll('[data-tab-panel]'));
  const jumpButtons = Array.from(root.querySelectorAll('[data-tab-jump]'));

  if (!buttons.length || !panels.length) return;

  const knownTabs = new Set(['matches', 'forecast']);
  const params = new URLSearchParams(window.location.search);

  const normalizeTab = (value) => {
    const tab = (value || '').toLowerCase();
    return knownTabs.has(tab) ? tab : null;
  };

  const detectDefaultTab = () => {
    const fromQuery = normalizeTab(params.get('tab'));
    if (fromQuery) return fromQuery;

    const stored = normalizeTab(sessionStorage.getItem('sporty:childResultsTab'));
    if (stored) return stored;

    const rawForecast = sessionStorage.getItem('sporty:lastChildForecast');
    if (!rawForecast) return 'forecast';
    try {
      const parsed = JSON.parse(rawForecast);
      if (parsed && parsed.premium_analysis) return 'matches';
    } catch (_) {}
    return 'forecast';
  };

  const setActiveTab = (tab) => {
    const nextTab = normalizeTab(tab) || 'forecast';

    buttons.forEach((button) => {
      const isActive = button.getAttribute('data-tab-button') === nextTab;
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    panels.forEach((panel) => {
      panel.hidden = panel.getAttribute('data-tab-panel') !== nextTab;
    });

    sessionStorage.setItem('sporty:childResultsTab', nextTab);

    if (params.get('tab') !== nextTab) {
      params.set('tab', nextTab);
      const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash || ''}`;
      window.history.replaceState({}, '', nextUrl);
    }
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.getAttribute('data-tab-button');
      setActiveTab(tab);
    });
  });

  jumpButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.getAttribute('data-tab-jump');
      setActiveTab(tab);
    });
  });

  setActiveTab(detectDefaultTab());
})();
