(function () {
  const CARD_SELECTOR = '[data-match-card]';
  const SPACER_SELECTOR = '[data-card-cta-spacer]';
  const CTA_SELECTOR = '[data-card-read-more]';
  const TOP_TOLERANCE_PX = 3;
  const RESIZE_DEBOUNCE_MS = 140;
  const listenersByContainer = new WeakMap();

  function debounce(fn, waitMs) {
    let timeoutId = null;
    return function debounced() {
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        fn();
      }, waitMs);
    };
  }

  function asCardArray(container) {
    if (!container) return [];
    return Array.from(container.querySelectorAll(CARD_SELECTOR));
  }

  function resetSpacerMinHeights(cards) {
    cards.forEach((card) => {
      const spacer = card.querySelector(SPACER_SELECTOR);
      if (spacer) spacer.style.minHeight = '';
    });
  }

  function groupCardsByRow(cards) {
    const sorted = cards
      .map((card) => ({ card, top: card.getBoundingClientRect().top }))
      .sort((a, b) => a.top - b.top);

    const rows = [];
    sorted.forEach(({ card, top }) => {
      const current = rows[rows.length - 1];
      if (!current || Math.abs(top - current.top) > TOP_TOLERANCE_PX) {
        rows.push({ top, cards: [card] });
        return;
      }
      current.cards.push(card);
    });
    return rows;
  }

  function alignCtaBaselineByRow(rows) {
    rows.forEach((row) => {
      const entries = row.cards
        .map((card) => {
          const spacer = card.querySelector(SPACER_SELECTOR);
          const cta = card.querySelector(CTA_SELECTOR);
          if (!spacer || !cta) return null;
          const cardTop = card.getBoundingClientRect().top;
          const ctaTopOffset = cta.getBoundingClientRect().top - cardTop;
          return {
            spacer,
            ctaTopOffset,
          };
        })
        .filter(Boolean);

      if (entries.length < 2) return;

      const targetCtaTopOffset = Math.max(...entries.map((entry) => entry.ctaTopOffset));
      entries.forEach((entry) => {
        const delta = Math.ceil(targetCtaTopOffset - entry.ctaTopOffset);
        entry.spacer.style.minHeight = `${Math.max(0, delta)}px`;
      });
    });
  }

  function realign(container) {
    const cards = asCardArray(container);
    if (!cards.length) return;
    resetSpacerMinHeights(cards);
    if (cards.length < 2) return;

    const rows = groupCardsByRow(cards);
    alignCtaBaselineByRow(rows);
  }

  function bindContainerListeners(container) {
    if (!container || listenersByContainer.has(container)) return;

    const onResize = debounce(() => realign(container), RESIZE_DEBOUNCE_MS);
    window.addEventListener('resize', onResize);

    if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
      document.fonts.ready.then(() => realign(container)).catch(() => {});
    }

    listenersByContainer.set(container, { onResize });
  }

  function init(container) {
    if (!container) return;
    bindContainerListeners(container);
    realign(container);
  }

  window.SportyResultCardAlignment = {
    init,
    realign,
  };
})();
