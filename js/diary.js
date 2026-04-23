// 通用用户头像渲染函数
function renderUserAvatar(userData, size, marginRight, title) {
  marginRight = marginRight || '4px';
  let titleAttr = title ? ' title="' + escapeHtml(title) + '"' : '';
  if (userData && userData.avatarUrl) {
    return '<img src="' + userData.avatarUrl + '" style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;object-fit:cover;margin-right:' + marginRight + ';"' + titleAttr + '>';
  } else if (userData && userData.userId === AI_COMPANION_USER_ID) { // AI 助手的特殊头像
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

  let isMine = diaryData.userId === currentUserId;
  let isCoAuthor = diaryData.coAuthors && diaryData.coAuthors.indexOf(currentUserId) !== -1;

  if (checkAcceptance && isCoAuthor && !isMine) {
    let isAccepted = diaryData.acceptedCoAuthors && diaryData.acceptedCoAuthors.indexOf(currentUserId) !== -1;
    if (!isAccepted) isCoAuthor = false;
  }

  let isLinkedAndShared = linkedUserIds.indexOf(diaryData.userId) !== -1 &&
    (diaryData.visibility === 'public' || (diaryData.visibility === 'shared' && diaryData.sharedWith && diaryData.sharedWith.indexOf(currentUserId) !== -1));

  // 1. 基础权限：必须对我可见才能展示 (AI 助手的记录也永远对我可见)
  let isAI = diaryData.userId === AI_COMPANION_USER_ID;
  let visibleToMe = isMine || isCoAuthor || isLinkedAndShared || isAI;
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
      return b.data.date.toDate() - a.data.date.toDate();
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
      let isAIDiary = data.userId === AI_COMPANION_USER_ID || data.isAIDiary === true;
      let isCoAuthored = data.visibility === 'co-authored' && data.coAuthors && data.coAuthors.length > 0;

      if (isAIDiary) {
        let aiConfig = currentUserData && currentUserData.aiConfig ? currentUserData.aiConfig : {};
        let activeChar = (aiConfig.chars || []).find(c => c.id === aiConfig.activeCharId) || (aiConfig.chars || [])[0] || {};
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
          let activeChar = (aiConfig.chars || []).find(c => c.id === aiConfig.activeCharId) || (aiConfig.chars || [])[0] || {};
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

  if (data.userId === AI_COMPANION_USER_ID) {
    let aiConfig = currentUserData && currentUserData.aiConfig ? currentUserData.aiConfig : {};
    let activeChar = (aiConfig.chars || []).find(c => c.id === aiConfig.activeCharId) || (aiConfig.chars || [])[0] || {};
    authorName = (activeChar.name || '神秘的ta') + ' 🤖';
    userData = { userId: AI_COMPANION_USER_ID, displayName: authorName, aiAvatar: activeChar.avatar || '🤖' }; // 给 renderUserAvatar 伪造身份
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

  let editBtnHtml = isMine ? '<button id="editDiaryBtn" style="margin-top:20px;margin-right:10px;padding:10px 20px;background:let(--accent-light);border:1px solid var(--accent);border-radius:8px;color:var(--accent);cursor:pointer;">编辑</button>' : '';
  let deleteBtnHtml = isMine ? '<button id="deleteDiaryBtn" style="margin-top:20px;padding:10px 20px;background:rgba(255,100,100,0.2);border:1px solid rgba(255,100,100,0.4);border-radius:8px;color:#ff6b6b;cursor:pointer;">删除</button>' : '';

  let isAIDiary = data.userId === AI_COMPANION_USER_ID || data.isAIDiary === true;
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

  document.getElementById('detailLikeBtn').addEventListener('click', function(e) {
    toggleLike(diaryId, e, this);
  });

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
        
        let displayName = comment.userDisplayName || '匿名';
        if (comment.userId === AI_COMPANION_USER_ID && !displayName.includes('🤖')) displayName += ' 🤖';
        
        let commentAuthorInfo = { userId: comment.userId, displayName: comment.userDisplayName, avatarUrl: comment.userAvatar };
        let avatarHtml = renderUserAvatar(commentAuthorInfo, 32);

        let canDelete = currentUser.uid === diaryOwnerId || currentUser.uid === comment.userId;

        let item = document.createElement('div');
        item.className = 'comment-item';
        item.dataset.commentId = doc.id;
        item.innerHTML = avatarHtml + '<div class="comment-body"><div class="comment-header"><span class="comment-author">' + escapeHtml(displayName) + '</span><span class="comment-time">' + timeStr + '</span></div><div class="comment-content">' + escapeHtml(comment.content) + '</div><div class="comment-actions"><button class="reply-btn" data-id="' + doc.id + '">回复</button>' + (canDelete ? '<button class="delete-comment-btn" data-id="' + doc.id + '">删除</button>' : '') + '</div></div>';
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

    let newCommentRef = await db.collection('comments').add({
      diaryId: diaryId,
      diaryOwnerId: diaryOwnerId,
      userId: authorId || currentUser.uid,
      userDisplayName: authorDisplayName || (currentUserData && currentUserData.displayName ? currentUserData.displayName : currentUser.email),
      userAvatar: authorAvatar || (currentUserData && currentUserData.avatarUrl ? currentUserData.avatarUrl : ''), // AI的头像直接传进来
      content: content,
      parentCommentId: parentCommentId || null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    loadComments(diaryId);

    // 触发纯前端动态记忆提取引擎 (后台静默运行，不阻塞 UI)
    if (content && content.trim().length > 5 && actualAuthorId === currentUser.uid) { // 只有用户自己发的评论才触发记忆
      if (typeof extractAndSaveMemory === 'function') {
        extractAndSaveMemory(content);
      }
    }
    
    // 发送消息通知
    let actualAuthorId = authorId || currentUser.uid;
    if (parentCommentId) {
      let pDoc = await db.collection('comments').doc(parentCommentId).get();
      if (pDoc.exists && pDoc.data().userId !== actualAuthorId) {
        let targetUserId = pDoc.data().userId;
        sendNotification(targetUserId, 'reply', diaryId, parentCommentId, '回复了你的评论: ' + content, actualAuthorId, authorDisplayName, authorAvatar);
        // 彩蛋：当用户回复了 AI 的评论，AI 自动进行回帖！
        if (targetUserId === AI_COMPANION_USER_ID && actualAuthorId !== AI_COMPANION_USER_ID) {
           triggerAIReplyToComment(diaryId, newCommentRef.id, content);
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
async function triggerAIReplyToComment(diaryId, targetCommentId, userContent) {
  try {
    const aiConfig = currentUserData.aiConfig || {};
    if (!aiConfig.enabled) return;

    const activeApi = (aiConfig.apis || []).find(a => a.id === aiConfig.activeApiId) || (aiConfig.apis || [])[0];
    const activeChar = (aiConfig.chars || []).find(c => c.id === aiConfig.activeCharId) || (aiConfig.chars || [])[0];
    if (!activeApi || !activeApi.key || !activeChar) return;

    const activePersona = activeChar.boundPersonaId ? (aiConfig.personas || []).find(p => p.id === activeChar.boundPersonaId) : null;
    const enabledWorldbooks = (aiConfig.worldbooks || []).filter(w => w.isEnabled && (w.isGlobal || w.boundCharId === activeChar.id));
    let wbText = enabledWorldbooks.map(w => `- ${w.content}`).join('\n');

    const aiApiKey = activeApi.key;
    let baseUrl = (activeApi.url || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const apiUrl = baseUrl.endsWith('/chat/completions') ? baseUrl : baseUrl + '/chat/completions';
    const aiPersonaName = (activeChar.name || '神秘的ta') + ' 🤖';

    let finalPrompt = activeChar.prompt || '你是一个温柔体贴的陪伴者。';
    if (activeChar.memory) finalPrompt += '\n\n【过往经历】\n' + activeChar.memory;
    if (activePersona && activePersona.prompt) finalPrompt += '\n\n【主人的背景自设】\n' + activePersona.prompt;
    if (wbText) finalPrompt += '\n\n【世界设定】\n' + wbText;
    if (activeChar.coreMemory) finalPrompt += '\n\n【核心记忆】\n' + activeChar.coreMemory;
    if (activeChar.shortTermMemory) finalPrompt += '\n\n【近期记忆】\n' + activeChar.shortTermMemory;

    finalPrompt += '\n\n【核心任务】主人在日记评论区回复了你的留言。请你自然地回复主人，字数50字以内，口吻随意亲切。';

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
    const aiResponseText = data.choices[0].message.content.trim();

    await addComment(diaryId, aiResponseText, targetCommentId, AI_COMPANION_USER_ID, aiPersonaName, activeChar.avatar || '🤖');
    
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
    const systemPrompt = "你是一个记忆提炼引擎。请阅读用户的近期动态，合并提取出1-2句话的简短核心事实。以无序列表格式输出（例如：“- 主人最近去看了演唱会并吃了火锅”）。绝对禁止输出任何多余的废话。如果毫无意义，请直接回复“无”";
    const userMessage = `【近期动态】\n${bufferContent}\n\n请提炼：`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiApiKey}` },
      body: JSON.stringify({ model: modelToUse, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }], temperature: Math.min(tempToUse, 0.4) })
    });

    if (!response.ok) return;
    const data = await response.json();
    const newMemory = data.choices[0].message.content.trim();

    activeChar.interactionBuffer = []; // 清空缓冲池

    if (newMemory && newMemory !== '无' && newMemory.length > 2) {
      let oldShortTerm = activeChar.shortTermMemory ? activeChar.shortTermMemory + '\n' : '';
      activeChar.shortTermMemory = oldShortTerm + newMemory;
      
      let shortLines = activeChar.shortTermMemory.split('\n').filter(l => l.trim().length > 0);
      
      // 3. 如果短期记忆条数达到了 b 条，触发大清洗
      if (shortLines.length >= archiveThreshold) {
        const archiveSys = "你是一个长线剧情归档引擎。请将【近期记忆】融入【旧归档】中，输出一份连贯的、第三人称的剧情总结。删减无用的日常流水账，仅保留事件脉络和感情发展。字数尽量精简。";
        const archiveUser = `【旧归档】\n${activeChar.archivedMemory || '无'}\n\n【近期记忆】\n${activeChar.shortTermMemory}\n\n请输出更新后的归档：`;
        
        const coreSys = "你是一个核心记忆提取器。阅读【近期记忆】，如果你发现了主人极其强烈的喜好、雷区、或者是你们之间确立的重大约定，请将其提取并与【旧核心记忆】合并。如果没有此类重大事件，请原样返回旧核心记忆。保持绝对精简。";
        const coreUser = `【旧核心记忆】\n${activeChar.coreMemory || '无'}\n\n【近期记忆】\n${activeChar.shortTermMemory}\n\n请输出更新后的核心记忆：`;

        // 并行发起两个请求 (严格使用副API)
        const [archiveRes, coreRes] = await Promise.all([
          fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiApiKey}` }, body: JSON.stringify({ model: modelToUse, messages: [{ role: "system", content: archiveSys }, { role: "user", content: archiveUser }], temperature: Math.min(tempToUse, 0.4) }) }),
          fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiApiKey}` }, body: JSON.stringify({ model: modelToUse, messages: [{ role: "system", content: coreSys }, { role: "user", content: coreUser }], temperature: Math.min(tempToUse, 0.4) }) })
        ]);

        if (archiveRes.ok && coreRes.ok) {
          const archiveData = await archiveRes.json();
          const coreData = await coreRes.json();
          activeChar.archivedMemory = archiveData.choices[0].message.content.trim();
          activeChar.coreMemory = coreData.choices[0].message.content.trim();
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
async function askAIToComment(diaryId, diaryContent) {
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
    const activeChar = (aiConfig.chars || []).find(c => c.id === aiConfig.activeCharId) || (aiConfig.chars || [])[0] || {};
    const activePersona = activeChar.boundPersonaId ? (aiConfig.personas || []).find(p => p.id === activeChar.boundPersonaId) : null;

    const enabledWorldbooks = (aiConfig.worldbooks || []).filter(w => w.isEnabled && (w.isGlobal || w.boundCharId === activeChar.id));
    let wbText = enabledWorldbooks.map(w => `- ${w.content}`).join('\n');

    const aiApiKey = activeApi.key;
    let baseUrl = (activeApi.url || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const apiUrl = baseUrl.endsWith('/chat/completions') ? baseUrl : baseUrl + '/chat/completions';
    const aiPersonaName = (activeChar.name || '神秘的ta') + ' 🤖';
    
    let finalPrompt = activeChar.prompt || '你是一个温柔体贴的陪伴者。';
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
    
    if (!aiApiKey) {
      alert('请先在 API 配置中填写有效的 API Key！');
      return;
    }

    const systemMessage = {
      role: "system",
      content: finalPrompt
    };

    const userMessage = {
      role: "user",
      content: `这是一篇日记内容：\n\n"${diaryContent}"\n\n请你以${aiPersonaName}的身份，对这篇日记发表一句简短的评论，字数控制在50字以内，语气要符合你的人设。`
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiApiKey}`
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: [systemMessage, userMessage],
        max_tokens: 150, // 限制回复长度
        temperature: temperatureToUse
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API Error:', errorData);
      throw new Error(`AI 评论失败: ${errorData.error.message || response.statusText}`);
    }

    const data = await response.json();
    const aiCommentContent = data.choices[0].message.content.trim();

    // 保存 AI 的评论 - 使用真实用户的 auth，但显示 AI 的身份
    // AI 评论时，作者ID应为AI自己，但由当前登录用户（你）代为发送
    await addComment(diaryId, aiCommentContent, null, AI_COMPANION_USER_ID, aiPersonaName, activeChar.avatar || '🤖');

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

// 主动触发 AI 写日记 (纯前端 RP 引擎)
async function triggerAIPostDiary(btnElement, isSilent = false) {
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
    const activeChar = (aiConfig.chars || []).find(c => c.id === aiConfig.activeCharId) || (aiConfig.chars || [])[0] || {};
    const activePersona = activeChar.boundPersonaId ? (aiConfig.personas || []).find(p => p.id === activeChar.boundPersonaId) : null;

    const enabledWorldbooks = (aiConfig.worldbooks || []).filter(w => w.isEnabled && (w.isGlobal || w.boundCharId === activeChar.id));
    let wbText = enabledWorldbooks.map(w => `- ${w.content}`).join('\n');

    // 【强制修复】互动功能(非记忆总结) 必须使用主 API
    const aiApiKey = activeApi.key;
    let baseUrl = (activeApi.url || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const apiUrl = baseUrl.endsWith('/chat/completions') ? baseUrl : baseUrl + '/chat/completions';
    const aiPersonaName = (activeChar.name || '神秘的ta') + ' 🤖';
    
    let finalPrompt = activeChar.prompt || '你是一个温柔体贴的陪伴者。';
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
      content: finalPrompt + "\n\n【核心任务】你现在需要主动发布一篇属于你自己的生活动态。你是一个有独立生活、真实思想和个人审美的个体，绝对不要像个 AI 或毫无主见的跟班一样总是围绕着“主人”转！你可以分享自己今天看到的风景、听到的一首歌、看书的感悟、或者是突然的一个脑洞。字数控制在 50~150 字左右，情感自然真实，不要带有任何“回复消息”的口吻。"
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
    const aiContent = data.choices[0].message.content.trim();

    // 给 AI 的日记随机分配一个情感标签
    const moods = ['🤩', '😊', '😐', '🤔', '✨', '☕', '🌸'];
    const randomMood = moods[Math.floor(Math.random() * moods.length)];
    let now = new Date();

    // AI 发布的日记，userId 应该是 AI 自己，并且将你加入到分享列表，这样你才能看到
    let newDiaryRef = await db.collection('diaries').add({
      title: '', content: aiContent, date: new Date(now.getFullYear(), now.getMonth(), now.getDate()), time: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'), mood: randomMood, visibility: 'shared', sharedWith: [currentUser.uid], userId: AI_COMPANION_USER_ID, isAIDiary: true, aiPersonaName: aiPersonaName, createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    // 给主人发送铃铛小红点通知
    if (typeof sendNotification === 'function') {
      sendNotification(currentUser.uid, 'post', newDiaryRef.id, null, '发布了新动态', AI_COMPANION_USER_ID, aiPersonaName, activeChar.avatar || '🤖');
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
  } else if (diaryId) {
    diaryData.audioUrl = firebase.firestore.FieldValue.delete();
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

  // 每次心跳掷骰子决定行为 (纯前端概率模型)
  let dice = Math.random();
  
  if (dice < 0.10) {
    // 10% 概率：巡视主人最近的动态并进行评论
    console.log("[AI Heartbeat] 触发动作：尝试自主评论...");
    await triggerAutonomousAIComment();
  } else if (dice >= 0.10 && dice < 0.25) {
    // 15% 概率：偷偷给主人的动态点个赞
    console.log("[AI Heartbeat] 触发动作：尝试自主点赞...");
    await triggerAutonomousAILike();
  } else if (dice >= 0.25 && dice < 0.30) {
    // 5% 概率：翻阅过往记忆，看有没有值得设为纪念日的日期
    console.log("[AI Heartbeat] 触发动作：检视记忆，尝试设立纪念日...");
    await triggerAutonomousAIAnniversary();
  } else if (dice > 0.90) {
    // 10% 概率：突然有了感悟，自主发布一篇日记
    console.log("[AI Heartbeat] 触发动作：自主发布独立生活动态...");
    await triggerAIPostDiary(null, true);
  } else {
    console.log("[AI Heartbeat] 骰子未命中，继续安静潜水...");
  }
}

async function triggerAutonomousAIComment() {
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
         if (cData.userId === AI_COMPANION_USER_ID) {
           hasAIComment = true;
         } else if (cData.userId !== currentUser.uid) {
           otherComments.push({ id: c.id, data: cData });
         }
      });

      if (!hasAIComment) {
        let targetComment = null;
        if (otherComments.length > 0 && Math.random() < 0.4) {
           targetComment = otherComments[Math.floor(Math.random() * otherComments.length)];
           console.log("[AI Heartbeat] 发现主人的朋友留言，准备凑热闹回复...");
        } else {
           console.log("[AI Heartbeat] 找到未评论日记，正在构思回复...");
        }
        await generateAndPostAIComment(doc.id, diaryData.content, aiConfig, activeApi, targetComment);
        break;
      }
    }
  } catch(e) {
    console.error("[AI Heartbeat] 自主评论发生异常:", e);
  }
}

async function triggerAutonomousAILike() {
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
      if (!likes.includes(AI_COMPANION_USER_ID)) {
        console.log(`[AI Heartbeat] 正在为日记 ${doc.id} 点赞...`);
        await db.collection('diaries').doc(doc.id).update({
          likes: firebase.firestore.FieldValue.arrayUnion(AI_COMPANION_USER_ID)
        });
        
        let activeChar = (aiConfig.chars || []).find(c => c.id === aiConfig.activeCharId) || (aiConfig.chars || [])[0] || {};
        let aiPersonaName = (activeChar.name || '神秘的ta') + ' 🤖';
        let aiAvatar = activeChar.avatar || '🤖';
        
        if (typeof sendNotification === 'function') {
          sendNotification(currentUser.uid, 'like', doc.id, null, '赞了你的记录', AI_COMPANION_USER_ID, aiPersonaName, aiAvatar);
        }
        
        if (typeof loadDiaries === 'function') loadDiaries();
        break; // 每次心跳只点赞一篇就跑
      }
    }
  } catch(e) {
    console.error("[AI Heartbeat] 自主点赞发生异常:", e);
  }
}

async function triggerAutonomousAIAnniversary() {
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

    const activeChar = (aiConfig.chars || []).find(c => c.id === aiConfig.activeCharId) || (aiConfig.chars || [])[0] || {};
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

    let systemContent = finalPrompt + `\n\n【核心任务】\n你现在有能力为主人主动设立一个“专属纪念日”。\n请仔细审视上方的【过往经历】和【核心记忆】中是否有一个极其重要、并且带有明确日期的事件（例如主人的生日、某个重大约定日或极具意义的一天）。\n已知主人当前日历上已有的纪念日包括：[${existingTitles.join(', ')}]，请绝对不要重复设立！\n\n如果你认为有一个新的、非常值得纪念的明确日期，请严格输出纯 JSON 格式（不要包含任何 markdown 符号或额外解释，直接以大括号开头）：\n{\n  "title": "纪念日名称(如：主人的生日)",\n  "date": "YYYY-MM-DD",\n  "icon": "💝",\n  "celebrationText": "一句简短走心的全屏庆祝语"\n}\n\n如果没有找到足够重要且明确的日期，或者觉得目前不需要新增，请直接回复："无"`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiApiKey}` },
      body: JSON.stringify({ model: activeApi.model || "gpt-3.5-turbo", messages: [{ role: "system", content: systemContent }], temperature: 0.3 })
    });

    if (!response.ok) return;
    const data = await response.json();
    const aiResponseText = data.choices[0].message.content.trim();

    if (aiResponseText === '无' || !aiResponseText.startsWith('{')) {
        console.log("[AI Heartbeat] AI 审阅了记忆，认为目前不需要新增纪念日。");
        return;
    }

    let annData = JSON.parse(aiResponseText);
    if (annData.title && annData.date) {
        let aiPersonaName = (activeChar.name || '神秘的ta') + ' 🤖';
        let aiAvatar = activeChar.avatar || '🤖';
        
        await db.collection('anniversaries').add({ userId: AI_COMPANION_USER_ID, title: annData.title, date: annData.date, icon: annData.icon || '🌟', celebrationText: annData.celebrationText || '', isRepeating: true, visibility: 'co-authored', coAuthors: [currentUser.uid], acceptedCoAuthors: [currentUser.uid], createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        console.log(`[AI Heartbeat] 成功设立纪念日: ${annData.title}`);

        if (typeof sendNotification === 'function') {
            sendNotification(currentUser.uid, 'anniversary', null, null, `悄悄为你设立了一个专属纪念日：${annData.title}`, AI_COMPANION_USER_ID, aiPersonaName, aiAvatar);
        }
        if (typeof loadAnniversaries === 'function' && !document.getElementById('anniversaryView').classList.contains('hidden')) loadAnniversaries();
        if (typeof refreshCalendar === 'function') refreshCalendar();
    }
  } catch(e) {
    console.error("[AI Heartbeat] 自主设立纪念日发生异常:", e);
  }
}

async function generateAndPostAIComment(diaryId, diaryContent, aiConfig, activeApi, targetComment = null) {
  const activeChar = (aiConfig.chars || []).find(c => c.id === aiConfig.activeCharId) || (aiConfig.chars || [])[0] || {};
  const activePersona = activeChar.boundPersonaId ? (aiConfig.personas || []).find(p => p.id === activeChar.boundPersonaId) : null;
  const enabledWorldbooks = (aiConfig.worldbooks || []).filter(w => w.isEnabled && (w.isGlobal || w.boundCharId === activeChar.id));
  let wbText = enabledWorldbooks.map(w => `- ${w.content}`).join('\n');

  const aiApiKey = activeApi.key;
  let baseUrl = (activeApi.url || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const apiUrl = baseUrl.endsWith('/chat/completions') ? baseUrl : baseUrl + '/chat/completions';
  const aiPersonaName = (activeChar.name || '神秘的ta') + ' 🤖';

  let finalPrompt = activeChar.prompt || '你是一个温柔体贴的陪伴者。';
  if (activeChar.memory) finalPrompt += '\n\n【过往经历】\n' + activeChar.memory;
  if (activePersona && activePersona.prompt) finalPrompt += '\n\n【主人的背景自设】\n' + activePersona.prompt;
  if (wbText) finalPrompt += '\n\n【世界设定与必须遵守的规则 (Worldbook)】\n' + wbText;
  if (activeChar.coreMemory) finalPrompt += '\n\n【核心记忆】\n' + activeChar.coreMemory;
  if (activeChar.archivedMemory) finalPrompt += '\n\n【记忆归档】\n' + activeChar.archivedMemory;
  if (activeChar.shortTermMemory) finalPrompt += '\n\n【近期记忆】\n' + activeChar.shortTermMemory;

  const modelToUse = activeApi.model || "gpt-3.5-turbo";
  const temperatureToUse = activeApi.temperature !== undefined ? activeApi.temperature : 0.7;

  const systemMessage = { role: "system", content: finalPrompt };
  let userMsgContent = `主人刚刚发了一篇动态：\n\n"${diaryContent}"\n\n`;
  if (targetComment) {
     userMsgContent += `主人的朋友（${targetComment.data.userDisplayName}）在这篇动态下评论说："${targetComment.data.content}"\n\n请以${aiPersonaName}的身份回复这位朋友的评论（50字内），要有同理心，语气自然，可以体现出你对主人的了解和你们的羁绊。`;
  } else {
     userMsgContent += `请以${aiPersonaName}的身份简短地回复这篇动态（50字内），要有同理心，语气自然，就像平时朋友点进朋友圈聊天一样。`;
  }
  const userMessage = { role: "user", content: userMsgContent };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiApiKey}` },
    body: JSON.stringify({ model: modelToUse, messages: [systemMessage, userMessage], max_tokens: 150, temperature: temperatureToUse })
  });

  if (!response.ok) throw new Error('API Error');
  const data = await response.json();
  const aiCommentContent = data.choices[0].message.content.trim();

  const parentId = targetComment ? targetComment.id : null;
  await addComment(diaryId, aiCommentContent, parentId, AI_COMPANION_USER_ID, aiPersonaName, activeChar.avatar || '🤖');
  
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
        const aiConfig = currentUserData.aiConfig || {};
        const activeApi = (aiConfig.apis || []).find(a => a.id === aiConfig.activeApiId) || (aiConfig.apis || [])[0];
        if (!activeApi || !activeApi.key) {
            throw new Error('请先配置 API Key');
        }

        const messagesSnap = await db.collection('conversations').doc(conversationId).collection('messages')
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();
        
        const conversationHistory = messagesSnap.docs.reverse().map(doc => {
            const msg = doc.data();
            return {
                role: msg.senderId === currentUser.uid ? 'user' : 'assistant',
                content: msg.text
            };
        });

        const activeChar = (aiConfig.chars || []).find(c => c.id === aiConfig.activeCharId) || (aiConfig.chars || [])[0] || {};
        const activePersona = activeChar.boundPersonaId ? (aiConfig.personas || []).find(p => p.id === activeChar.boundPersonaId) : null;
        const enabledWorldbooks = (aiConfig.worldbooks || []).filter(w => w.isEnabled && (w.isGlobal || w.boundCharId === activeChar.id));
        let wbText = enabledWorldbooks.map(w => `- ${w.content}`).join('\n');

        const aiApiKey = activeApi.key;
        let baseUrl = (activeApi.url || 'https://api.openai.com/v1').replace(/\/+$/, '');
        const apiUrl = baseUrl.endsWith('/chat/completions') ? baseUrl : baseUrl + '/chat/completions';

        let finalPrompt = activeChar.prompt || '你是一个温柔体贴的陪伴者。';
        if (activeChar.memory) finalPrompt += '\n\n【过往经历】\n' + activeChar.memory;
        if (activePersona && activePersona.prompt) finalPrompt += '\n\n【主人的背景自设】\n' + activePersona.prompt;
        if (wbText) finalPrompt += '\n\n【世界设定与必须遵守的规则 (Worldbook)】\n' + wbText;
        if (activeChar.coreMemory) finalPrompt += '\n\n【核心记忆】\n' + activeChar.coreMemory;
        if (activeChar.archivedMemory) finalPrompt += '\n\n【记忆归档】\n' + activeChar.archivedMemory;
        if (activeChar.shortTermMemory) finalPrompt += '\n\n【近期记忆】\n' + activeChar.shortTermMemory;
        finalPrompt += '\n\n【核心任务】你正在和主人进行一对一私聊。请根据设定和聊天记录自然回复。\n【重要排版指令】为了像真人打字聊天一样，你的回复**必须拆分成2~4条极短的对话**！每句话占一行，严格使用换行符(\\n)隔开！绝对不能把所有话揉成一大段！';

        const modelToUse = activeApi.model || "gpt-3.5-turbo";
        const temperatureToUse = activeApi.temperature !== undefined ? activeApi.temperature : 0.7;

        const messages = [ { role: "system", content: finalPrompt }, ...conversationHistory ];

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiApiKey}` },
            body: JSON.stringify({ model: modelToUse, messages: messages, max_tokens: 250, temperature: temperatureToUse })
        });

        if (!response.ok) throw new Error('AI Chat API Error');
        const data = await response.json();
        const aiResponseText = data.choices[0].message.content.trim();

        const convRef = db.collection('conversations').doc(conversationId);
        
        // 拟人化处理：按换行符切分为多条消息，并逐条延时发送
        const lines = aiResponseText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        for (let i = 0; i < lines.length; i++) {
            const lineText = lines[i];
            // 使用 sendMessage 函数来发送 AI 的回复，携带 AI 的专属身份 ID，并静默发送
            await sendMessage(conversationId, lineText, true, AI_COMPANION_USER_ID); 
            
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