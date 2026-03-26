const axios = require('axios');

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

// 네이버 지오코딩 (주소 → 좌표)
async function geocode(address) {
  const res = await axios.get('https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode', {
    params: { query: address },
    headers: {
      'X-NCP-APIGW-API-KEY-ID': NAVER_CLIENT_ID,
      'X-NCP-APIGW-API-KEY': NAVER_CLIENT_SECRET,
    },
  });

  const addr = res.data?.addresses?.[0];
  if (!addr) throw new Error(`주소 변환 실패: ${address}`);

  return { lon: parseFloat(addr.x), lat: parseFloat(addr.y) };
}

// 네이버 길찾기 (Directions 5)
async function getRoute(originAddr, destAddr) {
  const [origin, dest] = await Promise.all([
    geocode(originAddr),
    geocode(destAddr),
  ]);

  const res = await axios.get('https://naveropenapi.apigw.ntruss.com/map-direction/v1/driving', {
    params: {
      start: `${origin.lon},${origin.lat}`,
      goal: `${dest.lon},${dest.lat}`,
      option: 'trafast',
    },
    headers: {
      'X-NCP-APIGW-API-KEY-ID': NAVER_CLIENT_ID,
      'X-NCP-APIGW-API-KEY': NAVER_CLIENT_SECRET,
    },
  });

  const route = res.data?.route?.trafast?.[0];
  if (!route) throw new Error('경로 조회 실패');

  const summary = route.summary;
  const totalTime = Math.round(summary.duration / 60000); // ms → 분
  const totalDistance = (summary.distance / 1000).toFixed(1); // m → km
  const tollFare = summary.tollFare || 0;
  const fuelPrice = summary.fuelPrice || 0;

  // 사고·공사 구간 추출 (guide 정보에서)
  const incidents = [];
  const sections = route.section || [];
  for (const sec of sections) {
    if (sec.congestion === 0) {
      incidents.push(`${sec.name || '구간'} 정체`);
    }
  }

  // 평소 소요시간 기준 지연 판단 (약 25분 기준)
  const normalTime = 25;
  const isDelayed = totalTime > normalTime + 10;
  const delayMin = Math.max(0, totalTime - normalTime);

  return {
    totalTime,
    totalDistance,
    tollFare,
    fuelPrice,
    isDelayed,
    delayMin,
    incidents: [...new Set(incidents)].slice(0, 3),
    origin,
    dest,
  };
}

// 추천 출발 시각 계산
function getRecommendedDeparture(totalTime, targetArrival = '08:30') {
  const [h, m] = targetArrival.split(':').map(Number);
  const arrivalDate = new Date();
  arrivalDate.setHours(h, m, 0, 0);

  const buffer = 5; // 여유 5분
  const departureDate = new Date(arrivalDate.getTime() - (totalTime + buffer) * 60 * 1000);
  const dh = departureDate.getHours().toString().padStart(2, '0');
  const dm = departureDate.getMinutes().toString().padStart(2, '0');
  return `${dh}:${dm}`;
}

module.exports = { getRoute, getRecommendedDeparture };
