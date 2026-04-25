const axios = require('axios');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_TIMEOUT_MS = Number(process.env.TELEGRAM_TIMEOUT_MS || 10000);

function maskChatId(id) {
  const value = String(id);
  if (value.length <= 4) return '****';
  return `${'*'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

function normalizeTelegramError(err) {
  const data = err.response?.data;
  if (data) {
    return {
      status: err.response.status,
      errorCode: data.error_code,
      description: data.description || JSON.stringify(data),
    };
  }

  return {
    status: null,
    errorCode: err.code || null,
    description: err.message,
  };
}

async function sendTelegramMessage(briefing) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.error('텔레그램 설정 없음');
    return {
      ok: false,
      sent: [],
      failed: [{
        maskedChatId: null,
        error: {
          status: null,
          errorCode: 'CONFIG_MISSING',
          description: 'TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID가 설정되지 않았습니다.',
        },
      }],
    };
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
  const result = { ok: false, sent: [], failed: [] };

  if (chatIds.length === 0) {
    console.error('텔레그램 Chat ID 없음');
    result.failed.push({
      maskedChatId: null,
      error: {
        status: null,
        errorCode: 'CHAT_ID_EMPTY',
        description: 'TELEGRAM_CHAT_ID에 유효한 chat id가 없습니다.',
      },
    });
    return result;
  }

  for (const id of chatIds) {
    const maskedChatId = maskChatId(id);
    try {
      const res = await axios.post(
        `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
        {
          chat_id: id,
          text: finalText,
          parse_mode: 'Markdown',
        },
        { timeout: TELEGRAM_TIMEOUT_MS }
      );
      const messageId = res.data?.result?.message_id || null;
      result.sent.push({ maskedChatId, messageId });
      console.log(`[Telegram] sent chat=${maskedChatId} message_id=${messageId}`);
    } catch (err) {
      const error = normalizeTelegramError(err);
      result.failed.push({ maskedChatId, error });
      console.error(
        `[Telegram] failed chat=${maskedChatId} status=${error.status || '-'} code=${error.errorCode || '-'} description=${error.description}`
      );
    }
  }

  result.ok = result.failed.length === 0 && result.sent.length > 0;
  console.log(`텔레그램 메시지 전송 결과: 성공 ${result.sent.length}건, 실패 ${result.failed.length}건`);
  return result;
}

// Chat ID 자동 조회
async function getChatId() {
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN 필요');
  const res = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`, {
    timeout: TELEGRAM_TIMEOUT_MS,
  });
  const updates = res.data.result;
  if (updates.length === 0) return null;
  return updates[updates.length - 1].message?.chat?.id;
}

module.exports = { sendTelegramMessage, getChatId, maskChatId };
