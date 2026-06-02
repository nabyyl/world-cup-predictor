/* ============================================================
   ui.js — pure render helpers
   ============================================================ */

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));
}

function formatDate(value) {
  return new Date(value).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDateShort(value) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/* ============================================================
   Stage classification
   The OpenFootball feed labels stages as "Group A", "Group B"...
   "Round of 32", "Round of 16", "Quarter-finals", "Semi-finals",
   "Final" / "3rd place". Map all of these into our buckets.
   ============================================================ */

const STAGES = [
  { id: 'summary',  label: 'Summary',        emoji: '⚡' },
  { id: 'group',    label: 'Group Stage',    emoji: '🌍' },
  { id: 'r32',      label: 'Round of 32',    emoji: '🏟️' },
  { id: 'r16',      label: 'Round of 16',    emoji: '🎯' },
  { id: 'qf',       label: 'Quarter Finals', emoji: '🔥' },
  { id: 'sf',       label: 'Semi Finals',    emoji: '⭐' },
  { id: 'final',    label: 'Final',          emoji: '🏆' },
  { id: 'done',     label: 'Done',           emoji: '✅' }
];

function classifyStage(rawStage) {
  const s = String(rawStage || '').toLowerCase();
  if (!s) return 'group';
  if (s.startsWith('group')) return 'group';
  if (s.includes('round of 32') || s.includes('r32') || s.includes('round-of-32')) return 'r32';
  if (s.includes('round of 16') || s.includes('r16') || s.includes('round-of-16')) return 'r16';
  if (s.includes('quarter')) return 'qf';
  if (s.includes('semi'))    return 'sf';
  if (s.includes('final') || s.includes('3rd')) return 'final';
  return 'group';
}

/* ============================================================
   Match status helpers
   ============================================================ */

function matchHasResult(match) {
  return match.actual_home_score !== null
      && match.actual_away_score !== null
      && match.actual_home_score !== undefined
      && match.actual_away_score !== undefined;
}

function isLive(match) {
  const kickoff = new Date(match.kickoff_at).getTime();
  const now = Date.now();
  // Treat as live for 130 minutes after kickoff if no final score yet
  return !matchHasResult(match) && now >= kickoff && now <= kickoff + 130 * 60 * 1000;
}

function isUpcoming(match) {
  return new Date(match.kickoff_at).getTime() > Date.now();
}

function resultText(match) {
  if (!matchHasResult(match)) return 'Result pending';
  return `Result: ${match.actual_home_score} - ${match.actual_away_score}`;
}

function googleSearchUrl(match) {
  const q = `${match.home_team} vs ${match.away_team} world cup 2026`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

/* ============================================================
   Stage filter (sub-nav)
   ============================================================ */

function renderStageFilter(activeStageId, counts) {
  return STAGES.map(stage => {
    const c = counts[stage.id] || 0;
    const badge = c > 0 ? ` <span class="muted small">(${c})</span>` : '';
    return `
      <button data-stage="${stage.id}" class="${activeStageId === stage.id ? 'active' : ''}">
        ${stage.emoji} ${stage.label}${badge}
      </button>
    `;
  }).join('');
}

function computeStageCounts(matches) {
  const counts = { summary: 0, group: 0, r32: 0, r16: 0, qf: 0, sf: 0, final: 0, done: 0 };
  for (const m of matches) {
    const bucket = classifyStage(m.stage);
    counts[bucket] = (counts[bucket] || 0) + 1;
    if (matchHasResult(m)) counts.done += 1;
    if (isUpcoming(m))     counts.summary += 1;
  }
  return counts;
}

/* ============================================================
   Summary view (default landing inside Predictions)
   ============================================================ */

function renderSummary(matches, predictions) {
  const now = Date.now();
  const upcoming = matches
    .filter(m => new Date(m.kickoff_at).getTime() > now)
    .slice(0, 6);
  const live = matches.filter(isLive);
  const totalPredicted = predictions.length;
  const totalMatches = matches.length;

  return `
    <article class="card summary-hero">
      <div>
        <h2>Welcome back ⚽</h2>
        <p class="muted">Here's the quick view across the tournament. Pick a stage above to start predicting.</p>
        <div class="summary-quick">
          <div class="stat"><strong>${totalMatches}</strong><span>Total matches</span></div>
          <div class="stat"><strong>${upcoming.length}</strong><span>Upcoming</span></div>
          <div class="stat"><strong>${live.length}</strong><span>Live now</span></div>
          <div class="stat"><strong>${totalPredicted}</strong><span>Your predictions</span></div>
        </div>
      </div>
      <div class="badge">${new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</div>
    </article>

    ${live.length ? `
      <article class="card" style="padding:18px; margin-bottom:16px;">
        <h2>🔴 Live now</h2>
        <div class="next-up" style="margin-top:12px;">
          ${live.map(m => liveMiniCard(m)).join('')}
        </div>
      </article>
    ` : ''}

    <article class="card" style="padding:18px;">
      <h2>Next up</h2>
      <p class="muted small">The next ${Math.min(6, upcoming.length)} fixtures, in kickoff order.</p>
      ${upcoming.length === 0
        ? `<div class="empty-state"><span class="emoji">🌴</span>No upcoming matches scheduled.</div>`
        : `<div class="next-up" style="margin-top:12px;">${upcoming.map(nextUpCard).join('')}</div>`
      }
    </article>
  `;
}

function nextUpCard(match) {
  return `
    <div class="next-card">
      <span class="stage-tag">${escapeHtml(match.stage || 'Match')}</span>
      <div class="matchup">${escapeHtml(match.home_team)} <span class="muted">vs</span> ${escapeHtml(match.away_team)}</div>
      <div class="when">${formatDate(match.kickoff_at)}${match.venue ? ' • ' + escapeHtml(match.venue) : ''}</div>
    </div>
  `;
}

function liveMiniCard(match) {
  return `
    <div class="next-card">
      <span class="status-pill live">● LIVE</span>
      <div class="matchup">${escapeHtml(match.home_team)} <span class="muted">vs</span> ${escapeHtml(match.away_team)}</div>
      <a class="ext-link" href="${googleSearchUrl(match)}" target="_blank" rel="noopener">View live on Google ↗</a>
    </div>
  `;
}

/* ============================================================
   Match cards (Group / R32 / R16 / QF / SF / Final)
   ============================================================ */

function renderMatchCards(matches, predictions, helpers, stageFilterId) {
  const { predictionFor, matchLocked, lockReason } = helpers;

  const filtered = matches.filter(m => classifyStage(m.stage) === stageFilterId);

  if (!filtered.length) {
    return `
      <div class="card empty-state">
        <span class="emoji">🗓️</span>
        <p>No matches in this stage yet.</p>
        <p class="muted small">Admin can sync the schedule from the Admin tab.</p>
      </div>
    `;
  }

  return `<div class="view-grid">${filtered.map(match => {
    const prediction = predictionFor(match.id);
    const locked = matchLocked(match);
    const live = isLive(match);
    const venue = match.venue ? ` • ${escapeHtml(match.venue)}` : '';

    const pill = live
      ? `<span class="status-pill live">● LIVE</span>`
      : locked
        ? `<span class="status-pill locked">🔒 Locked</span>`
        : `<span class="status-pill upcoming">🟢 Open</span>`;

    return `
      <article class="card match-card">
        <div class="match-top">
          <span>${formatDate(match.kickoff_at)}</span>
          ${pill}
        </div>

        <div class="teams">
          <div class="team-name home">${escapeHtml(match.home_team)}</div>
          <div class="vs">vs</div>
          <div class="team-name away">${escapeHtml(match.away_team)}</div>
        </div>

        <p class="muted small">
          ${escapeHtml(match.stage || 'Match')}${venue} • ${resultText(match)}
        </p>

        <p class="muted small">
          Status: ${lockReason(match)}
        </p>

        <div class="score-row">
          <input
            type="number" min="0" max="30"
            id="home_${match.id}"
            value="${prediction?.home_score ?? ''}"
            ${locked ? 'disabled' : ''}
            placeholder="${escapeHtml(match.home_team)}"
          />
          <input
            type="number" min="0" max="30"
            id="away_${match.id}"
            value="${prediction?.away_score ?? ''}"
            ${locked ? 'disabled' : ''}
            placeholder="${escapeHtml(match.away_team)}"
          />
        </div>

        <button onclick="savePrediction('${match.id}')" ${locked ? 'disabled' : ''}>
          ${prediction ? 'Update Prediction' : 'Save Prediction'}
        </button>

        <p class="muted small">
          Unlimited updates allowed until kickoff — your last saved score is the one that counts.
        </p>

        ${prediction
          ? `<p class="saved">Latest prediction: ${prediction.home_score} - ${prediction.away_score}</p>`
          : `<p class="muted small">No prediction saved yet.</p>`
        }

        <a class="ext-link" href="${googleSearchUrl(match)}" target="_blank" rel="noopener">
          View on Google ↗
        </a>
      </article>
    `;
  }).join('')}</div>`;
}

/* ============================================================
   Done view — completed matches with final scores
   ============================================================ */

function renderDoneMatches(matches, predictions) {
  const done = matches.filter(matchHasResult)
    .sort((a, b) => new Date(b.kickoff_at) - new Date(a.kickoff_at));

  if (!done.length) {
    return `
      <div class="card empty-state">
        <span class="emoji">📭</span>
        <p>No completed matches yet.</p>
        <p class="muted small">Final scores will appear here as matches finish.</p>
      </div>
    `;
  }

  return `<div class="view-grid">${done.map(match => {
    const prediction = predictions.find(p => p.match_id === match.id);
    const pts = scorePrediction(prediction, match);
    const won = pts.points > 0;

    return `
      <article class="card match-card">
        <div class="match-top">
          <span>${formatDate(match.kickoff_at)}</span>
          <span class="status-pill done">✅ Final</span>
        </div>

        <div class="teams">
          <div class="team-name home">${escapeHtml(match.home_team)}</div>
          <div class="vs">${match.actual_home_score} - ${match.actual_away_score}</div>
          <div class="team-name away">${escapeHtml(match.away_team)}</div>
        </div>

        <p class="muted small">${escapeHtml(match.stage || 'Match')}${match.venue ? ' • ' + escapeHtml(match.venue) : ''}</p>

        ${prediction
          ? `<p class="${won ? 'saved' : 'muted'}">
               Your prediction: ${prediction.home_score} - ${prediction.away_score}
               • <strong>${pts.points} pt${pts.points === 1 ? '' : 's'}</strong>
               ${pts.label ? `· ${pts.label}` : ''}
             </p>`
          : `<p class="muted small">You didn't predict this match.</p>`
        }

        <a class="ext-link" href="${googleSearchUrl(match)}" target="_blank" rel="noopener">
          View on Google ↗
        </a>
      </article>
    `;
  }).join('')}</div>`;
}

/* ============================================================
   My Predictions view — per-match table with win highlight
   ============================================================ */

function renderMyPredictions(matches, predictions) {
  if (!matches.length) {
    return `
      <div class="card empty-state">
        <span class="emoji">📝</span>
        <p>No matches yet — nothing to predict.</p>
      </div>
    `;
  }

  const sorted = [...matches].sort((a, b) => new Date(b.kickoff_at) - new Date(a.kickoff_at));

  const totalPoints = sorted.reduce((sum, m) => {
    const pred = predictions.find(p => p.match_id === m.id);
    return sum + scorePrediction(pred, m).points;
  }, 0);

  return `
    <div class="card" style="padding:18px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div>
          <h2>My Predictions</h2>
          <p class="muted small">Your latest prediction vs. the actual result for every match. Green = points won.</p>
        </div>
        <div class="badge" style="background: var(--glass-bg-strong); border:1px solid var(--glass-border); padding:8px 14px; border-radius:999px; font-weight:800;">
          ${totalPoints} pts total
        </div>
      </div>

      <div class="mp-header" style="margin-top:14px;">
        <div>Match</div>
        <div style="text-align:center;">My Pick</div>
        <div style="text-align:center;">Actual</div>
        <div class="pts-col" style="text-align:right;">Pts</div>
      </div>

      <div class="mp-list">
        ${sorted.map(match => {
          const pred = predictions.find(p => p.match_id === match.id);
          const pts = scorePrediction(pred, match);
          const cls = matchHasResult(match) ? (pts.points > 0 ? 'win' : 'loss') : '';

          return `
            <div class="mp-row ${cls}">
              <div>
                <div class="matchup">${escapeHtml(match.home_team)} <span class="muted">vs</span> ${escapeHtml(match.away_team)}</div>
                <div class="meta">${formatDateShort(match.kickoff_at)} • ${escapeHtml(match.stage || '—')}</div>
              </div>
              <div class="score-cell">
                ${pred ? `${pred.home_score} - ${pred.away_score}` : '<span class="muted">—</span>'}
              </div>
              <div class="score-cell">
                ${matchHasResult(match)
                  ? `${match.actual_home_score} - ${match.actual_away_score}`
                  : '<span class="muted">pending</span>'}
              </div>
              <div class="pts">${matchHasResult(match) ? pts.points : '—'}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/* ============================================================
   Scoring helper — matches the Supabase view logic
   5 = exact · 4 = result + goal diff · 3 = result only
   ============================================================ */

function scorePrediction(prediction, match) {
  if (!prediction || !matchHasResult(match)) return { points: 0, label: '' };

  const ph = prediction.home_score, pa = prediction.away_score;
  const ah = match.actual_home_score, aa = match.actual_away_score;

  if (ph === ah && pa === aa) return { points: 5, label: 'Exact score' };

  const predResult = Math.sign(ph - pa);
  const actResult  = Math.sign(ah - aa);

  if (predResult === actResult) {
    if ((ph - pa) === (ah - aa)) return { points: 4, label: 'Result + goal diff' };
    return { points: 3, label: 'Correct result' };
  }

  return { points: 0, label: '' };
}

/* ============================================================
   Leaderboard
   ============================================================ */

function renderLeaderboardTable(rows) {
  return `
    <div class="card table-card">
      <h2>Leaderboard</h2>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Points</th>
            <th>Exact</th>
            <th>Correct Result</th>
            <th>Predictions</th>
          </tr>
        </thead>
        <tbody>
          ${(rows || []).map((row, index) => `
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
    </div>
  `;
}

function renderLeaderboardError(message) {
  return `<div class="card table-card"><p class="message">${escapeHtml(message)}</p></div>`;
}

/* ============================================================
   Admin
   ============================================================ */

function renderAdminPanel(matches, scheduleUrl) {
  const selectedOptions = matches.map(match => `
    <option value="${match.id}">
      ${escapeHtml(match.home_team)} vs ${escapeHtml(match.away_team)} - ${formatDate(match.kickoff_at)}
    </option>
  `).join('');

  return `
    <div class="admin-grid">
      <div class="card admin-card">
        <h2>Sync World Cup Schedule</h2>
        <p class="muted small">
          Pulls fixtures (and final scores once available) from the OpenFootball JSON schedule.
          OpenFootball uses the same FIFA-published data Google's World Cup card shows.
        </p>

        <label>Schedule JSON URL</label>
        <input id="scheduleUrl" value="${escapeHtml(scheduleUrl)}" />

        <button onclick="syncScheduleFromInternet()">Sync Schedule from Internet</button>

        <p class="muted small">
          Updates teams, stage, venue, kickoff time, and actual scores when present.
          Existing predictions are preserved.
        </p>
      </div>

      <div class="card admin-card">
        <h2>Add Match Manually</h2>

        <label>Home Team</label>
        <input id="adminHome" placeholder="Brazil" />

        <label>Away Team</label>
        <input id="adminAway" placeholder="Germany" />

        <label>Stage</label>
        <input id="adminStage" placeholder="Group A / Round of 16 / Quarter-finals" />

        <label>Venue</label>
        <input id="adminVenue" placeholder="Stadium / City" />

        <label>Kickoff Date & Time</label>
        <input id="adminKickoff" type="datetime-local" />

        <button onclick="addMatch()">Add Match</button>
      </div>

      <div class="card admin-card">
        <h2>Enter Results / Lock Control</h2>

        <label>Match</label>
        <select id="adminMatchSelect" onchange="fillAdminMatchForm()">
          ${selectedOptions}
        </select>

        <div class="inline-row">
          <div>
            <label>Home Actual</label>
            <input id="adminActualHome" type="number" min="0" />
          </div>
          <div>
            <label>Away Actual</label>
            <input id="adminActualAway" type="number" min="0" />
          </div>
        </div>

        <label>
          <input id="adminLock" type="checkbox" style="width:auto" />
          Manual lock
        </label>

        <label>
          <input id="adminOverrideOpen" type="checkbox" style="width:auto" />
          Admin override: keep open even after kickoff
        </label>

        <button onclick="updateResult()">Update Match</button>
        <button onclick="deleteSelectedMatch()" class="danger">Delete Match</button>

        <p class="muted small">
          Normal users are auto-locked the moment kickoff time passes.
          Use override only to deliberately reopen predictions.
        </p>
      </div>

      <div class="card admin-card">
        <h2>Office Users / Export</h2>
        <p class="muted small">
          Add approved emails in Supabase using SQL. After that, users can create their own accounts.
        </p>
        <button onclick="downloadPredictionsCsv()" class="secondary">
          Download My Visible Predictions CSV
        </button>
      </div>
    </div>
  `;
}
