const axios = require('axios');

// Open-Meteo API - 무료, 키 불필요 (아이폰 날씨앱과 동일 데이터 기반)
// 부산진구 좌표
const LAT = 35.158;
const LON = 129.049;

const WMO_CODES = {
  0: '맑음', 1: '대체로 맑음', 2: '구름 조금', 3: '흐림',
  45: '안개', 48: '안개',
  51: '이슬비', 53: '이슬비', 55: '이슬비',
  61: '비', 63: '비', 65: '강한 비',
  71: '눈', 73: '눈', 75: '강한 눈',
  80: '소나기', 81: '소나기', 82: '강한 소나기',
  95: '천둥번개', 96: '우박 동반 천둥', 99: '우박 동반 천둥',
};

async function getWeather() {
  try {
    const res = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: LAT,
        longitude: LON,
        hourly: 'temperature_2m,precipitation_probability,weathercode,windspeed_10m,relativehumidity_2m',
        timezone: 'Asia/Seoul',
        forecast_days: 1,
      },
    });

    const data = res.data.hourly;

    // 오전 8시 인덱스 (hourly 배열에서 8번째)
    const idx = 8;

    const code = data.weathercode[idx];
    const temp = data.temperature_2m[idx];
    const rainProb = data.precipitation_probability[idx];
    const windSpeed = data.windspeed_10m[idx];
    const humidity = data.relativehumidity_2m[idx];

    const weatherDesc = WMO_CODES[code] || '맑음';
    const needUmbrella = rainProb >= 40 || [51,53,55,61,63,65,80,81,82].includes(code);

    return {
      weatherDesc,
      temp: `${Math.round(temp)}°C`,
      rainProb: `${rainProb}%`,
      windSpeed: `${windSpeed}km/h`,
      humidity: `${humidity}%`,
      needUmbrella,
    };
  } catch (err) {
    console.error('날씨 API 오류:', err.message);
    return {
      weatherDesc: '날씨 정보 없음',
      temp: '-',
      rainProb: '-',
      windSpeed: '-',
      humidity: '-',
      needUmbrella: false,
    };
  }
}

module.exports = { getWeather };
