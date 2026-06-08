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
   Country flags
   ============================================================ */

const TEAM_FLAGS = {
  Algeria: '🇩🇿',
  Argentina: '🇦🇷',
  Australia: '🇦🇺',
  Austria: '🇦🇹',
  Belgium: '🇧🇪',
  'Bosnia and Herzegovina': '🇧🇦',
  Brazil: '🇧🇷',
  Canada: '🇨🇦',
  'Cape Verde': '🇨🇻',
  Colombia: '🇨🇴',
  Croatia: '🇭🇷',
  Curaçao: '🇨🇼',
  Czechia: '🇨🇿',
  Denmark: '🇩🇰',
  'DR Congo': '🇨🇩',
  Ecuador: '🇪🇨',
  Egypt: '🇪🇬',
  England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  France: '🇫🇷',
  Germany: '🇩🇪',
  Ghana: '🇬🇭',
  Haiti: '🇭🇹',
  Iran: '🇮🇷',
  Iraq: '🇮🇶',
  Italy: '🇮🇹',
  'Ivory Coast': '🇨🇮',
  Japan: '🇯🇵',
  Jordan: '🇯🇴',
  Mexico: '🇲🇽',
  Morocco: '🇲🇦',
  Netherlands: '🇳🇱',
  'New Zealand': '🇳🇿',
  Norway: '🇳🇴',
  Panama: '🇵🇦',
  Paraguay: '🇵🇾',
  Portugal: '🇵🇹',
  Qatar: '🇶🇦',
  'Saudi Arabia': '🇸🇦',
  Scotland: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  Senegal: '🇸🇳',
  'South Africa': '🇿🇦',
  'South Korea': '🇰🇷',
  Spain: '🇪🇸',
  Sweden: '🇸🇪',
  Switzerland: '🇨🇭',
  Tunisia: '🇹🇳',
  Türkiye: '🇹🇷',
  Turkey: '🇹🇷',
  Uruguay: '🇺🇾',
  USA: '🇺🇸',
  'United States': '🇺🇸',
  Uzbekistan: '🇺🇿',
  TBD: '🏳️'
};

function teamFlag(teamName) {
  const clean = String(teamName || '').trim();

  if (!clean) return '🏳️';

  return TEAM_FLAGS[clean] || '🏳️';
}

function teamWithFlag(teamName) {
  return `
    <span class="team-flag-row">
      <span class="team-flag small">${teamFlag(teamName)}</span>
      <span>${escapeHtml(teamName || 'TBD')}</span>
    </span>
  `;
}

function teamBlock(teamName) {
  return `
    <div class="team-wrap">
      <div class="team-name">${escapeHtml(teamName || 'TBD')}</div>
      <div class="team-flag">${teamFlag(teamName)}</div>
    </div>
  `;
}

function supportBadge(teamName) {
  if (!teamName) return '';

  return `
    <span class="support-team-badge" title="${escapeHtml(teamName)}">
      <span>${teamFlag(teamName)}</span>
      <span>${escapeHtml(teamName)}</span>
    </span>
  `;
}

/* ============================================================
   Stage classification
   ============================================================ */

const STAGES = [
  { id: 'summary', label: 'Summary', emoji: '⚡' },
  { id: 'group', label: 'Group', emoji: '🌍' },
  { id: 'r32', label: 'Round Of 32', emoji: '🏟️' },
  { id: 'r16', label: 'Round Of 16', emoji: '🎯' },
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

  const winner = actualWinner(match);

  if (
    match.actual_home_score === match.actual_away_score &&
    winner &&
    winner !== 'draw'
  ) {
    return `Result: ${match.actual_home_score} - ${match.actual_away_score} · Winner: ${winnerLabel(winner, match)}`;
  }

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

function winnerLabel(value, match) {
  if (value === 'home') return match?.home_team || 'Home team';
  if (value === 'away') return match?.away_team || 'Away team';
  if (value === 'draw') return 'Draw';
  return 'Not selected';
}

function actualWinner(match) {
  if (!matchHasResult(match)) return null;

  if (
    match.actual_winner === 'home' ||
    match.actual_winner === 'away' ||
    match.actual_winner === 'draw'
  ) {
    return match.actual_winner;
  }

  if (match.actual_winner_override === 'home' || match.actual_winner_override === 'away' || match.actual_winner_override === 'draw') {
    return match.actual_winner_override;
  }

  const home = Number(match.actual_home_score);
  const away = Number(match.actual_away_score);

  if (home > away) return 'home';
  if (away > home) return 'away';
  return 'draw';
}

function predictedWinnerFromScore(prediction) {
  if (!prediction) return null;

  const home = Number(prediction.home_score);
  const away = Number(prediction.away_score);

  if (home > away) return 'home';
  if (away > home) return 'away';
  return 'draw';
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function sortStageMatches(matches) {
  return [...matches].sort((a, b) => {
    const aDone = matchHasResult(a);
    const bDone = matchHasResult(b);

    if (aDone !== bDone) return aDone ? 1 : -1;

    const aTime = new Date(a.kickoff_at).getTime();
    const bTime = new Date(b.kickoff_at).getTime();

    if (aDone && bDone) return bTime - aTime;

    return aTime - bTime;
  });
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
        ${teamWithFlag(match.home_team)}
        <span class="muted">vs</span>
        ${teamWithFlag(match.away_team)}
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
        ${teamWithFlag(match.home_team)}
        <span class="muted">vs</span>
        ${teamWithFlag(match.away_team)}
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

  const filtered = sortStageMatches(
    matches.filter(match => classifyStage(match.stage) === stageFilterId)
  );

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
        const winnerSelected =
          prediction?.who_will_win ||
          (prediction ? predictedWinnerFromScore(prediction) : '');

        const pill = matchHasResult(match)
          ? `<span class="status-pill done">📊 Full Time</span>`
          : live
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
              ${teamBlock(match.home_team)}
              <div class="vs">vs</div>
              ${teamBlock(match.away_team)}
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

            <div class="first-score-box">
              <div class="first-score-title">First team to score / No goal (+1 point)</div>

              <div class="first-score-options">
                <label class="first-score-option">
                  <input
                    type="radio"
                    name="first_${match.id}"
                    value="home"
                    ${firstSelected === 'home' ? 'checked' : ''}
                    ${locked ? 'disabled' : ''}
                  />
                  <span>${teamFlag(match.home_team)} ${escapeHtml(match.home_team)}</span>
                </label>

                <label class="first-score-option">
                  <input
                    type="radio"
                    name="first_${match.id}"
                    value="away"
                    ${firstSelected === 'away' ? 'checked' : ''}
                    ${locked ? 'disabled' : ''}
                  />
                  <span>${teamFlag(match.away_team)} ${escapeHtml(match.away_team)}</span>
                </label>

                <label class="first-score-option">
                  <input
                    type="radio"
                    name="first_${match.id}"
                    value="none"
                    ${firstSelected === 'none' ? 'checked' : ''}
                    ${locked ? 'disabled' : ''}
                  />
                  <span>🚫 No goal / 0-0</span>
                </label>
              </div>
            </div>

            <div class="who-win-box">
              <div class="who-win-title">Who will win / advance? (+1 point)</div>

              <div class="who-win-options">
                <label class="who-win-option">
                  <input
                    type="radio"
                    name="winner_${match.id}"
                    value="home"
                    ${winnerSelected === 'home' ? 'checked' : ''}
                    ${locked ? 'disabled' : ''}
                  />
                  <span>${teamFlag(match.home_team)} ${escapeHtml(match.home_team)}</span>
                </label>

                <label class="who-win-option">
                  <input
                    type="radio"
                    name="winner_${match.id}"
                    value="away"
                    ${winnerSelected === 'away' ? 'checked' : ''}
                    ${locked ? 'disabled' : ''}
                  />
                  <span>${teamFlag(match.away_team)} ${escapeHtml(match.away_team)}</span>
                </label>

                <label class="who-win-option">
                  <input
                    type="radio"
                    name="winner_${match.id}"
                    value="draw"
                    ${winnerSelected === 'draw' ? 'checked' : ''}
                    ${locked ? 'disabled' : ''}
                  />
                  <span>Draw</span>
                </label>
              </div>

              <div class="who-win-note">
                For knockout matches, choose the team you think will advance. Choose Draw only if the match is not decided by penalties.
              </div>
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
                  · Winner: ${escapeHtml(winnerLabel(winnerSelected, match))}
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

    <div class="card bonus-card" style="margin-top:16px;">
      <div class="bonus-head">
        <div>
          <h2>Your Bonus Picks</h2>
          <p class="muted small">Choose from the dropdowns. Finalist 1 and Finalist 2 cannot be the same team.</p>
        </div>
      </div>

      <div class="bonus-grid">
        <div class="bonus-field">
          <label>Tournament Winner</label>
          <select id="bonusTournamentWinner" ${locked ? 'disabled' : ''}>
            <option value="">Select tournament winner</option>
            ${selectedTempOption(bonusPrediction?.tournament_winner)}
          </select>
        </div>

        <div class="bonus-field">
          <label>Tournament Best Player</label>
          <select id="bonusBestPlayer" ${locked ? 'disabled' : ''}>
            <option value="">Select best player</option>
            ${selectedTempOption(bonusPrediction?.best_player)}
          </select>
        </div>

        <div class="bonus-field">
          <label>Finalist 1</label>
          <select id="bonusFinalistOne" ${locked ? 'disabled' : ''}>
            <option value="">Select finalist 1</option>
            ${selectedTempOption(bonusPrediction?.finalist_one)}
          </select>
        </div>

        <div class="bonus-field">
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
        const actualResult = actualWinner(match);

        return `
          <article class="card match-card" id="match_${match.id}">
            <div class="match-top">
              <span>${match.match_no ? `M${match.match_no} · ` : ''}${formatDate(match.kickoff_at)}</span>
              <span class="status-pill done">📊 Full Time</span>
            </div>

            <div class="teams">
              ${teamBlock(match.home_team)}
              <div class="vs">
                <span style="font-size:22px; font-weight:900; color: var(--text);">
                  ${match.actual_home_score} - ${match.actual_away_score}
                </span>
              </div>
              ${teamBlock(match.away_team)}
            </div>

            <p class="muted small">
              ${escapeHtml(match.stage || 'Match')}${match.venue ? ' • ' + escapeHtml(match.venue) : ''}
            </p>

            <p class="muted small">
              Winner / advanced:
              <strong>${escapeHtml(winnerLabel(actualResult, match))}</strong>
            </p>

            <p class="muted small">
              First team to score:
              <strong>${escapeHtml(firstTeamLabel(match.actual_first_team_to_score, match))}</strong>
            </p>

            ${prediction
              ? `
                <p class="${won ? 'saved' : 'muted'}">
                  Your pick: ${prediction.home_score} - ${prediction.away_score}
                  · Winner: ${escapeHtml(winnerLabel(prediction.who_will_win || predictedWinnerFromScore(prediction), match))}
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

          const selectedWinner = pred.who_will_win || predictedWinnerFromScore(pred);

          return `
            <div class="mp-row ${cls}">
              <div>
                <div class="matchup">
                  ${match.match_no ? `M${match.match_no} · ` : ''}
                  ${teamWithFlag(match.home_team)}
                  <span class="muted">vs</span>
                  ${teamWithFlag(match.away_team)}
                </div>
                <div class="meta">
                  ${formatDateShort(match.kickoff_at)}
                  • ${escapeHtml(match.stage || '—')}
                  · saved ${formatRelative(pred.updated_at)}
                  · Winner: ${escapeHtml(winnerLabel(selectedWinner, match))}
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
   Exact score = 3
   Correct one team's score = 1 max
   Who will win / draw / penalty winner = 1
   First team to score / no goal = 1
   Maximum per match = 5
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

  const selectedWinner =
    prediction.who_will_win ||
    predictedWinnerFromScore(prediction);

  const actualResult = actualWinner(match);

  const exactScore = ph === ah && pa === aa;

  if (exactScore) {
    points += 3;
    labels.push('Exact score');
  } else if (ph === ah || pa === aa) {
    points += 1;
    labels.push('One team score');
  }

  if (selectedWinner && selectedWinner === actualResult) {
    points += 1;
    labels.push(
      actualResult === 'draw'
        ? 'Draw'
        : 'Winner / advanced'
    );
  }

  if (
    prediction.first_team_to_score &&
    match.actual_first_team_to_score &&
    prediction.first_team_to_score === match.actual_first_team_to_score
  ) {
    points += 1;
    labels.push(
      match.actual_first_team_to_score === 'none'
        ? 'No goal / 0-0'
        : 'First scorer'
    );
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
          </tr>
        </thead>

        <tbody>
          ${(rows || []).map((row, index) => `
            <tr>
              <td><span class="rank">${index + 1}</span></td>

              <td>
                <span class="leaderboard-name">
                  <span class="leaderboard-flag" title="${escapeHtml(row.supported_team || 'No supported team')}">
                    ${row.supported_team ? teamFlag(row.supported_team) : '🏳️'}
                  </span>
                  <span>${escapeHtml(row.full_name || row.email)}</span>
                </span>
              </td>

              <td><span class="points-pill">${row.total_points ?? 0}</span></td>
              <td>${row.match_points ?? 0}</td>
              <td>${row.bonus_points ?? 0}</td>
              <td>${row.exact_scores ?? 0}</td>
              <td>${row.correct_results ?? 0}</td>
              <td>${row.correct_first_scores ?? 0}</td>
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
   User profile / supported team modal
   ============================================================ */

function renderUserProfileModal(currentProfile, teams = [], supporterRows = []) {
  const selectedTeam = currentProfile?.supported_team || '';

  const currentSupportRow = selectedTeam
    ? (supporterRows || []).find(row => normalizeText(row.supported_team) === normalizeText(selectedTeam))
    : null;

  const sameTeamNames = currentSupportRow?.supporter_names || '';
  const sameTeamCount = Number(currentSupportRow?.supporters_count || 0);

  return `
    <div class="modal-backdrop" id="profileModalBackdrop" onclick="closeUserProfileModal(event)">
      <div class="card profile-modal" onclick="event.stopPropagation()">
        <div class="profile-modal-head">
          <div>
            <h2>My Profile</h2>
            <p class="muted small">
              Choose the team you support and see who else is backing the same team.
            </p>
          </div>

          <button class="profile-close-btn" onclick="closeUserProfileModal()">×</button>
        </div>

        <div class="profile-info-card">
          <div class="profile-info-main">
            <strong>${escapeHtml(currentProfile?.full_name || currentProfile?.email || 'User')}</strong>
            <span class="muted small">${escapeHtml(currentProfile?.email || '')}</span>
          </div>

          <div>
            ${selectedTeam
              ? `
                <div class="profile-current-team">
                  <span class="profile-current-flag">${teamFlag(selectedTeam)}</span>
                  <div>
                    <span class="muted small">Supporting</span>
                    <strong>${escapeHtml(selectedTeam)}</strong>
                  </div>
                </div>
              `
              : `
                <div class="profile-current-team">
                  <span class="profile-current-flag">🏳️</span>
                  <div>
                    <span class="muted small">Supporting</span>
                    <strong>No team selected</strong>
                  </div>
                </div>
              `
            }
          </div>
        </div>

        ${selectedTeam ? `
          <div class="profile-same-team-card">
            <h2>${teamFlag(selectedTeam)} ${escapeHtml(selectedTeam)} Supporters</h2>
            <p class="muted small">
              ${sameTeamCount > 0
                ? `${sameTeamCount} supporter${sameTeamCount === 1 ? '' : 's'} selected this team.`
                : 'No other supporters have selected this team yet.'
              }
            </p>

            <div class="same-team-names">
              ${sameTeamNames ? escapeHtml(sameTeamNames) : 'You are the first supporter shown for this team.'}
            </div>
          </div>
        ` : ''}

        <div class="profile-team-select">
          <label>Select your supported team</label>

          <div class="support-team-grid">
            ${(teams || []).map(team => `
              <label class="support-team-option">
                <input
                  type="radio"
                  name="supportedTeam"
                  value="${escapeHtml(team)}"
                  ${selectedTeam === team ? 'checked' : ''}
                />
                <span>${teamFlag(team)} ${escapeHtml(team)}</span>
              </label>
            `).join('')}
          </div>

          <div class="profile-team-actions">
            <button onclick="saveSupportedTeam()">Save Team</button>
            <button class="secondary" onclick="clearSupportedTeam()">Clear</button>
          </div>
        </div>

        <div style="margin-top:18px;">
          <h2>All Supporters</h2>
          <p class="muted small">Supporter summary by team.</p>

          <div class="supporter-summary-grid">
            ${(supporterRows || []).length
              ? supporterRows.map(row => `
                <div class="supporter-card ${normalizeText(row.supported_team) === normalizeText(selectedTeam) ? 'active-supporter-card' : ''}">
                  <strong>${teamFlag(row.supported_team)} ${escapeHtml(row.supported_team)}</strong>
                  <span>${row.supporters_count || 0} supporter${Number(row.supporters_count) === 1 ? '' : 's'}</span>
                  <span style="display:block; margin-top:6px;">
                    ${escapeHtml(row.supporter_names || '')}
                  </span>
                </div>
              `).join('')
              : `
                <div class="supporter-card">
                  <strong>🏳️ No supporters yet</strong>
                  <span>Once users select their teams, they will appear here.</span>
                </div>
              `
            }
          </div>
        </div>
      </div>
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
  const sortedMatches = sortStageMatches(matches);

  return `
    <div class="card admin-card">
      <h2>Admin Match Review</h2>
      <p class="muted small">
        Select a match to view each user’s latest prediction, winner pick, first-team-to-score pick, and points earned.
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
            ${teamBlock(match.home_team)}
            <div class="vs">vs</div>
            ${teamBlock(match.away_team)}
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
            Winner / advanced: ${escapeHtml(winnerLabel(actualWinner(match), match))}
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
        ${teamWithFlag(match.home_team)} vs ${teamWithFlag(match.away_team)}
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
        Actual winner / advanced:
        <strong>${escapeHtml(winnerLabel(actualWinner(match), match))}</strong>
      </p>

      <p class="muted small">
        Actual first scorer:
        <strong>${escapeHtml(firstTeamLabel(match.actual_first_team_to_score, match))}</strong>
      </p>
    </div>

    <div class="card table-card" style="margin-top:16px;">
      <h2>User Predictions</h2>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Score Pick</th>
            <th>Winner Pick</th>
            <th>First Scorer Pick</th>
            <th>Exact</th>
            <th>Team Score</th>
            <th>Winner</th>
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
                  <td>${escapeHtml(winnerLabel(row.who_will_win, match))}</td>
                  <td>${escapeHtml(firstTeamLabel(row.first_team_to_score, match))}</td>
                  <td>${row.exact_score_points ?? 0}</td>
                  <td>${row.team_score_points ?? 0}</td>
                  <td>${row.who_will_win_points ?? 0}</td>
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
                  <td colspan="11" class="muted">
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
    ? `${teamWithFlag(match.home_team)} vs ${teamWithFlag(match.away_team)}`
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
            <th>Winner</th>
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
                  <td>${escapeHtml(winnerLabel(row.who_will_win, match))}</td>
                  <td>${escapeHtml(firstTeamLabel(row.first_team_to_score, match))}</td>
                  <td>${escapeHtml(row.action)}</td>
                </tr>
              `).join('')
              : `
                <tr>
                  <td colspan="5" class="muted">
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

        <label>Actual Winner / Team Advanced</label>
        <select id="adminActualWinner">
          <option value="">Auto from score</option>
          <option value="home">Home team</option>
          <option value="away">Away team</option>
          <option value="draw">Draw</option>
        </select>

        <p class="muted small">
          For penalty or knockout matches that end level, select the team that advanced here.
        </p>

        <label>Actual First Team to Score</label>
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
        <h2>Super Admin Exports</h2>
        <p class="muted small">
          Download prediction, score, and active user data from Supabase.
        </p>

        <div class="super-export-actions">
          <button onclick="downloadPredictionsCsv()" class="secondary">
            Download Visible Predictions CSV
          </button>

          <button onclick="downloadFinalPredictionsCsv()" class="secondary">
            Download Final Predictions & Scores
          </button>

          <button onclick="downloadActiveUsersCsv()" class="secondary">
            Download Active Users
          </button>
        </div>

        <p class="export-note">
          Final prediction and active user exports require the new SQL views:
          final_predictions_export and active_users_export.
        </p>
      </div>

      <div class="card admin-card">
        <h2>Email Match Reminders</h2>
        <p class="muted small">
          Users can be emailed 30 minutes before each match using the Supabase scheduled Edge Function.
        </p>

        <p class="lock-note">
          This UI is ready for reminder tracking. The actual sending requires a Supabase Edge Function
          connected to the reminder_eligible_users view.
        </p>
      </div>
    </div>
  `;
}

/* Backward compatibility.
   If any old code still calls renderAdminPanel, show Super Admin panel. */
function renderAdminPanel(matches, scheduleUrl) {
  return renderSuperAdminPanel(matches, scheduleUrl, null);
}
