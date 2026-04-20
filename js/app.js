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
  initCalendar();

  // 隐藏加载动画
  setTimeout(function() {
    document.getElementById('loading').classList.add('hidden');
  }, 800);
}

// 设置认证
function setupAuth() {
  var authForm = document.getElementById('authForm');
  var authTabs = document.querySelectorAll('.auth-tab');
  var displayNameInput = document.getElementById('displayName');
  var authError = document.getElementById('authError');
  var isLogin = true;

  authTabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      authTabs.forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      isLogin = tab.dataset.tab === 'login';
      displayNameInput.classList.toggle('hidden', isLogin);
      authForm.querySelector('button').textContent = isLogin ? '登录' : '注册';
      authError.textContent = '';
    });
  });

  authForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    authError.textContent = '';

    var email = document.getElementById('email').value;
    var password = document.getElementById('password').value;
    var displayName = document.getElementById('displayName').value;

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        if (!displayName.trim()) {
          authError.textContent = '请输入昵称';
          return;
        }
        await register(email, password, displayName);
      }
    } catch (error) {
      authError.textContent = error.message;
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', async function() {
    await logout();
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

  document.querySelectorAll('.modal-backdrop').forEach(function(backdrop) {
    backdrop.addEventListener('click', function() {
      backdrop.closest('.modal').classList.add('hidden');
    });
  });
}

// 设置写日记
function setupWriteDiary() {
  document.getElementById('writeBtn').addEventListener('click', openWriteModal);

  document.getElementById('diaryVisibility').addEventListener('change', function(e) {
    var shareSelectRow = document.getElementById('shareSelectRow');
    shareSelectRow.classList.toggle('hidden', e.target.value !== 'shared');
  });

  document.getElementById('writeForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    var content = document.getElementById('diaryContent').value;
    var date = document.getElementById('diaryDate').value;
    var visibility = document.getElementById('diaryVisibility').value;
    var imageFile = document.getElementById('diaryImage').files[0];

    var sharedWith = [];
    if (visibility === 'shared') {
      document.querySelectorAll('#shareList input:checked').forEach(function(checkbox) {
        sharedWith.push(checkbox.value);
      });
    }

    await saveDiary(content, date, visibility, sharedWith, imageFile);
  });
}

function openWriteModal() {
  var now = new Date();
  document.getElementById('writeModal').classList.remove('hidden');
  document.getElementById('diaryTitle').value = '';
  document.getElementById('diaryContent').value = '';
  document.getElementById('diaryDate').value = now.toISOString().split('T')[0];
  document.getElementById('diaryTime').value = now.toTimeString().slice(0, 5);
  document.getElementById('diaryVisibility').value = 'private';
  document.getElementById('shareSelectRow').classList.add('hidden');
  document.getElementById('diaryImage').value = '';
  loadShareUsers();
  renderTagOptions();
}

function closeWriteModal() {
  document.getElementById('writeModal').classList.add('hidden');
}

document.getElementById('closeWriteModal').addEventListener('click', closeWriteModal);

// 检查 URL 链接参数
window.checkInviteLink = function() {
  var urlParams = new URLSearchParams(window.location.search);
  var linkId = urlParams.get('link');
  if (linkId && currentUser) {
    handleIncomingLink(linkId);
  }
};

// 设置链接管理
function setupLinkManagement() {
  document.getElementById('linkBtn').addEventListener('click', async function() {
    document.getElementById('linkModal').classList.remove('hidden');
    loadPendingLinks();
    loadLinkedUsers();
    document.getElementById('linkResult').classList.add('hidden');
  });

  document.getElementById('createLinkBtn').addEventListener('click', async function() {
    var linkId = await createLink();
    var linkUrl = window.location.origin + window.location.pathname + '?link=' + linkId;
    document.getElementById('generatedLink').value = linkUrl;
    document.getElementById('linkResult').classList.remove('hidden');
  });

  document.getElementById('copyLinkBtn').addEventListener('click', function() {
    var input = document.getElementById('generatedLink');
    input.select();
    document.execCommand('copy');
    document.getElementById('copyLinkBtn').textContent = '已复制';
    setTimeout(function() {
      document.getElementById('copyLinkBtn').textContent = '复制';
    }, 2000);
  });
}

// 处理收到的链接
async function handleIncomingLink(linkId) {
  try {
    var linkDoc = await db.collection('links').doc(linkId).get();

    if (!linkDoc.exists) {
      return;
    }

    var linkData = linkDoc.data();

    if (linkData.userId === currentUser.uid) {
      return;
    }

    if (linkData.accepted) {
      return;
    }

    var confirmAccept = confirm('收到来自 ' + (linkData.userDisplayName || linkData.userEmail) + ' 的连接请求，是否接受？');
    if (confirmAccept) {
      await acceptLink(linkId);
      alert('连接成功！');
      loadLinkedUsers();
      loadDiaries();
      refreshCalendar();
    }
  } catch (error) {
    console.error('处理链接失败:', error);
  }
}

// 加载待处理链接
async function loadPendingLinks() {
  var pendingLinks = document.getElementById('pendingLinks');
  pendingLinks.innerHTML = '';

  // 查找发给我的未被接受的链接
  var snapshot = await db.collection('links')
    .where('accepted', '==', false)
    .get();

  var myPendingLinks = snapshot.docs.filter(function(doc) {
    return doc.data().userId !== currentUser.uid;
  });

  if (myPendingLinks.length === 0) {
    pendingLinks.innerHTML = '<div style="font-size:13px;color:rgba(255,255,255,0.3)">没有待处理的链接请求</div>';
    return;
  }

  myPendingLinks.forEach(function(doc) {
    var data = doc.data();
    var item = document.createElement('div');
    item.className = 'pending-item';
    item.innerHTML = '<div class="user-info"><span class="user-email">' + (data.userDisplayName || data.userEmail) + '</span><span class="user-status">等待接受</span></div><div><button class="accept-btn" data-id="' + doc.id + '">接受</button><button class="reject-btn" data-id="' + doc.id + '">拒绝</button></div>';
    pendingLinks.appendChild(item);
  });

  pendingLinks.querySelectorAll('.accept-btn').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      await acceptLink(btn.dataset.id);
      loadPendingLinks();
      loadLinkedUsers();
      loadDiaries();
      refreshCalendar();
    });
  });

  pendingLinks.querySelectorAll('.reject-btn').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      await rejectLink(btn.dataset.id);
      loadPendingLinks();
    });
  });
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

  for (var i = 0; i < acceptedLinks.length; i++) {
    var linkDoc = acceptedLinks[i];
    var linkData = linkDoc.data();
    var isCreator = linkData.userId === currentUser.uid;
    var otherUser = await getLinkUserInfo(linkData, isCreator);

    var item = document.createElement('div');
    item.className = 'linked-item';
    item.innerHTML = '<div class="user-info"><span class="user-email">' + otherUser.displayName + '</span><span class="user-status">已连接</span></div><button class="unlink-btn" data-id="' + linkDoc.id + '">解除</button>';
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

  viewTabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      viewTabs.forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');

      var view = tab.dataset.view;
      if (view === 'diary') {
        diaryView.classList.remove('hidden');
        calendarView.classList.add('hidden');
      } else {
        diaryView.classList.add('hidden');
        calendarView.classList.remove('hidden');
        refreshCalendar();
      }
    });
  });
}