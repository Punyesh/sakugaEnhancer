# Sakuga Enhancer

A bookmarklet for [sakugabooru.com](https://www.sakugabooru.com) — better search, pools, an animator stats view, a show/episode browser, a frame-accurate video viewer with trimming, and real voting. Runs entirely in your browser, no server or extension.

<img width="940" height="943" alt="sEapp (1)" src="https://github.com/user-attachments/assets/05b6a9e3-2779-4018-bd14-9bccab88fd14" />


## Install

**[punyesh.github.io/sakugaEnhancer/install.html](https://punyesh.github.io/sakugaEnhancer/install.html)**

Open that page and drag the bookmarklet to your bookmarks bar. It's a tiny loader that fetches the live script from this repo's Pages URL at click-time, so future updates just need a push to `main` — no need to reinstall.

Go to sakugabooru.com, click your bookmark.

<details>
<summary>Local alternative (if the link above isn't live)</summary>

Open `install.html` directly from this repo instead — same button, same result. (Note: viewing it on github.com itself shows the raw code, not a working page — you need GitHub Pages enabled, or the file downloaded/opened locally.)

</details>

## Features

- **Search** — tag-chip search, sort by score/newest/oldest/random, a "solo cuts only" toggle (exactly one animator credited), a collapsible filter grid for co-occurring tags, and infinite scroll.
- **Animator Stats** (toggle inside Search) — cut count, avg score, activity-by-year chart, and top co-tags for whichever animator is in focus.
- **Shows** — search a title, browse its episodes (parsed from post source text), with back/forward navigation.
- **Pools** — two intentionally separate systems:
  - **My Pools** — fully local (this browser's `localStorage`), no login. Real pool creation needs an account-permission tier most accounts don't have, confirmed both via the API and by testing directly on the site.
  - **Browse Public Pools** — real, read-only browsing of pools other users made public.
- **Media viewer** — clicking any clip or image opens a lightbox instead of leaving the page:
  - Video: frame-by-frame navigator (frame count + timecode, single/10-frame/~1s step buttons, `,`/`.` keyboard shortcuts).
  - **Voting** — real 1–3 star ratings, not a flat upvote. Re-rating changes an existing vote rather than being rejected, and can be cleared back to unrated. Your actual account's current rating is read straight from the post page itself and shown the moment a clip opens.
  - Mark an in/out range and **Download Trim** for a real, lossless stream-copy cut of just that range — runs entirely client-side via ffmpeg.wasm, no server involved. **Download Full** grabs the original file as-is.
  - **Comments** — hidden by default, expands to fetch and show a post's comments only when you click it.
  - **Add to Pool** and **Copy Link**.
  - Clicking a tag chip anywhere (results, viewer, info popup) jumps straight to a fresh search for it.
- **Click-for-info popup** — a small badge on every card opens tags, score, rating, and source/post links in a floating popup next to it, without disturbing your scroll position or opening the clip.
- The whole panel is **draggable** (grab the header) and **resizable** (any corner or edge), remembers its position and size, and has a one-click **Reset**. A **Lock Size** toggle switches the results grid between "cards stretch to fill the panel" (default) and "cards stay a fixed size, more/fewer fit per row instead."
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
- Sort order is a real gotcha: this is a classic Danbooru 1.x/Moebooru engine, not Danbooru2 — so the ascending-by-id token is plain `order:id`, not `id_asc` (a Danbooru2-only convention). Using `id_asc` doesn't error, it just silently falls back to the default order, so "Oldest" quietly returned "Newest" until this was caught and fixed.
- Voting is genuinely a 1–3 star system (`score=1|2|3` on `/post/vote.json`), confirmed live — not a flat upvote, and re-voting overwrites your existing rating (score changes by the *delta*, e.g. 1★→3★ moves the total by +2, not +3). There's no dedicated "check my vote" endpoint and the post page's rendered HTML/DOM never reflects it either (confirmed by diffing all four rating states directly) — but the real value ships in every single post page load anyway, embedded in an inline `Post.register_resp({...})` script under a `votes` map keyed by post id, which is what this reads.
- Real pool creation is blocked by an account-permission tier most accounts (including a freshly made test account) don't have — confirmed both via the API ("access denied") and by trying to create a pool directly on the site. Hence the local/public split above.
- `/pool/show.json?id=X` is the correct single-pool lookup — `/pool.json?id=X` is the list-all endpoint and silently ignores an unrecognized `id`, always returning its default list regardless of what was asked for.
- Sakugabooru loads Prototype.js, which overwrites `Array.prototype.filter/map/every/some/find` globally. This code avoids all of them in favor of plain loops or the file's own `safeFilter`/`safeMap`/`safeSort` wrappers. `.slice()` and `.forEach()` are confirmed unaffected.
- Episode grouping is a best-effort text parse of the `source` field, not structured data — accurate where tagging followed the "Title #12" convention, rougher where it didn't.
- Trimming uses `@ffmpeg/ffmpeg` 0.12.x deliberately, not the older 0.11.x API: 0.12.x lets us fetch the core/wasm/worker files ourselves and hand them over as same-origin `blob:` URLs, avoiding the cross-origin-worker restrictions that break the naive "point at a CDN URL" approach when running inside someone else's page. Its worker.js also has two sibling imports (`const.js`, `errors.js`) that don't resolve from a `blob:` URL on their own, so the code fetches and patches all three before use. No `SharedArrayBuffer` involved — genuinely not needed with the right package, rather than shimmed around.
- There's a one-time ~25–30MB download the first time you trim (cached by your browser after), gated behind a plain-language consent prompt — it never fetches anything until you say yes.
- No Share button — the Web Share API's OS-level share sheet turned out unreliable for file sharing (e.g. Windows' own dialog not reliably completing a "Copy" action for an in-memory video blob). Download + manually attaching the file is the dependable path, so that's what's here instead.

## Changelog

- **Infinite scroll** — replaced the "Load more" button with an `IntersectionObserver` watching a sentinel near the bottom of the results, matching a native list's feel.
- **Fixed "Oldest" sort silently returning "Newest"** — `order:id_asc` isn't a real token on this engine; switched to `order:id`.
- **Real 1–3 star voting**, replacing the previous flat upvote — includes re-voting (changes an existing rating instead of being rejected), clearing back to unrated, and reading your actual current rating straight from the post page's own embedded data instead of guessing.
- **Pools** — My Pools (local, `localStorage`, no login) and Browse Public Pools (real, read-only), plus an "Add to Pool" action from inside the media viewer.
- **Solo Cuts Only** search toggle — filters to posts with exactly one animator credited, auto-disabled if the search already requires 2+ animators.
- **Click-for-info popup**, replacing the old hover dock — the old dock lived at the bottom of the entire results list and had to yank your scroll position to bring itself into view on every hover; the popup instead floats next to whatever you clicked and never touches scroll.
- **Draggable, resizable panel** — grab the header to move it, drag any corner or edge to resize, one-click Reset, and a Lock Size toggle for fixed-size-cards-reflow-count instead of fixed-column-count-stretch.
- **Icon-only header controls** and general de-emojification, matching the app's icon-toggle conventions instead of colorful pictographs.
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
