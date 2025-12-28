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
  const consentToggle = root.querySelector('[data-consent-toggle]');
  const toggleHelp = root.querySelector('[data-profile-toggle-help]');
  const signoutBtn = root.querySelector('[data-auth-signout]');

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

  let familyRequestId = 0;

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

  if (consentToggle) {
    consentToggle.addEventListener('change', handleToggleChange);
  }

  if (signoutBtn) {
    signoutBtn.addEventListener('click', () => {
      if (sportyApp && typeof sportyApp.signOut === 'function') {
        sportyApp.signOut();
      }
    });
  }

  function handleSnapshot(snapshot) {
    const signedIn = Boolean(snapshot && snapshot.user);
    if (signedOutBlock) signedOutBlock.hidden = signedIn;
    if (signedInBlock) signedInBlock.hidden = !signedIn;
    if (consentToggle) consentToggle.disabled = !signedIn;

    if (!signedIn) {
      if (creditsController) {
        creditsController.abort();
        creditsController = null;
      }
      setCredits('-', '-');
      updateRunButtons(0, 0);
      clearLocker();
      clearHistory();
      clearFamily();
      clearInviteInbox();

      if (emailEl) emailEl.textContent = '';
      if (consentStatusEl) consentStatusEl.textContent = '';
      if (consentToggle) consentToggle.checked = false;
      if (toggleHelp) toggleHelp.textContent = '';
      return;
    }

    // Account updates
    if (emailEl) {
      emailEl.textContent = snapshot.user.email || '';
    }
    updateConsentStatus(snapshot.hasConsent);
    // Only update toggle if the state actually changed to prevent flicker
    if (consentToggle && consentToggle.checked !== Boolean(snapshot.hasConsent)) {
      consentToggle.checked = Boolean(snapshot.hasConsent);
    }
    updateToggleHelp(snapshot.hasConsent);

    setCredits('...', '...');
    updateRunButtons(null, null); // loading state
    const creditSnapshot = readCreditSnapshot();
    if (creditSnapshot) {
      setCredits(String(creditSnapshot.adult), String(creditSnapshot.child));
      updateRunButtons(creditSnapshot.adult, creditSnapshot.child);
    }
    loadCredits(snapshot.user.id);
    loadHistory(snapshot.user.id);
    loadInviteInbox(snapshot.user);
    loadFamily(snapshot.user.id);
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
        return;
      }

      const [{ data: children, error: childError }, { data: allGuardianships, error: allGuardError }, { data: invites, error: inviteError }] =
        await Promise.all([
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

      const childrenSorted = (children || []).slice().sort((a, b) => {
        const da = new Date(a.created_at || 0).getTime();
        const db = new Date(b.created_at || 0).getTime();
        return db - da;
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
        li.appendChild(titleRow);

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

        const myGuardianship = (guardiansByChild.get(child.id) || []).find(
          (g) => g.guardian_user_id === userId
        );
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
            const who =
              gid === userId
                ? 'You'
                : emailByGuardian.get(gid) || 'Guardian';

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

      setFamilyState({ loading: false, empty: childrenSorted.length === 0 });
    } catch (error) {
      console.error('[Sporty] Failed to load family data', error);
      setFamilyState({ loading: false, empty: true });
    }
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
      consentStatusEl.className = 'text-sm text-teal-700 bg-teal-50 px-3 py-2 rounded-md border border-teal-100';
      consentStatusEl.textContent = 'You have granted Sporty data-retention consent.';
    } else {
      consentStatusEl.className = 'text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-md border border-amber-100';
      consentStatusEl.textContent = 'You have not granted data-retention consent.';
    }
  }

  async function handleToggleChange(event) {
    const target = event.currentTarget;
    if (!target) return;

    if (target.checked) {
      // Grant consent directly without modal
      if (!sportyApp.getClient() || !sportyApp.getUser()) {
        target.checked = false;
        return;
      }

      target.disabled = true;
      try {
        const client = sportyApp.getClient();
        const user = sportyApp.getUser();

        // Check if consent already exists
        const { data: existing } = await client
          .from('consents')
          .select('id')
          .eq('user_id', user.id)
          .eq('consent_type', 'data_retention')
          .is('revoked_at', null)
          .maybeSingle();

        if (!existing) {
          // Record consent using app API to ensure pending flags are cleared
          if (typeof sportyApp.recordConsent === 'function') {
            await sportyApp.recordConsent(user.id);
          } else {
            // Fallback for older app.js versions (shouldn't happen if reloaded)
            const payload = {
              user_id: user.id,
              consent_type: 'data_retention',
              version: 'adult-data-retention-v1',
            };
            const { error } = await client.from('consents').insert(payload);
            if (error) throw error;
          }
        }

        // Refresh consent state
        await sportyApp.refreshConsent();

        updateToggleHelp(true);
        updateConsentStatus(true);
      } catch (error) {
        console.error('[Dashboard] Failed to grant consent', error);
        target.checked = false;
        if (toggleHelp) {
          toggleHelp.textContent = 'Unable to grant consent. Please try again.';
        }
      } finally {
        target.disabled = false;
      }
    } else {
      if (typeof sportyApp.revokeConsent !== 'function') return;
      target.disabled = true;
      try {
        await sportyApp.revokeConsent();
        updateToggleHelp(false);
        updateConsentStatus(false);
      } catch (error) {
        console.error(error);
        target.checked = true; // Revert toggle if revoke fails
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
    if (!sportyApp.getClient()) return;
    const controller = new AbortController();
    creditsController = controller;
    try {
      const client = sportyApp.getClient();
      const { data, error } = await client
        .rpc('get_credit_totals')
        .eq('user_id', userId)
        .single();
      if (controller.signal.aborted) return;
      if (error) throw error;
      const adult = normalizeCreditCount(data?.adult);
      const child = normalizeCreditCount(data?.child);
      setCredits(String(adult), String(child));
      updateRunButtons(adult, child);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('[Dashboard] Failed to load credits', error);
      setCredits('0', '0');
      updateRunButtons(0, 0);
    }
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
      updateRunButtons(adult, child);
      creditsController = null;
    } catch (error) {
      if (creditsController && creditsController.signal.aborted) {
        creditsController = null;
        return;
      }
      console.error('[Sporty] Failed to load credits', error);
      setCredits('--', '--');
      updateRunButtons(0, 0);
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

  function clearHistory() {
    if (historyGrid) historyGrid.innerHTML = '';
  }

  async function loadHistory(userId) {
    if (!historyGrid) return;

    // Clear placeholders
    historyGrid.innerHTML = '<p class="col-span-full text-center py-8 text-slate-500">Loading history...</p>';

    const client = sportyApp?.getClient ? sportyApp.getClient() : null;
    if (!client) return;

    try {
      // Fetch adult results
      const { data: adultData, error: adultError } = await client
        .from('recommendation_results')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (adultError) throw adultError;

      // TODO: Fetch child results if table exists (e.g. child_forecast_runs)
      // For now, we'll just show adult results

      const items = (adultData || []).map(item => ({
        id: item.id,
        title: item.is_premium ? 'Adult Premium Analysis' : 'Adult Free Analysis',
        date: item.created_at,
        summary: item.summary || 'Analysis completed.',
        isPremium: item.is_premium,
        link: item.is_premium ? `/results/premium?id=${item.id}` : `/results?id=${item.id}` // Assuming ID-based routing works or will work
      }));

      renderHistory(items);

    } catch (error) {
      console.error('[Sporty] Failed to load history', error);
      historyGrid.innerHTML = '<p class="col-span-full text-center py-8 text-red-500">Unable to load history.</p>';
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
        </div>
      `;
      historyGrid.appendChild(article);
    });
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
