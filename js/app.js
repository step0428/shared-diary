// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  setupAuth();
  setupModal();
  setupWriteDiary();
  setupLinkManagement();
  setupViewTabs();
  initCalendar();

  // 隐藏加载动画
  setTimeout(() => {
    document.getElementById('loading').classList.add('hidden');
  }, 800);
}

// 设置认证
function setupAuth() {
  const authForm = document.getElementById('authForm');
  const authTabs = document.querySelectorAll('.auth-tab');
  const displayNameInput = document.getElementById('displayName');
  const authError = document.getElementById('authError');

  let isLogin = true;

  authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      authTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      isLogin = tab.dataset.tab === 'login';
      displayNameInput.classList.toggle('hidden', isLogin);
      authForm.querySelector('button').textContent = isLogin ? '登录' : '注册';
      authError.textContent = '';
    });
  });

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.textContent = '';

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const displayName = document.getElementById('displayName').value;

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

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await logout();
  });
}

// 设置模态框
function setupModal() {
  // 关闭按钮
  document.getElementById('closeDiaryModal').addEventListener('click', () => {
    document.getElementById('diaryModal').classList.add('hidden');
  });

  document.getElementById('closeLinkModal').addEventListener('click', () => {
    document.getElementById('linkModal').classList.add('hidden');
  });

  // 点击背景关闭
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', () => {
      backdrop.closest('.modal').classList.add('hidden');
    });
  });
}

// 设置写日记
function setupWriteDiary() {
  document.getElementById('writeBtn').addEventListener('click', openWriteModal);

  document.getElementById('diaryVisibility').addEventListener('change', (e) => {
    const shareSelectRow = document.getElementById('shareSelectRow');
    shareSelectRow.classList.toggle('hidden', e.target.value !== 'shared');
  });

  document.getElementById('writeForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const content = document.getElementById('diaryContent').value;
    const date = document.getElementById('diaryDate').value;
    const visibility = document.getElementById('diaryVisibility').value;
    const imageFile = document.getElementById('diaryImage').files[0];

    const sharedWith = [];
    if (visibility === 'shared') {
      document.querySelectorAll('#shareList input:checked').forEach(checkbox => {
        sharedWith.push(checkbox.value);
      });
    }

    await saveDiary(content, date, visibility, sharedWith, imageFile);
  });
}

function openWriteModal() {
  document.getElementById('writeModal').classList.remove('hidden');
  document.getElementById('diaryContent').value = '';
  document.getElementById('diaryDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('diaryVisibility').value = 'private';
  document.getElementById('shareSelectRow').classList.add('hidden');
  document.getElementById('diaryImage').value = '';
  loadShareUsers();
}

function closeWriteModal() {
  document.getElementById('writeModal').classList.add('hidden');
}

document.getElementById('closeWriteModal').addEventListener('click', closeWriteModal);

// 检查 URL 链接参数（供外部调用）
window.checkInviteLink = function() {
  const urlParams = new URLSearchParams(window.location.search);
  const linkId = urlParams.get('link');
  if (linkId && currentUser) {
    handleIncomingLink(linkId);
  }
};

// 设置链接管理
function setupLinkManagement() {
  document.getElementById('linkBtn').addEventListener('click', async () => {
    document.getElementById('linkModal').classList.remove('hidden');
    loadPendingLinks();
    loadLinkedUsers();
    document.getElementById('linkResult').classList.add('hidden');
  });

  document.getElementById('createLinkBtn').addEventListener('click', async () => {
    const linkId = await createLink();
    const linkUrl = `${window.location.origin}${window.location.pathname}?link=${linkId}`;
    document.getElementById('generatedLink').value = linkUrl;
    document.getElementById('linkResult').classList.remove('hidden');
  });

  document.getElementById('copyLinkBtn').addEventListener('click', () => {
    const input = document.getElementById('generatedLink');
    input.select();
    document.execCommand('copy');
    document.getElementById('copyLinkBtn').textContent = '已复制';
    setTimeout(() => {
      document.getElementById('copyLinkBtn').textContent = '复制';
    }, 2000);
  });
}

// 处理收到的链接
async function handleIncomingLink(linkId) {
  try {
    const linkDoc = await db.collection('links').doc(linkId).get();

    if (!linkDoc.exists) {
      alert('链接无效或已过期');
      return;
    }

    const linkData = linkDoc.data();

    if (linkData.userId === currentUser.uid) {
      return; // 是自己的链接
    }

    if (linkData.accepted) {
      alert('此链接已使用');
      return;
    }

    const confirmAccept = confirm(`收到来自 ${linkData.userDisplayName || linkData.userEmail} 的连接请求，是否接受？`);
    if (confirmAccept) {
      await acceptLink(linkId);
      alert('连接成功！');
      loadLinkedUsers();
      loadDiaries();
    }
  } catch (error) {
    console.error('处理链接失败:', error);
  }
}

// 加载待处理链接
async function loadPendingLinks() {
  const pendingLinks = document.getElementById('pendingLinks');
  pendingLinks.innerHTML = '';

  const snapshot = await db.collection('links')
    .where('accepted', '==', false)
    .get();

  // 客户端过滤
  const myPendingLinks = snapshot.docs.filter(doc => doc.data().userId !== currentUser.uid);

  if (myPendingLinks.length === 0) {
    pendingLinks.innerHTML = '<div style="font-size:13px;color:rgba(255,255,255,0.3)">没有待处理的链接请求</div>';
    return;
  }

  myPendingLinks.forEach(doc => {
    const data = doc.data();
    const item = document.createElement('div');
    item.className = 'pending-item';
    item.innerHTML = `
      <div class="user-info">
        <span class="user-email">${data.userDisplayName || data.userEmail}</span>
        <span class="user-status">等待接受</span>
      </div>
      <div>
        <button class="accept-btn" data-id="${doc.id}">接受</button>
        <button class="reject-btn" data-id="${doc.id}">拒绝</button>
      </div>
    `;
    pendingLinks.appendChild(item);
  });

  pendingLinks.querySelectorAll('.accept-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await acceptLink(btn.dataset.id);
      loadPendingLinks();
      loadLinkedUsers();
      loadDiaries();
      refreshCalendar();
    });
  });

  pendingLinks.querySelectorAll('.reject-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await rejectLink(btn.dataset.id);
      loadPendingLinks();
    });
  });
}

// 加载已链接用户
async function loadLinkedUsers() {
  const linkedUsers = document.getElementById('linkedUsers');
  linkedUsers.innerHTML = '';

  if (!currentUserData?.linkedUsers?.length) {
    linkedUsers.innerHTML = '<div style="font-size:13px;color:rgba(255,255,255,0.3)">还没有链接的人</div>';
    return;
  }

  for (const user of currentUserData.linkedUsers) {
    const item = document.createElement('div');
    item.className = 'linked-item';
    item.innerHTML = `
      <div class="user-info">
        <span class="user-email">${user.displayName || user.email}</span>
        <span class="user-status">已连接</span>
      </div>
      <button class="unlink-btn" data-id="${user.userId}">解除</button>
    `;
    linkedUsers.appendChild(item);
  }

  linkedUsers.querySelectorAll('.unlink-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('确定要解除连接吗？')) {
        await unlinkUser(btn.dataset.id);
        await loadUserData();
        loadLinkedUsers();
        loadDiaries();
        refreshCalendar();
      }
    });
  });
}

// 设置视图切换
function setupViewTabs() {
  const viewTabs = document.querySelectorAll('.view-tab');
  const diaryView = document.getElementById('diaryView');
  const calendarView = document.getElementById('calendarView');

  viewTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      viewTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const view = tab.dataset.view;
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
