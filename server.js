require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const cors = require('cors');
const path = require('path');
const { generateBriefing } = require('./services/briefing');
const { getTokenFromCode, saveTokenToEnv, refreshAccessToken } = require('./services/kakao');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let lastBriefing = null;

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

// 음성 스크립트 (iOS 단축어 TTS용)
app.get('/api/voice', (req, res) => {
  if (!lastBriefing) return res.type('text').send('아직 브리핑이 없습니다.');
  res.type('text').send(lastBriefing.voiceScript);
});

// 상태 확인
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    kakaoConnected: !!process.env.KAKAO_ACCESS_TOKEN,
    lastBriefingAt: lastBriefing?.generatedAt || null,
    ntfyTopic: process.env.NTFY_TOPIC,
    schedule: process.env.CRON_SCHEDULE || '30 7 * * 1-5',
  });
});

// ─── 스케줄러 ──────────────────────────────────────
const schedule = process.env.CRON_SCHEDULE || '30 7 * * 1-5';
cron.schedule(
  schedule,
  async () => {
    console.log(`[자동 스케줄] 브리핑 시작`);
    // 토큰 자동 갱신 시도
    if (process.env.KAKAO_REFRESH_TOKEN) await refreshAccessToken();
    try {
      lastBriefing = await generateBriefing();
    } catch (err) {
      console.error('[자동 스케줄] 오류:', err.message);
    }
  },
  { timezone: 'Asia/Seoul' }
);

app.listen(PORT, () => {
  console.log(`\n🌅 Morning Briefing 서버 시작!`);
  console.log(`📱 대시보드: http://localhost:${PORT}`);
  console.log(`🔑 카카오 연결: http://localhost:${PORT}/auth/kakao`);
  console.log(`📲 ntfy 채널: ${process.env.NTFY_TOPIC}`);
  console.log(`📅 스케줄: ${schedule} (Asia/Seoul)\n`);
});
