/* ── record.js: 기록 화면 ── */
const Record = (() => {

  let questions = [];
  let currentStep = 0;
  let answers = [];
  let recognition = null;
  let isRecording = false;
  let finalTranscript = '';
  let interimTranscript = '';
  let healthData = {};

  function init() {
    questions = Store.Questions.getAll();
    currentStep = 0;
    answers = new Array(questions.length).fill(null).map(() => ({ question: '', answer: '' }));
    healthData = Store.Health.getByDate(Store.today()) || {};
    renderStep();
  }

  function renderStep() {
    const total = questions.length;
    const pct = Math.round(((currentStep) / total) * 100);
    const stepEl = document.getElementById('rec-step');
    const progEl = document.getElementById('rec-progress');
    if (stepEl) stepEl.textContent = `${currentStep + 1} / ${total + 1}`;
    if (progEl) progEl.style.width = `${pct}%`;

    // 마지막 단계: 가민 + 선택 항목
    if (currentStep === questions.length) {
      renderFinalStep();
      return;
    }

    const q = questions[currentStep];
    answers[currentStep].question = q.text;
    const prevAnswers = answers.slice(0, currentStep).filter(a => a.answer);

    const body = document.getElementById('rec-body');
    body.innerHTML = `
      <div class="section">
        ${prevAnswers.length ? prevAnswers.map(a => `<div class="answer-bubble">${escapeHtml(a.answer)}</div>`).join('') : ''}
        <div class="card">
          <div class="q-bubble">
            <div class="q-label">Q${currentStep + 1} · ${getQCategory(currentStep)}</div>
            <div class="q-text">${escapeHtml(q.text)}</div>
          </div>
          <div class="voice-zone">
            <div class="voice-top" id="voice-top" onclick="Record.toggleVoice()">
              <div class="voice-ring" id="voice-ring">🎙</div>
              <div class="waveform" id="waveform">
                <span></span><span></span><span></span><span></span><span></span><span></span>
              </div>
              <div class="voice-status" id="voice-status">탭해서 말하기 시작</div>
            </div>
            <div class="stt-live-box">
              <div class="stt-label" id="stt-label" style="color:#bbb">💬 말하면 여기에 텍스트로 변환돼요</div>
              <div class="stt-text" id="stt-text"></div>
            </div>
            <div class="stt-actions" id="stt-actions" style="display:none">
              <button class="btn-retry" onclick="Record.retry()">🔄 다시 녹음</button>
              <button class="btn-confirm" onclick="Record.confirmVoice()">✓ 이대로 다음</button>
            </div>
          </div>
          <div class="divider-or">또는</div>
          <textarea class="text-input-area" id="text-answer"
            placeholder="직접 타이핑해도 좋아요..."
            oninput="Record.onTextInput(this.value)">${escapeHtml(answers[currentStep].answer || '')}</textarea>
          ${answers[currentStep].answer ? `
            <div class="ai-preview" id="ai-preview">
              <div class="ap-label">✨ AI 요약 미리보기</div>
              <div class="ap-text" id="ap-text">분석 중...</div>
            </div>` : ''}
        </div>
      </div>
    `;

    const nextBtn = document.getElementById('rec-next-btn');
    if (nextBtn) nextBtn.textContent = currentStep === questions.length - 1 ? '마지막 단계 →' : '다음 질문 →';
  }

  function renderFinalStep() {
    const stepEl = document.getElementById('rec-step');
    if (stepEl) stepEl.textContent = `가민 & 선택항목`;
    const progEl = document.getElementById('rec-progress');
    if (progEl) progEl.style.width = '90%';

    const today = Store.today();
    const existing = Store.Health.getByDate(today) || {};

    document.getElementById('rec-body').innerHTML = `
      <div class="section">
        <div class="card">
          <div style="font-size:11px;font-weight:600;color:#888;margin-bottom:10px">가민 스크린샷 업로드</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${renderUploadZone('sleep', '💤 수면 분석', existing.sleep ? `수면점수 ${existing.sleep} 파싱 완료` : '탭해서 수크린샷 선택')}
            ${renderUploadZone('stress', '🧠 스트레스', existing.stress ? `스트레스 ${existing.stress} 파싱 완료` : '탭해서 스크린샷 선택')}
            ${renderUploadZone('run', '🏃 러닝 (오늘 달린 경우만)', existing.pace ? `페이스 ${existing.pace} 파싱 완료` : '탭해서 스크린샷 선택')}
          </div>
        </div>
        <div class="card">
          <div style="font-size:11px;font-weight:600;color:#888;margin-bottom:10px">선택 항목</div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:0.5px solid #f0f0f0">
            <span style="font-size:13px;color:#222">오늘 아이와 함께한 시간</span>
            <select id="child-time" style="font-size:12px;color:#2AADA3;background:none;border:none;outline:none">
              <option value="">선택</option>
              <option>거의 없음</option>
              <option>1시간</option>
              <option>2시간 이상</option>
            </select>
          </div>
          <div style="padding:8px 0">
            <div style="font-size:13px;color:#222;margin-bottom:6px">오늘 특별히 남기고 싶은 말</div>
            <textarea class="text-input-area" id="free-note" placeholder="자유롭게 메모..." style="height:60px"></textarea>
          </div>
        </div>
      </div>
    `;

    const nextBtn = document.getElementById('rec-next-btn');
    if (nextBtn) nextBtn.textContent = '✨ AI로 일기 완성하기';
  }

  function renderUploadZone(type, label, subtext) {
    const isDone = subtext.includes('완료');
    return `
      <div class="garmin-hint" style="${isDone ? 'background:#E1F5EE;color:#0F6E56' : ''}" onclick="Record.uploadGarmin('${type}')">
        <span>${label}</span>
        <span style="flex:1;font-size:11px;color:${isDone ? '#0F6E56' : '#888'};margin-left:8px">${subtext}</span>
        <input type="file" id="file-${type}" accept="image/*" style="display:none" onchange="Record.onFileSelect(this, '${type}')">
        <span style="font-size:12px">${isDone ? '✓' : '+'}</span>
      </div>
    `;
  }

  function uploadGarmin(type) {
    document.getElementById(`file-${type}`)?.click();
  }

  async function onFileSelect(input, type) {
    if (!input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result.split(',')[1];
      const zone = input.parentElement;
      zone.innerHTML = `<div class="loading"><div class="spinner"></div> AI가 이미지 분석 중...</div>`;
      const result = await API.parseGarminImage(base64, type);
      if (result) {
        const today = Store.today();
        const existing = Store.Health.getByDate(today) || {};
        if (type === 'sleep') {
          Object.assign(existing, { sleep: result.sleepScore, sleepHours: result.totalSleep, deepSleep: result.deepSleep });
        } else if (type === 'stress') {
          existing.stress = result.stressScore;
        } else if (type === 'run') {
          Object.assign(existing, { pace: result.pace, heartRate: result.heartRate, calories: result.calories, duration: result.duration });
        }
        Store.Health.save(today, existing);
        healthData = existing;
        renderFinalStep();
      } else {
        alert('이미지 분석에 실패했습니다. 다시 시도해주세요.');
      }
    };
    reader.readAsDataURL(file);
  }

  // ── 음성 인식 ──
  function toggleVoice() {
    if (isRecording) stopRecording();
    else startRecording();
  }

  function startRecording() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('이 브라우저는 음성 인식을 지원하지 않아요. Chrome을 사용해주세요.');
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.continuous = true;
    recognition.interimResults = true;
    finalTranscript = '';
    interimTranscript = '';

    recognition.onstart = () => {
      isRecording = true;
      document.getElementById('voice-ring').innerHTML = '⏹';
      document.getElementById('voice-ring').classList.add('recording');
      document.getElementById('waveform').classList.add('active');
      document.getElementById('voice-status').textContent = '녹음 중 · 탭하면 완료';
      document.getElementById('voice-status').classList.add('on');
      document.getElementById('stt-label').textContent = '🔴 실시간 변환 중';
      document.getElementById('stt-label').style.color = '#2AADA3';
      document.getElementById('stt-actions').style.display = 'none';
    };

    recognition.onresult = (e) => {
      interimTranscript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript;
        else interimTranscript = e.results[i][0].transcript;
      }
      const textEl = document.getElementById('stt-text');
      if (textEl) {
        textEl.innerHTML = escapeHtml(finalTranscript) +
          (interimTranscript ? `<span class="stt-interim">${escapeHtml(interimTranscript)}</span>` : '') +
          '<span class="stt-cursor"></span>';
      }
      // 텍스트 영역도 동기화
      const ta = document.getElementById('text-answer');
      if (ta) ta.value = finalTranscript + interimTranscript;
    };

    recognition.onerror = (e) => {
      if (e.error !== 'aborted') console.error('음성 인식 오류:', e.error);
      stopRecording();
    };

    recognition.onend = () => {
      if (isRecording) recognition.start(); // 자동 재시작
    };

    recognition.start();
  }

  function stopRecording() {
    isRecording = false;
    if (recognition) { recognition.onend = null; recognition.stop(); recognition = null; }

    document.getElementById('voice-ring').innerHTML = '🎙';
    document.getElementById('voice-ring').classList.remove('recording');
    document.getElementById('waveform').classList.remove('active');
    document.getElementById('voice-status').textContent = '다시 말하기';
    document.getElementById('voice-status').classList.remove('on');

    const text = finalTranscript.trim();
    const textEl = document.getElementById('stt-text');
    if (textEl) {
      textEl.innerHTML = escapeHtml(text) || '<span style="color:#bbb">음성이 인식되지 않았어요</span>';
    }

    if (text) {
      document.getElementById('stt-label').textContent = '✓ 변환 완료 · 수정 가능해요';
      document.getElementById('stt-label').style.color = '#2AADA3';
      document.getElementById('stt-actions').style.display = 'flex';
      document.getElementById('text-answer').value = text;
      answers[currentStep].answer = text;
    }
  }

  function retry() {
    finalTranscript = '';
    document.getElementById('stt-text').innerHTML = '';
    document.getElementById('stt-actions').style.display = 'none';
    document.getElementById('stt-label').textContent = '💬 말하면 여기에 텍스트로 변환돼요';
    document.getElementById('stt-label').style.color = '#bbb';
    startRecording();
  }

  function confirmVoice() {
    const text = document.getElementById('text-answer')?.value?.trim();
    if (text) answers[currentStep].answer = text;
    next();
  }

  function onTextInput(val) {
    if (currentStep < questions.length) {
      answers[currentStep].answer = val;
    }
  }

  function getQCategory(index) {
    const cats = ['오늘 하루', '기억에 남는 일', '업무/커리어', '육아/가족', '내일 계획'];
    return cats[index] || `질문 ${index+1}`;
  }

  function next() {
    // 현재 텍스트 저장
    const ta = document.getElementById('text-answer');
    if (ta && currentStep < questions.length) answers[currentStep].answer = ta.value.trim();

    if (currentStep === questions.length) {
      finalize();
      return;
    }
    currentStep++;
    renderStep();
  }

  function skip() {
    if (currentStep < questions.length) answers[currentStep].answer = '';
    currentStep++;
    if (currentStep > questions.length) { finalize(); return; }
    renderStep();
  }

  async function finalize() {
    // 완성 화면으로 전환
    const body = document.getElementById('rec-body');
    body.innerHTML = `<div class="complete-view"><div class="loading"><div class="spinner"></div> AI가 일기를 작성 중이에요...</div></div>`;
    document.getElementById('rec-footer').style.display = 'none';

    const validAnswers = answers.filter(a => a.answer);
    const freeNote = document.getElementById('free-note')?.value || '';
    if (freeNote) validAnswers.push({ question: '자유 메모', answer: freeNote });

    const today = Store.today();
    const health = Store.Health.getByDate(today);

    // Claude API로 일기 생성
    const result = await API.generateDiary(validAnswers, health);

    const diary = result?.diary || validAnswers.map(a => a.answer).join(' ');
    const tags = result?.tags || [];
    const mood = result?.mood || '😊';
    const summary = result?.summary || diary.slice(0, 30);

    // 저장
    Store.Entries.save(today, { diary, tags, mood, summary, answers: validAnswers, health });

    // AI 할 일 추출 (비동기 백그라운드)
    API.extractTodos(Store.Entries.getRecent(3)).then(todos => {
      if (todos?.length) {
        const existing = Store.Todos.getAll();
        todos.forEach(t => { if (!existing.find(e => e.text === t)) Store.Todos.add(t); });
      }
    });

    // 완성 화면 렌더
    body.innerHTML = `
      <div class="complete-view">
        <div class="complete-ring">✅</div>
        <div class="complete-title">오늘 일기가 완성됐어요</div>
        <div class="complete-sub">AI가 오늘의 이야기를 정리했어요.<br>내일 할 일도 자동으로 추출했어요.</div>
        <div class="diary-result-card">
          <div class="diary-result-label">✨ AI가 완성한 오늘의 일기</div>
          <div class="diary-text">${escapeHtml(diary)}</div>
        </div>
        <div class="tag-wrap" style="justify-content:center">
          ${tags.map(t => `<span class="tag tag-g">${escapeHtml(t)}</span>`).join('')}
        </div>
        <button class="btn-primary" onclick="App.go('home')" style="width:100%">🏠 홈으로 돌아가기</button>
      </div>
    `;

    const footer = document.getElementById('rec-footer');
    if (footer) footer.style.display = 'none';
  }

  return { init, next, skip, toggleVoice, retry, confirmVoice, onTextInput, uploadGarmin, onFileSelect };
})();
