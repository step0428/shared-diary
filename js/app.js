// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
  initApp();
});

function initApp() {
  setupAuth();
  setupModal();
  setupWriteDiary();
  setupLinkManagement();
  setupViewTabs();
  setupCollectionModal();
  setupTheme();
  setupMultiSelectDelete();
  setupSidebarFilter();
  setupToggleSidebar();
  initCalendar();
  initAnniversary();
  initParticles();
  initSensing();

  // 隐藏加载动画
  setTimeout(function() {
    document.getElementById('loading').classList.add('hidden');
  }, 800);
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
      var item = cb.closest('.diary-item');
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
    if (item.dataset.filter === currentDiaryFilter) {
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

      if (currentDiaryFilter === otherUser.userId) {
        item.classList.add('active');
      }

      item.addEventListener('click', function(e) {
        var clickedItem = e.currentTarget;
        currentDiaryFilter = clickedItem.dataset.filter;
        document.querySelectorAll('.friend-item').forEach(function(el) {
          el.classList.remove('active');
        });
        clickedItem.classList.add('active');
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
  var allDiaryItem = document.querySelector('.friend-item[data-filter="all"]');
  var myDiaryItem = document.querySelector('.friend-item[data-filter="mine"]');

  allDiaryItem.addEventListener('click', function() {
    currentDiaryFilter = 'all';
    document.querySelectorAll('.friend-item').forEach(function(el) {
      el.classList.remove('active');
    });
    allDiaryItem.classList.add('active');
    refreshActiveView();
  });

  myDiaryItem.addEventListener('click', function() {
    currentDiaryFilter = 'mine';
    document.querySelectorAll('.friend-item').forEach(function(el) {
      el.classList.remove('active');
    });
    myDiaryItem.classList.add('active');
    refreshActiveView();
  });
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
    document.getElementById('diaryModal').classList.add('hidden');
  });

  document.getElementById('closeLinkModal').addEventListener('click', function() {
    document.getElementById('linkModal').classList.add('hidden');
  });

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
      // 如果是写日记弹窗且有内容，自动保存草稿
      if (modal.id === 'writeModal' && hasDiaryContent()) {
        saveDiaryDraft();
      }
      modal.classList.add('hidden');
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

  recordBtn.addEventListener('click', async function() {
    if (isRecording) {
      // 停止录音
      if (mediaRecorder) {
        mediaRecorder.stop();
      }
      isRecording = false;
      recordBtn.textContent = '🎤 录音';
      recordBtn.style.background = '';
      return;
    }

    try {
      var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = function(e) {
        audioChunks.push(e.data);
      };

      mediaRecorder.onstop = function() {
        var audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        selectedAudioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
        renderAudioPreview();
        stream.getTracks().forEach(function(track) { track.stop(); });
        document.getElementById('recordingStatus').textContent = '';
        document.getElementById('recordingStatus').style.display = 'none';
      };

      mediaRecorder.start();
      isRecording = true;
      recordBtn.textContent = '⏹ 停止';
      recordBtn.style.background = 'var(--accent-light)';

      document.getElementById('recordingStatus').textContent = '录音中...';
      document.getElementById('recordingStatus').style.display = 'block';
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
    preview.innerHTML = '<div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg-tertiary);border-radius:8px;"><audio src="' + url + '" controls style="height:32px;"></audio><button type="button" onclick="removeAudio()" style="padding:4px 12px;background:rgba(255,100,100,0.2);border:1px solid rgba(255,100,100,0.4);border-radius:6px;color:#ff6b6b;cursor:pointer;">删除</button></div>';
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
  for (var i = 0; i < selectedImageFiles.length; i++) {
    (function(index, file) {
      var reader = new FileReader();
      reader.onload = function(e) {
        var container = document.createElement('div');
        container.style = 'position:relative;display:inline-block;';
        var img = document.createElement('img');
        img.src = e.target.result;
        img.style = 'width:80px;height:80px;object-fit:cover;border-radius:8px;';
        var removeBtn = document.createElement('button');
        removeBtn.textContent = '×';
        removeBtn.style = 'position:absolute;top:-8px;right:-8px;width:22px;height:22px;border-radius:50%;background:#ff6b6b;border:none;color:#fff;cursor:pointer;font-size:14px;line-height:1;';
        removeBtn.dataset.index = index;
        removeBtn.addEventListener('click', function() {
          selectedImageFiles.splice(index, 1);
          renderImagePreview();
        });
        container.appendChild(img);
        container.appendChild(removeBtn);
        preview.appendChild(container);
      };
      reader.readAsDataURL(file);
    })(i, selectedImageFiles[i]);
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
}

function closeWriteModal(skipConfirm) {
  // 检查是否有内容（只有不跳过确认时才检查）
  if (!skipConfirm && hasDiaryContent()) {
    if (confirm('要将当前内容保存为草稿吗？')) {
      saveDiaryDraft();
    } else {
      clearDiaryDraft();
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
      // 如果写日记弹窗打开且有内容，自动保存草稿
      var writeModal = document.getElementById('writeModal');
      if (!writeModal.classList.contains('hidden') && hasDiaryContent()) {
        saveDiaryDraft();
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

// 粒子特效
function initParticles() {
  var canvas = document.getElementById('particles');
  var ctx = canvas.getContext('2d');
  var particles = [];
  var isLightTheme = false;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function getParticleColor() {
    var theme = document.body.dataset.theme || 'default';
    if (theme === 'light') {
      return { r: 120, g: 120, b: 125, a: 0.25 };
    } else if (theme === 'gold') {
      return { r: 255, g: 215, b: 0, a: 0.5 };
    } else if (theme === 'warm') {
      return { r: 255, g: 140, b: 170, a: 0.6 };
    } else if (theme === 'sky') {
      return { r: 100, g: 160, b: 220, a: 0.35 };
    } else if (theme === 'green') {
      return { r: 100, g: 200, b: 140, a: 0.4 };
    }
    return { r: 100, g: 180, b: 255, a: 0.5 };
  }

  function createParticle() {
    var color = getParticleColor();
    return {
      x: Math.random() * canvas.width,
      y: canvas.height + 10,
      size: Math.random() * 3 + 1,
      speedY: Math.random() * 0.5 + 0.2,
      speedX: (Math.random() - 0.5) * 0.3,
      opacity: Math.random() * 0.5 + 0.3,
      color: color
    };
  }

  function updateParticle(p) {
    p.y -= p.speedY;
    p.x += p.speedX;
    p.opacity -= 0.001;
  }

  function drawParticle(p) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(' + p.color.r + ',' + p.color.g + ',' + p.color.b + ',' + (p.opacity * p.color.a) + ')';
    ctx.fill();
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (particles.length < 80) {
      particles.push(createParticle());
    }

    for (var i = particles.length - 1; i >= 0; i--) {
      updateParticle(particles[i]);
      drawParticle(particles[i]);
      if (particles[i].y < -10 || particles[i].opacity <= 0) {
        particles.splice(i, 1);
      }
    }

    requestAnimationFrame(animate);
  }

  resize();
  window.addEventListener('resize', resize);
  animate();

  // 主题变化时更新粒子颜色
  var observer = new MutationObserver(function() {
    particles = [];
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