const axios = require('axios');

const TMAP_KEY = process.env.TMAP_API_KEY;

// 주소 → 좌표 변환
async function geocode(address) {
  const res = await axios.get('https://apis.openapi.sk.com/tmap/geo/fullAddrGeo', {
    params: {
      version: 1,
      addressFlag: 'F00',
      fullAddr: address,
      appKey: TMAP_KEY,
    },
  });

  const result = res.data?.coordinateInfo?.coordinate?.[0];
  if (!result) throw new Error(`주소 변환 실패: ${address}`);

  return {
    lon: parseFloat(result.lon || result.newLon),
    lat: parseFloat(result.lat || result.newLat),
  };
}

// 경로 조회 (소요시간, 거리, 사고·공사구간 포함)
async function getRoute(originAddr, destAddr) {
  const [origin, dest] = await Promise.all([
    geocode(originAddr),
    geocode(destAddr),
  ]);

  const res = await axios.post(
    'https://apis.openapi.sk.com/tmap/routes?version=1',
    {
      startX: origin.lon,
      startY: origin.lat,
      endX: dest.lon,
      endY: dest.lat,
      reqCoordType: 'WGS84GEO',
      resCoordType: 'WGS84GEO',
      trafficInfo: 'Y',
    },
    {
      headers: {
        appKey: TMAP_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  const feature = res.data?.features?.[0]?.properties;
  if (!feature) throw new Error('경로 조회 실패');

  const totalTime = Math.round(feature.totalTime / 60); // 분
  const totalDistance = (feature.totalDistance / 1000).toFixed(1); // km
  const totalFare = feature.totalFare || 0;

  // 사고·공사 구간 추출
  const incidents = [];
  const features = res.data?.features || [];
  for (const f of features) {
    const props = f.properties;
    if (props.description) {
      const desc = props.description;
      if (desc.includes('사고') || desc.includes('공사') || desc.includes('통제')) {
        incidents.push(desc);
      }
    }
  }

  // 평균 대비 지연 여부 (totalTime 기준 30분 이상이면 지연)
  const normalTime = 25; // 정상 소요시간 (분) - 약 25분 예상
  const isDelayed = totalTime > normalTime + 10;
  const delayMin = Math.max(0, totalTime - normalTime);

  return {
    totalTime,
    totalDistance,
    totalFare,
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

  const departureDate = new Date(arrivalDate.getTime() - totalTime * 60 * 1000 - 5 * 60 * 1000); // 여유 5분
  const dh = departureDate.getHours().toString().padStart(2, '0');
  const dm = departureDate.getMinutes().toString().padStart(2, '0');
  return `${dh}:${dm}`;
}

module.exports = { getRoute, getRecommendedDeparture };
