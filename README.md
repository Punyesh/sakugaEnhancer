# Sakuga Enhancer

A bookmarklet for [sakugabooru.com](https://www.sakugabooru.com) — better search, an animator stats view, a show/episode browser, and a frame-accurate video viewer with trimming. Runs entirely in your browser, no server or extension.

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
- **Media viewer** — clicking any clip or image opens a lightbox instead of leaving the page:
  - Video: frame-by-frame navigator (frame count + timecode, single/10-frame/~1s step buttons, `,`/`.` keyboard shortcuts).
  - Mark an in/out range and **Download Trim** for a real, lossless stream-copy cut of just that range — runs entirely client-side via ffmpeg.wasm, no server involved. **Download Full** grabs the original file as-is.
  - **💬 Comments** — hidden by default, expands to fetch and show a post's comments only when you click it.
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

- This fork's `/tag.json` API doesn't honor `name_pattern` (substring search) or `limit=0` ("all tags") despite the docs — tag lookups instead paginate the full dictionary in parallel batches once, and cache it in `localStorage` for 6 hours.
- Sakugabooru loads Prototype.js, which overwrites `Array.prototype.filter/map/every/some/find` globally. This code avoids all of them in favor of plain loops.
- Episode grouping is a best-effort text parse of the `source` field, not structured data — accurate where tagging followed the "Title #12" convention, rougher where it didn't.
- Trimming uses `@ffmpeg/ffmpeg` 0.12.x deliberately, not the older 0.11.x API: 0.12.x lets us fetch the core/wasm/worker files ourselves and hand them over as same-origin `blob:` URLs, avoiding the cross-origin-worker restrictions that break the naive "point at a CDN URL" approach when running inside someone else's page. Its worker.js also has two sibling imports (`const.js`, `errors.js`) that don't resolve from a `blob:` URL on their own, so the code fetches and patches all three before use. No `SharedArrayBuffer` involved — genuinely not needed with the right package, rather than shimmed around.
- There's a one-time ~25–30MB download the first time you trim (cached by your browser after), gated behind a plain-language consent prompt — it never fetches anything until you say yes.
- No Share button — the Web Share API's OS-level share sheet turned out unreliable for file sharing (e.g. Windows' own dialog not reliably completing a "Copy" action for an in-memory video blob). Download + manually attaching the file is the dependable path, so that's what's here instead.

## Changelog

- **Removed Share button** — replaced by a reliable Download + manual attach workflow after the OS share sheet proved flaky for file sharing.
- **Collapsible comments** in the media viewer — hidden by default, fetched only on click.
- **Real in-browser video trimming** via ffmpeg.wasm — Mark In/Out on the frame navigator, then Download Trim for a lossless stream-copy cut, gated behind a one-time consent prompt for the ~25–30MB tool it needs.
- **Frame-by-frame media viewer** — clicking a clip/image now opens a lightbox instead of navigating away; videos get a full frame navigator (frame count, timecode, stepped seeking), images get a simple viewer with download.
- **Faster tag dictionary loading** — parallel-batch pagination plus `localStorage` caching, so the one-time dictionary fetch (needed since this fork's tag search API doesn't work as documented) only happens once every 6 hours instead of every page load.
- **Merged Animator Stats into Search** as an internal toggle instead of a separate tab, so switching between searching and checking stats for the same animator doesn't require re-entering anything.
- **Shows tab** — season/episode back-forward navigation with a breadcrumb, plus related-title chips for jumping between a show's variants (movies, alternate arcs).
- **Cross-tab sync** between Search and Stats — search an animator's tag or look them up directly, either view follows the other, cached so bouncing between them doesn't refetch.
- **Collapsible search filter** — a checkbox grid of co-occurring tags (animator tags marked and sorted first) for narrowing an already-fetched result set, tucked behind a toggle instead of always taking up space.
- **Initial release** — Search, Animator Stats, and Shows tabs; hover-to-preview video/tag/animator info dock; tag-substring search built by paginating the site's own tag list client-side, since the documented API parameters for this don't actually work on this fork.
