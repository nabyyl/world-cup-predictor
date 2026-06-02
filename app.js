let supabaseClient;
let currentUser = null;
let currentProfile = null;
let matchesCache = [];
let predictionsCache = [];

const OPENFOOTBALL_2026_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

const $ = (id) => document.getElementById(id);

const views = {
  predictions: $('predictionsView'),
  leaderboard: $('leaderboardView'),
  rules: $('rulesView'),
  admin: $('adminView')
};

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3200);
}

function formatDate(value) {
  return new Date(value).toLocaleString([], {
    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function isAdmin() {
  return currentProfile?.role === 'admin';
}

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
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .single();
  if (error) throw error;
  currentProfile = data;
}

async function enterPortal() {
  await fetchProfile();
  if (currentProfile.status !== 'active') {
    $('authMessage').textContent = 'Your account is pending or inactive. Ask the admin to add/activate your email.';
    await supabaseClient.auth.signOut();
    return;
  }
  $('authPanel').classList.add('hidden');
  $('portalPanel').classList.remove('hidden');
  $('userLine').textContent = `${currentProfile.full_name || currentProfile.email} • ${currentProfile.role}`;
  $('adminTab').classList.toggle('hidden', !isAdmin());
  await refreshAll();
}

async function refreshAll() {
  await Promise.all([loadMatches(), loadPredictions()]);
  renderPredictions();
  await renderLeaderboard();
  if (isAdmin()) renderAdmin();
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

function matchLocked(match) {
  if (match.admin_override_open) return false;
  return match.is_locked || new Date(match.kickoff_at) <= new Date();
}

function lockReason(match) {
  if (match.admin_override_open) return 'Admin reopened';
  if (match.is_locked) return 'Manually locked';
  if (new Date(match.kickoff_at) <= new Date()) return 'Started';
  return 'Open';
}

function resultText(match) {
  if (match.actual_home_score === null || match.actual_away_score === null) return 'Result pending';
  return `Result: ${match.actual_home_score} - ${match.actual_away_score}`;
}

function renderPredictions() {
  if (!matchesCache.length) {
    views.predictions.innerHTML = `<div class="card match-card"><h2>No matches yet</h2><p class="muted">Admin needs to add matches first or sync the World Cup schedule.</p></div>`;
    return;
  }
  views.predictions.innerHTML = matchesCache.map(match => {
    const prediction = predictionFor(match.id);
    const locked = matchLocked(match);
    const venue = match.venue ? ` • ${escapeHtml(match.venue)}` : '';
    return `
      <article class="card match-card">
        <div class="match-top">
          <span>${formatDate(match.kickoff_at)}</span>
          <span class="status-pill ${locked ? 'locked' : ''}">${locked ? '🔒 Locked' : '🟢 Open'}</span>
        </div>
        <div class="teams">
          <div class="team-name">${escapeHtml(match.home_team)}</div>
          <div class="vs">vs</div>
          <div class="team-name">${escapeHtml(match.away_team)}</div>
        </div>
        <p class="muted">${escapeHtml(match.stage || 'Match')}${venue} • ${resultText(match)}</p>
        <p class="muted small">Lock status: ${lockReason(match)}</p>
        <div class="score-row">
          <input type="number" min="0" max="30" id="home_${match.id}" value="${prediction?.home_score ?? ''}" ${locked ? 'disabled' : ''} placeholder="${escapeHtml(match.home_team)}" />
          <input type="number" min="0" max="30" id="away_${match.id}" value="${prediction?.away_score ?? ''}" ${locked ? 'disabled' : ''} placeholder="${escapeHtml(match.away_team)}" />
        </div>
        <button onclick="savePrediction('${match.id}')" ${locked ? 'disabled' : ''}>Save / Update Prediction</button>
        <p class="muted small">You can update unlimited times before kickoff. Your latest saved score will count.</p>
        ${prediction ? `<p class="saved">Latest saved prediction: ${prediction.home_score} - ${prediction.away_score}</p>` : `<p class="muted">No prediction saved yet.</p>`}
      </article>
    `;
  }).join('');
}

async function savePrediction(matchId) {
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
  if (error) return toast(error.message);
  toast('Prediction saved. Latest saved score will count.');
  await loadPredictions();
  renderPredictions();
}
window.savePrediction = savePrediction;

async function renderLeaderboard() {
  const { data, error } = await supabaseClient
    .from('leaderboard')
    .select('*')
    .order('total_points', { ascending: false })
    .order('exact_scores', { ascending: false })
    .order('full_name', { ascending: true });
  if (error) {
    views.leaderboard.innerHTML = `<div class="card table-card"><p class="message">${escapeHtml(error.message)}</p></div>`;
    return;
  }
  views.leaderboard.innerHTML = `
    <div class="card table-card">
      <h2>Leaderboard</h2>
      <table>
        <thead><tr><th>Rank</th><th>Name</th><th>Points</th><th>Exact</th><th>Correct Result</th><th>Predictions</th></tr></thead>
        <tbody>
          ${(data || []).map((row, index) => `
            <tr>
              <td class="rank">#${index + 1}</td>
              <td>${escapeHtml(row.full_name || row.email)}</td>
              <td><strong>${row.total_points}</strong></td>
              <td>${row.exact_scores}</td>
              <td>${row.correct_results}</td>
              <td>${row.predictions_count}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderAdmin() {
  const selectedOptions = matchesCache.map(m => `<option value="${m.id}">${escapeHtml(m.home_team)} vs ${escapeHtml(m.away_team)} - ${formatDate(m.kickoff_at)}</option>`).join('');
  views.admin.innerHTML = `
    <div class="admin-grid">
      <div class="card admin-card">
        <h2>Sync World Cup Schedule</h2>
        <p class="muted">Pulls fixtures from the free OpenFootball JSON schedule and upserts them into your database.</p>
        <label>Schedule JSON URL</label>
        <input id="scheduleUrl" value="${OPENFOOTBALL_2026_URL}" />
        <button onclick="syncScheduleFromInternet()">Sync Schedule from Internet</button>
        <p class="muted small">This updates teams, stage, venue, kickoff time and source ID. Existing predictions are preserved.</p>
      </div>

      <div class="card admin-card">
        <h2>Add Match Manually</h2>
        <label>Home Team</label><input id="adminHome" placeholder="Brazil" />
        <label>Away Team</label><input id="adminAway" placeholder="Germany" />
        <label>Stage</label><input id="adminStage" placeholder="Group A" />
        <label>Venue</label><input id="adminVenue" placeholder="Stadium / City" />
        <label>Kickoff Date & Time</label><input id="adminKickoff" type="datetime-local" />
        <button onclick="addMatch()">Add Match</button>
      </div>

      <div class="card admin-card">
        <h2>Enter Results / Lock Control</h2>
        <label>Match</label>
        <select id="adminMatchSelect" onchange="fillAdminMatchForm()">${selectedOptions}</select>
        <div class="inline-row">
          <div><label>Home Actual</label><input id="adminActualHome" type="number" min="0" /></div>
          <div><label>Away Actual</label><input id="adminActualAway" type="number" min="0" /></div>
        </div>
        <label><input id="adminLock" type="checkbox" style="width:auto" /> Manual lock</label>
        <label><input id="adminOverrideOpen" type="checkbox" style="width:auto" /> Admin override: keep open even after kickoff</label>
        <button onclick="updateResult()">Update Match</button>
        <button onclick="deleteSelectedMatch()" class="danger">Delete Match</button>
        <p class="muted small">Normal users are locked after kickoff. Use override only if you intentionally want to reopen predictions.</p>
      </div>

      <div class="card admin-card">
        <h2>Office Users / Export</h2>
        <p class="muted">Add approved emails in Supabase using the SQL examples in the README. After that, users can create their own accounts.</p>
        <button onclick="downloadPredictionsCsv()" class="secondary">Download My Visible Predictions CSV</button>
      </div>
    </div>
  `;
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
  if (!payload.home_team || !payload.away_team || !payload.kickoff_at) return toast('Team names and kickoff are required.');
  const { error } = await supabaseClient.from('matches').insert(payload);
  if (error) return toast(error.message);
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
  if (error) return toast(error.message);
  toast('Match updated.');
  await refreshAll();
}
window.updateResult = updateResult;

async function deleteSelectedMatch() {
  const matchId = $('adminMatchSelect').value;
  if (!matchId) return;
  if (!confirm('Delete this match? Related predictions will also be deleted.')) return;
  const { error } = await supabaseClient.from('matches').delete().eq('id', matchId);
  if (error) return toast(error.message);
  toast('Match deleted.');
  await refreshAll();
}
window.deleteSelectedMatch = deleteSelectedMatch;

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
      .from('matches')
      .upsert(rows, { onConflict: 'external_id' });
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
  return matches.map((m, index) => {
    const kickoff = parseOpenFootballDateTime(m.date, m.time);
    const externalId = `openfootball-2026-${String(index + 1).padStart(3, '0')}`;
    const ft = Array.isArray(m.score?.ft) ? m.score.ft : null;
    return {
      external_id: externalId,
      source: 'openfootball',
      source_url: sourceUrl,
      home_team: m.team1 || 'TBD',
      away_team: m.team2 || 'TBD',
      stage: m.group || m.round || 'World Cup',
      venue: m.ground || null,
      kickoff_at: kickoff,
      actual_home_score: ft ? Number(ft[0]) : null,
      actual_away_score: ft ? Number(ft[1]) : null,
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
  const utcMs = Date.UTC(...dateValue.split('-').map((n, i) => i === 1 ? Number(n) - 1 : Number(n)), hour - offset, minute, 0);
  return new Date(utcMs).toISOString();
}

async function downloadPredictionsCsv() {
  const { data, error } = await supabaseClient
    .from('predictions_export')
    .select('*')
    .order('kickoff_at', { ascending: true });

  let rows;
  if (!error && data) {
    rows = data.map(r => [r.full_name, r.email, r.home_team, r.away_team, r.stage, r.kickoff_at, r.home_score, r.away_score, r.updated_at]);
  } else {
    rows = predictionsCache.map(p => {
      const match = matchesCache.find(m => m.id === p.match_id) || {};
      return [currentProfile.full_name, currentProfile.email, match.home_team, match.away_team, match.stage, match.kickoff_at, p.home_score, p.away_score, p.updated_at];
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

function showView(name) {
  Object.entries(views).forEach(([key, el]) => el.classList.toggle('hidden', key !== name));
  document.querySelectorAll('.nav-tabs button').forEach(btn => btn.classList.toggle('active', btn.dataset.view === name));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

$('saveConfigBtn').addEventListener('click', () => {
  const url = $('supabaseUrl').value.trim();
  const key = $('supabaseAnonKey').value.trim();
  if (!url || !key) return toast('Enter Supabase URL and anon key.');
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
        email,
        password,
        options: { data: { full_name: fullName } }
      });
      if (error) throw error;
      $('authMessage').style.color = '#86efac';
      $('authMessage').textContent = 'Account created. You can now login with the same email and password.';
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
  $('portalPanel').classList.add('hidden');
  $('authPanel').classList.remove('hidden');
});

document.querySelectorAll('.nav-tabs button').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

if (initSupabase()) loadSession();
