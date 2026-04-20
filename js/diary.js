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

// 用户合集
var userCollections = [];

// 用户缓存
var userCache = {};

// 加载用户标签和合集
async function loadUserTags() {
  try {
    var userDoc = await db.collection('users').doc(currentUser.uid).get();
    if (userDoc.exists) {
      if (userDoc.data().tags) {
        userTags = userDoc.data().tags;
      }
      if (userDoc.data().collections) {
        userCollections = userDoc.data().collections;
      } else {
        userCollections = [];
      }
    } else {
      await db.collection('users').doc(currentUser.uid).update({
        tags: DEFAULT_TAGS,
        collections: []
      });
    }
  } catch (e) {
    userTags = DEFAULT_TAGS.slice();
    userCollections = [];
  }
}

// 渲染标签选项
function renderTagOptions(selectedTagId) {
  var container = document.getElementById('tagOptions');
  if (!container) return;

  container.innerHTML = '';
  for (var i = 0; i < userTags.length; i++) {
    var tag = userTags[i];
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tag-select-btn' + (tag.id === selectedTagId ? ' selected' : '');
    btn.dataset.tagId = tag.id;
    btn.dataset.tagColor = tag.color;
    var isSelected = tag.id === selectedTagId;
    btn.style.cssText = 'padding:6px 14px;background:' + (isSelected ? tag.color : tag.color + '33') + ';border:2px solid ' + tag.color + ';border-radius:15px;color:' + (isSelected ? '#fff' : tag.color) + ';font-size:13px;cursor:pointer;transition:all 0.2s;';
    btn.textContent = tag.name;

    btn.addEventListener('click', function(tagId) {
      var currentSelected = container.querySelector('.tag-select-btn.selected');
      if (currentSelected && currentSelected.dataset.tagId === tagId) {
        // 取消选中
        currentSelected.classList.remove('selected');
        var origColor = currentSelected.dataset.tagColor;
        currentSelected.style.background = origColor + '33';
        currentSelected.style.color = origColor;
      } else {
        // 选中
        container.querySelectorAll('.tag-select-btn').forEach(function(b) {
          b.classList.remove('selected');
          b.style.background = b.dataset.tagColor + '33';
          b.style.color = b.dataset.tagColor;
        });
        this.classList.add('selected');
        this.style.background = this.dataset.tagColor;
        this.style.color = '#fff';
      }
    }.bind(btn, tag.id));

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
    item.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg-tertiary);border-radius:8px;';

    var colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = tag.color;
    colorInput.style.cssText = 'width:36px;height:36px;border:none;cursor:pointer;border-radius:6px;';
    colorInput.addEventListener('input', function(idx) {
      return function(e) {
        userTags[idx].color = e.target.value;
        saveUserTags();
        renderTagManagementList();
        renderTagOptions();
      };
    }(i));

    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = tag.name;
    nameInput.style.cssText = 'flex:1;padding:8px 12px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:14px;font-family:inherit;';
    nameInput.addEventListener('input', function(idx) {
      return function(e) {
        userTags[idx].name = e.target.value;
        saveUserTags();
        renderTagOptions();
      };
    }(i));

    var deleteBtn = document.createElement('button');
    deleteBtn.textContent = '删除';
    deleteBtn.style.cssText = 'padding:6px 12px;background:rgba(255,100,100,0.15);border:1px solid rgba(255,100,100,0.3);border-radius:6px;color:#ff6b6b;font-size:12px;cursor:pointer;';
    deleteBtn.addEventListener('click', function(idx) {
      return function() {
        userTags.splice(idx, 1);
        saveUserTags();
        renderTagManagementList();
        renderTagOptions();
      };
    }(i));

    item.appendChild(colorInput);
    item.appendChild(nameInput);
    item.appendChild(deleteBtn);
    list.appendChild(item);
  }
}

// 添加新标签（从管理弹窗，使用颜色选择器）
function addTagFromModal() {
  var name = prompt('输入标签名称：');
  if (!name || !name.trim()) return;

  var newTag = {
    id: 'tag_' + Date.now(),
    name: name.trim(),
    color: '#7eb8da'
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

// 保存用户合集到 Firestore
async function saveUserCollections() {
  try {
    await db.collection('users').doc(currentUser.uid).update({
      collections: userCollections
    });
  } catch (e) {
    console.error('保存合集失败:', e);
  }
}

// 设置添加标签按钮
function setupAddTag() {
  var addBtn = document.getElementById('addTagBtn');
  if (addBtn) {
    addBtn.style.display = 'none';
  }

  var addBtnModal = document.getElementById('addTagBtnModal');
  if (addBtnModal) {
    addBtnModal.addEventListener('click', addTagFromModal);
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

// 合集管理
function openCollectionModal() {
  document.getElementById('collectionModal').classList.remove('hidden');
  renderCollectionList();
}

function closeCollectionModal() {
  document.getElementById('collectionModal').classList.add('hidden');
}

function renderCollectionList() {
  var list = document.getElementById('collectionList');
  list.innerHTML = '';

  for (var i = 0; i < userCollections.length; i++) {
    var col = userCollections[i];
    var item = document.createElement('div');
    item.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg-tertiary);border-radius:8px;';

    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = col.name;
    nameInput.style.cssText = 'flex:1;padding:8px 12px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:14px;font-family:inherit;';
    nameInput.addEventListener('input', function(idx, val) {
      userCollections[idx].name = val;
      saveUserCollections();
    }.bind(null, i));

    var deleteBtn = document.createElement('button');
    deleteBtn.textContent = '删除';
    deleteBtn.style.cssText = 'padding:6px 12px;background:rgba(255,100,100,0.15);border:1px solid rgba(255,100,100,0.3);border-radius:6px;color:#ff6b6b;font-size:12px;cursor:pointer;';
    deleteBtn.addEventListener('click', function(idx) {
      userCollections.splice(idx, 1);
      saveUserCollections();
      renderCollectionList();
      updateCollectionFilter();
    }.bind(null, i));

    item.appendChild(nameInput);
    item.appendChild(deleteBtn);
    list.appendChild(item);
  }
}

function addCollection() {
  var input = document.getElementById('newCollectionName');
  var name = input.value.trim();
  if (!name) return;

  userCollections.push({
    id: 'col_' + Date.now(),
    name: name
  });
  saveUserCollections();
  input.value = '';
  renderCollectionList();
  updateCollectionFilter();
}

function updateCollectionFilter() {
  var select = document.getElementById('collectionFilter');
  select.innerHTML = '<option value="" style="color:#000;">全部日记</option>';
  for (var i = 0; i < userCollections.length; i++) {
    var opt = document.createElement('option');
    opt.value = userCollections[i].id;
    opt.textContent = userCollections[i].name;
    opt.style.color = '#000';
    select.appendChild(opt);
  }

  var diaryColSelect = document.getElementById('diaryCollection');
  diaryColSelect.innerHTML = '<option value="" style="color:#000;">无</option>';
  for (var j = 0; j < userCollections.length; j++) {
    var opt2 = document.createElement('option');
    opt2.value = userCollections[j].id;
    opt2.textContent = userCollections[j].name;
    opt2.style.color = '#000';
    diaryColSelect.appendChild(opt2);
  }
}

function setupCollectionModal() {
  var collectionsBtn = document.getElementById('collectionsBtn');
  if (collectionsBtn) {
    collectionsBtn.addEventListener('click', openCollectionModal);
  }

  var closeBtn = document.getElementById('closeCollectionModal');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeCollectionModal);
  }

  var addBtn = document.getElementById('addCollectionBtn');
  if (addBtn) {
    addBtn.addEventListener('click', addCollection);
  }

  var filterSelect = document.getElementById('collectionFilter');
  if (filterSelect) {
    filterSelect.addEventListener('change', function() {
      loadDiaries();
    });
  }
}

// 加载日记列表
var currentLoadToken = 0;

async function loadDiaries() {
  var myLoadToken = ++currentLoadToken;

  var diaryList = document.getElementById('diaryList');
  var collectionFilter = document.getElementById('collectionFilter').value;

  try {
    var allDiaries = await db.collection('diaries').get();
    var linkedIds = await getLinkedUserIds();

    if (myLoadToken !== currentLoadToken) return;

    var myDiaries = [];
    for (var i = 0; i < allDiaries.docs.length; i++) {
      var doc = allDiaries.docs[i];
      var data = doc.data();
      var isMine = data.userId === currentUser.uid;
      var isLinkedAndShared = linkedIds.indexOf(data.userId) !== -1 &&
        (data.visibility === 'public' || (data.visibility === 'shared' && data.sharedWith && data.sharedWith.indexOf(currentUser.uid) !== -1));

      if (isMine || isLinkedAndShared) {
        if (collectionFilter && data.collectionId !== collectionFilter) {
          continue;
        }
        myDiaries.push({doc: doc, data: data});
      }
    }

    myDiaries.sort(function(a, b) {
      return b.data.date.toDate() - a.data.date.toDate();
    });

    if (myLoadToken !== currentLoadToken) return;

    if (myDiaries.length === 0) {
      diaryList.innerHTML = '<div class="empty-state">还没有日记<br>写下第一篇吧</div>';
      return;
    }

    diaryList.innerHTML = '';

    // 批量获取所有需要的用户信息
    var userIds = [];
    for (var j = 0; j < myDiaries.length; j++) {
      if (userIds.indexOf(myDiaries[j].data.userId) === -1) {
        userIds.push(myDiaries[j].data.userId);
      }
    }
    var userDocs = {};
    if (userIds.length > 0) {
      var userSnapshot = await db.collection('users').get();
      userSnapshot.docs.forEach(function(userDoc) {
        if (userIds.indexOf(userDoc.id) !== -1) {
          userDocs[userDoc.id] = userDoc.data();
          userCache[userDoc.id] = userDoc.data();
        }
      });
    }

    for (var j = 0; j < myDiaries.length; j++) {
      var itemData = myDiaries[j];
      var doc = itemData.doc;
      var data = itemData.data;
      var userData = userDocs[data.userId];
      var authorName = userData ? (userData.displayName || userData.email) : '未知';

      var date = data.date.toDate();
      var timeStr = data.time || '';
      var dateStr = date.getFullYear() + '.' + String(date.getMonth() + 1).padStart(2, '0') + '.' + String(date.getDate()).padStart(2, '0');
      if (timeStr) {
        dateStr += ' ' + timeStr;
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

      var titleHtml = data.title ? '<div class="diary-title">' + escapeHtml(data.title) + '</div>' : '';

      var item = document.createElement('div');
      item.className = 'diary-item';
      item.innerHTML = '<div class="diary-item-header"><div><span class="diary-date">' + dateStr + '</span>' + (!isMyDiary ? '<span class="diary-author"> - ' + authorName + '</span>' : '') + tagHtml + '</div><span class="diary-visibility">' + visibilityText + '</span></div>' + titleHtml + '<div class="diary-preview">' + escapeHtml(data.content.substring(0, 150)) + (data.content.length > 150 ? '...' : '') + '</div>' + (data.imageUrl ? '<img class="diary-image" src="' + data.imageUrl + '" alt="">' : '');

      (function(diaryId, isMine) {
        item.addEventListener('click', function(e) {
          if (e.target.tagName === 'BUTTON') return;
          showDiaryDetail(diaryId, isMine);
        });
        item.addEventListener('dblclick', function() {
          if (isMine) editDiary(diaryId);
        });
      })(doc.id, isMyDiary);

      diaryList.appendChild(item);
    }
  } catch (e) {
    if (myLoadToken === currentLoadToken) {
      diaryList.innerHTML = '<div class="empty-state">加载失败<br>请刷新重试</div>';
    }
  }
}

// 显示日记详情
async function showDiaryDetail(diaryId, isMine) {
  var doc = await db.collection('diaries').doc(diaryId).get();
  var data = doc.data();

  var userData = userCache[data.userId];
  if (!userData) {
    var authorDoc = await db.collection('users').doc(data.userId).get();
    userData = authorDoc.exists ? authorDoc.data() : null;
    if (userData) userCache[data.userId] = userData;
  }
  var authorName = userData ? (userData.displayName || userData.email) : '未知';

  var date = data.date.toDate();
  var timeStr = data.time || '';
  var dateStr = date.getFullYear() + '.' + String(date.getMonth() + 1).padStart(2, '0') + '.' + String(date.getDate()).padStart(2, '0');
  if (timeStr) {
    dateStr += ' ' + timeStr;
  }

  var tagHtml = '';
  if (data.tagId) {
    var tag = userTags.find(function(t) { return t.id === data.tagId; });
    if (tag) {
      tagHtml = '<span style="display:inline-block;padding:4px 12px;background:' + tag.color + '33;border:1px solid ' + tag.color + ';border-radius:12px;color:' + tag.color + ';font-size:13px;margin-right:10px;">' + tag.name + '</span>';
    }
  }

  var titleHtml = data.title ? '<div class="diary-title-large">' + escapeHtml(data.title) + '</div>' : '';

  var editBtnHtml = isMine ? '<button id="editDiaryBtn" style="margin-top:20px;margin-right:10px;padding:10px 20px;background:var(--accent-light);border:1px solid var(--accent);border-radius:8px;color:var(--accent);cursor:pointer;">编辑</button>' : '';
  var deleteBtnHtml = isMine ? '<button id="deleteDiaryBtn" style="margin-top:20px;padding:10px 20px;background:rgba(255,100,100,0.2);border:1px solid rgba(255,100,100,0.4);border-radius:8px;color:#ff6b6b;cursor:pointer;">删除</button>' : '';

  var content = document.getElementById('diaryDetailContent');
  content.innerHTML = '<div class="diary-meta"><span>' + dateStr + '</span><span>' + authorName + '</span></div>' + titleHtml + tagHtml + '<div class="diary-detail-text">' + escapeHtml(data.content) + '</div>' + (data.imageUrl ? '<img src="' + data.imageUrl + '" alt="" style="max-width:100%;margin-top:20px;border-radius:8px;">' : '') + '<div style="margin-top:15px;">' + editBtnHtml + deleteBtnHtml + '</div>';

  if (isMine) {
    document.getElementById('editDiaryBtn').addEventListener('click', function() {
      editDiary(diaryId);
    });
    document.getElementById('deleteDiaryBtn').addEventListener('click', function() {
      if (confirm('确定要删除这篇日记吗？')) {
        deleteDiary(diaryId);
      }
    });
  }

  document.getElementById('diaryModal').classList.remove('hidden');
}

// 编辑日记
function editDiary(diaryId) {
  document.getElementById('diaryModal').classList.add('hidden');

  db.collection('diaries').doc(diaryId).get().then(function(doc) {
    var data = doc.data();

    document.getElementById('diaryId').value = diaryId;
    document.getElementById('diaryTitle').value = data.title || '';
    document.getElementById('diaryContent').value = data.content;

    var date = data.date.toDate();
    document.getElementById('diaryDate').value = date.toISOString().split('T')[0];
    document.getElementById('diaryTime').value = data.time || '';

    document.getElementById('diaryVisibility').value = data.visibility;
    document.getElementById('diaryCollection').value = data.collectionId || '';

    renderTagOptions(data.tagId);

    document.getElementById('writeModalTitle').textContent = '编辑日记';
    document.getElementById('writeModal').classList.remove('hidden');
  });
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
  var diaryId = document.getElementById('diaryId').value;
  var title = document.getElementById('diaryTitle').value.trim();
  var timeInput = document.getElementById('diaryTime').value;
  var collectionId = document.getElementById('diaryCollection').value;

  var selectedTag = document.querySelector('.tag-select-btn.selected');
  var tagId = selectedTag ? selectedTag.dataset.tagId : null;

  if (imageFile) {
    try {
      imageUrl = await uploadToCloudinary(imageFile);
    } catch (e) {
      console.error('图片上传失败:', e);
    }
  }

  var dateObj = new Date(date);
  if (timeInput) {
    var timeParts = timeInput.split(':');
    dateObj.setHours(parseInt(timeParts[0], 10));
    dateObj.setMinutes(parseInt(timeParts[1], 10));
  }

  var diaryData = {
    title: title,
    content: content,
    date: dateObj,
    time: timeInput,
    visibility: visibility,
    sharedWith: visibility === 'shared' ? sharedWith : [],
    tagId: tagId,
    collectionId: collectionId || null,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (imageUrl) {
    diaryData.imageUrl = imageUrl;
  }

  if (diaryId) {
    await db.collection('diaries').doc(diaryId).update(diaryData);
  } else {
    diaryData.userId = currentUser.uid;
    diaryData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('diaries').add(diaryData);
  }

  loadDiaries();
  closeWriteModal();
}

// 关闭写日记弹窗并重置
function closeWriteModal() {
  document.getElementById('writeModal').classList.add('hidden');
  document.getElementById('diaryId').value = '';
  document.getElementById('writeModalTitle').textContent = '写日记';
  document.getElementById('diaryTitle').value = '';
  document.getElementById('diaryContent').value = '';
  document.getElementById('diaryCollection').value = '';
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