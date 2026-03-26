// 카카오 Refresh Token 초기 발급 스크립트
// 실행: node scripts/kakao-setup.js
require('dotenv').config();
const http = require('http');
const axios = require('axios');

const PORT = 3000;
const REDIRECT_URI = `http://localhost:${PORT}/auth/kakao/callback`;
const CLIENT_ID = process.env.KAKAO_REST_API_KEY;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== '/auth/kakao/callback') return;

  const code = url.searchParams.get('code');
  if (!code) {
    res.end('인가 코드 없음');
    return;
  }

  try {
    const tokenRes = await axios.post(
      'https://kauth.kakao.com/oauth/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        code,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token } = tokenRes.data;

    console.log('\n✅ 토큰 발급 성공!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('KAKAO_REFRESH_TOKEN (GitHub Secrets에 등록):');
    console.log(refresh_token);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    res.end(`
      <html><body style="font-family:sans-serif;padding:40px;text-align:center;background:#1a1a2e;color:#fff;">
        <h2>✅ 카카오 연결 완료!</h2>
        <p>터미널에서 Refresh Token을 복사해서 GitHub Secrets에 등록하세요.</p>
      </body></html>
    `);

    server.close();
    process.exit(0);
  } catch (err) {
    console.error('오류:', err.response?.data || err.message);
    res.end('오류 발생: ' + err.message);
    server.close();
  }
});

server.listen(PORT, () => {
  const authUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code`;
  console.log('\n카카오 로그인 페이지 열기...');
  console.log('브라우저에서 로그인 후 자동으로 토큰이 발급됩니다.\n');

  const { exec } = require('child_process');
  exec(`open "${authUrl}"`);
});
