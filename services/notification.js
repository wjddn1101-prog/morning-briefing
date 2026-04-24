const axios = require('axios');

const NTFY_TOPIC = process.env.NTFY_TOPIC || 'wife-commute';
const NOTIFICATION_TIMEOUT_MS = Number(process.env.NOTIFICATION_TIMEOUT_MS || 10000);

// ntfy.sh 를 통한 아이폰 잠금화면 알림
async function sendPushNotification(briefing) {
  const { route, weather, recommendedDeparture, targetArrival } = briefing;

  const delayEmoji = route.isDelayed ? '⚠️' : '✅';
  const title = `🌅 출근 브리핑 | 추천출발 ${recommendedDeparture} (${targetArrival || '08:50'} 도착)`;
  const body = [
    `${delayEmoji} 소요 ${route.totalTime}분 (${route.totalDistance}km)`,
    `🌤 ${weather.weatherDesc} ${weather.temp}`,
    `💧 강수 ${weather.rainProb}${weather.needUmbrella ? ' ☂️ 우산챙기기' : ''}`,
    `😷 미세먼지 ${weather.dust}`,
    route.incidents.length > 0 ? `🚧 ${route.incidents[0]}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    await axios.post(
      'https://ntfy.sh/',
      {
        topic: NTFY_TOPIC,
        title,
        message: body,
        priority: route.isDelayed ? 4 : 3,
        tags: route.isDelayed ? ['warning', 'car'] : ['car'],
      },
      {
        timeout: NOTIFICATION_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('푸시 알림 전송 성공');
    return true;
  } catch (err) {
    console.error('푸시 알림 실패:', err.message);
    return false;
  }
}

// 음성 브리핑용 텍스트 생성 (iOS 단축어에서 사용)
function getVoiceScript(briefing) {
  const { route, weather, recommendedDeparture, targetArrival } = briefing;
  const delayText = route.isDelayed
    ? `평소보다 ${route.delayMin}분 지연되고 있어요.`
    : '교통 상황은 원활합니다.';

  const incidentText =
    route.incidents.length > 0
      ? `사고 및 공사 구간이 있습니다. ${route.incidents[0]}`
      : '사고나 공사 구간은 없습니다.';

  const umbrellaText = weather.needUmbrella
    ? '오늘 우산을 챙기세요.'
    : '';

  const dustText = weather.dust && weather.dust !== '알 수 없음'
    ? `미세먼지는 ${weather.dust.replace(/[^\w가-힣 ]/g, '').trim()}입니다.`
    : '';

  return [
    `안녕하세요. 오늘 아침 출근 브리핑입니다.`,
    `현재 동평로에서 경원로까지 예상 소요 시간은 ${route.totalTime}분입니다.`,
    delayText,
    incidentText,
    `${targetArrival || '08:50'} 도착 기준 추천 출발 시각은 ${recommendedDeparture}입니다.`,
    `날씨는 ${weather.weatherDesc}, 기온은 ${weather.temp}입니다.`,
    `강수 확률은 ${weather.rainProb}입니다.`,
    dustText,
    umbrellaText,
    `안전 운전 하세요!`,
  ]
    .filter(Boolean)
    .join(' ');
}

module.exports = { sendPushNotification, getVoiceScript };
