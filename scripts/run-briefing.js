require('dotenv').config();
const { getRoute, getRecommendedDeparture } = require('../services/tmap');
const { getWeather } = require('../services/weather');
const { getVoiceScript, sendPushNotification } = require('../services/notification');
const { sendTelegramMessage } = require('../services/telegram');

const ORIGIN = process.env.ORIGIN_ADDRESS || '부산광역시 부산진구 동평로 176';
const DEST = process.env.DEST_ADDRESS || '경남 김해시 경원로 73번길 15';

async function main() {
  console.log(`[${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}] 브리핑 시작`);

  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const generatedAt = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const [route, weather] = await Promise.all([
    getRoute(ORIGIN, DEST),
    getWeather(),
  ]);

  const recommendedDeparture = getRecommendedDeparture(route.totalTime, '08:30');
  const briefing = { route, weather, recommendedDeparture, generatedAt };
  briefing.voiceScript = getVoiceScript(briefing);

  console.log(`소요: ${route.totalTime}분 | 날씨: ${weather.weatherDesc} | 추천출발: ${recommendedDeparture}`);

  // 텔레그램 + 푸시 동시 전송
  await Promise.all([
    sendTelegramMessage(briefing),
    sendPushNotification(briefing),
  ]);

  console.log('브리핑 완료!');
}

main().catch(err => {
  console.error('오류:', err.message);
  process.exit(1);
});
