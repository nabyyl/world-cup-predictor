/* ============================================================
   app.js — World Cup 2026 Prediction League
   - Liquid glass UI with dark/light theme
   - Sub-tabs inside Predictions (Summary / stages / Full Time)
   - User chip with avatar
   - Click a Next-Up card to jump to that match
   - Auto-locks matches at kickoff (UI + Supabase RLS)
   - Uses FIFA portal schedule JSON file
   - Supports match_no, home_source, away_source
   - Auto-fills knockout winners/losers into next matches
   - Super Admin controls match/result management
   - Admin can review matches, latest predictions, points and history
   - Supabase connection is prefilled so users do not see setup screen
   ============================================================ */

let supabaseClient;
let currentUser = null;
let currentProfile = null;
let matchesCache = [];
let predictionsCache = [];

let currentTopView = 'predictions';
let currentStage = 'summary';
let lockTickerId = null;
let scheduleRefreshId = null;
let leaderboardRefreshId = null;

const OPENFOOTBALL_2026_URL = './fifa-2026-portal-schedule.json';

const DEFAULT_SUPABASE_URL = 'https://lpbsxggijjjanvnodgsn.supabase.co';

const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_RUaY8xsNZDZTjTUyq4SKWg_HbiLGxon';

const $ = (id) => document.getElementById(id);

const views = {
  predictions: $('predictionsView'),
  myPredictions: $('myPredictionsView'),
  leaderboard: $('leaderboardView'),
  rules: $('rulesView'),
  admin: $('adminView'),
  superAdmin: $('superAdminView')
};

/* ============================================================
   Safe UI helpers
   ============================================================ */

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value ?? '';
}

function setMessage(message, type = 'error') {
  const el = $('authMessage');

  if (!el) {
    toast(message);
    return;
  }

  el.style.color = type === 'success' ? '#86efac' : '#fb7185';
  el.textContent = message || '';
}

function showElement(id) {
  const el = $(id);
  if (el) el.classList.remove('hidden');
}

function hideElement(id) {
  const el = $(id);
  if (el) el.classList.add('hidden');
}

/* ============================================================
   Theme handling
   ============================================================ */

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('wc_theme', theme);

  const btn = $('themeToggleBtn');
  if (btn) {
    btn.textContent = theme === 'light' ? '☀️' : '🌙';
  }
}

function initTheme() {
  const saved = localStorage.getItem('wc_theme');
  const preferred =
    saved ||
    (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

  applyTheme(preferred);
}

/* ============================================================
   Toast
   ============================================================ */

function toast(message) {
  const el = $('toast');

  if (!el) {
    console.log(message);
    return;
  }

  el.textContent = message;
  el.classList.remove('hidden');

  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.classList.add('hidden');
  }, 3200);
}

/* ============================================================
   Role helpers
   ============================================================ */

function isSuperAdmin() {
  return currentProfile?.role === 'super_admin';
}

function hasAdminAccess() {
  return currentProfile?.role === 'admin' || currentProfile?.role === 'super_admin';
}

function isAdmin() {
  return isSuperAdmin();
}

/* ============================================================
   Supabase init + auth
   ============================================================ */

function initSupabase() {
  const savedUrl = localStorage.getItem('wc_supabase_url');
  const savedKey = localStorage.getItem('wc_supabase_anon_key');

  const url = savedUrl && savedUrl.trim() ? savedUrl.trim() : DEFAULT_SUPABASE_URL;
  const key = savedKey && savedKey.trim() ? savedKey.trim() : DEFAULT_SUPABASE_ANON_KEY;

  if (!url || !key) {
    showElement('setupPanel');
    hideElement('authPanel');
    hideElement('portalPanel');
    return false;
  }

  supabaseClient = supabase.createClient(url, key);

  localStorage.setItem('wc_supabase_url', url);
  localStorage.setItem('wc_supabase_anon_key', key);

  hideElement('setupPanel');
  showElement('authPanel');
  hideElement('portalPanel');

  return true;
}

async function loadSession() {
  if (!supabaseClient) return;

  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    setMessage(error.message, 'error');
    return;
  }

  if (data.session?.user) {
    currentUser = data.session.user;
    await enterPortal();
  }
}

async function fetchProfile() {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .single();

  if (error) throw error;

  currentProfile = data;
}

async function enterPortal() {
  try {
    await fetchProfile();

    if (!currentProfile || currentProfile.status !== 'active') {
      setMessage(
        'Your account is pending or inactive. Ask the admin to add/activate your email.',
        'error'
      );

      await supabaseClient.auth.signOut();
      return;
    }

    hideElement('setupPanel');
    hideElement('authPanel');
    showElement('portalPanel');

    const displayName = currentProfile.full_name || currentProfile.email || 'User';

    const displayRole =
      currentProfile.role === 'super_admin'
        ? 'Super Admin'
        : currentProfile.role === 'admin'
          ? 'Admin'
          : 'User';

    setText('userName', displayName);
    setText('userRole', displayRole);

    const adminTab = $('adminTab');
    if (adminTab) {
      adminTab.classList.toggle('hidden', !hasAdminAccess());
    }

    const superAdminTab = $('superAdminTab');
    if (superAdminTab) {
      superAdminTab.classList.toggle('hidden', !isSuperAdmin());
    }

    await refreshAll();

    showView('predictions');

    startLiveTickers();
  } catch (error) {
    setMessage(error.message, 'error');
    await supabaseClient.auth.signOut();
  }
}

/* ============================================================
   Live tickers + smart auto-sync
   Leaderboard refresh reduced to every 5 minutes.
   Admin and Super Admin pages are NOT auto-rebuilt every 30 sec.
   ============================================================ */

function startLiveTickers() {
  if (lockTickerId) clearInterval(lockTickerId);
  if (scheduleRefreshId) clearTimeout(scheduleRefreshId);
  if (leaderboardRefreshId) clearInterval(leaderboardRefreshId);

  lockTickerId = setInterval(() => {
    if (
      currentTopView === 'predictions' ||
      currentTopView === 'myPredictions'
    ) {
      rerenderCurrentView();
    }
  }, 30 * 1000);

  leaderboardRefreshId = setInterval(() => {
    if (currentTopView === 'leaderboard') {
      renderLeaderboard();
    }
  }, 5 * 60 * 1000);

  async function smartAutoSyncLoop() {
    try {
      if (isSuperAdmin()) {
        await autoSyncScoresFromInternet(true);
      } else {
        await loadMatches();
        await loadPredictions();

        if (
          currentTopView === 'predictions' ||
          currentTopView === 'myPredictions'
        ) {
          rerenderCurrentView();
        }

        if (currentTopView === 'leaderboard') {
          renderLeaderboard();
        }
      }
    } catch (error) {
      console.warn('Background refresh failed:', error.message);
    }

    const hasActiveMatch = matchesCache.some(match => {
      const kickoff = new Date(match.kickoff_at).getTime();
      const now = Date.now();

      return now >= kickoff - 15 * 60 * 1000 &&
             now <= kickoff + 3 * 60 * 60 * 1000;
    });

    const nextDelay = hasActiveMatch
      ? 2 * 60 * 1000
      : 15 * 60 * 1000;

    scheduleRefreshId = setTimeout(smartAutoSyncLoop, nextDelay);
  }

  smartAutoSyncLoop();
}

/* ============================================================
   Data loaders
   ============================================================ */

async function refreshAll() {
  await Promise.all([
    loadMatches(),
    loadPredictions()
  ]);

  if (
    currentTopView === 'predictions' ||
    currentTopView === 'myPredictions'
  ) {
    rerenderCurrentView();
  }

  if (currentTopView === 'leaderboard') {
    await renderLeaderboard();
  }

  if (currentTopView === 'admin') {
    renderAdmin();
  }

  if (currentTopView === 'superAdmin') {
    renderSuperAdmin();
  }
}

async function loadMatches() {
  const { data, error } = await supabaseClient
    .from('matches')
    .select('*')
    .order('kickoff_at', { ascending: true });

  if (error) throw error;

  matchesCache = data || [];
}

async function loadPredictions() {
  const { data, error } = await supabaseClient
    .from('predictions')
    .select('*')
    .eq('user_id', currentUser.id);

  if (error) throw error;

  predictionsCache = data || [];
}

function predictionFor(matchId) {
  return predictionsCache.find(p => p.match_id === matchId);
}

/* ============================================================
   Lock logic
   ============================================================ */

function matchLocked(match) {
  if (match.admin_override_open) return false;

  return match.is_locked || new Date(match.kickoff_at) <= new Date();
}

function lockReason(match) {
  if (match.admin_override_open) return 'Admin reopened';
  if (match.is_locked) return 'Manually locked';
  if (new Date(match.kickoff_at) <= new Date()) return 'Match started — locked';

  return 'Open for predictions';
}

/* ============================================================
   Render — Predictions root
   ============================================================ */

function renderPredictionsRoot() {
  const stageFilter = $('stageFilter');
  const content = $('predictionsContent');

  if (!stageFilter || !content) return;

  const counts = computeStageCounts(matchesCache);
  stageFilter.innerHTML = renderStageFilter(currentStage, counts);

  stageFilter.querySelectorAll('button[data-stage]').forEach(button => {
    button.addEventListener('click', () => {
      currentStage = button.dataset.stage;
      renderPredictionsRoot();
    });
  });

  if (currentStage === 'summary') {
    content.innerHTML = renderSummary(
      matchesCache,
      predictionsCache,
      currentProfile?.full_name || currentProfile?.email
    );
    return;
  }

  if (currentStage === 'results') {
    content.innerHTML = renderResultsMatches(matchesCache, predictionsCache);
    return;
  }

  content.innerHTML = renderMatchCards(
    matchesCache,
    predictionsCache,
    {
      predictionFor,
      matchLocked,
      lockReason
    },
    currentStage
  );
}

function renderMyPredictionsView() {
  if (!views.myPredictions) return;

  views.myPredictions.innerHTML = renderMyPredictions(
    matchesCache,
    predictionsCache
  );
}

function rerenderCurrentView() {
  try {
    if (currentTopView === 'predictions') {
      renderPredictionsRoot();
    }

    if (currentTopView === 'myPredictions') {
      renderMyPredictionsView();
    }

    // Leaderboard is intentionally not refreshed here every 30 seconds.
    // It refreshes separately every 5 minutes and during smart auto-sync.
  } catch (error) {
    console.warn('View render failed:', error.message);
    toast('There was an error loading this page. Please refresh once.');
  }
}

/* ============================================================
   Navigate to a specific match from Summary "Next up"
   ============================================================ */

function navigateToMatch(matchId) {
  const match = matchesCache.find(m => m.id === matchId);

  if (!match) return;

  currentStage = matchHasResult(match) ? 'results' : classifyStage(match.stage);
  showView('predictions');
  renderPredictionsRoot();

  requestAnimationFrame(() => {
    const el = document.getElementById(`match_${matchId}`);

    if (!el) return;

    el.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });

    el.classList.add('highlight-flash');

    setTimeout(() => {
      el.classList.remove('highlight-flash');
    }, 1900);
  });
}

window.navigateToMatch = navigateToMatch;

/* ============================================================
   Save prediction
   ============================================================ */

async function savePrediction(matchId) {
  const match = matchesCache.find(m => m.id === matchId);

  if (match && matchLocked(match)) {
    toast('This match has already started — predictions are locked.');
    return;
  }

  const homeInput = $(`home_${matchId}`);
  const awayInput = $(`away_${matchId}`);

  if (!homeInput || !awayInput) {
    toast('Prediction input not found.');
    return;
  }

  const home = Number(homeInput.value);
  const away = Number(awayInput.value);

  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) {
    toast('Enter valid scores first.');
    return;
  }

  const payload = {
    user_id: currentUser.id,
    match_id: matchId,
    home_score: home,
    away_score: away,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabaseClient
    .from('predictions')
    .upsert(payload, {
      onConflict: 'user_id,match_id'
    });

  if (error) {
    toast(error.message);
    return;
  }

  toast('Prediction saved. Latest saved score will count.');

  await loadPredictions();
  rerenderCurrentView();
}

window.savePrediction = savePrediction;

/* ============================================================
   Leaderboard
   ============================================================ */

async function renderLeaderboard() {
  if (!views.leaderboard) return;

  const { data, error } = await supabaseClient
    .from('leaderboard')
    .select('*')
    .order('total_points', { ascending: false })
    .order('exact_scores', { ascending: false })
    .order('full_name', { ascending: true });

  if (error) {
    views.leaderboard.innerHTML = renderLeaderboardError(error.message);
    return;
  }

  views.leaderboard.innerHTML = renderLeaderboardTable(data || []);
}

/* ============================================================
   Admin review page — limited Admin + Super Admin
   ============================================================ */

function renderAdmin() {
  if (!views.admin) return;

  if (!hasAdminAccess()) {
    views.admin.innerHTML = `
      <div class="card admin-card">
        <h2>Admin access required</h2>
        <p class="muted small">Your profile does not have admin review access.</p>
      </div>
    `;
    return;
  }

  try {
    views.admin.innerHTML = renderAdminReviewPage(matchesCache || []);
  } catch (error) {
    console.error('Admin page error:', error);

    views.admin.innerHTML = `
      <div class="card admin-card">
        <h2>Admin page could not load</h2>
        <p class="message">${escapeHtml(error.message)}</p>
        <p class="muted small">
          This is usually caused by an old ui.js file or missing admin review function.
        </p>
      </div>
    `;
  }
}

async function openAdminMatchReview(matchId) {
  if (!hasAdminAccess()) {
    toast('Admin access required.');
    return;
  }

  const match = matchesCache.find(m => m.id === matchId);

  const { data, error } = await supabaseClient
    .from('match_prediction_review')
    .select('*')
    .eq('match_id', matchId)
    .order('match_points', { ascending: false })
    .order('full_name', { ascending: true });

  if (error) {
    toast(error.message);
    return;
  }

  views.admin.innerHTML = renderAdminMatchReview(match, data || []);
}

window.openAdminMatchReview = openAdminMatchReview;

async function openUserPredictionHistory(userId, matchId) {
  if (!hasAdminAccess()) {
    toast('Admin access required.');
    return;
  }

  const { data, error } = await supabaseClient
    .from('match_prediction_history')
    .select('*')
    .eq('user_id', userId)
    .eq('match_id', matchId)
    .order('created_at', { ascending: false });

  if (error) {
    toast(error.message);
    return;
  }

  const match = matchesCache.find(m => m.id === matchId);

  views.admin.innerHTML = renderUserPredictionHistory(match, data || []);
}

window.openUserPredictionHistory = openUserPredictionHistory;

function backToAdminMatches() {
  renderAdmin();
}

window.backToAdminMatches = backToAdminMatches;

/* ============================================================
   Super Admin page — full system controls
   ============================================================ */

function renderSuperAdmin() {
  if (!views.superAdmin) return;

  if (!isSuperAdmin()) {
    views.superAdmin.innerHTML = `
      <div class="card admin-card">
        <h2>Super Admin access required</h2>
        <p class="muted small">Your profile is not assigned as super admin.</p>
      </div>
    `;
    return;
  }

  try {
    views.superAdmin.innerHTML = renderSuperAdminPanel(
      matchesCache || [],
      OPENFOOTBALL_2026_URL
    );

    fillAdminMatchForm();
  } catch (error) {
    console.error('Super Admin page error:', error);

    views.superAdmin.innerHTML = `
      <div class="card admin-card">
        <h2>Super Admin page could not load</h2>
        <p class="message">${escapeHtml(error.message)}</p>
        <p class="muted small">
          Check that ui.js has the latest Super Admin render function.
        </p>
      </div>
    `;
  }
}

function fillAdminMatchForm() {
  const select = $('adminMatchSelect');

  if (!select || !select.value) return;

  const match = matchesCache.find(m => m.id === select.value);

  if (!match) return;

  if ($('adminActualHome')) {
    $('adminActualHome').value = match.actual_home_score ?? '';
  }

  if ($('adminActualAway')) {
    $('adminActualAway').value = match.actual_away_score ?? '';
  }

  if ($('adminLock')) {
    $('adminLock').checked = !!match.is_locked;
  }

  if ($('adminOverrideOpen')) {
    $('adminOverrideOpen').checked = !!match.admin_override_open;
  }

  if ($('adminResultOverride')) {
    $('adminResultOverride').checked = !!match.admin_result_override;
  }

  if ($('adminResultSource')) {
    const source = match.result_source || 'manual';

    $('adminResultSource').textContent =
      source === 'admin'
        ? 'Result source: Admin manual override'
        : source === 'auto'
          ? `Result source: Auto synced${match.auto_result_synced_at ? ' · ' + new Date(match.auto_result_synced_at).toLocaleString() : ''}`
          : 'Result source: Manual / pending';
  }
}

window.fillAdminMatchForm = fillAdminMatchForm;

async function addMatch() {
  if (!isSuperAdmin()) {
    toast('Super Admin access required.');
    return;
  }

  const kickoffValue = $('adminKickoff')?.value;

  const payload = {
    match_no: $('adminMatchNo')?.value ? Number($('adminMatchNo').value) : null,
    home_team: $('adminHome')?.value.trim(),
    away_team: $('adminAway')?.value.trim(),
    stage: $('adminStage')?.value.trim(),
    venue: $('adminVenue')?.value.trim(),
    kickoff_at: kickoffValue ? new Date(kickoffValue).toISOString() : null,
    home_source: null,
    away_source: null,
    is_locked: false,
    admin_override_open: false,
    source: 'manual',
    result_source: 'manual',
    admin_result_override: false
  };

  if (!payload.home_team || !payload.away_team || !payload.kickoff_at) {
    toast('Team names and kickoff are required.');
    return;
  }

  const { error } = await supabaseClient
    .from('matches')
    .insert(payload);

  if (error) {
    toast(error.message);
    return;
  }

  toast('Match added.');
  await refreshAll();

  if (currentTopView === 'superAdmin') {
    renderSuperAdmin();
  }
}

window.addMatch = addMatch;

async function updateResult() {
  if (!isSuperAdmin()) {
    toast('Super Admin access required.');
    return;
  }

  const matchId = $('adminMatchSelect')?.value;

  if (!matchId) {
    toast('Select a match first.');
    return;
  }

  const homeRaw = $('adminActualHome')?.value ?? '';
  const awayRaw = $('adminActualAway')?.value ?? '';

  const hasResult = homeRaw !== '' && awayRaw !== '';

  const payload = {
    is_locked: !!$('adminLock')?.checked,
    admin_override_open: !!$('adminOverrideOpen')?.checked,
    actual_home_score: homeRaw === '' ? null : Number(homeRaw),
    actual_away_score: awayRaw === '' ? null : Number(awayRaw),
    result_source: hasResult ? 'admin' : 'manual',
    admin_result_override: hasResult ? true : !!$('adminResultOverride')?.checked
  };

  if (hasResult) {
    payload.is_locked = true;
    payload.admin_result_override = true;
  }

  const { error } = await supabaseClient
    .from('matches')
    .update(payload)
    .eq('id', matchId);

  if (error) {
    toast(error.message);
    return;
  }

  const completedMatch = matchesCache.find(match => match.id === matchId);

  if (completedMatch) {
    const updatedMatch = {
      ...completedMatch,
      ...payload
    };

    await updateDependentKnockoutMatches(updatedMatch);
  }

  toast(
    hasResult
      ? 'Match updated. Super Admin score is protected from auto-sync.'
      : 'Match updated.'
  );

  await refreshAll();

  if (currentTopView === 'superAdmin') {
    renderSuperAdmin();
  }
}

window.updateResult = updateResult;

async function updateDependentKnockoutMatches(completedMatch) {
  if (!completedMatch || !matchHasResult(completedMatch)) return;

  if (!completedMatch.match_no) {
    console.warn('Completed match has no match_no, cannot update knockout dependencies.');
    return;
  }

  const homeScore = Number(completedMatch.actual_home_score);
  const awayScore = Number(completedMatch.actual_away_score);

  if (homeScore === awayScore) {
    toast('Match is drawn. Please update the knockout winner manually if penalties were used.');
    return;
  }

  const winner =
    homeScore > awayScore
      ? completedMatch.home_team
      : completedMatch.away_team;

  const loser =
    homeScore > awayScore
      ? completedMatch.away_team
      : completedMatch.home_team;

  const matchNo = Number(completedMatch.match_no);

  const { data: allMatches, error } = await supabaseClient
    .from('matches')
    .select('*');

  if (error) {
    toast(error.message);
    return;
  }

  const dependentMatches = (allMatches || []).filter(match => {
    const homeSourceMatchNo = match.home_source?.match_no;
    const awaySourceMatchNo = match.away_source?.match_no;

    return Number(homeSourceMatchNo) === matchNo ||
           Number(awaySourceMatchNo) === matchNo;
  });

  for (const match of dependentMatches) {
    const payload = {};

    if (match.home_source && Number(match.home_source.match_no) === matchNo) {
      payload.home_team =
        match.home_source.type === 'winner'
          ? winner
          : loser;
    }

    if (match.away_source && Number(match.away_source.match_no) === matchNo) {
      payload.away_team =
        match.away_source.type === 'winner'
          ? winner
          : loser;
    }

    if (Object.keys(payload).length > 0) {
      const { error: updateError } = await supabaseClient
        .from('matches')
        .update(payload)
        .eq('id', match.id);

      if (updateError) {
        toast(updateError.message);
        return;
      }
    }
  }
}

window.updateDependentKnockoutMatches = updateDependentKnockoutMatches;

async function deleteSelectedMatch() {
  if (!isSuperAdmin()) {
    toast('Super Admin access required.');
    return;
  }

  const matchId = $('adminMatchSelect')?.value;

  if (!matchId) return;

  if (!confirm('Delete this match? Related predictions will also be deleted.')) {
    return;
  }

  const { error } = await supabaseClient
    .from('matches')
    .delete()
    .eq('id', matchId);

  if (error) {
    toast(error.message);
    return;
  }

  toast('Match deleted.');
  await refreshAll();

  if (currentTopView === 'superAdmin') {
    renderSuperAdmin();
  }
}

window.deleteSelectedMatch = deleteSelectedMatch;

/* ============================================================
   Super Admin replace old matches with local FIFA JSON
   ============================================================ */

async function replaceMatchesWithScheduleIfNoPredictions() {
  if (!isSuperAdmin()) {
    toast('Super Admin access required.');
    return;
  }

  const confirmed = confirm(
    'This will replace all existing matches with the FIFA 2026 portal schedule only if no predictions exist. Continue?'
  );

  if (!confirmed) return;

  try {
    toast('Loading local FIFA schedule...');

    const url = $('scheduleUrl')?.value.trim() || OPENFOOTBALL_2026_URL;

    const response = await fetch(url, {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Could not fetch schedule: ${response.status}`);
    }

    const scheduleJson = await response.json();

    toast('Checking predictions and replacing schedule...');

    const { data, error } = await supabaseClient
      .rpc('super_admin_replace_matches_from_json', {
        schedule_data: scheduleJson
      });

    if (error) throw error;

    toast(`Schedule replaced successfully. ${data || 0} matches loaded.`);

    await loadMatches();
    await loadPredictions();

    if (currentTopView === 'superAdmin') {
      renderSuperAdmin();
    } else {
      rerenderCurrentView();
    }
  } catch (error) {
    toast(error.message);
  }
}

window.replaceMatchesWithScheduleIfNoPredictions = replaceMatchesWithScheduleIfNoPredictions;

async function resetMatchesIfNoPredictions() {
  await replaceMatchesWithScheduleIfNoPredictions();
}

window.resetMatchesIfNoPredictions = resetMatchesIfNoPredictions;

/* ============================================================
   Schedule + score sync from FIFA portal JSON — Super Admin only
   ============================================================ */

async function syncScheduleFromInternet() {
  if (!isSuperAdmin()) {
    toast('Super Admin access required.');
    return;
  }

  await autoSyncScoresFromInternet(false);
}

window.syncScheduleFromInternet = syncScheduleFromInternet;

async function autoSyncScoresFromInternet(silent = true) {
  if (!isSuperAdmin()) {
    if (!silent) toast('Super Admin access required.');
    return;
  }

  const url = $('scheduleUrl')?.value.trim() || OPENFOOTBALL_2026_URL;

  try {
    if (!silent) {
      toast('Syncing schedule and available scores...');
    }

    const response = await fetch(url, {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Could not fetch schedule: ${response.status}`);
    }

    const json = await response.json();
    const incomingRows = normalizeOpenFootballSchedule(json, url);

    if (!incomingRows.length) {
      throw new Error('No matches found in the schedule file.');
    }

    const { data: existingMatches, error: existingError } = await supabaseClient
      .from('matches')
      .select('*');

    if (existingError) throw existingError;

    const existingByExternalId = new Map(
      (existingMatches || [])
        .filter(match => match.external_id)
        .map(match => [match.external_id, match])
    );

    const now = new Date().toISOString();

    const rowsToUpsert = incomingRows.map(row => {
      const existing = existingByExternalId.get(row.external_id);

      const incomingHasResult =
        row.actual_home_score !== null &&
        row.actual_away_score !== null &&
        row.actual_home_score !== undefined &&
        row.actual_away_score !== undefined;

      if (!existing) {
        return {
          ...row,
          result_source: incomingHasResult ? 'auto' : 'manual',
          admin_result_override: false,
          auto_result_synced_at: incomingHasResult ? now : null
        };
      }

      if (existing.admin_result_override) {
        return {
          ...row,
          actual_home_score: existing.actual_home_score,
          actual_away_score: existing.actual_away_score,
          result_source: existing.result_source || 'admin',
          admin_result_override: true,
          auto_result_synced_at: existing.auto_result_synced_at
        };
      }

      if (incomingHasResult) {
        return {
          ...row,
          result_source: 'auto',
          admin_result_override: false,
          auto_result_synced_at: now
        };
      }

      return {
        ...row,
        actual_home_score: existing.actual_home_score,
        actual_away_score: existing.actual_away_score,
        result_source: existing.result_source || 'manual',
        admin_result_override: existing.admin_result_override || false,
        auto_result_synced_at: existing.auto_result_synced_at
      };
    });

    const { error } = await supabaseClient
      .from('matches')
      .upsert(rowsToUpsert, {
        onConflict: 'external_id'
      });

    if (error) throw error;

    await loadMatches();
    await loadPredictions();

    if (
      currentTopView === 'predictions' ||
      currentTopView === 'myPredictions'
    ) {
      rerenderCurrentView();
    }

    if (!silent && currentTopView === 'leaderboard') {
      renderLeaderboard();
    }

    if (!silent && currentTopView === 'admin' && hasAdminAccess()) {
      renderAdmin();
    }

    if (!silent && currentTopView === 'superAdmin' && isSuperAdmin()) {
      renderSuperAdmin();
    }

    if (!silent) {
      toast(`Synced ${rowsToUpsert.length} matches and available scores.`);
    }
  } catch (error) {
    if (!silent) {
      toast(error.message);
    } else {
      console.warn('Auto score sync failed:', error.message);
    }
  }
}

window.autoSyncScoresFromInternet = autoSyncScoresFromInternet;

function normalizeOpenFootballSchedule(json, sourceUrl) {
  if (Array.isArray(json.matches)) {
    return json.matches
      .map((match, index) => {
        const kickoffDate = new Date(match.kickoff_at);

        if (!match.kickoff_at || Number.isNaN(kickoffDate.getTime())) {
          console.warn('Skipping match with invalid kickoff_at:', match);
          return null;
        }

        const hasResult =
          match.actual_home_score !== null &&
          match.actual_away_score !== null &&
          match.actual_home_score !== undefined &&
          match.actual_away_score !== undefined;

        return {
          external_id: match.external_id || `fifa-2026-m${String(match.match_no || index + 1).padStart(3, '0')}`,
          match_no: match.match_no || index + 1,
          source: match.source || 'fifa_manual_portal',
          source_url: match.source_url || json.source_url || sourceUrl,
          home_team: match.home_team || 'TBD',
          away_team: match.away_team || 'TBD',
          stage: match.stage || 'World Cup',
          venue: match.venue || null,
          kickoff_at: kickoffDate.toISOString(),
          home_source: match.home_source || null,
          away_source: match.away_source || null,
          actual_home_score: hasResult ? Number(match.actual_home_score) : null,
          actual_away_score: hasResult ? Number(match.actual_away_score) : null,
          last_synced_at: new Date().toISOString()
        };
      })
      .filter(Boolean);
  }

  return [];
}

function parseOpenFootballDateTime(dateValue, timeValue) {
  if (!dateValue) return null;

  const time = String(timeValue || '00:00').trim();
  const match = time.match(/^(\d{1,2}):(\d{2})(?:\s*UTC([+-]\d{1,2}))?$/i);

  if (!match) {
    return new Date(`${dateValue}T00:00:00Z`).toISOString();
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const offset = match[3] !== undefined ? Number(match[3]) : 0;
  const dateParts = dateValue.split('-').map(Number);

  const utcMs = Date.UTC(
    dateParts[0],
    dateParts[1] - 1,
    dateParts[2],
    hour - offset,
    minute,
    0
  );

  return new Date(utcMs).toISOString();
}

/* ============================================================
   CSV export
   ============================================================ */

async function downloadPredictionsCsv() {
  const { data, error } = await supabaseClient
    .from('predictions_export')
    .select('*')
    .order('kickoff_at', {
      ascending: true
    });

  let rows;

  if (!error && data) {
    rows = data.map(row => [
      row.full_name,
      row.email,
      row.match_no ?? '',
      row.home_team,
      row.away_team,
      row.stage,
      row.kickoff_at,
      row.home_score,
      row.away_score,
      row.updated_at
    ]);
  } else {
    rows = predictionsCache.map(prediction => {
      const match = matchesCache.find(item => item.id === prediction.match_id) || {};

      return [
        currentProfile.full_name,
        currentProfile.email,
        match.match_no ?? '',
        match.home_team,
        match.away_team,
        match.stage,
        match.kickoff_at,
        prediction.home_score,
        prediction.away_score,
        prediction.updated_at
      ];
    });
  }

  const csv = [
    [
      'Name',
      'Email',
      'Match No',
      'Home',
      'Away',
      'Stage',
      'Kickoff',
      'Pred Home',
      'Pred Away',
      'Updated'
    ],
    ...rows
  ]
    .map(row => row.map(csvEscape).join(','))
    .join('\n');

  const blob = new Blob([csv], {
    type: 'text/csv'
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = 'world-cup-predictions.csv';
  a.click();

  URL.revokeObjectURL(url);
}

window.downloadPredictionsCsv = downloadPredictionsCsv;

function csvEscape(value) {
  const str = String(value ?? '');

  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/* ============================================================
   Top-level view switching
   ============================================================ */

function showView(name) {
  currentTopView = name;

  Object.entries(views).forEach(([key, el]) => {
    if (el) {
      el.classList.toggle('hidden', key !== name);
    }
  });

  document.querySelectorAll('.nav-tabs button').forEach(button => {
    button.classList.toggle('active', button.dataset.view === name);
  });

  if (name === 'predictions') {
    renderPredictionsRoot();
  }

  if (name === 'myPredictions') {
    renderMyPredictionsView();
  }

  if (name === 'leaderboard') {
    renderLeaderboard();
  }

  if (name === 'admin') {
    renderAdmin();
  }

  if (name === 'superAdmin') {
    renderSuperAdmin();
  }
}

/* ============================================================
   Event wiring
   ============================================================ */

$('saveConfigBtn')?.addEventListener('click', () => {
  const url = $('supabaseUrl')?.value.trim();
  const key = $('supabaseAnonKey')?.value.trim();

  if (!url || !key) {
    toast('Enter Supabase URL and anon key.');
    return;
  }

  localStorage.setItem('wc_supabase_url', url);
  localStorage.setItem('wc_supabase_anon_key', key);

  initSupabase();
  loadSession();
});

let authMode = 'login';

$('loginTab')?.addEventListener('click', () => {
  authMode = 'login';

  $('loginTab')?.classList.add('active');
  $('signupTab')?.classList.remove('active');

  setText('authSubmitBtn', 'Login');

  $('nameLabel')?.classList.add('hidden');
  $('fullName')?.classList.add('hidden');
});

$('signupTab')?.addEventListener('click', () => {
  authMode = 'signup';

  $('signupTab')?.classList.add('active');
  $('loginTab')?.classList.remove('active');

  setText('authSubmitBtn', 'Create Account');

  $('nameLabel')?.classList.remove('hidden');
  $('fullName')?.classList.remove('hidden');
});

$('authForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();

  setMessage('', 'error');

  const email = $('email')?.value.trim().toLowerCase();
  const password = $('password')?.value;

  if (!email || !password) {
    setMessage('Enter email and password.', 'error');
    return;
  }

  try {
    if (authMode === 'login') {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      currentUser = data.user;
      await enterPortal();
    } else {
      const fullName = $('fullName')?.value.trim() || '';

      const { error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      });

      if (error) throw error;

      setMessage(
        'Account created. You can now login with the same email and password.',
        'success'
      );
    }
  } catch (error) {
    setMessage(error.message, 'error');
  }
});

$('logoutBtn')?.addEventListener('click', async () => {
  await supabaseClient.auth.signOut();

  currentUser = null;
  currentProfile = null;

  if (lockTickerId) clearInterval(lockTickerId);
  if (scheduleRefreshId) clearTimeout(scheduleRefreshId);
  if (leaderboardRefreshId) clearInterval(leaderboardRefreshId);

  hideElement('portalPanel');
  showElement('authPanel');
});

$('themeToggleBtn')?.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

document.querySelectorAll('.nav-tabs button').forEach(button => {
  button.addEventListener('click', () => {
    showView(button.dataset.view);
  });
});

/* ============================================================
   Boot
   ============================================================ */

initTheme();

if (initSupabase()) {
  loadSession();
}
