# Parasys v2

Web-based parametric product configurators: admin-only operator console, public embeddable configurators, Stripe checkout for a “design package” (PDF + STL path to follow), and Postgres-backed catalog + orders.

## Stack

- **Frontend:** Vite, React 19, React Router 7, React Three Fiber, Zustand
- **API:** Vercel serverless functions in `/api` (Node runtime); local dev uses Express on port 3000 with Vite proxy
- **DB:** PostgreSQL via Drizzle ORM + Neon serverless driver

## Prerequisites

- Node 20+
- A Neon (or other) Postgres `DATABASE_URL`
- **Stripe** — only if you want paid checkout; optional for local testing (see “Testing without Stripe” below)

## Setup

```bash
cd parasys_v2
npm install
cp .env.example .env
```

Fill `.env`:

| Variable | Purpose |
|----------|---------|
| `ADMIN_PASSWORD` | Operator login for `/admin` |
| `SESSION_SECRET` | HMAC secret for admin session cookie (≥16 chars) |
| `DATABASE_URL` | Postgres connection string |
| `STRIPE_SECRET_KEY` | Stripe secret |
| `STRIPE_PRICE_ID` | One Stripe Price ID for the design package |
| `STRIPE_WEBHOOK_SECRET` | Signing secret from Stripe dashboard / CLI |
| `PUBLIC_APP_URL` | Where users return after Checkout and where **email download links** point (e.g. `http://localhost:5173`) |
| `RESEND_API_KEY` | Optional. [Resend](https://resend.com) API key — sends a receipt email with a download link after payment |
| `EMAIL_FROM` | Optional. Sender address (e.g. `Parasys <onboarding@resend.dev>` for testing; use your verified domain in production) |
| `ALLOW_FREE_DESIGN_PACKAGE` | Set `true` for **dev ZIP** download (placeholder PDF + STL) without Stripe |

Apply schema (run again after pulling schema changes):

```bash
npm run db:push
```

This creates/updates tables: `configurators` (with optional `settings` JSON for default dimensions and param graph), `orders`, and `materials` (with optional `shader` JSON for layered procedural materials).

Optional demo data (skips slugs that already exist):

```bash
npm run db:seed
```

## Development

Runs Vite on **5173** and the dev API on **3000** (Vite proxies `/api` → 3000).

```bash
npm run dev
```

The API (port **3000**) starts **before** Vite so `/api` is ready when the UI loads. If you still see `ECONNREFUSED` on 3000, wait a second after the terminal shows `[parasys] dev API listening`, or stop duplicate dev servers (only one `npm run dev`; avoid a second Vite on 5173/5174 fighting for the same API).

1. Open `/admin/login`, sign in with `ADMIN_PASSWORD`.
2. Under **Configurators**, create a product (template, slug, optional default dimensions in mm). Use **Edit** / **Delete** on cards as needed.
3. Under **Materials**, pick a configurator and add folder + name + hex colour (central library per product).
4. Open `/c/<slug>` — the title and default sizes load from the server; visitors can still change W×D×H in the UI.

### Admin sign-in fails (“Invalid password”)

- Ensure **`ADMIN_PASSWORD`** is set in **`parasys_v2/.env`** (same folder as `package.json`), with **no stray spaces** around `=` and no quotes unless your password is meant to include them.
- If you edited `.env`, **restart** `npm run dev` so the API process reloads env (the dev server loads `.env` from the project root explicitly).
- **Windows:** if you copied the password from elsewhere, try retyping it — invisible **CRLF** or trailing spaces in `.env` are trimmed in code now, but the value must still match what you type.
- If you see **“Session misconfigured”**, set **`SESSION_SECRET`** to a long random string (16+ characters).

### Testing without Stripe

1. Set `ALLOW_FREE_DESIGN_PACKAGE=true` in `.env` (and restart `npm run dev` so Vite picks up the flag).
2. Ensure the configurator **slug** exists in the database (create it in admin first).
3. On `/c/<slug>`, use **Download design package (dev)** — you get a ZIP with `summary.pdf`, `model.stl`, and `readme.txt` (placeholder content until real exports ship).
4. Leave Stripe variables unset or dummy; **Buy design package** will error until Stripe is configured — that’s expected.

**Stripe webhooks locally:** use Stripe CLI (`stripe listen --forward-to localhost:3000/api/stripe/webhook`) and put the printed signing secret in `STRIPE_WEBHOOK_SECRET`.

## Production (public hosting)

**Parasys v2** needs the **Vite app plus `/api` serverless routes** and a **Postgres** database. The old **parasys-mvp** app was static-only and could use **GitHub Pages** (`gh-pages` + `base: '/parasys/'`). For v2, use **Vercel** (or another host that runs Node serverless + static) so `/api/*` and the DB work.

### Vercel (recommended)

1. In [Vercel](https://vercel.com), **New Project** → import this Git repo.
2. Set **Root Directory** to `parasys_v2` (this repo also contains `parasys-mvp` and assets).
3. **Environment variables:** copy everything from your local `.env` that the app needs (same keys as [Setup](#setup)). Use production values: `PUBLIC_APP_URL=https://<your-deployment>.vercel.app` (or your custom domain), real `DATABASE_URL`, Stripe secrets, etc.
4. **Deploy.** `vercel.json` builds the Vite app and rewrites client routes to `index.html` while leaving `/api/*` for serverless handlers.
5. **Stripe:** Dashboard → Webhooks → endpoint `https://<your-domain>/api/stripe/webhook` with the signing secret in `STRIPE_WEBHOOK_SECRET`.
6. From the `parasys_v2` folder, after `vercel link`, you can run `npm run deploy` (production) or `npm run deploy:preview`.
7. Run `npm run verify:deploy -- https://<your-domain>` to fail fast on missing required Vercel env vars or broken core API endpoints.

#### Vercel CLI credentials (this machine / Cursor terminal)

The GitHub integration deploys without your laptop logging in, but **`npx vercel` in a terminal** needs its own auth.

**Option A — Browser login (typical dev laptop)**  
Run once:

```bash
cd parasys_v2
npx vercel login
```

That stores a session under `%USERPROFILE%\.vercel` (Windows) or `~/.vercel` (macOS/Linux). Then link the folder: `npm run vercel:cli -- link --yes` (or `npx vercel link`).

**Option B — Token (headless, CI, or when login is awkward)**  
1. Create a token: [Vercel → Account → Tokens](https://vercel.com/account/tokens).  
2. Copy `parasys_v2/.env.vercel.local.example` → **`.env.vercel.local`** and set `VERCEL_TOKEN=...` (this file is gitignored).  
3. Use the same npm scripts as usual: `npm run vercel:cli -- whoami`, `npm run deploy`, `npm run dev:vercel`. They run through `scripts/vercel-env-run.mjs`, which loads `.env.vercel.local` before invoking the CLI.

**Option C — Cursor / VS Code terminal env**  
In **User** settings JSON (Windows: `%APPDATA%\Cursor\User\settings.json`), you can set:

```json
"terminal.integrated.env.windows": {
  "VERCEL_TOKEN": "paste-token-from-vercel-dashboard"
}
```

Restart the integrated terminal. Prefer **User** settings so the token is not committed. Do not put real tokens in tracked repo files.

**Client domain (reverse proxy):** map `https://client.com/configurator` → your Vercel origin if the browser must stay on the client host; proxy `/api` if checkout and session calls must be same-origin.

### GitHub Pages (static UI only)

Not sufficient by itself: the UI would have no API unless you set `VITE_API_BASE` to a deployed API origin. If you still want a subpath build (same idea as mvp1), set `VITE_BASE_PATH=/parasys` (or your repo path) when running `npm run build`, deploy `dist/` to the `gh-pages` branch, and point `VITE_API_BASE` at your Vercel API URL. Prefer deploying **both** frontend and API on Vercel with `VITE_BASE_PATH` unset.

## What’s scaffolded vs next

| Area | Status |
|------|--------|
| Admin login + session | Done |
| Configurator CRUD + saved defaults (settings JSON) | Done |
| Materials library + layered procedural shader editor | Done (noise layers, blend, roughness/metalness) |
| Parametric graph (React Flow scaffold, saved on configurator) | Done under **Admin → Graph** |
| Template geometry (per `templateKey`, not only a box) | Done — see `src/features/configurator/TemplateProduct.tsx` |
| Stripe Checkout + webhook → order `paid` | Done |
| Receipt email (Resend) + token download URL | Done when `RESEND_API_KEY` + `PUBLIC_APP_URL` are set |
| Dev ZIP (placeholder PDF + STL, no payment) | Done when `ALLOW_FREE_DESIGN_PACKAGE=true` |
| Production PDF + nesting + paid file delivery | Not built yet |
| Node editor, props placement | Not built yet |
| Manufacturer network | Out of Phase 1 scope |

## Scripts

| Script | Command |
|--------|---------|
| Dev (Vite + API) | `npm run dev` |
| Vite only | `npm run dev:vite` |
| Full Vercel local | `npm run dev:vercel` |
| Vercel CLI (any subcommand) | `npm run vercel:cli -- <args>` (loads `.env.vercel.local`) |
| Deploy to Vercel (prod) | `npm run deploy` (after `vercel link` or `VERCEL_TOKEN`) |
| Deploy preview | `npm run deploy:preview` |
| Verify deployed health | `npm run verify:deploy -- https://<your-domain>` |
| DB push (Drizzle) | `npm run db:push` |
