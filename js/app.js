// --- 注入盲盒翻转图片交互样式 ---
const flipStyle = document.createElement('style');
flipStyle.textContent = `
.flip-card { background-color: transparent; width: 220px; max-width: 100%; height: 260px; flex-shrink: 0; perspective: 1000px; cursor: pointer; display: block; margin: 10px 0; -webkit-tap-highlight-color: transparent; }
.flip-card-inner { position: relative; width: 100%; height: 100%; text-align: center; transition: transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1); transform-style: preserve-3d; }
.flip-card.flipped .flip-card-inner { transform: rotateY(180deg); }
.flip-card-front, .flip-card-back { position: absolute; width: 100%; height: 100%; -webkit-backface-visibility: hidden; backface-visibility: hidden; border-radius: 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; box-shadow: 0 4px 15px rgba(0,0,0,0.2); border: 12px solid #f8f9fa; border-bottom-width: 45px; overflow: hidden; }
.flip-card-front { background-color: #e2e5e9; color: #888; font-size: 13px; font-weight: bold; }
.flip-card-front::before { content: '📸'; font-size: 40px; margin-bottom: 12px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1)); }
.flip-card-back { background-color: #fff; color: #444; transform: rotateY(180deg); font-size: 14px; text-align: left; align-items: flex-start; justify-content: flex-start; padding: 10px; overflow-y: auto; line-height: 1.6; }
.flip-card-front span { display: none; }

/* --- 移动端底栏输入框防溢出适配 --- */
#chatInputForm { display: flex !important; width: 100% !important; box-sizing: border-box !important; flex-wrap: nowrap !important; position: relative; }
#chatMessageInput, #commentInput { flex: 1 1 auto !important; min-width: 0 !important; width: 100% !important; }
#chatInputForm button, #chatImageUploadBtn, #sendChatMessageBtn, #sendCommentBtn, #recordCommentBtn, #commentStickerBtn { flex-shrink: 0 !important; }
`;
document.head.appendChild(flipStyle);

// --- 紧急清理浏览器 PWA 顽固缓存 ---
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let r of registrations) r.unregister();
  });
}
// 代码加载完成


// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
  initApp();
});

let activeFilters = ['mine']; // 默认显示"我的记录"

function initApp() {
  // 修正 UI 文案，避免产生“所有人可见等于外网可见”的误解
  window.initStickerManagerModal();
  document.querySelectorAll('select').forEach(function(select) {
    if (select.id === 'diaryVisibility' || select.id === 'anniversaryVisibility') {
      for (var i = 0; i < select.options.length; i++) {
        if (select.options[i].value === 'public') select.options[i].text = '所有好友可见';
        if (select.options[i].value === 'shared') select.options[i].text = '部分好友可见';
      }
    }
  });

  setupAuth();
  setupModal();
  setupWriteDiary();
  setupLinkManagement();
  setupViewTabs();
  setupCollectionModal();
  setupTheme();
  setupMultiSelectDelete();
  setupAISettings();
  setupSidebarFilter();
  setupToggleSidebar();
  initCalendar();
  initAnniversary();
  initParticles();
  initSensing();
  setupPullToRefresh();
  setupRefreshButton();
  setupInfiniteScrollAndSearch();
  if (typeof setupChat === 'function') setupChat();
  
  // 隐藏加载动画
  setTimeout(function() {
    document.getElementById('loading').classList.add('hidden');
  }, 800);

  // 挂载通知监听
  firebase.auth().onAuthStateChanged(function(user) {
    if (user && typeof setupNotificationsListener === 'function') {
      setupNotificationsListener(user.uid);
    }
    if (user && typeof initAIHeartbeat === 'function') {
      initAIHeartbeat();
    }
  });
}

// 创建全局独立的表情包管理模态框
window.initStickerManagerModal = function() {
    if (document.getElementById('stickerManagerModal')) return;
    const stickerModal = document.createElement('div');
    stickerModal.id = 'stickerManagerModal';
    stickerModal.className = 'modal hidden';
    stickerModal.style.zIndex = '3000'; // 确保层级高于聊天界面
    stickerModal.innerHTML = `
        <div class="modal-backdrop" onclick="document.getElementById('stickerManagerModal').classList.add('hidden')"></div>
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h3 class="modal-title">表情包仓库</h3>
                <button onclick="document.getElementById('stickerManagerModal').classList.add('hidden')" class="close-btn">&times;</button>
            </div>
            <div id="stickerConfigArea" class="modal-body" style="display:flex; flex-direction: column; gap: 15px; padding: 20px;">
                <!-- Content will be rendered by JS -->
            </div>
        </div>
    `;
    document.body.appendChild(stickerModal);
}

// 设置移动端下拉刷新 (Pull-to-Refresh)
function setupPullToRefresh() {
  var views = ['diaryView', 'calendarView', 'anniversaryView'];
  
  views.forEach(function(viewId) {
    var view = document.getElementById(viewId);
    if (!view) return;

    var ptrContainer = document.createElement('div');
    ptrContainer.className = 'ptr-container';
    ptrContainer.innerHTML = '↓ 下拉刷新';
    ptrContainer.style.cssText = 'height:0px; overflow:hidden; transition:height 0.3s; display:flex; justify-content:center; align-items:center; color:var(--text-secondary); font-size:13px;';
    view.insertBefore(ptrContainer, view.firstChild);

    var startX = 0, startY = 0, currentY = 0, isPulling = false;

    view.addEventListener('touchstart', function(e) {
      var scrollTop = view.scrollTop || document.documentElement.scrollTop || window.scrollY || 0;
      if (scrollTop <= 0) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        currentY = startY; // 初始化 currentY，防止只有点击时算出巨大的偏差
        isPulling = true;
        ptrContainer.style.transition = 'none';
      }
    }, {passive: true});

    view.addEventListener('touchmove', function(e) {
      if (!isPulling) return;
      var currentX = e.touches[0].clientX;
      currentY = e.touches[0].clientY;
      var dx = currentX - startX;
      var dy = currentY - startY;
      var scrollTop = view.scrollTop || document.documentElement.scrollTop || window.scrollY || 0;
      
      // 必须是垂直往下拉，且下拉幅度大于左右滑动幅度
      if (dy > 0 && dy > Math.abs(dx) && scrollTop <= 0) {
        if(e.cancelable) e.preventDefault(); // 阻止浏览器原生下拉
        ptrContainer.style.height = Math.min(dy * 0.3, 60) + 'px'; // 增加阻尼
        ptrContainer.innerHTML = dy > 70 ? '↑ 松开刷新' : '↓ 下拉刷新'; // 提高触发阈值
      } else {
        if (dy < 0) isPulling = false; // 如果往上滑，取消刷新状态
      }
    }, {passive: false});

    view.addEventListener('touchend', function(e) {
      if (!isPulling) return;
      isPulling = false;
      ptrContainer.style.transition = 'height 0.3s';
      var dy = currentY - startY;
      if (dy > 70) {
        ptrContainer.style.height = '40px';
        ptrContainer.innerHTML = '⏳ 刷新中...';
        refreshActiveView();
        setTimeout(function() { ptrContainer.style.height = '0px'; }, 1000);
      } else {
        ptrContainer.style.height = '0px';
      }
    });
  });
}

// 设置全局刷新按钮
function setupRefreshButton() {
  var refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function() {
      refreshBtn.classList.add('spin-anim');
      // 整个页面强制刷新
      setTimeout(function() {
        window.location.reload();
      }, 300); // 稍微给点时间让转圈动画显示一下
    });
  }
}

// 设置无限滚动和全文搜索防抖
function setupInfiniteScrollAndSearch() {
  window.addEventListener('scroll', function() {
    if (!document.getElementById('diaryView').classList.contains('hidden')) {
      if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 800) {
        if (window.renderMoreDiaries && !window.isRenderingDiaries) {
          window.renderMoreDiaries();
        }
      }
    }
  });

  var searchInput = document.getElementById('diarySearchInput');
  var searchToggleBtn = document.getElementById('searchToggleBtn');
  var searchContainer = document.getElementById('searchContainer');
  var clearSearchBtn = document.getElementById('clearSearchBtn');

  if (searchToggleBtn && searchContainer && searchInput) {
    searchToggleBtn.addEventListener('click', function() {
      if (searchContainer.style.display === 'none') {
        searchContainer.style.display = 'flex';
        searchInput.focus();
      } else {
        searchContainer.style.display = 'none';
        if (searchInput.value !== '') {
          searchInput.value = '';
          if (typeof loadDiaries === 'function') loadDiaries();
        }
      }
    });
  }
  
  if (clearSearchBtn && searchContainer && searchInput) {
    clearSearchBtn.addEventListener('click', function() {
      searchInput.value = '';
      searchContainer.style.display = 'none';
      if (typeof loadDiaries === 'function') loadDiaries();
    });
  }

  if (searchInput) {
    var searchTimeout = null;
    searchInput.addEventListener('input', function() {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(function() {
        if (typeof loadDiaries === 'function') loadDiaries();
      }, 400);
    });
  }
}

// 设置多选删除
function setupMultiSelectDelete() {
  var batchSelectBtn = document.getElementById('batchSelectBtn');
  var batchActions = document.getElementById('batchActions');
  var selectAllCheckbox = document.getElementById('selectAllDiary');
  var deleteBtn = document.getElementById('deleteSelectedBtn');

  batchSelectBtn.addEventListener('click', function() {
    batchActions.classList.toggle('hidden');
    var isShown = !batchActions.classList.contains('hidden');
    if (isShown) {
      batchSelectBtn.style.background = 'var(--accent-light)';
      batchSelectBtn.style.color = 'var(--accent)';
    } else {
      batchSelectBtn.style.background = '';
      batchSelectBtn.style.color = '';
      document.querySelectorAll('.diary-checkbox').forEach(function(cb) {
        cb.checked = false;
      });
      selectAllCheckbox.checked = false;
    }
    document.querySelectorAll('.diary-checkbox').forEach(function(cb) {
      cb.style.display = isShown ? '' : 'none';
    });
  });

  selectAllCheckbox.addEventListener('change', function() {
    var checkboxes = document.querySelectorAll('.diary-checkbox');
    checkboxes.forEach(function(cb) {
      cb.checked = selectAllCheckbox.checked;
    });
  });

  deleteBtn.addEventListener('click', async function() {
    var checked = document.querySelectorAll('.diary-checkbox:checked');
    if (checked.length === 0) {
      alert('请先选择要删除的记录');
      return;
    }
    if (!confirm('确定要删除选中的 ' + checked.length + ' 篇记录吗？')) {
      return;
    }

    var originalContent = deleteBtn.innerHTML;
    deleteBtn.disabled = true;

    var ids = [];
    checked.forEach(function(cb) {
      var item = cb.closest('[data-id]');
      if (item && item.dataset.id) {
        ids.push(item.dataset.id);
      }
    });

    for (var i = 0; i < ids.length; i++) {
      await db.collection('diaries').doc(ids[i]).delete();
    }

    deleteBtn.innerHTML = originalContent;
    deleteBtn.disabled = false;
    selectAllCheckbox.checked = false;

    // 新增：批量删除完成后，收回批量操作栏并隐藏所有勾选框
    batchActions.classList.add('hidden');
    batchSelectBtn.style.background = '';
    batchSelectBtn.style.color = '';
    document.querySelectorAll('.diary-checkbox').forEach(function(cb) {
      cb.style.display = 'none';
      cb.checked = false; // 确保所有勾选框都取消勾选
    });
    loadDiaries();
  });
}

// --- AIRP (角色扮演) 核心配置引擎 ---
let currentAiConfig = {
  enabled: false,
  apis: [{ id: 'default', name: 'OpenAI 官方 (默认)', url: 'https://api.openai.com/v1/chat/completions', key: '' }],
  activeApiId: 'default',
  chars: [],
  activeCharId: '',
  activePersonaId: '',
  personas: [],
  worldbooks: []
};

// 确保这个函数在全局域，修复之前的未定义报错
window.openAISettingsModal = function() {
  var menu = document.getElementById('userMenuDropdown');
  if (menu) menu.remove();
  
  // 重新将表情包入口注入到设置网格中，防止在聊天界面外找不到快捷入口
  const gridContainer = document.querySelector('#aiSettingsModal .modal-content > div[style*="grid-template-columns"]');
  if (gridContainer && !document.getElementById('aiSettingsStickerBtn')) {
      const stickerBtn = document.createElement('button');
      stickerBtn.id = 'aiSettingsStickerBtn';
      stickerBtn.className = 'liquid-glass-strong ai-menu-btn';
      stickerBtn.setAttribute('onclick', "openStickerManagerFromSettings()");
      stickerBtn.innerHTML = `
        <span style="font-size:28px;margin-bottom:8px;display:block;">🤡</span>
        <span style="font-size:15px;font-weight:500;">表情包</span>
        <span style="font-size:11px;color:var(--text-muted);margin-top:4px;display:block;">全局表情管理</span>
      `;
      gridContainer.appendChild(stickerBtn);
  }
  
  document.getElementById('aiSettingsModal').classList.remove('hidden');
  loadAISettings();
};

window.openStickerManagerFromSettings = function() {
    document.getElementById('aiSettingsModal').classList.add('hidden');
    if (typeof initStickerManagerModal === 'function') window.initStickerManagerModal();
    document.getElementById('stickerManagerModal').classList.remove('hidden');
    if (typeof renderStickerManager === 'function') window.renderStickerManager();
};

async function loadAISettings() {
  if (!currentUser) return;
  try {
    let doc = await db.collection('users').doc(currentUser.uid).get();
    if (doc.exists) {
      let data = doc.data();
      // 如果用户有新的 aiConfig，直接读取
      if (data.aiConfig) {
        currentAiConfig = Object.assign(currentAiConfig, data.aiConfig);
      } 
      // 向下兼容：如果只有旧版的 apiKey，自动迁移进新的结构
      else if (data.aiApiKey) {
        currentAiConfig.apis[0].key = data.aiApiKey;
        currentAiConfig.enabled = true;
        currentAiConfig.chars.push({
          id: 'char_' + Date.now(),
          name: data.aiPersonaName || '神秘的ta',
          avatar: '',
          prompt: data.aiPersonaPrompt || '你是一个温柔体贴的陪伴者。',
          memory: '',
          personaId: ''
        });
        currentAiConfig.activeCharId = currentAiConfig.chars[0].id;
      }
    }
    document.getElementById('aiGlobalToggle').checked = currentAiConfig.enabled;
    renderAiApiConfig();
  } catch (e) {
    console.error('加载 AI 设置失败:', e);
  }
}

// 监听主控台的开关，自动静默保存
document.getElementById('aiGlobalToggle').addEventListener('change', async function(e) {
  currentAiConfig.enabled = e.target.checked;
  if (!currentUser) return;
  try {
    await db.collection('users').doc(currentUser.uid).update({
      aiConfig: currentAiConfig
    });
  } catch (e) {
    console.error('保存设定失败:', e);
  }
});

function setupAISettings() {
  document.getElementById('closeAISettingsModal').addEventListener('click', function() {
    document.getElementById('aiSettingsModal').classList.add('hidden');
  });
}

// 子页面导航
window.openAiSubModal = function(modalId) {
  document.getElementById('aiSettingsModal').classList.add('hidden');
  document.getElementById(modalId).classList.remove('hidden');
  if (modalId === 'aiApiModal') renderAiApiConfig();
  if (modalId === 'aiCharModal') renderAiCharConfig();
  if (modalId === 'aiPersonaModal') renderAiPersonaConfig();
  if (modalId === 'aiWorldbookModal') renderAiWorldbookConfig(); // 移除对 aiStickerModal 的引用
};
window.backToAiMainModal = function(modalId) {
  document.getElementById(modalId).classList.add('hidden');
  document.getElementById('aiSettingsModal').classList.remove('hidden');
};

window.editingApiId = null;
window.apiConfigTab = 'main'; // 状态：记录当前打开的是 'main' 还是 'sub'

window.renderAiApiConfig = function() {
  let select = document.getElementById('apiPresetSelect');
  let detailsArea = document.getElementById('apiDetailsArea');
  if (!select || !detailsArea) return;

  if (!window.editingApiId) window.editingApiId = currentAiConfig.activeApiId || currentAiConfig.apis[0].id;
  
  // 选择器即全局生效，自动同步状态
  currentAiConfig.activeApiId = window.editingApiId;

  select.innerHTML = '';
  currentAiConfig.apis.forEach(api => {
    let opt = document.createElement('option');
    opt.value = api.id;
    opt.textContent = api.name; // 已经去掉了“当前生效”尾缀，因为选中的就是生效的
    if (api.id === window.editingApiId) opt.selected = true;
    select.appendChild(opt);
  });

  let api = currentAiConfig.apis.find(a => a.id === window.editingApiId);
  if (!api) return;

  let isSub = window.apiConfigTab === 'sub';
  let urlField = isSub ? 'subUrl' : 'url';
  let keyField = isSub ? 'subKey' : 'key';
  let modelField = isSub ? 'subModel' : 'model';
  let tempField = isSub ? 'subTemperature' : 'temperature';
  let historyLimitField = isSub ? 'subHistoryLimit' : 'historyLimit';

  let temp = api[tempField] !== undefined ? api[tempField] : 0.7;
  let historyLimit = api[historyLimitField] !== undefined ? api[historyLimitField] : 30;

  let urlPlaceholder = isSub && api.url ? escapeHtml(api.url) : "如 https://api.openai.com/v1";
  let keyPlaceholder = isSub && api.key ? "默认同主 API Key" : "必填 (sk-...)";

  detailsArea.innerHTML = `
    <div>
      <label style="font-size:12px;color:var(--text-muted);margin-bottom:4px;display:block;">预设名称</label>
      <input type="text" value="${escapeHtml(api.name)}" onchange="updateApiConfig('${api.id}', 'name', this.value)" style="width:100%;padding:10px 12px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;">
    </div>
    
    <div style="display:flex;gap:10px;margin:5px 0;background:var(--bg-tertiary);padding:4px;border-radius:10px;border:1px solid var(--border);">
      <button onclick="window.apiConfigTab='main'; renderAiApiConfig();" style="flex:1;padding:8px;border-radius:8px;border:none;background:${!isSub ? 'var(--accent)' : 'transparent'};color:${!isSub ? '#fff' : 'var(--text-muted)'};cursor:pointer;font-size:13px;font-weight:500;transition:all 0.2s;">主 API</button>
      <button onclick="window.apiConfigTab='sub'; renderAiApiConfig();" style="flex:1;padding:8px;border-radius:8px;border:none;background:${isSub ? 'var(--accent)' : 'transparent'};color:${isSub ? '#fff' : 'var(--text-muted)'};cursor:pointer;font-size:13px;font-weight:500;transition:all 0.2s;">副 API (记忆专用)</button>
    </div>

    <div>
      <label style="font-size:12px;color:var(--text-muted);margin-bottom:4px;display:block;">接口 URL (填写到 /v1 即可)</label>
      <input type="text" placeholder="${urlPlaceholder}" value="${escapeHtml(api[urlField] || '')}" onchange="updateApiConfig('${api.id}', '${urlField}', this.value)" style="width:100%;padding:10px 12px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;">
    </div>
    <div>
      <label style="font-size:12px;color:var(--text-muted);margin-bottom:4px;display:block;">API Key (sk-...)</label>
      <input type="password" placeholder="${keyPlaceholder}" value="${escapeHtml(api[keyField] || '')}" onchange="updateApiConfig('${api.id}', '${keyField}', this.value)" style="width:100%;padding:10px 12px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;">
    </div>
    <div>
      <label style="font-size:12px;color:var(--text-muted);margin-bottom:4px;display:block;">模型选择</label>
      <div style="display:flex;gap:8px;">
        <input type="text" id="model_input_${api.id}" placeholder="如 gpt-3.5-turbo" value="${escapeHtml(api[modelField] || 'gpt-3.5-turbo')}" onchange="updateApiConfig('${api.id}', '${modelField}', this.value)" style="flex:1;padding:10px 12px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;">
        <button id="fetch_model_btn_${api.id}" onclick="fetchAiModels('${api.id}')" style="padding:10px 12px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:12px;cursor:pointer;white-space:nowrap;">获取列表</button>
      </div>
      <select id="model_select_${api.id}" style="display:none;width:100%;margin-top:8px;padding:10px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;" onchange="updateApiConfig('${api.id}', '${modelField}', this.value); document.getElementById('model_input_${api.id}').value = this.value;"></select>
    </div>
    <div style="margin-top:5px;">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:6px;">
        <label>温度 (Temperature)</label>
        <span id="temp_val_${api.id}">${temp}</span>
      </div>
      <input type="range" min="0" max="1" step="0.1" value="${temp}" oninput="document.getElementById('temp_val_${api.id}').textContent = this.value" onchange="updateApiConfig('${api.id}', '${tempField}', parseFloat(this.value))" style="width:100%;cursor:pointer;">
    </div>
    <div style="margin-top:12px;">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:6px;">
        <label>携带历史对话条数 (上下文记忆)</label>
        <span id="historyLimit_val_${api.id}">${historyLimit}</span>
      </div>
      <input type="range" min="1" max="100" step="1" value="${historyLimit}" oninput="document.getElementById('historyLimit_val_${api.id}').textContent = this.value" onchange="updateApiConfig('${api.id}', '${historyLimitField}', parseInt(this.value))" style="width:100%;cursor:pointer;">
    </div>
  `;
};

window.switchEditingApi = function(id) {
  window.editingApiId = id;
  currentAiConfig.activeApiId = id;
  renderAiApiConfig();
};

window.deleteAiApiConfig = function() {
  let id = window.editingApiId;
  if (currentAiConfig.apis.length <= 1) {
    alert('至少需要保留一个 API 节点');
    return;
  }
  if (confirm('确定要删除当前预设吗？')) {
    currentAiConfig.apis = currentAiConfig.apis.filter(a => a.id !== id);
    window.editingApiId = currentAiConfig.apis[0].id;
    currentAiConfig.activeApiId = currentAiConfig.apis[0].id;
    renderAiApiConfig();
  }
};

window.fetchAiModels = async function(id) {
  let api = currentAiConfig.apis.find(a => a.id === id);
  let isSub = window.apiConfigTab === 'sub';
  let u_url = isSub && api.subUrl ? api.subUrl : api.url;
  let u_key = isSub && api.subKey ? api.subKey : api.key;
  let u_model = isSub ? api.subModel : api.model;

  if (!api || !u_url || !u_key) return alert('请先填写完整的接口 URL 和 API Key');
  
  let btn = document.getElementById('fetch_model_btn_' + id);
  let originalText = btn.textContent;
  btn.textContent = '获取中...';
  btn.disabled = true;
  
  try {
    let baseUrl = (u_url || '').replace(/\/+$/, '');
    let modelsUrl = baseUrl.endsWith('/chat/completions') ? baseUrl.replace('/chat/completions', '/models') : baseUrl + '/models';
    
    let res = await fetch(modelsUrl, { method: 'GET', headers: { 'Authorization': 'Bearer ' + u_key } });
    if (!res.ok) throw new Error(res.statusText);
    
    let data = await res.json();
    let models = [];
    if (data.data && Array.isArray(data.data)) models = data.data.map(m => m.id);
    models.sort();
    
    let select = document.getElementById('model_select_' + id);
    let input = document.getElementById('model_input_' + id);
    let html = '<option value="">-- 选择模型 --</option>';
    models.forEach(m => { html += `<option value="${m}" ${m === u_model ? 'selected' : ''}>${m}</option>`; });
    
    select.innerHTML = html;
    select.style.display = 'block';
    input.style.display = 'none';
    btn.style.display = 'none';
  } catch (e) {
    alert('获取模型失败。可直接手动输入模型名。\n' + e.message);
  } finally { btn.textContent = originalText; btn.disabled = false; }
};

window.updateApiConfig = function(id, field, value) {
  let api = currentAiConfig.apis.find(a => a.id === id);
  if (api) {
    api[field] = typeof value === 'string' ? value.trim() : value;
    if (field === 'name') {
      let select = document.getElementById('apiPresetSelect');
      if (select && select.options[select.selectedIndex]) {
        select.options[select.selectedIndex].text = value; 
      }
    }
  }
};

window.addAiApiConfig = function() {
  let newId = 'api_' + Date.now();
  currentAiConfig.apis.push({ 
    id: newId, 
    name: '新预设', 
    url: '', key: '', model: 'gpt-3.5-turbo', temperature: 0.7, historyLimit: 30,
    subUrl: '', subKey: '', subModel: 'gpt-3.5-turbo', subTemperature: 0.7, subHistoryLimit: 30
  });
  window.editingApiId = newId;
  currentAiConfig.activeApiId = newId;
  renderAiApiConfig();
};

// --- 表情包仓库 (Sticker) 逻辑 ---
window.editingStickerCollectionId = 'common';
window.userStickers = { collections: [{ id: 'common', name: '常用' }], items: [] };

window.saveUserStickers = async function() {
    if (!currentUser) return;
    try {
        await db.collection('users').doc(currentUser.uid).update({ stickers: window.userStickers });
        if (window.renderChatStickerPanel) window.renderChatStickerPanel();
        if (window.renderCommentStickerPanel) window.renderCommentStickerPanel();
    } catch(e) {
        console.error('保存表情包失败:', e);
    }
}

window.renderStickerManager = function() {
    if (!window.userStickers || !window.userStickers.collections) {
        window.userStickers = {
            collections: [{ id: 'common', name: '常用' }],
            items: []
        };
    }
    if (!window.editingStickerCollectionId || !window.userStickers.collections.some(c => c.id === window.editingStickerCollectionId)) {
        window.editingStickerCollectionId = 'common';
    }
    window.isStickerBatchMode = window.isStickerBatchMode || false;

    const area = document.getElementById('stickerConfigArea');
    if (!area) return;
    const collections = window.userStickers.collections || [];
    const items = window.userStickers.items || [];

    let tabsHtml = '<div style="display:flex; flex-wrap:wrap; gap:8px; border-bottom: 1px solid var(--border); padding-bottom:10px;">';
    collections.forEach(c => {
        const isActive = c.id === window.editingStickerCollectionId;
        tabsHtml += `<button onclick="window.editingStickerCollectionId='${c.id}'; window.renderStickerManager();" style="padding: 6px 12px; border-radius:8px; border: 1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}; background: ${isActive ? 'var(--accent-light)' : 'var(--bg-tertiary)'}; color: ${isActive ? 'var(--accent)' : 'var(--text-primary)'}; cursor:pointer;">${escapeHtml(c.name)}</button>`;
    });
    tabsHtml += `<button onclick="addStickerCollection()" style="padding: 6px 12px; border-radius:8px; border: 1px dashed var(--border); background: transparent; color: var(--text-muted); cursor:pointer;">+ 新建合集</button></div>`;

    let batchControlsHtml = `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-top:10px; margin-bottom:10px; min-height: 32px;">
            <div id="stickerBatchToggleWrap" style="display: ${window.isStickerBatchMode ? 'none' : 'block'};">
                <button onclick="toggleStickerBatchMode()" style="padding:4px 12px; background:var(--bg-tertiary); border:1px solid var(--border); border-radius:15px; color:var(--text-primary); cursor:pointer; font-size:12px;">批量管理</button>
            </div>
            <div id="stickerBatchActions" style="display: ${window.isStickerBatchMode ? 'flex' : 'none'}; align-items:center; width:100%; gap:10px; justify-content:space-between; background:var(--bg-tertiary); padding:4px 10px; border-radius:8px; border:1px solid var(--border); box-sizing:border-box;">
                <label style="display:flex; align-items:center; gap:4px; font-size:12px; margin:0; cursor:pointer; color:var(--text-primary);">
                    <input type="checkbox" id="stickerSelectAllCb" onchange="toggleAllStickers(this.checked)" style="margin:0;"> 全选
                </label>
                <div style="display:flex; gap:8px;">
                    <button onclick="toggleStickerBatchMode()" style="padding:4px 10px; background:transparent; border:1px solid var(--border); border-radius:6px; color:var(--text-primary); cursor:pointer; font-size:12px;">取消</button>
                    <button onclick="deleteSelectedStickers()" style="padding:4px 10px; background:rgba(255,100,100,0.15); border:1px solid rgba(255,100,100,0.3); border-radius:6px; color:#ff6b6b; cursor:pointer; font-size:12px;">删除选中</button>
                </div>
            </div>
        </div>
    `;

    let itemsHtml = '<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap:15px; max-height: 300px; overflow-y:auto; padding:10px 5px;">';
    items.filter(i => i.collectionId === window.editingStickerCollectionId).forEach(item => {
        itemsHtml += `
            <div style="position:relative; text-align:center;">
                 <input type="checkbox" class="sticker-checkbox" value="${item.id}" style="display: ${window.isStickerBatchMode ? 'block' : 'none'}; position:absolute; top:4px; left:4px; z-index:5; width:16px; height:16px; cursor:pointer;"></input>
                <img src="${escapeHtml(item.url)}" style="width:60px; height:60px; object-fit:contain; background:rgba(255,255,255,0.05); border-radius:8px;">
                <input type="text" value="${escapeHtml(item.name)}" onchange="updateSticker('${item.id}', 'name', this.value)" placeholder="名称" style="width:100%; font-size:12px; text-align:center; margin-top:5px; padding:4px; background:var(--bg-tertiary); border:1px solid var(--border); border-radius:4px; color:var(--text-primary);">
                <button onclick="deleteSticker('${item.id}')" style="display: ${window.isStickerBatchMode ? 'none' : 'block'}; position:absolute; top:-8px; right:2px; background: #ff6b6b; color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:12px; line-height:20px;">×</button>
            </div>
        `;
    });
    itemsHtml += `
        <div style="text-align:center; display: ${window.isStickerBatchMode ? 'none' : 'flex'}; flex-direction:column; align-items:center; justify-content:center; border: 2px dashed var(--border); border-radius:8px; aspect-ratio:1; cursor:pointer;" onclick="addStickerManually()">
            <span style="font-size:24px; color:var(--text-muted);">+</span>
            <span style="font-size:12px; color:var(--text-muted);">手动添加</span>
        </div>
    `;
    itemsHtml += '</div>';

    const bulkImportHtml = `
        <div style="margin-top: 10px; display: ${window.isStickerBatchMode ? 'none' : 'block'};">
            <label style="font-size:12px;color:var(--text-muted);margin-bottom:4px;display:block;">批量导入</label>
            <p style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">每行一个表情，格式为：<code style="background:var(--bg-tertiary);padding:2px 4px;border-radius:4px;">名称 URL</code> (名称和URL用空格隔开)</p>
            <textarea id="stickerBulkImport" rows="4" placeholder="开心 http://.../happy.gif\n难过 http://.../sad.png" style="width:100%;padding:10px 12px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;resize:vertical;font-family:inherit;"></textarea>
            <button class="liquid-glass-strong" onclick="bulkImportStickers()" style="margin-top:8px; padding: 8px 16px; background: var(--accent); color:white; border:none; border-radius:8px; cursor:pointer; font-size:13px; font-weight:bold;">开始导入</button>
        </div>
    `;

    area.innerHTML = tabsHtml + batchControlsHtml + itemsHtml + bulkImportHtml;
}

window.addStickerCollection = function() {
    showInputModal('新建合集', '输入合集名称', '', (name) => {
        if (name && name.trim()) {
            window.userStickers.collections.push({ id: 'coll_' + Date.now(), name: name.trim() });
            window.saveUserStickers();
            window.renderStickerManager();
        }
    });
}

window.addStickerManually = function() {
    let existing = document.getElementById('addStickerModal');
    if (existing) existing.remove();

    let modal = document.createElement('div');
    modal.id = 'addStickerModal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:4000;';
    modal.innerHTML = `
        <div style="background:var(--bg-primary);border-radius:12px;padding:24px;width:320px;max-width:90%;">
            <h3 style="margin:0 0 16px;font-size:16px;color:var(--text-primary);">手动添加表情</h3>
            <div style="margin-bottom:12px;">
                <label style="display:block;font-size:13px;color:var(--text-muted);margin-bottom:6px;">表情名称 (用于AI识别)</label>
                <input type="text" id="newStickerName" placeholder="例如：开心" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg-secondary);color:var(--text-primary);box-sizing:border-box;">
            </div>
            <div style="margin-bottom:16px;">
                <label style="display:block;font-size:13px;color:var(--text-muted);margin-bottom:6px;">表情图片 URL</label>
                <input type="text" id="newStickerUrl" placeholder="http://..." style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg-secondary);color:var(--text-primary);box-sizing:border-box;">
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end;">
                <button onclick="document.getElementById('addStickerModal').remove()" style="padding:8px 16px;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--text-primary);cursor:pointer;">取消</button>
                <button id="confirmAddStickerBtn" style="padding:8px 16px;border:none;border-radius:6px;background:var(--accent);color:#fff;cursor:pointer;">确认</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('confirmAddStickerBtn').onclick = () => {
        let name = document.getElementById('newStickerName').value.trim();
        let url = document.getElementById('newStickerUrl').value.trim();
        
        if (!name) return alert('请输入表情名称');
        if (!url || !url.startsWith('http')) return alert('请输入有效的图片 URL');
        
        window.userStickers.items.push({
            id: 'sticker_' + Date.now(),
            name: name,
            url: url,
            collectionId: window.editingStickerCollectionId
        });
        window.saveUserStickers();
        window.renderStickerManager();
        modal.remove();
    };
}

window.bulkImportStickers = function() {
    const text = document.getElementById('stickerBulkImport').value.trim();
    if (!text) return;
    const lines = text.split('\n');
    let addedCount = 0;
    lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
            const name = parts[0];
            const url = parts[1];
            if (name && url.startsWith('http')) {
                window.userStickers.items.push({
                    id: 'sticker_' + Date.now() + Math.random(),
                    name: name,
                    url: url,
                    collectionId: window.editingStickerCollectionId
                });
                addedCount++;
            }
        }
    });
    if (addedCount > 0) {
        alert(`成功导入 ${addedCount} 个表情！`);
        document.getElementById('stickerBulkImport').value = '';
        window.saveUserStickers();
        window.renderStickerManager();
    } else {
        alert('没有找到有效格式的表情数据。');
    }
}

window.updateSticker = function(id, field, value) {
    const item = window.userStickers.items.find(i => i.id === id);
    if (item) {
        item[field] = value.trim();
        window.saveUserStickers();
    }
}

window.deleteSticker = function(id) {
    window.userStickers.items = window.userStickers.items.filter(i => i.id !== id);
    window.saveUserStickers();
    window.renderStickerManager();
}

window.toggleStickerBatchMode = function() {
    window.isStickerBatchMode = !window.isStickerBatchMode;
    window.renderStickerManager();
}

window.toggleAllStickers = function(checked) {
    document.querySelectorAll('.sticker-checkbox').forEach(cb => cb.checked = checked);
}

window.deleteSelectedStickers = function() {
    const checkedBoxes = document.querySelectorAll('.sticker-checkbox:checked');
    if (checkedBoxes.length === 0) {
        alert('请先选择要删除的表情');
        return;
    }
    if (confirm(`确定要删除选中的 ${checkedBoxes.length} 个表情吗？`)) {
        const idsToDelete = Array.from(checkedBoxes).map(cb => cb.value);
        window.userStickers.items = window.userStickers.items.filter(i => !idsToDelete.includes(i.id));
        window.saveUserStickers();
        window.isStickerBatchMode = false;
        window.renderStickerManager();
    }
}

// 角色图鉴逻辑
window.editingCharId = null;
window.charConfigTab = 'basic'; // 状态：basic (基础设定) 或 memory (记忆矩阵)

window.renderAiCharConfig = function() {
  let select = document.getElementById('charPresetSelect');
  let detailsArea = document.getElementById('charDetailsArea');
  if (!select || !detailsArea) return;

  if (!currentAiConfig.chars || currentAiConfig.chars.length === 0) {
    currentAiConfig.chars = [{ id: 'char_' + Date.now(), name: '神秘的ta', avatar: '🤖', prompt: '你是一个温柔体贴的陪伴者。', memory: '', coreMemory: '', shortTermMemory: '', archivedMemory: '', interactThreshold: 1, archiveThreshold: 5, interactionBuffer: [], boundPersonaId: '' }];
    currentAiConfig.activeCharId = currentAiConfig.chars[0].id;
  }

  if (!window.editingCharId) window.editingCharId = currentAiConfig.activeCharId || currentAiConfig.chars[0].id;
  currentAiConfig.activeCharId = window.editingCharId;

  select.innerHTML = '';
  currentAiConfig.chars.forEach(char => {
    let opt = document.createElement('option');
    opt.value = char.id;
    opt.textContent = char.name;
    if (char.id === window.editingCharId) opt.selected = true;
    select.appendChild(opt);
  });

  let char = currentAiConfig.chars.find(c => c.id === window.editingCharId);
  if (!char) return;

  let isBasic = window.charConfigTab === 'basic';
  let isMemory = window.charConfigTab === 'memory';
  let isVoice = window.charConfigTab === 'voice';

  let personas = currentAiConfig.personas || [];
  let personaOptions = '<option value="">-- 不绑定自设 --</option>';
  personas.forEach(p => {
    personaOptions += `<option value="${p.id}" ${char.boundPersonaId === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`;
  });

  let tabsHtml = `
    <div style="display:flex;gap:10px;margin-bottom:15px;background:var(--bg-tertiary);padding:4px;border-radius:10px;border:1px solid var(--border);">
      <button onclick="window.charConfigTab='basic'; renderAiCharConfig();" style="flex:1;padding:8px 4px;border-radius:8px;border:none;background:${isBasic ? 'var(--accent)' : 'transparent'};color:${isBasic ? '#fff' : 'var(--text-muted)'};cursor:pointer;font-size:12px;font-weight:500;transition:all 0.2s;">🎭 设定</button>
      <button onclick="window.charConfigTab='memory'; renderAiCharConfig();" style="flex:1;padding:8px 4px;border-radius:8px;border:none;background:${isMemory ? 'var(--accent)' : 'transparent'};color:${isMemory ? '#fff' : 'var(--text-muted)'};cursor:pointer;font-size:12px;font-weight:500;transition:all 0.2s;">🧠 记忆</button>
      <button onclick="window.charConfigTab='voice'; renderAiCharConfig();" style="flex:1;padding:8px 4px;border-radius:8px;border:none;background:${isVoice ? 'var(--accent)' : 'transparent'};color:${isVoice ? '#fff' : 'var(--text-muted)'};cursor:pointer;font-size:12px;font-weight:500;transition:all 0.2s;">🎤 语音</button>
    </div>
  `;

  let basicHtml = `
    <div style="display:flex;gap:10px;margin-bottom:12px;">
      <div style="flex:1;">
        <label style="font-size:12px;color:var(--text-muted);margin-bottom:4px;display:block;">角色名字</label>
        <input type="text" value="${escapeHtml(char.name)}" onchange="updateCharConfig('${char.id}', 'name', this.value)" style="width:100%;padding:10px 12px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;">
      </div>
      <div style="width:50px;display:flex;flex-direction:column;align-items:center;">
        <label style="font-size:12px;color:var(--text-muted);margin-bottom:4px;display:block;">头像</label>
        <div onclick="uploadAiCharAvatar('${char.id}')" style="width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;cursor:pointer;border:1px solid var(--border);overflow:hidden;position:relative;" title="点击上传头像图片">
          ${char.avatar && char.avatar.startsWith('http') ? `<img src="${escapeHtml(char.avatar)}" style="width:100%;height:100%;object-fit:cover;">` : `<span style="font-size:20px;">${escapeHtml(char.avatar || '🤖')}</span>`}
        </div>
      </div>
    </div>
    <div style="margin-bottom:12px;">
      <label style="font-size:12px;color:var(--text-muted);margin-bottom:4px;display:flex;justify-content:space-between;"><span>你的身份 (自设)</span><span style="font-size:11px;color:var(--accent);cursor:pointer;" onclick="openAiSubModal('aiPersonaModal')">去配置</span></label>
      <select onchange="updateCharConfig('${char.id}', 'boundPersonaId', this.value)" style="width:100%;padding:10px 12px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;outline:none;">
        ${personaOptions}
      </select>
    </div>
    <div>
      <label style="font-size:12px;color:var(--text-muted);margin-bottom:4px;display:block;">世界观与人设 (Prompt)</label>
      <textarea rows="6" placeholder="描绘ta的性格、世界观，以及你们的故事..." onchange="updateCharConfig('${char.id}', 'prompt', this.value)" style="width:100%;padding:10px 12px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;resize:vertical;font-family:inherit;">${escapeHtml(char.prompt || '')}</textarea>
    </div>
    <div>
      <label style="font-size:12px;color:var(--text-muted);margin-bottom:4px;display:block;">过往经历 (Experience)</label>
      <textarea rows="4" placeholder="ta的身世背景、过往经历，以及你们在遇到「久刹」前发生过的故事..." onchange="updateCharConfig('${char.id}', 'memory', this.value)" style="width:100%;padding:10px 12px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;resize:vertical;font-family:inherit;">${escapeHtml(char.memory || '')}</textarea>
      <p style="font-size:11px;color:var(--text-muted);margin-top:4px;">这部分经历将作为核心背景设定强制携带。</p>
    </div>
  `;

  let interactThresh = char.interactThreshold || 1;
  let archiveThresh = char.archiveThreshold || 5;

  let memoryHtml = `
    <div style="display:flex;gap:10px;margin-bottom:15px;">
      <div style="flex:1;background:var(--bg-tertiary);padding:12px;border-radius:10px;border:1px solid var(--border);">
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:6px;">生成短期记忆 (a)</label>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:12px;color:var(--text-primary);">每</span>
          <input type="number" min="1" max="10" value="${interactThresh}" onchange="updateCharConfig('${char.id}', 'interactThreshold', parseInt(this.value))" style="width:45px;padding:6px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);text-align:center;font-size:13px;">
          <span style="font-size:12px;color:var(--text-primary);">次记录生成 1 条</span>
        </div>
      </div>
      <div style="flex:1;background:var(--bg-tertiary);padding:12px;border-radius:10px;border:1px solid var(--border);">
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:6px;">触发大清洗 (b)</label>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:12px;color:var(--text-primary);">满</span>
          <input type="number" min="2" max="20" value="${archiveThresh}" onchange="updateCharConfig('${char.id}', 'archiveThreshold', parseInt(this.value))" style="width:45px;padding:6px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);text-align:center;font-size:13px;">
          <span style="font-size:12px;color:var(--text-primary);">条后自动归档</span>
        </div>
      </div>
    </div>
    <div>
      <label style="font-size:12px;color:#ff8faa;margin-bottom:4px;display:block;font-weight:bold;">💠 核心记忆 (Core Memory)</label>
      <p style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">记录你们的重大事件、绝对的喜好/雷区、以及不可磨灭的印记。</p>
      <textarea rows="4" placeholder="例如：主人的生日是... 主人对xx过敏... 我们约定过..." onchange="updateCharConfig('${char.id}', 'coreMemory', this.value)" style="width:100%;padding:10px 12px;background:rgba(255,143,170,0.05);border:1px solid rgba(255,143,170,0.3);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;resize:vertical;font-family:inherit;">${escapeHtml(char.coreMemory || '')}</textarea>
    </div>
    <div style="margin-top:12px;">
      <label style="font-size:12px;color:var(--accent);margin-bottom:4px;display:block;font-weight:bold;">📝 近期记忆 (Short-term Memory)</label>
      <p style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">最近的交互碎片，满一定数量后将自动触发总结归档。</p>
      <textarea rows="4" placeholder="副 API 会自动将近期的流水账记录在此..." onchange="updateCharConfig('${char.id}', 'shortTermMemory', this.value)" style="width:100%;padding:10px 12px;background:rgba(100,180,255,0.05);border:1px solid rgba(100,180,255,0.3);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;resize:vertical;font-family:inherit;">${escapeHtml(char.shortTermMemory || '')}</textarea>
    </div>
    <div style="margin-top:12px;">
      <label style="font-size:12px;color:#52c97a;margin-bottom:4px;display:block;font-weight:bold;">📚 记忆归档 (Archived Summary)</label>
      <p style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">由大量近期记忆浓缩而成的大总结，记录长线剧情的发展。</p>
      <textarea rows="4" placeholder="由系统自动总结的长期剧情回顾..." onchange="updateCharConfig('${char.id}', 'archivedMemory', this.value)" style="width:100%;padding:10px 12px;background:rgba(82,201,122,0.05);border:1px solid rgba(82,201,122,0.3);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;resize:vertical;font-family:inherit;">${escapeHtml(char.archivedMemory || '')}</textarea>
    </div>
  `;

  let voiceHtml = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.1);">
      <label style="font-size:14px;font-weight:bold;color:var(--text-primary);">开启角色语音 (MiniMax TTS)</label>
      <label class="toggle-switch" style="transform:scale(0.8);transform-origin:right;margin:0;">
        <input type="checkbox" ${char.ttsEnabled ? 'checked' : ''} onchange="updateCharConfig('${char.id}', 'ttsEnabled', this.checked)">
        <span class="slider"></span>
      </label>
    </div>
    <div style="margin-bottom:12px;">
      <label style="font-size:12px;color:var(--text-muted);margin-bottom:4px;display:block;">MiniMax API Key</label>
      <input type="password" placeholder="必填，用于生成声音的 Key" value="${escapeHtml(char.ttsApiKey || '')}" onchange="updateCharConfig('${char.id}', 'ttsApiKey', this.value)" style="width:100%;padding:10px 12px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;">
    </div>
    <div style="margin-bottom:12px;">
      <label style="font-size:12px;color:var(--text-muted);margin-bottom:4px;display:block;">模型版本</label>
      <select onchange="updateCharConfig('${char.id}', 'ttsModel', this.value)" style="width:100%;padding:10px 12px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;outline:none;">
        <option value="speech-2.8-hd" ${char.ttsModel === 'speech-2.8-hd' ? 'selected' : ''}>speech-2.8-hd (情感最丰沛,推荐)</option>
        <option value="speech-01-hd" ${char.ttsModel === 'speech-01-hd' ? 'selected' : ''}>speech-01-hd</option>
      </select>
    </div>
    <div style="margin-bottom:12px;">
      <label style="font-size:12px;color:var(--text-muted);margin-bottom:4px;display:flex;justify-content:space-between;"><span>音色 ID (Voice ID)</span><a href="https://platform.minimaxi.com/document/system-voice-id" target="_blank" style="color:var(--accent);text-decoration:none;font-size:11px;">去官网听音色</a></label>
      <input type="text" placeholder="如 male-qn-qingse" value="${escapeHtml(char.ttsVoiceId || '')}" onchange="updateCharConfig('${char.id}', 'ttsVoiceId', this.value)" style="width:100%;padding:10px 12px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;">
      <p style="font-size:11px;color:var(--text-muted);margin-top:6px;">推荐男声：male-qn-qingse (青涩) / moss_audio_ce44fc67... (成熟)<br>推荐女声：female-shaonv (少女) / moss_audio_aaa1346a... (御姐)</p>
    </div>
  `;

  detailsArea.innerHTML = tabsHtml + (isBasic ? basicHtml : (isMemory ? memoryHtml : voiceHtml));
};

window.switchEditingChar = function(id) {
  window.editingCharId = id;
  currentAiConfig.activeCharId = id;
  renderAiCharConfig();
};

window.updateCharConfig = function(id, field, value) {
  let char = currentAiConfig.chars.find(c => c.id === id);
  if (char) {
    char[field] = typeof value === 'string' ? value.trim() : value;
    if (field === 'name') {
      let select = document.getElementById('charPresetSelect');
      if (select && select.options[select.selectedIndex]) select.options[select.selectedIndex].text = value; 
    }
  }
};

let aiCropImage = null;
let aiCropSelection = { x: 0, y: 0, size: 0 };
let aiIsDragging = false;
let aiDragStart = { x: 0, y: 0 };
let currentAiCharIdForCrop = null;

window.uploadAiCharAvatar = function(charId) {
  let input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = function(e) {
    let file = e.target.files[0];
    if (!file) return;
    currentAiCharIdForCrop = charId;
    var reader = new FileReader();
    reader.onload = function(ev) {
      aiCropImage = new Image();
      aiCropImage.onload = function() {
        openAiCropModal(aiCropImage);
      };
      aiCropImage.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };
  input.click();
};

function openAiCropModal(img) {
  var canvas = document.getElementById('aiCropCanvas');
  var ctx = canvas.getContext('2d');
  var maxSize = 300;
  var scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  aiCropSelection.size = Math.min(canvas.width, canvas.height) * 0.8;
  aiCropSelection.x = (canvas.width - aiCropSelection.size) / 2;
  aiCropSelection.y = (canvas.height - aiCropSelection.size) / 2;
  drawAiCropOverlay();
  document.getElementById('aiCropModal').classList.remove('hidden');
}

function drawAiCropOverlay() {
  var canvas = document.getElementById('aiCropCanvas');
  var ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(aiCropImage, 0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;
  var step = aiCropSelection.size / 3;
  for (var i = 1; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(aiCropSelection.x + step * i, aiCropSelection.y); ctx.lineTo(aiCropSelection.x + step * i, aiCropSelection.y + aiCropSelection.size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(aiCropSelection.x, aiCropSelection.y + step * i); ctx.lineTo(aiCropSelection.x + aiCropSelection.size, aiCropSelection.y + step * i); ctx.stroke();
  }
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.strokeRect(aiCropSelection.x, aiCropSelection.y, aiCropSelection.size, aiCropSelection.size);
  var cornerSize = 15; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(aiCropSelection.x, aiCropSelection.y + cornerSize); ctx.lineTo(aiCropSelection.x, aiCropSelection.y); ctx.lineTo(aiCropSelection.x + cornerSize, aiCropSelection.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(aiCropSelection.x + aiCropSelection.size - cornerSize, aiCropSelection.y); ctx.lineTo(aiCropSelection.x + aiCropSelection.size, aiCropSelection.y); ctx.lineTo(aiCropSelection.x + aiCropSelection.size, aiCropSelection.y + cornerSize); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(aiCropSelection.x, aiCropSelection.y + aiCropSelection.size - cornerSize); ctx.lineTo(aiCropSelection.x, aiCropSelection.y + aiCropSelection.size); ctx.lineTo(aiCropSelection.x + cornerSize, aiCropSelection.y + aiCropSelection.size); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(aiCropSelection.x + aiCropSelection.size - cornerSize, aiCropSelection.y + aiCropSelection.size); ctx.lineTo(aiCropSelection.x + aiCropSelection.size, aiCropSelection.y + aiCropSelection.size); ctx.lineTo(aiCropSelection.x + aiCropSelection.size, aiCropSelection.y + aiCropSelection.size - cornerSize); ctx.stroke();
}

document.addEventListener('DOMContentLoaded', function() {
  var canvas = document.getElementById('aiCropCanvas');
  if (!canvas) return;
  function handleStart(e) {
    if(document.getElementById('aiCropModal').classList.contains('hidden')) return;
    e.preventDefault(); aiIsDragging = true;
    var rect = canvas.getBoundingClientRect();
    aiDragStart.x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    aiDragStart.y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
  }
  function handleMove(e) {
    if (!aiIsDragging || document.getElementById('aiCropModal').classList.contains('hidden')) return;
    e.preventDefault();
    var rect = canvas.getBoundingClientRect();
    var x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    var y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    var dx = x - aiDragStart.x; var dy = y - aiDragStart.y;
    aiCropSelection.x = Math.max(0, Math.min(aiCropSelection.x + dx, canvas.width - aiCropSelection.size));
    aiCropSelection.y = Math.max(0, Math.min(aiCropSelection.y + dy, canvas.height - aiCropSelection.size));
    aiDragStart.x = x; aiDragStart.y = y;
    drawAiCropOverlay();
  }
  function handleEnd() { aiIsDragging = false; }
  canvas.addEventListener('mousedown', handleStart);
  canvas.addEventListener('touchstart', handleStart, {passive: false});
  document.addEventListener('mousemove', handleMove, {passive: false});
  document.addEventListener('touchmove', handleMove, {passive: false});
  document.addEventListener('mouseup', handleEnd);
  document.addEventListener('touchend', handleEnd);

  document.getElementById('confirmAiCropBtn').addEventListener('click', function() {
    if (!aiCropImage) return;
    var btn = document.getElementById('confirmAiCropBtn');
    var oldText = btn.textContent;
    btn.textContent = '处理中...'; btn.disabled = true;
    var scaleX = aiCropImage.width / canvas.width;
    var scaleY = aiCropImage.height / canvas.height;
    var cropCanvas = document.createElement('canvas');
    cropCanvas.width = 200; cropCanvas.height = 200;
    cropCanvas.getContext('2d').drawImage(aiCropImage, aiCropSelection.x * scaleX, aiCropSelection.y * scaleY, aiCropSelection.size * scaleX, aiCropSelection.size * scaleY, 0, 0, 200, 200);
    
    cropCanvas.toBlob(async function(blob) {
      if (!blob) { alert('裁剪失败'); btn.textContent = oldText; btn.disabled = false; return; }
      try {
        let url = await uploadToCloudinary(blob);
        updateCharConfig(currentAiCharIdForCrop, 'avatar', url);
        renderAiCharConfig();
        document.getElementById('aiCropModal').classList.add('hidden');
      } catch (err) {
        console.error('头像上传失败:', err);
        alert('头像上传失败，请重试');
      } finally {
        btn.textContent = oldText; btn.disabled = false; aiCropImage = null;
      }
    }, 'image/jpeg', 0.8);
  });

  document.getElementById('closeAiCropModal').addEventListener('click', function() {
    document.getElementById('aiCropModal').classList.add('hidden');
    aiCropImage = null;
  });
  document.querySelector('#aiCropModal .modal-backdrop').addEventListener('click', function() {
    document.getElementById('aiCropModal').classList.add('hidden');
    aiCropImage = null;
  });
});

window.addAiCharConfig = function() {
  let newId = 'char_' + Date.now();
  currentAiConfig.chars.push({ id: newId, name: '新角色', avatar: '🤖', prompt: '你是一个温柔的陪伴者。', memory: '', coreMemory: '', shortTermMemory: '', archivedMemory: '', interactThreshold: 1, archiveThreshold: 5, interactionBuffer: [], boundPersonaId: '' });
  window.editingCharId = newId;
  currentAiConfig.activeCharId = newId;
  renderAiCharConfig();
};

window.deleteAiCharConfig = function() {
  let id = window.editingCharId;
  if (currentAiConfig.chars.length <= 1) return alert('至少需要保留一个角色');
  if (confirm('确定要删除当前角色吗？')) {
    currentAiConfig.chars = currentAiConfig.chars.filter(c => c.id !== id);
    window.editingCharId = currentAiConfig.chars[0].id;
    currentAiConfig.activeCharId = currentAiConfig.chars[0].id;
    renderAiCharConfig();
  }
};

// --- 我的自设 (Persona) 逻辑 ---
window.editingPersonaId = null;

window.renderAiPersonaConfig = function() {
  let select = document.getElementById('personaPresetSelect');
  let detailsArea = document.getElementById('personaDetailsArea');
  if (!select || !detailsArea) return;

  if (!currentAiConfig.personas) currentAiConfig.personas = [];
  if (currentAiConfig.personas.length === 0) {
    currentAiConfig.personas = [{ id: 'persona_' + Date.now(), name: '默认身份', prompt: '我是一个平凡的人。' }];
    currentAiConfig.activePersonaId = currentAiConfig.personas[0].id;
  }

  if (!window.editingPersonaId) window.editingPersonaId = currentAiConfig.activePersonaId || currentAiConfig.personas[0].id;
  currentAiConfig.activePersonaId = window.editingPersonaId;

  select.innerHTML = '';
  currentAiConfig.personas.forEach(p => {
    let opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    if (p.id === window.editingPersonaId) opt.selected = true;
    select.appendChild(opt);
  });

  let persona = currentAiConfig.personas.find(p => p.id === window.editingPersonaId);
  if (!persona) return;

  detailsArea.innerHTML = `
    <div>
      <label style="font-size:12px;color:var(--text-muted);margin-bottom:4px;display:block;">身份名称</label>
      <input type="text" value="${escapeHtml(persona.name)}" onchange="updatePersonaConfig('${persona.id}', 'name', this.value)" style="width:100%;padding:10px 12px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;">
    </div>
    <div>
      <label style="font-size:12px;color:var(--text-muted);margin-bottom:4px;display:block;">自我设定 (Prompt)</label>
      <p style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">告诉 AI 你是谁、你的性格、背景、甚至是一些小怪癖。</p>
      <textarea rows="6" placeholder="例如：我是你的造物主，平时说话比较幽默，喜欢随口吐槽，讨厌吃香菜..." onchange="updatePersonaConfig('${persona.id}', 'prompt', this.value)" style="width:100%;padding:10px 12px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;resize:vertical;font-family:inherit;">${escapeHtml(persona.prompt || '')}</textarea>
    </div>
  `;
};

window.switchEditingPersona = function(id) {
  window.editingPersonaId = id;
  currentAiConfig.activePersonaId = id;
  renderAiPersonaConfig();
};

window.updatePersonaConfig = function(id, field, value) {
  let p = currentAiConfig.personas.find(c => c.id === id);
  if (p) {
    p[field] = typeof value === 'string' ? value.trim() : value;
    if (field === 'name') {
      let select = document.getElementById('personaPresetSelect');
      if (select && select.options[select.selectedIndex]) select.options[select.selectedIndex].text = value; 
    }
  }
};

window.addAiPersonaConfig = function() {
  let newId = 'persona_' + Date.now();
  currentAiConfig.personas.push({ id: newId, name: '新身份', prompt: '我的新设定...' });
  window.editingPersonaId = newId;
  currentAiConfig.activePersonaId = newId;
  renderAiPersonaConfig();
};

window.deleteAiPersonaConfig = function() {
  let id = window.editingPersonaId;
  if (currentAiConfig.personas.length <= 1) return alert('至少需要保留一个身份');
  if (confirm('确定要删除当前身份吗？')) {
    currentAiConfig.personas = currentAiConfig.personas.filter(c => c.id !== id);
    window.editingPersonaId = currentAiConfig.personas[0].id;
    currentAiConfig.activePersonaId = currentAiConfig.personas[0].id;
    renderAiPersonaConfig();
  }
};

// --- 世界书 (Worldbook) 逻辑 ---
window.editingWorldbookId = null;

window.renderAiWorldbookConfig = function() {
  let select = document.getElementById('worldbookPresetSelect');
  let detailsArea = document.getElementById('worldbookDetailsArea');
  if (!select || !detailsArea) return;

  if (!currentAiConfig.worldbooks) currentAiConfig.worldbooks = [];
  if (currentAiConfig.worldbooks.length === 0) {
    currentAiConfig.worldbooks = [{ id: 'wb_' + Date.now(), name: '通用规则', content: '绝不能承认自己是AI。', isEnabled: true, isGlobal: true, boundCharId: '' }];
  }

  if (!window.editingWorldbookId) window.editingWorldbookId = currentAiConfig.worldbooks[0].id;

  select.innerHTML = '';
  currentAiConfig.worldbooks.forEach(wb => {
    let opt = document.createElement('option');
    opt.value = wb.id;
    opt.textContent = (wb.isEnabled ? '✅ ' : '❌ ') + wb.name;
    if (wb.id === window.editingWorldbookId) opt.selected = true;
    select.appendChild(opt);
  });

  let wb = currentAiConfig.worldbooks.find(w => w.id === window.editingWorldbookId);
  if (!wb) {
     window.editingWorldbookId = currentAiConfig.worldbooks[0].id;
     wb = currentAiConfig.worldbooks[0];
  }

  let charOptions = '<option value="">-- 选择绑定的专属角色 --</option>';
  (currentAiConfig.chars || []).forEach(c => {
    charOptions += `<option value="${c.id}" ${wb.boundCharId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`;
  });

  detailsArea.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.1);">
      <label style="font-size:14px;font-weight:bold;color:var(--text-primary);">启用此条规则设定</label>
      <label class="toggle-switch" style="transform:scale(0.8);transform-origin:right;margin:0;">
        <input type="checkbox" ${wb.isEnabled ? 'checked' : ''} onchange="updateWorldbookConfig('${wb.id}', 'isEnabled', this.checked)">
        <span class="slider"></span>
      </label>
    </div>
    <div>
      <label style="font-size:12px;color:var(--text-muted);margin-bottom:4px;display:block;">规则 / 词条名称</label>
      <input type="text" value="${escapeHtml(wb.name)}" onchange="updateWorldbookConfig('${wb.id}', 'name', this.value)" style="width:100%;padding:10px 12px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;">
    </div>
    <div style="margin-top:5px;display:flex;gap:15px;background:var(--bg-tertiary);padding:10px 12px;border-radius:8px;border:1px solid var(--border);">
      <label style="font-size:13px;color:var(--text-primary);display:flex;align-items:center;gap:6px;cursor:pointer;">
        <input type="radio" name="wbType_${wb.id}" ${wb.isGlobal ? 'checked' : ''} onchange="updateWorldbookConfig('${wb.id}', 'isGlobal', true); renderAiWorldbookConfig();" style="accent-color:var(--accent);"> 全局生效
      </label>
      <label style="font-size:13px;color:var(--text-primary);display:flex;align-items:center;gap:6px;cursor:pointer;">
        <input type="radio" name="wbType_${wb.id}" ${!wb.isGlobal ? 'checked' : ''} onchange="updateWorldbookConfig('${wb.id}', 'isGlobal', false); renderAiWorldbookConfig();" style="accent-color:var(--accent);"> 角色专属
      </label>
    </div>
    ${!wb.isGlobal ? `
      <div style="margin-top:5px;">
        <label style="font-size:12px;color:var(--accent);margin-bottom:4px;display:block;">绑定至固定角色</label>
        <select onchange="updateWorldbookConfig('${wb.id}', 'boundCharId', this.value)" style="width:100%;padding:10px 12px;background:rgba(100,180,255,0.05);border:1px solid var(--accent);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;outline:none;">
          ${charOptions}
        </select>
      </div>
    ` : ''}
    <div style="margin-top:5px;">
      <label style="font-size:12px;color:var(--text-muted);margin-bottom:4px;display:block;">内容 (设定、禁忌或知识库)</label>
      <textarea rows="6" placeholder="例如：设定背景在赛博朋克2077年；或者绝对禁止说废话..." onchange="updateWorldbookConfig('${wb.id}', 'content', this.value)" style="width:100%;padding:10px 12px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;resize:vertical;font-family:inherit;">${escapeHtml(wb.content || '')}</textarea>
    </div>
  `;
};

window.switchEditingWorldbook = function(id) {
  window.editingWorldbookId = id;
  renderAiWorldbookConfig();
};

window.updateWorldbookConfig = function(id, field, value) {
  let wb = currentAiConfig.worldbooks.find(w => w.id === id);
  if (wb) {
    wb[field] = typeof value === 'string' ? value.trim() : value;
    if (field === 'name' || field === 'isEnabled') {
      let select = document.getElementById('worldbookPresetSelect');
      if (select && select.options[select.selectedIndex]) select.options[select.selectedIndex].text = (wb.isEnabled ? '✅ ' : '❌ ') + wb.name;
    }
  }
};

window.addAiWorldbookConfig = function() {
  let newId = 'wb_' + Date.now();
  currentAiConfig.worldbooks.push({ id: newId, name: '新设定', content: '', isEnabled: true, isGlobal: true, boundCharId: '' });
  window.editingWorldbookId = newId;
  renderAiWorldbookConfig();
};

window.deleteAiWorldbookConfig = function() {
  let id = window.editingWorldbookId;
  if (currentAiConfig.worldbooks.length <= 1) return alert('至少需要保留一条世界书规则');
  if (confirm('确定要删除当前设定吗？')) {
    currentAiConfig.worldbooks = currentAiConfig.worldbooks.filter(w => w.id !== id);
    window.editingWorldbookId = currentAiConfig.worldbooks[0].id;
    renderAiWorldbookConfig();
  }
};

window.saveAiConfig = async function(btn) {
  let origText = btn ? btn.textContent : '保存中...';
  if (btn) { btn.textContent = '保存中...'; btn.disabled = true; }
  try {
    await db.collection('users').doc(currentUser.uid).update({ aiConfig: currentAiConfig });
    if (currentUserData) currentUserData.aiConfig = currentAiConfig;
    alert('配置已成功保存至云端！');
  } catch(e) {
    alert('保存失败: ' + e.message);
  } finally {
    if (btn) { btn.textContent = origText; btn.disabled = false; }
    if (window.renderAiApiConfig) renderAiApiConfig();
    if (window.renderAiCharConfig) renderAiCharConfig();
    if (window.renderAiPersonaConfig) renderAiPersonaConfig();
    if (window.renderAiWorldbookConfig) renderAiWorldbookConfig();
  }
};

// 设置认证
function setupAuth() {
  var authForm = document.getElementById('authForm');
  var authTabs = document.querySelectorAll('.auth-tab');
  var displayNameInput = document.getElementById('displayName');
  var confirmPasswordInput = document.getElementById('confirmPassword');
  var authBtn = document.getElementById('authBtn');
  var authError = document.getElementById('authError');
  var forgotPasswordLink = document.getElementById('forgotPasswordLink');
  var isLogin = true;

  // 初始化显示忘记密码链接
  forgotPasswordLink.style.display = 'block';

  authTabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      authTabs.forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      isLogin = tab.dataset.tab === 'login';
      displayNameInput.classList.toggle('hidden', isLogin);
      confirmPasswordInput.classList.toggle('hidden', isLogin);
      forgotPasswordLink.style.display = isLogin ? 'block' : 'none';
      authBtn.textContent = isLogin ? '登录' : '注册';
      authError.textContent = '';
    });
  });

  forgotPasswordLink.addEventListener('click', async function() {
    var email = document.getElementById('email').value.trim();
    if (!email) {
      authError.textContent = '请输入邮箱';
      return;
    }
    forgotPasswordLink.textContent = '发送中...';
    try {
      await auth.sendPasswordResetEmail(email);
      authError.textContent = '重置链接已发送到邮箱';
      authError.style.color = '#6bff6b';
    } catch (error) {
      authError.textContent = error.message;
      authError.style.color = '';
    }
    forgotPasswordLink.textContent = '忘记密码？';
  });

  authForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    authError.textContent = '';
    authError.style.color = '';
    authBtn.textContent = '请稍候...';
    authBtn.disabled = true;

    var email = document.getElementById('email').value;
    var password = document.getElementById('password').value;
    var displayName = document.getElementById('displayName').value;

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        if (!displayName.trim()) {
          authError.textContent = '请输入昵称';
          authBtn.textContent = '注册';
          authBtn.disabled = false;
          return;
        }
        if (password !== confirmPasswordInput.value) {
          authError.textContent = '两次密码输入不一致';
          authBtn.textContent = '注册';
          authBtn.disabled = false;
          return;
        }
        if (password.length < 6) {
          authError.textContent = '密码至少6位';
          authBtn.textContent = '注册';
          authBtn.disabled = false;
          return;
        }
        await register(email, password, displayName);
      }
    } catch (error) {
      authError.textContent = error.message;
      authBtn.textContent = isLogin ? '登录' : '注册';
      authBtn.disabled = false;
    }
  });
}

// 刷新当前激活的视图（日记/日历/纪念日）
function refreshActiveView() {
  if (!document.getElementById('diaryView').classList.contains('hidden')) {
    loadDiaries();
  } else if (!document.getElementById('calendarView').classList.contains('hidden')) {
    refreshCalendar();
  } else if (!document.getElementById('anniversaryView').classList.contains('hidden')) {
    loadAnniversaries();
  }
}

// 渲染左侧朋友栏
function renderFriendSidebar() {
  var friendList = document.getElementById('friendList');
  friendList.innerHTML = '';

  var items = document.querySelectorAll('.friend-item[data-filter]');
  items.forEach(function(item) {
    item.classList.remove('active');
    if (activeFilters.indexOf(item.dataset.filter) !== -1) {
      item.classList.add('active');
    }
  });

  // 异步加载朋友列表
  getAcceptedLinks().then(async function(acceptedLinks) {
    friendList.innerHTML = '';
    // Accepted links count: debug
    if (acceptedLinks.length === 0) {
      friendList.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:10px;">暂无链接的朋友</div>';
      return;
    }

    // 收集所有需要获取的用户ID
    var otherUserIds = [];
    var linkMap = [];
    for (var i = 0; i < acceptedLinks.length; i++) {
      var linkDoc = acceptedLinks[i];
      var linkData = linkDoc.data();
      var isCreator = linkData.userId === currentUser.uid;
      var otherUid = isCreator ? linkData.acceptedBy : linkData.userId;
      otherUserIds.push(otherUid);
      linkMap.push({ linkDoc: linkDoc, otherUid: otherUid, userId: currentUser.uid });
    }

    // 批量获取用户信息
    var userInfos = await getBatchUserInfo(otherUserIds);
    var userMap = {};
    userInfos.forEach(function(u) { userMap[u.userId] = u; });

    // 渲染朋友列表
    var fragment = document.createDocumentFragment();

    // 注入 AI 好友 (如果用户已配置)
    let aiName = '神秘的ta';
    let aiAvatarChar = '🤖';
    let hasAI = false;
    try {
      if (currentUserData && currentUserData.aiConfig && currentUserData.aiConfig.enabled) {
        hasAI = true;
      }
    } catch(e) {}

    if (hasAI) {
      let chars = currentUserData.aiConfig.chars || [];
      if (chars.length === 0) chars = [{ id: typeof AI_COMPANION_USER_ID !== 'undefined' ? AI_COMPANION_USER_ID : 'char_ai', name: '神秘的ta', avatar: '🤖' }];
      
      chars.forEach(char => {
        let aiName = char.name || '神秘的ta';
        let aiAvatarChar = char.avatar || '🤖';
        let filterId = char.id;

        var aiItem = document.createElement('div');
        aiItem.className = 'friend-item';
        aiItem.dataset.filter = filterId;
        aiItem.style.display = 'flex';
        aiItem.style.alignItems = 'center';
        aiItem.style.justifyContent = 'space-between';
        
        let aiAvatarHtml = '';
        if (aiAvatarChar.startsWith('http')) {
          aiAvatarHtml = '<img src="' + escapeHtml(aiAvatarChar) + '" style="width:24px;height:24px;border-radius:50%;object-fit:cover;margin-right:8px;border:1px solid rgba(255,255,255,0.2);">';
        } else {
          aiAvatarHtml = '<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#8e44ad;font-size:14px;color:#fff;margin-right:8px;">' + escapeHtml(aiAvatarChar) + '</span>';
        }
        
        let leftDiv = document.createElement('div');
        leftDiv.style.display = 'flex';
        leftDiv.style.alignItems = 'center';
        leftDiv.innerHTML = aiAvatarHtml + '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(aiName) + '</span>';
        
        let rightBtn = document.createElement('button');
        rightBtn.innerHTML = '✨ 互动';
        rightBtn.title = '让TA发条动态';
        rightBtn.style.cssText = 'background:var(--accent-light);border:1px solid var(--accent);color:var(--accent);border-radius:10px;cursor:pointer;font-size:11px;padding:3px 8px;transition:all 0.2s;';
        rightBtn.onclick = function(e) {
          e.stopPropagation();
          // 新增：调用带输入框的触发函数
          if (typeof window.triggerAIPostWithPrompt === 'function') {
            window.triggerAIPostWithPrompt(rightBtn, filterId);
          }
        };
        
        aiItem.appendChild(leftDiv);
        aiItem.appendChild(rightBtn);

        if (activeFilters.indexOf(filterId) !== -1) {
          aiItem.classList.add('active');
        }

        aiItem.addEventListener('click', function(e) {
          var clickedItem = e.currentTarget;
          var filterVal = clickedItem.dataset.filter;
          var idx = activeFilters.indexOf(filterVal);
          if (idx !== -1) {
            activeFilters.splice(idx, 1);
          } else {
            activeFilters.push(filterVal);
          }
          clickedItem.classList.toggle('active', activeFilters.indexOf(filterVal) !== -1);
          refreshActiveView();
        });

        fragment.appendChild(aiItem);
      });
    }

    for (var j = 0; j < linkMap.length; j++) {
      var linkDoc = linkMap[j].linkDoc;
      var otherUid = linkMap[j].otherUid;
      var otherUser = userMap[otherUid] || { displayName: 'unknown', avatarUrl: '', userId: otherUid };

      var avatarHtml = renderUserAvatar(otherUser, 24, '8px');

      var item = document.createElement('div');
      item.className = 'friend-item';
      item.dataset.filter = otherUser.userId;
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.innerHTML = avatarHtml + '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(otherUser.displayName) + '</span>';

      if (activeFilters.indexOf(otherUser.userId) !== -1) {
        item.classList.add('active');
      }

      item.addEventListener('click', function(e) {
        var clickedItem = e.currentTarget;
        var filterVal = clickedItem.dataset.filter;
        var idx = activeFilters.indexOf(filterVal);
        if (idx !== -1) {
          activeFilters.splice(idx, 1);
        } else {
          activeFilters.push(filterVal);
        }
        clickedItem.classList.toggle('active', activeFilters.indexOf(filterVal) !== -1);
        refreshActiveView();
      });

      fragment.appendChild(item);
    }

    friendList.appendChild(fragment);
    // friendList debug
  });
}

// 设置侧边栏筛选
function setupSidebarFilter() {
  var myDiaryItem = document.querySelector('.friend-item[data-filter="mine"]');

  if (myDiaryItem) {
    myDiaryItem.addEventListener('click', function() {
      var idx = activeFilters.indexOf('mine');
      if (idx !== -1) {
        activeFilters.splice(idx, 1);
      } else {
        activeFilters.push('mine');
      }
      myDiaryItem.classList.toggle('active', activeFilters.indexOf('mine') !== -1);
      refreshActiveView();
    });
  }
}

// 设置侧边栏展开/收起
function setupToggleSidebar() {
  var toggleBtn = document.getElementById('toggleSidebarBtn');
  var mainApp = document.getElementById('mainApp');

  toggleBtn.addEventListener('click', function() {
    mainApp.classList.toggle('sidebar-collapsed');
  });
}

// 设置模态框
function setupModal() {
  document.getElementById('closeDiaryModal').addEventListener('click', function() {
    // 清理音频
    var audio = document.getElementById('diaryAudioPlayer');
    if (audio) {
      audio.pause();
      try { if (audio._audioCtx) audio._audioCtx.close(); } catch(e) {}
      audio._audioCtx = null; 
    }
    document.getElementById('diaryModal').classList.add('hidden');
  });

  document.getElementById('closeLinkModal').addEventListener('click', function() {
    document.getElementById('linkModal').classList.add('hidden');
  });
  document.getElementById('closeAISettingsModal').addEventListener('click', closeAISettingsModal);

  document.getElementById('closeThemeModal').addEventListener('click', function() {
    document.getElementById('themeModal').classList.add('hidden');
  });

  // 输入模态框
  document.getElementById('closeInputModal').addEventListener('click', closeInputModal);
  document.getElementById('inputModalCancel').addEventListener('click', closeInputModal);
  document.getElementById('inputModalConfirm').addEventListener('click', confirmInputModal);
  document.getElementById('inputModalInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      confirmInputModal();
    }
  });

  document.querySelectorAll('.modal-backdrop').forEach(function(backdrop) {
    backdrop.addEventListener('click', function() {
      var modal = backdrop.closest('.modal');
      // 如果关掉的是详情弹窗，清理音频
      if (modal.id === 'diaryModal') {
        var audio = document.getElementById('diaryAudioPlayer');
        if (audio) {
          audio.pause();
          try { if (audio._audioCtx) audio._audioCtx.close(); } catch(e) {}
          audio._audioCtx = null; 
        }
            modal.classList.add('hidden');
          } else if (modal.id === 'writeModal') {
            closeWriteModal(false); // 交给统一的关闭函数处理拦截
          } else if (modal.id === 'notificationModal') {
            modal.classList.add('hidden');
            if (typeof markNotificationsAsRead === 'function') markNotificationsAsRead();
          } else {
            modal.classList.add('hidden');
      }
    });
  });
}

// 通用输入模态框
let inputModalCallback = null;

function showInputModal(title, placeholder, defaultValue, callback) {
  document.getElementById('inputModalTitle').textContent = title;
  document.getElementById('inputModalInput').placeholder = placeholder;
  document.getElementById('inputModalInput').value = defaultValue || '';
  inputModalCallback = callback;
  document.getElementById('inputModal').classList.remove('hidden');
  setTimeout(function() {
    document.getElementById('inputModalInput').focus();
  }, 100);
}

function closeInputModal() {
  document.getElementById('inputModal').classList.add('hidden');
  inputModalCallback = null;
}

function confirmInputModal() {
  var value = document.getElementById('inputModalInput').value;
  if (inputModalCallback) {
    inputModalCallback(value);
  }
  closeInputModal();
}

// 设置写记录
let selectedImageFiles = [];
let selectedAudioFile = null;
let mediaRecorder = null;
let audioChunks = [];

function setupWriteDiary() {
  document.getElementById('writeBtn').addEventListener('click', openWriteModal);

  document.getElementById('diaryVisibility').addEventListener('change', function(e) {
    var shareSelectRow = document.getElementById('shareSelectRow');
    shareSelectRow.classList.toggle('hidden', e.target.value !== 'shared');
  });

  document.getElementById('coAuthorCheck').addEventListener('change', function(e) {
    var coAuthorsHint = document.getElementById('coAuthorsHint');
    var coAuthorsList = document.getElementById('coAuthorsList');
    if (e.target.checked) {
      coAuthorsHint.style.display = 'block';
      coAuthorsList.style.display = 'flex';
      loadCoAuthors();
    } else {
      coAuthorsHint.style.display = 'none';
      coAuthorsList.style.display = 'none';
    }
  });

  document.getElementById('diaryImage').addEventListener('change', function(e) {
    var files = Array.from(e.target.files);
    var remaining = 9 - selectedImageFiles.length;
    if (remaining <= 0) {
      alert('最多只能选9张图片');
      e.target.value = '';
      return;
    }
    if (files.length > remaining) {
      files = files.slice(0, remaining);
      alert('最多只能选9张图片');
    }
    for (var i = 0; i < files.length; i++) {
      selectedImageFiles.push(files[i]);
    }
    e.target.value = '';
    renderImagePreview();
  });

  // 心情选择
  var moodSelect = document.getElementById('moodSelect');
  if (moodSelect) {
    moodSelect.addEventListener('click', function(e) {
      if (e.target.classList.contains('mood-option')) {
        if (e.target.classList.contains('selected')) {
          e.target.classList.remove('selected');
        } else {
          document.querySelectorAll('.mood-option').forEach(function(el) { el.classList.remove('selected'); });
          e.target.classList.add('selected');
        }
      }
    });
  }

  // 音频上传
  document.getElementById('diaryAudio').addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (file) {
      selectedAudioFile = file;
      renderAudioPreview();
    }
    e.target.value = '';
  });

  // 录音功能
  var recordBtn = document.getElementById('recordAudioBtn');
  var isRecording = false;
  window.recordingAudioCtx = null;
  window.recordingAnimationId = null;
  // 新增：日记语音识别变量
  window.diaryAudioTranscript = '';
  window.diarySpeechRecognition = null;

  recordBtn.addEventListener('click', async function() {
    if (isRecording) {
      // 停止录音
      if (mediaRecorder) {
        mediaRecorder.stop();
      }
      if (window.diarySpeechRecognition) {
        window.diarySpeechRecognition.stop();
      }
      isRecording = false;
      recordBtn.textContent = '🎤 录音';
      recordBtn.style.background = '';
      cancelAnimationFrame(window.recordingAnimationId);
      if (window.recordingAudioCtx) {
        try { window.recordingAudioCtx.close(); } catch(e) {}
        window.recordingAudioCtx = null;
      }
      return;
    }

    try {
      var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      window.diaryAudioTranscript = '';

      // 新增：开启浏览器原生语音识别（将声音同步转化为 AI 能看懂的文字）
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
          window.diarySpeechRecognition = new SpeechRecognition();
          window.diarySpeechRecognition.continuous = true;
          window.diarySpeechRecognition.interimResults = true;
          window.diarySpeechRecognition.onresult = function(e) {
              let final = '';
              for (let i = e.resultIndex; i < e.results.length; ++i) {
                  if (e.results[i].isFinal) final += e.results[i][0].transcript;
              }
              window.diaryAudioTranscript += final;
          };
          window.diarySpeechRecognition.start();
      }

      // 初始化实时录音波形
      document.getElementById('audioPreview').innerHTML = '<div style="display:flex;flex-direction:column;gap:10px;padding:15px;background:var(--bg-tertiary);border-radius:12px;align-items:center;">' +
        '<div style="font-size:13px;color:var(--accent);margin-bottom:5px;animation:pulse 1.5s infinite;">正在倾听你的声音...</div>' +
        '<canvas id="recordingVisualizer" width="300" height="60" style="width:100%;max-width:400px;height:60px;border-radius:8px;background:rgba(0,0,0,0.05);"></canvas>' +
        '</div>';
      document.getElementById('recordingStatus').style.display = 'none';

      window.recordingAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var recordingAnalyser = window.recordingAudioCtx.createAnalyser();
      var source = window.recordingAudioCtx.createMediaStreamSource(stream);
      source.connect(recordingAnalyser);
      recordingAnalyser.fftSize = 128;
      var bufferLength = recordingAnalyser.frequencyBinCount;
      var recordingDataArray = new Uint8Array(bufferLength);

      var canvas = document.getElementById('recordingVisualizer');
      var ctx = canvas.getContext('2d');
      var barWidth = (canvas.width / 64) * 1.5;
      var accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#64b4ff';

      function drawRecording() {
        window.recordingAnimationId = requestAnimationFrame(drawRecording);
        recordingAnalyser.getByteFrequencyData(recordingDataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        var currentX = 0;
        for (var i = 0; i < bufferLength; i++) {
          var barHeight = (recordingDataArray[i] / 255) * canvas.height * 0.8;
          if (barHeight < 2) barHeight = 2;
          ctx.fillStyle = accentColor;
          ctx.globalAlpha = 0.7 + (barHeight / canvas.height) * 0.3;
          ctx.fillRect(currentX, canvas.height / 2 - barHeight / 2, barWidth, barHeight);
          currentX += barWidth + 2;
        }
      }
      drawRecording();

      mediaRecorder.ondataavailable = function(e) {
        audioChunks.push(e.data);
      };

      mediaRecorder.onstop = function() {
        var audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        selectedAudioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
        renderAudioPreview();
        stream.getTracks().forEach(function(track) { track.stop(); });
      };

      mediaRecorder.start();
      isRecording = true;
      recordBtn.textContent = '⏹ 停止';
      recordBtn.style.background = 'var(--accent-light)';
    } catch (err) {
      console.error('录音失败:', err);
      alert('无法访问麦克风，请检查权限设置');
    }
  });

  window.existingAudioUrl = null;
  window.existingImageUrls = [];

  window.renderAudioPreview = function() {
    var preview = document.getElementById('audioPreview');
    if (!selectedAudioFile && !window.existingAudioUrl) {
      preview.innerHTML = '';
      return;
    }
    var url = selectedAudioFile ? URL.createObjectURL(selectedAudioFile) : window.existingAudioUrl;
    preview.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px;padding:15px;background:var(--bg-tertiary);border-radius:12px;align-items:center;">' +
      '<div style="display:flex;align-items:center;gap:10px;width:100%;">' +
      '<audio id="previewAudioPlayer" src="' + url + '" controls style="flex:1;height:40px;outline:none;"></audio>' +
      '<button type="button" onclick="removeAudio()" style="padding:6px 16px;background:rgba(255,100,100,0.15);border:1px solid rgba(255,100,100,0.3);border-radius:8px;color:#ff6b6b;cursor:pointer;white-space:nowrap;font-size:13px;">删除</button>' +
      '</div></div>';
  }

  window.removeAudio = function() {
    selectedAudioFile = null;
    window.existingAudioUrl = null;
    document.getElementById('audioPreview').innerHTML = '';
  };

  // 绑定音乐链接输入预览
  document.getElementById('diaryMusicUrl').addEventListener('input', function() {
    var url = this.value.trim();
    var preview = document.getElementById('musicPreview');
    if (!url) {
      preview.innerHTML = '';
      return;
    }
    if (typeof parseMusicUrl === 'function') {
      var musicInfo = parseMusicUrl(url);
      if (musicInfo && musicInfo.embedUrl) {
        preview.innerHTML = '<iframe frameborder="no" border="0" marginwidth="0" marginheight="0" width="100%" height="86" src="' + musicInfo.embedUrl + '" style="border-radius:8px;max-width:400px;margin-top:5px;"></iframe>';
      } else if (musicInfo) {
        preview.innerHTML = '<div style="padding:10px;background:rgba(255,255,255,0.05);border-radius:8px;font-size:13px;color:var(--accent);">🎵 已识别跳转链接 (若需播放器请粘贴官方标准长链接或 iframe 代码)</div>';
      } else {
        preview.innerHTML = '<div style="padding:10px;background:rgba(255,100,100,0.1);border-radius:8px;font-size:13px;color:#ff6b6b;">无法提取链接</div>';
      }
    }
  });

  document.getElementById('writeForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    var submitBtn = document.getElementById('submitDiaryBtn');
    var originalText = submitBtn.textContent;
    submitBtn.textContent = '保存中...';
    submitBtn.disabled = true;

    var content = document.getElementById('diaryContent').value;
    var date = document.getElementById('diaryDate').value;
    var visibility = document.getElementById('diaryVisibility').value;
    var imageFiles = selectedImageFiles;

    var sharedWith = [];
    if (visibility === 'shared') {
      document.querySelectorAll('#shareList input:checked').forEach(function(checkbox) {
        sharedWith.push(checkbox.value);
      });
    }

    var coAuthors = [];
    if (document.getElementById('coAuthorCheck').checked) {
      document.querySelectorAll('#coAuthorsList input:checked').forEach(function(checkbox) {
        if (coAuthors.indexOf(checkbox.value) === -1) {
          coAuthors.push(checkbox.value);
        }
      });
      coAuthors.push(currentUser.uid); // 创建者也是共建者
      visibility = 'co-authored'; // 共建记录设置visibility为co-authored
    }

    var audioFile = selectedAudioFile;

    try {
      await saveDiary(content, date, visibility, sharedWith, imageFiles, coAuthors, audioFile, window.diaryAudioTranscript);
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
      selectedAudioFile = null;
      selectedImageFiles = [];
    }
  });
}

function renderImagePreview() {
  var preview = document.getElementById('imagePreview');
  preview.innerHTML = '';

  // 1. 优先渲染已经存在的旧图片（编辑模式）
  if (window.existingImageUrls && window.existingImageUrls.length > 0) {
    window.existingImageUrls.forEach(function(url, idx) {
      var container = document.createElement('div');
      container.style = 'position:relative;display:inline-block;';
      var img = document.createElement('img');
      img.src = url;
      img.style = 'width:80px;height:80px;object-fit:cover;border-radius:8px;pointer-events:none;';
      var removeBtn = document.createElement('button');
      removeBtn.textContent = '×';
      removeBtn.style = 'position:absolute;top:-8px;right:-8px;width:22px;height:22px;border-radius:50%;background:#ff6b6b;border:none;color:#fff;cursor:pointer;font-size:14px;line-height:1;z-index:2;';
      removeBtn.addEventListener('click', function(e) {
        e.preventDefault();
        window.existingImageUrls.splice(idx, 1);
        renderImagePreview();
      });
      container.appendChild(img);
      container.appendChild(removeBtn);
      preview.appendChild(container);
    });
  }

  // 2. 渲染新选中的图片拖拽节点
  var draggingNode = null; // 记录当前正在拖拽的节点

  for (var i = 0; i < selectedImageFiles.length; i++) {
    (function(file) {
      var container = document.createElement('div');
      container.style = 'position:relative;display:inline-block;cursor:grab;transition:transform 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);';
      container.draggable = true;
      container.fileRef = file; // 绑定真实文件引用
      
      // 相册拖拽排序逻辑 (实时 DOM 交换，实现 iOS 般自动避让)
      container.addEventListener('dragstart', function(ev) {
        draggingNode = container;
        ev.dataTransfer.effectAllowed = 'move';
        ev.dataTransfer.setData('text/plain', ''); // 兼容火狐
        setTimeout(function() { container.style.opacity = '0.2'; }, 0);
      });
      
      container.addEventListener('dragover', function(ev) {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = 'move';
        if (draggingNode && draggingNode !== container) {
          var children = Array.from(preview.children);
          var draggingIdx = children.indexOf(draggingNode);
          var hoverIdx = children.indexOf(container);
          // 根据前后位置决定插入方向，自动把挡路的图片挤开
          if (hoverIdx > draggingIdx) {
            preview.insertBefore(draggingNode, container.nextSibling);
          } else {
            preview.insertBefore(draggingNode, container);
          }
        }
        return false;
      });
      
      container.addEventListener('dragend', function() {
        container.style.opacity = '1';
        draggingNode = null;
        
        // 松手时，根据最终被挤乱重排的真实 DOM 顺序，同步保存到我们的底层数据数组
        var newFiles = [];
        Array.from(preview.children).forEach(function(child) {
          if (child.fileRef) newFiles.push(child.fileRef);
        });
        selectedImageFiles = newFiles;
        renderImagePreview(); // 刷新状态以确保一切同步
      });

      var img = document.createElement('img');
      // 使用同步方式替代 FileReader，避免因为图片大小不同导致加载速度不同引起的排列错乱
      img.src = URL.createObjectURL(file);
      img.style = 'width:80px;height:80px;object-fit:cover;border-radius:8px;pointer-events:none;';
      
      var removeBtn = document.createElement('button');
      removeBtn.textContent = '×';
      removeBtn.style = 'position:absolute;top:-8px;right:-8px;width:22px;height:22px;border-radius:50%;background:#ff6b6b;border:none;color:#fff;cursor:pointer;font-size:14px;line-height:1;z-index:2;';
      removeBtn.addEventListener('click', function(e) {
        e.preventDefault();
        var currentIdx = selectedImageFiles.indexOf(file);
        if (currentIdx > -1) {
          selectedImageFiles.splice(currentIdx, 1);
          renderImagePreview();
        }
      });
      
      container.appendChild(img);
      container.appendChild(removeBtn);
      preview.appendChild(container);
    })(selectedImageFiles[i]);
  }
}

window.toggleWriteAddon = function(id) {
  var el = document.getElementById(id);
  if (!el) return;
  
  var wasHidden = el.classList.contains('hidden');
  
  // 先把三个面板都自动收起（纯视觉隐藏，绝不会清除已选好的数据）
  document.getElementById('imageAddon').classList.add('hidden');
  document.getElementById('audioAddon').classList.add('hidden');
  document.getElementById('musicAddon').classList.add('hidden');
  
  // 如果刚才被点击的这个面板原来是隐藏的，那就把它展开
  if (wasHidden) {
    el.classList.remove('hidden');
  }
};

function openWriteModal() {
  var now = new Date();
  var year = now.getFullYear();
  var month = String(now.getMonth() + 1).padStart(2, '0');
  var day = String(now.getDate()).padStart(2, '0');
  var hours = String(now.getHours()).padStart(2, '0');
  var minutes = String(now.getMinutes()).padStart(2, '0');
  selectedImageFiles = [];
  window.existingImageUrls = [];
  window.existingAudioUrl = null;
  document.getElementById('writeModal').classList.remove('hidden');
  document.getElementById('diaryId').value = '';
  document.getElementById('writeModalTitle').textContent = '写记录';
  document.getElementById('diaryTitle').value = '';
  document.getElementById('diaryContent').value = '';
  document.querySelectorAll('.mood-option').forEach(function(el) { el.classList.remove('selected'); });
  document.getElementById('diaryDate').value = year + '-' + month + '-' + day;
  document.getElementById('diaryTime').value = hours + ':' + minutes;
  document.getElementById('diaryVisibility').value = 'public';
  document.getElementById('shareSelectRow').classList.add('hidden');
  document.getElementById('imageAddon').classList.add('hidden');
  document.getElementById('audioAddon').classList.add('hidden');
  document.getElementById('musicAddon').classList.add('hidden');
  document.getElementById('diaryImage').value = '';
  document.getElementById('imagePreview').innerHTML = '';
  document.getElementById('coAuthorCheck').checked = false;
  document.getElementById('coAuthorsHint').style.display = 'none';
  document.getElementById('coAuthorsList').style.display = 'none';
  loadShareUsers();
  renderTagOptions();
  loadDiaryDraft();

  setTimeout(function() {
    if (typeof getDiaryFormState === 'function') {
      window.currentDiaryFormOriginalState = getDiaryFormState();
    }
  }, 100);
}

window.getDiaryFormState = function() {
  var sharedWith = [];
  document.querySelectorAll('#shareList input:checked').forEach(function(cb) { sharedWith.push(cb.value); });
  var coAuthors = [];
  document.querySelectorAll('#coAuthorsList input:checked').forEach(function(cb) { coAuthors.push(cb.value); });

  var selectedMoodEl = document.querySelector('.mood-option.selected');
  var selectedTag = document.querySelector('.tag-select-btn.selected');

  return JSON.stringify({
    title: document.getElementById('diaryTitle').value.trim(),
    content: document.getElementById('diaryContent').value.trim(),
    date: document.getElementById('diaryDate').value,
    time: document.getElementById('diaryTime').value,
    visibility: document.getElementById('diaryVisibility').value,
    mood: selectedMoodEl ? selectedMoodEl.dataset.mood : null,
    tagId: selectedTag ? selectedTag.dataset.tagId : null,
    collectionId: document.getElementById('diaryCollection').value,
    musicUrl: document.getElementById('diaryMusicUrl').value.trim(),
    coAuthorCheck: document.getElementById('coAuthorCheck').checked,
    sharedWith: sharedWith.sort(),
    coAuthors: coAuthors.sort(),
    imagesCount: selectedImageFiles.length,
    hasAudio: !!selectedAudioFile,
    audioText: window.diaryAudioTranscript
  });
};

function closeWriteModal(skipConfirm) {
  var diaryId = document.getElementById('diaryId').value;
  
  if (!skipConfirm) {
    if (!diaryId) {
      // 新建记录：检查是否有内容并询问草稿
      if (hasDiaryContent()) {
        if (confirm('要将当前内容保存为草稿吗？')) {
          saveDiaryDraft();
        } else {
          clearDiaryDraft();
        }
      }
    } else {
      // 编辑现有记录：检查是否修改并询问是否保存
      if (typeof getDiaryFormState === 'function' && window.currentDiaryFormOriginalState) {
        var currentState = getDiaryFormState();
        if (currentState !== window.currentDiaryFormOriginalState) {
          if (confirm('检测到内容已被修改，是否保存并发布更新？\n(点击"取消"将放弃本次修改)')) {
            document.getElementById('submitDiaryBtn').click();
            return; // 中断后续流程，等待提交完毕后自动关闭
          }
        }
      }
    }
  }

  document.getElementById('writeModal').classList.add('hidden');
  selectedImageFiles = [];
  selectedAudioFile = null;
  window.existingImageUrls = [];
  window.existingAudioUrl = null;
  document.getElementById('audioPreview').innerHTML = '';
  document.getElementById('recordingStatus').textContent = '';
  document.getElementById('recordingStatus').style.display = 'none';
  document.getElementById('recordAudioBtn').textContent = '🎤 录音';
  document.getElementById('recordAudioBtn').style.background = '';

  if (typeof mediaRecorder !== 'undefined' && mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  if (window.recordingAudioCtx) {
    try { window.recordingAudioCtx.close(); } catch(e) {}
    window.recordingAudioCtx = null;
  }
}

document.getElementById('closeWriteModal').addEventListener('click', function() {
  closeWriteModal(false);
});

// 设置链接管理
function setupLinkManagement() {
  document.getElementById('copyCodeBtn').addEventListener('click', function() {
    var code = document.getElementById('myLinkCode').textContent;
    navigator.clipboard.writeText(code).then(function() {
      document.getElementById('copyCodeBtn').textContent = '已复制';
      setTimeout(function() {
        document.getElementById('copyCodeBtn').textContent = '复制';
      }, 2000);
    });
  });

  document.getElementById('connectByCodeBtn').addEventListener('click', async function() {
    var code = document.getElementById('friendCodeInput').value.trim().toUpperCase();
    if (!code) {
      showConnectResult('请输入专属码', true);
      return;
    }

    if (code === (currentUserData && currentUserData.linkCode)) {
      showConnectResult('不能连接自己', true);
      return;
    }

    try {
      // 查找拥有此码的用户
      var userSnapshot = await db.collection('users').where('linkCode', '==', code).get();

      if (userSnapshot.empty) {
        showConnectResult('无效的专属码', true);
        return;
      }

      var friendDoc = userSnapshot.docs[0];
      var friendData = friendDoc.data();

      // 检查是否已经连接
      var existingLinks = await db.collection('links')
        .where('userId', '==', friendDoc.id)
        .where('acceptedBy', '==', currentUser.uid)
        .get();

      if (!existingLinks.empty) {
        showConnectResult('已经连接过了', true);
        return;
      }

      // 创建链接
      await db.collection('links').add({
        userId: currentUser.uid,
        userEmail: currentUser.email,
        userDisplayName: currentUserData && currentUserData.displayName ? currentUserData.displayName : '',
        userLinkCode: currentUserData && currentUserData.linkCode ? currentUserData.linkCode : '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        accepted: true,
        acceptedBy: friendDoc.id,
        acceptedByEmail: friendData.email,
        acceptedByDisplayName: friendData.displayName || friendData.email
      });

      // --- 新增：连接成功瞬间，自动将我的过往“部分可见”记录授权给新好友 ---
      try {
        var batch = db.batch();
        var count = 0;
        var diarySnap = await db.collection('diaries').where('userId', '==', currentUser.uid).where('visibility', '==', 'shared').get();
        diarySnap.docs.forEach(function(doc) {
          if ((doc.data().sharedWith || []).indexOf(friendDoc.id) === -1) {
            batch.update(doc.ref, { sharedWith: firebase.firestore.FieldValue.arrayUnion(friendDoc.id) });
            count++;
          }
        });
        var annSnap = await db.collection('anniversaries').where('userId', '==', currentUser.uid).where('visibility', '==', 'shared').get();
        annSnap.docs.forEach(function(doc) {
          if ((doc.data().sharedWith || []).indexOf(friendDoc.id) === -1) {
            batch.update(doc.ref, { sharedWith: firebase.firestore.FieldValue.arrayUnion(friendDoc.id) });
            count++;
          }
        });
        if (count > 0) await batch.commit();
      } catch (e) {
        console.error('自动授权历史记录失败:', e);
      }

      showConnectResult('连接成功！');
      document.getElementById('friendCodeInput').value = '';
      loadLinkedUsers();
      loadDiaries();
      refreshCalendar();
    } catch (e) {
      console.error('连接失败:', e);
      showConnectResult('连接失败', true);
    }
  });

  // 输入码时自动转大写
  document.getElementById('friendCodeInput').addEventListener('input', function(e) {
    e.target.value = e.target.value.toUpperCase();
  });
}

function showConnectResult(msg, isError) {
  var result = document.getElementById('connectResult');
  result.classList.remove('hidden');
  result.textContent = msg;
  result.style.color = isError ? '#ff6b6b' : 'var(--accent)';
}

// 加载已链接用户
async function loadLinkedUsers() {
  var linkedUsers = document.getElementById('linkedUsers');
  linkedUsers.innerHTML = '';

  var acceptedLinks = await getAcceptedLinks();

  if (acceptedLinks.length === 0) {
    linkedUsers.innerHTML = '<div style="font-size:13px;color:rgba(255,255,255,0.3)">还没有链接的人</div>';
    return;
  }

  // 收集所有需要获取的用户ID
  var otherUserIds = [];
  var linkMap = []; // 保存链接和对应用户的映射
  for (var i = 0; i < acceptedLinks.length; i++) {
    var linkDoc = acceptedLinks[i];
    var linkData = linkDoc.data();
    var isCreator = linkData.userId === currentUser.uid;
    var otherUid = isCreator ? linkData.acceptedBy : linkData.userId;
    otherUserIds.push(otherUid);
    linkMap.push({ linkDoc: linkDoc, otherUid: otherUid });
  }

  // 批量获取用户信息
  var userInfos = await getBatchUserInfo(otherUserIds);
  var userMap = {};
  userInfos.forEach(function(u) { userMap[u.userId] = u; });

  // 渲染链接用户列表
  for (var j = 0; j < linkMap.length; j++) {
    var linkDoc = linkMap[j].linkDoc;
    var otherUid = linkMap[j].otherUid;
    var otherUser = userMap[otherUid] || { displayName: 'unknown', avatarUrl: '' };

    var item = document.createElement('div');
    item.className = 'linked-item';
    item.innerHTML = '<div class="user-info"><span class="user-email">' + escapeHtml(otherUser.displayName) + '</span><span class="user-status">已连接</span></div>' +
      '<div style="display:flex; gap:8px;">' +
        '<button class="sync-history-btn" data-uid="' + otherUid + '" style="padding:4px 10px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:12px;cursor:pointer;" title="将过往部分可见的记录也分享给TA">补发过往</button>' +
        '<button class="unlink-btn" data-id="' + linkDoc.id + '" style="padding:4px 10px;background:rgba(255,100,100,0.1);border:1px solid rgba(255,100,100,0.3);border-radius:6px;color:#ff6b6b;font-size:12px;cursor:pointer;">解除</button>' +
      '</div>';
    linkedUsers.appendChild(item);
  }

  linkedUsers.querySelectorAll('.sync-history-btn').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      var targetUid = btn.dataset.uid;
      if (confirm('确定要将你过往所有「部分好友可见」的日记和纪念日，都开放给这位新好友查看吗？\n(注：原本为“所有好友可见”的记录新好友默认就能看，无需补发)')) {
        btn.textContent = '同步中...';
        btn.disabled = true;
        try {
          var batch = db.batch();
          var count = 0;
          
          // 查找所有自己发过的、且设定为 shared 的日记
          var diarySnap = await db.collection('diaries').where('userId', '==', currentUser.uid).where('visibility', '==', 'shared').get();
          diarySnap.docs.forEach(function(doc) {
            var sharedWith = doc.data().sharedWith || [];
            if (sharedWith.indexOf(targetUid) === -1) {
              batch.update(doc.ref, { sharedWith: firebase.firestore.FieldValue.arrayUnion(targetUid) });
              count++;
            }
          });

          // 查找所有自己发过的、且设定为 shared 的纪念日
          var annSnap = await db.collection('anniversaries').where('userId', '==', currentUser.uid).where('visibility', '==', 'shared').get();
          annSnap.docs.forEach(function(doc) {
            var sharedWith = doc.data().sharedWith || [];
            if (sharedWith.indexOf(targetUid) === -1) {
              batch.update(doc.ref, { sharedWith: firebase.firestore.FieldValue.arrayUnion(targetUid) });
              count++;
            }
          });

          if (count > 0) {
            await batch.commit();
          }
          alert('成功将 ' + count + ' 条历史记录同步给该好友！');
          btn.textContent = '已同步';
        } catch (e) {
          console.error(e);
          alert('同步失败: ' + e.message);
          btn.textContent = '补发过往';
          btn.disabled = false;
        }
      }
    });
  });

  linkedUsers.querySelectorAll('.unlink-btn').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      if (confirm('确定要解除连接吗？')) {
        await unlinkUser(btn.dataset.id);
        loadLinkedUsers();
        loadDiaries();
        refreshCalendar();
      }
    });
  });
}

// --- 消息通知模块 ---
window.markNotificationsAsRead = function() {
  if (!currentUser) return;
  db.collection('notifications').where('userId', '==', currentUser.uid).where('isRead', '==', false).get().then(snap => {
    if (snap.empty) return;
    let batch = db.batch();
    snap.docs.forEach(doc => { batch.update(doc.ref, { isRead: true }); });
    batch.commit();
  });
};

window.setupNotificationsListener = function(uid) {
  db.collection('notifications')
    .where('userId', '==', uid)
    .where('isRead', '==', false)
    .onSnapshot(function(snapshot) {
      let badge = document.getElementById('unreadBadge');
      if (badge) {
        badge.textContent = snapshot.docs.length > 99 ? '99+' : snapshot.docs.length;
        badge.style.display = snapshot.docs.length > 0 ? 'block' : 'none';
      }
    });

  document.getElementById('notificationBtn').addEventListener('click', openNotificationModal);
  document.getElementById('closeNotificationModal').addEventListener('click', function() {
    document.getElementById('notificationModal').classList.add('hidden');
    if (typeof markNotificationsAsRead === 'function') markNotificationsAsRead();
  });
};

window.openNotificationModal = async function() {
  document.getElementById('notificationModal').classList.remove('hidden');
  let list = document.getElementById('notificationList');
  list.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);"><div class="loading-ring" style="width:20px;height:20px;margin:0 auto 10px;"></div>加载中...</div>';
  
  let snapshot = await db.collection('notifications').where('userId', '==', currentUser.uid).orderBy('createdAt', 'desc').limit(30).get();
    
  list.innerHTML = '';
  if (snapshot.empty) {
    list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">暂无新消息</div>';
    return;
  }
  
  snapshot.forEach(function(doc) {
    let data = doc.data();
    let timeStr = data.createdAt ? data.createdAt.toDate().toLocaleString() : '刚刚';
    let item = document.createElement('div');
    item.style.cssText = 'padding:14px;background:var(--bg-tertiary);border-radius:12px;display:flex;gap:12px;align-items:center;cursor:pointer;transition:all 0.2s;opacity:' + (data.isRead ? '0.6' : '1') + ';border:1px solid ' + (data.isRead ? 'transparent' : 'rgba(100,180,255,0.3)') + ';';
    let avatarHtml = data.fromUserAvatar ? '<img src="' + escapeHtml(data.fromUserAvatar) + '" style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;">' : '<div style="width:40px;height:40px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;font-size:16px;">' + escapeHtml(data.fromUserName.charAt(0)) + '</div>';
    item.innerHTML = avatarHtml + '<div style="flex:1;"><div style="font-size:14px;color:var(--text-primary);"><b style="color:var(--accent);">' + escapeHtml(data.fromUserName) + '</b> ' + escapeHtml(data.text) + '</div><div style="font-size:11px;color:var(--text-muted);margin-top:5px;">' + timeStr + '</div></div>' + (!data.isRead ? '<div style="width:8px;height:8px;border-radius:50%;background:#ff6b6b;flex-shrink:0;box-shadow:0 0 5px #ff6b6b;"></div>' : '');
    item.addEventListener('click', function() {
       document.getElementById('notificationModal').classList.add('hidden');
       if (typeof markNotificationsAsRead === 'function') markNotificationsAsRead();
       if (typeof showDiaryDetail === 'function') showDiaryDetail(data.targetId, data.userId === currentUser.uid, false); 
    });
    list.appendChild(item);
  });
};

// 设置视图切换
function setupViewTabs() {
  var viewTabs = document.querySelectorAll('.view-tab');
  var diaryView = document.getElementById('diaryView');
  var calendarView = document.getElementById('calendarView');
  var anniversaryView = document.getElementById('anniversaryView');
  var chatListView = document.getElementById('chatListView');

  viewTabs.forEach(function(tab) {
    tab.addEventListener('click', async function() {
          // 如果写记录弹窗开着，统一交由 closeWriteModal 处理状态拦截
      var writeModal = document.getElementById('writeModal');
      if (!writeModal.classList.contains('hidden')) {
            closeWriteModal(false);
      }

      viewTabs.forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');

      var view = tab.dataset.view;
      if (view === 'diary') {
        diaryView.classList.remove('hidden');
        calendarView.classList.add('hidden');
        anniversaryView.classList.add('hidden');
        if (chatListView) chatListView.classList.add('hidden');
      } else if (view === 'calendar') {
        diaryView.classList.add('hidden');
        calendarView.classList.remove('hidden');
        anniversaryView.classList.add('hidden');
        if (chatListView) chatListView.classList.add('hidden');
        await refreshCalendar();
      } else if (view === 'anniversary') {
        diaryView.classList.add('hidden');
        calendarView.classList.add('hidden');
        anniversaryView.classList.remove('hidden');
        if (chatListView) chatListView.classList.add('hidden');
        loadAnniversaries();
      } else if (view === 'chat') {
        diaryView.classList.add('hidden');
        calendarView.classList.add('hidden');
        anniversaryView.classList.add('hidden');
        if (chatListView) chatListView.classList.remove('hidden');
        if (typeof loadConversations === 'function') loadConversations();
      }
    });
  });
}

// 设置主题
function setupTheme() {
  document.getElementById('themeBtn').addEventListener('click', function() {
    document.getElementById('themeModal').classList.remove('hidden');
  });

  document.querySelectorAll('.theme-option').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var theme = btn.dataset.theme;
      applyTheme(theme);
      saveUserTheme(theme);
      document.getElementById('themeModal').classList.add('hidden');
    });
  });
}

// 应用主题
function applyTheme(theme) {
  document.body.dataset.theme = theme;
}

// 保存主题到 Firebase
function saveUserTheme(theme) {
  if (currentUser) {
    db.collection('users').doc(currentUser.uid).update({
      theme: theme
    });
  }
}

// 加载用户主题
async function loadUserTheme() {
  if (!currentUser) return;
  try {
    var userDoc = await db.collection('users').doc(currentUser.uid).get();
    if (userDoc.exists && userDoc.data().theme) {
      applyTheme(userDoc.data().theme);
    }
  } catch (e) {
    console.error('加载主题失败:', e);
  }
}

// 华丽星辉连线粒子特效 (针对移动端深度优化性能)
function initParticles() {
  var canvas = document.getElementById('particles');
  var ctx = canvas.getContext('2d');
  var particles = [];
  var pointer = { x: null, y: null, radius: 120 }; // 触控/鼠标互动半径

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    init(); // 尺寸变化时重新生成，保证分布均匀
  }

  function getParticleColor() {
    var theme = document.body.dataset.theme || 'default';
    if (theme === 'light') {
      return { r: 120, g: 120, b: 125, a: 0.25 };
    } else if (theme === 'gold') {
      return { r: 255, g: 215, b: 0, a: 0.4 };
    } else if (theme === 'warm') {
      return { r: 255, g: 140, b: 170, a: 0.5 };
    } else if (theme === 'sky') {
      return { r: 100, g: 160, b: 220, a: 0.35 };
    } else if (theme === 'green') {
      return { r: 100, g: 200, b: 140, a: 0.4 };
    }
    return { r: 100, g: 180, b: 255, a: 0.4 };
  }

  function init() {
    particles = [];
    // 性能优化核心：手机端减少粒子数量，电脑端展示华丽效果
    var count = window.innerWidth < 768 ? 45 : 100;
    var color = getParticleColor();
    for (var i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        vx: (Math.random() - 0.5) * 0.6, // 缓慢漂浮
        vy: (Math.random() - 0.5) * 0.6,
        color: color
      });
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var color = getParticleColor(); // 实时获取主题色

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      // 边缘反弹
      if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

      // 手指/鼠标排斥互动
      if (pointer.x !== null && pointer.y !== null) {
        var dx = pointer.x - p.x;
        var dy = pointer.y - p.y;
        var distSq = dx * dx + dy * dy;
        if (distSq < pointer.radius * pointer.radius) {
          p.x -= dx * 0.02; // 轻柔的排斥力
          p.y -= dy * 0.02;
        }
      }

      // 绘制粒子圆点
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',' + color.a + ')';
      ctx.fill();

      // 绘制连线 (Constellation 网状效果)
      for (var j = i + 1; j < particles.length; j++) {
        var p2 = particles[j];
        var dx2 = p.x - p2.x;
        var dy2 = p.y - p2.y;
        var distSq2 = dx2 * dx2 + dy2 * dy2;
        // 手机端减少连线距离，进一步节省性能
        var minDist = window.innerWidth < 768 ? 70 : 120;
        if (distSq2 < minDist * minDist) {
          // 距离越近，线条越不透明
          var opacity = 1 - Math.sqrt(distSq2) / minDist;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',' + (opacity * color.a * 0.6) + ')';
          ctx.lineWidth = window.innerWidth < 768 ? 0.6 : 0.8;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(animate);
  }

  // 绑定鼠标与触摸事件
  window.addEventListener('mousemove', function(e) { pointer.x = e.clientX; pointer.y = e.clientY; });
  window.addEventListener('mouseout', function() { pointer.x = null; pointer.y = null; });
  window.addEventListener('touchstart', function(e) { pointer.x = e.touches[0].clientX; pointer.y = e.touches[0].clientY; }, {passive: true});
  window.addEventListener('touchmove', function(e) { pointer.x = e.touches[0].clientX; pointer.y = e.touches[0].clientY; }, {passive: true});
  window.addEventListener('touchend', function() { pointer.x = null; pointer.y = null; });

  resize();
  window.addEventListener('resize', resize);
  animate();

  // 主题变化时更新粒子颜色
  var observer = new MutationObserver(function() {
    // 主题变化时，动画循环会自动获取新的颜色，无需重置粒子
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
}

// 图片查看器
window.openImageViewer = function(url) {
  var viewer = document.createElement('div');
  viewer.style = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer;';
  viewer.innerHTML = '<img src="' + url + '" style="max-width:90%;max-height:90%;object-fit:contain;">';
  viewer.addEventListener('click', function() {
    viewer.remove();
  });
  document.body.appendChild(viewer);
};