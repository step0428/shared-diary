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
  select.innerHTML = '<option value="" style="color:#000;">全部记录</option>';
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

// 加载记录列表
var currentLoadToken = 0;
var currentDiaryFilter = 'all'; // 'all' | 'mine' | userId

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
      var isCoAuthor = data.coAuthors && data.coAuthors.indexOf(currentUser.uid) !== -1;
      var isLinkedAndShared = linkedIds.indexOf(data.userId) !== -1 &&
        (data.visibility === 'public' || (data.visibility === 'shared' && data.sharedWith && data.sharedWith.indexOf(currentUser.uid) !== -1));

      // 按过滤器判断是否显示
      var showDiary = false;
      if (currentDiaryFilter === 'all') {
        showDiary = isMine || isLinkedAndShared || isCoAuthor;
      } else if (currentDiaryFilter === 'mine') {
        showDiary = isMine;
      } else if (currentDiaryFilter === 'co-authored') {
        showDiary = isCoAuthor;
      } else {
        // 指定用户 - 包括该用户的共享记录和共建记录
        showDiary = (data.userId === currentDiaryFilter && isLinkedAndShared) || (data.coAuthors && data.coAuthors.indexOf(currentDiaryFilter) !== -1);
      }

      if (!showDiary) continue;

      if (collectionFilter && data.collectionId !== collectionFilter) {
        continue;
      }
      myDiaries.push({doc: doc, data: data});
    }

    myDiaries.sort(function(a, b) {
      return b.data.date.toDate() - a.data.date.toDate();
    });

    if (myLoadToken !== currentLoadToken) return;

    if (myDiaries.length === 0) {
      diaryList.innerHTML = '<div class="empty-state">还没有记录<br>写下第一篇吧</div>';
      return;
    }

    diaryList.innerHTML = '';

    // 批量获取所有需要的用户信息
    var userIds = [];
    for (var j = 0; j < myDiaries.length; j++) {
      var data = myDiaries[j].data;
      if (userIds.indexOf(data.userId) === -1) {
        userIds.push(data.userId);
      }
      // 也收集共建参与者ID
      if (data.coAuthors && data.coAuthors.length > 0) {
        for (var ci = 0; ci < data.coAuthors.length; ci++) {
          if (userIds.indexOf(data.coAuthors[ci]) === -1) {
            userIds.push(data.coAuthors[ci]);
          }
        }
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
      var authorAvatar = userData && userData.avatarUrl ? userData.avatarUrl : '';
      var isMyDiary = data.userId === currentUser.uid;
      var isCoAuthored = data.visibility === 'co-authored' && data.coAuthors && data.coAuthors.length > 0;

      // 作者头像HTML（共建记录显示所有参与者头像）
      var authorAvatarHtml = '';
      if (isCoAuthored) {
        // 共建记录：发起人在上，其他共建者在下
        var creatorUid = data.userId;
        var creatorData = userDocs[creatorUid];
        var creatorName = creatorData ? (creatorData.displayName || creatorData.email || '?') : '?';
        var creatorAvatar = creatorData && creatorData.avatarUrl || '';
        var creatorHtml = creatorAvatar
          ? '<img src="' + creatorAvatar + '" style="width:16px;height:16px;border-radius:50%;object-fit:cover;margin-right:2px;" title="' + escapeHtml(creatorName) + '">'
          : '<span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:var(--accent);font-size:9px;color:#fff;margin-right:2px;" title="' + escapeHtml(creatorName) + '">' + creatorName.charAt(0).toUpperCase() + '</span>';

        var othersHtml = '';
        for (var ci = 0; ci < data.coAuthors.length; ci++) {
          var coUid = data.coAuthors[ci];
          if (coUid === creatorUid) continue;
          var coUserData = userDocs[coUid];
          if (coUserData) {
            var caname = coUserData.displayName || coUserData.email || '?';
            var caavatar = coUserData.avatarUrl || '';
            if (caavatar) {
              othersHtml += '<img src="' + caavatar + '" style="width:16px;height:16px;border-radius:50%;object-fit:cover;margin-right:2px;" title="' + escapeHtml(caname) + '">';
            } else {
              othersHtml += '<span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:var(--accent);font-size:9px;color:#fff;margin-right:2px;" title="' + escapeHtml(caname) + '">' + caname.charAt(0).toUpperCase() + '</span>';
            }
          }
        }
        authorAvatarHtml = '<div style="display:flex;align-items:center;gap:2px;flex-wrap:wrap;">' + creatorHtml + othersHtml + '</div>';
      } else {
        if (authorAvatar) {
          authorAvatarHtml = '<img src="' + authorAvatar + '" style="width:16px;height:16px;border-radius:50%;object-fit:cover;margin-right:4px;">';
        } else {
          authorAvatarHtml = '<span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:var(--accent);font-size:9px;color:#fff;margin-right:4px;">' + authorName.charAt(0).toUpperCase() + '</span>';
        }
      }

      var date = data.date.toDate();
      var timeStr = data.time || '';
      var dateStr = date.getFullYear() + '.' + String(date.getMonth() + 1).padStart(2, '0') + '.' + String(date.getDate()).padStart(2, '0');
      if (timeStr) {
        dateStr += ' ' + timeStr;
      }

      var visibilityText = {
        'private': '仅自己可见',
        'shared': '仅链接对象可见',
        'public': '所有人可见',
        'co-authored': '共建记录'
      }[data.visibility] || '';

      var tagHtml = '';
      if (data.tagId) {
        var tag = userTags.find(function(t) { return t.id === data.tagId; });
        if (tag) {
          tagHtml = '<span style="display:inline-block;padding:3px 10px;background:' + tag.color + '33;border:1px solid ' + tag.color + ';border-radius:10px;color:' + tag.color + ';font-size:11px;margin-left:8px;">' + tag.name + '</span>';
        }
      }

      var titleHtml = data.title ? '<div class="diary-title">' + escapeHtml(data.title) + '</div>' : '';

      var imageHtml = '';
      var imageCount = data.imageUrls ? data.imageUrls.length : (data.imageUrl ? 1 : 0);
      if (imageCount > 0) {
        imageHtml = '<div class="diary-image-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:10px;">';
        var urls = data.imageUrls || [data.imageUrl];
        var displayCount = Math.min(urls.length, 9);
        for (var i = 0; i < displayCount; i++) {
          imageHtml += '<img src="' + urls[i] + '" alt="" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:4px;cursor:pointer;" onclick="openImageViewer(\'' + urls[i] + '\')">';
        }
        if (urls.length > 9) {
          imageHtml += '<div style="display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.1);border-radius:4px;color:rgba(255,255,255,0.6);font-size:12px;">+' + (urls.length - 9) + '</div>';
        }
        imageHtml += '</div>';
      }

      var item = document.createElement('div');
      item.className = 'diary-item';
      item.dataset.id = doc.id;
      var checkboxHtml = isMyDiary ? '<input type="checkbox" class="diary-checkbox" style="margin-right:10px;cursor:pointer;display:none;">' : '';
      item.innerHTML = '<div class="diary-item-header"><div style="display:flex;align-items:center;">' + checkboxHtml + '<div><span class="diary-date">' + dateStr + '</span><span class="diary-author" style="display:inline-flex;align-items:center;margin-left:8px;vertical-align:middle;">' + authorAvatarHtml + ((isCoAuthored || isMyDiary) ? '' : authorName) + '</span>' + tagHtml + '</div></div><span class="diary-visibility">' + visibilityText + '</span></div>' + titleHtml + '<div class="diary-preview">' + escapeHtml(data.content.substring(0, 150)) + (data.content.length > 150 ? '...' : '') + '</div>' + imageHtml;

      var isCoAuthor = data.coAuthors && data.coAuthors.indexOf(currentUser.uid) !== -1;
      (function(diaryId, isMine, isCoAuthor) {
        item.addEventListener('click', function(e) {
          if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
          showDiaryDetail(diaryId, isMine, isCoAuthor);
        });
        item.addEventListener('dblclick', function() {
          if (isMine) editDiary(diaryId);
        });
      })(doc.id, isMyDiary, isCoAuthor);

      diaryList.appendChild(item);
    }
  } catch (e) {
    if (myLoadToken === currentLoadToken) {
      diaryList.innerHTML = '<div class="empty-state">加载失败<br>请刷新重试</div>';
    }
  }
}

// 显示记录详情
async function showDiaryDetail(diaryId, isMine, isCoAuthor) {
  var doc = await db.collection('diaries').doc(diaryId).get();
  var data = doc.data();

  var userData = userCache[data.userId];
  if (!userData) {
    var authorDoc = await db.collection('users').doc(data.userId).get();
    userData = authorDoc.exists ? authorDoc.data() : null;
    if (userData) userCache[data.userId] = userData;
  }
  var authorName = userData ? (userData.displayName || userData.email) : '未知';
  var authorAvatar = userData && userData.avatarUrl ? userData.avatarUrl : '';

  // 显示作者头像和名称
  var authorHtml = '';
  if (data.visibility === 'co-authored' && data.coAuthors && data.coAuthors.length > 0) {
    // 共建记录：发起人单独一行，其他共建者在下面
    var authorPromises = data.coAuthors.map(function(uid) {
      return db.collection('users').doc(uid).get();
    });
    var authorDocs = await Promise.all(authorPromises);

    var creatorDoc = authorDocs.find(function(ad) { return ad.id === data.userId; });
    var otherDocs = authorDocs.filter(function(ad) { return ad.id !== data.userId; });

    var creatorHtml = '';
    var othersHtml = '';

    if (creatorDoc && creatorDoc.exists) {
      var cdata = creatorDoc.data();
      var cname = cdata.displayName || cdata.email || '未知';
      var cavatar = cdata.avatarUrl || '';
      if (cavatar) {
        creatorHtml = '<img src="' + cavatar + '" style="width:20px;height:20px;border-radius:50%;object-fit:cover;" title="' + escapeHtml(cname) + '">';
      } else {
        creatorHtml = '<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:var(--accent);font-size:11px;color:#fff;" title="' + escapeHtml(cname) + '">' + cname.charAt(0).toUpperCase() + '</span>';
      }
    }

    if (otherDocs.length > 0) {
      var otherAvatars = [];
      for (var oi = 0; oi < otherDocs.length; oi++) {
        var odata = otherDocs[oi].data();
        var oname = odata.displayName || odata.email || '?';
        var oavatar = odata.avatarUrl || '';
        if (oavatar) {
          otherAvatars.push('<img src="' + oavatar + '" style="width:20px;height:20px;border-radius:50%;object-fit:cover;" title="' + escapeHtml(oname) + '">');
        } else {
          otherAvatars.push('<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:var(--accent);font-size:11px;color:#fff;" title="' + escapeHtml(oname) + '">' + oname.charAt(0).toUpperCase() + '</span>');
        }
      }
      othersHtml = otherAvatars.join('');
    }

    authorHtml = '<div style="display:flex;align-items:center;gap:4px;margin-left:8px;margin-top:-20px;">' + creatorHtml + othersHtml + '</div>';
  } else {
    if (authorAvatar) {
      authorHtml = '<div style="display:flex;align-items:center;gap:6px;margin-left:8px;margin-top:-20px;"><img src="' + authorAvatar + '" style="width:20px;height:20px;border-radius:50%;object-fit:cover;"></div>';
    } else {
      authorHtml = '<div style="display:flex;align-items:center;gap:6px;margin-left:8px;margin-top:-20px;"><span style="display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:var(--accent);font-size:11px;color:#fff;">' + authorName.charAt(0).toUpperCase() + '</span></div>';
    }
  }

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

  var imageHtml = '';
  var imageCount = data.imageUrls ? data.imageUrls.length : (data.imageUrl ? 1 : 0);
  if (imageCount > 0) {
    imageHtml = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:20px;">';
    var urls = data.imageUrls || [data.imageUrl];
    for (var i = 0; i < urls.length; i++) {
      imageHtml += '<img src="' + urls[i] + '" alt="" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;cursor:pointer;" onclick="openImageViewer(\'' + urls[i] + '\')">';
    }
    imageHtml += '</div>';
  }

  var content = document.getElementById('diaryDetailContent');
  content.innerHTML = '<div class="diary-meta"><span>' + dateStr + '</span>' + authorHtml + '</div>' + titleHtml + tagHtml + '<div class="diary-detail-text">' + escapeHtml(data.content) + '</div>' + imageHtml + '<div style="margin-top:15px;">' + editBtnHtml + deleteBtnHtml + '</div>';

  if (isMine) {
    document.getElementById('editDiaryBtn').addEventListener('click', function() {
      editDiary(diaryId);
    });
    document.getElementById('deleteDiaryBtn').addEventListener('click', function() {
      if (confirm('确定要删除这篇记录吗？')) {
        deleteDiary(diaryId);
      }
    });
  }

  // 加载评论
  loadComments(diaryId);

  document.getElementById('diaryModal').classList.remove('hidden');
}

// 加载评论
var currentDiaryIdForComment = null;
async function loadComments(diaryId) {
  currentDiaryIdForComment = diaryId;
  var commentsList = document.getElementById('commentsList');
  commentsList.innerHTML = '<div style="font-size:13px;color:var(--text-muted);text-align:center;padding:20px;">加载中...</div>';

  var diaryDoc = await db.collection('diaries').doc(diaryId).get();
  var diaryOwnerId = diaryDoc.exists ? diaryDoc.data().userId : '';

  try {
    var snapshot = await db.collection('comments')
      .where('diaryId', '==', diaryId)
      .get();

    if (snapshot.empty) {
      commentsList.innerHTML = '<div style="font-size:13px;color:var(--text-muted);text-align:center;padding:20px;">暂无评论</div>';
    } else {
      var allDocs = snapshot.docs.sort(function(a, b) {
        var timeA = a.data().createdAt ? a.data().createdAt.toMillis() : 0;
        var timeB = b.data().createdAt ? b.data().createdAt.toMillis() : 0;
        return timeA - timeB;
      });

      commentsList.innerHTML = '';

      // 构建评论映射
      var commentMap = {};
      allDocs.forEach(function(doc) {
        commentMap[doc.id] = doc;
      });

      // 计算评论深度
      function getDepth(commentId, depth) {
        var comment = commentMap[commentId];
        if (!comment || !comment.data().parentCommentId) return depth;
        return getDepth(comment.data().parentCommentId, depth + 1);
      }

      function renderCommentItem(doc) {
        var comment = doc.data();
        var time = comment.createdAt ? comment.createdAt.toDate() : new Date();
        var timeStr = time.getFullYear() + '.' + String(time.getMonth() + 1).padStart(2, '0') + '.' + String(time.getDate()).padStart(2, '0') + ' ' + String(time.getHours()).padStart(2, '0') + ':' + String(time.getMinutes()).padStart(2, '0');
        var avatar = comment.userAvatar || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%2364b4ff" width="100" height="100" rx="50"/><text y="60" x="50" text-anchor="middle" font-size="40" fill="%23fff">?</text></svg>';

        var canDelete = currentUser.uid === diaryOwnerId || currentUser.uid === comment.userId;

        var item = document.createElement('div');
        item.className = 'comment-item';
        item.dataset.commentId = doc.id;
        item.innerHTML = '<img class="comment-avatar" src="' + avatar + '"><div class="comment-body"><div class="comment-header"><span class="comment-author">' + escapeHtml(comment.userDisplayName || '匿名') + '</span><span class="comment-time">' + timeStr + '</span></div><div class="comment-content">' + escapeHtml(comment.content) + '</div><div class="comment-actions"><button class="reply-btn" data-id="' + doc.id + '">回复</button>' + (canDelete ? '<button class="delete-comment-btn" data-id="' + doc.id + '">删除</button>' : '') + '</div></div>';
        return item;
      }

      // 渲染所有评论，扁平结构
      allDocs.forEach(function(doc) {
        var comment = doc.data();
        var depth = getDepth(doc.id, 0);
        var item = renderCommentItem(doc);

        if (depth > 0) {
          item.classList.add('reply-indent');
          item.style.marginLeft = (depth * 40) + 'px';
        }

        commentsList.appendChild(item);
      });
    }
  } catch (e) {
    console.error('评论加载失败:', e);
    commentsList.innerHTML = '<div style="font-size:13px;color:var(--text-muted);text-align:center;padding:20px;">评论加载失败</div>';
  }

  var sendBtn = document.getElementById('sendCommentBtn');
  var input = document.getElementById('commentInput');

  var newSendBtn = sendBtn.cloneNode(true);
  sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
  var newInput = input.cloneNode(true);
  input.parentNode.replaceChild(newInput, input);

  newSendBtn.onclick = function() {
    var content = newInput.value.trim();
    if (!content) return;
    addComment(currentDiaryIdForComment, content, null);
    newInput.value = '';
  };
  newInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      var content = newInput.value.trim();
      if (!content) return;
      addComment(currentDiaryIdForComment, content, null);
      newInput.value = '';
    }
  });

  document.querySelectorAll('.reply-btn').forEach(function(btn) {
    btn.onclick = function() {
      var commentId = this.dataset.id;
      var replyContent = prompt('请输入回复内容:');
      if (replyContent && replyContent.trim()) {
        addComment(currentDiaryIdForComment, replyContent.trim(), commentId);
      }
    };
  });

  document.querySelectorAll('.delete-comment-btn').forEach(function(btn) {
    btn.onclick = async function() {
      var commentId = this.dataset.id;
      if (confirm('确定删除这条评论吗？')) {
        await deleteComment(commentId);
      }
    };
  });
}

// 添加评论或回复
async function addComment(diaryId, content, parentCommentId) {
  try {
    // 获取日记主人ID
    var diaryDoc = await db.collection('diaries').doc(diaryId).get();
    var diaryOwnerId = diaryDoc.exists ? diaryDoc.data().userId : '';

    await db.collection('comments').add({
      diaryId: diaryId,
      diaryOwnerId: diaryOwnerId,
      userId: currentUser.uid,
      userDisplayName: currentUserData && currentUserData.displayName ? currentUserData.displayName : currentUser.email,
      userAvatar: currentUserData && currentUserData.avatarUrl ? currentUserData.avatarUrl : '',
      content: content,
      parentCommentId: parentCommentId || null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    loadComments(diaryId);
  } catch (e) {
    console.error('评论发送失败:', e);
    alert('评论发送失败');
  }
}

// 删除评论
async function deleteComment(commentId) {
  try {
    // 获取评论信息
    var commentDoc = await db.collection('comments').doc(commentId).get();
    if (!commentDoc.exists) return;

    var diaryId = commentDoc.data().diaryId;

    // 删除评论的所有回复
    var repliesSnapshot = await db.collection('comments').where('parentCommentId', '==', commentId).get();
    var batch = db.batch();
    repliesSnapshot.docs.forEach(function(replyDoc) {
      batch.delete(replyDoc.ref);
    });
    batch.delete(commentDoc.ref);
    await batch.commit();

    loadComments(diaryId);
  } catch (e) {
    console.error('删除评论失败:', e);
    alert('删除评论失败');
  }
}

// 编辑记录
function editDiary(diaryId) {
  document.getElementById('diaryModal').classList.add('hidden');

  db.collection('diaries').doc(diaryId).get().then(function(doc) {
    var data = doc.data();

    document.getElementById('diaryId').value = diaryId;
    document.getElementById('diaryTitle').value = data.title || '';
    document.getElementById('diaryContent').value = data.content;

    var date = data.date.toDate();
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    document.getElementById('diaryDate').value = year + '-' + month + '-' + day;
    document.getElementById('diaryTime').value = data.time || '';

    document.getElementById('diaryVisibility').value = data.visibility;
    document.getElementById('diaryCollection').value = data.collectionId || '';

    // 处理共建记录
    var coAuthors = data.coAuthors || [];
    if (coAuthors.length > 0) {
      document.getElementById('coAuthorCheck').checked = true;
      document.getElementById('coAuthorsHint').style.display = 'block';
      document.getElementById('coAuthorsList').style.display = 'flex';
    } else {
      document.getElementById('coAuthorCheck').checked = false;
      document.getElementById('coAuthorsHint').style.display = 'none';
      document.getElementById('coAuthorsList').style.display = 'none';
    }

    // 处理共享选中
    var shareSelectRow = document.getElementById('shareSelectRow');
    shareSelectRow.classList.toggle('hidden', data.visibility !== 'shared');

    renderTagOptions(data.tagId);

    // 加载共享用户并选中已选的
    loadShareUsers().then(function() {
      var sharedWith = data.sharedWith || [];
      sharedWith.forEach(function(userId) {
        var checkbox = document.querySelector('#shareList input[value="' + userId + '"]');
        if (checkbox) {
          checkbox.checked = true;
          checkbox.closest('.share-item').classList.add('selected');
        }
      });
    });

    // 加载共建用户并选中已选的
    loadCoAuthors().then(function() {
      coAuthors.forEach(function(userId) {
        if (userId !== currentUser.uid) {
          var checkbox = document.querySelector('#coAuthorsList input[value="' + userId + '"]');
          if (checkbox) {
            checkbox.checked = true;
            checkbox.closest('.share-item').classList.add('selected');
          }
        }
      });
    });

    document.getElementById('writeModalTitle').textContent = '编辑记录';
    document.getElementById('writeModal').classList.remove('hidden');
  });
}

// 删除记录
async function deleteDiary(diaryId) {
  await db.collection('diaries').doc(diaryId).delete();
  document.getElementById('diaryModal').classList.add('hidden');
  loadDiaries();
}

// Cloudinary 配置
var CLOUDINARY_CLOUD_NAME = 'dx21h5ymk';
var CLOUDINARY_API_KEY = '529277918461595';
var CLOUDINARY_API_SECRET = 'BR-RJPnOP2ECageGJbQAhawCBDY';

// 上传图片到 Cloudinary（带重试）
async function uploadToCloudinary(file, retryCount) {
  if (!retryCount) retryCount = 0;
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
        reject(new Error('Upload failed: ' + xhr.status));
      }
    };

    xhr.onerror = function() {
      if (retryCount < 2) {
        setTimeout(function() {
          uploadToCloudinary(file, retryCount + 1).then(resolve).catch(reject);
        }, 1000);
      } else {
        reject(new Error('Network error'));
      }
    };

    xhr.send(formData);
  });
}

// 保存记录
async function saveDiary(content, date, visibility, sharedWith, imageFiles, coAuthors) {
  var imageUrls = null;
  var diaryId = document.getElementById('diaryId').value;
  var title = document.getElementById('diaryTitle').value.trim();
  var timeInput = document.getElementById('diaryTime').value;
  var collectionId = document.getElementById('diaryCollection').value;

  var selectedTag = document.querySelector('.tag-select-btn.selected');
  var tagId = selectedTag ? selectedTag.dataset.tagId : null;

  if (imageFiles && imageFiles.length > 0) {
    try {
      var uploadPromises = [];
      for (var i = 0; i < imageFiles.length; i++) {
        uploadPromises.push(uploadToCloudinary(imageFiles[i]));
      }
      imageUrls = await Promise.all(uploadPromises);
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

  // 如果是共建记录，添加共建者
  if (coAuthors && coAuthors.length > 0) {
    diaryData.coAuthors = coAuthors;
  }

  if (imageUrls && imageUrls.length > 0) {
    diaryData.imageUrls = imageUrls;
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

// 关闭写记录弹窗并重置
function closeWriteModal() {
  document.getElementById('writeModal').classList.add('hidden');
  document.getElementById('diaryId').value = '';
  document.getElementById('writeModalTitle').textContent = '写记录';
  document.getElementById('diaryTitle').value = '';
  document.getElementById('diaryContent').value = '';
  document.getElementById('diaryCollection').value = '';
  document.getElementById('diaryImage').value = '';
  document.getElementById('imagePreview').innerHTML = '';
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
      var checkbox = item.querySelector('input');
      checkbox.addEventListener('change', function() {
        this.closest('.share-item').classList.toggle('selected', this.checked);
      });
      shareList.appendChild(item);
    }
  }
}

async function loadCoAuthors() {
  var coAuthorsList = document.getElementById('coAuthorsList');
  coAuthorsList.innerHTML = '';

  var linkedIds = await getLinkedUserIds();

  if (linkedIds.length === 0) {
    coAuthorsList.innerHTML = '<span style="font-size:13px;color:var(--text-muted);">暂无链接的人</span>';
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
      var checkbox = item.querySelector('input');
      checkbox.addEventListener('change', function() {
        this.closest('.share-item').classList.toggle('selected', this.checked);
      });
      coAuthorsList.appendChild(item);
    }
  }
}

// HTML 转义
function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}