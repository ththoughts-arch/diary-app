/* ====================================================
   record.js — 일기 기록 화면
   ==================================================== */
const Record = (() => {

  /* ── 상태 ── */
  let questions = [];
  let answers   = [];         // [{ question, category, catLabel, answer }]
  let step      = -1;         // -1: 모드선택, 0~N-1: 질문, N: 마무리
  let health    = {};
  let active    = false;      // 세션 진행 중 (화면 복귀 시 유지)
  let recog     = null;
  let recoding  = false;
  let sttText   = '';

  /* ── DOM 헬퍼 ── */
  const body    = () => $('rec-body');
  const footer  = () => $('rec-footer');
  const setStep = (txt, pct) => {
    if ($('rec-step'))    $('rec-step').textContent = txt;
    if ($('rec-progress')) $('rec-progress').style.width = pct;
  };

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     초기화
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  async function init() {
    if (active) { _render(); return; }           // 화면 복귀 시 상태 유지
    questions = QuestionPool.getDailyQuestions();
    answers   = questions.map(q => ({ question:q.q, category:q.catId, catLabel:q.catLabel, answer:'' }));
    health    = (await Store.Health.getByDate(Store.today())) || {};
    step      = -1;
    active    = true;
    _render();
  }

  function _render() {
    footer().style.display = 'none';
    if      (step <  0)                _renderMode();
    else if (step <  questions.length) _renderStep();
    else                               _renderFinal();
  }

  function _reset() { active=false; step=-1; sttText=''; _stopSTT(); }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     1. 모드 선택
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function _renderMode() {
    setStep('모드 선택', '0%');
    const preview = questions.map(q=>`
      <div style="display:flex;gap:8px;align-items:flex-start;padding:7px 0;border-bottom:.5px solid #f0f0f0">
        <span style="font-size:11px;font-weight:700;color:${q.catColor};background:${q.catBg};padding:2px 7px;border-radius:99px;flex-shrink:0">${q.catLabel}</span>
        <span style="font-size:12px;color:#888;line-height:1.5">${esc(q.q)}</span>
      </div>`).join('');

    body().innerHTML = `
      <div class="section" style="margin-top:8px">
        <div class="card" style="margin-bottom:10px">
          <div class="drawer-label">오늘의 질문 미리보기</div>
          ${preview}
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <button class="mode-choice" onclick="Record.startStep()">
            <div class="mode-choice-icon">💬</div>
            <div class="mode-choice-title">질문형 대화</div>
            <div class="mode-choice-desc">카테고리별로 하나씩 질문하고 순서대로 음성으로 답하는 방식</div>
          </button>
          <button class="mode-choice" onclick="Record.startFree()">
            <div class="mode-choice-icon">🎙</div>
            <div class="mode-choice-title">한 번에 말하기</div>
            <div class="mode-choice-desc">모든 질문이 한눈에 보이고 자유롭게 한 번에 녹음하는 방식</div>
          </button>
        </div>
        <div style="margin-top:14px">${_garminSection()}</div>
      </div>`;
  }

  /* ── 가민 업로드 ── */
  function _garminSection() {
    return `<div class="card">
      <div class="drawer-label">📷 가민 스크린샷 업로드</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${_uploadLabel('health','❤️‍🩹','건강 분석 (수면+스트레스)', health.sleep||health.stress ? `수면${health.sleep||'--'} · 스트레스${health.stress||'--'} 완료` : '')}
        ${_uploadLabel('run',  '🏃',  '러닝 활동', health.pace ? `페이스 ${health.pace} 완료` : '')}
      </div>
      <div id="garmin-loading" style="display:none;margin-top:8px"><div class="loading"><div class="spinner"></div> 이미지 분석 중...</div></div>
    </div>`;
  }

  function _uploadLabel(type, icon, label, done='') {
    return `<label class="upload-label">
      <span style="font-size:18px">${icon}</span>
      <div style="flex:1">
        <div class="ul-title">${label}</div>
        <div class="ul-status${done?' done':''}" id="${type}-status">${done||'탭해서 이미지 선택'}</div>
      </div>
      <span style="color:${done?'#2AADA3':'#ccc'}">${done?'✓':'+'}</span>
      <input type="file" accept="image/*" multiple style="display:none" onchange="Record.onGarmin(this,'${type}')">
    </label>`;
  }

  async function onGarmin(input, type) {
    const files = Array.from(input.files);
    if (!files.length) return;
    const loading  = $('garmin-loading');
    const statusEl = $(`${type}-status`);
    if (loading) loading.style.display = 'block';

    for (const file of files) {
      if (statusEl) statusEl.textContent = `${file.name} 분석 중...`;
      const { b64, mime } = await _readFile(file);
      const today = Store.today();
      const existing = (await Store.Health.getByDate(today)) || {};

      if (API.hasKey()) {
        const result = await API.parseGarmin(b64, mime, type);
        if (result) {
          _mergeHealth(existing, type, result);
          await Store.Health.save(today, existing);
          health = existing;
          if (statusEl) { statusEl.textContent = _healthText(type,existing); statusEl.className='ul-status done'; }
        } else {
          _openManual(type, existing, today, statusEl);
        }
      } else {
        _openManual(type, existing, today, statusEl);
      }
    }
    if (loading) loading.style.display = 'none';
  }

  const _readFile = file => new Promise(res => {
    const r = new FileReader();
    r.onload = e => { const d=e.target.result; res({ b64:d.split(',')[1], mime:d.split(';')[0].split(':')[1]||'image/jpeg' }); };
    r.readAsDataURL(file);
  });

  function _mergeHealth(e, type, r) {
    if (type==='health') {
      if (r.sleepScore!=null) Object.assign(e,{sleep:r.sleepScore,sleepHours:r.totalSleep,deepSleep:r.deepSleep});
      if (r.stressScore!=null) e.stress=r.stressScore;
    } else {
      Object.assign(e,{pace:r.pace,heartRate:r.heartRate,calories:r.calories,duration:r.duration});
    }
  }

  const _healthText = (type,h) => type==='health'
    ? `수면 ${h.sleep||'--'} · 스트레스 ${h.stress||'--'} 완료`
    : `페이스 ${h.pace||'--'} 완료`;

  // API 키 없을 때 수동 입력
  function _openManual(type, existing, today, statusEl) {
    Record._mCtx = { existing, today, statusEl, type };
    if (type==='health') {
      Drawer.open('건강 수치 직접 입력', `
        <div class="drawer-label">수면 점수 (0-100)</div>
        <input class="label-input" id="m-sleep" type="number" min="0" max="100" placeholder="예: 75" value="${existing.sleep||''}">
        <div class="drawer-label">총 수면 시간</div>
        <input class="label-input" id="m-sleep-h" type="text" placeholder="예: 6h 34m" value="${existing.sleepHours||''}">
        <div class="drawer-label">스트레스 수치 (0-100)</div>
        <input class="label-input" id="m-stress" type="number" min="0" max="100" placeholder="예: 54" value="${existing.stress||''}">
        <button class="btn-primary" onclick="Record.saveManual()">저장하기</button>`);
    } else {
      Drawer.open('러닝 데이터 직접 입력', `
        <div class="drawer-label">평균 페이스 (분/km)</div>
        <input class="label-input" id="m-pace" type="text" placeholder="예: 5'38&quot;" value="${existing.pace||''}">
        <div class="drawer-label">평균 심박수 (bpm)</div>
        <input class="label-input" id="m-hr" type="number" placeholder="예: 158" value="${existing.heartRate||''}">
        <div class="drawer-label">칼로리 (kcal)</div>
        <input class="label-input" id="m-cal" type="number" placeholder="예: 412" value="${existing.calories||''}">
        <button class="btn-primary" onclick="Record.saveManual()">저장하기</button>`);
    }
  }

  async function saveManual() {
    const ctx = Record._mCtx; if (!ctx) return;
    const e = ctx.existing;
    if (ctx.type==='health') {
      const sleep=parseInt($('m-sleep')?.value)||null, sh=$('m-sleep-h')?.value||null, stress=parseInt($('m-stress')?.value)||null;
      if (sleep) e.sleep=sleep; if (sh) e.sleepHours=sh; if (stress) e.stress=stress;
    } else {
      const pace=$('m-pace')?.value||null, hr=parseInt($('m-hr')?.value)||null, cal=parseInt($('m-cal')?.value)||null;
      if (pace) e.pace=pace; if (hr) e.heartRate=hr; if (cal) e.calories=cal;
    }
    await Store.Health.save(ctx.today, e);
    health = e;
    if (ctx.statusEl) { ctx.statusEl.textContent=_healthText(ctx.type,e); ctx.statusEl.className='ul-status done'; }
    Drawer.close();
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     2. 질문형 모드
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function startStep() { step=0; _renderStep(); }

  function _renderStep() {
    const total = questions.length;
    setStep(`${step+1} / ${total}`, `${Math.round(((step+1)/(total+1))*100)}%`);
    if (step >= total) { _renderFinal(); return; }

    const q = questions[step];
    body().innerHTML = `
      <div class="section">
        ${_dots()}
        <div class="card">
          <div class="q-bubble" style="background:linear-gradient(135deg,${q.catColor}CC,${q.catColor}88)">
            <div class="q-label">${q.catLabel}</div>
            <div class="q-text">${esc(q.q)}</div>
          </div>
          ${_voiceHTML()}
          <div class="divider-or">또는</div>
          <textarea class="text-input-area" id="text-answer" placeholder="직접 타이핑해도 좋아요..."
            oninput="Record.onType(this.value)">${esc(answers[step]?.answer||'')}</textarea>
          ${answers[step]?.answer?`<div style="font-size:11px;color:#2AADA3;margin-top:6px">✓ 기록됨 · 수정하려면 위 내용을 바꿔주세요</div>`:''}
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:4px">
          <button class="btn-primary" onclick="Record.next()">
            ${step===questions.length-1 ? '마무리 →' : '다음 질문 →'}
          </button>
          <div style="display:flex;gap:8px">
            ${step>0?`<button class="btn-secondary" style="flex:1" onclick="Record.prev()">← 이전</button>`:'<div style="flex:1"></div>'}
            <button class="btn-secondary" style="flex:1" onclick="Record.skip()">건너뛰기</button>
          </div>
        </div>
      </div>`;
  }

  function _dots() {
    return `<div class="progress-dots">
      ${questions.map((q,i)=>{
        const done=!!answers[i]?.answer, cur=i===step;
        return `<div class="progress-dot" onclick="Record.goTo(${i})"
          style="width:${cur?'24px':'8px'};background:${done?'#3DCFC4':cur?q.catColor:'#ddd'}" title="${q.catLabel}"></div>`;
      }).join('')}
    </div>`;
  }

  function _saveCurrent() {
    const ta = $('text-answer');
    if (ta && step>=0 && step<questions.length) answers[step].answer = ta.value.trim();
  }

  function goTo(s)  { _saveCurrent(); _stopSTT(); step=s; _renderStep(); }
  function next()   { _saveCurrent(); _stopSTT(); step++; _render(); }
  function prev()   { _saveCurrent(); _stopSTT(); step>0 ? (step--,_renderStep()) : (step=-1,_renderMode()); }
  function skip()   { _stopSTT(); step++; _render(); }
  function onType(v){ if (step>=0&&step<questions.length) answers[step].answer=v; }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     3. 한 번에 말하기
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function startFree() {
    setStep('자유 녹음','50%');
    const qList = questions.map(q=>`
      <div style="display:flex;gap:8px;align-items:flex-start;padding:9px 0;border-bottom:.5px solid #f0f0f0">
        <span style="font-size:11px;font-weight:700;color:${q.catColor};background:${q.catBg};padding:2px 8px;border-radius:99px;flex-shrink:0">${q.catLabel}</span>
        <span style="font-size:13px;color:#222;line-height:1.5">${esc(q.q)}</span>
      </div>`).join('');
    body().innerHTML = `
      <div class="section">
        <div class="card">${qList}</div>
        <div class="card">
          <div style="font-size:13px;font-weight:600;color:#222;margin-bottom:4px">🎙 순서 상관없이 자유롭게 말씀해 주세요</div>
          <div style="font-size:12px;color:#888;margin-bottom:14px;line-height:1.5">AI가 카테고리별로 알아서 정리해드려요.</div>
          ${_voiceHTML()}
          <div class="divider-or">또는</div>
          <textarea class="text-input-area" id="text-answer" placeholder="자유롭게 오늘 하루를 써주세요..." style="height:120px"></textarea>
          <button class="btn-primary" style="margin-top:10px;width:100%" onclick="Record.confirmFree()">✨ AI로 일기 완성하기</button>
          <button class="btn-ghost" onclick="Record.backToMode()">← 모드 선택으로</button>
        </div>
      </div>`;
  }

  function confirmFree() {
    _stopSTT();
    const text = $('text-answer')?.value?.trim() || sttText.trim();
    questions.forEach((_,i) => { if (!answers[i].answer) answers[i].answer=text; });
    step = questions.length;
    _finalize();
  }

  function backToMode() { _stopSTT(); step=-1; _renderMode(); }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     4. 마무리 단계
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function _renderFinal() {
    setStep('마무리','90%');
    const done = answers.filter(a=>a.answer).length;
    body().innerHTML = `
      <div class="section">
        ${_dots()}
        <div class="card">
          <div style="font-size:13px;color:#888;margin-bottom:10px">
            ${done}개 질문에 답하셨어요.
            ${done<questions.length?`<span style="color:#D85A30">(${questions.length-done}개 미답변)</span>`:'🎉 모두 완료!'}
          </div>
          ${questions.map((q,i)=>`
            <div onclick="Record.goTo(${i})" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#f5f5f5;border-radius:10px;cursor:pointer;margin-bottom:6px">
              <span>${answers[i]?.answer?'✅':'⬜'}</span>
              <span style="font-size:11px;font-weight:700;color:${q.catColor};background:${q.catBg};padding:1px 7px;border-radius:99px">${q.catLabel}</span>
              <span style="font-size:12px;color:${answers[i]?.answer?'#222':'#999'};flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                ${answers[i]?.answer?esc(answers[i].answer.slice(0,30))+'...':'탭해서 답변 추가'}
              </span>
              <span style="font-size:11px;color:#2AADA3">수정</span>
            </div>`).join('')}
        </div>
        <div class="card">
          <div class="drawer-label">추가 선택 항목</div>
          <div style="padding:8px 0;border-bottom:.5px solid #f0f0f0">
            <div style="font-size:13px;color:#222;margin-bottom:6px">아이와 함께한 시간</div>
            <select id="child-time" style="font-size:13px;background:#f5f5f5;border:none;border-radius:8px;padding:8px 12px;width:100%;outline:none;color:#222">
              <option value="">선택 안 함</option>
              <option>거의 없음</option><option>1시간</option><option>2시간 이상</option>
            </select>
          </div>
          <div style="padding:8px 0">
            <div style="font-size:13px;color:#222;margin-bottom:6px">✨ 자유 메모</div>
            <textarea class="text-input-area" id="free-note" placeholder="오늘 하루 추가로 남기고 싶은 말..." style="height:70px"></textarea>
          </div>
        </div>
        <button class="btn-primary" style="width:100%" onclick="Record.finalize()">✨ AI로 일기 완성하기</button>
      </div>`;
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     5. 일기 완성 (finalize)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  async function finalize() {
    _stopSTT();
    footer().style.display = 'none';
    body().innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 20px;gap:12px">
      <div class="spinner" style="width:32px;height:32px;border-width:3px"></div>
      <div style="font-size:14px;color:#888;text-align:center">AI가 카테고리별로<br>일기를 정리 중이에요...</div>
    </div>`;

    // 추가 항목
    const note   = $('free-note')?.value  || '';
    const child  = $('child-time')?.value || '';
    const valid  = answers.filter(a=>a.answer);
    if (note)  valid.push({ question:'자유 메모', category:'etc', catLabel:'✨ 그 외', answer:note });
    if (child) valid.push({ question:'아이와 함께한 시간', category:'parenting', catLabel:'👨‍👧 육아', answer:child });

    const todos  = await Store.Todos.getAll();
    const today  = Store.today();
    const hlth   = await Store.Health.getByDate(today);
    const result = await API.generateDiary(valid, hlth);

    const diary    = result?.diary    || valid.map(a=>a.answer).join('\n');
    const tags     = result?.tags     || [];
    const mood     = result?.mood     || '😊';
    const summary  = result?.summary  || diary.slice(0,30);
    const feedback = result?.feedback || '';

    // 카테고리 그룹
    const grouped = {};
    valid.forEach(a => { const c=a.category||'etc'; (grouped[c]=grouped[c]||[]).push(a); });

    await Store.Entries.save(today, { diary, tags, mood, summary, answers:valid, categorized:grouped, health:hlth });
    _reset();

    // 날씨
    const amTemp = $('w-am')?.textContent||'';
    const wBadge = amTemp&&amTemp!=='--°C' ? `🌤 ${amTemp}` : '';
    const now = new Date(), days=['일','월','화','수','목','금','토'];
    const dateStr = `${now.getFullYear()}년 ${now.getMonth()+1}월 ${now.getDate()}일 ${days[now.getDay()]}요일`;

    // 카테고리 카드
    const catCards = Object.entries(grouped).map(([cid,items]) => {
      const cat = QuestionPool.getCategoryInfo(cid);
      return `<div class="cat-card">
        <div class="cat-badge" style="color:${cat.color};background:${cat.bg}">${cat.label}</div>
        ${items.map(i=>`
          <div style="margin-bottom:7px">
            <div class="cat-q">${esc(i.question)}</div>
            <div class="cat-a">${esc(i.answer)}</div>
          </div>`).join('')}
      </div>`;
    }).join('');

    const todoHTML = todos.length ? `
      <div class="diary-result-card">
        <div class="diary-result-label">☑ 오늘 할 일 현황</div>
        ${todos.map(t=>`<div style="display:flex;align-items:center;gap:8px;font-size:13px;color:${t.done?'#bbb':'#222'};text-decoration:${t.done?'line-through':'none'};padding:4px 0">
          <span>${t.done?'✅':'⬜'}</span><span>${esc(t.text)}</span>
        </div>`).join('')}
      </div>` : '';

    const hlthHTML = hlth ? `
      <div class="diary-result-card">
        <div class="diary-result-label">💪 오늘 건강 데이터</div>
        <div class="health-mini">
          <div class="health-chip"><div class="hc-label2">수면점수</div><div class="sc-val" style="color:#534AB7;font-size:16px">${hlth.sleep||'--'}</div></div>
          <div class="health-chip"><div class="hc-label2">스트레스</div><div class="sc-val" style="color:#D85A30;font-size:16px">${hlth.stress||'--'}</div></div>
          <div class="health-chip"><div class="hc-label2">러닝</div><div class="sc-val" style="color:#085041;font-size:13px">${hlth.pace||'--'}</div></div>
        </div>
      </div>` : '';

    const fbHTML = feedback ? `
      <div class="ai-fb">
        <div class="ai-fb-label">✨ AI 피드백</div>
        <div class="ai-fb-text">${esc(feedback)}</div>
      </div>` : '';

    body().innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;padding-bottom:16px">
        <div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:20px 0 8px">
          <div class="complete-ring">✅</div>
          <div style="font-size:20px;font-weight:600;color:#222;text-align:center">오늘 일기가 완성됐어요</div>
          <div style="font-size:13px;color:#888;text-align:center;line-height:1.6">AI가 카테고리별로 오늘의 이야기를<br>정리했어요.</div>
        </div>
        <div class="card">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="font-size:34px">${mood}</div>
            <div style="flex:1">
              <div style="font-size:15px;font-weight:600;color:#222">${dateStr}</div>
              <div style="font-size:12px;color:#999;margin-top:2px">${esc(summary)}</div>
            </div>
            ${wBadge?`<div style="background:#f5f5f5;border-radius:99px;padding:4px 10px;font-size:12px;color:#888">${wBadge}</div>`:''}
          </div>
        </div>
        <div class="diary-result-card">
          <div class="diary-result-label">✨ AI가 완성한 오늘의 일기</div>
          <div style="font-size:14px;color:#222;line-height:1.8">${esc(diary)}</div>
        </div>
        <div>
          <div class="section-label" style="margin-bottom:8px">📂 카테고리별 기록</div>
          <div style="display:flex;flex-direction:column;gap:8px">${catCards}</div>
        </div>
        ${todoHTML}${hlthHTML}${fbHTML}
        <div class="tag-wrap" style="justify-content:center">${tags.map(t=>`<span class="tag tag-g">${esc(t)}</span>`).join('')}</div>
        <button class="btn-primary" onclick="App.go('home')" style="width:100%;margin-top:4px">🏠 홈으로 돌아가기</button>
        <button onclick="Record.share()" style="width:100%;background:#f5f5f5;color:#888;border:none;border-radius:14px;padding:11px;font-size:13px;font-family:inherit;cursor:pointer">
          📤 일기 공유 / 내보내기
        </button>
      </div>`;
  }

  function share() {
    const text = answers.filter(a=>a.answer).map(a=>`[${a.catLabel||''}]\n${a.answer}`).join('\n\n');
    if (navigator.share) navigator.share({ title:'나의 일기', text });
    else navigator.clipboard?.writeText(text).then(()=>alert('클립보드에 복사됐어요!'));
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     STT (음성 인식)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function _voiceHTML() {
    return `<div class="voice-zone">
      <div class="voice-top" onclick="Record.toggleVoice()">
        <div class="voice-ring" id="voice-ring">🎙</div>
        <div class="waveform" id="waveform"><span></span><span></span><span></span><span></span><span></span><span></span></div>
        <div class="voice-status" id="voice-status">탭해서 말하기 시작</div>
      </div>
      <div class="stt-live-box">
        <div class="stt-label" id="stt-label">💬 말하면 여기에 실시간으로 변환돼요</div>
        <div class="stt-text" id="stt-text"></div>
      </div>
      <div class="stt-actions" id="stt-actions" style="display:none">
        <button class="btn-retry" onclick="Record.retryVoice()">🔄 다시 녹음</button>
        <button class="btn-confirm" onclick="Record.confirmVoice()">✓ 저장하고 다음</button>
      </div>
    </div>`;
  }

  function toggleVoice() { recoding ? _stopSTT() : _startSTT(); }

  function _startSTT() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Chrome 또는 웨일 브라우저에서 사용해주세요.'); return; }
    if (recog) { try{recog.abort();}catch{} recog=null; }
    sttText = '';
    recog = new SR();
    Object.assign(recog, { lang:'ko-KR', continuous:false, interimResults:true });

    recog.onstart = () => {
      recoding = true;
      const r=$('voice-ring'), w=$('waveform'), s=$('voice-status'), l=$('stt-label');
      if(r){r.innerHTML='⏹';r.classList.add('recording');}
      if(w)w.classList.add('active');
      if(s){s.textContent='녹음 중 · 탭하면 완료';s.classList.add('on');}
      if(l){l.textContent='🔴 실시간 변환 중';l.style.color='#2AADA3';}
      const a=$('stt-actions');if(a)a.style.display='none';
    };

    recog.onresult = e => {
      let interim='', final=sttText;
      for(let i=e.resultIndex;i<e.results.length;i++){
        if(e.results[i].isFinal) final+=e.results[i][0].transcript;
        else interim=e.results[i][0].transcript;
      }
      sttText=final;
      const t=$('stt-text');
      if(t) t.innerHTML=esc(final)+(interim?`<span class="stt-interim"> ${esc(interim)}</span>`:'')+`<span class="stt-cursor"></span>`;
      const ta=$('text-answer');if(ta)ta.value=final+interim;
    };

    recog.onerror = e => { if(e.error==='no-speech'&&recoding){try{recog.start();}catch{}} else _stopSTT(); };
    recog.onend   = () => { if(recoding){try{recog.start();}catch{_stopSTT();}} };
    recog.start();
  }

  function _stopSTT() {
    recoding = false;
    if(recog){recog.onend=null;try{recog.abort();}catch{}recog=null;}
    const r=$('voice-ring'),w=$('waveform'),s=$('voice-status'),l=$('stt-label');
    if(r){r.innerHTML='🎙';r.classList.remove('recording');}
    if(w)w.classList.remove('active');
    if(s){s.textContent='다시 말하기';s.classList.remove('on');}
    const text=sttText.trim();
    const t=$('stt-text');
    if(t) t.innerHTML=text?esc(text):'<span style="color:#bbb">음성이 인식되지 않았어요</span>';
    if(l){l.textContent=text?'✓ 변환 완료 · 수정 가능해요':'💬 말하면 여기에 텍스트로 변환돼요';l.style.color=text?'#2AADA3':'#888';}
    if(text){
      const a=$('stt-actions');if(a)a.style.display='flex';
      const ta=$('text-answer');if(ta)ta.value=text;
      if(step>=0&&step<questions.length)answers[step].answer=text;
    }
  }

  function retryVoice() { sttText=''; const t=$('stt-text');if(t)t.innerHTML=''; const a=$('stt-actions');if(a)a.style.display='none'; _startSTT(); }
  function confirmVoice() { _saveCurrent(); _stopSTT(); step++; _render(); }

  return {
    init, startStep, startFree, next, prev, skip, goTo,
    onGarmin, saveManual, onType, confirmFree, backToMode,
    finalize, share, toggleVoice, retryVoice, confirmVoice,
  };
})();
