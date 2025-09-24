# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project overview
- Stack: Vite + React + TypeScript + Tailwind CSS + shadcn/ui + TanStack Query + Supabase
- App type: Single Page Application (SPA) — no server-side rendering
- Entrypoint: src/main.tsx renders <App/>; routing and providers are configured inside src/App.tsx
- Aliases: @ resolves to ./src (see vite.config.ts and tsconfig paths)

## Common commands (PowerShell-friendly)
- Install deps (local): npm i
- Clean CI install: npm ci
- Start dev server: npm run dev  → Vite on http://localhost:8080 (server.port=8080 in vite.config.ts)
- Lint all files: npm run lint  (ESLint 9 + typescript-eslint)
- Build (production): npm run build  → outputs to dist/
- Build (development profile): npm run build:dev
- Preview built app: npm run preview  (serves dist/)
- Tests: Not configured in this repository (no test runner/scripts defined). There's no command to run a single test at this time.

## Architecture and where things live
- Application composition (src/App.tsx):
  - Providers: QueryClientProvider (TanStack Query), AuthProvider (Supabase-backed), TooltipProvider
  - Routing: BrowserRouter + Routes. Primary routes include /, /auth, /reset-password, /templates, /strategy, /profile, /dashboard, /saas, and a catch-all * → NotFound
- State/data layer:
  - TanStack Query for async state and caching
  - Auth context in src/hooks/useAuth.tsx subscribes to Supabase auth state and exposes signIn/signUp/signOut/resetPassword
- UI layer:
  - Tailwind CSS with design tokens in src/index.css (CSS variables for light/dark plus sidebar palette)
  - shadcn/ui primitives under src/components/ui (accordion, button, dialog, form, etc.) used across pages and features
- Feature modules (examples, not exhaustive):
  - src/components/analytics/*: analytics dashboards (charts, KPIs, exporter, etc.)
  - src/components/auth/*: auth dialogs and invite code flows
  - src/components/dashboard/*: admin/user management views
  - src/pages/*: route-aligned screens (Index, Auth, PasswordReset, Templates, Strategy, Profile, NotFound)
  - src/hooks/*: domain hooks (useAuth, useAnalytics, useBusinessIntelligence, etc.)
  - src/lib/*: shared utilities (calendar, profile, shareUtils, general utils)

## Supabase integration
- Client: src/integrations/supabase/client.ts creates a typed Supabase client (Database type from src/integrations/supabase/types.ts). Sessions persist in localStorage; auto-refresh is enabled.
- Auth: src/hooks/useAuth.tsx wires Supabase auth (getSession, onAuthStateChange, signInWithPassword, signUp, signOut, resetPassword).
- Edge Functions: supabase/functions/
  - send-password-reset/index.ts — sends password reset email via Resend
  - send-signup-confirmation/index.ts — sends signup confirmation via Resend
  Both expect RESEND_API_KEY to be set in the Supabase environment. CORS preflight supported.
- MCP usage: For any Supabase interactions (queries, auth, migrations, functions ops), use MCP-based tools rather than direct CLI or ad-hoc scripts.
- Project config: supabase/config.toml sets project_id, site_url, and allowed redirect URLs. Update these if the deployment domain changes.
- Database schema: supabase/migrations contain SQL migrations for business/analytics/finance entities. The generated Database type (types.ts) reflects key tables like businesses, business_milestones, financial_records, finance_access_records, business_survival_records, analytics_summaries, etc.

## Tooling and configuration
- Vite (vite.config.ts):
  - Plugins: @vitejs/plugin-react-swc; lovable-tagger enabled only in development
  - Dev server: host "::" and port 8080
  - Alias: @ → ./src
- TypeScript: tsconfig.app.json uses bundler moduleResolution; project uses relaxed strictness (strict: false, noUnusedLocals/Parameters disabled). Paths mirror Vite alias.
- ESLint: eslint.config.js extends @eslint/js and typescript-eslint; react-refresh/only-export-components is warned; @typescript-eslint/no-unused-vars is off.
- Tailwind: tailwind.config.ts includes extended color tokens (including sidebar) and tailwindcss-animate; CSS variables/tokens defined in src/index.css.

## Deployment
- Production: Deployed to Vercel at https://jengabiz.africa
- Project name: jenga-biz
- Vercel MCP: Use `vercel_jengabiz` MCP tool for deployment operations

## Notes from README.md
- Requirements: Node.js + npm
- Local dev: npm i && npm run dev
- Built with: Vite, TypeScript, React, shadcn-ui, Tailwind CSS
- The README references Lovable for publishing, but this repo runs locally with the commands above.

## Operational guidance
- Use @ imports for internal modules (e.g., import { X } from '@/components/...').
- Supabase Edge Functions depend on the RESEND_API_KEY environment variable in the Supabase environment; this repo does not include CLI tasks for deploying functions.
- No tests are present. If test coverage is added later, document how to run a single test here (e.g., via Vitest or Playwright).

## 📦 MCP Usage Guidelines

### 🔧 Code Quality & Security
- **Semgrep MCP** → Run static analysis for vulnerabilities, bad patterns, and security checks.
  - Use before major commits or when reviewing PRs.
  - Run with targeted rules (e.g., `javascript.security`) instead of scanning everything unnecessarily.

- **@21st-dev/magic MCP** → Use utility tools for code formatting, transformations, or helper tasks.
  - Great for quick refactors or data shaping.

### 📚 External Knowledge & References
- **Exa MCP** → Fetch external knowledge, documentation, or articles.
  - Use when the answer isn't available locally.
  - Summarize results and store in Ref MCP for reuse.

- **Ref MCP** → Store and recall important snippets, configs, or retrieved docs.
  - Always prefer retrieving from Ref before calling Exa again to save credits.

- **Context7 MCP** → For experimental integrations with external structured data.
  - Use when you need fresh, nonstandard data sources.

### 🚀 Deployment & Infra
- **Vercel MCP** → Manage deployments, projects, and logs.
  - Use when you need to list deployments, get build logs, or deploy the current project.
  - For this project use `vercel_jengabiz` MCP.

- **Supabase MCP** → Manage DB schemas, queries, and authentication.
  - Use for structured database interactions instead of writing raw queries blindly.

### 🛠 Project Management & Monitoring
- **GitHub MCP** → Manage repos, issues, PRs, and discussions.
  - Use for project collaboration and automation.

- **Git MCP** → For local git operations (branches, commits, diffs).
  - Use before/after GitHub MCP to sync local and remote state.

- **Sentry MCP** → Query error monitoring, alerts, and performance data.
  - Use when debugging or after failed builds/deployments.

### 🌐 Automation & Testing
- **Playwright MCP** → Run automated browser workflows and tests.
  - Use for end-to-end testing and reproducible bug reports.

### 🧠 Efficiency Rules
- Always check **Ref MCP** first before making external calls (Exa, APIs, etc.).
- Use **Semgrep** before large commits to catch issues early.
- Use **Git MCP** for local changes, then **GitHub MCP** for syncing/PR management.
- Prefer **Sentry MCP** for debugging runtime errors instead of re-running failing tests blindly.
- Use **Exa** sparingly; store useful results in **Ref** for later reuse.

### 🎯 Primary Goal
Be efficient with AI credits by:
1. Using local MCP tools (Git, Semgrep, Ref) before external calls.
2. Fetching knowledge once (Exa) and caching it in Ref.
3. Automating repetitive workflows with Playwright and Magic MCP.

## Development Standards Reference
- Follow established coding standards: Google JavaScript/TypeScript Style Guide, W3C Web Standards, OWASP security practices
- Apply core principles: SOLID principles, KISS, DRY, YAGNI, Separation of Concerns, Fail Fast/Safe
- Maintain code quality through consistent patterns and the existing ESLint configuration
