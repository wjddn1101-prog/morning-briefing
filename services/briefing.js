const { getRoute, getRecommendedDeparture } = require('./tmap');
const { getWeather } = require('./weather');
const { sendKakaoMessage } = require('./kakao');
const { sendPushNotification, getVoiceScript } = require('./notification');

const ORIGIN = process.env.ORIGIN_ADDRESS || '부산광역시 부산진구 동평로 176';
const DEST = process.env.DEST_ADDRESS || '경남 김해시 경원로 73번길 15';

async function generateBriefing() {
  console.log(`[${new Date().toLocaleString('ko-KR')}] 브리핑 생성 시작...`);

  const now = new Date();
  const generatedAt = now.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const [route, weather] = await Promise.all([
    getRoute(ORIGIN, DEST),
    getWeather(),
  ]);

  const recommendedDeparture = getRecommendedDeparture(route.totalTime, '08:30');

  const briefing = {
    route,
    weather,
    recommendedDeparture,
    generatedAt,
    voiceScript: '',
  };

  briefing.voiceScript = getVoiceScript(briefing);

  console.log('브리핑 데이터:', {
    소요시간: `${route.totalTime}분`,
    지연: route.isDelayed ? `${route.delayMin}분 지연` : '정상',
    날씨: weather.weatherDesc,
    추천출발: recommendedDeparture,
  });

  // 카카오톡 + 푸시 알림 동시 발송
  await Promise.all([
    sendKakaoMessage(briefing),
    sendPushNotification(briefing),
  ]);

  return briefing;
}

module.exports = { generateBriefing };
