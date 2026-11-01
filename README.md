# AI Agent Skills

Skills that teach coding agents to work like senior specialists. Each skill is a folder with a
`SKILL.md` (the [Agent Skills](https://agentskills.io) open format) plus reference files the agent
loads only when needed, so it works the same in every major coding agent.

| Skill | What it does |
|---|---|
| [`premium-ui-expert-v1`](skills/premium-ui-expert-v1/SKILL.md) | Interviews you about UI and motion, studies reference sites with devtools, and builds responsive, accessible websites that feel premium and not AI-generated — with 14 professional animation modules |
| [`backend-expert-v1`](skills/backend-expert-v1/SKILL.md) | Maps every frontend → backend → database call and removes wasteful ones, picks polling / SSE / WebSockets only where needed, estimates load and sets per-endpoint rate limits (with online research), designs auth, admin and portal access, password hashing, encryption and OWASP API security — and writes a Test Handoff for the tester skill |
| [`tester-expert-v1`](skills/tester-expert-v1/SKILL.md) | Tries to break the app like real users and attackers (double clicks, double payments, races, tabs, back/refresh, bad networks, tampering), tests every feature and how features affect each other, checks API calls and security with devtools, fixes bugs with regression tests, and — after asking — load-tests with virtual users to find the breaking point |
| [`seo-expert-v1`](skills/seo-expert-v1/SKILL.md) | Makes pages findable, understood and worth ranking: interview, current-rules research, page-type metadata matrix, structured data, robots/sitemap, Google Search Console setup and indexing fixes, on-page/content, UI/UX and Core Web Vitals, off-page and local, AI-search visibility, honest measurement. Includes a page auditor and a sitemap generator. No ranking promises |

## Supported agents

| Agent | Project folder | Global folder (`--global`) |
|---|---|---|
| Claude Code | `.claude/skills/` | `~/.claude/skills/` |
| OpenAI Codex | `.agents/skills/` | `~/.agents/skills/` |
| Cursor | `.agents/skills/` | `~/.cursor/skills/` |
| GitHub Copilot | `.agents/skills/` | `~/.copilot/skills/` |
| Google Antigravity | `.agents/skills/` | `~/.gemini/antigravity/skills/` |
| OpenCode | `.agents/skills/` | `~/.config/opencode/skills/` |
| Kimi Code CLI | `.agents/skills/` | `~/.agents/skills/` |

## Install

Needs Node.js 18+. From this folder:

```bash
node install.mjs --project ../my-website
```

Other options:

```bash
node install.mjs --global
```

```bash
node install.mjs claude cursor --project ../my-website
```

Or copy the folders in `skills/` into the folder from the table by hand.
For an older agent version without skills support, add these lines to its `AGENTS.md` / rules file:
`For any UI work, read and follow .agents/skills/premium-ui-expert-v1/SKILL.md.`
`For any backend, API or database work, read and follow .agents/skills/backend-expert-v1/SKILL.md.`
`For any testing, QA or load testing, read and follow .agents/skills/tester-expert-v1/SKILL.md.`
`For any SEO, metadata, sitemap or Search Console work, read and follow .agents/skills/seo-expert-v1/SKILL.md.`

## Use it

The agent picks the skill up automatically for UI work. Example prompts:

- "Redesign the landing page so it feels premium."
- "Add animations to this site."
- "Make my pricing page like linear.app's, but with our brand."
- "Audit this project's responsiveness and fix it."

The agent will ask about your goal, brand, references, motion intensity and which animation
modules you want, then build, then run the QA checklist and report.

## Structure

```
skills/premium-ui-expert-v1/
  SKILL.md                         how to think + workflow + motion rules + module menu
  references/animations.md         code recipes for all 14 animation modules + React/GSAP/Vue/Svelte ports
  references/psychology-and-color.md   premium-perception principles, palettes, type, spacing
  references/reference-cloning.md  devtools workflow to study a reference site + inspiration sources
  references/qa-checklist.md       responsiveness, motion, a11y, performance checks + report template
skills/backend-expert-v1/
  SKILL.md                         how to think + workflow + defaults + red flags + Test Handoff template
  references/call-map.md           frontend ↔ backend ↔ DB tracing, "needs the backend?", minimum-request design
  references/realtime.md           refetch vs short/long polling vs SSE vs WebSockets vs webhooks, with load math
  references/capacity-and-rate-limits.md   load formulas, inventory example, per-endpoint rate limits
  references/security.md           auth, sessions/JWT, password hashing, encryption, admin/portal access, OWASP API Top 10
  references/database.md           queries, indexes, pagination, transactions, stock concurrency, caching, migrations, backups
skills/tester-expert-v1/
  SKILL.md                         break-it mindset + safety rules + workflow + fix loop + bug report format
  references/break-it-playbook.md  double clicks/payments, races, tabs, back/refresh, network, tampering, boundaries, lifecycle
  references/api-security-testing.md   API inventory, auth, IDOR, roles, mass assignment, injection, rate limits, headers, scanners
  references/e2e-and-devtools.md   Playwright setup, devtools fixture, feature interaction matrix, a11y, responsive, UI fixes
  references/load-testing.md       permission template, k6 journeys, breakpoint, browser load, bottleneck table, report
  scripts/race.mjs                 fire N identical requests at once (double-submit / double-charge / oversell)
  scripts/idor-check.mjs           check other users and visitors can't reach an owner's objects
skills/seo-expert-v1/
  SKILL.md                         priorities, workflow, interview, the 16 SEO-agent capabilities, red flags, report format
  references/technical-seo.md      crawling, indexing, robots, sitemaps, canonicals, redirects, JS SEO, launch/migration checklists
  references/search-console.md     setup, sitemap submission, URL Inspection, every indexing status and fix, APIs, routine
  references/metadata-and-structured-data.md   titles, descriptions, head template, page-type matrix, schema, JSON-LD
  references/on-page-and-content.md   intent, keyword map, on-page, E-E-A-T, AI-content rules, briefs, myths
  references/ui-ux-for-seo.md      Core Web Vitals fixes, UI pattern risks, rendering, rules for the UI skill
  references/off-page-and-local-seo.md   links, disavow, brand, Business Profile, international
  references/ai-search-and-measurement.md   AI Overviews, AI crawlers, KPIs, reporting
  references/site-type-playbooks.md   per-site-type page inventory, metadata, risks
  references/agent-capabilities.md    capability map, tools and APIs, engagement workflow, safety
  scripts/seo-audit.mjs, scripts/sitemap-gen.mjs   page auditor and sitemap generator (zero dependencies)
install.mjs                        copies skills into each agent's folder
tests/                             tests for the skill scripts — run: node --test
```

## Demo shop and work report

`demo/shop` is a small shop built with all three skills in turn: backend design and Test Handoff, storefront UI, then testing (bugs found and fixed, load test).

```bash
cd demo/shop && npm run seed && npm start
```

Open http://localhost:3000. Run its tests with `npm test`. `report/work-report.html` summarises everything that was done; rebuild it with `node report/build.mjs`.

## Adding the next skill

Create `skills/<name>/SKILL.md` with `name` and `description` frontmatter, keep the main file
under ~300 lines, move detail into `references/`, and re-run `install.mjs`.
