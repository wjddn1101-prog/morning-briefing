const { getRoute, getRecommendedDeparture, getArrivalAt0800 } = require('./tmap');
const { getWeather } = require('./weather');
const { sendKakaoMessage } = require('./kakao');
const { sendPushNotification, getVoiceScript } = require('./notification');
const { getTodayEvents } = require('./calendar');

const ORIGIN = process.env.ORIGIN_ADDRESS || '부산광역시 부산진구 동평로 176';
const DEST = process.env.DEST_ADDRESS || '경남 김해시 경원로 73번길 15';
const TIME_ZONE = 'Asia/Seoul';

function elapsedMs(startedAt) {
  return Math.round(Number(process.hrtime.bigint() - startedAt) / 1e6);
}

async function timed(label, task) {
  const startedAt = process.hrtime.bigint();
  try {
    return await task();
  } finally {
    console.log(`[Perf] ${label} ${elapsedMs(startedAt)}ms`);
  }
}

async function generateBriefing() {
  console.log(`[${new Date().toLocaleString('ko-KR', { timeZone: TIME_ZONE })}] 브리핑 생성 시작...`);

  const now = new Date();
  const generatedAt = now.toLocaleString('ko-KR', {
    timeZone: TIME_ZONE,
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const dataStartedAt = process.hrtime.bigint();
  const [route, weather, events] = await Promise.all([
    timed('data.route', () => getRoute(ORIGIN, DEST)),
    timed('data.weather', () => getWeather()),
    timed('data.calendar', () => getTodayEvents())
  ]);
  console.log(`[Perf] data.total ${elapsedMs(dataStartedAt)}ms`);

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

  const notifyStartedAt = process.hrtime.bigint();
  const [kakaoResult, pushResult, telegramResult] = await Promise.all([
    timed('notify.kakao', () => sendKakaoMessage(briefing)).catch(e => {
      console.error('Kakao Error', e.message);
      return false;
    }),
    timed('notify.push', () => sendPushNotification(briefing)).catch(e => {
      console.error('Push Error', e.message);
      return false;
    }),
    timed('notify.telegram', () => sendTelegramMessage(briefing)).catch(e => {
      console.error('Telegram Error', e.message);
      return {
        ok: false,
        sent: [],
        failed: [{
          maskedChatId: null,
          error: {
            status: null,
            errorCode: e.code || null,
            description: e.message,
          },
        }],
      };
    })
  ]);
  console.log(`[Perf] notify.total ${elapsedMs(notifyStartedAt)}ms`);

  briefing.delivery = {
    kakao: kakaoResult,
    push: pushResult,
    telegram: telegramResult,
  };

  return briefing;
}

module.exports = { generateBriefing };
