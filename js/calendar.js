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

  // 我的日记
  var myDiaries = await db.collection('diaries')
    .where('userId', '==', currentUser.uid)
    .get();

  for (var i = 0; i < myDiaries.docs.length; i++) {
    var doc = myDiaries.docs[i];
    var data = doc.data();
    events.push({
      id: doc.id,
      title: '我的日记',
      start: data.date.toDate(),
      backgroundColor: 'rgba(126, 184, 218, 0.6)',
      borderColor: 'rgba(126, 184, 218, 0.8)',
      extendedProps: {
        diaryId: doc.id,
        isMyDiary: true
      }
    });
  }

  // 分享给我的日记
  if (currentUserData && currentUserData.linkedUsers && currentUserData.linkedUsers.length) {
    for (var j = 0; j < currentUserData.linkedUsers.length; j++) {
      var user = currentUserData.linkedUsers[j];
      var userDiaries = await db.collection('diaries')
        .where('userId', '==', user.userId)
        .get();

      for (var k = 0; k < userDiaries.docs.length; k++) {
        var diaryDoc = userDiaries.docs[k];
        var diaryData = diaryDoc.data();
        if (diaryData.visibility === 'shared' || diaryData.visibility === 'public') {
          events.push({
            id: diaryDoc.id,
            title: user.displayName || user.email,
            start: diaryData.date.toDate(),
            backgroundColor: 'rgba(255, 200, 150, 0.6)',
            borderColor: 'rgba(255, 200, 150, 0.8)',
            extendedProps: {
              diaryId: diaryDoc.id,
              isMyDiary: false
            }
          });
        }
      }
    }
  }

  calendar.removeAllEvents();
  for (var m = 0; m < events.length; m++) {
    calendar.addEvent(events[m]);
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
