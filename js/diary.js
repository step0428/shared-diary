// 获取已链接用户的ID列表
async function getLinkedUserIds() {
  try {
    var acceptedLinks = await getAcceptedLinks();
    var linkedIds = [];
    for (var i = 0; i < acceptedLinks.length; i++) {
      var linkData = acceptedLinks[i].data();
      if (linkData.userId === currentUser.uid) {
        if (linkData.acceptedBy) linkedIds.push(linkData.acceptedBy);
      } else {
        linkedIds.push(linkData.userId);
      }
    }
    return linkedIds;
  } catch (e) {
    return [];
  }
}

// 加载日记列表
async function loadDiaries() {
  var diaryList = document.getElementById('diaryList');

  try {
    // 获取所有日记，在客户端过滤
    var allDiaries = await db.collection('diaries').get();

    var linkedIds = await getLinkedUserIds();

    var myDiaries = [];
    for (var i = 0; i < allDiaries.docs.length; i++) {
      var doc = allDiaries.docs[i];
      var data = doc.data();
      var isMine = data.userId === currentUser.uid;
      var isLinkedAndShared = linkedIds.indexOf(data.userId) !== -1 &&
        (data.visibility === 'public' || (data.visibility === 'shared' && data.sharedWith && data.sharedWith.indexOf(currentUser.uid) !== -1));

      if (isMine || isLinkedAndShared) {
        myDiaries.push({doc: doc, data: data});
      }
    }

    // 按日期排序
    myDiaries.sort(function(a, b) {
      return b.data.date.toDate() - a.data.date.toDate();
    });

    if (myDiaries.length === 0) {
      diaryList.innerHTML = '<div class="empty-state">还没有日记<br>写下第一篇吧</div>';
      return;
    }

    diaryList.innerHTML = '';

    for (var j = 0; j < myDiaries.length; j++) {
      var itemData = myDiaries[j];
      var doc = itemData.doc;
      var data = itemData.data;
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
  } catch (e) {
    diaryList.innerHTML = '<div class="empty-state">加载失败<br>请刷新重试</div>';
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

  if (imageFile) {
    var ref = storage.ref().child('diary-images/' + currentUser.uid + '/' + Date.now() + '-' + imageFile.name);
    await ref.put(imageFile);
    imageUrl = await ref.getDownloadURL();
  }

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

  var linkedIds = await getLinkedUserIds();

  if (linkedIds.length === 0) {
    shareList.innerHTML = '<span style="font-size:13px;color:rgba(255,255,255,0.35)">暂无链接的人</span>';
    return;
  }

  for (var i = 0; i < linkedIds.length; i++) {
    var userId = linkedIds[i];
    var userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      var userData = userDoc.data();
      var item = document.createElement('label');
      item.className = 'share-item';
      item.innerHTML = '<input type="checkbox" value="' + userId + '"><span>' + (userData.displayName || userData.email) + '</span>';
      shareList.appendChild(item);
    }
  }
}

// HTML 转义
function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
