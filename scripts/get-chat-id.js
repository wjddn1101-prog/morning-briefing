require('dotenv').config();
const axios = require('axios');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function checkChatId() {
  if (!BOT_TOKEN) {
    console.error('❌ .env 파일에 TELEGRAM_BOT_TOKEN이 없습니다.');
    return;
  }
  
  try {
    const res = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`);
    const updates = res.data.result;
    
    if (updates.length === 0) {
      console.log('👀 아직 아무도 봇에게 대화를 걸지 않았습니다!');
      console.log('👉 아내분 폰에서 브리핑 봇을 검색해 "안녕" 이라고 아무 메시지나 보낸 후 다시 실행해주세요.');
      return;
    }

    const ids = updates.map(u => ({
      username: u.message?.from?.username || u.message?.from?.first_name || '이름없음',
      id: u.message?.chat?.id
    })).filter(u => u.id != null);

    // 중복 제거
    const uniqueIds = Array.from(new Set(ids.map(i => i.id))).map(id => {
      return ids.find(i => i.id === id);
    });

    console.log('\n✅ 최근 브리핑 봇에게 대화를 건 사용자 목록입니다:\n');
    uniqueIds.forEach(user => {
      console.log(`👤 이름: ${user.username}`);
      console.log(`🔑 Chat ID: ${user.id}`);
      console.log('---------------------------');
    });
    
    console.log('\n이 중 아내분의 Chat ID 숫자를 복사해 깃허브 Repository Secrets의 TELEGRAM_CHAT_ID로 엎어치기 해주세요!');
    
  } catch (err) {
    console.error('조회 실패:', err.message);
  }
}

checkChatId();
