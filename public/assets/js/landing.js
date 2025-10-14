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

  const carousel = document.querySelector('[data-how-carousel]');
  if (carousel) {
    const tabs = Array.from(carousel.querySelectorAll('.how-carousel__tab'));
    const panels = Array.from(carousel.querySelectorAll('.how-carousel__panel'));

    const activate = (step) => {
      tabs.forEach((tab) => {
        const isActive = tab.dataset.step === step;
        tab.classList.toggle('is-active', isActive);
        tab.setAttribute('aria-selected', String(isActive));
        tab.setAttribute('tabindex', isActive ? '0' : '-1');
      });
      panels.forEach((panel) => {
        const isActive = panel.dataset.stepPanel === step;
        panel.classList.toggle('is-active', isActive);
        panel.setAttribute('aria-hidden', String(!isActive));
      });
    };

    tabs.forEach((tab, index) => {
      const step = tab.dataset.step;
      const focus = () => activate(step);
      tab.addEventListener('click', focus);
      tab.addEventListener('mouseenter', focus);
      tab.addEventListener('focus', focus);
      tab.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        event.preventDefault();
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        const nextIndex = (index + direction + tabs.length) % tabs.length;
        tabs[nextIndex].focus();
      });
    });
  }

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
