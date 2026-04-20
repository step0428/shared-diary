// 认证状态
var currentUser = null;
var currentUserData = null;

// 监听认证状态
auth.onAuthStateChanged(async function(user) {
  if (user) {
    currentUser = user;
    await loadUserData();
    showMainApp();
    loadDiaries();
    loadLinkedUsers();
    loadPendingLinks();
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
  } else {
    currentUserData = {
      email: currentUser.email,
      displayName: currentUser.displayName || ''
    };
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
var cropImage = null;
var cropSelection = { x: 0, y: 0, size: 0 };
var isDragging = false;
var dragStart = { x: 0, y: 0 };

  // 头像点击上传
  document.getElementById('userInfo').addEventListener('click', function() {
    document.getElementById('avatarInput').click();
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
  document.getElementById('cropCanvas').addEventListener('mousedown', function(e) {
    isDragging = true;
    var rect = e.target.getBoundingClientRect();
    dragStart.x = e.clientX - rect.left;
    dragStart.y = e.clientY - rect.top;
  });

  document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    var canvas = document.getElementById('cropCanvas');
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;

    var dx = x - dragStart.x;
    var dy = y - dragStart.y;

    cropSelection.x = Math.max(0, Math.min(cropSelection.x + dx, canvas.width - cropSelection.size));
    cropSelection.y = Math.max(0, Math.min(cropSelection.y + dy, canvas.height - cropSelection.size));

    dragStart.x = x;
    dragStart.y = y;

    drawCropOverlay();
  });

  document.addEventListener('mouseup', function() {
    isDragging = false;
  });

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

  // 加载用户标签和合集
  await loadUserTags();
  renderTagOptions();
  setupAddTag();
  setupCollectionModal();
  updateCollectionFilter();
  await loadUserTheme();
  renderFriendSidebar();
  setTimeout(function() { window.checkInviteLink(); }, 500);
}

// 注册
async function register(email, password, displayName) {
  var result = await auth.createUserWithEmailAndPassword(email, password);

  await db.collection('users').doc(result.user.uid).set({
    email: email,
    displayName: displayName,
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
    // 获取所有链接，客户端过滤
    var allLinks = await db.collection('links').where('accepted', '==', true).get();

    var myLinks = [];
    allLinks.docs.forEach(function(doc) {
      var data = doc.data();
      if (data.userId === currentUser.uid || data.acceptedBy === currentUser.uid) {
        myLinks.push(doc);
      }
    });

    return myLinks;
  } catch (e) {
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
      displayName: otherUserDoc.data().displayName || otherUserDoc.data().email
    };
  }
  return {
    userId: otherUid,
    email: isCreator ? linkData.userEmail : 'unknown',
    displayName: isCreator ? (linkData.userDisplayName || linkData.userEmail) : 'unknown'
  };
}