/* ── record.js ── */
const Record = (() => {
  let dailyQuestions = []; // 오늘의 카테고리별 질문
  let currentStep = 0;
  let answers = [];
  let recognition = null;
  let isRecording = false;
  let finalTranscript = '';
  let healthData = {};

  async function init() {
    // 매일 카테고리별 랜덤 질문 추출
    dailyQuestions = QuestionPool.getDailyQuestions();
    currentStep = 0;
    answers = dailyQuestions.map(q => ({ question: q.q, category: q.catId, catLabel: q.catLabel, answer: '' }));
    healthData = (await Store.Health.getByDate(Store.today())) || {};
    renderModeSelect();
  }

  // ── 모드 선택 화면 ──
  function renderModeSelect() {
    const stepEl = document.getElementById('rec-step');
    const progEl = document.getElementById('rec-progress');
    if (stepEl) stepEl.textContent = '모드 선택';
    if (progEl) progEl.style.width = '0%';
    const footer = document.getElementById('rec-footer');
    if (footer) footer.style.display = 'none';

    // 오늘 질문 미리보기
    const qPreview = dailyQuestions.map(q =>
      `<div style="display:flex;gap:8px;align-items:flex-start;padding:7px 0;border-bottom:0.5px solid #f0f0f0">
        <span style="font-size:11px;font-weight:700;color:${q.catColor};background:${q.catBg};padding:2px 7px;border-radius:99px;flex-shrink:0;margin-top:2px">${q.catLabel}</span>
        <span style="font-size:12px;color:#555;line-height:1.5">${escapeHtml(q.q)}</span>
      </div>`
    ).join('');

    document.getElementById('rec-body').innerHTML = `
      <div class="section" style="margin-top:8px">
        <div class="card" style="margin-bottom:10px">
          <div style="font-size:11px;font-weight:600;color:#888;margin-bottom:8px">오늘의 질문 미리보기</div>
          ${qPreview}
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <button onclick="Record.startStep()" style="background:white;border-radius:16px;padding:18px 16px;text-align:left;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.07);border:none;font-family:inherit">
            <div style="font-size:20px;margin-bottom:6px">💬</div>
            <div style="font-size:15px;font-weight:700;color:#222;margin-bottom:3px">질문형 대화</div>
            <div style="font-size:12px;color:#888;line-height:1.5">카테고리별로 하나씩 질문하고<br>순서대로 음성으로 답하는 방식</div>
          </button>
          <button onclick="Record.startFree()" style="background:white;border-radius:16px;padding:18px 16px;text-align:left;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.07);border:none;font-family:inherit">
            <div style="font-size:20px;margin-bottom:6px">🎙</div>
            <div style="font-size:15px;font-weight:700;color:#222;margin-bottom:3px">한 번에 말하기</div>
            <div style="font-size:12px;color:#888;line-height:1.5">모든 질문이 한눈에 보이고<br>자유롭게 한 번에 녹음하는 방식</div>
          </button>
        </div>

        <div style="margin-top:14px">
          <div class="card">
            <div style="font-size:11px;font-weight:600;color:#888;margin-bottom:10px">📷 가민 스크린샷 업로드</div>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${renderUploadLabel('sleep','💤','수면 분석')}
              ${renderUploadLabel('stress','🧠','스트레스')}
              ${renderUploadLabel('run','🏃','러닝 (달린 경우만)')}
            </div>
            <div id="garmin-parse-status" style="display:none;margin-top:10px">
              <div class="loading"><div class="spinner"></div> AI가 이미지 분석 중...</div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function renderUploadLabel(type, icon, label) {
    const h = healthData;
    const isDone = type==='sleep'?!!h.sleep:type==='stress'?!!h.stress:!!h.pace;
    const statusText = type==='sleep'?(h.sleep?`수면점수 ${h.sleep} 파싱완료`:'탭해서 이미지 선택')
      :type==='stress'?(h.stress?`스트레스 ${h.stress} 파싱완료`:'탭해서 이미지 선택')
      :(h.pace?`페이스 ${h.pace} 파싱완료`:'탭해서 이미지 선택');
    return `<label style="display:flex;align-items:center;gap:10px;background:#f5f5f5;border-radius:10px;padding:11px 13px;cursor:pointer">
      <span style="font-size:18px">${icon}</span>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:500;color:#222">${label}</div>
        <div style="font-size:11px;color:${isDone?'#2AADA3':'#999'}" id="${type}-status">${statusText}</div>
      </div>
      <span style="color:${isDone?'#2AADA3':'#bbb'}">${isDone?'✓':'+'}</span>
      <input type="file" accept="image/*" style="display:none" onchange="Record.onGarminSelect(this,'${type}')">
    </label>`;
  }

  // ── 질문형 모드 ──
  function startStep() {
    currentStep = 0;
    renderStep();
  }

  function renderStep() {
    const total = dailyQuestions.length;
    const stepEl = document.getElementById('rec-step');
    const progEl = document.getElementById('rec-progress');
    if (stepEl) stepEl.textContent = `${currentStep+1} / ${total+1}`;
    if (progEl) progEl.style.width = `${Math.round((currentStep/(total+1))*100)}%`;

    if (currentStep >= total) { renderFinalStep(); return; }

    const q = dailyQuestions[currentStep];
    const prevAnswers = answers.slice(0, currentStep).filter(a => a.answer);
    const footer = document.getElementById('rec-footer');
    if (footer) footer.style.display = '';
    const nextBtn = document.getElementById('rec-next-btn');
    if (nextBtn) nextBtn.textContent = currentStep === total-1 ? '마지막 단계 →' : '다음 질문 →';

    document.getElementById('rec-body').innerHTML = `
      <div class="section">
        ${prevAnswers.map(a => `
          <div style="margin-bottom:6px">
            <div style="font-size:10px;font-weight:600;color:#aaa;margin-bottom:3px;padding-left:4px">${escapeHtml(a.catLabel||'')}</div>
            <div class="answer-bubble">${escapeHtml(a.answer)}</div>
          </div>`).join('')}
        <div class="card">
          <div class="q-bubble" style="background:linear-gradient(135deg,${q.catColor}CC,${q.catColor}88)">
            <div class="q-label">${q.catLabel} · ${q.sub||''}</div>
            <div class="q-text">${escapeHtml(q.q)}</div>
          </div>
          ${renderVoiceZone()}
          <div class="divider-or">또는</div>
          <textarea class="text-input-area" id="text-answer"
            placeholder="직접 타이핑해도 좋아요..."
            oninput="Record.onTextInput(this.value)">${escapeHtml(answers[currentStep]?.answer||'')}</textarea>
        </div>
      </div>`;
  }

  // ── 한 번에 말하기 모드 ──
  function startFree() {
    const stepEl = document.getElementById('rec-step');
    const progEl = document.getElementById('rec-progress');
    if (stepEl) stepEl.textContent = '자유 녹음';
    if (progEl) progEl.style.width = '50%';
    const footer = document.getElementById('rec-footer');
    if (footer) footer.style.display = 'none';

    const qList = dailyQuestions.map(q =>
      `<div style="display:flex;gap:8px;align-items:flex-start;padding:9px 0;border-bottom:0.5px solid #f0f0f0">
        <span style="font-size:11px;font-weight:700;color:${q.catColor};background:${q.catBg};padding:2px 8px;border-radius:99px;flex-shrink:0;margin-top:1px">${q.catLabel}</span>
        <span style="font-size:13px;color:#333;line-height:1.5">${escapeHtml(q.q)}</span>
      </div>`
    ).join('');

    document.getElementById('rec-body').innerHTML = `
      <div class="section">
        <div class="card">
          <div style="font-size:11px;font-weight:600;color:#888;margin-bottom:8px">오늘의 질문들 — 자유롭게 답해주세요</div>
          ${qList}
        </div>
        <div class="card">
          <div style="font-size:13px;font-weight:600;color:#222;margin-bottom:4px">🎙 순서 상관없이 자유롭게 말씀해 주세요</div>
          <div style="font-size:12px;color:#888;margin-bottom:14px;line-height:1.5">AI가 카테고리별로 알아서 정리해드려요.</div>
          ${renderVoiceZone()}
          <div class="divider-or">또는</div>
          <textarea class="text-input-area" id="text-answer"
            placeholder="자유롭게 오늘 하루를 써주세요..."
            style="height:120px"
            oninput="Record.onFreeInput(this.value)"></textarea>
          <button class="btn-primary" style="margin-top:10px" onclick="Record.confirmFree()">✨ AI로 일기 완성하기</button>
        </div>
      </div>`;
  }

  function renderVoiceZone() {
    return `<div class="voice-zone">
      <div class="voice-top" id="voice-top" onclick="Record.toggleVoice()">
        <div class="voice-ring" id="voice-ring">🎙</div>
        <div class="waveform" id="waveform"><span></span><span></span><span></span><span></span><span></span><span></span></div>
        <div class="voice-status" id="voice-status">탭해서 말하기 시작</div>
      </div>
      <div class="stt-live-box">
        <div class="stt-label" id="stt-label" style="color:#bbb">💬 말하면 여기에 실시간으로 변환돼요</div>
        <div class="stt-text" id="stt-text"></div>
      </div>
      <div class="stt-actions" id="stt-actions" style="display:none">
        <button class="btn-retry" onclick="Record.retry()">🔄 다시 녹음</button>
        <button class="btn-confirm" onclick="Record.confirmVoice()">✓ 저장하고 다음</button>
      </div>
    </div>`;
  }

  function renderFinalStep() {
    const stepEl = document.getElementById('rec-step');
    if (stepEl) stepEl.textContent = '마무리';
    const progEl = document.getElementById('rec-progress');
    if (progEl) progEl.style.width = '90%';
    const footer = document.getElementById('rec-footer');
    if (footer) footer.style.display = '';
    const nextBtn = document.getElementById('rec-next-btn');
    if (nextBtn) nextBtn.textContent = '✨ AI로 일기 완성하기';

    document.getElementById('rec-body').innerHTML = `
      <div class="section">
        <div class="card">
          <div style="font-size:11px;font-weight:600;color:#888;margin-bottom:10px">추가 선택 항목</div>
          <div style="padding:8px 0;border-bottom:0.5px solid #f0f0f0">
            <div style="font-size:13px;color:#222;margin-bottom:6px">아이와 함께한 시간</div>
            <select id="child-time" style="font-size:13px;background:#f5f5f5;border:none;border-radius:8px;padding:8px 12px;width:100%;outline:none">
              <option value="">선택 안 함</option>
              <option>거의 없음</option>
              <option>1시간</option>
              <option>2시간 이상</option>
            </select>
          </div>
          <div style="padding:8px 0">
            <div style="font-size:13px;color:#222;margin-bottom:6px">✨ 하고 싶은 말 (자유 메모)</div>
            <textarea class="text-input-area" id="free-note" placeholder="오늘 하루 추가로 남기고 싶은 말..." style="height:70px"></textarea>
          </div>
        </div>
      </div>`;
  }

  // ── 가민 파싱 ──
  async function onGarminSelect(input, type) {
    if (!input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result.split(',')[1];
      const statusEl = document.getElementById(`${type}-status`);
      if (statusEl) statusEl.textContent = '분석 중...';
      const parseEl = document.getElementById('garmin-parse-status');
      if (parseEl) parseEl.style.display = 'block';
      const result = await API.parseGarminImage(base64, type);
      if (parseEl) parseEl.style.display = 'none';
      if (result) {
        const today = Store.today();
        const existing = (await Store.Health.getByDate(today)) || {};
        if (type==='sleep') Object.assign(existing, { sleep: result.sleepScore, sleepHours: result.totalSleep, deepSleep: result.deepSleep });
        else if (type==='stress') existing.stress = result.stressScore;
        else if (type==='run') Object.assign(existing, { pace: result.pace, heartRate: result.heartRate, calories: result.calories, duration: result.duration });
        await Store.Health.save(today, existing);
        healthData = existing;
        if (statusEl) {
          statusEl.textContent = type==='sleep'?`수면점수 ${result.sleepScore||'--'} 파싱완료`
            :type==='stress'?`스트레스 ${result.stressScore||'--'} 파싱완료`
            :`페이스 ${result.pace||'--'} 파싱완료`;
          statusEl.style.color = '#2AADA3';
        }
      } else {
        if (statusEl) statusEl.textContent = '분석 실패 · 다시 시도해주세요';
      }
    };
    reader.readAsDataURL(file);
  }

  // ── STT ──
  function toggleVoice() {
    if (isRecording) stopRecording();
    else startRecording();
  }

  function startRecording() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Chrome 또는 웨일 브라우저에서 사용해주세요.'); return; }
    if (recognition) { try { recognition.abort(); } catch(e){} recognition = null; }
    finalTranscript = '';
    recognition = new SR();
    recognition.lang = 'ko-KR';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      isRecording = true;
      const ring = document.getElementById('voice-ring');
      const wave = document.getElementById('waveform');
      const status = document.getElementById('voice-status');
      if (ring) { ring.innerHTML = '⏹'; ring.classList.add('recording'); }
      if (wave) wave.classList.add('active');
      if (status) { status.textContent = '녹음 중 · 탭하면 완료'; status.classList.add('on'); }
      const label = document.getElementById('stt-label');
      if (label) { label.textContent = '🔴 실시간 변환 중'; label.style.color = '#2AADA3'; }
      const actions = document.getElementById('stt-actions');
      if (actions) actions.style.display = 'none';
    };

    recognition.onresult = (e) => {
      let interim = '', final = finalTranscript;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim = e.results[i][0].transcript;
      }
      finalTranscript = final;
      const textEl = document.getElementById('stt-text');
      if (textEl) textEl.innerHTML = escapeHtml(finalTranscript) +
        (interim?`<span class="stt-interim"> ${escapeHtml(interim)}</span>`:'') +
        '<span class="stt-cursor"></span>';
      const ta = document.getElementById('text-answer');
      if (ta) ta.value = finalTranscript + interim;
    };

    recognition.onerror = (e) => {
      if (e.error==='no-speech') { if (isRecording) { try { recognition.start(); } catch(err){} } return; }
      stopRecording();
    };

    recognition.onend = () => {
      if (isRecording) { try { recognition.start(); } catch(err) { stopRecording(); } }
    };

    recognition.start();
  }

  function stopRecording() {
    isRecording = false;
    if (recognition) { recognition.onend = null; try { recognition.abort(); } catch(e){} recognition = null; }
    const ring = document.getElementById('voice-ring');
    const wave = document.getElementById('waveform');
    const status = document.getElementById('voice-status');
    if (ring) { ring.innerHTML = '🎙'; ring.classList.remove('recording'); }
    if (wave) wave.classList.remove('active');
    if (status) { status.textContent = '다시 말하기'; status.classList.remove('on'); }
    const text = finalTranscript.trim();
    const textEl = document.getElementById('stt-text');
    if (textEl) textEl.innerHTML = text ? escapeHtml(text) : '<span style="color:#bbb">음성이 인식되지 않았어요</span>';
    const label = document.getElementById('stt-label');
    if (text) {
      if (label) { label.textContent = '✓ 변환 완료 · 수정 가능해요'; label.style.color = '#2AADA3'; }
      const actions = document.getElementById('stt-actions');
      if (actions) actions.style.display = 'flex';
      const ta = document.getElementById('text-answer');
      if (ta) ta.value = text;
      if (currentStep < dailyQuestions.length) answers[currentStep].answer = text;
    } else {
      if (label) { label.textContent = '💬 말하면 여기에 텍스트로 변환돼요'; label.style.color = '#bbb'; }
    }
  }

  function retry() {
    finalTranscript = '';
    const textEl = document.getElementById('stt-text');
    if (textEl) textEl.innerHTML = '';
    const actions = document.getElementById('stt-actions');
    if (actions) actions.style.display = 'none';
    const label = document.getElementById('stt-label');
    if (label) { label.textContent = '💬 말하면 여기에 텍스트로 변환돼요'; label.style.color = '#bbb'; }
    startRecording();
  }

  function confirmVoice() {
    const ta = document.getElementById('text-answer');
    const text = ta?.value?.trim();
    if (text && currentStep < dailyQuestions.length) answers[currentStep].answer = text;
    stopRecording();
    next();
  }

  function confirmFree() {
    stopRecording();
    const ta = document.getElementById('text-answer');
    const text = ta?.value?.trim() || finalTranscript.trim();
    // 자유 발화를 모든 카테고리 답변으로 저장 (AI가 분류)
    dailyQuestions.forEach((q, i) => {
      if (!answers[i].answer) answers[i].answer = text;
    });
    finalize();
  }

  function onTextInput(val) {
    if (currentStep < dailyQuestions.length) answers[currentStep].answer = val;
  }

  function onFreeInput(val) {
    // 자유 입력은 첫 번째 답변에 저장
    if (answers[0]) answers[0].answer = val;
  }

  function next() {
    stopRecording();
    const ta = document.getElementById('text-answer');
    if (ta && currentStep < dailyQuestions.length) answers[currentStep].answer = ta.value.trim();
    currentStep++;
    renderStep();
  }

  function skip() {
    stopRecording();
    if (currentStep < dailyQuestions.length) answers[currentStep].answer = '';
    currentStep++;
    renderStep();
  }

  async function finalize() {
    stopRecording();
    const body = document.getElementById('rec-body');
    const footer = document.getElementById('rec-footer');
    if (footer) footer.style.display = 'none';
    body.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 20px;gap:12px">
      <div class="spinner" style="width:32px;height:32px;border-width:3px"></div>
      <div style="font-size:14px;color:var(--color-text-secondary);text-align:center">AI가 카테고리별로<br>일기를 정리 중이에요...</div>
    </div>`;

    const freeNote = document.getElementById('free-note')?.value || '';
    const childTime = document.getElementById('child-time')?.value || '';
    const validAnswers = answers.filter(a => a.answer);
    if (freeNote) validAnswers.push({ question: '자유 메모', category: 'etc', catLabel: '✨ 그 외', answer: freeNote });
    if (childTime) validAnswers.push({ question: '아이와 함께한 시간', category: 'parenting', catLabel: '👨‍👧 육아', answer: childTime });

    // 할 일 완료 여부
    const todos = await Store.Todos.getAll();

    const today = Store.today();
    const health = await Store.Health.getByDate(today);
    const result = await API.generateDiary(validAnswers, health);

    const diary = result?.diary || validAnswers.map(a => a.answer).join('\n');
    const tags = result?.tags || [];
    const mood = result?.mood || '😊';
    const summary = result?.summary || diary.slice(0, 30);
    const aiFeedback = result?.feedback || '';

    // 날짜/날씨 정보
    const now = new Date();
    const days = ['일','월','화','수','목','금','토'];
    const dateStr = `${now.getFullYear()}년 ${now.getMonth()+1}월 ${now.getDate()}일 ${days[now.getDay()]}요일`;
    const amTemp = document.getElementById('w-am')?.textContent || '';
    const amDesc = document.getElementById('w-am-desc')?.textContent || '';
    const weatherBadge = amTemp && amTemp !== '--°C' ? `${amTemp} ${amDesc}` : '';

    // 카테고리별 그룹핑
    const categorized = {};
    validAnswers.forEach(a => {
      const cat = a.category || 'etc';
      if (!categorized[cat]) categorized[cat] = [];
      categorized[cat].push(a);
    });

    await Store.Entries.save(today, { diary, tags, mood, summary, answers: validAnswers, categorized, health });

    // 카테고리별 카드 HTML
    const catCards = Object.entries(categorized).map(([catId, items]) => {
      const cat = QuestionPool.getCategoryInfo(catId);
      const qAndA = items.map(i => `
        <div style="margin-bottom:8px">
          <div style="font-size:11px;color:var(--color-text-secondary);margin-bottom:3px">${escapeHtml(i.question)}</div>
          <div style="font-size:13px;color:var(--color-text-primary);line-height:1.65">${escapeHtml(i.answer)}</div>
        </div>`).join('');
      return `<div style="background:var(--color-background-primary);border-radius:12px;padding:12px 14px">
        <div style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;color:${cat.color};background:${cat.bg};padding:3px 10px;border-radius:99px;margin-bottom:8px">${cat.label}</div>
        ${qAndA}
      </div>`;
    }).join('');

    // 할 일 현황 HTML
    const todoHtml = todos.length ? `
      <div style="background:var(--color-background-primary);border-radius:14px;padding:14px 16px">
        <div style="font-size:11px;font-weight:600;color:var(--color-text-secondary);letter-spacing:0.04em;margin-bottom:10px">☑ 오늘 할 일 완료 현황</div>
        ${todos.map(t => `<div style="display:flex;align-items:center;gap:8px;font-size:13px;color:${t.done?'var(--color-text-secondary)':'var(--color-text-primary)'};text-decoration:${t.done?'line-through':'none'};padding:4px 0">
          <span>${t.done?'✅':'⬜'}</span>
          <span>${escapeHtml(t.text)}</span>
        </div>`).join('')}
      </div>` : '';

    // 건강 데이터 HTML
    const healthHtml = health ? `
      <div style="background:var(--color-background-primary);border-radius:14px;padding:14px 16px">
        <div style="font-size:11px;font-weight:600;color:var(--color-text-secondary);letter-spacing:0.04em;margin-bottom:10px">💪 오늘 건강 데이터</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
          <div style="background:var(--color-background-secondary);border-radius:10px;padding:9px 8px;text-align:center">
            <div style="font-size:10px;color:var(--color-text-secondary);margin-bottom:3px">수면점수</div>
            <div style="font-size:16px;font-weight:600;color:#534AB7">${health.sleep||'--'}</div>
          </div>
          <div style="background:var(--color-background-secondary);border-radius:10px;padding:9px 8px;text-align:center">
            <div style="font-size:10px;color:var(--color-text-secondary);margin-bottom:3px">스트레스</div>
            <div style="font-size:16px;font-weight:600;color:#D85A30">${health.stress||'--'}</div>
          </div>
          <div style="background:var(--color-background-secondary);border-radius:10px;padding:9px 8px;text-align:center">
            <div style="font-size:10px;color:var(--color-text-secondary);margin-bottom:3px">러닝</div>
            <div style="font-size:14px;font-weight:600;color:#085041">${health.pace||'--'}</div>
          </div>
        </div>
      </div>` : '';

    // AI 피드백 HTML
    const feedbackHtml = aiFeedback ? `
      <div style="background:linear-gradient(135deg,#E1F5EE,#EEEDFE);border-radius:12px;padding:13px 14px">
        <div style="font-size:10px;font-weight:600;color:#0F6E56;margin-bottom:6px">✨ AI 피드백</div>
        <div style="font-size:13px;color:#085041;line-height:1.65">${escapeHtml(aiFeedback)}</div>
      </div>` : '';

    // 태그 HTML
    const tagHtml = tags.length ? `
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${tags.map(t=>`<span style="background:#E1F5EE;color:#0F6E56;border-radius:99px;padding:4px 11px;font-size:11px">${escapeHtml(t)}</span>`).join('')}
      </div>` : '';

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;padding-bottom:8px">

        <div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:20px 0 8px">
          <div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#3DCFC4,#B5E857);display:flex;align-items:center;justify-content:center;font-size:32px">✅</div>
          <div style="font-size:20px;font-weight:600;color:var(--color-text-primary);text-align:center">오늘 일기가 완성됐어요</div>
          <div style="font-size:13px;color:var(--color-text-secondary);text-align:center;line-height:1.6">AI가 카테고리별로 오늘의 이야기를<br>정리했어요.</div>
        </div>

        <div style="background:var(--color-background-primary);border-radius:14px;padding:14px 16px">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="font-size:34px">${mood}</div>
            <div style="flex:1">
              <div style="font-size:15px;font-weight:600;color:var(--color-text-primary)">${dateStr}</div>
              <div style="font-size:12px;color:var(--color-text-secondary);margin-top:2px">${summary}</div>
            </div>
            ${weatherBadge ? `<div style="background:var(--color-background-secondary);border-radius:99px;padding:4px 10px;font-size:12px;color:var(--color-text-secondary);white-space:nowrap">🌤 ${weatherBadge}</div>` : ''}
          </div>
        </div>

        <div style="background:var(--color-background-primary);border-radius:14px;padding:14px 16px">
          <div style="font-size:11px;font-weight:600;color:var(--color-text-secondary);letter-spacing:0.04em;margin-bottom:8px">✨ AI가 완성한 오늘의 일기</div>
          <div style="font-size:14px;color:var(--color-text-primary);line-height:1.8">${escapeHtml(diary)}</div>
        </div>

        <div>
          <div style="font-size:11px;font-weight:600;color:var(--color-text-secondary);letter-spacing:0.04em;margin-bottom:8px">📂 카테고리별 기록</div>
          <div style="display:flex;flex-direction:column;gap:8px">${catCards}</div>
        </div>

        ${todoHtml}
        ${healthHtml}
        ${feedbackHtml}
        ${tagHtml}

        <button class="btn-primary" onclick="App.go('home')" style="width:100%;margin-top:4px">🏠 홈으로 돌아가기</button>
        <button onclick="Record.shareEntry('${today}')" style="width:100%;background:var(--color-background-secondary);color:var(--color-text-secondary);border-radius:14px;padding:11px;font-size:13px;display:flex;align-items:center;justify-content:center;gap:6px">
          📤 일기 공유 / 내보내기
        </button>

      </div>`;
  }

  function shareEntry(dateStr) {
    const text = `📖 ${dateStr} 일기\n\n` + (answers.map(a => `[${a.catLabel||''}] ${a.answer}`).join('\n'));
    if (navigator.share) {
      navigator.share({ title: '나의 일기', text });
    } else {
      navigator.clipboard?.writeText(text).then(() => alert('일기가 클립보드에 복사됐어요!'));
    }
  }

  return { init, next, skip, finalize, shareEntry, toggleVoice, retry, confirmVoice, confirmFree, onTextInput, onFreeInput, onGarminSelect, startStep, startFree };
})();
