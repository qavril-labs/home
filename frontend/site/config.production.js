// Production site configuration. Chosen by scripts/select-site-config.mjs production, which copies
// this file over site/config.js before the production site is uploaded.
// Production is not live yet: content.qavrillabs.com is not set up. Until it is, leave
// contentApiBase empty, so the forms show the contact-email notice instead of failing.
window.ERP_CONFIG = {
  brand: "QAVRIL LABS",
  apiBase: "",
  contentApiBase: "",
  contactEmail: "connect@qavrillabs.com"
};
