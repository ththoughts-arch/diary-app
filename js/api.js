/* ====================================================
   api.js — Google Gemini API (Cloudflare Worker 프록시 경유)
   ====================================================
   ▸ API 키는 Cloudflare Worker 서버에서만 보관
   ▸ 브라우저 → Worker 프록시 → Gemini API
   ▸ 가민 이미지 여러 장: Promise.all 병렬 처리
   ▸ Gemini 무료 티어 사용 (gemini-2.0-flash)
   ==================================================== */
const API = (() => {

  // ── Cloudflare Worker 프록시 URL ──────────────────
  const PROXY_URL = 'https://diary-claude-proxy.ththoughts.workers.dev';
  const MODEL = 'gemini-2.0-flash-lite';

  // 하위 호환용 (settings.js에서 호출하는 경우 대비)
  const setKey  = () => {};
  const hasKey  = () => true;

  /* ── 공통 fetch (타임아웃 30초) ──
     body 형식: { contents: [...], systemInstruction?: {...}, generationConfig?: {...} }
  ── */
  async function _fetch(body, timeoutMs = 30000) {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(PROXY_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...body, model: MODEL }),
        signal:  ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('[API] 프록시 오류:', err);
        return null;
      }
      const data = await res.json();
      // Gemini 응답 구조: candidates[0].content.parts[0].text
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
    } catch (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError') console.warn('[API] 타임아웃');
      else console.error('[API]', e);
      return null;
    }
  }

  /* ── JSON 파싱 헬퍼 ── */
  const _json = (raw, fallback = null) => {
    if (!raw) return fallback;
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      return m ? JSON.parse(m[0]) : fallback;
    } catch { return fallback; }
  };

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     일기 생성
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  async function generateDiary(answers, health) {
    const catLabels = {
      economy: '💰경제', relation: '🤝관계', health: '💪건강',
      growth: '🌱자아실현', parenting: '👨‍👧육아', etc: '✨그외',
    };
    const grouped = {};
    answers.filter(a => a.answer).forEach(a => {
      const c = a.category || 'etc';
      (grouped[c] = grouped[c] || []).push(a);
    });
    const bodyText = Object.entries(grouped)
      .map(([c, items]) => `[${catLabels[c] || c}]\n${items.map(i => `Q: ${i.question}\nA: ${i.answer}`).join('\n')}`)
      .join('\n\n');

    const systemText = `사용자의 하루 기록을 카테고리를 자연스럽게 녹여 1인칭 일기 문체로 300~400자 작성하세요.
반드시 JSON만 반환 (다른 텍스트 없이, 마크다운 코드블록 없이):
{"diary":"일기내용","tags":["#태그1","#태그2","#태그3"],"mood":"😊","summary":"30자이내요약","feedback":"따뜻한피드백1~2문장"}`;
    const userText = `${bodyText}${health ? `\n\n건강: 수면${health.sleep || '--'} 스트레스${health.stress || '--'} 러닝${health.pace || '없음'}` : ''}`;

    const raw = await _fetch({
      systemInstruction: { parts: [{ text: systemText }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: { maxOutputTokens: 800 },
    });
    return _json(raw) || {
      diary:    answers.filter(a => a.answer).map(a => a.answer).join('\n\n'),
      tags:     [],
      mood:     '😊',
      summary:  '오늘의 일기',
      feedback: '',
    };
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     리포트 생성
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  async function generateReport(entries) {
    if (!entries.length) return null;
    const systemText = `사용자의 일기를 분석해 리포트를 작성하세요.
반드시 JSON만 반환 (마크다운 코드블록 없이):
{"title":"제목","narrative":"2-3문장총평","keywords":["#키워드"],"moodSummary":"감정흐름","lifeSummary":{"work":{"highlight":"핵심","detail":"상세"},"family":{"highlight":"핵심","detail":"상세"},"health":{"highlight":"핵심","detail":"상세"},"money":{"highlight":"핵심","detail":"상세"}},"bestMoment":"기억에남는순간","bestQuote":"인상적인문장","nextTips":["제안1","제안2","제안3"]}`;
    const userText = entries.map(e => `[${e.date}] ${e.diary || e.summary || ''}`).join('\n');

    const raw = await _fetch({
      systemInstruction: { parts: [{ text: systemText }] },
      contents: [{ role: 'user', parts: [{ text: `일기:\n${userText}` }] }],
      generationConfig: { maxOutputTokens: 1200 },
    });
    return _json(raw);
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     가민 이미지 파싱 — 단일 이미지 (Gemini Vision)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  async function _parseSingleGarmin(base64, mediaType, type) {
    const prompts = {
      health: `이 가민 앱 스크린샷에서 수면/스트레스 수치를 찾아 JSON만 반환 (마크다운 코드블록 없이):
{"sleepScore":숫자or null,"totalSleep":"시간or null","deepSleep":"시간or null","stressScore":숫자or null}`,
      run: `이 가민 앱 러닝 스크린샷에서 수치를 찾아 JSON만 반환 (마크다운 코드블록 없이):
{"duration":"42분","pace":"5'38\\"","heartRate":숫자,"calories":숫자,"distance":"7.4km"}`,
    };
    const raw = await _fetch({
      contents: [{
        role: 'user',
        parts: [
          { inline_data: { mime_type: mediaType || 'image/jpeg', data: base64 } },
          { text: prompts[type] || prompts.health },
        ],
      }],
      generationConfig: { maxOutputTokens: 300 },
    }, 20000);
    return _json(raw);
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     가민 이미지 파싱 — 여러 장 병렬 처리 (Promise.all)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  async function parseGarminBatch(images) {
    if (!images.length) return {};

    const results = await Promise.all(
      images.map(img => _parseSingleGarmin(img.base64, img.mediaType, img.type))
    );

    const merged = { health: null, run: null };
    results.forEach((result, i) => {
      if (!result) return;
      const type = images[i].type;
      if (type === 'health') {
        merged.health = merged.health || {};
        if (result.sleepScore  != null) merged.health.sleepScore  = result.sleepScore;
        if (result.totalSleep  != null) merged.health.totalSleep  = result.totalSleep;
        if (result.deepSleep   != null) merged.health.deepSleep   = result.deepSleep;
        if (result.stressScore != null) merged.health.stressScore = result.stressScore;
      } else if (type === 'run') {
        merged.run = merged.run || {};
        if (result.duration)  merged.run.duration  = result.duration;
        if (result.pace)      merged.run.pace       = result.pace;
        if (result.heartRate) merged.run.heartRate  = result.heartRate;
        if (result.calories)  merged.run.calories   = result.calories;
        if (result.distance)  merged.run.distance   = result.distance;
      }
    });
    return merged;
  }

  /* 하위 호환 단일 인터페이스 */
  async function parseGarmin(base64, mediaType, type) {
    return _parseSingleGarmin(base64, mediaType, type);
  }

  /* ── 이미지 타입 감지 ── */
  const detectMediaType = b64 => {
    try {
      const hex = Array.from(atob(b64.slice(0, 12)))
        .map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
      if (hex.startsWith('89504e47')) return 'image/png';
      if (hex.startsWith('ffd8ff'))   return 'image/jpeg';
    } catch {}
    return 'image/jpeg';
  };

  return { setKey, hasKey, generateDiary, generateReport, parseGarmin, parseGarminBatch, detectMediaType };
})();
