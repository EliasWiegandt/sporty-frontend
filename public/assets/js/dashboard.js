(function () {
  const sportyApp = window.SportyApp;
  const root = document.querySelector('[data-dashboard-root]');
  if (!root || !sportyApp) return;

  const signedOutBlock = root.querySelector('[data-dashboard-signed-out]');
  const signedInBlock = root.querySelector('[data-dashboard-signed-in]');
  const creditsAdultEl = root.querySelector('[data-credits-adult]');
  const creditsChildEl = root.querySelector('[data-credits-child]');
  const lockerList = root.querySelector('[data-measurement-locker]');
  const lockerEmpty = root.querySelector('[data-measurement-locker-empty]');
  let creditsController = null;

  function readCreditSnapshot() {
    try {
      const raw = sessionStorage.getItem('sporty:lastCreditSnapshot');
      if (!raw) return null;
      sessionStorage.removeItem('sporty:lastCreditSnapshot');
      const parsed = JSON.parse(raw);
      return {
        adult: Number(parsed.adult) || 0,
        child: Number(parsed.child) || 0,
      };
    } catch (error) {
      console.warn('[Sporty] Failed to read credit snapshot', error);
      return null;
    }
  }

  sportyApp.ready.then(() => {
    if (typeof sportyApp.onAuthChange === 'function') {
      sportyApp.onAuthChange(handleSnapshot);
    }
  });

  function handleSnapshot(snapshot) {
    const signedIn = Boolean(snapshot && snapshot.user);
    if (signedOutBlock) signedOutBlock.hidden = signedIn;
    if (signedInBlock) signedInBlock.hidden = !signedIn;

    if (!signedIn) {
      if (creditsController) {
        creditsController.abort();
        creditsController = null;
      }
      setCredits('-', '-');
      clearLocker();
      return;
    }

    setCredits('...', '...');
    const creditSnapshot = readCreditSnapshot();
    if (creditSnapshot) {
      setCredits(String(creditSnapshot.adult), String(creditSnapshot.child));
    }
    loadCredits(snapshot.user.id);
    renderLocker([]);
  }

  function setCredits(adult, child) {
    if (creditsAdultEl) creditsAdultEl.textContent = adult;
    if (creditsChildEl) creditsChildEl.textContent = child;
  }

  function normalizeCreditCount(value) {
    if (value === null || value === undefined) return 0;
    const numeric = Number(value);
    if (Number.isNaN(numeric) || !Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.trunc(numeric));
  }

  async function loadCredits(userId) {
    if (!userId) {
      setCredits('-', '-');
      return;
    }

    if (creditsController) {
      creditsController.abort();
    }

    creditsController = new AbortController();

    try {
      const resp = await fetch(`/api/credits?user_id=${encodeURIComponent(userId)}`, {
        headers: { Accept: 'application/json' },
        signal: creditsController.signal,
      });

      if (!resp.ok) {
        throw new Error(`Failed to load credits: ${resp.status}`);
      }

      const payload = await resp.json();
      const adult = normalizeCreditCount(payload.adult_credits);
      const child = normalizeCreditCount(payload.child_credits);
      setCredits(String(adult), String(child));
      creditsController = null;
    } catch (error) {
      if (creditsController && creditsController.signal.aborted) {
        creditsController = null;
        return;
      }
      console.error('[Sporty] Failed to load credits', error);
      setCredits('--', '--');
      creditsController = null;
    }
  }

  function clearLocker() {
    renderLocker(null);
  }

  function renderLocker(entries) {
    if (!lockerList || !lockerEmpty) return;
    lockerList.innerHTML = '';
    if (!entries || !entries.length) {
      lockerEmpty.hidden = false;
      lockerList.hidden = true;
      return;
    }

    lockerEmpty.hidden = true;
    lockerList.hidden = false;
    entries.forEach((entry) => {
      const li = document.createElement('li');
      li.textContent = entry.label || 'Saved measurements';
      lockerList.appendChild(li);
    });
  }
})();
