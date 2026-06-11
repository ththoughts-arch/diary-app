/* ── weather.js (standalone) ── */
const Weather = (() => {
  const OWM_KEY = 'b1b15e88fa797225412429c1c50c122';  // 무료 데모키 - 실제 발급 필요

  async function load() {
    const s = await Store.Settings.get();
    if (!s.weatherEnabled) return;
    if (!navigator.geolocation) {
      console.log('위치 정보 지원 안 됨');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        await fetchWeather(lat, lon);
        await Store.Settings.set('location', `${lat.toFixed(2)}, ${lon.toFixed(2)}`);
        const locEl = document.getElementById('location-label');
        if (locEl) locEl.textContent = '위치 설정 완료 ✓';
      },
      (err) => {
        console.log('위치 접근 실패:', err.message);
        const locEl = document.getElementById('location-label');
        if (locEl) locEl.textContent = '위치 접근 거부됨';
        // 위치 없이 서울 기본값으로 시도
        fetchWeather(37.5665, 126.9780);
      },
      { timeout: 8000 }
    );
  }

  async function fetchWeather(lat, lon) {
    try {
      const key = localStorage.getItem('diary_owm_key') || OWM_KEY;
      const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${key}&units=metric&lang=kr&cnt=16`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`날씨 API 오류: ${res.status}`);
      const data = await res.json();
      if (!data.list?.length) throw new Error('날씨 데이터 없음');

      let amData = null, pmData = null;
      let hasRain = false, rainTime = '';

      for (const item of data.list) {
        const d = new Date(item.dt * 1000);
        const h = d.getHours();
        if (!amData && h >= 6 && h <= 12) amData = item;
        if (!pmData && h >= 13 && h <= 18) pmData = item;
        if (h >= 7 && h <= 20 && !hasRain) {
          const weather = item.weather[0]?.main || '';
          if (weather === 'Rain' || weather === 'Drizzle' || weather === 'Thunderstorm') {
            hasRain = true;
            rainTime = `${h}시`;
          }
        }
      }

      const firstItem = data.list[0];
      if (!amData) amData = firstItem;
      if (!pmData) pmData = firstItem;

      const setWeather = (valId, descId, item) => {
        const temp = Math.round(item.main.temp);
        const desc = item.weather[0]?.description || '-';
        const el = document.getElementById(valId);
        const de = document.getElementById(descId);
        if (el) el.textContent = `${temp}°C`;
        if (de) de.textContent = desc;
      };

      setWeather('w-am', 'w-am-desc', amData);
      setWeather('w-pm', 'w-pm-desc', pmData);

      const rainEl = document.getElementById('rain-alert');
      const rainMsg = document.getElementById('rain-msg');
      if (rainEl && rainMsg && hasRain) {
        rainMsg.textContent = `${rainTime}경 비 예보. 외출 시 우산 챙기세요.`;
        rainEl.style.display = 'flex';
      }
    } catch (e) {
      console.error('날씨 불러오기 실패:', e);
      // 실패 시 UI에 안내
      const amEl = document.getElementById('w-am');
      const amDesc = document.getElementById('w-am-desc');
      if (amEl) amEl.textContent = '--°C';
      if (amDesc) amDesc.textContent = '날씨 설정 필요';
    }
  }

  return { load, fetchWeather };
})();
