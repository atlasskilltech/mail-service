// =============================================
// Drag & Drop Email Template Editor
// =============================================

let editorBlocks = [];
let selectedBlockId = null;
let undoStack = [];
let redoStack = [];
let editorSettings = { bgColor: '#f4f4f7', contentBg: '#ffffff', width: 600 };
let dragSrcId = null;
let blockIdCounter = 0;

// ---- Block Defaults ----
const blockDefaults = {
  header: () => ({
    type: 'header',
    content: 'Your Company Name',
    props: { bgColor: '#667eea', textColor: '#ffffff', fontSize: '24', padding: '32', align: 'center', fontWeight: 'bold' }
  }),
  text: () => ({
    type: 'text',
    content: 'Write your text here. You can use <b>bold</b>, <i>italic</i>, and <a href="#">links</a>.',
    props: { textColor: '#51545e', fontSize: '16', padding: '16', align: 'left', lineHeight: '1.6' }
  }),
  image: () => ({
    type: 'image',
    props: { src: '', alt: 'Image', width: '100', padding: '16', align: 'center', borderRadius: '0', link: '' }
  }),
  button: () => ({
    type: 'button',
    content: 'Click Here',
    props: { bgColor: '#3b82f6', textColor: '#ffffff', fontSize: '16', padding: '16', borderRadius: '8', align: 'center', link: '#', fullWidth: false, fontWeight: 'bold' }
  }),
  divider: () => ({
    type: 'divider',
    props: { color: '#e5e7eb', thickness: '1', padding: '16', style: 'solid', width: '100' }
  }),
  spacer: () => ({
    type: 'spacer',
    props: { height: '32' }
  }),
  columns: () => ({
    type: 'columns',
    props: { padding: '16', gap: '16', bgColor: 'transparent' },
    left: { content: '<p style="margin:0;color:#51545e;font-size:15px;">Left column content. Edit this text.</p>' },
    right: { content: '<p style="margin:0;color:#51545e;font-size:15px;">Right column content. Edit this text.</p>' }
  }),
  social: () => ({
    type: 'social',
    props: { align: 'center', padding: '16', iconSize: '32', bgColor: 'transparent' },
    links: [
      { platform: 'facebook', url: '#' },
      { platform: 'twitter', url: '#' },
      { platform: 'instagram', url: '#' },
      { platform: 'linkedin', url: '#' }
    ]
  }),
  footer: () => ({
    type: 'footer',
    content: '© 2026 Your Company. All rights reserved.<br><a href="#" style="color:#9ca3af;">Unsubscribe</a> · <a href="#" style="color:#9ca3af;">View in browser</a>',
    props: { bgColor: '#f8f9fc', textColor: '#9ca3af', fontSize: '12', padding: '24', align: 'center' }
  }),
  html: () => ({
    type: 'html',
    content: '<div style="padding:16px;text-align:center;color:#666;">Custom HTML block</div>',
    props: { padding: '0' }
  }),
  'hero-section': () => ({
    type: 'hero-section',
    content: 'Welcome to Our Newsletter',
    props: {
      bgColor: '#667eea', bgGradient: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
      textColor: '#ffffff', fontSize: '36', padding: '60', align: 'center',
      subtitle: 'Discover what we have in store for you this month',
      subtitleColor: 'rgba(255,255,255,0.85)', subtitleSize: '18',
      btnText: 'Get Started', btnColor: '#ffffff', btnTextColor: '#667eea',
      btnLink: '#', btnRadius: '8'
    }
  }),
  'feature-grid': () => ({
    type: 'feature-grid',
    props: { padding: '24', bgColor: '#ffffff' },
    features: [
      { icon: '🚀', title: 'Fast Delivery', desc: 'Lightning-fast email delivery worldwide.' },
      { icon: '🔒', title: 'Secure', desc: 'Enterprise-grade security for your data.' },
      { icon: '📊', title: 'Analytics', desc: 'Real-time tracking and reporting.' }
    ]
  }),
  testimonial: () => ({
    type: 'testimonial',
    content: '"This service completely transformed how we communicate with our customers. Highly recommended!"',
    props: {
      padding: '32', bgColor: '#f8f9fc', textColor: '#333333', fontSize: '16',
      author: 'Jane Smith', authorTitle: 'CEO, Acme Corp', authorColor: '#667eea',
      borderColor: '#667eea'
    }
  }),
  'cta-banner': () => ({
    type: 'cta-banner',
    content: 'Ready to Get Started?',
    props: {
      bgColor: '#1a1a2e', bgGradient: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
      textColor: '#ffffff', fontSize: '28', padding: '48', align: 'center',
      subtitle: 'Join thousands of companies already using our platform.',
      subtitleColor: 'rgba(255,255,255,0.8)',
      btnText: 'Start Free Trial', btnColor: '#ffffff', btnTextColor: '#667eea',
      btnLink: '#', btnRadius: '8'
    }
  })
};

// ---- Social Icons SVGs ----
const socialIcons = {
  facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
  twitter: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/><path fill="#fff" d="M9.545 15.568V8.432L15.818 12z"/></svg>'
};

const socialColors = {
  facebook: '#1877F2', twitter: '#000000', instagram: '#E4405F',
  linkedin: '#0A66C2', youtube: '#FF0000'
};

// ---- Initialize ----
function initTemplateEditor() {
  if (editorBlocks.length === 0) {
    undoStack = [];
    redoStack = [];
    selectedBlockId = null;
  }
  renderCanvas();
  setupPaletteDrag();
  renderPropsPanel();
  document.getElementById('api-base-url-editor')?.remove();
}

// ---- Unique ID ----
function genBlockId() {
  return 'blk_' + (++blockIdCounter) + '_' + Math.random().toString(36).substr(2, 5);
}

// ---- Save State for Undo ----
function saveState() {
  undoStack.push(JSON.stringify(editorBlocks));
  if (undoStack.length > 40) undoStack.shift();
  redoStack = [];
}

function editorUndo() {
  if (undoStack.length === 0) return;
  redoStack.push(JSON.stringify(editorBlocks));
  editorBlocks = JSON.parse(undoStack.pop());
  selectedBlockId = null;
  renderCanvas();
  renderPropsPanel();
}

function editorRedo() {
  if (redoStack.length === 0) return;
  undoStack.push(JSON.stringify(editorBlocks));
  editorBlocks = JSON.parse(redoStack.pop());
  selectedBlockId = null;
  renderCanvas();
  renderPropsPanel();
}

// ---- Palette Drag Setup ----
function setupPaletteDrag() {
  document.querySelectorAll('.dnd-palette-item').forEach(item => {
    item.removeEventListener('dragstart', handlePaletteDragStart);
    item.addEventListener('dragstart', handlePaletteDragStart);
    // Click to append
    item.removeEventListener('click', handlePaletteClick);
    item.addEventListener('click', handlePaletteClick);
  });
}

function handlePaletteDragStart(e) {
  e.dataTransfer.setData('text/plain', e.currentTarget.dataset.block);
  e.dataTransfer.effectAllowed = 'copy';
}

function handlePaletteClick(e) {
  const blockType = e.currentTarget.dataset.block;
  addBlock(blockType);
}

// ---- Add Block ----
function addBlock(type, insertIdx) {
  saveState();
  const factory = blockDefaults[type];
  if (!factory) return;
  const block = factory();
  block.id = genBlockId();
  if (insertIdx !== undefined) {
    editorBlocks.splice(insertIdx, 0, block);
  } else {
    editorBlocks.push(block);
  }
  selectedBlockId = block.id;
  renderCanvas();
  renderPropsPanel();
}

// ---- Delete Block ----
function deleteBlock(id) {
  saveState();
  editorBlocks = editorBlocks.filter(b => b.id !== id);
  if (selectedBlockId === id) selectedBlockId = null;
  renderCanvas();
  renderPropsPanel();
}

// ---- Duplicate Block ----
function duplicateBlock(id) {
  saveState();
  const idx = editorBlocks.findIndex(b => b.id === id);
  if (idx === -1) return;
  const clone = JSON.parse(JSON.stringify(editorBlocks[idx]));
  clone.id = genBlockId();
  editorBlocks.splice(idx + 1, 0, clone);
  selectedBlockId = clone.id;
  renderCanvas();
  renderPropsPanel();
}

// ---- Move Block ----
function moveBlock(id, dir) {
  const idx = editorBlocks.findIndex(b => b.id === id);
  if (idx === -1) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= editorBlocks.length) return;
  saveState();
  [editorBlocks[idx], editorBlocks[newIdx]] = [editorBlocks[newIdx], editorBlocks[idx]];
  renderCanvas();
}

// ---- Render Canvas ----
function renderCanvas() {
  const zone = document.getElementById('dnd-drop-zone');
  const empty = document.getElementById('dnd-empty-state');

  if (editorBlocks.length === 0) {
    zone.innerHTML = '';
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'dnd-empty-state';
    emptyDiv.id = 'dnd-empty-state';
    emptyDiv.innerHTML = `
      <svg class="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
      <p class="text-gray-400 text-sm font-medium">Drag & drop blocks here</p>
      <p class="text-gray-300 text-xs mt-1">or click a block from the left panel</p>`;
    zone.appendChild(emptyDiv);
    setupDropZone(zone);
    return;
  }

  zone.innerHTML = '';
  editorBlocks.forEach((block, idx) => {
    const el = document.createElement('div');
    el.className = 'dnd-block' + (block.id === selectedBlockId ? ' selected' : '');
    el.dataset.blockId = block.id;
    el.dataset.idx = idx;
    el.draggable = true;
    el.innerHTML = renderBlockHtml(block) + renderBlockActions(block.id, idx);
    el.addEventListener('click', (e) => {
      if (e.target.closest('.dnd-block-action')) return;
      selectedBlockId = block.id;
      document.querySelectorAll('.dnd-block').forEach(b => b.classList.remove('selected'));
      el.classList.add('selected');
      renderPropsPanel();
    });
    // Drag reorder
    el.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      dragSrcId = block.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
      setTimeout(() => el.classList.add('dnd-dragging'), 0);
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dnd-dragging');
      document.querySelectorAll('.dnd-drag-over').forEach(d => d.classList.remove('dnd-drag-over'));
      dragSrcId = null;
    });
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = dragSrcId ? 'move' : 'copy';
      document.querySelectorAll('.dnd-drag-over').forEach(d => d.classList.remove('dnd-drag-over'));
      el.classList.add('dnd-drag-over');
    });
    el.addEventListener('dragleave', () => el.classList.remove('dnd-drag-over'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.remove('dnd-drag-over');
      const targetIdx = parseInt(el.dataset.idx);
      if (dragSrcId) {
        // Reorder
        const srcIdx = editorBlocks.findIndex(b => b.id === dragSrcId);
        if (srcIdx === -1 || srcIdx === targetIdx) return;
        saveState();
        const [moved] = editorBlocks.splice(srcIdx, 1);
        const insertAt = targetIdx > srcIdx ? targetIdx : targetIdx;
        editorBlocks.splice(insertAt, 0, moved);
        renderCanvas();
      } else {
        // New block from palette
        const blockType = e.dataTransfer.getData('text/plain');
        if (blockType && blockDefaults[blockType]) {
          addBlock(blockType, targetIdx + 1);
        }
      }
    });
    zone.appendChild(el);
  });
  setupDropZone(zone);
}

function setupDropZone(zone) {
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = dragSrcId ? 'move' : 'copy';
  });
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.target.closest('.dnd-block')) return; // handled by block
    const blockType = e.dataTransfer.getData('text/plain');
    if (blockType && blockDefaults[blockType]) {
      addBlock(blockType);
    }
  });
}

// ---- Block Actions Overlay ----
function renderBlockActions(id, idx) {
  return `<div class="dnd-block-actions">
    <button class="dnd-block-action" title="Move Up" onclick="event.stopPropagation();moveBlock('${id}',-1)"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg></button>
    <button class="dnd-block-action" title="Move Down" onclick="event.stopPropagation();moveBlock('${id}',1)"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg></button>
    <button class="dnd-block-action" title="Duplicate" onclick="event.stopPropagation();duplicateBlock('${id}')"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg></button>
    <button class="dnd-block-action delete" title="Delete" onclick="event.stopPropagation();deleteBlock('${id}')"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
  </div>`;
}

// ---- Block HTML Rendering ----
function renderBlockHtml(block) {
  const p = block.props || {};
  switch (block.type) {
    case 'header':
      return `<div style="background:${p.bgColor||'#667eea'};padding:${p.padding||32}px;text-align:${p.align||'center'};">
        <div style="color:${p.textColor||'#fff'};font-size:${p.fontSize||24}px;font-weight:${p.fontWeight||'bold'};font-family:Helvetica,Arial,sans-serif;">${block.content}</div>
      </div>`;

    case 'text':
      return `<div style="padding:${p.padding||16}px;text-align:${p.align||'left'};">
        <div style="color:${p.textColor||'#51545e'};font-size:${p.fontSize||16}px;line-height:${p.lineHeight||'1.6'};font-family:Helvetica,Arial,sans-serif;">${block.content}</div>
      </div>`;

    case 'image':
      if (!p.src) {
        return `<div style="padding:${p.padding||16}px;text-align:${p.align||'center'};">
          <div style="background:#f3f4f6;border:2px dashed #d1d5db;border-radius:8px;padding:40px 20px;color:#9ca3af;font-size:14px;font-family:Helvetica,Arial,sans-serif;">
            <svg style="width:32px;height:32px;margin:0 auto 8px;display:block;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            Click to add image URL
          </div>
        </div>`;
      }
      const imgTag = `<img src="${escapeHtml(p.src)}" alt="${escapeHtml(p.alt||'')}" style="max-width:${p.width||100}%;height:auto;border-radius:${p.borderRadius||0}px;display:block;${p.align==='center'?'margin:0 auto;':''}">`;
      return `<div style="padding:${p.padding||16}px;text-align:${p.align||'center'};">${p.link ? `<a href="${escapeHtml(p.link)}">${imgTag}</a>` : imgTag}</div>`;

    case 'button':
      const btnW = p.fullWidth ? 'display:block;width:100%;box-sizing:border-box;' : 'display:inline-block;';
      return `<div style="padding:${p.padding||16}px;text-align:${p.align||'center'};">
        <a href="${escapeHtml(p.link||'#')}" style="${btnW}background:${p.bgColor||'#3b82f6'};color:${p.textColor||'#fff'};font-size:${p.fontSize||16}px;font-weight:${p.fontWeight||'bold'};padding:14px 32px;border-radius:${p.borderRadius||8}px;text-decoration:none;font-family:Helvetica,Arial,sans-serif;">${block.content}</a>
      </div>`;

    case 'divider':
      return `<div style="padding:${p.padding||16}px 0;">
        <hr style="border:0;border-top:${p.thickness||1}px ${p.style||'solid'} ${p.color||'#e5e7eb'};margin:0 auto;width:${p.width||100}%;">
      </div>`;

    case 'spacer':
      return `<div style="height:${p.height||32}px;background:transparent;position:relative;"><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;"><span style="font-size:10px;color:#ccc;background:#fff;padding:0 6px;">${p.height}px</span></div></div>`;

    case 'columns':
      return `<div style="padding:${p.padding||16}px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
          <td width="48%" valign="top" style="padding-right:${(p.gap||16)/2}px;">${block.left?.content||''}</td>
          <td width="48%" valign="top" style="padding-left:${(p.gap||16)/2}px;">${block.right?.content||''}</td>
        </tr></table>
      </div>`;

    case 'social': {
      const links = block.links || [];
      const icons = links.map(l => {
        const color = socialColors[l.platform] || '#666';
        const svg = socialIcons[l.platform] || '';
        return `<a href="${escapeHtml(l.url||'#')}" style="display:inline-block;width:${p.iconSize||32}px;height:${p.iconSize||32}px;margin:0 6px;color:${color};text-decoration:none;" title="${l.platform}">${svg}</a>`;
      }).join('');
      return `<div style="padding:${p.padding||16}px;text-align:${p.align||'center'};background:${p.bgColor||'transparent'};">${icons}</div>`;
    }

    case 'footer':
      return `<div style="background:${p.bgColor||'#f8f9fc'};padding:${p.padding||24}px;text-align:${p.align||'center'};">
        <div style="color:${p.textColor||'#9ca3af'};font-size:${p.fontSize||12}px;line-height:1.5;font-family:Helvetica,Arial,sans-serif;">${block.content}</div>
      </div>`;

    case 'html':
      return `<div style="padding:${p.padding||0}px;">${block.content}</div>`;

    case 'hero-section':
      return `<div style="background:${p.bgGradient||p.bgColor||'#667eea'};padding:${p.padding||60}px 40px;text-align:${p.align||'center'};">
        <h1 style="color:${p.textColor||'#fff'};font-size:${p.fontSize||36}px;font-weight:bold;margin:0 0 16px 0;font-family:Helvetica,Arial,sans-serif;">${block.content}</h1>
        <p style="color:${p.subtitleColor||'rgba(255,255,255,0.85)'};font-size:${p.subtitleSize||18}px;margin:0 0 28px 0;font-family:Helvetica,Arial,sans-serif;">${p.subtitle||''}</p>
        ${p.btnText ? `<a href="${escapeHtml(p.btnLink||'#')}" style="display:inline-block;background:${p.btnColor||'#fff'};color:${p.btnTextColor||'#667eea'};padding:14px 36px;border-radius:${p.btnRadius||8}px;font-weight:bold;text-decoration:none;font-size:16px;font-family:Helvetica,Arial,sans-serif;">${p.btnText}</a>` : ''}
      </div>`;

    case 'feature-grid': {
      const feats = block.features || [];
      const cells = feats.map(f => `<td valign="top" style="padding:12px;text-align:center;width:${Math.floor(100/feats.length)}%;">
        <div style="font-size:32px;margin-bottom:8px;">${f.icon}</div>
        <div style="font-weight:bold;font-size:15px;color:#333;margin-bottom:6px;font-family:Helvetica,Arial,sans-serif;">${escapeHtml(f.title)}</div>
        <div style="font-size:13px;color:#666;line-height:1.4;font-family:Helvetica,Arial,sans-serif;">${escapeHtml(f.desc)}</div>
      </td>`).join('');
      return `<div style="padding:${p.padding||24}px;background:${p.bgColor||'#fff'};">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>${cells}</tr></table>
      </div>`;
    }

    case 'testimonial':
      return `<div style="padding:${p.padding||32}px;background:${p.bgColor||'#f8f9fc'};">
        <div style="border-left:4px solid ${p.borderColor||'#667eea'};padding:16px 24px;">
          <p style="color:${p.textColor||'#333'};font-size:${p.fontSize||16}px;line-height:1.6;margin:0 0 16px 0;font-style:italic;font-family:Helvetica,Arial,sans-serif;">${block.content}</p>
          <p style="margin:0;font-size:14px;font-family:Helvetica,Arial,sans-serif;"><strong style="color:${p.authorColor||'#667eea'};">${escapeHtml(p.author||'')}</strong><br><span style="color:#888;font-size:12px;">${escapeHtml(p.authorTitle||'')}</span></p>
        </div>
      </div>`;

    case 'cta-banner':
      return `<div style="background:${p.bgGradient||p.bgColor||'#1a1a2e'};padding:${p.padding||48}px 40px;text-align:${p.align||'center'};">
        <h2 style="color:${p.textColor||'#fff'};font-size:${p.fontSize||28}px;font-weight:bold;margin:0 0 12px 0;font-family:Helvetica,Arial,sans-serif;">${block.content}</h2>
        ${p.subtitle ? `<p style="color:${p.subtitleColor||'rgba(255,255,255,0.8)'};font-size:16px;margin:0 0 28px 0;font-family:Helvetica,Arial,sans-serif;">${p.subtitle}</p>` : ''}
        ${p.btnText ? `<a href="${escapeHtml(p.btnLink||'#')}" style="display:inline-block;background:${p.btnColor||'#fff'};color:${p.btnTextColor||'#667eea'};padding:14px 36px;border-radius:${p.btnRadius||8}px;font-weight:bold;text-decoration:none;font-size:16px;font-family:Helvetica,Arial,sans-serif;">${p.btnText}</a>` : ''}
      </div>`;

    default:
      return `<div style="padding:16px;color:#999;text-align:center;">Unknown block: ${block.type}</div>`;
  }
}

// ---- Properties Panel ----
function renderPropsPanel() {
  const panel = document.getElementById('props-panel');
  if (!selectedBlockId) {
    panel.innerHTML = '<p class="text-sm text-gray-400 text-center py-8">Select a block to edit its properties</p>';
    return;
  }
  const block = editorBlocks.find(b => b.id === selectedBlockId);
  if (!block) {
    panel.innerHTML = '<p class="text-sm text-gray-400 text-center py-8">Block not found</p>';
    return;
  }

  let html = `<div class="mb-3 pb-3 border-b border-gray-100"><span class="text-xs font-bold text-primary-600 uppercase">${block.type.replace(/-/g,' ')}</span></div>`;
  const p = block.props || {};

  // Content field for content blocks
  if ('content' in block && block.type !== 'columns') {
    const isLong = block.type === 'html' || block.type === 'footer' || block.type === 'text';
    html += `<div class="prop-group">
      <label class="prop-label">Content</label>
      ${isLong ? `<textarea class="prop-textarea" data-prop="content" oninput="updateBlockContent(this)">${escapeHtml(block.content)}</textarea>` :
        `<input class="prop-input" data-prop="content" value="${escapeHtml(block.content)}" oninput="updateBlockContent(this)">`}
    </div>`;
  }

  // Type-specific props
  switch (block.type) {
    case 'header':
      html += colorProp('Background', 'bgColor', p.bgColor || '#667eea');
      html += colorProp('Text Color', 'textColor', p.textColor || '#ffffff');
      html += rangeProp('Font Size', 'fontSize', p.fontSize || 24, 12, 48);
      html += rangeProp('Padding', 'padding', p.padding || 32, 0, 80);
      html += alignProp(p.align || 'center');
      html += selectProp('Font Weight', 'fontWeight', p.fontWeight || 'bold', ['normal', 'bold', '600', '800']);
      break;

    case 'text':
      html += colorProp('Text Color', 'textColor', p.textColor || '#51545e');
      html += rangeProp('Font Size', 'fontSize', p.fontSize || 16, 10, 32);
      html += rangeProp('Padding', 'padding', p.padding || 16, 0, 60);
      html += selectProp('Line Height', 'lineHeight', p.lineHeight || '1.6', ['1.2', '1.4', '1.6', '1.8', '2.0']);
      html += alignProp(p.align || 'left');
      html += `<div class="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-700">Supports HTML: &lt;b&gt;, &lt;i&gt;, &lt;a href&gt;, &lt;br&gt;</div>`;
      break;

    case 'image':
      html += `<div class="prop-group">
        <label class="prop-label">Image URL</label>
        <input class="prop-input" data-prop="src" value="${escapeHtml(p.src||'')}" placeholder="https://... or /uploads/..." oninput="updateBlockProp(this)">
      </div>`;
      html += `<div class="prop-group">
        <label class="prop-label">Or Upload</label>
        <input type="file" accept="image/*" class="prop-input text-xs" onchange="uploadEditorImage(this)">
      </div>`;
      html += `<div class="prop-group"><label class="prop-label">Alt Text</label><input class="prop-input" data-prop="alt" value="${escapeHtml(p.alt||'')}" oninput="updateBlockProp(this)"></div>`;
      html += `<div class="prop-group"><label class="prop-label">Link URL</label><input class="prop-input" data-prop="link" value="${escapeHtml(p.link||'')}" placeholder="Optional link" oninput="updateBlockProp(this)"></div>`;
      html += rangeProp('Width %', 'width', p.width || 100, 10, 100);
      html += rangeProp('Padding', 'padding', p.padding || 16, 0, 60);
      html += rangeProp('Border Radius', 'borderRadius', p.borderRadius || 0, 0, 30);
      html += alignProp(p.align || 'center');
      break;

    case 'button':
      html += `<div class="prop-group"><label class="prop-label">Link URL</label><input class="prop-input" data-prop="link" value="${escapeHtml(p.link||'#')}" oninput="updateBlockProp(this)"></div>`;
      html += colorProp('Button Color', 'bgColor', p.bgColor || '#3b82f6');
      html += colorProp('Text Color', 'textColor', p.textColor || '#ffffff');
      html += rangeProp('Font Size', 'fontSize', p.fontSize || 16, 12, 24);
      html += rangeProp('Padding', 'padding', p.padding || 16, 0, 40);
      html += rangeProp('Border Radius', 'borderRadius', p.borderRadius || 8, 0, 30);
      html += alignProp(p.align || 'center');
      html += checkboxProp('Full Width', 'fullWidth', p.fullWidth || false);
      break;

    case 'divider':
      html += colorProp('Color', 'color', p.color || '#e5e7eb');
      html += rangeProp('Thickness', 'thickness', p.thickness || 1, 1, 5);
      html += rangeProp('Width %', 'width', p.width || 100, 20, 100);
      html += rangeProp('Padding', 'padding', p.padding || 16, 0, 40);
      html += selectProp('Style', 'style', p.style || 'solid', ['solid', 'dashed', 'dotted']);
      break;

    case 'spacer':
      html += rangeProp('Height', 'height', p.height || 32, 8, 120);
      break;

    case 'columns':
      html += `<div class="prop-group"><label class="prop-label">Left Column (HTML)</label><textarea class="prop-textarea font-mono text-xs" data-col="left" oninput="updateColumnContent(this)">${escapeHtml(block.left?.content||'')}</textarea></div>`;
      html += `<div class="prop-group"><label class="prop-label">Right Column (HTML)</label><textarea class="prop-textarea font-mono text-xs" data-col="right" oninput="updateColumnContent(this)">${escapeHtml(block.right?.content||'')}</textarea></div>`;
      html += rangeProp('Padding', 'padding', p.padding || 16, 0, 40);
      html += rangeProp('Gap', 'gap', p.gap || 16, 0, 40);
      break;

    case 'social':
      html += alignProp(p.align || 'center');
      html += rangeProp('Icon Size', 'iconSize', p.iconSize || 32, 20, 48);
      html += rangeProp('Padding', 'padding', p.padding || 16, 0, 40);
      html += `<div class="prop-group"><label class="prop-label">Social Links</label>`;
      (block.links || []).forEach((l, i) => {
        html += `<div class="flex gap-1 mb-2">
          <select class="prop-select text-xs flex-shrink-0" style="width:90px;" data-social-idx="${i}" data-social-field="platform" onchange="updateSocialLink(this)">
            ${['facebook','twitter','instagram','linkedin','youtube'].map(s => `<option value="${s}" ${s===l.platform?'selected':''}>${s}</option>`).join('')}
          </select>
          <input class="prop-input text-xs" data-social-idx="${i}" data-social-field="url" value="${escapeHtml(l.url||'')}" placeholder="URL" oninput="updateSocialLink(this)">
          <button class="dnd-block-action delete flex-shrink-0" onclick="removeSocialLink(${i})" title="Remove"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>`;
      });
      html += `<button class="text-xs text-primary-600 hover:text-primary-700 font-medium mt-1" onclick="addSocialLink()">+ Add Link</button></div>`;
      break;

    case 'footer':
      html += colorProp('Background', 'bgColor', p.bgColor || '#f8f9fc');
      html += colorProp('Text Color', 'textColor', p.textColor || '#9ca3af');
      html += rangeProp('Font Size', 'fontSize', p.fontSize || 12, 10, 16);
      html += rangeProp('Padding', 'padding', p.padding || 24, 0, 60);
      html += alignProp(p.align || 'center');
      break;

    case 'html':
      html += rangeProp('Padding', 'padding', p.padding || 0, 0, 40);
      html += `<div class="mt-2 p-2 bg-amber-50 rounded text-xs text-amber-700">Write any valid HTML/CSS. Supports inline styles for email clients.</div>`;
      break;

    case 'hero-section':
      html += colorProp('Background', 'bgColor', p.bgColor || '#667eea');
      html += `<div class="prop-group"><label class="prop-label">Gradient (CSS)</label><input class="prop-input text-xs font-mono" data-prop="bgGradient" value="${escapeHtml(p.bgGradient||'')}" oninput="updateBlockProp(this)" placeholder="linear-gradient(...)"></div>`;
      html += colorProp('Text Color', 'textColor', p.textColor || '#ffffff');
      html += rangeProp('Title Size', 'fontSize', p.fontSize || 36, 20, 52);
      html += rangeProp('Padding', 'padding', p.padding || 60, 20, 100);
      html += `<div class="prop-group"><label class="prop-label">Subtitle</label><input class="prop-input" data-prop="subtitle" value="${escapeHtml(p.subtitle||'')}" oninput="updateBlockProp(this)"></div>`;
      html += `<div class="prop-group"><label class="prop-label">Button Text</label><input class="prop-input" data-prop="btnText" value="${escapeHtml(p.btnText||'')}" oninput="updateBlockProp(this)"></div>`;
      html += `<div class="prop-group"><label class="prop-label">Button Link</label><input class="prop-input" data-prop="btnLink" value="${escapeHtml(p.btnLink||'#')}" oninput="updateBlockProp(this)"></div>`;
      html += colorProp('Button Color', 'btnColor', p.btnColor || '#ffffff');
      html += colorProp('Button Text', 'btnTextColor', p.btnTextColor || '#667eea');
      break;

    case 'feature-grid':
      html += rangeProp('Padding', 'padding', p.padding || 24, 0, 60);
      html += colorProp('Background', 'bgColor', p.bgColor || '#ffffff');
      (block.features || []).forEach((f, i) => {
        html += `<div class="prop-group border-t border-gray-100 pt-3 mt-3">
          <label class="prop-label">Feature ${i+1}</label>
          <input class="prop-input mb-1" data-feat-idx="${i}" data-feat-field="icon" value="${escapeHtml(f.icon)}" placeholder="Emoji" oninput="updateFeature(this)">
          <input class="prop-input mb-1" data-feat-idx="${i}" data-feat-field="title" value="${escapeHtml(f.title)}" placeholder="Title" oninput="updateFeature(this)">
          <input class="prop-input" data-feat-idx="${i}" data-feat-field="desc" value="${escapeHtml(f.desc)}" placeholder="Description" oninput="updateFeature(this)">
        </div>`;
      });
      break;

    case 'testimonial':
      html += colorProp('Background', 'bgColor', p.bgColor || '#f8f9fc');
      html += colorProp('Text Color', 'textColor', p.textColor || '#333333');
      html += colorProp('Border Color', 'borderColor', p.borderColor || '#667eea');
      html += rangeProp('Font Size', 'fontSize', p.fontSize || 16, 12, 24);
      html += rangeProp('Padding', 'padding', p.padding || 32, 0, 60);
      html += `<div class="prop-group"><label class="prop-label">Author Name</label><input class="prop-input" data-prop="author" value="${escapeHtml(p.author||'')}" oninput="updateBlockProp(this)"></div>`;
      html += `<div class="prop-group"><label class="prop-label">Author Title</label><input class="prop-input" data-prop="authorTitle" value="${escapeHtml(p.authorTitle||'')}" oninput="updateBlockProp(this)"></div>`;
      html += colorProp('Author Color', 'authorColor', p.authorColor || '#667eea');
      break;

    case 'cta-banner':
      html += colorProp('Background', 'bgColor', p.bgColor || '#1a1a2e');
      html += `<div class="prop-group"><label class="prop-label">Gradient (CSS)</label><input class="prop-input text-xs font-mono" data-prop="bgGradient" value="${escapeHtml(p.bgGradient||'')}" oninput="updateBlockProp(this)"></div>`;
      html += colorProp('Text Color', 'textColor', p.textColor || '#ffffff');
      html += rangeProp('Font Size', 'fontSize', p.fontSize || 28, 16, 44);
      html += rangeProp('Padding', 'padding', p.padding || 48, 16, 80);
      html += `<div class="prop-group"><label class="prop-label">Subtitle</label><input class="prop-input" data-prop="subtitle" value="${escapeHtml(p.subtitle||'')}" oninput="updateBlockProp(this)"></div>`;
      html += `<div class="prop-group"><label class="prop-label">Button Text</label><input class="prop-input" data-prop="btnText" value="${escapeHtml(p.btnText||'')}" oninput="updateBlockProp(this)"></div>`;
      html += `<div class="prop-group"><label class="prop-label">Button Link</label><input class="prop-input" data-prop="btnLink" value="${escapeHtml(p.btnLink||'#')}" oninput="updateBlockProp(this)"></div>`;
      html += colorProp('Button Color', 'btnColor', p.btnColor || '#ffffff');
      html += colorProp('Button Text', 'btnTextColor', p.btnTextColor || '#667eea');
      break;
  }

  panel.innerHTML = html;
}

// ---- Property Helpers ----
function colorProp(label, key, val) {
  return `<div class="prop-group"><label class="prop-label">${label}</label>
    <div class="prop-color-row"><input type="color" class="prop-color" data-prop="${key}" value="${val}" oninput="updateBlockProp(this)"><input class="prop-input" style="width:calc(100% - 40px)" data-prop="${key}" value="${val}" oninput="updateBlockProp(this)"></div></div>`;
}

function rangeProp(label, key, val, min, max) {
  return `<div class="prop-group"><label class="prop-label">${label}: <span id="rv-${key}">${val}</span></label>
    <input type="range" class="prop-range" data-prop="${key}" value="${val}" min="${min}" max="${max}" oninput="this.previousElementSibling.querySelector('span').textContent=this.value;updateBlockProp(this)"></div>`;
}

function selectProp(label, key, val, options) {
  return `<div class="prop-group"><label class="prop-label">${label}</label>
    <select class="prop-select" data-prop="${key}" onchange="updateBlockProp(this)">${options.map(o => `<option value="${o}" ${o==val?'selected':''}>${o}</option>`).join('')}</select></div>`;
}

function alignProp(val) {
  return `<div class="prop-group"><label class="prop-label">Alignment</label>
    <div class="flex gap-1">
      <button class="dnd-toolbar-btn ${val==='left'?'active':''}" onclick="setBlockAlign('left')"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h8M4 18h12"/></svg></button>
      <button class="dnd-toolbar-btn ${val==='center'?'active':''}" onclick="setBlockAlign('center')"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M8 12h8M6 18h12"/></svg></button>
      <button class="dnd-toolbar-btn ${val==='right'?'active':''}" onclick="setBlockAlign('right')"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M12 12h8M8 18h12"/></svg></button>
    </div></div>`;
}

function checkboxProp(label, key, val) {
  return `<div class="prop-group"><label class="flex items-center gap-2 cursor-pointer">
    <input type="checkbox" data-prop="${key}" ${val?'checked':''} onchange="updateBlockPropCheckbox(this)" class="accent-primary-600">
    <span class="text-sm text-gray-600">${label}</span></label></div>`;
}

// ---- Update Handlers ----
function updateBlockContent(el) {
  const block = editorBlocks.find(b => b.id === selectedBlockId);
  if (!block) return;
  block.content = el.value;
  rerenderBlock(block.id);
}

function updateBlockProp(el) {
  const block = editorBlocks.find(b => b.id === selectedBlockId);
  if (!block) return;
  const key = el.dataset.prop;
  block.props[key] = el.value;
  // Sync twin inputs (color + text)
  document.querySelectorAll(`[data-prop="${key}"]`).forEach(inp => {
    if (inp !== el) inp.value = el.value;
  });
  rerenderBlock(block.id);
}

function updateBlockPropCheckbox(el) {
  const block = editorBlocks.find(b => b.id === selectedBlockId);
  if (!block) return;
  block.props[el.dataset.prop] = el.checked;
  rerenderBlock(block.id);
}

function setBlockAlign(align) {
  const block = editorBlocks.find(b => b.id === selectedBlockId);
  if (!block) return;
  block.props.align = align;
  rerenderBlock(block.id);
  renderPropsPanel();
}

function updateColumnContent(el) {
  const block = editorBlocks.find(b => b.id === selectedBlockId);
  if (!block) return;
  const col = el.dataset.col;
  if (!block[col]) block[col] = {};
  block[col].content = el.value;
  rerenderBlock(block.id);
}

function updateSocialLink(el) {
  const block = editorBlocks.find(b => b.id === selectedBlockId);
  if (!block || !block.links) return;
  const idx = parseInt(el.dataset.socialIdx);
  const field = el.dataset.socialField;
  block.links[idx][field] = el.value;
  rerenderBlock(block.id);
}

function addSocialLink() {
  const block = editorBlocks.find(b => b.id === selectedBlockId);
  if (!block) return;
  if (!block.links) block.links = [];
  block.links.push({ platform: 'facebook', url: '#' });
  renderPropsPanel();
  rerenderBlock(block.id);
}

function removeSocialLink(idx) {
  const block = editorBlocks.find(b => b.id === selectedBlockId);
  if (!block || !block.links) return;
  block.links.splice(idx, 1);
  renderPropsPanel();
  rerenderBlock(block.id);
}

function updateFeature(el) {
  const block = editorBlocks.find(b => b.id === selectedBlockId);
  if (!block || !block.features) return;
  const idx = parseInt(el.dataset.featIdx);
  const field = el.dataset.featField;
  block.features[idx][field] = el.value;
  rerenderBlock(block.id);
}

function rerenderBlock(id) {
  const el = document.querySelector(`[data-block-id="${id}"]`);
  const block = editorBlocks.find(b => b.id === id);
  if (el && block) {
    const idx = el.dataset.idx;
    el.innerHTML = renderBlockHtml(block) + renderBlockActions(id, idx);
  }
}

// ---- Upload Image ----
async function uploadEditorImage(fileInput) {
  const file = fileInput.files[0];
  if (!file) return;
  if (!getApiKey()) return showToast('Enter API key first', 'error');

  const formData = new FormData();
  formData.append('image', file);

  try {
    const headers = {};
    const apiKey = getApiKey();
    if (apiKey) headers['X-API-Key'] = apiKey;

    const res = await fetch('/images', { method: 'POST', headers, body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');

    const block = editorBlocks.find(b => b.id === selectedBlockId);
    if (block && block.type === 'image') {
      block.props.src = data.url;
      rerenderBlock(block.id);
      renderPropsPanel();
      showToast('Image uploaded!');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---- Preview / Mobile Toggle ----
function setPreviewMode(mode) {
  const canvas = document.getElementById('dnd-canvas');
  document.getElementById('preview-desktop').classList.toggle('active', mode === 'desktop');
  document.getElementById('preview-mobile').classList.toggle('active', mode === 'mobile');
  if (mode === 'mobile') {
    canvas.classList.add('mobile');
  } else {
    canvas.classList.remove('mobile');
  }
}

function updateEditorBg(color) {
  editorSettings.bgColor = color;
  document.getElementById('dnd-canvas-bg').style.backgroundColor = color;
}

function updateContentBg(color) {
  editorSettings.contentBg = color;
  document.getElementById('dnd-canvas').style.backgroundColor = color;
}

function updateEditorWidth(w) {
  editorSettings.width = parseInt(w);
  const canvas = document.getElementById('dnd-canvas');
  if (!canvas.classList.contains('mobile')) {
    canvas.style.width = w + 'px';
  }
}

// ---- Export HTML ----
function generateEmailHtml() {
  const w = editorSettings.width;
  const bg = editorSettings.bgColor;
  const cbg = editorSettings.contentBg;
  let bodyHtml = '';
  editorBlocks.forEach(block => {
    bodyHtml += renderBlockHtml(block);
  });

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge">
<style type="text/css">body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none;}body{margin:0;padding:0;width:100%!important;}@media only screen and (max-width:620px){.email-container{width:100%!important;max-width:100%!important;}}</style>
</head><body style="margin:0;padding:0;background-color:${bg};font-family:Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${bg};"><tr><td align="center" style="padding:24px 16px;">
<table role="presentation" class="email-container" width="${w}" cellpadding="0" cellspacing="0" style="background-color:${cbg};max-width:${w}px;border-radius:4px;overflow:hidden;">
<tr><td>${bodyHtml}</td></tr>
</table></td></tr></table></body></html>`;
}

function exportEditorHtml() {
  if (editorBlocks.length === 0) return showToast('Add some blocks first', 'error');
  const html = generateEmailHtml();
  // Show in modal
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `<div class="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
    <div class="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
      <h3 class="text-lg font-semibold text-gray-900">Export HTML</h3>
      <div class="flex gap-2">
        <button onclick="copyExportedHtml()" class="bg-primary-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">Copy HTML</button>
        <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>
    </div>
    <textarea id="export-html-output" class="flex-1 p-4 font-mono text-xs text-gray-800 resize-none outline-none" readonly>${escapeHtml(html)}</textarea>
  </div>`;
  document.body.appendChild(modal);
}

function copyExportedHtml() {
  const ta = document.getElementById('export-html-output');
  navigator.clipboard.writeText(ta.value).then(() => showToast('HTML copied!'));
}

// ---- Preview ----
function previewEditorEmail() {
  if (editorBlocks.length === 0) return showToast('Add some blocks first', 'error');
  const html = generateEmailHtml();
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `<div class="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
    <div class="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
      <h3 class="text-lg font-semibold text-gray-900">Email Preview</h3>
      <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
    </div>
    <div class="flex-1 overflow-auto"><iframe id="preview-iframe" style="width:100%;height:100%;min-height:500px;border:0;"></iframe></div>
  </div>`;
  document.body.appendChild(modal);
  const iframe = modal.querySelector('#preview-iframe');
  iframe.srcdoc = html;
}

// ---- Save as Template ----
function saveEditorAsTemplate() {
  if (editorBlocks.length === 0) return showToast('Add some blocks first', 'error');
  if (!getApiKey()) return showToast('Enter API key first', 'error');

  const html = generateEmailHtml();
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `<div class="bg-white rounded-2xl w-full max-w-lg">
    <div class="p-6 border-b border-gray-200">
      <h3 class="text-lg font-semibold text-gray-900">Save as Template</h3>
      <p class="text-sm text-gray-500 mt-1">Save your design as a reusable email template.</p>
    </div>
    <form id="save-template-form" class="p-6 space-y-4" onsubmit="submitSaveTemplate(event)">
      <div><label class="block text-sm font-medium text-gray-700 mb-1.5">Template Name <span class="text-red-500">*</span></label>
        <input type="text" id="save-tpl-name" required pattern="[a-zA-Z0-9_-]+" placeholder="my_campaign_template" class="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none">
        <p class="text-xs text-gray-400 mt-1">Letters, numbers, hyphens, underscores only</p>
      </div>
      <div><label class="block text-sm font-medium text-gray-700 mb-1.5">Subject Line <span class="text-red-500">*</span></label>
        <input type="text" id="save-tpl-subject" required placeholder="Your subject line here" class="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none">
      </div>
      <div><label class="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
        <input type="text" id="save-tpl-desc" placeholder="Brief description" class="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none">
      </div>
      <textarea id="save-tpl-html" class="hidden">${escapeHtml(html)}</textarea>
      <div class="flex gap-3 justify-end pt-2">
        <button type="button" onclick="this.closest('.fixed').remove()" class="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
        <button type="submit" id="save-tpl-btn" class="px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700">Save Template</button>
      </div>
    </form>
  </div>`;
  document.body.appendChild(modal);
}

async function submitSaveTemplate(e) {
  e.preventDefault();
  const name = document.getElementById('save-tpl-name').value.trim();
  const subject = document.getElementById('save-tpl-subject').value.trim();
  const desc = document.getElementById('save-tpl-desc').value.trim();
  const html = document.getElementById('save-tpl-html').value;
  const btn = document.getElementById('save-tpl-btn');

  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    await api('POST', '/templates', {
      name,
      subject,
      bodyHtml: html,
      description: desc || `Created with Template Editor`
    });
    showToast(`Template "${name}" saved!`);
    document.querySelector('#save-template-form').closest('.fixed').remove();
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Save Template';
  }
}

// ---- escapeHtml fallback (if not already defined) ----
if (typeof escapeHtml !== 'function') {
  window.escapeHtml = function(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };
}
