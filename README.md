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

- **Search** — one field does the work: tags are chips inside it, sort sits at its right edge, and results follow the chips as you add or remove them (no Search button). Suggestions appear as you type (arrow keys + Enter). Backspace removes the last chip.
  - **Clips | Stats** switch under the field, with a clip count and a **Filter** pill. Infinite scroll.
  - **Filter** panel: **Solo cuts only** (exactly one animator credited), **Hide uncredited** (drops cuts tagged only `artist_unknown`, or with no animator tag; a cut with `artist_unknown` plus a real animator is kept), and a checklist of co-occurring tags to hide.
  - Cards show the credited animators (other than the ones already in your search) and the score.
  - With nothing typed, the screen suggests the most-tagged animators and shows, or lets you browse the newest clips.
- **Back button** — a ‹ beside the search field returns to the previous search, wherever you came from (a tag, a stats row, a show's animator list), or to the episode list after an episode search.
- **Stats** — follows your search. With an animator in it: clip count, average and highest score, most frequent shows, clips by upload year, and often-tagged-with (click a show or tag to add it to the search). With only a show: its most credited animators (click one to see their cuts in that show).
- **Shows** — opens on the most-tagged shows; search a title, open a show to see related shows, its most credited animators and its episodes (parsed from post source text), with back/forward navigation. **All clips** searches the whole show.
- **Pools**:
  - *My pools* — local only (`localStorage`), no login required. Server-side pool creation requires an account tier most accounts lack.
  - *Public pools* — read-only browsing of pools other users have made public.
  - *Export clips* — see [Pool export](#pool-export).
- **Media viewer** — opens clips and images in a lightbox:
  - Frame-by-frame navigation for video (frame count, timecode, step controls, keyboard shortcuts).
  - **Voting** — genuine 1–3 star ratings. Ratings may be changed or cleared, and your current rating is read from the post page itself.
  - **Download Trim** — client-side cut of a marked range via ffmpeg.wasm: a fast stream copy by default, or a frame-accurate re-encode when the "frame-accurate" box is ticked. **Download Full** retrieves the original file. Both offer MP4 / GIF / APNG, a size, and quality options under "more options".
  - Comments, loaded on demand.
  - Add to Pool, Copy Link.
  - Tag chips are clickable throughout, jumping to a fresh search.
- **Info popup** — a per-card badge shows tags, score, rating, and links without leaving the results view.
- **Panel** — draggable and resizable from any edge or corner, with position/size persisted. The ⋯ menu holds **Lock clip size** (fixed card size vs. fixed column count) and **Reset size and position**.

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

- **Main screen redesign**: one search field with inline chips and sort, live results, Clips | Stats switch, Filter panel with labelled switches, animator names on cards, Stats that follow the search (animator or show), a Shows home, pools with thumbnail previews, and a ⋯ menu replacing the two unlabelled header icons. Matches the Export Composer's design language.
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
