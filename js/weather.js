/* ── weather.js: Open-Meteo (무료, 키 불필요) ── */
const Weather = (() => {

  // 날씨 코드 → 한국어 설명
  const weatherDesc = {
    0: '맑음', 1: '대체로 맑음', 2: '부분 흐림', 3: '흐림',
    45: '안개', 48: '안개',
    51: '이슬비', 53: '이슬비', 55: '이슬비',
    61: '비', 63: '비', 65: '강한 비',
    71: '눈', 73: '눈', 75: '강한 눈',
    80: '소나기', 81: '소나기', 82: '강한 소나기',
    95: '뇌우', 96: '뇌우', 99: '뇌우',
  };

  // 비/눈 여부 (우산 알림)
  const rainCodes = [51,53,55,61,63,65,80,81,82,95,96,99];

  async function load() {
    if (!navigator.geolocation) {
      setFallback();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        await fetchWeather(lat, lon);
        // 위치 설정 표시
        const locEl = document.getElementById('location-label');
        if (locEl) locEl.textContent = '위치 자동 감지 완료 ✓';
      },
      (err) => {
        console.log('위치 접근 실패, 서울 기본값 사용');
        fetchWeather(37.5665, 126.9780); // 서울 기본값
      },
      { timeout: 8000 }
    );
  }

  async function fetchWeather(lat, lon) {
    try {
      // Open-Meteo API — 무료, 키 불필요
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,weathercode&timezone=auto&forecast_days=1`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('날씨 API 응답 오류');
      const data = await res.json();

      const hours = data.hourly.time;         // ["2026-06-10T00:00", ...]
      const temps = data.hourly.temperature_2m;
      const codes = data.hourly.weathercode;

      // 오전 (9시), 오후 (15시) 데이터 추출
      let amTemp = null, amCode = null;
      let pmTemp = null, pmCode = null;
      let hasRain = false, rainTime = '';

      hours.forEach((t, i) => {
        const h = new Date(t).getHours();
        if (h === 9)  { amTemp = temps[i]; amCode = codes[i]; }
        if (h === 15) { pmTemp = temps[i]; pmCode = codes[i]; }
        if (h >= 7 && h <= 20 && rainCodes.includes(codes[i]) && !hasRain) {
          hasRain = true;
          rainTime = `오전 ${h < 12 ? h : h-12}시`;
          if (h >= 12) rainTime = `오후 ${h === 12 ? 12 : h-12}시`;
        }
      });

      // 없으면 현재 시간 기준 데이터로 대체
      if (amTemp === null) { amTemp = temps[0]; amCode = codes[0]; }
      if (pmTemp === null) { pmTemp = temps[0]; pmCode = codes[0]; }

      // UI 업데이트
      const amEl = document.getElementById('w-am');
      const amDesc = document.getElementById('w-am-desc');
      const pmEl = document.getElementById('w-pm');
      const pmDesc = document.getElementById('w-pm-desc');

      if (amEl) amEl.textContent = `${Math.round(amTemp)}°C`;
      if (amDesc) amDesc.textContent = weatherDesc[amCode] || '흐림';
      if (pmEl) pmEl.textContent = `${Math.round(pmTemp)}°C`;
      if (pmDesc) pmDesc.textContent = weatherDesc[pmCode] || '흐림';

      // 우산 알림
      const rainEl = document.getElementById('rain-alert');
      const rainMsg = document.getElementById('rain-msg');
      if (rainEl && rainMsg && hasRain) {
        rainMsg.textContent = `${rainTime}경 비 예보가 있어요. 외출 시 우산을 꼭 챙기세요.`;
        rainEl.style.display = 'flex';
      } else if (rainEl) {
        rainEl.style.display = 'none';
      }

    } catch (e) {
      console.error('날씨 불러오기 실패:', e);
      setFallback();
    }
  }

  function setFallback() {
    const amEl = document.getElementById('w-am-desc');
    const pmEl = document.getElementById('w-pm-desc');
    if (amEl) amEl.textContent = '위치 허용 필요';
    if (pmEl) pmEl.textContent = '위치 허용 필요';
  }

  return { load };
})();
