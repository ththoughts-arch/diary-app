/* ── api.js: Claude API 연동 ── */
const API = (() => {

  const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';
  const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
  let ANTHROPIC_API_KEY = localStorage.getItem('diary_api_key') || '';

  function setApiKey(key) {
    ANTHROPIC_API_KEY = key;
    localStorage.setItem('diary_api_key', key);
  }

  function hasApiKey() {
    return !!ANTHROPIC_API_KEY;
  }

  // ── 공통 Claude 호출 (타임아웃 30초) ──
  async function callClaude(systemPrompt, userContent, maxTokens = 1000) {
    if (!ANTHROPIC_API_KEY) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
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
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json();
      if (data.error) { console.error('Claude API 오류:', data.error); return null; }
      return data.content?.[0]?.text || null;
    } catch (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError') console.warn('Claude API 타임아웃');
      else console.error('Claude API 오류:', e);
      return null;
    }
  }

  // ── 일기 생성 ──
  async function generateDiary(answers, healthData) {
    if (!ANTHROPIC_API_KEY) {
      // API 키 없으면 답변을 그냥 이어붙여서 반환
      const diary = answers.map(a => a.answer).filter(Boolean).join('\n\n');
      return { diary, tags: [], mood: '😊', summary: diary.slice(0,30), feedback: '' };
    }

    const systemPrompt = `당신은 사용자의 하루 기록을 카테고리별로 정리하여 자연스러운 일기 문체로 작성하는 AI입니다.
- 1인칭 시점으로 300~400자 분량으로 작성하세요.
- 경제(회사/커리어/재무), 관계(가족/동료/친구), 건강, 자아실현, 육아 카테고리를 자연스럽게 녹여주세요.
- JSON 형식으로만 반환하세요 (다른 텍스트 없이):
{"diary":"일기내용","tags":["#태그1","#태그2","#태그3"],"mood":"😊","summary":"한줄요약(30자이내)","feedback":"따뜻한AI피드백1~2문장"}`;

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

    const userContent = `오늘의 카테고리별 기록:\n${catText}${healthData ? `\n\n건강: 수면${healthData.sleep||'--'} 스트레스${healthData.stress||'--'} 러닝${healthData.pace||'없음'}` : ''}\n\n위 내용을 일기로 정리해주세요.`;

    const raw = await callClaude(systemPrompt, userContent, 800);
    if (!raw) return { diary: answers.map(a=>a.answer).join('\n'), tags:[], mood:'😊', summary:'오늘의 일기', feedback:'' };
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      return { diary: raw, tags:[], mood:'😊', summary:'오늘의 일기', feedback:'' };
    } catch { return { diary: raw, tags:[], mood:'😊', summary:'오늘의 일기', feedback:'' }; }
  }

  // ── 주간 리포트 생성 ──
  async function generateWeeklyReport(entries) {
    if (!ANTHROPIC_API_KEY || !entries.length) return null;

    const systemPrompt = `당신은 사용자의 일기를 분석하여 리포트를 작성하는 AI입니다.
JSON 형식으로만 반환하세요 (다른 텍스트 없이):
{"title":"한주를한문장으로","narrative":"2-3문장총평","keywords":["#키워드1","#키워드2"],"moodSummary":"감정흐름한줄","lifeSummary":{"work":{"highlight":"업무핵심","detail":"상세"},"family":{"highlight":"가족핵심","detail":"상세"},"health":{"highlight":"건강핵심","detail":"상세"},"money":{"highlight":"재무핵심","detail":"상세"}},"bestMoment":"가장기억에남는순간","bestQuote":"인상적인문장","nextWeekTips":["제안1","제안2","제안3"]}`;

    const diaryTexts = entries.map(e => `[${e.date}] ${e.diary||e.summary||''}`).join('\n');
    const raw = await callClaude(systemPrompt, `일기:\n${diaryTexts}`, 1200);
    if (!raw) return null;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      return null;
    } catch { return null; }
  }

  // ── 할 일 자동 추출 ──
  async function extractTodos(recentEntries) {
    if (!ANTHROPIC_API_KEY || !recentEntries.length) return [];
    const systemPrompt = `사용자의 최근 일기에서 내일 해야 할 일을 추출하세요. JSON 배열로만 반환: ["할일1","할일2"] (최대 5개)`;
    const content = recentEntries.slice(0,3).map(e=>e.diary||e.summary||'').join('\n');
    const raw = await callClaude(systemPrompt, content, 200);
    if (!raw) return [];
    try {
      const match = raw.match(/\[[\s\S]*\]/);
      return match ? JSON.parse(match[0]) : [];
    } catch { return []; }
  }

  // ── 가민 스크린샷 파싱 (API 키 있을 때) ──
  async function parseGarminImage(base64Image, type, mediaType) {
    if (!ANTHROPIC_API_KEY) return null;
    const imgType = mediaType || detectMediaType(base64Image);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    const prompts = {
      sleep: `이 이미지는 가민 앱의 수면 분석 화면입니다. 수면 점수와 시간 수치를 JSON으로만 반환하세요 (다른 텍스트 없이):
{"sleepScore":숫자,"totalSleep":"6h34m형식","deepSleep":"시간","remSleep":"시간","lightSleep":"시간","awake":"시간"}`,
      stress: `이 이미지는 가민 앱의 스트레스 화면입니다. 스트레스 수치를 JSON으로만 반환하세요:
{"stressScore":숫자}`,
      health: `이 이미지는 가민 앱의 수면 또는 스트레스 화면입니다. 찾을 수 있는 수치를 JSON으로만 반환하세요:
{"sleepScore":숫자또는null,"totalSleep":"시간또는null","deepSleep":"시간또는null","stressScore":숫자또는null}`,
      run: `이 이미지는 가민 앱의 러닝 활동 화면입니다. 러닝 수치를 JSON으로만 반환하세요:
{"duration":"42분","pace":"5'38\\"","heartRate":숫자,"calories":숫자,"distance":"7.4km"}`,
    };

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
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: imgType, data: base64Image } },
              { type: 'text', text: prompts[type] || prompts.health },
            ],
          }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) { console.error('Vision API HTTP:', res.status); return null; }
      const data = await res.json();
      if (data.error) { console.error('Vision API 오류:', data.error); return null; }
      const raw = data.content?.[0]?.text || null;
      if (!raw) return null;
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError') console.warn('Vision API 타임아웃');
      else console.error('Vision API 오류:', e);
      return null;
    }
  }

  // ── API 키 없을 때: 수동 입력 신호 반환 ──
  function parseGarminImageAuto(base64Image, mediaType, hint) {
    if (ANTHROPIC_API_KEY) {
      // API 키 있으면 Claude Vision 사용
      const type = hint === 'run' ? 'run' : 'health';
      return parseGarminImage(base64Image, type, mediaType);
    }
    // API 키 없으면 수동 입력 요청
    return Promise.resolve({ _requireManualInput: true });
  }

  function detectMediaType(base64) {
    try {
      const bytes = atob(base64.slice(0, 12));
      const hex = Array.from(bytes).map(b => b.charCodeAt(0).toString(16).padStart(2,'0')).join('');
      if (hex.startsWith('89504e47')) return 'image/png';
      if (hex.startsWith('ffd8ff')) return 'image/jpeg';
      if (hex.startsWith('47494638')) return 'image/gif';
    } catch(e) {}
    return 'image/jpeg';
  }

  return { callClaude, generateDiary, generateWeeklyReport, extractTodos, parseGarminImage, parseGarminImageAuto, setApiKey, hasApiKey };
})();
