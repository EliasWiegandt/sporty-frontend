(function () {
  const sportyApp = window.SportyApp;
  const root = document.querySelector('[data-dashboard-root]');
  if (!root || !sportyApp) return;

  const signedOutBlock = root.querySelector('[data-dashboard-signed-out]');
  const signedInBlock = root.querySelector('[data-dashboard-signed-in]');
  const creditsAdultEl = root.querySelector('[data-credits-adult]');
  const creditsChildEl = root.querySelector('[data-credits-child]');
  const runButtons = root.querySelectorAll('[data-premium-run]');
  const lockerList = root.querySelector('[data-measurement-locker]');
  const lockerEmpty = root.querySelector('[data-measurement-locker-empty]');
  let creditsController = null;

  const historyGrid = root.querySelector('[data-history-grid]');

  // Account elements
  const emailEl = root.querySelector('[data-profile-email]');
  const consentStatusEl = root.querySelector('[data-profile-consent-status]');
  const consentToggles = root.querySelectorAll('[data-consent-type-toggle]');
  const toggleHelp = root.querySelector('[data-profile-toggle-help]');
  const accountDeleteStatusEl = root.querySelector('[data-account-delete-status]');
  const accountDeleteOpenBtn = root.querySelector('[data-account-delete-open]');
  const accountDeleteOverlay = root.querySelector('[data-account-delete-overlay]');
  const accountDeleteConfirmInput = root.querySelector('[data-account-delete-confirm-input]');
  const accountDeleteCancelBtn = root.querySelector('[data-account-delete-cancel]');
  const accountDeleteConfirmBtn = root.querySelector('[data-account-delete-confirm]');
  const dataDeleteStatusEl = root.querySelector('[data-data-delete-status]');
  const dataDeleteOpenBtn = root.querySelector('[data-data-delete-open]');
  const dataDeleteOverlay = root.querySelector('[data-data-delete-overlay]');
  const dataDeleteConfirmInput = root.querySelector('[data-data-delete-confirm-input]');
  const dataDeleteCancelBtn = root.querySelector('[data-data-delete-cancel]');
  const dataDeleteConfirmBtn = root.querySelector('[data-data-delete-confirm]');
  const signoutBtn = root.querySelector('[data-auth-signout]');
  const measurementSystemButtons = root.querySelectorAll('[data-measurement-system-option]');
  const measurementSystemStatus = root.querySelector('[data-measurement-system-status]');

  const familyZone = root.querySelector('[data-family-zone]');
  const familyList = root.querySelector('[data-family-list]');
  const familyEmpty = root.querySelector('[data-family-empty]');
  const familyLoading = root.querySelector('[data-family-loading]');
  const familyAddOpen = root.querySelector('[data-family-add-open]');
  const familyAddForm = root.querySelector('[data-family-add-form]');
  const familyAddCancel = root.querySelector('[data-family-add-cancel]');
  const familyAddStatus = root.querySelector('[data-family-add-status]');

  const inviteInbox = root.querySelector('[data-invite-inbox]');
  const inviteList = root.querySelector('[data-invite-list]');
  const inviteEmpty = root.querySelector('[data-invite-empty]');
  const inviteLoading = root.querySelector('[data-invite-loading]');

  const childAnalysisDialog = root.querySelector('[data-child-analysis-dialog]');
  const childAnalysisDialogList = root.querySelector('[data-child-analysis-dialog-list]');
  const childAnalysisDialogEmpty = root.querySelector('[data-child-analysis-dialog-empty]');
  const childAnalysisDialogLoading = root.querySelector('[data-child-analysis-dialog-loading]');

  let familyRequestId = 0;
  let latestChildCredits = 0;
  let familyChildrenCache = [];
  let lastUserId = null;
  let lastUserEmail = null;
  let accountDeletePollTimer = null;
  let accountDeleteInFlight = false;
  let dataDeleteInFlight = false;
  let historyItemsState = [];
  let historyMenuOutsideBound = false;
  let measurementSystem = 'metric';
  let measurementSystemRequestId = 0;
  const MEASUREMENT_SYSTEM_STORAGE_KEY = 'sporty:measurement-system:v1';

  function isMeasurementSystem(value) {
    return value === 'metric' || value === 'imperial';
  }

  function readStoredMeasurementSystem() {
    try {
      const fromSession = sessionStorage.getItem(MEASUREMENT_SYSTEM_STORAGE_KEY);
      if (isMeasurementSystem(fromSession)) return fromSession;
      const fromLocal = localStorage.getItem(MEASUREMENT_SYSTEM_STORAGE_KEY);
      if (isMeasurementSystem(fromLocal)) return fromLocal;
    } catch (error) {
      console.warn('[Dashboard] Unable to read measurement system from storage', error);
    }
    return null;
  }

  function localeDefaultMeasurementSystem() {
    const locale = navigator.language || '';
    const parts = locale.split('-');
    const region = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : '';
    return region === 'US' ? 'imperial' : 'metric';
  }

  function resolveMeasurementSystem(preferredFromProfile) {
    if (isMeasurementSystem(preferredFromProfile)) return preferredFromProfile;
    const stored = readStoredMeasurementSystem();
    if (stored) return stored;
    return localeDefaultMeasurementSystem();
  }

  function persistMeasurementSystemLocal(nextSystem) {
    try {
      sessionStorage.setItem(MEASUREMENT_SYSTEM_STORAGE_KEY, nextSystem);
      localStorage.setItem(MEASUREMENT_SYSTEM_STORAGE_KEY, nextSystem);
    } catch (error) {
      console.warn('[Dashboard] Unable to persist measurement system locally', error);
    }
  }

  function setMeasurementSystemStatus(message, tone) {
    if (!measurementSystemStatus) return;
    measurementSystemStatus.hidden = !message;
    if (!message) return;
    measurementSystemStatus.className =
      tone === 'error' ? 'text-xs text-red-600 mt-2' : 'text-xs text-slate-500 mt-2';
    measurementSystemStatus.textContent = message;
  }

  function renderMeasurementSystemToggle() {
    measurementSystemButtons.forEach((btn) => {
      const option = btn.dataset.measurementSystemOption;
      const active = option === measurementSystem;
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      if (active) {
        btn.classList.add('btn-pill-primary');
        btn.classList.remove('btn-pill-secondary');
      } else {
        btn.classList.add('btn-pill-secondary');
        btn.classList.remove('btn-pill-primary');
      }
    });
  }

  function setMeasurementSystem(nextSystem) {
    measurementSystem = isMeasurementSystem(nextSystem) ? nextSystem : 'metric';
    persistMeasurementSystemLocal(measurementSystem);
    renderMeasurementSystemToggle();
  }

  async function hydrateMeasurementSystem(userId) {
    const requestId = ++measurementSystemRequestId;
    let preferred = null;
    const client = sportyApp?.getClient ? sportyApp.getClient() : null;
    if (client && userId) {
      try {
        const { data, error } = await client
          .from('profiles')
          .select('preferred_measurement_system')
          .eq('id', userId)
          .maybeSingle();
        if (!error) preferred = data && data.preferred_measurement_system;
      } catch (error) {
        console.warn('[Dashboard] Unable to hydrate measurement system from profile', error);
      }
    }
    if (requestId !== measurementSystemRequestId) return;
    setMeasurementSystem(resolveMeasurementSystem(preferred));
    setMeasurementSystemStatus('', 'info');
  }

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

  if (familyAddOpen && familyAddForm) {
    familyAddOpen.addEventListener('click', () => {
      familyAddForm.hidden = !familyAddForm.hidden;
      if (familyAddStatus) familyAddStatus.hidden = true;
    });
  }
  if (familyAddCancel && familyAddForm) {
    familyAddCancel.addEventListener('click', () => {
      familyAddForm.hidden = true;
      if (familyAddStatus) familyAddStatus.hidden = true;
    });
  }
  if (familyAddForm) {
    familyAddForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await handleCreateChild();
    });
  }

  consentToggles.forEach((toggle) => {
    toggle.addEventListener('change', handleToggleChange);
  });

  if (accountDeleteOpenBtn) {
    accountDeleteOpenBtn.addEventListener('click', openAccountDeleteModal);
  }
  if (accountDeleteCancelBtn) {
    accountDeleteCancelBtn.addEventListener('click', closeAccountDeleteModal);
  }
  if (accountDeleteOverlay) {
    accountDeleteOverlay.addEventListener('click', (event) => {
      if (event.target === accountDeleteOverlay) {
        closeAccountDeleteModal();
      }
    });
  }
  if (accountDeleteConfirmInput) {
    accountDeleteConfirmInput.addEventListener('input', updateAccountDeleteConfirmState);
  }
  if (accountDeleteConfirmBtn) {
    accountDeleteConfirmBtn.addEventListener('click', handleAccountDeleteConfirm);
  }
  if (dataDeleteOpenBtn) {
    dataDeleteOpenBtn.addEventListener('click', openDataDeleteModal);
  }
  if (dataDeleteCancelBtn) {
    dataDeleteCancelBtn.addEventListener('click', closeDataDeleteModal);
  }
  if (dataDeleteOverlay) {
    dataDeleteOverlay.addEventListener('click', (event) => {
      if (event.target === dataDeleteOverlay) {
        closeDataDeleteModal();
      }
    });
  }
  if (dataDeleteConfirmInput) {
    dataDeleteConfirmInput.addEventListener('input', updateDataDeleteConfirmState);
  }
  if (dataDeleteConfirmBtn) {
    dataDeleteConfirmBtn.addEventListener('click', handleDataDeleteConfirm);
  }

  if (signoutBtn) {
    signoutBtn.addEventListener('click', () => {
      if (sportyApp && typeof sportyApp.signOut === 'function') {
        sportyApp.signOut();
      }
    });
  }

  measurementSystemButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const option = btn.dataset.measurementSystemOption;
      if (!isMeasurementSystem(option)) return;
      setMeasurementSystem(option);
      setMeasurementSystemStatus('Saving preference…', 'info');

      const client = sportyApp?.getClient ? sportyApp.getClient() : null;
      const user = sportyApp?.getUser ? sportyApp.getUser() : null;
      if (!client || !user || !user.id) {
        setMeasurementSystemStatus('Saved in this browser.', 'info');
        return;
      }

      try {
        const { error } = await client
          .from('profiles')
          .update({ preferred_measurement_system: option })
          .eq('id', user.id);
        if (error) throw error;
        setMeasurementSystemStatus('Saved for your account.', 'info');
      } catch (error) {
        console.error('[Dashboard] Failed to save measurement system preference', error);
        setMeasurementSystemStatus('Unable to save to profile. Kept locally.', 'error');
      }
    });
  });

  // Hydrate immediately so toggle isn't blank before auth snapshot settles.
  setMeasurementSystem(resolveMeasurementSystem(null));
  renderMeasurementSystemToggle();

  function handleSnapshot(snapshot) {
    const signedIn = Boolean(snapshot && snapshot.user);
    if (signedOutBlock) signedOutBlock.hidden = signedIn;
    if (signedInBlock) signedInBlock.hidden = !signedIn;
    consentToggles.forEach((toggle) => {
      toggle.disabled = !signedIn;
    });
    if (accountDeleteOpenBtn) accountDeleteOpenBtn.disabled = !signedIn;
    if (dataDeleteOpenBtn) dataDeleteOpenBtn.disabled = !signedIn;

    if (!signedIn) {
      closeAccountDeleteModal();
      closeDataDeleteModal();
      stopAccountDeletePolling();
      if (creditsController) {
        creditsController.abort();
        creditsController = null;
      }
      setCredits('-', '-');
      updateRunButtons(0, 0);
      latestChildCredits = 0;
      familyChildrenCache = [];
      lastUserId = null;
      clearLocker();
      clearHistory();
      clearFamily();
      clearInviteInbox();

      if (emailEl) emailEl.textContent = '';
      clearConsentActionStatus();
      if (accountDeleteStatusEl) accountDeleteStatusEl.textContent = '';
      if (dataDeleteStatusEl) dataDeleteStatusEl.textContent = '';
      consentToggles.forEach((toggle) => {
        toggle.checked = false;
      });
      if (toggleHelp) toggleHelp.textContent = '';
      setMeasurementSystemStatus('', 'info');
      return;
    }

    // Account updates
    if (emailEl) {
      emailEl.textContent = snapshot.user.email || '';
    }
    lastUserId = snapshot.user.id;
    lastUserEmail = snapshot.user.email || null;
    clearConsentActionStatus();
    updateAccountDeleteStatus(snapshot);
    syncConsentToggles(snapshot);
    if (snapshot.accountDeleteStatus === 'pending' || snapshot.accountDeleteStatus === 'running') {
      startAccountDeletePolling();
    } else {
      stopAccountDeletePolling();
    }
    updateToggleHelp(snapshot);

    setCredits('...', '...');
    updateRunButtons(null, null); // loading state
    const creditSnapshot = readCreditSnapshot();
    if (creditSnapshot) {
      setCredits(String(creditSnapshot.adult), String(creditSnapshot.child));
      updateRunButtons(creditSnapshot.adult, creditSnapshot.child);
      latestChildCredits = Number(creditSnapshot.child) || 0;
    }
    loadCredits(snapshot.user.id);
    loadHistory(snapshot.user.id);
    loadInviteInbox(snapshot.user);
    loadFamily(snapshot.user.id);
    hydrateMeasurementSystem(snapshot.user.id);
    renderLocker([]);
  }

  function clearInviteInbox() {
    if (inviteList) inviteList.innerHTML = '';
    if (inviteEmpty) inviteEmpty.hidden = true;
    if (inviteLoading) inviteLoading.hidden = true;
  }

  function setInviteState({ loading, empty }) {
    if (inviteLoading) inviteLoading.hidden = !loading;
    if (inviteEmpty) inviteEmpty.hidden = !empty;
    if (inviteList) inviteList.hidden = Boolean(empty);
  }

  async function loadInviteInbox(user) {
    if (!inviteInbox || !inviteList) return;
    const client = sportyApp?.getClient ? sportyApp.getClient() : null;
    if (!client || !user || !user.email) return;

    setInviteState({ loading: true, empty: false });
    inviteList.innerHTML = '';

    try {
      const { data, error } = await client
        .from('guardian_invites')
        .select('id,child_id,invitee_email,status,issued_at,expires_at')
        .eq('status', 'issued')
        .ilike('invitee_email', user.email)
        .gt('expires_at', new Date().toISOString())
        .order('issued_at', { ascending: false });

      if (error) throw error;

      const rows = data || [];
      if (!rows.length) {
        setInviteState({ loading: false, empty: true });
        return;
      }

      rows.forEach((row) => {
        const li = document.createElement('li');
        li.className = 'flex items-center justify-between gap-3';

        const left = document.createElement('div');
        left.className = 'text-sm text-slate-600';
        left.textContent = 'You have been invited to join as a guardian.';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-pill btn-pill-primary btn-pill-xs';
        btn.textContent = 'Accept';
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            const { error: acceptError } = await client.rpc('accept_guardian_invite_by_id', {
              p_invite_id: row.id,
            });
            if (acceptError) throw acceptError;
            await loadInviteInbox(user);
            await loadFamily(user.id);
          } catch (error) {
            console.error('[Dashboard] Failed to accept guardian invite', error);
            btn.disabled = false;
            btn.textContent = 'Failed';
            setTimeout(() => {
              btn.textContent = 'Accept';
            }, 2000);
          }
        });

        li.appendChild(left);
        li.appendChild(btn);
        inviteList.appendChild(li);
      });

      setInviteState({ loading: false, empty: false });
    } catch (error) {
      console.error('[Dashboard] Failed to load invite inbox', error);
      setInviteState({ loading: false, empty: true });
    }
  }

  function setFamilyAddStatus(message, tone = 'info') {
    if (!familyAddStatus) return;
    familyAddStatus.hidden = false;
    familyAddStatus.className =
      tone === 'error' ? 'text-sm text-red-600 mt-2' : 'text-sm text-slate-500 mt-2';
    familyAddStatus.textContent = message;
  }

  async function handleCreateChild() {
    if (!familyAddForm) return;
    const client = sportyApp?.getClient ? sportyApp.getClient() : null;
    const user = sportyApp?.getUser ? sportyApp.getUser() : null;
    if (!client || !user) return;

    const formEl = familyAddForm;
    const name = formEl.elements.name ? String(formEl.elements.name.value || '').trim() : '';
    const birthdate = formEl.elements.birthdate ? String(formEl.elements.birthdate.value || '').trim() : '';
    const sex = formEl.elements.sex ? String(formEl.elements.sex.value || '').trim() : '';
    const biologicalRole = formEl.elements.biological_role
      ? String(formEl.elements.biological_role.value || 'unknown').trim()
      : 'unknown';

    if (!birthdate || !sex) {
      setFamilyAddStatus('Birthdate and sex are required.', 'error');
      return;
    }

    setFamilyAddStatus('Creating child…');
    try {
      const { data, error } = await client.rpc('create_child_v2', {
        p_name: name || null,
        p_birthdate: birthdate,
        p_sex: sex,
        p_biological_role: biologicalRole,
      });
      if (error) throw error;
      if (!data) throw new Error('No child id returned');
      setFamilyAddStatus('Child added.');
      familyAddForm.hidden = true;
      await loadFamily(user.id);
    } catch (error) {
      console.error('[Dashboard] Failed to create child', error);
      setFamilyAddStatus(
        `Unable to create child. ${error && error.message ? error.message : 'Please try again.'}`,
        'error'
      );
    }
  }

  function clearFamily() {
    if (familyList) familyList.innerHTML = '';
    if (familyEmpty) familyEmpty.hidden = true;
    if (familyLoading) familyLoading.hidden = true;
  }

  function setFamilyState({ loading, empty }) {
    if (familyLoading) familyLoading.hidden = !loading;
    if (familyEmpty) familyEmpty.hidden = !empty;
    if (familyList) familyList.hidden = Boolean(empty);
  }

  function formatChildAge(birthdate) {
    if (!birthdate) return null;
    const d = new Date(birthdate);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    let years = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) years -= 1;
    if (years < 0) years = 0;
    return years === 1 ? '1 year' : `${years} years`;
  }

  function shortId(value) {
    return null;
  }

  async function loadFamily(userId) {
    if (!familyZone || !familyList) return;

    const client = sportyApp?.getClient ? sportyApp.getClient() : null;
    if (!client) return;

    const requestId = (familyRequestId += 1);
    setFamilyState({ loading: true, empty: false });
    familyList.innerHTML = '';

    try {
      const { data: myGuardianships, error: myGuardError } = await client
        .from('guardianships')
        .select('child_id')
        .eq('guardian_user_id', userId)
        .eq('status', 'active');

      if (requestId !== familyRequestId) return;
      if (myGuardError) throw myGuardError;

      const childIds = Array.from(
        new Set((myGuardianships || []).map((row) => row.child_id).filter(Boolean))
      );

      if (!childIds.length) {
        setFamilyState({ loading: false, empty: true });
        familyChildrenCache = [];
        return;
      }

      const [
        { data: children, error: childError },
        { data: allGuardianships, error: allGuardError },
        { data: invites, error: inviteError },
      ] = await Promise.all([
        client
          .from('children')
          .select('id,name,birthdate,sex,created_at')
          .in('id', childIds)
          .order('created_at', { ascending: false }),
        client
          .from('guardianships')
          .select('child_id,guardian_user_id,role,biological_role,status,created_at')
          .in('child_id', childIds)
          .order('created_at', { ascending: true }),
        client
          .from('guardian_invites')
          .select('child_id,invitee_email,invited_user_id,status,issued_at,accepted_at')
          .in('child_id', childIds)
          .order('issued_at', { ascending: false }),
      ]);

      if (requestId !== familyRequestId) return;
      if (childError) throw childError;
      if (allGuardError) throw allGuardError;
      if (inviteError) throw inviteError;

      // Optional queries: these may not exist yet if migrations haven't been applied.
      let myShares = [];
      try {
        const { data, error } = await client
          .from('parent_measurement_shares')
          .select('child_id,revoked_at')
          .eq('owner_user_id', userId)
          .in('child_id', childIds);
        if (error) throw error;
        myShares = data || [];
      } catch (error) {
        console.warn('[Dashboard] parent_measurement_shares unavailable; skipping', error);
        myShares = [];
      }

      let guardianEmails = [];
      try {
        const { data, error } = await client.rpc('get_guardian_emails_for_children', {
          p_child_ids: childIds,
        });
        if (error) throw error;
        guardianEmails = data || [];
      } catch (error) {
        console.warn('[Dashboard] get_guardian_emails_for_children unavailable; skipping', error);
        guardianEmails = [];
      }

      const guardiansByChild = new Map();
      (allGuardianships || []).forEach((row) => {
        const key = row.child_id;
        if (!key) return;
        if (!guardiansByChild.has(key)) guardiansByChild.set(key, []);
        guardiansByChild.get(key).push(row);
      });

      const emailByGuardian = new Map();
      const pendingInvitesByChild = new Map();
      (invites || []).forEach((row) => {
        if (row.child_id && row.status === 'issued' && row.invitee_email) {
          if (!pendingInvitesByChild.has(row.child_id)) pendingInvitesByChild.set(row.child_id, []);
          pendingInvitesByChild.get(row.child_id).push(row.invitee_email);
        }
        const gid = row.invited_user_id;
        const email = row.invitee_email;
        if (!gid || !email) return;
        if (!emailByGuardian.has(gid)) emailByGuardian.set(gid, email);
      });

      (guardianEmails || []).forEach((row) => {
        if (!row) return;
        if (row.guardian_user_id && row.email && !emailByGuardian.has(row.guardian_user_id)) {
          emailByGuardian.set(row.guardian_user_id, row.email);
        }
      });

      const childrenSorted = (children || []).slice().sort((a, b) => {
        const da = new Date(a.created_at || 0).getTime();
        const db = new Date(b.created_at || 0).getTime();
        return db - da;
      });

      const myShareEnabledByChild = new Map();
      (myShares || []).forEach((row) => {
        if (!row || !row.child_id) return;
        myShareEnabledByChild.set(row.child_id, row.revoked_at == null);
      });

      childrenSorted.forEach((child) => {
        const li = document.createElement('li');
        li.className = 'rounded-lg border border-slate-100 bg-white px-4 py-3';

        const titleRow = document.createElement('div');
        titleRow.className = 'flex items-start justify-between gap-3';

        const name = child.name || 'Child';
        const age = formatChildAge(child.birthdate);
        const sex = child.sex ? String(child.sex).replace(/_/g, ' ') : null;

        const left = document.createElement('div');
        left.innerHTML = `
          <div class="flex items-center gap-2">
            <h4 class="m-0 text-slate-900 font-medium">${escapeHtml(name)}</h4>
            ${age ? `<span class="badge-subtle">${escapeHtml(age)}</span>` : ''}
            ${sex ? `<span class="badge-subtle">${escapeHtml(sex)}</span>` : ''}
          </div>
        `;

        titleRow.appendChild(left);

        if (latestChildCredits > 0) {
          const runBtn = document.createElement('button');
          runBtn.type = 'button';
          runBtn.className = 'btn-pill btn-pill-primary btn-pill-xs flex-shrink-0';
          runBtn.textContent = 'Run analysis';
          runBtn.addEventListener('click', () => {
            window.location.assign(`/child-intake?child_id=${encodeURIComponent(child.id)}`);
          });
          titleRow.appendChild(runBtn);
        }
        li.appendChild(titleRow);

        const myGuardianship = (guardiansByChild.get(child.id) || []).find(
          (g) => g.guardian_user_id === userId && g.status === 'active'
        );

        // Parent measurement sharing (biological parents only; share is consumed by all active guardians).
        const myBio = myGuardianship && myGuardianship.biological_role ? String(myGuardianship.biological_role) : null;
        if (myBio === 'mother' || myBio === 'father') {
          const sharingBlock = document.createElement('div');
          sharingBlock.className = 'mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3';

          const leftCopy = document.createElement('div');
          leftCopy.className = 'min-w-0';
          leftCopy.innerHTML = `
            <div class="text-sm font-medium text-slate-900">Share my latest measurements</div>
            <div class="text-xs text-slate-500">Allow all active guardians to use your latest saved measurements when forecasting this child.</div>
          `;

          const toggle = document.createElement('input');
          toggle.type = 'checkbox';
          toggle.checked = Boolean(myShareEnabledByChild.get(child.id));

          const wrapper = document.createElement('label');
          wrapper.className = 'toggle flex-shrink-0';
          wrapper.setAttribute('aria-label', 'Share my latest measurements with guardians');
          wrapper.appendChild(toggle);
          const track = document.createElement('span');
          track.className = 'toggle__track';
          wrapper.appendChild(track);

          const status = document.createElement('p');
          status.className = 'text-xs text-slate-500 mt-2';
          status.hidden = true;

          toggle.addEventListener('change', async () => {
            toggle.disabled = true;
            status.hidden = false;
            status.className = 'text-xs text-slate-500 mt-2';
            status.textContent = 'Saving…';
            try {
              const { error } = await client.rpc('set_parent_measurement_share', {
                p_child_id: child.id,
                p_enabled: Boolean(toggle.checked),
              });
              if (error) throw error;
              status.textContent = toggle.checked ? 'Sharing enabled.' : 'Sharing disabled.';
              myShareEnabledByChild.set(child.id, Boolean(toggle.checked));
            } catch (error) {
              console.error('[Dashboard] Failed to update measurement sharing', error);
              toggle.checked = !toggle.checked;
              status.className = 'text-xs text-red-600 mt-2';
              status.textContent =
                (error && error.message) || 'Unable to update sharing. Please try again.';
            } finally {
              toggle.disabled = false;
              setTimeout(() => {
                status.hidden = true;
              }, 2500);
            }
          });

          sharingBlock.appendChild(leftCopy);
          sharingBlock.appendChild(wrapper);
          li.appendChild(sharingBlock);
          li.appendChild(status);
        }

        // Invite co-guardian (creator-driven assignment)
        const inviteBlock = document.createElement('div');
        inviteBlock.className = 'mt-3';
        inviteBlock.innerHTML = `
          <div class="text-xs text-slate-500 uppercase tracking-wider font-medium">Invite co-guardian</div>
          <div class="mt-1 grid gap-2 sm:grid-cols-[1fr_auto_auto] items-center">
            <input class="input-base" type="email" placeholder="Email address" data-invite-email />
            <select class="input-base" data-invite-bio>
              <option value="unknown">Unknown</option>
              <option value="mother">Biological mother</option>
              <option value="father">Biological father</option>
              <option value="not_biological">Not biological parent</option>
            </select>
            <button class="btn-pill btn-pill-secondary btn-pill-xs" type="button" data-invite-send>Invite</button>
          </div>
          <p class="text-xs text-slate-500 mt-2" data-invite-status hidden></p>
        `;

        const sendBtn = inviteBlock.querySelector('[data-invite-send]');
        const emailInput = inviteBlock.querySelector('[data-invite-email]');
        const bioSelect = inviteBlock.querySelector('[data-invite-bio]');
        const status = inviteBlock.querySelector('[data-invite-status]');

        const setInviteStatus = (message, tone) => {
          if (!status) return;
          status.hidden = false;
          status.className =
            tone === 'error' ? 'text-xs text-red-600 mt-2' : 'text-xs text-slate-500 mt-2';
          status.textContent = message;
        };

        if (sendBtn) {
          sendBtn.addEventListener('click', async () => {
            const email = emailInput ? String(emailInput.value || '').trim() : '';
            const biological = bioSelect ? String(bioSelect.value || 'unknown') : 'unknown';
            if (!email) {
              setInviteStatus('Enter an email address.', 'error');
              return;
            }
            sendBtn.disabled = true;
            setInviteStatus('Creating invite…');
            try {
              const { data: token, error: inviteError } = await client.rpc('invite_guardian', {
                p_child_id: child.id,
                p_invitee_email: email,
                p_invited_biological_role: biological,
              });
              if (inviteError) throw inviteError;
              // Token is returned for share-link use, but B can also accept from their dashboard inbox.
              setInviteStatus('Invite created. They can accept it from their dashboard (Invites).');
              if (emailInput) emailInput.value = '';
              await loadFamily(userId);
            } catch (error) {
              console.error('[Dashboard] Failed to invite guardian', error);
              setInviteStatus(
                `Unable to create invite. ${error && error.message ? error.message : ''}`.trim(),
                'error'
              );
            } finally {
              sendBtn.disabled = false;
            }
          });
        }

        li.appendChild(inviteBlock);

        if (myGuardianship) {
          const relBlock = document.createElement('div');
          relBlock.className = 'mt-3';
          relBlock.innerHTML = `
            <div class="text-xs text-slate-500 uppercase tracking-wider font-medium">Your relation</div>
            <div class="mt-1 grid gap-2 sm:grid-cols-[1fr_auto] items-center">
              <select class="input-base" data-relation-select>
                <option value="unknown">Unknown</option>
                <option value="mother">Biological mother</option>
                <option value="father">Biological father</option>
                <option value="not_biological">Not biological parent</option>
              </select>
              <button class="btn-pill btn-pill-secondary btn-pill-xs" type="button" data-relation-save>Save</button>
            </div>
            <p class="text-xs text-slate-500 mt-2" data-relation-status hidden></p>
          `;

          const select = relBlock.querySelector('[data-relation-select]');
          const saveBtn = relBlock.querySelector('[data-relation-save]');
          const status = relBlock.querySelector('[data-relation-status]');
          if (select) {
            const current = myGuardianship.biological_role || 'unknown';
            select.value = current;
          }
          const setRelStatus = (message, tone) => {
            if (!status) return;
            status.hidden = false;
            status.className =
              tone === 'error' ? 'text-xs text-red-600 mt-2' : 'text-xs text-slate-500 mt-2';
            status.textContent = message;
          };

          if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
              const newRole = select ? String(select.value || 'unknown') : 'unknown';
              saveBtn.disabled = true;
              setRelStatus('Saving…');
              try {
                const guardianRole =
                  newRole === 'mother' || newRole === 'father' ? 'parent' : 'guardian';
                const { error: updError } = await client
                  .from('guardianships')
                  .update({ biological_role: newRole, role: guardianRole })
                  .eq('child_id', child.id)
                  .eq('guardian_user_id', userId);
                if (updError) throw updError;
                setRelStatus('Saved.');
                await loadFamily(userId);
              } catch (error) {
                console.error('[Dashboard] Failed to update relation', error);
                setRelStatus(
                  'Unable to save. If mother/father is already assigned, choose another option.',
                  'error'
                );
              } finally {
                saveBtn.disabled = false;
              }
            });
          }

          li.appendChild(relBlock);
        }

        const guardians = guardiansByChild.get(child.id) || [];
        if (guardians.length) {
          const gWrap = document.createElement('div');
          gWrap.className = 'mt-2';

          const label = document.createElement('div');
          label.className = 'text-xs text-slate-500 uppercase tracking-wider font-medium';
          label.textContent = 'Guardians';
          gWrap.appendChild(label);

          const gList = document.createElement('div');
          gList.className = 'mt-1 flex flex-wrap gap-2';

          guardians.forEach((g) => {
            const chip = document.createElement('span');
            const gid = g.guardian_user_id;
            const role = g.role ? String(g.role).replace(/_/g, ' ') : 'guardian';
            const status = g.status ? String(g.status).replace(/_/g, ' ') : 'active';
            const bio = g.biological_role ? String(g.biological_role).replace(/_/g, ' ') : null;
            const who = emailByGuardian.get(gid) || (gid === userId ? lastUserEmail || 'You' : 'Guardian');

            chip.className = 'badge-subtle';
            chip.textContent = `${who} · ${role}${bio ? ` · ${bio}` : ''} · ${status}`;
            gList.appendChild(chip);
          });

          gWrap.appendChild(gList);
          li.appendChild(gWrap);
        }

        const pending = pendingInvitesByChild.get(child.id) || [];
        if (pending.length) {
          const pendingWrap = document.createElement('div');
          pendingWrap.className = 'mt-2';

          const label = document.createElement('div');
          label.className = 'text-xs text-slate-500 uppercase tracking-wider font-medium';
          label.textContent = 'Pending invites';
          pendingWrap.appendChild(label);

          const pList = document.createElement('div');
          pList.className = 'mt-1 flex flex-wrap gap-2';
          pending.slice(0, 10).forEach((email) => {
            const chip = document.createElement('span');
            chip.className = 'badge-subtle';
            chip.textContent = email;
            pList.appendChild(chip);
          });
          pendingWrap.appendChild(pList);
          li.appendChild(pendingWrap);
        }

        familyList.appendChild(li);
      });

      familyChildrenCache = childrenSorted.slice();
      setFamilyState({ loading: false, empty: childrenSorted.length === 0 });
      return childrenSorted;
    } catch (error) {
      console.error('[Sporty] Failed to load family data', error);
      setFamilyState({ loading: false, empty: true });
      familyChildrenCache = [];
      return [];
    }
  }

  function syncConsentToggles(snapshot) {
    const consents = snapshot?.consents || {};
    consentToggles.forEach((toggle) => {
      const consentType = toggle.dataset.consentTypeToggle;
      const granted = Boolean(consents?.[consentType]?.granted);
      if (toggle.checked !== granted) {
        toggle.checked = granted;
      }
    });
  }

  function updateToggleHelp(snapshot) {
    if (!toggleHelp) return;
    // Keep the static helper copy from dashboard.astro; avoid redundant status text above toggles.
    if (!toggleHelp.textContent || !toggleHelp.textContent.trim()) {
      toggleHelp.textContent =
        'Control storage and processing by data category. Revoking a category starts scoped deletion for that category.';
    }
  }

  function getConsentLabel(consentType) {
    if (consentType === 'basic_processing') return 'Basic processing';
    if (consentType === 'sensitive_health_processing') return 'Sensitive health processing';
    if (consentType === 'child_data_processing') return 'Child data processing';
    return 'Consent';
  }

  function clearConsentActionStatus() {
    if (!consentStatusEl) return;
    consentStatusEl.className = 'status-area mt-2';
    consentStatusEl.textContent = '';
    consentStatusEl.removeAttribute('role');
    consentStatusEl.removeAttribute('aria-live');
    consentStatusEl.hidden = true;
  }

  function showConsentActionStatus({ type, text }) {
    if (!consentStatusEl) return;
    if (!text) {
      clearConsentActionStatus();
      return;
    }

    consentStatusEl.hidden = false;
    if (type === 'success') {
      consentStatusEl.className = 'text-sm text-teal-700 bg-teal-50 px-3 py-2 rounded-md border border-teal-100';
      consentStatusEl.setAttribute('role', 'status');
      consentStatusEl.setAttribute('aria-live', 'polite');
    } else if (type === 'error') {
      consentStatusEl.className = 'text-sm text-red-700 bg-red-50 px-3 py-2 rounded-md border border-red-100';
      consentStatusEl.setAttribute('role', 'alert');
      consentStatusEl.setAttribute('aria-live', 'assertive');
    } else {
      consentStatusEl.className = 'text-sm text-slate-700 bg-slate-100 px-3 py-2 rounded-md border border-slate-200';
      consentStatusEl.setAttribute('role', 'status');
      consentStatusEl.setAttribute('aria-live', 'polite');
    }
    consentStatusEl.textContent = text;
  }

  function updateAccountDeleteStatus(snapshot) {
    if (!accountDeleteStatusEl) return;
    const status = snapshot?.accountDeleteStatus ? String(snapshot.accountDeleteStatus) : null;

    if (status === 'pending' || status === 'running') {
      accountDeleteStatusEl.className = 'text-sm text-rose-700 bg-rose-50 px-3 py-2 rounded-md border border-rose-100';
      accountDeleteStatusEl.textContent = 'Account deletion is in progress. You will be signed out when complete.';
      return;
    }
    if (status === 'failed') {
      accountDeleteStatusEl.className = 'text-sm text-red-700 bg-red-50 px-3 py-2 rounded-md border border-red-100';
      accountDeleteStatusEl.textContent = 'Account deletion failed. Retry and contact support if it persists.';
      return;
    }
    if (status === 'done') {
      accountDeleteStatusEl.className = 'text-sm text-slate-700 bg-slate-100 px-3 py-2 rounded-md border border-slate-200';
      accountDeleteStatusEl.textContent = 'Account deletion completed. Signing you out...';
      return;
    }

    accountDeleteStatusEl.className = 'text-sm text-slate-600';
    accountDeleteStatusEl.textContent = '';
  }

  function openAccountDeleteModal() {
    if (!accountDeleteOverlay) return;
    accountDeleteOverlay.hidden = false;
    if (accountDeleteConfirmInput) {
      accountDeleteConfirmInput.value = '';
      accountDeleteConfirmInput.focus();
    }
    updateAccountDeleteConfirmState();
  }

  function closeAccountDeleteModal() {
    if (!accountDeleteOverlay) return;
    accountDeleteOverlay.hidden = true;
    if (accountDeleteConfirmInput) accountDeleteConfirmInput.value = '';
    updateAccountDeleteConfirmState();
  }

  function updateAccountDeleteConfirmState() {
    if (!accountDeleteConfirmBtn) return;
    const ok = accountDeleteConfirmInput && accountDeleteConfirmInput.value.trim() === 'DELETE';
    const disabled = !ok || accountDeleteInFlight;
    accountDeleteConfirmBtn.disabled = disabled;
    accountDeleteConfirmBtn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    accountDeleteConfirmBtn.classList.toggle('btn-pill-disabled', disabled);
  }

  function stopAccountDeletePolling() {
    if (accountDeletePollTimer) {
      clearTimeout(accountDeletePollTimer);
      accountDeletePollTimer = null;
    }
  }

  function startAccountDeletePolling() {
    if (accountDeletePollTimer) return;
    const poll = async () => {
      if (!sportyApp?.getUser?.()) return;
      try {
        const statusPayload =
          typeof sportyApp.refreshAccountDelete === 'function'
            ? await sportyApp.refreshAccountDelete()
            : typeof sportyApp.getAccountDeleteStatus === 'function'
              ? await sportyApp.getAccountDeleteStatus()
              : null;
        const status = statusPayload?.status || null;
        updateAccountDeleteStatus({ accountDeleteStatus: status });
        if (status === 'done') {
          clearAllResultCaches();
          await sportyApp.signOut();
          window.location.assign('/?account_deleted=1');
          return;
        }
      } catch (error) {
        console.warn('[Dashboard] Account delete status poll failed', error);
      }
      accountDeletePollTimer = setTimeout(poll, 2000);
    };
    accountDeletePollTimer = setTimeout(poll, 800);
  }

  function clearAllResultCaches() {
    const keys = [
      'sporty:lastResult',
      'sporty:lastPremiumResult',
      'sporty:lastCreditSnapshot',
      'sporty:intake:draft:v1',
      'sporty:child-intake:draft:v1',
    ];
    try {
      keys.forEach((key) => {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.warn('[Dashboard] Failed to clear storage after account deletion', error);
    }
  }

  async function handleAccountDeleteConfirm() {
    if (!sportyApp?.deleteAccount || !accountDeleteConfirmBtn) return;
    if (!accountDeleteConfirmInput || accountDeleteConfirmInput.value.trim() !== 'DELETE') {
      updateAccountDeleteConfirmState();
      return;
    }
    accountDeleteInFlight = true;
    updateAccountDeleteConfirmState();
    try {
      await sportyApp.deleteAccount();
      closeAccountDeleteModal();
      updateAccountDeleteStatus({ accountDeleteStatus: 'pending' });
      startAccountDeletePolling();
    } catch (error) {
      console.error('[Dashboard] Failed to request account deletion', error);
      if (accountDeleteStatusEl) {
        accountDeleteStatusEl.className = 'text-sm text-red-700 bg-red-50 px-3 py-2 rounded-md border border-red-100';
        accountDeleteStatusEl.textContent = 'Unable to start account deletion. Please try again.';
      }
    } finally {
      accountDeleteInFlight = false;
      updateAccountDeleteConfirmState();
    }
  }

  function updateDataDeleteStatus(message, tone = 'info') {
    if (!dataDeleteStatusEl) return;
    if (!message) {
      dataDeleteStatusEl.className = 'text-sm text-slate-600';
      dataDeleteStatusEl.textContent = '';
      return;
    }
    if (tone === 'success') {
      dataDeleteStatusEl.className = 'text-sm text-teal-700 bg-teal-50 px-3 py-2 rounded-md border border-teal-100';
    } else if (tone === 'error') {
      dataDeleteStatusEl.className = 'text-sm text-red-700 bg-red-50 px-3 py-2 rounded-md border border-red-100';
    } else {
      dataDeleteStatusEl.className = 'text-sm text-slate-700 bg-slate-100 px-3 py-2 rounded-md border border-slate-200';
    }
    dataDeleteStatusEl.textContent = message;
  }

  function openDataDeleteModal() {
    if (!dataDeleteOverlay) return;
    dataDeleteOverlay.hidden = false;
    if (dataDeleteConfirmInput) {
      dataDeleteConfirmInput.value = '';
      dataDeleteConfirmInput.focus();
    }
    updateDataDeleteConfirmState();
  }

  function closeDataDeleteModal() {
    if (!dataDeleteOverlay) return;
    dataDeleteOverlay.hidden = true;
    if (dataDeleteConfirmInput) dataDeleteConfirmInput.value = '';
    updateDataDeleteConfirmState();
  }

  function updateDataDeleteConfirmState() {
    if (!dataDeleteConfirmBtn) return;
    const ok = dataDeleteConfirmInput && dataDeleteConfirmInput.value.trim() === 'DELETE DATA';
    const disabled = !ok || dataDeleteInFlight;
    dataDeleteConfirmBtn.disabled = disabled;
    dataDeleteConfirmBtn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    dataDeleteConfirmBtn.classList.toggle('btn-pill-disabled', disabled);
  }

  async function handleDataDeleteConfirm() {
    if (!sportyApp?.deleteAllData || !dataDeleteConfirmInput || !dataDeleteConfirmBtn) return;
    if (dataDeleteConfirmInput.value.trim() !== 'DELETE DATA') {
      updateDataDeleteConfirmState();
      return;
    }
    dataDeleteInFlight = true;
    updateDataDeleteConfirmState();
    updateDataDeleteStatus('Deleting saved measurements and results...', 'info');
    try {
      const payload = await sportyApp.deleteAllData();
      const counts = payload?.deleted_counts || {};
      closeDataDeleteModal();
      historyItemsState = [];
      renderHistory([]);
      updateDataDeleteStatus(
        `Deleted ${counts.measurements || 0} measurements, ${counts.recommendations || 0} recommendations, ${counts.child_forecast_runs || 0} child runs.`,
        'success'
      );
    } catch (error) {
      console.error('[Dashboard] Failed to delete all data', error);
      updateDataDeleteStatus('Unable to delete data. Please try again.', 'error');
    } finally {
      dataDeleteInFlight = false;
      updateDataDeleteConfirmState();
    }
  }

  async function handleToggleChange(event) {
    const target = event.currentTarget;
    if (!target) return;
    const consentType = target.dataset.consentTypeToggle;
    if (!consentType) return;

    if (target.checked) {
      if (!sportyApp.getUser()) {
        target.checked = false;
        return;
      }

      target.disabled = true;
      try {
        let snap = (await sportyApp.grantConsent(consentType, 'consent-policy-v1', 'EU')) || {};
        try {
          await sportyApp.refreshConsent();
          const status = typeof sportyApp.getConsentStatus === 'function' ? await sportyApp.getConsentStatus() : null;
          if (status && typeof status === 'object') snap = status;
        } catch (refreshError) {
          console.warn('[Dashboard] Consent refresh after grant failed; using grant response payload', refreshError);
        }
        const consent = snap?.consents?.[consentType];
        const label = getConsentLabel(consentType);
        updateToggleHelp(snap);
        syncConsentToggles(snap);
        if (consent?.granted) {
          showConsentActionStatus({ type: 'success', text: `${label} turned on successfully.` });
        } else {
          target.checked = false;
          showConsentActionStatus({ type: 'error', text: `Unable to update ${label.toLowerCase()}. Please try again.` });
        }
      } catch (error) {
        console.error('[Dashboard] Failed to grant consent', error);
        target.checked = false;
        const label = getConsentLabel(consentType);
        showConsentActionStatus({ type: 'error', text: `Unable to update ${label.toLowerCase()}. Please try again.` });
      } finally {
        target.disabled = false;
      }
    } else {
      if (typeof sportyApp.revokeConsent !== 'function') return;
      target.disabled = true;
      try {
        let snap = (await sportyApp.revokeConsent(consentType)) || {};
        try {
          await sportyApp.refreshConsent();
          const status = typeof sportyApp.getConsentStatus === 'function' ? await sportyApp.getConsentStatus() : null;
          if (status && typeof status === 'object') snap = status;
        } catch (refreshError) {
          console.warn('[Dashboard] Consent refresh after revoke failed; using revoke response payload', refreshError);
        }
        const consent = snap?.consents?.[consentType];
        const purgeStatus = String(consent?.purge_status || '').toLowerCase();
        const label = getConsentLabel(consentType);
        updateToggleHelp(snap);
        syncConsentToggles(snap);
        if (purgeStatus === 'failed') {
          showConsentActionStatus({
            type: 'error',
            text: `${label} turned off, but cleanup failed. Please try again.`,
          });
        } else if (purgeStatus === 'pending' || purgeStatus === 'running') {
          showConsentActionStatus({
            type: 'info',
            text: `${label} turned off successfully. Data cleanup is in progress.`,
          });
        } else {
          showConsentActionStatus({ type: 'success', text: `${label} turned off successfully.` });
        }
      } catch (error) {
        console.error(error);
        target.checked = true; // Revert toggle if revoke fails
        const label = getConsentLabel(consentType);
        showConsentActionStatus({ type: 'error', text: `Unable to update ${label.toLowerCase()}. Please try again.` });
      } finally {
        target.disabled = false;
      }
    }
  }

  function setCredits(adult, child) {
    if (creditsAdultEl) creditsAdultEl.textContent = adult;
    if (creditsChildEl) creditsChildEl.textContent = child;
  }

  function updateRunButtons(adultCredits, childCredits) {
    runButtons.forEach((btn) => {
      const kind = btn.dataset.premiumRun;
      const target = btn.dataset.premiumRunTarget;
      const creditCount = kind === 'adult' ? adultCredits : childCredits;

      // Loading state
      if (adultCredits === null || childCredits === null) {
        btn.disabled = true;
        btn.setAttribute('aria-disabled', 'true');
        btn.classList.add('btn-pill-disabled');
        btn.textContent = 'Run analysis';
        return;
      }

      const hasCredits = Number(creditCount) > 0;
      btn.disabled = !hasCredits;
      btn.setAttribute('aria-disabled', hasCredits ? 'false' : 'true');
      if (!hasCredits) {
        btn.classList.add('btn-pill-disabled');
        btn.textContent = 'Run analysis';
      } else {
        btn.classList.remove('btn-pill-disabled');
        btn.textContent = 'Run analysis';
      }

      btn.onclick = () => {
        if (!hasCredits) return;
        if (kind === 'child') {
          handleStartChildAnalysis();
          return;
        }
        if (target) window.location.href = target;
      };
    });
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
      const response = await fetch(`/api/credits?user_id=${encodeURIComponent(userId)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: creditsController.signal,
      });
      if (!response.ok) {
        throw new Error(`Failed to load credits (${response.status})`);
      }
      const data = await response.json();
      const adult = normalizeCreditCount(data?.adult_credits ?? data?.adult);
      const child = normalizeCreditCount(data?.child_credits ?? data?.child);
      setCredits(String(adult), String(child));
      updateRunButtons(adult, child);
      const previousChildCredits = latestChildCredits;
      latestChildCredits = child;
      if (previousChildCredits !== latestChildCredits && lastUserId) {
        // Re-render child rows so per-child CTA reflects credit availability.
        loadFamily(lastUserId);
      }
      creditsController = null;
    } catch (error) {
      if (creditsController && creditsController.signal.aborted) {
        creditsController = null;
        return;
      }
      console.error('[Sporty] Failed to load credits', error);
      setCredits('--', '--');
      updateRunButtons(0, 0);
      latestChildCredits = 0;
      creditsController = null;
    }
  }

  function setChildAnalysisDialogState({ loading, empty }) {
    if (childAnalysisDialogLoading) childAnalysisDialogLoading.hidden = !loading;
    if (childAnalysisDialogEmpty) childAnalysisDialogEmpty.hidden = !empty;
    if (childAnalysisDialogList) childAnalysisDialogList.hidden = Boolean(empty);
  }

  function renderChildChooser(children) {
    if (!childAnalysisDialogList) return;
    childAnalysisDialogList.innerHTML = '';
    const rows = Array.isArray(children) ? children : [];
    if (!rows.length) {
      setChildAnalysisDialogState({ loading: false, empty: true });
      return;
    }

    setChildAnalysisDialogState({ loading: false, empty: false });
    rows.forEach((child) => {
      const li = document.createElement('li');
      li.className =
        'flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2';

      const left = document.createElement('div');
      left.className = 'min-w-0';
      const title = document.createElement('div');
      title.className = 'text-sm font-medium text-slate-900 truncate';
      title.textContent = child.name || 'Child';
      const meta = document.createElement('div');
      meta.className = 'text-xs text-slate-500';
      meta.textContent = child.birthdate ? `Born ${child.birthdate}` : '';
      left.appendChild(title);
      if (meta.textContent) left.appendChild(meta);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-pill btn-pill-primary btn-pill-xs flex-shrink-0';
      btn.textContent = 'Continue';
      btn.addEventListener('click', () => {
        try {
          childAnalysisDialog?.close?.();
        } catch (_) {}
        window.location.assign(`/child-intake?child_id=${encodeURIComponent(child.id)}`);
      });

      li.appendChild(left);
      li.appendChild(btn);
      childAnalysisDialogList.appendChild(li);
    });
  }

  async function handleStartChildAnalysis() {
    if (latestChildCredits <= 0) return;

    if (Array.isArray(familyChildrenCache) && familyChildrenCache.length === 1) {
      const only = familyChildrenCache[0];
      if (only && only.id) {
        window.location.assign(`/child-intake?child_id=${encodeURIComponent(only.id)}`);
        return;
      }
    }

    if (!childAnalysisDialog) {
      window.location.assign('/child-intake');
      return;
    }

    setChildAnalysisDialogState({ loading: true, empty: false });
    if (childAnalysisDialogList) childAnalysisDialogList.innerHTML = '';

    try {
      let rows = familyChildrenCache;
      if ((!rows || !rows.length) && lastUserId) {
        rows = (await loadFamily(lastUserId)) || [];
      }
      renderChildChooser(rows || []);
    } catch (error) {
      console.warn('[Dashboard] Unable to load children for chooser', error);
      renderChildChooser([]);
    }

    if (typeof childAnalysisDialog.showModal === 'function') {
      childAnalysisDialog.showModal();
    } else if (typeof childAnalysisDialog.show === 'function') {
      childAnalysisDialog.show();
    }
  }

  if (childAnalysisDialog) {
    childAnalysisDialog.addEventListener('click', (event) => {
      if (event.target === childAnalysisDialog) {
        try {
          childAnalysisDialog.close();
        } catch (_) {}
      }
    });
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

  function clearHistory() {
    historyItemsState = [];
    if (historyGrid) historyGrid.innerHTML = '';
  }

  async function loadHistory(userId) {
    if (!historyGrid) return;

    // Clear placeholders
    historyGrid.innerHTML = '<p class="col-span-full text-center py-8 text-slate-500">Loading history...</p>';

    const client = sportyApp?.getClient ? sportyApp.getClient() : null;
    if (!client) return;

    try {
      // Keep adult history on the stable RLS-safe view and enrich item IDs for delete-item.
      const { data: adultData, error: adultError } = await client
        .from('recommendation_results')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (adultError) throw adultError;

      const adultItems = (adultData || []).map((item) => {
        const isPremium = Boolean(item.is_premium);
        return {
          id: item.id,
          itemType: 'adult_run',
          title: isPremium ? 'Adult Premium Analysis' : 'Adult Quick Analysis',
          date: item.created_at,
          summary: item.summary || 'Analysis completed.',
          isPremium,
          link: isPremium ? `/results/premium?id=${item.id}` : `/results?id=${item.id}`,
        };
      });

      let childItems = [];
      try {
        const { data: childData, error: childError } = await client
          .from('child_forecast_runs')
          .select('id,forecasted_at,metadata')
          .eq('guardian_user_id', userId)
          .order('forecasted_at', { ascending: false });
        if (childError) throw childError;

        childItems = (childData || []).map((item) => {
          const metadata = item.metadata || {};
          const premium = metadata.child_premium_analysis || {};
          const suggested = premium.suggested_sport || 'Child forecast run';
          return {
            id: item.id,
            itemType: 'child_run',
            title: 'Child Forecast Analysis',
            date: item.forecasted_at || item.created_at,
            summary: `Top match: ${suggested}`,
            isPremium: true,
            link: '/child-results',
          };
        });
      } catch (error) {
        console.warn('[Dashboard] Child run history unavailable; continuing with adult history', error);
      }

      historyItemsState = [...adultItems, ...childItems].sort((a, b) => {
        const left = new Date(a.date || 0).getTime();
        const right = new Date(b.date || 0).getTime();
        return right - left;
      });
      renderHistory(historyItemsState);

    } catch (error) {
      console.error('[Sporty] Failed to load history', error);
      historyGrid.innerHTML = '<p class="col-span-full text-center py-8 text-red-500">Unable to load history.</p>';
    }
  }

  async function requestDeleteHistoryItem(item) {
    if (!sportyApp?.deleteDataItem) return;
    const previous = historyItemsState.slice();
    historyItemsState = historyItemsState.filter((entry) => entry.id !== item.id);
    renderHistory(historyItemsState);

    try {
      await sportyApp.deleteDataItem(item.itemType, item.id);
      updateDataDeleteStatus('Run deleted.', 'success');
    } catch (error) {
      console.error('[Dashboard] Failed to delete run item', error);
      historyItemsState = previous;
      renderHistory(historyItemsState);
      updateDataDeleteStatus('Unable to delete run. Please try again.', 'error');
    }
  }

  function renderHistory(items) {
    if (!historyGrid) return;
    historyGrid.innerHTML = '';

    if (!items || items.length === 0) {
      historyGrid.innerHTML = '<p class="col-span-full text-center py-8 text-slate-500">No analyses found. Start a new one!</p>';
      return;
    }

    items.forEach(item => {
      const article = document.createElement('article');
      article.className = 'history-card';
      article.dataset.historyId = item.id;

      const dateStr = new Date(item.date).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      const badgeClass = item.isPremium ? 'badge-premium' : 'badge-free';
      const badgeText = item.isPremium ? 'Premium' : 'Free';

      article.innerHTML = `
        <div class="history-card__header">
          <div>
            <h2>${item.title}</h2>
            <p class="history-card__meta">${dateStr}</p>
          </div>
          <span class="${badgeClass}">${badgeText}</span>
        </div>
        <p class="history-card__summary">${item.summary}</p>
        <div class="history-card__actions">
          <a class="btn-pill btn-pill-primary btn-pill-sm" href="${item.link}">View details</a>
          <div class="history-card__menu">
            <button
              type="button"
              class="history-card__menu-trigger"
              aria-haspopup="menu"
              aria-expanded="false"
              data-history-menu-trigger
            >
              ...
            </button>
            <div class="history-card__menu-dropdown hidden" role="menu" data-history-menu-dropdown>
              <button type="button" class="history-card__menu-item" role="menuitem" data-history-delete-item>
                Delete run
              </button>
            </div>
          </div>
        </div>
      `;
      const menuTrigger = article.querySelector('[data-history-menu-trigger]');
      const menuDropdown = article.querySelector('[data-history-menu-dropdown]');
      const deleteItemBtn = article.querySelector('[data-history-delete-item]');

      if (menuTrigger && menuDropdown && deleteItemBtn) {
        menuTrigger.addEventListener('click', (event) => {
          event.stopPropagation();
          const expanded = menuTrigger.getAttribute('aria-expanded') === 'true';
          historyGrid.querySelectorAll('[data-history-menu-dropdown]').forEach((node) => {
            node.classList.add('hidden');
          });
          historyGrid.querySelectorAll('[data-history-menu-trigger]').forEach((node) => {
            node.setAttribute('aria-expanded', 'false');
          });
          if (!expanded) {
            menuDropdown.classList.remove('hidden');
            menuTrigger.setAttribute('aria-expanded', 'true');
          }
        });

        deleteItemBtn.addEventListener('click', (event) => {
          event.stopPropagation();
          const ok = window.confirm('Delete this run?');
          if (!ok) return;
          requestDeleteHistoryItem(item);
        });
      }
      historyGrid.appendChild(article);
    });

    const closeMenus = () => {
      historyGrid.querySelectorAll('[data-history-menu-dropdown]').forEach((node) => {
        node.classList.add('hidden');
      });
      historyGrid.querySelectorAll('[data-history-menu-trigger]').forEach((node) => {
        node.setAttribute('aria-expanded', 'false');
      });
    };
    if (!historyMenuOutsideBound) {
      historyMenuOutsideBound = true;
      document.addEventListener('click', (event) => {
        if (!historyGrid.contains(event.target)) {
          closeMenus();
        }
      });
    }
  }

  function escapeHtml(value) {
    return (value || '')
      .toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
