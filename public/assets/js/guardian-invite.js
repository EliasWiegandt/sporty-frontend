(function () {
  const root = document.querySelector('[data-guardian-invite-root]');
  if (!root) return;

  const statusEl = root.querySelector('[data-guardian-invite-status]');
  const form = root.querySelector('[data-guardian-invite-form]');

  function setStatus(message, tone) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className =
      tone === 'error' ? 'text-sm text-red-600' : 'text-sm text-slate-600';
  }

  function requireToken() {
    const params = new URLSearchParams(window.location.search || '');
    return (params.get('token') || '').trim();
  }

  function requireInviteId() {
    const params = new URLSearchParams(window.location.search || '');
    return (params.get('invite_id') || '').trim();
  }

  async function ensureSignedIn() {
    const sportyApp = window.SportyApp;
    if (!sportyApp) return null;
    const user = sportyApp.getUser ? sportyApp.getUser() : null;
    if (user) return user;
    if (typeof sportyApp.openAuth === 'function') {
      sportyApp.openAuth('signin');
    }
    return null;
  }

  async function acceptInvite(token) {
    const sportyApp = window.SportyApp;
    const client = sportyApp && sportyApp.getClient ? sportyApp.getClient() : null;
    if (!client) throw new Error('Not authenticated');

    const { data, error } = await client.rpc('accept_guardian_invite', { p_token: token });
    if (error) throw error;
    return data;
  }

  async function acceptInviteById(inviteId) {
    const sportyApp = window.SportyApp;
    const client = sportyApp && sportyApp.getClient ? sportyApp.getClient() : null;
    if (!client) throw new Error('Not authenticated');

    const { data, error } = await client.rpc('accept_guardian_invite_by_id', { p_invite_id: inviteId });
    if (error) throw error;
    return data;
  }

  async function updateBiologicalRole(childId, userId, role) {
    // Creator-controlled assignment: biological role is set by the inviter on the invite.
    // This page only accepts the invite and redirects.
    return;
  }

  async function init() {
    const token = requireToken();
    const inviteId = requireInviteId();
    if (!token && !inviteId) {
      setStatus('Missing invite token.', 'error');
      return;
    }

    setStatus('Sign in to accept the invite…');
    let user = await ensureSignedIn();
    if (!user) {
      // Wait briefly for auth to complete (best effort)
      const sportyApp = window.SportyApp;
      if (sportyApp && typeof sportyApp.onAuthChange === 'function') {
        await new Promise((resolve) => {
          const unsub = sportyApp.onAuthChange((snapshot) => {
            if (snapshot && snapshot.user) {
              user = snapshot.user;
              resolve();
            }
          });
          setTimeout(resolve, 15000);
          if (typeof unsub === 'function') {
            // no-op; app.js does not currently return an unsubscribe
          }
        });
      }
    }

    user = window.SportyApp && window.SportyApp.getUser ? window.SportyApp.getUser() : user;
    if (!user) {
      setStatus('Please sign in to continue.', 'error');
      return;
    }

    setStatus('Accepting invite…');
    let childId = null;
    try {
      childId = token ? await acceptInvite(token) : await acceptInviteById(inviteId);
    } catch (error) {
      console.error('[GuardianInvite] Failed to accept invite', error);
      setStatus('Invite link is invalid or expired.', 'error');
      return;
    }

    if (!childId) {
      setStatus('Invite accepted, but no child was returned.', 'error');
      return;
    }

    if (form) form.hidden = true;
    setStatus('Invite accepted. Redirecting…');
    window.location.assign('/dashboard');
  }

  init().catch((error) => {
    console.error('[GuardianInvite] Init failed', error);
    setStatus('Something went wrong. Please try again.', 'error');
  });
})();
