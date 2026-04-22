// 颜色转换：将任意颜色值转为 rgba 并添加透明度
function hexToRgba(color, alpha) {
  // 如果已经是 rgba 格式，直接返回
  if (color.indexOf('rgba') === 0) {
    return color.replace(/[\d.]+\)$/, alpha + ')');
  }
  // 如果是 rgb 格式，转为 rgba
  if (color.indexOf('rgb') === 0) {
    return color.replace('rgb', 'rgba').replace(')', ', ' + alpha + ')');
  }
  // 解析十六进制颜色 #RGB 或 #RRGGBB
  let hex = color.replace('#', '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  // 如果不是有效的十六进制（如颜色名 red），用 canvas 转换
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    let canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    let ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    let d = ctx.getImageData(0, 0, 1, 1).data;
    return 'rgba(' + d[0] + ', ' + d[1] + ', ' + d[2] + ', ' + alpha + ')';
  }
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
}

// 用户信息缓存
let userInfoCache = {};

// 获取用户信息（从缓存，同步）
function getUserInfoFromCache(userId) {
  if (userInfoCache[userId]) {
    return userInfoCache[userId];
  }
  return { displayName: '未知用户', avatarUrl: '' };
}

// 预加载用户信息到缓存（批量获取）
async function preloadUserInfoCache(userIds) {
  if (!userIds || userIds.length === 0) return;

  let uniqueIds = [...new Set(userIds)];
  let batchSize = 10;

  for (let i = 0; i < uniqueIds.length; i += batchSize) {
    let batch = uniqueIds.slice(i, i + batchSize);
    let docs = await db.collection('users').where(firebase.firestore.FieldPath.documentId(), 'in', batch).get();
    docs.forEach(function(doc) {
      let data = doc.data();
      userInfoCache[doc.id] = {
        displayName: data.displayName || data.email || '未知用户',
        avatarUrl: data.avatarUrl || ''
      };
    });
  }
}

// 获取用户信息（从缓存或 Firestore）
async function getUserInfoForCalendar(userId) {
  if (userInfoCache[userId]) {
    return userInfoCache[userId];
  }
  // 如果缓存没有，单独获取（兼容少量场景）
  try {
    let userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      let data = userDoc.data();
      userInfoCache[userId] = {
        displayName: data.displayName || data.email || '未知用户',
        avatarUrl: data.avatarUrl || ''
      };
    } else {
      userInfoCache[userId] = { displayName: '未知用户', avatarUrl: '' };
    }
  } catch (e) {
    userInfoCache[userId] = { displayName: '未知用户', avatarUrl: '' };
  }
  return userInfoCache[userId];
}

// 日历实例
let calendar = null;

// 初始化日历
function initCalendar() {
  let calendarEl = document.getElementById('calendar');

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    height: 'auto',
    events: [],
    eventClick: handleCalendarEventClick,
    dateClick: handleCalendarDateClick,
    slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
    eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
    eventContent: function(arg) {
      // 如果是纪念日事件，使用特殊的加粗居中排版
      if (arg.event.extendedProps.isAnniversary) {
        return {
          html: '<div class="fc-event-main-content" style="display:flex;align-items:center;justify-content:center;padding:2px 4px;overflow:hidden;width:100%;box-sizing:border-box;font-weight:bold;letter-spacing:0.5px;">' +
                '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + arg.event.title + '</span>' +
                '</div>'
        };
      }

      let avatarUrl = arg.event.extendedProps.avatarUrl;
      let displayName = arg.event.extendedProps.displayName || '';
      let isCoAuthor = arg.event.extendedProps.isCoAuthor;
      let mood = arg.event.extendedProps.mood;
      let coAuthorAvatars = arg.event.extendedProps.coAuthorAvatars || [];

      let html = '<div class="fc-event-main-content" style="display:flex;align-items:center;gap:3px;padding:2px;overflow:hidden;width:100%;box-sizing:border-box;">';

      // 如果是共建记录，显示多个头像
      if (isCoAuthor && coAuthorAvatars.length > 0) {
        for (let i = 0; i < Math.min(coAuthorAvatars.length, 3); i++) {
          let avatar = coAuthorAvatars[i];
          if (avatar.url) {
            html += '<img src="' + avatar.url + '" style="width:16px;height:16px;border-radius:50%;object-fit:cover;border:1px solid rgba(255,255,255,0.5);" />';
          } else {
            html += '<div style="width:16px;height:16px;border-radius:50%;background:#7eb8da;display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;">' + (avatar.initial || '?') + '</div>';
          }
        }
        if (coAuthorAvatars.length > 3) {
          html += '<span style="font-size:9px;">+' + (coAuthorAvatars.length - 3) + '</span>';
        }
      } else if (avatarUrl) {
        // 单个头像
        html += '<img src="' + avatarUrl + '" style="width:16px;height:16px;border-radius:50%;object-fit:cover;border:1px solid rgba(255,255,255,0.5);" />';
      } else if (displayName) {
        // 无头像显示首字
        html += '<div style="width:16px;height:16px;border-radius:50%;background:#7eb8da;display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;">' + displayName.charAt(0).toUpperCase() + '</div>';
      }

      let moodHtml = mood ? '<span style="font-size:13px;margin-right:2px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.2));">' + mood + '</span>' : '';
      html += moodHtml + '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;">' + arg.event.title + '</span>';
      html += '</div>';
      return { html: html };
    }
  });

  calendar.render();
}

// 加载日历事件
async function loadCalendarEvents() {
  if (!calendar) return;

  let events = [];
  userInfoCache = {}; // 清空缓存

  try {
    let linkedIds = await getLinkedUserIds();
    let allDiaries = await db.collection('diaries').get();

    // 第一步：收集所有需要用户信息的ID并批量预加载
    let neededUserIds = [];
    for (let i = 0; i < allDiaries.docs.length; i++) {
      let data = allDiaries.docs[i].data();
      neededUserIds.push(data.userId);
      if (data.coAuthors) {
        neededUserIds = neededUserIds.concat(data.coAuthors);
      }
    }
    await preloadUserInfoCache(neededUserIds);

    // 第二步：遍历日记（此时用户信息已在缓存中）
    for (let j = 0; j < allDiaries.docs.length; j++) {
      let doc = allDiaries.docs[j];
      let data = doc.data();

      // 使用通用可见性判断函数
      let visResult = isDiaryVisible(data, currentUser.uid, linkedIds, activeFilters, { checkAcceptance: true });
      if (!visResult) continue;

      let isMine = data.userId === currentUser.uid;
      let isCoAuthor = data.coAuthors && data.coAuthors.indexOf(currentUser.uid) !== -1;
      let isPending = isCoAuthor && !isMine && (!data.acceptedCoAuthors || data.acceptedCoAuthors.indexOf(currentUser.uid) === -1);
      if (isPending) isCoAuthor = false;

      // 获取作者信息（从缓存，同步）
      let authorInfo = getUserInfoFromCache(data.userId);

      // 标题只显示记录标题
      let title = data.title || (isMine ? '我的记录' : '已链接记录');

      // 设置时间
      let eventDate = data.date.toDate();
      if (data.time) {
        let timeParts = data.time.split(':');
        eventDate.setHours(parseInt(timeParts[0], 10));
        eventDate.setMinutes(parseInt(timeParts[1], 10));
      }

      // 颜色：边框是标签色，背景是浅色透明，文字是标签色
      let bgColor, borderColor, textColor;
      if (data.tagId) {
        let tag = userTags.find(function(t) { return t.id === data.tagId; });
        if (tag) {
          borderColor = tag.color;
          textColor = tag.color;
          bgColor = hexToRgba(tag.color, 0.15);
        }
      }

      if (!bgColor) {
        bgColor = isMine ? 'rgba(126, 184, 218, 0.15)' : 'rgba(255, 200, 150, 0.15)';
        borderColor = isMine ? '#7eb8da' : '#ffc896';
        textColor = isMine ? '#7eb8da' : '#ffc896';
      }

      let eventProps = {
        mood: data.mood,
        diaryId: doc.id,
        isMyDiary: isMine,
        isCoAuthor: isCoAuthor,
        tagColor: borderColor,
        avatarUrl: authorInfo.avatarUrl,
        displayName: authorInfo.displayName
      };

      // 如果是共建记录，获取所有共建者头像（从缓存）
      if (isCoAuthor && data.coAuthors) {
        let coAuthorAvatars = [];
        for (let c = 0; c < data.coAuthors.length; c++) {
          let coAuthorInfo = getUserInfoFromCache(data.coAuthors[c]);
          coAuthorAvatars.push({
            url: coAuthorInfo.avatarUrl,
            initial: coAuthorInfo.displayName ? coAuthorInfo.displayName.charAt(0).toUpperCase() : '?'
          });
        }
        eventProps.coAuthorAvatars = coAuthorAvatars;
      }

      events.push({
        id: doc.id,
        title: title,
        start: eventDate,
        display: 'block',
        backgroundColor: bgColor,
        borderColor: borderColor,
        textColor: textColor,
        classNames: ['tag-event'],
        extendedProps: eventProps
      });
    }

    // 第三步：加载纪念日事件
    let anniversaries = await getAllAnniversariesForCalendar();
    for (let a = 0; a < anniversaries.length; a++) {
      let ann = anniversaries[a];
      let result = calculateDays(ann.date, ann.isRepeating);
      let targetDate = result.targetDate;

      let eventTitle = ann.title;
      if (ann.isRepeating) {
        // 如果是重复纪念日，计算今年是第几周年并在日历上显示
        let years = targetDate.getFullYear() - result.originalDate.getFullYear();
        if (years > 0) {
          eventTitle += ' (' + years + '周年)';
        }
      }

      events.push({
        id: 'ann_' + ann.id,
        title: (ann.icon || '💝') + ' ' + eventTitle,
        start: targetDate,
        display: 'block',
        backgroundColor: 'var(--accent-light)', // 自动跟随当前主题
        borderColor: 'var(--accent)',           // 自动跟随当前主题
        textColor: 'var(--accent)',             // 自动跟随当前主题
        classNames: ['anniversary-event'],
        extendedProps: {
          anniversaryId: ann.id,
          isAnniversary: true
        }
      });
    }

    calendar.removeAllEvents();
    events.forEach(function(event) {
      calendar.addEvent(event);
    });
    calendar.render();
  } catch (e) {
    console.error('加载日历失败:', e);
  }
}

// 处理日历事件点击
function handleCalendarEventClick(info) {
  let extProps = info.event.extendedProps;

  // 纪念日点击：打开纪念日编辑
  if (extProps.isAnniversary) {
    let annId = extProps.anniversaryId;
    if (typeof showAnniversaryDetail === 'function') {
      showAnniversaryDetail(annId);
    }
    return;
  }

  // 日记点击：显示详情
  let diaryId = extProps.diaryId;
  let isMine = extProps.isMyDiary;
  let isCoAuthor = extProps.isCoAuthor;
  showDiaryDetail(diaryId, isMine, isCoAuthor);
}

// 处理日期点击
function handleCalendarDateClick(info) {
  let now = new Date();
  let timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  document.getElementById('diaryDate').value = info.dateStr;
  document.getElementById('diaryTime').value = timeStr;
  openWriteModal();
}

// 设置24小时制
function set24HourFormat() {
  if (calendar) {
    calendar.setOption('eventTimeFormat', { hour: '2-digit', minute: '2-digit', hour12: false });
    calendar.setOption('slotLabelFormat', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
}

// 刷新日历
async function refreshCalendar() {
  await loadCalendarEvents();
  setTimeout(set24HourFormat, 100);
}