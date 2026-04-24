const axios = require('axios');

// Open-Meteo API - 무료, 키 불필요 (아이폰 날씨앱과 동일 데이터 기반)
// 부산진구 좌표
const LAT = 35.158;
const LON = 129.049;
const WEATHER_TIMEOUT_MS = Number(process.env.WEATHER_TIMEOUT_MS || 10000);
const COMMUTE_HOURS = [7, 8, 9];

const weatherClient = axios.create({
  timeout: WEATHER_TIMEOUT_MS,
});

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

function getSeasonFallbackTemp(date = new Date()) {
  const monthlyTemps = [-1, 3, 8, 14, 19, 23, 27, 28, 24, 18, 11, 4];
  return monthlyTemps[date.getMonth()] ?? 20;
}

function formatNumber(value, digits = 0) {
  if (value == null || Number.isNaN(Number(value))) return null;
  return Number(value).toFixed(digits).replace(/\.0$/, '');
}

function findHourIndex(times, targetHour) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  const hourText = `T${String(targetHour).padStart(2, '0')}:00`;
  return Array.isArray(times)
    ? times.findIndex((t) => t.startsWith(today) && t.includes(hourText))
    : -1;
}

function pickAt(arr, idx) {
  return Array.isArray(arr) && arr[idx] != null ? arr[idx] : null;
}

function pickMorningRange(data, field) {
  const values = [];
  for (const hour of COMMUTE_HOURS) {
    const idx = findHourIndex(data.time, hour);
    const value = pickAt(data[field], idx);
    if (value != null) values.push(value);
  }
  return values;
}

// 코디 추천
function getOutfitRecommendation({
  temp,
  apparentTemp,
  morningLow,
  morningHigh,
  rainProb,
  windSpeed,
  humidity,
  isRaining,
  isDustBad,
  dataAvailable = true,
}) {
  const baseTemp = apparentTemp ?? temp ?? getSeasonFallbackTemp();
  const high = morningHigh ?? temp ?? baseTemp;
  const low = morningLow ?? temp ?? baseTemp;
  const tempGap = high - low;
  const strongWind = windSpeed != null && windSpeed >= 18;
  const humid = humidity != null && humidity >= 75;

  let main;
  if (baseTemp >= 28) main = '반팔이나 얇은 셔츠에 통풍 잘 되는 하의를 추천해요.';
  else if (baseTemp >= 24) main = '반팔에 얇은 셔츠를 걸치면 출근길과 실내 냉방 모두 대응하기 좋아요.';
  else if (baseTemp >= 20) main = '얇은 긴팔이나 반팔 위 가벼운 가디건 조합이 무난해요.';
  else if (baseTemp >= 17) main = '긴팔 티셔츠나 얇은 니트에 가벼운 겉옷을 챙기세요.';
  else if (baseTemp >= 13) main = '셔츠나 니트 위에 재킷, 트렌치, 바람막이 중 하나가 현실적이에요.';
  else if (baseTemp >= 9) main = '니트나 맨투맨에 두께감 있는 재킷이 필요해요.';
  else if (baseTemp >= 5) main = '코트나 패딩 조끼처럼 보온되는 겉옷을 입는 게 좋아요.';
  else main = '패딩이나 두꺼운 코트, 목도리까지 챙기는 겨울 복장이 좋아요.';

  const notes = [];
  if (!dataAvailable) notes.push('실시간 날씨를 못 받아 계절 기준으로 추천했어요.');
  if (tempGap >= 7) notes.push('아침과 낮 기온 차가 커서 벗기 쉬운 겉옷이 좋아요.');
  if (strongWind) notes.push('바람이 강해서 얇은 옷 여러 겹보다 바람막이가 낫습니다.');
  if (humid && baseTemp >= 20) notes.push('습도가 높아 두꺼운 소재는 답답할 수 있어요.');

  const accessories = [];
  if (isRaining || (rainProb != null && rainProb >= 40)) accessories.push('우산');
  if (isDustBad) accessories.push('KF 마스크');

  const rangeText = dataAvailable
    ? `출근 시간대 체감 ${formatNumber(baseTemp)}°C, 기온 ${formatNumber(low)}~${formatNumber(high)}°C 기준.`
    : `오늘 계절 기준 예상 ${formatNumber(baseTemp)}°C 안팎.`;

  return [
    `👕 코디 추천: ${main}`,
    rangeText,
    notes.length > 0 ? `💡 ${notes.join(' ')}` : '',
    accessories.length > 0 ? `챙길 것: ${accessories.join(', ')}` : '',
  ].filter(Boolean).join('\n');
}

async function getWeather() {
  try {
    const [weatherResult, airResult] = await Promise.allSettled([
      weatherClient.get('https://api.open-meteo.com/v1/forecast', {
        params: {
          latitude: LAT,
          longitude: LON,
          hourly: 'temperature_2m,apparent_temperature,precipitation_probability,weathercode,windspeed_10m,relativehumidity_2m',
          timezone: 'Asia/Seoul',
          forecast_days: 2,
        },
      }),
      weatherClient.get('https://air-quality-api.open-meteo.com/v1/air-quality', {
        params: {
          latitude: LAT,
          longitude: LON,
          hourly: 'pm10,pm2_5',
          timezone: 'Asia/Seoul',
          forecast_days: 2,
        }
      })
    ]);

    if (weatherResult.status === 'rejected') {
      throw weatherResult.reason;
    }

    const weatherRes = weatherResult.value;
    const airRes = airResult.status === 'fulfilled' ? airResult.value : null;
    const data = weatherRes.data.hourly;
    const airData = airRes?.data?.hourly || {};

    // 오전 8시에 해당하는 hourly 인덱스를 동적으로 검색 (배열 bounds 검증 포함)
    const targetHour = 8;
    let idx = findHourIndex(data.time, targetHour);
    if (idx < 0 || idx >= (data.weathercode?.length || 0)) {
      idx = 0;
    }

    const code = pickAt(data.weathercode, idx);
    const temp = pickAt(data.temperature_2m, idx);
    const apparentTemp = pickAt(data.apparent_temperature, idx);
    const rainProb = pickAt(data.precipitation_probability, idx);
    const windSpeed = pickAt(data.windspeed_10m, idx);
    const humidity = pickAt(data.relativehumidity_2m, idx);

    const pm10 = pickAt(airData.pm10, idx) ?? 0;
    const pm25 = pickAt(airData.pm2_5, idx) ?? 0;
    const morningTemps = pickMorningRange(data, 'temperature_2m');
    const morningLow = morningTemps.length > 0 ? Math.min(...morningTemps) : temp;
    const morningHigh = morningTemps.length > 0 ? Math.max(...morningTemps) : temp;

    const weatherDesc = code != null && WMO_CODES[code] ? WMO_CODES[code] : '정보 없음';
    const needUmbrella = (rainProb != null && rainProb >= 40) || [51,53,55,61,63,65,80,81,82].includes(code);
    const dust = getDustLevel(pm10, pm25);
    const outfit = getOutfitRecommendation({
      temp,
      apparentTemp,
      morningLow,
      morningHigh,
      rainProb,
      windSpeed,
      humidity,
      isRaining: needUmbrella,
      isDustBad: dust.bad,
    });

    console.log(`[weather] idx=${idx} code=${code} desc=${weatherDesc} temp=${temp}°C rain=${rainProb}% wind=${windSpeed} pm10=${pm10} pm25=${pm25}`);
    if (airResult.status === 'rejected') {
      console.error('대기질 API 오류:', airResult.reason.message);
    }

    return {
      weatherDesc,
      temp: temp != null ? `${Math.round(temp)}°C` : '-',
      rainProb: rainProb != null ? `${rainProb}%` : '-',
      windSpeed: windSpeed != null ? `${windSpeed}km/h` : '-',
      humidity: humidity != null ? `${humidity}%` : '-',
      needUmbrella,
      dust: dust.level,
      pm10,
      pm25,
      outfit
    };
  } catch (err) {
    console.error('날씨 API 오류:', err.message);
    const fallbackTemp = getSeasonFallbackTemp();
    return {
      weatherDesc: '날씨 정보 없음',
      temp: '-',
      rainProb: '-',
      windSpeed: '-',
      humidity: '-',
      needUmbrella: false,
      dust: '알 수 없음',
      pm10: null,
      pm25: null,
      outfit: getOutfitRecommendation({
        temp: fallbackTemp,
        apparentTemp: fallbackTemp,
        morningLow: fallbackTemp - 2,
        morningHigh: fallbackTemp + 3,
        isRaining: false,
        isDustBad: false,
        dataAvailable: false,
      })
    };
  }
}

module.exports = { getWeather };
