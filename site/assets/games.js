// Games page
(function () {
  const P = window.PBGN;
  const STATE_KEY = "pbgn-filters";
  const state = { players: null, time: null, weight: [], style: [], q: "" };
  const saved = P.readStore(STATE_KEY, null);
  if (saved) {
    state.players = saved.players == null ? null : saved.players;
    state.time = saved.time == null ? null : saved.time;
    state.weight = Array.isArray(saved.weight) ? saved.weight : [];
    state.style = Array.isArray(saved.style) ? saved.style : [];
  }
  let LIB = null;
  let draft = P.getDraft();

  const filterDefs = [
    { el: "fPlayers", key: "players", single: true, opts: [{ v: null, l: "Any" }].concat([2, 3, 4, 5, 6, 7, 8].map(function (n) { return { v: n, l: n === 8 ? "8+" : String(n) }; })) },
    { el: "fTime", key: "time", single: true, opts: [{ v: null, l: "Any" }, { v: 30, l: "30 min or less" }, { v: 60, l: "1 hr or less" }, { v: 90, l: "90 min or less" }] },
    { el: "fWeight", key: "weight", single: false, opts: [{ v: null, l: "Any" }].concat([1, 2, 3, 4].map(function (n) { return { v: n, l: ["", "Light", "Medium-light", "Medium", "Heavy"][n] }; })) },
    { el: "fStyle", key: "style", single: false, opts: ["Competitive", "Co-op", "Teams", "One vs. many", "Party"].map(function (s) { return { v: s, l: s }; }) }
  ];
  function isOn(def, v) {
    if (def.single) return state[def.key] === v;
    return v === null ? state[def.key].length === 0 : state[def.key].indexOf(v) !== -1;
  }
  filterDefs.forEach(function (def) {
    const row = document.getElementById(def.el);
    def.opts.forEach(function (o) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.textContent = o.l;
      b.addEventListener("click", function () {
        if (def.single) state[def.key] = o.v;
        else if (o.v === null) state[def.key] = [];
        else { const arr = state[def.key], i = arr.indexOf(o.v); if (i === -1) arr.push(o.v); else arr.splice(i, 1); }
        render();
      });
      row.appendChild(b); o.btn = b;
    });
  });

  const q = document.getElementById("q");
  q.addEventListener("input", function () { state.q = q.value.trim().toLowerCase(); render(); });
  document.getElementById("clear").addEventListener("click", function () {
    state.players = null; state.time = null; state.weight = []; state.style = []; state.q = ""; q.value = "";
    render();
  });
  // Keep More filters open if one of them is already set
  if (state.players !== null || state.time !== null || state.style.length) document.getElementById("more").open = true;

  function matches(g) {
    if (state.players !== null) {
      const r = LIB.effPlayers(g), n = state.players;
      if (n === 8 ? r[1] < 8 : (n < r[0] || n > r[1])) return false;
    }
    if (state.time !== null && g.time[0] > state.time) return false;
    if (state.weight.length && state.weight.indexOf(P.tier(g.weight).n) === -1) return false;
    if (state.style.length && state.style.indexOf(g.style) === -1) return false;
    if (state.q) {
      const hay = [g].concat(LIB.kidsOf(g.id)).map(function (x) { return [x.name, x.publisher, x.tags.join(" "), x.style, x.owner || ""].join(" "); }).join(" ").toLowerCase();
      if (hay.indexOf(state.q) === -1) return false;
    }
    return true;
  }

  function card(g) {
    const t = P.tier(g.weight), own = g.players, eff = LIB.effPlayers(g), kids = LIB.kidsOf(g.id);
    const onBallot = draft.indexOf(g.id) !== -1;
    const hot = ["Unplayed", "In progress"];
    const kidWord = kids.every(function (k) { return k.kind === "expansion"; }) ? (kids.length === 1 ? "expansion" : "expansions") : (kids.length === 1 ? "set" : "sets");
    const kidHtml = kids.length ? '<details class="kids"><summary>' + kids.length + " " + kidWord + '</summary><div class="kids__list">' + kids.map(function (k) {
      return '<div class="kid">' +
        '<div><span class="kid__name">' + P.esc(k.name) + '</span><span class="kid__kind">' + (k.kind === "expansion" ? "Expansion" : "Standalone") + "</span></div>" +
        '<div class="meta"><span>' + P.players(k.players) + "</span><span>" + P.range(k.time[0], k.time[1], " min") + "</span></div>" +
        '<p class="note">' + P.esc(k.notes) + "</p></div>";
    }).join("") + "</div></details>" : "";

    const action = LIB.isVotable(g)
      ? '<button type="button" class="btn btn--secondary btn--small' + (onBallot ? " is-on" : "") + '" data-ballot="' + P.esc(g.id) + '" aria-pressed="' + onBallot + '">' + (onBallot ? "On my ballot" : "Add to ballot") + "</button>"
      : '<span class="off-ballot">Not on the ballot</span>';

    return '<article class="card">' +
      '<div class="card__top"><div><h2 class="card__name">' + P.esc(g.name) + '</h2><div class="card__pub">' + P.esc(g.publisher) + "</div></div>" +
      '<span class="style-tag">' + P.esc(g.style) + "</span></div>" +
      '<div class="meta">' +
        "<span>" + P.players(own) + "</span>" +
        "<span>" + P.range(g.time[0], g.time[1], " min") + "</span>" +
        "<span>Ages " + g.age + "+</span>" +
        '<span class="diff" title="BoardGameGeek weight ' + g.weight.toFixed(1) + ' of 5">' + P.pips(g.weight) + "<span>" + t.label + "</span></span>" +
      "</div>" +
      (eff[1] > own[1] ? '<span class="boost">Up to ' + (eff[1] >= 99 ? "any number of" : eff[1]) + " players with the expansion</span>" : "") +
      (g.owner ? '<span class="owner">From ' + P.esc(g.owner) + "'s shelf</span>" : "") +
      '<p class="note">' + P.esc(g.notes) + "</p>" +
      (g.tags.length ? '<div class="tags">' + g.tags.map(function (x) { return '<span class="tag' + (hot.indexOf(x) !== -1 ? " tag--hot" : "") + '">' + P.esc(x) + "</span>"; }).join("") + "</div>" : "") +
      kidHtml +
      '<div class="card__foot"><a class="text-link" href="' + P.videoUrl(g) + '" target="_blank" rel="noopener">Watch how to play</a>' + action + "</div>" +
      "</article>";
  }

  function renderTray() {
    const tray = document.getElementById("tray");
    document.body.classList.toggle("has-tray", draft.length > 0);
    if (!draft.length) { tray.hidden = true; return; }
    tray.hidden = false;
    const names = draft.map(function (id) { return LIB.byId[id] ? LIB.byId[id].name : id; });
    document.getElementById("trayText").textContent = draft.length + " of 3: " + names.join(", ");
  }

  function render() {
    filterDefs.forEach(function (def) { def.opts.forEach(function (o) { o.btn.setAttribute("aria-pressed", isOn(def, o.v)); }); });
    const extra = (state.players !== null ? 1 : 0) + (state.time !== null ? 1 : 0) + state.style.length;
    document.getElementById("moreLabel").textContent = extra ? "More filters (" + extra + ")" : "More filters";
    const active = extra || state.weight.length || state.q;
    document.getElementById("clear").hidden = !active;

    const rows = LIB.top.filter(matches);
    document.getElementById("list").innerHTML = rows.length ? rows.map(card).join("") :
      '<p class="empty">No games match. Try fewer filters.</p>';
    document.getElementById("count").textContent = rows.length === LIB.top.length ? LIB.top.length + " games" : rows.length + " of " + LIB.top.length + " games";
    renderTray();
    P.writeStore(STATE_KEY, { players: state.players, time: state.time, weight: state.weight, style: state.style });
  }

  document.getElementById("list").addEventListener("click", function (e) {
    const b = e.target.closest("[data-ballot]");
    if (!b) return;
    const id = b.getAttribute("data-ballot"), i = draft.indexOf(id);
    if (i !== -1) draft.splice(i, 1);
    else if (draft.length >= 3) {
      document.getElementById("tray").hidden = false;
      document.getElementById("trayText").textContent = "Your ballot is full. Remove a game first.";
      return;
    } else draft.push(id);
    P.setDraft(draft);
    render();
  });

  P.loadJSON("data/games.json").then(function (games) {
    LIB = P.indexGames(games);
    draft = draft.filter(function (id) { return LIB.isVotable(LIB.byId[id]); });
    P.setDraft(draft);
    render();
  }).catch(function () {
    document.getElementById("list").innerHTML = '<p class="empty">The game list didn\'t load. Refresh the page to try again.</p>';
  });
})();
