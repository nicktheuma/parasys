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

## Production (Vercel)

- Import the project; set the same environment variables in the Vercel project settings.
- Add Stripe webhook URL: `https://<your-domain>/api/stripe/webhook`.
- **Client domain path (reverse proxy):** map `https://client.com/configurator` → your deployed origin so the browser stays on the client host; proxy `/api` if the checkout and session calls must be same-origin.

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
| DB push (Drizzle) | `npm run db:push` |
