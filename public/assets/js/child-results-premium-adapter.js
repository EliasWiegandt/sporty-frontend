(function () {
  const premiumRoot = document.querySelector('[data-premium-root]');
  if (!premiumRoot) return;

  try {
    sessionStorage.removeItem('sporty:lastPremiumResult');
  } catch (_) {}

  const rawForecast = sessionStorage.getItem('sporty:lastChildForecast');
  if (!rawForecast) return;

  let parsed = null;
  try {
    parsed = JSON.parse(rawForecast);
  } catch (_) {
    return;
  }

  const premium = parsed && parsed.premium_analysis ? parsed.premium_analysis : null;
  if (!premium || !Array.isArray(premium.matches) || premium.matches.length === 0) return;

  const payload = {
    reason:
      premium.reason ||
      'Based on the child’s forecasted adult build and premium inputs.',
    matches: premium.matches,
  };

  try {
    sessionStorage.setItem('sporty:lastPremiumResult', JSON.stringify(payload));
  } catch (_) {}
})();
