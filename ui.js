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

function formatRelative(value) {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.round(diff / 60000);

  if (Math.abs(mins) < 1) return 'just now';
  if (mins > 0 && mins < 60) return `${mins} min ago`;
  if (mins < 0 && mins > -60) return `in ${-mins} min`;

  const hrs = Math.round(mins / 60);

  if (hrs > 0 && hrs < 24) return `${hrs}h ago`;
  if (hrs < 0 && hrs > -24) return `in ${-hrs}h`;

  return formatDateShort(value);
}

/* ============================================================
   Stage classification
   ============================================================ */

const STAGES = [
  { id: 'summary', label: 'Summary', emoji: '⚡' },
  { id: 'group', label: 'Group', emoji: '🌍' },
  { id: 'r32', label: 'R-32', emoji: '🏟️' },
  { id: 'r16', label: 'R-16', emoji: '🎯' },
  { id: 'qf', label: 'Quarter Final', emoji: '🔥' },
  { id: 'sf', label: 'Semi Final', emoji: '⭐' },
  { id: 'final', label: 'Final', emoji: '🏆' },
  { id: 'bonus', label: 'Bonus', emoji: '🎁' },
  { id: 'results', label: 'Full Time', emoji: '📊' }
];

function classifyStage(rawStage) {
  const s = String(rawStage || '').toLowerCase();

  if (!s) return 'group';
  if (s.startsWith('group')) return 'group';
  if (s.includes('round of 32') || s.includes('r32') || s.includes('round-of-32')) return 'r32';
  if (s.includes('round of 16') || s.includes('r16') || s.includes('round-of-16')) return 'r16';
  if (s.includes('quarter')) return 'qf';
  if (s.includes('semi')) return 'sf';
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

  return !matchHasResult(match) &&
    now >= kickoff &&
    now <= kickoff + 130 * 60 * 1000;
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

function matchNumberLabel(match) {
  return match.match_no ? `Match ${match.match_no}` : 'Match';
}

function sourceLabel(source) {
  if (!source) return '';

  const type = source.type === 'winner'
    ? 'Winner'
    : source.type === 'loser'
      ? 'Loser'
      : 'Team';

  return `${type} of Match ${source.match_no}`;
}

function firstTeamLabel(value, match) {
  if (value === 'home') return match?.home_team || 'Home team';
  if (value === 'away') return match?.away_team || 'Away team';
  if (value === 'none') return 'No goal / 0-0';
  return 'Not selected';
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

/* ============================================================
   Dropdown helper
   ============================================================ */

function selectedTempOption(value) {
  const clean = String(value || '').trim();

  if (!clean) return '';

  return `<option value="${escapeHtml(clean)}" selected>${escapeHtml(clean)}</option>`;
}

/* ============================================================
   Stage filter
   ============================================================ */

function renderStageFilter(activeStageId, counts) {
  return STAGES.map(stage => {
    const c = counts[stage.id] || 0;
    const showBadge = !['summary', 'bonus'].includes(stage.id);
    const badge = showBadge && c > 0 ? ` <span class="muted small">(${c})</span>` : '';

    return `
      <button data-stage="${stage.id}" class="${activeStageId === stage.id ? 'active' : ''}">
        ${stage.emoji} ${stage.label}${badge}
      </button>
    `;
  }).join('');
}

function computeStageCounts(matches) {
  const counts = {
    summary: 0,
    group: 0,
    r32: 0,
    r16: 0,
    qf: 0,
    sf: 0,
    final: 0,
    bonus: 1,
    results: 0
  };

  for (const match of matches) {
    const bucket = classifyStage(match.stage);

    counts[bucket] = (counts[bucket] || 0) + 1;

    if (matchHasResult(match)) counts.results += 1;
    if (isUpcoming(match)) counts.summary += 1;
  }

  return counts;
}

/* ============================================================
   Summary view
   ============================================================ */

function renderSummary(matches, predictions, userName) {
  const now = Date.now();

  const upcoming = matches
    .filter(match => new Date(match.kickoff_at).getTime() > now)
    .slice(0, 6);

  const live = matches.filter(isLive);
  const totalPredicted = predictions.length;
  const totalMatches = matches.length;

  const greeting = userName
    ? `Welcome back, ${escapeHtml(userName.split(' ')[0])} ⚽`
    : 'Welcome back ⚽';

  return `
    <article class="card summary-hero">
      <div class="date-badge">
        <span class="dot"></span>
        <span>${new Date().toLocaleDateString([], {
          weekday: 'long',
          month: 'long',
          day: 'numeric'
        })}</span>
      </div>

      <div class="hero-text">
        <h2>${greeting}</h2>
        <p class="muted">Here's the quick view across the tournament. Pick a stage above to start predicting.</p>
      </div>

      <div class="summary-quick">
        <div class="stat"><strong>${totalMatches}</strong><span>Total matches</span></div>
        <div class="stat"><strong>${upcoming.length}</strong><span>Upcoming</span></div>
        <div class="stat"><strong>${live.length}</strong><span>Live now</span></div>
        <div class="stat"><strong>${totalPredicted}</strong><span>Your predictions</span></div>
      </div>
    </article>

    ${live.length ? `
      <article class="card" style="padding:18px; margin-bottom:16px;">
        <h2>🔴 Live now</h2>
        <div class="next-up" style="margin-top:12px;">
          ${live.map(match => liveMiniCard(match)).join('')}
        </div>
      </article>
    ` : ''}

    <article class="card" style="padding:18px; margin-bottom:16px;">
      <h2>Next up</h2>
      <p class="muted small">The next ${Math.min(6, upcoming.length)} fixtures — click any to jump to its prediction card.</p>

      ${upcoming.length === 0
        ? `
          <div class="empty-state">
            <span class="emoji">🌴</span>
            <h3>All caught up</h3>
            <p>No upcoming matches scheduled.</p>
          </div>
        `
        : `
          <div class="next-up" style="margin-top:12px;">
            ${upcoming.map(nextUpCard).join('')}
          </div>
        `
      }
    </article>

    <article class="card bonus-summary-card">
      <div>
        <h2>🎁 Bonus Predictions</h2>
        <p class="muted small">
          Predict the tournament winner, best player, and finalists before the Super Admin locks bonus predictions.
        </p>
      </div>

      <button onclick="currentStage='bonus'; renderPredictionsRoot();" class="secondary">
        Open Bonus Predictions
      </button>
    </article>
  `;
}

function nextUpCard(match) {
  return `
    <div class="next-card" onclick="navigateToMatch('${match.id}')" data-match-id="${match.id}">
      <span class="stage-tag">${escapeHtml(matchNumberLabel(match))} · ${escapeHtml(match.stage || 'Match')}</span>
      <div class="matchup">
        ${escapeHtml(match.home_team)}
        <span class="muted">vs</span>
        ${escapeHtml(match.away_team)}
      </div>
      <div class="when">
        ${formatDate(match.kickoff_at)}${match.venue ? ' • ' + escapeHtml(match.venue) : ''}
      </div>
    </div>
  `;
}

function liveMiniCard(match) {
  return `
    <div class="next-card" onclick="navigateToMatch('${match.id}')" data-match-id="${match.id}">
      <span class="status-pill live">● LIVE</span>
      <div class="matchup">
        ${escapeHtml(match.home_team)}
        <span class="muted">vs</span>
        ${escapeHtml(match.away_team)}
      </div>
      <a class="ext-link" href="${googleSearchUrl(match)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">
        View live on Google ↗
      </a>
    </div>
  `;
}

/* ============================================================
   Match cards
   ============================================================ */

function renderMatchCards(matches, predictions, helpers, stageFilterId) {
  const { predictionFor, matchLocked, lockReason } = helpers;

  const filtered = matches.filter(match => classifyStage(match.stage) === stageFilterId);

  if (!filtered.length) {
    return `
      <div class="card empty-state">
        <span class="emoji">🗓️</span>
        <h3>No matches in this stage yet</h3>
        <p class="muted small">Super Admin can sync the schedule from the Super Admin tab.</p>
      </div>
    `;
  }

  return `
    <div class="view-grid">
      ${filtered.map(match => {
        const prediction = predictionFor(match.id);
        const locked = matchLocked(match);
        const live = isLive(match);
        const venue = match.venue ? ` • ${escapeHtml(match.venue)}` : '';

        const homeSource = sourceLabel(match.home_source);
        const awaySource = sourceLabel(match.away_source);

        const firstSelected = prediction?.first_team_to_score || '';

        const pill = live
          ? `<span class="status-pill live">● LIVE</span>`
          : locked
            ? `<span class="status-pill locked">🔒 Locked</span>`
            : `<span class="status-pill upcoming">🟢 Open</span>`;

        return `
          <article class="card match-card" id="match_${match.id}">
            <div class="match-top">
              <span>${match.match_no ? `M${match.match_no} · ` : ''}${formatDate(match.kickoff_at)}</span>
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

            ${(homeSource || awaySource) ? `
              <p class="muted small">
                ${homeSource ? escapeHtml(homeSource) : 'TBD'} vs ${awaySource ? escapeHtml(awaySource) : 'TBD'}
              </p>
            ` : ''}

            <p class="muted small">Status: ${lockReason(match)}</p>

            <div class="score-row">
              <input
                type="number"
                min="0"
                max="30"
                id="home_${match.id}"
                value="${prediction?.home_score ?? ''}"
                ${locked ? 'disabled' : ''}
                placeholder="${escapeHtml(match.home_team)}"
              />
              <input
                type="number"
                min="0"
                max="30"
                id="away_${match.id}"
                value="${prediction?.away_score ?? ''}"
                ${locked ? 'disabled' : ''}
                placeholder="${escapeHtml(match.away_team)}"
              />
            </div>

            <div class="card" style="padding:12px; box-shadow:none; margin-top:4px;">
              <p class="muted small" style="margin:0 0 8px;">
                First team to score <strong>(+1 point)</strong>
              </p>

              <label style="margin:6px 0;">
                <input
                  type="radio"
                  name="first_${match.id}"
                  value="home"
                  style="width:auto"
                  ${firstSelected === 'home' ? 'checked' : ''}
                  ${locked ? 'disabled' : ''}
                />
                ${escapeHtml(match.home_team)}
              </label>

              <label style="margin:6px 0;">
                <input
                  type="radio"
                  name="first_${match.id}"
                  value="away"
                  style="width:auto"
                  ${firstSelected === 'away' ? 'checked' : ''}
                  ${locked ? 'disabled' : ''}
                />
                ${escapeHtml(match.away_team)}
              </label>

              <label style="margin:6px 0;">
                <input
                  type="radio"
                  name="first_${match.id}"
                  value="none"
                  style="width:auto"
                  ${firstSelected === 'none' ? 'checked' : ''}
                  ${locked ? 'disabled' : ''}
                />
                No goal / 0-0
              </label>
            </div>

            <button onclick="savePrediction('${match.id}')" ${locked ? 'disabled' : ''}>
              ${prediction ? 'Update Prediction' : 'Save Prediction'}
            </button>

            <p class="muted small">
              Unlimited updates until kickoff — your last saved prediction counts.
            </p>

            ${prediction
              ? `
                <p class="saved">
                  Latest: ${prediction.home_score} - ${prediction.away_score}
                  · First scorer: ${escapeHtml(firstTeamLabel(prediction.first_team_to_score, match))}
                </p>
              `
              : `<p class="muted small">No prediction saved yet.</p>`
            }

            <a class="ext-link" href="${googleSearchUrl(match)}" target="_blank" rel="noopener">
              View on Google ↗
            </a>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

/* ============================================================
   Bonus Predictions
   ============================================================ */

function renderBonusPredictions(bonusPrediction, bonusResult, currentProfile, bonusOptions = {}) {
  const locked = !!bonusResult?.is_locked;

  return `
    <div class="card admin-card">
      <h2>🎁 Bonus Predictions</h2>
      <p class="muted small">
        These are tournament-level predictions. They can be edited until the Super Admin locks the bonus page.
      </p>

      <div class="rules-grid" style="margin-bottom:16px;">
        <div>
          <strong>10 pts</strong>
          <span>Tournament winner</span>
        </div>
        <div>
          <strong>10 pts</strong>
          <span>Best player</span>
        </div>
        <div>
          <strong>5 pts</strong>
          <span>Each correct finalist</span>
        </div>
      </div>

      <p class="${locked ? 'message' : 'saved'}">
        ${locked ? 'Bonus predictions are locked.' : 'Bonus predictions are open.'}
      </p>
    </div>

    <div class="card admin-card" style="margin-top:16px;">
      <h2>Your Bonus Picks</h2>

      <label>Tournament Winner</label>
      <select id="bonusTournamentWinner" ${locked ? 'disabled' : ''}>
        <option value="">Select tournament winner</option>
        ${selectedTempOption(bonusPrediction?.tournament_winner)}
      </select>

      <label>Tournament Best Player</label>
      <select id="bonusBestPlayer" ${locked ? 'disabled' : ''}>
        <option value="">Select best player</option>
        ${selectedTempOption(bonusPrediction?.best_player)}
      </select>

      <div class="inline-row">
        <div>
          <label>Finalist 1</label>
          <select id="bonusFinalistOne" ${locked ? 'disabled' : ''}>
            <option value="">Select finalist 1</option>
            ${selectedTempOption(bonusPrediction?.finalist_one)}
          </select>
        </div>

        <div>
          <label>Finalist 2</label>
          <select id="bonusFinalistTwo" ${locked ? 'disabled' : ''}>
            <option value="">Select finalist 2</option>
            ${selectedTempOption(bonusPrediction?.finalist_two)}
          </select>
        </div>
      </div>

      <button onclick="saveBonusPrediction()" ${locked ? 'disabled' : ''}>
        ${bonusPrediction ? 'Update Bonus Predictions' : 'Save Bonus Predictions'}
      </button>

      ${bonusPrediction?.updated_at
        ? `<p class="muted small">Last updated: ${new Date(bonusPrediction.updated_at).toLocaleString()}</p>`
        : `<p class="muted small">No bonus prediction saved yet.</p>`
      }
    </div>
  `;
}

/* ============================================================
   Full Time view
   ============================================================ */

function renderResultsMatches(matches, predictions) {
  const done = matches
    .filter(matchHasResult)
    .sort((a, b) => new Date(b.kickoff_at) - new Date(a.kickoff_at));

  if (!done.length) {
    return `
      <div class="card empty-state">
        <span class="emoji">📭</span>
        <h3>No final scores yet</h3>
        <p class="muted small">Completed matches will show up here as the tournament progresses.</p>
      </div>
    `;
  }

  return `
    <div class="view-grid">
      ${done.map(match => {
        const prediction = predictions.find(item => item.match_id === match.id);
        const pts = scorePrediction(prediction, match);
        const won = pts.points > 0;

        return `
          <article class="card match-card" id="match_${match.id}">
            <div class="match-top">
              <span>${match.match_no ? `M${match.match_no} · ` : ''}${formatDate(match.kickoff_at)}</span>
              <span class="status-pill done">📊 Full Time</span>
            </div>

            <div class="teams">
              <div class="team-name home">${escapeHtml(match.home_team)}</div>
              <div class="vs">
                <span style="font-size:22px; font-weight:900; color: var(--text);">
                  ${match.actual_home_score} - ${match.actual_away_score}
                </span>
              </div>
              <div class="team-name away">${escapeHtml(match.away_team)}</div>
            </div>

            <p class="muted small">
              ${escapeHtml(match.stage || 'Match')}${match.venue ? ' • ' + escapeHtml(match.venue) : ''}
            </p>

            <p class="muted small">
              First team to score:
              <strong>${escapeHtml(firstTeamLabel(match.actual_first_team_to_score, match))}</strong>
            </p>

            ${prediction
              ? `
                <p class="${won ? 'saved' : 'muted'}">
                  Your pick: ${prediction.home_score} - ${prediction.away_score}
                  · First scorer: ${escapeHtml(firstTeamLabel(prediction.first_team_to_score, match))}
                  • <strong>${pts.points} pt${pts.points === 1 ? '' : 's'}</strong>
                  ${pts.label ? `· ${pts.label}` : ''}
                </p>
              `
              : `<p class="muted small">You didn't predict this match.</p>`
            }

            <a class="ext-link" href="${googleSearchUrl(match)}" target="_blank" rel="noopener">
              View on Google ↗
            </a>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

/* ============================================================
   My Predictions
   ============================================================ */

function renderMyPredictions(matches, predictions) {
  if (!predictions.length) {
    return `
      <div class="card empty-state">
        <span class="emoji">📝</span>
        <h3>No predictions yet</h3>
        <p class="muted small">Head to the Predictions tab and pick some scores to get started.</p>
      </div>
    `;
  }

  const rows = predictions
    .map(pred => ({
      pred,
      match: matches.find(match => match.id === pred.match_id)
    }))
    .filter(row => row.match)
    .sort((a, b) => new Date(b.pred.updated_at) - new Date(a.pred.updated_at));

  let totalPoints = 0;
  let hits = 0;
  let played = 0;

  for (const { pred, match } of rows) {
    if (matchHasResult(match)) {
      played += 1;

      const score = scorePrediction(pred, match);

      totalPoints += score.points;

      if (score.points > 0) hits += 1;
    }
  }

  const accuracy = played ? Math.round((hits / played) * 100) : 0;

  return `
    <div class="card mp-card">
      <div class="mp-head">
        <div>
          <h2>My Predictions</h2>
          <p class="muted small">Your latest pick for every match, newest first. Green = points earned · Red = missed.</p>
        </div>
      </div>

      <div class="mp-summary">
        <div class="stat"><strong>${totalPoints}</strong><span>Match points</span></div>
        <div class="stat"><strong>${predictions.length}</strong><span>Predictions</span></div>
        <div class="stat"><strong>${played}</strong><span>Settled</span></div>
        <div class="stat"><strong>${accuracy}%</strong><span>Hit rate</span></div>
      </div>

      <div class="mp-header-row">
        <div>Match</div>
        <div class="center">My Pick</div>
        <div class="center">Actual</div>
        <div class="center pts-col">Points</div>
      </div>

      <div class="mp-list">
        ${rows.map(({ pred, match }) => {
          const pts = scorePrediction(pred, match);
          const cls = matchHasResult(match)
            ? pts.points > 0 ? 'win' : 'loss'
            : '';

          return `
            <div class="mp-row ${cls}">
              <div>
                <div class="matchup">
                  ${match.match_no ? `M${match.match_no} · ` : ''}
                  ${escapeHtml(match.home_team)}
                  <span class="muted">vs</span>
                  ${escapeHtml(match.away_team)}
                </div>
                <div class="meta">
                  ${formatDateShort(match.kickoff_at)}
                  • ${escapeHtml(match.stage || '—')}
                  · saved ${formatRelative(pred.updated_at)}
                  · First scorer: ${escapeHtml(firstTeamLabel(pred.first_team_to_score, match))}
                </div>
              </div>

              <div class="score-cell">${pred.home_score} - ${pred.away_score}</div>

              <div class="score-cell">
                ${matchHasResult(match)
                  ? `${match.actual_home_score} - ${match.actual_away_score}`
                  : '<span class="muted small">pending</span>'
                }
              </div>

              <div class="pts">
                <span class="badge-pts">${matchHasResult(match) ? pts.points : '—'}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/* ============================================================
   Scoring helper
   Exact score = 5
   Correct winner / correct draw = 2
   First team to score = 1
   Maximum per match = 8
   ============================================================ */

function scorePrediction(prediction, match) {
  if (!prediction || !matchHasResult(match)) {
    return { points: 0, label: '' };
  }

  const ph = Number(prediction.home_score);
  const pa = Number(prediction.away_score);
  const ah = Number(match.actual_home_score);
  const aa = Number(match.actual_away_score);

  let points = 0;
  const labels = [];

  const predResult = Math.sign(ph - pa);
  const actualResult = Math.sign(ah - aa);

  if (ph === ah && pa === aa) {
    points += 5;
    labels.push('Exact score');
  }

  if (predResult === actualResult) {
    points += 2;
    labels.push('Correct result');
  }

  if (
    prediction.first_team_to_score &&
    match.actual_first_team_to_score &&
    match.actual_first_team_to_score !== 'none' &&
    prediction.first_team_to_score === match.actual_first_team_to_score
  ) {
    points += 1;
    labels.push('First scorer');
  }

  return {
    points,
    label: labels.join(' + ')
  };
}

/* ============================================================
   Leaderboard
   ============================================================ */

function renderLeaderboardTable(rows) {
  return `
    <div class="card table-card">
      <h2>Leaderboard</h2>
      <p class="muted small">
        Total points include match points and bonus points.
      </p>

      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Total</th>
            <th>Match</th>
            <th>Bonus</th>
            <th>Exact</th>
            <th>Result</th>
            <th>First Score</th>
            <th>Picks</th>
          </tr>
        </thead>

        <tbody>
          ${(rows || []).map((row, index) => `
            <tr>
              <td><span class="rank">${index + 1}</span></td>
              <td>${escapeHtml(row.full_name || row.email)}</td>
              <td><span class="points-pill">${row.total_points ?? 0}</span></td>
              <td>${row.match_points ?? 0}</td>
              <td>${row.bonus_points ?? 0}</td>
              <td>${row.exact_scores ?? 0}</td>
              <td>${row.correct_results ?? 0}</td>
              <td>${row.correct_first_scores ?? 0}</td>
              <td>${row.predictions_count ?? 0}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderLeaderboardError(message) {
  return `
    <div class="card table-card">
      <p class="message">${escapeHtml(message)}</p>
    </div>
  `;
}

/* ============================================================
   Admin Review Page Shell
   ============================================================ */

function renderAdminPageShell(activeView) {
  return `
    <div class="card admin-card">
      <h2>Admin Review</h2>
      <p class="muted small">
        Review match predictions, user histories, and bonus predictions.
      </p>

      <div class="stage-filter card" style="margin-top:14px;">
        <button class="${activeView === 'matches' ? 'active' : ''}" onclick="switchAdminView('matches')">
          ⚽ Match Predictions
        </button>
        <button class="${activeView === 'bonus' ? 'active' : ''}" onclick="switchAdminView('bonus')">
          🎁 Bonus Predictions
        </button>
      </div>
    </div>

    <div id="adminInnerContent" style="margin-top:16px;"></div>
  `;
}

/* ============================================================
   Admin Review Page
   Limited Admin + Super Admin
   ============================================================ */

function renderAdminReviewPage(matches) {
  const sortedMatches = [...matches].sort((a, b) => {
    const aTime = new Date(a.kickoff_at).getTime();
    const bTime = new Date(b.kickoff_at).getTime();

    return aTime - bTime;
  });

  return `
    <div class="card admin-card">
      <h2>Admin Match Review</h2>
      <p class="muted small">
        Select a match to view each user’s latest prediction, first-team-to-score pick, and points earned.
      </p>
    </div>

    <div class="view-grid" style="margin-top:16px;">
      ${sortedMatches.map(match => `
        <article class="card match-card" onclick="openAdminMatchReview('${match.id}')" style="cursor:pointer;">
          <div class="match-top">
            <span>${match.match_no ? `M${match.match_no} · ` : ''}${formatDate(match.kickoff_at)}</span>
            <span class="status-pill ${matchHasResult(match) ? 'done' : isLive(match) ? 'live' : isUpcoming(match) ? 'upcoming' : 'locked'}">
              ${matchHasResult(match)
                ? 'Result entered'
                : isLive(match)
                  ? '● LIVE'
                  : isUpcoming(match)
                    ? 'Upcoming'
                    : 'Awaiting result'
              }
            </span>
          </div>

          <div class="teams">
            <div class="team-name">${escapeHtml(match.home_team)}</div>
            <div class="vs">vs</div>
            <div class="team-name">${escapeHtml(match.away_team)}</div>
          </div>

          <p class="muted small">
            ${escapeHtml(match.stage || 'Match')}${match.venue ? ' • ' + escapeHtml(match.venue) : ''}
          </p>

          <p class="${matchHasResult(match) ? 'saved' : 'muted'}">
            ${matchHasResult(match)
              ? `Result: ${match.actual_home_score} - ${match.actual_away_score}`
              : 'Result pending'
            }
          </p>

          <p class="muted small">
            First scorer: ${escapeHtml(firstTeamLabel(match.actual_first_team_to_score, match))}
          </p>

          <p class="muted small">Click to review predictions</p>
        </article>
      `).join('')}
    </div>
  `;
}

function renderAdminMatchReview(match, rows) {
  if (!match) {
    return `
      <div class="card admin-card">
        <h2>Match not found</h2>
        <button onclick="backToAdminMatches()">Back</button>
      </div>
    `;
  }

  return `
    <div class="card admin-card">
      <button class="secondary" onclick="backToAdminMatches()">← Back to Matches</button>

      <h2 style="margin-top:14px;">
        ${match.match_no ? `Match ${match.match_no}: ` : ''}
        ${escapeHtml(match.home_team)} vs ${escapeHtml(match.away_team)}
      </h2>

      <p class="muted small">
        ${escapeHtml(match.stage || 'Match')} · ${formatDate(match.kickoff_at)}
        ${match.venue ? ' · ' + escapeHtml(match.venue) : ''}
      </p>

      <p class="${matchHasResult(match) ? 'saved' : 'muted'}">
        ${matchHasResult(match)
          ? `Final Result: ${match.actual_home_score} - ${match.actual_away_score}`
          : 'Final Result: Pending'
        }
      </p>

      <p class="muted small">
        Actual first scorer: <strong>${escapeHtml(firstTeamLabel(match.actual_first_team_to_score, match))}</strong>
      </p>
    </div>

    <div class="card table-card" style="margin-top:16px;">
      <h2>User Predictions</h2>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Score Pick</th>
            <th>First Scorer Pick</th>
            <th>Result Points</th>
            <th>First Score</th>
            <th>Total</th>
            <th>Last Updated</th>
            <th>History</th>
          </tr>
        </thead>

        <tbody>
          ${
            rows.length
              ? rows.map(row => `
                <tr>
                  <td>${escapeHtml(row.full_name || row.email)}</td>
                  <td>${row.home_score} - ${row.away_score}</td>
                  <td>${escapeHtml(firstTeamLabel(row.first_team_to_score, match))}</td>
                  <td>${row.result_points ?? 0}</td>
                  <td>${row.first_score_points ?? 0}</td>
                  <td><span class="points-pill">${row.match_points ?? 0}</span></td>
                  <td>${new Date(row.updated_at).toLocaleString()}</td>
                  <td>
                    <button class="secondary" onclick="openUserPredictionHistory('${row.user_id}', '${row.match_id}')">
                      View
                    </button>
                  </td>
                </tr>
              `).join('')
              : `
                <tr>
                  <td colspan="8" class="muted">
                    No predictions submitted for this match yet.
                  </td>
                </tr>
              `
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderUserPredictionHistory(match, rows) {
  const title = match
    ? `${escapeHtml(match.home_team)} vs ${escapeHtml(match.away_team)}`
    : 'Prediction History';

  const userName = rows[0]?.full_name || rows[0]?.email || 'User';
  const matchId = match?.id || rows[0]?.match_id || '';

  return `
    <div class="card admin-card">
      <button class="secondary" onclick="openAdminMatchReview('${matchId}')">
        ← Back to Match Review
      </button>

      <h2 style="margin-top:14px;">${title}</h2>
      <p class="muted small">Prediction history for ${escapeHtml(userName)}</p>
    </div>

    <div class="card table-card" style="margin-top:16px;">
      <h2>All Prediction Changes</h2>

      <table>
        <thead>
          <tr>
            <th>Date / Time</th>
            <th>Prediction</th>
            <th>First Scorer</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          ${
            rows.length
              ? rows.map(row => `
                <tr>
                  <td>${new Date(row.created_at).toLocaleString()}</td>
                  <td>${row.home_score} - ${row.away_score}</td>
                  <td>${escapeHtml(firstTeamLabel(row.first_team_to_score, match))}</td>
                  <td>${escapeHtml(row.action)}</td>
                </tr>
              `).join('')
              : `
                <tr>
                  <td colspan="4" class="muted">
                    No history available. History is tracked only after the audit table was added.
                  </td>
                </tr>
              `
          }
        </tbody>
      </table>
    </div>
  `;
}

/* ============================================================
   Admin Bonus Review
   ============================================================ */

function renderAdminBonusPredictionReview(rows) {
  return `
    <div class="card table-card">
      <h2>Bonus Predictions</h2>
      <p class="muted small">
        Review tournament winner, best player, finalists, and bonus points.
      </p>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Winner</th>
            <th>Best Player</th>
            <th>Finalist 1</th>
            <th>Finalist 2</th>
            <th>Bonus Points</th>
            <th>Updated</th>
          </tr>
        </thead>

        <tbody>
          ${
            rows.length
              ? rows.map(row => `
                <tr>
                  <td>${escapeHtml(row.full_name || row.email)}</td>
                  <td>${escapeHtml(row.tournament_winner || '—')}</td>
                  <td>${escapeHtml(row.best_player || '—')}</td>
                  <td>${escapeHtml(row.finalist_one || '—')}</td>
                  <td>${escapeHtml(row.finalist_two || '—')}</td>
                  <td><span class="points-pill">${row.bonus_points ?? 0}</span></td>
                  <td>${row.updated_at ? new Date(row.updated_at).toLocaleString() : '—'}</td>
                </tr>
              `).join('')
              : `
                <tr>
                  <td colspan="7" class="muted">
                    No bonus predictions submitted yet.
                  </td>
                </tr>
              `
          }
        </tbody>
      </table>
    </div>
  `;
}

/* ============================================================
   Super Admin Panel
   Full controls only for Super Admin
   ============================================================ */

function renderSuperAdminPanel(matches, scheduleUrl, bonusResult, bonusOptions = {}) {
  const selectedOptions = matches.map(match => `
    <option value="${match.id}">
      ${match.match_no ? `M${match.match_no} - ` : ''}
      ${escapeHtml(match.home_team)} vs ${escapeHtml(match.away_team)} - ${formatDate(match.kickoff_at)}
    </option>
  `).join('');

  return `
    <div class="admin-grid">
      <div class="card admin-card">
        <h2>Sync FIFA Schedule & Scores</h2>
        <p class="muted small">
          Pulls fixtures from the local FIFA 2026 portal schedule JSON file.
          If final scores are included in the JSON later, the portal can sync them too.
        </p>

        <label>Schedule JSON URL</label>
        <input id="scheduleUrl" value="${escapeHtml(scheduleUrl)}" />

        <button onclick="syncScheduleFromInternet()">Sync Schedule & Scores Now</button>

        <button onclick="replaceMatchesWithScheduleIfNoPredictions()" class="secondary">
          Replace Old Matches With Schedule
        </button>

        <p class="muted small">
          Sync preserves predictions. Replace deletes old matches only if no predictions exist.
        </p>
      </div>

      <div class="card admin-card">
        <h2>Add Match Manually</h2>

        <label>Match Number</label>
        <input id="adminMatchNo" type="number" min="1" max="104" placeholder="1 to 104" />

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
        <h2>Results / Lock Control</h2>

        <label>Match</label>
        <select id="adminMatchSelect" onchange="fillAdminMatchForm()">
          ${selectedOptions}
        </select>

        <p id="adminResultSource" class="muted small">Result source: —</p>

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

        <label>First Team to Score</label>
        <select id="adminFirstTeamToScore">
          <option value="">Not selected</option>
          <option value="home">Home team</option>
          <option value="away">Away team</option>
          <option value="none">No goal / 0-0</option>
        </select>

        <label>
          <input id="adminLock" type="checkbox" style="width:auto" />
          Manual lock
        </label>

        <label>
          <input id="adminOverrideOpen" type="checkbox" style="width:auto" />
          Super Admin override: keep predictions open even after kickoff
        </label>

        <label>
          <input id="adminResultOverride" type="checkbox" style="width:auto" />
          Protect this score from auto-sync
        </label>

        <button onclick="updateResult()">Update Match</button>
        <button onclick="deleteSelectedMatch()" class="danger">Delete Match</button>

        <p class="muted small">
          For knockout matches, when a match result is entered, the portal will try to push the winner or loser
          into the next linked match using the match number source fields.
        </p>
      </div>

      <div class="card admin-card">
        <h2>Bonus Prediction Control</h2>
        <p class="muted small">
          Lock bonus predictions and enter final bonus results after the tournament.
        </p>

        <label>
          <input id="bonusLock" type="checkbox" style="width:auto" ${bonusResult?.is_locked ? 'checked' : ''} />
          Lock bonus predictions
        </label>

        <label>Actual Tournament Winner</label>
        <select id="actualTournamentWinner">
          <option value="">Select actual tournament winner</option>
          ${selectedTempOption(bonusResult?.actual_tournament_winner)}
        </select>

        <label>Actual Best Player</label>
        <select id="actualBestPlayer">
          <option value="">Select actual best player</option>
          ${selectedTempOption(bonusResult?.actual_best_player)}
        </select>

        <div class="inline-row">
          <div>
            <label>Actual Finalist 1</label>
            <select id="actualFinalistOne">
              <option value="">Select actual finalist 1</option>
              ${selectedTempOption(bonusResult?.actual_finalist_one)}
            </select>
          </div>

          <div>
            <label>Actual Finalist 2</label>
            <select id="actualFinalistTwo">
              <option value="">Select actual finalist 2</option>
              ${selectedTempOption(bonusResult?.actual_finalist_two)}
            </select>
          </div>
        </div>

        <button onclick="updateBonusResults()">Update Bonus Settings</button>

        <p class="muted small">
          Finalist points are order-free. Each correct finalist gives 5 points, maximum 10.
        </p>
      </div>

      <div class="card admin-card">
        <h2>Office Users / Export</h2>
        <p class="muted small">
          Add approved users and roles in Supabase SQL.
          Use <strong>admin</strong> for limited review access and <strong>super_admin</strong> for full controls.
        </p>

        <button onclick="downloadPredictionsCsv()" class="secondary">
          Download Visible Predictions CSV
        </button>
      </div>
    </div>
  `;
}

/* Backward compatibility.
   If any old code still calls renderAdminPanel, show Super Admin panel. */
function renderAdminPanel(matches, scheduleUrl) {
  return renderSuperAdminPanel(matches, scheduleUrl, null);
}
