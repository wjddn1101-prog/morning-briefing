const ical = require('node-ical');

// 오늘 날짜의 자정과 다음날 자정을 구하는 헬퍼 함수
function getTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

// 주어진 iCal URL에서 오늘 예정된 이벤트를 배열로 반환
async function getTodayEvents() {
  const url = process.env.ICAL_URL;
  if (!url) return [];

  try {
    const events = await ical.async.fromURL(url);
    const { start, end } = getTodayRange();
    const todayEvents = [];

    for (const key in events) {
      if (events.hasOwnProperty(key)) {
        const ev = events[key];
        if (ev.type === 'VEVENT') {
          // 반복 일정(rrule)이 없는 일반 일정 처리
          if (ev.start && ev.end) {
            const evStart = new Date(ev.start);
            const evEnd = new Date(ev.end);
            
            // 오늘 하루 종일(All Day) 일정이거나 특정 시간대 일정이 오늘 겹치는 경우
            if (
              (evStart >= start && evStart < end) || 
              (evEnd > start && evEnd <= end) || 
              (evStart <= start && evEnd >= end)
            ) {
              todayEvents.push(ev.summary);
            }
          }
          
          // 반복 일정(rrule) 처리 (.exdates 등 상세처리는 생략하고 간단히)
          if (ev.rrule) {
            const dates = ev.rrule.between(start, end);
            if (dates.length > 0) {
              todayEvents.push(ev.summary);
            }
          }
        }
      }
    }

    // 중복 제거 후 리턴
    return [...new Set(todayEvents)];
  } catch (err) {
    console.error('캘린더 (iCal) 연동 오류:', err.message);
    return [];
  }
}

module.exports = { getTodayEvents };
