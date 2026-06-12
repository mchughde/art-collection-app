# Impressionist Art Collection

A personal PWA for curating Impressionist and related artworks from the Art Institute of Chicago and Cleveland Museum of Art.

**Live app:** https://mchughde.github.io/art-collection-app/

## What it does

- Browse and search artworks from two open-access museum collections
- Save artworks to your personal collection
- Export and import your collection as a JSON file for backup or transfer between devices

## Design philosophy

This is a personal curation tool, not an art-historical reference. The goal is to make it easier to find and save paintings that are personally appealing, working across two large open-access museum collections.

The period labels — Pre-Impressionism, Impressionism, Post-Impressionism, and so on — are used as **probability filters**, not precise classifications. Selecting "Post-Impressionism" doesn't guarantee every result is a Post-Impressionist work; it means that within those years (1886–1899), the density of the kinds of paintings worth browsing is higher than it would be across the full collection. The label narrows the field to a plausible neighbourhood; personal taste does the rest.

Each period bucket will contain a broad mix of styles — academic portraits, landscapes, genre scenes, and decorative works sit alongside the canonical Impressionist and Post-Impressionist paintings. That's an honest reflection of what museums actually hold from those years, and it's how the two source APIs work: neither is filtered to Impressionism specifically. The personal collection layer — saving, tagging, notes, and favourites — is where individual curatorial choices live.

This approach is consistent with how cross-institutional art aggregators like Europeana handle the same problem: date ranges are the one field that exists in some form across all institutions, making them the most reliable basis for a consistent browsing experience even when style classifications vary or are absent entirely.

## Collection scope and data sources

The app browses two open-access museum APIs. Neither API is filtered to Impressionism specifically — both return their broader collections, with period labels assigned client-side by the artwork's completion date.

### Art Institute of Chicago (AIC)

- **API:** `api.artic.edu/api/v1/artworks/search`
- **Filter:** artworks with images, from departments matching painting, prints, drawing, Americas, or graphic arts
- **Date filter:** completion date (`date_end`) in range 1820–1940 for browsing
- **Period assignment:** based on AIC's own `date_end` field (a clean integer), fully deterministic

### Cleveland Museum of Art (CMA)

- **API:** `openaccess-api.clevelandart.org/api/artworks`
- **Filter:** `type=Painting`, `has_image=1`
- **Date filter:** `created_after` / `created_before` parameters on the CMA API
- **Period assignment:** based on the last 4-digit year found in the `creation_date` string (e.g. "c. 1896–1908" → 1908)

### Period boundaries

Periods are assigned purely by year — not by the museums' own style classifications:

| Period | Date range | AIC | CMA | Total artworks |
|---|---|---|---|---|
| **All periods** | **1820–1940** | **44,824** | **735** | **~45,559** |
| Pre-Impressionism | 1820–1859 | 10,078 | 217 | 10,295 |
| Early Impressionism | 1860–1879 | 5,322 | 290 | 5,612 |
| High Impressionism | 1880–1885 | 1,480 | 54 | 1,534 |
| Post-Impressionism | 1886–1899 | 5,840 | 129 | 5,969 |
| Fauvism | 1900–1907 | 4,680 | 72 | 4,752 |
| Cubism | 1908–1920 | 6,301 | 44 | 6,345 |
| Early Modern | 1921–1940 | 11,123 | 36 | 11,159 |

**Notes:**
- "All periods" and the individual period totals differ by ~0.2% (107 artworks). This is because some CMA artworks have date spans that cross period boundaries (e.g. "c. 1896–1908") and are counted in two adjacent period buckets.
- The lower bound of 1820 reflects the app's focus on 19th–early 20th century art. Pre-1820 works (ancient, medieval, Renaissance) are excluded.
- The upper bound of 1940 marks the end of the Early Modern period. Post-1940 works appear only under "Other / Unknown".
- AIC also holds far more works outside this date range; the keyword-free date filter means the AIC results include all departments and media, not just Impressionist painting.

## Pushing updates

After making changes, run in Terminal:

```bash
cd "/Users/diannemchugh/Library/CloudStorage/GoogleDrive-mchughde@gmail.com/My Drive/Art Collection app"
git add -A
git commit -m "Describe your change here"
git push https://mchughde@github.com/mchughde/art-collection-app.git main
```

The live site updates automatically within a minute or two.
