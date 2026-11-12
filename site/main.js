(function () {
  "use strict";
  document.documentElement.classList.remove("no-js");
  document.documentElement.classList.add("js");

  var config = window.ERP_CONFIG || {};
  var form = document.getElementById("lead-form");
  var status = document.getElementById("form-status");
  var submit = form ? form.querySelector("button[type=submit]") : null;

  // Attribution: remember which campaign brought the visitor. Only the campaign name is read from the URL.
  var params = new URLSearchParams(window.location.search);
  var source = (params.get("utm_source") || "direct").slice(0, 100);

  // A pricing link such as book.html?plan=growth names the plan in the request.
  var presetPlan = (params.get("plan") || "").slice(0, 40);

  // A link such as book.html?interest=trial preselects the request type.
  var presetInterest = params.get("interest");
  var interestField = document.getElementById("f-interest") || document.getElementById("b-interest");
  if (interestField && ["demo", "trial", "early_access", "partner"].indexOf(presetInterest) !== -1) {
    interestField.value = presetInterest;
  }

  // CTAs that preselect what the visitor wants in the form.
  document.querySelectorAll("[data-interest]").forEach(function (link) {
    link.addEventListener("click", function () {
      var select = document.getElementById("f-interest");
      if (select) select.value = link.getAttribute("data-interest");
    });
  });

  function setStatus(message, kind) {
    if (!status) return;
    status.textContent = message;
    status.className = "status" + (kind ? " " + kind : "");
  }

  // The visitor's own time zone, so a slot can be read in their local time.
  function visitorTimeZone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch (error) {
      return "";
    }
  }

  // A trial is a waitlist place, so a slot is never sent with it.
  function slotFor(fields) {
    return String(fields.get("interest") || "") === "trial" ? "" : String(fields.get("slot") || "");
  }

  // Marks each invalid field and puts its message beside it, for screen readers and sighted visitors.
  function markInvalid(formEl) {
    formEl.querySelectorAll("[aria-invalid]").forEach(function (el) { el.removeAttribute("aria-invalid"); });
    formEl.querySelectorAll(".field-error").forEach(function (el) { el.remove(); });
    var first = null;
    formEl.querySelectorAll("input, select, textarea").forEach(function (el) {
      if (el.checkValidity()) return;
      el.setAttribute("aria-invalid", "true");
      var note = document.createElement("p");
      note.className = "field-error";
      note.textContent = el.validationMessage;
      var wrap = el.closest(".field");
      if (wrap) wrap.appendChild(note);
      if (!first) first = el;
    });
    if (first) first.focus();
  }

  // Shown when the request service is not connected. Nothing is sent or opened silently.
  function notConnected() {
    return "Requests are not connected on this page yet. Email " + config.contactEmail + " with your details and we will reply.";
  }

  // Turns an API error into a message the visitor can act on.
  function failureMessage(response) {
    if (response.status === 429) return "Too many tries from this network. Give it a few minutes.";
    if (response.status === 400) {
      return response.json().then(function (body) {
        var issue = body && body.error && body.error.details && body.error.details[0];
        var field = issue && issue.path && issue.path[0];
        var labels = { name: "your name", email: "a valid work email", interest: "what you want", consent: "the consent box", message: "your message" };
        if (field && labels[field]) return "Please check " + labels[field] + " and try again.";
        return "Please check the highlighted fields and try again.";
      }).catch(function () { return "Please check the fields and try again."; });
    }
    return Promise.resolve("Something went wrong on our side. Try again in a moment, or email " + config.contactEmail + ".");
  }

  if (form) {
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!form.checkValidity()) {
        markInvalid(form);
        setStatus("Fill in the highlighted fields and try again.", "err");
        return;
      }

      var fields = new FormData(form);
      var data = {
        name: String(fields.get("name") || "").trim(),
        email: String(fields.get("email") || "").trim(),
        company: String(fields.get("company") || "").trim(),
        country: String(fields.get("country") || "").trim(),
        interest: String(fields.get("interest") || ""),
        industry: String(fields.get("industry") || ""),
        message: String(fields.get("message") || "").trim(),
        consent: fields.get("consent") === "on",
        website: String(fields.get("website") || ""),
        source: source
      };

      data.slot = slotFor(fields);
      data.timezone = visitorTimeZone();
      if (presetPlan) data.message = "Plan of interest: " + presetPlan + (data.message ? "\n" + data.message : "");

      if (!config.apiBase) {
        setStatus(notConnected(), "err");
        return;
      }

      submit.disabled = true;
      setStatus("Sending...", "");
      try {
        var response = await fetch(config.apiBase.replace(/\/$/, "") + "/v1/public/leads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(data)
        });
        if (response.status === 201) {
          form.reset();
          setStatus("Thanks. We have your request and will reply by email.", "ok");
        } else {
          setStatus(await failureMessage(response), "err");
        }
      } catch (error) {
        setStatus("We could not reach the server. Check your connection and try again, or email " + config.contactEmail + ".", "err");
      } finally {
        submit.disabled = false;
      }
    });
  }

  // Scroll reveals. Everything shows if the browser cannot observe it, and after a short wait regardless.
  setTimeout(function () {
    document.querySelectorAll(".reveal:not(.is-visible)").forEach(function (el) { el.classList.add("is-visible"); });
  }, 3000);
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { observer.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }

  // Phone menu: opens the header links and tells assistive tech the state.
  var menuButton = document.querySelector(".menu-toggle");
  var menuLinks = document.getElementById("site-links");
  if (menuButton && menuLinks) {
    menuButton.addEventListener("click", function () {
      var open = menuButton.getAttribute("aria-expanded") !== "true";
      menuButton.setAttribute("aria-expanded", String(open));
      menuLinks.classList.toggle("is-open", open);
    });
    // Close the menu once a link is chosen, so the section is visible.
    menuLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        menuButton.setAttribute("aria-expanded", "false");
        menuLinks.classList.remove("is-open");
      });
    });
    // Close on Escape key
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && menuLinks.classList.contains("is-open")) {
        menuButton.setAttribute("aria-expanded", "false");
        menuLinks.classList.remove("is-open");
        menuButton.focus();
      }
    });
  }

  // 3D tilt for the hero scene: it follows the pointer on mouse-style devices only.
  var scene = document.querySelector(".hero-art");
  var fineHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var motionOk = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (scene && fineHover && motionOk) {
    var aim = { x: 0, y: 0 };
    var eased = { x: 0, y: 0 };
    scene.addEventListener("pointermove", function (event) {
      var box = scene.getBoundingClientRect();
      aim.x = ((event.clientX - box.left) / box.width - 0.5) * 2;
      aim.y = ((event.clientY - box.top) / box.height - 0.5) * 2;
    });
    scene.addEventListener("pointerleave", function () {
      aim.x = 0;
      aim.y = 0;
    });
    (function frame() {
      eased.x += (aim.x - eased.x) * 0.08;
      eased.y += (aim.y - eased.y) * 0.08;
      scene.style.setProperty("--rx", (-eased.y * 10).toFixed(2) + "deg");
      scene.style.setProperty("--ry", (eased.x * 12).toFixed(2) + "deg");
      requestAnimationFrame(frame);
    })();
  }

  // Light or dark theme. The visitor's choice is remembered on this device, and the system setting is the default.
  var themeButton = document.querySelector("[data-theme-toggle]");
  function currentTheme() {
    var set = document.documentElement.getAttribute("data-theme");
    if (set) return set;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    if (themeButton) {
      themeButton.setAttribute("aria-pressed", String(theme === "dark"));
      themeButton.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
    }
    try { localStorage.setItem("qavril-theme", theme); } catch (error) { /* private mode: the choice lasts this visit only */ }
  }
  if (themeButton) {
    themeButton.setAttribute("aria-pressed", String(currentTheme() === "dark"));
    themeButton.addEventListener("click", function () {
      applyTheme(currentTheme() === "dark" ? "light" : "dark");
    });
  }

  // Request dialog: "Book a demo" and "Request a free trial" open here, on the same page.
  // Without JavaScript or <dialog> support, the links still go to book.html.
  var canDialog = typeof HTMLDialogElement === "function";

  function requestDialog() {
    var existing = document.getElementById("request-modal");
    if (existing) return existing;
    var prefix = document.querySelector('link[rel="stylesheet"][href*="subpage.css"]') ? "../" : "";
    var dialog = document.createElement("dialog");
    dialog.id = "request-modal";
    dialog.className = "request-modal";
    dialog.setAttribute("aria-labelledby", "request-modal-title");
    dialog.innerHTML =
      '<form class="lead-form modal-form" method="dialog" novalidate>' +
      '<div class="modal-head"><h2 id="request-modal-title" class="modal-title"></h2>' +
      '<button type="button" class="modal-close" aria-label="Close">&times;</button></div>' +
      '<p class="modal-copy">We reply by email to confirm. Nothing is charged.</p>' +
      '<div class="field"><label for="m-name">Full name</label><input id="m-name" name="name" type="text" autocomplete="name" required maxlength="120"></div>' +
      '<div class="field"><label for="m-email">Work email</label><input id="m-email" name="email" type="email" autocomplete="email" required maxlength="254"></div>' +
      '<div class="field"><label for="m-company">Company</label><input id="m-company" name="company" type="text" autocomplete="organization" maxlength="160"></div>' +
      '<div class="field"><label for="m-interest">I want a</label><select id="m-interest" name="interest"><option value="demo">Demo slot</option><option value="trial">Free trial (request)</option></select></div>' +
      '<div class="field"><label for="m-slot">Preferred slot</label><select id="m-slot" name="slot"><option value="">No preference</option>' +
      ["Monday morning", "Monday afternoon", "Tuesday morning", "Tuesday afternoon", "Wednesday morning", "Wednesday afternoon", "Thursday morning", "Thursday afternoon", "Friday morning", "Friday afternoon"]
        .map(function (slot) { return "<option>" + slot + "</option>"; }).join("") +
      '</select></div>' +
      '<div class="field check"><input id="m-consent" name="consent" type="checkbox" required><label for="m-consent">I agree that QAVRIL LABS may store these details and contact me about my request. <a href="' + prefix + 'privacy.html">Privacy notice</a>.</label></div>' +
      '<div class="hp" aria-hidden="true"><label>Leave empty <input name="website" type="text" tabindex="-1" autocomplete="off"></label></div>' +
      '<div class="modal-actions"><button class="btn btn-lime" type="submit">Send my request</button>' +
      '<p class="status modal-status" role="status" aria-live="polite"></p></div>' +
      "</form>";
    document.body.appendChild(dialog);

    dialog.querySelector(".modal-close").addEventListener("click", function () { dialog.close(); });
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) dialog.close();
    });
    dialog.querySelector("form").addEventListener("submit", function (event) {
      event.preventDefault();
      submitRequest(dialog);
    });
    return dialog;
  }

  function submitRequest(dialog) {
    var form = dialog.querySelector("form");
    var status = dialog.querySelector(".modal-status");
    var button = form.querySelector("button[type=submit]");
    if (!form.checkValidity()) {
      markInvalid(form);
      status.textContent = "Fill in the highlighted fields and try again.";
      status.className = "status modal-status err";
      return;
    }
    var fields = new FormData(form);
    var data = {
      name: String(fields.get("name") || "").trim(),
      email: String(fields.get("email") || "").trim(),
      company: String(fields.get("company") || "").trim(),
      country: "",
      interest: String(fields.get("interest") || "demo"),
      industry: "",
      message: "",
      slot: slotFor(fields),
      timezone: visitorTimeZone(),
      consent: fields.get("consent") === "on",
      website: String(fields.get("website") || ""),
      source: source
    };
    if (!config.apiBase) {
      status.textContent = notConnected();
      status.className = "status modal-status err";
      return;
    }
    button.disabled = true;
    status.textContent = "Sending...";
    status.className = "status modal-status";
    fetch(config.apiBase.replace(/\/$/, "") + "/v1/public/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data)
    })
      .then(function (response) {
        if (response.status === 201) {
          form.reset();
          status.textContent = data.interest === "trial"
            ? "You're in! Watch your inbox: we email your free account details shortly."
            : "Booked! We email you to confirm your slot.";
          status.className = "status modal-status ok";
          return;
        }
        return failureMessage(response).then(function (message) {
          status.textContent = message;
          status.className = "status modal-status err";
        });
      })
      .catch(function () {
        status.textContent = "We could not reach the server. Check your connection and try again, or email " + config.contactEmail + ".";
        status.className = "status modal-status err";
      })
      .then(function () { button.disabled = false; });
  }

  if (canDialog) {
    document.addEventListener("click", function (event) {
      var trigger = event.target.closest ? event.target.closest("[data-modal]") : null;
      if (!trigger) return;
      event.preventDefault();
      var dialog = requestDialog();
      var trial = trigger.getAttribute("data-modal") === "trial";
      dialog.querySelector("select[name=interest]").value = trial ? "trial" : "demo";
      // A trial is a waitlist place, so there is no slot to choose.
      dialog.querySelector("#m-slot").closest(".field").hidden = trial;
      dialog.querySelector(".modal-title").textContent = trial ? "Request a free trial" : "Book a demo slot";
      dialog.querySelector(".modal-status").textContent = "";
      dialog.querySelector(".modal-status").className = "status modal-status";
      dialog.showModal();
      dialog.querySelector("input[name=name]").focus();
    });
  }

  // 3D hero scene: loads after the page is ready, and only on desktops that allow motion.
  if (fineHover && motionOk && document.querySelector(".scene3d")) {
    window.addEventListener("load", function () {
      setTimeout(function () {
        import("./scene3d.js")
          .then(function (scene) {
            return scene.mount(document.querySelector(".scene3d"));
          })
          .catch(function () {
            // Without WebGL or the script, the CSS scene stays in place.
          });
      }, 400);
    });
  }

  // Cursor glow, only for mouse-style pointers and only when motion is allowed.
  var canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (canHover && !reduceMotion) {
    var glow = document.querySelector(".cursor-glow");
    if (glow) {
      document.documentElement.classList.add("has-fine-pointer");
      window.addEventListener("pointermove", function (event) {
        glow.style.left = event.clientX + "px";
        glow.style.top = event.clientY + "px";
      }, { passive: true });
    }
  }
})();
