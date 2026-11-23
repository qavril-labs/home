// Staging site configuration. Chosen by scripts/select-site-config.mjs staging, which copies this
// file over site/config.js before the staging site is uploaded. Do not use for production.
window.ERP_CONFIG = {
  brand: "QAVRIL LABS",
  // The ERP API is not deployed yet, so the signed-in pages have no backend on staging.
  apiBase: "",
  // The website API (lead form, content, admin) on staging.
  contentApiBase: "https://content-staging.qavrillabs.com",
  contactEmail: "connect@qavrillabs.com"
};
