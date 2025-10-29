(function () {
  const base =
    typeof self !== "undefined" && typeof self.SUPABASE_STORAGE_URL === "string"
      ? self.SUPABASE_STORAGE_URL.replace(/\/$/, "")
      : "";

  if (!base) {
    console.warn(
      "SUPABASE_STORAGE_URL missing; hero tiles will fall back to empty src"
    );
    return;
  }

  const mapping = {
    "landing.hero.banner": "frontend_images/landing/hero_banner.webp",
    "landing.sample_results.tile_matches":
      "frontend_images/landing/sample_tile_matches.webp",
    "landing.sample_results.tile_metrics":
      "frontend_images/landing/sample_tile_metrics.webp",
    "landing.sample_results.tile_next_steps":
      "frontend_images/landing/sample_tile_next_steps.webp",
    "landing.pillars.ai_research":
      "frontend_images/landing/pillar_ai_research.webp",
    "landing.pillars.proprietary_data":
      "frontend_images/landing/pillar_proprietary_data.webp",
    "landing.pillars.privacy": "frontend_images/landing/pillar_privacy.webp",
    "landing.how_it_works.measure":
      "frontend_images/landing/how_it_works_measure.webp",
    "landing.how_it_works.results":
      "frontend_images/landing/how_it_works_results.webp",
    "landing.how_it_works.upgrade":
      "frontend_images/landing/how_it_works_upgrade.webp",
    "landing.how_it_works.banner":
      "frontend_images/landing/how_it_works_banner.webp",
  };

  Object.entries(mapping).forEach(([key, path]) => {
    const img = document.querySelector(`img[data-image-key="${key}"]`);
    if (!img) return;
    img.src = `${base}/${path}`;
  });

  const stickyCta = document.querySelector("[data-sticky-cta]");
  if (stickyCta) {
    stickyCta.remove();
  }
})();
