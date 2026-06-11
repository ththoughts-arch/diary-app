/* ── weather.js: Open-Meteo (무료, 키 불필요) ── */
const Weather = (() => {

  const weatherDesc = {
    0:'맑음',1:'대체로 맑음',2:'부분 흐림',3:'흐림',
    45:'안개',48:'안개',51:'이슬비',53:'이슬비',55:'이슬비',
    61:'비',63:'비',65:'강한 비',71:'눈',73:'눈',75:'강한 눈',
    80:'소나기',81:'소나기',82:'강한 소나기',95:'뇌우',96:'뇌우',99:'뇌우',
  };
  const rainCodes = [51,53,55,61,63,65,80,81,82,95,96,99];

  async function load() {
    // 위치 권한 시도, 실패하면 서울 기본값
    try {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 6000 })
      );
      await fetchWeather(pos.coords.latitude, pos.coords.longitude);
    } catch (e) {
      await fetchWeather(37.5665, 126.9780); // 서울
    }
  }

  async function fetchWeather(lat, lon) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,weathercode&timezone=Asia%2FSeoul&forecast_days=1`;
      const res = await fetch(url);
      const data = await res.json();

      const hours = data.hourly.time;
      const temps = data.hourly.temperature_2m;
      const codes = data.hourly.weathercode;

      let amTemp, amCode, pmTemp, pmCode;
      let hasRain = false, rainTime = '';

      hours.forEach((t, i) => {
        const h = parseInt(t.split('T')[1]);
        if (h === 9)  { amTemp = temps[i]; amCode = codes[i]; }
        if (h === 15) { pmTemp = temps[i]; pmCode = codes[i]; }
        if (h >= 7 && h <= 20 && rainCodes.includes(codes[i]) && !hasRain) {
          hasRain = true;
          rainTime = h < 12 ? `오전 ${h}시` : `오후 ${h-12||12}시`;
        }
      });

      if (amTemp == null) { amTemp = temps[9]; amCode = codes[9]; }
      if (pmTemp == null) { pmTemp = temps[15]; pmCode = codes[15]; }

      const amEl = document.getElementById('w-am');
      const amDesc = document.getElementById('w-am-desc');
      const pmEl = document.getElementById('w-pm');
      const pmDesc = document.getElementById('w-pm-desc');
      if (amEl) amEl.textContent = `${Math.round(amTemp)}°C`;
      if (amDesc) amDesc.textContent = weatherDesc[amCode] || '-';
      if (pmEl) pmEl.textContent = `${Math.round(pmTemp)}°C`;
      if (pmDesc) pmDesc.textContent = weatherDesc[pmCode] || '-';

      const rainEl = document.getElementById('rain-alert');
      const rainMsg = document.getElementById('rain-msg');
      if (rainEl && rainMsg) {
        if (hasRain) {
          rainMsg.textContent = `${rainTime}경 비 예보. 외출 시 우산 챙기세요.`;
          rainEl.style.display = 'flex';
        } else {
          rainEl.style.display = 'none';
        }
      }
    } catch(e) {
      console.error('날씨 오류:', e);
    }
  }

  return { load };
})();
