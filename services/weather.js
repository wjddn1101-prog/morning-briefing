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

// 미세먼지 단계 판별
function getDustLevel(pm10, pm25) {
  let level = '좋음';
  let bad = false;
  if (pm10 > 80 || pm25 > 35) { level = '나쁨 😷'; bad = true; }
  else if (pm10 > 30 || pm25 > 15) { level = '보통'; }
  return { level, bad };
}

// 코디 추천
function getOutfitRecommendation(temp, isRaining, isDustBad) {
  let rec = '👕 코디 추천: ';
  
  if (temp >= 28) rec += '한여름 날씨예요! 시원한 반팔과 린넨 소재 옷을 입으세요.';
  else if (temp >= 23) rec += '더운 날씨 반팔이 쾌적해요.';
  else if (temp >= 20) rec += '가벼운 긴팔이나 얇은 가디건이 좋아요.';
  else if (temp >= 17) rec += '얇은 니트나 맨투맨, 가디건을 챙기세요.';
  else if (temp >= 12) rec += '재킷, 셔츠, 얇은 트렌치 코트를 입기 좋아요.';
  else if (temp >= 9) rec += '트렌치 코트나 얇은 야상 등 겉옷이 필수예요.';
  else if (temp >= 5) rec += '코트나 가죽자켓 등 꽤 두툼한 겉옷을 입으세요.';
  else rec += '겨울 날씨예요! 패딩이나 두꺼운 코트, 목도리를 챙기세요 🥶.';

  let accessories = [];
  if (isRaining) accessories.push('☂️ 우산');
  if (isDustBad) accessories.push('😷 미세먼지 마스크');

  if (accessories.length > 0) {
    rec += `\n💡 잊지마세요: *${accessories.join(', ')}*`;
  }
  return rec;
}

async function getWeather() {
  try {
    const [weatherRes, airRes] = await Promise.all([
      axios.get('https://api.open-meteo.com/v1/forecast', {
        params: {
          latitude: LAT,
          longitude: LON,
          hourly: 'temperature_2m,precipitation_probability,weathercode,windspeed_10m,relativehumidity_2m',
          timezone: 'Asia/Seoul',
          forecast_days: 1,
        },
      }),
      axios.get('https://air-quality-api.open-meteo.com/v1/air-quality', {
        params: {
          latitude: LAT,
          longitude: LON,
          hourly: 'pm10,pm2_5',
          timezone: 'Asia/Seoul',
          forecast_days: 1,
        }
      })
    ]).catch(err => { throw err; });

    const data = weatherRes.data.hourly;
    const airData = airRes.data.hourly;

    // 오전 8시 인덱스 (hourly 배열에서 8번째)
    const idx = 8;

    const code = data.weathercode[idx];
    const temp = data.temperature_2m[idx];
    const rainProb = data.precipitation_probability[idx];
    const windSpeed = data.windspeed_10m[idx];
    const humidity = data.relativehumidity_2m[idx];

    const pm10 = airData.pm10 ? airData.pm10[idx] : 0;
    const pm25 = airData.pm2_5 ? airData.pm2_5[idx] : 0;

    const weatherDesc = WMO_CODES[code] || '맑음';
    const needUmbrella = rainProb >= 40 || [51,53,55,61,63,65,80,81,82].includes(code);
    const dust = getDustLevel(pm10, pm25);
    const outfit = getOutfitRecommendation(temp, needUmbrella, dust.bad);

    return {
      weatherDesc,
      temp: `${Math.round(temp)}°C`,
      rainProb: `${rainProb}%`,
      windSpeed: `${windSpeed}km/h`,
      humidity: `${humidity}%`,
      needUmbrella,
      dust: dust.level,
      pm10,
      pm25,
      outfit
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
      dust: '알 수 없음',
      outfit: '코디 추천을 불러올 수 없습니다.'
    };
  }
}

module.exports = { getWeather };
