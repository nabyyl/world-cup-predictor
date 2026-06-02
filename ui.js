/* ============================================================
   ui.js — pure render helpers (Liquid Glass Edition)
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
  const date = new Date(value);
  const formatted = date.toLocaleString([], {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  return `<time datetime="${date.toISOString()}">${formatted}</time>`;
}

function formatDateShort(value) {
  const date = new Date(value);
  const formatted = date.toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  return `<time datetime="${date.toISOString()}">${formatted}</time>`;
}

/* ============================================================
   Stage classification
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
  if (!s || s.startsWith('group')) return 'group';
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
  return match.actual_home_score != null && match.actual_away_score != null;
}

function isLive(match) {
  const kickoff = new Date(match.kickoff_at).getTime();
  const now = Date.now();
  return !matchHasResult(match) && now >= kickoff && now <= kickoff + 130 * 60 * 1000;
}

function isUpcoming(match) {
  return new Date(match.kickoff_at).getTime() > Date.now();
}

function resultText(match) {
  if (!matchHasResult(match)) return 'Result pending';
  return `Result: <span class="highlight-score">${match.actual_home_score} - ${match.actual_away_score}</span>`;
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
    const badge = c > 0 ? ` <span class="glass-badge-count muted small">(${c})</span>` : '';
    const isActive = activeStageId === stage.id;
    
    return `
      <button 
        data-stage="${stage.id}" 
        class="glass-tab ${isActive ? 'active glow-effect' : ''}"
        aria-pressed="${isActive}">
        <span class="tab-emoji" aria-hidden="true">${stage.emoji}</span> ${stage.label}${badge}
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
   Summary view
   ============================================================ */

function renderSummary(matches, predictions) {
  const now = Date.now();
  const upcoming = matches.filter(m => new Date(m.kickoff_at).getTime() > now).slice(0, 6);
  const live = matches.filter(isLive);
  const todayFormatted = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  return `
    <section class="glass-panel summary-hero glow-effect">
      <div class="hero-top">
        <div class="glass-date-badge">${escapeHtml(todayFormatted)}</div>
      </div>
      
      <div class="hero-content">
        <h2 class="hero-title">Welcome back <span class="emoji-glow">⚽</span></h2>
        <p class="hero-subtitle muted">Pick a stage above to start predicting</p>
        
        <div class="glass-stats-grid">
          <div class="glass-stat-box">
            <strong class="stat-value text-glow">${matches.length}</strong>
            <span class="stat-label">Total matches</span>
          </div>
          <div class="glass-stat-box">
            <strong class="stat-value text-glow">${upcoming.length}</strong>
            <span class="stat-label">Upcoming</span>
          </div>
          <div class="glass-stat-box ${live.length ? 'live-pulse' : ''}">
            <strong class="stat-value text-glow">${live.length}</strong>
            <span class="stat-label">Live now</span>
          </div>
          <div class="glass-stat-box">
            <strong class="stat-value text-glow">${predictions.length}</strong>
            <span class="stat-label">Your predictions</span>
          </div>
        </div>
      </div>
    </section>

    ${live.length ? `
      <section class="glass-panel live-section glow-effect-red" style="margin-bottom:24px;">
        <h2 class="section-title">🔴 Live now</h2>
        <div class="next-up-grid">
          ${live.map(liveMiniCard).join('')}
        </div>
      </section>
    ` : ''}

    <section class="glass-panel upcoming-section">
      <div class="section-header">
        <h2 class="section-title">Next up</h2>
        <p class="muted small">The next ${Math.min(6, upcoming.length)} fixtures, in kickoff order.</p>
      </div>
      
      ${upcoming.length === 0
        ? `<div class="glass-empty-state"><span class="emoji-large" aria-hidden="true">🌴</span><p>No upcoming matches scheduled.</p></div>`
        : `<div class="next-up-grid">${upcoming.map(nextUpCard).join('')}</div>`
      }
    </section>
  `;
}

function nextUpCard(match) {
  return `
    <article class="glass-card mini-card glow-hover">
      <span class="glass-stage-tag">${escapeHtml(match.stage || 'Match')}</span>
      <h3 class="matchup">${escapeHtml(match.home_team)} <span class="muted thin">vs</span> ${escapeHtml(match.away_team)}</h3>
      <div class="when">${formatDate(match.kickoff_at)}</div>
      ${match.venue ? `<div class="venue muted small">${escapeHtml(match.venue)}</div>` : ''}
    </article>
  `;
}

function liveMiniCard(match) {
  return `
    <article class="glass-card mini-card live-card glow-hover-red">
      <span class="status-pill live pulse">● LIVE</span>
      <h3 class="matchup">${escapeHtml(match.home_team)} <span class="muted thin">vs</span> ${escapeHtml(match.away_team)}</h3>
      <a class="glass-btn-sm ext-link" href="${googleSearchUrl(match)}" target="_blank" rel="noopener noreferrer">View on Google ↗</a>
    </article>
  `;
}

/* ============================================================
   Match cards
   ============================================================ */

function renderMatchCards(matches, predictions, helpers, stageFilterId) {
  const { predictionFor, matchLocked, lockReason } = helpers;
  const filtered = matches.filter(m => classifyStage(m.stage) === stageFilterId);

  if (!filtered.length) {
    return `
      <div class="glass-panel glass-empty-state glow-effect">
        <span class="emoji-large" aria-hidden="true">🗓️</span>
        <p class="text-glow">No matches in this stage yet.</p>
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
      ? `<span class="status-pill live pulse">● LIVE</span>`
      : locked
        ? `<span class="status-pill locked">🔒 Locked</span>`
        : `<span class="status-pill upcoming">🟢 Open</span>`;

    return `
      <article class="glass-card match-card glow-hover">
        <header class="match-top glass-header">
          <div class="time-stamp">${formatDate(match.kickoff_at)}</div>
          ${pill}
        </header>

        <div class="teams-display">
          <div class="team-name home text-glow">${escapeHtml(match.home_team)}</div>
          <div class="vs-badge">VS</div>
          <div class="team-name away text-glow">${escapeHtml(match.away_team)}</div>
        </div>

        <div class="match-meta">
          <p class="muted small">${escapeHtml(match.stage || 'Match')}${venue}</p>
          <p class="result-text">${resultText(match)}</p>
          <p class="muted xs">Status: ${escapeHtml(lockReason(match))}</p>
        </div>

        <div class="glass-score-row">
          <input
            class="liquid-input"
            type="number" min="0" max="30"
            id="home_${escapeHtml(match.id)}"
            value="${escapeHtml(prediction?.home_score ?? '')}"
            ${locked ? 'disabled' : ''}
            placeholder="${escapeHtml(match.home_team)}"
            aria-label="Predicted score for ${escapeHtml(match.home_team)}"
          />
          <span class="input-divider">-</span>
          <input
            class="liquid-input"
            type="number" min="0" max="30"
            id="away_${escapeHtml(match.id)}"
            value="${escapeHtml(prediction?.away_score ?? '')}"
            ${locked ? 'disabled' : ''}
            placeholder="${escapeHtml(match.away_team)}"
            aria-label="Predicted score for ${escapeHtml(match.away_team)}"
          />
        </div>

        <div class="card-actions">
          <button class="glass-btn primary-glow" onclick="savePrediction('${escapeHtml(match.id)}')" ${locked ? 'disabled' : ''}>
            ${prediction ? 'Update Prediction' : 'Save Prediction'}
          </button>
        </div>

        <div class="prediction-status">
          ${prediction
            ? `<div class="saved-badge glow-success">Latest: <strong>${escapeHtml(prediction.home_score)} - ${escapeHtml(prediction.away_score)}</strong></div>`
            : `<div class="muted small">No prediction saved yet</div>`
          }
        </div>

        <footer class="card-footer">
          <a class="glass-link ext-link" href="${googleSearchUrl(match)}" target="_blank" rel="noopener noreferrer">
            Google ↗
          </a>
        </footer>
      </article>
    `;
  }).join('')}</div>`;
}

/* ============================================================
   Done view
   ============================================================ */

function renderDoneMatches(matches, predictions) {
  const done = matches.filter(matchHasResult)
    .sort((a, b) => new Date(b.kickoff_at) - new Date(a.kickoff_at));

  if (!done.length) {
    return `
      <div class="glass-panel glass-empty-state glow-effect">
        <span class="emoji-large" aria-hidden="true">📭</span>
        <p class="text-glow">No completed matches yet.</p>
        <p class="muted small">Final scores will appear here as matches finish.</p>
      </div>
    `;
  }

  return `<div class="view-grid">${done.map(match => {
    const prediction = predictions.find(p => p.match_id === match.id);
    const pts = scorePrediction(prediction, match);
    const won = pts.points > 0;

    return `
      <article class="glass-card match-card done-card glow-hover">
        <header class="match-top glass-header">
          <div class="time-stamp">${formatDate(match.kickoff_at)}</div>
          <span class="status-pill done">✅ Final</span>
        </header>

        <div class="teams-display">
          <div class="team-name home">${escapeHtml(match.home_team)}</div>
          <div class="final-score text-glow">${escapeHtml(match.actual_home_score)} - ${escapeHtml(match.actual_away_score)}</div>
          <div class="team-name away">${escapeHtml(match.away_team)}</div>
        </div>

        <div class="match-meta">
          <p class="muted small">${escapeHtml(match.stage || 'Match')}${match.venue ? ' • ' + escapeHtml(match.venue) : ''}</p>
        </div>

        <div class="prediction-status">
          ${prediction
            ? `<div class="saved-badge ${won ? 'glow-success' : 'glass-muted'}">
                 Your pick: ${escapeHtml(prediction.home_score)} - ${escapeHtml(prediction.away_score)}
                 <span class="pts-pill">${pts.points} pt${pts.points === 1 ? '' : 's'}</span>
                 ${pts.label ? `<span class="pts-label">${escapeHtml(pts.label)}</span>` : ''}
               </div>`
            : `<div class="muted small glass-muted-badge">You didn't predict this match.</div>`
          }
        </div>

        <footer class="card-footer">
          <a class="glass-link ext-link" href="${googleSearchUrl(match)}" target="_blank" rel="noopener noreferrer">
            Google ↗
          </a>
        </footer>
      </article>
    `;
  }).join('')}</div>`;
}

/* ============================================================
   My Predictions view
   ============================================================ */

function renderMyPredictions(matches, predictions) {
  if (!matches.length) {
    return `
      <div class="glass-panel glass-empty-state glow-effect">
        <span class="emoji-large" aria-hidden="true">📝</span>
        <p class="text-glow">No matches yet — nothing to predict.</p>
      </div>
    `;
  }

  const sorted = [...matches].sort((a, b) => new Date(b.kickoff_at) - new Date(a.kickoff_at));
  const totalPoints = sorted.reduce((sum, m) => {
    const pred = predictions.find(p => p.match_id === m.id);
    return sum + scorePrediction(pred, m).points;
  }, 0);

  return `
    <section class="glass-panel list-panel glow-effect">
      <header class="panel-header">
        <div class="header-titles">
          <h2 class="text-glow">My Predictions</h2>
          <p class="muted small">Your latest prediction vs. actual result. Green = points won.</p>
        </div>
        <div class="glass-badge-total text-glow glow-success">
          ${totalPoints} pts total
        </div>
      </header>

      <div class="glass-table-wrapper">
        <div class="mp-header glass-th">
          <div class="col-match">Match</div>
          <div class="col-pick text-center">My Pick</div>
          <div class="col-actual text-center">Actual</div>
          <div class="col-pts text-right">Pts</div>
        </div>

        <div class="mp-list" role="list">
          ${sorted.map(match => {
            const pred = predictions.find(p => p.match_id === match.id);
            const pts = scorePrediction(pred, match);
            const isWon = matchHasResult(match) && pts.points > 0;
            const cls = matchHasResult(match) ? (isWon ? 'row-win glow-success-subtle' : 'row-loss') : 'row-pending';

            return `
              <div class="mp-row glass-row ${cls}" role="listitem">
                <div class="col-match">
                  <div class="matchup-text">${escapeHtml(match.home_team)} <span class="muted thin">vs</span> ${escapeHtml(match.away_team)}</div>
                  <div class="meta-text muted small">${formatDateShort(match.kickoff_at)} • ${escapeHtml(match.stage || '—')}</div>
                </div>
                <div class="col-pick text-center score-cell">
                  ${pred ? `<span class="glass-pill">${escapeHtml(pred.home_score)} - ${escapeHtml(pred.away_score)}</span>` : '<span class="muted">—</span>'}
                </div>
                <div class="col-actual text-center score-cell">
                  ${matchHasResult(match)
                    ? `<span class="glass-pill actual">${escapeHtml(match.actual_home_score)} - ${escapeHtml(match.actual_away_score)}</span>`
                    : '<span class="muted small pending-text">pending</span>'}
                </div>
                <div class="col-pts text-right pts-cell">
                  ${matchHasResult(match) ? `<strong class="${isWon ? 'text-glow-success' : ''}">${pts.points}</strong>` : '—'}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </section>
  `;
}

/* ============================================================
   Scoring helper
   ============================================================ */

function scorePrediction(prediction, match) {
  if (!prediction || !matchHasResult(match)) return { points: 0, label: '' };

  const ph = Number(prediction.home_score), pa = Number(prediction.away_score);
  const ah = Number(match.actual_home_score), aa = Number(match.actual_away_score);

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
    <section class="glass-panel table-panel glow-effect">
      <h2 class="text-glow text-center" style="margin-bottom: 24px;">Leaderboard</h2>
      <div class="glass-table-responsive">
        <table class="glass-table">
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Name</th>
              <th scope="col">Points</th>
              <th scope="col" class="hide-mobile">Exact</th>
              <th scope="col" class="hide-mobile">Correct Result</th>
              <th scope="col">Predictions</th>
            </tr>
          </thead>
          <tbody>
            ${(rows || []).map((row, index) => `
              <tr class="glass-tr glow-hover">
                <td class="rank-cell">
                  <span class="rank-badge ${index < 3 ? 'top-3-glow' : ''}">#${index + 1}</span>
                </td>
                <td class="name-cell">${escapeHtml(row.full_name || row.email)}</td>
                <td class="pts-cell"><strong class="text-glow">${escapeHtml(row.total_points)}</strong></td>
                <td class="hide-mobile">${escapeHtml(row.exact_scores)}</td>
                <td class="hide-mobile">${escapeHtml(row.correct_results)}</td>
                <td>${escapeHtml(row.predictions_count)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderLeaderboardError(message) {
  return `<div class="glass-panel glass-empty-state error-glow"><p class="message text-glow-red">${escapeHtml(message)}</p></div>`;
}

/* ============================================================
   Admin
   ============================================================ */

function renderAdminPanel(matches, scheduleUrl) {
  const selectedOptions = matches.map(match => `
    <option value="${escapeHtml(match.id)}">
      ${escapeHtml(match.home_team)} vs ${escapeHtml(match.away_team)} - ${escapeHtml(new Date(match.kickoff_at).toLocaleString())}
    </option>
  `).join('');

  return `
    <div class="admin-grid">
      <section class="glass-card admin-card glow-hover">
        <h2 class="text-glow">Sync World Cup Schedule</h2>
        <p class="muted small glass-desc">
          Pulls fixtures (and final scores once available) from the OpenFootball JSON schedule.
        </p>
        
        <div class="glass-form-group">
          <label for="scheduleUrl">Schedule JSON URL</label>
          <input class="liquid-input" id="scheduleUrl" value="${escapeHtml(scheduleUrl)}" />
        </div>

        <button class="glass-btn primary-glow w-full" onclick="syncScheduleFromInternet()">Sync Schedule from Internet</button>
      </section>

      <section class="glass-card admin-card glow-hover">
        <h2 class="text-glow">Add Match Manually</h2>
        
        <div class="glass-form-group"><label for="adminHome">Home Team</label><input class="liquid-input" id="adminHome" placeholder="Brazil" /></div>
        <div class="glass-form-group"><label for="adminAway">Away Team</label><input class="liquid-input" id="adminAway" placeholder="Germany" /></div>
        <div class="glass-form-group"><label for="adminStage">Stage</label><input class="liquid-input" id="adminStage" placeholder="Group A / Round of 16" /></div>
        <div class="glass-form-group"><label for="adminVenue">Venue</label><input class="liquid-input" id="adminVenue" placeholder="Stadium / City" /></div>
        <div class="glass-form-group"><label for="adminKickoff">Kickoff Date & Time</label><input class="liquid-input" id="adminKickoff" type="datetime-local" /></div>

        <button class="glass-btn secondary-glow w-full" onclick="addMatch()">Add Match</button>
      </section>

      <section class="glass-card admin-card glow-hover">
        <h2 class="text-glow">Enter Results / Lock Control</h2>

        <div class="glass-form-group">
          <label for="adminMatchSelect">Match</label>
          <div class="glass-select-wrapper">
            <select class="liquid-input" id="adminMatchSelect" onchange="fillAdminMatchForm()">
              ${selectedOptions}
            </select>
          </div>
        </div>

        <div class="glass-inline-row">
          <div class="glass-form-group">
            <label for="adminActualHome">Home Actual</label>
            <input class="liquid-input" id="adminActualHome" type="number" min="0" />
          </div>
          <div class="glass-form-group">
            <label for="adminActualAway">Away Actual</label>
            <input class="liquid-input" id="adminActualAway" type="number" min="0" />
          </div>
        </div>

        <div class="glass-checkbox-group">
          <label class="glass-checkbox-label"><input class="glass-checkbox" id="adminLock" type="checkbox" /> <span class="custom-check"></span> Manual lock</label>
          <label class="glass-checkbox-label"><input class="glass-checkbox" id="adminOverrideOpen" type="checkbox" /> <span class="custom-check"></span> Admin override</label>
        </div>

        <div class="glass-button-group">
          <button class="glass-btn success-glow" onclick="updateResult()">Update Match</button>
          <button class="glass-btn danger-glow" onclick="deleteSelectedMatch()">Delete Match</button>
        </div>
      </section>

      <section class="glass-card admin-card glow-hover">
        <h2 class="text-glow">Office Users / Export</h2>
        <button class="glass-btn tertiary-glow w-full" onclick="downloadPredictionsCsv()">
          Download Predictions CSV
        </button>
      </section>
    </div>
  `;
}
