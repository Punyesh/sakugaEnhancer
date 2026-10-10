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
  - *My Pools* — local only (`localStorage`), no login required. Each pool in the list shows a three-clip preview strip and its clip count. Server-side pool creation requires an account tier most accounts lack.
  - *Browse Public Pools* — read-only browsing of pools other users have made public.
  - *Export Clips* — see [Pool export](#pool-export).
- **Media viewer** — opens clips and images in a lightbox:
  - Frame-by-frame navigation for video (frame count, timecode, step controls, keyboard shortcuts).
  - **Voting** — genuine 1–3 star ratings. Ratings may be changed or cleared, and your current rating is read from the post page itself.
  - **Download Trim** — client-side cut of a marked range via ffmpeg.wasm: a fast stream copy by default, or a frame-accurate re-encode when the "frame-accurate" box is ticked. **Download Full** retrieves the original file. Both offer MP4 / GIF / APNG, a size, and quality options under "more options".
  - **Comments panel** — comments sit in their own panel in the left column, under the credits panel (and below the viewer on narrow screens). Loaded on demand; long threads scroll inside the panel, so the three panels never overlap.
  - Add to Pool, Copy Link.
  - **Credits panel** — the animator and tags sit in their own panel to the left of the viewer (stacked above it on narrow screens), at a larger readable size; the panel and its chips size to their content and long tag names wrap instead of scrolling. Every chip is clickable and jumps to a fresh search.
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

- `web-src/` — the source, as ordered modules (see below). **Edit these.**
- `sakuga-enhancer.js` — generated: `web-src/` stitched into the single script the install bookmarklet loads. Committed so the hosted install keeps working; don't edit it by hand.
- `build.js` — builds `sakuga-enhancer.js` from `web-src/`, then the bookmarklet URI (`bookmarklet.txt`).
- `build-install.js` — generates `install.html`.
- `install.html` — the installable page.

Rebuild after editing:
```
node build.js && node build-install.js
```

### Source layout

All modules are parts of **one closure** (they share scope, no imports), joined in filename order, so the numeric prefix is the load order.

| Module | What's in it |
|---|---|
| `00-head` … `01-tokens` | entry guards, colors and the shape/size scale (`R_CTL`, `R_BOX`, `R_INNER`, `H_CTL`, `H_SM`) |
| `02-css/` | the stylesheet, one file per area (panel, forms, results, tags, shows, stats, composer, viewer…); `10-shape` is the single place the shared control radii, heights and paddings live |
| `03-dom` … `05-lock-tabs` | panel markup, drag/resize geometry, lock-size, tab switching |
| `06-api-auth-votes`, `07-util` | API helper, login/comment/vote calls, small safe array helpers |
| `08-modal` | `mountModal` — backdrop, Esc and click-outside close, shared by every window |
| `09`–`12` | local pools, search tab UI, tag dictionary and chips, info popup |
| `13`–`16` | downloads, ffmpeg.wasm loading and trimming, export options, grid layout maths, frame-stepping bar |
| `17-trim-download-panel` | the Mark In/Out + download panel shared by the clip viewer and the export result |
| `18-grid-export` | `performGridExport`, split into `computeFrame`, `loadGridInputs`, `buildGridFilterGraph` (pure), `prepareMusicTrack`, `cleanupGridFiles` |
| `19`–`22` | export result window, comments, clip viewer, cards and search results |
| `23`–`25` | stats, shows, pools tabs |
| `26`–`28` | composer markup/helpers, composer, pool detail |
| `29-boot`, `99-tail` | start-up from the current booru page, closing `})();` |

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

- **Viewer top bar aligned; booru links in the booru's colour.** "view post", Copy Link and Add to Pool now share one size and baseline (they were mismatched because one was a link and the others weren't). Links that open the booru or another site — view post, source, View on site, links in comments — use the booru's own link red (`#ee8887`, hover lighter); the panel's own actions stay amber.
- **Links keep their look on the live site.** "← back to previous search" (and "back to episode list") sat in a box its text didn't fit and showed in the site's red link colour; "reset", "view post" and "View on site" had the same problem. They now keep the panel's own colours, size and no underline whatever the site's stylesheet says.
- **Card info popup is now a side panel.** The ⓘ badge on a result opens the clip's credits (score, rating, source, animator, tags) in a panel to the left of the Enhancer panel, styled like the credits panel in the clip viewer: sized to its content, chips wrap, no horizontal scrollbar, and it never covers the results. If there's no room on the left it opens on the right. Clicking the badge again, Esc, or clicking elsewhere closes it; clicking a tag still searches it.
- **Active tab on the live site.** The Search / Shows / Pools tab that's selected showed a white fill on sakugabooru.com, because the site's own stylesheet fills anything with an `.active` class. The tabs now set their own background so site styles can't leak in.
- **Search runs automatically — no Search button.** Press Enter to add the typed tag and search (on an empty box it re-runs the current search); picking a suggestion, changing the sort and removing a chip search too (chip removal waits a moment so several removals become one search). A ↻ button appears beside the sort when it's set to random, for a new random set. Only the newest search paints, so quick changes can't show stale results.
- **Calmer search controls.** The Results / Animator Stats switch is now one segmented pill (My Pools / Public Pools too). The Filter and Most Frequently Tagged toggles share a single row with the solo and hide-uncredited icons and the reset link, instead of three separate rows, and both toggles use the same style. Nothing was removed or renamed.
- **One typeface everywhere.** Buttons, inputs and dropdowns in the panel, and the buttons in the clip viewer, used the browser's default control font (Arial) while the rest used the panel's font stack. They now inherit the same font as everything else, and the stack is a single token (`FONT`).
- **Pools screens match the rest.** The pool list gets its three-clip preview strip back (with the clip count), and both pool detail screens use the same header as Shows: ← Back, a breadcrumb, then the pool name as an amber title with the clip count and a compact Export Clips button on the same line.
- **Source split into modules.** The 5,600-line single file is now `web-src/` (42 small files, stitched into the same `sakuga-enhancer.js`). Duplicated code was merged: one shared window helper, one trim/download panel, one frame-layout function used by both the composer preview and the export. `performGridExport` and the search-results painter were broken into named steps, and 84 CSS declarations that a later rule overrode were deleted. No behaviour change: the old and new builds produce identical page markup, identical computed styles on 22 screens, and identical ffmpeg arguments across 16 export configurations.
- **Clip viewer comments moved out of the way**, into a panel under the credits on the left, so the viewer itself is just the clip and its controls.
- **Clip viewer credits moved to a left-hand panel.** The animator and tags used to be tiny chips at the very bottom of the clip window; they now have their own panel beside it, with larger chips. The viewer's own layout is unchanged.
- **Consistent shapes and spacing** across every screen and window: one corner radius for all controls (buttons, inputs, selects, icon buttons, chips), one for containers (panels, cards, popups, modals), regular controls 28px and small ones 24px tall, and a 4px spacing grid. Empty rows no longer leave gaps. The radii and heights are variables at the top of the style list in `sakuga-enhancer.js`.

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
