// 加载日记列表
async function loadDiaries() {
  var diaryList = document.getElementById('diaryList');

  // 获取我写的日记
  var myDiaries = await db.collection('diaries')
    .where('userId', '==', currentUser.uid)
    .orderBy('date', 'desc')
    .get();

  // 获取分享给我的日记（客户端过滤）
  var allShared = await db.collection('diaries')
    .where('visibility', '==', 'shared')
    .get();
  var sharedDiaries = allShared.docs.filter(function(doc) {
    return doc.data().sharedWith && doc.data().sharedWith.indexOf(currentUser.uid) !== -1;
  });

  // 获取公开日记（客户端过滤）
  var allPublic = await db.collection('diaries')
    .where('visibility', '==', 'public')
    .get();
  var publicDiaries = allPublic.docs;

  var allDiaries = [].concat(myDiaries.docs, sharedDiaries, publicDiaries);
  allDiaries.sort(function(a, b) {
    return b.data().date.toDate() - a.data().date.toDate();
  });

  if (allDiaries.length === 0) {
    diaryList.innerHTML = '<div class="empty-state">还没有日记<br>写下第一篇吧</div>';
    return;
  }

  diaryList.innerHTML = '';

  for (var i = 0; i < allDiaries.length; i++) {
    var doc = allDiaries[i];
    var data = doc.data();
    var authorDoc = await db.collection('users').doc(data.userId).get();
    var authorName = authorDoc.exists ? (authorDoc.data().displayName || authorDoc.data().email) : '未知';

    var date = data.date.toDate();
    var dateStr = date.getFullYear() + '.' + String(date.getMonth() + 1).padStart(2, '0') + '.' + String(date.getDate()).padStart(2, '0');

    var visibilityText = {
      'private': '仅自己可见',
      'shared': '仅分享对象可见',
      'public': '所有人可见'
    }[data.visibility] || '';

    var isMyDiary = data.userId === currentUser.uid;

    var item = document.createElement('div');
    item.className = 'diary-item';
    item.innerHTML = '<div class="diary-item-header"><div><span class="diary-date">' + dateStr + '</span>' + (!isMyDiary ? '<span class="diary-author"> - ' + authorName + '</span>' : '') + '</div><span class="diary-visibility">' + visibilityText + '</span></div><div class="diary-preview">' + escapeHtml(data.content.substring(0, 150)) + (data.content.length > 150 ? '...' : '') + '</div>' + (data.imageUrl ? '<img class="diary-image" src="' + data.imageUrl + '" alt="">' : '');

    (function(diaryId) {
      item.addEventListener('click', function() { showDiaryDetail(diaryId); });
    })(doc.id);

    diaryList.appendChild(item);
  }
}

// 显示日记详情
async function showDiaryDetail(diaryId) {
  var doc = await db.collection('diaries').doc(diaryId).get();
  var data = doc.data();

  var authorDoc = await db.collection('users').doc(data.userId).get();
  var authorName = authorDoc.exists ? (authorDoc.data().displayName || authorDoc.data().email) : '未知';

  var date = data.date.toDate();
  var dateStr = date.getFullYear() + '.' + String(date.getMonth() + 1).padStart(2, '0') + '.' + String(date.getDate()).padStart(2, '0');

  var content = document.getElementById('diaryDetailContent');
  content.innerHTML = '<div class="diary-meta"><span>' + dateStr + '</span><span>' + authorName + '</span></div>' + escapeHtml(data.content) + (data.imageUrl ? '<img src="' + data.imageUrl + '" alt="">' : '');

  document.getElementById('diaryModal').classList.remove('hidden');
}

// 保存日记
async function saveDiary(content, date, visibility, sharedWith, imageFile) {
  var imageUrl = null;

  // 上传图片
  if (imageFile) {
    var ref = storage.ref().child('diary-images/' + currentUser.uid + '/' + Date.now() + '-' + imageFile.name);
    await ref.put(imageFile);
    imageUrl = await ref.getDownloadURL();
  }

  // 保存日记
  await db.collection('diaries').add({
    userId: currentUser.uid,
    content: content,
    date: new Date(date),
    visibility: visibility,
    sharedWith: visibility === 'shared' ? sharedWith : [],
    imageUrl: imageUrl,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  loadDiaries();
  closeWriteModal();
}

// 加载分享用户列表
async function loadShareUsers() {
  var shareList = document.getElementById('shareList');
  shareList.innerHTML = '';

  if (!currentUserData || !currentUserData.linkedUsers || !currentUserData.linkedUsers.length) {
    shareList.innerHTML = '<span style="font-size:13px;color:rgba(255,255,255,0.35)">暂无链接的人</span>';
    return;
  }

  for (var i = 0; i < currentUserData.linkedUsers.length; i++) {
    var user = currentUserData.linkedUsers[i];
    var item = document.createElement('label');
    item.className = 'share-item';
    item.innerHTML = '<input type="checkbox" value="' + user.userId + '"><span>' + (user.displayName || user.email) + '</span>';
    shareList.appendChild(item);
  }
}

// HTML 转义
function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
