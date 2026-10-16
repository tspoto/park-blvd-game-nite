// Ballot box for Park Blvd Game Nite.
// Lives in the Apps Script editor of the ballots Google Sheet, deployed as a web app.
// POST adds a ballot. GET returns vote totals for the GitHub action. Names never leave the sheet.

const HEADERS = ['Received', 'Month', 'Name', 'Name key', 'Pick 1', 'Pick 2', 'Pick 3', 'Dates', 'Note'];
const POINTS = [3, 2, 1];

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'Not valid JSON.' });
  }

  const name = clean_(data.name, 60);
  const round = String(data.round || '');
  const picks = ids_(data.picks, 3, /^[a-z0-9-]{1,80}$/);
  const dates = ids_(data.dates, 10, /^\d{4}-\d{2}-\d{2}$/);
  if (!name || !/^\d{4}-\d{2}$/.test(round) || !picks.length) {
    return json_({ ok: false, error: 'Need a name, a month and at least one game.' });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    sheet_().appendRow([new Date(), round, name, nameKey_(name), picks[0] || '', picks[1] || '', picks[2] || '', dates.join(', '), clean_(data.note, 500)]);
  } finally {
    lock.releaseLock();
  }
  return json_({ ok: true });
}

function doGet() {
  const rows = sheet_().getDataRange().getValues().slice(1);
  return json_(tallyRows_(rows, new Date()));
}

// Only each person's latest ballot per month counts. Picks are worth 3/2/1.
function tallyRows_(rows, now) {
  const latest = {};
  rows.forEach(function (r) {
    const round = String(r[1] || ''), key = r[3];
    if (!round || !key) return;
    const id = round + '|' + key, t = new Date(r[0]).getTime();
    if (!latest[id] || t >= latest[id].t) latest[id] = { t: t, round: round, row: r };
  });

  const rounds = {};
  Object.keys(latest).forEach(function (id) {
    const entry = latest[id], r = entry.row;
    const out = rounds[entry.round] || (rounds[entry.round] = { voters: 0, games: {}, nights: {} });
    out.voters++;
    [r[4], r[5], r[6]].forEach(function (gameId, i) {
      if (!gameId) return;
      const g = out.games[gameId] || (out.games[gameId] = { id: gameId, points: 0, first: 0, picks: 0 });
      g.points += POINTS[i];
      g.picks += 1;
      if (i === 0) g.first += 1;
    });
    String(r[7] || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (d) {
      out.nights[d] = (out.nights[d] || 0) + 1;
    });
  });

  Object.keys(rounds).forEach(function (k) {
    const o = rounds[k];
    rounds[k] = {
      voters: o.voters,
      games: Object.keys(o.games).map(function (g) { return o.games[g]; }).sort(function (a, b) { return b.points - a.points; }),
      nights: Object.keys(o.nights).sort().map(function (d) { return { id: d, count: o.nights[d] }; })
    };
  });
  return { updated: now.toISOString(), rounds: rounds };
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('Ballots');
  if (!sh) {
    sh = ss.insertSheet('Ballots');
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  }
  return sh;
}

// Anything starting with = + - @ would turn into a formula, so prefix it with an apostrophe
function clean_(value, max) {
  let s = String(value == null ? '' : value).replace(/[\u0000-\u0009\u000b-\u001f]+/g, ' ').trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function ids_(list, max, pattern) {
  if (!Array.isArray(list)) return [];
  const seen = {};
  return list.map(String).filter(function (id) {
    if (!pattern.test(id) || seen[id]) return false;
    seen[id] = true;
    return true;
  }).slice(0, max);
}

// "Tony", "tony " and "TONY" are the same person
function nameKey_(name) {
  return name.replace(/^'/, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
