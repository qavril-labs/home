// Time-back calculator on the homepage. The visitor enters their own hours; the chart and totals
// redraw from those inputs. The share of each task the bots take over is a stated, editable assumption.
(function () {
  var root = document.querySelector("[data-roi]");
  if (!root) return;

  var form = root.querySelector(".roi-inputs");
  var chart = root.querySelector(".roi-chart");
  var tableBody = root.querySelector(".roi-table tbody");
  var tip = root.querySelector(".roi-tip");
  var outHours = root.querySelector("[data-out=hours]");
  var outDays = root.querySelector("[data-out=days]");
  var outValue = root.querySelector("[data-out=value]");

  var tasks = [
    { key: "invoicing", label: "Invoicing and data entry" },
    { key: "reconcile", label: "Bank matching and month-end" },
    { key: "chasing", label: "Chasing late payments" },
    { key: "stock", label: "Stock checks and reorders" },
  ];

  function num(name) {
    var field = form.elements[name];
    var value = parseFloat(field && field.value);
    return isFinite(value) && value >= 0 ? value : 0;
  }

  function esc(text) {
    return String(text).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function fmt(n) {
    return n >= 10 ? Math.round(n).toLocaleString() : (Math.round(n * 10) / 10).toLocaleString();
  }

  function render() {
    var share = Math.min(num("share"), 100) / 100;
    var rate = num("rate");
    var rows = tasks.map(function (t) {
      var before = num(t.key);
      return { label: t.label, before: before, after: before * (1 - share) };
    });
    var saved = rows.reduce(function (sum, r) { return sum + r.before - r.after; }, 0);
    outHours.textContent = fmt(saved);
    outDays.textContent = fmt((saved * 48) / 8);
    outValue.textContent = "$" + Math.round(saved * 48 * rate).toLocaleString();

    // Horizontal grouped bars: one row per task, "By hand" above "With QAVRIL bots".
    var max = Math.max.apply(null, rows.map(function (r) { return r.before; }).concat([1]));
    var width = 560, labelW = 0, barH = 14, gap = 2, rowH = 64, top = 8, right = 64;
    var plotW = width - labelW - right;
    var height = top + rows.length * rowH;
    var svg = '<svg viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="Hours per week by task, by hand and with QAVRIL bots">';
    // Recessive vertical grid at quarter steps.
    for (var g = 0; g <= 4; g += 1) {
      var gx = labelW + (plotW * g) / 4;
      svg += '<line class="roi-grid" x1="' + gx + '" x2="' + gx + '" y1="0" y2="' + height + '"/>';
    }
    rows.forEach(function (r, i) {
      var y = top + i * rowH;
      svg += '<text class="roi-label" x="0" y="' + (y + 10) + '">' + esc(r.label) + "</text>";
      [["before", r.before, "By hand"], ["after", r.after, "With QAVRIL bots"]].forEach(function (b, j) {
        var w = Math.max((plotW * b[1]) / max, b[1] > 0 ? 4 : 0);
        var by = y + 18 + j * (barH + gap);
        var tipText = r.label + " · " + b[2] + ": " + fmt(b[1]) + " h/week";
        svg += '<g class="roi-bar" data-tip="' + esc(tipText) + '">' +
          '<rect class="hit" x="' + labelW + '" y="' + (by - 1) + '" width="' + plotW + '" height="' + (barH + 2) + '"/>' +
          '<path class="bar-' + b[0] + '" d="' + barPath(labelW, by, w, barH) + '"/>' +
          '<text class="roi-value" x="' + (labelW + w + 6) + '" y="' + (by + barH - 3) + '">' + fmt(b[1]) + " h</text></g>";
      });
    });
    svg += "</svg>";
    chart.innerHTML = svg;

    tableBody.innerHTML = rows.map(function (r) {
      return "<tr><th scope=\"row\">" + esc(r.label) + "</th><td>" + fmt(r.before) + "</td><td>" + fmt(r.after) + "</td></tr>";
    }).join("");
  }

  // A bar with a 4px rounded data end and a square baseline end.
  function barPath(x, y, w, h) {
    if (w <= 0) return "";
    var r = Math.min(4, w / 2, h / 2);
    return "M" + x + "," + y + "H" + (x + w - r) + "Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) +
      "V" + (y + h - r) + "Q" + (x + w) + "," + (y + h) + " " + (x + w - r) + "," + (y + h) + "H" + x + "Z";
  }

  chart.addEventListener("pointermove", function (event) {
    var bar = event.target.closest(".roi-bar");
    if (!bar) { tip.hidden = true; return; }
    var box = chart.getBoundingClientRect();
    tip.textContent = bar.getAttribute("data-tip");
    tip.hidden = false;
    tip.style.left = Math.min(event.clientX - box.left + 12, box.width - 220) + "px";
    tip.style.top = event.clientY - box.top + 12 + "px";
  });
  chart.addEventListener("pointerleave", function () { tip.hidden = true; });

  var toggle = root.querySelector(".roi-toggle");
  var table = root.querySelector(".roi-table");
  toggle.addEventListener("click", function () {
    var open = table.hidden;
    table.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "Hide the table" : "Show as a table";
  });

  form.addEventListener("input", render);
  render();
})();
