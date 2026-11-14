# Claude Code environment inventory

Date: 2026-11-14. Machine: Windows 11 Pro. Repository: `E:\SaaS` (branch `main`, origin `https://github.com/qavril-labs/home.git`).

This is a read-only inventory. Nothing was installed, removed, enabled, disabled or changed. Secrets, tokens and private environment values were not read or printed.

Sources checked: `~/.claude/` (settings, plugin records, synced skills), `~/.claude.json` (MCP server names and transport only), `E:\SaaS\.claude/` (project launch file), `E:\SaaS\CLAUDE.md`, `E:\SaaS\AGENTS.md`, `E:\SaaS\docs/`, and the official plugin marketplace cache.

Claude Code version: **2.1.252**. Plugin management is done with `/plugin`; skills are discovered from `~/.claude/skills`, `.claude/skills` and plugin folders; commands from `.claude/commands`; subagents from `.claude/agents`.

## Status key

- **Installed**: present on this machine and loaded or loadable in the current session.
- **Available**: a public item that could be installed. Not installed.
- **Verified in files**: confirmed from a file on disk.
- **Reported by session only**: shown to the session by the desktop app but not found in a file on disk.

---

## 1. Personal skills (`~/.claude/skills/`)

| Item | Status |
|---|---|
| `~/.claude/skills/synced/` | Installed. Holds 15 skill folders synced from the desktop app. |
| `~/.claude/skills/.trash/` | Holds removed items. Not active. |

### Synced skills (installed, verified in files)

| Skill | Source | Purpose | Project use for QAVRIL LABS |
|---|---|---|---|
| `3d-web-experience` | Third-party (vibeship-spawner-skills, Apache 2.0) | Three.js, React Three Fiber and 3D web guidance | Hero scene, product visuals |
| `built-in-browser` | Anthropic example | Guidance for the in-app browser | Visual checks of the site |
| `chrome-browser` | Anthropic example | Guidance for Claude in Chrome | Cross-browser checks |
| `computer-use` | Anthropic example | Desktop control rules | Not needed for the website |
| `deep-research` | Anthropic example | Multi-agent research coordination | Market and competitor research |
| `docs` | Anthropic example | Editable shared documents | Proposals and handoffs |
| `docx` | Anthropic example | Word document creation and editing | Client documents |
| `google-workspace` | Anthropic example | Google Docs, Sheets and Slides | Shared working files |
| `import-memory` | Anthropic example | Memory import | Not needed |
| `morning` | Anthropic example | Morning brief | Not needed |
| `pdf` | Anthropic example | PDF reading, creation and forms | Proposals, invoices |
| `pptx` | Anthropic example | PowerPoint creation | Company decks |
| `skill-creator` | Anthropic example | Create and test skills | Building custom skills |
| `xlsx` | Anthropic example | Spreadsheet creation | Pricing models |

The synced folder also has `manifest.json`, which records the skill IDs, descriptions and sources.

## 2. Project skills (`E:\SaaS\.claude\skills\`)

Not present. No project-level skills are defined.

## 3. Plugins (installed)

| Plugin | Marketplace | Version | Scope | Status |
|---|---|---|---|---|
| `neon-postgres` | `neon` (`neondatabase/agent-skills`) | 3.0.8 | User | Installed, enabled. Verified in `installed_plugins.json` and `settings.json`. |

Only one plugin is recorded as installed on disk.

## 4. Plugin marketplaces (configured)

| Marketplace | Source | Auto-update | Status |
|---|---|---|---|
| `claude-plugins-official` | GitHub `anthropics/claude-plugins-official` | Not set | Configured, cached locally. |
| `neon` | GitHub `neondatabase/agent-skills` | On | Configured, cached locally. |

## 5. Custom slash commands

| Location | Status |
|---|---|
| `~/.claude/commands/` | Not present. |
| `E:\SaaS\.claude/commands/` | Not present. |

Total custom commands: **0**.

## 6. Subagents

| Location | Status |
|---|---|
| `~/.claude/agents/` | Not present. |
| `E:\SaaS\.claude/agents/` | Not present. |

Built-in agent types are provided by Claude Code itself (general-purpose, Explore, Plan, claude-code-guide, statusline-setup). These are not custom.

Total custom subagents: **0**.

## 7. MCP servers

| Server | Transport | Source | Status |
|---|---|---|---|
| `Neon` | HTTP | `~/.claude.json` (user config) | Verified in file. Connected in this session; it disconnected and reconnected during the session. |
| `plugin:small-business:tiktok` | Plugin | Reported by session | Failed to connect (ECONNRESET). |
| Figma, Intercom, Asana, Atlassian, Datadog, GitHub, Linear, Notion, PagerDuty, Slack, ClickUp, Monday, Calendly, Close, Crunchbase, Fireflies, Gong, Lusha, Microsoft 365, Otter.ai, Outreach, Salesforce, Similarweb, ZoomInfo, Airwallex, Apollo, Canva, Clay, DocuSign and about 20 more | Plugin | Reported by session only | Require OAuth authorisation via `/mcp`. Not found on disk. |
| Project MCP servers | Project `.mcp.json` | Not present | None defined for this repository. |

The desktop app reports the plugin MCP servers. They are not in `installed_plugins.json`, so they are not verified on disk.

## 8. Hooks and automation

| Location | Status |
|---|---|
| `~/.claude/settings.json` hooks | None. Settings keys: `model`, `modelSettings`, `autoUpdatesChannel`, `enabledPlugins`. |
| Project hooks (`E:\SaaS\.claude/settings*.json`) | Not present. |
| Launch configurations (`E:\SaaS\.claude/launch.json`) | Present. Three configurations: `site-and-api`, `site`, `uaap`. These start local servers. They are not hooks. |

No hooks or scheduled automations are configured.

## 9. Instruction files

| File | Location | Status |
|---|---|---|
| `CLAUDE.md` | `E:\SaaS\CLAUDE.md` | Present. Working agreements: product catalogue, commands, architecture rules, conventions. |
| `AGENTS.md` | `E:\SaaS\AGENTS.md` | Present. Instructions for the frontend lane. |
| `docs/build-plan.md`, `docs/ui-contract.md` | `E:\SaaS\docs\` | Present. Referenced by `CLAUDE.md`. |
| `docs/industry-portfolio.md`, `docs/infrastructure.md`, `docs/phase-0-status.md`, `docs/plan-review.md` | `E:\SaaS\docs\` | Present. |
| `docs/ai-agent-readiness/`, `docs/architecture/` | `E:\SaaS\docs\` | Present. |
| `docs/claude/` | `E:\SaaS\docs\claude\` | Created by this inventory. |
| User-level `CLAUDE.md` | `~/.claude/CLAUDE.md` | Not present. |

## 10. Other reusable workflows and extensions

### Available in the official marketplace (not installed)

The official marketplace cache has 43 plugins in `plugins/` and 40 external-plugin entries, including:

- Code and review: `code-review`, `pr-review-toolkit`, `code-simplifier`, `commit-commands`, `feature-dev`, `security-guidance`, `claude-security`.
- Build and quality: `frontend-design`, `playwright`, `hookify`, `plugin-dev`, `mcp-server-dev`, `skill-creator`, `claude-md-management`.
- Language servers: `pyright-lsp`, `rust-analyzer-lsp`, `ruby-lsp`, `php-lsp`, `kotlin-lsp`, `lua-lsp`, `gopls-lsp`, `jdtls-lsp`, `csharp-lsp`, `clangd-lsp`.
- External integrations: `github`, `gitlab`, `linear`, `asana`, `context7`, `playwright`, `serena`, `terraform`, `firebase`, `laravel-boost`.
- Other: `ralph-loop`, `session-report`, `project-artifact`, `claude-for-manufacturing`, `receipts`.

These are **available for installation only**. None is installed.

### Skills from the Neon marketplace (plugin installed)

`neon`, `neon-ai-gateway`, `neon-auth`, `neon-functions`, `neon-object-storage`, `neon-postgres`, `neon-realtime`. Installed through `neon-postgres`.

### Skills reported by the session but not on disk

`mcp__plugin_small-business_*`, `sales:*`, `design:*`, `engineering:*`, `productivity:*`, `small-business:*`, `dataviz`, `artifact-design`, `artifact-diagramming`, `plugin-authoring`, `run`, `init`, `security-review`, `loop`, `schedule`, `update-config`, `keybindings-help`, `fewer-permission-prompts`, `code-review`, `simplify`, `claude-api`. Reported by the desktop app; not present as files here.

---

## Totals

| Category | Count | Note |
|---|---|---|
| Installed skills, on disk | 14 (15 folders including `manifest.json`) | Synced personal skills |
| Installed plugins | 1 | `neon-postgres` |
| Configured marketplaces | 2 | `claude-plugins-official`, `neon` |
| Custom slash commands | 0 | |
| Custom subagents | 0 | |
| MCP servers in config file | 1 | `Neon` (HTTP) |
| MCP servers reported by session | about 50 | Mostly OAuth plugins, not authorised |
| Hooks | 0 | |
| Instruction files | 2 root (`CLAUDE.md`, `AGENTS.md`) + docs | |

## Missing recommended capabilities

1. **Project skills or commands for the website.** No `.claude/skills` or `.claude/commands`. Adding them would stop repeated instructions being retyped.
2. **Playwright or the browser checks as a plugin.** `playwright` is available. It would support the mobile, accessibility and console checks the QAVRIL LABS brief requires.
3. **A code-review plugin.** `code-review` and `pr-review-toolkit` are available and not installed.
4. **Lighthouse or accessibility audit skill.** Not in the marketplace. The site already has an in-house check (`npm run site:check`).
5. **Context7 or docs lookup.** Available; would help with current framework documentation.
6. **Hooks for safety.** No hook blocks commits to `main` or secret files. `hookify` is available.
7. **GitHub integration.** Authentication to `qavril-labs/home` is through `gh`; the GitHub MCP plugin is not authorised.

## Duplicate or overlapping items

- `neon-postgres` (plugin) and the `neon-postgres` skill are the same skill, loaded twice in different forms. The plugin version is the one that matters.
- `chrome-browser` and `built-in-browser` overlap in purpose, but each covers a different browser.
- `code-review` appears as a skill reported by the session, and also as an available plugin. Install one, not both.
- `skill-creator` is both a synced personal skill and an available plugin.
- `playwright` appears as an available plugin and as a session-reported browser capability.

## Recommended additions for QAVRIL LABS website engineering

1. Install `code-review` and `pr-review-toolkit` before opening pull requests.
2. Install `playwright` for responsive, accessibility and console tests of the site.
3. Add `.claude/commands/site-check.md` to run `npm run site:check` and report failures.
4. Add `.claude/agents/website-qa.md` for route, link and metadata checks.
5. Add a project hook that blocks commits containing `.env` files, and blocks pushes to `main` without review.
6. Authorise the GitHub connection through `/mcp` if pull requests should be opened from the session.
7. Keep the brand name fixed at **QAVRIL LABS** in any project instruction.

## Notes

- Items marked "reported by session only" could not be checked against the file system. They may be available, but this inventory did not confirm them.
- No credentials, tokens, API keys or private environment variables were read or recorded.
