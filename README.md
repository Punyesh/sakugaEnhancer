# Sakuga Enhancer

A bookmarklet for [sakugabooru.com](https://www.sakugabooru.com) — better search, an animator stats view, and a show/episode browser. Runs entirely in your browser, no server or extension.

## Install

**[punyesh.github.io/sakugaEnhancer/install.html](https://punyesh.github.io/sakugaEnhancer/install.html)**

Open that page — there are two buttons, drag whichever matches your browser to your bookmarks bar:
- **Chrome / Edge / Safari** — the full script, self-contained.
- **Firefox** — a short loader that fetches the script from this repo's Pages URL at click-time, since Firefox has trouble saving very long bookmarklet links.

Go to sakugabooru.com, click your bookmark.

<details>
<summary>Local alternative (if the link above isn't live)</summary>

Open `install.html` directly from this repo instead — same button, same result. (Note: viewing it on github.com itself shows the raw code, not a working page — you need GitHub Pages enabled, or the file downloaded/opened locally.)

</details>

## Features

- **Search** — tag-chip search with sort order, hover-to-preview clips, a tag/animator info dock, and a collapsible filter grid.
- **📊 Animator Stats** (toggle inside Search) — cut count, avg score, activity-by-year chart, and top co-tags for whichever animator is in focus.
- **Shows** — search a title, browse its episodes (parsed from post source text), with back/forward navigation.
- Search and Stats stay in sync — search an animator's tag or look them up directly, either way the other view follows.

## Files

- `sakuga-enhancer.js` — the app itself. Edit this for changes.
- `build.js` — turns it into a `javascript:` bookmarklet URI (`bookmarklet.txt`).
- `build-install.js` — generates `install.html` from that.
- `install.html` — what you actually drag to your bookmarks bar.

Rebuild after any edit:
```
node build.js && node build-install.js
```

## Notes

- This fork's `/tag.json` API doesn't honor `name_pattern` (substring search) or `limit=0` ("all tags") despite the docs — tag lookups instead paginate the full dictionary once and cache it in `localStorage` for 6 hours.
- Sakugabooru loads Prototype.js, which overwrites `Array.prototype.filter/map/every/some/find` globally. This code avoids all of them in favor of plain loops.
- Episode grouping is a best-effort text parse of the `source` field, not structured data — accurate where tagging followed the "Title #12" convention, rougher where it didn't.
