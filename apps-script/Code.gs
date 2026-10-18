// Ballot box for Park Blvd Game Nite.
// Lives in the Apps Script editor of the ballots Google Sheet, deployed as a web app.
// POST adds a ballot. GET returns vote totals for the site and the GitHub action. Names never leave the sheet.
//
// The voting PIN lives in Project Settings > Script Properties as VOTE_PIN, so it's not in the repo.

const HEADERS = ['Received', 'Month', 'Name', 'Name key', 'Pick 1', 'Pick 2', 'Pick 3', 'Dates', 'Note'];
const POINTS = [3, 2, 1];
const LIMIT_PER_HOUR = 60;          // all ballots, including wrong PINs
const LIMIT_PER_NAME_PER_HOUR = 5;

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'invalid' });
  }

  const name = clean_(data.name, 60);
  const round = String(data.round || '');
  const picks = ids_(data.picks, 3, /^[a-z0-9-]{1,80}$/);
  const dates = ids_(data.dates, 10, /^\d{4}-\d{2}-\d{2}$/);
  if (!name || !/^\d{4}-\d{2}$/.test(round) || !picks.length) {
    return json_({ ok: false, error: 'invalid' });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // Count every attempt, so guessing the PIN runs into the limit too
    if (overLimit_(nameKey_(name))) return json_({ ok: false, error: 'busy' });
    if (!pinMatches_(data.pin)) return json_({ ok: false, error: 'pin' });
    sheet_().appendRow([new Date(), round, name, nameKey_(name), picks[0] || '', picks[1] || '', picks[2] || '', dates.join(', '), clean_(data.note, 500)]);
  } finally {
    lock.releaseLock();
  }
  return json_({ ok: true });
}

// If VOTE_PIN isn't set, anyone can vote
function pinMatches_(pin) {
  const expected = PropertiesService.getScriptProperties().getProperty('VOTE_PIN');
  if (!expected) return true;
  return String(pin == null ? '' : pin).trim() === String(expected).trim();
}

// Counts ballots per hour in the script cache. Returns true once a limit is hit.
function overLimit_(key) {
  const cache = CacheService.getScriptCache();
  const hour = Utilities.formatDate(new Date(), 'UTC', 'yyyyMMddHH');
  const allKey = 'all|' + hour, nameKey = 'name|' + hour + '|' + key.slice(0, 60);
  const counts = cache.getAll([allKey, nameKey]);
  const all = Number(counts[allKey] || 0), mine = Number(counts[nameKey] || 0);
  if (all >= LIMIT_PER_HOUR || mine >= LIMIT_PER_NAME_PER_HOUR) return true;
  cache.putAll({ [allKey]: String(all + 1), [nameKey]: String(mine + 1) }, 3600);
  return false;
}

function doGet() {
  const rows = sheet_().getDataRange().getValues().slice(1);
  return json_(tallyRows_(rows, new Date()));
}

// Only each person's latest ballot per month counts. Picks are worth 3/2/1.
function tallyRows_(rows, now) {
  const latest = {};
  rows.forEach(function (r) {
    const round = asText_(r[1], 'yyyy-MM'), key = r[3];
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
    asText_(r[7], 'yyyy-MM-dd').split(',').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (d) {
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
  // Sheets turns "2026-12" into a date unless the column is plain text
  sh.getRange('B:B').setNumberFormat('@');
  sh.getRange('H:H').setNumberFormat('@');
  return sh;
}

// Rows saved before the columns were plain text come back as dates.
// Sheets dates don't always pass instanceof Date, so check for getTime instead.
function asText_(value, format) {
  if (value && typeof value.getTime === 'function') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), format);
  }
  return String(value || '');
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
