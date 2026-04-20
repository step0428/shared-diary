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
    dateClick: handleCalendarDateClick
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
        // 标题：只用日记标题，不显示时间
        var title = data.title || (isMine ? '我的日记' : '已链接日记');

        // 获取时间（如果没有就用12:00）
        var eventDate = data.date.toDate();
        var timeStr = data.time || '12:00';
        var timeParts = timeStr.split(':');
        eventDate.setHours(parseInt(timeParts[0], 10));
        eventDate.setMinutes(parseInt(timeParts[1], 10));

        // 颜色
        var bgColor, borderColor;
        if (data.tagId) {
          var tag = userTags.find(function(t) { return t.id === data.tagId; });
          if (tag) {
            bgColor = tag.color + '99';
            borderColor = tag.color;
          }
        }

        if (!bgColor) {
          bgColor = isMine ? 'rgba(126, 184, 218, 0.6)' : 'rgba(255, 200, 150, 0.6)';
          borderColor = isMine ? 'rgba(126, 184, 218, 0.8)' : 'rgba(255, 200, 150, 0.8)';
        }

        events.push({
          id: doc.id,
          title: title,
          start: eventDate,
          backgroundColor: bgColor,
          borderColor: borderColor,
          extendedProps: {
            diaryId: doc.id,
            isMyDiary: isMine
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
  showDiaryDetail(diaryId);
}

// 处理日期点击
function handleCalendarDateClick(info) {
  var now = new Date();
  var timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  document.getElementById('diaryDate').value = info.dateStr;
  document.getElementById('diaryTime').value = timeStr;
  openWriteModal();
}

// 刷新日历
function refreshCalendar() {
  loadCalendarEvents();
}
