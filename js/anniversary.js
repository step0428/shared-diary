// 初始化纪念日功能
function initAnniversary() {
  var addBtn = document.getElementById('addAnniversaryBtn');
  var saveBtn = document.getElementById('saveAnniversaryBtn');
  var deleteBtn = document.getElementById('deleteAnniversaryBtn');
  var closeBtn = document.getElementById('closeAnniversaryModal');
  var cancelBtn = document.getElementById('cancelAnniversaryBtn');

  if (addBtn) addBtn.addEventListener('click', function() { openAnniversaryModal(); });
  if (saveBtn) saveBtn.addEventListener('click', saveAnniversary);
  if (deleteBtn) deleteBtn.addEventListener('click', deleteAnniversary);
  if (closeBtn) closeBtn.addEventListener('click', closeAnniversaryModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeAnniversaryModal);

  // 模态框 backdrop 点击关闭
  var modal = document.getElementById('anniversaryModal');
  if (modal) {
    var backdrop = modal.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', closeAnniversaryModal);
    }
  }

  var detailCloseBtn = document.getElementById('closeAnniversaryDetailModal');
  if (detailCloseBtn) {
    detailCloseBtn.addEventListener('click', function() { document.getElementById('anniversaryDetailModal').classList.add('hidden'); });
  }

  // 图标选择事件
  var iconSelect = document.getElementById('anniversaryIconSelect');
  if (iconSelect) {
    iconSelect.addEventListener('click', function(e) {
      if (e.target.classList.contains('icon-option')) {
        iconSelect.querySelectorAll('.icon-option').forEach(function(el) { el.classList.remove('selected'); });
        e.target.classList.add('selected');
      }
    });
  }

  var visibilitySelect = document.getElementById('anniversaryVisibility');
  if (visibilitySelect) {
    visibilitySelect.addEventListener('change', function(e) {
      document.getElementById('anniversaryShareSelectRow').classList.toggle('hidden', e.target.value !== 'shared');
    });
  }

  var coAuthorCheck = document.getElementById('anniversaryCoAuthorCheck');
  if (coAuthorCheck) {
    coAuthorCheck.addEventListener('change', function(e) {
      var hint = document.getElementById('anniversaryCoAuthorsHint');
      var list = document.getElementById('anniversaryCoAuthorsList');
      if (e.target.checked) {
        hint.style.display = 'block';
        list.style.display = 'flex';
        loadAnniversaryCoAuthors();
      } else {
        hint.style.display = 'none';
        list.style.display = 'none';
      }
    });
  }

  // 新增：初始化纪念日批量删除 UI
  setupAnniversaryBatchDelete();
}

// 设置纪念日批量删除
function setupAnniversaryBatchDelete() {
  var view = document.getElementById('anniversaryView');
  var list = document.getElementById('anniversaryList');
  if (!view || !list || document.getElementById('annBatchControls')) return;

  var controls = document.createElement('div');
  controls.id = 'annBatchControls';
  controls.style.cssText = 'display:flex; justify-content:flex-end; align-items:center; margin-bottom:15px;';
  
  controls.innerHTML = 
    '<div id="annBatchToggleWrap">' +
      '<button id="annBatchToggleBtn" style="padding:6px 16px; background:var(--bg-tertiary); border:1px solid var(--border); border-radius:20px; color:var(--text-primary); cursor:pointer; font-size:13px; display:flex; align-items:center; gap:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> 批量管理</button>' +
    '</div>' +
    '<div id="annBatchActions" class="hidden" style="display:flex; align-items:center; gap:15px; flex:1; justify-content:space-between; background:var(--bg-tertiary); padding:8px 15px; border-radius:12px; border:1px solid var(--border);">' +
      '<label style="display:flex; align-items:center; gap:6px; font-size:13px; color:var(--text-primary); cursor:pointer; margin:0;">' +
        '<input type="checkbox" id="annSelectAllCb" style="width:16px;height:16px;margin:0;"> 全选' +
      '</label>' +
      '<div style="display:flex; gap:10px;">' +
        '<button id="annBatchCancelBtn" style="padding:6px 12px; background:transparent; border:1px solid var(--border); border-radius:8px; color:var(--text-primary); cursor:pointer; font-size:12px;">取消</button>' +
        '<button id="annBatchDeleteBtn" style="padding:6px 12px; background:rgba(255,100,100,0.15); border:1px solid rgba(255,100,100,0.3); border-radius:8px; color:#ff6b6b; cursor:pointer; font-size:12px;">删除选中</button>' +
      '</div>' +
    '</div>';
  
  list.parentNode.insertBefore(controls, list);

  var toggleBtn = document.getElementById('annBatchToggleBtn');
  var actionsBar = document.getElementById('annBatchActions');
  var toggleWrap = document.getElementById('annBatchToggleWrap');
  var selectAllCb = document.getElementById('annSelectAllCb');
  var cancelBtn = document.getElementById('annBatchCancelBtn');
  var deleteBtn = document.getElementById('annBatchDeleteBtn');

  function exitBatchMode() {
    actionsBar.classList.add('hidden');
    toggleWrap.style.display = 'block';
    document.querySelectorAll('.ann-checkbox').forEach(function(cb) {
      cb.style.display = 'none';
      cb.checked = false;
    });
    selectAllCb.checked = false;
  }

  toggleBtn.addEventListener('click', function() {
    actionsBar.classList.remove('hidden');
    toggleWrap.style.display = 'none';
    document.querySelectorAll('.ann-checkbox').forEach(function(cb) {
      cb.style.display = 'block';
    });
  });

  cancelBtn.addEventListener('click', exitBatchMode);

  selectAllCb.addEventListener('change', function(e) {
    var isChecked = e.target.checked;
    document.querySelectorAll('.ann-checkbox').forEach(function(cb) {
      if(cb.style.display !== 'none') cb.checked = isChecked;
    });
  });

  deleteBtn.addEventListener('click', async function() {
    var checkedCbs = document.querySelectorAll('.ann-checkbox:checked');
    if (checkedCbs.length === 0) {
      alert('请先选择要删除的纪念日');
      return;
    }
    if (!confirm('确定要删除选中的 ' + checkedCbs.length + ' 个纪念日吗？')) return;

    var origText = deleteBtn.textContent;
    deleteBtn.textContent = '删除中...';
    deleteBtn.disabled = true;

    try {
      var batch = db.batch();
      checkedCbs.forEach(function(cb) {
        var annId = cb.value;
        var ref = db.collection('anniversaries').doc(annId);
        batch.delete(ref);
      });
      await batch.commit();
      
      exitBatchMode();
      loadAnniversaries();
      if (typeof refreshCalendar === 'function') refreshCalendar();
    } catch(err) {
      console.error('批量删除失败:', err);
      alert('批量删除失败，请重试');
    } finally {
      deleteBtn.textContent = origText;
      deleteBtn.disabled = false;
    }
  });
}

// 打开模态框
function openAnniversaryModal(anniversary) {
  var modal = document.getElementById('anniversaryModal');
  if (!modal) {
    console.error('anniversaryModal not found!');
    return;
  }
  var title = document.getElementById('anniversaryModalTitle');
  var idInput = document.getElementById('anniversaryId');
  var titleInput = document.getElementById('anniversaryTitle');
  var dateInput = document.getElementById('anniversaryDate');
  var repeatingInput = document.getElementById('anniversaryRepeating');
  var celebrationTextInput = document.getElementById('anniversaryCelebrationText');
  var deleteBtn = document.getElementById('deleteAnniversaryBtn');
  
  // 重置图标选中状态
  var iconOptions = document.querySelectorAll('#anniversaryIconSelect .icon-option');
  iconOptions.forEach(function(el) { el.classList.remove('selected'); });

  document.getElementById('anniversaryVisibility').value = 'public';
  document.getElementById('anniversaryShareSelectRow').classList.add('hidden');
  document.getElementById('anniversaryCoAuthorCheck').checked = false;
  document.getElementById('anniversaryCoAuthorsHint').style.display = 'none';
  document.getElementById('anniversaryCoAuthorsList').style.display = 'none';

  if (anniversary) {
    title.textContent = '编辑纪念日';
    idInput.value = anniversary.id;
    titleInput.value = anniversary.title;
    dateInput.value = anniversary.date;
    repeatingInput.checked = anniversary.isRepeating;
    celebrationTextInput.value = anniversary.celebrationText || '';
    deleteBtn.classList.remove('hidden');
    
    var targetIcon = anniversary.icon || '💝';
    var selectedEl = document.querySelector('#anniversaryIconSelect .icon-option[data-icon="' + targetIcon + '"]');
    if (selectedEl) selectedEl.classList.add('selected');

    document.getElementById('anniversaryVisibility').value = anniversary.visibility || 'public';
    if (anniversary.visibility === 'shared') {
      document.getElementById('anniversaryShareSelectRow').classList.remove('hidden');
    }
    if (anniversary.coAuthors && anniversary.coAuthors.length > 0) {
      document.getElementById('anniversaryCoAuthorCheck').checked = true;
      document.getElementById('anniversaryCoAuthorsHint').style.display = 'block';
      document.getElementById('anniversaryCoAuthorsList').style.display = 'flex';
    }

    loadAnniversaryShareUsers().then(function() {
      if (anniversary.visibility === 'shared' && anniversary.sharedWith) {
        anniversary.sharedWith.forEach(function(uid) {
          var cb = document.querySelector('#anniversaryShareList input[value="' + uid + '"]');
          if (cb) { cb.checked = true; cb.closest('.share-item').classList.add('selected'); }
        });
      }
    });
    loadAnniversaryCoAuthors().then(function() {
      if (anniversary.coAuthors && anniversary.coAuthors.length > 0) {
        anniversary.coAuthors.forEach(function(uid) {
          if (uid !== currentUser.uid) {
            var cb = document.querySelector('#anniversaryCoAuthorsList input[value="' + uid + '"]');
            if (cb) { cb.checked = true; cb.closest('.share-item').classList.add('selected'); }
          }
        });
      }
    });
  } else {
    title.textContent = '添加纪念日';
    idInput.value = '';
    titleInput.value = '';
    var today = new Date();
    dateInput.value = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    repeatingInput.checked = false;
    celebrationTextInput.value = '';
    deleteBtn.classList.add('hidden');
    iconOptions[0].classList.add('selected'); // 默认选中第一个
    loadAnniversaryShareUsers();
  }

  modal.classList.remove('hidden');
  titleInput.focus();
}

function closeAnniversaryModal() {
  document.getElementById('anniversaryModal').classList.add('hidden');
}

// 精确计算几年几个月几天
function getExactYMD(date1, date2) {
  var d1 = new Date(date1);
  var d2 = new Date(date2);
  if (d1 > d2) { var t = d1; d1 = d2; d2 = t; }

  var years = d2.getFullYear() - d1.getFullYear();
  var months = d2.getMonth() - d1.getMonth();
  var days = d2.getDate() - d1.getDate();

  if (days < 0) {
    months--;
    var tempDate = new Date(d2.getFullYear(), d2.getMonth(), 0);
    days += tempDate.getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  var res = [];
  if (years > 0) res.push(years + '年');
  if (months > 0) res.push(months + '个月');
  if (days > 0 || res.length === 0) res.push(days + '天');
  return res.join('');
}

// 计算天数
function calculateDays(dateStr, isRepeating) {
  if (!dateStr) return { type: 'today', days: 0, targetDate: new Date(), originalDate: new Date(), isAnniversaryToday: false };
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var original = new Date(dateStr + 'T00:00:00');
  
  // 距离原起点的天数（正数表示已经过去，负数表示还没到）
  var diffOriginal = Math.round((today - original) / (1000 * 60 * 60 * 24));

  var target = new Date(dateStr + 'T00:00:00');
  // 对于重复纪念日，调整到今年或明年
  if (isRepeating) {
    target.setFullYear(today.getFullYear());
    if (target < today) {
      target.setFullYear(today.getFullYear() + 1);
    }
  }

  // 距离下一次目标日期的天数（日历需要）
  var diffTarget = Math.round((target - today) / (1000 * 60 * 60 * 24));

  var type, displayDays;

  // 今天是纪念日（无论重不重复）
  if (diffTarget === 0) {
    type = 'today';
    displayDays = 0;
  } else if (diffOriginal > 0 && !isRepeating) {
    // 非重复纪念日已过 → 显示正数（相识多少天）
    type = 'countup';
    displayDays = diffOriginal;
  } else if (diffTarget > 0 && isRepeating) {
    // 重复纪念日已过（但还没到明年）→ 这种情况不应该发生，但为了安全显示倒计时
    type = 'countdown';
    displayDays = diffTarget;
  } else {
    // 还没到纪念日 → 显示倒数
    type = 'countdown';
    displayDays = Math.abs(diffOriginal);
  }
  
  return { type: type, days: displayDays, targetDate: target, originalDate: original, isAnniversaryToday: diffTarget === 0 };
}

// 显示纪念日详情
async function showAnniversaryDetail(anniversaryId) {
  try {
    var doc = await db.collection('anniversaries').doc(anniversaryId).get();
    if (!doc.exists) return;
    var data = doc.data();

    var modal = document.getElementById('anniversaryDetailModal');
    var content = document.getElementById('anniversaryDetailContent');
    var actions = document.getElementById('anniversaryDetailActions');

    var result = calculateDays(data.date, data.isRepeating);
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var daysDisplay = result.days;
    var daysText = '';
    var ymdText = '';

    if (result.type === 'countdown') {
      daysText = '还有 ' + result.days + ' 天';
      ymdText = getExactYMD(today, result.targetDate);
    } else if (result.type === 'countup') {
      daysText = '已经 ' + result.days + ' 天';
      ymdText = getExactYMD(result.originalDate, today);
    } else {
      daysDisplay = '🎉';
      daysText = '就是今天';
      ymdText = '0天';
    }

    var userIds = [data.userId];
    if (data.coAuthors) {
      data.coAuthors.forEach(function(uid) { if (userIds.indexOf(uid) === -1) userIds.push(uid); });
    }
    
    let aiIds = userIds.filter(id => String(id).startsWith('char_'));
    let queryIds = userIds.filter(id => !String(id).startsWith('char_'));
    var userInfos = queryIds.length > 0 ? await getBatchUserInfo(queryIds) : [];
    var userMap = {};
    userInfos.forEach(function(u) { userMap[u.userId] = u; });
    
    aiIds.forEach(function(aiId) {
       let aiConfig = currentUserData && currentUserData.aiConfig ? currentUserData.aiConfig : {};
       let activeChar = (aiConfig.chars || []).find(c => c.id === aiId) || (aiConfig.chars || []).find(c => c.id === aiConfig.activeCharId) || (aiConfig.chars || [])[0] || {};
       userMap[aiId] = {
           userId: aiId,
           displayName: (activeChar.name || '神秘的ta') + ' 🤖',
           avatarUrl: '',
           aiAvatar: activeChar.avatar || '🤖'
       };
    });

    var iconDisplay = data.icon || '💝';
    var visibilityText = {
      'private': '仅自己可见',
      'shared': '部分好友可见',
      'public': '所有好友可见',
      'co-authored': '共同纪念日'
    }[data.visibility || 'public'] || '';

    var isPendingCoAuthor = data.coAuthors && data.coAuthors.indexOf(currentUser.uid) !== -1 && data.userId !== currentUser.uid && (!data.acceptedCoAuthors || data.acceptedCoAuthors.indexOf(currentUser.uid) === -1);
    var canEdit = (data.userId === currentUser.uid || (data.coAuthors && data.coAuthors.indexOf(currentUser.uid) !== -1)) && !isPendingCoAuthor;

    var daysFontSize = result.type === 'today' ? '4rem' : '3.5rem';

    var avatarHtml = '';
    var isCoAuthored = data.visibility === 'co-authored' && data.coAuthors && data.coAuthors.length > 0;
    if (isCoAuthored) {
      var avatars = [];
      var creatorData = userMap[data.userId];
      if (creatorData) avatars.push(renderUserAvatar(creatorData, 28, '4px', creatorData.displayName));
      var accepted = data.acceptedCoAuthors || [];
      data.coAuthors.forEach(function(uid) {
        if (uid !== data.userId && accepted.indexOf(uid) !== -1) {
          var coData = userMap[uid];
          if (coData) avatars.push(renderUserAvatar(coData, 28, '4px', coData.displayName));
        }
      });
      avatarHtml = '<div style="display:flex;justify-content:center;margin-top:15px;margin-bottom:5px;">' + avatars.join('') + '</div>';
    } else {
      var creatorData = userMap[data.userId];
      if (creatorData) {
        avatarHtml = '<div style="display:flex;justify-content:center;margin-top:15px;margin-bottom:5px;">' + renderUserAvatar(creatorData, 28, '0', creatorData.displayName) + '</div>';
      }
    }
    
    window.toggleAnniversaryDetailYMD = function(el) {
      if (result.type === 'today') return;
      var isYMD = el.getAttribute('data-show-ymd') === 'true';
      if (isYMD) {
        el.innerText = daysDisplay;
        el.style.fontSize = daysFontSize;
        el.setAttribute('data-show-ymd', 'false');
      } else {
        el.innerText = ymdText;
        el.style.fontSize = '1.8rem';
        el.setAttribute('data-show-ymd', 'true');
      }
    };

    content.innerHTML = '<div style="font-size:12px;color:var(--text-muted);margin-bottom:15px;display:inline-block;background:var(--bg-tertiary);padding:4px 10px;border-radius:12px;">' + visibilityText + '</div>' +
      '<div class="days-count" style="font-size:' + daysFontSize + ';font-weight:bold;color:var(--accent);line-height:1;margin-bottom:10px;cursor:pointer;text-shadow:' + (result.type === 'today' ? '0 0 15px var(--accent-light)' : 'none') + ';" data-show-ymd="false" onclick="toggleAnniversaryDetailYMD(this)">' + daysDisplay + '</div>' +
      '<div style="font-size:14px;color:var(--text-muted);margin-bottom:20px;">' + daysText + '</div>' +
      '<div style="font-size:20px;font-weight:500;color:var(--text-primary);margin-bottom:8px;">' + iconDisplay + ' ' + escapeHtml(data.title) + '</div>' +
      '<div style="font-size:14px;color:var(--text-muted);">' + data.date + (data.isRepeating ? ' 🔄' : '') + '</div>' +
      avatarHtml;

    actions.innerHTML = '';
    if (canEdit) {
      actions.innerHTML = '<button id="detailEditAnnBtn" style="padding:10px 30px;background:var(--accent-light);border:1px solid var(--accent);border-radius:8px;color:var(--accent);font-size:14px;cursor:pointer;transition:all 0.2s;">编辑</button>';
    }

    modal.classList.remove('hidden');

    if (canEdit) {
      document.getElementById('detailEditAnnBtn').onclick = function() {
        modal.classList.add('hidden');
        openAnniversaryModal({
          id: doc.id,
          title: data.title,
          date: data.date,
          isRepeating: data.isRepeating,
          icon: data.icon,
          visibility: data.visibility || 'public',
        celebrationText: data.celebrationText || '',
          sharedWith: data.sharedWith || [],
          coAuthors: data.coAuthors || []
        });
      };
    }
  } catch (e) {
    console.error('加载纪念日详情失败:', e);
  }
}

// 获取所有纪念日（用于日历）
async function getAllAnniversariesForCalendar() {
  if (!currentUser) return [];

  try {
    var snapshot = await db.collection('anniversaries').get();
    var linkedIds = await getLinkedUserIds();

    var anniversaries = [];
    snapshot.forEach(function(doc) {
      var data = doc.data();
      if (isDiaryVisible(data, currentUser.uid, linkedIds, activeFilters, { checkAcceptance: true })) {
        anniversaries.push({
          id: doc.id,
          title: data.title,
          date: data.date,
          isRepeating: data.isRepeating,
          icon: data.icon || '💝',
          visibility: data.visibility || 'public',
          sharedWith: data.sharedWith || [],
          coAuthors: data.coAuthors || [],
          userId: data.userId
        });
      }
    });
    return anniversaries;
  } catch (e) {
    console.error('获取纪念日失败:', e);
    return [];
  }
}

// 加载纪念日列表
async function loadAnniversaries() {
  var listEl = document.getElementById('anniversaryList');

  if (!currentUser) {
    listEl.innerHTML = '<div class="anniversary-empty">请先登录</div>';
    return;
  }

  listEl.innerHTML = '<div class="anniversary-empty">加载中...</div>';

  try {
    var snapshot = await db.collection('anniversaries').get();
    var linkedIds = await getLinkedUserIds();

    listEl.innerHTML = '';

    var validAnniversaries = [];
    var userIds = [];

    snapshot.forEach(function(doc) {
      var data = doc.data();
      if (isDiaryVisible(data, currentUser.uid, linkedIds, activeFilters)) {
        validAnniversaries.push({ id: doc.id, data: data });
        if (userIds.indexOf(data.userId) === -1) userIds.push(data.userId);
        if (data.coAuthors) {
          data.coAuthors.forEach(function(uid) { if (userIds.indexOf(uid) === -1) userIds.push(uid); });
        }
      }
    });

    if (validAnniversaries.length === 0) {
      listEl.innerHTML = '<div class="anniversary-empty">还没有纪念日，点击右上角+添加一个吧</div>';
      return;
    }

    var userMap = {};
    let aiIds = userIds.filter(id => String(id).startsWith('char_'));
    let queryIds = userIds.filter(id => !String(id).startsWith('char_'));
    if (queryIds.length > 0) {
      var userInfos = await getBatchUserInfo(queryIds);
      userInfos.forEach(function(u) { userMap[u.userId] = u; });
    }
    
    // 如果纪念日里有 AI，向 map 中注入 AI 身份信息
    aiIds.forEach(function(aiId) {
       let aiConfig = currentUserData && currentUserData.aiConfig ? currentUserData.aiConfig : {};
       let activeChar = (aiConfig.chars || []).find(c => c.id === aiId) || (aiConfig.chars || []).find(c => c.id === aiConfig.activeCharId) || (aiConfig.chars || [])[0] || {};
       userMap[aiId] = {
           userId: aiId,
           displayName: (activeChar.name || '神秘的ta') + ' 🤖',
           avatarUrl: '',
           aiAvatar: activeChar.avatar || '🤖'
       };
    });

    validAnniversaries.forEach(function(ann) {
      renderAnniversaryCard(ann, userMap);
    });

    // 新增：如果当前处于批量管理模式，下拉刷新或重载后保持复选框的显示状态
    var actionsBar = document.getElementById('annBatchActions');
    if (actionsBar && !actionsBar.classList.contains('hidden')) {
      document.querySelectorAll('.ann-checkbox').forEach(function(cb) {
        cb.style.display = 'block';
      });
      var selectAllCb = document.getElementById('annSelectAllCb');
      if (selectAllCb) selectAllCb.checked = false;
    }
  } catch (e) {
    console.error('加载纪念日失败:', e);
    listEl.innerHTML = '<div class="anniversary-empty">加载失败</div>';
  }
}

// 渲染纪念日卡片
function renderAnniversaryCard(anniversary, userMap) {
  var listEl = document.getElementById('anniversaryList');
  var data = anniversary.data;

  var result = calculateDays(data.date, data.isRepeating);

  var card = document.createElement('div');
  card.className = 'anniversary-card' + (result.type === 'today' ? ' type-today' : '');

  var daysText = '';
  var daysDisplay = result.days;

  if (result.type === 'countdown') {
    daysText = '还有 ' + result.days + ' 天';
  } else if (result.type === 'countup') {
    daysText = '已经 ' + result.days + ' 天';
  } else {
    daysDisplay = '🎉';
    daysText = '就是今天';
  }
  
  var iconDisplay = data.icon || '💝';
  var ymdText = '';
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // 计算年月日的字符串
  if (result.type === 'countup') {
    ymdText = getExactYMD(result.originalDate, today);
  } else if (result.type === 'countdown') {
    ymdText = getExactYMD(today, result.targetDate);
  }

  var visibilityText = {
    'private': '仅自己可见',
    'shared': '部分好友可见',
    'public': '所有好友可见',
    'co-authored': '共同纪念日'
  }[data.visibility || 'public'] || '';
  
  var isPendingCoAuthor = data.coAuthors && data.coAuthors.indexOf(currentUser.uid) !== -1 && data.userId !== currentUser.uid && (!data.acceptedCoAuthors || data.acceptedCoAuthors.indexOf(currentUser.uid) === -1);

  var avatarHtml = '';
  var isCoAuthored = data.visibility === 'co-authored' && data.coAuthors && data.coAuthors.length > 0;
  if (userMap) {
    if (isCoAuthored) {
      var avatars = [];
      var creatorData = userMap[data.userId];
      if (creatorData) avatars.push(renderUserAvatar(creatorData, 22, '2px', creatorData.displayName));
      var accepted = data.acceptedCoAuthors || [];
      data.coAuthors.forEach(function(uid) {
        if (uid !== data.userId && accepted.indexOf(uid) !== -1) {
          var coData = userMap[uid];
          if (coData) avatars.push(renderUserAvatar(coData, 22, '2px', coData.displayName));
        }
      });
      avatarHtml = '<div style="display:flex;justify-content:center;margin-top:12px;gap:2px;">' + avatars.join('') + '</div>';
    } else {
      var creatorData = userMap[data.userId];
      if (creatorData) avatarHtml = '<div style="display:flex;justify-content:center;margin-top:12px;">' + renderUserAvatar(creatorData, 22, '0', creatorData.displayName) + '</div>';
    }
  }

  var pendingOverlay = '';
  if (isPendingCoAuthor) {
    pendingOverlay = '<div style="position:absolute;inset:0;background:var(--bg-secondary);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:10;border:1px solid var(--accent);">' +
      '<div style="font-size:14px;margin-bottom:15px;color:var(--text-primary);">邀请你共建此纪念日</div>' +
      '<div style="display:flex;gap:10px;">' +
        '<button class="reject-co-btn" style="padding:6px 16px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:15px;color:var(--text-secondary);font-size:12px;cursor:pointer;">拒绝</button>' +
        '<button class="accept-co-btn" style="padding:6px 16px;background:var(--accent-light);border:1px solid var(--accent);border-radius:15px;color:var(--accent);font-size:12px;cursor:pointer;">接受</button>' +
      '</div></div>';
  }

  var canEdit = (data.userId === currentUser.uid || (data.coAuthors && data.coAuthors.indexOf(currentUser.uid) !== -1)) && !isPendingCoAuthor;

  var actionsHtml = canEdit ? '<div class="card-actions"><button class="edit-btn" data-id="' + anniversary.id + '">编辑</button></div>' : '';
  
  // 新增：批量操作复选框（只有拥有编辑/删除权限的卡片才会渲染它）
  var checkboxHtml = canEdit ? '<input type="checkbox" class="ann-checkbox" value="' + anniversary.id + '" style="position:absolute; top:12px; right:12px; z-index:20; display:none; width:18px; height:18px; cursor:pointer;">' : '';

  card.innerHTML = pendingOverlay + actionsHtml + checkboxHtml +
    '<div style="position:absolute;top:12px;left:12px;font-size:11px;color:var(--text-muted);background:var(--bg-tertiary);padding:3px 8px;border-radius:10px;">' + visibilityText + '</div>' +
    '<div class="days-count" title="点击切换显示格式">' + daysDisplay + '</div>' +
    '<div class="days-text">' + daysText + '</div>' +
    '<div class="anniversary-title">' + iconDisplay + ' ' + escapeHtml(data.title) + '</div>' +
    '<div class="anniversary-date">' + data.date + (data.isRepeating ? ' 🔄' : '') + '</div>' + 
    avatarHtml;

  listEl.appendChild(card);
  
  // 点击数字切换年月日格式
  var countEl = card.querySelector('.days-count');
  var showYMD = false;
  if (result.type !== 'today') {
    countEl.addEventListener('click', function() {
      showYMD = !showYMD;
      countEl.innerText = showYMD ? ymdText : daysDisplay;
      countEl.style.fontSize = showYMD ? '1.8rem' : ''; // 文字过长时缩小字体
    });
  }

  if (isPendingCoAuthor) {
    card.querySelector('.accept-co-btn').addEventListener('click', async function(e) {
      e.stopPropagation();
      await db.collection('anniversaries').doc(anniversary.id).update({ acceptedCoAuthors: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
      loadAnniversaries();
      if (typeof refreshCalendar === 'function') refreshCalendar();
    });
    card.querySelector('.reject-co-btn').addEventListener('click', async function(e) {
      e.stopPropagation();
      await db.collection('anniversaries').doc(anniversary.id).update({ coAuthors: firebase.firestore.FieldValue.arrayRemove(currentUser.uid), acceptedCoAuthors: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
      loadAnniversaries();
    });
  }

  // 编辑按钮事件
  if (canEdit) {
    card.querySelector('.edit-btn').addEventListener('click', function() {
      openAnniversaryModal({
        id: anniversary.id,
        title: data.title,
        date: data.date,
        isRepeating: data.isRepeating,
        icon: data.icon,
        visibility: data.visibility || 'public',
        celebrationText: data.celebrationText || '',
        sharedWith: data.sharedWith || [],
        coAuthors: data.coAuthors || []
      });
    });
  }
}

// 保存纪念日
async function saveAnniversary() {
  var idInput = document.getElementById('anniversaryId');
  var titleInput = document.getElementById('anniversaryTitle');
  var dateInput = document.getElementById('anniversaryDate');
  var repeatingInput = document.getElementById('anniversaryRepeating');
  var celebrationTextInput = document.getElementById('anniversaryCelebrationText');

  var title = titleInput.value.trim();
  var date = dateInput.value;
  var isRepeating = repeatingInput.checked;
  
  var selectedIconEl = document.querySelector('#anniversaryIconSelect .icon-option.selected');
  var icon = selectedIconEl ? selectedIconEl.dataset.icon : '💝';

  var visibility = document.getElementById('anniversaryVisibility').value;
  var sharedWith = [];
  if (visibility === 'shared') {
    document.querySelectorAll('#anniversaryShareList input:checked').forEach(function(cb) {
      sharedWith.push(cb.value);
    });
  }

  var coAuthors = [];
  if (document.getElementById('anniversaryCoAuthorCheck').checked) {
    document.querySelectorAll('#anniversaryCoAuthorsList input:checked').forEach(function(cb) {
      if (coAuthors.indexOf(cb.value) === -1) coAuthors.push(cb.value);
    });
    if (coAuthors.indexOf(currentUser.uid) === -1) coAuthors.push(currentUser.uid);
    visibility = 'co-authored';
  }

  if (!title) {
    titleInput.focus();
    return;
  }

  if (!date) {
    dateInput.focus();
    return;
  }

  var data = {
    title: title,
    date: date,
    icon: icon,
    isRepeating: isRepeating,
    celebrationText: celebrationTextInput.value.trim(),
    visibility: visibility,
    sharedWith: visibility === 'shared' ? sharedWith : []
  };

  if (coAuthors.length > 0) {
    data.coAuthors = coAuthors;
    if (idInput.value) {
      data.acceptedCoAuthors = firebase.firestore.FieldValue.arrayUnion(currentUser.uid);
    } else {
      data.acceptedCoAuthors = [currentUser.uid];
    }
  } else {
    // 非共建纪念日，不设置这两个字段即可
  }

  try {
    if (idInput.value) {
      // 更新
      await db.collection('anniversaries').doc(idInput.value).update(data);
    } else {
      // 新增
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      data.userId = currentUser.uid;
      await db.collection('anniversaries').add(data);
    }

    closeAnniversaryModal();
    loadAnniversaries();
  } catch (e) {
    console.error('保存纪念日失败:', e);
    alert('保存失败');
  }
}

// 删除纪念日
async function deleteAnniversary() {
  var idInput = document.getElementById('anniversaryId');
  var titleInput = document.getElementById('anniversaryTitle').value;

  if (!confirm('确定要删除 "' + titleInput + '" 吗？')) {
    return;
  }

  try {
    await db.collection('anniversaries').doc(idInput.value).delete();
    closeAnniversaryModal();
    loadAnniversaries();
  } catch (e) {
    console.error('删除纪念日失败:', e);
    alert('删除失败');
  }
}

// 加载分享用户列表（用于纪念日）
async function loadAnniversaryShareUsers() {
  var shareList = document.getElementById('anniversaryShareList');
  if (!shareList) return;
  shareList.innerHTML = '';
  var linkedIds = await getLinkedUserIds();
  if (linkedIds.length === 0) {
    shareList.innerHTML = '<span style="font-size:13px;color:var(--text-muted)">暂无链接的人</span>';
    return;
  }
  var userInfos = await getBatchUserInfo(linkedIds);
  userInfos.forEach(function(userData) {
    var item = document.createElement('label');
    item.className = 'share-item';
    item.innerHTML = '<input type="checkbox" value="' + userData.userId + '"><span>' + escapeHtml(userData.displayName) + '</span>';
    var checkbox = item.querySelector('input');
    checkbox.addEventListener('change', function() {
      this.closest('.share-item').classList.toggle('selected', this.checked);
    });
    shareList.appendChild(item);
  });
}

// 加载共建用户列表（用于纪念日）
async function loadAnniversaryCoAuthors() {
  var coAuthorsList = document.getElementById('anniversaryCoAuthorsList');
  if (!coAuthorsList) return;
  coAuthorsList.innerHTML = '';
  
  var linkedIds = await getLinkedUserIds();
  
  // 优先注入 AI
  if (currentUserData && currentUserData.aiConfig && currentUserData.aiConfig.enabled) {
    let chars = currentUserData.aiConfig.chars || [];
    chars.forEach(activeChar => {
      let aiName = (activeChar.name || '神秘的ta') + ' 🤖';
      var aiItem = document.createElement('label');
      aiItem.className = 'share-item';
      aiItem.innerHTML = '<input type="checkbox" value="' + activeChar.id + '"><span>' + escapeHtml(aiName) + '</span>';
      var aiCheckbox = aiItem.querySelector('input');
      aiCheckbox.addEventListener('change', function() {
        this.closest('.share-item').classList.toggle('selected', this.checked);
      });
      coAuthorsList.appendChild(aiItem);
    });
  }
  
  if (linkedIds.length === 0 && coAuthorsList.children.length === 0) {
    coAuthorsList.innerHTML = '<span style="font-size:13px;color:var(--text-muted)">暂无链接的人</span>';
    return;
  }
  if (linkedIds.length > 0) {
    var userInfos = await getBatchUserInfo(linkedIds);
    userInfos.forEach(function(userData) {
      var item = document.createElement('label');
      item.className = 'share-item';
      item.innerHTML = '<input type="checkbox" value="' + userData.userId + '"><span>' + escapeHtml(userData.displayName) + '</span>';
      var checkbox = item.querySelector('input');
      checkbox.addEventListener('change', function() {
        this.closest('.share-item').classList.toggle('selected', this.checked);
      });
      coAuthorsList.appendChild(item);
    });
  }
}

// 全局标记是否已经庆祝过，避免每次刷新都喷发
window.hasCelebrated = false;

async function checkAndTriggerCelebration() {
  if (window.hasCelebrated || !currentUser) return;

  try {
    var snapshot = await db.collection('anniversaries').get();
    var linkedIds = await getLinkedUserIds();
    var todayAnniversaries = [];

    snapshot.forEach(function(doc) {
      var data = doc.data();
      if (isDiaryVisible(data, currentUser.uid, linkedIds, activeFilters, { checkAcceptance: true })) {
        var result = calculateDays(data.date, data.isRepeating);
        if (result.type === 'today') {
          var text = data.celebrationText ? data.celebrationText : ('🎉 ' + data.title + ' 快乐！ 🎉');
          todayAnniversaries.push(text);
        }
      }
    });

    if (todayAnniversaries.length > 0) {
      window.hasCelebrated = true;
      triggerCelebrationEffect(todayAnniversaries);
    }
  } catch (e) {
    console.error('检查今日纪念日失败:', e);
  }
}

// 华丽的喷射彩带特效
function triggerCelebrationEffect(texts) {
  var canvas = document.getElementById('celebrationCanvas');
  if (!canvas) return;
  canvas.style.display = 'block';
  var ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  var particles = [];
  var colors = ['#fce18a', '#ff726d', '#b48def', '#f4306d', '#64b4ff', '#7dd99a'];
  var originX = canvas.width / 2;
  var originY = canvas.height;

  for (var i = 0; i < 150; i++) {
    particles.push({
      x: originX, y: originY,
      vx: (Math.random() - 0.5) * 25,     // 随机左右抛射
      vy: (Math.random() - 1) * 25 - 10,  // 向上抛射
      size: Math.random() * 10 + 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 15,
      life: 1.5 // 寿命
    });
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var active = false;

    if (texts && texts.length > 0) {
      ctx.save();
      var fontSize = window.innerWidth < 600 ? 24 : 40;
      ctx.font = 'bold ' + fontSize + 'px Noto Serif SC, sans-serif';
      ctx.fillStyle = 'rgba(255, 107, 107, ' + Math.min(1, particles[0].life) + ')';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(255,255,255,0.8)';
      ctx.shadowBlur = 15;
      
      var lineHeight = fontSize + 16;
      var startY = canvas.height / 3 - ((texts.length - 1) * lineHeight) / 2;
      for (var j = 0; j < texts.length; j++) {
        ctx.fillText(texts[j], canvas.width / 2, startY + j * lineHeight);
      }
      ctx.restore();
    }

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (p.life <= 0) continue;
      active = true;
      p.vy += 0.35; // 重力
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      p.life -= 0.006;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.5);
      ctx.restore();
    }

    if (active) {
      requestAnimationFrame(animate);
    } else {
      canvas.style.display = 'none';
    }
  }
  animate();
}
