// The signed-in dashboard. Reads the session saved by account.js and calls the ERP API.
window.addEventListener("DOMContentLoaded", function () {
  var config = window.ERP_CONFIG || {};
  var api = (config.apiBase || "").replace(/\/$/, "");
  var session = null;
  try { session = JSON.parse(sessionStorage.getItem("qavril-session") || "null"); } catch (e) { session = null; }
  var data = null;
  var kind = "sale";

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function show(state) {
    $$("[data-state]").forEach(function (el) { el.hidden = el.getAttribute("data-state") !== state; });
  }

  function bind(name, text) {
    $$('[data-bind="' + name + '"]').forEach(function (el) { el.textContent = text; });
  }

  function call(method, path, body) {
    return fetch(api + path, {
      method: method,
      headers: Object.assign({ authorization: "Bearer " + session.token }, body ? { "content-type": "application/json" } : {}),
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (response) {
      return response.text().then(function (text) {
        var json = null;
        try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
        if (response.status === 401) {
          try { sessionStorage.removeItem("qavril-session"); } catch (e) { /* storage blocked */ }
          show("signed-out");
          throw new Error("signed-out");
        }
        if (!response.ok) {
          var err = new Error((json && json.error && json.error.message) || "Something went wrong. Try again.");
          err.status = response.status;
          throw err;
        }
        return json;
      });
    });
  }

  // Money arrives as decimal strings; format for display only, never for arithmetic.
  function money(decimal) {
    var negative = String(decimal).charAt(0) === "-";
    var parts = String(decimal).replace("-", "").split(".");
    var whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    var text = whole + (parts[1] ? "." + parts[1] : "");
    return (negative ? "−" : "") + symbol() + text;
  }

  function symbol() {
    var code = data ? data.company.currency : "USD";
    var known = { USD: "$", EUR: "€", GBP: "£", INR: "₹" };
    return known[code] || code + " ";
  }

  function greeting() {
    var hour = new Date().getHours();
    return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  }

  function load() {
    if (!session || !session.token || !api) { show("signed-out"); return; }
    call("GET", "/v1/workspace/overview")
      .then(function (overview) {
        data = overview;
        bind("workspace", overview.workspace.slug);
        if (!overview.booksReady) { show("setup"); return; }
        render();
        show("ready");
      })
      .catch(function (error) {
        if (error.message === "signed-out") return;
        $(".app-loading").textContent = "We couldn't load your books. " + error.message;
      });
  }

  function render() {
    bind("company", data.company.name);
    bind("currency", data.company.currency);
    bind("asOf", data.asOf);
    bind("greeting", greeting() + ".");
    $$("[data-total]").forEach(function (el) { countUp(el, data.totals[el.getAttribute("data-total")]); });

    // Accounts table.
    $(".accounts-table tbody").innerHTML = "";
    data.accounts.forEach(function (a) {
      var tr = document.createElement("tr");
      [a.code, a.name, money(a.balance)].forEach(function (text, i) {
        var td = document.createElement("td");
        td.textContent = text;
        if (i === 2) td.className = "num";
        tr.appendChild(td);
      });
      $(".accounts-table tbody").appendChild(tr);
    });

    // Recent entries.
    var list = $(".recent-list");
    list.innerHTML = "";
    $(".recent-empty").hidden = data.recent.length > 0;
    data.recent.forEach(function (e) {
      var li = document.createElement("li");
      var left = document.createElement("div");
      var title = document.createElement("strong");
      title.textContent = e.memo || e.reference;
      var meta = document.createElement("span");
      meta.className = "fine";
      meta.textContent = e.date + " · " + e.reference + (e.reversal ? " · reversal" : "");
      left.appendChild(title);
      left.appendChild(meta);
      var amount = document.createElement("span");
      amount.className = "recent-amount";
      amount.textContent = money(e.amount);
      li.appendChild(left);
      li.appendChild(amount);
      list.appendChild(li);
    });

    renderTrend();
    fillAccounts();
    renderCity();
    renderCrew();
  }

  // ---- Bot crew. Each bot reads the overview figures and says what it found and what it would do.
  function num(decimal) { return parseFloat(decimal || "0"); }
  function pct(a, b) { return b === 0 ? null : Math.round(((a - b) / Math.abs(b)) * 100); }
  function balance(code) {
    var a = data.accounts.filter(function (x) { return x.code === code; })[0];
    return a ? a.balance : "0.00";
  }

  function crewReports() {
    var t = data.totals;
    var ins = data.insights;
    var now = data.trend[data.trend.length - 1];
    var prev = data.trend[data.trend.length - 2];
    var reports = [];

    // Ledger Lou: does everything balance, and is the month tidy?
    var debitSide = 0, creditSide = 0;
    data.accounts.forEach(function (a) {
      if (a.type === "ASSET" || a.type === "EXPENSE") debitSide += num(a.balance); else creditSide += num(a.balance);
    });
    reports.push({
      name: "Ledger Lou", role: "Month-end checker", colour: "#3de8ff",
      state: ins.entriesWithoutNote > 0 ? "watch" : "good",
      found: "Your books balance to the cent: " + money(debitSide.toFixed(2)) + " on each side. " +
        ins.entriesThisMonth + " entr" + (ins.entriesThisMonth === 1 ? "y" : "ies") + " this month.",
      next: ins.entriesWithoutNote > 0
        ? ins.entriesWithoutNote + " entr" + (ins.entriesWithoutNote === 1 ? "y has" : "ies have") + " no note. I'd ask you to add one before month-end, so your accountant knows what each was for."
        : "Month-end checklist is clear. When you close the month, nothing can be posted into it by accident.",
      balanced: Math.abs(debitSide - creditSide) < 0.005,
    });

    // Chase Chloe: who owes you money?
    var owed = num(t.receivable);
    reports.push({
      name: "Chase Chloe", role: "Payment reminders", colour: "#ffe14d",
      state: owed > 0 ? "act" : "good",
      found: owed > 0 ? "Customers owe you " + money(t.receivable) + "." : "No one owes you money right now.",
      next: owed > 0
        ? "I've drafted a friendly reminder for you to approve."
        : "Record a sale paid by \"Customer will pay later\" and I'll draft the reminder for you.",
      draft: owed > 0
        ? "Hi! A friendly reminder that " + money(t.receivable) + " is due to " + data.company.name + ". You can pay by bank transfer. Thank you!"
        : null,
    });

    // Forecast Finn: where is cash heading?
    var active = data.trend.filter(function (m) { return num(m.revenue) !== 0 || num(m.expenses) !== 0; });
    var avgNet = active.length ? active.reduce(function (s2, m) { return s2 + num(m.revenue) - num(m.expenses); }, 0) / active.length : 0;
    var cash = num(t.cash);
    reports.push({
      name: "Forecast Finn", role: "Cash forecast", colour: "#8b6bff",
      state: active.length === 0 ? "idle" : (cash + avgNet * 3 < 0 ? "act" : avgNet < 0 ? "watch" : "good"),
      found: active.length === 0
        ? "I need a little history: record a few sales and expenses."
        : "You make " + money(avgNet.toFixed(2)) + " a month on average after expenses.",
      next: active.length === 0
        ? "Then I'll project your cash 30, 60 and 90 days out."
        : avgNet < 0
          ? "At this pace cash lasts about " + (avgNet < 0 && cash > 0 ? Math.max(0, Math.floor(cash / -avgNet)) + " months" : "no time") + ". I'd look at your biggest costs first."
          : "Cash keeps growing at this pace. Here's the projection:",
      forecast: active.length === 0 ? null : [1, 2, 3].map(function (m) { return { label: m * 30 + " days", value: (cash + avgNet * m).toFixed(2) }; }),
    });

    // Guard Gus: anything unusual?
    var flags = [];
    ins.duplicates.forEach(function (d) { flags.push("Possible double entry on " + d.date + ": " + d.references.join(" and ") + "."); });
    if (ins.largestExpense && ins.expenseCount >= 3 && num(ins.largestExpense.amount) > 3 * num(ins.averageExpense)) {
      flags.push((ins.largestExpense.memo || ins.largestExpense.reference) + " (" + money(ins.largestExpense.amount) + ") is more than 3 times your usual expense of " + money(ins.averageExpense) + ".");
    }
    if (num(now.expenses) > num(now.revenue) && num(now.revenue) > 0) flags.push("This month's expenses are higher than sales.");
    reports.push({
      name: "Guard Gus", role: "Duplicates and anomalies", colour: "#ff4fa3",
      state: flags.length ? "act" : "good",
      found: flags.length ? flags.length + " thing" + (flags.length === 1 ? "" : "s") + " to check." : "Nothing unusual in " + (ins.expenseCount + data.recent.length > 0 ? "your entries so far." : "your books yet."),
      next: flags.length ? flags.join(" ") : "I watch every entry for double payments and unusual amounts, and flag them for you to review.",
    });

    // Pip: how are sales moving?
    var change = pct(num(now.revenue), num(prev.revenue));
    reports.push({
      name: "Pip", role: "Sales follow-up", colour: "#c6ff3d",
      state: num(now.revenue) === 0 ? "idle" : "good",
      found: num(now.revenue) === 0
        ? "No sales recorded this month yet."
        : "Sales this month: " + money(now.revenue) + (change === null ? "." : " (" + (change >= 0 ? "up " : "down ") + Math.abs(change) + "% on last month)."),
      next: num(now.revenue) === 0
        ? "Record a sale and I'll start tracking your pace and suggest who to follow up with."
        : change !== null && change < 0
          ? "I'd follow up with last month's customers this week to win the gap back."
          : "Nice pace. I'll draft follow-ups for repeat customers so it keeps going.",
    });

    // Restock Rex: are you selling stock you are not tracking?
    var stock = num(ins.stock);
    var payable = num(t.payable);
    reports.push({
      name: "Restock Rex", role: "Restocking and bills", colour: "#ff8a3d",
      state: payable > 0 ? "watch" : num(now.revenue) > 0 && stock === 0 ? "idle" : "good",
      found: payable > 0
        ? "You owe suppliers " + money(t.payable) + "."
        : stock > 0 ? "Stock on hand: " + money(ins.stock) + "." : "No stock is tracked yet.",
      next: payable > 0
        ? "I'd schedule the payment before it's due, so suppliers keep you on good terms."
        : stock > 0
          ? "I'll suggest a reorder before shelves run low."
          : "Track stock purchases and I'll draft purchase orders before you run out.",
    });
    return reports;
  }

  var lastCrew = {};
  function renderCrew() {
    var grid = $(".crew-grid");
    if (!grid) return;
    var labels = { good: "All good", watch: "Worth a look", act: "Needs you", idle: "Waiting for data" };
    var icons = { good: "✓", watch: "!", act: "●", idle: "…" };
    grid.innerHTML = "";
    crewReports().forEach(function (r) {
      var card = document.createElement("article");
      card.className = "crew-card crew-" + r.state;
      card.style.setProperty("--bot", r.colour);
      var key = r.found + r.next;
      if (lastCrew[r.name] !== undefined && lastCrew[r.name] !== key) card.classList.add("crew-changed");
      lastCrew[r.name] = key;

      var head = document.createElement("div");
      head.className = "crew-card-head";
      var avatar = document.createElement("span");
      avatar.className = "crew-avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = r.name.charAt(0);
      var who = document.createElement("div");
      var name = document.createElement("strong");
      name.textContent = r.name;
      var role = document.createElement("span");
      role.className = "fine";
      role.textContent = r.role;
      who.appendChild(name);
      who.appendChild(role);
      var state = document.createElement("span");
      state.className = "crew-state";
      state.textContent = icons[r.state] + " " + labels[r.state];
      head.appendChild(avatar);
      head.appendChild(who);
      head.appendChild(state);
      card.appendChild(head);

      var found = document.createElement("p");
      found.className = "crew-found";
      found.textContent = r.found;
      card.appendChild(found);
      var next = document.createElement("p");
      next.className = "crew-next";
      next.textContent = r.next;
      card.appendChild(next);

      if (r.forecast) {
        var row = document.createElement("div");
        row.className = "crew-forecast";
        r.forecast.forEach(function (f) {
          var cell = document.createElement("span");
          var label = document.createElement("small");
          label.textContent = f.label;
          var value = document.createElement("b");
          value.textContent = money(f.value);
          cell.appendChild(label);
          cell.appendChild(value);
          row.appendChild(cell);
        });
        card.appendChild(row);
      }
      if (r.draft) {
        var draft = document.createElement("blockquote");
        draft.className = "crew-draft";
        draft.textContent = r.draft;
        card.appendChild(draft);
        var copy = document.createElement("button");
        copy.type = "button";
        copy.className = "btn btn-sm btn-lime";
        copy.textContent = "Copy reminder";
        copy.addEventListener("click", function () {
          var done = function () { copy.textContent = "Copied!"; };
          if (navigator.clipboard) navigator.clipboard.writeText(r.draft).then(done, done); else done();
        });
        card.appendChild(copy);
      }
      grid.appendChild(card);
    });
    var stamp = new Date();
    bind("crew-updated", "Live · updated " + stamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  }

  var motionOk = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  // KPI numbers count up from their previous value. The final text is always the exact decimal.
  function countUp(el, decimal) {
    var to = parseFloat(decimal);
    var from = parseFloat(el.getAttribute("data-value") || "0");
    el.setAttribute("data-value", String(to));
    // Hidden tabs do not run animation frames, so show the final figure straight away there.
    if (!motionOk || from === to || document.hidden) { el.textContent = money(decimal); return; }
    var places = (String(decimal).split(".")[1] || "").length;
    var start = null;
    function step(now) {
      if (start === null) start = now;
      var p = Math.min((now - start) / 900, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      if (p < 1) {
        el.textContent = money((from + (to - from) * eased).toFixed(places));
        requestAnimationFrame(step);
      } else {
        el.textContent = money(decimal);
        el.parentElement.classList.toggle("kpi-bump", false);
        void el.parentElement.offsetWidth;
        el.parentElement.classList.toggle("kpi-bump", true);
      }
    }
    requestAnimationFrame(step);
  }

  // The 3D city loads once, on desktops that allow motion; later calls just feed it new data.
  var city = null;
  var cityLoading = false;
  function renderCity() {
    var host = $(".app-city");
    if (!host || !motionOk || !finePointer) return;
    if (city) { city.update(data); return; }
    if (cityLoading) return;
    cityLoading = true;
    import("./app3d.js?v=3")
      .then(function (mod) {
        city = mod.mount(host, data, data.trend.map(function (r) { return monthName(r.month); }));
        host.classList.add("is-live");
      })
      .catch(function () { host.hidden = true; });
  }

  // KPI tiles tilt slightly toward the pointer.
  if (motionOk && finePointer) {
    $$(".kpi").forEach(function (tile) {
      tile.addEventListener("pointermove", function (e) {
        var r = tile.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        tile.style.transform = "perspective(600px) rotateX(" + (-y * 8) + "deg) rotateY(" + (x * 10) + "deg) translateY(-3px)";
      });
      tile.addEventListener("pointerleave", function () { tile.style.transform = ""; });
    });
  }

  // Grouped bars, sales vs expenses per month. Colours match the validated homepage palette.
  function renderTrend() {
    var rows = data.trend;
    var values = rows.map(function (r) { return [parseFloat(r.revenue), parseFloat(r.expenses)]; });
    var max = Math.max.apply(null, [].concat.apply([], values).concat([1]));
    var W = 560, H = 220, top = 12, bottom = 28, left = 8;
    var plotH = H - top - bottom;
    var groupW = (W - left) / rows.length;
    var barW = Math.min(26, groupW / 3);
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Sales and expenses by month">';
    for (var g = 0; g <= 4; g += 1) {
      var gy = top + plotH - (plotH * g) / 4;
      svg += '<line class="roi-grid" x1="0" x2="' + W + '" y1="' + gy + '" y2="' + gy + '"/>';
    }
    rows.forEach(function (r, i) {
      var cx = left + groupW * i + groupW / 2;
      [["after", values[i][0], "Sales", r.revenue], ["before", values[i][1], "Expenses", r.expenses]].forEach(function (b, j) {
        var h = b[1] > 0 ? Math.max((plotH * b[1]) / max, 3) : 0;
        var x = cx - barW - 1 + j * (barW + 2);
        var y = top + plotH - h;
        var tip = monthName(r.month) + " · " + b[2] + ": " + money(b[3]);
        svg += '<g class="roi-bar" data-tip="' + tip.replace(/"/g, "&quot;") + '">' +
          '<rect class="hit" x="' + x + '" y="' + top + '" width="' + barW + '" height="' + plotH + '"/>' +
          (h > 0 ? '<path class="bar-' + b[0] + '" d="' + columnPath(x, y, barW, h) + '"/>' : "") + "</g>";
      });
      svg += '<text class="roi-value" text-anchor="middle" x="' + cx + '" y="' + (H - 8) + '">' + monthName(r.month) + "</text>";
    });
    svg += "</svg>";
    $(".trend-chart").innerHTML = svg;
    $("#trend-table tbody").innerHTML = rows.map(function (r) {
      return "<tr><th scope=\"row\">" + monthName(r.month) + "</th><td>" + money(r.revenue) + "</td><td>" + money(r.expenses) + "</td></tr>";
    }).join("");
  }

  // A column with a 4px rounded top and a square base on the baseline.
  function columnPath(x, y, w, h) {
    var r = Math.min(4, w / 2, h);
    return "M" + x + "," + (y + h) + "V" + (y + r) + "Q" + x + "," + y + " " + (x + r) + "," + y +
      "H" + (x + w - r) + "Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) + "V" + (y + h) + "Z";
  }

  function monthName(ym) {
    var d = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1));
    return d.toLocaleString(undefined, { month: "short", timeZone: "UTC" });
  }

  var chart = $(".trend-chart");
  var tip = $(".app-trend .roi-tip");
  chart.addEventListener("pointermove", function (event) {
    var bar = event.target.closest(".roi-bar");
    if (!bar) { tip.hidden = true; return; }
    var box = $(".app-trend").getBoundingClientRect();
    tip.textContent = bar.getAttribute("data-tip");
    tip.hidden = false;
    tip.style.left = Math.min(event.clientX - box.left + 12, box.width - 200) + "px";
    tip.style.top = event.clientY - box.top + 12 + "px";
  });
  chart.addEventListener("pointerleave", function () { tip.hidden = true; });
  $(".app-trend .roi-toggle").addEventListener("click", function () {
    var table = $("#trend-table");
    table.hidden = !table.hidden;
    this.setAttribute("aria-expanded", String(!table.hidden));
    this.textContent = table.hidden ? "Show as a table" : "Hide the table";
  });

  // Quick entries.
  var form = $(".quick-form");
  form.elements.date.value = new Date().toISOString().slice(0, 10);

  function fillAccounts() {
    if (!data) return;
    var type = kind === "sale" ? "REVENUE" : "EXPENSE";
    var select = form.elements.account;
    select.innerHTML = "";
    data.accounts.filter(function (a) { return a.type === type; }).forEach(function (a) {
      var o = document.createElement("option");
      o.value = a.code;
      o.textContent = a.name;
      select.appendChild(o);
    });
    $('[data-for="sale expense"]').hidden = kind === "owner_investment" || kind === "customer_payment";
    var via = form.elements.via;
    var options = {
      sale: [["1100", "Bank"], ["1000", "Cash on hand"], ["1200", "Customer will pay later"]],
      expense: [["1100", "Bank"], ["1000", "Cash on hand"], ["2000", "Bill to pay later"]],
      customer_payment: [["1100", "Bank"], ["1000", "Cash on hand"]],
      owner_investment: [["1100", "Bank"], ["1000", "Cash on hand"]],
    }[kind];
    via.innerHTML = "";
    options.forEach(function (o) {
      var opt = document.createElement("option");
      opt.value = o[0];
      opt.textContent = o[1];
      via.appendChild(opt);
    });
    bind("via-label", kind === "expense" ? "Paid from" : kind === "sale" ? "Paid into" : "Money went into");
    bind("quick-submit", {
      sale: "Record sale", expense: "Record expense", customer_payment: "Record payment", owner_investment: "Record money in",
    }[kind]);
  }

  $$(".quick-tabs [data-kind]").forEach(function (tab) {
    tab.addEventListener("click", function () {
      kind = tab.getAttribute("data-kind");
      $$(".quick-tabs [data-kind]").forEach(function (t) { t.setAttribute("aria-selected", String(t === tab)); });
      fillAccounts();
    });
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var status = $(".status", form);
    if (!form.checkValidity()) {
      form.reportValidity();
      status.textContent = "Enter an amount like 1250 or 1250.50, and a date.";
      status.className = "status full err";
      return;
    }
    var body = { kind: kind, amount: form.elements.amount.value.trim(), date: form.elements.date.value, via: form.elements.via.value };
    if (kind !== "owner_investment") body.account = form.elements.account.value;
    if (form.elements.memo.value.trim()) body.memo = form.elements.memo.value.trim();
    var button = $("button[type=submit]", form);
    button.disabled = true;
    status.textContent = "Posting to your books…";
    status.className = "status full";
    call("POST", "/v1/workspace/quick-entries", body)
      .then(function (result) {
        form.elements.amount.value = "";
        form.elements.memo.value = "";
        status.textContent = "Posted as " + result.reference + ". Updating your figures…";
        return call("GET", "/v1/workspace/overview").then(function (overview) {
          data = overview;
          render();
          status.textContent = "Done! Posted as " + result.reference + ". Your figures are updated.";
          status.className = "status full ok";
        });
      })
      .catch(function (error) {
        if (error.message === "signed-out") return;
        status.textContent = error.message;
        status.className = "status full err";
      })
      .finally(function () { button.disabled = false; });
  });

  $('[data-action="setup"]').addEventListener("click", function () {
    var button = this;
    button.disabled = true;
    bind("setup-status", "Opening your books…");
    call("POST", "/v1/workspace/starter-books")
      .then(load)
      .catch(function (error) { if (error.message !== "signed-out") bind("setup-status", error.message); })
      .finally(function () { button.disabled = false; });
  });

  $('[data-action="signout"]').addEventListener("click", function () {
    var done = function () {
      try { sessionStorage.removeItem("qavril-session"); } catch (e) { /* storage blocked */ }
      window.location.href = "signin.html";
    };
    if (session && session.token && api) call("POST", "/v1/auth/logout").then(done, done); else done();
  });

  load();
});
