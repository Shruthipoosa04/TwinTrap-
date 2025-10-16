// ==========================================================
// TwinTrap — Robust SPA Navigation + Fake WiFi Scanner (main.js)
// ==========================================================
(function () {
  // Run after DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    /* ------------------------
       Element references
    ------------------------ */
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menuToggle');
    const closeBtn = document.getElementById('closeBtn');
    const mainEl = document.querySelector('main') || document.getElementById('main') || document.body;

    // A best-effort set of sidebar links (works with .sidebar-menu a or .nav-link)
    const navLinks = Array.from(document.querySelectorAll('.sidebar-menu a, a.nav-link'));

    const titleToId = {
      'dashboard': 'home',
      'home': 'home',
      'analyze': 'analyze',
      'results': 'results',
      'about': 'about',
      'docs': 'docs'
    };

    /* ------------------------
       Utility: update toggle icon
    ------------------------ */
    function updateToggleIcon() {
      if (!menuToggle) return;
      const open = sidebar && sidebar.classList.contains('active');
      menuToggle.textContent = open ? '✕' : '☰';
    }

    /* ------------------------
       Utility: resolve link -> page id
    ------------------------ */
    function resolveLinkTarget(a) {
      if (!a) return null;
      if (a.dataset && a.dataset.page) return a.dataset.page;
      if (a.hash && a.hash.startsWith('#') && a.hash.length > 1) return a.hash.slice(1);
      const href = a.getAttribute && a.getAttribute('href');
      if (href && href.startsWith('#') && href.length > 1) return href.slice(1);
      const text = (a.textContent || '').trim().toLowerCase();
      if (titleToId[text]) return titleToId[text];
      // fallback: return text as id candidate
      return text || null;
    }

    /* ------------------------
       SPA navigate
    ------------------------ */
    function navigate(page) {
      if (!page) return;
      // hide all pages
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

      // show target
      const target = document.getElementById(page);
      if (target) {
        target.classList.add('active');
        // update hash without jumping
        try { history.replaceState(null, '', '#' + page); } catch (e) {}
      } else {
        // if target doesn't exist, try the 'home' fallback
        console.warn('navigate: page not found ->', page);
        const fallback = document.getElementById('home');
        if (fallback) fallback.classList.add('active');
      }

      // update nav link active states
      navLinks.forEach(a => {
        const t = resolveLinkTarget(a);
        a.classList.toggle('active', t === page);
      });

      // focus main for accessibility
      (mainEl || document.body).setAttribute('tabindex', '-1');
      (mainEl || document.body).focus();

      // close sidebar on mobile / small screens for UX
      if (sidebar && window.innerWidth <= 900) {
        sidebar.classList.remove('active');
        updateToggleIcon();
      }
    }

    // expose navigate globally (some existing inline handlers may call it)
    window.navigate = navigate;

    /* ------------------------
       Attach listeners to nav links
    ------------------------ */
    if (navLinks.length) {
      navLinks.forEach(a => {
        a.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const page = resolveLinkTarget(a);
          navigate(page);
        });
        // keyboard
        a.addEventListener('keyup', ev => { if (ev.key === 'Enter') a.click(); });
      });
    }

    /* ------------------------
       Sidebar toggle & outside-click
    ------------------------ */
    if (menuToggle) {
      menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (sidebar) sidebar.classList.toggle('active');
        updateToggleIcon();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (sidebar) sidebar.classList.remove('active');
        updateToggleIcon();
      });
    }

    document.addEventListener('click', (e) => {
      // only auto-close on narrow screens to avoid unexpected behavior desktop
      if (sidebar && menuToggle && window.innerWidth <= 900) {
        if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
          sidebar.classList.remove('active');
          updateToggleIcon();
        }
      }
    });

    // set initial toggle icon state
    updateToggleIcon();

    /* ------------------------
       Modal helpers (global)
    ------------------------ */
    window.openModal = function (name) {
      const el = document.getElementById(name + 'Modal');
      if (el) el.classList.add('active');
    };
    window.closeModal = function (name) {
      const el = document.getElementById(name + 'Modal');
      if (el) el.classList.remove('active');
    };

    window.handleLogin = function (e) {
      if (e && e.preventDefault) e.preventDefault();
      alert('Demo login — replace with real authentication endpoint.');
      window.closeModal && window.closeModal('login');
    };

    window.handleSignup = function (e) {
      if (e && e.preventDefault) e.preventDefault();
      alert('Demo signup — replace with real signup endpoint.');
      window.closeModal && window.closeModal('signup');
    };

    /* ------------------------
       Fake WiFi Scan Simulation (safe & resilient)
    ------------------------ */
    let scanning = false;
    let scanTimer = null;
    let latestResults = [];

    const scanBtn = document.getElementById('scanBtn') || document.querySelector('.scan-btn');
    const statusEl = document.getElementById('status') || document.querySelector('.status');
    let resultsGrid = document.getElementById('resultsGrid');

    // ensure resultsGrid exists (create inside results-panel/analyze-wrapper or body)
    if (!resultsGrid) {
      const fallbackContainer = document.querySelector('.results-panel') || document.querySelector('.analyze-wrapper') || document.getElementById('results') || document.body;
      resultsGrid = document.createElement('div');
      resultsGrid.id = 'resultsGrid';
      resultsGrid.className = 'results-grid';
      fallbackContainer.appendChild(resultsGrid);
    }

    function randomAP() {
      const names = ['CoffeeNet', 'HomeWiFi', 'FreeAirport', 'TP-Link', 'Linksys', 'Starbucks', 'LibraryNet', 'GuestNet'];
      const ssid = names[Math.floor(Math.random() * names.length)] + (Math.random() > 0.75 ? '-FREE' : '');
      const bssid = 'AA:BB:CC:' + Math.floor(Math.random() * 90 + 10).toString(16).toUpperCase();
      const rssi = Math.floor(Math.random() * 60) - 90;
      const enc = Math.random() > 0.6 ? 'WPA2' : (Math.random() > 0.85 ? 'OPEN' : 'WPA3');
      const score = Math.max(0, Math.min(100, (enc === 'OPEN' ? 20 : enc === 'WPA2' ? 70 : 90) + (rssi > -50 ? 10 : rssi > -70 ? 0 : -10)));
      const verdict = score > 80 ? 'good' : score > 50 ? 'suspicious' : 'malicious';
      return { ssid, bssid, rssi, enc, score, verdict, channel: Math.ceil(Math.random() * 11), timestamp: new Date().toISOString() };
    }

    function renderAP(ap) {
      const div = document.createElement('div');
      div.className = 'ap-card ' + ap.verdict;
      div.innerHTML = `
        <div class="ap-label">${ap.ssid}</div>
        <div class="ap-details">BSSID: <code>${ap.bssid}</code> • RSSI: ${ap.rssi} dBm • Channel: ${ap.channel} • ${ap.enc}</div>
        <div class="explanation">Score: ${ap.score} — ${ap.verdict.charAt(0).toUpperCase() + ap.verdict.slice(1)}</div>`;
      return div;
    }

    function startScan() {
      if (scanning) return;
      scanning = true;
      latestResults = [];
      resultsGrid.innerHTML = '';
      if (scanBtn) { scanBtn.innerText = 'Scanning...'; scanBtn.setAttribute('aria-pressed', 'true'); }
      if (statusEl) statusEl.innerText = 'Scanning — collecting nearby networks...';

      let count = 0;
      scanTimer = setInterval(() => {
        count++;
        const ap = randomAP();
        latestResults.unshift(ap);
        // prepend
        if (resultsGrid.firstChild) resultsGrid.prepend(renderAP(ap));
        else resultsGrid.appendChild(renderAP(ap));
        if (statusEl) statusEl.innerText = `Scanning — found ${count} AP${count > 1 ? 's' : ''}`;
        if (count >= 8) {
          stopScan();
          if (statusEl) statusEl.innerText = 'Scan complete — results displayed below.';
        }
      }, 450);
    }

    function stopScan() {
      if (scanTimer) clearInterval(scanTimer);
      scanning = false;
      if (scanBtn) { scanBtn.innerText = 'Start Scan'; scanBtn.setAttribute('aria-pressed', 'false'); }
      if (statusEl) statusEl.innerText = 'Idle';
    }

    function toggleScan() {
      scanning ? stopScan() : startScan();
    }

    // expose scan functions globally for buttons that call them inline
    window.toggleScan = toggleScan;
    window.exportResults = function () {
      if (!latestResults.length) {
        alert('No results to export. Run a scan first.');
        return;
      }
      const data = JSON.stringify(latestResults, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `twintrap-scan-${new Date().toISOString().slice(0, 19)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    };

    // attach click to scan button if present
    if (scanBtn) {
      scanBtn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleScan();
      });
    }

    /* ------------------------
       Keyboard shortcuts (1-4 -> pages)
    ------------------------ */
    window.addEventListener('keydown', (e) => {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key >= '1' && e.key <= '4') {
        const map = ['home', 'analyze', 'results', 'about'];
        const idx = parseInt(e.key, 10) - 1;
        navigate(map[idx]);
      }
      if (e.key === 'Enter' && document.activeElement === scanBtn) {
        toggleScan();
      }
    });

    /* ------------------------
       Q&A accordion (if present)
    ------------------------ */
    document.querySelectorAll('.question').forEach(question => {
      question.addEventListener('click', () => {
        const card = question.parentElement;
        card.classList.toggle('active');
      });
    });

    /* ------------------------
       Initial navigation: hash or default home
    ------------------------ */
    const initialHash = window.location.hash && window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    const initialPage = initialHash || 'home';
    navigate(initialPage);
  });
})();
