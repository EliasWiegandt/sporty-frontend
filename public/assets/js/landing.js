(function () {
  const base = (typeof self !== 'undefined' && typeof self.SUPABASE_STORAGE_URL === 'string')
    ? self.SUPABASE_STORAGE_URL.replace(/\/$/, '')
    : '';

  if (!base) {
    console.warn('SUPABASE_STORAGE_URL missing; hero tiles will fall back to empty src');
    return;
  }

  const mapping = {
    'landing.hero.banner': 'frontend_images/landing/hero_banner.webp',
    'landing.sample_results.tile_matches': 'frontend_images/landing/sample_tile_matches.webp',
    'landing.sample_results.tile_metrics': 'frontend_images/landing/sample_tile_metrics.webp',
    'landing.sample_results.tile_next_steps': 'frontend_images/landing/sample_tile_next_steps.webp',
  };

  Object.entries(mapping).forEach(([key, path]) => {
    const img = document.querySelector(`img[data-image-key="${key}"]`);
    if (!img) return;
    img.src = `${base}/${path}`;
  });

  const stickyCta = document.querySelector('[data-sticky-cta]');
  if (stickyCta) {
    const hero = document.getElementById('hero');
    let threshold = hero ? hero.offsetHeight : 320;

    const evaluate = () => {
      threshold = hero ? hero.offsetHeight : threshold;
      const shouldShow = window.scrollY > threshold;
      stickyCta.hidden = !shouldShow;
    };

    window.addEventListener('scroll', evaluate, { passive: true });
    window.addEventListener('resize', evaluate);
    evaluate();
  }
})();
