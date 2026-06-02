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

function resultText(match) {
  if (match.actual_home_score === null || match.actual_away_score === null) {
    return 'Result pending';
  }

  return `Result: ${match.actual_home_score} - ${match.actual_away_score}`;
}

function renderMatchCards(matches, predictions, helpers) {
  const { predictionFor, matchLocked, lockReason } = helpers;

  if (!matches.length) {
    return `
      <div class="card match-card">
        <h2>No matches yet</h2>
        <p class="muted">Admin needs to add matches first or sync the World Cup schedule.</p>
      </div>
    `;
  }

  return matches.map(match => {
    const prediction = predictionFor(match.id);
    const locked = matchLocked(match);
    const venue = match.venue ? ` • ${escapeHtml(match.venue)}` : '';

    return `
      <article class="card match-card">
        <div class="match-top">
          <span>${formatDate(match.kickoff_at)}</span>
          <span class="status-pill ${locked ? 'locked' : ''}">
            ${locked ? '🔒 Locked' : '🟢 Open'}
          </span>
        </div>

        <div class="teams">
          <div class="team-name">${escapeHtml(match.home_team)}</div>
          <div class="vs">vs</div>
          <div class="team-name">${escapeHtml(match.away_team)}</div>
        </div>

        <p class="muted">
          ${escapeHtml(match.stage || 'Match')}${venue} • ${resultText(match)}
        </p>

        <p class="muted small">
          Lock status: ${lockReason(match)}
        </p>

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

        <button onclick="savePrediction('${match.id}')" ${locked ? 'disabled' : ''}>
          Save / Update Prediction
        </button>

        <p class="muted small">
          You can update unlimited times before kickoff. Your latest saved score will count.
        </p>

        ${
          prediction
            ? `<p class="saved">Latest saved prediction: ${prediction.home_score} - ${prediction.away_score}</p>`
            : `<p class="muted">No prediction saved yet.</p>`
        }
      </article>
    `;
  }).join('');
}

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
  return `
    <div class="card table-card">
      <p class="message">${escapeHtml(message)}</p>
    </div>
  `;
}

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

        <p class="muted">
          Pulls fixtures from the free OpenFootball JSON schedule and updates your database.
        </p>

        <label>Schedule JSON URL</label>
        <input id="scheduleUrl" value="${escapeHtml(scheduleUrl)}" />

        <button onclick="syncScheduleFromInternet()">Sync Schedule from Internet</button>

        <p class="muted small">
          This updates teams, stage, venue, kickoff time and source ID.
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
        <input id="adminStage" placeholder="Group A" />

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
          Normal users are locked after kickoff.
          Use override only if you intentionally want to reopen predictions.
        </p>
      </div>

      <div class="card admin-card">
        <h2>Office Users / Export</h2>

        <p class="muted">
          Add approved emails in Supabase using SQL.
          After that, users can create their own accounts.
        </p>

        <button onclick="downloadPredictionsCsv()" class="secondary">
          Download My Visible Predictions CSV
        </button>
      </div>
    </div>
  `;
}
