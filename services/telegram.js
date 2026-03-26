const axios = require('axios');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramMessage(briefing) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.error('텔레그램 설정 없음');
    return false;
  }

  const { route, weather, recommendedDeparture, generatedAt } = briefing;

  const delayText = route.isDelayed
    ? `⚠️ 평소보다 ${route.delayMin}분 지연`
    : '✅ 정상 소통';

  const incidentText =
    route.incidents.length > 0
      ? route.incidents.map((i) => `• ${i}`).join('\n')
      : '• 특이사항 없음';

  const text = [
    `🌅 *아침 출근 브리핑* (${generatedAt})`,
    '',
    `📍 동평로 176 → 경원로 73번길`,
    `⏱ 예상 소요: *${route.totalTime}분* (${route.totalDistance}km)`,
    `📊 교통: ${delayText}`,
    `🚀 추천 출발: *${recommendedDeparture}*`,
    '',
    `🚧 *사고·공사 구간*`,
    incidentText,
    '',
    `🌤 날씨: ${weather.weatherDesc} ${weather.temp}`,
    `💧 강수확률: ${weather.rainProb} | 습도: ${weather.humidity}`,
    `💨 바람: ${weather.windSpeed}`,
    weather.needUmbrella ? '\n☂️ *우산 챙기세요\\!*' : '',
  ].filter(Boolean).join('\n');

  try {
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text,
      parse_mode: 'Markdown',
    });
    console.log('텔레그램 메시지 전송 성공');
    return true;
  } catch (err) {
    console.error('텔레그램 전송 실패:', err.response?.data || err.message);
    return false;
  }
}

// Chat ID 자동 조회
async function getChatId() {
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN 필요');
  const res = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`);
  const updates = res.data.result;
  if (updates.length === 0) return null;
  return updates[updates.length - 1].message?.chat?.id;
}

module.exports = { sendTelegramMessage, getChatId };
