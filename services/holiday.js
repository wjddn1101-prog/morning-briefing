// 대한민국 주요 법정 공휴일 (양력 고정 및 24-26 유동 휴일 하드코딩)
const HOLIDAYS = [
  '01-01', // 신정
  '03-01', // 삼일절
  '05-05', // 어린이날
  '06-06', // 현충일
  '08-15', // 광복절
  '10-03', // 개천절
  '10-09', // 한글날
  '12-25', // 기독탄신일

  // --- 2024년 유동 휴일 ---
  '2024-02-09', '2024-02-10', '2024-02-11', '2024-02-12', // 설연휴 + 대체휴일
  '2024-04-10', // 총선
  '2024-05-06', // 어린이날 대체휴일
  '2024-05-15', // 부처님오신날
  '2024-09-16', '2024-09-17', '2024-09-18', // 추석 연휴

  // --- 2025년 유동 휴일 ---
  '2025-01-28', '2025-01-29', '2025-01-30', // 설연휴
  '2025-03-03', // 삼일절 대체휴일
  '2025-05-05', '2025-05-06', // 어린이날/부처님 연휴 (대체)
  '2025-10-05', '2025-10-06', '2025-10-07', '2025-10-08', '2025-10-09', // 추석 연휴 + 한글날 연휴

  // --- 2026년 유동 휴일 ---
  '2026-02-16', '2026-02-17', '2026-02-18', // 설연휴
  '2026-03-02', // 삼일절 대체
  '2026-05-24', '2026-05-25', // 부처님오신날 대체
  '2026-08-17', // 광복절 대체
  '2026-09-24', '2026-09-25', '2026-09-26' // 추석 연휴
];

function getKoreaDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function isHoliday(date = new Date()) {
  const { year, month, day } = getKoreaDateParts(date);
  const mmdd = `${month}-${day}`;
  const yyyymmdd = `${year}-${mmdd}`;
  
  return HOLIDAYS.includes(mmdd) || HOLIDAYS.includes(yyyymmdd);
}

function isWeekend(date = new Date()) {
  const { weekday } = getKoreaDateParts(date);
  return weekday === 'Sat' || weekday === 'Sun';
}

function isBriefingDay(date = new Date()) {
  return !isWeekend(date) && !isHoliday(date);
}

function getNoBriefingReason(date = new Date()) {
  if (isWeekend(date)) return '주말';
  if (isHoliday(date)) return '공휴일';
  return null;
}

module.exports = { getKoreaDateParts, getNoBriefingReason, isBriefingDay, isHoliday, isWeekend };
