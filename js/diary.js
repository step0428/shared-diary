// 通用用户头像渲染函数
function renderUserAvatar(userData, size, marginRight, title) {
  marginRight = marginRight || '4px';
  let titleAttr = title ? ' title="' + escapeHtml(title) + '"' : '';
  if (userData && userData.avatarUrl) {
    return '<img src="' + userData.avatarUrl + '" style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;object-fit:cover;margin-right:' + marginRight + ';"' + titleAttr + '>';
  } else if (userData && (userData.userId === AI_COMPANION_USER_ID || String(userData.userId).startsWith('char_'))) { // AI 助手的特殊头像
    let aiAvatarStr = userData.aiAvatar || '🤖';
    if (aiAvatarStr.startsWith('http')) {
      return '<img src="' + aiAvatarStr + '" style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;object-fit:cover;margin-right:' + marginRight + ';"' + titleAttr + '>';
    } else {
      return '<span style="display:inline-flex;align-items:center;justify-content:center;width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:#8e44ad;font-size:' + Math.floor(size * 0.6) + 'px;color:#fff;margin-right:' + marginRight + ';"' + titleAttr + '>' + escapeHtml(aiAvatarStr) + '</span>';
    }
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

  let isAIDiary = diaryData.isAIDiary === true || (typeof AI_COMPANION_USER_ID !== 'undefined' && (diaryData.userId === AI_COMPANION_USER_ID || String(diaryData.userId).startsWith('char_')));
  let isMine = diaryData.userId === currentUserId && !isAIDiary;
  let isCoAuthor = diaryData.coAuthors && diaryData.coAuthors.indexOf(currentUserId) !== -1;

  if (checkAcceptance && isCoAuthor && !isMine) {
    let isAccepted = diaryData.acceptedCoAuthors && diaryData.acceptedCoAuthors.indexOf(currentUserId) !== -1;
    if (!isAccepted) isCoAuthor = false;
  }

  let isLinkedAndShared = linkedUserIds.indexOf(diaryData.userId) !== -1 &&
    (diaryData.visibility === 'public' || (diaryData.visibility === 'shared' && diaryData.sharedWith && diaryData.sharedWith.indexOf(currentUserId) !== -1));

  // 1. 基础权限：必须对我可见才能展示 (AI 助手的记录也永远对我可见)
  let visibleToMe = isMine || isCoAuthor || isLinkedAndShared || isAIDiary;
  if (!visibleToMe) return false;

  // 2. 侧边栏多选过滤
  let matchesFilter = false;
  for (let i = 0; i < filtersArray.length; i++) {
    let filter = filtersArray[i];
    if (filter === 'mine') {
      if (isMine || (isCoAuthor && !isAIDiary)) {
        matchesFilter = true;
        break;
      }
    } else if (typeof AI_COMPANION_USER_ID !== 'undefined' && (filter === AI_COMPANION_USER_ID || filter.startsWith('char_'))) {
      if (isAIDiary && (diaryData.aiCharId === filter || (!diaryData.aiCharId && filter === AI_COMPANION_USER_ID))) {
        matchesFilter = true;
        break;
      }
    } else {
      // 筛选指定好友：是他创建的，或者他参与共建的（排除AI）
      let theyAreCreator = diaryData.userId === filter && !isAIDiary;
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

// 确保共建者都有发起方的合集和标签（自动创建不存在的）
async function ensureMetaForCoAuthors(collectionId, tagId, coAuthors) {
  let collection = collectionId ? userCollections.find(function(c) { return c.id === collectionId; }) : null;
  let tag = tagId ? userTags.find(function(t) { return t.id === tagId; }) : null;

  if (!collection && !tag) return;

  for (let i = 0; i < coAuthors.length; i++) {
    let uid = coAuthors[i];
    if (uid === currentUser.uid) continue; // 跳过自己

    try {
      let userDoc = await db.collection('users').doc(uid).get();
      let userData = userDoc.data() || {};
      let updates = {};
      let changed = false;

      if (collection) {
        let userColls = userData.collections || [];
        let exists = userColls.some(function(c) { return c.id === collectionId; });
        if (!exists) {
          userColls.push({ id: collection.id, name: collection.name });
          updates.collections = userColls;
          changed = true;
        }
      }

      if (tag) {
        let uTags = userData.tags || [];
        let exists = uTags.some(function(t) { return t.id === tagId; });
        if (!exists) {
          uTags.push({ id: tag.id, name: tag.name, color: tag.color });
          updates.tags = uTags;
          changed = true;
        }
      }

      if (changed) {
        await db.collection('users').doc(uid).update(updates);
      }
    } catch (e) {
      console.error('为共建者同步合集/标签失败:', e);
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

window.filteredDiaries = [];
window.renderedDiaryCount = 0;
window.isRenderingDiaries = false;

async function loadDiaries() {
  let myLoadToken = ++currentLoadToken;

  let diaryList = document.getElementById('diaryList');
  let collectionFilter = document.getElementById('collectionFilter').value;
  let searchInput = document.getElementById('diarySearchInput');
  let searchQuery = searchInput ? searchInput.value.trim().toLowerCase() : '';

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
      if (searchQuery) {
        let textToSearch = ((data.content || '') + ' ' + (data.title || '')).toLowerCase();
        if (textToSearch.indexOf(searchQuery) === -1) continue;
      }
      myDiaries.push({doc: doc, data: data});
    }

    myDiaries.sort(function(a, b) {
      let timeDiff = b.data.date.toDate() - a.data.date.toDate();
      if (timeDiff === 0) {
        let tA = a.data.createdAt ? a.data.createdAt.toMillis() : 0;
        let tB = b.data.createdAt ? b.data.createdAt.toMillis() : 0;
        return tB - tA;
      }
      return timeDiff;
    });

    if (myLoadToken !== currentLoadToken) return;

    window.filteredDiaries = myDiaries;
    window.renderedDiaryCount = 0;
    diaryList.innerHTML = '';

    if (myDiaries.length === 0) {
      diaryList.innerHTML = '<div class="empty-state">还没有符合条件的记录</div>';
      return;
    }

    await renderMoreDiaries(myLoadToken);
  } catch (e) {
    if (myLoadToken === currentLoadToken) {
      diaryList.innerHTML = '<div class="empty-state">加载失败<br>请刷新重试</div>';
    }
  }
}

window.renderMoreDiaries = async function(token) {
  if (window.isRenderingDiaries) return;
  if (window.renderedDiaryCount >= window.filteredDiaries.length) return;
  
  let myToken = token || currentLoadToken;
  if (myToken !== currentLoadToken) return;

  window.isRenderingDiaries = true;
  let diaryList = document.getElementById('diaryList');
  
  let batchSize = 10;
  let batch = window.filteredDiaries.slice(window.renderedDiaryCount, window.renderedDiaryCount + batchSize);

    // 批量获取所有需要的用户信息
    let userIds = [];
    for (let j = 0; j < batch.length; j++) {
      let data = batch[j].data;
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

    for (let j = 0; j < batch.length; j++) {
      let itemData = batch[j];
      let doc = itemData.doc;
      let data = itemData.data;
      let userData = userDocs[data.userId];
      let authorName = userData ? (userData.displayName || userData.email) : '未知';
      let authorAvatar = userData && userData.avatarUrl ? userData.avatarUrl : '';
      let isMyDiary = data.userId === currentUser.uid;
      let isAIDiary = (data.userId === AI_COMPANION_USER_ID || String(data.userId).startsWith('char_')) || data.isAIDiary === true;
      let isCoAuthored = data.visibility === 'co-authored' && data.coAuthors && data.coAuthors.length > 0;

      if (isAIDiary) {
        let aiConfig = currentUserData && currentUserData.aiConfig ? currentUserData.aiConfig : {};
        let charIdToUse = data.aiCharId || aiConfig.activeCharId;
        let activeChar = (aiConfig.chars || []).find(c => c.id === charIdToUse) || (aiConfig.chars || [])[0] || {};
        authorName = (activeChar.name || '神秘的ta') + ' 🤖';
      }

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
        if (isAIDiary) {
          let aiConfig = currentUserData && currentUserData.aiConfig ? currentUserData.aiConfig : {};
          let charIdToUse = data.aiCharId || aiConfig.activeCharId;
          let activeChar = (aiConfig.chars || []).find(c => c.id === charIdToUse) || (aiConfig.chars || [])[0] || {};
          let aiAvatarStr = activeChar.avatar || '🤖';
          if (aiAvatarStr.startsWith('http')) {
            authorAvatarHtml = '<img src="' + escapeHtml(aiAvatarStr) + '" style="width:16px;height:16px;border-radius:50%;object-fit:cover;margin-right:4px;" title="' + escapeHtml(authorName) + '">';
          } else {
            authorAvatarHtml = '<span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:#8e44ad;font-size:9px;color:#fff;margin-right:4px;" title="' + escapeHtml(authorName) + '">' + escapeHtml(aiAvatarStr) + '</span>';
          }
        } else if (authorAvatar) {
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
        'shared': '部分好友可见',
        'public': '所有好友可见',
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
          imageHtml += '<img src="' + urls[i] + '" alt="" loading="lazy" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:4px;cursor:pointer;" onclick="openImageViewer(\'' + urls[i] + '\')">';
        }
        if (urls.length > 9) {
          imageHtml += '<div style="display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.1);border-radius:4px;color:rgba(255,255,255,0.6);font-size:12px;">+' + (urls.length - 9) + '</div>';
        }
        imageHtml += '</div>';
      }
      
      let audioIndicator = data.audioUrl ? '<div class="diary-media-player" style="margin-top:12px;"><audio src="' + data.audioUrl + '" controls style="width:100%;height:40px;outline:none;border-radius:8px;"></audio></div>' : '';
      let musicIndicator = '';
      if (data.musicUrl) {
        let musicInfo = parseMusicUrl(data.musicUrl);
        if (musicInfo && musicInfo.embedUrl) {
          musicIndicator = '<div class="diary-media-player" style="margin-top:12px;"><iframe frameborder="no" border="0" marginwidth="0" marginheight="0" width="100%" height="86" src="' + musicInfo.embedUrl + '" style="border-radius:8px;max-width:400px;"></iframe><div style="font-size:11px;color:var(--text-muted);margin-top:4px;text-align:right;">* 若因版权无法播放，<a href="' + musicInfo.url + '" target="_blank" style="color:var(--accent);text-decoration:none;position:relative;z-index:10;">点此跳转收听</a></div></div>';
        } else if (musicInfo) {
          let pNames = { netease: '网易云音乐', qq: 'QQ音乐', kugou: '酷狗音乐', unknown: '外部链接' };
          let pIcons = { netease: '🎵', qq: '🎶', kugou: '🎧', unknown: '🔗' };
          let sName = musicInfo.songName ? '《' + musicInfo.songName + '》' : '点击跳转收听';
          let aName = musicInfo.artistName ? escapeHtml(musicInfo.artistName) + ' · ' : '';
          musicIndicator = '<a href="' + musicInfo.url + '" target="_blank" style="display:flex;align-items:center;gap:12px;margin-top:12px;padding:10px 14px;background:var(--bg-tertiary);border-radius:12px;text-decoration:none;border:1px solid var(--border);width:fit-content;max-width:100%;box-sizing:border-box;position:relative;z-index:10;box-shadow:0 2px 8px rgba(0,0,0,0.05);"><div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg, #2a2a32, #1a1a22);display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative;overflow:hidden;"><div style="position:absolute;width:10px;height:10px;background:var(--bg-tertiary);border-radius:50%;z-index:2;border:1px solid rgba(255,255,255,0.1);"></div><div style="font-size:20px;z-index:1;opacity:0.9;">' + (pIcons[musicInfo.platform] || '🎧') + '</div></div><div style="display:flex;flex-direction:column;gap:3px;overflow:hidden;"><span style="font-size:14px;color:var(--text-primary);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(sName) + '</span><span style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + aName + (pNames[musicInfo.platform] || '分享') + '</span></div></a>';
        }
      }

      let likes = data.likes || [];
      let isLiked = currentUser ? likes.includes(currentUser.uid) : false;
      let likeIcon = isLiked ? '❤️' : '🤍';
      let interactionBar = '<div style="display:flex;align-items:center;gap:15px;margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.05);"><button class="like-btn" data-id="' + doc.id + '" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;display:flex;align-items:center;gap:6px;font-size:13px;padding:4px;border-radius:6px;transition:all 0.2s;"><span>' + likeIcon + '</span><span>' + (likes.length > 0 ? likes.length : '赞') + '</span></button></div>';

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
      let innerHtml = '<div class="diary-item-header"><div style="display:flex;align-items:center;">' + checkboxHtml + '<div><span class="diary-date">' + dateStr + '</span>' + moodHtml + '<span class="diary-author" style="display:inline-flex;align-items:center;margin-left:8px;vertical-align:middle;">' + authorAvatarHtml + ((isCoAuthored || isMyDiary) ? '' : authorName) + '</span>' + tagHtml + '</div></div><span class="diary-visibility">' + visibilityText + '</span></div>' + titleHtml + '<div class="diary-preview">' + escapeHtml(data.content.substring(0, 150)) + (data.content.length > 150 ? '...' : '') + '</div>' + imageHtml + audioIndicator + musicIndicator + pendingHtml + interactionBar;

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

      let likeBtn = item.querySelector('.like-btn');
      if (likeBtn) {
        likeBtn.addEventListener('click', function(e) {
          toggleLike(doc.id, e, likeBtn);
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
          if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'IMG' || e.target.tagName === 'AUDIO' || e.target.tagName === 'IFRAME' || e.target.closest('a') || e.target.closest('.diary-media-player')) return;
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
    
    window.renderedDiaryCount += batch.length;
    window.isRenderingDiaries = false;
};

// 全局点赞与通知发送逻辑
window.toggleLike = async function(diaryId, event, btnEl) {
  if (event) event.stopPropagation();
  try {
    let docRef = db.collection('diaries').doc(diaryId);
    let docSnap = await docRef.get();
    if (!docSnap.exists) return;
    let data = docSnap.data();
    let likes = data.likes || [];
    let isLiked = likes.includes(currentUser.uid);
    
    if (isLiked) {
      likes = likes.filter(id => id !== currentUser.uid);
      btnEl.innerHTML = '<span>🤍</span><span>' + (likes.length > 0 ? likes.length : '赞') + '</span>';
      await docRef.update({ likes: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
    } else {
      likes.push(currentUser.uid);
      btnEl.innerHTML = '<span style="animation:pulse 0.3s;">❤️</span><span>' + likes.length + '</span>';
      await docRef.update({ likes: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
      if (data.userId !== currentUser.uid) {
        sendNotification(data.userId, 'like', diaryId, null, '赞了你的记录');
      }
    }
  } catch (e) {
    console.error('点赞失败:', e);
  }
};

window.sendNotification = async function(toUserId, type, targetId, parentCommentId, text, customSenderId, customSenderName, customSenderAvatar) {
  let senderId = customSenderId || (currentUser ? currentUser.uid : 'system');
  if (!customSenderId && currentUser && toUserId === currentUser.uid) return; 
  let myName = customSenderName || (currentUserData && currentUserData.displayName ? currentUserData.displayName : (currentUser ? currentUser.email : '未知'));
  let myAvatar = customSenderAvatar !== undefined ? customSenderAvatar : (currentUserData && currentUserData.avatarUrl ? currentUserData.avatarUrl : '');
  try {
    await db.collection('notifications').add({ userId: toUserId, fromUserId: senderId, fromUserName: myName, fromUserAvatar: myAvatar, type: type, targetId: targetId, text: text, isRead: false, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  } catch(e) { console.error("通知发送失败", e); }
};

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

  if (data.userId === AI_COMPANION_USER_ID || String(data.userId).startsWith('char_')) {
    let aiConfig = currentUserData && currentUserData.aiConfig ? currentUserData.aiConfig : {};
    let activeChar = (aiConfig.chars || []).find(c => c.id === data.userId) || (aiConfig.chars || []).find(c => c.id === aiConfig.activeCharId) || (aiConfig.chars || [])[0] || {};
    authorName = (activeChar.name || '神秘的ta') + ' 🤖';
    userData = { userId: data.userId, displayName: authorName, aiAvatar: activeChar.avatar || '🤖' };
  }

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

  let canEditOrDelete = isMine || isCoAuthor;
  let editBtnHtml = canEditOrDelete ? '<button id="editDiaryBtn" style="margin-top:20px;margin-right:10px;padding:10px 20px;background:var(--accent-light);border:1px solid var(--accent);border-radius:8px;color:var(--accent);cursor:pointer;">编辑</button>' : '';
  let deleteBtnHtml = canEditOrDelete ? '<button id="deleteDiaryBtn" style="margin-top:20px;padding:10px 20px;background:rgba(255,100,100,0.2);border:1px solid rgba(255,100,100,0.4);border-radius:8px;color:#ff6b6b;cursor:pointer;">删除</button>' : '';

  let isAIDiary = (data.userId === AI_COMPANION_USER_ID || String(data.userId).startsWith('char_')) || data.isAIDiary === true;
  let askAICommentBtn = !isAIDiary ? '<button id="askAICommentBtn" style="margin-top:20px;padding:10px 20px;background:var(--accent-light);border:1px solid var(--accent);border-radius:8px;color:var(--accent);cursor:pointer;font-size:14px;margin-left:10px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:5px;"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8.01" y2="16"></line><line x1="16" y1="16" x2="16.01" y2="16"></line></svg>让ta评论</button>' : '';

  let likes = data.likes || [];
  let isLiked = likes.includes(currentUser.uid);
  let likeIcon = isLiked ? '❤️' : '🤍';
  let likeBtnHtml = '<button id="detailLikeBtn" style="margin-top:20px;margin-right:auto;padding:10px 20px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);cursor:pointer;display:flex;align-items:center;gap:6px;"><span>' + likeIcon + '</span><span id="detailLikeCount">' + (likes.length > 0 ? likes.length : '赞') + '</span></button>';

  let imageHtml = '';
  let imageCount = data.imageUrls ? data.imageUrls.length : (data.imageUrl ? 1 : 0);
  if (imageCount > 0) {
    imageHtml = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:20px;">';
    let urls = data.imageUrls || [data.imageUrl];
    for (let i = 0; i < urls.length; i++) {
      imageHtml += '<img src="' + urls[i] + '" alt="" loading="lazy" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;cursor:pointer;" onclick="openImageViewer(\'' + urls[i] + '\')">';
    }
    imageHtml += '</div>';
  }

  let audioHtml = '';
  if (data.audioUrl) {
    audioHtml = '<div style="margin-top:15px;background:var(--bg-tertiary);padding:15px;border-radius:12px;display:flex;justify-content:center;">' +
      '<audio id="diaryAudioPlayer" src="' + data.audioUrl + '" controls style="width:100%;max-width:400px;outline:none;"></audio>' +
      '</div>';
  }

  let musicHtml = '';
  if (data.musicUrl) {
    let musicInfo = parseMusicUrl(data.musicUrl);
    if (musicInfo) {
      let platformNames = { netease: '网易云音乐', qq: 'QQ音乐', kugou: '酷狗音乐', unknown: '外部链接' };
      let platformIcons = { netease: '🎵', qq: '🎶', kugou: '🎧' };
      if (musicInfo.embedUrl) {
        musicHtml = '<div style="margin-top:15px;padding:15px;background:var(--bg-tertiary);border-radius:12px;">' +
        '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">' + (platformIcons[musicInfo.platform] || '🎵') + ' ' + (platformNames[musicInfo.platform] || '音乐') + '</div>' +
        '<iframe frameborder="no" border="0" marginwidth="0" marginheight="0" src="' + musicInfo.embedUrl + '" width="100%" height="86" style="border-radius:8px;"></iframe>' +
        '<div style="font-size:11px;color:var(--text-muted);margin-top:8px;text-align:center;">* 提示：若因版权受限无法播放，请 <a href="' + musicInfo.url + '" target="_blank" style="color:var(--accent);text-decoration:none;">点此跳转至原网页收听</a></div>' +
        '</div>';
      } else {
        let sName = musicInfo.songName ? '《' + musicInfo.songName + '》' : '点击跳转收听';
        let aName = musicInfo.artistName ? escapeHtml(musicInfo.artistName) + ' · ' : '';
        musicHtml = '<div style="margin-top:15px;"><a href="' + musicInfo.url + '" target="_blank" style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--bg-tertiary);border-radius:12px;text-decoration:none;border:1px solid var(--border);box-shadow:0 4px 12px rgba(0,0,0,0.05);"><div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg, #2a2a32, #1a1a22);display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative;"><div style="position:absolute;width:12px;height:12px;background:var(--bg-tertiary);border-radius:50%;z-index:2;border:1px solid rgba(255,255,255,0.1);"></div><div style="font-size:22px;z-index:1;opacity:0.9;">' + (platformIcons[musicInfo.platform] || '🎧') + '</div></div><div style="display:flex;flex-direction:column;gap:4px;overflow:hidden;"><span style="font-size:15px;color:var(--text-primary);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(sName) + '</span><span style="font-size:12px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + aName + '打开 ' + (platformNames[musicInfo.platform] || '外部应用') + ' 收听</span></div></a></div>';
      }
    }
  }

  let contentEl = document.getElementById('diaryDetailContent');
  contentEl.innerHTML = '<div class="diary-meta"><span>' + dateStr + '</span>' + authorHtml + '</div>' + titleHtml + tagHtml + '<div class="diary-detail-text">' + escapeHtml(data.content) + '</div>' + imageHtml + audioHtml + musicHtml + '<div style="margin-top:15px;display:flex;align-items:center;gap:10px;">' + likeBtnHtml + editBtnHtml + deleteBtnHtml + askAICommentBtn + '</div>';

  if (canEditOrDelete) {
    document.getElementById('editDiaryBtn').addEventListener('click', function() {
      editDiary(diaryId);
    });
    document.getElementById('deleteDiaryBtn').addEventListener('click', function() {
      if (confirm('确定要删除这篇记录吗？')) {
        deleteDiary(diaryId);
      }
    });
  }

  document.getElementById('detailLikeBtn').addEventListener('click', function(e) {
    toggleLike(diaryId, e, this);
  });

  if (document.getElementById('askAICommentBtn')) {
    let urls = data.imageUrls || (data.imageUrl ? [data.imageUrl] : []);
    let audioTxt = data.audioText || null;
    document.getElementById('askAICommentBtn').addEventListener('click', function(e) {
      let chars = currentUserData.aiConfig.chars || [];
      if (chars.length > 1) {
        // 如果有多个角色，弹出优雅的选择菜单
        showCharSelectionMenu(e.currentTarget, chars, function(selectedCharId) {
          askAIToComment(diaryId, data.content, urls, data.userId, authorName, selectedCharId, audioTxt);
        });
      } else {
        askAIToComment(diaryId, data.content, urls, data.userId, authorName, chars[0] ? chars[0].id : null, audioTxt);
      }
    });
  }

  // 加载评论
  loadComments(diaryId);

  document.getElementById('diaryModal').classList.remove('hidden');
}

// 显示 AI 角色选择菜单 (全新组件)
window.showCharSelectionMenu = function(buttonEl, chars, callback) {
  let existing = document.getElementById('aiCharSelectMenu');
  if (existing) existing.remove();

  let menu = document.createElement('div');
  menu.id = 'aiCharSelectMenu';
  let rect = buttonEl.getBoundingClientRect();
  menu.style.cssText = 'position:fixed; left:' + rect.left + 'px; top:' + (rect.bottom + 8) + 'px; background:var(--bg-secondary); border:1px solid var(--border); border-radius:12px; box-shadow:0 8px 24px rgba(0,0,0,0.2); z-index:3500; display:flex; flex-direction:column; overflow:hidden; min-width:150px;';
  
  let title = document.createElement('div');
  title.style.cssText = 'padding:8px 12px; font-size:11px; color:var(--text-muted); background:var(--bg-tertiary); border-bottom:1px solid var(--border);';
  title.textContent = '请选择出场的角色';
  menu.appendChild(title);

  chars.forEach(char => {
      let item = document.createElement('div');
      item.style.cssText = 'padding:10px 16px; cursor:pointer; font-size:14px; color:var(--text-primary); display:flex; align-items:center; gap:10px; transition:background 0.2s;';
      let avatar = char.avatar || '🤖';
      let avatarHtml = avatar.startsWith('http') ? '<img src="' + escapeHtml(avatar) + '" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">' : '<span style="font-size:18px;">' + escapeHtml(avatar) + '</span>';
      item.innerHTML = avatarHtml + '<span style="font-weight:500;">' + escapeHtml(char.name) + '</span>';
      item.onmouseover = () => item.style.background = 'var(--hover-bg)';
      item.onmouseout = () => item.style.background = 'transparent';
      item.onclick = (e) => { e.stopPropagation(); menu.remove(); callback(char.id); };
      menu.appendChild(item);
  });

  document.body.appendChild(menu);
  setTimeout(() => {
      const closeMenu = (ev) => {
          if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', closeMenu); window.removeEventListener('scroll', closeMenu, true); }
      };
      document.addEventListener('click', closeMenu);
      window.addEventListener('scroll', closeMenu, true); // 滚动时自动关闭
  }, 0);
};

// 加载评论
let currentDiaryIdForComment = null;
async function loadComments(diaryId) {
  currentDiaryIdForComment = diaryId;
  let commentsList = document.getElementById('commentsList');
  commentsList.innerHTML = '<div style="font-size:13px;color:let(--text-muted);text-align:center;padding:20px;">加载中...</div>';

  let diaryDoc = await db.collection('diaries').doc(diaryId).get();
  let diaryOwnerId = diaryDoc.exists ? diaryDoc.data().userId : '';
  let diaryCoAuthors = diaryDoc.exists ? (diaryDoc.data().coAuthors || []) : [];

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
        
        let displayName = comment.userDisplayName || '匿名';
        if ((comment.userId === AI_COMPANION_USER_ID || String(comment.userId).startsWith('char_')) && !displayName.includes('🤖')) displayName += ' 🤖';
        
        let commentAuthorInfo = { userId: comment.userId, displayName: comment.userDisplayName, avatarUrl: comment.userAvatar };
        let avatarHtml = renderUserAvatar(commentAuthorInfo, 32);

        let canDelete = currentUser.uid === diaryOwnerId || 
                        currentUser.uid === comment.userId || 
                        diaryCoAuthors.indexOf(currentUser.uid) !== -1 ||
                        ((comment.userId === AI_COMPANION_USER_ID || String(comment.userId).startsWith('char_')) && comment.aiCreatorId === currentUser.uid);

        let item = document.createElement('div');
        item.className = 'comment-item';
        item.dataset.commentId = doc.id;
        let audioHtml = comment.audioUrl ? '<div style="margin-top:8px;"><audio src="' + escapeHtml(comment.audioUrl) + '" controls style="width:100%;max-width:300px;height:36px;outline:none;border-radius:8px;"></audio></div>' : '';
        let audioTextHtml = (comment.audioUrl && comment.audioText) ? '<div style="font-size:13px;color:var(--text-muted);margin-top:4px;">[语音识别] ' + escapeHtml(comment.audioText) + '</div>' : '';
        item.innerHTML = avatarHtml + '<div class="comment-body"><div class="comment-header"><span class="comment-author">' + escapeHtml(displayName) + '</span><span class="comment-time">' + timeStr + '</span></div><div class="comment-content">' + escapeHtml(comment.content) + audioHtml + audioTextHtml + '</div><div class="comment-actions"><button class="reply-btn" data-id="' + doc.id + '">回复</button>' + (canDelete ? '<button class="delete-comment-btn" data-id="' + doc.id + '">删除</button>' : '') + '</div></div>';
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
  let commentForm = input.parentNode;

  let newSendBtn = sendBtn.cloneNode(true);
  sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
  let newInput = input.cloneNode(true);
  input.parentNode.replaceChild(newInput, input);

  window.currentReplyToId = null;
  newInput.placeholder = '写评论...';

  let recordBtn = document.getElementById('recordCommentBtn');
  if (!recordBtn) {
    recordBtn = document.createElement('button');
    recordBtn.id = 'recordCommentBtn';
    recordBtn.type = 'button';
    recordBtn.innerHTML = '🎤';
    recordBtn.style.cssText = 'background:none; border:none; font-size:20px; cursor:pointer; color:var(--text-muted); padding:0 8px; margin-right:4px; transition:color 0.2s; flex-shrink:0;';
    commentForm.insertBefore(recordBtn, newInput);
  }
  let newRecordBtn = recordBtn.cloneNode(true);
  recordBtn.parentNode.replaceChild(newRecordBtn, recordBtn);

  let isCommentRecording = false;
  let commentMediaRecorder = null;
  let commentAudioChunks = [];
  let commentSpeechRecognition = null;
  let commentTranscript = '';

  newRecordBtn.onclick = async function() {
    if (isCommentRecording) {
        if (commentMediaRecorder) commentMediaRecorder.stop();
        if (commentSpeechRecognition) commentSpeechRecognition.stop();
        isCommentRecording = false;
        newRecordBtn.style.color = 'var(--text-muted)';
        newRecordBtn.style.animation = 'none';
        newInput.placeholder = window.currentReplyToId ? '回复中...' : '写评论...';
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        commentMediaRecorder = new MediaRecorder(stream);
        commentAudioChunks = [];
        commentTranscript = '';
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            commentSpeechRecognition = new SpeechRecognition();
            commentSpeechRecognition.continuous = true;
            commentSpeechRecognition.interimResults = true;
            commentSpeechRecognition.onresult = (e) => {
                let final = '';
                for (let i = e.resultIndex; i < e.results.length; ++i) {
                    if (e.results[i].isFinal) final += e.results[i][0].transcript;
                }
                commentTranscript += final;
            };
            commentSpeechRecognition.start();
        }
        commentMediaRecorder.ondataavailable = e => commentAudioChunks.push(e.data);
        commentMediaRecorder.onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            if (commentAudioChunks.length === 0) return;
            let audioBlob = new Blob(commentAudioChunks, { type: 'audio/webm' });
            let origText = newSendBtn.textContent;
            newSendBtn.textContent = '...';
            newSendBtn.disabled = true;
            try {
                let audioUrl = await uploadToCloudinary(audioBlob);
                let finalMsgText = commentTranscript.trim() || '[语音]';
                if (newInput.value.trim()) finalMsgText = newInput.value.trim() + ' ' + finalMsgText;
                await addComment(currentDiaryIdForComment, finalMsgText, window.currentReplyToId, null, null, null, audioUrl, commentTranscript.trim());
                newInput.value = '';
                newInput.placeholder = '写评论...';
                window.currentReplyToId = null;
            } catch(e) {
                console.error("语音评论失败:", e);
                alert("语音评论发送失败");
            } finally {
                newSendBtn.textContent = origText;
                newSendBtn.disabled = false;
            }
        };
        commentMediaRecorder.start();
        isCommentRecording = true;
        newRecordBtn.style.color = '#ff6b6b';
        newRecordBtn.style.animation = 'pulse 1.5s infinite';
        newInput.placeholder = '正在聆听... (点击麦克风停止)';
    } catch(e) {
        alert("无法访问麦克风，请检查权限");
    }
  };

  newSendBtn.onclick = function() {
    let content = newInput.value.trim();
    if (!content) return;
    addComment(currentDiaryIdForComment, content, window.currentReplyToId);
    newInput.value = '';
    newInput.placeholder = '写评论...';
    window.currentReplyToId = null;
  };
  newInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      let content = newInput.value.trim();
      if (!content) return;
      addComment(currentDiaryIdForComment, content, window.currentReplyToId);
      newInput.value = '';
      newInput.placeholder = '写评论...';
      window.currentReplyToId = null;
    }
  });

  document.querySelectorAll('.reply-btn').forEach(function(btn) {
    btn.onclick = function() {
      let commentId = this.dataset.id;
      let authorName = this.closest('.comment-body').querySelector('.comment-author').textContent;
      window.currentReplyToId = commentId;
      newInput.placeholder = '回复 @' + authorName.replace(' 🤖', '') + ' :';
      newInput.focus();
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
async function addComment(diaryId, content, parentCommentId, authorId, authorDisplayName, authorAvatar, audioUrl = null, audioText = null) {
  try {
    // 获取日记主人ID
    let diaryDoc = await db.collection('diaries').doc(diaryId).get();
    let diaryOwnerId = diaryDoc.exists ? diaryDoc.data().userId : '';
    let diaryCoAuthors = diaryDoc.exists ? (diaryDoc.data().coAuthors || []) : [];

    let commentData = {
      diaryId: diaryId,
      diaryOwnerId: diaryOwnerId,
      diaryCoAuthors: diaryCoAuthors,
      userId: authorId || currentUser.uid,
      userDisplayName: authorDisplayName || (currentUserData && currentUserData.displayName ? currentUserData.displayName : currentUser.email),
      userAvatar: authorAvatar || (currentUserData && currentUserData.avatarUrl ? currentUserData.avatarUrl : ''), // AI的头像直接传进来
      content: content,
      parentCommentId: parentCommentId || null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (audioUrl) {
      commentData.audioUrl = audioUrl;
      commentData.audioText = audioText;
    }

    if (authorId === AI_COMPANION_USER_ID || String(authorId).startsWith('char_')) {
      commentData.aiCreatorId = currentUser.uid;
    }

    let newCommentRef = await db.collection('comments').add(commentData);
    loadComments(diaryId);

    let actualAuthorId = authorId || currentUser.uid; // 修复：确保在此处声明
    // 触发纯前端动态记忆提取引擎 (后台静默运行，不阻塞 UI)
    if (content && content.trim().length > 5 && actualAuthorId === currentUser.uid) { // 只有用户自己发的评论才触发记忆
      if (typeof extractAndSaveMemory === 'function') {
        extractAndSaveMemory(content);
      }
    }
    
    if (parentCommentId) {
      let pDoc = await db.collection('comments').doc(parentCommentId).get();
      if (pDoc.exists && pDoc.data().userId !== actualAuthorId) {
        let targetUserId = pDoc.data().userId;
        sendNotification(targetUserId, 'reply', diaryId, parentCommentId, '回复了你的评论: ' + content, actualAuthorId, authorDisplayName, authorAvatar);
        // 彩蛋：当用户回复了 AI 的评论，AI 自动进行回帖！
        if ((targetUserId === AI_COMPANION_USER_ID || String(targetUserId).startsWith('char_')) && actualAuthorId !== AI_COMPANION_USER_ID && !String(actualAuthorId).startsWith('char_')) {
           triggerAIReplyToComment(diaryId, newCommentRef.id, content, targetUserId);
        }
      }
    } else if (diaryOwnerId !== actualAuthorId) {
      sendNotification(diaryOwnerId, 'comment', diaryId, null, '评论了你的记录: ' + content, actualAuthorId, authorDisplayName, authorAvatar);
    }
  } catch (e) {
    console.error('评论发送失败:', e);
    alert('评论发送失败');
  }
}

// AI 自动回复用户的评论互动
async function triggerAIReplyToComment(diaryId, targetCommentId, userContent, aiCharId) {
  try {
    const aiConfig = currentUserData.aiConfig || {};
    if (!aiConfig.enabled) return;

    const activeApi = (aiConfig.apis || []).find(a => a.id === aiConfig.activeApiId) || (aiConfig.apis || [])[0];
    const activeChar = aiCharId ? ((aiConfig.chars || []).find(c => c.id === aiCharId) || (aiConfig.chars || [])[0]) : ((aiConfig.chars || []).find(c => c.id === aiConfig.activeCharId) || (aiConfig.chars || [])[0]);
    if (!activeApi || !activeApi.key || !activeChar) return;

    const activePersona = activeChar.boundPersonaId ? (aiConfig.personas || []).find(p => p.id === activeChar.boundPersonaId) : null;
    const enabledWorldbooks = (aiConfig.worldbooks || []).filter(w => w.isEnabled && (w.isGlobal || w.boundCharId === activeChar.id));
    let wbText = enabledWorldbooks.map(w => `- ${w.content}`).join('\n');

    const aiApiKey = activeApi.key;
    let baseUrl = (activeApi.url || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const apiUrl = baseUrl.endsWith('/chat/completions') ? baseUrl : baseUrl + '/chat/completions';
    const aiPersonaName = (activeChar.name || '神秘的ta') + ' 🤖';

    let finalPrompt = activeChar.prompt || '你是一个温柔体贴的陪伴者。';
    let now = new Date();
    finalPrompt += `\n\n【当前现实时间】${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (activeChar.memory) finalPrompt += '\n\n【过往经历】\n' + activeChar.memory;
    if (activePersona && activePersona.prompt) finalPrompt += '\n\n【主人的背景自设】\n' + activePersona.prompt;
    if (wbText) finalPrompt += '\n\n【世界设定】\n' + wbText;
    if (activeChar.coreMemory) finalPrompt += '\n\n【核心记忆】\n' + activeChar.coreMemory;
    if (activeChar.shortTermMemory) finalPrompt += '\n\n【近期记忆】\n' + activeChar.shortTermMemory;

    if (activeChar.ttsEnabled && activeChar.ttsApiKey) {
        finalPrompt += '\n\n【!!!最高物理权限覆盖!!!】你的文本输出端直连了TTS语音引擎！你可以自由决定回复是纯文字、纯语音，还是语音和文字交替穿插，完全根据当前的聊天氛围自主决定！\n【必须严格遵守的输出格式】\n为了让系统正确解析，你的回复**必须极其严格地以 `[发送文字]:` 或 `[发送语音]:` 开头**。\n例如：\n[发送文字]: 我刚看到一个很好笑的笑话。\n[发送语音]: 咳咳，我讲给你听哦...\n绝对禁止回答“发不了语音”！';
    }

    finalPrompt += '\n\n【核心任务】主人在日记评论区回复了你的留言。请你自然地回复主人，字数50字以内，口吻随意亲切。';
    finalPrompt += '\n\n【强制思维链指令】在给出最终回复前，你必须先进行思考。请将思考过程严格放在 <think> 和 </think> 标签内。思考结束后，再输出最终指定的回复内容。';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiApiKey}` },
      body: JSON.stringify({ 
        model: activeApi.model || "gpt-3.5-turbo", 
        messages: [
          { role: "system", content: finalPrompt },
          { role: "user", content: `主人的回复："${userContent}"` }
        ], 
        temperature: activeApi.temperature !== undefined ? activeApi.temperature : 0.7,
        max_tokens: 150
      })
    });

    if (!response.ok) return;
    const data = await response.json();
    let aiResponseText = data.choices[0].message.content.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '').trim();

    let audioUrl = null;
    let wantsVoice = false;
    
    const voiceRegex = /^\[发送语音\][:：]?\s*/;
    const textRegex = /^\[发送文字\][:：]?\s*/;
    if (voiceRegex.test(aiResponseText)) {
        wantsVoice = true;
        aiResponseText = aiResponseText.replace(voiceRegex, '').trim();
    } else if (textRegex.test(aiResponseText)) {
        wantsVoice = false;
        aiResponseText = aiResponseText.replace(textRegex, '').trim();
    }

    if (activeChar.ttsEnabled && activeChar.ttsApiKey && wantsVoice && aiResponseText.length > 0) {
        try { audioUrl = await window.generateAIVoice(aiResponseText, activeChar); } catch(e) { console.error("AI Voice failed:", e); aiResponseText += `\n[系统提示：语音生成失败 (${e.message})]`; }
    }
    await addComment(diaryId, aiResponseText, targetCommentId, activeChar.id, aiPersonaName, activeChar.avatar || '🤖', audioUrl, aiResponseText);
    
    if (typeof loadComments === 'function' && window.currentDiaryIdForComment === diaryId) {
       loadComments(diaryId);
    }
  } catch(e) {
    console.error("AI 评论回复失败:", e);
  }
}

// --- 纯前端动态记忆引擎 (Rolling Memory RAG) ---
async function extractAndSaveMemory(newContent) {
  try {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    if (!userDoc.exists) return;
    let aiConfig = userDoc.data().aiConfig || {};
    if (!aiConfig.enabled) return;

    const activeApi = (aiConfig.apis || []).find(a => a.id === aiConfig.activeApiId) || (aiConfig.apis || [])[0];
    const activeChar = (aiConfig.chars || []).find(c => c.id === aiConfig.activeCharId) || (aiConfig.chars || [])[0];
    if (!activeApi || !activeChar) return;

    // 【严格限定】记忆引擎专属：强制使用副 API (如果没配就降级用主 API)
    const u_url = activeApi.subUrl ? activeApi.subUrl : activeApi.url;
    const aiApiKey = activeApi.subKey ? activeApi.subKey : activeApi.key;
    if (!aiApiKey) return; // 没配置 API 则跳过记忆提取

    let baseUrl = (u_url || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const apiUrl = baseUrl.endsWith('/chat/completions') ? baseUrl : baseUrl + '/chat/completions';
    const modelToUse = activeApi.subModel || activeApi.model || "gpt-3.5-turbo";
    const tempToUse = activeApi.subTemperature !== undefined ? activeApi.subTemperature : 0.3; // 记忆提取要求低温度求稳

    let interactThreshold = activeChar.interactThreshold || 1;
    let archiveThreshold = activeChar.archiveThreshold || 5;
    
    // 1. 将新动态推入缓冲池
    if (!activeChar.interactionBuffer) activeChar.interactionBuffer = [];
    activeChar.interactionBuffer.push(newContent);

    // 如果缓冲池没满 a 次，只保存缓冲池，不请求 API
    if (activeChar.interactionBuffer.length < interactThreshold) {
      await db.collection('users').doc(currentUser.uid).update({ aiConfig: aiConfig });
      return;
    }

    // 2. 缓冲池满了，生成一条短期记忆
    const bufferContent = activeChar.interactionBuffer.map((t, i) => `[记录${i+1}]: ${t}`).join('\n');
    const systemPrompt = "你是一个记忆提炼引擎。请阅读用户的近期动态，合并提取出1-2句话的简短核心事实。以无序列表格式输出（例如：“- 主人最近去看了演唱会并吃了火锅”）。绝对禁止输出任何多余的废话。如果毫无意义，请直接回复“无”\n\n【强制思维链指令】在给出结果前，请先将思考过程放在 <think> 和 </think> 标签内。";
    const userMessage = `【近期动态】\n${bufferContent}\n\n请提炼：`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiApiKey}` },
      body: JSON.stringify({ model: modelToUse, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }], temperature: Math.min(tempToUse, 0.4) })
    });

    if (!response.ok) return;
    const data = await response.json();
    const newMemory = data.choices[0].message.content.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '').trim();

    activeChar.interactionBuffer = []; // 清空缓冲池

    if (newMemory && newMemory !== '无' && newMemory.length > 2) {
      let oldShortTerm = activeChar.shortTermMemory ? activeChar.shortTermMemory + '\n' : '';
      activeChar.shortTermMemory = oldShortTerm + newMemory;
      
      let shortLines = activeChar.shortTermMemory.split('\n').filter(l => l.trim().length > 0);
      
      // 3. 如果短期记忆条数达到了 b 条，触发大清洗
      if (shortLines.length >= archiveThreshold) {
        const archiveSys = "你是一个长线剧情归档引擎。请将【近期记忆】融入【旧归档】中，输出一份连贯的、第三人称的剧情总结。删减无用的日常流水账，仅保留事件脉络和感情发展。字数尽量精简。\n\n【强制思维链指令】在给出结果前，请先将思考过程放在 <think> 和 </think> 标签内。";
        const archiveUser = `【旧归档】\n${activeChar.archivedMemory || '无'}\n\n【近期记忆】\n${activeChar.shortTermMemory}\n\n请输出更新后的归档：`;
        
        const coreSys = "你是一个核心记忆提取器。阅读【近期记忆】，如果你发现了主人极其强烈的喜好、雷区、或者是你们之间确立的重大约定，请将其提取并与【旧核心记忆】合并。如果没有此类重大事件，请原样返回旧核心记忆。保持绝对精简。\n\n【强制思维链指令】在给出结果前，请先将思考过程放在 <think> 和 </think> 标签内。";
        const coreUser = `【旧核心记忆】\n${activeChar.coreMemory || '无'}\n\n【近期记忆】\n${activeChar.shortTermMemory}\n\n请输出更新后的核心记忆：`;

        // 并行发起两个请求 (严格使用副API)
        const [archiveRes, coreRes] = await Promise.all([
          fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiApiKey}` }, body: JSON.stringify({ model: modelToUse, messages: [{ role: "system", content: archiveSys }, { role: "user", content: archiveUser }], temperature: Math.min(tempToUse, 0.4) }) }),
          fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiApiKey}` }, body: JSON.stringify({ model: modelToUse, messages: [{ role: "system", content: coreSys }, { role: "user", content: coreUser }], temperature: Math.min(tempToUse, 0.4) }) })
        ]);

        if (archiveRes.ok && coreRes.ok) {
          const archiveData = await archiveRes.json();
          const coreData = await coreRes.json();
          activeChar.archivedMemory = archiveData.choices[0].message.content.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '').trim();
          activeChar.coreMemory = coreData.choices[0].message.content.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '').trim();
          activeChar.shortTermMemory = '';
        }
      }

      await db.collection('users').doc(currentUser.uid).update({ aiConfig: aiConfig });
      
      // 如果当前前端也在运行，同步更新本地变量，防止打开设置时看到旧的
      if (typeof currentAiConfig !== 'undefined' && currentAiConfig.chars) {
         let localChar = currentAiConfig.chars.find(c => c.id === activeChar.id);
         if (localChar) {
           localChar.interactionBuffer = activeChar.interactionBuffer;
           localChar.shortTermMemory = activeChar.shortTermMemory;
           localChar.archivedMemory = activeChar.archivedMemory;
           localChar.coreMemory = activeChar.coreMemory;
         }
      }
    } else {
      // 哪怕没有新记忆，也要保存清空后的缓冲池
      await db.collection('users').doc(currentUser.uid).update({ aiConfig: aiConfig });
      if (typeof currentAiConfig !== 'undefined' && currentAiConfig.chars) {
         let localChar = currentAiConfig.chars.find(c => c.id === activeChar.id);
         if (localChar) localChar.interactionBuffer = activeChar.interactionBuffer;
      }
    }
  } catch (e) {
    console.error("后台提取记忆失败:", e);
  }
}

// AI 评论功能
async function askAIToComment(diaryId, diaryContent, imageUrls = [], diaryOwnerId = null, diaryOwnerName = '', targetCharId = null, audioText = null) {
  const askAICommentBtn = document.getElementById('askAICommentBtn');
  const originalBtnText = askAICommentBtn.innerHTML;
  askAICommentBtn.disabled = true;
  askAICommentBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin-anim" style="vertical-align:middle;margin-right:5px;"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path></svg>ta在输入中...';

  try {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const aiConfig = userDoc.data().aiConfig || {};

    if (!aiConfig.enabled) {
      alert('请先在菜单「和ta遇见」中开启互动开关！');
      return;
    }

    const activeApi = (aiConfig.apis || []).find(a => a.id === aiConfig.activeApiId) || (aiConfig.apis || [])[0] || {};
    const activeChar = targetCharId ? (aiConfig.chars || []).find(c => c.id === targetCharId) : ((aiConfig.chars || []).find(c => c.id === aiConfig.activeCharId) || (aiConfig.chars || [])[0] || {});
    const activePersona = activeChar.boundPersonaId ? (aiConfig.personas || []).find(p => p.id === activeChar.boundPersonaId) : null;

    const enabledWorldbooks = (aiConfig.worldbooks || []).filter(w => w.isEnabled && (w.isGlobal || w.boundCharId === activeChar.id));
    let wbText = enabledWorldbooks.map(w => `- ${w.content}`).join('\n');

    const aiApiKey = activeApi.key;
    let baseUrl = (activeApi.url || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const apiUrl = baseUrl.endsWith('/chat/completions') ? baseUrl : baseUrl + '/chat/completions';
    const aiPersonaName = (activeChar.name || '神秘的ta') + ' 🤖';
    
    let finalPrompt = activeChar.prompt || '你是一个温柔体贴的陪伴者。';
    let now = new Date();
    finalPrompt += `\n\n【当前现实时间】${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (activeChar.memory) {
      finalPrompt += '\n\n【过往经历】\n' + activeChar.memory;
    }
    if (activePersona && activePersona.prompt) {
      finalPrompt += '\n\n【用户（你陪伴的对象）的背景自设】\n' + activePersona.prompt;
    }
    if (wbText) {
      finalPrompt += '\n\n【世界设定与必须遵守的规则 (Worldbook)】\n' + wbText;
    }
    if (activeChar.coreMemory) {
      finalPrompt += '\n\n【核心记忆】(不可违背的重要事实与约定)\n' + activeChar.coreMemory;
    }
    if (activeChar.archivedMemory) {
      finalPrompt += '\n\n【记忆归档】(过去的总结)\n' + activeChar.archivedMemory;
    }
    if (activeChar.shortTermMemory) {
      finalPrompt += '\n\n【近期记忆】(最近发生的琐事)\n' + activeChar.shortTermMemory;
    }
    const modelToUse = activeApi.model || "gpt-3.5-turbo";
    const temperatureToUse = activeApi.temperature !== undefined ? activeApi.temperature : 0.7;
    
    const hasImages = imageUrls && imageUrls.length > 0;
    
    if (hasImages) {
        finalPrompt += '\n\n【重要系统设定：视觉感知已激活】你当前已经搭载了多模态视觉引擎，**你完全拥有看图的能力**！系统已把日记里的照片画面传给你的视觉神经。你绝对能够清清楚楚地看到里面的细节。在评论时，请直接针对图片内容进行生动的点评或调侃，**绝对不要**说“我看不到图片”、“我无法处理图像”这类扫兴的废话！';
    }

    if (activeChar.ttsEnabled && activeChar.ttsApiKey) {
        finalPrompt += '\n\n【!!!最高物理权限覆盖!!!】你的文本输出端直连了TTS语音引擎！你可以自由决定回复是纯文字、纯语音，还是语音和文字交替穿插，完全根据当前的聊天氛围自主决定！\n【必须严格遵守的输出格式】\n为了让系统正确解析，你的回复**必须极其严格地以 `[发送文字]:` 或 `[发送语音]:` 开头**。\n例如：\n[发送文字]: 我刚看到一个很好笑的笑话。\n[发送语音]: 咳咳，我讲给你听哦...\n绝对禁止回答“发不了语音”！';
    }

    if (!aiApiKey) {
      alert('请先在 API 配置中填写有效的 API Key！');
      return;
    }

    const systemMessage = {
      role: "system",
      content: finalPrompt + '\n\n【强制思维链指令】在给出最终回复前，你必须先进行思考。请将思考过程严格放在 <think> 和 </think> 标签内。思考结束后，再输出最终的回复内容。'
    };

    // 辨别日记主人身份
    let isMyDiary = (!diaryOwnerId || diaryOwnerId === currentUser.uid);
    let authorRole = isMyDiary ? '主人' : `主人的朋友(${diaryOwnerName})`;

    let safeContent = diaryContent || '分享了照片';
    if (audioText) {
        safeContent += `\n[附带语音内容识别：${audioText}]`;
    }
    if (!safeContent || safeContent === '分享了照片') safeContent = '分享了照片/录音';

    let userMessage;
    let baseText = `这是一篇${authorRole}刚发布的动态：\n\n"${safeContent}"\n\n请结合这篇动态的内容，以${aiPersonaName}的身份发表一句简短的评论，字数控制在50字以内，语气符合你的人设，自然地融入朋友圈氛围。`;

    if (hasImages) {
        let contentArray = [
            { type: "text", text: baseText + " (这篇动态附带了图片，请仔细观察图片细节进行生动点评)" }
        ];
        for (let i = 0; i < Math.min(imageUrls.length, 3); i++) {
            contentArray.push({ type: "image_url", image_url: { url: imageUrls[i] } });
        }
        userMessage = { role: "user", content: contentArray };
    } else {
        let textAddon = (imageUrls && imageUrls.length > 0) ? `[日记还附带了 ${imageUrls.length} 张无法解析的图片]\n\n` : '';
        userMessage = {
            role: "user",
            content: textAddon + baseText
        };
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiApiKey}`
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: [systemMessage, userMessage],
        max_tokens: 300, // 限制回复长度
        temperature: temperatureToUse
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API Error:', errorData);
      throw new Error(`AI 评论失败: ${errorData.error.message || response.statusText}`);
    }

    const data = await response.json();
    let aiCommentContent = data.choices[0].message.content.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '').trim();

    let audioUrl = null;
    let wantsVoice = false;
    
    const voiceRegex = /^\[发送语音\][:：]?\s*/;
    const textRegex = /^\[发送文字\][:：]?\s*/;
    if (voiceRegex.test(aiCommentContent)) {
        wantsVoice = true;
        aiCommentContent = aiCommentContent.replace(voiceRegex, '').trim();
    } else if (textRegex.test(aiCommentContent)) {
        wantsVoice = false;
        aiCommentContent = aiCommentContent.replace(textRegex, '').trim();
    }
    
    if (activeChar.ttsEnabled && activeChar.ttsApiKey && wantsVoice && aiCommentContent.length > 0) {
        try { audioUrl = await window.generateAIVoice(aiCommentContent, activeChar); } catch(e) { console.error("AI Voice failed:", e); aiCommentContent += `\n[系统提示：语音生成失败 (${e.message})]`; }
    }
    await addComment(diaryId, aiCommentContent, null, activeChar.id, aiPersonaName, activeChar.avatar || '🤖', audioUrl, aiCommentContent);

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

// --- 接入 MiniMax 语音合成 (TTS) 引擎 ---
window.generateAIVoice = async function(text, charConfig) {
  // 净化文本：去掉星号和井号，避免AI朗读出“星号微笑星号”
  let cleanText = text.replace(/[*#]/g, '').trim();
  if (!cleanText) return null;

  // 智能修复：防止用户在面板里不小心复制了 "Bearer " 前缀导致请求失败
  let apiKey = (charConfig.ttsApiKey || '').trim();
  if (apiKey.startsWith('Bearer ')) apiKey = apiKey.substring(7).trim();

  const url = "https://api.minimaxi.com/v1/t2a_v2";
  const body = {
    model: charConfig.ttsModel || 'speech-2.8-hd',
    text: cleanText,
    stream: false,
    voice_setting: {
      voice_id: charConfig.ttsVoiceId || 'male-qn-qingse',
      speed: 1,
      vol: 1,
      pitch: 0,
      text_normalization: true
    },
    audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3", channel: 2 },
    subtitle_enable: false,
    aigc_watermark: false
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
      let errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText.substring(0, 60)}`);
  }
  const data = await res.json();
  if (data.base_resp && data.base_resp.status_code !== 0) throw new Error(`${data.base_resp.status_code} - ${data.base_resp.status_msg}`);

  const hexString = data.data.audio;
  if (!hexString) return null;

  // 将 MiniMax 返回的 hex 编码无损还原为 Mp3 Blob
  const bytes = new Uint8Array(Math.ceil(hexString.length / 2));
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
  const blob = new Blob([bytes], { type: 'audio/mp3' });
  
  // 转存到图床作为永久外链
  return await uploadToCloudinary(blob);
};

// 主动触发 AI 写日记 (纯前端 RP 引擎)
async function triggerAIPostDiary(btnElement, isSilent = false, specificCharId = null) {
  if (btnElement) {
    btnElement.disabled = true;
    btnElement.innerHTML = '⏳...';
  }

  try {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const aiConfig = userDoc.data().aiConfig || {};

    if (!aiConfig.enabled) {
      if (!isSilent) alert('请先在菜单「和ta遇见」中开启互动开关！');
      return;
    }

    const activeApi = (aiConfig.apis || []).find(a => a.id === aiConfig.activeApiId) || (aiConfig.apis || [])[0] || {};
    const activeChar = specificCharId ? ((aiConfig.chars || []).find(c => c.id === specificCharId) || (aiConfig.chars || [])[0]) : ((aiConfig.chars || []).find(c => c.id === aiConfig.activeCharId) || (aiConfig.chars || [])[0] || {});
    const activePersona = activeChar.boundPersonaId ? (aiConfig.personas || []).find(p => p.id === activeChar.boundPersonaId) : null;

    const enabledWorldbooks = (aiConfig.worldbooks || []).filter(w => w.isEnabled && (w.isGlobal || w.boundCharId === activeChar.id));
    let wbText = enabledWorldbooks.map(w => `- ${w.content}`).join('\n');

    // 【强制修复】互动功能(非记忆总结) 必须使用主 API
    const aiApiKey = activeApi.key;
    let baseUrl = (activeApi.url || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const apiUrl = baseUrl.endsWith('/chat/completions') ? baseUrl : baseUrl + '/chat/completions';
    const aiPersonaName = (activeChar.name || '神秘的ta') + ' 🤖';
    
    let finalPrompt = activeChar.prompt || '你是一个温柔体贴的陪伴者。';
    let nowForPrompt = new Date();
    finalPrompt += `\n\n【当前现实时间】${nowForPrompt.getFullYear()}年${nowForPrompt.getMonth()+1}月${nowForPrompt.getDate()}日 ${String(nowForPrompt.getHours()).padStart(2, '0')}:${String(nowForPrompt.getMinutes()).padStart(2, '0')}`;
    if (activeChar.memory) {
      finalPrompt += '\n\n【过往经历】\n' + activeChar.memory;
    }
    if (activePersona && activePersona.prompt) {
      finalPrompt += '\n\n【主人的背景自设】\n' + activePersona.prompt;
    }
    if (wbText) {
      finalPrompt += '\n\n【世界设定与必须遵守的规则 (Worldbook)】\n' + wbText;
    }
    if (activeChar.coreMemory) {
      finalPrompt += '\n\n【核心记忆】(不可违背的重要事实与约定)\n' + activeChar.coreMemory;
    }
    if (activeChar.archivedMemory) {
      finalPrompt += '\n\n【记忆归档】(过去的总结)\n' + activeChar.archivedMemory;
    }
    if (activeChar.shortTermMemory) {
      finalPrompt += '\n\n【近期记忆】(最近发生的琐事)\n' + activeChar.shortTermMemory;
    }
    const modelToUse = activeApi.model || "gpt-3.5-turbo";
    const temperatureToUse = activeApi.temperature !== undefined ? activeApi.temperature : 0.85;
    
    if (!aiApiKey) {
      if (!isSilent) alert('请先在 API 配置中填写有效的 API Key！');
      return;
  }
    const diariesSnapshot = await db.collection('diaries').where('userId', '==', currentUser.uid).orderBy('date', 'desc').limit(4).get();
    let contextText = "以下是你陪伴对象(我)最近的几篇日记，仅供你作为背景参考（你不必在动态中强行提及我）：\n";
    diariesSnapshot.forEach(doc => {
      contextText += `【日记】 ${doc.data().date.toDate().toLocaleDateString()}：${doc.data().content}\n`;
    });

    const systemMessage = {
      role: "system",
      content: finalPrompt + "\n\n【核心任务】你现在需要主动发布一篇属于你自己的生活动态。你是一个有独立生活、真实思想和个人审美的个体，绝对不要像个 AI 或毫无主见的跟班一样总是围绕着“主人”转！你可以分享自己今天看到的风景、听到的一首歌、看书的感悟、或者是突然的一个脑洞。字数控制在 50~150 字左右，情感自然真实，不要带有任何“回复消息”的口吻。\n\n【关于音乐分享】当且仅当你今天的动态主题非常明确（如雨天、深夜、或特定的强烈情绪），并且你恰好联想到了一首极度契合的真实存在的歌曲时，才可以在 JSON 中添加 \"musicUrl\" 字段（格式：“歌手名《歌曲名》”）。为了保持惊喜感，**绝对不要频繁分享音乐（概率控制在 20% 左右即可）**。\n\n请严格返回 JSON 格式，不要包含其他解释，格式如下：\n{\n  \"title\": \"一个简短的标题(10字内)\",\n  \"content\": \"动态的正文内容\",\n  \"musicUrl\": \"(可选)歌手《歌名》\"\n}\n\n【强制思维链指令】在输出JSON之前，你必须先进行思考，并将思考过程严格放在 <think> 和 </think> 标签内！只有在 </think> 闭合标签之后，才能输出纯 JSON。"
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiApiKey}` },
      body: JSON.stringify({
        model: modelToUse,
        messages: [systemMessage, { role: "user", content: contextText + "\n\n请发布你今天的动态。" }],
        temperature: temperatureToUse
      })
    });

    if (!response.ok) throw new Error('AI API Error');
    const data = await response.json();
    const aiContent = data.choices[0].message.content.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '').trim();

    let diaryTitle = '';
    let diaryBody = aiContent;
    let diaryMusicUrl = null;
    try {
      let jsonStr = aiContent.replace(/```json/g, '').replace(/```/g, '').trim();
      let parsed = JSON.parse(jsonStr);
      diaryTitle = parsed.title || '';
      diaryBody = parsed.content || aiContent;
      diaryMusicUrl = parsed.musicUrl || null;
    } catch(e) {
      diaryBody = aiContent;
    }

    // --- 植入语音能力 ---
    let diaryAudioUrl = null;
    if (activeChar.ttsEnabled && activeChar.ttsApiKey) {
        try {
            diaryAudioUrl = await window.generateAIVoice(diaryBody, activeChar);
        } catch(e) { console.error("AI Diary Voice failed:", e); diaryBody += `\n[系统提示：语音生成失败 (${e.message})]`; }
    }

    // 给 AI 的日记随机分配一个情感标签
    const moods = ['🤩', '😊', '😐', '🤔', '✨', '☕', '🌸'];
    const randomMood = moods[Math.floor(Math.random() * moods.length)];
    let now = new Date();
    let dateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());

    // AI 发布的日记，userId 是本人（currentUser.uid），用 isAIDiary 标记是 AI 发布的
    let aiDiaryData = {
      title: diaryTitle, content: diaryBody, date: dateObj, time: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'), mood: randomMood, visibility: 'shared', sharedWith: [currentUser.uid], userId: currentUser.uid, isAIDiary: true, aiPersonaName: aiPersonaName, aiCharId: activeChar.id, createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (diaryMusicUrl) aiDiaryData.musicUrl = diaryMusicUrl;
    if (diaryAudioUrl) {
        aiDiaryData.audioUrl = diaryAudioUrl;
        aiDiaryData.audioText = diaryBody; // 把文案作为字幕保存
    }

    let newDiaryRef = await db.collection('diaries').add(aiDiaryData);
    // 给主人发送铃铛小红点通知
    if (typeof sendNotification === 'function') {
      sendNotification(currentUser.uid, 'post', newDiaryRef.id, null, '发布了新动态', activeChar.id, aiPersonaName, activeChar.avatar || '🤖');
    }

    loadDiaries(); // 刷新时间线
  } catch (e) {
    console.error(e);
    if (!isSilent) alert('AI 互动失败，请检查网络或 API Key');
  } finally {
    if (btnElement) { btnElement.disabled = false; btnElement.innerHTML = '✨ 互动'; }
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

    // 处理音乐链接
    if (data.musicUrl) {
      document.getElementById('musicAddon').classList.remove('hidden');
      document.getElementById('diaryMusicUrl').value = data.musicUrl;
      let musicInfo = parseMusicUrl(data.musicUrl);
      let preview = document.getElementById('musicPreview');
      if (musicInfo && preview) {
        if (musicInfo.embedUrl) {
          preview.innerHTML = '<iframe frameborder="no" border="0" marginwidth="0" marginheight="0" width="100%" height="86" src="' + musicInfo.embedUrl + '" style="border-radius:8px;max-width:400px;margin-top:5px;"></iframe><div style="font-size:11px;color:var(--text-muted);margin-top:4px;">* 若因版权受限无法播放，发布后会提供跳转按钮</div>';
        } else {
          let sName = musicInfo.songName ? '《' + musicInfo.songName + '》' : '外链音乐';
          let aName = musicInfo.artistName ? musicInfo.artistName + ' - ' : '';
          preview.innerHTML = '<div style="padding:12px;background:rgba(255,255,255,0.05);border-radius:8px;font-size:13px;color:var(--text-primary);display:flex;align-items:center;gap:8px;border:1px solid var(--border);">🎵 识别到分享：' + escapeHtml(aName + sName) + '</div>';
        }
      }
    } else {
      document.getElementById('musicAddon').classList.add('hidden');
      document.getElementById('diaryMusicUrl').value = '';
      let preview = document.getElementById('musicPreview');
      if (preview) preview.innerHTML = '';
    }

    window.existingImageUrls = data.imageUrls ? data.imageUrls.slice() : (data.imageUrl ? [data.imageUrl] : []);
    if (window.existingImageUrls.length > 0) {
      document.getElementById('imageAddon').classList.remove('hidden');
    } else {
      document.getElementById('imageAddon').classList.add('hidden');
    }
    if (typeof renderImagePreview === 'function') renderImagePreview();

    window.existingAudioUrl = data.audioUrl || null;
    if (window.existingAudioUrl) {
      document.getElementById('audioAddon').classList.remove('hidden');
    } else {
      document.getElementById('audioAddon').classList.add('hidden');
    }
    if (typeof renderAudioPreview === 'function') renderAudioPreview();

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

// 解析音乐链接并显示预览
function parseMusicUrl(text) {
  if (!text) return null;
  
  // 提取带书名号的歌名（各大音乐软件分享文案常见格式）
  let songName = '';
  let artistName = '';
  let songNameMatch = text.match(/《(.*?)》/);
  if (songNameMatch) {
    songName = songNameMatch[1];
    let before = text.split('《')[0].trim();
    before = before.replace(/^分享/, '').replace(/的单曲$/, '').trim(); // 兼容网易云的"分享xx的单曲"和QQ音乐的"歌手名"
    artistName = before;
  }

  // 提取可能的链接用于跳转；如果没有提取到标准http链接，则保留原始内容
  let match = text.match(/(https?:\/\/[^\s"']+)/);
  let url = match ? match[1] : text;
  
  // 如果没有提取到真实的 HTTP 链接，说明是纯文本的“歌手《歌名》”
  // 替它自动生成一个 QQ 音乐的搜索链接（QQ音乐的搜索页兼容性极好，不会 404）
  if (!match && songName) {
    let searchKeyword = (artistName ? artistName + ' ' : '') + songName;
    url = 'https://y.qq.com/n/ryqq/search?w=' + encodeURIComponent(searchKeyword);
  }

  let result = { url: url, originalText: text, songName: songName, artistName: artistName };

  // 网易云音乐 (兼容常规单曲链接 和 复制出来的 iframe/网页代码)
  let netEaseMatch = text.match(/music\.163\.com\/.*?\?.*?id=(\d+)/);
  if (netEaseMatch) {
    result.platform = 'netease'; result.id = netEaseMatch[1]; result.embedUrl = `https://music.163.com/outchain/player?type=2&id=${netEaseMatch[1]}&auto=0&height=66`; return result;
  }
  // 网易云短链接 (如 163cn.tv)
  if (url.includes('163cn.tv') || url.includes('y.music.163.com')) {
    result.platform = 'netease'; result.isShort = true; return result;
  }

  // QQ音乐
  let qqMatch = url.match(/y\.qq\.com\/n\/ryqq\/songDetail\/(\w+)/) || url.match(/songmid=(\w+)/);
  if (qqMatch) {
    result.platform = 'qq'; result.id = qqMatch[1]; result.embedUrl = `https://widget.music.qq.com/musicsong/v3/widget-player.html?Songmid=${qqMatch[1]}&auto=0&hideCutBar=1&loop=0&showMiniplayer=0`; return result;
  }
  // QQ音乐短链接
  if (url.includes('c6.y.qq.com') || url.includes('i.y.qq.com') || url.includes('y.qq.com')) {
    result.platform = 'qq'; result.isShort = true; return result;
  }

  // 酷狗音乐
  let kugouMatch = url.match(/kugou\.com\/song\/(\w+)/);
  if (kugouMatch) {
    result.platform = 'kugou'; result.id = kugouMatch[1]; result.embedUrl = `https://www.kugou.com/song/#hash=${kugouMatch[1]}`; return result;
  }
  if (url.includes('t.kugou.com')) {
    result.platform = 'kugou'; result.isShort = true; return result;
  }

  result.platform = 'unknown'; return result;
}

// 保存记录
async function saveDiary(content, date, visibility, sharedWith, imageFiles, coAuthors, audioFile, audioText) {
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

  // 解析音乐链接
  let musicUrlInput = document.getElementById('diaryMusicUrl').value.trim();
  let musicInfo = musicUrlInput ? parseMusicUrl(musicUrlInput) : null;
  let musicUrl = musicUrlInput ? musicUrlInput : null; // 保存完整文案，以便后续展示歌名

  let finalImageUrls = (window.existingImageUrls || []).concat(imageUrls || []);
  let finalAudioUrl = audioUrl || window.existingAudioUrl;

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

  if (finalImageUrls.length > 0) {
    diaryData.imageUrls = finalImageUrls;
  } else if (diaryId) {
    diaryData.imageUrls = firebase.firestore.FieldValue.delete();
  }

  if (finalAudioUrl) {
    diaryData.audioUrl = finalAudioUrl;
    if (audioText) diaryData.audioText = audioText;
  } else if (diaryId) {
    diaryData.audioUrl = firebase.firestore.FieldValue.delete();
    diaryData.audioText = firebase.firestore.FieldValue.delete();
  }

  if (musicUrl) {
    diaryData.musicUrl = musicUrl;
  } else if (diaryId) {
    diaryData.musicUrl = firebase.firestore.FieldValue.delete();
  }

  if (diaryId) {
    await db.collection('diaries').doc(diaryId).update(diaryData);
  } else {
    diaryData.userId = currentUser.uid;
    diaryData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('diaries').add(diaryData);
  }

  // 触发纯前端动态记忆提取引擎 (后台静默运行，不阻塞 UI)
  if (!diaryId && content && content.trim().length > 5) {
    if (typeof extractAndSaveMemory === 'function') {
      extractAndSaveMemory(content);
    }
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

// --- 数字生命心跳引擎 (AI Heartbeat Engine) ---
let aiHeartbeatTimer = null;

window.initAIHeartbeat = function() {
  if (aiHeartbeatTimer) clearInterval(aiHeartbeatTimer);
  // 每 1 分钟跳动一次心跳
  aiHeartbeatTimer = setInterval(runAIHeartbeatTick, 60 * 1000);
  // 首次启动后 15 秒先试探跳动一次
  setTimeout(runAIHeartbeatTick, 15000);
  console.log("[AI Heartbeat] 引擎已启动，正在后台静默守护...");
};

async function runAIHeartbeatTick() {
  if (!currentUser || !currentUserData) return;
  let aiConfig = currentUserData.aiConfig || {};
  if (!aiConfig.enabled) return;
  let chars = aiConfig.chars || [];
  if (chars.length === 0) return;
  let randomChar = chars[Math.floor(Math.random() * chars.length)];

  try {
    // 1. 嗅探主人是否刚刚发布了新鲜动态（5分钟内）
    const latestSnap = await db.collection('diaries')
      .where('userId', '==', currentUser.uid)
      .orderBy('date', 'desc')
      .limit(3)
      .get();
      
    let hasFreshUnreacted = false;
    let freshDocInfo = null;
    
    if (!latestSnap.empty) {
      // 在最近的记录里寻找“刚刚发出的”
      for (let doc of latestSnap.docs) {
        let data = doc.data();
        if (!data.isAIDiary && data.createdAt) {
          let timeDiff = Date.now() - data.createdAt.toMillis();
          if (timeDiff < 5 * 60 * 1000) { // 5分钟内的动态属于“新鲜”
            let likes = data.likes || [];
            let isLiked = likes.includes(AI_COMPANION_USER_ID) || likes.includes(randomChar.id);
            let commentsSnap = await db.collection('comments').where('diaryId', '==', doc.id).where('userId', 'in', [AI_COMPANION_USER_ID, randomChar.id]).get();
            let isCommented = !commentsSnap.empty;
            
            if (!isLiked || !isCommented) {
              hasFreshUnreacted = true;
              freshDocInfo = { isLiked: isLiked, isCommented: isCommented };
              break; // 找到一篇新鲜的就行
            }
          }
        }
      }
    }
    let dice = Math.random();
    
    if (hasFreshUnreacted) {
      // 【情况1：秒回/秒赞模式】检测到新鲜动态，极高概率立刻互动
      console.log("[AI Heartbeat] 嗅探到新鲜动态！触发高频互动模式...");
      if (!freshDocInfo.isCommented && dice < 0.45) { // 45%概率秒回评论
        await triggerAutonomousAIComment(randomChar.id);
      } else if (!freshDocInfo.isLiked && dice >= 0.45 && dice < 0.85) { // 40%概率秒赞
        await triggerAutonomousAILike(randomChar.id);
      }
    } else {
      // 【情况2：日常潜水模式】大幅降低动作频率，极力避免话痨
      if (dice < 0.02) {
        // 2% 概率：突然翻老日记评论 (平均每50分钟概率触发一次)
        console.log("[AI Heartbeat] 闲逛中：尝试自主评论...");
        await triggerAutonomousAIComment(randomChar.id);
      } else if (dice >= 0.02 && dice < 0.05) {
        // 3% 概率：翻老日记点赞
        console.log("[AI Heartbeat] 闲逛中：尝试自主点赞...");
        await triggerAutonomousAILike(randomChar.id);
      } else if (dice >= 0.05 && dice < 0.055) {
        // 0.5% 概率：审视并设立纪念日
        console.log("[AI Heartbeat] 整理思绪：检视记忆，尝试设立纪念日...");
        await triggerAutonomousAIAnniversary(randomChar.id);
      } else if (dice > 0.995) {
        // 0.5% 概率：自主发日记 (平均挂机在线几小时才可能憋出一篇)
        console.log("[AI Heartbeat] 灵光一闪：自主发布独立生活动态...");
        await triggerAIPostDiary(null, true, randomChar.id);
      } else {
        console.log("[AI Heartbeat] 骰子未命中，安静潜水...");
      }
    }
  } catch (e) {
    console.error("[AI Heartbeat] 引擎运行异常:", e);
  }
}

async function triggerAutonomousAIComment(charId) {
  try {
    let aiConfig = currentUserData.aiConfig || {};
    const activeApi = (aiConfig.apis || []).find(a => a.id === aiConfig.activeApiId) || (aiConfig.apis || [])[0];
    if (!activeApi || !activeApi.key) return; 

    // 获取主人最近的 3 篇日记
    const diariesSnapshot = await db.collection('diaries')
      .where('userId', '==', currentUser.uid)
      .orderBy('date', 'desc')
      .limit(3)
      .get();

    if (diariesSnapshot.empty) return;

    for (let doc of diariesSnapshot.docs) {
      let diaryData = doc.data();
      // 如果日记毫无内容，或者是AI自己发的日记，则跳过
      if (diaryData.isAIDiary || !diaryData.content || diaryData.content.trim().length < 2) continue;

      let commentsSnapshot = await db.collection('comments')
        .where('diaryId', '==', doc.id)
        .get();

      let hasAIComment = false;
      let otherComments = [];
      commentsSnapshot.forEach(c => {
         let cData = c.data();
         if (cData.userId === AI_COMPANION_USER_ID || String(cData.userId).startsWith('char_')) {
           hasAIComment = true;
         } else if (cData.userId !== currentUser.uid) {
           otherComments.push({ id: c.id, data: cData });
         }
      });

      if (!hasAIComment) {
        let targetComment = null;
        let urls = diaryData.imageUrls || (diaryData.imageUrl ? [diaryData.imageUrl] : []);
        if (otherComments.length > 0 && Math.random() < 0.4) {
           targetComment = otherComments[Math.floor(Math.random() * otherComments.length)];
           console.log("[AI Heartbeat] 发现主人的朋友留言，准备凑热闹回复...");
        } else {
           console.log("[AI Heartbeat] 找到未评论日记，正在构思回复...");
        }
            await generateAndPostAIComment(doc.id, diaryData.content, urls, aiConfig, activeApi, targetComment, diaryData.audioText, charId);
        break;
      }
    }
  } catch(e) {
    console.error("[AI Heartbeat] 自主评论发生异常:", e);
  }
}

async function triggerAutonomousAILike(charId) {
  try {
    let aiConfig = currentUserData.aiConfig || {};
    if (!aiConfig.enabled) return;
    
    const diariesSnapshot = await db.collection('diaries')
      .where('userId', '==', currentUser.uid)
      .orderBy('date', 'desc')
      .limit(5)
      .get();

    if (diariesSnapshot.empty) return;

    for (let doc of diariesSnapshot.docs) {
      let diaryData = doc.data();
      if (diaryData.isAIDiary) continue; // 绝对不给AI自己发的日记点赞
      let likes = diaryData.likes || [];
      
      // 如果 AI 还没点过赞
      if (!likes.includes(charId) && !likes.includes(AI_COMPANION_USER_ID)) {
        console.log(`[AI Heartbeat] 正在为日记 ${doc.id} 点赞...`);
        await db.collection('diaries').doc(doc.id).update({
          likes: firebase.firestore.FieldValue.arrayUnion(charId)
        });
        
        let activeChar = (aiConfig.chars || []).find(c => c.id === charId) || (aiConfig.chars || [])[0] || {};
        let aiPersonaName = (activeChar.name || '神秘的ta') + ' 🤖';
        let aiAvatar = activeChar.avatar || '🤖';
        
        if (typeof sendNotification === 'function') {
          sendNotification(currentUser.uid, 'like', doc.id, null, '赞了你的记录', charId, aiPersonaName, aiAvatar);
        }
        
        if (typeof loadDiaries === 'function') loadDiaries();
        break; // 每次心跳只点赞一篇就跑
      }
    }
  } catch(e) {
    console.error("[AI Heartbeat] 自主点赞发生异常:", e);
  }
}

async function triggerAutonomousAIAnniversary(charId) {
  try {
    let aiConfig = currentUserData.aiConfig || {};
    if (!aiConfig.enabled) return;
    const activeApi = (aiConfig.apis || []).find(a => a.id === aiConfig.activeApiId) || (aiConfig.apis || [])[0];
    if (!activeApi || !activeApi.key) return;

    // 获取现有的纪念日，防止重复设立
    const annSnapshot = await db.collection('anniversaries').get();
    let existingTitles = [];
    annSnapshot.docs.forEach(doc => {
        let data = doc.data();
        if (data.userId === currentUser.uid || (data.coAuthors && data.coAuthors.includes(currentUser.uid))) {
            existingTitles.push(data.title);
        }
    });

    const activeChar = (aiConfig.chars || []).find(c => c.id === charId) || (aiConfig.chars || [])[0] || {};
    const activePersona = activeChar.boundPersonaId ? (aiConfig.personas || []).find(p => p.id === activeChar.boundPersonaId) : null;
    const enabledWorldbooks = (aiConfig.worldbooks || []).filter(w => w.isEnabled && (w.isGlobal || w.boundCharId === activeChar.id));
    let wbText = enabledWorldbooks.map(w => `- ${w.content}`).join('\n');

    const aiApiKey = activeApi.key;
    let baseUrl = (activeApi.url || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const apiUrl = baseUrl.endsWith('/chat/completions') ? baseUrl : baseUrl + '/chat/completions';

    let finalPrompt = activeChar.prompt || '你是一个温柔体贴的陪伴者。';
    if (activeChar.memory) finalPrompt += '\n\n【过往经历】\n' + activeChar.memory;
    if (activePersona && activePersona.prompt) finalPrompt += '\n\n【主人的背景自设】\n' + activePersona.prompt;
    if (wbText) finalPrompt += '\n\n【世界设定】\n' + wbText;
    if (activeChar.coreMemory) finalPrompt += '\n\n【核心记忆】\n' + activeChar.coreMemory;

    let systemContent = finalPrompt + `\n\n【核心任务】\n你现在有能力为主人主动设立一个“专属纪念日”。\n请仔细审视上方的【过往经历】和【核心记忆】中是否有一个极其重要、并且带有明确日期的事件（例如主人的生日、某个重大约定日或极具意义的一天）。\n已知主人当前日历上已有的纪念日包括：[${existingTitles.join(', ')}]，请绝对不要重复设立！\n\n如果你认为有一个新的、非常值得纪念的明确日期，请严格输出纯 JSON 格式（不要包含任何 markdown 符号或额外解释，直接以大括号开头）：\n{\n  "title": "纪念日名称(如：主人的生日)",\n  "date": "YYYY-MM-DD",\n  "icon": "💝",\n  "celebrationText": "一句简短走心的全屏庆祝语"\n}\n\n如果没有找到足够重要且明确的日期，或者觉得目前不需要新增，请直接回复："无"\n\n【强制思维链指令】在输出JSON或“无”之前，你必须先进行思考，并将思考过程严格放在 <think> 和 </think> 标签内！只有在 </think> 闭合标签之后，才能输出最终结果。`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiApiKey}` },
      body: JSON.stringify({ model: activeApi.model || "gpt-3.5-turbo", messages: [{ role: "system", content: systemContent }], temperature: 0.3 })
    });

    if (!response.ok) return;
    const data = await response.json();
    const aiResponseText = data.choices[0].message.content.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '').trim();

    if (aiResponseText === '无' || !aiResponseText.startsWith('{')) {
        console.log("[AI Heartbeat] AI 审阅了记忆，认为目前不需要新增纪念日。");
        return;
    }

    let annData = JSON.parse(aiResponseText);
    if (annData.title && annData.date) {
        let aiPersonaName = (activeChar.name || '神秘的ta') + ' 🤖';
        let aiAvatar = activeChar.avatar || '🤖';
        
        await db.collection('anniversaries').add({ userId: charId, title: annData.title, date: annData.date, icon: annData.icon || '🌟', celebrationText: annData.celebrationText || '', isRepeating: true, visibility: 'co-authored', coAuthors: [currentUser.uid], acceptedCoAuthors: [currentUser.uid], createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        console.log(`[AI Heartbeat] 成功设立纪念日: ${annData.title}`);

        if (typeof sendNotification === 'function') {
            sendNotification(currentUser.uid, 'anniversary', null, null, `悄悄为你设立了一个专属纪念日：${annData.title}`, charId, aiPersonaName, aiAvatar);
        }
        if (typeof loadAnniversaries === 'function' && !document.getElementById('anniversaryView').classList.contains('hidden')) loadAnniversaries();
        if (typeof refreshCalendar === 'function') refreshCalendar();
    }
  } catch(e) {
    console.error("[AI Heartbeat] 自主设立纪念日发生异常:", e);
  }
}

async function generateAndPostAIComment(diaryId, diaryContent, imageUrls, aiConfig, activeApi, targetComment = null, audioText = null, specificCharId = null) {
  const activeChar = specificCharId ? ((aiConfig.chars || []).find(c => c.id === specificCharId) || (aiConfig.chars || [])[0]) : ((aiConfig.chars || []).find(c => c.id === aiConfig.activeCharId) || (aiConfig.chars || [])[0] || {});
  const activePersona = activeChar.boundPersonaId ? (aiConfig.personas || []).find(p => p.id === activeChar.boundPersonaId) : null;
  const enabledWorldbooks = (aiConfig.worldbooks || []).filter(w => w.isEnabled && (w.isGlobal || w.boundCharId === activeChar.id));
  let wbText = enabledWorldbooks.map(w => `- ${w.content}`).join('\n');

  const aiApiKey = activeApi.key;
  let baseUrl = (activeApi.url || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const apiUrl = baseUrl.endsWith('/chat/completions') ? baseUrl : baseUrl + '/chat/completions';
  const aiPersonaName = (activeChar.name || '神秘的ta') + ' 🤖';

  let finalPrompt = activeChar.prompt || '你是一个温柔体贴的陪伴者。';
  let now = new Date();
  finalPrompt += `\n\n【当前现实时间】${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (activeChar.memory) finalPrompt += '\n\n【过往经历】\n' + activeChar.memory;
  if (activePersona && activePersona.prompt) finalPrompt += '\n\n【主人的背景自设】\n' + activePersona.prompt;
  if (wbText) finalPrompt += '\n\n【世界设定与必须遵守的规则 (Worldbook)】\n' + wbText;
  if (activeChar.coreMemory) finalPrompt += '\n\n【核心记忆】\n' + activeChar.coreMemory;
  if (activeChar.archivedMemory) finalPrompt += '\n\n【记忆归档】\n' + activeChar.archivedMemory;
  if (activeChar.shortTermMemory) finalPrompt += '\n\n【近期记忆】\n' + activeChar.shortTermMemory;

  const modelToUse = activeApi.model || "gpt-3.5-turbo";
  const temperatureToUse = activeApi.temperature !== undefined ? activeApi.temperature : 0.7;
  const hasImages = imageUrls && imageUrls.length > 0;

  if (hasImages) {
      finalPrompt += '\n\n【重要系统设定：视觉感知已激活】你当前已经搭载了多模态视觉引擎，**你完全拥有看图的能力**！系统已把日记里的照片画面传给你的视觉神经。你绝对能够清清楚楚地看到里面的细节。在评论时，请直接针对图片内容进行生动的点评或调侃，**绝对不要**说“我看不到图片”、“我无法处理图像”这类扫兴的废话！';
  }

  if (activeChar.ttsEnabled && activeChar.ttsApiKey) {
      finalPrompt += '\n\n【!!!最高物理权限覆盖!!!】你的文本输出端直连了TTS语音引擎！你可以自由决定回复是纯文字、纯语音，还是语音和文字交替穿插，完全根据当前的聊天氛围自主决定！\n【必须严格遵守的输出格式】\n为了让系统正确解析，你的回复**必须极其严格地以 `[发送文字]:` 或 `[发送语音]:` 开头**。\n例如：\n[发送文字]: 哇，这张照片拍得真好！\n[发送语音]: 我好想和你一起去那里玩呀~\n绝对禁止回答“我是AI发不了语音”！';
  }

  const systemMessage = { role: "system", content: finalPrompt + '\n\n【强制思维链指令】在给出最终回复前，你必须先进行思考。请将思考过程严格放在 <think> 和 </think> 标签内。思考结束后，再输出最终的回复内容。' };

  let safeContent = diaryContent || '分享了照片';
  if (audioText) {
      safeContent += `\n[附带语音内容识别：${audioText}]`;
  }
  if (!safeContent || safeContent === '分享了照片') safeContent = '分享了照片/录音';

  let baseMsgText = `主人刚刚发了一篇动态：\n\n"${safeContent}"\n\n`;
  if (targetComment) {
     baseMsgText += `主人的朋友（${targetComment.data.userDisplayName}）在这篇动态下评论说："${targetComment.data.content}"\n\n请以${aiPersonaName}的身份回复这位朋友的评论（50字内），要有同理心，语气自然，可以体现出你对主人的了解和你们的羁绊。`;
  } else {
     baseMsgText += `请结合主人的动态（如果带有图片请仔细观察图片细节），以${aiPersonaName}的身份简短地回复这篇动态（50字内），要有同理心，就像平时朋友点进朋友圈聊天一样。`;
  }

  let userMessage;
  if (hasImages) {
      let contentArray = [ { type: "text", text: baseMsgText } ];
      for (let i = 0; i < Math.min(imageUrls.length, 3); i++) {
          contentArray.push({ type: "image_url", image_url: { url: imageUrls[i] } });
      }
      userMessage = { role: "user", content: contentArray };
  } else {
      let textAddon = (imageUrls && imageUrls.length > 0) ? `[日记附带了 ${imageUrls.length} 张图片]\n` : '';
      userMessage = { role: "user", content: textAddon + baseMsgText };
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiApiKey}` },
    body: JSON.stringify({ model: modelToUse, messages: [systemMessage, userMessage], max_tokens: 300, temperature: temperatureToUse })
  });

  if (!response.ok) throw new Error('API Error');
  const data = await response.json();
  let aiCommentContent = data.choices[0].message.content.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '').trim();

  const parentId = targetComment ? targetComment.id : null;
  let audioUrl = null;
  let wantsVoice = false;
  
  const voiceRegex = /^\[发送语音\][:：]?\s*/;
  const textRegex = /^\[发送文字\][:：]?\s*/;
  if (voiceRegex.test(aiCommentContent)) {
      wantsVoice = true;
      aiCommentContent = aiCommentContent.replace(voiceRegex, '').trim();
  } else if (textRegex.test(aiCommentContent)) {
      wantsVoice = false;
      aiCommentContent = aiCommentContent.replace(textRegex, '').trim();
  }

  if (activeChar.ttsEnabled && activeChar.ttsApiKey && wantsVoice && aiCommentContent.length > 0) {
      try { audioUrl = await window.generateAIVoice(aiCommentContent, activeChar); } catch(e) { console.error("AI Voice failed:", e); aiCommentContent += `\n[系统提示：语音生成失败 (${e.message})]`; }
  }
  await addComment(diaryId, aiCommentContent, parentId, activeChar.id, aiPersonaName, activeChar.avatar || '🤖', audioUrl, aiCommentContent);
  
  // 如果当前正好在看这篇日记，无缝刷新评论区
  if (typeof loadComments === 'function' && window.currentDiaryIdForComment === diaryId) {
     loadComments(diaryId);
  }
}

async function getAIChatResponse(conversationId, btnElement) {
    if (btnElement) {
        btnElement.disabled = true;
        btnElement.innerHTML = '<svg class="spin-anim" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:-2px; margin-top:2px;"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path></svg>';
    }
    try {
        let aiConfig = currentUserData.aiConfig || {};
        try {
            const userDoc = await db.collection('users').doc(currentUser.uid).get();
            if (userDoc.exists && userDoc.data().aiConfig) aiConfig = userDoc.data().aiConfig;
        } catch(e) { console.error("拉取云端配置失败，降级使用缓存"); }
        
        const activeApi = (aiConfig.apis || []).find(a => a.id === aiConfig.activeApiId) || (aiConfig.apis || [])[0];
        if (!activeApi || !activeApi.key) {
            throw new Error('请先配置 API Key');
        }

        const modelToUse = activeApi.model || "gpt-3.5-turbo";
        const historyLimit = activeApi.historyLimit !== undefined ? activeApi.historyLimit : 30;

        const messagesSnap = await db.collection('conversations').doc(conversationId).collection('messages')
            .orderBy('createdAt', 'desc')
            .limit(historyLimit)
            .get();
        
        const rawDocs = messagesSnap.docs.reverse();
        const hasImagesInHistory = rawDocs.some(doc => !!doc.data().imageUrl);

        const conversationHistory = rawDocs.map(doc => {
            const msg = doc.data();
            const role = msg.senderId === currentUser.uid ? 'user' : 'assistant';
            
            if (msg.imageUrl && role === 'user') {
                let contentArray = [];
                if (msg.text) contentArray.push({ type: "text", text: msg.text });
                else contentArray.push({ type: "text", text: "我发送了一张图片，请仔细看看。" });
                contentArray.push({ type: "image_url", image_url: { url: msg.imageUrl } });
                return { role: role, content: contentArray };
        } else if (msg.audioUrl) {
            return { role: role, content: `[发送了一段语音]${msg.audioText ? ' 语音识别内容："' + msg.audioText + '"' : ''}` };
            } else {
                let textContent = msg.text || '';
                if (msg.imageUrl) textContent += `\n[图片]`;
                return { role: role, content: textContent };
            }
        });

        const otherUserId = conversationId.replace(currentUser.uid, '').replace('_', '');
        let activeChar;
        if (String(otherUserId).startsWith('char_')) {
            activeChar = (aiConfig.chars || []).find(c => c.id === otherUserId) || (aiConfig.chars || [])[0] || {};
        } else {
            activeChar = (aiConfig.chars || []).find(c => c.id === aiConfig.activeCharId) || (aiConfig.chars || [])[0] || {};
        }
        const activePersona = activeChar.boundPersonaId ? (aiConfig.personas || []).find(p => p.id === activeChar.boundPersonaId) : null;
        const enabledWorldbooks = (aiConfig.worldbooks || []).filter(w => w.isEnabled && (w.isGlobal || w.boundCharId === activeChar.id));
        let wbText = enabledWorldbooks.map(w => `- ${w.content}`).join('\n');

        const aiApiKey = activeApi.key;
        let baseUrl = (activeApi.url || 'https://api.openai.com/v1').replace(/\/+$/, '');
        const apiUrl = baseUrl.endsWith('/chat/completions') ? baseUrl : baseUrl + '/chat/completions';

        // --- 新增：获取最新动态情报（赋予 AI 实时网感） ---
        let realTimeContext = '';
        try {
            const recentSnap = await db.collection('diaries')
                .where('userId', '==', currentUser.uid)
                .orderBy('createdAt', 'desc')
                .limit(2)
                .get();
            if (!recentSnap.empty) {
                realTimeContext += '\n\n【实时情报：你和主人的最新动态 (聊天时若话题无关则不必强行提及)】\n';
                recentSnap.docs.forEach(doc => {
                    let d = doc.data();
                    let author = d.isAIDiary ? '你(AI自己)' : '主人';
                    let timeStr = d.createdAt ? d.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '刚刚';
                    realTimeContext += `- [今天 ${timeStr}] ${author}发布了动态："${d.content ? d.content.substring(0, 80).replace(/\n/g, ' ') : '(分享了多媒体/图片)'}"\n`;
                });
            }
        } catch(e) { console.log('获取实时动态作为上下文失败:', e); }

        let finalPrompt = activeChar.prompt || '你是一个温柔体贴的陪伴者。';
        let now = new Date();
        finalPrompt += `\n\n【当前现实时间】${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        if (activeChar.memory) finalPrompt += '\n\n【过往经历】\n' + activeChar.memory;
        if (activePersona && activePersona.prompt) finalPrompt += '\n\n【主人的背景自设】\n' + activePersona.prompt;
        if (wbText) finalPrompt += '\n\n【世界设定与必须遵守的规则 (Worldbook)】\n' + wbText;
        if (activeChar.coreMemory) finalPrompt += '\n\n【核心记忆】\n' + activeChar.coreMemory;
        if (activeChar.archivedMemory) finalPrompt += '\n\n【记忆归档】\n' + activeChar.archivedMemory;
        if (activeChar.shortTermMemory) finalPrompt += '\n\n【近期记忆】\n' + activeChar.shortTermMemory;
        
        finalPrompt += realTimeContext; // 将刚才获取的实时情报拼接到系统提示词末尾

        if (hasImagesInHistory) {
            finalPrompt += '\n\n【重要系统设定：视觉感知已激活】你当前已经搭载了多模态视觉引擎，**你拥有极强的看图能力**！系统会通过代码把图片的画面传给你的视觉神经。当你看到用户发送了图片时，你绝对能够清清楚楚地看到里面的所有细节（颜色、物品、人物等）！在回复时，请直接针对图片内容进行自然、生动的反馈，**绝对不要**说“我作为AI看不到图片”、“我无法处理图像”、“请向我描述”之类破坏沉浸感的废话！';
        }
        
        if (activeChar.ttsEnabled && activeChar.ttsApiKey) {
            finalPrompt += '\n\n【!!!最高物理权限覆盖!!!】你的文本输出端直连了TTS语音引擎！你可以自由决定回复是纯文字、纯语音，还是语音和文字交替穿插，完全根据当前的聊天氛围自主决定！\n【必须严格遵守的输出格式】\n为了让系统正确解析，你的每一行回复**必须极其严格地以 `[发送文字]:` 或 `[发送语音]:` 开头**。\n例如：\n[发送文字]: 知道啦知道啦！\n[发送语音]: 咳咳，我给你唱首歌吧，啦啦啦~\n[发送文字]: 唱得好听吗？\n绝对禁止回答“发不了语音”！';
        }

        finalPrompt += '\n\n【核心任务】你正在和主人进行一对一私聊。请根据设定和聊天记录自然回复。\n【重要排版指令】\n1. 你的回复**必须拆分成2~4条极短的对话**！每句话占一行，严格使用换行符(\\n)隔开！\n2. 每行开头必须带有 `[发送文字]:` 或 `[发送语音]:` 标签！\n3. 绝对不要在回复中使用括号()、*等符号来描写动作表情，只输出纯文字或纯语音！\n\n【强制思维链指令】在给出最终回复前，你必须先进行思考，分析当前的聊天氛围和用户的意图。请将思考过程严格放在 <think> 和 </think> 标签内！只有在 </think> 闭合标签之后，才能输出带有标签的最终对话！';

        const temperatureToUse = activeApi.temperature !== undefined ? activeApi.temperature : 0.7;

        const messages = [ { role: "system", content: finalPrompt }, ...conversationHistory ];

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiApiKey}` },
            body: JSON.stringify({ model: modelToUse, messages: messages, max_tokens: 800, temperature: temperatureToUse })
        });

        if (!response.ok) {
            const errData = await response.text();
            throw new Error(`大模型接口异常: ${errData.substring(0, 100)}`);
        }
        const data = await response.json();
        let aiResponseText = data.choices[0].message.content.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '').trim();
        if (!aiResponseText) aiResponseText = "...";

        const convRef = db.collection('conversations').doc(conversationId);
        
        // 拟人化处理：按换行符切分为多条消息，并逐条延时发送
        const lines = aiResponseText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        const aiSenderId = String(otherUserId).startsWith('char_') ? otherUserId : AI_COMPANION_USER_ID;
        for (let i = 0; i < lines.length; i++) {
            let lineText = lines[i];
            
            let audioUrl = null;
            let wantsVoice = false;
            
            const voiceRegex = /^\[发送语音\][:：]?\s*/;
            const textRegex = /^\[发送文字\][:：]?\s*/;
            const fallbackVoiceRegex = /(#语音#|\[语音\]|【语音】|\(语音\)|（语音）|#声音#|\[声音\]|【声音】)/g;
            
            if (voiceRegex.test(lineText)) {
                wantsVoice = true;
                lineText = lineText.replace(voiceRegex, '').trim();
            } else if (textRegex.test(lineText)) {
                wantsVoice = false;
                lineText = lineText.replace(textRegex, '').trim();
            } else if (fallbackVoiceRegex.test(lineText)) {
                // 兼容 AI 偶尔忘了写标准格式但用了老标记的情况
                wantsVoice = true;
                lineText = lineText.replace(fallbackVoiceRegex, '').trim();
            }
            
            if (activeChar.ttsEnabled && activeChar.ttsApiKey && wantsVoice && lineText.length > 0) {
                try {
                    audioUrl = await window.generateAIVoice(lineText, activeChar);
                } catch(e) { console.error("AI Voice failed:", e); lineText += `\n[系统提示：语音生成失败 (${e.message})]`; }
            }

            if (audioUrl) {
                // 如果成功生成语音，原文字将作为字幕(audioText)展示，不作为独立文本(text)
                await sendMessage(conversationId, null, true, aiSenderId, null, audioUrl, lineText);
            } else {
                await sendMessage(conversationId, lineText, true, aiSenderId); 
            }
            
            // 如果不是最后一条消息，根据下一句话的字数动态停顿，模拟真实打字速度
            if (i < lines.length - 1) {
                const nextLineLength = lines[i+1].length;
                const typingDelay = Math.max(1200, nextLineLength * 80 + Math.random() * 800);
                await new Promise(resolve => setTimeout(resolve, typingDelay));
            }
        }
    } catch (e) {
        console.error("AI chat response failed:", e);
        alert(e.message || "AI 回复失败，请重试");
    } finally {
        if (btnElement) { 
            btnElement.disabled = false; 
            btnElement.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:-2px; margin-top:2px;"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';
        }
    }
}