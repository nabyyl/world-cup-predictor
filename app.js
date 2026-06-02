/* ============================================================
   app.js — Office World Cup Prediction League
   - Liquid glass UI with dark/light theme
   - Sub-tabs inside Predictions (Summary / stages / Done)
   - "My Predictions" top-level page with win highlight
   - Auto-locks matches at kickoff (UI + Supabase RLS)
   ============================================================ */

let supabaseClient;
let currentUser = null;
let currentProfile = null;
let matchesCache = [];
let predictionsCache = [];

let currentTopView = 'predictions';
let currentStage = 'summary';   // summary | group | r32 | r16 | qf | sf | final | done
let lockTickerId = null;
let scheduleRefreshId = null;

const OPENFOOTBALL_2026_URL =
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

const $ = (id) => document.getElementById(id);

const views = {
  predictions:   $('predictionsView'),
  myPredictions: $('myPredictionsView'),
  leaderboard:   $('leaderboardView'),
  rules:         $('rulesView'),
  admin:         $('adminView')
};

/* ============================================================
   Theme handling
   ============================================================ */

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('wc_theme', theme);
  const btn = $('themeToggleBtn');
  if (btn) btn.textContent = theme === 'light' ? '☀️' : '🌙';
}

function initTheme() {
  const saved = localStorage.getItem('wc_theme');
  const preferred = saved || (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  applyTheme(preferred);
}

/* ============================================================
   Toast
   ============================================================ */

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), 3200);
}

function isAdmin() { return currentProfile?.role === 'admin'; }

/* ============================================================
   Supabase init + auth
   ============================================================ */

function initSupabase() {
  const url = localStorage.getItem('wc_supabase_url');
  const key = localStorage.getItem('wc_supabase_anon_key');

  if (!url || !key) {
    $('setupPanel').classList.remove('hidden');
    $('authPanel').classList.add('hidden');
    return false;
  }

  supabaseClient = supabase.createClient(url, key);
  $('setupPanel').classList.add('hidden');
  $('authPanel').classList.remove('hidden');
  return true;
}

async function loadSession() {
  if (!supabaseClient) return;
  const { data } = await supabaseClient.auth.getSession();
  if (data.session?.user) {
    currentUser = data.session.user;
    await enterPortal();
  }
}

async function fetchProfile() {
  const { data, error } = await supabaseClient
    .from('profiles').select('*').eq('id', currentUser.id).single();
  if (error) throw error;
  currentProfile = data;
}

async function enterPortal() {
  await fetchProfile();

  if (currentProfile.status !== 'active') {
    $('authMessage').textContent =
      'Your account is pending or inactive. Ask the admin to add/activate your email.';
    await supabaseClient.auth.signOut();
    return;
  }

  $('authPanel').classList.add('hidden');
  $('portalPanel').classList.remove('hidden');

  $('userLine').textContent =
    `${currentProfile.full_name || currentProfile.email} • ${currentProfile.role}`;

  $('adminTab').classList.toggle('hidden', !isAdmin());

  await refreshAll();
  startLiveTickers();
}

/* ============================================================
   Live tickers — auto-lock at kickoff + periodic re-sync
   ============================================================ */

function startLiveTickers() {
  // Re-render current view every 30s so kickoff-locks appear without manual reload.
  if (lockTickerId) clearInterval(lockTickerId);
  lockTickerId = setInterval(() => {
    if (currentTopView === 'predictions') renderPredictionsRoot();
    if (currentTopView === 'myPredictions') renderMyPredictionsView();
  }, 30 * 1000);

  // Every 5 min, re-pull matches + predictions from Supabase so live scores
  // posted by admin (or by the schedule sync) appear automatically.
  if (scheduleRefreshId) clearInterval(scheduleRefreshId);
  scheduleRefreshId = setInterval(async () => {
    try {
      await loadMatches();
      await loadPredictions();
      rerenderCurrentView();
    } catch { /* silent */ }
  }, 5 * 60 * 1000);
}

/* ============================================================
   Data loaders
   ============================================================ */

async function refreshAll() {
  await Promise.all([loadMatches(), loadPredictions()]);
  rerenderCurrentView();
  await renderLeaderboard();
  if (isAdmin()) renderAdmin();
}

async function loadMatches() {
  const { data, error } = await supabaseClient
    .from('matches').select('*').order('kickoff_at', { ascending: true });
  if (error) throw error;
  matchesCache = data || [];
}

async function loadPredictions() {
  const { data, error } = await supabaseClient
    .from('predictions').select('*').eq('user_id', currentUser.id);
  if (error) throw error;
  predictionsCache = data || [];
}

function predictionFor(matchId) {
  return predictionsCache.find(p => p.match_id === matchId);
}

/* ============================================================
   Lock logic — auto detects kickoff
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
   Render — Predictions root (sub-tabs + content)
   ============================================================ */

function renderPredictionsRoot() {
  const counts = computeStageCounts(matchesCache);
  $('stageFilter').innerHTML = renderStageFilter(currentStage, counts);

  // Wire sub-tab clicks
  $('stageFilter').querySelectorAll('button[data-stage]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentStage = btn.dataset.stage;
      renderPredictionsRoot();
    });
  });

  const content = $('predictionsContent');
  if (currentStage === 'summary') {
    content.innerHTML = renderSummary(matchesCache, predictionsCache);
  } else if (currentStage === 'done') {
    content.innerHTML = renderDoneMatches(matchesCache, predictionsCache);
  } else {
    content.innerHTML = renderMatchCards(
      matchesCache, predictionsCache,
      { predictionFor, matchLocked, lockReason },
      currentStage
    );
  }
}

function renderMyPredictionsView() {
  views.myPredictions.innerHTML = renderMyPredictions(matchesCache, predictionsCache);
}

function rerenderCurrentView() {
  if (currentTopView === 'predictions')   renderPredictionsRoot();
  if (currentTopView === 'myPredictions')  renderMyPredictionsView();
}

/* ============================================================
   Save prediction
   ============================================================ */

async function savePrediction(matchId) {
  const match = matchesCache.find(m => m.id === matchId);
  if (match && matchLocked(match)) {
    toast('This match has already started — predictions are locked.');
    return;
  }

  const home = Number($(`home_${matchId}`).value);
  const away = Number($(`away_${matchId}`).value);

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
    .upsert(payload, { onConflict: 'user_id,match_id' });

  if (error) { toast(error.message); return; }

  toast('Prediction saved. Latest saved score will count.');
  await loadPredictions();
  rerenderCurrentView();
}
window.savePrediction = savePrediction;

/* ============================================================
   Leaderboard
   ============================================================ */

async function renderLeaderboard() {
  const { data, error } = await supabaseClient
    .from('leaderboard').select('*')
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
   Admin
   ============================================================ */

function renderAdmin() {
  views.admin.innerHTML = renderAdminPanel(matchesCache, OPENFOOTBALL_2026_URL);
  fillAdminMatchForm();
}

function fillAdminMatchForm() {
  const select = $('adminMatchSelect');
  if (!select || !select.value) return;
  const match = matchesCache.find(m => m.id === select.value);
  if (!match) return;
  $('adminActualHome').value = match.actual_home_score ?? '';
  $('adminActualAway').value = match.actual_away_score ?? '';
  $('adminLock').checked = !!match.is_locked;
  $('adminOverrideOpen').checked = !!match.admin_override_open;
}
window.fillAdminMatchForm = fillAdminMatchForm;

async function addMatch() {
  const kickoffValue = $('adminKickoff').value;
  const payload = {
    home_team: $('adminHome').value.trim(),
    away_team: $('adminAway').value.trim(),
    stage: $('adminStage').value.trim(),
    venue: $('adminVenue').value.trim(),
    kickoff_at: kickoffValue ? new Date(kickoffValue).toISOString() : null,
    is_locked: false,
    admin_override_open: false,
    source: 'manual'
  };

  if (!payload.home_team || !payload.away_team || !payload.kickoff_at) {
    toast('Team names and kickoff are required.');
    return;
  }

  const { error } = await supabaseClient.from('matches').insert(payload);
  if (error) { toast(error.message); return; }
  toast('Match added.');
  await refreshAll();
}
window.addMatch = addMatch;

async function updateResult() {
  const matchId = $('adminMatchSelect').value;
  const homeRaw = $('adminActualHome').value;
  const awayRaw = $('adminActualAway').value;

  const payload = {
    is_locked: $('adminLock').checked,
    admin_override_open: $('adminOverrideOpen').checked,
    actual_home_score: homeRaw === '' ? null : Number(homeRaw),
    actual_away_score: awayRaw === '' ? null : Number(awayRaw)
  };

  const { error } = await supabaseClient.from('matches').update(payload).eq('id', matchId);
  if (error) { toast(error.message); return; }
  toast('Match updated.');
  await refreshAll();
}
window.updateResult = updateResult;

async function deleteSelectedMatch() {
  const matchId = $('adminMatchSelect').value;
  if (!matchId) return;
  if (!confirm('Delete this match? Related predictions will also be deleted.')) return;

  const { error } = await supabaseClient.from('matches').delete().eq('id', matchId);
  if (error) { toast(error.message); return; }
  toast('Match deleted.');
  await refreshAll();
}
window.deleteSelectedMatch = deleteSelectedMatch;

/* ============================================================
   Schedule sync from OpenFootball (same data Google uses)
   ============================================================ */

async function syncScheduleFromInternet() {
  const url = $('scheduleUrl').value.trim() || OPENFOOTBALL_2026_URL;

  try {
    toast('Syncing schedule...');
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not fetch schedule: ${response.status}`);

    const json = await response.json();
    const rows = normalizeOpenFootballSchedule(json, url);
    if (!rows.length) throw new Error('No matches found in the schedule file.');

    const { error } = await supabaseClient
      .from('matches').upsert(rows, { onConflict: 'external_id' });
    if (error) throw error;

    toast(`Synced ${rows.length} matches.`);
    await refreshAll();
  } catch (error) {
    toast(error.message);
  }
}
window.syncScheduleFromInternet = syncScheduleFromInternet;

function normalizeOpenFootballSchedule(json, sourceUrl) {
  const matches = Array.isArray(json.matches) ? json.matches : [];

  return matches.map((match, index) => {
    const kickoff = parseOpenFootballDateTime(match.date, match.time);
    const externalId = `openfootball-2026-${String(index + 1).padStart(3, '0')}`;
    const fullTimeScore = Array.isArray(match.score?.ft) ? match.score.ft : null;

    return {
      external_id: externalId,
      source: 'openfootball',
      source_url: sourceUrl,
      home_team: match.team1 || 'TBD',
      away_team: match.team2 || 'TBD',
      stage: match.group || match.round || 'World Cup',
      venue: match.ground || null,
      kickoff_at: kickoff,
      actual_home_score: fullTimeScore ? Number(fullTimeScore[0]) : null,
      actual_away_score: fullTimeScore ? Number(fullTimeScore[1]) : null,
      last_synced_at: new Date().toISOString()
    };
  }).filter(row => row.kickoff_at);
}

function parseOpenFootballDateTime(dateValue, timeValue) {
  if (!dateValue) return null;
  const time = String(timeValue || '00:00').trim();
  const match = time.match(/^(\d{1,2}):(\d{2})(?:\s*UTC([+-]\d{1,2}))?$/i);

  if (!match) return new Date(`${dateValue}T00:00:00Z`).toISOString();

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const offset = match[3] !== undefined ? Number(match[3]) : 0;
  const dp = dateValue.split('-').map(Number);
  const utcMs = Date.UTC(dp[0], dp[1] - 1, dp[2], hour - offset, minute, 0);
  return new Date(utcMs).toISOString();
}

/* ============================================================
   CSV export
   ============================================================ */

async function downloadPredictionsCsv() {
  const { data, error } = await supabaseClient
    .from('predictions_export').select('*').order('kickoff_at', { ascending: true });

  let rows;
  if (!error && data) {
    rows = data.map(row => [
      row.full_name, row.email, row.home_team, row.away_team,
      row.stage, row.kickoff_at, row.home_score, row.away_score, row.updated_at
    ]);
  } else {
    rows = predictionsCache.map(prediction => {
      const match = matchesCache.find(item => item.id === prediction.match_id) || {};
      return [
        currentProfile.full_name, currentProfile.email,
        match.home_team, match.away_team, match.stage, match.kickoff_at,
        prediction.home_score, prediction.away_score, prediction.updated_at
      ];
    });
  }

  const csv = [
    ['Name','Email','Home','Away','Stage','Kickoff','Pred Home','Pred Away','Updated'],
    ...rows
  ].map(row => row.map(csvEscape).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
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
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/* ============================================================
   Top-level view switching
   ============================================================ */

function showView(name) {
  currentTopView = name;

  Object.entries(views).forEach(([key, el]) => {
    el.classList.toggle('hidden', key !== name);
  });

  document.querySelectorAll('.nav-tabs button').forEach(b => {
    b.classList.toggle('active', b.dataset.view === name);
  });

  if (name === 'predictions')   renderPredictionsRoot();
  if (name === 'myPredictions') renderMyPredictionsView();
}

/* ============================================================
   Event wiring
   ============================================================ */

$('saveConfigBtn').addEventListener('click', () => {
  const url = $('supabaseUrl').value.trim();
  const key = $('supabaseAnonKey').value.trim();
  if (!url || !key) { toast('Enter Supabase URL and anon key.'); return; }

  localStorage.setItem('wc_supabase_url', url);
  localStorage.setItem('wc_supabase_anon_key', key);
  initSupabase();
  loadSession();
});

let authMode = 'login';

$('loginTab').addEventListener('click', () => {
  authMode = 'login';
  $('loginTab').classList.add('active');
  $('signupTab').classList.remove('active');
  $('authSubmitBtn').textContent = 'Login';
  $('nameLabel').classList.add('hidden');
  $('fullName').classList.add('hidden');
});

$('signupTab').addEventListener('click', () => {
  authMode = 'signup';
  $('signupTab').classList.add('active');
  $('loginTab').classList.remove('active');
  $('authSubmitBtn').textContent = 'Create Account';
  $('nameLabel').classList.remove('hidden');
  $('fullName').classList.remove('hidden');
});

$('authForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('authMessage').textContent = '';

  const email = $('email').value.trim().toLowerCase();
  const password = $('password').value;

  try {
    if (authMode === 'login') {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      currentUser = data.user;
      await enterPortal();
    } else {
      const fullName = $('fullName').value.trim();
      const { error } = await supabaseClient.auth.signUp({
        email, password,
        options: { data: { full_name: fullName } }
      });
      if (error) throw error;
      $('authMessage').style.color = '#86efac';
      $('authMessage').textContent =
        'Account created. You can now login with the same email and password.';
    }
  } catch (error) {
    $('authMessage').style.color = '#fb7185';
    $('authMessage').textContent = error.message;
  }
});

$('logoutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  currentUser = null;
  currentProfile = null;
  if (lockTickerId) clearInterval(lockTickerId);
  if (scheduleRefreshId) clearInterval(scheduleRefreshId);
  $('portalPanel').classList.add('hidden');
  $('authPanel').classList.remove('hidden');
});

$('themeToggleBtn').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

document.querySelectorAll('.nav-tabs button').forEach(button => {
  button.addEventListener('click', () => showView(button.dataset.view));
});

/* ============================================================
   Boot
   ============================================================ */

initTheme();
if (initSupabase()) loadSession();
