/*
 * KeyFrame Staff List — lookup + credit sheet organizer
 * =========================================================================
 * One small draggable panel. A link at the bottom switches it between two
 * modes:
 *   - Lookup: enter names, get formatted staff/credit info.
 *   - Organizer: paste a raw credit sheet, verify every name/studio against
 *     KeyFrame's live search, and get it organized by role.
 * Results for the organizer open in a second small side-panel, never a new
 * tab. Paste into your browser's Console (F12 -> Console) on
 * keyframe-staff-list.com, or better, use the bookmarklet version.
 */

(() => {
  document.getElementById("kfl-panel")?.remove();
  document.getElementById("kfl-org-panel")?.remove();

  let kflMode = "lookup"; // "lookup" | "organize"

  // ---------- custom role dictionary (user-editable, persisted) ----------
  // Lets the user add their own role terms/abbreviations without needing a
  // code change every time an unrecognized credit shows up. Stored in
  // localStorage so it survives across sessions. Custom entries take
  // priority over the built-in dictionary, so a user can also override a
  // built-in mapping if they disagree with it.
  let customRoles = {};
  try {
    customRoles = JSON.parse(localStorage.getItem("kfl-custom-roles") || "{}");
  } catch (e) {
    customRoles = {};
  }
  let customRoleSet = {};
  function rebuildCustomRoleSet() {
    customRoleSet = {};
    Object.keys(customRoles).forEach((k) => { customRoleSet[kflNorm(k)] = customRoles[k]; });
  }
  function saveCustomRoles() {
    localStorage.setItem("kfl-custom-roles", JSON.stringify(customRoles));
    rebuildCustomRoleSet();
  }
  rebuildCustomRoleSet();

  // ---------- main panel shell ----------
  const panel = document.createElement("div");
  panel.id = "kfl-panel";
  const initialLeft = Math.max(20, window.innerWidth - 320 - 20);
  panel.style.cssText = `
    position: fixed; top: 20px; left: ${initialLeft}px; width: 320px;
    background: #0b0d10; color: #e8e6e1; font-family: 'Inter', system-ui, sans-serif;
    font-size: 13px; border-radius: 10px; box-shadow: 0 8px 30px rgba(0,0,0,.5);
    z-index: 999999; overflow: hidden; border: 1px solid #262b33;
  `;
  document.body.appendChild(panel);

  // Reusable drag-to-move, since the panel's innerHTML gets replaced on
  // every mode switch (wiping old listeners) -- call this again each time.
  function setupDrag(handleEl, target) {
    let dragging = false, offsetX = 0, offsetY = 0;
    handleEl.addEventListener("mousedown", (e) => {
      if (e.target.dataset && e.target.dataset.noDrag) return;
      dragging = true;
      const rect = target.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      e.preventDefault();
    });
    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const maxLeft = window.innerWidth - target.offsetWidth;
      const maxTop = window.innerHeight - 40;
      target.style.left = `${Math.min(Math.max(0, e.clientX - offsetX), maxLeft)}px`;
      target.style.top = `${Math.min(Math.max(0, e.clientY - offsetY), maxTop)}px`;
    });
    document.addEventListener("mouseup", () => { dragging = false; });
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const DELAY_MS = 1000; // same pacing as the organizer; keep uncached requests reasonably spaced
  const VERIFY_DELAY_MS = 1000; // lighter delay for the organizer's search-only calls

  // Cache of already-fetched lookup results, keyed by normalized name.
  // Persists for as long as this panel stays open.
  const cache = {};
  const searchCache = {}; // normalized query -> search matches / error
  const profileCache = {}; // stable staff id -> fetched profile result
  const cacheKey = (name) => name.trim().replace(/\s+/g, " ").toLowerCase();
  const searchCacheKey = (name) => name.trim().replace(/\s+/g, " ").toLowerCase();
  const profileCacheKey = (staffId) => String(staffId);

  const log = (msg) => {
    const el = document.getElementById("kfl-log");
    if (!el) return;
    el.textContent += (el.textContent ? "\n" : "") + msg;
    el.scrollTop = el.scrollHeight;
  };
  const updateCacheCount = () => {
    const el = document.getElementById("kfl-cache-count");
    if (!el) return;
    const n = Object.keys(cache).length;
    el.textContent = n > 0 ? `${n} cached` : "";
  };

  function esc(s) {
    if (s == null) return "";
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function buildRoleGroups(credits) {
    const roleMaps = {};
    for (const work of credits || []) {
      for (const nameEntry of work.names || []) {
        for (const cat of nameEntry.categories || []) {
          for (const role of cat.roles || []) {
            const roleName = role.role_en || cat.category || "Other";
            if (!roleMaps[roleName]) roleMaps[roleName] = new Map();
            const map = roleMaps[roleName];
            if (!map.has(work.uuid)) {
              map.set(work.uuid, {
                work: work.stafflist_name, workJa: work.stafflist_name_ja,
                year: work.seasonYear, slug: work.slug, studios: work.stafflist_studios,
                status: work.status, kv: work.stafflist_kv, episodes: [],
              });
            }
            const entry = map.get(work.uuid);
            for (const c of role.credits || []) {
              if (c.episode) entry.episodes.push(c.episode);
            }
          }
        }
      }
    }
    const roles = {};
    for (const [roleName, map] of Object.entries(roleMaps)) {
      roles[roleName] = Array.from(map.values()).sort((a, b) => (b.year || 0) - (a.year || 0));
    }
    return roles;
  }

  // Groups by WORK instead of by role — one card per anime, with all of this
  // person's roles on it listed together, each with its own episode list.
  // This is what feeds the AniList-style poster grid view (as opposed to the
  // role-first list view above).
  function buildWorkGrid(credits) {
    const map = new Map();
    for (const work of credits || []) {
      if (!map.has(work.uuid)) {
        map.set(work.uuid, {
          work: work.stafflist_name, workJa: work.stafflist_name_ja,
          year: work.seasonYear, slug: work.slug, studios: work.stafflist_studios,
          status: work.status, kv: work.stafflist_kv, roleMap: new Map(), // roleName -> episodes[]
        });
      }
      const entry = map.get(work.uuid);
      for (const nameEntry of work.names || []) {
        for (const cat of nameEntry.categories || []) {
          for (const role of cat.roles || []) {
            const roleName = role.role_en || cat.category || "Other";
            if (!entry.roleMap.has(roleName)) entry.roleMap.set(roleName, []);
            for (const c of role.credits || []) {
              if (c.episode) entry.roleMap.get(roleName).push(c.episode);
            }
          }
        }
      }
    }
    return Array.from(map.values())
      .map((w) => ({
        work: w.work, workJa: w.workJa, year: w.year, slug: w.slug,
        studios: w.studios, status: w.status, kv: w.kv,
        roles: Array.from(w.roleMap.entries()).map(([name, episodes]) => ({ name, episodes })),
      }))
      .sort((a, b) => (b.year || 0) - (a.year || 0));
  }

  async function searchName(name) {
    const key = searchCacheKey(name);
    if (searchCache[key]) return { ...searchCache[key], _cached: true };

    const searchRes = await fetch(`/api/search/?q=${encodeURIComponent(name)}&type=all`, { credentials: "include" });
    if (!searchRes.ok) {
      const result = { error: `Search failed (status ${searchRes.status})` };
      searchCache[key] = result;
      return result;
    }
    const matches = (await searchRes.json()).staff || [];
    const result = matches.length === 0 ? { error: "No matching staff found" } : { matches };
    searchCache[key] = result;
    return result;
  }

  async function fetchProfile(name, staffId, allMatches) {
    const key = profileCacheKey(staffId);
    if (profileCache[key]) {
      const cached = { ...profileCache[key], query: name, allSearchMatches: allMatches, _cached: true };
      return cached;
    }

    const result = { query: name, found: false, allSearchMatches: allMatches };

    const profileRes = await fetch(`/api/person/show.php?id=${staffId}&type=person`, { credentials: "include" });
    if (!profileRes.ok) { result.error = `Profile fetch failed (status ${profileRes.status})`; return result; }
    const data = await profileRes.json();
    const staff = data.staff || {};
    const credits = data.credits || [];

    result.found = true;
    result.id = staff.id;
    result.nameEn = staff.en;
    result.nameJa = staff.ja;
    result.jobs = data.jobs || [];
    result.studios = data.studios || {};
    result.creditCount = credits.length;
    result.roles = buildRoleGroups(credits);
    result.workGrid = buildWorkGrid(credits);

    profileCache[key] = { ...result, query: undefined, allSearchMatches: undefined };
    return result;
  }

  // Shows candidate buttons in the panel and resolves with the chosen match
  // (or null if the user clicks Skip). Pauses the run loop until answered.
  function promptForMatch(name, matches) {
    return new Promise((resolve) => {
      const box = document.getElementById("kfl-select");
      box.style.display = "flex";
      box.innerHTML = `<div style="color:#8a8f98; font-size:11.5px; margin-bottom:2px;">Multiple matches for "${esc(name)}" — pick one:</div>`;

      matches.forEach((m, i) => {
        const btn = document.createElement("button");
        const jobsPreview = (m.jobs || []).slice(0, 2).join(", ");
        const studioTag = m.is_studio ? "[Studio] " : "";
        btn.textContent = `${studioTag}${m.en || m.ja || "Unnamed"}${m.ja ? ` (${m.ja})` : ""}${jobsPreview ? ` — ${jobsPreview}` : ""}`;
        btn.style.cssText = m.is_studio
          ? "text-align:left; background:#1c2028; color:#f5a623; border:1px solid #3a3020; border-radius:6px; padding:6px 8px; cursor:pointer; font-size:11.5px;"
          : "text-align:left; background:#1c2028; color:#e8e6e1; border:1px solid #262b33; border-radius:6px; padding:6px 8px; cursor:pointer; font-size:11.5px;";
        btn.onclick = () => { box.style.display = "none"; box.innerHTML = ""; resolve(matches[i]); };
        box.appendChild(btn);
      });

      const skipBtn = document.createElement("button");
      skipBtn.textContent = "Skip this name";
      skipBtn.style.cssText = "background:#2a1414; color:#f2a; border:1px solid #4a1f1f; border-radius:6px; padding:6px 8px; cursor:pointer; font-size:11.5px;";
      skipBtn.onclick = () => { box.style.display = "none"; box.innerHTML = ""; resolve(null); };
      box.appendChild(skipBtn);
    });
  }

  async function lookupName(name) {
    const searchResult = await searchName(name);
    if (searchResult.error) return { query: name, found: false, error: searchResult.error, _network: !searchResult._cached };

    const matches = searchResult.matches;
    const allMatches = matches.map((m) => ({ id: m.anilist_id, en: m.en, ja: m.ja, jobs: m.jobs, isStudio: !!m.is_studio }));

    let chosen;
    if (matches.length === 1) {
      chosen = matches[0];
    } else {
      log(`  -> ${matches.length} matches found, pick one in the panel...`);
      chosen = await promptForMatch(name, matches);
      if (!chosen) return { query: name, found: false, error: "Skipped by user (multiple matches)", allSearchMatches: allMatches, _network: !searchResult._cached };
    }

    if (chosen.is_studio) {
      return { query: name, found: false, error: "That match is a studio, not a staff member — studio profiles aren't supported by this tool", allSearchMatches: allMatches, _network: !searchResult._cached };
    }

    // Staff not linked to an AniList entry have anilist_id: null. The site
    // falls back to addressing them by name instead — id=ja:<name> or
    // id=en:<name> (confirmed via captured request: show.php?id=en:Christina).
    // Only the name portion gets percent-encoded; the "ja:"/"en:" prefix and
    // colon stay literal.
    let staffId = chosen.anilist_id;
    if (staffId == null) {
      if (chosen.ja) staffId = "ja:" + encodeURIComponent(chosen.ja);
      else if (chosen.en) staffId = "en:" + encodeURIComponent(chosen.en);
    }

    if (staffId == null) return { query: name, found: false, error: "Chosen match had no id or name to look up", allSearchMatches: allMatches, _network: !searchResult._cached };

    const profileResult = await fetchProfile(name, staffId, allMatches);
    if (!searchResult._cached) profileResult._network = true;
    else if (profileResult._cached) profileResult._network = false;
    else profileResult._network = true;
    return profileResult;
  }
  // ---------- results page builder ----------
  let uid = 0;
  function renderPerson(r) {
    if (!r.found) {
      return `<div class="person"><div class="error-card"><span class="q">${esc(r.query)}</span> — ${esc(r.error || "not found")}</div></div>`;
    }
    const jobs = (r.jobs || []).map((j) => `<span class="badge">${esc(j)}</span>`).join("");
    const studioNames = Object.keys(r.studios || {});
    const studiosHtml = studioNames.length
      ? `<div class="studio-affiliations">Studio affiliations: ${studioNames.map((s) => esc(s)).join(", ")}</div>`
      : "";
    const roles = r.roles || {};
    const roleNames = Object.keys(roles).sort((a, b) => roles[b].length - roles[a].length);

    const rolesHtml = roleNames.map((roleName) => {
      const works = roles[roleName];
      const sectionId = `kfl-role-${uid++}`;
      return `
        <div class="role-section" id="${sectionId}">
          <div class="role-head" onclick="document.getElementById('${sectionId}').classList.toggle('open')">
            <span class="role-arrow">▶</span>
            <span class="role-title">${esc(roleName)}</span>
            <span class="role-count">${works.length}</span>
          </div>
          <div class="role-works">
            ${works.map((w) => `
              <div class="role-work">
                ${w.kv ? `<img class="role-work-thumb" src="${esc(w.kv)}" alt="" loading="lazy" onerror="this.remove()">` : ""}
                <div class="role-work-text">
                  <div class="role-work-title">${esc(w.work || w.slug)}</div>
                  <div class="role-work-meta">
                    <span class="year">${esc(w.year ?? "—")}</span>
                    ${w.studios ? `<span>${esc(w.studios)}</span>` : ""}
                    ${w.episodes && w.episodes.length ? `<span>${esc(w.episodes.join(", "))}</span>` : ""}
                  </div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="person">
        <div class="person-head">
          <div class="person-name">${esc(r.nameEn || r.query)}${r.nameJa ? `<span class="ja">${esc(r.nameJa)}</span>` : ""}</div>
          <div class="badges">${jobs}</div>
          ${studiosHtml}
        </div>
        <div>${rolesHtml || '<div style="padding:16px 22px; color:var(--muted); font-size:13px;">No credits listed.</div>'}</div>
      </div>
    `;
  }

  function renderPersonGrid(r) {
    if (!r.found) {
      return `<div class="person"><div class="error-card"><span class="q">${esc(r.query)}</span> — ${esc(r.error || "not found")}</div></div>`;
    }
    const jobs = (r.jobs || []).map((j) => `<span class="badge">${esc(j)}</span>`).join("");
    const studioNames = Object.keys(r.studios || {});
    const studiosHtml = studioNames.length
      ? `<div class="studio-affiliations">Studio affiliations: ${studioNames.map((s) => esc(s)).join(", ")}</div>`
      : "";
    const works = r.workGrid || [];

    const cardsHtml = works.map((w) => `
      <div class="grid-card">
        ${w.kv
          ? `<img class="grid-card-img" src="${esc(w.kv)}" alt="" loading="lazy" onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='flex';">`
          : ""}
        <div class="grid-card-placeholder" style="${w.kv ? "display:none;" : ""}">${esc((w.work || w.slug || "?").slice(0, 1))}</div>
        <div class="grid-card-title">${esc(w.work || w.slug)}</div>
        <div class="grid-card-year">${esc(w.year ?? "—")}</div>
        <div class="grid-role-pills">${w.roles.map((r) => `<span class="grid-role-pill">${esc(r.name)}${r.episodes.length ? ` <span class="ep">${esc(r.episodes.join(", "))}</span>` : ""}</span>`).join("")}</div>
      </div>
    `).join("");

    const GRID_PREVIEW_ROWS = 2; // how many full rows to show before collapsing
    const TOGGLE_THRESHOLD = 8; // rough cutoff to decide whether a toggle is worth showing at all
    const needsToggle = works.length > TOGGLE_THRESHOLD;
    const gridId = `kfl-grid-${uid++}`;

    // Toggle link sits in the header (not below the grid) and stays sticky
    // while scrolling, so collapsing is always reachable. The exact number
    // of cards to hide is computed at runtime (see the script at the bottom
    // of buildResultsPage) since it depends on how many columns actually fit
    // the screen — that's the only way to guarantee full rows, never a
    // cropped one.
    const toggleLink = needsToggle
      ? `<span class="grid-toggle-link" id="${gridId}-btn" onclick="
          const el = document.getElementById('${gridId}');
          el.classList.toggle('expanded');
          document.getElementById('${gridId}-btn').textContent = el.classList.contains('expanded') ? 'Show less' : 'Show all ${works.length}';
          window.kflRefreshGridPreviews();
        ">Show all ${works.length}</span>`
      : "";

    return `
      <div class="person">
        <div class="person-head person-head-split">
          <div>
            <div class="person-name">${esc(r.nameEn || r.query)}${r.nameJa ? `<span class="ja">${esc(r.nameJa)}</span>` : ""}</div>
            <div class="badges">${jobs}</div>
            ${studiosHtml}
          </div>
          ${toggleLink}
        </div>
        <div class="work-grid-wrap${needsToggle ? "" : " expanded"}" id="${gridId}" data-preview-rows="${GRID_PREVIEW_ROWS}">
          <div class="work-grid">${cardsHtml || '<div style="padding:16px 22px; color:var(--muted); font-size:13px;">No credits listed.</div>'}</div>
        </div>
      </div>
    `;
  }

  function buildResultsPage(results) {
    const doneMsg = `${results.filter((r) => r.found).length}/${results.length} found`;
    const bodyHtmlList = results.map(renderPerson).join("");
    const bodyHtmlGrid = results.map(renderPersonGrid).join("");
    // Escape '<' so a "</script" sequence inside any bio/title text can't
    // break out of the embedded JSON script tag below.
    const rawDataJson = JSON.stringify(results).replace(/</g, "\\u003c");
    return `
      <!DOCTYPE html><html><head><meta charset="UTF-8"><title>KeyFrame Lookup — Results</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
      <style>
        :root { --bg:#0b0d10; --panel:#15181d; --panel-2:#1c2028; --line:#262b33; --text:#e8e6e1; --muted:#8a8f98; --amber:#f5a623; --cyan:#4fd1c5; }
        * { box-sizing: border-box; }
        body { margin:0; background:var(--bg); color:var(--text); font-family:'Inter',sans-serif; min-height:100vh; }
        header { padding: 28px 24px 18px; border-bottom: 1px solid var(--line); display:flex; align-items:center; gap:14px; }
        .slate-mark { width:30px; height:30px; background: repeating-linear-gradient(45deg, var(--amber), var(--amber) 6px, #111 6px, #111 12px); border-radius:4px; flex-shrink:0; }
        h1 { font-family:'Space Grotesk',sans-serif; font-size:19px; font-weight:700; margin:0; }
        h1 span { color: var(--amber); }
        .sub { color:var(--muted); font-size:13px; margin-top:2px; }
        main { max-width: 900px; margin:0 auto; padding: 28px 24px 80px; }
        .person { background:var(--panel); border:1px solid var(--line); border-radius:10px; margin-bottom:20px; }
        .person-head { padding:18px 22px; border-bottom:1px solid var(--line); }
        .person-name { font-family:'Space Grotesk',sans-serif; font-size:18px; font-weight:700; }
        .person-name .ja { font-family:'Inter',sans-serif; font-weight:400; color:var(--muted); font-size:13px; margin-left:8px; }
        .badges { display:flex; flex-wrap:wrap; gap:6px; margin-top:9px; }
        .studio-affiliations { font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--muted); margin-top:8px; }
        .badge { font-size:11px; padding:4px 9px; border-radius:20px; background:var(--panel-2); border:1px solid var(--line); color:var(--cyan); font-family:'JetBrains Mono',monospace; }
        .role-section { border-bottom:1px solid var(--line); }
        .role-section:last-child { border-bottom:none; }
        .role-head { padding:12px 22px; display:flex; align-items:center; gap:10px; cursor:pointer; user-select:none; }
        .role-head:hover { background:var(--panel-2); }
        .role-arrow { color:var(--amber); font-size:11px; transition:transform .15s ease; width:10px; flex-shrink:0; }
        .role-section.open .role-arrow { transform: rotate(90deg); }
        .role-title { font-weight:600; font-size:14px; flex:1; }
        .role-count { font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--amber); background:rgba(245,166,35,.1); padding:2px 8px; border-radius:20px; }
        .role-works { display:none; padding:0 22px 12px 46px; }
        .role-section.open .role-works { display:block; }
        .role-work { display:flex; gap:10px; align-items:flex-start; padding:8px 0; border-bottom:1px dashed var(--line); }
        .role-work:last-child { border-bottom:none; }
        .role-work-thumb { width:42px; height:58px; object-fit:cover; border-radius:4px; flex-shrink:0; background:var(--panel-2); }
        .role-work-text { flex:1; min-width:0; }
        .role-work-title { font-weight:600; font-size:14px; }
        .role-work-meta { margin-top:3px; font-family:'JetBrains Mono',monospace; font-size:11.5px; color:var(--muted); display:flex; gap:10px; flex-wrap:wrap; }
        .role-work-meta .year { color:var(--cyan); }
        .error-card { padding:16px 22px; color:var(--muted); font-size:13px; }
        .error-card .q { color:var(--text); font-weight:600; }
        footer { text-align:center; color:var(--muted); font-size:12px; padding:20px; }
        footer a { color:var(--amber); }

        /* view toggle */
        .view-toggle { display:flex; gap:6px; margin-left:auto; }
        .view-toggle button {
          font-family:'Inter',sans-serif; font-size:12.5px; font-weight:600;
          background:var(--panel-2); color:var(--muted); border:1px solid var(--line);
          border-radius:6px; padding:7px 14px; cursor:pointer;
        }
        .view-toggle button.active { background:var(--amber); color:#14171c; border-color:var(--amber); }

        /* AniList-style poster grid */
        #kfl-view-grid { display:none; }
        body[data-view="grid"] #kfl-view-list { display:none; }
        body[data-view="grid"] #kfl-view-grid { display:block; }
        .work-grid {
          display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr));
          gap:16px; padding:18px 22px;
        }
        .grid-card { display:flex; flex-direction:column; }
        .grid-card-img {
          width:100%; aspect-ratio:2/3; object-fit:cover; border-radius:6px;
          background:var(--panel-2); box-shadow:0 2px 10px rgba(0,0,0,.4);
        }
        .grid-card-placeholder {
          width:100%; aspect-ratio:2/3; border-radius:6px; background:var(--panel-2);
          display:flex; align-items:center; justify-content:center;
          font-family:'Space Grotesk',sans-serif; font-size:28px; font-weight:700; color:var(--line);
        }
        .grid-card-title {
          font-size:12.5px; font-weight:600; line-height:1.3; margin-top:7px;
          display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
        }
        .grid-card-year { font-family:'JetBrains Mono',monospace; font-size:10.5px; color:var(--cyan); margin-top:3px; }
        .grid-role-pills { display:flex; flex-wrap:wrap; gap:4px; margin-top:5px; }
        .grid-role-pill {
          font-size:9px; background:var(--panel-2); border:1px solid var(--line);
          padding:2px 6px; border-radius:20px; color:var(--muted);
        }
        .grid-role-pill .ep { color:var(--cyan); font-family:'JetBrains Mono',monospace; }

        .person-head-split {
          display:flex; justify-content:space-between; align-items:flex-start; gap:14px; flex-wrap:wrap;
          position:sticky; top:0; z-index:5; background:var(--panel); border-radius:10px 10px 0 0;
        }
        .grid-toggle-link {
          font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--amber);
          cursor:pointer; white-space:nowrap; padding-top:3px; user-select:none;
        }
        .grid-toggle-link:hover { text-decoration:underline; }

        /* Cards past the computed preview count are hidden via inline style,
           set at runtime by the script at the bottom of this page — see
           kflRefreshGridPreviews(). This guarantees whole rows only. */
      </style>
      <link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><pattern id="s" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#f5a623"/><rect width="4" height="8" fill="#111111"/></pattern></defs><rect width="32" height="32" rx="6" fill="url(#s)"/></svg>')}">
      </head>
      <body data-view="list">
        <header>
          <div class="slate-mark"></div>
          <div><h1>KEY<span>FRAME</span> RESULTS</h1><div class="sub">${esc(doneMsg)}</div></div>
          <div class="view-toggle">
            <button id="kfl-btn-list" class="active" onclick="document.body.dataset.view='list';document.getElementById('kfl-btn-list').classList.add('active');document.getElementById('kfl-btn-grid').classList.remove('active');">☰ List</button>
            <button id="kfl-btn-grid" onclick="document.body.dataset.view='grid';document.getElementById('kfl-btn-grid').classList.add('active');document.getElementById('kfl-btn-list').classList.remove('active');window.kflRefreshGridPreviews();">▦ Grid</button>
            <button id="kfl-copy-md" onclick="window.kflCopyMarkdown();">📋 Copy Markdown</button>
          </div>
        </header>
        <main>
          <div id="kfl-view-list">${bodyHtmlList}</div>
          <div id="kfl-view-grid">${bodyHtmlGrid}</div>
        </main>
        <footer>Data via <a href="https://keyframe-staff-list.com" target="_blank">KeyFrame Staff List</a></footer>
        <script type="application/json" id="kfl-raw-data">${rawDataJson}</script>
        <script>
          // Hides grid cards past N full rows, where N (rows-per-preview) is
          // fixed but the column count is measured live -- guarantees the
          // preview always ends on a complete row regardless of screen width.
          // Only runs meaningfully while Grid view is actually visible, since
          // hidden elements can't be measured (offsetTop is always 0).
          window.kflRefreshGridPreviews = function () {
            if (document.body.dataset.view !== "grid") return;
            document.querySelectorAll(".work-grid-wrap").forEach(function (wrap) {
              var cards = wrap.querySelectorAll(".grid-card");
              if (!cards.length) return;
              if (wrap.classList.contains("expanded")) {
                cards.forEach(function (c) { c.style.display = ""; });
                return;
              }
              var firstTop = cards[0].offsetTop;
              var columns = 0;
              for (var i = 0; i < cards.length; i++) {
                if (cards[i].offsetTop === firstTop) columns++; else break;
              }
              if (columns < 1) columns = 1;
              var rows = parseInt(wrap.dataset.previewRows || "2", 10);
              var previewCount = columns * rows;
              cards.forEach(function (c, i) { c.style.display = i < previewCount ? "" : "none"; });
            });
          };
          var kflResizeTimer;
          window.addEventListener("resize", function () {
            clearTimeout(kflResizeTimer);
            kflResizeTimer = setTimeout(window.kflRefreshGridPreviews, 150);
          });

          function kflEsc(s) { return s == null ? "" : String(s); }

          // Discord's Markdown subset has no headers (# / ##) -- bold/italic/
          // lists only. Using __**bold underline**__ for the top-level name
          // so it stands out from role labels below it.
          window.kflBuildMarkdown = function (results) {
            var lines = [];
            results.forEach(function (r) {
              if (!r.found) {
                lines.push("__**" + kflEsc(r.query) + "**__ — not found (" + kflEsc(r.error || "") + ")");
                lines.push("");
                return;
              }
              lines.push("__**" + kflEsc(r.nameEn || r.query) + "**__" + (r.nameJa ? " (" + kflEsc(r.nameJa) + ")" : ""));
              if (r.jobs && r.jobs.length) lines.push("*Jobs:* " + r.jobs.join(", "));
              lines.push("");

              var roleNames = Object.keys(r.roles || {}).sort(function (a, b) {
                return r.roles[b].length - r.roles[a].length;
              });
              roleNames.forEach(function (roleName) {
                var works = r.roles[roleName];
                lines.push("**" + kflEsc(roleName) + "** (" + works.length + ")");
                works.forEach(function (w) {
                  var eps = w.episodes && w.episodes.length ? " — " + w.episodes.join(", ") : "";
                  lines.push("- " + kflEsc(w.work || w.slug) + " (" + kflEsc(w.year ?? "—") + ")" + eps);
                });
                lines.push("");
              });
            });
            lines.push("_Data via KeyFrame Staff List (keyframe-staff-list.com)_");
            return lines.join("\\n");
          };

          window.kflCopyMarkdown = function () {
            var raw = JSON.parse(document.getElementById("kfl-raw-data").textContent);
            var md = window.kflBuildMarkdown(raw);
            navigator.clipboard.writeText(md).catch(function () {});

            document.getElementById("kfl-md-modal")?.remove();
            var overlay = document.createElement("div");
            overlay.id = "kfl-md-modal";
            overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:999999;display:flex;align-items:center;justify-content:center;padding:24px;";
            overlay.innerHTML =
              '<div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;max-width:640px;width:100%;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;">' +
                '<div style="padding:14px 18px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;">' +
                  '<strong style="font-family:Space Grotesk,sans-serif;">Copied to clipboard — formatted for Discord</strong>' +
                  '<span style="cursor:pointer;color:var(--muted);" onclick="document.getElementById(\\\'kfl-md-modal\\\').remove()">✕</span>' +
                "</div>" +
                '<textarea readonly style="flex:1;min-height:320px;background:#111;color:var(--text);border:none;padding:16px;font-family:JetBrains Mono,monospace;font-size:12px;line-height:1.6;resize:none;box-sizing:border-box;"></textarea>' +
              "</div>";
            document.body.appendChild(overlay);
            var ta = overlay.querySelector("textarea");
            ta.value = md;
            ta.focus();
            ta.select();
          };
        </script>
      </body></html>
    `;
  }

  let lastResults = null;

  // =========================================================================
  // Credit sheet organizer logic
  // =========================================================================
  // Takes messy raw credit-sheet text (role headers, studio names, and
  // names -- sometimes multiple per line), splits it into candidate tokens,
  // then verifies every name/studio live against KeyFrame's own search API.
  // Studio-vs-person is resolved via the API's own is_studio flag rather
  // than guessing from text shape.

  var ROLE_MAP = {
    // Directing
    "総監督": "Chief Director", "chief director": "Chief Director", "general director": "Chief Director",
    "監督": "Director", "director": "Director",
    "副監督": "Assistant Director", "助監督": "Assistant Director", "assistant director": "Assistant Director", "vice director": "Assistant Director",
    "各話演出": "Episode Director", "episode director": "Episode Director", "ed": "Episode Director",
    "演出": "Unit Director", "unit director": "Unit Director",
    "演出補佐": "Assistant Episode Director", "assistant episode director": "Assistant Episode Director", "assistant unit director": "Assistant Episode Director",
    "チーフ演出": "Chief Episode Director", "chief episode director": "Chief Episode Director",
    "シリーズディレクター": "Series Director", "series director": "Series Director",
    // Writing
    "脚本": "Script", "script": "Script", "screenplay": "Script",
    "シリーズ構成": "Series Composition", "series composition": "Series Composition",
    "脚本協力": "Script Cooperation", "script cooperation": "Script Cooperation",
    "脚本監修": "Script Supervision", "script supervision": "Script Supervision", "script supervisor": "Script Supervision",
    // Storyboard
    "コンテ": "Storyboard", "絵コンテ": "Storyboard", "storyboard": "Storyboard", "storyboarder": "Storyboard", "sb": "Storyboard",
    "コンテ協力": "Storyboard Cooperation", "絵コンテ協力": "Storyboard Cooperation", "storyboard cooperation": "Storyboard Cooperation",
    // Animation direction
    "総作画監督": "Chief Animation Director", "chief animation director": "Chief Animation Director", "general animation director": "Chief Animation Director", "cad": "Chief Animation Director",
    "総作画監督補佐": "Assistant Chief Animation Director", "assistant chief animation director": "Assistant Chief Animation Director",
    "作画監督": "Animation Director", "animation director": "Animation Director", "ad": "Animation Director",
    "作画監督補佐": "Assistant Animation Director", "assistant animation director": "Assistant Animation Director", "ass. ad": "Assistant Animation Director", "asst. ad": "Assistant Animation Director",
    "作画監督協力": "Animation Direction Cooperation", "animation direction cooperation": "Animation Direction Cooperation",
    "作画監督補正": "Animation Direction Correction",
    "キャラクター作画監督": "Character Animation Director", "character animation director": "Character Animation Director",
    "アクション作画監督": "Action Animation Director", "action animation director": "Action Animation Director",
    "メカ作画監督": "Mecha Animation Director", "メカニック作画監督": "Mechanical Animation Director",
    "mecha animation director": "Mecha Animation Director", "mechanical animation director": "Mechanical Animation Director",
    // Key / in-between animation
    "第一原画": "1st Key Animation", "1st key animation": "1st Key Animation",
    "第二原画": "2nd Key Animation", "2nd key animation": "2nd Key Animation",
    "原画": "Key Animation", "key animation": "Key Animation", "ka": "Key Animation",
    "原画協力": "Key Animation Cooperation", "key animation cooperation": "Key Animation Cooperation",
    "動画": "In-Between Animation", "in-between animation": "In-Between Animation",
    "動画検査": "In-Between Check", "動画チェック": "In-Between Check", "in-between check": "In-Between Check", "in-between animation check": "In-Between Check",
    "動画協力": "In-Between Cooperation", "in-between cooperation": "In-Between Cooperation",
    // Design
    "キャラクターデザイン": "Character Design", "character design": "Character Design",
    "サブキャラクターデザイン": "Sub Character Design", "sub character design": "Sub Character Design",
    "ゲストキャラデザイン": "Guest Character Design", "guest character design": "Guest Character Design",
    "メカニックデザイン": "Mechanical Design", "mechanical design": "Mechanical Design",
    "メカデザイン": "Mecha Design", "mecha design": "Mecha Design",
    "プロップデザイン": "Prop Design", "prop design": "Prop Design",
    "モンスターデザイン": "Monster Design", "monster design": "Monster Design",
    "美術設定": "Art Setting", "art setting": "Art Setting",
    "総設定": "General Setting", "general setting": "General Setting",
    "設定": "Setting", "setting": "Setting",
    // Art / background
    "美術監督": "Art Director", "art director": "Art Director",
    "美術監督補佐": "Assistant Art Director", "assistant art director": "Assistant Art Director",
    "美術": "Art", "art": "Art",
    "背景": "Background", "background": "Background",
    "美術ボード": "Art Board", "art board": "Art Board",
    // Color
    "色彩設計": "Color Design", "color design": "Color Design",
    "色彩設計補佐": "Assistant Color Design", "assistant color design": "Assistant Color Design",
    "色指定": "Color Specification", "color specification": "Color Specification",
    "色彩": "Color", "color": "Color",
    // Photography / CG
    "撮影監督": "Director of Photography", "director of photography": "Director of Photography",
    "撮影": "Photography", "photography": "Photography",
    "撮影協力": "Photography Cooperation", "photography cooperation": "Photography Cooperation",
    "CGディレクター": "CG Director", "cg director": "CG Director",
    "3DCG監督": "3DCG Director", "3dcg director": "3DCG Director",
    "3DCG": "3DCG", "3dcg": "3DCG",
    // Editing
    "編集": "Editing", "editing": "Editing",
    "編集助手": "Assistant Editor", "assistant editor": "Assistant Editor",
    // Sound
    "音響監督": "Sound Director", "sound director": "Sound Director",
    "音響効果": "Sound Effects", "sound effects": "Sound Effects",
    "音響制作": "Sound Production", "sound production": "Sound Production",
    "録音": "Recording", "recording": "Recording",
    "整音": "Sound Mixing", "sound mixing": "Sound Mixing",
    // Music
    "音楽": "Music", "music": "Music",
    "音楽プロデューサー": "Music Producer", "music producer": "Music Producer",
    "主題歌": "Theme Song", "theme song": "Theme Song",
    // Production
    "プロデューサー": "Producer", "producer": "Producer",
    "アニメーションプロデューサー": "Animation Producer", "animation producer": "Animation Producer",
    "アシスタントプロデューサー": "Assistant Producer", "assistant producer": "Assistant Producer",
    "制作": "Production", "production": "Production",
    "制作進行": "Production Coordinator", "production assistant": "Production Coordinator", "production coordinator": "Production Coordinator",
    "制作デスク": "Production Desk", "production desk": "Production Desk",
    "制作協力": "Production Cooperation", "production cooperation": "Production Cooperation",
    "進行": "Progress", "progress": "Progress",
    // Finishing
    "仕上げ": "Finishing", "finishing": "Finishing", "ink and paint": "Finishing",
    "仕上げ検査": "Finish Check", "finish check": "Finish Check",
    "検査": "Inspection", "inspection": "Inspection", "check": "Inspection",
    // Misc
    "タイムシート": "Timesheet", "timesheet": "Timesheet",
  };

  function kflNorm(s) { return (s || "").trim().toLowerCase().replace(/[.\s]+/g, ""); }
  const ROLE_SET = {};
  Object.keys(ROLE_MAP).forEach((k) => { ROLE_SET[kflNorm(k)] = ROLE_MAP[k]; });
  function isRoleHeader(line) { const k = kflNorm(line); return !!(customRoleSet[k] || ROLE_SET[k]); }
  function roleLabel(line) { const k = kflNorm(line); return customRoleSet[k] || ROLE_SET[k] || line; }

  // Unified tokenizer -- works the same regardless of raw-text format
  // (role on its own line, "role： names" inline, "role names" inline with
  // just a space, "role: name, name, name" comma-separated, or any mix of
  // these within one paste). Colons are normalized to whitespace so every
  // format reduces to the same "stream of words" representation. Commas are
  // treated as a DEFINITIVE person/studio boundary (unlike plain whitespace,
  // which is ambiguous) -- each comma-separated segment becomes its own
  // buffer, never merged with its neighbors. Role terms are detected by
  // matching words/short phrases against the dictionary, checking up to 4
  // words at a time (covers multi-word English terms and abbreviations like
  // "chief animation director" / "CAD"). Everything that isn't a recognized
  // role becomes a "namebuffer": the actual person/studio boundaries within
  // it (when there's no comma to rely on) are NOT guessed from whitespace
  // count -- that's resolved later via live search verification (see
  // verifyTokens/trySplitFallback), which is far more reliable than any
  // text-shape heuristic. Line boundaries still flush buffers, since studios
  // and name-pairs are reliably one-per-line even when role labels aren't.
  function parseCreditSheet(raw) {
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
    const tokens = [];
    let currentRole = null;

    lines.forEach((line) => {
      const normalizedLine = line.replace(/[：:]/g, " ");
      const commaSegments = normalizedLine.split(",").map((s) => s.trim()).filter(Boolean);

      commaSegments.forEach((segment) => {
        const words = segment.split(/\s+/).map((w) => w.trim()).filter(Boolean);

        let buffer = [];
        const flushBuffer = () => {
          if (buffer.length === 0) return;
          tokens.push({ kind: "namebuffer", text: buffer.join(" "), role: currentRole });
          buffer = [];
        };

        let i = 0;
        while (i < words.length) {
          let matchedRole = null;
          let matchedLen = 0;
          for (let len = Math.min(4, words.length - i); len >= 1; len--) {
            const phrase = words.slice(i, i + len).join(" ");
            if (isRoleHeader(phrase)) {
              matchedRole = roleLabel(phrase);
              matchedLen = len;
              break;
            }
          }
          if (matchedRole) {
            flushBuffer();
            currentRole = matchedRole;
            tokens.push({ kind: "role", text: currentRole });
            i += matchedLen;
          } else {
            buffer.push(words[i]);
            i += 1;
          }
        }
        flushBuffer(); // flush at end of each comma segment -- keeps names from merging across commas
      });
    });

    return tokens;
  }

  // Exact text match on either name -> unambiguous (studio or person).
  // No exact match but exactly one non-studio candidate -> treat as a likely
  // spelling variant (resolved automatically, English name preferred).
  // No exact match but 2+ non-studio candidates -> genuinely ambiguous,
  // needs the user to pick (see promptForOrgMatch).
  function classifyMatch(candidateText, matches) {
    const norm = (s) => (s || "").trim();
    const candidateNorm = norm(candidateText);

    for (const m of matches) {
      if (m.is_studio && (norm(m.en) === candidateNorm || norm(m.ja) === candidateNorm)) {
        return { verdict: "studio", match: m };
      }
    }
    for (const m of matches) {
      if (!m.is_studio && (norm(m.en) === candidateNorm || norm(m.ja) === candidateNorm)) {
        return { verdict: "person-exact", match: m };
      }
    }
    const candidates = matches.filter((m) => !m.is_studio);
    if (candidates.length === 0) return { verdict: "not-found", match: null };
    if (candidates.length === 1) return { verdict: "person-diff", match: candidates[0] };
    return { verdict: "ambiguous", candidates };
  }

  // Shows candidate buttons inside the small panel (organize mode) and
  // resolves with the chosen match, or null if "keep as typed" is clicked.
  // Pauses the verify loop until answered -- same pattern as the lookup
  // mode's promptForMatch, just targeting the organizer's own box.
  function promptForOrgMatch(name, matches) {
    return new Promise((resolve) => {
      const box = document.getElementById("org-select");
      box.style.display = "flex";
      box.innerHTML = `<div style="color:#8a8f98; font-size:11.5px; margin-bottom:2px;">Multiple matches for "${esc(name)}" — pick one:</div>`;

      matches.forEach((m) => {
        const btn = document.createElement("button");
        const jobsPreview = (m.jobs || []).slice(0, 2).join(", ");
        btn.textContent = `${m.en || m.ja || "Unnamed"}${m.ja ? ` (${m.ja})` : ""}${jobsPreview ? ` — ${jobsPreview}` : ""}`;
        btn.style.cssText = "text-align:left; background:#1c2028; color:#e8e6e1; border:1px solid #262b33; border-radius:6px; padding:6px 8px; cursor:pointer; font-size:11.5px;";
        btn.onclick = () => { box.style.display = "none"; box.innerHTML = ""; resolve(m); };
        box.appendChild(btn);
      });

      const keepBtn = document.createElement("button");
      keepBtn.textContent = `Keep as typed: "${name}"`;
      keepBtn.style.cssText = "background:#2a1414; color:#f2a; border:1px solid #4a1f1f; border-radius:6px; padding:6px 8px; cursor:pointer; font-size:11.5px;";
      keepBtn.onclick = () => { box.style.display = "none"; box.innerHTML = ""; resolve(null); };
      box.appendChild(keepBtn);
    });
  }

  // When a candidate comes back not-found as a whole, it might actually be
  // several people accidentally joined by single spaces (looks identical to
  // a real multi-word name in plain text -- there's no way to tell apart
  // from shape alone). Greedily searches for the LONGEST word-prefix that
  // independently exists on KeyFrame, consumes it, and repeats on the rest
  // -- preferring to keep multi-word names together (e.g. "山下 悟" as one
  // person) over over-splitting. Only ever suggests a split backed by real
  // search evidence for every resulting piece.
  async function trySplitFallback(text) {
    const words = text.trim().split(/\s+/);
    if (words.length < 2) return null;

    const parts = [];
    let remaining = words.slice();

    while (remaining.length > 0) {
      let matched = false;
      for (let len = remaining.length; len >= 1; len--) {
        const candidate = remaining.slice(0, len).join(" ");
        let matches = [];
        try {
          const searchResult = await searchName(candidate);
          matches = searchResult.matches || [];
        } catch (e) {
          matches = [];
        }
        if (matches.length > 0) {
          parts.push({ text: candidate, matches });
          remaining = remaining.slice(len);
          matched = true;
          break;
        }
      }
      if (!matched) return null; // some leftover chunk doesn't resolve to anything -- give up, not confident enough to suggest a split
    }

    return parts.length >= 2 ? parts : null; // only useful if it actually found more than one person
  }

  function promptSplitConfirm(original, parts) {
    return new Promise((resolve) => {
      const box = document.getElementById("org-select");
      box.style.display = "flex";
      const partsPreview = parts.map((p) => `"${p.text}"`).join(", ");
      box.innerHTML = `<div style="color:#8a8f98; font-size:11.5px; margin-bottom:2px;">"${esc(original)}" wasn't found as one entry, but ${esc(partsPreview)} each exist separately — split into ${parts.length} people?</div>`;

      const splitBtn = document.createElement("button");
      splitBtn.textContent = `Split into: ${partsPreview}`;
      splitBtn.style.cssText = "text-align:left; background:#1c2028; color:#89c37a; border:1px solid #2a3a26; border-radius:6px; padding:6px 8px; cursor:pointer; font-size:11.5px;";
      splitBtn.onclick = () => { box.style.display = "none"; box.innerHTML = ""; resolve(true); };
      box.appendChild(splitBtn);

      const keepBtn = document.createElement("button");
      keepBtn.textContent = `Keep as one: "${original}" (not found)`;
      keepBtn.style.cssText = "background:#2a1414; color:#f2a; border:1px solid #4a1f1f; border-radius:6px; padding:6px 8px; cursor:pointer; font-size:11.5px;";
      keepBtn.onclick = () => { box.style.display = "none"; box.innerHTML = ""; resolve(false); };
      box.appendChild(keepBtn);
    });
  }

  function staffIdFromMatch(match) {
    if (!match) return null;
    if (match.anilist_id != null) return match.anilist_id;
    if (match.ja) return "ja:" + encodeURIComponent(match.ja);
    if (match.en) return "en:" + encodeURIComponent(match.en);
    return null;
  }

  async function makeOrgCandidate(text, role, verdict, match, allMatches) {
    let lookupResult = null;
    if (match && !match.is_studio && (verdict === "person-exact" || verdict === "person-diff")) {
      const staffId = staffIdFromMatch(match);
      if (staffId != null) {
        lookupResult = await fetchProfile(text, staffId, allMatches || [{
          id: match.anilist_id, en: match.en, ja: match.ja, jobs: match.jobs, isStudio: !!match.is_studio,
        }]);
      }
    }
    return { kind: "candidate", text, role, verdict, match: match || null, lookupResult };
  }

  // Resolution for one piece of a confirmed split. If that piece is itself
  // unambiguous, resolves directly; if it's ambiguous too (e.g. multiple
  // "Christine"s), shows the same picker as the normal flow rather than
  // silently guessing the first match.
  async function resolveSplitHalf(text, role, matches) {
    const cls = classifyMatch(text, matches);
    const allMatches = matches.map((m) => ({
      id: m.anilist_id, en: m.en, ja: m.ja, jobs: m.jobs, isStudio: !!m.is_studio,
    }));
    if (cls.verdict === "studio" || cls.verdict === "person-exact" || cls.verdict === "person-diff") {
      return makeOrgCandidate(text, role, cls.verdict, cls.match, allMatches);
    }
    if (cls.verdict === "ambiguous") {
      const chosen = await promptForOrgMatch(text, cls.candidates);
      return makeOrgCandidate(text, role, chosen ? "person-diff" : "not-found", chosen, chosen ? [{
        id: chosen.anilist_id, en: chosen.en, ja: chosen.ja, jobs: chosen.jobs, isStudio: !!chosen.is_studio,
      }] : []);
    }
    return makeOrgCandidate(text, role, "not-found", null, allMatches);
  }

  async function verifyTokens(tokens, onProgress) {
    const out = [];
    const buffers = tokens.filter((t) => t.kind === "namebuffer");
    let done = 0;
    let lastNetworkLookupAt = 0;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.kind === "role") { out.push(t); continue; }
      done++;
      onProgress(done, buffers.length, t.text);
      const waitForSpacing = Math.max(0, VERIFY_DELAY_MS - (Date.now() - lastNetworkLookupAt));
      if (lastNetworkLookupAt && waitForSpacing) await sleep(waitForSpacing);
      try {
        const searchResult = await searchName(t.text);
        const matches = searchResult.matches || [];
        if (searchResult.matches || searchResult.error) lastNetworkLookupAt = Date.now();
        const cls = classifyMatch(t.text, matches);
        const allMatches = matches.map((m) => ({
          id: m.anilist_id, en: m.en, ja: m.ja, jobs: m.jobs, isStudio: !!m.is_studio,
        }));

        if (cls.verdict === "ambiguous") {
          onProgress(done, buffers.length, `${t.text} — pick a match in the panel...`);
          const chosen = await promptForOrgMatch(t.text, cls.candidates);
          out.push(await makeOrgCandidate(
            t.text, t.role, chosen ? "person-diff" : "not-found", chosen,
            chosen ? [{ id: chosen.anilist_id, en: chosen.en, ja: chosen.ja, jobs: chosen.jobs, isStudio: !!chosen.is_studio }] : allMatches
          ));
        } else if (cls.verdict === "not-found") {
          let noSpaceResolved = false;
          if (/\s/.test(t.text)) {
            const noSpaceText = t.text.replace(/\s+/g, "");
            try {
              const searchResult2 = await searchName(noSpaceText);
              const matches2 = searchResult2.matches || [];
              lastNetworkLookupAt = Date.now();
              const cls2 = classifyMatch(noSpaceText, matches2);
              const allMatches2 = matches2.map((m) => ({
                id: m.anilist_id, en: m.en, ja: m.ja, jobs: m.jobs, isStudio: !!m.is_studio,
              }));
              if (cls2.verdict === "studio" || cls2.verdict === "person-exact" || cls2.verdict === "person-diff") {
                out.push(await makeOrgCandidate(t.text, t.role, cls2.verdict, cls2.match, allMatches2));
                noSpaceResolved = true;
              } else if (cls2.verdict === "ambiguous") {
                onProgress(done, buffers.length, `${t.text} — pick a match in the panel...`);
                const chosen2 = await promptForOrgMatch(t.text, cls2.candidates);
                out.push(await makeOrgCandidate(
                  t.text, t.role, chosen2 ? "person-diff" : "not-found", chosen2,
                  chosen2 ? [{ id: chosen2.anilist_id, en: chosen2.en, ja: chosen2.ja, jobs: chosen2.jobs, isStudio: !!chosen2.is_studio }] : allMatches2
                ));
                noSpaceResolved = true;
              }
            } catch (e) {}
          }

          if (!noSpaceResolved) {
            const splitParts = await trySplitFallback(t.text);
            if (splitParts) {
              onProgress(done, buffers.length, `${t.text} — possible split found, confirm in panel...`);
              const doSplit = await promptSplitConfirm(t.text, splitParts);
              if (doSplit) {
                for (const part of splitParts) {
                  out.push(await resolveSplitHalf(part.text, t.role, part.matches));
                }
              } else {
                out.push(await makeOrgCandidate(t.text, t.role, "not-found", null, allMatches));
              }
            } else {
              out.push(await makeOrgCandidate(t.text, t.role, "not-found", null, allMatches));
            }
          }
        } else {
          out.push(await makeOrgCandidate(t.text, t.role, cls.verdict, cls.match, allMatches));
        }
      } catch (e) {
        out.push(await makeOrgCandidate(t.text, t.role, "error", null, []));
      }
    }
    return out;
  }

  function reconstruct(verifiedTokens) {
    const roles = [];
    let currentRoleObj = null;
    let currentGroup = null;

    function ensureGroup() {
      if (!currentGroup) {
        currentGroup = { studio: null, people: [] };
        currentRoleObj.groups.push(currentGroup);
      }
      return currentGroup;
    }

    verifiedTokens.forEach((t) => {
      if (t.kind === "role") {
        currentRoleObj = { role: t.text, groups: [] };
        roles.push(currentRoleObj);
        currentGroup = null;
        return;
      }
      if (!currentRoleObj) {
        currentRoleObj = { role: "Unlabeled", groups: [] };
        roles.push(currentRoleObj);
        currentGroup = null;
      }
      if (t.verdict === "studio") {
        const studioName = t.match ? (t.match.en || t.match.ja || t.text) : t.text;
        currentGroup = { studio: studioName, people: [] };
        currentRoleObj.groups.push(currentGroup);
        return;
      }
      const group = ensureGroup();
      const official = t.match ? (t.match.en || t.match.ja || null) : null;
      group.people.push({
        original: t.text,
        verdict: t.verdict,
        official: official,
        chosen: official ? "official" : "original",
        match: t.match || null,
        lookupResult: t.lookupResult || null,
      });
    });
    return roles;
  }

  // Matches the style of well-established credit-sheet posts: a plain
  // "Role: Name, Name" line when a role has just one group, or "Role:" on
  // its own line followed by blank-line-separated studio blocks when a
  // role spans multiple studios/groups. Minimal decoration -- no emoji,
  // no per-name flags beyond a trailing "?" for not-found.
  function buildOrgMarkdown(roles) {
    const lines = [];

    function nameListFor(group) {
      return group.people
        .map((p) => {
          const name = p.chosen === "official" && p.official ? p.official : p.original;
          return p.verdict === "not-found" ? `${name}?` : name;
        })
        .join(", ");
    }

    roles.forEach((roleObj) => {
      const groups = roleObj.groups.filter((g) => g.people.length > 0);
      if (groups.length === 0) return;

      if (groups.length === 1) {
        const g = groups[0];
        const studioLabel = g.studio ? ` (${g.studio})` : "";
        lines.push(`**${roleObj.role}**${studioLabel}: ${nameListFor(g)}`);
        lines.push("");
      } else {
        lines.push(`**${roleObj.role}:**`);
        groups.forEach((g) => {
          if (g.studio) lines.push(g.studio);
          lines.push(nameListFor(g));
          lines.push("");
        });
      }
    });

    // trim the trailing blank line
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    return lines.join("\n");
  }

  // Full standalone HTML document -- real, selectable DOM (not a rasterized
  // image). Used by "View as Page" (opens in a new tab) and "Download HTML"
  // (saves as a portable file you can host, embed, or attach anywhere).
  function buildOrganizerResults(roles) {
    const seen = {};
    const results = [];
    for (const roleObj of roles || []) {
      for (const group of roleObj.groups || []) {
        for (const person of group.people || []) {
          const result = person && person.lookupResult;
          if (!result || !result.found) continue;
          const key = profileCacheKey(result.id != null ? result.id : result.nameEn || result.query);
          if (seen[key]) continue;
          seen[key] = true;
          results.push(result);
        }
      }
    }
    return buildResultsPage(results);
  }

  let kflOrgData = null;

  // ---------- organizer results: second small side-panel ----------
  function renderOrgResultsHtml(roles) {
    let html = "";
    let orgUid = 0; // dedicated counter, always starts fresh -- must match buildOrgMarkdownFromDom's read order
    roles.forEach((roleObj) => {
      const hasContent = roleObj.groups.some((g) => g.people.length > 0);
      if (!hasContent) return;
      html += `<div class="korg-role"><div class="korg-role-head">${esc(roleObj.role)}</div>`;
      roleObj.groups.forEach((g) => {
        if (g.people.length === 0) return;
        html += `<div class="korg-group">`;
        html += g.studio
          ? `<div class="korg-studio">🏢 ${esc(g.studio)}</div>`
          : `<div class="korg-freelance">No studio listed</div>`;
        html += `<div class="korg-chip-row">`;
        g.people.forEach((p) => {
          const gid = orgUid++;
          const initialText = p.chosen === "official" && p.official ? p.official : p.original;
          html += `<div class="korg-person">`;
          html += `<span class="korg-person-name" id="korg-name-${gid}">${esc(initialText)}</span>`;
          if (p.verdict === "not-found" || p.verdict === "error") {
            html += `<span class="korg-tag notfound">not found</span>`;
          } else if (p.official && p.official !== p.original) {
            html += `<span class="korg-toggle" id="korg-toggle-${gid}" data-official="${esc(p.official)}" data-original="${esc(p.original)}" data-chosen="${p.chosen}">↔ as typed: ${esc(p.original)}</span>`;
          } else {
            html += `<span class="korg-tag ok">✓ verified</span>`;
          }
          html += `</div>`;
        });
        html += `</div>`; // close korg-chip-row
        html += `</div>`; // close korg-group
      });
      html += `</div>`;
    });
    return html || `<div style="color:#8a8f98; padding:16px 0; font-size:12.5px;">Nothing parsed — check the pasted text.</div>`;
  }

  function showOrgResultsPanel(roles) {
    document.getElementById("kfl-org-panel")?.remove();

    const orgPanel = document.createElement("div");
    orgPanel.id = "kfl-org-panel";
    const mainRect = panel.getBoundingClientRect();
    const leftPos = Math.max(20, mainRect.left - 420);
    orgPanel.style.cssText = `
      position: fixed; top: 20px; left: ${leftPos}px; width: 400px; max-height: 88vh;
      background: #0b0d10; color: #e8e6e1; font-family: 'Inter', system-ui, sans-serif;
      font-size: 13px; border-radius: 10px; box-shadow: 0 8px 30px rgba(0,0,0,.5);
      z-index: 999998; overflow: hidden; border: 1px solid #262b33;
      display: flex; flex-direction: column;
    `;

    orgPanel.innerHTML = `
      <style>
        #kfl-org-panel .korg-role { border-bottom: 1px solid #262b33; }
        #kfl-org-panel .korg-role:last-child { border-bottom: none; }
        #kfl-org-panel .korg-role-head { font-weight: 700; font-size: 13px; padding: 10px 14px 4px; }
        #kfl-org-panel .korg-group { padding: 6px 14px 10px; }
        #kfl-org-panel .korg-studio { font-family: monospace; font-size: 11px; color: #f5a623; margin-bottom: 6px; }
        #kfl-org-panel .korg-freelance { font-family: monospace; font-size: 10.5px; color: #8a8f98; margin-bottom: 6px; }
        #kfl-org-panel .korg-chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
        #kfl-org-panel .korg-person {
          display: flex; align-items: center; gap: 6px; font-size: 12.5px;
          background: #1c2028; border: 1px solid #262b33; border-radius: 20px;
          padding: 4px 10px;
        }
        #kfl-org-panel .korg-tag { font-family: monospace; font-size: 9.5px; padding: 1px 6px; border-radius: 20px; white-space: nowrap; }
        #kfl-org-panel .korg-tag.ok { background: rgba(137,195,122,.15); color: #89c37a; }
        #kfl-org-panel .korg-tag.notfound { background: rgba(224,108,117,.15); color: #e06c75; }
        #kfl-org-panel .korg-toggle { font-family: monospace; font-size: 10px; color: #4fd1c5; cursor: pointer; text-decoration: underline dotted; white-space: nowrap; }
      </style>
      <div id="korg-drag-handle" style="padding:10px 14px; background:#7e4ea0; font-weight:600; display:flex; justify-content:space-between; align-items:center; cursor:move; user-select:none; flex-shrink:0;">
        <span>Credit Sheet Results</span>
        <span id="korg-close" data-no-drag="1" style="cursor:pointer; opacity:.8;">✕</span>
      </div>
      <div style="padding:10px 14px; overflow-y:auto; flex:1;">
        <div id="korg-results">${renderOrgResultsHtml(roles)}</div>
        <div style="margin-top:16px; font-weight:700; font-size:12.5px; margin-bottom:6px;">Shareable output</div>
        <textarea id="korg-preview" readonly style="width:100%; height:160px; box-sizing:border-box; background:#111; color:#e8e6e1; border:1px solid #262b33; border-radius:6px; padding:8px; font-family:monospace; font-size:11.5px; resize:vertical;">${esc(buildOrgMarkdown(roles))}</textarea>
        <div style="display:flex; gap:8px; margin-top:8px;">
          <button id="korg-copy" style="flex:1; background:#7e4ea0; color:#fff; border:none; border-radius:6px; padding:8px; cursor:pointer; font-weight:600; font-size:12.5px;">📋 Copy Markdown</button>
          <button id="korg-viewpage" style="flex:1; background:#1c2028; color:#e8e6e1; border:1px solid #262b33; border-radius:6px; padding:8px; cursor:pointer; font-weight:600; font-size:12.5px;">🌐 View as Page</button>
        </div>
        <button id="korg-savehtml" style="width:100%; margin-top:6px; background:#1c2028; color:#e8e6e1; border:1px solid #262b33; border-radius:6px; padding:8px; cursor:pointer; font-weight:600; font-size:12.5px;">⬇️ Download HTML</button>
      </div>
    `;

    document.body.appendChild(orgPanel);
    setupDrag(document.getElementById("korg-drag-handle"), orgPanel);
    document.getElementById("korg-close").onclick = () => orgPanel.remove();

    document.getElementById("korg-copy").onclick = () => {
      const md = document.getElementById("korg-preview").value;
      const btn = document.getElementById("korg-copy");
      const original = btn.textContent;
      navigator.clipboard.writeText(md).then(() => {
        btn.textContent = "✓ Copied!";
        setTimeout(() => { btn.textContent = original; }, 1500);
      }).catch(() => {
        btn.textContent = "Copy failed";
        setTimeout(() => { btn.textContent = original; }, 1500);
      });
    };

    document.getElementById("korg-viewpage").onclick = async () => {
      const btn = document.getElementById("korg-viewpage");
      const old = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Loading staff history...";
      try {
        const html = buildOrganizerResults(kflOrgData);
        const win = window.open("", "_blank");
        if (!win) { alert("Popup blocked — allow popups for this site and try again."); return; }
        win.document.write(html);
        win.document.close();
      } finally {
        btn.disabled = false;
        btn.textContent = old;
      }
    };

    document.getElementById("korg-savehtml").onclick = async () => {
      const btn = document.getElementById("korg-savehtml");
      const old = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Preparing HTML...";
      try {
        const html = buildOrganizerResults(kflOrgData);
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "keyframe_credit_sheet_results.html";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
      } finally {
        btn.disabled = false;
        btn.textContent = old;
      }
    };

    // wire the per-person spelling toggles
    orgPanel.querySelectorAll(".korg-toggle").forEach((toggleEl) => {
      toggleEl.onclick = () => {
        const nameEl = toggleEl.previousElementSibling;
        const chosen = toggleEl.dataset.chosen === "official" ? "original" : "official";
        toggleEl.dataset.chosen = chosen;
        if (chosen === "official") {
          nameEl.textContent = toggleEl.dataset.official;
          toggleEl.textContent = "↔ as typed: " + toggleEl.dataset.original;
        } else {
          nameEl.textContent = toggleEl.dataset.original;
          toggleEl.textContent = "↔ use English: " + toggleEl.dataset.official;
        }
        // reflect the choice back into kflOrgData so exports match the UI
        const md = buildOrgMarkdownFromDom(orgPanel);
        document.getElementById("korg-preview").value = md;
      };
    });
  }

  // Rebuilds markdown by reading the CURRENT toggle states directly from the
  // side panel's DOM, so a manual spelling toggle is reflected immediately
  // in the exported text without needing to re-run verification.
  function buildOrgMarkdownFromDom(orgPanel) {
    // Simplest reliable approach: mutate kflOrgData in place to match the
    // DOM's current toggle states, then reuse the normal builder.
    let idx = 0;
    kflOrgData.forEach((roleObj) => {
      roleObj.groups.forEach((g) => {
        g.people.forEach((p) => {
          const toggleEl = document.getElementById("korg-toggle-" + idx);
          const nameEl = document.getElementById("korg-name-" + idx);
          if (toggleEl) {
            p.chosen = toggleEl.dataset.chosen;
          }
          idx++;
        });
      });
    });
    return buildOrgMarkdown(kflOrgData);
  }

  // ---------- panel body templates ----------
  function lookupBodyHtml() {
    return `
      <div id="kfl-drag-handle" style="padding:10px 14px; background:#7e4ea0; font-weight:600; display:flex; justify-content:space-between; align-items:center; cursor:move; user-select:none;">
        <span>KeyFrame Lookup</span>
        <span id="kfl-close" data-no-drag="1" style="cursor:pointer; opacity:.8;">✕</span>
      </div>
      <div style="padding:12px 14px; display:flex; flex-direction:column; gap:8px;">
        <textarea id="kfl-names" placeholder="One name per line, or comma-separated...&#10;Yutaka Nakamura&#10;Norio Matsumoto"
          style="width:100%; height:70px; resize:vertical; background:#111; color:#eee; border:1px solid #262b33; border-radius:6px; padding:6px; box-sizing:border-box; font-family:inherit;"></textarea>
        <button id="kfl-run" style="background:#7e4ea0; color:#fff; border:none; border-radius:6px; padding:8px; cursor:pointer; font-weight:600;">
          Run lookup
        </button>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div id="kfl-cache-count" style="font-size:11px; color:#8a8f98;"></div>
          <span id="kfl-clear-cache" style="font-size:11px; color:#8a8f98; cursor:pointer; text-decoration:underline;">Clear cache</span>
        </div>
        <div id="kfl-log" style="font-family:monospace; font-size:11px; color:#8a8f98; max-height:90px; overflow-y:auto; line-height:1.5; white-space:pre-wrap;"></div>
        <div id="kfl-progress" style="font-size:11px; color:#8a8f98; min-height:14px;"></div>
        <div id="kfl-select" style="display:none; flex-direction:column; gap:6px; background:#111; border:1px solid #262b33; border-radius:6px; padding:8px; max-height:180px; overflow-y:auto;"></div>
        <div style="display:flex; gap:8px;">
          <button id="kfl-view" style="display:none; flex:1; background:#4fd1c5; color:#0b0d10; border:none; border-radius:6px; padding:8px; cursor:pointer; font-weight:600;">
            View Results
          </button>
          <button id="kfl-download" style="display:none; flex:1; background:#1c2028; color:#e8e6e1; border:1px solid #262b33; border-radius:6px; padding:8px; cursor:pointer; font-weight:600;">
            Download JSON
          </button>
        </div>
        <button id="kfl-download-html" style="display:none; background:#1c2028; color:#e8e6e1; border:1px solid #262b33; border-radius:6px; padding:8px; cursor:pointer; font-weight:600; margin-top:4px;">
          ⬇️ Download HTML (to share)
        </button>
        <div style="text-align:center; margin-top:2px;">
          <span id="kfl-mode-switch" style="font-size:11px; color:#8a8f98; cursor:pointer; text-decoration:underline;">📋 Switch to Credit Sheet Organizer</span>
        </div>
      </div>
    `;
  }

  function customRolesListHtml() {
    const keys = Object.keys(customRoles);
    if (keys.length === 0) {
      return `<div style="color:#8a8f98; font-size:11px;">No custom roles yet.</div>`;
    }
    return keys.map((k) => `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; padding:3px 0; font-size:11.5px;">
        <span><strong>${esc(k)}</strong> → ${esc(customRoles[k])}</span>
        <span class="custom-role-remove" data-key="${esc(k)}" style="color:#e06c75; cursor:pointer; font-family:monospace;">✕</span>
      </div>
    `).join("");
  }

  function organizeBodyHtml() {
    return `
      <div id="kfl-drag-handle" style="padding:10px 14px; background:#7e4ea0; font-weight:600; display:flex; justify-content:space-between; align-items:center; cursor:move; user-select:none;">
        <span>Credit Sheet Organizer</span>
        <span id="kfl-close" data-no-drag="1" style="cursor:pointer; opacity:.8;">✕</span>
      </div>
      <div style="padding:12px 14px; display:flex; flex-direction:column; gap:8px;">
        <textarea id="org-input" placeholder="Paste raw credit sheet text here..."
          style="width:100%; height:130px; resize:vertical; background:#111; color:#eee; border:1px solid #262b33; border-radius:6px; padding:6px; box-sizing:border-box; font-family:monospace; font-size:12px;"></textarea>
        <button id="org-run" style="background:#7e4ea0; color:#fff; border:none; border-radius:6px; padding:8px; cursor:pointer; font-weight:600;">
          Parse &amp; Verify
        </button>
        <div id="org-log" style="font-family:monospace; font-size:11px; color:#8a8f98; max-height:90px; overflow-y:auto; line-height:1.5; white-space:pre-wrap;"></div>
        <div id="org-select" style="display:none; flex-direction:column; gap:6px; background:#111; border:1px solid #262b33; border-radius:6px; padding:8px; max-height:180px; overflow-y:auto;"></div>
        <div style="text-align:center; margin-top:2px; display:flex; justify-content:center; gap:14px;">
          <span id="kfl-custom-roles-toggle" style="font-size:11px; color:#8a8f98; cursor:pointer; text-decoration:underline;">⚙️ Custom Roles</span>
          <span id="kfl-mode-switch" style="font-size:11px; color:#8a8f98; cursor:pointer; text-decoration:underline;">🔍 Switch to Lookup</span>
        </div>
        <div id="kfl-custom-roles-panel" style="display:none; flex-direction:column; gap:6px; background:#111; border:1px solid #262b33; border-radius:6px; padding:10px;">
          <div style="font-size:11px; color:#8a8f98; margin-bottom:2px;">Any term you add here will be recognized as a role header, just like the built-in ones — useful for abbreviations or house-specific labels the built-in dictionary doesn't know.</div>
          <div id="kfl-custom-roles-list">${customRolesListHtml()}</div>
          <div style="display:flex; gap:6px; margin-top:4px;">
            <input id="kfl-custom-role-term" placeholder="Term (e.g. Ass.ED)" style="flex:1; min-width:0; background:#1c2028; color:#eee; border:1px solid #262b33; border-radius:6px; padding:6px; font-size:11.5px;">
            <input id="kfl-custom-role-target" placeholder="Maps to (e.g. Assistant Episode Director)" style="flex:1; min-width:0; background:#1c2028; color:#eee; border:1px solid #262b33; border-radius:6px; padding:6px; font-size:11.5px;">
          </div>
          <button id="kfl-custom-role-add" style="background:#7e4ea0; color:#fff; border:none; border-radius:6px; padding:6px; cursor:pointer; font-weight:600; font-size:11.5px;">Add</button>
        </div>
      </div>
    `;
  }

  function wireLookupHandlers() {
    document.getElementById("kfl-close").onclick = () => panel.remove();
    setupDrag(document.getElementById("kfl-drag-handle"), panel);
    updateCacheCount();

    document.getElementById("kfl-clear-cache").onclick = () => {
      for (const k in cache) delete cache[k];
      updateCacheCount();
      log("Cache cleared.");
    };

    document.getElementById("kfl-mode-switch").onclick = () => {
      kflMode = "organize";
      renderPanel();
    };

    document.getElementById("kfl-view").onclick = () => {
      if (!lastResults) return;
      const win = window.open("", "_blank");
      if (!win) { log("Popup blocked — allow popups for this site and try again."); return; }
      win.document.write(buildResultsPage(lastResults));
      win.document.close();
    };

    document.getElementById("kfl-download").onclick = () => {
      if (!lastResults) return;
      const blob = new Blob([JSON.stringify(lastResults, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "keyframe_results.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
    };

    document.getElementById("kfl-download-html").onclick = () => {
      if (!lastResults) return;
      const html = buildResultsPage(lastResults);
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "keyframe_lookup_results.html";
      document.body.appendChild(a);
      a.click();
      a.remove();
    };

    document.getElementById("kfl-run").onclick = async () => {
      const names = document.getElementById("kfl-names").value
        .split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
      if (names.length === 0) { log("Enter at least one name."); return; }

      document.getElementById("kfl-log").textContent = "";
      document.getElementById("kfl-run").disabled = true;
      document.getElementById("kfl-mode-switch").style.pointerEvents = "none";
      document.getElementById("kfl-mode-switch").style.opacity = "0.4";
      document.getElementById("kfl-view").style.display = "none";
      document.getElementById("kfl-download").style.display = "none";
      document.getElementById("kfl-download-html").style.display = "none";
      lastResults = null;

      const results = [];
      let lastNetworkLookupAt = 0;
      const progressEl = document.getElementById("kfl-progress");
      const publishProgress = () => {
        lastResults = results.slice();
        if (progressEl) {
          const found = results.filter((r) => r.found).length;
          progressEl.textContent = `Processed ${results.length}/${names.length} · ${found} found`;
        }
        if (results.length) {
          document.getElementById("kfl-view").style.display = "block";
          document.getElementById("kfl-download").style.display = "block";
          document.getElementById("kfl-download-html").style.display = "block";
        }
      };

      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        const key = cacheKey(name);

        if (cache[key]) {
          log(`${name}: using cached result`);
          results.push(cache[key]);
          publishProgress();
          continue;
        }

        log(`Looking up: ${name} ...`);
        try {
          // Wait only when this lookup actually needs a network request.
          // Search/profile caches are also considered fast paths, so they do
          // not inherit the network pacing delay.
          const elapsed = Date.now() - lastNetworkLookupAt;
          if (lastNetworkLookupAt && elapsed < DELAY_MS) await sleep(DELAY_MS - elapsed);
          const res = await lookupName(name);
          if (res._network) lastNetworkLookupAt = Date.now();
          results.push(res);
          cache[key] = res;
          updateCacheCount();
          publishProgress();
          log(res.found ? `  -> OK` : `  -> FAILED (${res.error})`);
        } catch (e) {
          lastNetworkLookupAt = Date.now();
          const failed = { query: name, found: false, error: String(e) };
          results.push(failed);
          cache[key] = failed;
          updateCacheCount();
          publishProgress();
          log(`  -> ERROR: ${e}`);
        }
      }

      lastResults = results;
      if (progressEl) {
        const found = results.filter((r) => r.found).length;
        progressEl.textContent = `Done · ${found}/${results.length} found`;
      }
      log(`Done — ${results.filter((r) => r.found).length}/${results.length} found.`);
      document.getElementById("kfl-run").disabled = false;
      document.getElementById("kfl-mode-switch").style.pointerEvents = "";
      document.getElementById("kfl-mode-switch").style.opacity = "";
      document.getElementById("kfl-view").style.display = "block";
      document.getElementById("kfl-download").style.display = "block";
      document.getElementById("kfl-download-html").style.display = "block";
    };
  }

  function wireOrganizeHandlers() {
    document.getElementById("kfl-close").onclick = () => panel.remove();
    setupDrag(document.getElementById("kfl-drag-handle"), panel);

    const orgLog = (msg) => {
      const el = document.getElementById("org-log");
      if (!el) return;
      el.textContent += (el.textContent ? "\n" : "") + msg;
      el.scrollTop = el.scrollHeight;
    };

    document.getElementById("kfl-mode-switch").onclick = () => {
      kflMode = "lookup";
      renderPanel();
    };

    document.getElementById("kfl-custom-roles-toggle").onclick = () => {
      const panelEl = document.getElementById("kfl-custom-roles-panel");
      panelEl.style.display = panelEl.style.display === "none" ? "flex" : "none";
    };

    function refreshCustomRolesList() {
      document.getElementById("kfl-custom-roles-list").innerHTML = customRolesListHtml();
      document.querySelectorAll(".custom-role-remove").forEach((el) => {
        el.onclick = () => {
          delete customRoles[el.dataset.key];
          saveCustomRoles();
          refreshCustomRolesList();
        };
      });
    }
    refreshCustomRolesList();

    document.getElementById("kfl-custom-role-add").onclick = () => {
      const termInput = document.getElementById("kfl-custom-role-term");
      const targetInput = document.getElementById("kfl-custom-role-target");
      const term = termInput.value.trim();
      const target = targetInput.value.trim();
      if (!term || !target) return;
      customRoles[term] = target;
      saveCustomRoles();
      termInput.value = "";
      targetInput.value = "";
      refreshCustomRolesList();
    };

    document.getElementById("org-run").onclick = async () => {
      const raw = document.getElementById("org-input").value;
      if (!raw.trim()) { orgLog("Paste some text first."); return; }

      document.getElementById("org-log").textContent = "";
      document.getElementById("org-run").disabled = true;
      document.getElementById("kfl-mode-switch").style.pointerEvents = "none";
      document.getElementById("kfl-mode-switch").style.opacity = "0.4";

      const tokens = parseCreditSheet(raw);

      const verified = await verifyTokens(tokens, (done, total, name) => {
        orgLog(`Verifying ${done}/${total}: ${name}`);
      });

      const roles = reconstruct(verified);
      kflOrgData = roles;
      showOrgResultsPanel(roles);

      orgLog("Done. Results opened in the side panel.");
      document.getElementById("org-run").disabled = false;
      document.getElementById("kfl-mode-switch").style.pointerEvents = "";
      document.getElementById("kfl-mode-switch").style.opacity = "";
    };
  }

  function renderPanel() {
    panel.innerHTML = kflMode === "lookup" ? lookupBodyHtml() : organizeBodyHtml();
    if (kflMode === "lookup") wireLookupHandlers();
    else wireOrganizeHandlers();
  }

  renderPanel();
})();
