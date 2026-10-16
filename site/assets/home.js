// Home page. Voting windows run back to back, so one month's date can be set
// while next month's voting is already open.
(function () {
  const P = window.PBGN;
  const nextBox = document.getElementById("next"), seasonList = document.getElementById("season");
  let LIB = null;

  function updatedLabel(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
  function hostLine(r) {
    return r.host ? "Hosted by <b>" + P.esc(r.host) + "</b>" + (r.where ? " in " + P.esc(r.where) : "") : "Host to be confirmed";
  }
  // e.g. "Saturdays: Dec 5, 12, 19"
  function optionsLine(r) {
    const d = r.options.slice().sort();
    if (!d.length) return "";
    const month = P.dateLabel(d[0]).split(", ")[1].split(" ")[0];
    return "Saturdays: " + month + " " + d.map(function (x) { return String(+x.slice(8)); }).join(", ");
  }

  function setHero(r, season) {
    const nxt = season.next(r);
    let after = "";
    if (nxt && nxt.status === "voting") after = " " + P.esc(nxt.label) + " voting is open now.";
    else if (nxt) after = " " + P.esc(nxt.label) + " voting opens " + P.esc(P.dateLabel(nxt.votingOpens)) + ".";
    return '<section class="panel panel--band night-hero"><span class="eyebrow">Next game night</span>' +
      '<span class="night-hero__big">' + P.esc(P.dateLabel(r.lead, "long")) + "</span>" +
      '<p class="night-hero__sub"><b>' + P.esc(r.time || "Time to be set") + "</b> · " + hostLine(r) + "</p>" +
      '<p class="night-hero__sub">No RSVP needed. Come if you can.' + after + "</p></section>";
  }
  function votingHero(r, compact) {
    return '<section class="panel ' + (compact ? "" : "panel--band ") + 'night-hero"><span class="eyebrow">' + P.esc(r.label) + " game night</span>" +
      '<span class="night-hero__big">' + (compact ? P.esc(r.label) + " voting is open" : "Voting is open") + "</span>" +
      '<p class="night-hero__sub">Closes <b>' + P.esc(P.dateLabel(r.votingCloses)) + "</b>. " + P.esc(optionsLine(r)) + "</p>" +
      '<div class="btn-row"><a class="btn" href="vote.html">Vote for ' + P.esc(r.label) + "</a></div></section>";
  }
  function upcomingHero(r) {
    return '<section class="panel panel--band night-hero"><span class="eyebrow">' + P.esc(r.label) + " game night</span>" +
      '<span class="night-hero__big">Voting opens ' + P.esc(P.dateLabel(r.votingOpens)) + "</span>" +
      '<p class="night-hero__sub">' + P.esc(optionsLine(r)) + "</p>" +
      '<div class="btn-row"><a class="btn" href="games.html">Browse the games</a></div></section>';
  }

  function gameRows(r, limit) {
    const ranked = P.rankedGames(LIB, r.tally).slice(0, limit);
    const max = ranked.length ? ranked[0].points : 1;
    return ranked.map(function (x, i) {
      const g = LIB.byId[x.id];
      return '<div class="rank__row' + (i === 0 ? " is-top" : "") + '"><span class="rank__n">' + (i + 1) + "</span>" +
        '<span class="rank__name">' + P.esc(g.name) + "</span>" +
        '<span class="rank__val">' + x.points + " pts</span>" +
        '<span class="rank__sub">' + P.players(LIB.effPlayers(g)) + " · " + P.range(g.time[0], g.time[1], " min") + "</span>" +
        '<span class="rank__bar" aria-hidden="true"><i style="width:' + Math.max(4, Math.round(x.points / max * 100)) + '%"></i></span></div>';
    }).join("");
  }
  function dateRows(r) {
    const counts = {};
    (r.tally.nights || []).forEach(function (n) { counts[n.id] = n.count; });
    const max = Math.max(1, Math.max.apply(null, r.options.map(function (d) { return counts[d] || 0; })));
    return r.options.slice().sort().map(function (d) {
      const c = counts[d] || 0, lead = d === r.lead && c > 0;
      return '<div class="rank__row' + (lead ? " is-top" : "") + '"><span class="rank__n"></span>' +
        '<span class="rank__name">' + P.esc(P.dateLabel(d)) + "</span>" +
        '<span class="rank__val">' + c + " could make it</span>" +
        '<span class="rank__bar" aria-hidden="true"><i style="width:' + Math.round(c / max * 100) + '%"></i></span></div>';
    }).join("");
  }

  function lineupPanel(r) {
    const rows = gameRows(r, 6);
    return '<section class="panel" aria-labelledby="lineupH"><div class="section-head"><span class="eyebrow">' + P.esc(r.label) + "</span>" +
      '<h2 id="lineupH">The lineup</h2>' +
      '<p class="hint">We start with the highest game on this list that fits the group. If more people show up than it allows, we partner up.</p></div>' +
      (rows ? '<div class="rank">' + rows + "</div>" : '<p class="hint">Nobody voted this month, so the group will pick on the night.</p>') + "</section>";
  }
  function standingsPanel(r, season) {
    const voters = r.tally.voters || 0, when = updatedLabel(season.updated);
    const head = voters ? voters + (voters === 1 ? " ballot" : " ballots") + " so far" + (when ? ". Updated " + P.esc(when) + "." : ".") : "No ballots yet.";
    const rows = gameRows(r, 5);
    return '<section class="panel" aria-labelledby="leadH-' + r.id + '"><div class="section-head"><span class="eyebrow">' + P.esc(r.label) + " standings</span>" +
      '<h2 id="leadH-' + r.id + '">Leading so far</h2><p class="hint">' + head + " Standings update twice a day.</p></div>" +
      (rows ? '<div class="rank">' + rows + "</div>" : '<p>Be the first to vote. <a class="text-link" href="vote.html">Vote now</a></p>') +
      '<h3>Saturdays</h3><div class="rank">' + dateRows(r) + "</div></section>";
  }

  function topPanels(season) {
    const cur = season.current, open = season.open;
    const sample = season.sample ? '<div class="notice"><b>Sample numbers.</b> These votes are made up to show the layout.</div>' : "";
    if (!cur) {
      return '<section class="panel panel--band night-hero"><span class="eyebrow">Season over</span>' +
        '<span class="night-hero__big">That\'s a wrap</span><p class="night-hero__sub">Thanks for playing. Next season\'s schedule will show up here.</p></section>';
    }
    if (cur.status === "upcoming") return upcomingHero(cur);
    if (cur.status === "voting") return votingHero(cur, false) + sample + standingsPanel(cur, season);
    // Date's set. Show it, the lineup, and next month's voting if it's open.
    let h = setHero(cur, season) + sample + lineupPanel(cur);
    if (open && open !== cur) h += votingHero(open, true) + standingsPanel(open, season);
    return h;
  }

  function seasonRows(season) {
    return season.rounds.map(function (r) {
      let status, detail;
      if (r.status === "played") { status = '<span class="status">Played</span>'; detail = P.dateLabel(r.lead); }
      else if (r.status === "set") { status = '<span class="status status--set">Date set</span>'; detail = P.dateLabel(r.lead) + (r.host ? " · " + r.host : ""); }
      else if (r.status === "voting") { status = '<span class="status status--open">Voting open</span>'; detail = "Closes " + P.dateLabel(r.votingCloses); }
      else { status = '<span class="status">Voting opens ' + P.esc(P.dateLabel(r.votingOpens)) + "</span>"; detail = optionsLine(r); }
      return '<li><div><div class="season__month">' + P.esc(r.label) + '</div><div class="season__detail">' + P.esc(detail) + "</div></div>" + status + "</li>";
    }).join("");
  }

  function load() {
    Promise.all([P.loadJSON("data/games.json"), P.loadSeason()]).then(function (res) {
      LIB = P.indexGames(res[0]);
      const season = res[1];
      const example = season.example ? '<div class="notice"><b>Placeholder dates.</b> The schedule below is an example until the real dates are set.</div>' : "";
      nextBox.className = "list";
      nextBox.innerHTML = example + topPanels(season);
      seasonList.innerHTML = seasonRows(season);
    }).catch(function () {
      nextBox.innerHTML = '<p class="empty">The schedule didn\'t load. Refresh the page to try again.</p>';
    });
  }
  load();
})();
