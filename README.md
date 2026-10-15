# EU Yacht VAT / T2L / CE Matrix

Static, zero-database pre-deposit checklist for used yachts in the EU.

Answer three questions and get **GO / HOLD / STOP** on:

1. **VAT-paid evidence** (first-sale invoice with VAT, import VAT receipt — not listing slogans)
2. **T2L / Union-goods** proof when customs may ask
3. **CE / RCD** plate + Declaration of Conformity (or legacy / PCA risk)

- **Live (GitHub Pages):** https://nareyko.github.io/eu-yacht-vat-matrix/
- **Static JSON SSOT:** [`data/matrix.json`](./data/matrix.json)
- **Rules (pure ES module):** [`vat-matrix.mjs`](./vat-matrix.mjs)

> Not legal, tax, or customs advice. National practice differs. Condition completion on documents that match the hull (HIN/CIN).

---

## FairHelm doors (next step after the matrix)

| Door | URL |
| --- | --- |
| **CapEx scanner** — paste the listing, surface unstated CapEx | https://fairhelm.com/en/yachts/tools/capex-scanner/ |
| **Listing review €49** — remote red-flag note on one public URL | https://fairhelm.com/en/yachts/services/listing-review/ |

Use CapEx when the boat is outside the Union or CE is missing (import VAT / PCA / delivery bands). Use listing review when the advert says “VAT paid” but papers are thin.

---

## Run locally

No build step, no npm dependencies:

```bash
# Unit tests (Node 20+)
npm test

# Static server
npm run serve
# → http://127.0.0.1:8080/
```

---

## Architecture

| Piece | Role |
| --- | --- |
| `data/matrix.json` | Axes, scenario fixtures, door URLs, sources |
| `vat-matrix.mjs` | `evaluate(answers)` → VAT / T2L / CE / overall |
| `app.js` + `index.html` | Client-only UI (fetch JSON, render in &lt;10 ms typical) |
| GitHub Pages (`main` `/`) | Public host — **0 DB** |

**Phase B (FairHelm monorepo — later, not this repo):** optional tools-route + JSON-LD WebApplication on fairhelm.com. This satellite stays the public MIT source.

---

## License

MIT © [FairHelm](https://fairhelm.com)
