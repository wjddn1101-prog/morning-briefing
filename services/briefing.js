const { getRoute, getRecommendedDeparture, getArrivalAt0800 } = require('./tmap');
const { getWeather } = require('./weather');
const { sendKakaoMessage } = require('./kakao');
const { sendPushNotification, getVoiceScript } = require('./notification');
const { getTodayEvents } = require('./calendar');

const ORIGIN = process.env.ORIGIN_ADDRESS || '부산광역시 부산진구 동평로 176';
const DEST = process.env.DEST_ADDRESS || '경남 김해시 경원로 73번길 15';

async function generateBriefing() {
  console.log(`[${new Date().toLocaleString('ko-KR')}] 브리핑 생성 시작...`);

  const now = new Date();
  const generatedAt = now.toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const [route, weather, events] = await Promise.all([
    getRoute(ORIGIN, DEST),
    getWeather(),
    getTodayEvents()
  ]);

  const recommendedDeparture = getRecommendedDeparture(route.totalTime, '08:50');
  const arrivalAt0800 = getArrivalAt0800(route.totalTime);

  const briefing = {
    route,
    weather,
    events,
    recommendedDeparture,
    arrivalAt0800,
    targetArrival: '08:50',
    generatedAt,
    voiceScript: '',
  };

  briefing.voiceScript = getVoiceScript(briefing);

  console.log('브리핑 데이터:', {
    소요시간: `${route.totalTime}분`,
    지연: route.isDelayed ? `${route.delayMin}분 지연` : '정상',
    날씨: weather.weatherDesc,
    미세먼지: weather.dust,
    일정수: events.length,
    추천출발: recommendedDeparture,
  });

  // 카카오톡 + 푸시 알림 + 텔레그램은 별도 로직?
  // 기존 코드엔 텔레그램 발송이 누락되어 있으니 추가
  const { sendTelegramMessage } = require('./telegram');

  await Promise.all([
    sendKakaoMessage(briefing).catch(e => console.error('Kakao Error', e.message)),
    sendPushNotification(briefing).catch(e => console.error('Push Error', e.message)),
    sendTelegramMessage(briefing).catch(e => console.error('Telegram Error', e.message))
  ]);

  return briefing;
}

module.exports = { generateBriefing };
