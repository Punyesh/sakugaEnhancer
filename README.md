# Sakuga Enhancer

A bookmarklet for [sakugabooru.com](https://www.sakugabooru.com): improved search, pools, animator statistics, a show/episode browser, a frame-accurate video viewer with trimming, voting, and a pool exporter that turns clips into grids or back-to-back sequences with animator credits and music. Runs entirely client-side; no server or browser extension required.

An Android port lives at [Punyesh/sakugaEnhancerApp](https://github.com/Punyesh/sakugaEnhancerApp). It does not have every feature below yet (notably the newer export options).

<img width="940" height="943" alt="sEapp (1)" src="https://github.com/user-attachments/assets/e6f95f14-d878-4a1e-bbb6-d6c72241b798" />


## Installation

**[punyesh.github.io/sakugaEnhancer/install.html](https://punyesh.github.io/sakugaEnhancer/install.html)**

Drag the bookmarklet on that page to your bookmarks bar. It is a loader that fetches the current script from this repository's Pages URL on each click, so updates require only a push to `main`.

Navigate to sakugabooru.com and click the bookmark to launch. If you launch it from a post page, that post's tags are already loaded as search chips; from a search page, that page's search (and sort) is carried over and run.

<details>
<summary>Local alternative (if the link above is unavailable)</summary>

Open `install.html` directly from this repository. Note: viewing it on github.com shows the raw source, not a working page — GitHub Pages must be enabled, or the file opened locally.

</details>

## Features

- **Search** — tag-chip search, sort by score, newest, oldest, or random; infinite scroll; a collapsible filter grid for co-occurring tags; and two one-click filters:
  - **Solo cuts only** — exactly one animator credited.
  - **Hide uncredited** — drops cuts with no real credit (tagged only `artist_unknown`, or no animator tag). A cut with `artist_unknown` plus a real animator is kept.
- **Back button** — a general "← back" returns to the previous search, wherever you came from (including after clicking an animator or tag).
- **Animator Stats** (toggle within Search) — cut count, average score, activity-by-year chart, and top co-tags for the animator in focus. Clicking an animator from a show's most-tagged list adds them to the search without replacing the show tag.
- **Shows** — search a title and browse its episodes, parsed from post source text, with back/forward navigation.
- **Pools**:
  - *My Pools* — local only (`localStorage`), no login required. Server-side pool creation requires an account tier most accounts lack.
  - *Browse Public Pools* — read-only browsing of pools other users have made public.
  - *Export Clips* — see [Pool export](#pool-export).
- **Media viewer** — opens clips and images in a lightbox:
  - Frame-by-frame navigation for video (frame count, timecode, step controls, keyboard shortcuts).
  - **Voting** — genuine 1–3 star ratings. Ratings may be changed or cleared, and your current rating is read from the post page itself.
  - **Download Trim** — client-side cut of a marked range via ffmpeg.wasm: a fast stream copy by default, or a frame-accurate re-encode when the "frame-accurate" box is ticked. **Download Full** retrieves the original file. Both offer MP4 / GIF / APNG, a size, and quality options under "more options".
  - Comments, loaded on demand.
  - Add to Pool, Copy Link.
  - **Credits block** directly under the top bar: the animator name(s) in large amber chips, then the show and other tags at a readable size. Every chip is clickable and jumps to a fresh search.
- **Info popup** — a per-card badge shows tags, score, rating, and links without leaving the results view.
- **Panel** — draggable and resizable from any edge or corner, with position/size persisted, a Reset control, and a Lock Size toggle (fixed card size vs. fixed column count).
- Search and Stats remain synchronized on the active animator.

### Pool export

*Export Clips* on a pool opens the **Export Composer**, one window where the export is built by looking at it:

- **Live preview** of the real result: the actual thumbnails in their cells, numbered, with each clip's label drawn where it will land.
- **Drag to rearrange** — drag clips directly in the preview; the others slide aside live. The same drag works in the clip list, and in Back to back mode a filmstrip under the frame does the job. All views stay in sync. Keyboard: focus a row's grip and press Up/Down.
- **Layout** — *Grid* (auto-sized to the clip count, short last row centred) or *Back to back* (clips play one after another); landscape or portrait; optionally feature the first clip larger above the rest.
- **Shorter clips** (grid) — replay until the longest clip ends, or hold the last frame.
- **Labels** — print each clip's credited animator names on it, as outlined text or on a translucent box. Position with the 3×3 picker, or drag the label in the preview to any spot. Type custom text on any clip to replace its names.
- **Per clip** (click a row) — trim range (type it, or *Pick in video* to mark it in the viewer), custom label text, **Duplicate** (show a clip again, e.g. with a different segment), **Remove**. *+ Add clip* brings back anything left out. The default is the first 9 video clips; more gets slow and memory-heavy.
- **Music** — add up to 5 audio files (click, or drop them on the Music row). Played back to back from the start, cut to the video's length; play once or loop. Sakugabooru clips carry no audio, so this is the only sound in an export.
- **Progress** — a progress bar tracks fetching, trimming and encoding.
- **Result** — opens in a viewer with frame stepping, optional trim of the finished export, and the same format / size / quality options (MP4, GIF, or APNG) as single clips. Booru clips are 480p, so sizes offered are Source, 480p, 360p and 240p.

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
- Exports use real ffmpeg filter graphs: a black background plus chained `overlay` for grids (`xstack` leaves gaps), `tpad` to hold a last frame, and `drawtext` for labels (the label font is loaded into the wasm filesystem; text is measured with the browser canvas so wrapping matches). The wasm core is ffmpeg 5.1-era, so some newer filter options are unavailable (e.g. `drawtext` `text_align`: multi-line labels stay left-aligned).
- GIF output is two-pass (`palettegen` then `paletteuse`); APNG is saved as `.png`.
- Trimming uses `@ffmpeg/ffmpeg` 0.12.x, which allows serving the core/wasm/worker files as same-origin `blob:` URLs — necessary to avoid cross-origin worker restrictions when running inside another site's page. No `SharedArrayBuffer` dependency.
- The first trim triggers a one-time ~25–30MB download, cached thereafter, gated behind an explicit consent prompt.
- No share button is provided; the Web Share API proved unreliable for file sharing across platforms. Download and manual attachment is used instead.

## Changelog

- **Clip viewer credits moved to the top.** The animator and tags were small 10px chips at the very bottom of the clip window; they now sit right under the top bar, with the animator at 15px, so they're visible without scrolling. Images use the same layout.
- **Consistent shapes and spacing** across every screen and window: one corner radius for all controls (buttons, inputs, selects, icon buttons, chips), one for containers (panels, cards, popups, modals), regular controls 28px and small ones 24px tall, and a 4px spacing grid. The Search button now sits in the same row as the tag field and sort, and empty rows no longer leave gaps. The radii and heights are variables at the top of the style list in `sakuga-enhancer.js`.

- **Export Composer**: the pool export panel is replaced by a single window with a live preview, drag-to-rearrange in the preview, list and filmstrip, per-clip trim / label / duplicate / remove, and Labels / Music rows.
- **Label placement**: 3×3 position picker plus free drag in the preview.
- **Per-clip custom label text** (replaces animator names for that clip).
- **Repeated clips**: duplicate a clip within an export, each copy with its own trim and label.
- **Music in exports**: up to 5 tracks, play once or loop.
- **Export formats**: MP4 / GIF / APNG with size, quality and frame-rate options; sizes limited to what 480p sources make sense for.
- **Progress bars** for exports, trims and downloads.
- **Frame-accurate trim** option (re-encode) alongside the fast stream-copy trim.
- **Hide uncredited** filter.
- **General back button** across searches, replacing the episode-list-only back link.
- Clicking an animator from a show's top list no longer replaces the show tag.
- Opening the bookmarklet on a booru page preloads that page's tags or search.
- Mute control only appears when an export actually has audio.
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
