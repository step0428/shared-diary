// 通用用户头像渲染函数
function renderUserAvatar(userData, size, marginRight, title) {
  marginRight = marginRight || '4px';
  let titleAttr = title ? ' title="' + escapeHtml(title) + '"' : '';
  if (userData && userData.avatarUrl) {
    return '<img src="' + userData.avatarUrl + '" style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;object-fit:cover;margin-right:' + marginRight + ';"' + titleAttr + '>';
  } else if (userData && userData.userId === AI_COMPANION_USER_ID) { // AI 助手的特殊头像
    return '<span style="display:inline-flex;align-items:center;justify-content:center;width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:#8e44ad;font-size:' + Math.floor(size * 0.6) + 'px;color:#fff;margin-right:' + marginRight + ';"' + titleAttr + '>🤖</span>';
  } else {
    let name = userData ? (userData.displayName || userData.email || '?') : '?';
    return '<span style="display:inline-flex;align-items:center;justify-content:center;width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:var(--accent);font-size:' + Math.floor(size * 0.6) + 'px;color:#fff;margin-right:' + marginRight + ';"' + titleAttr + '>' + name.charAt(0).toUpperCase() + '</span>';
  }
}
// 判断日记是否对当前用户可见（并结合侧边栏过滤）
function isDiaryVisible(diaryData, currentUserId, linkedUserIds, filtersArray, options) {
  options = options || {};
  var checkAcceptance = options.checkAcceptance || false;

  if (!filtersArray || filtersArray.length === 0) return false; // 什么都没勾选时，什么都不展示

  let isMine = diaryData.userId === currentUserId;
  let isCoAuthor = diaryData.coAuthors && diaryData.coAuthors.indexOf(currentUserId) !== -1;

  if (checkAcceptance && isCoAuthor && !isMine) {
    let isAccepted = diaryData.acceptedCoAuthors && diaryData.acceptedCoAuthors.indexOf(currentUserId) !== -1;
    if (!isAccepted) isCoAuthor = false;
  }

  let isLinkedAndShared = linkedUserIds.indexOf(diaryData.userId) !== -1 &&
    (diaryData.visibility === 'public' || (diaryData.visibility === 'shared' && diaryData.sharedWith && diaryData.sharedWith.indexOf(currentUserId) !== -1));

  // 1. 基础权限：必须对我可见才能展示
  let visibleToMe = isMine || isCoAuthor || isLinkedAndShared;
  if (!visibleToMe) return false;

  // 2. 侧边栏多选过滤
  let matchesFilter = false;
  for (let i = 0; i < filtersArray.length; i++) {
    let filter = filtersArray[i];
    if (filter === 'mine') {
      if (isMine || isCoAuthor) {
        matchesFilter = true;
        break;
      }
    } else {
      // 筛选指定好友：是他创建的，或者他参与共建的
      let theyAreCreator = diaryData.userId === filter;
      let theyAreCoAuthor = diaryData.coAuthors && diaryData.coAuthors.indexOf(filter) !== -1;
      if (theyAreCreator || theyAreCoAuthor) {
        matchesFilter = true;
        break;
      }
    }
  }
  return matchesFilter;
}


// 获取已链接用户的ID列表
async function getLinkedUserIds() {
  try {
    let acceptedLinks = await getAcceptedLinks();
    let linkedIds = [];
    for (let i = 0; i < acceptedLinks.length; i++) {
      let linkData = acceptedLinks[i].data();
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
let DEFAULT_TAGS = [
  { id: 'daily', name: '日常', color: '#7eb8da' },
  { id: 'work', name: '工作', color: '#da7e7e' },
  { id: 'mood', name: '心情', color: '#7eda7e' }
];

// 用户标签
let userTags = DEFAULT_TAGS.slice();

// 用户合集
let userCollections = [];

// 用户缓存
let userCache = {};

// 加载用户标签和合集
async function loadUserTags() {
  try {
    let userDoc = await db.collection('users').doc(currentUser.uid).get();
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
  let container = document.getElementById('tagOptions');
  if (!container) return;

  container.innerHTML = '';
  for (let i = 0; i < userTags.length; i++) {
    let tag = userTags[i];
    let btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tag-select-btn' + (tag.id === selectedTagId ? ' selected' : '');
    btn.dataset.tagId = tag.id;
    btn.dataset.tagColor = tag.color;
    let isSelected = tag.id === selectedTagId;
    btn.style.cssText = 'padding:6px 14px;background:' + (isSelected ? tag.color : tag.color + '33') + ';border:2px solid ' + tag.color + ';border-radius:15px;color:' + (isSelected ? '#fff' : tag.color) + ';font-size:13px;cursor:pointer;transition:all 0.2s;';
    btn.textContent = tag.name;

    btn.addEventListener('click', function(tagId) {
      let currentSelected = container.querySelector('.tag-select-btn.selected');
      if (currentSelected && currentSelected.dataset.tagId === tagId) {
        // 取消选中
        currentSelected.classList.remove('selected');
        let origColor = currentSelected.dataset.tagColor;
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
  let list = document.getElementById('tagManagementList');
  list.innerHTML = '';

  for (let i = 0; i < userTags.length; i++) {
    let tag = userTags[i];
    let item = document.createElement('div');
    item.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg-tertiary);border-radius:8px;';

    let colorInput = document.createElement('input');
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

    let nameInput = document.createElement('input');
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

    let deleteBtn = document.createElement('button');
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
  showInputModal('添加标签', '输入标签名称', '', function(name) {
    if (name && name.trim()) {
      let newTag = {
        id: 'tag_' + Date.now(),
        name: name.trim(),
        color: '#7eb8da'
      };

      userTags.push(newTag);
      saveUserTags();
      renderTagManagementList();
      renderTagOptions();
    }
  });
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

// 确保共建者都有某个合集（自动创建不存在的）
async function ensureCollectionForCoAuthors(collectionId, coAuthors) {
  // 获取当前用户的合集中这个合集的信息
  let collection = userCollections.find(function(c) { return c.id === collectionId; });
  if (!collection) return;

  // 遍历所有共建者
  for (let i = 0; i < coAuthors.length; i++) {
    let uid = coAuthors[i];
    if (uid === currentUser.uid) continue; // 跳过自己

    try {
      let userDoc = await db.collection('users').doc(uid).get();
      let userData = userDoc.data();
      let userColls = userData.collections || [];

      // 检查是否已有这个合集
      let exists = userColls.some(function(c) { return c.id === collectionId; });
      if (!exists) {
        // 添加合集
        userColls.push({
          id: collection.id,
          name: collection.name
        });
        await db.collection('users').doc(uid).update({
          collections: userColls
        });
      }
    } catch (e) {
      console.error('为共建者创建合集失败:', e);
    }
  }
}

// 设置添加标签按钮
function setupAddTag() {
  let addBtn = document.getElementById('addTagBtn');
  if (addBtn) {
    addBtn.style.display = 'none';
  }

  let addBtnModal = document.getElementById('addTagBtnModal');
  if (addBtnModal) {
    addBtnModal.addEventListener('click', addTagFromModal);
  }

  let manageBtn = document.getElementById('manageTagsBtn');
  if (manageBtn) {
    manageBtn.addEventListener('click', openTagModal);
  }

  let closeTagBtn = document.getElementById('closeTagModal');
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
  let list = document.getElementById('collectionList');
  list.innerHTML = '';

  for (let i = 0; i < userCollections.length; i++) {
    let col = userCollections[i];
    let item = document.createElement('div');
    item.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg-tertiary);border-radius:8px;';

    let nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = col.name;
    nameInput.style.cssText = 'flex:1;padding:8px 12px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:14px;font-family:inherit;';
    nameInput.addEventListener('input', function(idx, val) {
      userCollections[idx].name = val;
      saveUserCollections();
    }.bind(null, i));

    let deleteBtn = document.createElement('button');
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
  let input = document.getElementById('newCollectionName');
  let name = input.value.trim();
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
  let select = document.getElementById('collectionFilter');
  select.innerHTML = '<option value="" style="color:#000;">全部记录</option>';
  for (let i = 0; i < userCollections.length; i++) {
    let opt = document.createElement('option');
    opt.value = userCollections[i].id;
    opt.textContent = userCollections[i].name;
    opt.style.color = '#000';
    select.appendChild(opt);
  }

  let diaryColSelect = document.getElementById('diaryCollection');
  diaryColSelect.innerHTML = '<option value="" style="color:#000;">无</option>';
  for (let j = 0; j < userCollections.length; j++) {
    let opt2 = document.createElement('option');
    opt2.value = userCollections[j].id;
    opt2.textContent = userCollections[j].name;
    opt2.style.color = '#000';
    diaryColSelect.appendChild(opt2);
  }
}

function setupCollectionModal() {
  let collectionsBtn = document.getElementById('collectionsBtn');
  if (collectionsBtn) {
    collectionsBtn.addEventListener('click', openCollectionModal);
  }

  let closeBtn = document.getElementById('closeCollectionModal');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeCollectionModal);
  }

  let addBtn = document.getElementById('addCollectionBtn');
  if (addBtn) {
    addBtn.addEventListener('click', addCollection);
  }

  let filterSelect = document.getElementById('collectionFilter');
  if (filterSelect) {
    filterSelect.addEventListener('change', function() {
      loadDiaries();
    });
  }
}

// 加载记录列表
let currentLoadToken = 0;
let currentDiaryFilter = 'all'; // 'all' | 'mine' | userId

async function loadDiaries() {
  let myLoadToken = ++currentLoadToken;

  let diaryList = document.getElementById('diaryList');
  let collectionFilter = document.getElementById('collectionFilter').value;

  try {
    let allDiaries = await db.collection('diaries').get();
    let linkedIds = await getLinkedUserIds();

    if (myLoadToken !== currentLoadToken) return;

    let myDiaries = [];
    for (let i = 0; i < allDiaries.docs.length; i++) {
      let doc = allDiaries.docs[i];
      let data = doc.data();
      let isMine = data.userId === currentUser.uid;
      let isCoAuthor = data.coAuthors && data.coAuthors.indexOf(currentUser.uid) !== -1;

      if (!isDiaryVisible(data, currentUser.uid, linkedIds, activeFilters)) continue;

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
    let userIds = [];
    for (let j = 0; j < myDiaries.length; j++) {
      let data = myDiaries[j].data;
      if (userIds.indexOf(data.userId) === -1) {
        userIds.push(data.userId);
      }
      // 也收集共建参与者ID
      if (data.coAuthors && data.coAuthors.length > 0) {
        for (let ci = 0; ci < data.coAuthors.length; ci++) {
          if (userIds.indexOf(data.coAuthors[ci]) === -1) {
            userIds.push(data.coAuthors[ci]);
          }
        }
      }
    }
    let userDocs = {};
    if (userIds.length > 0) {
      let userSnapshot = await db.collection('users').get();
      userSnapshot.docs.forEach(function(userDoc) {
        if (userIds.indexOf(userDoc.id) !== -1) {
          userDocs[userDoc.id] = userDoc.data();
          userCache[userDoc.id] = userDoc.data();
        }
      });
    }

    for (let j = 0; j < myDiaries.length; j++) {
      let itemData = myDiaries[j];
      let doc = itemData.doc;
      let data = itemData.data;
      let userData = userDocs[data.userId];
      let authorName = userData ? (userData.displayName || userData.email) : '未知';
      let authorAvatar = userData && userData.avatarUrl ? userData.avatarUrl : '';
      let isMyDiary = data.userId === currentUser.uid;
      let isCoAuthored = data.visibility === 'co-authored' && data.coAuthors && data.coAuthors.length > 0;

      // 作者头像HTML（共建记录显示所有参与者头像）
      let authorAvatarHtml = '';
      if (isCoAuthored) {
        // 共建记录：发起人在上，其他共建者在下
        let creatorUid = data.userId;
        let creatorData = userDocs[creatorUid];
        let creatorName = creatorData ? (creatorData.displayName || creatorData.email || '?') : '?';
        let creatorAvatar = creatorData && creatorData.avatarUrl || '';
        let creatorHtml = renderUserAvatar(creatorData, 16, '2px');

        let othersHtml = '';
        for (let ci = 0; ci < data.coAuthors.length; ci++) {
          let coUid = data.coAuthors[ci];
          if (coUid === creatorUid) continue;
          let coUserData = userDocs[coUid];
          if (coUserData) {
            let caname = coUserData.displayName || coUserData.email || '?';
            othersHtml += renderUserAvatar(coUserData, 16, '2px');
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

      let date = data.date.toDate();
      let timeStr = data.time || '';
      let dateStr = date.getFullYear() + '.' + String(date.getMonth() + 1).padStart(2, '0') + '.' + String(date.getDate()).padStart(2, '0');
      if (timeStr) {
        dateStr += ' ' + timeStr;
      }

      let visibilityText = {
        'private': '仅自己可见',
        'shared': '仅链接对象可见',
        'public': '所有人可见',
        'co-authored': '共建记录'
      }[data.visibility] || '';

      let tagHtml = '';
      if (data.tagId) {
        let tag = userTags.find(function(t) { return t.id === data.tagId; });
        if (tag) {
          tagHtml = '<span style="display:inline-block;padding:3px 10px;background:' + tag.color + '33;border:1px solid ' + tag.color + ';border-radius:10px;color:' + tag.color + ';font-size:11px;margin-left:8px;">' + tag.name + '</span>';
        }
      }

      let titleHtml = data.title ? '<div class="diary-title">' + escapeHtml(data.title) + '</div>' : '';

      let imageHtml = '';
      let imageCount = data.imageUrls ? data.imageUrls.length : (data.imageUrl ? 1 : 0);
      if (imageCount > 0) {
        imageHtml = '<div class="diary-image-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:10px;">';
        let urls = data.imageUrls || [data.imageUrl];
        let displayCount = Math.min(urls.length, 9);
        for (let i = 0; i < displayCount; i++) {
          imageHtml += '<img src="' + urls[i] + '" alt="" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:4px;cursor:pointer;" onclick="openImageViewer(\'' + urls[i] + '\')">';
        }
        if (urls.length > 9) {
          imageHtml += '<div style="display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.1);border-radius:4px;color:rgba(255,255,255,0.6);font-size:12px;">+' + (urls.length - 9) + '</div>';
        }
        imageHtml += '</div>';
      }
      let audioIndicator = data.audioUrl ? '<div style="margin-top:8px;color:let(--text-muted);font-size:12px;">🎵 语音</div>' : '';

      let isPendingCoAuthor = isCoAuthored && !isMyDiary && (!data.acceptedCoAuthors || data.acceptedCoAuthors.indexOf(currentUser.uid) === -1);
      let pendingHtml = '';
      if (isPendingCoAuthor) {
        pendingHtml = '<div style="margin-top:15px;padding-top:15px;border-top:1px dashed var(--border);display:flex;justify-content:space-between;align-items:center;">' +
          '<span style="font-size:13px;color:var(--accent);">好友邀请你共建此记录</span>' +
          '<div style="display:flex;gap:10px;">' +
            '<button class="reject-co-btn" style="padding:6px 16px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:15px;color:var(--text-secondary);font-size:12px;cursor:pointer;">拒绝</button>' +
            '<button class="accept-co-btn" style="padding:6px 16px;background:var(--accent-light);border:1px solid var(--accent);border-radius:15px;color:var(--accent);font-size:12px;cursor:pointer;">接受</button>' +
          '</div></div>';
      }

      let item = document.createElement('div');
      item.className = 'diary-item-wrapper';
      item.dataset.id = doc.id;
      item.style.cssText = 'position:relative; margin-bottom:15px; border-radius:12px; overflow:hidden; border:1px solid var(--border);';

      let checkboxHtml = isMyDiary ? '<input type="checkbox" class="diary-checkbox" style="margin-right:10px;cursor:pointer;display:none;">' : '';
      let moodHtml = data.mood ? '<span style="font-size:16px;margin-left:8px;vertical-align:middle;" title="心情">' + data.mood + '</span>' : '';
      let innerHtml = '<div class="diary-item-header"><div style="display:flex;align-items:center;">' + checkboxHtml + '<div><span class="diary-date">' + dateStr + '</span>' + moodHtml + '<span class="diary-author" style="display:inline-flex;align-items:center;margin-left:8px;vertical-align:middle;">' + authorAvatarHtml + ((isCoAuthored || isMyDiary) ? '' : authorName) + '</span>' + tagHtml + '</div></div><span class="diary-visibility">' + visibilityText + '</span></div>' + titleHtml + '<div class="diary-preview">' + escapeHtml(data.content.substring(0, 150)) + (data.content.length > 150 ? '...' : '') + '</div>' + imageHtml + audioIndicator + pendingHtml;

      // 滑动删除底色按钮层
      let swipeActionHtml = isMyDiary ? '<div class="swipe-delete-btn" style="position:absolute; right:0; top:0; bottom:0; width:80px; background:#ff6b6b; color:#fff; display:flex; align-items:center; justify-content:center; z-index:1; cursor:pointer; font-size:14px; font-weight:bold; opacity:0; transition:opacity 0.2s;">删除</div>' : '';

      // 可滑动的表面内容层
      item.innerHTML = swipeActionHtml + '<div class="diary-item-content diary-item" style="margin-bottom:0; border:none; width:100%; box-sizing:border-box; position:relative; z-index:2; transition:transform 0.3s ease; border-radius:12px; background:var(--bg-secondary);">' + innerHtml + '</div>';

      let isCoAuthor = data.coAuthors && data.coAuthors.indexOf(currentUser.uid) !== -1;
      let contentEl = item.querySelector('.diary-item-content');
      let deleteBtn = item.querySelector('.swipe-delete-btn');

      if (deleteBtn) {
        deleteBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          if (confirm('确定要删除这篇记录吗？')) deleteDiary(doc.id);
        });
      }

      (function(diaryId, isMine, isCoAuthor, isPending) {
        if (isPending) {
          contentEl.querySelector('.accept-co-btn').addEventListener('click', async function(e) {
            e.stopPropagation();
            await db.collection('diaries').doc(diaryId).update({ acceptedCoAuthors: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
            loadDiaries();
            if (typeof refreshCalendar === 'function') refreshCalendar();
          });
          contentEl.querySelector('.reject-co-btn').addEventListener('click', async function(e) {
            e.stopPropagation();
            await db.collection('diaries').doc(diaryId).update({ coAuthors: firebase.firestore.FieldValue.arrayRemove(currentUser.uid), acceptedCoAuthors: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
            loadDiaries();
          });
        }
        contentEl.addEventListener('click', function(e) {
          if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'IMG') return;
          if (isPending) { alert('请先接受共建邀请后再查看详情'); return; }
          // 如果处于左滑拉开的状态，点击仅恢复原状
          if (contentEl.style.transform === 'translateX(-80px)') {
            contentEl.style.transform = 'translateX(0)';
            if (deleteBtn) deleteBtn.style.opacity = '0';
            return;
          }
          showDiaryDetail(diaryId, isMine, isCoAuthor);
        });
        contentEl.addEventListener('dblclick', function() {
          if (isPending) return;
          if (isMine) editDiary(diaryId);
        });

        // 移动端手势左滑删除
        if (isMine) {
          let startX = 0, currentX = 0, isSwiping = false;
          let startY = 0, currentY = 0; // 用于判断是否是垂直滚动
          let isDragging = false; // 标记手指是否按下并开始拖动
          const TAP_THRESHOLD = 10; // 区分点击和滑动的阈值（像素）

          contentEl.addEventListener('touchstart', function(e) {
            if(e.touches.length > 1) return;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isDragging = true;
            isSwiping = false;
            contentEl.style.transition = 'none';
          }, {passive: true});

          contentEl.addEventListener('touchmove', function(e) {
            if (!isDragging) return;
            currentX = e.touches[0].clientX;
            currentY = e.touches[0].clientY;
            let dx = currentX - startX;
            let dy = currentY - startY;

            if (!isSwiping) {
              if (Math.abs(dx) > TAP_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
                isSwiping = true;
                if (deleteBtn) deleteBtn.style.opacity = '1'; // 只有确认在左滑时才显示红色底板
                if (e.cancelable) e.preventDefault(); // 阻止默认的滚动行为
              } else if (Math.abs(dy) > TAP_THRESHOLD) {
                isDragging = false;
                contentEl.style.transform = 'translateX(0)';
                if (deleteBtn) deleteBtn.style.opacity = '0';
                return;
              }
            }

            if (isSwiping) {
              if (e.cancelable) e.preventDefault(); // 持续阻止默认滚动
              if (dx < 0) { // 只允许向左滑动
                contentEl.style.transform = 'translateX(' + Math.max(dx, -90) + 'px)';
              } else { // 向右滑动则复位
                contentEl.style.transform = 'translateX(0)';
              }
            }
          }, {passive: false}); // passive: false 允许调用 preventDefault

          contentEl.addEventListener('touchend', function(e) {
            if (!isDragging) return; // 如果之前被判断为滚动，则不处理
            isDragging = false;
            contentEl.style.transition = 'transform 0.3s ease';

            if (isSwiping && currentX - startX < -40) { // 确认是滑动且滑动距离足够
              contentEl.style.transform = 'translateX(-80px)';
              if (deleteBtn) deleteBtn.style.opacity = '1';
              // 自动关闭其他打开的滑块
              document.querySelectorAll('.diary-item-content').forEach(function(el) {
                if (el !== contentEl) {
                  el.style.transform = 'translateX(0)';
                  let siblingBtn = el.previousElementSibling;
                  if (siblingBtn && siblingBtn.classList.contains('swipe-delete-btn')) siblingBtn.style.opacity = '0';
                }
              });
            } else {
              contentEl.style.transform = 'translateX(0)';
              if (deleteBtn) deleteBtn.style.opacity = '0'; // 滑回原位时隐藏
            }
          });
        }
      })(doc.id, isMyDiary, isCoAuthor, isPendingCoAuthor);

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
  let doc = await db.collection('diaries').doc(diaryId).get();
  let data = doc.data();

  let userData = userCache[data.userId];
  if (!userData) {
    let authorDoc = await db.collection('users').doc(data.userId).get();
    userData = authorDoc.exists ? authorDoc.data() : null;
    if (userData) userCache[data.userId] = userData;
  }
  let authorName = userData ? (userData.displayName || userData.email) : '未知';
  let authorAvatar = userData && userData.avatarUrl ? userData.avatarUrl : '';

  // 显示作者头像和名称
  let authorHtml = '';
  if (data.visibility === 'co-authored' && data.coAuthors && data.coAuthors.length > 0) {
    // 共建记录：发起人单独一行，其他共建者在下面
    let authorPromises = data.coAuthors.map(function(uid) {
      return db.collection('users').doc(uid).get();
    });
    let authorDocs = await Promise.all(authorPromises);

    let creatorDoc = authorDocs.find(function(ad) { return ad.id === data.userId; });
    let otherDocs = authorDocs.filter(function(ad) { return ad.id !== data.userId; });

    let creatorHtml = '';
    let othersHtml = '';

    if (creatorDoc && creatorDoc.exists) {
      let cdata = creatorDoc.data();
      let cname = cdata.displayName || cdata.email || '未知';
      creatorHtml = renderUserAvatar(cdata, 20, '', cname);
    }

    if (otherDocs.length > 0) {
      let otherAvatars = [];
      for (let oi = 0; oi < otherDocs.length; oi++) {
        let odata = otherDocs[oi].data();
        let oname = odata.displayName || odata.email || '?';
        otherAvatars.push(renderUserAvatar(odata, 20, '', oname));
      }
      othersHtml = otherAvatars.join('');
    }

    authorHtml = '<div style="display:flex;align-items:center;gap:4px;margin-left:8px;margin-top:-20px;">' + creatorHtml + othersHtml + '</div>';
  } else {
    authorHtml = '<div style="display:flex;align-items:center;gap:6px;margin-left:8px;margin-top:-20px;">' + renderUserAvatar(userData, 20, '0') + '</div>';
  }

  let date = data.date.toDate();
  let timeStr = data.time || '';
  let dateStr = date.getFullYear() + '.' + String(date.getMonth() + 1).padStart(2, '0') + '.' + String(date.getDate()).padStart(2, '0');
  if (timeStr) {
    dateStr += ' ' + timeStr;
  }

  let tagHtml = '';
  if (data.tagId) {
    let tag = userTags.find(function(t) { return t.id === data.tagId; });
    if (tag) {
      tagHtml = '<span style="display:inline-block;padding:4px 12px;background:' + tag.color + '33;border:1px solid ' + tag.color + ';border-radius:12px;color:' + tag.color + ';font-size:13px;margin-right:10px;">' + tag.name + '</span>';
    }
  }

  let moodHtml = data.mood ? '<span style="font-size:28px;margin-right:10px;vertical-align:middle;">' + data.mood + '</span>' : '';
  let titleHtml = data.title ? '<div class="diary-title-large">' + moodHtml + escapeHtml(data.title) + '</div>' : (data.mood ? '<div class="diary-title-large">' + moodHtml + '</div>' : '');

  let editBtnHtml = isMine ? '<button id="editDiaryBtn" style="margin-top:20px;margin-right:10px;padding:10px 20px;background:let(--accent-light);border:1px solid var(--accent);border-radius:8px;color:var(--accent);cursor:pointer;">编辑</button>' : '';
  let deleteBtnHtml = isMine ? '<button id="deleteDiaryBtn" style="margin-top:20px;padding:10px 20px;background:rgba(255,100,100,0.2);border:1px solid rgba(255,100,100,0.4);border-radius:8px;color:#ff6b6b;cursor:pointer;">删除</button>' : '';

  let askAICommentBtn = '<button id="askAICommentBtn" style="margin-top:20px;padding:10px 20px;background:var(--accent-light);border:1px solid var(--accent);border-radius:8px;color:var(--accent);cursor:pointer;font-size:14px;margin-left:10px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:5px;"><path d="M12 8V4H8"></path><path d="M16 16.24L12 20V16.24"></path><path d="M15.34 15.34L18.66 18.66"></path><path d="M7.34 7.34L4 4"></path><path d="M12 12H12.01"></path><path d="M12 12L16 8"></path><path d="M12 12L8 16"></path><path d="M12 12L15.34 15.34"></path><path d="M12 12L7.34 7.34"></path></svg>让AI评论</button>';

  let imageHtml = '';
  let imageCount = data.imageUrls ? data.imageUrls.length : (data.imageUrl ? 1 : 0);
  if (imageCount > 0) {
    imageHtml = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:20px;">';
    let urls = data.imageUrls || [data.imageUrl];
    for (let i = 0; i < urls.length; i++) {
      imageHtml += '<img src="' + urls[i] + '" alt="" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;cursor:pointer;" onclick="openImageViewer(\'' + urls[i] + '\')">';
    }
    imageHtml += '</div>';
  }

  let audioHtml = '';
  if (data.audioUrl) {
    audioHtml = '<div style="margin-top:15px;background:var(--bg-tertiary);padding:15px;border-radius:12px;display:flex;flex-direction:column;gap:10px;align-items:center;">' +
      '<canvas id="audioVisualizer" width="300" height="60" style="width:100%;max-width:400px;height:60px;border-radius:8px;background:rgba(0,0,0,0.05);"></canvas>' +
      '<audio id="diaryAudioPlayer" src="' + data.audioUrl + '" controls crossorigin="anonymous" style="width:100%;max-width:400px;outline:none;"></audio>' +
      '</div>';
  }

  let contentEl = document.getElementById('diaryDetailContent');
  contentEl.innerHTML = '<div class="diary-meta"><span>' + dateStr + '</span>' + authorHtml + '</div>' + titleHtml + tagHtml + '<div class="diary-detail-text">' + escapeHtml(data.content) + '</div>' + imageHtml + audioHtml + '<div style="margin-top:15px;display:flex;justify-content:flex-end;">' + editBtnHtml + deleteBtnHtml + askAICommentBtn + '</div>';

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

  if (document.getElementById('askAICommentBtn')) {
    document.getElementById('askAICommentBtn').addEventListener('click', function() { askAIToComment(diaryId, data.content); });
  }

  // 加载评论
  loadComments(diaryId);

  if (data.audioUrl) {
    setTimeout(function() {
      setupAudioVisualizer('diaryAudioPlayer', 'audioVisualizer');
    }, 50);
  }

  document.getElementById('diaryModal').classList.remove('hidden');
}

// 通用音频波形可视化初始化函数
function setupAudioVisualizer(audioId, canvasId) {
  var audio = document.getElementById(audioId);
  var canvas = document.getElementById(canvasId);
  if (!audio || !canvas) return;

  // 清理之前绑定在这个音频元素上的上下文，防止卡死和内存泄漏
  if (audio._audioCtx) {
    try { audio._audioCtx.close(); } catch(e) {}
    audio._audioCtx = null;
  }

  var ctx = canvas.getContext('2d');
  var barWidth = (canvas.width / 64) * 1.5;
  
  var accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#64b4ff';

  // 画一条默认安静状态的随机起伏线作为占位
  function drawQuietState() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = accentColor;
    ctx.globalAlpha = 0.3;
    var x = 0;
    for (var i = 0; i < 64; i++) {
      var h = Math.random() * 4 + 2;
      ctx.fillRect(x, canvas.height / 2 - h / 2, barWidth, h);
      x += barWidth + 2;
    }
  }
  drawQuietState();

  var analyser, dataArray, bufferLength, animationId;

  audio.addEventListener('play', function() {
    if (!audio._audioCtx) {
      audio._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audio._audioCtx.createAnalyser();
      try {
        var audioSource = audio._audioCtx.createMediaElementSource(audio);
        audioSource.connect(analyser);
        analyser.connect(audio._audioCtx.destination);
      } catch(e) {
        console.error("Web Audio API error:", e);
      }
      analyser.fftSize = 128;
      bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
    }
    if (audio._audioCtx.state === 'suspended') {
      audio._audioCtx.resume();
    }
    visualize();
  });

  audio.addEventListener('pause', function() {
    cancelAnimationFrame(animationId);
    drawQuietState();
  });
  
  audio.addEventListener('ended', function() {
    cancelAnimationFrame(animationId);
    drawQuietState();
  });

  function visualize() {
    if (audio.paused) return;
    animationId = requestAnimationFrame(visualize);
    if (analyser && dataArray) {
      analyser.getByteFrequencyData(dataArray);
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var currentX = 0;
    for (var i = 0; i < (bufferLength || 64); i++) {
      var val = dataArray ? dataArray[i] : (Math.random() * 30);
      var barHeight = (val / 255) * canvas.height * 0.8;
      if (barHeight < 2) barHeight = 2;
      ctx.fillStyle = accentColor;
      ctx.globalAlpha = 0.7 + (barHeight / canvas.height) * 0.3;
      ctx.fillRect(currentX, canvas.height / 2 - barHeight / 2, barWidth, barHeight); // 对称居中绘制
      currentX += barWidth + 2;
    }
  }
}

// 加载评论
let currentDiaryIdForComment = null;
async function loadComments(diaryId) {
  currentDiaryIdForComment = diaryId;
  let commentsList = document.getElementById('commentsList');
  commentsList.innerHTML = '<div style="font-size:13px;color:let(--text-muted);text-align:center;padding:20px;">加载中...</div>';

  let diaryDoc = await db.collection('diaries').doc(diaryId).get();
  let diaryOwnerId = diaryDoc.exists ? diaryDoc.data().userId : '';

  try {
    let snapshot = await db.collection('comments')
      .where('diaryId', '==', diaryId)
      .get();

    if (snapshot.empty) {
      commentsList.innerHTML = '<div style="font-size:13px;color:let(--text-muted);text-align:center;padding:20px;">暂无评论</div>';
    } else {
      let allDocs = snapshot.docs.sort(function(a, b) {
        let timeA = a.data().createdAt ? a.data().createdAt.toMillis() : 0;
        let timeB = b.data().createdAt ? b.data().createdAt.toMillis() : 0;
        return timeA - timeB;
      });

      commentsList.innerHTML = '';

      // 构建评论映射
      let commentMap = {};
      allDocs.forEach(function(doc) {
        commentMap[doc.id] = doc;
      });

      // 预计算所有评论深度（迭代方式）
      let depthMap = {};
      allDocs.forEach(function(doc) {
        let depth = 0;
        let currentId = doc.id;
        let visited = new Set();
        while (currentId) {
          if (visited.has(currentId)) break; // 防止循环引用
          visited.add(currentId);
          let comment = commentMap[currentId];
          if (!comment || !comment.data().parentCommentId) break;
          currentId = comment.data().parentCommentId;
          depth++;
        }
        depthMap[doc.id] = depth;
      });

      function renderCommentItem(doc) {
        let comment = doc.data();
        let time = comment.createdAt ? comment.createdAt.toDate() : new Date();
        let timeStr = time.getFullYear() + '.' + String(time.getMonth() + 1).padStart(2, '0') + '.' + String(time.getDate()).padStart(2, '0') + ' ' + String(time.getHours()).padStart(2, '0') + ':' + String(time.getMinutes()).padStart(2, '0');
        let commentAuthorInfo = { userId: comment.userId, displayName: comment.userDisplayName, avatarUrl: comment.userAvatar };
        let avatarHtml = renderUserAvatar(commentAuthorInfo, 32);

        let canDelete = currentUser.uid === diaryOwnerId || currentUser.uid === comment.userId;

        let item = document.createElement('div');
        item.className = 'comment-item';
        item.dataset.commentId = doc.id;
        item.innerHTML = avatarHtml + '<div class="comment-body"><div class="comment-header"><span class="comment-author">' + escapeHtml(comment.userDisplayName || '匿名') + '</span><span class="comment-time">' + timeStr + '</span></div><div class="comment-content">' + escapeHtml(comment.content) + '</div><div class="comment-actions"><button class="reply-btn" data-id="' + doc.id + '">回复</button>' + (canDelete ? '<button class="delete-comment-btn" data-id="' + doc.id + '">删除</button>' : '') + '</div></div>';
        return item;
      }

      // 渲染所有评论，扁平结构
      allDocs.forEach(function(doc) {
        let comment = doc.data();
        let depth = depthMap[doc.id] || 0;
        let item = renderCommentItem(doc);

        if (depth > 0) {
          item.classList.add('reply-indent');
          item.style.marginLeft = (depth * 40) + 'px';
        }

        commentsList.appendChild(item);
      });
    }
  } catch (e) {
    console.error('评论加载失败:', e);
    commentsList.innerHTML = '<div style="font-size:13px;color:let(--text-muted);text-align:center;padding:20px;">评论加载失败</div>';
  }

  let sendBtn = document.getElementById('sendCommentBtn');
  let input = document.getElementById('commentInput');

  let newSendBtn = sendBtn.cloneNode(true);
  sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
  let newInput = input.cloneNode(true);
  input.parentNode.replaceChild(newInput, input);

  newSendBtn.onclick = function() {
    let content = newInput.value.trim();
    if (!content) return;
    addComment(currentDiaryIdForComment, content, null);
    newInput.value = '';
  };
  newInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      let content = newInput.value.trim();
      if (!content) return;
      addComment(currentDiaryIdForComment, content, null);
      newInput.value = '';
    }
  });

  document.querySelectorAll('.reply-btn').forEach(function(btn) {
    btn.onclick = function() {
      let commentId = this.dataset.id;
      showInputModal('回复', '请输入回复内容', '', function(replyContent) {
        if (replyContent && replyContent.trim()) {
          addComment(currentDiaryIdForComment, replyContent.trim(), commentId, currentUser.uid, currentUserData.displayName, currentUserData.avatarUrl);
        }
      });
    };
  });

  document.querySelectorAll('.delete-comment-btn').forEach(function(btn) {
    btn.onclick = async function() {
      let commentId = this.dataset.id;
      if (confirm('确定删除这条评论吗？')) {
        await deleteComment(commentId);
      }
    };
  });
}

// 添加评论或回复
async function addComment(diaryId, content, parentCommentId, authorId, authorDisplayName, authorAvatar) {
  try {
    // 获取日记主人ID
    let diaryDoc = await db.collection('diaries').doc(diaryId).get();
    let diaryOwnerId = diaryDoc.exists ? diaryDoc.data().userId : '';

    await db.collection('comments').add({
      diaryId: diaryId,
      diaryOwnerId: diaryOwnerId,
      userId: authorId || currentUser.uid,
      userDisplayName: authorDisplayName || (currentUserData && currentUserData.displayName ? currentUserData.displayName : currentUser.email),
      userAvatar: authorAvatar || (currentUserData && currentUserData.avatarUrl ? currentUserData.avatarUrl : ''),
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

// AI 评论功能
async function askAIToComment(diaryId, diaryContent) {
  const askAICommentBtn = document.getElementById('askAICommentBtn');
  const originalBtnText = askAICommentBtn.innerHTML;
  askAICommentBtn.disabled = true;
  askAICommentBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin-anim" style="vertical-align:middle;margin-right:5px;"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path></svg>AI思考中...';

  try {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const userData = userDoc.data();
    const aiApiKey = userData.aiApiKey;
    const aiPersonaName = userData.aiPersonaName || 'AI 助手';
    const aiPersonaPrompt = userData.aiPersonaPrompt || '你是一个温柔体贴的日记助手，会根据日记内容给出积极的评论和鼓励。';

    if (!aiApiKey || aiApiKey.length < 10) { // Basic check for API key validity
      alert('请先在用户菜单 -> AI 助手设置中配置有效的 OpenAI API Key！');
      return;
    }

    const systemMessage = {
      role: "system",
      content: aiPersonaPrompt
    };

    const userMessage = {
      role: "user",
      content: `这是一篇日记内容：\n\n"${diaryContent}"\n\n请你以${aiPersonaName}的身份，对这篇日记发表一句简短的评论，字数控制在50字以内，语气要符合你的人设。`
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo", // 可以根据需要更换模型，如 "gpt-4o"
        messages: [systemMessage, userMessage],
        max_tokens: 150, // 限制回复长度
        temperature: 0.7 // 创造性
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API Error:', errorData);
      throw new Error(`AI 评论失败: ${errorData.error.message || response.statusText}`);
    }

    const data = await response.json();
    const aiCommentContent = data.choices[0].message.content.trim();

    // 保存 AI 的评论
    await addComment(diaryId, aiCommentContent, null, AI_COMPANION_USER_ID, aiPersonaName, 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%238e44ad" width="100" height="100" rx="50"/><text y="60" x="50" text-anchor="middle" font-size="40" fill="%23fff">🤖</text></svg>');

    loadComments(diaryId); // 重新加载评论列表
  } catch (e) {
    console.error('请求 AI 评论失败:', e);
    alert(e.message || '请求 AI 评论失败，请检查网络或 API Key。');
  } finally {
    askAICommentBtn.innerHTML = originalBtnText;
    askAICommentBtn.disabled = false;
  }
}

// 删除评论
async function deleteComment(commentId) {
  try {
    // 获取评论信息
    let commentDoc = await db.collection('comments').doc(commentId).get();
    if (!commentDoc.exists) return;

    let diaryId = commentDoc.data().diaryId;

    // 删除评论的所有回复
    let repliesSnapshot = await db.collection('comments').where('parentCommentId', '==', commentId).get();
    let batch = db.batch();
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
    let data = doc.data();

    document.getElementById('diaryId').value = diaryId;
    document.getElementById('diaryTitle').value = data.title || '';
    document.getElementById('diaryContent').value = data.content;

    document.querySelectorAll('.mood-option').forEach(function(el) { el.classList.remove('selected'); });
    if (data.mood) {
      let moodEl = document.querySelector('.mood-option[data-mood="' + data.mood + '"]');
      if (moodEl) moodEl.classList.add('selected');
    }

    let date = data.date.toDate();
    let year = date.getFullYear();
    let month = String(date.getMonth() + 1).padStart(2, '0');
    let day = String(date.getDate()).padStart(2, '0');
    document.getElementById('diaryDate').value = year + '-' + month + '-' + day;
    document.getElementById('diaryTime').value = data.time || '';

    document.getElementById('diaryVisibility').value = data.visibility;
    document.getElementById('diaryCollection').value = data.collectionId || '';

    // 处理共建记录
    let coAuthors = data.coAuthors || [];
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
    let shareSelectRow = document.getElementById('shareSelectRow');
    shareSelectRow.classList.toggle('hidden', data.visibility !== 'shared');

    renderTagOptions(data.tagId);

        // 加载用户复选框并记录原始状态
        Promise.all([
          loadShareUsers().then(function() {
            let sharedWith = data.sharedWith || [];
            sharedWith.forEach(function(userId) {
              let checkbox = document.querySelector('#shareList input[value="' + userId + '"]');
              if (checkbox) {
                checkbox.checked = true;
                checkbox.closest('.share-item').classList.add('selected');
              }
            });
          }),
          loadCoAuthors().then(function() {
            coAuthors.forEach(function(userId) {
              if (userId !== currentUser.uid) {
                let checkbox = document.querySelector('#coAuthorsList input[value="' + userId + '"]');
                if (checkbox) {
                  checkbox.checked = true;
                  checkbox.closest('.share-item').classList.add('selected');
                }
              }
            });
          })
        ]).then(function() {
          if (typeof getDiaryFormState === 'function') {
            window.currentDiaryFormOriginalState = getDiaryFormState();
          }
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

// 上传文件到 Cloudinary（支持图片和音频）
async function uploadToCloudinary(file, retryCount) {
  if (!retryCount) retryCount = 0;
  return new Promise(function(resolve, reject) {
    let formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'ml_default');

    // 根据文件类型选择上传路径
    let resourceType = 'auto';
    if (file.type.startsWith('image/')) {
      resourceType = 'image';
    } else if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
      resourceType = 'video';
    }

    let xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD_NAME + '/' + resourceType + '/upload');

    xhr.onload = function() {
      if (xhr.status === 200) {
        let response = JSON.parse(xhr.responseText);
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
async function saveDiary(content, date, visibility, sharedWith, imageFiles, coAuthors, audioFile) {
  let imageUrls = null;
  let audioUrl = null;
  let diaryId = document.getElementById('diaryId').value;
  let title = document.getElementById('diaryTitle').value.trim();
  let timeInput = document.getElementById('diaryTime').value;
  let collectionId = document.getElementById('diaryCollection').value;

  let selectedMoodEl = document.querySelector('.mood-option.selected');
  let mood = selectedMoodEl ? selectedMoodEl.dataset.mood : null;

  let selectedTag = document.querySelector('.tag-select-btn.selected');
  let tagId = selectedTag ? selectedTag.dataset.tagId : null;

  if (imageFiles && imageFiles.length > 0) {
    try {
      let uploadPromises = [];
      for (let i = 0; i < imageFiles.length; i++) {
        uploadPromises.push(uploadToCloudinary(imageFiles[i]));
      }
      imageUrls = await Promise.all(uploadPromises);
    } catch (e) {
      console.error('图片上传失败:', e);
    }
  }

  // 上传音频
  if (audioFile) {
    try {
      audioUrl = await uploadToCloudinary(audioFile);
    } catch (e) {
      console.error('音频上传失败:', e);
    }
  }

  let dateObj = new Date(date);
  if (timeInput) {
    let timeParts = timeInput.split(':');
    dateObj.setHours(parseInt(timeParts[0], 10));
    dateObj.setMinutes(parseInt(timeParts[1], 10));
  }

  let diaryData = {
    title: title,
    content: content,
    date: dateObj,
    time: timeInput,
    visibility: visibility,
    sharedWith: visibility === 'shared' ? sharedWith : [],
    mood: mood,
    tagId: tagId,
    collectionId: collectionId || null,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  // 如果是共建记录，添加共建者
  if (coAuthors && coAuthors.length > 0) {
    diaryData.coAuthors = coAuthors;
    if (diaryId) {
      diaryData.acceptedCoAuthors = firebase.firestore.FieldValue.arrayUnion(currentUser.uid);
    } else {
      diaryData.acceptedCoAuthors = [currentUser.uid];
    }

    // 如果有合集，自动给所有共建者创建这个合集
    if (collectionId) {
      await ensureCollectionForCoAuthors(collectionId, coAuthors);
    }
  } else {
    if (diaryId) {
      diaryData.coAuthors = firebase.firestore.FieldValue.delete();
      diaryData.acceptedCoAuthors = firebase.firestore.FieldValue.delete();
    }
  }

  if (imageUrls && imageUrls.length > 0) {
    diaryData.imageUrls = imageUrls;
  }

  if (audioUrl) {
    diaryData.audioUrl = audioUrl;
  }

  if (diaryId) {
    await db.collection('diaries').doc(diaryId).update(diaryData);
  } else {
    diaryData.userId = currentUser.uid;
    diaryData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('diaries').add(diaryData);
  }

  clearDiaryDraft();
  loadDiaries();
  // 调用 app.js 的 closeWriteModal（跳过确认，已保存）
  if (window.closeWriteModal) {
    window.closeWriteModal(true);
  } else {
    document.getElementById('writeModal').classList.add('hidden');
  }
}

// 加载分享用户列表
async function loadShareUsers() {
  let shareList = document.getElementById('shareList');
  shareList.innerHTML = '';

  let linkedIds = await getLinkedUserIds();

  if (linkedIds.length === 0) {
    shareList.innerHTML = '<span style="font-size:13px;color:rgba(255,255,255,0.35)">暂无链接的人</span>';
    return;
  }

  // 批量获取用户信息
  let userInfos = await getBatchUserInfo(linkedIds);

  userInfos.forEach(function(userData) {
    let item = document.createElement('label');
    item.className = 'share-item';
    item.innerHTML = '<input type="checkbox" value="' + userData.userId + '"><span>' + escapeHtml(userData.displayName) + '</span>';
    let checkbox = item.querySelector('input');
    checkbox.addEventListener('change', function() {
      this.closest('.share-item').classList.toggle('selected', this.checked);
    });
    shareList.appendChild(item);
  });
}

async function loadCoAuthors() {
  let coAuthorsList = document.getElementById('coAuthorsList');
  coAuthorsList.innerHTML = '';

  let linkedIds = await getLinkedUserIds();

  if (linkedIds.length === 0) {
    coAuthorsList.innerHTML = '<span style="font-size:13px;color:let(--text-muted);">暂无链接的人</span>';
    return;
  }

  // 批量获取用户信息
  let userInfos = await getBatchUserInfo(linkedIds);

  userInfos.forEach(function(userData) {
    let item = document.createElement('label');
    item.className = 'share-item';
    item.innerHTML = '<input type="checkbox" value="' + userData.userId + '"><span>' + escapeHtml(userData.displayName) + '</span>';
    let checkbox = item.querySelector('input');
    checkbox.addEventListener('change', function() {
      this.closest('.share-item').classList.toggle('selected', this.checked);
    });
    coAuthorsList.appendChild(item);
  });
}

// HTML 转义
function escapeHtml(text) {
  let div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// --- 草稿管理 ---
function getDiaryDraftKey() {
  return currentUser ? 'diaryDraft_' + currentUser.uid : null;
}

function saveDiaryDraft() {
  let key = getDiaryDraftKey();
  if (!key) return;

  let draft = {
    title: document.getElementById('diaryTitle').value,
    content: document.getElementById('diaryContent').value,
    date: document.getElementById('diaryDate').value,
    time: document.getElementById('diaryTime').value,
    visibility: document.getElementById('diaryVisibility').value,
    tagId: document.querySelector('.tag-select-btn.selected')?.dataset.tagId || null,
    mood: document.querySelector('.mood-option.selected')?.dataset.mood || null,
    collectionId: document.getElementById('diaryCollection').value
  };

  localStorage.setItem(key, JSON.stringify(draft));
}

function loadDiaryDraft() {
  let key = getDiaryDraftKey();
  if (!key) return;

  let draftStr = localStorage.getItem(key);
  if (!draftStr) return;

  try {
    let draft = JSON.parse(draftStr);
    document.getElementById('diaryTitle').value = draft.title || '';
    document.getElementById('diaryContent').value = draft.content || '';
    document.getElementById('diaryDate').value = draft.date || '';
    document.getElementById('diaryTime').value = draft.time || '';
    document.getElementById('diaryVisibility').value = draft.visibility || 'public';
    document.getElementById('diaryCollection').value = draft.collectionId || '';

    if (draft.mood) {
      let moodEl = document.querySelector('.mood-option[data-mood="' + draft.mood + '"]');
      if (moodEl) moodEl.classList.add('selected');
    }

    // 恢复标签选中
    if (draft.tagId) {
      let tagBtn = document.querySelector('.tag-select-btn[data-tag-id="' + draft.tagId + '"]');
      if (tagBtn) {
        document.querySelectorAll('.tag-select-btn').forEach(function(b) {
          b.classList.remove('selected');
          b.style.background = b.dataset.tagColor + '33';
          b.style.color = b.dataset.tagColor;
        });
        tagBtn.classList.add('selected');
        tagBtn.style.background = tagBtn.dataset.tagColor;
        tagBtn.style.color = '#fff';
      }
    }
  } catch (e) {
    console.error('加载草稿失败:', e);
  }
}

function clearDiaryDraft() {
  let key = getDiaryDraftKey();
  if (key) localStorage.removeItem(key);
}

function hasDiaryContent() {
  let title = document.getElementById('diaryTitle').value.trim();
  let content = document.getElementById('diaryContent').value.trim();
  let hasImages = selectedImageFiles && selectedImageFiles.length > 0;
  let hasAudio = selectedAudioFile;
  return title || content || hasImages || hasAudio;
}