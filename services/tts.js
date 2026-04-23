const axios = require('axios');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const VOICE = process.env.TTS_VOICE || 'nova';
const MODEL = process.env.TTS_MODEL || 'tts-1';

// OpenAI TTS API 로 텍스트 → mp3 buffer 변환
async function textToSpeech(text) {
  if (!OPENAI_API_KEY) {
    console.log('[TTS] OPENAI_API_KEY 없음, 음성 생성 건너뜀');
    return null;
  }

  try {
    const res = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      {
        model: MODEL,
        voice: VOICE,
        input: text,
        response_format: 'mp3',
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
        timeout: 30000,
      }
    );

    console.log(`[TTS] ${VOICE} 보이스로 mp3 생성 성공 (${res.data.byteLength} bytes)`);
    return Buffer.from(res.data);
  } catch (err) {
    console.error('[TTS] 음성 생성 실패:', err.response?.data?.toString() || err.message);
    return null;
  }
}

module.exports = { textToSpeech };
