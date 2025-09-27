(function () {
  const sportyApp = window.SportyApp;
  const root = document.querySelector('[data-profile-root]');
  if (!root || !sportyApp) return;

  const signedOutCard = root.querySelector('[data-profile-signed-out]');
  const signedInCard = root.querySelector('[data-profile-signed-in]');
  const emailEl = root.querySelector('[data-profile-email]');
  const consentStatusEl = root.querySelector('[data-profile-consent-status]');
  const consentToggle = root.querySelector('[data-consent-toggle]');
  const toggleHelp = root.querySelector('[data-profile-toggle-help]');
  const signupTriggers = root.querySelectorAll('[data-signup-open]');

  sportyApp.ready.then(() => {
    if (typeof sportyApp.onAuthChange === 'function') {
      sportyApp.onAuthChange(handleSnapshot);
    }
  });

  signupTriggers.forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      if (!sportyApp.openAuth) return;
      sportyApp.openAuth();
      if (typeof sportyApp.setAuthMode === 'function') {
        sportyApp.setAuthMode('signup');
      }
    });
  });

  if (consentToggle) {
    consentToggle.addEventListener('change', handleToggleChange);
  }

  async function handleSnapshot(snapshot) {
    const signedIn = snapshot && snapshot.user;

    if (signedInCard) signedInCard.hidden = !signedIn;
    if (signedOutCard) signedOutCard.hidden = signedIn;
    if (consentToggle) consentToggle.disabled = !signedIn;

    if (!signedIn) {
      if (consentStatusEl) consentStatusEl.textContent = '';
      if (consentToggle) consentToggle.checked = false;
      return;
    }

    if (emailEl) {
      emailEl.textContent = snapshot.user.email || '';
    }

    updateConsentStatus(snapshot.hasConsent);
    if (consentToggle) consentToggle.checked = Boolean(snapshot.hasConsent);
    updateToggleHelp(snapshot.hasConsent);
  }

  function updateToggleHelp(hasConsent) {
    if (!toggleHelp) return;
    toggleHelp.textContent = hasConsent
      ? 'Sporty will remember new free matches. Turn this off to stop storing data.'
      : 'Turn this on to let Sporty remember your future free matches.';
  }

  function updateConsentStatus(hasConsent) {
    if (!consentStatusEl) return;
    if (hasConsent) {
      consentStatusEl.className = 'profile-status profile-status--active';
      consentStatusEl.textContent = 'You have granted Sporty data-retention consent.';
    } else {
      consentStatusEl.className = 'profile-status profile-status--missing';
      consentStatusEl.textContent = 'You have not granted data-retention consent.';
    }
  }

  async function handleToggleChange(event) {
    const target = event.currentTarget;
    if (!target) return;

    if (target.checked) {
      if (typeof sportyApp.ensureConsent !== 'function') return;
      const accepted = await sportyApp.ensureConsent();
      if (!accepted) {
        target.checked = false;
        if (toggleHelp) {
          toggleHelp.textContent =
            'Consent is off. Log out if you want to run free matches without storing them.';
        }
      } else {
        updateToggleHelp(true);
      }
    } else {
      if (typeof sportyApp.revokeConsent !== 'function') return;
      target.disabled = true;
      try {
        await sportyApp.revokeConsent();
        updateToggleHelp(false);
      } catch (error) {
        console.error(error);
        target.checked = true;
      } finally {
        target.disabled = false;
      }
    }
  }
})();
