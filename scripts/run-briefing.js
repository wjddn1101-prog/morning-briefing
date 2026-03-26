require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { generateBriefing } = require('../services/briefing');
const { isHoliday } = require('../services/holiday');

async function main() {
  if (isHoliday()) {
    console.log(`[GitHub Actions] 오늘은 공휴일이므로 브리핑을 건너뜁니다.`);
    process.exit(0);
  }
  
  console.log(`[GitHub Actions] 평일 브리핑 시작`);
  const b = await generateBriefing();
  
  // 위젯용 정적 데이터 생성 (GitHub Pages 배포용)
  const isDelayed = b.route.isDelayed ? `(+${b.route.delayMin})` : '';
  const t1 = `🚗 ${b.route.totalTime}분${isDelayed} · 출발 ${b.recommendedDeparture}`;
  const dustStatus = b.weather.dust.includes('나쁨') ? '나쁨😷' : '보통';
  const t2 = `🌤 ${parseInt(b.weather.temp)}°C · 풍속 ${parseInt(b.weather.windSpeed)} · 미먼 ${dustStatus}`;
  
  const widgetData = { text1: t1, text2: t2 };
  
  fs.writeFileSync(path.join(__dirname, '../public/widget.json'), JSON.stringify(widgetData));
  console.log(`[GitHub Actions] 브리핑 완료 및 위젯 데이터 저장 성공`);
  process.exit(0);
}

main().catch(err => {
  console.error('오류:', err.message);
  process.exit(1);
});
