# KeyFrame Lookup

A small in-browser tool for looking up animation staff on [KeyFrame Staff List](https://keyframe-staff-list.com) by name, and viewing their full credit history — either grouped by role (Key Animation, Animation Director, Storyboard, etc.) in a list view, or as an AniList-style poster grid, your choice. Cover art, year, and episode info either way. If a name matches multiple people, you're prompted to pick the right one (or skip it) instead of it silently guessing.

It also includes a **Credit Sheet Organizer** — paste in a messy raw credit list (role headers, studio names, names packed several to a line) and it verifies every name and studio live against KeyFrame, translates role headers to English, and produces a clean, shareable summary.

Runs entirely inside your own browser tab as a bookmarklet or console script — no server, no installation, no dependencies.

https://github.com/user-attachments/assets/d0d0ef17-1b34-4e58-843b-3156c7998cf7

## Install (30 seconds)

**[punyesh.github.io/keyframeLookup](https://punyesh.github.io/keyframeLookup/)**

Open that page and drag the amber button on it to your bookmarks bar. That's it — no extension install, no permissions prompt.

<details>
<summary>Alternative: manual copy-paste (if the link above ever goes down)</summary>

1. Copy the contents of <a href="./keyframe_panel.js">keyframe_panel.js</a>.
2. In your browser, right-click your bookmarks bar → **Add page** (Chrome) or **New Bookmark** (other browsers).
3. Give it any name, e.g. `KeyFrame Lookup`.
4. Paste `javascript:eval(decodeURIComponent(escape(window.atob("<base64 of the file>"))))` into the URL field — or just paste the raw script into your browser's DevTools Console (F12) on keyframe-staff-list.com instead, which works without making a bookmark at all.

</details>

## Use it — Lookup

1. Go to [keyframe-staff-list.com](https://keyframe-staff-list.com) and let the page load normally.
2. Click your new bookmark. A small panel appears — drag it anywhere by its header.
3. Type or paste names, one per line or comma-separated.
4. Click **Run lookup**. Progress logs in the panel as it works through your list. If a name matches more than one person, the panel pauses and shows you the candidates to pick from (or a Skip button).
5. When it's done: **View Results** for a full formatted page (List or Grid view, cover art, expandable roles), **Copy Markdown** for a Discord-ready summary, **Download HTML** to save/share the exact results page as a file, or **Download JSON** for the raw data.

Already-looked-up names are cached in memory for the session — adding a name to your list and re-running won't re-fetch names you already have.

## Use it — Credit Sheet Organizer

1. In the panel, click **📋 Switch to Credit Sheet Organizer** at the bottom (same small panel, different mode — click **🔍 Switch to Lookup** to go back).
2. Paste your raw credit sheet text and click **Parse & Verify**.
3. It works through every name and studio one at a time against KeyFrame's live search — role headers get translated to English automatically, and studios are detected the same way (never guessed from text shape).
4. If a name matches multiple different people, a picker pauses the process so you can choose. Names that look like two people accidentally joined on one line (no way to detect that from text shape alone) get double-checked — if both halves independently exist on KeyFrame, you're asked whether to split them.
5. Results open in a second small side-panel: reviewed names with spelling toggles (KeyFrame's English name is used by default, click to revert to as-typed), a live Discord-formatted summary, and **Copy Markdown** / **View as Page** / **Download HTML** to share.

## Sharing

There's no "copy a short link" option — a genuinely short, pasteable link needs real link-shortening infrastructure, which this tool doesn't have (and GitHub's anonymous Gist creation, the one no-backend option, has been deprecated). Instead:

- **Copy Markdown** gives you Discord-ready plain text, sized to actually fit in a message.
- **Download HTML** saves a real, fully-formatted page you can attach directly to a Discord message (or host/embed anywhere) — recipients get the exact same view you had, cover art and all.

## Why the delay between names

KeyFrame Staff List's own [scraping policy](https://keyframe-staff-list.com/scraping) permits looking up specific individuals for personal use, but asks that request volume stay reasonable. This tool waits a few seconds between each name accordingly — please don't remove that if you modify this.

## Credit

All data comes from [KeyFrame Staff List](https://keyframe-staff-list.com), built and maintained by its contributors. If you use data pulled with this tool anywhere public, please credit them.

## Changelog

- **Firefox Support** — Firfox doesn't support long URLs for bookmarks. Added alternate panel to account for it.
- **Credit Sheet Organizer** — a whole second mode, switchable from the same small panel. Paste a messy raw credit sheet and it verifies every name/studio live against KeyFrame, translates role headers to English (170+ Japanese/English terms recognized), prompts you to disambiguate ambiguous names (including detecting accidentally-joined names like "yaya Christine" when there's real evidence for a split), and produces a clean, Discord-formatted summary plus a shareable HTML page.
- **One unified panel** — Lookup and the Organizer now live in the same small draggable panel instead of a separate button/page; a link at the bottom switches modes.
- **Share as a file** — both Lookup and Organizer results can be downloaded as a real HTML page to attach to Discord or host elsewhere, since a true short link isn't something this tool can reliably provide.
- **English names by default** — when KeyFrame has an English name for someone or a studio, it's shown by default instead of whatever script the source used, with a one-click toggle back to the original spelling.
- **Grid view** — a **☰ List** / **▦ Grid** toggle on the results page. Grid view shows one poster card per anime (cover art, title, year) with all of the roles on that work as pills underneath, each showing its episode numbers — alongside the original role-first list view.
- **Studios** — studios that show up alongside people in search results are now tagged `[Studio]` in the picker instead of being filtered out or silently causing an error if picked.
- **Cover art + name disambiguation** — each work now shows its cover image; names matching multiple people prompt you to pick one instead of guessing.
- **Initial release** — bookmarklet/console tool, results grouped by role, JSON export.
