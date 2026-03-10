// Auth helpers
function getToken() {
  return localStorage.getItem('jwt_token');
}

function getStoredEmail() {
  return localStorage.getItem('user_email');
}

function setAuth(token, email) {
  localStorage.setItem('jwt_token', token);
  localStorage.setItem('user_email', email);
}

function clearAuth() {
  localStorage.removeItem('jwt_token');
  localStorage.removeItem('user_email');
  localStorage.removeItem('mail-service-api-key');
}

function getApiKey() {
  return localStorage.getItem('mail-service-api-key');
}

async function autoSetApiKey() {
  try {
    const token = getToken();
    if (!token) return;
    const res = await fetch('/api-keys/active', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.apiKey) {
      localStorage.setItem('mail-service-api-key', data.apiKey);
    }
  } catch (err) {
    console.warn('Auto-set API key failed:', err.message);
  }
}

function isLoggedIn() {
  return !!getToken();
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  errorEl.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Signing in...';

  try {
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    setAuth(data.token, data.email);
    await autoSetApiKey();
    showApp();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

function handleLogout() {
  clearAuth();
  showLogin();
}

function showApp() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app-container').style.display = 'flex';
  const emailEl = document.getElementById('user-email');
  if (emailEl) emailEl.textContent = getStoredEmail() || '';
  if (typeof loadDashboard === 'function') loadDashboard();
}

function showLogin() {
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('app-container').style.display = 'none';
}

// Check auth on page load
document.addEventListener('DOMContentLoaded', async function() {
  if (isLoggedIn()) {
    if (!getApiKey()) {
      await autoSetApiKey();
    }
    showApp();
  } else {
    showLogin();
  }
});

// API helper
async function api(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(path, opts);
  const data = await res.json();

  if (res.status === 401) {
    clearAuth();
    showLogin();
    throw new Error('Session expired. Please login again.');
  }

  if (!res.ok) {
    throw new Error(data.error || data.details || `Request failed (${res.status})`);
  }
  return data;
}

// Toast notifications
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const colors = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
    warning: 'bg-yellow-600'
  };
  const toast = document.createElement('div');
  toast.className = `toast ${colors[type]} text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium max-w-sm`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Page navigation
const pageTitles = {
  'dashboard': 'Dashboard',
  'send-email': 'Send Email',
  'email-logs': 'Email Logs',
  'templates': 'Templates',
  'bounces': 'Bounces',
  'suppression': 'Suppression List',
  'api-keys': 'API Keys',
  'webhooks': 'Webhooks',
  'api-docs': 'API Documentation',
  'template-editor': 'Template Editor',
  'contacts': 'Contacts',
  'contact-lists': 'Lists & Segments',
  'campaigns': 'Campaigns',
  'campaign-detail': 'Campaign Detail',
  'campaign-create': 'Create Campaign',
  'automations': 'Automations',
  'automation-detail': 'Automation Detail',
  'automation-create': 'Create Automation'
};

function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  const navEl = document.getElementById(`nav-${page}`);
  if (pageEl) {
    pageEl.classList.remove('hidden');
    pageEl.classList.add('fade-in');
  }
  if (navEl) navEl.classList.add('active');

  document.getElementById('page-title').textContent = pageTitles[page] || page;

  // Full-width mode for template editor
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.querySelector('main');
  if (page === 'template-editor') {
    document.body.classList.add('fullwidth-mode');
    sidebar.classList.add('sidebar-hidden');
    sidebar.classList.remove('open');
    mainContent.classList.remove('md:ml-64');
    mainContent.classList.add('ml-0');
    document.getElementById('sidebar-overlay').classList.remove('active');
  } else {
    document.body.classList.remove('fullwidth-mode');
    sidebar.classList.remove('sidebar-hidden');
    sidebar.classList.remove('open');
    mainContent.classList.add('md:ml-64');
    mainContent.classList.remove('ml-0');
    document.getElementById('sidebar-overlay').classList.remove('active');
  }

  // Load data for specific pages
  if (page === 'dashboard') loadDashboard();
  if (page === 'templates') loadTemplates();
  if (page === 'suppression') loadSuppressionList();
  if (page === 'api-keys') loadApiKeys();
  if (page === 'webhooks') loadWebhooks();
  if (page === 'api-docs') initApiDocs();
  if (page === 'template-editor') initTemplateEditor();
  if (page === 'contacts') loadContacts();
  if (page === 'contact-lists') loadContactLists();
  if (page === 'campaigns') loadCampaigns();
  if (page === 'automations') loadAutomations();
  if (page === 'campaign-create') initCampaignCreateForm();
}

// Status badge helper
function statusBadge(status) {
  const colors = {
    pending: 'bg-gray-100 text-gray-700',
    queued: 'bg-blue-100 text-blue-700',
    sent: 'bg-green-100 text-green-700',
    delivered: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-red-100 text-red-700',
    bounced: 'bg-yellow-100 text-yellow-700'
  };
  return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-700'}">${status}</span>`;
}

function bounceTypeBadge(type) {
  const colors = {
    hard: 'bg-red-100 text-red-700',
    soft: 'bg-yellow-100 text-yellow-700',
    complaint: 'bg-orange-100 text-orange-700'
  };
  return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[type] || 'bg-gray-100 text-gray-700'}">${type}</span>`;
}

function reasonBadge(reason) {
  const colors = {
    hard_bounce: 'bg-red-100 text-red-700',
    complaint: 'bg-orange-100 text-orange-700',
    manual: 'bg-blue-100 text-blue-700'
  };
  const label = reason.replace('_', ' ');
  return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[reason] || 'bg-gray-100 text-gray-700'}">${label}</span>`;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Dashboard
async function loadDashboard() {
  // Load health
  try {
    const health = await fetch('/health').then(r => r.json());
    const dot = document.getElementById('health-dot');
    const text = document.getElementById('health-text');
    dot.className = `w-2 h-2 rounded-full ${health.status === 'ok' ? 'bg-green-500' : 'bg-red-500'}`;
    text.textContent = health.status === 'ok' ? 'All systems operational' : 'Service degraded';

    document.getElementById('health-details').innerHTML = `
      <div class="flex items-center justify-between py-2">
        <span class="text-sm text-gray-600">Status</span>
        <span class="text-sm font-medium ${health.status === 'ok' ? 'text-green-600' : 'text-red-600'}">${health.status}</span>
      </div>
      <div class="flex items-center justify-between py-2 border-t border-gray-100">
        <span class="text-sm text-gray-600">Database</span>
        <span class="text-sm font-medium ${health.services?.database?.status === 'connected' ? 'text-green-600' : 'text-red-600'}">${health.services?.database?.status || 'unknown'}</span>
      </div>
      <div class="flex items-center justify-between py-2 border-t border-gray-100">
        <span class="text-sm text-gray-600">Uptime</span>
        <span class="text-sm font-medium text-gray-900">${formatUptime(health.uptime)}</span>
      </div>
      <div class="flex items-center justify-between py-2 border-t border-gray-100">
        <span class="text-sm text-gray-600">Version</span>
        <span class="text-sm font-medium text-gray-900">${health.version || '-'}</span>
      </div>
      <div class="flex items-center justify-between py-2 border-t border-gray-100">
        <span class="text-sm text-gray-600">Environment</span>
        <span class="text-sm font-medium text-gray-900">${health.environment || '-'}</span>
      </div>
    `;
  } catch (e) {
    document.getElementById('health-dot').className = 'w-2 h-2 rounded-full bg-red-500';
    document.getElementById('health-text').textContent = 'Cannot reach service';
  }

  // Load stats
  if (!getApiKey()) return;
  try {
    const stats = await api('GET', '/email/stats');
    const breakdown = stats.breakdown || [];
    const getCount = (s) => { const r = breakdown.find(b => b.status === s); return r ? r.count : 0; };
    document.getElementById('stat-sent').textContent = getCount('sent');
    document.getElementById('stat-queued').textContent = getCount('queued') + getCount('pending');
    document.getElementById('stat-failed').textContent = getCount('failed');
    document.getElementById('stat-bounced').textContent = getCount('bounced');
  } catch (e) {
    // Stats require auth
  }
}

function formatUptime(seconds) {
  if (!seconds) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// Send Email
document.getElementById('send-email-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!getApiKey()) return showToast('Please enter your API key', 'error');

  const to = document.getElementById('email-to').value;
  const template = document.getElementById('email-template').value;

  const body = { to: to.includes(',') ? to.split(',').map(e => e.trim()) : to };

  if (document.getElementById('email-from').value) body.from = document.getElementById('email-from').value;
  if (document.getElementById('email-reply-to').value) body.replyTo = document.getElementById('email-reply-to').value;

  if (template) {
    body.template = template;
    const data = {};
    document.querySelectorAll('#template-vars input').forEach(input => {
      if (input.value) data[input.name] = input.value;
    });
    if (Object.keys(data).length > 0) body.data = data;
  } else {
    body.subject = document.getElementById('email-subject').value;
    body.html = document.getElementById('email-html').value;
    body.text = document.getElementById('email-text').value;
  }

  try {
    const result = await api('POST', template ? '/email/send-template' : '/email/send', body);
    if (result.success) {
      showToast(`Email queued successfully (ID: ${result.logId})`, 'success');
      e.target.reset();
    } else {
      showToast(result.error || 'Failed to send email', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Template selector change
document.getElementById('email-template').addEventListener('change', function() {
  const customSection = document.getElementById('custom-content-section');
  const varsSection = document.getElementById('template-vars-section');

  if (this.value) {
    customSection.classList.add('hidden');
    const tpl = window._templates?.find(t => t.name === this.value);
    if (tpl && tpl.variables) {
      const vars = typeof tpl.variables === 'string' ? JSON.parse(tpl.variables) : tpl.variables;
      varsSection.classList.remove('hidden');
      document.getElementById('template-vars').innerHTML = vars.map(v =>
        `<div><label class="block text-xs text-gray-500 mb-1">${escapeHtml(v)}</label><input name="${escapeHtml(v)}" placeholder="${escapeHtml(v)}" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"></div>`
      ).join('');
    } else {
      varsSection.classList.add('hidden');
    }
  } else {
    customSection.classList.remove('hidden');
    varsSection.classList.add('hidden');
  }
});

// Email Logs
async function loadEmailLogs() {
  if (!getApiKey()) return showToast('Please enter your API key', 'error');

  const recipient = document.getElementById('logs-search').value.trim();
  const status = document.getElementById('logs-status-filter').value;

  let url = '/email/logs?limit=50';
  if (recipient) url += `&recipient=${encodeURIComponent(recipient)}`;
  if (status) url += `&status=${encodeURIComponent(status)}`;

  if (!recipient && !status) return showToast('Enter a recipient or select a status', 'warning');

  try {
    const data = await api('GET', url);
    const logs = data.logs || data;
    const tbody = document.getElementById('logs-table-body');

    if (!logs.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-12 text-center text-sm text-gray-500">No logs found</td></tr>';
      return;
    }

    tbody.innerHTML = logs.map(log => `
      <tr class="hover:bg-gray-50 transition-colors">
        <td class="px-6 py-3 text-sm text-gray-900 font-mono">${log.id}</td>
        <td class="px-6 py-3 text-sm text-gray-900">${escapeHtml(log.recipient)}</td>
        <td class="px-6 py-3 text-sm text-gray-600 max-w-xs truncate">${escapeHtml(log.subject)}</td>
        <td class="px-6 py-3 text-sm text-gray-600">${log.template ? `<span class="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">${escapeHtml(log.template)}</span>` : '-'}</td>
        <td class="px-6 py-3">${statusBadge(log.status)}</td>
        <td class="px-6 py-3 text-sm text-gray-500">${formatDate(log.created_at)}</td>
      </tr>
    `).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('logs-search').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadEmailLogs(); });

// Templates
async function loadTemplates() {
  if (!getApiKey()) {
    document.getElementById('templates-grid').innerHTML = '<p class="text-sm text-gray-500 col-span-full text-center py-12">Enter your API key to view templates</p>';
    return;
  }

  try {
    const search = document.getElementById('tpl-search-input').value.trim();
    const activeOnly = document.getElementById('tpl-filter-active').value;

    let url = '/templates?';
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (activeOnly) url += `active=${activeOnly}&`;

    const templates = await api('GET', url);
    window._templates = templates;

    // Update the send email template dropdown
    const select = document.getElementById('email-template');
    const currentVal = select.value;
    select.innerHTML = '<option value="">-- No template (custom content) --</option>';
    templates.filter(t => t.is_active).forEach(t => {
      select.innerHTML += `<option value="${escapeHtml(t.name)}">${escapeHtml(t.name)} - ${escapeHtml(t.subject)}</option>`;
    });
    select.value = currentVal;

    if (!templates.length) {
      document.getElementById('templates-grid').innerHTML = `
        <div class="col-span-full text-center py-16">
          <svg class="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
          <p class="text-gray-500 font-medium">No templates found</p>
          <p class="text-sm text-gray-400 mt-1">Create your first email template to get started</p>
        </div>`;
      return;
    }

    document.getElementById('templates-grid').innerHTML = templates.map(t => {
      const nameEsc = escapeHtml(t.name).replace(/'/g, "\\'");
      const dateStr = formatDate(t.updated_at || t.created_at);
      const hasHtml = t.html_body || t.body;
      const previewId = 'tpl-preview-' + t.id;
      return `
      <div class="tpl-card ${!t.is_active ? 'opacity-60' : ''}" data-tpl-id="${t.id}">
        <div class="tpl-card-preview" id="${previewId}">
          ${hasHtml
            ? `<iframe srcdoc="${escapeHtml(t.html_body || t.body)}" sandbox="allow-same-origin" loading="lazy" onload="scaleTplPreview(this)"></iframe>`
            : `<div class="tpl-fallback">
                <div class="text-center p-4">
                  <svg class="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  <p class="text-xs text-gray-400">${escapeHtml(t.subject || 'No preview')}</p>
                </div>
              </div>`
          }
          ${t.version && t.version > 1 ? `<div class="tpl-card-badge">v${t.version}</div>` : ''}
          <div class="tpl-card-actions">
            <button onclick="event.stopPropagation();previewTemplate('${nameEsc}')" class="tpl-card-action bg-white text-gray-800 hover:bg-gray-100">Preview</button>
            <button onclick="event.stopPropagation();editTemplate(${t.id}, '${nameEsc}')" class="tpl-card-action bg-primary-600 text-white hover:bg-primary-700">Edit</button>
            <button onclick="event.stopPropagation();openCloneModal(${t.id}, '${nameEsc}')" class="tpl-card-action bg-teal-600 text-white hover:bg-teal-700">Clone</button>
            <button onclick="event.stopPropagation();deleteTemplate(${t.id}, '${nameEsc}')" class="tpl-card-action bg-red-600 text-white hover:bg-red-700">Delete</button>
          </div>
        </div>
        <div class="tpl-card-info">
          <h4>${escapeHtml(t.name)} ${t.description ? ' - ' + escapeHtml(t.description) : ''}</h4>
          <p style="font-size:10px;color:#9ca3af;margin-top:3px;">${dateStr}</p>
        </div>
      </div>`;
    }).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function scaleTplPreview(iframe) {
  const container = iframe.parentElement;
  if (!container) return;
  const cw = container.offsetWidth;
  const scale = cw / 600;
  iframe.style.transform = `scale(${scale})`;
  iframe.style.width = '600px';
  iframe.style.height = (container.offsetHeight / scale) + 'px';
}

function switchTemplateTab(tab) {
  document.querySelectorAll('.tpl-tab').forEach(t => t.classList.remove('active'));
  ['your', 'gallery', 'blocks', 'brand'].forEach(id => {
    const el = document.getElementById('tpl-content-' + id);
    if (el) el.classList.add('hidden');
  });
  const tabEl = document.getElementById('tpl-tab-' + tab);
  const contentEl = document.getElementById('tpl-content-' + tab);
  if (tabEl) tabEl.classList.add('active');
  if (contentEl) contentEl.classList.remove('hidden');
}

function toggleTemplateMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('tpl-more-menu');
  menu.classList.toggle('hidden');
  const close = (ev) => { if (!menu.contains(ev.target)) { menu.classList.add('hidden'); document.removeEventListener('click', close); }};
  setTimeout(() => document.addEventListener('click', close), 0);
}

// Search & filter listeners
document.getElementById('tpl-search-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadTemplates(); });
document.getElementById('tpl-filter-active').addEventListener('change', () => loadTemplates());
document.getElementById('tpl-sort-select').addEventListener('change', () => loadTemplates());

function openTemplateModal(tpl = null) {
  document.getElementById('template-modal').classList.remove('hidden');
  document.getElementById('template-modal-title').textContent = tpl ? 'Edit Template' : 'New Template';
  document.getElementById('template-id').value = tpl ? tpl.id : '';
  document.getElementById('tpl-name').value = tpl ? tpl.name : '';
  document.getElementById('tpl-name').disabled = !!tpl;
  document.getElementById('tpl-description').value = tpl ? (tpl.description || '') : '';
  document.getElementById('tpl-subject').value = tpl ? tpl.subject : '';
  document.getElementById('tpl-html').value = tpl ? (tpl.body_html || '') : '';
  document.getElementById('tpl-text').value = tpl ? (tpl.body_text || '') : '';
  const vars = tpl?.variables ? (typeof tpl.variables === 'string' ? JSON.parse(tpl.variables) : tpl.variables) : [];
  document.getElementById('tpl-variables').value = vars.join(', ');
}

function closeTemplateModal() {
  document.getElementById('template-modal').classList.add('hidden');
  document.getElementById('template-form').reset();
}

async function editTemplate(id, name) {
  try {
    const tpl = await api('GET', `/templates/${name}`);
    openTemplateModal(tpl);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteTemplate(id, name) {
  if (!confirm(`Delete template "${name}"?`)) return;
  try {
    await api('DELETE', `/templates/${id}`);
    showToast('Template deleted', 'success');
    loadTemplates();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Toggle active/inactive
async function toggleTemplateActive(id) {
  try {
    const result = await api('PATCH', `/templates/${id}/toggle`);
    showToast(result.message, 'success');
    loadTemplates();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Preview
let _previewName = '';
function previewTemplate(name) {
  _previewName = name;
  const tpl = window._templates?.find(t => t.name === name);
  const vars = tpl?.variables ? (typeof tpl.variables === 'string' ? JSON.parse(tpl.variables) : tpl.variables) : [];
  // Pre-fill sample data
  const sampleData = {};
  vars.forEach(v => { sampleData[v] = `Sample ${v}`; });
  document.getElementById('preview-data').value = JSON.stringify(sampleData, null, 2);
  document.getElementById('preview-subject').classList.add('hidden');
  document.getElementById('preview-html').classList.add('hidden');
  document.getElementById('preview-modal').classList.remove('hidden');
  renderPreview();
}

async function renderPreview() {
  try {
    let data = {};
    const jsonStr = document.getElementById('preview-data').value.trim();
    if (jsonStr) data = JSON.parse(jsonStr);

    const result = await api('POST', `/templates/${_previewName}/preview`, { data });
    document.getElementById('preview-subject').classList.remove('hidden');
    document.getElementById('preview-subject-content').textContent = result.subject;
    document.getElementById('preview-html').classList.remove('hidden');
    const iframe = document.getElementById('preview-iframe');
    iframe.srcdoc = result.html;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function closePreviewModal() {
  document.getElementById('preview-modal').classList.add('hidden');
}

// Clone
function openCloneModal(id, name) {
  document.getElementById('clone-source-id').value = id;
  document.getElementById('clone-source-name').textContent = name;
  document.getElementById('clone-new-name').value = name + '_copy';
  document.getElementById('clone-modal').classList.remove('hidden');
}

function closeCloneModal() {
  document.getElementById('clone-modal').classList.add('hidden');
  document.getElementById('clone-form').reset();
}

document.getElementById('clone-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!getApiKey()) return showToast('Please enter your API key', 'error');
  try {
    const id = document.getElementById('clone-source-id').value;
    const name = document.getElementById('clone-new-name').value;
    await api('POST', `/templates/${id}/clone`, { name });
    showToast('Template cloned', 'success');
    closeCloneModal();
    loadTemplates();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Stats
async function viewTemplateStats(name) {
  document.getElementById('stats-modal').classList.remove('hidden');
  document.getElementById('stats-content').innerHTML = '<p class="text-sm text-gray-500">Loading...</p>';
  try {
    const stats = await api('GET', `/templates/${name}/stats`);
    document.getElementById('stats-content').innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between py-2">
          <span class="text-sm text-gray-600">Template</span>
          <span class="text-sm font-medium text-gray-900 font-mono">${escapeHtml(stats.template)}</span>
        </div>
        <div class="flex items-center justify-between py-2 border-t border-gray-100">
          <span class="text-sm text-gray-600">Total Emails Sent</span>
          <span class="text-sm font-bold text-gray-900">${stats.totalSent}</span>
        </div>
        <div class="flex items-center justify-between py-2 border-t border-gray-100">
          <span class="text-sm text-gray-600">Last Used</span>
          <span class="text-sm font-medium text-gray-900">${stats.lastUsedAt ? formatDate(stats.lastUsedAt) : 'Never'}</span>
        </div>
        ${stats.byStatus.length > 0 ? `
        <div class="pt-2 border-t border-gray-100">
          <p class="text-sm font-medium text-gray-700 mb-2">Breakdown by Status</p>
          <div class="grid grid-cols-2 gap-2">
            ${stats.byStatus.map(s => `
              <div class="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                ${statusBadge(s.status)}
                <span class="text-sm font-bold text-gray-900">${s.count}</span>
              </div>
            `).join('')}
          </div>
        </div>` : '<p class="text-sm text-gray-400 pt-2 border-t border-gray-100">No usage data yet</p>'}
      </div>
    `;
  } catch (err) {
    document.getElementById('stats-content').innerHTML = `<p class="text-sm text-red-500">${escapeHtml(err.message)}</p>`;
  }
}

// Export
async function exportTemplates() {
  if (!getApiKey()) return showToast('Please enter your API key', 'error');
  try {
    const result = await api('GET', '/templates/export');
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `templates-export-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${result.count} templates`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Import
function openImportModal() {
  document.getElementById('import-modal').classList.remove('hidden');
}

function closeImportModal() {
  document.getElementById('import-modal').classList.add('hidden');
  document.getElementById('import-form').reset();
}

document.getElementById('import-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!getApiKey()) return showToast('Please enter your API key', 'error');
  try {
    const jsonStr = document.getElementById('import-json').value.trim();
    const parsed = JSON.parse(jsonStr);
    const templates = parsed.templates || parsed;
    const overwrite = document.getElementById('import-overwrite').checked;

    const result = await api('POST', '/templates/import', { templates, overwrite });
    showToast(`Import: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`, 'success');
    closeImportModal();
    loadTemplates();
  } catch (err) {
    showToast(err.message || 'Invalid JSON format', 'error');
  }
});

document.getElementById('template-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!getApiKey()) return showToast('Please enter your API key', 'error');

  const id = document.getElementById('template-id').value;
  const vars = document.getElementById('tpl-variables').value.split(',').map(v => v.trim()).filter(Boolean);

  const body = {
    name: document.getElementById('tpl-name').value,
    subject: document.getElementById('tpl-subject').value,
    bodyHtml: document.getElementById('tpl-html').value,
    bodyText: document.getElementById('tpl-text').value || null,
    description: document.getElementById('tpl-description').value || null,
    variables: vars.length > 0 ? vars : null
  };

  try {
    if (id) {
      await api('PUT', `/templates/${id}`, body);
      showToast('Template updated', 'success');
    } else {
      await api('POST', '/templates', body);
      showToast('Template created', 'success');
    }
    closeTemplateModal();
    loadTemplates();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ========== Image Upload & Gallery ==========

async function uploadImageFile(file) {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch('/images', {
    method: 'POST',
    headers: { 'x-api-key': getApiKey() },
    body: formData
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Upload failed');
  }
  return response.json();
}

async function uploadMultipleImages(files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('images', file);
  }

  const response = await fetch('/images/bulk', {
    method: 'POST',
    headers: { 'x-api-key': getApiKey() },
    body: formData
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Upload failed');
  }
  return response.json();
}

// Template modal image upload
document.getElementById('tpl-image-upload').addEventListener('change', async (e) => {
  const files = e.target.files;
  if (!files.length) return;
  if (!getApiKey()) return showToast('Please enter your API key', 'error');

  const progress = document.getElementById('tpl-upload-progress');
  const bar = document.getElementById('tpl-upload-bar');
  const text = document.getElementById('tpl-upload-text');
  progress.classList.remove('hidden');
  bar.style.width = '30%';
  text.textContent = `Uploading ${files.length} file(s)...`;

  try {
    let uploaded;
    if (files.length === 1) {
      const result = await uploadImageFile(files[0]);
      uploaded = [result];
    } else {
      const result = await uploadMultipleImages(files);
      uploaded = result.images;
    }

    bar.style.width = '100%';
    text.textContent = 'Done!';

    uploaded.forEach(img => addUploadedImageThumb(img.url || `/uploads/${img.filename}`, img.filename));

    showToast(`${uploaded.length} image(s) uploaded`, 'success');
    setTimeout(() => progress.classList.add('hidden'), 1500);
  } catch (err) {
    progress.classList.add('hidden');
    showToast(err.message, 'error');
  }

  e.target.value = '';
});

function addUploadedImageThumb(url, filename) {
  const container = document.getElementById('tpl-uploaded-images');
  const div = document.createElement('div');
  div.className = 'relative group';
  div.innerHTML = `
    <img src="${escapeHtml(url)}" alt="${escapeHtml(filename)}" class="w-16 h-16 object-cover rounded-lg border border-gray-200 cursor-pointer hover:ring-2 hover:ring-primary-500 transition-all" title="Click to insert into HTML" onclick="insertImageToHtml('${escapeHtml(url)}')">
    <button type="button" onclick="this.parentElement.remove()" class="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
  `;
  container.appendChild(div);
}

function insertImageToHtml(url) {
  const textarea = document.getElementById('tpl-html');
  const imgTag = `<img src="${url}" alt="" style="max-width:100%;height:auto;">`;
  const pos = textarea.selectionStart || textarea.value.length;
  textarea.value = textarea.value.slice(0, pos) + imgTag + textarea.value.slice(pos);
  textarea.focus();
  textarea.setSelectionRange(pos + imgTag.length, pos + imgTag.length);
  showToast('Image tag inserted into HTML body', 'success');
}

// Image Gallery
function openImageGallery() {
  document.getElementById('gallery-modal').classList.remove('hidden');
  loadGalleryImages();
}

function closeImageGallery() {
  document.getElementById('gallery-modal').classList.add('hidden');
}

async function loadGalleryImages() {
  if (!getApiKey()) return;
  const container = document.getElementById('gallery-images');
  container.innerHTML = '<p class="text-sm text-gray-500 col-span-full text-center py-8">Loading images...</p>';

  try {
    const result = await api('GET', '/images');

    if (!result.images || result.images.length === 0) {
      container.innerHTML = '<p class="text-sm text-gray-500 col-span-full text-center py-8">No images uploaded yet. Upload your first image above.</p>';
      return;
    }

    container.innerHTML = result.images.map(img => `
      <div class="relative group bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
        <img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.filename)}" class="w-full h-28 object-cover cursor-pointer hover:opacity-80 transition-opacity" onclick="selectGalleryImage('${escapeHtml(img.url)}')">
        <div class="p-2">
          <p class="text-xs text-gray-600 truncate" title="${escapeHtml(img.filename)}">${escapeHtml(img.filename)}</p>
          <p class="text-xs text-gray-400">${formatFileSize(img.size)}</p>
        </div>
        <div class="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onclick="copyImageUrl('${escapeHtml(img.url)}')" class="bg-white/90 hover:bg-white text-gray-700 rounded p-1 shadow-sm" title="Copy URL">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
          </button>
          <button onclick="deleteGalleryImage('${escapeHtml(img.filename)}')" class="bg-white/90 hover:bg-white text-red-600 rounded p-1 shadow-sm" title="Delete">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<p class="text-sm text-red-500 col-span-full text-center py-8">${escapeHtml(err.message)}</p>`;
  }
}

function selectGalleryImage(url) {
  insertImageToHtml(url);
  addUploadedImageThumb(url, url.split('/').pop());
  closeImageGallery();
}

function copyImageUrl(url) {
  const fullUrl = window.location.origin + url;
  navigator.clipboard.writeText(fullUrl).then(() => {
    showToast('Image URL copied', 'success');
  }).catch(() => {
    showToast('Failed to copy URL', 'error');
  });
}

async function deleteGalleryImage(filename) {
  if (!confirm(`Delete image "${filename}"?`)) return;
  try {
    await api('DELETE', `/images/${filename}`);
    showToast('Image deleted', 'success');
    loadGalleryImages();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Gallery upload
document.getElementById('gallery-upload-input').addEventListener('change', async (e) => {
  const files = e.target.files;
  if (!files.length) return;
  if (!getApiKey()) return showToast('Please enter your API key', 'error');

  const status = document.getElementById('gallery-upload-status');
  status.classList.remove('hidden');
  status.textContent = `Uploading ${files.length} file(s)...`;

  try {
    if (files.length === 1) {
      await uploadImageFile(files[0]);
    } else {
      await uploadMultipleImages(files);
    }
    status.textContent = `${files.length} file(s) uploaded successfully!`;
    showToast(`${files.length} image(s) uploaded`, 'success');
    loadGalleryImages();
    setTimeout(() => status.classList.add('hidden'), 2000);
  } catch (err) {
    status.classList.add('hidden');
    showToast(err.message, 'error');
  }

  e.target.value = '';
});

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ========== API Docs ==========

function initApiDocs() {
  // Set base URL
  const baseUrl = window.location.origin;
  const baseUrlEl = document.getElementById('api-base-url');
  if (baseUrlEl) baseUrlEl.textContent = baseUrl;

  // Replace {baseUrl} placeholders in code blocks
  document.querySelectorAll('#page-api-docs pre code').forEach(el => {
    el.innerHTML = el.innerHTML.replace(/\{baseUrl\}/g, baseUrl);
  });

  // Load template list for the docs
  loadDocTemplateList();
}

async function loadDocTemplateList() {
  const container = document.getElementById('doc-template-list');
  if (!container) return;
  if (!getApiKey()) {
    container.innerHTML = '<span class="text-xs text-gray-400">Enter API key to see templates</span>';
    return;
  }
  try {
    const templates = await api('GET', '/templates?active=true');
    if (templates.length === 0) {
      container.innerHTML = '<span class="text-xs text-gray-400">No templates yet</span>';
      return;
    }
    container.innerHTML = templates.map(t => {
      const vars = t.variables ? (typeof t.variables === 'string' ? JSON.parse(t.variables) : t.variables) : [];
      return `<div class="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
        <code class="text-xs font-mono font-semibold text-primary-700">${escapeHtml(t.name)}</code>
        <p class="text-xs text-gray-500 mt-0.5">${escapeHtml(t.subject)}</p>
        ${vars.length > 0 ? `<p class="text-xs text-gray-400 mt-0.5">vars: ${vars.map(v => `{{${v}}}`).join(', ')}</p>` : ''}
      </div>`;
    }).join('');
  } catch (err) {
    container.innerHTML = `<span class="text-xs text-red-500">${escapeHtml(err.message)}</span>`;
  }
}

function toggleDocSection(headerEl) {
  const body = headerEl.nextElementSibling;
  const chevron = headerEl.querySelector('.doc-chevron');
  if (body.classList.contains('hidden')) {
    body.classList.remove('hidden');
    if (chevron) chevron.style.transform = 'rotate(180deg)';
  } else {
    body.classList.add('hidden');
    if (chevron) chevron.style.transform = 'rotate(0deg)';
  }
}

function scrollToDoc(id) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Auto-expand if collapsed
    const body = el.querySelector('.doc-body');
    const chevron = el.querySelector('.doc-chevron');
    if (body && body.classList.contains('hidden')) {
      body.classList.remove('hidden');
      if (chevron) chevron.style.transform = 'rotate(180deg)';
    }
  }
}

function copyCodeBlock(btn) {
  const pre = btn.closest('.relative').querySelector('pre');
  const text = pre.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  }).catch(() => showToast('Failed to copy', 'error'));
}

// Bounces
async function loadBounces() {
  if (!getApiKey()) return showToast('Please enter your API key', 'error');

  const email = document.getElementById('bounce-search').value.trim();
  if (!email) return showToast('Enter an email to search', 'warning');

  try {
    const data = await api('GET', `/bounces/email/${encodeURIComponent(email)}`);
    const bounces = data.bounces || data;
    const tbody = document.getElementById('bounces-table-body');

    if (!bounces.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-12 text-center text-sm text-gray-500">No bounces found for this email</td></tr>';
      return;
    }

    tbody.innerHTML = bounces.map(b => `
      <tr class="hover:bg-gray-50 transition-colors">
        <td class="px-6 py-3 text-sm text-gray-900">${escapeHtml(b.email)}</td>
        <td class="px-6 py-3">${bounceTypeBadge(b.bounce_type)}</td>
        <td class="px-6 py-3 text-sm text-gray-600">${escapeHtml(b.bounce_subtype) || '-'}</td>
        <td class="px-6 py-3 text-sm text-gray-500 font-mono text-xs max-w-xs truncate">${escapeHtml(b.original_message_id) || '-'}</td>
        <td class="px-6 py-3 text-sm text-gray-500">${formatDate(b.created_at)}</td>
      </tr>
    `).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('bounce-search').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadBounces(); });

// Suppression List
async function loadSuppressionList() {
  if (!getApiKey()) {
    document.getElementById('suppression-table-body').innerHTML = '<tr><td colspan="4" class="px-6 py-12 text-center text-sm text-gray-500">Enter your API key to view suppression list</td></tr>';
    return;
  }

  try {
    const data = await api('GET', '/bounces/suppression');
    const items = data.items || data;
    const tbody = document.getElementById('suppression-table-body');

    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-12 text-center text-sm text-gray-500">Suppression list is empty</td></tr>';
      return;
    }

    tbody.innerHTML = items.map(s => `
      <tr class="hover:bg-gray-50 transition-colors">
        <td class="px-6 py-3 text-sm text-gray-900">${escapeHtml(s.email)}</td>
        <td class="px-6 py-3">${reasonBadge(s.reason)}</td>
        <td class="px-6 py-3 text-sm text-gray-500">${formatDate(s.created_at)}</td>
        <td class="px-6 py-3">
          <button onclick="removeFromSuppression('${escapeHtml(s.email)}')" class="text-xs text-red-600 hover:text-red-800 font-medium transition-colors">Remove</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function removeFromSuppression(email) {
  if (!confirm(`Remove ${email} from suppression list?`)) return;
  try {
    await api('DELETE', `/bounces/suppression/${encodeURIComponent(email)}`);
    showToast(`${email} removed from suppression list`, 'success');
    loadSuppressionList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openSuppressionModal() {
  document.getElementById('suppression-modal').classList.remove('hidden');
}

function closeSuppressionModal() {
  document.getElementById('suppression-modal').classList.add('hidden');
  document.getElementById('suppression-form').reset();
}

document.getElementById('suppression-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!getApiKey()) return showToast('Please enter your API key', 'error');

  const body = {
    email: document.getElementById('suppress-email').value,
    reason: document.getElementById('suppress-reason').value,
    notes: document.getElementById('suppress-notes').value || undefined
  };

  try {
    await api('POST', '/bounces/suppression', body);
    showToast('Email added to suppression list', 'success');
    closeSuppressionModal();
    loadSuppressionList();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// =====================
// API Keys Management
// =====================
async function loadApiKeys() {
  if (!getApiKey()) {
    document.getElementById('api-keys-table-body').innerHTML = '<tr><td colspan="7" class="px-6 py-12 text-center text-sm text-gray-500">Enter your API key to manage keys</td></tr>';
    return;
  }

  try {
    const keys = await api('GET', '/api-keys');
    const tbody = document.getElementById('api-keys-table-body');

    if (!keys.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-12 text-center text-sm text-gray-500">No API keys found</td></tr>';
      return;
    }

    tbody.innerHTML = keys.map(k => `
      <tr class="hover:bg-gray-50 transition-colors">
        <td class="px-6 py-3 text-sm font-medium text-gray-900">${escapeHtml(k.key_name)}</td>
        <td class="px-6 py-3 text-sm text-gray-500 font-mono text-xs">${escapeHtml(k.api_key)}</td>
        <td class="px-6 py-3">${k.is_active
          ? '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>'
          : '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Revoked</span>'
        }</td>
        <td class="px-6 py-3 text-sm text-gray-600">${k.rate_limit}/min</td>
        <td class="px-6 py-3 text-sm text-gray-500">${formatDate(k.last_used_at)}</td>
        <td class="px-6 py-3 text-sm text-gray-500">${k.expires_at ? formatDate(k.expires_at) : 'Never'}</td>
        <td class="px-6 py-3">
          <div class="flex items-center gap-2">
            ${k.is_active ? `<button onclick="revokeApiKeyById(${k.id})" class="text-xs text-yellow-600 hover:text-yellow-800 font-medium transition-colors">Revoke</button>` : ''}
            <button onclick="deleteApiKeyById(${k.id}, '${escapeHtml(k.key_name)}')" class="text-xs text-red-600 hover:text-red-800 font-medium transition-colors">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openApiKeyModal() {
  document.getElementById('apikey-modal').classList.remove('hidden');
}

function closeApiKeyModal() {
  document.getElementById('apikey-modal').classList.add('hidden');
  document.getElementById('apikey-form').reset();
}

function copyApiKey() {
  const input = document.getElementById('ak-result-key');
  navigator.clipboard.writeText(input.value).then(() => showToast('API key copied to clipboard', 'success'));
}

document.getElementById('apikey-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const body = {
    keyName: document.getElementById('ak-name').value,
    rateLimit: parseInt(document.getElementById('ak-rate-limit').value) || 100
  };

  const expiresVal = document.getElementById('ak-expires').value;
  if (expiresVal) body.expiresAt = new Date(expiresVal).toISOString();

  try {
    const result = await api('POST', '/api-keys', body);
    closeApiKeyModal();
    // Show the generated key
    document.getElementById('ak-result-key').value = result.apiKey;
    document.getElementById('apikey-result-modal').classList.remove('hidden');
    // Auto-set the API key if none is currently active
    if (!getApiKey() && result.apiKey) {
      localStorage.setItem('mail-service-api-key', result.apiKey);
    }
    loadApiKeys();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

async function revokeApiKeyById(id) {
  if (!confirm('Revoke this API key?')) return;
  try {
    await api('PATCH', `/api-keys/${id}/revoke`);
    showToast('API key revoked', 'success');
    loadApiKeys();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteApiKeyById(id, name) {
  if (!confirm(`Delete API key "${name}"?`)) return;
  try {
    await api('DELETE', `/api-keys/${id}`);
    showToast('API key deleted', 'success');
    loadApiKeys();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// =====================
// Webhooks Management
// =====================
async function loadWebhooks() {
  if (!getApiKey()) {
    document.getElementById('webhooks-grid').innerHTML = '<p class="text-sm text-gray-500 col-span-full text-center py-12">Enter your API key to manage webhooks</p>';
    return;
  }

  try {
    const webhooks = await api('GET', '/webhooks');

    if (!webhooks.length) {
      document.getElementById('webhooks-grid').innerHTML = '<p class="text-sm text-gray-500 col-span-full text-center py-12">No webhooks configured</p>';
      return;
    }

    document.getElementById('webhooks-grid').innerHTML = webhooks.map(w => `
      <div class="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
        <div class="flex items-start justify-between mb-3">
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 truncate">${escapeHtml(w.url)}</p>
            <p class="text-xs text-gray-500 mt-0.5">ID: ${w.id}</p>
          </div>
          <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${w.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">
            ${w.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div class="flex flex-wrap gap-1 mb-3">
          ${(w.events || []).map(ev =>
            `<span class="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-mono">${escapeHtml(ev)}</span>`
          ).join('')}
        </div>
        <div class="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
          <div>Failures: <span class="font-medium ${w.failure_count > 0 ? 'text-red-600' : 'text-gray-900'}">${w.failure_count}</span></div>
          <div>Last triggered: <span class="font-medium text-gray-900">${w.last_triggered_at ? formatDate(w.last_triggered_at) : 'Never'}</span></div>
        </div>
        <div class="flex items-center gap-2 pt-3 border-t border-gray-100">
          <button onclick="testWebhook(${w.id})" class="text-xs text-primary-600 hover:text-primary-800 font-medium transition-colors">Test</button>
          <span class="text-gray-300">|</span>
          <button onclick="editWebhook(${w.id})" class="text-xs text-primary-600 hover:text-primary-800 font-medium transition-colors">Edit</button>
          <span class="text-gray-300">|</span>
          <button onclick="deleteWebhook(${w.id})" class="text-xs text-red-600 hover:text-red-800 font-medium transition-colors">Delete</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openWebhookModal(wh = null) {
  document.getElementById('webhook-modal').classList.remove('hidden');
  document.getElementById('webhook-modal-title').textContent = wh ? 'Edit Webhook' : 'Add Webhook';
  document.getElementById('wh-id').value = wh ? wh.id : '';
  document.getElementById('wh-url').value = wh ? wh.url : '';
  document.getElementById('wh-secret').value = '';

  // Set event checkboxes
  document.querySelectorAll('input[name="wh-events"]').forEach(cb => {
    cb.checked = wh ? (wh.events || []).includes(cb.value) : false;
  });
}

function closeWebhookModal() {
  document.getElementById('webhook-modal').classList.add('hidden');
  document.getElementById('webhook-form').reset();
}

async function editWebhook(id) {
  try {
    const wh = await api('GET', `/webhooks/${id}`);
    openWebhookModal(wh);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteWebhook(id) {
  if (!confirm('Delete this webhook?')) return;
  try {
    await api('DELETE', `/webhooks/${id}`);
    showToast('Webhook deleted', 'success');
    loadWebhooks();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function testWebhook(id) {
  try {
    await api('POST', `/webhooks/${id}/test`);
    showToast('Test webhook sent', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('webhook-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!getApiKey()) return showToast('Please enter your API key', 'error');

  const events = Array.from(document.querySelectorAll('input[name="wh-events"]:checked')).map(cb => cb.value);
  if (events.length === 0) return showToast('Select at least one event', 'error');

  const id = document.getElementById('wh-id').value;
  const body = {
    url: document.getElementById('wh-url').value,
    events
  };

  const secret = document.getElementById('wh-secret').value;
  if (secret) body.secret = secret;

  try {
    if (id) {
      await api('PUT', `/webhooks/${id}`, body);
      showToast('Webhook updated', 'success');
    } else {
      const result = await api('POST', '/webhooks', body);
      showToast('Webhook created', 'success');
    }
    closeWebhookModal();
    loadWebhooks();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
});
