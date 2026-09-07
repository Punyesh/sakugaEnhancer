# Sakuga Enhancer

A bookmarklet for [sakugabooru.com](https://www.sakugabooru.com): improved search, pools, animator statistics, a show/episode browser, a frame-accurate video viewer with trimming, and voting. Runs entirely client-side; no server or browser extension required.

<img width="940" height="943" alt="sEapp (1)" src="https://github.com/user-attachments/assets/e6f95f14-d878-4a1e-bbb6-d6c72241b798" />


## Installation

**[punyesh.github.io/sakugaEnhancer/install.html](https://punyesh.github.io/sakugaEnhancer/install.html)**

Drag the bookmarklet on that page to your bookmarks bar. It is a loader that fetches the current script from this repository's Pages URL on each click, so updates require only a push to `main`.

Navigate to sakugabooru.com and click the bookmark to launch.

<details>
<summary>Local alternative (if the link above is unavailable)</summary>

Open `install.html` directly from this repository. Note: viewing it on github.com shows the raw source, not a working page — GitHub Pages must be enabled, or the file opened locally.

</details>

## Features

- **Search** — tag-chip search, sort by score, newest, oldest, or random; a "solo cuts only" filter (exactly one animator credited); a collapsible filter grid for co-occurring tags; infinite scroll.
- **Animator Stats** (toggle within Search) — cut count, average score, activity-by-year chart, and top co-tags for the animator in focus.
- **Shows** — search a title and browse its episodes, parsed from post source text, with back/forward navigation.
- **Pools**:
  - *My Pools* — local only (`localStorage`), no login required. Server-side pool creation requires an account tier most accounts lack.
  - *Browse Public Pools* — read-only browsing of pools other users have made public.
- **Media viewer** — opens clips and images in a lightbox:
  - Frame-by-frame navigation for video (frame count, timecode, step controls, keyboard shortcuts).
  - **Voting** — genuine 1–3 star ratings. Ratings may be changed or cleared, and your current rating is read from the post page itself.
  - **Download Trim** — lossless, client-side stream-copy cut of a marked range, via ffmpeg.wasm. **Download Full** retrieves the original file.
  - Comments, loaded on demand.
  - Add to Pool, Copy Link.
  - Tag chips are clickable throughout, jumping to a fresh search.
- **Info popup** — a per-card badge shows tags, score, rating, and links without leaving the results view.
- **Panel** — draggable and resizable from any edge or corner, with position/size persisted, a Reset control, and a Lock Size toggle (fixed card size vs. fixed column count).
- Search and Stats remain synchronized on the active animator.

## Files

- `sakuga-enhancer.js` — application source.
- `build.js` — produces the bookmarklet URI (`bookmarklet.txt`).
- `build-install.js` — generates `install.html`.
- `install.html` — the installable page.

Rebuild after editing:
```
node build.js && node build-install.js
```

## Notes

- `/tag.json`'s `name_pattern` and `limit=0` parameters do not function as documented on this fork. Tag search instead paginates the full tag dictionary once and caches it in `localStorage` for six hours.
- This is a Danbooru 1.x/Moebooru engine, not Danbooru2. The ascending-by-id sort token is `order:id`; `order:id_asc` (a Danbooru2 convention) is silently ignored, which previously caused "Oldest" to return newest-first results.
- Voting is a 1–3 star system (`score=1|2|3`), confirmed against the live API. Re-voting replaces an existing rating rather than being rejected; score changes by the delta between old and new values. No endpoint exposes a given account's vote directly, and the rendered post page is identical across all vote states — but the true value is present in every page load, embedded in an inline `Post.register_resp({...})` call under a `votes` map.
- Server-side pool creation returns an authorization error for most accounts, confirmed via the API and directly on the site.
- `/pool/show.json?id=X` is the correct single-pool endpoint; `/pool.json?id=X` ignores the `id` parameter and returns its default list.
- This site loads Prototype.js, which overrides `Array.prototype.filter/map/every/some/find`. This code uses plain loops or the included `safeFilter`/`safeMap`/`safeSort` helpers instead. `.slice()` and `.forEach()` are unaffected.
- Episode grouping is a best-effort parse of the `source` field and is not guaranteed accurate for posts that don't follow the "Title #12" convention.
- Trimming uses `@ffmpeg/ffmpeg` 0.12.x, which allows serving the core/wasm/worker files as same-origin `blob:` URLs — necessary to avoid cross-origin worker restrictions when running inside another site's page. No `SharedArrayBuffer` dependency.
- The first trim triggers a one-time ~25–30MB download, cached thereafter, gated behind an explicit consent prompt.
- No share button is provided; the Web Share API proved unreliable for file sharing across platforms. Download and manual attachment is used instead.

## Changelog

- Infinite scroll, replacing the manual "Load more" control.
- Fixed "Oldest" sort returning newest-first results (`order:id_asc` → `order:id`).
- Real 1–3 star voting, replacing a flat upvote; supports re-voting, clearing, and reading the account's current rating.
- Pools: local (private) and public (read-only) browsing, plus "Add to Pool" from the media viewer.
- Solo Cuts Only search filter.
- Info popup, replacing a hover-triggered dock that previously disrupted scroll position.
- Draggable, resizable panel with persisted geometry, Reset, and Lock Size.
- Icon-based header controls, replacing text labels and decorative emoji.
- Removed share button in favor of download-and-attach.
- Collapsible, on-demand comments in the media viewer.
- Client-side video trimming via ffmpeg.wasm.
- Frame-by-frame media viewer (lightbox) for video and images.
- Tag dictionary caching, reducing repeated full-dictionary fetches.
- Animator Stats merged into Search as a toggle.
- Shows tab with episode navigation and related-title linking.
- Search/Stats synchronization on the active animator.
- Collapsible tag filter grid for narrowing existing results.
- Initial release: Search, Animator Stats, and Shows, with client-side tag-substring search.
