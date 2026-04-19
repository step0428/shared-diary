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

    // 获取所有日记
    var allDiaries = await db.collection('diaries').get();

    for (var i = 0; i < allDiaries.docs.length; i++) {
      var doc = allDiaries.docs[i];
      var data = doc.data();

      var isMine = data.userId === currentUser.uid;
      var isLinkedAndShared = linkedIds.indexOf(data.userId) !== -1 &&
        (data.visibility === 'public' || (data.visibility === 'shared' && data.sharedWith && data.sharedWith.indexOf(currentUser.uid) !== -1));

      if (isMine || isLinkedAndShared) {
        var userDoc = await db.collection('users').doc(data.userId).get();
        var userName = isMine ? '我的日记' : (userDoc.exists ? (userDoc.data().displayName || userDoc.data().email) : '已链接用户');

        events.push({
          id: doc.id,
          title: userName,
          start: data.date.toDate(),
          backgroundColor: isMine ? 'rgba(126, 184, 218, 0.6)' : 'rgba(255, 200, 150, 0.6)',
          borderColor: isMine ? 'rgba(126, 184, 218, 0.8)' : 'rgba(255, 200, 150, 0.8)',
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
  document.getElementById('diaryDate').value = info.dateStr;
  openWriteModal();
}

// 刷新日历
function refreshCalendar() {
  loadCalendarEvents();
}
