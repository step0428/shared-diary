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

// 默认标签
var DEFAULT_TAGS = [
  { id: 'daily', name: '日常', color: '#7eb8da' },
  { id: 'work', name: '工作', color: '#da7e7e' },
  { id: 'mood', name: '心情', color: '#7eda7e' }
];

// 用户标签
var userTags = DEFAULT_TAGS.slice();

// 加载用户标签
async function loadUserTags() {
  try {
    var userDoc = await db.collection('users').doc(currentUser.uid).get();
    if (userDoc.exists && userDoc.data().tags) {
      userTags = userDoc.data().tags;
    } else {
      await db.collection('users').doc(currentUser.uid).update({
        tags: DEFAULT_TAGS
      });
    }
  } catch (e) {
    userTags = DEFAULT_TAGS.slice();
  }
}

// 渲染标签选项
function renderTagOptions() {
  var container = document.getElementById('tagOptions');
  if (!container) return;

  container.innerHTML = '';
  for (var i = 0; i < userTags.length; i++) {
    var tag = userTags[i];
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tag-select-btn';
    btn.dataset.tagId = tag.id;
    btn.style.cssText = 'padding:6px 14px;background:' + tag.color + '33;border:2px solid ' + tag.color + ';border-radius:15px;color:' + tag.color + ';font-size:13px;cursor:pointer;transition:all 0.2s;';
    btn.textContent = tag.name;

    btn.addEventListener('click', function() {
      var allBtns = container.querySelectorAll('.tag-select-btn');
      allBtns.forEach(function(b) { b.classList.remove('selected'); b.style.background = b.style.borderColor + '33'; });
      this.classList.add('selected');
      this.style.background = this.style.borderColor;
    });

    container.appendChild(btn);
  }
}

// 打开标签管理弹窗
function openTagModal() {
  document.getElementById('tagModal').classList.remove('hidden');
  renderTagManagementList();
}

// 关闭标签管理弹窗
function closeTagModal() {
  document.getElementById('tagModal').classList.add('hidden');
}

// 渲染标签管理列表
function renderTagManagementList() {
  var list = document.getElementById('tagManagementList');
  list.innerHTML = '';

  for (var i = 0; i < userTags.length; i++) {
    var tag = userTags[i];
    var item = document.createElement('div');
    item.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px;background:rgba(255,255,255,0.03);border-radius:8px;';

    var colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = tag.color;
    colorInput.style.cssText = 'width:36px;height:36px;border:none;cursor:pointer;border-radius:6px;';
    colorInput.addEventListener('change', function(idx, val) {
      userTags[idx].color = val;
      saveUserTags();
      renderTagManagementList();
      renderTagOptions();
    }.bind(null, i));

    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = tag.name;
    nameInput.style.cssText = 'flex:1;padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:rgba(255,255,255,0.9);font-size:14px;font-family:inherit;';
    nameInput.addEventListener('change', function(idx, val) {
      userTags[idx].name = val;
      saveUserTags();
      renderTagOptions();
    }.bind(null, i));

    var deleteBtn = document.createElement('button');
    deleteBtn.textContent = '删除';
    deleteBtn.style.cssText = 'padding:6px 12px;background:rgba(255,100,100,0.2);border:1px solid rgba(255,100,100,0.4);border-radius:6px;color:rgba(255,255,255,0.8);font-size:12px;cursor:pointer;';
    deleteBtn.addEventListener('click', function(idx) {
      userTags.splice(idx, 1);
      saveUserTags();
      renderTagManagementList();
      renderTagOptions();
    }.bind(null, i));

    item.appendChild(colorInput);
    item.appendChild(nameInput);
    item.appendChild(deleteBtn);
    list.appendChild(item);
  }
}

// 添加新标签（从管理弹窗）
function addTagFromModal() {
  var name = prompt('输入标签名称：');
  if (!name || !name.trim()) return;

  var color = prompt('输入标签颜色（英文，如 red, blue, #ff0000）：') || '#7eb8da';

  var newTag = {
    id: 'tag_' + Date.now(),
    name: name.trim(),
    color: color.trim()
  };

  userTags.push(newTag);
  saveUserTags();
  renderTagManagementList();
  renderTagOptions();
}

// 保存用户标签到 Firestore
async function saveUserTags() {
  try {
    await db.collection('users').doc(currentUser.uid).update({
      tags: userTags
    });
  } catch (e) {
    console.error('保存标签失败:', e);
  }
}

// 设置添加标签按钮
function setupAddTag() {
  var addBtn = document.getElementById('addTagBtn');
  if (addBtn) {
    addBtn.addEventListener('click', addTagFromModal);
  }

  var manageBtn = document.getElementById('manageTagsBtn');
  if (manageBtn) {
    manageBtn.addEventListener('click', openTagModal);
  }

  var closeTagBtn = document.getElementById('closeTagModal');
  if (closeTagBtn) {
    closeTagBtn.addEventListener('click', closeTagModal);
  }
}

// 加载日记列表
async function loadDiaries() {
  var diaryList = document.getElementById('diaryList');

  try {
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
      var timeStr = data.time || '';
      var dateStr = date.getFullYear() + '.' + String(date.getMonth() + 1).padStart(2, '0') + '.' + String(date.getDate()).padStart(2, '0');
      if (timeStr) {
        var hours = String(date.getHours()).padStart(2, '0');
        var mins = String(date.getMinutes()).padStart(2, '0');
        dateStr += ' ' + hours + ':' + mins;
      }

      var visibilityText = {
        'private': '仅自己可见',
        'shared': '仅分享对象可见',
        'public': '所有人可见'
      }[data.visibility] || '';

      var isMyDiary = data.userId === currentUser.uid;

      var tagHtml = '';
      if (data.tagId) {
        var tag = userTags.find(function(t) { return t.id === data.tagId; });
        if (tag) {
          tagHtml = '<span style="display:inline-block;padding:3px 10px;background:' + tag.color + '33;border:1px solid ' + tag.color + ';border-radius:10px;color:' + tag.color + ';font-size:11px;margin-left:8px;">' + tag.name + '</span>';
        }
      }

      var titleHtml = data.title ? '<div style="font-size:16px;color:rgba(255,255,255,0.95);margin-bottom:8px;">' + escapeHtml(data.title) + '</div>' : '';

      var item = document.createElement('div');
      item.className = 'diary-item';
      item.innerHTML = '<div class="diary-item-header"><div><span class="diary-date">' + dateStr + '</span>' + (!isMyDiary ? '<span class="diary-author"> - ' + authorName + '</span>' : '') + tagHtml + '</div><span class="diary-visibility">' + visibilityText + '</span></div>' + titleHtml + '<div class="diary-preview">' + escapeHtml(data.content.substring(0, 150)) + (data.content.length > 150 ? '...' : '') + '</div>' + (data.imageUrl ? '<img class="diary-image" src="' + data.imageUrl + '" alt="">' : '');

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
  var timeStr = data.time || '';
  var dateStr = date.getFullYear() + '.' + String(date.getMonth() + 1).padStart(2, '0') + '.' + String(date.getDate()).padStart(2, '0');
  if (timeStr) {
    var hours = String(date.getHours()).padStart(2, '0');
    var mins = String(date.getMinutes()).padStart(2, '0');
    dateStr += ' ' + hours + ':' + mins;
  }

  var isMyDiary = data.userId === currentUser.uid;

  var tagHtml = '';
  if (data.tagId) {
    var tag = userTags.find(function(t) { return t.id === data.tagId; });
    if (tag) {
      tagHtml = '<span style="display:inline-block;padding:4px 12px;background:' + tag.color + '33;border:1px solid ' + tag.color + ';border-radius:12px;color:' + tag.color + ';font-size:13px;margin-right:10px;">' + tag.name + '</span>';
    }
  }

  var titleHtml = data.title ? '<div style="font-size:22px;color:rgba(255,255,255,0.95);margin-bottom:15px;">' + escapeHtml(data.title) + '</div>' : '';

  var deleteBtnHtml = isMyDiary ? '<button class="diary-delete-btn" id="diaryDeleteBtn" style="margin-top:20px;padding:10px 20px;background:rgba(255,100,100,0.2);border:1px solid rgba(255,100,100,0.4);border-radius:8px;color:rgba(255,255,255,0.9);cursor:pointer;">删除日记</button>' : '';

  var content = document.getElementById('diaryDetailContent');
  content.innerHTML = '<div class="diary-meta"><span>' + dateStr + '</span><span>' + authorName + '</span></div>' + titleHtml + tagHtml + '<div style="margin-top:20px;line-height:2;font-size:15px;">' + escapeHtml(data.content) + '</div>' + (data.imageUrl ? '<img src="' + data.imageUrl + '" alt="" style="max-width:100%;margin-top:20px;border-radius:8px;">' : '') + deleteBtnHtml;

  var deleteBtn = document.getElementById('diaryDeleteBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', function() {
      if (confirm('确定要删除这篇日记吗？')) {
        deleteDiary(diaryId);
      }
    });
  }

  document.getElementById('diaryModal').classList.remove('hidden');
}

// 删除日记
async function deleteDiary(diaryId) {
  await db.collection('diaries').doc(diaryId).delete();
  document.getElementById('diaryModal').classList.add('hidden');
  loadDiaries();
}

// Cloudinary 配置
var CLOUDINARY_CLOUD_NAME = 'dx21h5ymk';
var CLOUDINARY_API_KEY = '529277918461595';
var CLOUDINARY_API_SECRET = 'BR-RJPnOP2ECageGJbQAhawCBDY';

// 上传图片到 Cloudinary
async function uploadToCloudinary(file) {
  return new Promise(function(resolve, reject) {
    var formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'ml_default');

    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD_NAME + '/image/upload');

    xhr.onload = function() {
      if (xhr.status === 200) {
        var response = JSON.parse(xhr.responseText);
        resolve(response.secure_url);
      } else {
        reject(new Error('Upload failed'));
      }
    };

    xhr.onerror = function() {
      reject(new Error('Network error'));
    };

    xhr.send(formData);
  });
}

// 保存日记
async function saveDiary(content, date, visibility, sharedWith, imageFile) {
  var imageUrl = null;
  var title = document.getElementById('diaryTitle').value.trim();
  var timeInput = document.getElementById('diaryTime').value;

  var selectedTagId = null;
  var selectedTag = document.querySelector('.tag-select-btn.selected');
  if (selectedTag) {
    selectedTagId = selectedTag.dataset.tagId;
  }

  if (imageFile) {
    try {
      imageUrl = await uploadToCloudinary(imageFile);
    } catch (e) {
      console.error('图片上传失败:', e);
    }
  }

  // 处理日期和时间
  var dateObj = new Date(date);
  if (timeInput) {
    var timeParts = timeInput.split(':');
    dateObj.setHours(parseInt(timeParts[0], 10));
    dateObj.setMinutes(parseInt(timeParts[1], 10));
  }

  await db.collection('diaries').add({
    userId: currentUser.uid,
    title: title,
    content: content,
    date: dateObj,
    time: timeInput,
    visibility: visibility,
    sharedWith: visibility === 'shared' ? sharedWith : [],
    tagId: selectedTagId,
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
