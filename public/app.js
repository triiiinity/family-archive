/* Family Archive
   All content comes from the three spreadsheets in /data (saved from Excel as CSV):
     collections.csv  - the folders (Mema, Poppy, Lesters, Lesters Now)
     people.csv       - one row per person
     photos.csv       - one row per photo (the inventory)
   Real images go in /images/web/ and are named in the photos.csv "file" column.
   Pages are addressed by a simple #name: #sloan, #lester, #mema, #person-mema.
*/

const SIDES = {
  sloan: { title: "Sloan" },
  lester: { title: "Lester" },
};

const state = { collections: [], people: new Map(), photos: [], ready: false };
const app = document.getElementById("app");

/* ---------- Helpers ---------- */

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const splitList = (s) => (s || "").split(";").map((x) => x.trim()).filter(Boolean);
const isYes = (s) => /^(y|yes|true|1)$/i.test((s || "").trim());

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const head = (rows.shift() || []).map((h) => h.replace(/^﻿/, "").trim().toLowerCase());
  return rows
    .filter((r) => r.some((v) => v.trim()))
    .map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}

function personName(id) {
  const p = state.people.get(id);
  return p ? p.known_as || p.name || id : id;
}

function hashOf(str) {
  let h = 2166136261;
  for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* Stand-in "photo" drawn as an image until the real scan exists. */
function placeholder(id, tone = 0) {
  const h = hashOf(id);
  const shapes = [[3, 2], [2, 3], [1, 1], [4, 3], [3, 4], [5, 4]];
  const [aw, ah] = shapes[h % shapes.length];
  const W = 600, H = Math.round((W * ah) / aw);
  const palettes = [
    ["#efe6d6", "#d9c7a8", "#b89d77"],
    ["#ebe4dc", "#cbbcab", "#9f8b76"],
    ["#e9e7e1", "#c9c4b8", "#958d80"],
    ["#f0e4d4", "#dcc0a0", "#ae8865"],
  ];
  const [bg, mid, dark] = palettes[(h + tone) % palettes.length];
  const horizon = Math.round(H * (0.45 + ((h >> 3) % 20) / 100));
  const sunX = Math.round(W * (0.2 + ((h >> 5) % 60) / 100));
  const b = 22; // white print border
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="#fbfaf7"/>
    <rect x="${b}" y="${b}" width="${W - 2 * b}" height="${H - 2 * b}" fill="${bg}"/>
    <circle cx="${sunX}" cy="${Math.round(horizon * 0.55)}" r="${Math.round(W * 0.07)}" fill="${mid}" opacity=".8"/>
    <rect x="${b}" y="${horizon}" width="${W - 2 * b}" height="${H - horizon - b}" fill="${mid}"/>
    <path d="M${b} ${horizon} Q ${W * 0.35} ${horizon - H * 0.12} ${W * 0.6} ${horizon} T ${W - b} ${horizon - H * 0.05} V ${H - b} H ${b} Z" fill="${dark}" opacity=".35"/>
    <text x="${W / 2}" y="${H - b - 18}" text-anchor="middle" font-family="Georgia, serif" font-size="22" fill="#5d5247" opacity=".75">${esc(id)}</text>
  </svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

function imageFor(photo) {
  return photo.file ? `images/web/${encodeURIComponent(photo.file)}` : placeholder(photo.id);
}

/* If a real image is missing, quietly fall back to the stand-in. */
document.addEventListener("error", (e) => {
  const img = e.target;
  if (img.tagName === "IMG" && img.dataset.fallback && img.src !== img.dataset.fallback) {
    img.src = img.dataset.fallback;
  }
}, true);

function imgTag(photo, alt) {
  return `<img src="${esc(imageFor(photo))}" data-fallback="${esc(placeholder(photo.id))}" alt="${esc(alt)}" loading="lazy">`;
}

/* ---------- Data ---------- */

const visiblePhotos = () => state.photos.filter((p) => !isYes(p.private));
const photosIn = (code) => visiblePhotos().filter((p) => p.collection === code);
const collectionsOn = (side) => state.collections.filter((c) => c.side === side);
const collectionByCode = (code) => state.collections.find((c) => c.code === code);

async function load() {
  const get = (f) => fetch(`data/${f}`, { cache: "no-cache" }).then((r) => {
    if (!r.ok) throw new Error(`${f}: ${r.status}`);
    return r.text();
  });
  const [cols, people, photos] = await Promise.all([get("collections.csv"), get("people.csv"), get("photos.csv")]);
  state.collections = parseCSV(cols).sort((a, b) => (+a.order || 0) - (+b.order || 0));
  state.people = new Map(parseCSV(people).map((p) => [p.person_id, p]));
  state.photos = parseCSV(photos).sort((a, b) =>
    a.collection === b.collection ? (+a.original_position || 0) - (+b.original_position || 0) : 0);
  state.ready = true;
}

/* ---------- Pages ---------- */

function coverFor(photos, fallbackId, tone) {
  const first = photos[0];
  return first
    ? imgTag(first, "")
    : `<img src="${placeholder(fallbackId, tone)}" alt="">`;
}

function card(href, title, meta, cover, side, crest = false) {
  const crestImg = crest
    ? `<span class="veil"></span><img class="crest" src="images/crests/${side}.png" alt="${esc(title)} crest">`
    : "";
  return `<a class="card glow-${side}${crest ? " has-crest" : ""}" href="#${href}">
      <span class="frame">${cover}${crestImg}</span>
      <span class="name">${esc(title)}</span>
      ${meta ? `<span class="meta">${esc(meta)}</span>` : ""}
    </a>`;
}

function renderHome() {
  document.title = "Family Archive";
  const cards = Object.entries(SIDES).map(([key, side], i) => {
    const photos = collectionsOn(key).flatMap((c) => photosIn(c.code));
    return card(key, side.title, "", coverFor(photos, key + "-cover", i), key, true);
  });
  app.innerHTML = `<section class="home"><div class="cards">${cards.join("")}</div></section>`;
}

function renderSide(key) {
  const side = SIDES[key];
  document.title = `${side.title} · Family Archive`;
  const cards = collectionsOn(key).map((c, i) => {
    const photos = photosIn(c.code);
    return card(c.slug, c.title, `${photos.length} photos`, coverFor(photos, c.code, i), key);
  });
  app.innerHTML = `
    <div class="page-head">
      <h1>${esc(side.title)}</h1>
      <img class="side-crest" src="images/crests/${key}.png" alt="${esc(side.title)} crest">
    </div>
    <div class="cards">${cards.join("") || "<p>No folders yet.</p>"}</div>`;
}

function gridHTML(photos) {
  return `<div class="grid">${photos.map((p, i) => {
    const names = splitList(p.people).map(personName).join(", ");
    const side = collectionByCode(p.collection)?.side || "";
    return `<button class="tile glow-${side}" data-i="${i}">
        <span class="box">${imgTag(p, p.description || p.id)}</span>
        <span class="peek"><b>${esc(p.date || "Date unknown")}</b>${p.event ? " · " + esc(p.event) : ""}<br>${esc(names)}</span>
      </button>`;
  }).join("")}</div>`;
}

function wireGrid(photos) {
  app.querySelectorAll(".tile").forEach((t) =>
    t.addEventListener("click", () => openLightbox(photos, +t.dataset.i)));
}

function renderCollection(c) {
  document.title = `${c.title} · Family Archive`;
  const photos = photosIn(c.code);
  const allSample = photos.length && photos.every((p) => !p.file);
  const order = state.collections;
  const next = order[(order.indexOf(c) + 1) % order.length];
  app.innerHTML = `
    <div class="page-head">
      <div class="crumbs"><a href="#${c.side}">${esc(SIDES[c.side]?.title || c.side)}</a></div>
      <h1>${esc(c.title)}</h1>
      <p>${esc(c.description)}${c.description ? " · " : ""}${photos.length} photos</p>
    </div>
    ${allSample ? `<div class="notice">Under construction. These are stand-in photos until the real scans are added.</div>` : ""}
    ${photos.length ? gridHTML(photos) : `<p class="notice">No photos in this folder yet.</p>`}
    <div class="next-link"><span>Next folder:</span> <a href="#${next.slug}">${esc(next.title)} →</a></div>`;
  wireGrid(photos);
}

function renderPerson(id) {
  const p = state.people.get(id) || { known_as: id };
  const name = p.known_as || p.name || id;
  document.title = `${name} · Family Archive`;
  const photos = visiblePhotos()
    .filter((ph) => splitList(ph.people).includes(id))
    .sort((a, b) => (+a.date_sort || 9999) - (+b.date_sort || 9999));
  const years = p.born || p.died ? `${p.born || "?"}–${p.died || ""}` : "";
  const facts = [p.name && p.name !== name ? p.name : "", p.relation, years].filter(Boolean).join(" · ");
  app.innerHTML = `
    <div class="page-head">
      <div class="crumbs">People</div>
      <h1>${esc(name)}</h1>
      ${facts ? `<p>${esc(facts)}</p>` : ""}
      <p>${photos.length} photo${photos.length === 1 ? "" : "s"}, oldest first</p>
    </div>
    ${gridHTML(photos)}`;
  wireGrid(photos);
}

/* ---------- Lightbox ---------- */

const lb = {
  el: document.getElementById("lightbox"),
  stage: document.getElementById("lb-stage"),
  img: document.getElementById("lb-img"),
  panel: document.getElementById("lb-panel"),
  list: [],
  i: 0,
};

function field(label, value) {
  return value ? `<dt>${label}</dt><dd>${value}</dd>` : "";
}

function showPhoto() {
  const p = lb.list[lb.i];
  lb.stage.classList.remove("zoomed");
  lb.img.src = imageFor(p);
  lb.img.dataset.fallback = placeholder(p.id);
  lb.img.alt = p.description || p.id;

  const c = collectionByCode(p.collection);
  const people = splitList(p.people)
    .map((id) => `<a href="#person-${esc(id)}">${esc(personName(id))}</a>`)
    .join(", ");
  const title = splitList(p.people).map(personName).join(", ") || "Unidentified";

  lb.panel.innerHTML = `
    <h2>${esc(title)}</h2>
    <div class="id">${esc(p.id)} · ${lb.i + 1} of ${lb.list.length}</div>
    <dl>
      ${field("Date", esc(p.date || "Unknown"))}
      ${field("People", people)}
      ${field("Place", esc(p.place))}
      ${field("Event", esc(p.event))}
      ${field("Description", esc(p.description))}
      ${field("Written on the back", p.back_of_photo ? `“${esc(p.back_of_photo)}”` : "")}
      ${field("Tags", esc(splitList(p.tags).join(", ")))}
      ${field("Folder", c ? `<a href="#${c.slug}">${esc(c.title)}</a>` : esc(p.collection))}
    </dl>
    <dl class="record">
      ${field("Information from", esc(p.info_source))}
      ${field("Original file", esc([p.original_file_name, p.original_position && "position " + p.original_position].filter(Boolean).join(", ")))}
    </dl>
    <div class="hint">Click the photo to zoom · ← → to browse · Esc to close</div>`;
}

function openLightbox(list, i) {
  lb.list = list;
  lb.i = i;
  showPhoto();
  lb.el.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  lb.el.hidden = true;
  document.body.style.overflow = "";
}

function step(d) {
  lb.i = (lb.i + d + lb.list.length) % lb.list.length;
  showPhoto();
}

document.getElementById("lb-close").addEventListener("click", closeLightbox);
document.getElementById("lb-prev").addEventListener("click", () => step(-1));
document.getElementById("lb-next").addEventListener("click", () => step(1));
lb.panel.addEventListener("click", (e) => { if (e.target.closest("a")) closeLightbox(); });

lb.img.addEventListener("click", (e) => {
  lb.stage.classList.toggle("zoomed");
  moveZoom(e);
});
function moveZoom(e) {
  if (!lb.stage.classList.contains("zoomed")) return;
  const r = lb.img.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * 100;
  const y = ((e.clientY - r.top) / r.height) * 100;
  lb.img.style.transformOrigin = `${Math.max(0, Math.min(100, x))}% ${Math.max(0, Math.min(100, y))}%`;
}
lb.stage.addEventListener("mousemove", moveZoom);

document.addEventListener("keydown", (e) => {
  if (!lb.el.hidden) {
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  }
});

/* ---------- Router ---------- */

function route() {
  if (!state.ready) return;
  closeLightbox();
  const key = decodeURIComponent(location.hash.slice(1));
  const collection = state.collections.find((c) => c.slug === key);

  if (!key) renderHome();
  else if (SIDES[key]) renderSide(key);
  else if (collection) renderCollection(collection);
  else if (key.startsWith("person-")) renderPerson(key.slice(7));
  else renderHome();

  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", route);

load()
  .then(route)
  .catch((err) => {
    app.innerHTML = `<div class="page-head"><h1>Couldn't load the archive</h1><p>${esc(err.message)}</p>
      <p>If you opened index.html straight from your computer, run it through a local server instead (see README).</p></div>`;
  });
