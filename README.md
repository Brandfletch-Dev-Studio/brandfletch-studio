# Brandfletch Dev Studio Website

Static website for Brandfletch Dev Studio — a WordPress website design and hosting business, backed by a full software dev studio. Built with vanilla HTML, CSS, and JS — no build step, no dependencies.

## What this site does

- Sells WordPress website design & build services
- Sells tiered hosting packages, billed in Malawi Kwacha (MWK)
- Lists add-on services (domain registration, business email, e-commerce setup, SEO)
- Showcases past dev studio projects as proof of technical capability
- Includes a password-protected admin panel (`/admin`) for editing all content without touching code

## Content is data-driven

All homepage content — services, hosting packages, add-ons, projects, about section, stats, and contact info — lives in `content.json` and is edited through the admin panel at `/admin`. The homepage fetches it via `/api/content` at load time.

## Admin panel

Go to `/admin`, log in with the `ADMIN_PASSWORD` environment variable, and edit:
- Services
- Hosting Packages (name, pricing in MWK, features, highlight badge)
- Add-ons
- Projects
- About section & stats
- Contact form messages

Changes are committed straight to `content.json` in this repo via the GitHub API.

## Environment variables (Vercel)

- `GITHUB_TOKEN` — token with write access to this repo, used by `/api/content` to read/update `content.json`
- `ADMIN_PASSWORD` — password for the admin panel

## Deploy to Vercel

This repo is set up to deploy directly on Vercel with serverless functions in `/api`. Push to `main` and Vercel picks it up automatically.

## Customizing

### Hosting Packages & Pricing
Edit through `/admin` → Hosting Packages. Prices are entered in Malawi Kwacha (MWK).

### Services & Add-ons
Edit through `/admin` → Services / Add-ons.

### Projects
Edit through `/admin` → Projects. Mark a project "Featured" to have it show on the homepage; if nothing is marked featured, all projects show.

### Colors
Edit the CSS variables at the top of `css/style.css` under `:root`.

### Contact Info
Update through `/admin` → About, or directly in `content.json`.

### Favicon
Replace `assets/favicon.svg` with your own.

## Custom Domain
In Vercel project settings, add your custom domain under **Domains**.
