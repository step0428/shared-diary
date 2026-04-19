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
    // 如果用户文档不存在，创建一个
    currentUserData = {
      email: currentUser.email,
      displayName: currentUser.displayName || '',
      linkedUsers: []
    };
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

// 获取我的已接受链接（作为创建者或接受者）
async function getAcceptedLinks() {
  // 查找我创建的被接受的链接
  var created = await db.collection('links')
    .where('userId', '==', currentUser.uid)
    .where('accepted', '==', true)
    .get();

  // 查找我接受的链接（我是acceptedBy）
  var accepted = await db.collection('links')
    .where('acceptedBy', '==', currentUser.uid)
    .where('accepted', '==', true)
    .get();

  return [].concat(created.docs, accepted.docs);
}

// 处理链接
async function acceptLink(linkId) {
  // 更新链接状态
  await db.collection('links').doc(linkId).update({
    accepted: true,
    acceptedBy: currentUser.uid
  });

  // 重新加载已链接用户
  await loadLinkedUsers();
}

// 拒绝链接
async function rejectLink(linkId) {
  await db.collection('links').doc(linkId).delete();
}

// 解除链接
async function unlinkUser(linkId) {
  await db.collection('links').doc(linkId).delete();
  await loadLinkedUsers();
}

// 获取链接用户的信息
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
