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

  const accordionGroups = document.querySelectorAll(".hs-accordion-group");
  accordionGroups.forEach((group) => {
    let allowMultiple = false;
    const configAttr = group.getAttribute("data-hs-accordion");
    if (configAttr) {
      try {
        const parsed = JSON.parse(configAttr);
        if (parsed && typeof parsed === "object") {
          allowMultiple = Boolean(parsed.alwaysOpen);
        }
      } catch (error) {
        console.warn("[Sporty] Failed to parse accordion config", error);
      }
    }

    const toggles = group.querySelectorAll(".hs-accordion-toggle");

    const collapse = (btn, panel) => {
      if (!panel || panel.classList.contains("hidden")) return;
      btn.setAttribute("aria-expanded", "false");
      btn.classList.remove("hs-accordion-active");
      const parent = btn.closest(".hs-accordion");
      if (parent) parent.classList.remove("hs-accordion-active");

      panel.style.height = panel.scrollHeight + "px";
      requestAnimationFrame(() => {
        panel.style.height = "0px";
      });
      const onTransitionEnd = () => {
        panel.classList.add("hidden");
        panel.style.height = "";
        panel.removeEventListener("transitionend", onTransitionEnd);
      };
      panel.addEventListener("transitionend", onTransitionEnd);
    };

    const expand = (btn, panel) => {
      if (!panel) return;
      btn.setAttribute("aria-expanded", "true");
      btn.classList.add("hs-accordion-active");
      const parent = btn.closest(".hs-accordion");
      if (parent) parent.classList.add("hs-accordion-active");

      panel.classList.remove("hidden");
      panel.style.height = "0px";
      const height = panel.scrollHeight;
      requestAnimationFrame(() => {
        panel.style.height = height + "px";
      });
      const onTransitionEnd = () => {
        panel.style.height = "";
        panel.removeEventListener("transitionend", onTransitionEnd);
      };
      panel.addEventListener("transitionend", onTransitionEnd);
    };

    toggles.forEach((btn) => {
      const panelId = btn.getAttribute("aria-controls");
      if (!panelId) return;
      const panel = document.getElementById(panelId);

      btn.addEventListener("click", () => {
        const expanded = btn.getAttribute("aria-expanded") === "true";
        if (expanded) {
          collapse(btn, panel);
          return;
        }

        if (!allowMultiple) {
          toggles.forEach((otherBtn) => {
            if (otherBtn === btn) return;
            const otherPanelId = otherBtn.getAttribute("aria-controls");
            if (!otherPanelId) return;
            const otherPanel = document.getElementById(otherPanelId);
            collapse(otherBtn, otherPanel);
          });
        }

        expand(btn, panel);
      });
    });
  });
})();
