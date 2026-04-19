// 认证状态
let currentUser = null;
let currentUserData = null;

// 监听认证状态
auth.onAuthStateChanged(async (user) => {
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
  const doc = await db.collection('users').doc(currentUser.uid).get();
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
  document.getElementById('userName').textContent = currentUserData?.displayName || currentUser.email;
  // 检查链接邀请
  setTimeout(() => window.checkInviteLink(), 500);
}

// 注册
async function register(email, password, displayName) {
  const result = await auth.createUserWithEmailAndPassword(email, password);

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

// 获取我的链接
async function getMyLink() {
  const snapshot = await db.collection('links')
    .where('userId', '==', currentUser.uid)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    return snapshot.docs[0];
  }
  return null;
}

// 创建链接
async function createLink() {
  const linkRef = await db.collection('links').add({
    userId: currentUser.uid,
    userEmail: currentUser.email,
    userDisplayName: currentUserData?.displayName || '',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    accepted: false,
    acceptedBy: null
  });

  return linkRef.id;
}

// 处理链接
async function acceptLink(linkId) {
  const linkDoc = await db.collection('links').doc(linkId).get();
  const linkData = linkDoc.data();

  // 获取对方用户数据
  const otherUserDoc = await db.collection('users').doc(linkData.userId).get();
  const otherUserData = otherUserDoc.data();

  // 添加到我的 linkedUsers
  const myUpdate = {};
  myUpdate['linkedUsers'] = firebase.firestore.FieldValue.arrayUnion({
    userId: linkData.userId,
    email: linkData.userEmail,
    displayName: linkData.userDisplayName,
    linkedAt: new Date()
  });
  await db.collection('users').doc(currentUser.uid).update(myUpdate);

  // 添加到对方的 linkedUsers
  const otherUpdate = {};
  otherUpdate['linkedUsers'] = firebase.firestore.FieldValue.arrayUnion({
    userId: currentUser.uid,
    email: currentUser.email,
    displayName: currentUserData?.displayName || '',
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
  // 从我的列表移除
  await db.collection('users').doc(currentUser.uid).update({
    linkedUsers: firebase.firestore.FieldValue.arrayRemove(
      currentUserData.linkedUsers.find(u => u.userId === userId)
    )
  });

  // 从对方列表移除
  const otherUserDoc = await db.collection('users').doc(userId).get();
  const otherUserData = otherUserDoc.data();

  await db.collection('users').doc(userId).update({
    linkedUsers: firebase.firestore.FieldValue.arrayRemove(
      otherUserData.linkedUsers.find(u => u.userId === currentUser.uid)
    )
  });
}
