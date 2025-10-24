(function () {
  const sportyApp = window.SportyApp;
  const buttons = document.querySelectorAll('[data-checkout-product]');
  if (!buttons.length) return;

  const childState = {
    profiles: null,
    promise: null,
    selectedId: null,
  };

  ensureChildModalStyles();

  buttons.forEach((button) => {
    button.addEventListener('click', (event) => handleClick(event, button));
  });

  function resolveStatusElement(button) {
    if (button) {
      const zone = button.closest('[data-checkout-zone]');
      if (zone) {
        const local = zone.querySelector('[data-checkout-status]');
        if (local) return local;
      }
    }
    return document.querySelector('[data-checkout-status]');
  }

  function setStatus(target, message, tone) {
    if (!target) return;
    if (!message) {
      target.textContent = '';
      target.dataset.tone = '';
      target.hidden = true;
      return;
    }
    target.textContent = message;
    target.dataset.tone = tone || 'info';
    target.hidden = false;
  }

  function toggleButton(button, loading) {
    if (!button) return;
    if (loading) {
      button.setAttribute('data-loading', 'true');
      button.disabled = true;
    } else {
      button.removeAttribute('data-loading');
      button.disabled = false;
    }
  }

  function resolvePublishableKey() {
    const config = window.SPORTY_CONFIG || {};
    return (
      config.STRIPE_PUBLIC_KEY ||
      window.STRIPE_PUBLIC_KEY ||
      ''
    ).trim();
  }

  async function ensureUser(statusEl) {
    if (!sportyApp) return null;
    if (sportyApp.ready) {
      try {
        await sportyApp.ready;
      } catch (error) {
        console.error('[Sporty] Auth initialisation failed', error);
      }
    }
    const user = sportyApp.getUser ? sportyApp.getUser() : null;
    if (!user) {
      setStatus(statusEl, 'Sign in to purchase credits.', 'warn');
      if (sportyApp && typeof sportyApp.openAuth === 'function') {
        sportyApp.openAuth();
      }
      return null;
    }
    return user;
  }

  async function handleClick(event, button) {
    event.preventDefault();
    const statusEl = resolveStatusElement(button);
    const productId = button?.dataset?.checkoutProduct || '';
    const creditType = button?.dataset?.checkoutCreditType || 'adult';

    if (!productId) {
      console.warn('[Sporty] Missing checkout product id');
      return;
    }

    const publishableKey = resolvePublishableKey();
    if (!publishableKey) {
      setStatus(statusEl, 'Stripe public key missing. Contact support.', 'error');
      return;
    }

    const user = await ensureUser(statusEl);
    if (!user) return;

    let subjectChild = null;
    if (creditType === 'child') {
      subjectChild = await selectChildProfile(statusEl);
      if (!subjectChild) {
        return;
      }
    }

    setStatus(statusEl, 'Creating checkout session…', 'info');
    toggleButton(button, true);

    const payload = {
      product_id: productId,
      user_id: user.id,
    };
    if (subjectChild) {
      payload.subject_child_id = subjectChild.id;
    }

    try {
      const resp = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const err = await safeJson(resp);
        const message =
          err && err.detail ? err.detail : `Checkout failed (${resp.status})`;
        throw new Error(message);
      }

      const data = await resp.json();
      const url = data?.url ? String(data.url) : '';
      if (!url) {
        throw new Error('Checkout session missing redirect URL.');
      }

      if (subjectChild) {
        setStatus(statusEl, `Redirecting to Stripe for ${subjectChild.label}…`, 'info');
      } else {
        setStatus(statusEl, 'Redirecting to Stripe…', 'info');
      }
      window.location.assign(url);
    } catch (error) {
      console.error('[Sporty] Unable to start checkout', error);
      setStatus(
        statusEl,
        error instanceof Error ? error.message : 'Unable to start checkout.',
        'error'
      );
      toggleButton(button, false);
    }
  }

  async function selectChildProfile(statusEl) {
    try {
      setStatus(statusEl, 'Loading linked children…', 'info');
      const profiles = await getChildProfiles();

      if (!profiles.length) {
        setStatus(
          statusEl,
          'No linked children found. Add a child profile in your guardian dashboard before purchasing.',
          'warn'
        );
        return null;
      }

      if (profiles.length === 1) {
        const [profile] = profiles;
        childState.selectedId = profile.id;
        setStatus(statusEl, `Assigning credit to ${profile.label}.`, 'info');
        return profile;
      }

      setStatus(statusEl, 'Choose which child to assign this credit to.', 'info');
      const chosenId = await openChildPicker(
        profiles,
        childState.selectedId || profiles[0].id
      );
      if (!chosenId) {
        setStatus(statusEl, 'Child credit purchase cancelled.', 'warn');
        return null;
      }

      childState.selectedId = chosenId;
      const chosen = profiles.find((profile) => profile.id === chosenId);
      if (chosen) {
        setStatus(statusEl, `Assigning credit to ${chosen.label}.`, 'info');
        return chosen;
      }

      return { id: chosenId, label: 'selected child' };
    } catch (error) {
      console.error('[Sporty] Unable to load child profiles', error);
      setStatus(
        statusEl,
        'Unable to load your linked children right now. Please try again shortly.',
        'error'
      );
      return null;
    }
  }

  async function getChildProfiles() {
    if (childState.profiles) return childState.profiles;
    if (childState.promise) return childState.promise;

    childState.promise = (async () => {
      if (sportyApp?.ready) {
        try {
          await sportyApp.ready;
        } catch (error) {
          console.error('[Sporty] Auth not ready for child fetch', error);
        }
      }

      const client = sportyApp?.getClient ? sportyApp.getClient() : null;
      if (!client) return [];

      const { data, error } = await client
        .from('children')
        .select('id,name,birthdate,sex')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formatted = (data || []).map(formatChildProfile);
      childState.profiles = formatted;
      return formatted;
    })()
      .catch((error) => {
        childState.profiles = null;
        throw error;
      })
      .finally(() => {
        childState.promise = null;
      });

    return childState.promise;
  }

  function formatChildProfile(child) {
    const birthdate = child.birthdate ? formatDate(child.birthdate) : null;
    const parts = [];
    if (child.name) parts.push(child.name);
    if (birthdate) parts.push(birthdate);
    const label = parts.length ? parts.join(' · ') : 'Child profile';
    return {
      id: child.id,
      name: child.name || '',
      birthdate,
      sex: child.sex || '',
      label,
    };
  }

  function formatDate(isoDate) {
    try {
      const date = new Date(isoDate);
      if (Number.isNaN(date.getTime())) return isoDate;
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      return isoDate;
    }
  }

  function getChildModal() {
    let modal = document.querySelector('[data-checkout-child-modal]');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'checkout-child-modal';
    modal.setAttribute('data-checkout-child-modal', '');
    modal.innerHTML = `
      <div class="checkout-child-modal__backdrop" data-child-modal-backdrop></div>
      <div class="checkout-child-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="child-modal-title">
        <header class="checkout-child-modal__header">
          <h2 id="child-modal-title">Assign child credit</h2>
          <p>Select which child profile this credit should be attached to.</p>
        </header>
        <label class="checkout-child-modal__field">
          <span>Child profile</span>
          <select data-child-modal-select></select>
        </label>
        <footer class="checkout-child-modal__actions">
          <button class="btn-ghost" type="button" data-child-modal-cancel>Cancel</button>
          <button class="btn-primary" type="button" data-child-modal-confirm>Continue</button>
        </footer>
      </div>
    `;

    document.body.appendChild(modal);
    return modal;
  }

  function ensureChildModalStyles() {
    if (document.querySelector('style[data-checkout-child-modal-style]')) return;
    const style = document.createElement('style');
    style.setAttribute('data-checkout-child-modal-style', '');
    style.textContent = `
      .checkout-child-modal {
        position: fixed;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 9000;
      }
      .checkout-child-modal.is-open {
        display: flex;
      }
      .checkout-child-modal__backdrop {
        position: absolute;
        inset: 0;
        background: rgba(15, 23, 42, 0.45);
      }
      .checkout-child-modal__dialog {
        position: relative;
        width: min(400px, 90vw);
        background: #ffffff;
        border-radius: 24px;
        padding: 1.75rem;
        box-shadow: 0 18px 60px rgba(15, 23, 42, 0.28);
        display: grid;
        gap: 1.25rem;
      }
      .checkout-child-modal__header h2 {
        margin: 0 0 0.25rem;
        font-size: 1.3rem;
      }
      .checkout-child-modal__header p {
        margin: 0;
        color: rgba(71, 85, 105, 0.95);
      }
      .checkout-child-modal__field {
        display: grid;
        gap: 0.5rem;
        font-weight: 600;
      }
      .checkout-child-modal__field span {
        font-size: 0.95rem;
        color: rgba(15, 23, 42, 0.75);
      }
      .checkout-child-modal__field select {
        font-size: 1rem;
        padding: 0.65rem 0.75rem;
        border-radius: 14px;
        border: 1px solid rgba(148, 163, 184, 0.45);
        background: rgba(248, 250, 252, 0.95);
      }
      .checkout-child-modal__actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
      }
    `;
    document.head.appendChild(style);
  }

  function openChildPicker(profiles, defaultId) {
    return new Promise((resolve) => {
      const modal = getChildModal();
      const select = modal.querySelector('[data-child-modal-select]');
      const confirmBtn = modal.querySelector('[data-child-modal-confirm]');
      const cancelBtn = modal.querySelector('[data-child-modal-cancel]');
      const backdrop = modal.querySelector('[data-child-modal-backdrop]');

      if (select) {
        select.innerHTML = '';
        profiles.forEach((profile) => {
          const option = document.createElement('option');
          option.value = profile.id;
          option.textContent = profile.label;
          if (profile.id === defaultId) {
            option.selected = true;
          }
          select.appendChild(option);
        });
      }

      const cleanup = () => {
        modal.classList.remove('is-open');
        confirmBtn?.removeEventListener('click', onConfirm);
        cancelBtn?.removeEventListener('click', onCancel);
        backdrop?.removeEventListener('click', onCancel);
        document.removeEventListener('keydown', onKeydown);
      };

      const onConfirm = () => {
        const value = select?.value || null;
        cleanup();
        resolve(value);
      };

      const onCancel = () => {
        cleanup();
        resolve(null);
      };

      const onKeydown = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        }
      };

      confirmBtn?.addEventListener('click', onConfirm);
      cancelBtn?.addEventListener('click', onCancel);
      backdrop?.addEventListener('click', onCancel);
      document.addEventListener('keydown', onKeydown);

      requestAnimationFrame(() => {
        modal.classList.add('is-open');
        select?.focus({ preventScroll: true });
      });
    });
  }

  async function safeJson(response) {
    try {
      return await response.json();
    } catch (_) {
      return null;
    }
  }
})();
