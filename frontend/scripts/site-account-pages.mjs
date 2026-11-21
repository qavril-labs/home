// Sign-up and sign-in pages. Self sign-up and customer sign-in are not open yet, so these pages do not
// collect passwords and do not pretend to create an account. They explain the position and send the
// visitor to the trial waitlist or a demo request, which both reach the team by email.

export function signupBody() {
  return `  <main class="account-page">
    <section class="account-grid">
      <div class="account-pitch">
        <span class="kicker">Free trial waitlist</span>
        <h1>Request your free trial.</h1>
        <p class="lead">Self sign-up is not open yet. Tell us about your business and we will email you when your trial workspace is ready, in the order requests arrive.</p>
        <ul class="feature-list">
          <li>No card needed for the trial</li>
          <li>Your data is kept separate from every other business</li>
          <li>We help you move your records across during onboarding</li>
        </ul>
        <p class="cta-row"><a class="btn btn-lime" href="book.html?interest=trial">Join the trial waitlist</a> <a class="btn btn-ghost" href="book.html?interest=demo">Book a demo instead</a></p>
        <p class="fine">Already have a workspace? <a href="signin.html">Read about sign-in</a></p>
      </div>
    </section>
  </main>
`;
}

export function signinBody() {
  return `  <main class="account-page">
    <section class="account-grid">
      <div class="account-pitch">
        <span class="kicker">Sign in</span>
        <h1>Customer sign-in opens with your onboarding.</h1>
        <p class="lead">We do not run self-service sign-in yet. When your workspace is set up, we give you your sign-in details by email, along with a guide to your first week.</p>
        <p class="cta-row"><a class="btn btn-lime" href="book.html?interest=demo">Book a setup call</a> <a class="btn btn-ghost" href="book.html?interest=trial">Join the trial waitlist</a></p>
        <p class="fine">Questions about your account? Email <a href="mailto:connect@qavrillabs.com">connect@qavrillabs.com</a>.</p>
      </div>
    </section>
  </main>
`;
}
