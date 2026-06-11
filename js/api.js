/* ── api.js: Claude API + OpenWeatherMap 연동 ── */
const API = (() => {

  // ── Claude API ──
  // ⚠️ 실제 배포 시 ANTHROPIC_API_KEY는 반드시 서버 프록시를 통해 호출하세요.
  // 클라이언트에 직접 키를 노출하지 마세요.
  const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';
  const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
  let ANTHROPIC_API_KEY = localStorage.getItem('diary_api_key') || '';

  function setApiKey(key) {
    ANTHROPIC_API_KEY = key;
    localStorage.setItem('diary_api_key', key);
  }

  async function callClaude(systemPrompt, userContent, maxTokens = 1000) {
    if (!ANTHROPIC_API_KEY) {
      const key = prompt('Claude API 키를 입력하세요 (설정에서 언제든 변경 가능):');
      if (key) setApiKey(key);
      else return null;
    }
    try {
      const res = await fetch(CLAUDE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: userContent }],
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return data.content?.[0]?.text || null;
    } catch (e) {
      console.error('Claude API 오류:', e);
      return null;
    }
  }

  // ── 일기 변환 ──
  async function generateDiary(answers, healthData) {
    const systemPrompt = `당신은 사용자의 하루 기록을 카테고리별로 정리하여 자연스러운 일기 문체로 작성하는 AI입니다.
- 1인칭 시점으로 작성하세요.
- 경제(회사/커리어/재무), 관계(가족/동료/친구), 건강, 자아실현, 육아, 그 외 카테고리를 고려하여 내용을 자연스럽게 녹여주세요.
- 전체 일기는 300~400자 분량의 자연스러운 문체로 작성하세요.
- 건강 데이터가 있으면 간결하게 포함하세요.
- 감정과 생각이 잘 드러나도록 작성하세요.
- JSON 형식으로만 반환하세요:
{"diary": "일기내용", "tags": ["#태그1","#태그2","#태그3","#태그4","#태그5"], "mood": "😊", "summary": "한줄요약(30자 이내)"}`;

    const catLabels = { economy:'💰경제', relation:'🤝관계', health:'💪건강', growth:'🌱자아실현', parenting:'👨‍👧육아', etc:'✨그외' };
    const categorized = {};
    answers.forEach(a => {
      const cat = a.category || 'etc';
      if (!categorized[cat]) categorized[cat] = [];
      categorized[cat].push(a);
    });

    const catText = Object.entries(categorized).map(([cat, items]) =>
      `[${catLabels[cat]||cat}]\n${items.map(i=>`Q: ${i.question}\nA: ${i.answer}`).join('\n')}`
    ).join('\n\n');

    const userContent = `오늘의 카테고리별 기록:
${catText}
${healthData ? `\n건강 데이터: 수면점수 ${healthData.sleep||'--'}, 스트레스 ${healthData.stress||'--'}, 러닝 ${healthData.pace||'없음'}` : ''}

위 내용을 카테고리를 자연스럽게 녹여서 하나의 일기로 정리해주세요.`;

    const raw = await callClaude(systemPrompt, userContent, 600);
    if (!raw) return null;
    try {
      const clean = raw.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch { return { diary: raw, tags: [], mood: '😊', summary: '오늘의 일기' }; }
  }

  // ── AI 건강 추천 ──
  async function generateHealthRec(healthData, recentEntries) {
    const systemPrompt = `당신은 사용자의 건강 데이터를 보고 오늘 하루를 어떻게 보낼지 간결하게 조언하는 AI입니다.
- 3줄 이내로 핵심적인 조언만 하세요.
- 따뜻하고 공감적인 말투를 사용하세요.
- JSON: {"rec": "추천문구", "tips": ["팁1","팁2","팁3"]}`;

    const userContent = `오늘 건강 데이터: 수면점수 ${healthData.sleep}, 스트레스 ${healthData.stress}, 러닝페이스 ${healthData.run || '없음'}
최근 패턴: 스트레스 3일 평균 ${healthData.stressAvg || healthData.stress}
조언을 JSON으로 주세요.`;

    const raw = await callClaude(systemPrompt, userContent, 300);
    if (!raw) return null;
    try {
      const clean = raw.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch { return null; }
  }

  // ── 주간 리포트 생성 ──
  async function generateWeeklyReport(entries) {
    const systemPrompt = `당신은 사용자의 일주일 일기를 분석하여 의미있는 리포트를 작성하는 AI입니다.
JSON 형식으로 반환하세요:
{
  "title": "이번 주를 한 문장으로",
  "narrative": "2-3문장 총평",
  "keywords": ["#키워드1","#키워드2"],
  "moodSummary": "감정 흐름 한 줄 요약",
  "lifeSummary": {
    "work": {"highlight": "업무 핵심", "detail": "상세내용"},
    "family": {"highlight": "육아/가족 핵심", "detail": "상세내용"},
    "health": {"highlight": "건강 핵심", "detail": "상세내용"},
    "money": {"highlight": "재무 핵심", "detail": "상세내용"}
  },
  "bestMoment": "이번 주 가장 기억에 남는 순간",
  "bestQuote": "일기에서 가장 인상적인 문장",
  "nextWeekTips": ["제안1","제안2","제안3"]
}`;

    const diaryTexts = entries.map(e => `[${e.date}] ${e.diary || e.summary || ''}`).join('\n');
    const raw = await callClaude(systemPrompt, `이번 주 일기:\n${diaryTexts}`, 1000);
    if (!raw) return null;
    try {
      const clean = raw.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch { return null; }
  }

  // ── 할 일 자동 추출 ──
  async function extractTodos(recentEntries) {
    if (!recentEntries.length) return [];
    const systemPrompt = `사용자의 최근 일기에서 내일 해야 할 일이나 하고 싶다고 언급한 내용을 추출하세요.
JSON 배열로만 반환하세요: ["할일1", "할일2", "할일3"] (최대 5개)`;

    const content = recentEntries.slice(0, 3).map(e => e.diary || e.summary || '').join('\n');
    const raw = await callClaude(systemPrompt, content, 200);
    if (!raw) return [];
    try {
      const clean = raw.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch { return []; }
  }

  // ── Claude Vision으로 가민 스크린샷 파싱 ──
  async function parseGarminImage(base64Image, type) {
    const typeLabels = { sleep: '수면', stress: '스트레스', run: '러닝' };
    const systemPrompt = `당신은 가민 스마트워치 앱 스크린샷에서 건강 데이터를 추출하는 AI입니다.
이미지에서 수치만 정확하게 추출하여 JSON으로 반환하세요.
${type === 'sleep' ? '{"sleepScore": 숫자, "totalSleep": "6h 34m", "deepSleep": "1h 02m", "remSleep": "1h 18m", "lightSleep": "3h 12m", "awake": "22m"}' : ''}
${type === 'stress' ? '{"stressScore": 숫자}' : ''}
${type === 'run' ? '{"duration": "42분", "pace": "5\'38\\"", "heartRate": 숫자, "calories": 숫자, "distance": "7.4km"}' : ''}
값을 찾을 수 없으면 null로 반환하세요.`;

    if (!ANTHROPIC_API_KEY) {
      const key = prompt('Claude API 키를 입력하세요:');
      if (key) setApiKey(key);
      else return null;
    }
    try {
      const res = await fetch(CLAUDE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 300,
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64Image } },
              { type: 'text', text: `${typeLabels[type]} 데이터를 추출해주세요.` },
            ],
          }],
        }),
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text || null;
      if (!raw) return null;
      const clean = raw.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch (e) { console.error('Vision API 오류:', e); return null; }
  }

  // ── OpenWeatherMap ──
  const WEATHER_KEY = 'YOUR_OPENWEATHERMAP_API_KEY'; // 실제 키로 교체

  async function getWeather(lat, lon) {
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${WEATHER_KEY}&units=metric&lang=kr&cnt=8`
      );
      const data = await res.json();
      if (!data.list) return null;

      const now = new Date();
      const amHour = 9, pmHour = 14;

      let amData = null, pmData = null;
      let hasRainInWindow = false;
      let rainTime = '';

      for (const item of data.list) {
        const d = new Date(item.dt * 1000);
        const h = d.getHours();
        if (!amData && h >= amHour && h < 12) amData = item;
        if (!pmData && h >= pmHour && h < 17) pmData = item;
        if (h >= 7 && h <= 20) {
          if (item.weather[0].main === 'Rain' || item.weather[0].main === 'Drizzle') {
            if (!hasRainInWindow) { hasRainInWindow = true; rainTime = `${h}시`; }
          }
        }
      }

      return {
        am: amData ? { temp: Math.round(amData.main.temp), desc: amData.weather[0].description } : null,
        pm: pmData ? { temp: Math.round(pmData.main.temp), desc: pmData.weather[0].description } : null,
        hasRain: hasRainInWindow,
        rainTime,
      };
    } catch (e) { console.error('날씨 API 오류:', e); return null; }
  }

  return { callClaude, generateDiary, generateHealthRec, generateWeeklyReport, extractTodos, parseGarminImage, getWeather, setApiKey };
})();
