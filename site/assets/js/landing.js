(function () {
  const base = (typeof self !== 'undefined' && typeof self.SUPABASE_STORAGE_URL === 'string')
    ? self.SUPABASE_STORAGE_URL.replace(/\/$/, '')
    : '';

  if (!base) {
    console.warn('SUPABASE_STORAGE_URL missing; hero tiles will fall back to empty src');
    return;
  }

  const mapping = {
    'landing.hero.tile_a': 'frontend_images/landing/hero_tile_basketball.webp',
    'landing.hero.tile_b': 'frontend_images/landing/hero_tile_swimmer.webp',
    'landing.hero.tile_c': 'frontend_images/landing/hero_tile_runner.webp',
    'landing.sample_results.tile_matches': 'frontend_images/landing/sample_tile_matches.webp',
    'landing.sample_results.tile_metrics': 'frontend_images/landing/sample_tile_metrics.webp',
    'landing.sample_results.tile_next_steps': 'frontend_images/landing/sample_tile_next_steps.webp',
  };

  Object.entries(mapping).forEach(([key, path]) => {
    const img = document.querySelector(`img[data-image-key="${key}"]`);
    if (!img) return;
    img.src = `${base}/${path}`;
  });
})();
