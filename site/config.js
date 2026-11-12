// Site configuration. Edit these before going live.
// apiBase: the deployed ERP API, for example "https://api.qavrillabs.com".
//          Leave it empty and the forms show a notice with the contact email instead.
//          When the site is opened on this machine (localhost), the local API from `npm run dev:all` is used.
// contactEmail: where mailto fallbacks and the footer contact point.
window.ERP_CONFIG = {
  brand: "QAVRIL LABS",
  apiBase: "",
  contactEmail: "connect@qavrillabs.com"
};
(function () {
  var host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
    window.ERP_CONFIG.apiBase = "http://" + host + ":3002";
  }
})();
