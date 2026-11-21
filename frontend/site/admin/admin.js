/**
 * QAVRIL LABS — CMS Admin Panel Controller
 * Handles authentication, dynamic CMS data loading, CRUD operations,
 * drawer dialogs, and real-time marketing site updates.
 */

(function () {
  'use strict';

  // Determine API base URL
  const API_BASE = (window.__CONFIG__ && (window.__CONFIG__.contentApiBase || window.__CONFIG__.apiBase)) ||
                   (window.__API_BASE__) ||
                   (location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? 'http://localhost:3003' : '');

  const STORAGE_KEY = 'qavril_cms_admin_key';
  const THEME_KEY = 'qavril_theme';

  // Internal state
  const state = {
    key: localStorage.getItem(STORAGE_KEY) || '',
    activeTab: 'overview',
    articleFilter: 'all',
    pages: [],
    articles: [],
    faqs: [],
    leads: [],
    settings: {},
    selectedPageSlug: null,
    isOffline: false,
    pendingDelete: null
  };

  // Helper: headers with auth key
  function getHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-admin-key': state.key
    };
  }

  // Toast Notification
  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    toast.innerHTML = `<span><strong>${icon}</strong> ${escapeHtml(message)}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 200);
    }, 3500);
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Theme Initialisation
  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);

    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem(THEME_KEY, next);
      });
    }
  }

  // Authentication & Login Modal
  const loginDialog = document.getElementById('login-dialog');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');

  async function checkAuth() {
    if (!state.key) {
      openLoginModal();
      return false;
    }

    try {
      const res = await fetch(`${API_BASE}/v1/admin/cms/auth/verify`, {
        method: 'POST',
        headers: getHeaders()
      });

      if (res.ok) {
        state.isOffline = false;
        updateConnectionStatus(true);
        return true;
      } else {
        openLoginModal();
        return false;
      }
    } catch (err) {
      console.warn('[CMS Admin] API unavailable or offline:', err);
      state.isOffline = true;
      updateConnectionStatus(false);
      // Allow user in offline demonstration mode
      return true;
    }
  }

  function openLoginModal() {
    if (loginDialog && typeof loginDialog.showModal === 'function') {
      loginDialog.showModal();
    }
  }

  function closeLoginModal() {
    if (loginDialog && typeof loginDialog.close === 'function') {
      loginDialog.close();
    }
  }

  function updateConnectionStatus(connected) {
    const chip = document.getElementById('backend-status-chip');
    if (!chip) return;
    if (connected) {
      chip.className = 'status-chip chip-ok';
      chip.textContent = '● Connected to Live Neon API';
    } else {
      chip.className = 'status-chip chip-draft';
      chip.textContent = '○ Offline / Local Mock Mode';
    }
  }

  // Bind Login Form
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginError.style.display = 'none';
      const keyInput = document.getElementById('admin-key');
      const enteredKey = keyInput ? keyInput.value.trim() : '';

      if (!enteredKey) {
        loginError.textContent = 'Please enter the admin key.';
        loginError.style.display = 'block';
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/v1/admin/cms/auth/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-key': enteredKey }
        });

        if (res.ok) {
          state.key = enteredKey;
          localStorage.setItem(STORAGE_KEY, enteredKey);
          closeLoginModal();
          showToast('Authenticated successfully with Neon API', 'success');
          loadCurrentTab();
        } else {
          loginError.textContent = 'Invalid Admin Key. Check server configuration.';
          loginError.style.display = 'block';
        }
      } catch (err) {
        // If API unreachable, fallback
        state.key = enteredKey;
        localStorage.setItem(STORAGE_KEY, enteredKey);
        closeLoginModal();
        showToast('Running in local offline mode', 'info');
        loadCurrentTab();
      }
    });
  }

  // Logout Button
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEY);
      state.key = '';
      showToast('Logged out of CMS admin panel', 'info');
      openLoginModal();
    });
  }

  // Tab Navigation
  function initNav() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        switchTab(tab);
      });
    });
  }

  function switchTab(tabName) {
    state.activeTab = tabName;
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    document.querySelectorAll('.admin-tab').forEach(sec => {
      sec.classList.toggle('active', sec.id === `tab-${tabName}`);
    });

    loadCurrentTab();
  }

  function loadCurrentTab() {
    switch (state.activeTab) {
      case 'overview':
        loadOverview();
        break;
      case 'pages':
        loadPages();
        break;
      case 'articles':
        loadArticles();
        break;
      case 'faqs':
        loadFaqs();
        break;
      case 'leads':
        loadLeads();
        break;
      case 'settings':
        loadSettings();
        break;
    }
  }

  // --- TAB 1: OVERVIEW ---
  async function loadOverview() {
    try {
      const res = await fetch(`${API_BASE}/v1/admin/cms/overview`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        document.getElementById('kpi-pages').textContent = data.pagesCount ?? 3;
        document.getElementById('kpi-articles').textContent = data.articlesCount ?? 0;
        document.getElementById('kpi-faqs').textContent = data.faqsCount ?? 3;
        document.getElementById('kpi-leads').textContent = data.leadsCount ?? 0;

        renderRecentLeads(data.recentLeads || []);
        return;
      }
    } catch (e) {
      console.warn('[CMS Overview] Falling back to local data');
    }

    // Fallback numbers
    document.getElementById('kpi-pages').textContent = state.pages.length || 3;
    document.getElementById('kpi-articles').textContent = state.articles.length || 0;
    document.getElementById('kpi-faqs').textContent = state.faqs.length || 3;
    document.getElementById('kpi-leads').textContent = state.leads.length || 0;
  }

  function renderRecentLeads(leads) {
    const container = document.getElementById('recent-leads-list');
    if (!container) return;

    if (!leads || leads.length === 0) {
      container.innerHTML = '<div class="empty-state">No inquiries received yet. Submissions from <code>/book.html</code> will appear here.</div>';
      return;
    }

    container.innerHTML = leads.slice(0, 5).map(lead => `
      <div style="padding: 10px 0; border-bottom: 1px dashed var(--black); display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong>${escapeHtml(lead.name || 'Anonymous')}</strong> (${escapeHtml(lead.email)})
          <div style="font-size: 12px; color: var(--muted);">${escapeHtml(lead.company || 'Enterprise')} · ${escapeHtml(lead.interest || 'General')}</div>
        </div>
        <span style="font-size: 11px; font-weight: 700; color: var(--muted);">${new Date(lead.created_at || Date.now()).toLocaleDateString()}</span>
      </div>
    `).join('');
  }

  // --- TAB 2: PAGES CMS ---
  async function loadPages() {
    try {
      const res = await fetch(`${API_BASE}/v1/admin/cms/pages`, { headers: getHeaders() });
      if (res.ok) {
        state.pages = await res.json();
      }
    } catch (err) {
      console.warn('[CMS Pages] Local fallback for pages');
      if (state.pages.length === 0) {
        state.pages = [
          {
            slug: 'home',
            title: 'QAVRIL LABS — Autonomous AI, Precision Automation & Systems Engineering',
            meta_description: 'QAVRIL LABS delivers autonomous agents, precision enterprise automation, double-entry financial platforms, and mission-critical systems engineering.',
            kicker: 'Autonomous AI & Mission Systems',
            hero_headline: 'ENGINEER THE AUTONOMOUS ENTERPRISE.',
            hero_subhead: 'Continuous financial audit, cognitive AI workers, zero-loss migrations, and mission-critical engineering deployed on day one.',
            hero_badge: 'PRODUCTION READY',
            is_published: true
          },
          {
            slug: 'book',
            title: 'Schedule Technical Architecture Consultation | QAVRIL LABS',
            meta_description: 'Book a 45-minute confidential architecture and systems briefing with QAVRIL LABS engineering partners.',
            kicker: 'Direct Partner Access',
            hero_headline: 'BOOK TECHNICAL CONSULTATION.',
            hero_subhead: 'Direct confidential consultation with our systems architects. Review architecture, ledger integration, or autonomous bot deployments.',
            hero_badge: 'CONFIDENTIAL BRIEFING',
            is_published: true
          },
          {
            slug: 'faq',
            title: 'Frequently Asked Questions & Systems FAQ | QAVRIL LABS',
            meta_description: 'Technical, compliance, security, and deployment answers for QAVRIL LABS autonomous architecture.',
            kicker: 'Knowledge Base',
            hero_headline: 'ENTERPRISE ARCHITECTURE FAQ.',
            hero_subhead: 'Clear answers on security, single-tenant deployments, real-time double-entry ledgers, and deterministic bot control.',
            hero_badge: 'SYSTEMS KNOWLEDGE',
            is_published: true
          }
        ];
      }
    }

    renderPagesList();
    if (!state.selectedPageSlug && state.pages.length > 0) {
      selectPage(state.pages[0].slug);
    } else if (state.selectedPageSlug) {
      selectPage(state.selectedPageSlug);
    }
  }

  function renderPagesList() {
    const list = document.getElementById('pages-list');
    if (!list) return;

    list.innerHTML = state.pages.map(page => `
      <div class="page-list-item ${page.slug === state.selectedPageSlug ? 'active' : ''}" onclick="Admin.selectPage('${page.slug}')">
        <div>
          <div style="font-weight: 700;">/${page.slug}.html</div>
          <div style="font-size: 11px; opacity: 0.8;">${escapeHtml(page.hero_badge || 'Page')}</div>
        </div>
        <span class="status-chip ${page.is_published ? 'chip-ok' : 'chip-draft'}" style="font-size: 10px; padding: 2px 6px;">
          ${page.is_published ? 'LIVE' : 'DRAFT'}
        </span>
      </div>
    `).join('');
  }

  function selectPage(slug) {
    state.selectedPageSlug = slug;
    renderPagesList();

    const page = state.pages.find(p => p.slug === slug);
    if (!page) return;

    document.getElementById('editing-page-title').textContent = `Edit Page: /${page.slug}.html`;
    document.getElementById('edit-page-slug').value = page.slug;
    document.getElementById('page-title').value = page.title || '';
    document.getElementById('page-meta-desc').value = page.meta_description || '';
    document.getElementById('page-kicker').value = page.kicker || '';
    document.getElementById('page-hero-badge').value = page.hero_badge || '';
    document.getElementById('page-hero-headline').value = page.hero_headline || '';
    document.getElementById('page-hero-subhead').value = page.hero_subhead || '';
    document.getElementById('page-is-published').checked = page.is_published !== false;
  }

  // Page Edit Form Submit
  const pageEditForm = document.getElementById('page-edit-form');
  if (pageEditForm) {
    pageEditForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const slug = document.getElementById('edit-page-slug').value;
      const payload = {
        title: document.getElementById('page-title').value,
        meta_description: document.getElementById('page-meta-desc').value,
        kicker: document.getElementById('page-kicker').value,
        hero_badge: document.getElementById('page-hero-badge').value,
        hero_headline: document.getElementById('page-hero-headline').value,
        hero_subhead: document.getElementById('page-hero-subhead').value,
        is_published: document.getElementById('page-is-published').checked
      };

      try {
        const res = await fetch(`${API_BASE}/v1/admin/cms/pages/${slug}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          showToast(`Page '/${slug}.html' updated successfully!`, 'success');
          // Update local state
          const idx = state.pages.findIndex(p => p.slug === slug);
          if (idx !== -1) {
            state.pages[idx] = { ...state.pages[idx], ...payload };
          }
          renderPagesList();
        } else {
          showToast('Failed to update page copy on server', 'error');
        }
      } catch (err) {
        // Offline update
        const idx = state.pages.findIndex(p => p.slug === slug);
        if (idx !== -1) {
          state.pages[idx] = { ...state.pages[idx], ...payload };
        }
        renderPagesList();
        showToast(`Page '/${slug}.html' updated locally (offline mode)`, 'info');
      }
    });
  }

  // --- TAB 3: ARTICLES & BLOGS CMS ---
  async function loadArticles() {
    try {
      const res = await fetch(`${API_BASE}/v1/admin/cms/articles`, { headers: getHeaders() });
      if (res.ok) {
        state.articles = await res.json();
      }
    } catch (err) {
      console.warn('[CMS Articles] Local fallback for articles');
      if (state.articles.length === 0) {
        state.articles = [
          {
            id: 'art-1',
            slug: 'immutable-double-entry-systems',
            title: 'Why One Immutable Double-Entry Ledger Outperforms Microservice Reconciliation',
            type: 'blog',
            category: 'Architecture',
            author: 'QAVRIL LABS Core Systems Team',
            read_time: '6 min read',
            excerpt: 'How appending debit and credit entries to a deterministic ledger eliminates month-end financial reconciliation nightmares forever.',
            content: '# Why One Immutable Double-Entry Ledger Outperforms Microservice Reconciliation\n\nTraditional enterprise software splits accounting across billing, invoicing, and ERP databases. QAVRIL LABS centralises every transaction onto an immutable double-entry ledger where debits strictly match credits.',
            is_featured: true,
            is_published: true,
            created_at: new Date().toISOString()
          },
          {
            id: 'art-2',
            slug: 'finn-autonomous-forecast-case-study',
            title: 'Finn: Real-Time Cash Flow Runway Simulation Under Stress Scenarios',
            type: 'case_study',
            category: 'Finance Bots',
            author: 'Autonomous Bots Studio',
            read_time: '8 min read',
            excerpt: 'How enterprise finance teams simulated multi-currency liquidity shocks in 12 milliseconds using Finn autonomous agents.',
            content: '# Finn: Real-Time Cash Flow Runway Simulation\n\nFinn connects directly to double-entry ledger streams to model runway, overdue debtor collections, and payroll commitments.',
            is_featured: false,
            is_published: true,
            created_at: new Date().toISOString()
          }
        ];
      }
    }

    renderArticlesTable();
  }

  function initArticleFilters() {
    const filterBtns = document.querySelectorAll('.filter-group .btn-filter');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.articleFilter = btn.getAttribute('data-filter');
        renderArticlesTable();
      });
    });
  }

  function renderArticlesTable() {
    const tbody = document.getElementById('articles-table-body');
    if (!tbody) return;

    let filtered = state.articles;
    if (state.articleFilter !== 'all') {
      filtered = state.articles.filter(a => a.type === state.articleFilter);
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 24px;">No articles found for filter '${state.articleFilter}'. Click "+ Create New Article" to write one.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(art => `
      <tr>
        <td>
          <strong>${escapeHtml(art.title)}</strong>
          <div style="font-size: 11px; color: var(--muted);"><code>/${art.slug}</code> ${art.is_featured ? '★ Featured' : ''}</div>
        </td>
        <td><span class="status-chip chip-type">${escapeHtml(art.type || 'blog')}</span></td>
        <td>${escapeHtml(art.category || 'General')}</td>
        <td>${escapeHtml(art.author || 'Team')}</td>
        <td>
          <span class="status-chip ${art.is_published ? 'chip-ok' : 'chip-draft'}">
            ${art.is_published ? 'LIVE' : 'DRAFT'}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-sm btn-outline" onclick="Admin.editArticle('${art.id || art.slug}')">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="Admin.confirmDelete('article', '${art.id || art.slug}', '${escapeHtml(art.title)}')">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // Article Drawer Operations
  const articleDrawer = document.getElementById('article-drawer');
  const articleForm = document.getElementById('article-form');

  function openNewArticleDrawer() {
    if (!articleForm) return;
    articleForm.reset();
    document.getElementById('art-id').value = '';
    document.getElementById('article-drawer-title').textContent = 'New Article / Case Study';
    document.getElementById('art-published').checked = true;
    articleDrawer.classList.add('open');
    articleDrawer.setAttribute('aria-hidden', 'false');
  }

  function editArticle(identifier) {
    const art = state.articles.find(a => a.id === identifier || a.slug === identifier);
    if (!art) return;

    document.getElementById('art-id').value = art.id || art.slug;
    document.getElementById('art-title').value = art.title || '';
    document.getElementById('art-slug').value = art.slug || '';
    document.getElementById('art-type').value = art.type || 'blog';
    document.getElementById('art-category').value = art.category || '';
    document.getElementById('art-author').value = art.author || 'QAVRIL LABS Team';
    document.getElementById('art-read-time').value = art.read_time || '5 min read';
    document.getElementById('art-excerpt').value = art.excerpt || '';
    document.getElementById('art-content').value = art.content || '';
    document.getElementById('art-featured').checked = !!art.is_featured;
    document.getElementById('art-published').checked = art.is_published !== false;

    document.getElementById('article-drawer-title').textContent = 'Edit Article';
    articleDrawer.classList.add('open');
    articleDrawer.setAttribute('aria-hidden', 'false');
  }

  function closeArticleDrawer() {
    if (articleDrawer) {
      articleDrawer.classList.remove('open');
      articleDrawer.setAttribute('aria-hidden', 'true');
    }
  }

  if (articleForm) {
    articleForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('art-id').value;
      const isNew = !id;

      const payload = {
        title: document.getElementById('art-title').value,
        slug: document.getElementById('art-slug').value,
        type: document.getElementById('art-type').value,
        category: document.getElementById('art-category').value,
        author: document.getElementById('art-author').value,
        read_time: document.getElementById('art-read-time').value,
        excerpt: document.getElementById('art-excerpt').value,
        content: document.getElementById('art-content').value,
        is_featured: document.getElementById('art-featured').checked,
        is_published: document.getElementById('art-published').checked
      };

      try {
        const url = isNew ? `${API_BASE}/v1/admin/cms/articles` : `${API_BASE}/v1/admin/cms/articles/${id}`;
        const method = isNew ? 'POST' : 'PUT';

        const res = await fetch(url, {
          method,
          headers: getHeaders(),
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          showToast(`Article '${payload.title}' saved successfully!`, 'success');
          closeArticleDrawer();
          loadArticles();
        } else {
          showToast('Server returned error saving article', 'error');
        }
      } catch (err) {
        // Offline save
        if (isNew) {
          payload.id = 'art-' + Date.now();
          state.articles.unshift(payload);
        } else {
          const idx = state.articles.findIndex(a => a.id === id || a.slug === id);
          if (idx !== -1) state.articles[idx] = { ...state.articles[idx], ...payload };
        }
        closeArticleDrawer();
        renderArticlesTable();
        showToast('Article saved locally (offline mode)', 'info');
      }
    });
  }

  // --- TAB 4: FAQS CMS ---
  async function loadFaqs() {
    try {
      const res = await fetch(`${API_BASE}/v1/admin/cms/faqs`, { headers: getHeaders() });
      if (res.ok) {
        state.faqs = await res.json();
      }
    } catch (err) {
      console.warn('[CMS FAQs] Local fallback for FAQs');
      if (state.faqs.length === 0) {
        state.faqs = [
          {
            id: 'faq-1',
            category: 'Architecture & Ledgers',
            question: 'How does QAVRIL LABS guarantee continuous double-entry ledger balance?',
            answer: 'Every financial entry is an immutable debit-credit pair written inside an ACID transaction on PostgreSQL with mathematical balance checks before commit. Unbalanced ledger entries are rejected at the database engine level.',
            sort_order: 1,
            is_active: true
          },
          {
            id: 'faq-2',
            category: 'Deployment & Security',
            question: 'Can QAVRIL LABS platforms run in air-gapped or dedicated single-tenant VPCs?',
            answer: 'Yes. All services are packaged as containerised artifacts deployable onto private Kubernetes clusters, AWS GovCloud, or on-premises servers with zero outbound telemetry dependencies.',
            sort_order: 2,
            is_active: true
          },
          {
            id: 'faq-3',
            category: 'Autonomous Agents',
            question: 'How are autonomous AI workers prevented from making unauthorised commitments?',
            answer: 'All bot actions (e.g. Finn, Nora, Ledger) run within strict policy boundaries and multi-party approval workflows. Financial disbursements exceeding configured thresholds require human cryptographic sign-off.',
            sort_order: 3,
            is_active: true
          }
        ];
      }
    }

    renderFaqsTable();
  }

  function renderFaqsTable() {
    const tbody = document.getElementById('faqs-table-body');
    if (!tbody) return;

    if (state.faqs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding: 24px;">No FAQs defined. Click "+ Add FAQ" to create one.</td></tr>';
      return;
    }

    tbody.innerHTML = state.faqs.map(faq => `
      <tr>
        <td><strong>${escapeHtml(faq.category || 'General')}</strong></td>
        <td>
          <div style="font-weight: 700; margin-bottom: 4px;">${escapeHtml(faq.question)}</div>
          <div style="font-size: 13px; color: var(--muted);">${escapeHtml(faq.answer)}</div>
        </td>
        <td><code>#${faq.sort_order ?? 1}</code></td>
        <td>
          <span class="status-chip ${faq.is_active ? 'chip-ok' : 'chip-draft'}">
            ${faq.is_active ? 'ACTIVE' : 'HIDDEN'}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-sm btn-outline" onclick="Admin.editFaq('${faq.id}')">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="Admin.confirmDelete('faq', '${faq.id}', '${escapeHtml(faq.question)}')">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // FAQ Drawer Operations
  const faqDrawer = document.getElementById('faq-drawer');
  const faqForm = document.getElementById('faq-form');

  function openNewFaqDrawer() {
    if (!faqForm) return;
    faqForm.reset();
    document.getElementById('faq-id').value = '';
    document.getElementById('faq-drawer-title').textContent = 'Add FAQ Item';
    document.getElementById('faq-active').checked = true;
    faqDrawer.classList.add('open');
    faqDrawer.setAttribute('aria-hidden', 'false');
  }

  function editFaq(id) {
    const faq = state.faqs.find(f => f.id === id);
    if (!faq) return;

    document.getElementById('faq-id').value = faq.id;
    document.getElementById('faq-category').value = faq.category || '';
    document.getElementById('faq-question').value = faq.question || '';
    document.getElementById('faq-answer').value = faq.answer || '';
    document.getElementById('faq-order').value = faq.sort_order ?? 1;
    document.getElementById('faq-active').checked = faq.is_active !== false;

    document.getElementById('faq-drawer-title').textContent = 'Edit FAQ Item';
    faqDrawer.classList.add('open');
    faqDrawer.setAttribute('aria-hidden', 'false');
  }

  function closeFaqDrawer() {
    if (faqDrawer) {
      faqDrawer.classList.remove('open');
      faqDrawer.setAttribute('aria-hidden', 'true');
    }
  }

  if (faqForm) {
    faqForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('faq-id').value;
      const isNew = !id;

      const payload = {
        category: document.getElementById('faq-category').value,
        question: document.getElementById('faq-question').value,
        answer: document.getElementById('faq-answer').value,
        sort_order: parseInt(document.getElementById('faq-order').value, 10) || 1,
        is_active: document.getElementById('faq-active').checked
      };

      try {
        const url = isNew ? `${API_BASE}/v1/admin/cms/faqs` : `${API_BASE}/v1/admin/cms/faqs/${id}`;
        const method = isNew ? 'POST' : 'PUT';

        const res = await fetch(url, {
          method,
          headers: getHeaders(),
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          showToast('FAQ saved successfully!', 'success');
          closeFaqDrawer();
          loadFaqs();
        } else {
          showToast('Failed to save FAQ', 'error');
        }
      } catch (err) {
        if (isNew) {
          payload.id = 'faq-' + Date.now();
          state.faqs.push(payload);
        } else {
          const idx = state.faqs.findIndex(f => f.id === id);
          if (idx !== -1) state.faqs[idx] = { ...state.faqs[idx], ...payload };
        }
        closeFaqDrawer();
        renderFaqsTable();
        showToast('FAQ saved locally (offline mode)', 'info');
      }
    });
  }

  // --- TAB 5: LEADS INBOX ---
  async function loadLeads() {
    try {
      const res = await fetch(`${API_BASE}/v1/admin/cms/leads`, { headers: getHeaders() });
      if (res.ok) {
        state.leads = await res.json();
      }
    } catch (err) {
      console.warn('[CMS Leads] Fallback for leads');
    }

    renderLeadsTable();
  }

  function renderLeadsTable() {
    const tbody = document.getElementById('leads-table-body');
    if (!tbody) return;

    if (state.leads.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 24px;">No inbound consultation or demo requests yet. Submissions from <code>/book.html</code> will arrive here in real time.</td></tr>';
      return;
    }

    tbody.innerHTML = state.leads.map(lead => `
      <tr>
        <td><code>${new Date(lead.created_at || Date.now()).toLocaleDateString()}</code></td>
        <td><strong>${escapeHtml(lead.name || 'Anonymous')}</strong></td>
        <td><a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a></td>
        <td>${escapeHtml(lead.company || '—')}</td>
        <td><span class="status-chip chip-type">${escapeHtml(lead.interest || 'Consultation')}</span></td>
        <td>${escapeHtml(lead.preferred_slot || 'ASAP')}</td>
        <td style="max-width: 250px; font-size: 13px;">${escapeHtml(lead.message || '—')}</td>
      </tr>
    `).join('');
  }

  function exportLeadsCsv() {
    if (state.leads.length === 0) {
      showToast('No leads available to export.', 'info');
      return;
    }

    const headers = ['Date', 'Name', 'Email', 'Company', 'Interest', 'Preferred Slot', 'Message'];
    const rows = state.leads.map(l => [
      new Date(l.created_at || Date.now()).toISOString(),
      `"${(l.name || '').replace(/"/g, '""')}"`,
      `"${(l.email || '').replace(/"/g, '""')}"`,
      `"${(l.company || '').replace(/"/g, '""')}"`,
      `"${(l.interest || '').replace(/"/g, '""')}"`,
      `"${(l.preferred_slot || '').replace(/"/g, '""')}"`,
      `"${(l.message || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qavril-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Leads CSV exported successfully!', 'success');
  }

  // --- TAB 6: SETTINGS ---
  async function loadSettings() {
    try {
      const res = await fetch(`${API_BASE}/v1/admin/cms/settings`, { headers: getHeaders() });
      if (res.ok) {
        state.settings = await res.json();
      }
    } catch (err) {
      console.warn('[CMS Settings] Local fallback');
      state.settings = {
        brand_name: 'QAVRIL LABS',
        tagline: 'Autonomous AI, Precision Automation & Systems Engineering',
        contact_email: 'partners@qavrillabs.com',
        announcement_text: '★ QAVRIL LABS PRODUCTION RELEASE LIVE — ONE IMMUTABLE DOUBLE-ENTRY LEDGER — VERIFIED ON STAGING ★',
        announcement_active: true
      };
    }

    document.getElementById('set-brand-name').value = state.settings.brand_name || 'QAVRIL LABS';
    document.getElementById('set-tagline').value = state.settings.tagline || '';
    document.getElementById('set-contact-email').value = state.settings.contact_email || 'partners@qavrillabs.com';
    document.getElementById('set-announcement-text').value = state.settings.announcement_text || '';
    document.getElementById('set-announcement-active').checked = state.settings.announcement_active !== false;
  }

  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        brand_name: document.getElementById('set-brand-name').value,
        tagline: document.getElementById('set-tagline').value,
        contact_email: document.getElementById('set-contact-email').value,
        announcement_text: document.getElementById('set-announcement-text').value,
        announcement_active: document.getElementById('set-announcement-active').checked
      };

      try {
        const res = await fetch(`${API_BASE}/v1/admin/cms/settings`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          state.settings = payload;
          showToast('Site settings & announcement ticker updated globally!', 'success');
        } else {
          showToast('Failed to update settings on server', 'error');
        }
      } catch (err) {
        state.settings = payload;
        showToast('Site settings updated locally (offline mode)', 'info');
      }
    });
  }

  // Confirm Dialog Operations
  const confirmDialog = document.getElementById('confirm-dialog');
  const confirmProceed = document.getElementById('confirm-proceed');
  const confirmCancel = document.getElementById('confirm-cancel');

  function confirmDelete(type, id, name) {
    state.pendingDelete = { type, id };
    document.getElementById('confirm-title').textContent = `Delete ${type.toUpperCase()}`;
    document.getElementById('confirm-message').textContent = `Are you sure you want to permanently delete "${name}"? This action removes it from the public marketing website immediately.`;
    if (confirmDialog && typeof confirmDialog.showModal === 'function') {
      confirmDialog.showModal();
    }
  }

  if (confirmCancel) {
    confirmCancel.addEventListener('click', () => {
      state.pendingDelete = null;
      if (confirmDialog) confirmDialog.close();
    });
  }

  if (confirmProceed) {
    confirmProceed.addEventListener('click', async () => {
      if (!state.pendingDelete) return;
      const { type, id } = state.pendingDelete;
      state.pendingDelete = null;
      if (confirmDialog) confirmDialog.close();

      const endpoint = type === 'article' ? `articles/${id}` : `faqs/${id}`;
      try {
        const res = await fetch(`${API_BASE}/v1/admin/cms/${endpoint}`, {
          method: 'DELETE',
          headers: getHeaders()
        });

        if (res.ok) {
          showToast(`Deleted ${type} successfully!`, 'success');
          if (type === 'article') loadArticles();
          else loadFaqs();
        } else {
          showToast(`Failed to delete ${type}`, 'error');
        }
      } catch (err) {
        if (type === 'article') {
          state.articles = state.articles.filter(a => a.id !== id && a.slug !== id);
          renderArticlesTable();
        } else {
          state.faqs = state.faqs.filter(f => f.id !== id);
          renderFaqsTable();
        }
        showToast(`Deleted ${type} locally (offline mode)`, 'info');
      }
    });
  }

  // Expose global controller
  window.Admin = {
    switchTab,
    selectPage,
    openNewArticleDrawer,
    editArticle,
    closeArticleDrawer,
    openNewFaqDrawer,
    editFaq,
    closeFaqDrawer,
    confirmDelete,
    exportLeadsCsv,
    showToast
  };

  // Bootstrap
  document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initNav();
    initArticleFilters();
    const authenticated = await checkAuth();
    if (authenticated) {
      loadCurrentTab();
    }
  });

})();
