## Project Context

A community-managed wiki and documentation site for arcdps (the Guild Wars 2 combat-analysis addon), hosted under axi.link on Cloudflare Pages. Contributors edit Markdown via GitHub pull requests, and an automated pipeline decompiles the arcdps DLL on a cadence to keep generated reference material fresh. The site aims to be a beautiful, modern docs experience realizing the arc dev's vision of a community help system.

## Goals

- Provide a community-managed wiki/help system for arcdps
- Use a Git-backed Markdown workflow with GitHub PR-based contributions
- Deliver a beautiful, modern site design
- Host on Cloudflare Pages under the axi.link domain
- Build an automated pipeline that decompiles the arcdps DLL on a cadence and updates generated reference pages (via GitHub Actions or the local venus.local device)

## Out of scope

- In-browser wiki-style editing with a live database backend

## Suggested stack

- **Astro + Starlight** — Modern, fast static docs framework with beautiful defaults, built-in search/nav, and Markdown/MDX content that deploys cleanly to Cloudflare Pages
- **Cloudflare Pages** — Cheap, fast static hosting that fits the axi.link setup and Git-backed deploy workflow
- **GitHub + GitHub Actions** — PR-based contribution workflow plus a scheduled job for the decompile-and-update automation
