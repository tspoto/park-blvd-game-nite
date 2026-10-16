// Vote page
(function () {
  const P = window.PBGN;
  let LIB = null, ROUND = null;
  let picks = P.getDraft();

  const X = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
  const UP = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 9l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const PTS = [3, 2, 1], ORD = ["First choice", "Second choice", "Third choice"];

  const form = document.getElementById("ballot");
  const nameEl = document.getElementById("name"), noteEl = document.getElementById("note");
  const search = document.getElementById("pickSearch");
  const errEl = document.getElementById("formError"), sendBtn = document.getElementById("send");

  function renderSlots() {
    let h = "";
    for (let i = 0; i < 3; i++) {
      const g = picks[i] && LIB.byId[picks[i]];
      if (g) {
        h += '<div class="slot is-filled"><span class="slot__rank">' + (i + 1) + "</span>" +
          '<span class="slot__body"><span class="slot__name">' + P.esc(g.name) + '</span><span class="slot__pts">' + ORD[i] + " · " + PTS[i] + " pts</span></span>" +
          '<span class="slot__tools">' +
            '<button type="button" class="icon-btn" data-up="' + i + '" aria-label="Move ' + P.esc(g.name) + ' up"' + (i === 0 ? " disabled" : "") + ">" + UP + "</button>" +
            '<button type="button" class="icon-btn" data-remove="' + i + '" aria-label="Remove ' + P.esc(g.name) + '">' + X + "</button>" +
          "</span></div>";
      } else {
        h += '<div class="slot"><span class="slot__rank">' + (i + 1) + '</span><span class="slot__body"><span class="hint">' + ORD[i] + "</span></span></div>";
      }
    }
    document.getElementById("slots").innerHTML = h;
  }

  function renderPicker() {
    const q = search.value.trim().toLowerCase(), full = picks.length >= 3;
    const rows = LIB.top.filter(LIB.isVotable).filter(function (g) {
      return !q || (g.name + " " + g.publisher + " " + g.tags.join(" ")).toLowerCase().indexOf(q) !== -1;
    });
    document.getElementById("pickList").innerHTML = rows.length ? rows.map(function (g) {
      const taken = picks.indexOf(g.id) !== -1, eff = LIB.effPlayers(g);
      const meta = taken ? "Picked" : P.players(eff) + " · " + P.range(g.time[0], g.time[1], " min");
      return '<button type="button" class="pick" data-add="' + P.esc(g.id) + '"' + (taken || full ? " disabled" : "") + ">" +
        '<span class="pick__name">' + P.esc(g.name) + '</span><span class="pick__meta">' + meta + "</span></button>";
    }).join("") : '<p class="empty">No games match that search.</p>';
  }

  function renderDates(checked) {
    document.getElementById("dates").innerHTML = ROUND.options.map(function (id) {
      const el = "date-" + id;
      return '<label class="check" for="' + el + '"><input type="checkbox" id="' + el + '" value="' + P.esc(id) + '"' + (checked.indexOf(id) !== -1 ? " checked" : "") + ">" +
        "<span><b>" + P.esc(P.dateLabel(id)) + "</b><small>" + P.esc(ROUND.time || "Time to be set") + "</small></span></label>";
    }).join("");
  }

  function renderAll() { renderSlots(); renderPicker(); }

  document.getElementById("slots").addEventListener("click", function (e) {
    const up = e.target.closest("[data-up]"), rm = e.target.closest("[data-remove]");
    if (up) { const i = +up.getAttribute("data-up"); if (i > 0) { const t = picks[i - 1]; picks[i - 1] = picks[i]; picks[i] = t; } }
    else if (rm) picks.splice(+rm.getAttribute("data-remove"), 1);
    else return;
    P.setDraft(picks); renderAll();
  });
  document.getElementById("pickList").addEventListener("click", function (e) {
    const b = e.target.closest("[data-add]");
    if (!b || b.disabled || picks.length >= 3) return;
    picks.push(b.getAttribute("data-add"));
    P.setDraft(picks); renderAll();
    errEl.hidden = true;
    if (picks.length === 3) document.getElementById("datesH").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  search.addEventListener("input", renderPicker);

  function showError(msg) { errEl.textContent = msg; errEl.hidden = false; }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errEl.hidden = true;
    const name = nameEl.value.trim();
    const dates = Array.prototype.map.call(document.querySelectorAll("#dates input:checked"), function (i) { return i.value; });
    if (!picks.length) { showError("Pick at least one game."); search.focus(); return; }
    if (!dates.length) { showError("Check at least one Saturday that might work."); return; }
    if (!name) { showError("Add your name so your ballot can be counted."); nameEl.focus(); return; }
    if (!P.canSend()) { showError("Voting isn't connected yet, so this can't be sent. Your picks are saved on this phone."); return; }

    const ballot = { type: "ballot", round: ROUND.id, name: name, picks: picks.slice(0, 3), dates: dates, note: noteEl.value.trim() };
    sendBtn.disabled = true; sendBtn.textContent = "Sending…";
    P.send(ballot).then(function () {
      P.writeStore(P.LAST_KEY, { name: ballot.name });
      const names = ballot.picks.map(function (id) { return LIB.byId[id].name; });
      document.getElementById("thanksText").textContent = "Thanks, " + ballot.name + ". You picked " + names.join(", ") + ", and " +
        (dates.length === ROUND.options.length ? "any of the dates work." : dates.map(function (d) { return P.dateLabel(d); }).join(" or ") + " might work.");
      document.getElementById("thanksText").textContent += " You can update it anytime before " + P.dateLabel(ROUND.votingCloses) + ".";
      form.hidden = true;
      document.getElementById("thanks").hidden = false;
      window.scrollTo(0, 0);
    }).catch(function () {
      showError("Your ballot didn't send. Check your connection and try again.");
    }).then(function () { sendBtn.disabled = false; sendBtn.textContent = "Send my ballot"; });
  });

  document.getElementById("editAgain").addEventListener("click", function () {
    document.getElementById("thanks").hidden = true;
    form.hidden = false;
  });

  function showNotOpen(season) {
    const box = document.getElementById("notOpen"), cur = season.current;
    document.getElementById("voteH").textContent = "Voting is closed";
    document.getElementById("voteLede").hidden = true;
    let h;
    if (!cur) {
      h = "<h2>That's a wrap on the season</h2><p>Thanks for playing. Watch for next season's schedule.</p>";
    } else if (cur.status === "upcoming") {
      h = "<h2>" + P.esc(cur.label) + " voting opens " + P.esc(P.dateLabel(cur.votingOpens)) + "</h2>" +
        "<p>Until then, browse the games and add a few to your ballot. They'll be waiting here.</p>";
    } else {
      const nxt = season.next(cur);
      h = "<h2>" + P.esc(cur.label) + " game night is " + P.esc(P.dateLabel(cur.lead, "long")) + "</h2>" +
        "<p>" + (nxt ? P.esc(nxt.label) + " voting opens " + P.esc(P.dateLabel(nxt.votingOpens)) + "." : "That's the last night of the season.") + " Come if you can.</p>";
    }
    box.innerHTML = h + '<div class="actions"><a class="btn" href="games.html">Browse the games</a><a class="btn btn--secondary" href="./">Home</a></div>';
    box.hidden = false;
  }

  Promise.all([P.loadJSON("data/games.json"), P.loadSeason()]).then(function (res) {
    LIB = P.indexGames(res[0]);
    const season = res[1];
    if (season.example) document.getElementById("exampleNotice").hidden = false;
    ROUND = season.open;
    if (!ROUND) { showNotOpen(season); return; }
    if (!P.canSend()) document.getElementById("closedNotice").hidden = false;
    document.getElementById("roundEyebrow").textContent = "Voting closes " + P.dateLabel(ROUND.votingCloses);
    document.getElementById("voteH").textContent = "Vote for " + ROUND.label;
    picks = picks.filter(function (id) { return LIB.isVotable(LIB.byId[id]); }).slice(0, 3);
    P.setDraft(picks);
    const last = P.readStore(P.LAST_KEY, null);
    if (last && last.name) nameEl.value = last.name;
    renderDates([]);
    renderAll();
    form.hidden = false;
  }).catch(function () {
    const box = document.getElementById("notOpen");
    box.innerHTML = '<p class="empty">The ballot didn\'t load. Refresh the page to try again.</p>';
    box.hidden = false;
  });
})();
