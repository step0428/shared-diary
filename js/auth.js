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
function showMainApp() {
  document.getElementById('authPage').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  document.getElementById('userName').textContent = currentUserData && currentUserData.displayName ? currentUserData.displayName : currentUser.email;
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
