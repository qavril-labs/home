// Checks the marketing site without a browser or any dependencies.
// Fails (exit 1) on broken links, mismatched structured data, or a form that the API would reject.
// Warns about launch placeholders that are expected until the site is deployed.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "site");
const failures = [];
const warnings = [];
let passed = 0;

const read = (path) => readFileSync(path, "utf8");
const check = (condition, message) => {
  if (condition) passed += 1;
  else failures.push(message);
};
const visibleText = (html) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

// Every HTML page in the site, including the generated pages in subfolders.
const htmlFiles = (dir, base = "") =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    const relative = base ? `${base}/${name}` : name;
    if (statSync(full).isDirectory()) return htmlFiles(full, relative);
    return name.endsWith(".html") ? [relative] : [];
  });
const pages = htmlFiles(site);
const html = Object.fromEntries(pages.map((page) => [page, read(join(site, page))]));

// 1. Every in-page anchor points at an element that exists, and every local file exists.
for (const page of pages) {
  const ids = new Set([...html[page].matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
  for (const [, target] of html[page].matchAll(/href="#([^"]+)"/g)) {
    check(ids.has(target), `${page}: anchor #${target} has a matching id`);
  }
  for (const [, reference] of html[page].matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(https?:|mailto:|data:|#)/.test(reference)) continue;
    const file = reference.split(/[?#]/)[0];
    check(existsSync(resolve(dirname(join(site, page)), file)), `${page}: local file ${file} exists`);
  }
  for (const [, body] of html[page].matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(body);
      check(true, `${page}: JSON-LD parses`);
    } catch (error) {
      check(false, `${page}: JSON-LD does not parse (${error.message})`);
    }
  }
}

// 2. The structured FAQ must match the visible FAQ, word for word.
const structured = [...html["index.html"].matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .map((match) => JSON.parse(match[1]))
  .flatMap((block) => (block["@graph"] ? block["@graph"] : [block]))
  .find((item) => item["@type"] === "FAQPage");
const structuredFaq = (structured?.mainEntity ?? []).map((item) => [item.name, item.acceptedAnswer.text]);
const visibleFaq = [...html["index.html"].matchAll(/<details[^>]*>\s*<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>/g)]
  .map((match) => [visibleText(match[1]), visibleText(match[2])]);
check(structuredFaq.length > 0, "index.html: FAQPage structured data exists");
check(structuredFaq.length === visibleFaq.length, "FAQ: structured and visible question counts match");
structuredFaq.forEach(([question, answer], index) => {
  const visible = visibleFaq[index];
  check(
    visible !== undefined && visible[0] === question && visible[1] === answer,
    `FAQ item ${index + 1}: structured data matches the visible text`,
  );
});

// 3. The form must send what the API accepts.
const formBlock = html["index.html"].match(/<form id="lead-form"[\s\S]*?<\/form>/)?.[0] ?? "";
const formNames = new Set([...formBlock.matchAll(/\sname="([^"]+)"/g)].map((match) => match[1]));
const apiSource = read(join(root, "apps/api/src/app.ts"));
const leadBody = apiSource.match(/const LeadBody = z\.object\(\{([\s\S]*?)\n\}\);/)?.[1] ?? "";
const apiKeys = [...leadBody.matchAll(/^ {2}(\w+):/gm)].map((match) => match[1]);
const clientSource = read(join(root, "site/main.js"));
const requiredApiKeys = ["name", "email", "interest", "consent"];
check(apiKeys.length > 0, "API: LeadBody schema is readable");
for (const key of apiKeys) {
  check(formNames.has(key) || key === "source" || clientSource.includes("data." + key), `form: field "${key}" is sent by the form or set by script`);
}
for (const key of requiredApiKeys) {
  check(formNames.has(key), `form: required field "${key}" is in the form`);
}
const script = read(join(site, "main.js"));
for (const key of apiKeys) {
  check(new RegExp(`\\b${key}:`).test(script), `main.js: sends "${key}"`);
}

// 4. Sitemap entries must be real pages.
const sitemap = read(join(site, "sitemap.xml"));
for (const [, location] of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const path = new URL(location).pathname;
  const file = path === "/" ? "index.html" : path.slice(1);
  check(existsSync(join(site, file)), `sitemap: ${location} points to an existing page`);
}

// 5. Social preview image: real PNG at the size the meta tags declare.
const preview = readFileSync(join(site, "og-image.png"));
check(preview.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), "og-image.png is a PNG");
check(preview.readUInt32BE(16) === 1200 && preview.readUInt32BE(20) === 630, "og-image.png is 1200x630");
check(html["index.html"].includes('og:image" content="https://'), "index.html: og:image is set");

// 6. Runtime config exists and names both settings.
const config = read(join(site, "config.js"));
check(/apiBase:/.test(config) && /contactEmail:/.test(config), "config.js: apiBase and contactEmail are set");

// 6b. Search and AI discovery: every indexable page has one title, one description, one H1, a canonical,
// social tags, valid JSON-LD, and appears in the sitemap with a date.
const indexable = pages.filter((page) => page !== "404.html");
const sitemapPaths = new Set([...sitemap.matchAll(/<loc>https?:\/\/[^/<]+\/([^<]*)<\/loc>/g)].map((m) => m[1]));
for (const page of indexable) {
  const text = html[page];
  const title = text.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
  const description = text.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
  check(title.length > 0 && title.length <= 65, `seo: ${page} title is 1 to 65 characters`);
  check(description.length >= 70 && description.length <= 160, `seo: ${page} description is 70 to 160 characters`);
  check((text.match(/<h1[\s>]/g) ?? []).length === 1, `seo: ${page} has exactly one H1`);
  check(/<link rel="canonical" href="[^"]+"/.test(text), `seo: ${page} has a canonical link`);
  check(/<meta property="og:title"/.test(text) && /<meta name="twitter:card"/.test(text), `seo: ${page} has Open Graph and Twitter tags`);
  for (const [, json] of text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let valid = true;
    try { JSON.parse(json); } catch { valid = false; }
    check(valid, `seo: ${page} has valid JSON-LD`);
  }
  if (!text.includes("noindex")) check(sitemapPaths.has(page === "index.html" ? "" : page), `seo: ${page} is listed in the sitemap`);
}
check(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(sitemap), "seo: sitemap entries carry a lastmod date");
check(/Sitemap: /.test(read(join(site, "robots.txt"))), "seo: robots.txt points at the sitemap");
check(/GPTBot|ClaudeBot|PerplexityBot/.test(read(join(site, "robots.txt"))), "seo: robots.txt states the AI crawler policy");

// 7. Launch placeholders: reported as warnings, expected until the domain is chosen.
const hosts = new Set();
for (const text of [html["index.html"], html["privacy.html"], read(join(site, "robots.txt")), sitemap]) {
  for (const [, host] of text.matchAll(/https:\/\/([a-z0-9.-]+)/g)) hosts.add(host);
}
if (hosts.has("your-domain.example")) {
  warnings.push(`domain placeholder "your-domain.example" still in ${[...hosts].length} host reference(s)`);
}
const placeholderCount = (html["privacy.html"].match(/class="placeholder"/g) ?? []).length;
if (placeholderCount > 0) warnings.push(`privacy notice has ${placeholderCount} placeholder(s) to fill in`);
if (/apiBase:\s*"https?:\/\/(127\.0\.0\.1|localhost)/.test(config)) {
  warnings.push("config.js apiBase points at localhost (fine locally, change before deploying)");
}

console.log(`site check: ${passed} passed, ${failures.length} failed`);
for (const message of failures) console.log(`  FAIL ${message}`);
for (const message of warnings) console.log(`  WARN ${message}`);
process.exitCode = failures.length > 0 ? 1 : 0;
