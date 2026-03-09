// ==========================================
// Campaigns & Automations Frontend Logic
// ==========================================

// --- Campaign Status Badge ---
function campaignStatusBadge(status) {
  const colors = {
    draft: 'bg-gray-100 text-gray-700',
    scheduled: 'bg-blue-100 text-blue-700',
    sending: 'bg-yellow-100 text-yellow-700',
    paused: 'bg-orange-100 text-orange-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700'
  };
  return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-700'}">${status}</span>`;
}

// ==========================================
// CAMPAIGNS
// ==========================================

async function loadCampaigns() {
  try {
    const status = document.getElementById('campaign-filter-status').value;
    const search = document.getElementById('campaign-filter-search').value;
    let url = '/campaigns?limit=50';
    if (status) url += `&status=${status}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const data = await api('GET', url);
    const campaigns = data.campaigns || [];

    // Update stats
    const total = data.total || campaigns.length;
    const active = campaigns.filter(c => c.status === 'sending').length;
    const completed = campaigns.filter(c => c.status === 'completed').length;
    const draft = campaigns.filter(c => c.status === 'draft').length;

    document.getElementById('camp-stat-total').textContent = total;
    document.getElementById('camp-stat-active').textContent = active;
    document.getElementById('camp-stat-completed').textContent = completed;
    document.getElementById('camp-stat-draft').textContent = draft;

    const tbody = document.getElementById('campaign-table-body');
    if (campaigns.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-12 text-center text-sm text-gray-500">No campaigns yet. Create your first campaign!</td></tr>';
      return;
    }

    tbody.innerHTML = campaigns.map(c => {
      const openRate = c.sent_count > 0 ? ((c.open_count / c.sent_count) * 100).toFixed(1) + '%' : '-';
      const clickRate = c.sent_count > 0 ? ((c.click_count / c.sent_count) * 100).toFixed(1) + '%' : '-';
      return `<tr class="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onclick="viewCampaign(${c.id})">
        <td class="px-6 py-4">
          <p class="text-sm font-medium text-gray-900">${escapeHtml(c.campaign_name)}</p>
          <p class="text-xs text-gray-500">${escapeHtml(c.subject)}</p>
        </td>
        <td class="px-6 py-4">${campaignStatusBadge(c.status)}</td>
        <td class="px-6 py-4 text-sm text-gray-700">${c.sent_count} / ${c.total_recipients}</td>
        <td class="px-6 py-4 text-sm text-gray-700">${openRate}</td>
        <td class="px-6 py-4 text-sm text-gray-700">${clickRate}</td>
        <td class="px-6 py-4 text-sm text-gray-500">${formatDate(c.created_at)}</td>
        <td class="px-6 py-4 text-right">
          <div class="flex items-center justify-end gap-1">
            ${c.status === 'draft' ? `<button onclick="event.stopPropagation(); sendCampaignNow(${c.id})" class="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100" title="Send Now">Send</button>` : ''}
            <button onclick="event.stopPropagation(); duplicateCampaign(${c.id})" class="text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded hover:bg-gray-100" title="Duplicate">Copy</button>
            ${c.status === 'draft' ? `<button onclick="event.stopPropagation(); deleteCampaign(${c.id})" class="text-xs bg-red-50 text-red-600 px-2 py-1 rounded hover:bg-red-100" title="Delete">Del</button>` : ''}
          </div>
        </td>
      </tr>`;
    }).join('');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function showCreateCampaignForm() {
  showPage('campaign-create');
}

async function initCampaignCreateForm() {
  // Load templates - API returns array directly
  try {
    const templates = await api('GET', '/templates');
    const sel = document.getElementById('camp-template');
    sel.innerHTML = '<option value="">Select a template...</option>';
    (Array.isArray(templates) ? templates : (templates.templates || [])).forEach(t => {
      sel.innerHTML += `<option value="${t.id}">${escapeHtml(t.name)} — ${escapeHtml(t.subject)}</option>`;
    });
  } catch (_) {}

  // Load lists - API returns array directly
  try {
    const lists = await api('GET', '/lists');
    const sel = document.getElementById('camp-list');
    sel.innerHTML = '<option value="">Select a list...</option>';
    (Array.isArray(lists) ? lists : (lists.lists || [])).forEach(l => {
      sel.innerHTML += `<option value="${l.id}">${escapeHtml(l.name)}</option>`;
    });
  } catch (_) {}
}

async function submitCreateCampaign(e) {
  e.preventDefault();
  try {
    let templateData = null;
    const tdVal = document.getElementById('camp-template-data').value.trim();
    if (tdVal) {
      try { templateData = JSON.parse(tdVal); } catch (_) { showToast('Invalid template variables JSON', 'error'); return; }
    }

    const body = {
      campaignName: document.getElementById('camp-name').value,
      subject: document.getElementById('camp-subject').value,
      templateId: parseInt(document.getElementById('camp-template').value),
      listId: parseInt(document.getElementById('camp-list').value),
      senderEmail: document.getElementById('camp-from').value || undefined,
      replyTo: document.getElementById('camp-replyto').value || undefined,
      templateData
    };

    const data = await api('POST', '/campaigns', body);
    showToast('Campaign created!', 'success');

    const schedAt = document.getElementById('camp-schedule').value;
    if (schedAt && data.campaign) {
      await api('POST', `/campaigns/${data.campaign.id}/schedule`, { scheduledAt: new Date(schedAt).toISOString() });
      showToast('Campaign scheduled!', 'success');
    }

    showPage('campaigns');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function viewCampaign(id) {
  try {
    const { campaign } = await api('GET', `/campaigns/${id}`);
    const { analytics } = await api('GET', `/campaigns/${id}/analytics`);

    document.getElementById('campaign-detail-name').textContent = campaign.campaign_name;
    document.getElementById('campaign-detail-subject').textContent = campaign.subject;

    // Action buttons
    const actionsDiv = document.getElementById('campaign-detail-actions');
    let actions = '';
    if (campaign.status === 'draft') actions += `<button onclick="sendCampaignNow(${id})" class="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700">Send Now</button>`;
    if (campaign.status === 'sending') actions += `<button onclick="pauseCampaign(${id})" class="bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-yellow-700">Pause</button>`;
    if (campaign.status === 'paused') actions += `<button onclick="resumeCampaign(${id})" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Resume</button>`;
    if (['draft', 'scheduled', 'sending', 'paused'].includes(campaign.status)) {
      actions += `<button onclick="cancelCampaign(${id})" class="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700">Cancel</button>`;
    }
    actions += `<button onclick="duplicateCampaign(${id})" class="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Duplicate</button>`;
    actionsDiv.innerHTML = actions;

    // Analytics cards
    const cards = document.getElementById('campaign-analytics-cards');
    cards.innerHTML = `
      <div class="bg-white rounded-lg border p-3 text-center">
        <p class="text-xs text-gray-500">Status</p>
        <p class="mt-1">${campaignStatusBadge(campaign.status)}</p>
      </div>
      <div class="bg-white rounded-lg border p-3 text-center">
        <p class="text-xs text-gray-500">Recipients</p>
        <p class="text-lg font-bold text-gray-900">${analytics.total_recipients}</p>
      </div>
      <div class="bg-white rounded-lg border p-3 text-center">
        <p class="text-xs text-gray-500">Sent</p>
        <p class="text-lg font-bold text-green-600">${analytics.sent}</p>
      </div>
      <div class="bg-white rounded-lg border p-3 text-center">
        <p class="text-xs text-gray-500">Open Rate</p>
        <p class="text-lg font-bold text-blue-600">${analytics.open_rate}%</p>
      </div>
      <div class="bg-white rounded-lg border p-3 text-center">
        <p class="text-xs text-gray-500">Click Rate</p>
        <p class="text-lg font-bold text-purple-600">${analytics.click_rate}%</p>
      </div>
      <div class="bg-white rounded-lg border p-3 text-center">
        <p class="text-xs text-gray-500">Bounced</p>
        <p class="text-lg font-bold text-yellow-600">${analytics.bounced}</p>
      </div>
      <div class="bg-white rounded-lg border p-3 text-center">
        <p class="text-xs text-gray-500">Unsubs</p>
        <p class="text-lg font-bold text-red-600">${analytics.unsubscribed}</p>
      </div>
    `;

    // Store analytics for tabs
    window._currentCampaign = campaign;
    window._currentAnalytics = analytics;

    // Show page and overview tab
    showPage('campaign-detail');
    showCampaignTab('overview');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function showCampaignTab(tab) {
  document.querySelectorAll('.camp-tab').forEach(t => {
    t.classList.remove('text-primary-600', 'border-b-2', 'border-primary-600');
    t.classList.add('text-gray-500');
  });
  const activeTab = document.getElementById(`camp-tab-${tab}`);
  if (activeTab) {
    activeTab.classList.add('text-primary-600', 'border-b-2', 'border-primary-600');
    activeTab.classList.remove('text-gray-500');
  }

  const content = document.getElementById('campaign-tab-content');
  const analytics = window._currentAnalytics;
  const campaign = window._currentCampaign;

  if (tab === 'overview') {
    let topLinksHtml = '';
    if (analytics.top_links && analytics.top_links.length > 0) {
      topLinksHtml = `<div class="bg-white rounded-xl border border-gray-200 p-6 mt-4">
        <h4 class="text-sm font-semibold text-gray-900 mb-3">Top Clicked Links</h4>
        <div class="space-y-2">
          ${analytics.top_links.map(l => `<div class="flex items-center justify-between text-sm">
            <span class="text-gray-600 truncate max-w-md">${escapeHtml(l.link_url)}</span>
            <span class="font-medium text-gray-900">${l.clicks} clicks</span>
          </div>`).join('')}
        </div>
      </div>`;
    }

    let hourlyHtml = '';
    if (analytics.hourly_opens && analytics.hourly_opens.length > 0) {
      const maxCount = Math.max(...analytics.hourly_opens.map(h => h.count));
      hourlyHtml = `<div class="bg-white rounded-xl border border-gray-200 p-6 mt-4">
        <h4 class="text-sm font-semibold text-gray-900 mb-3">Hourly Opens</h4>
        <div class="flex items-end gap-1 h-32">
          ${analytics.hourly_opens.map(h => {
            const pct = maxCount > 0 ? (h.count / maxCount * 100) : 0;
            return `<div class="flex-1 flex flex-col items-center">
              <div class="w-full bg-blue-200 rounded-t" style="height:${Math.max(pct, 2)}%" title="${h.hour}:00 - ${h.count} opens"></div>
              <span class="text-xs text-gray-400 mt-1">${h.hour}</span>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }

    content.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-white rounded-xl border border-gray-200 p-6">
          <h4 class="text-sm font-semibold text-gray-900 mb-3">Campaign Info</h4>
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between"><dt class="text-gray-500">Subject</dt><dd class="text-gray-900 font-medium">${escapeHtml(campaign.subject)}</dd></div>
            <div class="flex justify-between"><dt class="text-gray-500">Sender</dt><dd class="text-gray-900">${escapeHtml(campaign.sender_email || 'Default')}</dd></div>
            <div class="flex justify-between"><dt class="text-gray-500">Created</dt><dd class="text-gray-900">${formatDate(campaign.created_at)}</dd></div>
            ${campaign.scheduled_at ? `<div class="flex justify-between"><dt class="text-gray-500">Scheduled</dt><dd class="text-gray-900">${formatDate(campaign.scheduled_at)}</dd></div>` : ''}
            ${campaign.started_at ? `<div class="flex justify-between"><dt class="text-gray-500">Started</dt><dd class="text-gray-900">${formatDate(campaign.started_at)}</dd></div>` : ''}
            ${campaign.completed_at ? `<div class="flex justify-between"><dt class="text-gray-500">Completed</dt><dd class="text-gray-900">${formatDate(campaign.completed_at)}</dd></div>` : ''}
          </dl>
        </div>
        <div class="bg-white rounded-xl border border-gray-200 p-6">
          <h4 class="text-sm font-semibold text-gray-900 mb-3">Delivery Breakdown</h4>
          <div class="space-y-2">
            ${(analytics.delivery_breakdown || []).map(d => `<div class="flex items-center justify-between text-sm">
              <span>${campaignStatusBadge(d.status)}</span>
              <span class="font-medium text-gray-900">${d.count}</span>
            </div>`).join('')}
          </div>
        </div>
      </div>
      ${topLinksHtml}
      ${hourlyHtml}
    `;
  } else if (tab === 'recipients') {
    loadCampaignRecipients(campaign.id);
  } else if (tab === 'activity') {
    loadCampaignActivity(campaign.id);
  }
}

async function loadCampaignRecipients(campaignId) {
  const content = document.getElementById('campaign-tab-content');
  try {
    const data = await api('GET', `/campaigns/${campaignId}/recipients?limit=100`);
    const recipients = data.recipients || [];
    if (recipients.length === 0) {
      content.innerHTML = '<div class="bg-white rounded-xl border p-6 text-center text-sm text-gray-500">No recipients yet. Population happens when the campaign is sent.</div>';
      return;
    }
    content.innerHTML = `<div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table class="w-full"><thead><tr class="bg-gray-50 border-b">
        <th class="text-left px-4 py-2 text-xs font-semibold text-gray-500">Email</th>
        <th class="text-left px-4 py-2 text-xs font-semibold text-gray-500">Name</th>
        <th class="text-left px-4 py-2 text-xs font-semibold text-gray-500">Status</th>
        <th class="text-left px-4 py-2 text-xs font-semibold text-gray-500">Opens</th>
        <th class="text-left px-4 py-2 text-xs font-semibold text-gray-500">Clicks</th>
        <th class="text-left px-4 py-2 text-xs font-semibold text-gray-500">Sent At</th>
      </tr></thead><tbody>
        ${recipients.map(r => `<tr class="border-b border-gray-100">
          <td class="px-4 py-2 text-sm text-gray-900">${escapeHtml(r.email)}</td>
          <td class="px-4 py-2 text-sm text-gray-600">${escapeHtml((r.first_name || '') + ' ' + (r.last_name || ''))}</td>
          <td class="px-4 py-2">${campaignStatusBadge(r.status)}</td>
          <td class="px-4 py-2 text-sm text-gray-700">${r.open_count}</td>
          <td class="px-4 py-2 text-sm text-gray-700">${r.click_count}</td>
          <td class="px-4 py-2 text-sm text-gray-500">${formatDate(r.sent_at)}</td>
        </tr>`).join('')}
      </tbody></table>
    </div>`;
  } catch (error) {
    content.innerHTML = `<div class="bg-white rounded-xl border p-6 text-center text-sm text-red-500">${error.message}</div>`;
  }
}

async function loadCampaignActivity(campaignId) {
  const content = document.getElementById('campaign-tab-content');
  try {
    const data = await api('GET', `/track/campaign/${campaignId}/events?limit=100`);
    const events = data.events || [];
    if (events.length === 0) {
      content.innerHTML = '<div class="bg-white rounded-xl border p-6 text-center text-sm text-gray-500">No tracking events yet.</div>';
      return;
    }
    content.innerHTML = `<div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table class="w-full"><thead><tr class="bg-gray-50 border-b">
        <th class="text-left px-4 py-2 text-xs font-semibold text-gray-500">Time</th>
        <th class="text-left px-4 py-2 text-xs font-semibold text-gray-500">Email</th>
        <th class="text-left px-4 py-2 text-xs font-semibold text-gray-500">Event</th>
        <th class="text-left px-4 py-2 text-xs font-semibold text-gray-500">Link</th>
      </tr></thead><tbody>
        ${events.map(e => `<tr class="border-b border-gray-100">
          <td class="px-4 py-2 text-sm text-gray-500">${formatDate(e.created_at)}</td>
          <td class="px-4 py-2 text-sm text-gray-900">${escapeHtml(e.email)}</td>
          <td class="px-4 py-2"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${e.event_type === 'open' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}">${e.event_type}</span></td>
          <td class="px-4 py-2 text-sm text-gray-500 truncate max-w-xs">${e.link_url ? escapeHtml(e.link_url) : '-'}</td>
        </tr>`).join('')}
      </tbody></table>
    </div>`;
  } catch (error) {
    content.innerHTML = `<div class="bg-white rounded-xl border p-6 text-center text-sm text-red-500">${error.message}</div>`;
  }
}

// --- Campaign Actions ---
async function sendCampaignNow(id) {
  if (!confirm('Send this campaign now?')) return;
  try {
    await api('POST', `/campaigns/${id}/send`);
    showToast('Campaign is now sending!', 'success');
    loadCampaigns();
  } catch (error) { showToast(error.message, 'error'); }
}

async function pauseCampaign(id) {
  try {
    await api('POST', `/campaigns/${id}/pause`);
    showToast('Campaign paused', 'info');
    viewCampaign(id);
  } catch (error) { showToast(error.message, 'error'); }
}

async function resumeCampaign(id) {
  try {
    await api('POST', `/campaigns/${id}/resume`);
    showToast('Campaign resumed', 'success');
    viewCampaign(id);
  } catch (error) { showToast(error.message, 'error'); }
}

async function cancelCampaign(id) {
  if (!confirm('Cancel this campaign?')) return;
  try {
    await api('POST', `/campaigns/${id}/cancel`);
    showToast('Campaign cancelled', 'info');
    viewCampaign(id);
  } catch (error) { showToast(error.message, 'error'); }
}

async function duplicateCampaign(id) {
  try {
    await api('POST', `/campaigns/${id}/duplicate`);
    showToast('Campaign duplicated!', 'success');
    loadCampaigns();
    showPage('campaigns');
  } catch (error) { showToast(error.message, 'error'); }
}

async function deleteCampaign(id) {
  if (!confirm('Delete this draft campaign?')) return;
  try {
    await api('DELETE', `/campaigns/${id}`);
    showToast('Campaign deleted', 'success');
    loadCampaigns();
  } catch (error) { showToast(error.message, 'error'); }
}


// ==========================================
// AUTOMATIONS
// ==========================================

async function loadAutomations() {
  try {
    const data = await api('GET', '/automations');
    const automations = data.automations || [];

    const tbody = document.getElementById('automation-table-body');
    if (automations.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-12 text-center text-sm text-gray-500">No automations yet. Create your first automation!</td></tr>';
      return;
    }

    tbody.innerHTML = automations.map(a => {
      const activeLabel = a.is_active
        ? '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>'
        : '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Inactive</span>';
      return `<tr class="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onclick="viewAutomation(${a.id})">
        <td class="px-6 py-4">
          <p class="text-sm font-medium text-gray-900">${escapeHtml(a.name)}</p>
          <p class="text-xs text-gray-500">${escapeHtml(a.description || '')}</p>
        </td>
        <td class="px-6 py-4"><span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">${a.trigger_type}</span></td>
        <td class="px-6 py-4">${activeLabel}</td>
        <td class="px-6 py-4 text-sm text-gray-700">${a.total_entered}</td>
        <td class="px-6 py-4 text-sm text-gray-700">${a.total_completed}</td>
        <td class="px-6 py-4 text-right">
          <div class="flex items-center justify-end gap-1">
            <button onclick="event.stopPropagation(); toggleAutomation(${a.id})" class="text-xs ${a.is_active ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'} px-2 py-1 rounded hover:opacity-80">${a.is_active ? 'Deactivate' : 'Activate'}</button>
            <button onclick="event.stopPropagation(); deleteAutomation(${a.id})" class="text-xs bg-red-50 text-red-600 px-2 py-1 rounded hover:bg-red-100">Delete</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function showCreateAutomationForm() {
  showPage('automation-create');
}

async function submitCreateAutomation(e) {
  e.preventDefault();
  try {
    let triggerConfig = null;
    const tcVal = document.getElementById('auto-trigger-config').value.trim();
    if (tcVal) {
      try { triggerConfig = JSON.parse(tcVal); } catch (_) { showToast('Invalid trigger config JSON', 'error'); return; }
    }

    const body = {
      name: document.getElementById('auto-name').value,
      description: document.getElementById('auto-desc').value || undefined,
      triggerType: document.getElementById('auto-trigger').value,
      triggerConfig
    };

    const data = await api('POST', '/automations', body);
    showToast('Automation created!', 'success');
    viewAutomation(data.automation.id);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function viewAutomation(id) {
  try {
    const data = await api('GET', `/automations/${id}`);
    const automation = data.automation;
    const steps = data.steps || [];

    window._currentAutomationId = id;

    document.getElementById('automation-detail-name').textContent = automation.name;
    document.getElementById('automation-detail-desc').textContent = automation.description || '';
    document.getElementById('auto-stat-trigger').textContent = automation.trigger_type;
    document.getElementById('auto-stat-entered').textContent = automation.total_entered;
    document.getElementById('auto-stat-completed').textContent = automation.total_completed;

    // Action buttons
    const actionsDiv = document.getElementById('automation-detail-actions');
    const activeLabel = automation.is_active ? 'Deactivate' : 'Activate';
    const activeClass = automation.is_active ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700';
    actionsDiv.innerHTML = `
      <button onclick="toggleAutomation(${id})" class="${activeClass} text-white px-4 py-2 rounded-lg text-sm font-medium">${activeLabel}</button>
      <button onclick="deleteAutomation(${id})" class="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700">Delete</button>
    `;

    // Steps
    const stepsDiv = document.getElementById('automation-steps-list');
    if (steps.length === 0) {
      stepsDiv.innerHTML = '<p class="text-sm text-gray-500">No steps configured yet. Add steps to build your workflow.</p>';
    } else {
      stepsDiv.innerHTML = steps.map((s, i) => {
        const config = typeof s.config === 'string' ? JSON.parse(s.config) : s.config;
        const configStr = JSON.stringify(config, null, 0);
        const actionColors = {
          send_email: 'bg-blue-100 text-blue-700 border-blue-200',
          wait: 'bg-yellow-100 text-yellow-700 border-yellow-200',
          add_tag: 'bg-green-100 text-green-700 border-green-200',
          remove_tag: 'bg-red-100 text-red-700 border-red-200',
          move_to_list: 'bg-purple-100 text-purple-700 border-purple-200',
          condition: 'bg-gray-100 text-gray-700 border-gray-200'
        };
        return `<div class="flex items-center gap-3 p-3 border rounded-lg ${actionColors[s.action_type] || 'bg-gray-50 border-gray-200'}">
          <span class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white text-sm font-bold text-gray-700 border">${s.step_order}</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium">${s.action_type.replace(/_/g, ' ')}</p>
            <p class="text-xs opacity-75 truncate">${escapeHtml(configStr)}</p>
          </div>
          <button onclick="deleteAutomationStep(${s.id}, ${id})" class="text-xs opacity-60 hover:opacity-100 px-2 py-1">x</button>
        </div>
        ${i < steps.length - 1 ? '<div class="flex justify-center"><svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg></div>' : ''}`;
      }).join('');
    }

    // Set default step order for add form
    document.getElementById('step-order').value = steps.length + 1;

    // Load enrollments
    loadAutomationEnrollments(id);

    showPage('automation-detail');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadAutomationEnrollments(id) {
  try {
    const data = await api('GET', `/automations/${id}/enrollments?limit=20`);
    const enrollments = data.enrollments || [];
    const div = document.getElementById('automation-enrollments-list');

    if (enrollments.length === 0) {
      div.innerHTML = '<p class="text-sm text-gray-500">No contacts enrolled yet.</p>';
      return;
    }

    div.innerHTML = `<table class="w-full"><thead><tr class="border-b">
      <th class="text-left pb-2 text-xs font-semibold text-gray-500">Contact</th>
      <th class="text-left pb-2 text-xs font-semibold text-gray-500">Step</th>
      <th class="text-left pb-2 text-xs font-semibold text-gray-500">Status</th>
      <th class="text-left pb-2 text-xs font-semibold text-gray-500">Enrolled</th>
    </tr></thead><tbody>
      ${enrollments.map(e => `<tr class="border-b border-gray-100">
        <td class="py-2 text-sm text-gray-900">${escapeHtml(e.email || 'Unknown')}</td>
        <td class="py-2 text-sm text-gray-700">${e.current_step}</td>
        <td class="py-2">${campaignStatusBadge(e.status)}</td>
        <td class="py-2 text-sm text-gray-500">${formatDate(e.created_at)}</td>
      </tr>`).join('')}
    </tbody></table>`;
  } catch (error) {
    document.getElementById('automation-enrollments-list').innerHTML = `<p class="text-sm text-red-500">${error.message}</p>`;
  }
}

function showAddStepForm() {
  document.getElementById('add-step-form').classList.remove('hidden');
}

function updateStepConfigUI() {
  const type = document.getElementById('step-action-type').value;
  const configEl = document.getElementById('step-config');
  const placeholders = {
    send_email: '{"template":"welcome","data":{"key":"val"}}',
    wait: '{"duration":1,"unit":"days"}',
    add_tag: '{"tag":"VIP"}',
    remove_tag: '{"tag":"Lead"}',
    move_to_list: '{"listId":1}',
    condition: '{"field":"city","operator":"equals","value":"Mumbai"}'
  };
  configEl.placeholder = placeholders[type] || '{}';
}

async function submitAddStep() {
  try {
    let config;
    const configVal = document.getElementById('step-config').value.trim();
    try { config = configVal ? JSON.parse(configVal) : {}; } catch (_) { showToast('Invalid config JSON', 'error'); return; }

    await api('POST', `/automations/${window._currentAutomationId}/steps`, {
      stepOrder: parseInt(document.getElementById('step-order').value),
      actionType: document.getElementById('step-action-type').value,
      config
    });

    showToast('Step added!', 'success');
    document.getElementById('add-step-form').classList.add('hidden');
    viewAutomation(window._currentAutomationId);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function deleteAutomationStep(stepId, automationId) {
  if (!confirm('Delete this step?')) return;
  try {
    await api('DELETE', `/automations/${automationId}/steps/${stepId}`);
    showToast('Step deleted', 'success');
    viewAutomation(automationId);
  } catch (error) { showToast(error.message, 'error'); }
}

async function toggleAutomation(id) {
  try {
    const data = await api('PATCH', `/automations/${id}/toggle`);
    showToast(data.isActive ? 'Automation activated!' : 'Automation deactivated', 'success');
    // Refresh the current view
    if (document.getElementById('page-automation-detail') && !document.getElementById('page-automation-detail').classList.contains('hidden')) {
      viewAutomation(id);
    } else {
      loadAutomations();
    }
  } catch (error) { showToast(error.message, 'error'); }
}

async function deleteAutomation(id) {
  if (!confirm('Delete this automation and all its steps/enrollments?')) return;
  try {
    await api('DELETE', `/automations/${id}`);
    showToast('Automation deleted', 'success');
    showPage('automations');
  } catch (error) { showToast(error.message, 'error'); }
}
