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
  }
}

// 显示认证页
function showAuthPage() {
  document.getElementById('authPage').classList.remove('hidden');
  document.getElementById('mainApp').classList.add('hidden');
}

// 显示主应用
function showMainApp() {
  document.getElementById('authPage').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  document.getElementById('userName').textContent = currentUserData && currentUserData.displayName ? currentUserData.displayName : currentUser.email;
  // 检查链接邀请
  setTimeout(function() { window.checkInviteLink(); }, 500);
}

// 注册
async function register(email, password, displayName) {
  var result = await auth.createUserWithEmailAndPassword(email, password);

  // 创建用户文档
  await db.collection('users').doc(result.user.uid).set({
    email: email,
    displayName: displayName,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    linkedUsers: []
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

// 处理链接
async function acceptLink(linkId) {
  var linkDoc = await db.collection('links').doc(linkId).get();
  var linkData = linkDoc.data();

  // 获取对方用户数据
  var otherUserDoc = await db.collection('users').doc(linkData.userId).get();
  var otherUserData = otherUserDoc.data();

  // 添加到我的 linkedUsers
  var myUpdate = {};
  myUpdate['linkedUsers'] = firebase.firestore.FieldValue.arrayUnion({
    userId: linkData.userId,
    email: linkData.userEmail,
    displayName: linkData.userDisplayName,
    linkedAt: new Date()
  });
  await db.collection('users').doc(currentUser.uid).update(myUpdate);

  // 添加到对方的 linkedUsers
  var otherUpdate = {};
  otherUpdate['linkedUsers'] = firebase.firestore.FieldValue.arrayUnion({
    userId: currentUser.uid,
    email: currentUser.email,
    displayName: currentUserData && currentUserData.displayName ? currentUserData.displayName : '',
    linkedAt: new Date()
  });
  await db.collection('users').doc(linkData.userId).update(otherUpdate);

  // 标记链接为已接受
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
async function unlinkUser(userId) {
  // 找到要移除的用户对象
  var userToRemove = null;
  if (currentUserData && currentUserData.linkedUsers) {
    for (var i = 0; i < currentUserData.linkedUsers.length; i++) {
      if (currentUserData.linkedUsers[i].userId === userId) {
        userToRemove = currentUserData.linkedUsers[i];
        break;
      }
    }
  }

  if (userToRemove) {
    await db.collection('users').doc(currentUser.uid).update({
      linkedUsers: firebase.firestore.FieldValue.arrayRemove(userToRemove)
    });
  }

  // 从对方列表移除
  var otherUserDoc = await db.collection('users').doc(userId).get();
  var otherUserData = otherUserDoc.data();

  if (otherUserData && otherUserData.linkedUsers) {
    for (var j = 0; j < otherUserData.linkedUsers.length; j++) {
      if (otherUserData.linkedUsers[j].userId === currentUser.uid) {
        await db.collection('users').doc(userId).update({
          linkedUsers: firebase.firestore.FieldValue.arrayRemove(otherUserData.linkedUsers[j])
        });
        break;
      }
    }
  }
}
