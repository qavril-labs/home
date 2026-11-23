// Copies frontend/site/config.<env>.js over frontend/site/config.js, so one build uses one environment.
// Usage: node frontend/scripts/select-site-config.mjs staging|production
// Run it on a copy of the site before upload. config.js itself stays the local-development default.
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const env = process.argv[2];
const allowed = ["staging", "production"];
if (!allowed.includes(env)) {
  console.error(`usage: select-site-config.mjs ${allowed.join("|")}`);
  process.exit(1);
}

const site = resolve(dirname(fileURLToPath(import.meta.url)), "..", "site");
const source = join(site, `config.${env}.js`);
if (!existsSync(source)) {
  console.error(`missing ${source}`);
  process.exit(1);
}
copyFileSync(source, join(site, "config.js"));
console.log(`site config set to ${env}`);
