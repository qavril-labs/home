// Sign-up and sign-in pages. build-site-pages.mjs wraps these bodies in the shared head, header and footer.
// The countries offered at sign-up, with the currency and hosting region each one defaults to.
// Keep regions within ALLOWED_REGIONS in packages/tenancy/src/model.ts.
export const SIGNUP_COUNTRIES = [
  ["US", "United States", "USD", "US"],
  ["KE", "Kenya", "KES", "MEA"],
  ["NG", "Nigeria", "NGN", "MEA"],
  ["ZA", "South Africa", "ZAR", "MEA"],
  ["AE", "United Arab Emirates", "AED", "MEA"],
  ["SA", "Saudi Arabia", "SAR", "MEA"],
  ["EG", "Egypt", "EGP", "MEA"],
  ["IN", "India", "INR", "APAC"],
  ["SG", "Singapore", "SGD", "APAC"],
  ["AU", "Australia", "AUD", "APAC"],
  ["PH", "Philippines", "PHP", "APAC"],
  ["GB", "United Kingdom", "GBP", "EU"],
  ["DE", "Germany", "EUR", "EU"],
  ["FR", "France", "EUR", "EU"],
  ["NL", "Netherlands", "EUR", "EU"],
  ["IE", "Ireland", "EUR", "EU"],
  ["CA", "Canada", "CAD", "US"],
  ["MX", "Mexico", "MXN", "LATAM"],
  ["BR", "Brazil", "BRL", "LATAM"],
];

const esc = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function signupBody() {
  const options = SIGNUP_COUNTRIES.map(
    ([code, name, currency, region]) => `              <option value="${code}" data-currency="${currency}" data-region="${region}">${esc(name)}</option>`,
  ).join("\n");
  return `  <main class="account-page">
    <section class="account-grid">
      <div class="account-pitch">
        <span class="kicker">Start free</span>
        <h1>Your whole business, one login. Ready in two minutes.</h1>
        <p class="lead">Create your workspace now. Your books, sales and stock live in one place from day one, and you add modules and bots as you grow.</p>
        <ul class="feature-list">
          <li>Free plan, no card needed</li>
          <li>Your data walled off from every other business</li>
          <li>We move your records across for you</li>
        </ul>
        <p class="fine">Already have a workspace? <a href="signin.html">Sign in</a></p>
      </div>

      <form id="signup-form" class="lead-form account-form" novalidate>
        <div class="field full">
          <label for="s-name">Your name</label>
          <input id="s-name" name="name" type="text" autocomplete="name" required maxlength="120">
        </div>
        <div class="field full">
          <label for="s-email">Work email</label>
          <input id="s-email" name="email" type="email" autocomplete="email" required maxlength="254">
        </div>
        <div class="field full">
          <label for="s-password">Password</label>
          <input id="s-password" name="password" type="password" autocomplete="new-password" required minlength="12" maxlength="256" aria-describedby="s-password-help">
          <small id="s-password-help" class="fine">At least 12 characters. A short sentence works well.</small>
        </div>
        <div class="field full">
          <label for="s-company">Business name</label>
          <input id="s-company" name="company" type="text" autocomplete="organization" required maxlength="160">
        </div>
        <div class="field">
          <label for="s-country">Country</label>
          <select id="s-country" name="countryCode" required>
${options}
          </select>
        </div>
        <div class="field">
          <label for="s-currency">Currency</label>
          <input id="s-currency" type="text" value="US dollar ($)" readonly aria-describedby="s-currency-help">
          <input type="hidden" name="baseCurrency" value="USD">
          <small id="s-currency-help" class="fine">All books are kept in US dollars.</small>
        </div>
        <div class="field full">
          <label for="s-workspace">Workspace address <span class="optional">(optional)</span></label>
          <input id="s-workspace" name="workspace" type="text" maxlength="63" pattern="[a-z0-9][a-z0-9-]{1,62}" aria-describedby="s-workspace-help" placeholder="made from your business name">
          <small id="s-workspace-help" class="fine">Lowercase letters, numbers and hyphens. You sign in with it.</small>
        </div>
        <input type="hidden" name="region" value="US">
        <div class="field full hp" aria-hidden="true">
          <label for="s-website">Website</label>
          <input id="s-website" name="website" type="text" tabindex="-1" autocomplete="off">
        </div>
        <label class="consent full">
          <input type="checkbox" name="consent" required>
          <span>I agree to the <a href="terms.html">terms</a> and the <a href="privacy.html">privacy notice</a>.</span>
        </label>
        <button class="btn btn-lime full" type="submit">Create my free workspace</button>
        <p class="status full" role="status" aria-live="polite"></p>
      </form>
    </section>
  </main>
  <script src="account.js?v=4"></script>`;
}

export function signinBody() {
  return `  <main class="account-page">
    <section class="account-grid">
      <div class="account-pitch">
        <span class="kicker">Sign in</span>
        <h1>Welcome back.</h1>
        <p class="lead">Your bots kept working while you were away. Sign in to see what they need you to approve.</p>
        <p class="fine">New here? <a href="signup.html">Create a free workspace</a></p>
      </div>

      <form id="signin-form" class="lead-form account-form" novalidate>
        <div class="field full">
          <label for="i-workspace">Workspace address</label>
          <input id="i-workspace" name="tenantSlug" type="text" autocomplete="organization" required maxlength="63" autocapitalize="none">
        </div>
        <div class="field full">
          <label for="i-email">Email</label>
          <input id="i-email" name="email" type="email" autocomplete="email" required maxlength="254">
        </div>
        <div class="field full">
          <label for="i-password">Password</label>
          <input id="i-password" name="password" type="password" autocomplete="current-password" required maxlength="256">
        </div>
        <button class="btn btn-lime full" type="submit">Sign in</button>
        <p class="status full" role="status" aria-live="polite"></p>
      </form>
    </section>
  </main>
  <script src="account.js?v=4"></script>`;
}
