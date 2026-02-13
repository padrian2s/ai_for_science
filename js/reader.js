(function () {
  'use strict';

  /* ── Constants ── */
  var TOTAL_PAGES  = 12;
  var ZOOM_LEVELS  = [70, 80, 90, 100, 110, 120, 130, 140];
  var VIEW_MODES   = ['full', 'transcript', 'commentary'];

  var STORAGE_KEYS = {
    page:     'aifs-reader-page',
    zoom:     'aifs-reader-zoom',
    viewMode: 'aifs-reader-viewmode',
    sepia:    'aifs-reader-sepia'
  };

  /* ── State ── */
  var state = {
    currentPage: 1,
    zoomIndex:   3,          // 100 %
    viewMode:    'full',     // full | transcript | commentary
    sepia:       false,
    menuOpen:    false
  };

  /* ── DOM Cache ── */
  var dom = {};

  function cacheDom() {
    dom.pageCounter   = document.getElementById('page-counter');
    dom.pageDisplay   = document.getElementById('page-display');
    dom.textView      = document.getElementById('text-view');
    dom.textContent   = document.getElementById('text-content');
    dom.btnPrev       = document.getElementById('btn-prev');
    dom.btnNext       = document.getElementById('btn-next');
    dom.pageInput     = document.getElementById('page-input');
    dom.progressBar   = document.getElementById('progress-bar');
    dom.zoomPanel     = document.getElementById('zoom-panel');
    dom.contextFab    = document.getElementById('context-fab');
    dom.contextMenu   = document.getElementById('context-menu');
    dom.ctxPrev       = document.getElementById('ctx-prev');
    dom.ctxNext       = document.getElementById('ctx-next');
    dom.ctxPageLabel  = document.getElementById('ctx-page-label');
    dom.ctxClose      = document.getElementById('ctx-close');
    dom.ctxToggleView = document.getElementById('ctx-toggle-view');
    dom.ctxToggleSepia = document.getElementById('ctx-toggle-sepia');
    dom.searchInput   = document.getElementById('search-input');
    dom.searchResults = document.getElementById('search-results');
    dom.viewIndicator = document.getElementById('view-indicator');
  }

  /* ── Local Storage Helpers ── */
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEYS.page, String(state.currentPage));
      localStorage.setItem(STORAGE_KEYS.zoom, String(ZOOM_LEVELS[state.zoomIndex]));
      localStorage.setItem(STORAGE_KEYS.viewMode, state.viewMode);
      localStorage.setItem(STORAGE_KEYS.sepia, state.sepia ? '1' : '0');
    } catch (e) { /* quota / private-mode */ }
  }

  function loadState() {
    try {
      var p = parseInt(localStorage.getItem(STORAGE_KEYS.page), 10);
      if (p >= 1 && p <= TOTAL_PAGES) state.currentPage = p;

      var z = parseInt(localStorage.getItem(STORAGE_KEYS.zoom), 10);
      var zi = ZOOM_LEVELS.indexOf(z);
      if (zi !== -1) state.zoomIndex = zi;

      var vm = localStorage.getItem(STORAGE_KEYS.viewMode);
      if (VIEW_MODES.indexOf(vm) !== -1) state.viewMode = vm;

      var s = localStorage.getItem(STORAGE_KEYS.sepia);
      if (s === '1') state.sepia = true;
    } catch (e) { /* private-mode */ }
  }

  /* ── URL Param Parsing ── */
  function parseUrlPage() {
    var params = new URLSearchParams(window.location.search);
    var section = parseInt(params.get('section'), 10);
    if (section >= 1 && section <= TOTAL_PAGES) {
      state.currentPage = section;
    }
  }

  /* ── Pad Number ── */
  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /* ── Navigation ── */
  function goToPage(n) {
    if (n < 1 || n > TOTAL_PAGES) return;
    state.currentPage = n;

    // Update UI counters
    if (dom.pageCounter)  dom.pageCounter.textContent = n + ' / ' + TOTAL_PAGES;
    if (dom.pageInput)    dom.pageInput.value = n;
    if (dom.ctxPageLabel) dom.ctxPageLabel.textContent = 'Page ' + n + ' of ' + TOTAL_PAGES;

    // Prev / Next button states
    if (dom.btnPrev) dom.btnPrev.disabled = (n === 1);
    if (dom.btnNext) dom.btnNext.disabled = (n === TOTAL_PAGES);

    // Progress bar
    if (dom.progressBar) {
      var pct = (n / TOTAL_PAGES) * 100;
      dom.progressBar.style.width = pct + '%';
    }

    // Fetch section content
    var url = 'text/section_' + pad(n) + '.html';
    if (dom.textContent) {
      dom.textContent.innerHTML = '<div class="reader-loading"><div class="reader-loading__spinner"></div><div class="reader-loading__text">Loading section ' + n + '...</div></div>';
    }

    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('Not found');
        return res.text();
      })
      .then(function (html) {
        if (dom.textContent) dom.textContent.innerHTML = html;
        applyViewMode();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch(function () {
        if (dom.textContent) {
          dom.textContent.innerHTML = '<div class="reader-loading"><div class="reader-loading__text">Section ' + n + ' is not available yet.</div></div>';
        }
      });

    saveState();
  }

  /* ── Zoom ── */
  function setZoom(level) {
    var idx = ZOOM_LEVELS.indexOf(level);
    if (idx === -1) return;
    state.zoomIndex = idx;

    var scale = level / 100;
    if (dom.pageDisplay) {
      dom.pageDisplay.style.transform = 'scale(' + scale + ')';
      dom.pageDisplay.style.transformOrigin = 'top center';
    }

    // Update zoom panel buttons
    if (dom.zoomPanel) {
      var btns = dom.zoomPanel.querySelectorAll('.zoom-panel__btn');
      btns.forEach(function (btn) {
        var val = parseInt(btn.getAttribute('data-zoom'), 10);
        btn.classList.toggle('active', val === level);
      });
    }

    saveState();
  }

  /* ── View Mode Toggle ── */
  function cycleViewMode() {
    var idx = VIEW_MODES.indexOf(state.viewMode);
    state.viewMode = VIEW_MODES[(idx + 1) % VIEW_MODES.length];
    applyViewMode();
    saveState();
  }

  function applyViewMode() {
    var body = document.body;
    body.classList.remove('view-transcript', 'view-commentary');

    if (state.viewMode === 'transcript') {
      body.classList.add('view-transcript');
    } else if (state.viewMode === 'commentary') {
      body.classList.add('view-commentary');
    }

    // Update view indicator
    if (dom.viewIndicator) {
      dom.viewIndicator.className = 'view-indicator';
      var label = '';
      if (state.viewMode === 'full') {
        label = 'Full View';
        dom.viewIndicator.classList.add('view-indicator--all');
      } else if (state.viewMode === 'transcript') {
        label = 'Transcript Only';
        dom.viewIndicator.classList.add('view-indicator--transcript');
      } else {
        label = 'Commentary Only';
        dom.viewIndicator.classList.add('view-indicator--commentary');
      }
      dom.viewIndicator.textContent = label;
    }
  }

  /* ── Sepia Toggle ── */
  function toggleSepia() {
    state.sepia = !state.sepia;
    applySepia();
    saveState();
  }

  function applySepia() {
    document.body.classList.toggle('sepia', state.sepia);
  }

  /* ── Context Menu ── */
  function openMenu() {
    state.menuOpen = true;
    if (dom.contextMenu) dom.contextMenu.classList.add('active');
    if (dom.ctxPageLabel) dom.ctxPageLabel.textContent = 'Page ' + state.currentPage + ' of ' + TOTAL_PAGES;
  }

  function closeMenu() {
    state.menuOpen = false;
    if (dom.contextMenu) dom.contextMenu.classList.remove('active');
    if (dom.searchInput) dom.searchInput.value = '';
    if (dom.searchResults) dom.searchResults.innerHTML = '';
  }

  /* ── Search ── */
  function handleSearch() {
    var query = (dom.searchInput ? dom.searchInput.value : '').toLowerCase().trim();
    if (!dom.searchResults) return;

    if (!query) {
      dom.searchResults.innerHTML = '';
      return;
    }

    var pages = window.pagesData || [];
    var matches = pages.filter(function (p) {
      return p.title.toLowerCase().indexOf(query) !== -1 ||
             p.searchText.toLowerCase().indexOf(query) !== -1;
    });

    if (matches.length === 0) {
      dom.searchResults.innerHTML = '<div class="context-menu__search-item" style="color:var(--color-gray-400)">No results found</div>';
      return;
    }

    dom.searchResults.innerHTML = matches.map(function (m) {
      return '<div class="context-menu__search-item" data-page="' + m.page + '">' +
             '<strong>' + m.page + '.</strong> ' + m.title +
             '</div>';
    }).join('');

    // Bind click handlers to results
    dom.searchResults.querySelectorAll('.context-menu__search-item[data-page]').forEach(function (el) {
      el.addEventListener('click', function () {
        var pg = parseInt(el.getAttribute('data-page'), 10);
        goToPage(pg);
        closeMenu();
      });
    });
  }

  /* ── Keyboard Shortcuts ── */
  function handleKeyDown(e) {
    // Ignore when typing in input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        goToPage(state.currentPage - 1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        goToPage(state.currentPage + 1);
        break;
      case 'v':
      case 'V':
        e.preventDefault();
        cycleViewMode();
        break;
      case 's':
      case 'S':
        e.preventDefault();
        toggleSepia();
        break;
      case 'm':
      case 'M':
        e.preventDefault();
        if (state.menuOpen) closeMenu(); else openMenu();
        break;
      case 'Escape':
        if (state.menuOpen) {
          e.preventDefault();
          closeMenu();
        }
        break;
    }
  }

  /* ── Event Binding ── */
  function bindEvents() {
    // Bottom nav
    if (dom.btnPrev) dom.btnPrev.addEventListener('click', function () { goToPage(state.currentPage - 1); });
    if (dom.btnNext) dom.btnNext.addEventListener('click', function () { goToPage(state.currentPage + 1); });

    // Page input
    if (dom.pageInput) {
      dom.pageInput.addEventListener('change', function () {
        var v = parseInt(dom.pageInput.value, 10);
        if (v >= 1 && v <= TOTAL_PAGES) goToPage(v);
        else dom.pageInput.value = state.currentPage;
      });
      dom.pageInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          dom.pageInput.blur();
        }
      });
    }

    // Context FAB
    if (dom.contextFab) dom.contextFab.addEventListener('click', function () {
      if (state.menuOpen) closeMenu(); else openMenu();
    });

    // Context menu close
    if (dom.ctxClose) dom.ctxClose.addEventListener('click', closeMenu);

    // Click overlay to close
    if (dom.contextMenu) dom.contextMenu.addEventListener('click', function (e) {
      if (e.target === dom.contextMenu) closeMenu();
    });

    // Context menu nav
    if (dom.ctxPrev) dom.ctxPrev.addEventListener('click', function () { goToPage(state.currentPage - 1); });
    if (dom.ctxNext) dom.ctxNext.addEventListener('click', function () { goToPage(state.currentPage + 1); });

    // Context menu toggles
    if (dom.ctxToggleView) dom.ctxToggleView.addEventListener('click', cycleViewMode);
    if (dom.ctxToggleSepia) dom.ctxToggleSepia.addEventListener('click', toggleSepia);

    // Search
    if (dom.searchInput) dom.searchInput.addEventListener('input', handleSearch);

    // Zoom panel buttons
    if (dom.zoomPanel) {
      dom.zoomPanel.querySelectorAll('.zoom-panel__btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var level = parseInt(btn.getAttribute('data-zoom'), 10);
          if (!isNaN(level)) setZoom(level);
        });
      });
    }

    // Keyboard
    document.addEventListener('keydown', handleKeyDown);
  }

  /* ── Init ── */
  function init() {
    cacheDom();
    loadState();
    parseUrlPage();
    setZoom(ZOOM_LEVELS[state.zoomIndex]);
    applyViewMode();
    applySepia();
    goToPage(state.currentPage);
    bindEvents();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
