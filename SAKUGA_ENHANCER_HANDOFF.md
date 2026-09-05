# Sakuga Enhancer — Project Handoff Doc

Two related but separate projects, both clients for **sakugabooru.com** (a Moebooru-family booru for anime "sakuga" — key animation cuts). Built entirely against sakugabooru's own public API. User's GitHub handle: **Punyesh**, site username **Punibaba**. There's a Discord community around this project.

---

## Project 1: Native App (`sakugaEnhancerApp`)

**Stack**: React Native + Expo (SDK 57), TypeScript, React Navigation. Bottom tabs: Search / Shows / Pools. A root-level stack also holds the Viewer screen (shared/reachable from any tab).

### File map
- `App.tsx` — navigator setup, tag-dictionary prefetch on launch, update-check banner
- `app.json` — has a `version` field, currently **1.2.0**, must be bumped manually alongside `updateCheck.ts`'s constant on every release
- `src/api/sakugabooru.ts` — `Post`/`Tag`/`Pool` interfaces, `searchPosts`, `getTagTypeMap`, `getPool`/`getPoolPosts`/`searchPools`/`listPools` (all **read-only**, for browsing *other people's* real public pools only — see Pools section below), `postComment`/`fetchComments`, `voteUp`, `verifyLogin`, exports `BASE_URL`
- `src/api/auth.ts` — password hashing (see salt below) + `expo-secure-store` credential storage
- `src/api/trim.ts` — video trim via `react-native-video-trim`
- `src/api/localPools.ts` — **local, on-device** pools via AsyncStorage (see Pools section)
- `src/api/updateCheck.ts` — GitHub Releases version check; `APP_VERSION` constant needs manual bump per release (deliberately no `expo-constants` dependency)
- `src/hooks/useAuth.ts` — shared login/credentials hook
- `src/components/` — `LoginModal`, `CreatePlaylistModal` (creates a *local* pool), `AddToPlaylistModal` (adds to a *local* pool), `PostCard` (memoized, two-tap select-then-open, buffering spinner, duration badge on the selected card only)
- `src/screens/` — `SearchScreen`, `ArtistStatsView`, `ShowSearchScreen`, `ShowDetailScreen`, `EpisodeResultsScreen`, `ViewerScreen`, `PlaylistsScreen` (Pools tab home — local pools), `LocalPoolDetailScreen`, `PlaylistDetailScreen` (read-only real-pool browsing), `BrowsePoolsScreen`

### Features (as of v1.2.0)
- **Search** — tag chips (color-coded: amber=animator, blue=show, default=general), live type-ahead suggestions (same coloring), sort as two fixed buttons (Top Score / Newest) + a "More" dropdown (Random / Lowest Score / Oldest), exclude-tag filter, "Solo cuts only" toggle (icon-only, person/person-outline — filters to posts with exactly one animator tag), infinite scroll
- **Animator Stats** — score/activity-by-year chart/top co-tags; syncs with Search but a real bug was fixed here (see below)
- **Shows** — search/browse/episode grid with jump-to-episode
- **Viewer** — frame-by-frame stepping, toggle to hide native video controls during stepping, tag chips (color-coded, tappable → jumps to Search with that tag), comments (quote formatting, tappable timestamps incl. fractional seconds, tappable post-links), share-booru-link button (separate from share-video-file), vote button on the score badge, "Add to Pool" button
- **Trim & Download** — hardware-accelerated via `react-native-video-trim`, share/save to gallery
- **Login & Comments & Voting** — real account actions against the live site
- **Pools** — see below, this is the one area with real nuance
- **Update banner** — checks GitHub Releases on launch, dismissable, opens release page; deliberately *not* silent/automatic (user explicitly rejected EAS Update/expo-updates in favor of visible consent)

### Pools — important nuance
Real server-side pool **creation** is blocked by an account-permission tier ("privileged" vs "basic," confirmed via sakugabooru's own `/help/users` page) that most accounts — including a **freshly created test account** — don't have. This was confirmed two ways: our API call got "access denied," and creating a pool *directly on the actual website* also failed for the same account. So:
- **"My Pools" is entirely local** (AsyncStorage, `src/api/localPools.ts`) — no login required, no server interaction, posts stored as full snapshots at add-time (score etc. won't stay live)
- **"Browse Public Pools" is real** — reads actual pools other users made public on sakugabooru, via the read-only functions in `sakugabooru.ts`
- These are two intentionally separate systems, not one unified thing

### Real API details discovered (hard-won, don't re-derive)
- **Password salt**, confirmed from sakugabooru's own `/help/api` page: `sha1('er@!$rjiajd0$!dkaopc350!Y%)--' + password + '--')`, hex-encoded
- `/comment/create.json` — POST, params `login`, `password_hash`, `comment[post_id]`, `comment[body]`
- `/post/vote.json` — POST, params `login`, `password_hash`, `id`, `score=1` (upvote-only, scoped conservatively; exact param format is a best-reasoned guess, not as thoroughly confirmed as comments)
- `/pool/show.json?id=X` — the correct single-pool lookup endpoint. **Not** `/pool.json?id=X` — that's the list-all endpoint and silently ignores an unrecognized `id` param, returning its default list instead (this was a real, confirmed bug we shipped and then fixed — always returned the same "most recent" pool regardless of which was requested)
- `pool:ID` tag syntax works on the regular `/post.json` search endpoint — used to fetch a pool's posts via already-proven infrastructure instead of a separate untested endpoint
- Sort orders: `order:score`, `order:score_asc`, `order:date`, `order:id_asc` (oldest, via sequential post IDs), `order:random`
- **Duration/clip-length is NOT available at all** — confirmed directly from sakugabooru's own forum, a mod/admin answered "No" when asked if searching/sorting by length is possible. The API has no duration field. The *video file itself* has duration embedded once actually loaded client-side (used for the app's per-card duration badge, shown only on the selected/already-loading card — reading this for every thumbnail in a grid would mean loading every video just to find out how long it is)

### Real bugs found and fixed along the way (worth knowing the patterns, not just the fixes)
- Keyboard intercepting the first tap on fresh search results (device-specific investigation, not a code bug)
- `PostCard` re-render storm on every selection change — fixed with `React.memo` + stable `useCallback` refs (inline closures per-card defeat memoization)
- Comments overlapping the phone's nav bar — missing safe-area-inset handling, fixed via `react-native-safe-area-context`
- Multi-animator Stats sync silently wiping the rest of the search's tags — `onStatsLookup` was unconditionally overwriting `tags` even during an *automatic* sync (Stats auto-showing the first animator from an existing search); fixed by distinguishing automatic sync from an explicit manual lookup
- Timestamp regex missing fractional seconds (`0:05` matched but `.9` didn't) — fixed in the app; **the bookmarklet never had this bug**, its regex was written correctly from the start

### Distribution
- **Not on Google Play** — blocked on unresolved Play Console verification issues
- **GitHub Releases** is the real distribution path — README's download link uses `.../releases/latest` (always points to newest, no per-release README edits needed)
- MIT licensed, public repo
- iOS untested — would need a paid Apple Developer account + TestFlight; same `eas build` command, different platform flag

### Current version state (last known — confirm before assuming)
v1.2.0, `app.json` and `updateCheck.ts`'s `APP_VERSION` both bumped to match. A preview build may have been queued around the time this doc was written — confirm actual build/release status before assuming it's live.

---

## Project 2: Bookmarklet (`sakugaEnhancer`)

**Stack**: Vanilla JS, single IIFE file `sakuga-enhancer.js` (~2200+ lines). Built via `build.js` (→ `bookmarklet.txt`, a `javascript:` URI with the whole script embedded) and `build-install.js` (→ `install.html`, hosted on GitHub Pages).

### Critical gotcha
**Prototype.js** (loaded by sakugabooru's own page) overrides native `Array.prototype` methods. Must use the file's own `safeFilter`/`safeMap`/`safeSort` wrappers instead of `.filter`/`.map`/`.sort` directly. `.slice()` is confirmed safe/unaffected, used freely.

### Auto-update mechanism (recently added, important)
`install.html` now has **one unified bookmarklet link for all browsers** — a tiny loader:
```js
javascript:(function(){var s=document.createElement('script');s.src='https://punyesh.github.io/sakugaEnhancer/sakuga-enhancer.js?t='+Date.now();document.body.appendChild(s);})();
```
This fetches the live script from GitHub Pages on every click. **Future updates just need a push to `main`** — no need to redistribute a new bookmarklet link ever again. (Previously had two separate versions — Chrome got the whole script embedded, Firefox got this loader because Firefox chokes on very long saved bookmark URLs. Merged into one since the loader approach is just better for everyone.)

### Features (current state)
- **Search** — tag chips, live type-ahead suggestions (color-coded by type), sort as a native `<select>` with score/score_asc/date/id_asc/random (adding options here is trivial — just more `<option>` tags, no UI redesign needed), exclude-tag filter grid, infinite scroll
- **Shows** — search/browse/episode navigation with back-forward history
- **Stats** — per-animator activity chart + top co-tags
- **Hover-preview info dock** — shown on hovering a result thumbnail (not inside an opened clip) — tags color-coded + clickable-to-search, score/rating badges
- **Media modal** (opened clip) — vote button (click the score badge), frame-by-frame stepping + trim (client-side via `ffmpeg.wasm`, consent-gated ~25–30MB one-time download), download/share, **copy-link button** (clipboard, with `prompt()` fallback), comments (quote formatting, clickable timestamps including fractional seconds, clickable post-links opening in-modal, login+posting), and **tags section directly in the modal** (recently added — previously tags were *only* visible via the separate hover dock, not inside an actually-opened clip, which was a real reported gap)
- Tag chips inside the modal are clickable → jump to a fresh search for that tag. **Two real bugs were found and fixed in sequence here**: (1) clicking a tag updated the search correctly but never closed the modal, so the person was staring at a frozen clip while the real update happened invisibly behind it — fixed by giving the modal a `box._close()` handle the tag-click handler can call; (2) after that fix, the modal closed correctly but the *chip pills* in the main search UI still showed the old tag even though results had updated — the handler was updating `searchState.tags` and re-running the search, but never calling `renderChips()`. Fixed by routing through `switchToTab('search')` instead of `ensureResultsMarkup()` directly, since that path already rebuilds chips correctly (and also correctly handles the case where the clip was opened from the Shows tab, not Search)
- **Login/voting/comments** — same real API mechanics as the app, ported over

### NOT yet in the bookmarklet (explicitly deferred, not forgotten)
- **Pools** — user explicitly said "start with the smaller ones (voting, sort, tag click/color), do Pools separately after." Not built yet. Would need an equivalent to the app's local-pools approach (localStorage instead of AsyncStorage) plus real-pool browsing.
- Duration badge — never requested for the bookmarklet, not built

---

## Cross-cutting facts worth remembering
- Both repos are **MIT licensed**, both **public**
- The password-salt discovery, the `/pool/show.json` vs `/pool.json` distinction, the pool-creation permission wall, and the "no duration data exists" finding are all things that took real research/testing to confirm — don't re-derive them, they're settled
- When porting a feature between the two projects, check what's *actually* there first rather than assuming parity — several "obviously already ported" assumptions turned out wrong during this project (e.g., assuming the bookmarklet had the timestamp bug when it never did; assuming tags were shown inside the opened clip when they were only in a separate hover dock)
- User strongly prefers **visible, consent-based** update mechanisms over silent/automatic ones — this shaped both the app's update banner design and the reasoning for not using EAS Update
