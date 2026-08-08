# Self-hosted fonts

These `.woff2` files are served from this site's own origin so visitors never
make a request to a third-party font CDN, and so the render path avoids an
extra DNS/TLS round-trip.

| Family | Weights | License |
|---|---|---|
| Barlow Semi Condensed | 500, 600, 700 | SIL Open Font License 1.1 — `OFL-BarlowSemiCondensed.txt` |
| JetBrains Mono | 400, 500, 600 | SIL Open Font License 1.1 — `OFL-JetBrainsMono.txt` |

Only the `latin` and `latin-ext` subsets are shipped; this is an
English-language technical reference.

Do not edit these files or `src/styles/fonts.css` by hand — regenerate both with:

```sh
npm run fonts:fetch
```
