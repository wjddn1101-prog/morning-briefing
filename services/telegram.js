const axios = require('axios');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramMessage(briefing) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.error('텔레그램 설정 없음');
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

  const text = [
    `🌅 *아침 출근 브리핑* (${generatedAt})`,
    '',
    `📍 동평로 176 → 경원로 73번길`,
    `⏱ 예상 소요: *${route.totalTime}분* (${route.totalDistance}km)`,
    `📊 교통: ${delayText}`,
    `🚀 추천 출발: *${recommendedDeparture}* (08:50 도착 기준)`,
    `⏰ 08:00 출발 시 도착: *${arrivalAt0800}*`,
    '',
    `🚧 *사고·공사 구간*`,
    incidentText,
    '',
    `🌤 날씨: ${weather.weatherDesc} ${weather.temp}`,
    `💧 강수확률: ${weather.rainProb} | 습도: ${weather.humidity}`,
    `💨 바람: ${weather.windSpeed}`,
    `😷 미세먼지: ${weather.dust} (PM10: ${weather.pm10}, PM2.5: ${weather.pm25})`,
    '',
    weather.outfit,
    ''
  ];

  if (briefing.events && briefing.events.length > 0) {
    text.push(`📅 *오늘의 중요 일정*`);
    briefing.events.forEach(e => text.push(`• ${e}`));
    text.push('');
  }

  const finalText = text.filter(line => line !== null && line !== undefined).join('\n');
  const chatIds = [...new Set(CHAT_ID.split(',').map(id => id.trim()).filter(id => id))];

  try {
    for (const id of chatIds) {
      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: id,
        text: finalText,
        parse_mode: 'Markdown',
      });
    }
    console.log(`텔레그램 메시지 전송 성공 (${chatIds.length}명)`);
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
