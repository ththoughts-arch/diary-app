/* ====================================================
   api.js — Claude API + 날씨 API
   ==================================================== */
const API = (() => {

  const ENDPOINT = 'https://api.anthropic.com/v1/messages';
  const MODEL    = 'claude-sonnet-4-20250514';

  let _key = localStorage.getItem('diary_api_key') || '';
  const setKey  = k => { _key = k; localStorage.setItem('diary_api_key', k); };
  const hasKey  = ()  => !!_key;

  /* ── 공통 fetch (타임아웃 25초) ── */
  async function _fetch(body, timeoutMs = 25000) {
    if (!_key) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'x-api-key':_key, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const data = await res.json();
      if (data.error) { console.error('[API]', data.error.message); return null; }
      return data.content?.[0]?.text ?? null;
    } catch (e) {
      clearTimeout(timer);
      if (e.name !== 'AbortError') console.error('[API]', e);
      else console.warn('[API] 타임아웃');
      return null;
    }
  }

  /* ── JSON 파싱 헬퍼 ── */
  const _json = (raw, fallback = null) => {
    if (!raw) return fallback;
    try { const m = raw.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : fallback; }
    catch { return fallback; }
  };

  /* ── 일기 생성 ── */
  async function generateDiary(answers, health) {
    // API 키 없으면 답변 그대로 연결
    if (!_key) {
      const diary = answers.filter(a=>a.answer).map(a=>a.answer).join('\n\n');
      return { diary, tags:[], mood:'😊', summary:diary.slice(0,30), feedback:'' };
    }

    const catLabels = { economy:'💰경제', relation:'🤝관계', health:'💪건강', growth:'🌱자아실현', parenting:'👨‍👧육아', etc:'✨그외' };
    const grouped = {};
    answers.filter(a=>a.answer).forEach(a => { const c=a.category||'etc'; (grouped[c]=grouped[c]||[]).push(a); });
    const bodyText = Object.entries(grouped)
      .map(([c,items]) => `[${catLabels[c]||c}]\n${items.map(i=>`Q: ${i.question}\nA: ${i.answer}`).join('\n')}`)
      .join('\n\n');

    const system = `사용자의 하루 기록을 카테고리를 자연스럽게 녹여 1인칭 일기 문체로 300~400자 작성하세요.
반드시 JSON만 반환 (다른 텍스트 없이):
{"diary":"일기내용","tags":["#태그1","#태그2","#태그3"],"mood":"😊","summary":"30자이내요약","feedback":"따뜻한피드백1~2문장"}`;
    const user = `${bodyText}${health?`\n\n건강: 수면${health.sleep||'--'} 스트레스${health.stress||'--'} 러닝${health.pace||'없음'}`:''}`;

    const raw = await _fetch({ model:MODEL, max_tokens:800, system, messages:[{role:'user',content:user}] });
    return _json(raw) || { diary: answers.map(a=>a.answer).join('\n'), tags:[], mood:'😊', summary:'오늘의 일기', feedback:'' };
  }

  /* ── 리포트 생성 ── */
  async function generateReport(entries) {
    if (!_key || !entries.length) return null;
    const system = `사용자의 일기를 분석해 리포트를 작성하세요.
반드시 JSON만 반환:
{"title":"제목","narrative":"2-3문장총평","keywords":["#키워드"],"moodSummary":"감정흐름","lifeSummary":{"work":{"highlight":"핵심","detail":"상세"},"family":{"highlight":"핵심","detail":"상세"},"health":{"highlight":"핵심","detail":"상세"},"money":{"highlight":"핵심","detail":"상세"}},"bestMoment":"기억에남는순간","bestQuote":"인상적인문장","nextTips":["제안1","제안2","제안3"]}`;
    const user = entries.map(e=>`[${e.date}] ${e.diary||e.summary||''}`).join('\n');
    const raw = await _fetch({ model:MODEL, max_tokens:1200, system, messages:[{role:'user',content:`일기:\n${user}`}] });
    return _json(raw);
  }

  /* ── 가민 이미지 파싱 ── */
  async function parseGarmin(base64, mediaType, type) {
    if (!_key) return null;
    const prompts = {
      health: `이 가민 앱 스크린샷에서 수면/스트레스 수치를 찾아 JSON만 반환:
{"sleepScore":숫자or null,"totalSleep":"시간or null","deepSleep":"시간or null","stressScore":숫자or null}`,
      run: `이 가민 앱 러닝 스크린샷에서 수치를 찾아 JSON만 반환:
{"duration":"42분","pace":"5'38\\"","heartRate":숫자,"calories":숫자,"distance":"7.4km"}`,
    };
    const raw = await _fetch({
      model: MODEL, max_tokens: 300,
      messages: [{ role:'user', content: [
        { type:'image', source:{ type:'base64', media_type: mediaType||'image/jpeg', data:base64 } },
        { type:'text',  text: prompts[type] || prompts.health },
      ]}],
    }, 20000);
    return _json(raw);
  }

  /* ── 이미지 타입 감지 ── */
  const detectMediaType = b64 => {
    try {
      const hex = Array.from(atob(b64.slice(0,12))).map(c=>c.charCodeAt(0).toString(16).padStart(2,'0')).join('');
      if (hex.startsWith('89504e47')) return 'image/png';
      if (hex.startsWith('ffd8ff'))   return 'image/jpeg';
    } catch {}
    return 'image/jpeg';
  };

  return { setKey, hasKey, generateDiary, generateReport, parseGarmin, detectMediaType };
})();
