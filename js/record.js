/* ── record.js ── */
const Record = (() => {
  let questions = [];
  let currentStep = 0;
  let answers = [];
  let recognition = null;
  let isRecording = false;
  let finalTranscript = '';
  let healthData = {};
  // 가민 이미지 멀티업로드용
  let garminImages = { sleep: null, stress: null, run: null };

  async function init() {
    questions = await Store.Questions.getAll();
    currentStep = 0;
    answers = questions.map(q => ({ question: q.text, answer: '' }));
    healthData = (await Store.Health.getByDate(Store.today())) || {};
    garminImages = { sleep: null, stress: null, run: null };
    renderStep();
  }

  function renderStep() {
    const total = questions.length;
    const stepEl = document.getElementById('rec-step');
    const progEl = document.getElementById('rec-progress');
    if (stepEl) stepEl.textContent = `${Math.min(currentStep+1, total+1)} / ${total+1}`;
    if (progEl) progEl.style.width = `${Math.round((currentStep / (total+1)) * 100)}%`;

    if (currentStep >= total) { renderFinalStep(); return; }

    const q = questions[currentStep];
    const prevAnswers = answers.slice(0, currentStep).filter(a => a.answer);
    const body = document.getElementById('rec-body');
    body.innerHTML = `
      <div class="section">
        ${prevAnswers.map(a => `<div class="answer-bubble">${escapeHtml(a.answer)}</div>`).join('')}
        <div class="card">
          <div class="q-bubble">
            <div class="q-label">Q${currentStep+1} · ${getQCategory(currentStep)}</div>
            <div class="q-text">${escapeHtml(q.text)}</div>
          </div>
          <div class="voice-zone">
            <div class="voice-top" id="voice-top" onclick="Record.toggleVoice()">
              <div class="voice-ring" id="voice-ring">🎙</div>
              <div class="waveform" id="waveform"><span></span><span></span><span></span><span></span><span></span><span></span></div>
              <div class="voice-status" id="voice-status">탭해서 말하기 시작</div>
            </div>
            <div class="stt-live-box">
              <div class="stt-label" id="stt-label" style="color:#bbb">💬 말하면 여기에 텍스트로 변환돼요</div>
              <div class="stt-text" id="stt-text"></div>
            </div>
            <div class="stt-actions" id="stt-actions" style="display:none">
              <button class="btn-retry" onclick="Record.retry()">🔄 다시 녹음</button>
              <button class="btn-confirm" onclick="Record.confirmVoice()">✓ 저장하고 다음</button>
            </div>
          </div>
          <div class="divider-or">또는</div>
          <textarea class="text-input-area" id="text-answer"
            placeholder="직접 타이핑해도 좋아요..."
            oninput="Record.onTextInput(this.value)">${escapeHtml(answers[currentStep]?.answer || '')}</textarea>
        </div>
      </div>`;
    const nextBtn = document.getElementById('rec-next-btn');
    if (nextBtn) nextBtn.textContent = currentStep === questions.length-1 ? '마지막 단계 →' : '다음 질문 →';
    const footer = document.getElementById('rec-footer');
    if (footer) footer.style.display = '';
  }

  function renderFinalStep() {
    const today = Store.today();
    const h = healthData;
    const stepEl = document.getElementById('rec-step');
    if (stepEl) stepEl.textContent = '가민 & 선택항목';
    const progEl = document.getElementById('rec-progress');
    if (progEl) progEl.style.width = '90%';

    document.getElementById('rec-body').innerHTML = `
      <div class="section">
        <div class="card">
          <div style="font-size:11px;font-weight:600;color:#888;margin-bottom:10px">📷 가민 스크린샷 업로드 (여러 장 한꺼번에 가능)</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <label style="display:flex;align-items:center;gap:10px;background:#f5f5f5;border-radius:10px;padding:12px 14px;cursor:pointer">
              <span style="font-size:20px">💤</span>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:500;color:#222">수면 분석</div>
                <div style="font-size:11px;color:#999" id="sleep-status">${h.sleep ? `수면점수 ${h.sleep} · ${h.sleepHours||''}` : '탭해서 이미지 선택'}</div>
              </div>
              <span style="color:${h.sleep?'#2AADA3':'#bbb'}">${h.sleep?'✓':'+'}</span>
              <input type="file" accept="image/*" style="display:none" onchange="Record.onGarminSelect(this,'sleep')">
            </label>
            <label style="display:flex;align-items:center;gap:10px;background:#f5f5f5;border-radius:10px;padding:12px 14px;cursor:pointer">
              <span style="font-size:20px">🧠</span>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:500;color:#222">스트레스</div>
                <div style="font-size:11px;color:#999" id="stress-status">${h.stress ? `스트레스 ${h.stress}` : '탭해서 이미지 선택'}</div>
              </div>
              <span style="color:${h.stress?'#2AADA3':'#bbb'}">${h.stress?'✓':'+'}</span>
              <input type="file" accept="image/*" style="display:none" onchange="Record.onGarminSelect(this,'stress')">
            </label>
            <label style="display:flex;align-items:center;gap:10px;background:#f5f5f5;border-radius:10px;padding:12px 14px;cursor:pointer">
              <span style="font-size:20px">🏃</span>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:500;color:#222">러닝 (오늘 달린 경우만)</div>
                <div style="font-size:11px;color:#999" id="run-status">${h.pace ? `페이스 ${h.pace}` : '탭해서 이미지 선택'}</div>
              </div>
              <span style="color:${h.pace?'#2AADA3':'#bbb'}">${h.pace?'✓':'+'}</span>
              <input type="file" accept="image/*" style="display:none" onchange="Record.onGarminSelect(this,'run')">
            </label>
          </div>
          <div id="garmin-parse-status" style="display:none;margin-top:10px">
            <div class="loading"><div class="spinner"></div> AI가 이미지 분석 중...</div>
          </div>
        </div>
        <div class="card">
          <div style="font-size:11px;font-weight:600;color:#888;margin-bottom:10px">선택 항목</div>
          <div style="padding:8px 0;border-bottom:0.5px solid #f0f0f0">
            <div style="font-size:13px;color:#222;margin-bottom:6px">아이와 함께한 시간</div>
            <select id="child-time" style="font-size:13px;color:#222;background:#f5f5f5;border:none;border-radius:8px;padding:8px 12px;width:100%;outline:none">
              <option value="">선택 안 함</option>
              <option>거의 없음</option>
              <option>1시간</option>
              <option>2시간 이상</option>
            </select>
          </div>
          <div style="padding:8px 0">
            <div style="font-size:13px;color:#222;margin-bottom:6px">오늘 하고 싶은 말</div>
            <textarea class="text-input-area" id="free-note" placeholder="자유롭게 메모..." style="height:60px"></textarea>
          </div>
        </div>
      </div>`;

    const nextBtn = document.getElementById('rec-next-btn');
    if (nextBtn) nextBtn.textContent = '✨ AI로 일기 완성하기';
  }

  async function onGarminSelect(input, type) {
    if (!input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result.split(',')[1];
      garminImages[type] = base64;
      // 상태 텍스트 업데이트
      const statusEl = document.getElementById(`${type}-status`);
      if (statusEl) statusEl.textContent = '이미지 선택됨 · AI 분석 대기 중';

      // 선택 즉시 파싱
      const parseEl = document.getElementById('garmin-parse-status');
      if (parseEl) parseEl.style.display = 'block';
      const result = await API.parseGarminImage(base64, type);
      if (parseEl) parseEl.style.display = 'none';

      if (result) {
        const today = Store.today();
        const existing = (await Store.Health.getByDate(today)) || {};
        if (type === 'sleep') {
          Object.assign(existing, { sleep: result.sleepScore, sleepHours: result.totalSleep, deepSleep: result.deepSleep, remSleep: result.remSleep });
          if (statusEl) statusEl.textContent = `수면점수 ${result.sleepScore||'--'} · ${result.totalSleep||'--'} 파싱 완료`;
        } else if (type === 'stress') {
          existing.stress = result.stressScore;
          if (statusEl) statusEl.textContent = `스트레스 ${result.stressScore||'--'} 파싱 완료`;
        } else if (type === 'run') {
          Object.assign(existing, { pace: result.pace, heartRate: result.heartRate, calories: result.calories, duration: result.duration });
          if (statusEl) statusEl.textContent = `페이스 ${result.pace||'--'} 파싱 완료`;
        }
        await Store.Health.save(today, existing);
        healthData = existing;
      } else {
        if (statusEl) statusEl.textContent = '분석 실패 · 다시 시도해주세요';
      }
    };
    reader.readAsDataURL(file);
  }

  // ── 음성 인식 (중복 방지) ──
  function toggleVoice() {
    if (isRecording) stopRecording();
    else startRecording();
  }

  function startRecording() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Chrome 브라우저에서 사용해주세요.'); return; }

    // 이전 인식 세션 정리
    if (recognition) { try { recognition.abort(); } catch(e){} recognition = null; }

    finalTranscript = '';
    recognition = new SR();
    recognition.lang = 'ko-KR';
    recognition.continuous = false; // false로 바꿔서 중복 방지
    recognition.interimResults = true;

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
      let interim = '';
      let final = finalTranscript;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim = e.results[i][0].transcript;
      }
      finalTranscript = final;
      const textEl = document.getElementById('stt-text');
      if (textEl) {
        textEl.innerHTML = escapeHtml(finalTranscript) +
          (interim ? `<span class="stt-interim"> ${escapeHtml(interim)}</span>` : '') +
          '<span class="stt-cursor"></span>';
      }
      const ta = document.getElementById('text-answer');
      if (ta) ta.value = finalTranscript + interim;
    };

    recognition.onerror = (e) => {
      if (e.error === 'no-speech') {
        // 말 없으면 재시작
        if (isRecording) { try { recognition.start(); } catch(err){} }
        return;
      }
      console.error('STT 오류:', e.error);
      stopRecording();
    };

    recognition.onend = () => {
      // continuous=false 이므로 isRecording 중이면 재시작
      if (isRecording) {
        try { recognition.start(); } catch(err) { stopRecording(); }
      }
    };

    recognition.start();
  }

  function stopRecording() {
    isRecording = false;
    if (recognition) {
      recognition.onend = null;
      try { recognition.abort(); } catch(e) {}
      recognition = null;
    }
    const ring = document.getElementById('voice-ring');
    const wave = document.getElementById('waveform');
    const status = document.getElementById('voice-status');
    if (ring) { ring.innerHTML = '🎙'; ring.classList.remove('recording'); }
    if (wave) wave.classList.remove('active');
    if (status) { status.textContent = '다시 말하기'; status.classList.remove('on'); }

    const text = finalTranscript.trim();
    const textEl = document.getElementById('stt-text');
    if (textEl) textEl.innerHTML = text ? escapeHtml(text) : '<span style="color:#bbb">음성이 인식되지 않았어요</span>';

    const labelEl = document.getElementById('stt-label');
    if (text) {
      if (labelEl) { labelEl.textContent = '✓ 변환 완료 · 수정 가능해요'; labelEl.style.color = '#2AADA3'; }
      document.getElementById('stt-actions').style.display = 'flex';
      const ta = document.getElementById('text-answer');
      if (ta) ta.value = text;
      answers[currentStep].answer = text;
    } else {
      if (labelEl) { labelEl.textContent = '💬 말하면 여기에 텍스트로 변환돼요'; labelEl.style.color = '#bbb'; }
    }
  }

  function retry() {
    finalTranscript = '';
    const textEl = document.getElementById('stt-text');
    if (textEl) textEl.innerHTML = '';
    const actions = document.getElementById('stt-actions');
    if (actions) actions.style.display = 'none';
    const labelEl = document.getElementById('stt-label');
    if (labelEl) { labelEl.textContent = '💬 말하면 여기에 텍스트로 변환돼요'; labelEl.style.color = '#bbb'; }
    startRecording();
  }

  function confirmVoice() {
    const ta = document.getElementById('text-answer');
    const text = ta?.value?.trim();
    if (text) answers[currentStep].answer = text;
    stopRecording();
    next();
  }

  function onTextInput(val) {
    if (currentStep < questions.length) answers[currentStep].answer = val;
  }

  function getQCategory(i) {
    const cats = ['오늘 하루','기억에 남는 일','업무/커리어','육아/가족','내일 계획'];
    return cats[i] || `질문 ${i+1}`;
  }

  function next() {
    stopRecording();
    const ta = document.getElementById('text-answer');
    if (ta && currentStep < questions.length) answers[currentStep].answer = ta.value.trim();
    currentStep++;
    renderStep();
  }

  function skip() {
    stopRecording();
    if (currentStep < questions.length) answers[currentStep].answer = '';
    currentStep++;
    renderStep();
  }

  async function finalize() {
    stopRecording();
    const body = document.getElementById('rec-body');
    const footer = document.getElementById('rec-footer');
    if (footer) footer.style.display = 'none';
    body.innerHTML = `<div class="complete-view"><div class="loading"><div class="spinner"></div> AI가 일기를 작성 중이에요...</div></div>`;

    const freeNote = document.getElementById('free-note')?.value || '';
    const childTime = document.getElementById('child-time')?.value || '';
    const validAnswers = answers.filter(a => a.answer);
    if (freeNote) validAnswers.push({ question: '자유 메모', answer: freeNote });
    if (childTime) validAnswers.push({ question: '아이와 함께한 시간', answer: childTime });

    const today = Store.today();
    const health = await Store.Health.getByDate(today);
    const result = await API.generateDiary(validAnswers, health);

    const diary = result?.diary || validAnswers.map(a => a.answer).join(' ');
    const tags = result?.tags || [];
    const mood = result?.mood || '😊';
    const summary = result?.summary || diary.slice(0, 30);

    await Store.Entries.save(today, { diary, tags, mood, summary, answers: validAnswers, health });

    // 할 일 자동 추출 (백그라운드)
    Store.Entries.getRecent(3).then(recent => {
      API.extractTodos(recent).then(todos => {
        if (todos?.length) {
          Store.Todos.getAll().then(existing => {
            todos.forEach(t => { if (!existing.find(e => e.text === t)) Store.Todos.add(t); });
          });
        }
      });
    });

    body.innerHTML = `
      <div class="complete-view">
        <div class="complete-ring">✅</div>
        <div class="complete-title">오늘 일기가 완성됐어요</div>
        <div class="complete-sub">AI가 오늘의 이야기를 정리했어요.</div>
        <div class="diary-result-card">
          <div class="diary-result-label">✨ AI가 완성한 오늘의 일기</div>
          <div class="diary-text">${escapeHtml(diary)}</div>
        </div>
        <div class="tag-wrap" style="justify-content:center">
          ${tags.map(t => `<span class="tag tag-g">${escapeHtml(t)}</span>`).join('')}
        </div>
        <button class="btn-primary" onclick="App.go('home')" style="width:100%">🏠 홈으로 돌아가기</button>
      </div>`;
  }

  return { init, next, skip, finalize, toggleVoice, retry, confirmVoice, onTextInput, onGarminSelect };
})();
