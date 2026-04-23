const axios = require('axios');
const fs = require('fs');
const path = require('path');

function getAccessToken() {
  return process.env.KAKAO_ACCESS_TOKEN || '';
}

// 카카오 "나에게 보내기" API
async function sendKakaoMessage(briefing) {
  const token = getAccessToken();
  if (!token) {
    console.error('카카오 Access Token 없음. /setup 페이지에서 발급하세요.');
    return false;
  }

  const { route, weather, recommendedDeparture, arrivalAt0800, generatedAt } = briefing;

  const delayText = route.isDelayed
    ? `⚠️ 평소보다 ${route.delayMin}분 지연`
    : '✅ 정상 소통';

  const incidentText =
    route.incidents.length > 0
      ? route.incidents.map((i) => `• ${i}`).join('\n')
      : '• 특이사항 없음';

  const umbrellaText = weather.needUmbrella ? '\n☂️ 우산 챙기세요!' : '';

  const messageText = [
    `🌅 아침 출근 브리핑 (${generatedAt})`,
    '',
    `📍 동평로 176 → 경원로 73번길`,
    `⏱ 예상 소요: ${route.totalTime}분 (${route.totalDistance}km)`,
    `📊 교통: ${delayText}`,
    `🚀 추천 출발: ${recommendedDeparture} (08:50 도착 기준)`,
    `⏰ 08:00 출발 시 도착: ${arrivalAt0800}`,
    '',
    `🚧 사고·공사 구간`,
    incidentText,
    '',
    `🌤 날씨: ${weather.weatherDesc} ${weather.temp}`,
    `💧 강수확률: ${weather.rainProb} | 습도: ${weather.humidity}`,
    `💨 바람: ${weather.windSpeed}`,
    `😷 미세먼지: ${weather.dust} (PM10: ${weather.pm10}, PM2.5: ${weather.pm25})`,
    umbrellaText,
  ].join('\n');

  try {
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
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    console.log('카카오톡 메시지 전송 성공');
    return true;
  } catch (err) {
    console.error('카카오톡 전송 실패:', err.response?.data || err.message);
    return false;
  }
}

// 인가 코드로 Access Token 발급
async function getTokenFromCode(code, redirectUri) {
  const res = await axios.post(
    'https://kauth.kakao.com/oauth/token',
    new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.KAKAO_REST_API_KEY,
      redirect_uri: redirectUri,
      code,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return res.data;
}

// .env 파일에 토큰 저장
function saveTokenToEnv(accessToken, refreshToken) {
  const envPath = path.join(__dirname, '../.env');
  let content = fs.readFileSync(envPath, 'utf8');
  content = content.replace(/KAKAO_ACCESS_TOKEN=.*/, `KAKAO_ACCESS_TOKEN=${accessToken}`);
  if (refreshToken) {
    if (content.includes('KAKAO_REFRESH_TOKEN=')) {
      content = content.replace(/KAKAO_REFRESH_TOKEN=.*/, `KAKAO_REFRESH_TOKEN=${refreshToken}`);
    } else {
      content += `\nKAKAO_REFRESH_TOKEN=${refreshToken}`;
    }
  }
  fs.writeFileSync(envPath, content);
  process.env.KAKAO_ACCESS_TOKEN = accessToken;
  if (refreshToken) process.env.KAKAO_REFRESH_TOKEN = refreshToken;
}

// Access Token 갱신
async function refreshAccessToken() {
  const refreshToken = process.env.KAKAO_REFRESH_TOKEN;
  if (!refreshToken) return false;

  try {
    const res = await axios.post(
      'https://kauth.kakao.com/oauth/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.KAKAO_REST_API_KEY,
        refresh_token: refreshToken,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const { access_token, refresh_token } = res.data;
    saveTokenToEnv(access_token, refresh_token || refreshToken);
    console.log('카카오 토큰 갱신 성공');
    return true;
  } catch (err) {
    console.error('토큰 갱신 실패:', err.response?.data || err.message);
    return false;
  }
}

module.exports = { sendKakaoMessage, getTokenFromCode, saveTokenToEnv, refreshAccessToken };
