// Sign-up and sign-in forms. Both post to the ERP API set in config.js.
// The session token is kept in sessionStorage only, so it ends when the tab closes.
// Runs after the whole page has loaded, so config.js (loaded in the footer) has set ERP_CONFIG.
window.addEventListener("DOMContentLoaded", function () {
  var config = window.ERP_CONFIG || {};
  var api = (config.apiBase || "").replace(/\/$/, "");
  var SESSION_KEY = "qavril-session";

  function saveSession(value) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(value)); } catch (e) { /* storage blocked */ }
  }
  function loadSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch (e) { return null; }
  }
  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* storage blocked */ }
  }

  function setStatus(form, text, kind) {
    var status = form.querySelector(".status");
    status.textContent = text;
    status.className = "status full" + (kind ? " " + kind : "");
  }

  function markInvalid(form, name, message) {
    var field = form.elements[name];
    if (!field) return;
    field.setAttribute("aria-invalid", "true");
    if (message) field.setCustomValidity(message);
  }

  function clearInvalid(form) {
    Array.prototype.forEach.call(form.elements, function (el) {
      if (el.removeAttribute) el.removeAttribute("aria-invalid");
      if (el.setCustomValidity) el.setCustomValidity("");
    });
  }

  // Turns an API error into a sentence that says what went wrong and how to fix it.
  function explain(response, body) {
    var error = (body && body.error) || {};
    if (response.status === 429) return "Too many attempts from this connection. Wait a few minutes, then try again.";
    if (response.status === 401) return "That workspace, email and password don't match. Check all three and try again.";
    if (response.status === 409) return error.message || "That is already registered. Try signing in instead.";
    if (response.status === 400) {
      var issues = Array.isArray(error.details) ? error.details : [];
      var path = issues[0] && issues[0].path && issues[0].path[0];
      var hints = {
        password: "Your password needs at least 12 characters.",
        email: "Check your email address.",
        consent: "Tick the box to accept the terms and privacy notice.",
        baseCurrency: "Use a three-letter currency code, such as KES or USD.",
        company: "Add your business name.",
        name: "Add your name.",
      };
      return hints[path] || error.message || "Some details need another look. Check the highlighted fields.";
    }
    return "We couldn't reach the server. Check your connection and try again.";
  }

  function post(path, payload, token) {
    var headers = { "content-type": "application/json" };
    if (token) headers.authorization = "Bearer " + token;
    return fetch(api + path, { method: "POST", headers: headers, body: payload ? JSON.stringify(payload) : undefined })
      .then(function (response) {
        return response.text().then(function (text) {
          var body = null;
          try { body = text ? JSON.parse(text) : null; } catch (e) { body = null; }
          return { response: response, body: body };
        });
      });
  }

  function noApi(form) {
    setStatus(form, "Sign-up opens here shortly. Email " + (config.contactEmail || "us") + " and we will set up your workspace today.", "err");
  }

  function showReady(form, title, lines, actions) {
    var panel = document.createElement("div");
    panel.className = "account-ready";
    panel.setAttribute("tabindex", "-1");
    panel.innerHTML = "<h2></h2>" + lines.map(function () { return "<p></p>"; }).join("") + '<p class="cta-row"></p>';
    panel.querySelector("h2").textContent = title;
    var ps = panel.querySelectorAll("p");
    lines.forEach(function (line, i) { ps[i].textContent = line; });
    var row = panel.querySelector(".cta-row");
    actions.forEach(function (a) { row.appendChild(a); row.appendChild(document.createTextNode(" ")); });
    form.replaceWith(panel);
    panel.focus();
  }

  function link(text, href, cls) {
    var a = document.createElement("a");
    a.className = "btn " + cls;
    a.href = href;
    a.textContent = text;
    return a;
  }

  function signOutButton(session) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-ghost";
    b.textContent = "Sign out";
    b.addEventListener("click", function () {
      post("/v1/auth/logout", null, session.token).finally(function () {
        clearSession();
        window.location.href = "signin.html";
      });
    });
    return b;
  }

  // Sign-up.
  var signup = document.getElementById("signup-form");
  if (signup) {
    var country = signup.elements.countryCode;
    var currency = signup.elements.baseCurrency;
    var region = signup.elements.region;
    var syncCountry = function () {
      var option = country.options[country.selectedIndex];
      region.value = option.getAttribute("data-region");
    };
    country.addEventListener("change", syncCountry);
    syncCountry();
    signup.addEventListener("input", function () { clearInvalid(signup); });

    signup.addEventListener("submit", function (event) {
      event.preventDefault();
      clearInvalid(signup);
      if (!signup.checkValidity()) {
        signup.reportValidity();
        setStatus(signup, "Fill in the highlighted fields to create your workspace.", "err");
        return;
      }
      if (!api) return noApi(signup);
      var data = {
        name: signup.elements.name.value.trim(),
        email: signup.elements.email.value.trim(),
        password: signup.elements.password.value,
        company: signup.elements.company.value.trim(),
        countryCode: country.value,
        baseCurrency: currency.value.trim().toUpperCase(),
        region: region.value,
        consent: signup.elements.consent.checked,
        website: signup.elements.website.value,
      };
      var ws = signup.elements.workspace.value.trim().toLowerCase();
      if (ws) data.workspace = ws;
      var button = signup.querySelector("button[type=submit]");
      button.disabled = true;
      setStatus(signup, "Creating your workspace…", "");
      post("/v1/public/signup", data)
        .then(function (result) {
          if (result.response.status === 201) {
            var b = result.body;
            saveSession({ token: b.session.token, expiresAt: b.session.expiresAt, workspace: b.workspace, email: data.email });
            window.location.href = "app.html";
            return;
          }
          var body = result.body || {};
          var field = body.error && body.error.details && body.error.details.field;
          if (field) markInvalid(signup, field, body.error.message);
          if (result.response.status === 409 && !field) markInvalid(signup, "email");
          setStatus(signup, explain(result.response, body), "err");
        })
        .catch(function () { setStatus(signup, "We couldn't reach the server. Check your connection and try again.", "err"); })
        .finally(function () { button.disabled = false; });
    });
  }

  // Sign-in.
  var signin = document.getElementById("signin-form");
  if (signin) {
    var existing = loadSession();
    if (existing && existing.token && new Date(existing.expiresAt) > new Date()) {
      window.location.replace("app.html");
      return;
    }
    signin.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!signin.checkValidity()) {
        signin.reportValidity();
        setStatus(signin, "Fill in all three fields to sign in.", "err");
        return;
      }
      if (!api) return noApi(signin);
      var workspace = signin.elements.tenantSlug.value.trim().toLowerCase();
      var email = signin.elements.email.value.trim();
      var button = signin.querySelector("button[type=submit]");
      button.disabled = true;
      setStatus(signin, "Signing you in…", "");
      post("/v1/auth/login", { tenantSlug: workspace, email: email, password: signin.elements.password.value })
        .then(function (result) {
          if (result.response.status === 200) {
            var session = { token: result.body.token, expiresAt: result.body.expiresAt, workspace: workspace, email: email };
            saveSession(session);
            window.location.href = "app.html";
            return;
          }
          setStatus(signin, explain(result.response, result.body), "err");
        })
        .catch(function () { setStatus(signin, "We couldn't reach the server. Check your connection and try again.", "err"); })
        .finally(function () { button.disabled = false; });
    });
  }
});
