// 日历实例
let calendar = null;

// 初始化日历
function initCalendar() {
  const calendarEl = document.getElementById('calendar');

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

  const events = [];

  // 我的日记
  const myDiaries = await db.collection('diaries')
    .where('userId', '==', currentUser.uid)
    .get();

  for (const doc of myDiaries.docs) {
    const data = doc.data();
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
  if (currentUserData?.linkedUsers?.length) {
    for (const user of currentUserData.linkedUsers) {
      const sharedDiaries = await db.collection('diaries')
        .where('userId', '==', user.userId)
        .where('visibility', 'in', ['shared', 'public'])
        .get();

      for (const doc of sharedDiaries.docs) {
        const data = doc.data();
        events.push({
          id: doc.id,
          title: user.displayName || user.email,
          start: data.date.toDate(),
          backgroundColor: 'rgba(255, 200, 150, 0.6)',
          borderColor: 'rgba(255, 200, 150, 0.8)',
          extendedProps: {
            diaryId: doc.id,
            isMyDiary: false
          }
        });
      }
    }
  }

  calendar.removeAllEvents();
  events.forEach(event => calendar.addEvent(event));
}

// 处理日历事件点击
function handleCalendarEventClick(info) {
  const diaryId = info.event.extendedProps.diaryId;
  showDiaryDetail(diaryId);
}

// 处理日期点击
function handleCalendarDateClick(info) {
  // 可以打开写日记弹窗并预填日期
  document.getElementById('diaryDate').value = info.dateStr;
  openWriteModal();
}

// 刷新日历
function refreshCalendar() {
  loadCalendarEvents();
}