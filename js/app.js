// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
  initApp();
});

let activeFilters = ['mine']; // 默认显示"我的记录"

function initApp() {
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

  // 隐藏加载动画
  setTimeout(function() {
    document.getElementById('loading').classList.add('hidden');
  }, 800);
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
    loadDiaries();
  });
}

async function loadAISettings() {
  if (!currentUser) return;
  try {
    let doc = await db.collection('users').doc(currentUser.uid).get();
    if (doc.exists) {
      let data = doc.data();
      document.getElementById('aiApiKey').value = data.aiApiKey || '';
      document.getElementById('aiPersonaName').value = data.aiPersonaName || '';
      document.getElementById('aiPersonaPrompt').value = data.aiPersonaPrompt || '';
    }
  } catch (e) {
    console.error('加载 AI 设置失败:', e);
  }
}

function closeAISettingsModal() {
  var modal = document.getElementById('aiSettingsModal');
  if (modal) modal.classList.add('hidden');
}

async function saveAISettings() {
  if (!currentUser) return;
  try {
    await db.collection('users').doc(currentUser.uid).update({
      aiApiKey: document.getElementById('aiApiKey').value.trim(),
      aiPersonaName: document.getElementById('aiPersonaName').value.trim(),
      aiPersonaPrompt: document.getElementById('aiPersonaPrompt').value.trim()
    });
    alert('AI 助手设置已保存！');
    closeAISettingsModal();
  } catch (e) {
    console.error('保存 AI 设置失败:', e);
    alert('保存 AI 设置失败: ' + e.message);
  }
}

function setupAISettings() {
  var saveBtn = document.getElementById('saveAISettingsBtn');
  if (saveBtn) saveBtn.addEventListener('click', saveAISettings);
}

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
    console.log('Accepted links count:', acceptedLinks.length);
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
    console.log('friendList children count:', friendList.children.length);
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
    if (audio && audio._audioCtx) {
      try { audio._audioCtx.close(); } catch(e) {}
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
        if (audio && audio._audioCtx) {
          try { audio._audioCtx.close(); } catch(e) {}
          audio._audioCtx = null;
        }
            modal.classList.add('hidden');
          } else if (modal.id === 'writeModal') {
            closeWriteModal(false); // 交给统一的关闭函数处理拦截
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

  recordBtn.addEventListener('click', async function() {
    if (isRecording) {
      // 停止录音
      if (mediaRecorder) {
        mediaRecorder.stop();
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

  function renderAudioPreview() {
    var preview = document.getElementById('audioPreview');
    if (!selectedAudioFile) {
      preview.innerHTML = '';
      return;
    }
    var url = URL.createObjectURL(selectedAudioFile);
    preview.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px;padding:15px;background:var(--bg-tertiary);border-radius:12px;align-items:center;">' +
      '<canvas id="previewAudioVisualizer" width="300" height="60" style="width:100%;max-width:400px;height:60px;border-radius:8px;background:rgba(0,0,0,0.05);"></canvas>' +
      '<div style="display:flex;align-items:center;gap:10px;width:100%;">' +
      '<audio id="previewAudioPlayer" src="' + url + '" controls style="flex:1;height:32px;outline:none;"></audio>' +
      '<button type="button" onclick="removeAudio()" style="padding:6px 16px;background:rgba(255,100,100,0.15);border:1px solid rgba(255,100,100,0.3);border-radius:8px;color:#ff6b6b;cursor:pointer;white-space:nowrap;font-size:13px;">删除</button>' +
      '</div></div>';
      
    setTimeout(function() {
      if (typeof setupAudioVisualizer === 'function') {
        setupAudioVisualizer('previewAudioPlayer', 'previewAudioVisualizer');
      }
    }, 50);
  }

  window.removeAudio = function() {
    selectedAudioFile = null;
    document.getElementById('audioPreview').innerHTML = '';
  };

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
      await saveDiary(content, date, visibility, sharedWith, imageFiles, coAuthors, audioFile);
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

function openWriteModal() {
  var now = new Date();
  var year = now.getFullYear();
  var month = String(now.getMonth() + 1).padStart(2, '0');
  var day = String(now.getDate()).padStart(2, '0');
  var hours = String(now.getHours()).padStart(2, '0');
  var minutes = String(now.getMinutes()).padStart(2, '0');
  selectedImageFiles = [];
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
    coAuthorCheck: document.getElementById('coAuthorCheck').checked,
    sharedWith: sharedWith.sort(),
    coAuthors: coAuthors.sort(),
    imagesCount: selectedImageFiles.length,
    hasAudio: !!selectedAudioFile
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
    item.innerHTML = '<div class="user-info"><span class="user-email">' + escapeHtml(otherUser.displayName) + '</span><span class="user-status">已连接</span></div><button class="unlink-btn" data-id="' + linkDoc.id + '">解除</button>';
    linkedUsers.appendChild(item);
  }

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

// 设置视图切换
function setupViewTabs() {
  var viewTabs = document.querySelectorAll('.view-tab');
  var diaryView = document.getElementById('diaryView');
  var calendarView = document.getElementById('calendarView');
  var anniversaryView = document.getElementById('anniversaryView');

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
      } else if (view === 'calendar') {
        diaryView.classList.add('hidden');
        calendarView.classList.remove('hidden');
        anniversaryView.classList.add('hidden');
        await refreshCalendar();
      } else if (view === 'anniversary') {
        diaryView.classList.add('hidden');
        calendarView.classList.add('hidden');
        anniversaryView.classList.remove('hidden');
        loadAnniversaries();
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