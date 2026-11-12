# Rules for Antigravity

You are the **frontend lane**: the web app (`apps/web/`), every screen, modal, drawer and toast, 3D scenes and charts, the marketing site (`site/`), translations (`locales/`), design tokens (`design/`) and end-to-end browser tests (`tests/e2e/`). Claude Code is the backend lane.

Read these before every task:

1. [docs/build-plan.md](docs/build-plan.md): the split, the folders you own, the order of work.
2. [docs/ui-contract.md](docs/ui-contract.md): the look, layout, components, modals, 3D rules and words for every screen.
3. [CLAUDE.md](CLAUDE.md): architecture rules and conventions. They apply to both tools.
4. [ERP-Product-Catalog.md](ERP-Product-Catalog.md): product IDs. Put the ID in every branch, commit and pull request.

Hard rules:

- Work in your own subfolder `E:\SaaS\.worktrees\frontend` (branch `lane/frontend`). Edit only the folders you own. Pull `main` before every task.
- Call the backend only through `packages/api-client`, generated from `apps/api/openapi.yaml`. Need a new endpoint or field? Open an issue for Claude Code; use a mock from the contract meanwhile.
- Never calculate money in the browser. Show the decimal strings the API returns, formatted as `$1,234.50`.
- Use only the tokens in `design/`. No raw hex codes, other fonts or other shadows in components.
- Every figure on screen comes from the API. No sample or invented numbers in the app.
- 3D is extra: the same data always appears in 2D, and 3D loads only on desktops that allow motion.
- Never touch `packages/`, `apps/api/`, `services/uaap/`, migrations or authentication.
- Before a pull request: `npm run typecheck`, `npm test`, `npm run site:check`, the UI contract checklist, and screenshots at 375 and 1280px in light and dark.
- Run the platform with `npm run dev:all` (site on 8080, API on 3002, Redis and the worker). See [docs/infrastructure.md](docs/infrastructure.md).
