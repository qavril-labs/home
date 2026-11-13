// Phase L1 Comprehensive Quality and Stabilization Audit for QAVRIL LABS website.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "site");

const results = {
  passed: 0,
  failed: 0,
  failures: [],
  categories: {
    structure: { passed: 0, failed: 0 },
    seo_metadata: { passed: 0, failed: 0 },
    links_and_assets: { passed: 0, failed: 0 },
    accessibility: { passed: 0, failed: 0 },
    security_headers: { passed: 0, failed: 0 },
    branding_and_studios: { passed: 0, failed: 0 },
    legal_and_privacy: { passed: 0, failed: 0 },
    api_and_fallbacks: { passed: 0, failed: 0 }
  }
};

function record(category, condition, message) {
  if (condition) {
    results.passed += 1;
    results.categories[category].passed += 1;
  } else {
    results.failed += 1;
    results.categories[category].failed += 1;
    results.failures.push(`[${category.toUpperCase()}] ${message}`);
  }
}

// 1. Gather all HTML pages (public indexable pages; app.html is internal shell)
const htmlFiles = (dir, base = "") =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    const relative = base ? `${base}/${name}` : name;
    if (statSync(full).isDirectory()) return htmlFiles(full, relative);
    return name.endsWith(".html") && name !== "app.html" ? [relative] : [];
  });

const pages = htmlFiles(site);
const htmlMap = Object.fromEntries(pages.map((p) => [p, readFileSync(join(site, p), "utf8")]));

console.log(`L1 Audit: Auditing ${pages.length} HTML pages and static assets...`);

// 2. Audit each HTML page
for (const page of pages) {
  const content = htmlMap[page];

  // Structure
  record("structure", /<!doctype html>/i.test(content), `${page}: valid DOCTYPE declaration`);
  record("structure", /<html[^>]*lang="en"/i.test(content), `${page}: html element with lang="en"`);
  record("structure", /<meta charset="utf-8"/i.test(content), `${page}: meta charset utf-8 present`);
  record("structure", /<meta name="viewport"/i.test(content), `${page}: viewport meta tag present`);
  record("structure", (content.match(/<h1[\s>]/g) || []).length === 1, `${page}: exactly one <h1> tag`);

  // Duplicate IDs
  const idMatches = [...content.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const seenIds = new Set();
  let duplicateId = null;
  for (const id of idMatches) {
    if (seenIds.has(id)) { duplicateId = id; break; }
    seenIds.add(id);
  }
  record("structure", duplicateId === null, `${page}: no duplicate IDs (found duplicate: "${duplicateId}")`);

  // SEO & Metadata
  const title = content.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
  const desc = content.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
  record("seo_metadata", title.length > 0 && title.length <= 65, `${page}: title length valid (${title.length} chars)`);
  record("seo_metadata", desc.length >= 70 && desc.length <= 160, `${page}: description length valid (${desc.length} chars)`);
  record("seo_metadata", /<link rel="canonical" href="https:\/\/qavrillabs\.com\//.test(content) || page === "404.html", `${page}: canonical URL uses https://qavrillabs.com`);
  record("seo_metadata", /<meta property="og:title"/.test(content), `${page}: og:title present`);
  record("seo_metadata", /<meta name="twitter:card"/.test(content), `${page}: twitter:card present`);

  // JSON-LD Validation
  for (const [, jsonBlock] of content.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let validJson = false;
    try {
      JSON.parse(jsonBlock);
      validJson = true;
    } catch {
      validJson = false;
    }
    record("seo_metadata", validJson, `${page}: JSON-LD block is valid JSON`);
  }

  // Links & Assets
  for (const [, target] of content.matchAll(/href="#([^"]+)"/g)) {
    record("links_and_assets", seenIds.has(target), `${page}: anchor #${target} has matching id in page`);
  }
  for (const [, ref] of content.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(https?:|mailto:|data:|#|tel:)/.test(ref)) continue;
    const file = ref.split(/[?#]/)[0];
    const targetPath = resolve(dirname(join(site, page)), file);
    record("links_and_assets", existsSync(targetPath), `${page}: local reference "${ref}" resolves to file on disk`);
  }

  // Accessibility: Images
  for (const [imgTag] of content.matchAll(/<img[^>]+>/g)) {
    const hasAlt = /alt="[^"]*"/i.test(imgTag);
    record("accessibility", hasAlt, `${page}: image tag has alt attribute: ${imgTag.slice(0, 50)}...`);
  }

  // Accessibility: Buttons
  for (const [btnTag, btnText] of content.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)) {
    const hasAria = /aria-label="[^"]+"/i.test(btnTag);
    const hasText = btnText.replace(/<[^>]+>/g, "").trim().length > 0;
    record("accessibility", hasAria || hasText, `${page}: button has accessible name or label`);
  }
}

// 3. Brand & Studio Architecture Verification
const indexContent = htmlMap["index.html"];
record("branding_and_studios", /id="studios"/.test(indexContent), "index.html: dedicated #studios section exists");
for (let s = 1; s <= 7; s++) {
  const sStr = `Studio 0${s}`;
  record("branding_and_studios", indexContent.includes(sStr), `index.html: presents ${sStr}`);
}
const aboutContent = htmlMap["about.html"];
record("branding_and_studios", /Seven dedicated product studios/i.test(aboutContent), "about.html: explains Seven Dedicated Studios");
record("branding_and_studios", /The rules we design by/i.test(aboutContent), "about.html: specifies engineering invariants");

// 4. API & Fallback Invariant
const configJs = readFileSync(join(site, "config.js"), "utf8");
record("api_and_fallbacks", /apiBase:\s*""/.test(configJs), "config.js: apiBase is empty string (decoupled)");
record("api_and_fallbacks", /contactEmail:\s*"connect@qavrillabs\.com"/.test(configJs), "config.js: contactEmail is connect@qavrillabs.com");

const mainJs = readFileSync(join(site, "main.js"), "utf8");
record("api_and_fallbacks", mainJs.includes("notConnected()"), "main.js: has notConnected fallback handler");
record("api_and_fallbacks", !mainJs.includes("http://127.0.0.1:3000"), "main.js: no hardcoded localhost API pointers");

// 5. Legal & Privacy Invariant
const privacyContent = htmlMap["privacy.html"];
record("legal_and_privacy", privacyContent.includes("Pending legal review"), "privacy.html: marked as pending legal review");
record("legal_and_privacy", privacyContent.includes("Pending corporate registration"), "privacy.html: address marked as pending corporate registration");
record("legal_and_privacy", !privacyContent.includes("Inc.") && !privacyContent.includes("LLC"), "privacy.html: no invented legal entity names");

const termsContent = htmlMap["terms.html"];
record("legal_and_privacy", termsContent.includes("Pending legal review"), "terms.html: marked as pending legal review");

// 6. Security Headers (_headers)
const headersContent = readFileSync(join(site, "_headers"), "utf8");
record("security_headers", headersContent.includes("Content-Security-Policy"), "_headers: CSP header defined");
record("security_headers", headersContent.includes("X-Frame-Options: DENY"), "_headers: X-Frame-Options DENY defined");
record("security_headers", headersContent.includes("X-Content-Type-Options: nosniff"), "_headers: nosniff defined");
record("security_headers", headersContent.includes("Strict-Transport-Security: max-age=31536000; includeSubDomains"), "_headers: HSTS defined without premature preload");
record("security_headers", !headersContent.includes("localhost") && !headersContent.includes("127.0.0.1"), "_headers: no localhost in CSP connect-src");
record("security_headers", headersContent.includes("https://cdn.jsdelivr.net"), "_headers: cdn.jsdelivr.net allowed in script-src for Three.js");

// 7. Sitemap & Robots & LLMS
const sitemapContent = readFileSync(join(site, "sitemap.xml"), "utf8");
const robotsContent = readFileSync(join(site, "robots.txt"), "utf8");
const llmsContent = readFileSync(join(site, "llms.txt"), "utf8");
record("seo_metadata", robotsContent.includes("Sitemap: https://qavrillabs.com/sitemap.xml"), "robots.txt: points to sitemap");
record("seo_metadata", /GPTBot|ClaudeBot|PerplexityBot/.test(robotsContent), "robots.txt: crawler directives present");
record("seo_metadata", llmsContent.includes("https://qavrillabs.com"), "llms.txt: targets canonical domain");
record("seo_metadata", (sitemapContent.match(/<loc>/g) || []).length === pages.length, `sitemap.xml: exactly ${pages.length} URLs registered`);

// Summary
console.log("\n=================== L1 AUDIT RESULTS ===================");
console.log(`TOTAL CHECKS: ${results.passed + results.failed}`);
console.log(`PASSED: ${results.passed}`);
console.log(`FAILED: ${results.failed}`);
console.log("\n--- Category Breakdown ---");
for (const [cat, data] of Object.entries(results.categories)) {
  const status = data.failed === 0 ? "PASS" : "FAIL";
  console.log(`  ${cat.padEnd(25)}: ${data.passed} passed, ${data.failed} failed [${status}]`);
}

if (results.failures.length > 0) {
  console.log("\n--- Failures ---");
  for (const f of results.failures) {
    console.log(`  FAIL: ${f}`);
  }
}
console.log("========================================================\n");

process.exitCode = results.failed > 0 ? 1 : 0;

