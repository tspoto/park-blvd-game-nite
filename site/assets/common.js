// Helpers shared by every page
(function () {
  const CFG = window.PBGN_CONFIG || {};

  function loadJSON(path) {
    return fetch(path, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(path + " returned " + r.status);
      return r.json();
    });
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // 99 = no real cap (Flip 7, Jenga)
  function range(a, b, unit) {
    unit = unit || "";
    if (b >= 99) return a + "+" + unit;
    return a === b ? a + unit : a + "–" + b + unit;
  }
  function players(r) { return range(r[0], r[1]) + (r[0] === 1 && r[1] === 1 ? " player" : " players"); }

  function tier(w) {
    if (w < 1.7) return { n: 1, label: "Light" };
    if (w < 2.3) return { n: 2, label: "Medium-light" };
    if (w < 3) return { n: 3, label: "Medium" };
    return { n: 4, label: "Heavy" };
  }

  function pips(w) {
    const t = tier(w), on = Math.round(w);
    let h = '<span class="pips" aria-hidden="true">';
    for (let i = 1; i <= 5; i++) h += "<i" + (i <= on ? ' style="background:var(--w' + t.n + ')"' : "") + "></i>";
    return h + "</span>";
  }

  // Groups expansions under their base game. Player counts include expansions.
  function indexGames(games) {
    const byId = {}, kids = {};
    games.forEach(function (g) { byId[g.id] = g; if (g.parent) (kids[g.parent] = kids[g.parent] || []).push(g); });
    function kidsOf(id) { return kids[id] || []; }
    function effPlayers(g) {
      let a = g.players[0], b = g.players[1];
      kidsOf(g.id).forEach(function (k) {
        if (k.kind === "expansion") { a = Math.min(a, k.players[0]); b = Math.max(b, k.players[1]); }
      });
      return [a, b];
    }
    const top = games.filter(function (g) { return !g.parent; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    // 2-player games stay on the shelf but aren't on the ballot
    function isVotable(g) { return !!g && !g.parent && effPlayers(g)[1] > 2; }
    return { all: games, top: top, byId: byId, kidsOf: kidsOf, effPlayers: effPlayers, isVotable: isVotable };
  }

  function videoUrl(g) {
    return "https://www.youtube.com/results?search_query=" + encodeURIComponent("how to play " + (g.lookup || g.name));
  }

  function iso(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function parseDate(id) {
    const p = String(id).split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function dateLabel(id, style) {
    const d = parseDate(id);
    if (isNaN(d)) return id;
    const opts = style === "long" ? { weekday: "long", month: "long", day: "numeric" } : { weekday: "short", month: "short", day: "numeric" };
    return d.toLocaleDateString("en-US", opts);
  }
  // CFG.today is handy for testing, e.g. "2026-11-28"
  function today() { return CFG.today || iso(new Date()); }

  // One round per month. Most votes wins, ties go to the earlier Saturday. Set round.night to override.
  function leadingDate(round, tally) {
    if (round.night) return round.night;
    const counts = {};
    (tally.nights || []).forEach(function (n) { counts[n.id] = n.count; });
    let best = null, bestCount = -1;
    round.options.slice().sort().forEach(function (id) {
      const c = counts[id] || 0;
      if (c > bestCount) { best = id; bestCount = c; }
    });
    return best;
  }
  function roundStatus(round, lead, t) {
    if (t < round.votingOpens) return "upcoming";
    if (t <= round.votingCloses) return "voting";
    if (t <= lead) return "set";
    return "played";
  }
  function loadSeason() {
    return Promise.all([loadJSON("data/schedule.json"), loadJSON("data/results.json")]).then(function (res) {
      const sched = res[0], results = res[1] || {}, t = today();
      const rounds = (sched.rounds || []).slice().sort(function (a, b) { return a.votingOpens.localeCompare(b.votingOpens); }).map(function (r) {
        const tally = (results.rounds && results.rounds[r.id]) || { voters: 0, games: [], nights: [] };
        const lead = leadingDate(r, tally);
        return Object.assign({}, r, { tally: tally, lead: lead, status: roundStatus(r, lead, t) });
      });
      return {
        example: !!sched.example, sample: !!results.sample, updated: results.updated, today: t, rounds: rounds,
        current: rounds.filter(function (r) { return r.status !== "played"; })[0] || null,
        open: rounds.filter(function (r) { return r.status === "voting"; })[0] || null,
        next: function (round) { const i = rounds.indexOf(round); return i === -1 ? null : rounds[i + 1] || null; }
      };
    });
  }
  function rankedGames(LIB, tally) {
    return (tally.games || []).filter(function (x) { return LIB.isVotable(LIB.byId[x.id]); }).sort(function (a, b) {
      return b.points - a.points || b.first - a.first || LIB.byId[a.id].name.localeCompare(LIB.byId[b.id].name);
    });
  }

  // Remembers your name and ballot picks on this device
  const DRAFT_KEY = "pbgn-draft", LAST_KEY = "pbgn-last";
  function readStore(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function writeStore(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private browsing, etc. */ }
  }
  function getDraft() { const d = readStore(DRAFT_KEY, []); return Array.isArray(d) ? d.slice(0, 3) : []; }
  function setDraft(ids) { writeStore(DRAFT_KEY, ids.slice(0, 3)); }

  // Apps Script doesn't send CORS headers, so we can't read the response. Fire and forget.
  function send(payload) {
    return fetch(CFG.voteEndpoint, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
  }
  function canSend() { return !!(CFG.voteEndpoint || "").trim(); }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-season]").forEach(function (el) { el.textContent = CFG.season || ""; });
    document.querySelectorAll("[data-organizer]").forEach(function (el) { el.textContent = CFG.organizer || ""; });
  });

  window.PBGN = {
    CFG: CFG, loadJSON: loadJSON, esc: esc, range: range, players: players, tier: tier, pips: pips,
    indexGames: indexGames, videoUrl: videoUrl, dateLabel: dateLabel, today: today,
    loadSeason: loadSeason, rankedGames: rankedGames,
    getDraft: getDraft, setDraft: setDraft, readStore: readStore, writeStore: writeStore, LAST_KEY: LAST_KEY,
    send: send, canSend: canSend
  };
})();
