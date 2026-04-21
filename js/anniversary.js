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
  
  if (diffTarget === 0) {
    type = 'today'; // 优先判断今天是不是纪念日（无论重不重复）
    displayDays = 0;
  } else if (diffOriginal > 0) {
    type = 'countup'; // 已经过去，永远显示正数（例如相识多少天）
    displayDays = diffOriginal;
  } else {
    type = 'countdown'; // 还没到，显示倒数
    displayDays = Math.abs(diffOriginal);
  }
  
  return { type: type, days: displayDays, targetDate: target, originalDate: original, isAnniversaryToday: diffTarget === 0 };
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
      if (isDiaryVisible(data, currentUser.uid, linkedIds, currentDiaryFilter)) {
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

    var hasAnniversary = false;
    snapshot.forEach(function(doc) {
      var data = doc.data();
      if (isDiaryVisible(data, currentUser.uid, linkedIds, currentDiaryFilter)) {
        hasAnniversary = true;
        var anniversary = { id: doc.id, data: data };
        renderAnniversaryCard(anniversary);
      }
    });

    if (!hasAnniversary) {
      listEl.innerHTML = '<div class="anniversary-empty">还没有纪念日，点击右上角+添加一个吧</div>';
    }
  } catch (e) {
    console.error('加载纪念日失败:', e);
    listEl.innerHTML = '<div class="anniversary-empty">加载失败</div>';
  }
}

// 渲染纪念日卡片
function renderAnniversaryCard(anniversary) {
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
    'shared': '仅链接对象可见',
    'public': '所有人可见',
    'co-authored': '共同纪念日'
  }[data.visibility || 'public'] || '';
  
  var canEdit = data.userId === currentUser.uid || (data.coAuthors && data.coAuthors.indexOf(currentUser.uid) !== -1);

  var actionsHtml = canEdit ? '<div class="card-actions"><button class="edit-btn" data-id="' + anniversary.id + '">编辑</button></div>' : '';

  card.innerHTML = actionsHtml +
    '<div style="position:absolute;top:12px;left:12px;font-size:11px;color:var(--text-muted);background:var(--bg-tertiary);padding:3px 8px;border-radius:10px;">' + visibilityText + '</div>' +
    '<div class="days-count" title="点击切换显示格式">' + daysDisplay + '</div>' +
    '<div class="days-text">' + daysText + '</div>' +
    '<div class="anniversary-title">' + iconDisplay + ' ' + escapeHtml(data.title) + '</div>' +
    '<div class="anniversary-date">' + data.date + (data.isRepeating ? ' 🔄' : '') + '</div>';

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
    visibility: visibility,
    sharedWith: visibility === 'shared' ? sharedWith : []
  };
  
  if (coAuthors.length > 0) {
    data.coAuthors = coAuthors;
  } else {
    data.coAuthors = firebase.firestore.FieldValue.delete(); // 如果取消勾选，则清除该字段
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
  if (linkedIds.length === 0) {
    coAuthorsList.innerHTML = '<span style="font-size:13px;color:var(--text-muted)">暂无链接的人</span>';
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
    coAuthorsList.appendChild(item);
  });
}
