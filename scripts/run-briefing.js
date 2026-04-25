require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { generateBriefing } = require('../services/briefing');
const { isHoliday } = require('../services/holiday');

function formatWidgetMetric(value, unit = '') {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? `${parsed}${unit}` : '-';
}

function logTelegramResult(result) {
  if (!result) {
    console.error('[GitHub Actions] Telegram result missing');
    return;
  }

  console.log(`[GitHub Actions] Telegram result: ok=${result.ok} sent=${result.sent.length} failed=${result.failed.length}`);
  for (const item of result.sent) {
    console.log(`[GitHub Actions] Telegram sent chat=${item.maskedChatId} message_id=${item.messageId}`);
  }
  for (const item of result.failed) {
    const error = item.error || {};
    console.error(
      `[GitHub Actions] Telegram failed chat=${item.maskedChatId || '-'} status=${error.status || '-'} code=${error.errorCode || '-'} description=${error.description || '-'}`
    );
  }
}

async function main() {
  if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' && process.env.MANUAL_SEND !== 'true') {
    console.log('[GitHub Actions] 명시적으로 승인되지 않은 수동/외부 실행이므로 브리핑 발송을 건너뜁니다.');
    process.exit(0);
  }

  if (isHoliday()) {
    console.log(`[GitHub Actions] 오늘은 공휴일이므로 브리핑을 건너뜁니다.`);
    process.exit(0);
  }
  
  console.log(`[GitHub Actions] 평일 브리핑 시작`);
  const b = await generateBriefing();
  
  // 위젯용 정적 데이터 생성 (GitHub Pages 배포용)
  const isDelayed = b.route.isDelayed ? `(+${b.route.delayMin})` : '';
  const t1 = `🚗 ${b.route.totalTime}분${isDelayed} · 출발 ${b.recommendedDeparture}`;
  const dustStatus = b.weather.dust?.includes('나쁨') ? '나쁨😷' : '보통';
  const temp = formatWidgetMetric(b.weather.temp, '°C');
  const wind = formatWidgetMetric(b.weather.windSpeed);
  const t2 = `🌤 ${temp} · 풍속 ${wind} · 미먼 ${dustStatus}`;
  
  const widgetData = { text1: t1, text2: t2 };
  
  fs.writeFileSync(path.join(__dirname, '../public/widget.json'), JSON.stringify(widgetData));
  fs.writeFileSync(path.join(__dirname, '../public/voice.txt'), b.voiceScript);
  logTelegramResult(b.delivery?.telegram);
  console.log(`[GitHub Actions] 브리핑 완료 및 위젯/음성 데이터 저장 성공`);

  if (process.env.GITHUB_ACTIONS === 'true' && (b.delivery?.telegram?.sent?.length || 0) === 0) {
    throw new Error('Telegram 전송 성공 0건: 브리핑 파일은 생성했지만 텔레그램 발송은 실패했습니다.');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('오류:', err.message);
  process.exit(1);
});
