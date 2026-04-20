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
    eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false }
  });

  calendar.render();
}

// 加载日历事件
async function loadCalendarEvents() {
  if (!calendar) return;

  var events = [];

  try {
    var linkedIds = await getLinkedUserIds();
    var allDiaries = await db.collection('diaries').get();

    for (var i = 0; i < allDiaries.docs.length; i++) {
      var doc = allDiaries.docs[i];
      var data = doc.data();

      var isMine = data.userId === currentUser.uid;
      var isLinkedAndShared = linkedIds.indexOf(data.userId) !== -1 &&
        (data.visibility === 'public' || (data.visibility === 'shared' && data.sharedWith && data.sharedWith.indexOf(currentUser.uid) !== -1));

      if (isMine || isLinkedAndShared) {
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
            // 用 rgba 解析颜色并添加透明度，支持 #hex、rgb()、颜色名如 red
            bgColor = hexToRgba(tag.color, 0.15);
          }
        }

        if (!bgColor) {
          bgColor = isMine ? 'rgba(126, 184, 218, 0.15)' : 'rgba(255, 200, 150, 0.15)';
          borderColor = isMine ? '#7eb8da' : '#ffc896';
          textColor = isMine ? '#7eb8da' : '#ffc896';
        }

        events.push({
          id: doc.id,
          title: title,
          start: eventDate,
          backgroundColor: bgColor,
          borderColor: borderColor,
          textColor: textColor,
          classNames: ['tag-event'],
          extendedProps: {
            diaryId: doc.id,
            isMyDiary: isMine,
            tagColor: borderColor
          }
        });
      }
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
  showDiaryDetail(diaryId, isMine);
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