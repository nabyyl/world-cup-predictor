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
    Number(match.actual_home_score) === Number(match.actual_away_score) &&
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

  if (
    match.actual_winner_override === 'home' ||
    match.actual_winner_override === 'away' ||
    match.actual_winner_override === 'draw'
  ) {
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

function bonusMatchOptions(matches, stageIds = []) {
  return (matches || [])
    .filter(match => {
      if (!stageIds.length) return true;

      return stageIds.includes(classifyStage(match.stage));
    })
    .map(match => ({
      value: `${match.match_no ? `M${match.match_no} · ` : ''}${match.home_team || 'TBD'} vs ${match.away_team || 'TBD'}`,
      label: `${match.match_no ? `M${match.match_no} · ` : ''}${match.home_team || 'TBD'} vs ${match.away_team || 'TBD'}`
    }));
}

function optionRows(options, selectedValue) {
  return (options || []).map(item => {
    const value = typeof item === 'string' ? item : item.value;
    const label = typeof item === 'string' ? item : item.label;

    return `
      <option value="${escapeHtml(value)}" ${value === selectedValue ? 'selected' : ''}>
        ${escapeHtml(label)}
      </option>
    `;
  }).join('');
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
          Predict stage bonuses and end-of-tournament major bonuses before each section is locked.
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
    <div class="next-card next-card-compact" onclick="navigateToMatch('${match.id}')" data-match-id="${match.id}">
      <span class="stage-tag">${escapeHtml(matchNumberLabel(match))} · ${escapeHtml(match.stage || 'Match')}</span>

      <div class="next-teams-list">
        <div class="next-team-line">
          <span class="next-team-flag">${teamFlag(match.home_team)}</span>
          <span class="next-team-name">${escapeHtml(match.home_team || 'TBD')}</span>
        </div>

        <div class="next-team-line">
          <span class="next-team-flag">${teamFlag(match.away_team)}</span>
          <span class="next-team-name">${escapeHtml(match.away_team || 'TBD')}</span>
        </div>
      </div>

      <div class="when">
        ${formatDate(match.kickoff_at)}${match.venue ? ' • ' + escapeHtml(match.venue) : ''}
      </div>
    </div>
  `;
}

function liveMiniCard(match) {
  return `
    <div class="next-card next-card-compact" onclick="navigateToMatch('${match.id}')" data-match-id="${match.id}">
      <span class="stage-tag live-tag">● LIVE</span>

      <div class="next-teams-list">
        <div class="next-team-line">
          <span class="next-team-flag">${teamFlag(match.home_team)}</span>
          <span class="next-team-name">${escapeHtml(match.home_team || 'TBD')}</span>
        </div>

        <div class="next-team-line">
          <span class="next-team-flag">${teamFlag(match.away_team)}</span>
          <span class="next-team-name">${escapeHtml(match.away_team || 'TBD')}</span>
        </div>
      </div>

      <div class="when">
        ${formatDate(match.kickoff_at)}${match.venue ? ' • ' + escapeHtml(match.venue) : ''}
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

function bonusSectionLocked(bonusResult, key) {
  if (!bonusResult) return false;

  if (bonusResult.is_locked) return true;

  return !!bonusResult[key];
}

function bonusStatusBadge(isLocked) {
  return `
    <span class="status-pill ${isLocked ? 'locked' : 'upcoming'}">
      ${isLocked ? '🔒 Locked' : '🟢 Open'}
    </span>
  `;
}

function bonusFieldSelect(id, label, placeholder, selected, locked, note = '') {
  return `
    <div class="bonus-field">
      <label>${escapeHtml(label)}</label>
      <select id="${id}" ${locked ? 'disabled' : ''}>
        <option value="">${escapeHtml(placeholder)}</option>
        ${selectedTempOption(selected)}
      </select>
      ${note ? `<p class="muted small">${escapeHtml(note)}</p>` : ''}
    </div>
  `;
}

function bonusFieldNumber(id, label, placeholder, selected, locked, note = '') {
  return `
    <div class="bonus-field">
      <label>${escapeHtml(label)}</label>
      <input
        id="${id}"
        type="number"
        min="0"
        max="20"
        placeholder="${escapeHtml(placeholder)}"
        value="${selected ?? ''}"
        ${locked ? 'disabled' : ''}
      />
      ${note ? `<p class="muted small">${escapeHtml(note)}</p>` : ''}
    </div>
  `;
}

function bonusSaveButton(label, functionName, locked) {
  return `
    <div
      class="bonus-section-save"
      style="
        grid-column: 1 / -1;
        width: 100%;
        display: flex;
        justify-content: flex-start;
        margin-top: 24px;
        padding-top: 10px;
      "
    >
      <button
        onclick="${functionName}()"
        ${locked ? 'disabled' : ''}
        style="
          width: auto;
          min-width: 210px;
          max-width: 280px;
          padding: 14px 24px;
          border-radius: 18px;
          font-size: 0.95rem;
          font-weight: 800;
          white-space: nowrap;
        "
      >
        ${escapeHtml(label)}
      </button>
    </div>
  `;
}

function bonusUserSection({ id, title, subtitle, points, locked, body, saveButton, orderClass }) {
  return `
    <section class="card bonus-stage-card ${orderClass || ''}" data-bonus-section="${escapeHtml(id)}">
      <div class="bonus-stage-head">
        <div>
          <span class="stage-tag">${escapeHtml(points)}</span>
          <h2>${title}</h2>
          <p class="muted small">${subtitle}</p>
        </div>
        ${bonusStatusBadge(locked)}
      </div>

      <div class="bonus-grid">
        ${body}
      </div>

      ${saveButton || ''}
    </section>
  `;
}

function renderBonusPredictions(bonusPrediction, bonusResult, currentProfile, bonusOptions = {}) {
  const teams = bonusOptions.teams || [];
  const players = bonusOptions.players || [];
  const matches = bonusOptions.matches || [];

  const locks = {
    group: bonusSectionLocked(bonusResult, 'group_bonus_locked'),
    r32: bonusSectionLocked(bonusResult, 'r32_bonus_locked'),
    r16: bonusSectionLocked(bonusResult, 'r16_bonus_locked'),
    qf: bonusSectionLocked(bonusResult, 'qf_bonus_locked'),
    sf: bonusSectionLocked(bonusResult, 'sf_bonus_locked'),
    final: bonusSectionLocked(bonusResult, 'final_bonus_locked'),
    major: bonusSectionLocked(bonusResult, 'major_bonus_locked')
  };

  const sections = [
    {
      id: 'group',
      order: 1,
      locked: locks.group,
      html: bonusUserSection({
        id: 'group',
        title: '🌍 Group Stage Questions',
        subtitle: 'Each question is worth 5 points. - Deadline: Before the start of Second Match of Group Stage (21:00 of 18 June / Czechia vs South Africa)',
        points: '5 pts each',
        locked: locks.group,
        body: `
          ${bonusFieldSelect('bonusGroupMostGoalsTeam', 'Which team will score the most goals during the group stage?', 'Select team', bonusPrediction?.group_most_goals_team, locks.group)}
          ${bonusFieldSelect('bonusGroupFewestConcededTeam', 'Which team will concede the fewest goals during the group stage?', 'Select team', bonusPrediction?.group_fewest_conceded_team, locks.group)}
          ${bonusFieldSelect('bonusGroupMostYellowCardsTeam', 'Which team will be given the most yellow cards during the group stage?', 'Select team', bonusPrediction?.group_most_yellow_cards_team, locks.group)}
        `,
        saveButton: bonusSaveButton(
          bonusPrediction ? 'Update Group Bonus' : 'Save Group Bonus',
          'saveGroupBonusPrediction',
          locks.group
        )
      })
    },
    {
      id: 'r32',
      order: 2,
      locked: locks.r32,
      html: bonusUserSection({
        id: 'r32',
        title: '🏟️ Round of 32 Question',
        subtitle: 'Pick the match you think will go to extra time. - Deadline: Before the Start of Round of 32',
        points: '7 pts',
        locked: locks.r32,
        body: `
          ${bonusFieldSelect('bonusR32ExtraTimeMatch', 'Which match will go to extra time?', 'Select match', bonusPrediction?.r32_extra_time_match, locks.r32)}
        `,
        saveButton: bonusSaveButton(
          bonusPrediction ? 'Update Round of 32 Bonus' : 'Save Round of 32 Bonus',
          'saveR32BonusPrediction',
          locks.r32
        )
      })
    },
    {
      id: 'r16',
      order: 3,
      locked: locks.r16,
      html: bonusUserSection({
        id: 'r16',
        title: '🎯 Round of 16 Question',
        subtitle: 'Pick the team you think will win through a penalty shootout. - Deadline: Before the Start of Round of 16',
        points: '7 pts',
        locked: locks.r16,
        body: `
          ${bonusFieldSelect('bonusR16PenaltyShootoutTeam', 'Which team will win through a penalty shootout?', 'Select team', bonusPrediction?.r16_penalty_shootout_team, locks.r16)}
        `,
        saveButton: bonusSaveButton(
          bonusPrediction ? 'Update Round of 16 Bonus' : 'Save Round of 16 Bonus',
          'saveR16BonusPrediction',
          locks.r16
        )
      })
    },
    {
      id: 'qf',
      order: 4,
      locked: locks.qf,
      html: bonusUserSection({
        id: 'qf',
        title: '🔥 Quarter-finals Question',
        subtitle: 'Pick the team that progresses without conceding. - Deadline: Before the Start of Quarter-Final Matches',
        points: '7 pts',
        locked: locks.qf,
        body: `
          ${bonusFieldSelect('bonusQfCleanSheetTeam', 'Which team will progress with a clean sheet?', 'Select team', bonusPrediction?.qf_clean_sheet_team, locks.qf)}
        `,
        saveButton: bonusSaveButton(
          bonusPrediction ? 'Update Quarter-finals Bonus' : 'Save Quarter-finals Bonus',
          'saveQfBonusPrediction',
          locks.qf
        )
      })
    },
    {
      id: 'sf',
      order: 5,
      locked: locks.sf,
      html: bonusUserSection({
        id: 'sf',
        title: '⭐ Semi-finals Question',
        subtitle: 'Pick the team you think will have the highest possession. - Deadline: Before the Start of Semi-Final Matches',
        points: '7 pts',
        locked: locks.sf,
        body: `
          ${bonusFieldSelect('bonusSfMostPossessionTeam', 'Which team will have the most possession?', 'Select team', bonusPrediction?.sf_most_possession_team, locks.sf)}
        `,
        saveButton: bonusSaveButton(
          bonusPrediction ? 'Update Semi-finals Bonus' : 'Save Semi-finals Bonus',
          'saveSfBonusPrediction',
          locks.sf
        )
      })
    },
    {
      id: 'final',
      order: 6,
      locked: locks.final,
      html: bonusUserSection({
        id: 'final',
        title: '🏆 Final Question',
        subtitle: 'Predict the number of goals in the first half. - Deadline: Before the Start of Final Match',
        points: '7 pts',
        locked: locks.final,
        body: `
          ${bonusFieldNumber('bonusFinalFirstHalfGoals', 'How many goals will be scored in the first half?', 'Example: 1', bonusPrediction?.final_first_half_goals, locks.final)}
        `,
        saveButton: bonusSaveButton(
          bonusPrediction ? 'Update Final Bonus' : 'Save Final Bonus',
          'saveFinalBonusPrediction',
          locks.final
        )
      })
    },
    {
      id: 'major',
      order: 7,
      locked: locks.major,
      html: bonusUserSection({
        id: 'major',
        title: '🏅 End-of-Tournament Major Bonuses',
        subtitle: 'Finalist picks are order-free. France/Brazil and Brazil/France both count.- Deadline: Before the First Match of Round of 16',
        points: '80 pts max',
        locked: locks.major,
        body: `
          ${bonusFieldSelect('bonusTournamentWinner', 'Tournament Winner', 'Select tournament winner', bonusPrediction?.tournament_winner, locks.major, '30 points')}
          ${bonusFieldSelect('bonusGoldenBoot', 'Golden Boot / Top Scorer', 'Select top scorer', bonusPrediction?.golden_boot || bonusPrediction?.best_player, locks.major, '20 points')}
          <select id="bonusBestPlayer" class="hidden">
            ${selectedTempOption(bonusPrediction?.golden_boot || bonusPrediction?.best_player)}
          </select>
          ${bonusFieldSelect('bonusFinalistOne', 'Finalist Team A', 'Select finalist A', bonusPrediction?.finalist_one, locks.major, '15 points')}
          ${bonusFieldSelect('bonusFinalistTwo', 'Finalist Team B', 'Select finalist B', bonusPrediction?.finalist_two, locks.major, '15 points')}
        `,
        saveButton: bonusSaveButton(
          bonusPrediction ? 'Update Major Bonus' : 'Save Major Bonus',
          'saveMajorBonusPrediction',
          locks.major
        )
      })
    }
  ];

  const openSections = sections
    .filter(section => !section.locked)
    .sort((a, b) => a.order - b.order);

  const lockedSections = sections
    .filter(section => section.locked)
    .sort((a, b) => a.order - b.order);

  const allLocked = sections.every(section => section.locked);

  return `
    <div class="card admin-card">
      <h2>🎁 Bonus Predictions</h2>
      <p class="muted small">
        Save each bonus section separately. Upcoming/open sections are shown first. Closed sections move to the bottom.
      </p>

      <div class="rules-grid" style="margin-bottom:16px;">
        <div>
          <strong>130</strong>
          <span>Maximum bonus points</span>
        </div>
        <div>
          <strong>80</strong>
          <span>Major bonus points</span>
        </div>
        <div>
          <strong>50</strong>
          <span>Stage bonus points</span>
        </div>
      </div>

      <p class="${allLocked ? 'message' : 'saved'}">
        ${allLocked ? 'All bonus sections are locked.' : 'Some bonus sections are still open.'}
      </p>

      ${bonusPrediction?.updated_at
        ? `<p class="muted small">Last updated: ${new Date(bonusPrediction.updated_at).toLocaleString()}</p>`
        : `<p class="muted small">No bonus prediction saved yet.</p>`
      }
    </div>

    <div class="bonus-page-stack" style="margin-top:16px;">
      ${openSections.length ? `
        <div class="bonus-section-label">
          <h2>Open / Upcoming Bonus Questions</h2>
          <p class="muted small">Complete these before Super Admin locks the section.</p>
        </div>
        ${openSections.map(section => section.html).join('')}
      ` : ''}

      ${lockedSections.length ? `
        <div class="bonus-section-label">
          <h2>Closed Bonus Questions</h2>
          <p class="muted small">These sections are locked and can no longer be edited.</p>
        </div>
        ${lockedSections.map(section => section.html).join('')}
      ` : ''}
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
    .sort((a, b) => {
      const aNo = Number(a.match.match_no || 0);
      const bNo = Number(b.match.match_no || 0);

      if (aNo !== bNo) return bNo - aNo;

      return new Date(b.match.kickoff_at) - new Date(a.match.kickoff_at);
    });

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
  let lastPoints = null;
  let currentRank = 0;

  return `
    <div class="card table-card leaderboard-table-card">
      <h2>Leaderboard</h2>
      <p class="muted small">
        Total points include match points and bonus points.
      </p>

      <table class="leaderboard-table">
        <colgroup>
          <col class="lb-rank-col" />
          <col class="lb-name-col" />
          <col class="lb-score-col" />
          <col class="lb-score-col" />
          <col class="lb-score-col" />
          <col class="lb-score-col" />
          <col class="lb-score-col" />
          <col class="lb-score-col" />
          <col class="lb-score-col" />
        </colgroup>

        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Total</th>
            <th>Match</th>
            <th>Bonus</th>
            <th>Exact</th>
            <th>One Score</th>
            <th>Result</th>
            <th>First Score</th>
          </tr>
        </thead>

        <tbody>
          ${(rows || []).map((row) => {
            const totalPoints = row.total_points ?? 0;

            if (totalPoints !== lastPoints) {
              currentRank += 1;
              lastPoints = totalPoints;
            }

            const rankClass =
              currentRank === 1
                ? 'rank rank-gold'
                : currentRank === 2
                  ? 'rank rank-silver'
                  : currentRank === 3
                    ? 'rank rank-bronze'
                    : 'rank';

            return `
              <tr>
                <td><span class="${rankClass}">${currentRank}</span></td>

                <td>
                  <span class="leaderboard-name">
                    <span class="leaderboard-flag" title="${escapeHtml(row.supported_team || 'No supported team')}">
                      ${row.supported_team ? teamFlag(row.supported_team) : '🇦🇷'}
                    </span>
                    <span class="leaderboard-person-name">${escapeHtml(row.full_name || row.email)}</span>
                  </span>
                </td>

                <td><span class="points-pill">${row.total_points ?? 0}</span></td>
                <td>${row.match_points ?? 0}</td>
                <td>${row.bonus_points ?? 0}</td>
                <td>${row.exact_scores ?? 0}</td>
                <td>${row.team_score_points ?? 0}</td>
                <td>${row.correct_results ?? 0}</td>
                <td>${row.correct_first_scores ?? 0}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderLeaderboardError(message) {
  return `
    <div class="card table-card leaderboard-table-card">
      <h2>Leaderboard</h2>
      <p class="message">${escapeHtml(message || 'Leaderboard could not load.')}</p>
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
                  <span class="profile-current-flag">🇦🇷</span>
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
                  <strong>🇦🇷 No supporters yet</strong>
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
        Review all bonus answers and calculated bonus points.
      </p>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Major Picks</th>
            <th>Group Picks</th>
            <th>Round Picks</th>
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
                  <td>
                    Winner: ${escapeHtml(row.tournament_winner || '—')}<br>
                    Golden Boot: ${escapeHtml(row.golden_boot || row.best_player || '—')}<br>
                    Finalists: ${escapeHtml(row.finalist_one || '—')} / ${escapeHtml(row.finalist_two || '—')}
                  </td>
                  <td>
                    Most goals: ${escapeHtml(row.group_most_goals_team || '—')}<br>
                    Fewest conceded: ${escapeHtml(row.group_fewest_conceded_team || '—')}<br>
                    Most yellows: ${escapeHtml(row.group_most_yellow_cards_team || '—')}
                  </td>
                  <td>
                    R32 ET match: ${escapeHtml(row.r32_extra_time_match || '—')}<br>
                    R16 pens: ${escapeHtml(row.r16_penalty_shootout_team || '—')}<br>
                    QF clean sheet: ${escapeHtml(row.qf_clean_sheet_team || '—')}<br>
                    SF possession: ${escapeHtml(row.sf_most_possession_team || '—')}<br>
                    Final 1H goals: ${row.final_first_half_goals ?? '—'}
                  </td>
                  <td><span class="points-pill">${row.bonus_points ?? 0}</span></td>
                  <td>${row.updated_at ? new Date(row.updated_at).toLocaleString() : '—'}</td>
                </tr>
              `).join('')
              : `
                <tr>
                  <td colspan="6" class="muted">
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
   ============================================================ */

function adminBonusLock(label, id, checked) {
  return `
    <label>
      <input id="${id}" type="checkbox" style="width:auto" ${checked ? 'checked' : ''} />
      ${escapeHtml(label)}
    </label>
  `;
}

function adminActualSelect(id, label, placeholder, selected) {
  return `
    <div class="bonus-field">
      <label>${escapeHtml(label)}</label>
      <select id="${id}">
        <option value="">${escapeHtml(placeholder)}</option>
        ${selectedTempOption(selected)}
      </select>
    </div>
  `;
}

function adminActualNumber(id, label, placeholder, selected) {
  return `
    <div class="bonus-field">
      <label>${escapeHtml(label)}</label>
      <input id="${id}" type="number" min="0" max="20" placeholder="${escapeHtml(placeholder)}" value="${selected ?? ''}" />
    </div>
  `;
}

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

        <label>Kickoff Date & Time</label>
        <input id="adminEditKickoff" type="datetime-local" />

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

      <div class="card admin-card bonus-admin-card">
        <h2>Bonus Prediction Control</h2>
        <p class="muted small">
          Lock each bonus section separately and enter actual answers for scoring.
        </p>

        <div class="bonus-lock-grid">
          ${adminBonusLock('Lock all bonus sections', 'bonusLock', bonusResult?.is_locked)}
          ${adminBonusLock('Lock Major Bonuses', 'majorBonusLock', bonusResult?.major_bonus_locked)}
          ${adminBonusLock('Lock Group Stage', 'groupBonusLock', bonusResult?.group_bonus_locked)}
          ${adminBonusLock('Lock Round of 32', 'r32BonusLock', bonusResult?.r32_bonus_locked)}
          ${adminBonusLock('Lock Round of 16', 'r16BonusLock', bonusResult?.r16_bonus_locked)}
          ${adminBonusLock('Lock Quarter-finals', 'qfBonusLock', bonusResult?.qf_bonus_locked)}
          ${adminBonusLock('Lock Semi-finals', 'sfBonusLock', bonusResult?.sf_bonus_locked)}
          ${adminBonusLock('Lock Final', 'finalBonusLock', bonusResult?.final_bonus_locked)}
        </div>

        <div class="bonus-admin-section">
          <h3>Major Bonus Actual Answers</h3>
          <p class="muted small">Winner 30 pts · Golden Boot 20 pts · Finalists 15 pts each.</p>

          <div class="bonus-grid">
            ${adminActualSelect('actualTournamentWinner', 'Actual Tournament Winner', 'Select actual tournament winner', bonusResult?.actual_tournament_winner)}
            ${adminActualSelect('actualGoldenBoot', 'Actual Golden Boot / Top Scorer', 'Select actual top scorer', bonusResult?.actual_golden_boot || bonusResult?.actual_best_player)}
            <select id="actualBestPlayer" class="hidden">
              ${selectedTempOption(bonusResult?.actual_golden_boot || bonusResult?.actual_best_player)}
            </select>
            ${adminActualSelect('actualFinalistOne', 'Actual Finalist Team A', 'Select actual finalist A', bonusResult?.actual_finalist_one)}
            ${adminActualSelect('actualFinalistTwo', 'Actual Finalist Team B', 'Select actual finalist B', bonusResult?.actual_finalist_two)}
          </div>
        </div>

        <div class="bonus-admin-section">
          <h3>Stage Bonus Actual Answers</h3>
          <p class="muted small">Group questions are 5 pts each. Other round questions are 7 pts each.</p>

          <div class="bonus-grid">
            ${adminActualSelect('actualGroupMostGoalsTeam', 'Group: Most goals scored', 'Select actual team', bonusResult?.actual_group_most_goals_team)}
            ${adminActualSelect('actualGroupFewestConcededTeam', 'Group: Fewest goals conceded', 'Select actual team', bonusResult?.actual_group_fewest_conceded_team)}
            ${adminActualSelect('actualGroupMostYellowCardsTeam', 'Group: Most yellow cards', 'Select actual team', bonusResult?.actual_group_most_yellow_cards_team)}
            ${adminActualSelect('actualR32ExtraTimeMatch', 'Round of 32: Match went to extra time', 'Select actual match', bonusResult?.actual_r32_extra_time_match)}
            ${adminActualSelect('actualR16PenaltyShootoutTeam', 'Round of 16: Won through penalty shootout', 'Select actual team', bonusResult?.actual_r16_penalty_shootout_team)}
            ${adminActualSelect('actualQfCleanSheetTeam', 'Quarter-finals: Progressed with clean sheet', 'Select actual team', bonusResult?.actual_qf_clean_sheet_team)}
            ${adminActualSelect('actualSfMostPossessionTeam', 'Semi-finals: Most possession', 'Select actual team', bonusResult?.actual_sf_most_possession_team)}
            ${adminActualNumber('actualFinalFirstHalfGoals', 'Final: First-half goals', 'Example: 1', bonusResult?.actual_final_first_half_goals)}
          </div>
        </div>

        <button onclick="updateBonusResults()">Update Bonus Settings</button>

        <p class="muted small">
          Finalist points are order-free. If the two teams are correct, users get points regardless of finalist order.
        </p>
      </div>

      <div class="card admin-card">
        <h2>Reset Leaderboard</h2>
        <p class="muted small">
          Use this after the testing phase. This clears all match predictions, prediction history,
          bonus predictions, and reminder logs.
        </p>

        <p class="lock-note">
          Matches, users, match results, and bonus result settings will not be deleted.
          Password required: same as schedule sync password.
        </p>

        <button onclick="resetLeaderboard()" class="danger">
          Reset Leaderboard
        </button>
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
          Users can be emailed around 30 minutes before each match using Google Apps Script and the reminder_eligible_users view.
        </p>

        <p class="lock-note">
          Reminder logs are tracked in match_email_notifications to avoid duplicate reminder emails.
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
