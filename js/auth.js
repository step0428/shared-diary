// 认证状态
let currentUser = null;
let currentUserData = null;

// 监听认证状态
auth.onAuthStateChanged(async function(user) {
  if (user) {
    currentUser = user;
    await loadUserData();
    showMainApp();
    loadDiaries();
    loadLinkedUsers();
    // 登录后检测今天是否有纪念日，触发全屏庆祝
    if (typeof checkAndTriggerCelebration === 'function') setTimeout(checkAndTriggerCelebration, 1500);
  } else {
    currentUser = null;
    currentUserData = null;
    showAuthPage();
  }
});

// 加载用户数据
async function loadUserData() {
  var doc = await db.collection('users').doc(currentUser.uid).get();
  if (doc.exists) {
    currentUserData = doc.data();
    // 如果没有专属码，生成一个
    if (!currentUserData.linkCode) {
      var linkCode = generateLinkCode();
      await db.collection('users').doc(currentUser.uid).update({
        linkCode: linkCode
      });
      currentUserData.linkCode = linkCode;
    }
  } else {
    var linkCode = generateLinkCode();
    currentUserData = {
      email: currentUser.email,
      displayName: currentUser.displayName || '',
      linkCode: linkCode
    };
    await db.collection('users').doc(currentUser.uid).set(currentUserData);
  }
}

// 显示认证页
function showAuthPage() {
  document.getElementById('authPage').classList.remove('hidden');
  document.getElementById('mainApp').classList.add('hidden');
}

// 显示主应用
async function showMainApp() {
  document.getElementById('authPage').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  document.getElementById('userName').textContent = currentUserData && currentUserData.displayName ? currentUserData.displayName : currentUser.email;

  // 显示头像
  if (currentUserData && currentUserData.avatarUrl) {
    document.getElementById('userAvatar').src = currentUserData.avatarUrl;
  }

  // 头像裁剪相关变量
let cropImage = null;
let cropSelection = { x: 0, y: 0, size: 0 };
let isDragging = false;
let dragStart = { x: 0, y: 0 };

  // 头像点击上传
  document.getElementById('userAvatar').addEventListener('click', function(e) {
    e.stopPropagation();
    document.getElementById('avatarInput').click();
  });

  // 名称点击显示菜单
  document.getElementById('userName').addEventListener('click', function(e) {
    e.stopPropagation();
    showUserMenu();
  });

  document.getElementById('avatarInput').addEventListener('change', async function(e) {
    var file = e.target.files[0];
    if (!file) return;

    // 读取图片并显示裁剪弹窗
    var reader = new FileReader();
    reader.onload = function(ev) {
      cropImage = new Image();
      cropImage.onload = function() {
        openCropModal(cropImage);
      };
      cropImage.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    document.getElementById('avatarInput').value = '';
  });

  // 打开裁剪弹窗
  function openCropModal(img) {
    var canvas = document.getElementById('cropCanvas');
    var ctx = canvas.getContext('2d');
    var container = document.getElementById('cropContainer');

    var maxSize = 300;
    var scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    cropSelection.size = Math.min(canvas.width, canvas.height) * 0.8;
    cropSelection.x = (canvas.width - cropSelection.size) / 2;
    cropSelection.y = (canvas.height - cropSelection.size) / 2;

    drawCropOverlay();
    document.getElementById('cropModal').classList.remove('hidden');
  }

  // 绘制裁剪覆盖层
  function drawCropOverlay() {
    var canvas = document.getElementById('cropCanvas');
    var ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(cropImage, 0, 0, canvas.width, canvas.height);

    // 九宫格分割线（直接画在原图上）
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    var step = cropSelection.size / 3;
    for (var i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cropSelection.x + step * i, cropSelection.y);
      ctx.lineTo(cropSelection.x + step * i, cropSelection.y + cropSelection.size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cropSelection.x, cropSelection.y + step * i);
      ctx.lineTo(cropSelection.x + cropSelection.size, cropSelection.y + step * i);
      ctx.stroke();
    }

    // 边框
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(cropSelection.x, cropSelection.y, cropSelection.size, cropSelection.size);

    // 四个角的角标
    var cornerSize = 15;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    // 左上角
    ctx.beginPath();
    ctx.moveTo(cropSelection.x, cropSelection.y + cornerSize);
    ctx.lineTo(cropSelection.x, cropSelection.y);
    ctx.lineTo(cropSelection.x + cornerSize, cropSelection.y);
    ctx.stroke();
    // 右上角
    ctx.beginPath();
    ctx.moveTo(cropSelection.x + cropSelection.size - cornerSize, cropSelection.y);
    ctx.lineTo(cropSelection.x + cropSelection.size, cropSelection.y);
    ctx.lineTo(cropSelection.x + cropSelection.size, cropSelection.y + cornerSize);
    ctx.stroke();
    // 左下角
    ctx.beginPath();
    ctx.moveTo(cropSelection.x, cropSelection.y + cropSelection.size - cornerSize);
    ctx.lineTo(cropSelection.x, cropSelection.y + cropSelection.size);
    ctx.lineTo(cropSelection.x + cornerSize, cropSelection.y + cropSelection.size);
    ctx.stroke();
    // 右下角
    ctx.beginPath();
    ctx.moveTo(cropSelection.x + cropSelection.size - cornerSize, cropSelection.y + cropSelection.size);
    ctx.lineTo(cropSelection.x + cropSelection.size, cropSelection.y + cropSelection.size);
    ctx.lineTo(cropSelection.x + cropSelection.size, cropSelection.y + cropSelection.size - cornerSize);
    ctx.stroke();
  }

  // 裁剪画布鼠标事件
  var cropCanvas = document.getElementById('cropCanvas');

  function handleCropDragStart(e) {
    e.preventDefault();
    isDragging = true;
    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;
    var rect = cropCanvas.getBoundingClientRect();
    dragStart.x = clientX - rect.left;
    dragStart.y = clientY - rect.top;
  }

  function handleCropDragMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;
    var rect = cropCanvas.getBoundingClientRect();
    var x = clientX - rect.left;
    var y = clientY - rect.top;

    var dx = x - dragStart.x;
    var dy = y - dragStart.y;

    cropSelection.x = Math.max(0, Math.min(cropSelection.x + dx, cropCanvas.width - cropSelection.size));
    cropSelection.y = Math.max(0, Math.min(cropSelection.y + dy, cropCanvas.height - cropSelection.size));

    dragStart.x = x;
    dragStart.y = y;

    drawCropOverlay();
  }

  function handleCropDragEnd() {
    isDragging = false;
  }

  cropCanvas.addEventListener('mousedown', handleCropDragStart);
  cropCanvas.addEventListener('touchstart', handleCropDragStart);

  document.addEventListener('mousemove', handleCropDragMove);
  document.addEventListener('touchmove', handleCropDragMove);

  document.addEventListener('mouseup', handleCropDragEnd);
  document.addEventListener('touchend', handleCropDragEnd);

  // 确认裁剪
  document.getElementById('confirmCropBtn').addEventListener('click', async function() {
    if (!cropImage) return;

    var canvas = document.getElementById('cropCanvas');
    var scaleX = cropImage.width / canvas.width;
    var scaleY = cropImage.height / canvas.height;

    var cropCanvas = document.createElement('canvas');
    cropCanvas.width = 200;
    cropCanvas.height = 200;
    var cropCtx = cropCanvas.getContext('2d');

    cropCtx.drawImage(
      cropImage,
      cropSelection.x * scaleX, cropSelection.y * scaleY,
      cropSelection.size * scaleX, cropSelection.size * scaleY,
      0, 0, 200, 200
    );

    cropCanvas.toBlob(async function(blob) {
      if (!blob) {
        alert('裁剪失败');
        return;
      }
      try {
        var url = await uploadToCloudinary(blob);
        await db.collection('users').doc(currentUser.uid).update({
          avatarUrl: url
        });
        currentUserData.avatarUrl = url;
        document.getElementById('userAvatar').src = url;
      } catch (err) {
        console.error('头像上传失败:', err);
        alert('头像上传失败');
      }
    }, 'image/jpeg', 0.8);

    document.getElementById('cropModal').classList.add('hidden');
    cropImage = null;
  });

  // 关闭裁剪弹窗
  document.getElementById('closeCropModal').addEventListener('click', function() {
    document.getElementById('cropModal').classList.add('hidden');
    cropImage = null;
  });

  // 显示用户菜单
  function showUserMenu() {
    var existingMenu = document.getElementById('userMenuDropdown');
    if (existingMenu) {
      existingMenu.remove();
      return;
    }

    var menu = document.createElement('div');
    menu.id = 'userMenuDropdown';
    menu.style.cssText = 'position:absolute;top:50px;right:60px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:8px 0;min-width:200px;z-index:1000;box-shadow:0 4px 12px rgba(0,0,0,0.15);';
    var emailText = currentUser ? currentUser.email : '';
    var divider = '<div style="height:1px;background:var(--border);margin:6px 0;"></div>';
    menu.innerHTML = '<div style="padding:8px 16px;border-bottom:1px solid var(--border);font-size:12px;color:var(--text-secondary);">' + escapeHtml(emailText) + '</div>' +
      '<div class="menu-item" onclick="openLinkModal()" style="padding:10px 16px;cursor:pointer;font-size:14px;color:var(--text);display:flex;align-items:center;gap:8px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>链接管理</div>' +
      '<div class="menu-item" onclick="editUserName()" style="padding:10px 16px;cursor:pointer;font-size:14px;color:var(--text);display:flex;align-items:center;gap:8px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>修改名称</div>' +
      '<div class="menu-item" onclick="showChangePasswordModal()" style="padding:10px 16px;cursor:pointer;font-size:14px;color:var(--text);display:flex;align-items:center;gap:8px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>修改密码</div>' +
      '<div class="menu-item" onclick="openAISettingsModal()" style="padding:10px 16px;cursor:pointer;font-size:14px;color:var(--text);display:flex;align-items:center;gap:8px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8.01" y2="16"></line><line x1="16" y1="16" x2="16.01" y2="16"></line></svg>和ta遇见</div>' +
      divider +
      '<div class="menu-item" id="exportBackupBtn" style="padding:10px 16px;cursor:pointer;font-size:14px;color:var(--text);display:flex;align-items:center;gap:8px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>导出备份</div>' +
      '<label class="menu-item" id="importBackupLabel" style="padding:10px 16px;cursor:pointer;font-size:14px;color:var(--text);display:flex;align-items:center;gap:8px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>导入备份<input type="file" id="importFileInput" accept=".zip" style="display:none;"></label>' +
      divider +
      '<div class="menu-item" onclick="logout()" style="padding:10px 16px;cursor:pointer;font-size:14px;color:#ff6b6b;display:flex;align-items:center;gap:8px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>退出登录</div>';

    document.body.appendChild(menu);

    // 添加hover样式
    var style = document.createElement('style');
    style.id = 'userMenuStyle';
    style.textContent = '.menu-item:hover{background:var(--hover-bg);}';
    document.head.appendChild(style);

    // Attach event listeners to the newly created elements
    document.getElementById('exportBackupBtn').addEventListener('click', async function(e) {
      e.stopPropagation();
      await exportBackup(e.currentTarget); // Pass the button element
      closeUserMenu(); // Close menu after action
    });

    document.getElementById('importFileInput').addEventListener('change', async function(e) {
      e.stopPropagation();
      var file = e.target.files[0];
      if (file) {
        await importBackup(file, e.currentTarget.closest('label')); // Pass the label element
        closeUserMenu(); // Close menu after action
      }
    });

    // 点击其他地方关闭菜单
    setTimeout(function() {
      document.addEventListener('click', closeUserMenu);
    }, 0);
  }

  // 打开链接管理弹窗
  window.openLinkModal = function() {
    var menu = document.getElementById('userMenuDropdown');
    if (menu) menu.remove();
    document.getElementById('linkModal').classList.remove('hidden');
    if (currentUserData && currentUserData.linkCode) {
      document.getElementById('myLinkCode').textContent = currentUserData.linkCode;
    }
    loadLinkedUsers();
    document.getElementById('connectResult').classList.add('hidden');
  };

  // 打开和ta遇见设置弹窗
  window.openAISettingsModal = function() {
    var menu = document.getElementById('userMenuDropdown');
    if (menu) menu.remove();
    document.getElementById('aiSettingsModal').classList.remove('hidden');
    if (typeof loadAISettings === 'function') {
      loadAISettings();
    }
  };

  function closeUserMenu(e) {
    var menu = document.getElementById('userMenuDropdown');
    // 如果没有事件对象e，或者点击发生在菜单外部，则关闭菜单
    if (menu && (!e || (!menu.contains(e.target) && e.target.id !== 'userName'))) {
      menu.remove();
      document.removeEventListener('click', closeUserMenu);
    }
  }

  // 修改用户名
  window.editUserName = function() {
    var menu = document.getElementById('userMenuDropdown');
    if (menu) menu.remove();

    showInputModal('修改名称', '请输入新名称', currentUserData && currentUserData.displayName ? currentUserData.displayName : '', function(newName) {
      if (newName && newName.trim()) {
        db.collection('users').doc(currentUser.uid).update({
          displayName: newName.trim()
        }).then(function() {
          currentUserData.displayName = newName.trim();
          document.getElementById('userName').textContent = newName.trim();
        }).catch(function(err) {
          console.error('修改名称失败:', err);
          alert('修改名称失败');
        });
      }
    });
  };

  // 显示修改密码弹窗
  window.showChangePasswordModal = function() {
    var menu = document.getElementById('userMenuDropdown');
    if (menu) menu.remove();

    var modal = document.createElement('div');
    modal.id = 'passwordModal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:2000;';
    modal.innerHTML = '<div style="background:var(--bg-primary);border-radius:12px;padding:24px;width:320px;max-width:90%;"><h3 style="margin:0 0 16px;font-size:16px;color:var(--text);">修改密码</h3>' +
      '<div style="margin-bottom:12px;"><label style="display:block;font-size:13px;color:var(--text-muted);margin-bottom:6px;">新密码</label><input type="password" id="newPasswordInput" placeholder="至少6位" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg-secondary);color:var(--text);box-sizing:border-box;"></div>' +
      '<div style="margin-bottom:16px;"><label style="display:block;font-size:13px;color:var(--text-muted);margin-bottom:6px;">确认密码</label><input type="password" id="confirmPasswordInput" placeholder="再次输入新密码" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg-secondary);color:var(--text);box-sizing:border-box;"></div>' +
      '<div style="display:flex;gap:10px;justify-content:flex-end;"><button onclick="closePasswordModal()" style="padding:8px 16px;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--text);cursor:pointer;">取消</button><button onclick="confirmChangePassword()" style="padding:8px 16px;border:none;border-radius:6px;background:var(--accent);color:#fff;cursor:pointer;">确认</button></div></div>';
    document.body.appendChild(modal);

    modal.addEventListener('click', function(e) {
      if (e.target === modal) closePasswordModal();
    });
  };

  window.closePasswordModal = function() {
    var modal = document.getElementById('passwordModal');
    if (modal) modal.remove();
  };

  window.confirmChangePassword = function() {
    var newPass = document.getElementById('newPasswordInput').value;
    var confirmPass = document.getElementById('confirmPasswordInput').value;

    if (!newPass || newPass.length < 6) {
      alert('密码至少需要6位');
      return;
    }
    if (newPass !== confirmPass) {
      alert('两次输入的密码不一致');
      return;
    }

    auth.currentUser.updatePassword(newPass).then(function() {
      alert('密码修改成功');
      closePasswordModal();
    }).catch(function(err) {
      console.error('修改密码失败:', err);
      if (err.code === 'auth/requires-recent-login') {
        alert('修改密码需要您最近一次登录后操作，请重新登录后再试');
      } else {
        alert('修改密码失败: ' + err.message);
      }
    });
  };

  // 加载用户标签和合集
  await loadUserTags();
  renderTagOptions();
  setupAddTag();
  setupCollectionModal();
  updateCollectionFilter();
  await loadUserTheme();
  renderFriendSidebar();
}

// 生成专属码
function generateLinkCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code = '';
  for (var i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 注册
async function register(email, password, displayName) {
  var result = await auth.createUserWithEmailAndPassword(email, password);

  var linkCode = generateLinkCode();

  await db.collection('users').doc(result.user.uid).set({
    email: email,
    displayName: displayName,
    linkCode: linkCode,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  return result;
}

// 登录
async function login(email, password) {
  return await auth.signInWithEmailAndPassword(email, password);
}

// 登出
async function logout() {
  await auth.signOut();
}

// 创建链接
async function createLink() {
  var linkRef = await db.collection('links').add({
    userId: currentUser.uid,
    userEmail: currentUser.email,
    userDisplayName: currentUserData && currentUserData.displayName ? currentUserData.displayName : '',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    accepted: false,
    acceptedBy: null
  });

  return linkRef.id;
}

// 获取已接受链接
async function getAcceptedLinks() {
  try {
    // 执行两次查询然后合并结果
    var [linksAsCreator, linksAsAccepted] = await Promise.all([
      db.collection('links').where('userId', '==', currentUser.uid).where('accepted', '==', true).get(),
      db.collection('links').where('acceptedBy', '==', currentUser.uid).where('accepted', '==', true).get()
    ]);

    // 合并并去重（同一个链接可能在两种查询中都出现）
    var linkMap = new Map();
    linksAsCreator.docs.forEach(function(doc) { linkMap.set(doc.id, doc); });
    linksAsAccepted.docs.forEach(function(doc) { linkMap.set(doc.id, doc); });

    return Array.from(linkMap.values());
  } catch (e) {
    console.error('getAcceptedLinks error:', e);
    return [];
  }
}

// 接受链接
async function acceptLink(linkId) {
  await db.collection('links').doc(linkId).update({
    accepted: true,
    acceptedBy: currentUser.uid
  });
}

// 拒绝链接
async function rejectLink(linkId) {
  await db.collection('links').doc(linkId).delete();
}

// 解除链接
async function unlinkUser(linkId) {
  await db.collection('links').doc(linkId).delete();
}

// 获取链接另一方的用户信息
async function getLinkUserInfo(linkData, isCreator) {
  var otherUid = isCreator ? linkData.acceptedBy : linkData.userId;
  var otherUserDoc = await db.collection('users').doc(otherUid).get();
  if (otherUserDoc.exists) {
    return {
      userId: otherUid,
      email: otherUserDoc.data().email,
      displayName: otherUserDoc.data().displayName || otherUserDoc.data().email,
      avatarUrl: otherUserDoc.data().avatarUrl || ''
    };
  }
  return {
    userId: otherUid,
    email: isCreator ? linkData.userEmail : 'unknown',
    displayName: isCreator ? (linkData.userDisplayName || linkData.userEmail) : 'unknown',
    avatarUrl: ''
  };
}

// 批量获取用户信息（解决N+1查询问题）
async function getBatchUserInfo(userIds) {
  if (!userIds || userIds.length === 0) return [];

  var uniqueIds = [...new Set(userIds)];
  var users = [];

  // Firestore的in查询最多10个元素，分批查询
  var batchSize = 10;
  for (var i = 0; i < uniqueIds.length; i += batchSize) {
    var batch = uniqueIds.slice(i, i + batchSize);
    var docs = await db.collection('users').where(firebase.firestore.FieldPath.documentId(), 'in', batch).get();
    docs.forEach(function(doc) {
      var data = doc.data();
      users.push({
        userId: doc.id,
        email: data.email || '',
        displayName: data.displayName || data.email || 'unknown',
        avatarUrl: data.avatarUrl || ''
      });
    });
  }

  return users;
}