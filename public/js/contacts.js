// =============================================
// Contacts & Lists Management
// =============================================

let contactsPage = 0;
const contactsLimit = 30;
let contactsTotal = 0;
let contactSearchTimer = null;

// ---- Load Contacts ----
async function loadContacts() {
  if (!getApiKey()) return showToast('Enter API key first', 'error');

  try {
    const search = document.getElementById('contacts-search')?.value || '';
    const status = document.getElementById('contacts-filter-status')?.value || '';
    const source = document.getElementById('contacts-filter-source')?.value || '';
    const offset = contactsPage * contactsLimit;

    const params = new URLSearchParams({ limit: contactsLimit, offset });
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (source) params.set('source', source);

    const [result, stats] = await Promise.all([
      api('GET', `/contacts?${params}`),
      api('GET', '/contacts/stats')
    ]);

    contactsTotal = result.total;
    renderContactsTable(result.contacts);
    renderContactsStats(stats);
    updateContactsPagination();
    loadSourceFilters();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderContactsStats(stats) {
  document.getElementById('contacts-stat-total').textContent = stats.total.toLocaleString();
  document.getElementById('contacts-stat-recent').textContent = stats.last30Days.toLocaleString();

  const sub = stats.byStatus.find(s => s.status === 'subscribed');
  const unsub = stats.byStatus.find(s => s.status === 'unsubscribed');
  document.getElementById('contacts-stat-subscribed').textContent = (sub?.count || 0).toLocaleString();
  document.getElementById('contacts-stat-unsub').textContent = (unsub?.count || 0).toLocaleString();
}

function renderContactsTable(contacts) {
  const tbody = document.getElementById('contacts-table-body');
  if (!contacts.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-12 text-gray-400">No contacts found</td></tr>';
    return;
  }

  tbody.innerHTML = contacts.map(c => {
    const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || '-';
    const tags = c.tags ? (typeof c.tags === 'string' ? JSON.parse(c.tags) : c.tags) : [];
    const statusColors = {
      subscribed: 'bg-green-100 text-green-700',
      unsubscribed: 'bg-orange-100 text-orange-700',
      bounced: 'bg-red-100 text-red-700',
      complained: 'bg-red-100 text-red-700'
    };
    const date = new Date(c.created_at).toLocaleDateString();

    return `<tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors">
      <td class="py-3 px-4 font-mono text-xs text-gray-900">${escapeHtml(c.email)}</td>
      <td class="py-3 px-4 text-gray-700">${escapeHtml(name)}</td>
      <td class="py-3 px-4 text-gray-500">${escapeHtml(c.city || '-')}</td>
      <td class="py-3 px-4"><span class="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">${escapeHtml(c.source || 'manual')}</span></td>
      <td class="py-3 px-4"><span class="text-xs px-2 py-0.5 rounded-full ${statusColors[c.status] || 'bg-gray-100 text-gray-600'}">${c.status}</span></td>
      <td class="py-3 px-4">${tags.length ? tags.map(t => `<span class="text-xs px-1.5 py-0.5 bg-primary-50 text-primary-700 rounded mr-1">${escapeHtml(t)}</span>`).join('') : '<span class="text-gray-300">-</span>'}</td>
      <td class="py-3 px-4 text-xs text-gray-400">${date}</td>
      <td class="py-3 px-4 text-right">
        <button onclick="editContact(${c.id})" class="text-gray-400 hover:text-primary-600 p-1" title="Edit"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
        <button onclick="deleteContactConfirm(${c.id},'${escapeHtml(c.email)}')" class="text-gray-400 hover:text-red-600 p-1" title="Delete"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
      </td>
    </tr>`;
  }).join('');
}

function updateContactsPagination() {
  const total = contactsTotal;
  const start = contactsPage * contactsLimit + 1;
  const end = Math.min(start + contactsLimit - 1, total);
  document.getElementById('contacts-count').textContent = total ? `${start}-${end} of ${total}` : '0 contacts';
  document.getElementById('contacts-prev-btn').disabled = contactsPage === 0;
  document.getElementById('contacts-next-btn').disabled = end >= total;
}

function contactsPagePrev() { if (contactsPage > 0) { contactsPage--; loadContacts(); } }
function contactsPageNext() { contactsPage++; loadContacts(); }

function debounceContactSearch() {
  clearTimeout(contactSearchTimer);
  contactSearchTimer = setTimeout(() => { contactsPage = 0; loadContacts(); }, 300);
}

async function loadSourceFilters() {
  try {
    const filters = await api('GET', '/contacts/filters');
    const sel = document.getElementById('contacts-filter-source');
    const current = sel.value;
    sel.innerHTML = '<option value="">All Sources</option>' +
      filters.sources.map(s => `<option value="${s}" ${s === current ? 'selected' : ''}>${s}</option>`).join('');
  } catch (_) { /* ignore */ }
}

// ---- Add Contact Modal ----
function openAddContactModal(contact) {
  const isEdit = !!contact;
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
  modal.id = 'contact-modal';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `<div class="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
    <div class="p-6 border-b border-gray-200 flex items-center justify-between">
      <h3 class="text-lg font-semibold text-gray-900">${isEdit ? 'Edit Contact' : 'Add Contact'}</h3>
      <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
    </div>
    <form onsubmit="submitContact(event,${isEdit ? contact.id : 'null'})" class="p-6 space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Email <span class="text-red-500">*</span></label>
          <input type="email" id="c-email" required value="${isEdit ? escapeHtml(contact.email) : ''}" ${isEdit ? 'readonly class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50"' : 'class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"'}></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input type="text" id="c-phone" value="${isEdit ? escapeHtml(contact.phone || '') : ''}" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"></div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div><label class="block text-sm font-medium text-gray-700 mb-1">First Name</label>
          <input type="text" id="c-fname" value="${isEdit ? escapeHtml(contact.first_name || '') : ''}" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
          <input type="text" id="c-lname" value="${isEdit ? escapeHtml(contact.last_name || '') : ''}" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"></div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div><label class="block text-sm font-medium text-gray-700 mb-1">City</label>
          <input type="text" id="c-city" value="${isEdit ? escapeHtml(contact.city || '') : ''}" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Country</label>
          <input type="text" id="c-country" value="${isEdit ? escapeHtml(contact.country || '') : ''}" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"></div>
      </div>
      <div><label class="block text-sm font-medium text-gray-700 mb-1">Company</label>
        <input type="text" id="c-company" value="${isEdit ? escapeHtml(contact.company || '') : ''}" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"></div>
      <div><label class="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
        <input type="text" id="c-tags" value="${isEdit && contact.tags ? (typeof contact.tags === 'string' ? JSON.parse(contact.tags) : contact.tags).join(', ') : ''}" placeholder="vip, newsletter, student" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"></div>
      ${isEdit ? `<div><label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <select id="c-status" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
          ${['subscribed','unsubscribed','bounced','complained'].map(s => `<option value="${s}" ${contact.status===s?'selected':''}>${s}</option>`).join('')}
        </select></div>` : ''}
      <div class="flex gap-3 justify-end pt-2">
        <button type="button" onclick="this.closest('.fixed').remove()" class="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
        <button type="submit" class="px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700">${isEdit ? 'Save Changes' : 'Add Contact'}</button>
      </div>
    </form>
  </div>`;
  document.body.appendChild(modal);
}

async function submitContact(e, id) {
  e.preventDefault();
  try {
    const tagsStr = document.getElementById('c-tags').value;
    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];
    const data = {
      firstName: document.getElementById('c-fname').value,
      lastName: document.getElementById('c-lname').value,
      phone: document.getElementById('c-phone').value,
      city: document.getElementById('c-city').value,
      country: document.getElementById('c-country').value,
      company: document.getElementById('c-company').value,
      tags
    };

    if (id) {
      const statusEl = document.getElementById('c-status');
      if (statusEl) data.status = statusEl.value;
      await api('PUT', `/contacts/${id}`, data);
      showToast('Contact updated');
    } else {
      data.email = document.getElementById('c-email').value;
      await api('POST', '/contacts', data);
      showToast('Contact added');
    }
    document.getElementById('contact-modal').remove();
    loadContacts();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function editContact(id) {
  try {
    const contact = await api('GET', `/contacts/${id}`);
    openAddContactModal(contact);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteContactConfirm(id, email) {
  if (!confirm(`Delete contact ${email}?`)) return;
  try {
    await api('DELETE', `/contacts/${id}`);
    showToast('Contact deleted');
    loadContacts();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---- Import Modal ----
function openImportModal() {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
  modal.id = 'import-modal';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `<div class="bg-white rounded-2xl w-full max-w-lg">
    <div class="p-6 border-b border-gray-200">
      <h3 class="text-lg font-semibold text-gray-900">Import Contacts</h3>
      <p class="text-sm text-gray-500 mt-1">Upload a CSV file with your contacts</p>
    </div>
    <form onsubmit="submitCsvImport(event)" class="p-6 space-y-4">
      <div class="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-primary-400 transition-colors">
        <svg class="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
        <input type="file" id="csv-file" accept=".csv" required class="text-sm">
        <p class="text-xs text-gray-400 mt-3">CSV must have header row. Required column: <strong>email</strong></p>
        <p class="text-xs text-gray-400">Optional: first_name, last_name, phone, city, country, company</p>
      </div>
      <div><label class="block text-sm font-medium text-gray-700 mb-1">Add to List (optional)</label>
        <select id="import-list-id" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
          <option value="">No list</option>
        </select>
      </div>
      <div class="flex gap-3 justify-end pt-2">
        <button type="button" onclick="this.closest('.fixed').remove()" class="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
        <button type="submit" id="import-btn" class="px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700">Import</button>
      </div>
    </form>
  </div>`;
  document.body.appendChild(modal);
  loadImportListOptions();
}

async function loadImportListOptions() {
  try {
    const lists = await api('GET', '/lists');
    const sel = document.getElementById('import-list-id');
    if (sel) {
      lists.forEach(l => {
        sel.innerHTML += `<option value="${l.id}">${escapeHtml(l.name)}</option>`;
      });
    }
  } catch (_) { /* ignore */ }
}

async function submitCsvImport(e) {
  e.preventDefault();
  const fileInput = document.getElementById('csv-file');
  const listId = document.getElementById('import-list-id').value;
  const btn = document.getElementById('import-btn');

  if (!fileInput.files[0]) return showToast('Select a CSV file', 'error');

  btn.disabled = true;
  btn.textContent = 'Importing...';

  try {
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    if (listId) formData.append('listId', listId);

    const headers = {};
    const apiKey = getApiKey();
    if (apiKey) headers['X-API-Key'] = apiKey;

    const res = await fetch('/contacts/import/csv', { method: 'POST', headers, body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Import failed');

    showToast(`Imported ${data.imported} contacts (${data.skipped} skipped)`);
    document.getElementById('import-modal').remove();
    loadContacts();
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Import';
  }
}

// =============================================
// Contact Lists
// =============================================

async function loadContactLists() {
  if (!getApiKey()) return showToast('Enter API key first', 'error');
  try {
    const [lists, segments] = await Promise.all([
      api('GET', '/lists'),
      api('GET', '/lists/segments/all')
    ]);
    renderLists(lists);
    renderSegments(segments);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderLists(lists) {
  const grid = document.getElementById('lists-grid');
  if (!lists.length) {
    grid.innerHTML = '<p class="text-sm text-gray-400 col-span-full text-center py-12">No lists yet. Create your first list!</p>';
    return;
  }
  grid.innerHTML = lists.map(l => `
    <div class="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full" style="background:${l.color || '#3b82f6'}"></div>
          <h4 class="font-semibold text-gray-900">${escapeHtml(l.name)}</h4>
        </div>
        <div class="flex gap-1">
          <button onclick="viewListMembers(${l.id},'${escapeHtml(l.name)}')" class="text-gray-400 hover:text-primary-600 p-1" title="View"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg></button>
          <button onclick="deleteListConfirm(${l.id},'${escapeHtml(l.name)}')" class="text-gray-400 hover:text-red-600 p-1" title="Delete"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
        </div>
      </div>
      <p class="text-sm text-gray-500 mb-3">${escapeHtml(l.description || 'No description')}</p>
      <div class="flex items-center gap-4 text-xs text-gray-400">
        <span class="flex items-center gap-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg> ${l.member_count} contacts</span>
        <span>${l.is_active ? '<span class="text-green-500">Active</span>' : '<span class="text-gray-400">Inactive</span>'}</span>
      </div>
    </div>
  `).join('');
}

function renderSegments(segments) {
  const grid = document.getElementById('segments-grid');
  if (!segments.length) {
    grid.innerHTML = '<p class="text-sm text-gray-400 col-span-full text-center py-12">No segments yet. Create dynamic contact groups!</p>';
    return;
  }
  grid.innerHTML = segments.map(s => {
    const conditions = typeof s.conditions === 'string' ? JSON.parse(s.conditions) : s.conditions;
    return `<div class="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div class="flex items-start justify-between mb-3">
        <h4 class="font-semibold text-gray-900">${escapeHtml(s.name)}</h4>
        <div class="flex gap-1">
          <button onclick="querySegmentView(${s.id},'${escapeHtml(s.name)}')" class="text-gray-400 hover:text-primary-600 p-1" title="Query"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></button>
          <button onclick="deleteSegmentConfirm(${s.id},'${escapeHtml(s.name)}')" class="text-gray-400 hover:text-red-600 p-1" title="Delete"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
        </div>
      </div>
      <p class="text-sm text-gray-500 mb-3">${escapeHtml(s.description || '')}</p>
      <div class="flex flex-wrap gap-1.5">
        ${conditions.map(c => `<span class="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded-full">${escapeHtml(c.field)} ${escapeHtml(c.operator)} ${escapeHtml(c.value || '')}</span>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function switchListTab(tab) {
  document.getElementById('tab-lists').className = 'px-4 py-2 rounded-md text-sm font-medium ' +
    (tab === 'lists' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700') + ' transition-colors';
  document.getElementById('tab-segments').className = 'px-4 py-2 rounded-md text-sm font-medium ' +
    (tab === 'segments' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700') + ' transition-colors';
  document.getElementById('tab-content-lists').classList.toggle('hidden', tab !== 'lists');
  document.getElementById('tab-content-segments').classList.toggle('hidden', tab !== 'segments');
}

// ---- Create List Modal ----
function openCreateListModal() {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
  modal.id = 'list-modal';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `<div class="bg-white rounded-2xl w-full max-w-md">
    <div class="p-6 border-b border-gray-200">
      <h3 class="text-lg font-semibold text-gray-900">Create List</h3>
    </div>
    <form onsubmit="submitCreateList(event)" class="p-6 space-y-4">
      <div><label class="block text-sm font-medium text-gray-700 mb-1">Name <span class="text-red-500">*</span></label>
        <input type="text" id="list-name" required placeholder="Newsletter Subscribers" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"></div>
      <div><label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <input type="text" id="list-desc" placeholder="Brief description" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"></div>
      <div><label class="block text-sm font-medium text-gray-700 mb-1">Color</label>
        <div class="flex gap-2">
          ${['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16'].map(c =>
            `<button type="button" onclick="document.getElementById('list-color').value='${c}';this.parentElement.querySelectorAll('button').forEach(b=>b.style.outline='');this.style.outline='2px solid #333'" class="w-7 h-7 rounded-full border-2 border-white shadow" style="background:${c}"></button>`
          ).join('')}
          <input type="hidden" id="list-color" value="#3b82f6">
        </div>
      </div>
      <div class="flex gap-3 justify-end pt-2">
        <button type="button" onclick="this.closest('.fixed').remove()" class="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
        <button type="submit" class="px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700">Create</button>
      </div>
    </form>
  </div>`;
  document.body.appendChild(modal);
}

async function submitCreateList(e) {
  e.preventDefault();
  try {
    await api('POST', '/lists', {
      name: document.getElementById('list-name').value,
      description: document.getElementById('list-desc').value,
      color: document.getElementById('list-color').value
    });
    showToast('List created!');
    document.getElementById('list-modal').remove();
    loadContactLists();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteListConfirm(id, name) {
  if (!confirm(`Delete list "${name}"? This will not delete the contacts.`)) return;
  try {
    await api('DELETE', `/lists/${id}`);
    showToast('List deleted');
    loadContactLists();
  } catch (err) { showToast(err.message, 'error'); }
}

// ---- View List Members ----
async function viewListMembers(listId, listName) {
  try {
    const result = await api('GET', `/lists/${listId}/members?limit=100`);
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    const rows = result.contacts.map(c => {
      const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || '-';
      return `<tr class="border-b border-gray-50"><td class="py-2 px-3 font-mono text-xs">${escapeHtml(c.email)}</td><td class="py-2 px-3 text-sm">${escapeHtml(name)}</td><td class="py-2 px-3 text-xs text-gray-400">${escapeHtml(c.city||'-')}</td><td class="py-2 px-3 text-right"><button onclick="removeFromList(${listId},${c.id},this)" class="text-red-400 hover:text-red-600 text-xs">Remove</button></td></tr>`;
    }).join('');

    modal.innerHTML = `<div class="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
      <div class="p-5 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <div><h3 class="text-lg font-semibold text-gray-900">${escapeHtml(listName)}</h3><p class="text-xs text-gray-500">${result.total} contacts</p></div>
        <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>
      <div class="flex-1 overflow-auto">
        <table class="w-full text-sm"><thead><tr class="bg-gray-50 border-b"><th class="text-left py-2 px-3 text-gray-500 font-medium">Email</th><th class="text-left py-2 px-3 text-gray-500 font-medium">Name</th><th class="text-left py-2 px-3 text-gray-500 font-medium">City</th><th class="text-right py-2 px-3"></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" class="text-center py-8 text-gray-400">No contacts in this list</td></tr>'}</tbody></table>
      </div>
    </div>`;
    document.body.appendChild(modal);
  } catch (err) { showToast(err.message, 'error'); }
}

async function removeFromList(listId, contactId, btn) {
  try {
    await api('DELETE', `/lists/${listId}/members/${contactId}`);
    btn.closest('tr').remove();
    showToast('Removed from list');
  } catch (err) { showToast(err.message, 'error'); }
}

// ---- Create Segment Modal ----
function openCreateSegmentModal() {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
  modal.id = 'segment-modal';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `<div class="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
    <div class="p-6 border-b border-gray-200">
      <h3 class="text-lg font-semibold text-gray-900">Create Segment</h3>
      <p class="text-sm text-gray-500 mt-1">Define conditions to dynamically group contacts</p>
    </div>
    <form onsubmit="submitCreateSegment(event)" class="p-6 space-y-4">
      <div><label class="block text-sm font-medium text-gray-700 mb-1">Segment Name <span class="text-red-500">*</span></label>
        <input type="text" id="seg-name" required placeholder="Active Mumbai Users" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"></div>
      <div><label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <input type="text" id="seg-desc" placeholder="Brief description" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"></div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Conditions</label>
        <div id="seg-conditions" class="space-y-2">
          <div class="seg-condition flex gap-2 items-center">
            <select class="seg-field border border-gray-300 rounded-lg px-2 py-1.5 text-sm flex-1" onchange="updateSegOperators(this)">
              <option value="status">Status</option>
              <option value="city">City</option>
              <option value="country">Country</option>
              <option value="source">Source</option>
              <option value="company">Company</option>
              <option value="email">Email</option>
              <option value="first_name">First Name</option>
            </select>
            <select class="seg-op border border-gray-300 rounded-lg px-2 py-1.5 text-sm flex-1">
              <option value="equals">equals</option>
              <option value="not_equals">not equals</option>
              <option value="contains">contains</option>
              <option value="starts_with">starts with</option>
              <option value="is_empty">is empty</option>
              <option value="is_not_empty">is not empty</option>
            </select>
            <input class="seg-val border border-gray-300 rounded-lg px-2 py-1.5 text-sm flex-1" placeholder="Value">
          </div>
        </div>
        <button type="button" onclick="addSegCondition()" class="text-xs text-primary-600 font-medium mt-2 hover:text-primary-700">+ Add condition</button>
      </div>
      <div id="seg-preview-area" class="hidden">
        <p class="text-sm font-medium text-gray-700 mb-1">Preview: <span id="seg-preview-count" class="text-primary-600"></span></p>
      </div>
      <div class="flex gap-3 justify-between pt-2">
        <button type="button" onclick="previewSegmentConditions()" class="px-3 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100">Preview Results</button>
        <div class="flex gap-3">
          <button type="button" onclick="this.closest('.fixed').remove()" class="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
          <button type="submit" class="px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700">Create Segment</button>
        </div>
      </div>
    </form>
  </div>`;
  document.body.appendChild(modal);
}

function addSegCondition() {
  const container = document.getElementById('seg-conditions');
  const div = document.createElement('div');
  div.className = 'seg-condition flex gap-2 items-center';
  div.innerHTML = `
    <select class="seg-field border border-gray-300 rounded-lg px-2 py-1.5 text-sm flex-1" onchange="updateSegOperators(this)">
      <option value="status">Status</option><option value="city">City</option><option value="country">Country</option>
      <option value="source">Source</option><option value="company">Company</option><option value="email">Email</option><option value="first_name">First Name</option>
    </select>
    <select class="seg-op border border-gray-300 rounded-lg px-2 py-1.5 text-sm flex-1">
      <option value="equals">equals</option><option value="not_equals">not equals</option><option value="contains">contains</option>
      <option value="starts_with">starts with</option><option value="is_empty">is empty</option><option value="is_not_empty">is not empty</option>
    </select>
    <input class="seg-val border border-gray-300 rounded-lg px-2 py-1.5 text-sm flex-1" placeholder="Value">
    <button type="button" onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-600 p-1"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>`;
  container.appendChild(div);
}

function updateSegOperators(el) { /* operators are common for all fields */ }

function getSegConditions() {
  const rows = document.querySelectorAll('.seg-condition');
  const conditions = [];
  rows.forEach(row => {
    const field = row.querySelector('.seg-field').value;
    const operator = row.querySelector('.seg-op').value;
    const value = row.querySelector('.seg-val').value;
    conditions.push({ field, operator, value });
  });
  return conditions;
}

async function previewSegmentConditions() {
  try {
    const conditions = getSegConditions();
    const result = await api('POST', '/lists/segments/preview?limit=5', { conditions });
    document.getElementById('seg-preview-area').classList.remove('hidden');
    document.getElementById('seg-preview-count').textContent = `${result.total} contacts match`;
  } catch (err) { showToast(err.message, 'error'); }
}

async function submitCreateSegment(e) {
  e.preventDefault();
  try {
    const conditions = getSegConditions();
    await api('POST', '/lists/segments', {
      name: document.getElementById('seg-name').value,
      description: document.getElementById('seg-desc').value,
      conditions
    });
    showToast('Segment created!');
    document.getElementById('segment-modal').remove();
    loadContactLists();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteSegmentConfirm(id, name) {
  if (!confirm(`Delete segment "${name}"?`)) return;
  try {
    await api('DELETE', `/lists/segments/${id}`);
    showToast('Segment deleted');
    loadContactLists();
  } catch (err) { showToast(err.message, 'error'); }
}

async function querySegmentView(id, name) {
  try {
    const result = await api('GET', `/lists/segments/${id}/query?limit=50`);
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    const rows = result.contacts.map(c => {
      const n = [c.first_name, c.last_name].filter(Boolean).join(' ') || '-';
      return `<tr class="border-b border-gray-50"><td class="py-2 px-3 font-mono text-xs">${escapeHtml(c.email)}</td><td class="py-2 px-3 text-sm">${escapeHtml(n)}</td><td class="py-2 px-3 text-xs">${escapeHtml(c.city||'-')}</td><td class="py-2 px-3 text-xs">${c.status}</td></tr>`;
    }).join('');

    modal.innerHTML = `<div class="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
      <div class="p-5 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <div><h3 class="text-lg font-semibold text-gray-900">${escapeHtml(name)}</h3><p class="text-xs text-gray-500">${result.total} matching contacts</p></div>
        <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>
      <div class="flex-1 overflow-auto">
        <table class="w-full text-sm"><thead><tr class="bg-gray-50 border-b"><th class="text-left py-2 px-3 text-gray-500 font-medium">Email</th><th class="text-left py-2 px-3 text-gray-500 font-medium">Name</th><th class="text-left py-2 px-3 text-gray-500 font-medium">City</th><th class="text-left py-2 px-3 text-gray-500 font-medium">Status</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" class="text-center py-8 text-gray-400">No matching contacts</td></tr>'}</tbody></table>
      </div>
    </div>`;
    document.body.appendChild(modal);
  } catch (err) { showToast(err.message, 'error'); }
}
