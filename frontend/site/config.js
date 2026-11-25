// Site configuration. Edit these before going live.
// apiBase: the deployed ERP API (sign-in, sign-up, workspace), for example "https://api.qavrillabs.com".
//          Used only by the signed-in app pages for now.
// contentApiBase: the deployed website API (qavril-labs/website-api): the lead form and the
//          content (CMS) reads and the admin. For example "https://content.qavrillabs.com".
//          Leave it empty and the lead form shows a notice with the contact email instead.
//          It falls back to apiBase when not set, so existing setups keep working.
//          When the site is opened on this machine, the local services are used.
// contactEmail: where mailto fallbacks and the footer contact point.
window.ERP_CONFIG = {
  brand: "QAVRIL LABS",
  apiBase: "",
  contentApiBase: "",
  contactEmail: "connect@qavrillabs.com"
};
(function () {
  // Fall back to the ERP API base until a separate content API is configured.
  if (!window.ERP_CONFIG.contentApiBase) window.ERP_CONFIG.contentApiBase = window.ERP_CONFIG.apiBase;
  var host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
    window.ERP_CONFIG.apiBase = "http://" + host + ":3002";
    window.ERP_CONFIG.contentApiBase = "http://" + host + ":3003";
  }
})();
