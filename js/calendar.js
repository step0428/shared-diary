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
  var hex = color.replace('#', '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  // 如果不是有效的十六进制（如颜色名 red），用 canvas 转换
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    var canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    var d = ctx.getImageData(0, 0, 1, 1).data;
    return 'rgba(' + d[0] + ', ' + d[1] + ', ' + d[2] + ', ' + alpha + ')';
  }
  var r = parseInt(hex.substring(0, 2), 16);
  var g = parseInt(hex.substring(2, 4), 16);
  var b = parseInt(hex.substring(4, 6), 16);
  return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
}

// 用户信息缓存
var userInfoCache = {};

// 获取用户信息
async function getUserInfoForCalendar(userId) {
  if (userInfoCache[userId]) {
    return userInfoCache[userId];
  }
  try {
    var userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      var data = userDoc.data();
      userInfoCache[userId] = {
        displayName: data.displayName || data.email || '未知用户',
        avatarUrl: data.avatarUrl || ''
      };
    } else {
      userInfoCache[userId] = {
        displayName: '未知用户',
        avatarUrl: ''
      };
    }
  } catch (e) {
    userInfoCache[userId] = {
      displayName: '未知用户',
      avatarUrl: ''
    };
  }
  return userInfoCache[userId];
}

// 日历实例
var calendar = null;

// 初始化日历
function initCalendar() {
  var calendarEl = document.getElementById('calendar');

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek'
    },
    height: 'auto',
    events: [],
    eventClick: handleCalendarEventClick,
    dateClick: handleCalendarDateClick,
    slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
    eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
    eventContent: function(arg) {
      var avatarUrl = arg.event.extendedProps.avatarUrl;
      var displayName = arg.event.extendedProps.displayName || '';
      var isCoAuthor = arg.event.extendedProps.isCoAuthor;
      var coAuthorAvatars = arg.event.extendedProps.coAuthorAvatars || [];

      var html = '<div class="fc-event-main-content" style="display:flex;align-items:center;gap:4px;padding:2px 4px;">';

      // 如果是共建记录，显示多个头像
      if (isCoAuthor && coAuthorAvatars.length > 0) {
        for (var i = 0; i < Math.min(coAuthorAvatars.length, 3); i++) {
          var avatar = coAuthorAvatars[i];
          if (avatar.url) {
            html += '<img src="' + avatar.url + '" style="width:18px;height:18px;border-radius:50%;object-fit:cover;border:1px solid rgba(255,255,255,0.5);" />';
          } else {
            html += '<div style="width:18px;height:18px;border-radius:50%;background:#7eb8da;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;">' + (avatar.initial || '?') + '</div>';
          }
        }
        if (coAuthorAvatars.length > 3) {
          html += '<span style="font-size:10px;">+' + (coAuthorAvatars.length - 3) + '</span>';
        }
      } else if (avatarUrl) {
        // 单个头像
        html += '<img src="' + avatarUrl + '" style="width:18px;height:18px;border-radius:50%;object-fit:cover;border:1px solid rgba(255,255,255,0.5);" />';
      } else if (displayName) {
        // 无头像显示首字
        html += '<div style="width:18px;height:18px;border-radius:50%;background:#7eb8da;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;">' + displayName.charAt(0).toUpperCase() + '</div>';
      }

      html += '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + arg.event.title + '</span>';
      html += '</div>';
      return { html: html };
    }
  });

  calendar.render();
}

// 加载日历事件
async function loadCalendarEvents() {
  if (!calendar) return;

  var events = [];
  userInfoCache = {}; // 清空缓存

  try {
    var linkedIds = await getLinkedUserIds();
    var allDiaries = await db.collection('diaries').get();

    for (var i = 0; i < allDiaries.docs.length; i++) {
      var doc = allDiaries.docs[i];
      var data = doc.data();

      var isMine = data.userId === currentUser.uid;
      var isCoAuthor = data.coAuthors && data.coAuthors.indexOf(currentUser.uid) !== -1;
      var isLinkedAndShared = linkedIds.indexOf(data.userId) !== -1 &&
        (data.visibility === 'public' || (data.visibility === 'shared' && data.sharedWith && data.sharedWith.indexOf(currentUser.uid) !== -1));

      // 判断是否可见
      var isVisible = isMine || isCoAuthor || isLinkedAndShared;
      if (!isVisible) continue;

      // 获取作者信息
      var authorInfo = await getUserInfoForCalendar(data.userId);

      // 标题只显示记录标题
      var title = data.title || (isMine ? '我的记录' : '已链接记录');

      // 设置时间
      var eventDate = data.date.toDate();
      if (data.time) {
        var timeParts = data.time.split(':');
        eventDate.setHours(parseInt(timeParts[0], 10));
        eventDate.setMinutes(parseInt(timeParts[1], 10));
      }

      // 颜色：边框是标签色，背景是浅色透明，文字是标签色
      var bgColor, borderColor, textColor;
      if (data.tagId) {
        var tag = userTags.find(function(t) { return t.id === data.tagId; });
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

      var eventProps = {
        diaryId: doc.id,
        isMyDiary: isMine,
        isCoAuthor: isCoAuthor,
        tagColor: borderColor,
        avatarUrl: authorInfo.avatarUrl,
        displayName: authorInfo.displayName
      };

      // 如果是共建记录，获取所有共建者头像
      if (isCoAuthor && data.coAuthors) {
        var coAuthorAvatars = [];
        for (var c = 0; c < data.coAuthors.length; c++) {
          var coAuthorInfo = await getUserInfoForCalendar(data.coAuthors[c]);
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
        backgroundColor: bgColor,
        borderColor: borderColor,
        textColor: textColor,
        classNames: ['tag-event'],
        extendedProps: eventProps
      });
    }

    calendar.removeAllEvents();
    for (var j = 0; j < events.length; j++) {
      calendar.addEvent(events[j]);
    }
  } catch (e) {
    console.error('加载日历失败:', e);
  }
}

// 处理日历事件点击
function handleCalendarEventClick(info) {
  var diaryId = info.event.extendedProps.diaryId;
  var isMine = info.event.extendedProps.isMyDiary;
  var isCoAuthor = info.event.extendedProps.isCoAuthor;
  showDiaryDetail(diaryId, isMine, isCoAuthor);
}

// 处理日期点击
function handleCalendarDateClick(info) {
  var now = new Date();
  var timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
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
function refreshCalendar() {
  loadCalendarEvents();
  setTimeout(set24HourFormat, 100);
}