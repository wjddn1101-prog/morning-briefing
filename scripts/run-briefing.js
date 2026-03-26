require('dotenv').config();
const axios = require('axios');
const { getRoute, getRecommendedDeparture } = require('../services/tmap');
const { getWeather } = require('../services/weather');
const { getVoiceScript, sendPushNotification } = require('../services/notification');

const ORIGIN = process.env.ORIGIN_ADDRESS || '부산광역시 부산진구 동평로 176';
const DEST = process.env.DEST_ADDRESS || '경남 김해시 경원로 73번길 15';

// 카카오 Refresh Token으로 Access Token 발급
async function getKakaoAccessToken() {
  const refreshToken = process.env.KAKAO_REFRESH_TOKEN;
  if (!refreshToken) {
    console.log('카카오 Refresh Token 없음 - 카카오 메시지 스킵');
    return null;
  }

  const res = await axios.post(
    'https://kauth.kakao.com/oauth/token',
    new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.KAKAO_REST_API_KEY,
      refresh_token: refreshToken,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return res.data.access_token;
}

// 카카오 메시지 전송
async function sendKakaoMessage(accessToken, briefing) {
  const { route, weather, recommendedDeparture, generatedAt } = briefing;

  const delayText = route.isDelayed
    ? `⚠️ 평소보다 ${route.delayMin}분 지연`
    : '✅ 정상 소통';

  const incidentText =
    route.incidents.length > 0
      ? route.incidents.map((i) => `• ${i}`).join('\n')
      : '• 특이사항 없음';

  const messageText = [
    `🌅 아침 출근 브리핑 (${generatedAt})`,
    '',
    `📍 동평로 176 → 경원로 73번길`,
    `⏱ 예상 소요: ${route.totalTime}분 (${route.totalDistance}km)`,
    `📊 교통: ${delayText}`,
    `🚀 추천 출발: ${recommendedDeparture}`,
    '',
    `🚧 사고·공사 구간`,
    incidentText,
    '',
    `🌤 날씨: ${weather.weatherDesc} ${weather.temp}`,
    `💧 강수확률: ${weather.rainProb} | 습도: ${weather.humidity}`,
    `💨 바람: ${weather.windSpeed}`,
    weather.needUmbrella ? '☂️ 우산 챙기세요!' : '',
  ].filter(Boolean).join('\n');

  await axios.post(
    'https://kapi.kakao.com/v2/api/talk/memo/default/send',
    new URLSearchParams({
      template_object: JSON.stringify({
        object_type: 'text',
        text: messageText,
        link: {
          web_url: 'https://map.kakao.com',
          mobile_web_url: 'https://map.kakao.com',
        },
        button_title: '카카오맵으로 보기',
      }),
    }),
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );
}

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

  // 카카오 + 푸시 동시 전송
  const [accessToken] = await Promise.all([
    getKakaoAccessToken().catch(e => { console.error('토큰 오류:', e.message); return null; }),
  ]);

  await Promise.all([
    accessToken
      ? sendKakaoMessage(accessToken, briefing).then(() => console.log('카카오 전송 완료'))
        .catch(e => console.error('카카오 실패:', e.message))
      : Promise.resolve(),
    sendPushNotification(briefing),
  ]);

  console.log('브리핑 완료!');
}

main().catch(err => {
  console.error('오류:', err.message);
  process.exit(1);
});
