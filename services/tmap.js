const axios = require('axios');

const TMAP_APP_KEY = process.env.TMAP_APP_KEY;

// T-map 지오코딩 (주소 → 좌표)
async function geocode(address) {
  if (!TMAP_APP_KEY) throw new Error('TMAP_APP_KEY가 설정되지 않았습니다.');
  
  const res = await axios.get('https://apis.openapi.sk.com/tmap/geo/fullAddrGeo', {
    params: {
      version: 1,
      format: 'json',
      coordType: 'WGS84GEO',
      fullAddr: address
    },
    headers: {
      'appKey': TMAP_APP_KEY
    }
  });

  const coordInfo = res.data?.coordinateInfo?.coordinate;
  if (!coordInfo || coordInfo.length === 0) throw new Error(`주소 변환 실패: ${address}`);

  const item = coordInfo[0];
  // 신주소(newLon) 또는 구주소(lon) 좌표 반환
  const lon = item.newLon && item.newLon.length > 0 ? item.newLon : item.lon;
  const lat = item.newLat && item.newLat.length > 0 ? item.newLat : item.lat;

  return { lon: parseFloat(lon), lat: parseFloat(lat) };
}

// T-map 자동차 경로 탐색 (최적길)
async function getRoute(originAddr, destAddr) {
  if (!TMAP_APP_KEY) throw new Error('TMAP_APP_KEY가 설정되지 않았습니다.');

  const [origin, dest] = await Promise.all([
    geocode(originAddr),
    geocode(destAddr),
  ]);

  const res = await axios.post('https://apis.openapi.sk.com/tmap/routes?version=1&format=json', {
    startX: origin.lon,
    startY: origin.lat,
    endX: dest.lon,
    endY: dest.lat,
    reqCoordType: 'WGS84GEO',
    resCoordType: 'WGS84GEO',
    searchOption: '0', // 0: 추천 (가장 빠른 길)
    trafficInfo: 'Y'   // 실시간 교통정보 포함 (구간 지연시간 등)
  }, {
    headers: {
      'appKey': TMAP_APP_KEY,
      'Content-Type': 'application/json'
    }
  });

  const features = res.data?.features;
  if (!features || features.length === 0) throw new Error('경로 조회 실패');

  const summary = features[0].properties;
  const totalTime = Math.round(summary.totalTime / 60); // 초 → 분
  const totalDistance = (summary.totalDistance / 1000).toFixed(1); // m → km
  const tollFare = summary.totalFare || 0;
  
  // 사고·공사 및 정체 구간 추출 (혼잡도 정보)
  const incidents = [];
  let severeDelay = false;

  // properties.taxiFare 어쩌고가 있는 properties말고, 라인 스트링의 traffic을 볼 수 있음
  // T-map은 별도 api 없이 congestion으로 분석 가능하지만 단순화를 위해 time/distance 기반 산출
  for (const feat of features) {
    if (feat.geometry.type === 'LineString' && feat.properties.congestion !== undefined) {
      if (feat.properties.congestion === 3 || feat.properties.congestion === 4) { // 3: 지체, 4: 정체
        if (feat.properties.name && feat.properties.name !== '') {
          incidents.push(`${feat.properties.name} 정체`);
        }
      }
    }
  }

  // 평소 소요시간 기준 지연 판단 (약 25분 기준)
  const normalTime = 25;
  const delayMin = Math.max(0, totalTime - normalTime);
  const isDelayed = delayMin > 7; // 7분 이상 막히면 지연으로 간주

  return {
    totalTime,
    totalDistance,
    tollFare,
    fuelPrice: 0, // Tmap 자동차 길찾기는 요약에 fuelPrice 미포함이므로 0 
    isDelayed,
    delayMin,
    incidents: [...new Set(incidents)].slice(0, 3), // 중복 제거 후 최대 3개
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
