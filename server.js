require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { generateBriefing } = require('./services/briefing');
const { getTokenFromCode, saveTokenToEnv, refreshAccessToken } = require('./services/kakao');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let lastBriefing = null;

function formatWidgetMetric(value, unit = '') {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? `${parsed}${unit}` : '-';
}

function getWidgetData(briefing) {
  const b = briefing;
  const isDelayed = b.route.isDelayed ? `(+${b.route.delayMin})` : '';
  const t1 = `🚗 ${b.route.totalTime}분${isDelayed} · 출발 ${b.recommendedDeparture}`;
  const dustStatus = b.weather.dust?.includes('나쁨') ? '나쁨😷' : '보통';
  const temp = formatWidgetMetric(b.weather.temp, '°C');
  const wind = formatWidgetMetric(b.weather.windSpeed);
  const t2 = `🌤 ${temp} · 풍속 ${wind} · 미먼 ${dustStatus}`;
  return { text1: t1, text2: t2 };
}

function saveBriefingFiles(briefing) {
  fs.writeFileSync(
    path.join(__dirname, 'public/widget.json'),
    JSON.stringify(getWidgetData(briefing))
  );
  fs.writeFileSync(path.join(__dirname, 'public/voice.txt'), briefing.voiceScript || '');
}

// ─── 카카오 OAuth 설정 ─────────────────────────────
const REDIRECT_URI = `http://localhost:${PORT}/auth/kakao/callback`;

// 카카오 로그인 시작
app.get('/auth/kakao', (req, res) => {
  const url = `https://kauth.kakao.com/oauth/authorize?client_id=${process.env.KAKAO_REST_API_KEY}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code`;
  res.redirect(url);
});

// 카카오 콜백 - 토큰 자동 저장
app.get('/auth/kakao/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.send('인가 코드 없음');

  try {
    const tokens = await getTokenFromCode(code, REDIRECT_URI);
    saveTokenToEnv(tokens.access_token, tokens.refresh_token);
    res.send(`
      <html><body style="font-family:sans-serif;padding:40px;text-align:center;background:#1a1a2e;color:#fff;">
        <h2>✅ 카카오 연결 완료!</h2>
        <p>이제 카카오톡으로 브리핑을 받을 수 있어요.</p>
        <a href="/" style="color:#64d2ff;">← 대시보드로 돌아가기</a>
      </body></html>
    `);
  } catch (err) {
    res.send(`연결 실패: ${err.response?.data?.error_description || err.message}`);
  }
});

// ─── API ──────────────────────────────────────────

// 브리핑 수동 실행
app.get('/api/briefing', async (req, res) => {
  try {
    const briefing = await generateBriefing();
    lastBriefing = briefing;
    saveBriefingFiles(briefing);
    res.json({ success: true, briefing });
  } catch (err) {
    console.error('브리핑 오류:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 최신 브리핑 조회 (iOS 단축어용)
app.get('/api/latest', (req, res) => {
  if (!lastBriefing) {
    return res.json({ success: false, message: '브리핑이 아직 없습니다.' });
  }
  res.json({ success: true, briefing: lastBriefing });
});

// 잠금화면 위젯용 요약 데이터 (Scriptable 연동용)
app.get('/api/widget', (req, res) => {
  if (!lastBriefing) {
    return res.json({ text1: '브리핑 대기중', text2: '서버에 데이터가 없습니다.' });
  }
  res.json(getWidgetData(lastBriefing));
});

// 음성 스크립트 (iOS 단축어 TTS용)
app.get('/api/voice', (req, res) => {
  if (!lastBriefing) {
    const voicePath = path.join(__dirname, 'public/voice.txt');
    if (fs.existsSync(voicePath)) {
      return res.type('text').send(fs.readFileSync(voicePath, 'utf8'));
    }
    return res.type('text').send('아직 브리핑이 없습니다.');
  }
  res.type('text').send(lastBriefing.voiceScript);
});

// 상태 확인
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    kakaoConnected: !!process.env.KAKAO_ACCESS_TOKEN,
    lastBriefingAt: lastBriefing?.generatedAt || null,
    ntfyTopic: process.env.NTFY_TOPIC,
    schedule: process.env.CRON_SCHEDULE || '10 7 * * 1-5',
  });
});

// ─── 스케줄러 ──────────────────────────────────────
// ENABLE_LOCAL_CRON=true 일 때만 서버 내장 cron 실행
// GitHub Actions를 사용 중이면 이 값을 설정하지 말 것 (중복 발송 방지)
const schedule = process.env.CRON_SCHEDULE || '10 7 * * 1-5';
const { getNoBriefingReason, isBriefingDay } = require('./services/holiday');

if (process.env.ENABLE_LOCAL_CRON === 'true') {
  cron.schedule(
    schedule,
    async () => {
      if (!isBriefingDay()) {
        console.log(`[자동 스케줄] 오늘은 ${getNoBriefingReason() || '비출근일'}이므로 브리핑 자동 발송을 건너뜁니다.`);
        return;
      }

      console.log(`[자동 스케줄] 평일 브리핑 시작`);
      if (process.env.KAKAO_REFRESH_TOKEN) await refreshAccessToken();
      try {
        lastBriefing = await generateBriefing();
        saveBriefingFiles(lastBriefing);
      } catch (err) {
        console.error('[자동 스케줄] 오류:', err.message);
      }
    },
    { timezone: 'Asia/Seoul' }
  );
  console.log(`📅 내장 스케줄러 활성화: ${schedule} (Asia/Seoul)`);
} else {
  console.log(`📅 내장 스케줄러 비활성화 (GitHub Actions 사용 중)`);
}

app.listen(PORT, () => {
  console.log(`\n🌅 Morning Briefing 서버 시작!`);
  console.log(`📱 대시보드: http://localhost:${PORT}`);
  console.log(`🔑 카카오 연결: http://localhost:${PORT}/auth/kakao`);
  console.log(`📲 ntfy 채널: ${process.env.NTFY_TOPIC}`);
  console.log(`📅 스케줄: ${schedule} (Asia/Seoul)\n`);
});
