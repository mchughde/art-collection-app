/* ===================================================
   Impressionist Art Collection — app.js
   =================================================== */

// ===== Constants =====
const STORAGE_KEY = 'impressionist-collection';
const AIC_BASE = 'https://api.artic.edu/api/v1';
const CMA_BASE = 'https://openaccess-api.clevelandart.org/api';
const AIC_FIELDS = 'id,title,artist_title,date_display,date_end,medium_display,image_id,description,department_title';
const PAGE_SIZE = 20;

const ALL_THEMES = [
  'water','light','figures','landscape','garden','flowers',
  'still life','architecture','trees','sky','urban','domestic','movement','atmospheric'
];

const THEME_KEYWORDS = {
  water:        ['water','river','lake','sea','ocean','pond','stream','canal','reflection'],
  light:        ['light','sun','shadow','glow','shimmer','dappled','luminous'],
  figures:      ['figure','woman','man','child','people','crowd','bather','dancer','portrait'],
  landscape:    ['landscape','field','countryside','hill','valley','plain'],
  garden:       ['garden','park','terrace','hedge','flowerbed'],
  flowers:      ['flower','blossom','bouquet','rose','lily','poppy'],
  'still life': ['still life','vase','fruit','bowl','table','bottle'],
  architecture: ['building','cathedral','bridge','street','facade','tower','rooftop'],
  trees:        ['tree','forest','wood','grove','orchard','branch','foliage'],
  sky:          ['sky','cloud','horizon','sunset','dawn','twilight'],
  urban:        ['city','boulevard','café','cafe','market','square','promenade'],
  domestic:     ['interior','room','home','window','fireplace','bedroom'],
  movement:     ['movement','dance','motion','racing','galloping'],
  atmospheric:  ['mist','fog','haze','rain','storm','snow']
};

// ===== State =====
const state = {
  activeTab: 'browse',
  browsePage: 1,
  browseQuery: '',
  browseSource: 'both', // 'both' | 'aic' | 'cma'
  browsePeriod: 'all',
  collection: [],
  collectionFilter: {
    search: '',
    sources: { aic: true, cma: true },
    period: 'all',
    theme: 'all',
    tag: 'all',
    favOnly: false,
    sort: 'dateAdded-desc'
  },
  modal: null
};

// ===== Collection persistence =====
function loadCollection() {
  try { state.collection = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { state.collection = []; }
}
function saveCollection() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.collection));
}
function inCollection(id, source) {
  return state.collection.some(a => a.id === String(id) && a.source === source);
}
function getFromCollection(id, source) {
  return state.collection.find(a => a.id === String(id) && a.source === source) || null;
}

// ===== Period assignment =====
const ALL_PERIODS = [
  'Pre-Impressionism',
  'Early Impressionism',
  'High Impressionism',
  'Post-Impressionism',
  'Fauvism',
  'Cubism',
  'Early Modern',
  'Other / Unknown'
];

// Date ranges for server-side filtering (inclusive). Other / Unknown has no range.
const PERIOD_RANGES = {
  'Pre-Impressionism':   { gte: 1820, lte: 1859 },
  'Early Impressionism': { gte: 1860, lte: 1879 },
  'High Impressionism':  { gte: 1880, lte: 1885 },
  'Post-Impressionism':  { gte: 1886, lte: 1899 },
  'Fauvism':             { gte: 1900, lte: 1907 },
  'Cubism':              { gte: 1908, lte: 1920 },
  'Early Modern':        { gte: 1921, lte: 1940 },
};

function assignPeriod(year) {
  if (!year || isNaN(year)) return 'Other / Unknown';
  year = Number(year);
  if (year < 1860) return 'Pre-Impressionism';
  if (year <= 1879) return 'Early Impressionism';
  if (year <= 1885) return 'High Impressionism';
  if (year <= 1899) return 'Post-Impressionism';
  if (year <= 1907) return 'Fauvism';
  if (year <= 1920) return 'Cubism';
  if (year <= 1940) return 'Early Modern';
  return 'Other / Unknown';
}

// ===== Theme detection =====
function detectThemes(text) {
  const lower = (text || '').toLowerCase();
  return ALL_THEMES.filter(theme =>
    THEME_KEYWORDS[theme].some(kw => lower.includes(kw))
  );
}

// ===== AIC helpers =====
function aicImageUrl(imageId) {
  if (!imageId) return '';
  return `https://www.artic.edu/iiif/2/${imageId}/full/400,/0/default.jpg`;
}

function normalizeAic(raw) {
  const year = raw.date_end ? parseInt(raw.date_end) : null;
  const textBlob = [raw.title, raw.medium_display, raw.description].filter(Boolean).join(' ');
  return {
    id: String(raw.id),
    source: 'aic',
    title: raw.title || 'Untitled',
    artist: raw.artist_title || 'Unknown artist',
    date: raw.date_display || '',
    period: assignPeriod(year),
    medium: raw.medium_display || '',
    imageUrl: aicImageUrl(raw.image_id),
    description: raw.description || '',
    themes: detectThemes(textBlob),
    customTags: [],
    notes: '',
    isFavorite: false,
    dateAdded: new Date().toISOString()
  };
}

function normalizeCma(raw) {
  const dateStr = raw.creation_date || '';
  const yearMatch = dateStr.match(/\d{4}/g);
  const year = yearMatch ? parseInt(yearMatch[yearMatch.length - 1]) : null;
  const artist = raw.creators && raw.creators[0]
    ? raw.creators[0].description || raw.creators[0].name || 'Unknown artist'
    : 'Unknown artist';
  const imageUrl = raw.images && raw.images.web ? raw.images.web.url || '' : '';
  const textBlob = [raw.title, raw.technique, raw.description].filter(Boolean).join(' ');
  return {
    id: String(raw.id),
    source: 'cma',
    title: raw.title || 'Untitled',
    artist,
    date: dateStr,
    period: assignPeriod(year),
    medium: raw.technique || '',
    imageUrl,
    description: raw.description || '',
    themes: detectThemes(textBlob),
    customTags: [],
    notes: '',
    isFavorite: false,
    dateAdded: new Date().toISOString()
  };
}

// ===== API calls =====
async function fetchAic(page, query, limit = PAGE_SIZE, dateRange = null) {
  let res;
  if (dateRange) {
    const filters = [
      { exists: { field: 'image_id' } },
      { range: { date_end: { gte: dateRange.gte, lte: dateRange.lte } } }
    ];
    const body = { query: { bool: { filter: filters } }, fields: AIC_FIELDS.split(','), limit, page };
    if (query) body.q = query;
    res = await fetch(`${AIC_BASE}/artworks/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } else {
    const q = query || 'impressionism painting';
    const params = new URLSearchParams({ q, fields: AIC_FIELDS, limit, page });
    res = await fetch(`${AIC_BASE}/artworks/search?${params}`);
  }
  if (!res.ok) throw new Error('AIC API error');
  const json = await res.json();
  const artworks = (json.data || []).filter(a =>
    a.image_id &&
    a.department_title &&
    /paint|print|drawing|americas|graphic/i.test(a.department_title)
  );
  return {
    artworks: artworks.map(normalizeAic),
    totalPages: json.pagination ? Math.ceil(json.pagination.total / limit) : 1
  };
}

async function fetchCma(page, query, limit = PAGE_SIZE, dateRange = null) {
  const skip = (page - 1) * limit;
  const params = new URLSearchParams({ type: 'Painting', has_image: '1', limit, skip });
  if (query) params.set('q', query);
  if (dateRange) {
    // CMA created_after/created_before are exclusive, so offset by 1
    params.set('created_after', dateRange.gte - 1);
    params.set('created_before', dateRange.lte + 1);
  }
  const res = await fetch(`${CMA_BASE}/artworks/?${params}`);
  if (!res.ok) throw new Error('CMA API error');
  const json = await res.json();
  const artworks = (json.data || []).filter(a => a.images && a.images.web && a.images.web.url);
  const total = json.info ? json.info.total : artworks.length;
  return {
    artworks: artworks.map(normalizeCma),
    totalPages: Math.ceil(total / limit)
  };
}

// ===== Service worker image caching =====
function cacheImage(url) {
  if (!url || !('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;
  navigator.serviceWorker.controller.postMessage({ type: 'CACHE_IMAGE', url });
}

// ===== Debounce =====
function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// ===== Online check =====
function isOnline() { return navigator.onLine; }

// ===== Render helpers =====
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('data-')) node.dataset[k.slice(5)] = v;
    else if (k === 'aria-label') node.setAttribute('aria-label', v);
    else if (k === 'role') node.setAttribute('role', v);
    else node[k] = v;
  }
  for (const child of children) {
    if (child == null) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ===== Card rendering =====
function makeCard(artwork, inCol) {
  const card = el('article', { class: 'artwork-card', role: 'button', tabindex: '0', 'aria-label': artwork.title });
  card.addEventListener('click', () => openModal(artwork, inCol));
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openModal(artwork, inCol); });

  const imgWrap = el('div', { class: 'card-image-wrap' });
  const img = el('img', { alt: artwork.title, loading: 'lazy' });
  img.src = artwork.imageUrl || '';
  img.onerror = () => { img.src = ''; img.style.display = 'none'; };
  imgWrap.appendChild(img);

  if (inCol) {
    const favBtn = el('button', {
      class: `card-fav${artwork.isFavorite ? ' is-fav' : ''}`,
      'aria-label': artwork.isFavorite ? 'Remove from favourites' : 'Add to favourites'
    }, artwork.isFavorite ? '♥' : '♡');
    favBtn.addEventListener('click', e => {
      e.stopPropagation();
      toggleFav(artwork.id, artwork.source);
    });
    imgWrap.appendChild(favBtn);
  }

  const body = el('div', { class: 'card-body' });
  body.appendChild(el('p', { class: 'card-title' }, artwork.title));
  body.appendChild(el('p', { class: 'card-artist' }, artwork.artist));
  if (artwork.date) body.appendChild(el('p', { class: 'card-date' }, artwork.date));
  const metaRow = el('div', { class: 'card-meta-row' });
  if (artwork.period) metaRow.appendChild(el('span', { class: 'card-period' }, artwork.period));
  metaRow.appendChild(el('span', { class: 'card-source' }, artwork.source === 'aic' ? 'AIC' : 'CMA'));
  body.appendChild(metaRow);

  card.appendChild(imgWrap);
  card.appendChild(body);
  return card;
}

function toggleFav(id, source) {
  const artwork = getFromCollection(id, source);
  if (!artwork) return;
  artwork.isFavorite = !artwork.isFavorite;
  saveCollection();
  if (state.activeTab === 'collection') renderCollection();
}

// ===== Periods used in collection =====
function getUsedPeriods() {
  const s = new Set(state.collection.map(a => a.period));
  return Array.from(s).sort();
}

function getUsedTags() {
  const all = state.collection.flatMap(a => a.customTags || []);
  return Array.from(new Set(all)).sort();
}

// ===== Browse tab rendering (combined AIC + CMA) =====
async function renderBrowse() {
  const main = document.getElementById('main-content');
  main.innerHTML = '';

  if (!isOnline()) {
    main.appendChild(el('div', { class: 'offline-banner' }, '⚡ You are offline — browsing is unavailable. Your saved collection is still accessible.'));
    return;
  }

  // Search bar
  const searchWrap = el('div', { class: 'search-bar' });
  const inputWrap = el('div', { class: 'search-input-wrap' });
  inputWrap.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>`;
  const searchInput = el('input', {
    type: 'search',
    placeholder: 'Search artworks…',
    value: state.browseQuery,
    'aria-label': 'Search artworks'
  });
  function doSearch() {
    state.browseQuery = searchInput.value;
    state.browsePage = 1;
    renderBrowse();
  }
  searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  inputWrap.appendChild(searchInput);
  const searchBtn = el('button', { class: 'search-go-btn', 'aria-label': 'Search' }, 'Go');
  searchBtn.addEventListener('click', doSearch);
  inputWrap.appendChild(searchBtn);
  searchWrap.appendChild(inputWrap);
  main.appendChild(searchWrap);

  // Filter dropdowns row
  const filterRow = el('div', { class: 'browse-dropdowns' });

  const srcSel = el('select', { 'aria-label': 'Filter by museum' });
  for (const [val, label] of [['both','All museums'],['aic','Art Institute of Chicago'],['cma','Cleveland Museum of Art']]) {
    const opt = el('option', { value: val }, label);
    if (state.browseSource === val) opt.selected = true;
    srcSel.appendChild(opt);
  }
  srcSel.addEventListener('change', () => {
    state.browseSource = srcSel.value;
    state.browsePage = 1;
    renderBrowse();
  });
  filterRow.appendChild(srcSel);

  const BROWSE_PERIODS = ALL_PERIODS;
  const periodSel = el('select', { 'aria-label': 'Filter by period' });
  for (const p of ['all', ...BROWSE_PERIODS]) {
    const opt = el('option', { value: p }, p === 'all' ? 'All periods' : p);
    if (state.browsePeriod === p) opt.selected = true;
    periodSel.appendChild(opt);
  }
  periodSel.addEventListener('change', () => {
    state.browsePeriod = periodSel.value;
    state.browsePage = 1;
    renderBrowse();
  });
  filterRow.appendChild(periodSel);

  main.appendChild(filterRow);

  // Loading
  const loadingEl = el('div', { class: 'loading' });
  loadingEl.innerHTML = '<div class="spinner"></div><p>Loading artworks…</p>';
  main.appendChild(loadingEl);

  const CLIENT_PAGE_SIZE = 12;

  try {
    const query = state.browseQuery;
    const periodActive = state.browsePeriod !== 'all';
    let artworks = [], totalPages = 1;

    if (periodActive) {
      const range = PERIOD_RANGES[state.browsePeriod] || null;
      const page = state.browsePage;

      if (range) {
        // Server-side date range filtering — full collection pagination
        if (state.browseSource === 'aic') {
          const r = await fetchAic(page, query, PAGE_SIZE, range);
          artworks = r.artworks; totalPages = r.totalPages;
        } else if (state.browseSource === 'cma') {
          const r = await fetchCma(page, query, PAGE_SIZE, range);
          artworks = r.artworks; totalPages = r.totalPages;
        } else {
          const [aicR, cmaR] = await Promise.allSettled([
            fetchAic(page, query, PAGE_SIZE, range),
            fetchCma(page, query, PAGE_SIZE, range)
          ]);
          const aicArt = aicR.status === 'fulfilled' ? aicR.value.artworks : [];
          const cmaArt = cmaR.status === 'fulfilled' ? cmaR.value.artworks : [];
          const aicPages = aicR.status === 'fulfilled' ? aicR.value.totalPages : 1;
          const cmaPages = cmaR.status === 'fulfilled' ? cmaR.value.totalPages : 1;
          const len = Math.max(aicArt.length, cmaArt.length);
          for (let i = 0; i < len; i++) {
            if (i < aicArt.length) artworks.push(aicArt[i]);
            if (i < cmaArt.length) artworks.push(cmaArt[i]);
          }
          totalPages = Math.max(aicPages, cmaPages);
        }
      } else {
        // Other / Unknown — no date or post-1940: fetch a batch and filter client-side
        const BATCH = 100;
        const CLIENT_PAGE_SIZE = 12;
        let raw = [];
        if (state.browseSource === 'aic') {
          raw = (await fetchAic(1, query, BATCH)).artworks;
        } else if (state.browseSource === 'cma') {
          raw = (await fetchCma(1, query, BATCH)).artworks;
        } else {
          const [aicR, cmaR] = await Promise.allSettled([fetchAic(1, query, BATCH), fetchCma(1, query, BATCH)]);
          const aicArt = aicR.status === 'fulfilled' ? aicR.value.artworks : [];
          const cmaArt = cmaR.status === 'fulfilled' ? cmaR.value.artworks : [];
          const len = Math.max(aicArt.length, cmaArt.length);
          for (let i = 0; i < len; i++) {
            if (i < aicArt.length) raw.push(aicArt[i]);
            if (i < cmaArt.length) raw.push(cmaArt[i]);
          }
        }
        raw = raw.filter(a => a.period === 'Other / Unknown');
        totalPages = Math.max(1, Math.ceil(raw.length / CLIENT_PAGE_SIZE));
        if (state.browsePage > totalPages) state.browsePage = 1;
        const start = (state.browsePage - 1) * CLIENT_PAGE_SIZE;
        artworks = raw.slice(start, start + CLIENT_PAGE_SIZE);
      }
    } else {
      // "All periods" — use the same date-range mechanism as individual periods,
      // spanning 1820 onwards so the total is the true union of all period buckets.
      const allRange = { gte: 1820, lte: 1940 };
      const page = state.browsePage;
      if (state.browseSource === 'aic') {
        const r = await fetchAic(page, query, PAGE_SIZE, allRange);
        artworks = r.artworks; totalPages = r.totalPages;
      } else if (state.browseSource === 'cma') {
        const r = await fetchCma(page, query, PAGE_SIZE, allRange);
        artworks = r.artworks; totalPages = r.totalPages;
      } else {
        const [aicR, cmaR] = await Promise.allSettled([
          fetchAic(page, query, PAGE_SIZE, allRange),
          fetchCma(page, query, PAGE_SIZE, allRange)
        ]);
        const aicArt = aicR.status === 'fulfilled' ? aicR.value.artworks : [];
        const cmaArt = cmaR.status === 'fulfilled' ? cmaR.value.artworks : [];
        const aicPages = aicR.status === 'fulfilled' ? aicR.value.totalPages : 1;
        const cmaPages = cmaR.status === 'fulfilled' ? cmaR.value.totalPages : 1;
        const len = Math.max(aicArt.length, cmaArt.length);
        for (let i = 0; i < len; i++) {
          if (i < aicArt.length) artworks.push(aicArt[i]);
          if (i < cmaArt.length) artworks.push(cmaArt[i]);
        }
        totalPages = Math.max(aicPages, cmaPages);
      }
    }

    loadingEl.remove();

    if (!artworks.length) {
      main.appendChild(makeEmptyState('No artworks found', 'Try a different search term, period, or source.'));
      return;
    }

    const grid = el('div', { class: 'artwork-grid', role: 'list' });
    for (const artwork of artworks) {
      grid.appendChild(makeCard(artwork, false));
    }
    main.appendChild(grid);

    const page = state.browsePage;
    if (totalPages > 1) {
      const pg = el('div', { class: 'pagination' });
      const prevBtn = el('button', {}, '← Previous');
      prevBtn.disabled = page <= 1;
      prevBtn.addEventListener('click', () => { state.browsePage--; renderBrowse(); });
      const nextBtn = el('button', {}, 'Next →');
      nextBtn.disabled = page >= totalPages;
      nextBtn.addEventListener('click', () => { state.browsePage++; renderBrowse(); });
      pg.appendChild(prevBtn);
      pg.appendChild(el('span', { class: 'page-info' }, `Page ${page} of ${totalPages}`));
      pg.appendChild(nextBtn);
      main.appendChild(pg);
    }
  } catch (err) {
    loadingEl.remove();
    main.appendChild(el('div', { class: 'offline-banner' }, `Failed to load artworks — ${isOnline() ? 'API error. Please try again.' : 'you appear to be offline.'}`));
  }
}

// ===== Collection rendering =====
function renderCollection() {
  const main = document.getElementById('main-content');
  main.innerHTML = '';

  // Search bar
  const searchWrap = el('div', { class: 'search-bar' });
  const inputWrap = el('div', { class: 'search-input-wrap' });
  inputWrap.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>`;
  const searchInput = el('input', {
    type: 'search',
    placeholder: 'Search by title, artist, period, theme, source…',
    value: state.collectionFilter.search,
    'aria-label': 'Search collection'
  });
  function doColSearch() {
    state.collectionFilter.search = searchInput.value;
    renderCollection();
  }
  searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doColSearch(); });
  inputWrap.appendChild(searchInput);
  const searchBtn = el('button', { class: 'search-go-btn', 'aria-label': 'Search' }, 'Go');
  searchBtn.addEventListener('click', doColSearch);
  inputWrap.appendChild(searchBtn);
  searchWrap.appendChild(inputWrap);
  main.appendChild(searchWrap);

  // Filter bar
  main.appendChild(buildFilterBar());

  if (!state.collection.length) {
    main.appendChild(makeEmptyState('Your collection is empty', 'Browse the AIC or CMA tabs and add artworks you love.'));
    return;
  }

  const filtered = applyFilters(state.collection);

  if (!filtered.length) {
    main.appendChild(makeEmptyState('No results', 'Try adjusting your filters or search terms.'));
    return;
  }

  const grid = el('div', { class: 'artwork-grid', role: 'list' });
  for (const artwork of filtered) {
    grid.appendChild(makeCard(artwork, true));
  }
  main.appendChild(grid);
}

function buildFilterBar() {
  const bar = el('div', { class: 'filter-bar' });

  // Filter dropdowns row
  const dropRow = el('div', { class: 'browse-dropdowns' });

  const srcSel = el('select', { 'aria-label': 'Filter by museum' });
  for (const [val, label] of [['all','All museums'],['aic','Art Institute of Chicago'],['cma','Cleveland Museum of Art']]) {
    const opt = el('option', { value: val }, label);
    const current = state.collectionFilter.sources.aic && state.collectionFilter.sources.cma ? 'all'
      : state.collectionFilter.sources.aic ? 'aic' : 'cma';
    if (current === val) opt.selected = true;
    srcSel.appendChild(opt);
  }
  srcSel.addEventListener('change', () => {
    state.collectionFilter.sources.aic = srcSel.value === 'all' || srcSel.value === 'aic';
    state.collectionFilter.sources.cma = srcSel.value === 'all' || srcSel.value === 'cma';
    renderCollection();
  });
  dropRow.appendChild(srcSel);

  const usedPeriods = getUsedPeriods();
  const periodSel = el('select', { 'aria-label': 'Filter by period' });
  for (const p of ['all', ...usedPeriods]) {
    const opt = el('option', { value: p }, p === 'all' ? 'All periods' : p);
    if (state.collectionFilter.period === p) opt.selected = true;
    periodSel.appendChild(opt);
  }
  periodSel.addEventListener('change', () => {
    state.collectionFilter.period = periodSel.value;
    renderCollection();
  });
  dropRow.appendChild(periodSel);

  bar.appendChild(dropRow);

  // Themes dropdown
  const usedThemes = Array.from(new Set(state.collection.flatMap(a => a.themes))).sort();
  if (usedThemes.length) {
    const themeSel = el('select', { 'aria-label': 'Filter by theme' });
    for (const t of ['all', ...usedThemes]) {
      const opt = el('option', { value: t }, t === 'all' ? 'All themes' : t);
      if (state.collectionFilter.theme === t) opt.selected = true;
      themeSel.appendChild(opt);
    }
    themeSel.addEventListener('change', () => {
      state.collectionFilter.theme = themeSel.value;
      renderCollection();
    });
    dropRow.appendChild(themeSel);
  }

  // Tags dropdown
  const usedTags = getUsedTags();
  if (usedTags.length) {
    const tagSel = el('select', { 'aria-label': 'Filter by tag' });
    for (const t of ['all', ...usedTags]) {
      const opt = el('option', { value: t }, t === 'all' ? 'All tags' : t);
      if (state.collectionFilter.tag === t) opt.selected = true;
      tagSel.appendChild(opt);
    }
    tagSel.addEventListener('change', () => {
      state.collectionFilter.tag = tagSel.value;
      renderCollection();
    });
    dropRow.appendChild(tagSel);
  }

  // Sort — right-justified in the same row as the other dropdowns
  const sortLabel = el('span', { style: 'margin-left:auto; font-size:0.82rem; color:var(--text-mid); white-space:nowrap; align-self:center' }, 'Sort:');
  dropRow.appendChild(sortLabel);
  const sortSel = el('select', { 'aria-label': 'Sort collection' });
  const sortOptions = [
    ['dateAdded-desc', 'Date added (newest)'],
    ['dateAdded-asc', 'Date added (oldest)'],
    ['artist-asc', 'Artist A–Z'],
    ['artworkDate-asc', 'Artwork date (oldest)'],
    ['artworkDate-desc', 'Artwork date (newest)'],
    ['source-asc', 'Source'],
    ['fav-first', 'Favourites first']
  ];
  for (const [val, label] of sortOptions) {
    const opt = el('option', { value: val }, label);
    if (val === state.collectionFilter.sort) opt.selected = true;
    sortSel.appendChild(opt);
  }
  sortSel.addEventListener('change', () => {
    state.collectionFilter.sort = sortSel.value;
    renderCollection();
  });
  dropRow.appendChild(sortSel);
  bar.appendChild(dropRow);

  // Favourites toggle — second row, left-aligned
  const favRow = el('div', { class: 'fav-row' });
  const favBtn = el('button', {
    class: `fav-toggle${state.collectionFilter.favOnly ? ' active' : ''}`,
    'aria-pressed': String(state.collectionFilter.favOnly)
  }, '♥ Favourites only');
  favBtn.addEventListener('click', () => {
    state.collectionFilter.favOnly = !state.collectionFilter.favOnly;
    renderCollection();
  });
  favRow.appendChild(favBtn);
  bar.appendChild(favRow);

  return bar;
}

function applyFilters(artworks) {
  const f = state.collectionFilter;
  let result = artworks.filter(a => {
    if (!f.sources[a.source]) return false;
    if (f.period !== 'all' && a.period !== f.period) return false;
    if (f.theme !== 'all' && !(a.themes || []).includes(f.theme)) return false;
    if (f.tag !== 'all' && !(a.customTags || []).includes(f.tag)) return false;
    if (f.favOnly && !a.isFavorite) return false;
    if (f.search) {
      const q = f.search.toLowerCase();
      const sourceName = a.source === 'aic' ? 'art institute of chicago aic' : 'cleveland museum of art cma';
      const searchable = [a.title, a.artist, a.period, a.medium, sourceName, ...(a.themes || []), ...(a.customTags || [])].join(' ').toLowerCase();
      if (!searchable.includes(q)) return false;
    }
    return true;
  });

  result = sortArtworks(result, f.sort);
  return result;
}

function sortArtworks(arr, sort) {
  return [...arr].sort((a, b) => {
    switch (sort) {
      case 'dateAdded-desc': return new Date(b.dateAdded) - new Date(a.dateAdded);
      case 'dateAdded-asc':  return new Date(a.dateAdded) - new Date(b.dateAdded);
      case 'artist-asc':     return a.artist.localeCompare(b.artist);
      case 'artworkDate-asc':  return extractYear(a.date) - extractYear(b.date);
      case 'artworkDate-desc': return extractYear(b.date) - extractYear(a.date);
      case 'source-asc':     return a.source.localeCompare(b.source);
      case 'fav-first':      return (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0);
      default: return 0;
    }
  });
}

function extractYear(dateStr) {
  if (!dateStr) return 9999;
  const m = dateStr.match(/\d{4}/);
  return m ? parseInt(m[0]) : 9999;
}

function makeEmptyState(title, text) {
  const div = el('div', { class: 'empty-state' });
  div.innerHTML = `<div class="icon">🎨</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p>`;
  return div;
}

// ===== Modals =====
function closeModal() {
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
  state.modal = null;
}

function openModal(artwork, inCol) {
  closeModal();
  const saved = inCol ? getFromCollection(artwork.id, artwork.source) : null;
  const displayArtwork = saved || artwork;
  const isInCol = !!saved || inCollection(artwork.id, artwork.source);

  const backdrop = el('div', { class: 'modal-backdrop', id: 'modal-backdrop' });
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });

  const modal = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': displayArtwork.title });

  // Header
  const hdr = el('div', { class: 'modal-header' });
  hdr.appendChild(el('h2', {}, displayArtwork.title));
  const closeBtn = el('button', { class: 'modal-close', 'aria-label': 'Close' }, '×');
  closeBtn.addEventListener('click', closeModal);
  hdr.appendChild(closeBtn);
  modal.appendChild(hdr);

  // Body
  const body = el('div', { class: 'modal-body' });

  if (displayArtwork.imageUrl) {
    const imgWrap = el('div', { class: 'modal-image-wrap', 'aria-label': 'View full screen', role: 'button', tabindex: '0' });
    const img = el('img', { class: 'modal-image', alt: displayArtwork.title });
    img.src = displayArtwork.imageUrl;
    img.onerror = () => imgWrap.remove();
    imgWrap.appendChild(img);
    imgWrap.appendChild(el('span', { class: 'modal-image-hint' }, '⛶ Full screen'));
    imgWrap.addEventListener('click', () => openLightbox(displayArtwork));
    imgWrap.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openLightbox(displayArtwork); });
    body.appendChild(imgWrap);
  }

  const meta = el('div', { class: 'artwork-meta' });
  const rows = [
    ['Artist', displayArtwork.artist],
    ['Date', displayArtwork.date],
    ['Medium', displayArtwork.medium],
    ['Period', displayArtwork.period],
    ['Source', displayArtwork.source === 'aic' ? 'Art Institute of Chicago' : 'Cleveland Museum of Art']
  ];
  for (const [label, val] of rows) {
    if (!val) continue;
    const row = el('p', { class: 'meta-row' });
    row.innerHTML = `<span class="meta-label">${escapeHtml(label)}:</span> ${escapeHtml(val)}`;
    meta.appendChild(row);
  }
  body.appendChild(meta);

  if (isInCol && displayArtwork.themes && displayArtwork.themes.length) {
    const thRow = el('div', { class: 'filter-row' });
    thRow.style.flexWrap = 'wrap';
    thRow.style.gap = '0.35rem';
    for (const t of displayArtwork.themes) {
      thRow.appendChild(el('span', { class: 'pill active' }, t));
    }
    body.appendChild(thRow);
  }

  // In-collection badge
  if (isInCol) {
    body.appendChild(el('div', { class: 'in-collection-badge' }, '✓ In your collection'));
  }

  // Description
  if (displayArtwork.description) {
    const desc = el('div', { class: 'description-block' });
    const sourceName = displayArtwork.source === 'aic' ? 'AIC' : 'CMA';
    const labelDiv = el('div', { class: 'block-label' }, `About this work — From ${sourceName}`);
    const textDiv = el('div', {});
    // API returns HTML; sanitize by only allowing safe tags
    textDiv.innerHTML = displayArtwork.description
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<(?!\/?(?:p|em|strong|b|i|br|ul|ol|li|a)\b)[^>]+>/gi, '');
    desc.appendChild(labelDiv);
    desc.appendChild(textDiv);
    body.appendChild(desc);
  }

  // Notes (view mode — only if notes exist)
  if (isInCol && displayArtwork.notes) {
    const notesBlock = el('div', { class: 'notes-block' });
    notesBlock.innerHTML = `<div class="block-label">My Notes</div><p>${escapeHtml(displayArtwork.notes)}</p>`;
    body.appendChild(notesBlock);
  }

  modal.appendChild(body);

  // Actions
  const actions = el('div', { class: 'modal-actions' });

  if (isInCol) {
    const removeBtn = el('button', { class: 'btn-remove' }, 'Remove from collection');
    removeBtn.addEventListener('click', () => {
      if (confirm(`Remove "${displayArtwork.title}" from your collection?`)) {
        state.collection = state.collection.filter(a => !(a.id === displayArtwork.id && a.source === displayArtwork.source));
        saveCollection();
        closeModal();
        if (state.activeTab === 'collection') renderCollection();
      }
    });
    actions.appendChild(removeBtn);

    const editBtn = el('button', { class: 'btn-save' }, 'Edit');
    editBtn.addEventListener('click', () => openEditModal(displayArtwork));
    actions.appendChild(editBtn);
  } else {
    const cancelBtn = el('button', { class: 'btn-cancel' }, 'Close');
    cancelBtn.addEventListener('click', closeModal);
    actions.appendChild(cancelBtn);

    const addBtn = el('button', { class: 'btn-add' }, '+ Add to collection');
    addBtn.addEventListener('click', () => openAddModal(artwork));
    actions.appendChild(addBtn);
  }

  modal.appendChild(actions);
  backdrop.appendChild(modal);
  document.getElementById('modal-root').appendChild(backdrop);
  modal.focus();
}

// ===== Add Modal =====
function openAddModal(artwork) {
  closeModal();

  const backdrop = el('div', { class: 'modal-backdrop', id: 'modal-backdrop' });
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });

  const modal = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' });

  const hdr = el('div', { class: 'modal-header' });
  hdr.appendChild(el('h2', {}, 'Add to Collection'));
  const closeBtn = el('button', { class: 'modal-close', 'aria-label': 'Close' }, '×');
  closeBtn.addEventListener('click', closeModal);
  hdr.appendChild(closeBtn);
  modal.appendChild(hdr);

  const body = el('div', { class: 'modal-body' });

  // Title / artist (read-only info)
  const info = el('div', { class: 'artwork-meta' });
  info.innerHTML = `<p class="meta-row"><span class="meta-label">Title:</span> ${escapeHtml(artwork.title)}</p><p class="meta-row"><span class="meta-label">Artist:</span> ${escapeHtml(artwork.artist)}</p>`;
  body.appendChild(info);

  // Period selector
  const periodField = el('div', { class: 'form-field' });
  periodField.appendChild(el('label', {}, 'Period'));
  const periodSel = el('select', { 'aria-label': 'Period' });
  const periodOptions = ALL_PERIODS;
  for (const p of periodOptions) {
    const opt = el('option', { value: p }, p);
    if (p === artwork.period) opt.selected = true;
    periodSel.appendChild(opt);
  }
  periodField.appendChild(periodSel);
  body.appendChild(periodField);

  // Themes
  const themeField = el('div', { class: 'form-field' });
  themeField.appendChild(el('label', {}, 'Themes'));
  const themeWrap = el('div', { class: 'theme-pills-edit' });
  let selectedThemes = [...artwork.themes];
  const themePills = {};
  for (const theme of ALL_THEMES) {
    const pill = el('button', {
      class: `theme-pill-toggle${selectedThemes.includes(theme) ? ' selected' : ''}`
    }, theme);
    pill.addEventListener('click', () => {
      const idx = selectedThemes.indexOf(theme);
      if (idx === -1) { selectedThemes.push(theme); pill.classList.add('selected'); }
      else { selectedThemes.splice(idx, 1); pill.classList.remove('selected'); }
    });
    themePills[theme] = pill;
    themeWrap.appendChild(pill);
  }
  themeField.appendChild(themeWrap);
  body.appendChild(themeField);

  // Custom tags
  const tagField = el('div', { class: 'form-field' });
  tagField.appendChild(el('label', {}, 'Custom tags (optional — press Enter or comma to add)'));
  const { tagArea, getCustomTags } = buildTagInput([]);
  tagField.appendChild(tagArea);
  body.appendChild(tagField);

  // Notes
  const notesField = el('div', { class: 'form-field' });
  notesField.appendChild(el('label', {}, 'My notes (optional)'));
  const notesArea = el('textarea', { placeholder: 'Personal observations, where you saw this, why you love it…' });
  notesField.appendChild(notesArea);
  body.appendChild(notesField);

  // Favourite
  const favRow = el('div', { class: 'fav-row' });
  let isFav = false;
  const heartBtn = el('button', { class: 'heart-toggle', 'aria-label': 'Mark as favourite' }, '♡');
  heartBtn.addEventListener('click', () => {
    isFav = !isFav;
    heartBtn.textContent = isFav ? '♥' : '♡';
    heartBtn.classList.toggle('active', isFav);
  });
  favRow.appendChild(heartBtn);
  favRow.appendChild(el('label', {}, 'Mark as favourite'));
  body.appendChild(favRow);

  modal.appendChild(body);

  const actions = el('div', { class: 'modal-actions' });
  const cancelBtn = el('button', { class: 'btn-cancel' }, 'Cancel');
  cancelBtn.addEventListener('click', closeModal);
  actions.appendChild(cancelBtn);

  const confirmBtn = el('button', { class: 'btn-add' }, 'Add to collection');
  confirmBtn.addEventListener('click', () => {
    if (confirmBtn.disabled) return;
    confirmBtn.disabled = true;
    // Guard against duplicate adds
    if (inCollection(artwork.id, artwork.source)) { closeModal(); return; }
    const newArtwork = {
      ...artwork,
      period: periodSel.value,
      themes: selectedThemes,
      customTags: getCustomTags(),
      notes: notesArea.value.trim(),
      isFavorite: isFav,
      dateAdded: new Date().toISOString()
    };
    state.collection.unshift(newArtwork);
    saveCollection();
    cacheImage(newArtwork.imageUrl);
    closeModal();
    if (state.activeTab === 'collection') renderCollection();
  });
  actions.appendChild(confirmBtn);

  modal.appendChild(actions);
  backdrop.appendChild(modal);
  document.getElementById('modal-root').appendChild(backdrop);
}

// ===== Edit Modal =====
function openEditModal(artwork) {
  closeModal();

  const backdrop = el('div', { class: 'modal-backdrop', id: 'modal-backdrop' });
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });

  const modal = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' });

  const hdr = el('div', { class: 'modal-header' });
  hdr.appendChild(el('h2', {}, artwork.title));
  const closeBtn = el('button', { class: 'modal-close', 'aria-label': 'Close' }, '×');
  closeBtn.addEventListener('click', closeModal);
  hdr.appendChild(closeBtn);
  modal.appendChild(hdr);

  const body = el('div', { class: 'modal-body' });

  const meta = el('div', { class: 'artwork-meta' });
  meta.innerHTML = `<p class="meta-row"><span class="meta-label">Artist:</span> ${escapeHtml(artwork.artist)}</p><p class="meta-row"><span class="meta-label">Date:</span> ${escapeHtml(artwork.date)}</p>`;
  body.appendChild(meta);

  // Description (read-only, only if exists)
  if (artwork.description) {
    const sourceName = artwork.source === 'aic' ? 'AIC' : 'CMA';
    const desc = el('div', { class: 'description-block' });
    const labelDiv = el('div', { class: 'block-label' }, `About this work — From ${sourceName}`);
    const textDiv = el('div', {});
    textDiv.innerHTML = artwork.description
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<(?!\/?(?:p|em|strong|b|i|br|ul|ol|li|a)\b)[^>]+>/gi, '');
    desc.appendChild(labelDiv);
    desc.appendChild(textDiv);
    body.appendChild(desc);
  }

  // Period
  const periodField = el('div', { class: 'form-field' });
  periodField.appendChild(el('label', {}, 'Period'));
  const periodSel = el('select', { 'aria-label': 'Period' });
  const periodOptions = ALL_PERIODS;
  for (const p of periodOptions) {
    const opt = el('option', { value: p }, p);
    if (p === artwork.period) opt.selected = true;
    periodSel.appendChild(opt);
  }
  periodField.appendChild(periodSel);
  body.appendChild(periodField);

  // Themes
  const themeField = el('div', { class: 'form-field' });
  themeField.appendChild(el('label', {}, 'Themes'));
  const themeWrap = el('div', { class: 'theme-pills-edit' });
  let selectedThemes = [...(artwork.themes || [])];
  for (const theme of ALL_THEMES) {
    const pill = el('button', {
      class: `theme-pill-toggle${selectedThemes.includes(theme) ? ' selected' : ''}`
    }, theme);
    pill.addEventListener('click', () => {
      const idx = selectedThemes.indexOf(theme);
      if (idx === -1) { selectedThemes.push(theme); pill.classList.add('selected'); }
      else { selectedThemes.splice(idx, 1); pill.classList.remove('selected'); }
    });
    themeWrap.appendChild(pill);
  }
  themeField.appendChild(themeWrap);
  body.appendChild(themeField);

  // Custom tags
  const tagField = el('div', { class: 'form-field' });
  tagField.appendChild(el('label', {}, 'Custom tags'));
  const { tagArea, getCustomTags } = buildTagInput(artwork.customTags || []);
  tagField.appendChild(tagArea);
  body.appendChild(tagField);

  // Favourite
  const favRow = el('div', { class: 'fav-row' });
  let isFav = artwork.isFavorite;
  const heartBtn = el('button', {
    class: `heart-toggle${isFav ? ' active' : ''}`,
    'aria-label': 'Mark as favourite'
  }, isFav ? '♥' : '♡');
  heartBtn.addEventListener('click', () => {
    isFav = !isFav;
    heartBtn.textContent = isFav ? '♥' : '♡';
    heartBtn.classList.toggle('active', isFav);
  });
  favRow.appendChild(heartBtn);
  favRow.appendChild(el('label', {}, 'Favourite'));
  body.appendChild(favRow);

  // Notes
  const notesField = el('div', { class: 'form-field' });
  notesField.appendChild(el('label', {}, 'My Notes'));

  if (artwork.notes) {
    const notesArea = el('textarea', {});
    notesArea.value = artwork.notes;
    notesField.appendChild(notesArea);
    body.appendChild(notesField);

    modal.appendChild(body);
    const actions = buildEditActions(modal, artwork, periodSel, selectedThemes, getCustomTags, isFavGetter(() => isFav), notesArea);
    modal.appendChild(actions);
  } else {
    // No notes yet — show "Add note" button
    let notesArea = null;
    const addNoteBtn = el('button', { class: 'btn-add-note' }, '+ Add a note');
    addNoteBtn.addEventListener('click', () => {
      notesArea = el('textarea', { placeholder: 'Your personal notes…' });
      notesField.innerHTML = '';
      notesField.appendChild(el('label', {}, 'My Notes'));
      notesField.appendChild(notesArea);
    });
    notesField.appendChild(addNoteBtn);
    body.appendChild(notesField);

    modal.appendChild(body);
    const actions = buildEditActions(modal, artwork, periodSel, selectedThemes, getCustomTags, isFavGetter(() => isFav), { get value() { return notesArea ? notesArea.value : ''; } });
    modal.appendChild(actions);
  }

  backdrop.appendChild(modal);
  document.getElementById('modal-root').appendChild(backdrop);
}

function isFavGetter(fn) { return fn; }

function buildEditActions(modal, artwork, periodSel, selectedThemes, getCustomTags, getFav, notesArea) {
  const actions = el('div', { class: 'modal-actions' });

  const removeBtn = el('button', { class: 'btn-remove' }, 'Remove');
  removeBtn.addEventListener('click', () => {
    if (confirm(`Remove "${artwork.title}" from your collection?`)) {
      state.collection = state.collection.filter(a => !(a.id === artwork.id && a.source === artwork.source));
      saveCollection();
      closeModal();
      renderCollection();
    }
  });
  actions.appendChild(removeBtn);

  const cancelBtn = el('button', { class: 'btn-cancel' }, 'Cancel');
  cancelBtn.addEventListener('click', closeModal);
  actions.appendChild(cancelBtn);

  const saveBtn = el('button', { class: 'btn-save' }, 'Save changes');
  saveBtn.addEventListener('click', () => {
    const idx = state.collection.findIndex(a => a.id === artwork.id && a.source === artwork.source);
    if (idx === -1) return;
    state.collection[idx] = {
      ...state.collection[idx],
      period: periodSel.value,
      themes: selectedThemes,
      customTags: getCustomTags(),
      isFavorite: typeof getFav === 'function' ? getFav() : getFav,
      notes: notesArea.value.trim()
    };
    saveCollection();
    closeModal();
    renderCollection();
  });
  actions.appendChild(saveBtn);

  return actions;
}

// ===== Tag Input Widget =====
function buildTagInput(initialTags) {
  const tags = [...initialTags];
  const tagArea = el('div', { class: 'tag-input-area', role: 'group', 'aria-label': 'Custom tags' });
  const input = el('input', { type: 'text', placeholder: 'Type a tag and press Enter…', 'aria-label': 'Add tag' });

  function renderChips() {
    tagArea.innerHTML = '';
    for (const tag of tags) {
      const chip = el('span', { class: 'tag-chip' });
      chip.appendChild(document.createTextNode(tag));
      const rm = el('button', { 'aria-label': `Remove tag ${tag}` }, '×');
      rm.addEventListener('click', () => {
        tags.splice(tags.indexOf(tag), 1);
        renderChips();
      });
      chip.appendChild(rm);
      tagArea.appendChild(chip);
    }
    tagArea.appendChild(input);
    input.focus();
  }

  function addTag(val) {
    const trimmed = val.trim().replace(/,+$/, '').trim();
    if (trimmed && !tags.includes(trimmed)) tags.push(trimmed);
    input.value = '';
    renderChips();
  }

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(input.value); }
    if (e.key === 'Backspace' && !input.value && tags.length) { tags.pop(); renderChips(); }
  });
  input.addEventListener('blur', () => { if (input.value.trim()) addTag(input.value); });
  tagArea.addEventListener('click', () => input.focus());

  renderChips();

  return { tagArea, getCustomTags: () => [...tags] };
}

// ===== Export =====
function exportCollection() {
  if (!state.collection.length) { alert('Your collection is empty.'); return; }
  const date = new Date().toISOString().slice(0, 10);
  const filename = `my-impressionist-collection-${date}.json`;
  const blob = new Blob([JSON.stringify(state.collection, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ===== Import =====
function importCollection() {
  const input = el('input', { type: 'file', accept: '.json' });
  input.style.display = 'none';
  document.body.appendChild(input);
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) { input.remove(); return; }
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      if (!Array.isArray(imported)) throw new Error('Invalid format');
      showImportConfirm(imported);
    } catch {
      alert('Could not read the file. Make sure it is a valid collection JSON.');
    }
    input.remove();
  });
  input.click();
}

function showImportConfirm(imported) {
  closeModal();
  const existingKeys = new Set(state.collection.map(a => `${a.source}:${a.id}`));
  const newItems = imported.filter(a => !existingKeys.has(`${a.source}:${a.id}`));
  const updates = imported.filter(a => existingKeys.has(`${a.source}:${a.id}`));

  const backdrop = el('div', { class: 'modal-backdrop', id: 'modal-backdrop' });
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });
  const modal = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' });

  const hdr = el('div', { class: 'modal-header' });
  hdr.appendChild(el('h2', {}, 'Import Collection'));
  const closeBtn = el('button', { class: 'modal-close', 'aria-label': 'Close' }, '×');
  closeBtn.addEventListener('click', closeModal);
  hdr.appendChild(closeBtn);
  modal.appendChild(hdr);

  const body = el('div', { class: 'modal-body' });
  const stats = el('div', { class: 'import-stats' });
  stats.innerHTML = `
    <p>Found <strong>${imported.length}</strong> artworks in the import file:</p>
    <p>• <strong>${newItems.length}</strong> new artworks to add</p>
    <p>• <strong>${updates.length}</strong> existing artworks to update (notes, tags, favourites)</p>
  `;
  body.appendChild(stats);
  modal.appendChild(body);

  const actions = el('div', { class: 'modal-actions' });
  const cancelBtn = el('button', { class: 'btn-cancel' }, 'Cancel');
  cancelBtn.addEventListener('click', closeModal);
  actions.appendChild(cancelBtn);

  const confirmBtn = el('button', { class: 'btn-save' }, 'Import');
  confirmBtn.addEventListener('click', () => {
    // Apply updates
    for (const item of updates) {
      const idx = state.collection.findIndex(a => a.source === item.source && a.id === item.id);
      if (idx !== -1) {
        state.collection[idx] = {
          ...state.collection[idx],
          notes: item.notes,
          customTags: item.customTags,
          isFavorite: item.isFavorite,
          period: item.period,
          themes: item.themes
        };
      }
    }
    // Add new
    state.collection.push(...newItems);
    saveCollection();
    closeModal();
    if (state.activeTab === 'collection') renderCollection();
    alert(`Import complete: ${newItems.length} added, ${updates.length} updated.`);
  });
  actions.appendChild(confirmBtn);

  modal.appendChild(actions);
  backdrop.appendChild(modal);
  document.getElementById('modal-root').appendChild(backdrop);
}

// ===== Lightbox =====
function openLightbox(artwork) {
  const existing = document.getElementById('lightbox');
  if (existing) existing.remove();

  const box = el('div', { class: 'lightbox', id: 'lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Full screen image' });

  const img = el('img', { alt: artwork.title });
  // Request a larger version from AIC (800px wide) or use original URL
  if (artwork.source === 'aic' && artwork.imageUrl.includes('/iiif/2/')) {
    img.src = artwork.imageUrl.replace('/full/400,/', '/full/800,/');
  } else {
    img.src = artwork.imageUrl;
  }

  const toolbar = el('div', { class: 'lightbox-toolbar' });

  const downloadBtn = el('button', { class: 'lightbox-btn', 'aria-label': 'Download as JPG' }, '↓ Save as JPG');
  downloadBtn.addEventListener('click', () => downloadAsJpg(img, artwork.title));

  const closeBtn = el('button', { class: 'lightbox-btn', 'aria-label': 'Close full screen' }, '✕ Close');
  closeBtn.addEventListener('click', () => box.remove());

  toolbar.appendChild(downloadBtn);
  toolbar.appendChild(closeBtn);

  const caption = el('div', { class: 'lightbox-caption' },
    `${artwork.title} — ${artwork.artist}${artwork.date ? ', ' + artwork.date : ''}`
  );

  box.appendChild(img);
  box.appendChild(toolbar);
  box.appendChild(caption);

  box.addEventListener('click', e => { if (e.target === box) box.remove(); });
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') { box.remove(); document.removeEventListener('keydown', escHandler); }
  });

  document.body.appendChild(box);
}

async function downloadAsJpg(sourceImg, title) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Use a fresh image to ensure CORS headers are respected
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = sourceImg.src + (sourceImg.src.includes('?') ? '&' : '?') + '_cb=' + Date.now();

  img.onload = () => {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const url = canvas.toDataURL('image/jpeg', 0.92);
    const a = document.createElement('a');
    const safeName = title.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 60);
    a.href = url;
    a.download = `${safeName}.jpg`;
    a.click();
  };

  img.onerror = () => {
    // CORS blocked — open image URL directly in a new tab for manual save
    window.open(sourceImg.src, '_blank');
    alert('The image opened in a new tab. Right-click → Save image to download it.');
  };
}

// ===== Tab switching =====
function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
    btn.setAttribute('aria-selected', btn.dataset.tab === tab ? 'true' : 'false');
  });
  if (tab === 'browse') renderBrowse();
  else renderCollection();
}

// ===== Init =====
function init() {
  loadCollection();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.unregister());
    });
  }

  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Home button (title click)
  document.getElementById('btn-home').addEventListener('click', () => switchTab('browse'));

  // Export / Import
  document.getElementById('btn-export').addEventListener('click', exportCollection);
  document.getElementById('btn-import').addEventListener('click', importCollection);

  // Keyboard: close modal on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.modal) closeModal();
    if (e.key === 'Escape') closeModal();
  });

  // Online/offline events
  window.addEventListener('online', () => { if (state.activeTab === 'browse') renderBrowse(); });
  window.addEventListener('offline', () => { if (state.activeTab === 'browse') renderBrowse(); });

  // Initial render
  switchTab('browse');
}

document.addEventListener('DOMContentLoaded', init);
