/* ── calendar.js ── */
const Calendar = (() => {
  let year = new Date().getFullYear();
  let month = new Date().getMonth() + 1;

  async function render() {
    renderHeader();
    await renderGrid();
    await renderStats();
    await renderEntryList();
  }

  async function renderHeader() {
    const el = document.getElementById('cal-title');
    if (el) el.textContent = `${year}년 ${month}월`;
    const entries = await Store.Entries.getByMonth(year, month);
    const countEl = document.getElementById('cal-month-count');
    if (countEl) countEl.textContent = `${entries.length}일`;
  }

  async function renderGrid() {
    const grid = document.getElementById('cal-grid');
    if (!grid) return;
    const entries = await Store.Entries.getAll();
    const today = Store.today();
    const firstDay = new Date(year, month-1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    let html = '';
    for (let i = 0; i < firstDay; i++) html += '<div></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const entry = entries[dateStr];
      const isToday = dateStr === today;
      const isFuture = dateStr > today;
      html += `<div class="cal-day" onclick="${entry?`Drawer.showEntry('${dateStr}')`:''}" style="cursor:${entry?'pointer':'default'}">
        <div class="cd-num ${isToday?'today':''}">${d}</div>
        <div class="cd-bar ${entry?'done':isFuture?'':'partial'}"></div>
        <div class="cd-mood">${entry?.mood||''}</div>
      </div>`;
    }
    grid.innerHTML = html;
  }

  async function renderStats() {
    const el = document.getElementById('cal-stats');
    if (!el) return;
    const entries = await Store.Entries.getByMonth(year, month);
    const moods = entries.map(e => e.mood).filter(Boolean);
    const dominantMood = moods.length ? moods.sort((a,b)=>moods.filter(v=>v===b).length-moods.filter(v=>v===a).length)[0] : '😊';
    const runCount = entries.filter(e => e.health?.pace).length;
    el.innerHTML = `
      <div class="stat-chip"><div class="sc-label">기록 완료</div><div class="sc-val" style="color:#2AADA3">${entries.length}일</div></div>
      <div class="stat-chip"><div class="sc-label">평균 기분</div><div class="sc-val">${dominantMood}</div></div>
      <div class="stat-chip"><div class="sc-label">러닝</div><div class="sc-val" style="color:#085041">${runCount}회</div></div>`;
  }

  async function renderEntryList() {
    const el = document.getElementById('cal-entry-list');
    if (!el) return;
    const entries = (await Store.Entries.getByMonth(year, month)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
    if (!entries.length) { el.innerHTML = '<div style="text-align:center;padding:20px;color:#bbb;font-size:13px">이번 달 기록이 없어요</div>'; return; }
    const days = ['일','월','화','수','목','금','토'];
    el.innerHTML = entries.map(e => {
      const d = new Date(e.date);
      return `<div class="entry-row" onclick="Drawer.showEntry('${e.date}')">
        <div class="entry-dot" style="background:linear-gradient(135deg,#3DCFC4,#B5E857);flex-direction:column;gap:0">
          <span style="font-size:15px;font-weight:700;color:white">${d.getDate()}</span>
          <span style="font-size:9px;color:rgba(255,255,255,0.8)">${days[d.getDay()]}</span>
        </div>
        <div class="entry-meta">
          <div class="entry-title">${escapeHtml(e.summary||e.diary?.slice(0,30)||'오늘의 일기')}</div>
          <div class="entry-preview">${e.health?`수면${e.health.sleep||'--'} · 스트레스${e.health.stress||'--'}`:''}</div>
        </div>
        <div style="font-size:20px">${e.mood||''}</div>
      </div>`;
    }).join('');
  }

  function prevMonth() { if(month===1){year--;month=12;}else month--; render(); }
  function nextMonth() { if(month===12){year++;month=1;}else month++; render(); }
  return { render, prevMonth, nextMonth };
})();

/* ── settings.js ── */
const Settings = (() => {

  async function render() {
    const s = await Store.Settings.get();
    const streak = Store.Streak.get();
    const nameEl = document.getElementById('set-username');
    if (nameEl) nameEl.textContent = s.username || '내 일기장';
    const subEl = document.getElementById('set-streak-info');
    if (subEl) subEl.textContent = `연속 ${streak.current}일째 🔥 · ${s.email||''}`;

    await renderAlarms();
    await renderQuestions();

    // 다크모드 — 실제 상태와 토글 동기화
    const isDark = document.body.classList.contains('dark');
    const toggleDark = document.getElementById('toggle-dark');
    if (toggleDark) toggleDark.classList.toggle('on', isDark);

    // 날씨 토글
    const toggleWeather = document.getElementById('toggle-weather');
    if (toggleWeather) toggleWeather.classList.toggle('on', !!s.weatherEnabled);

    // 위치 설정
    const locEl = document.getElementById('location-label');
    if (locEl) locEl.textContent = s.location || '탭해서 위치 설정';

    // 모드
    // API 키 상태 표시
    const apiKey = localStorage.getItem('diary_api_key');
    const apiKeyEl = document.getElementById('api-key-label');
    if (apiKeyEl) apiKeyEl.textContent = apiKey ? '키 설정 완료 ✓' : '탭해서 키 입력';

    // 피드백 스타일 라벨
    const fbLabels = { warm:'따뜻하고 공감적으로', coach:'코치처럼 동기부여', analytical:'분석적이고 객관적으로', friend:'친구처럼 편하게', mentor:'멘토처럼 깊이있게' };
    const fbEl = document.getElementById('feedback-style-label');
    if (fbEl) fbEl.textContent = fbLabels[s.aiFeedbackStyle||'warm'] || '따뜻하고 공감적으로';

    document.querySelectorAll('.mode-card').forEach(c => {
      c.classList.toggle('active', c.dataset.mode === (s.mode||'question'));
    });
  }

  async function renderAlarms() {
    const el = document.getElementById('alarm-list');
    if (!el) return;
    const alarms = await Store.Alarms.getAll();
    const dayNames = ['일','월','화','수','목','금','토'];
    if (!alarms.length) {
      el.innerHTML = '<div style="padding:14px;text-align:center;color:#bbb;font-size:13px">등록된 알람이 없어요</div>';
      return;
    }
    el.innerHTML = alarms.map(a => `
      <div class="alarm-item">
        <div class="alarm-time">${a.time}</div>
        <div class="alarm-meta">
          <div class="alarm-label">${escapeHtml(a.label)}</div>
          <div class="alarm-days">${a.days.length===7?'매일':a.days.map(d=>dayNames[d]).join(', ')}</div>
        </div>
        <div class="toggle ${a.enabled?'on':''}" onclick="Settings.toggleAlarm(${a.id})"><div class="toggle-knob"></div></div>
        <button class="alarm-del" onclick="Settings.deleteAlarm(${a.id})">✕</button>
      </div>`).join('');
  }

  async function renderQuestions() {
    const el = document.getElementById('question-list');
    if (!el) return;
    const qs = await Store.Questions.getAll();
    el.innerHTML = qs.map(q => `
      <div class="q-item">
        <span class="q-handle">⠿</span>
        <span class="q-text">${escapeHtml(q.text)}</span>
        <button class="q-edit-btn" onclick="Settings.deleteQuestion(${q.id})">✕</button>
      </div>`).join('');
  }

  function openAlarmDrawer() {
    const dayNames = ['일','월','화','수','목','금','토'];
    Drawer.open('알람 추가', `
      <div>
        <div class="drawer-section-label">시간 설정</div>
        <div class="time-picker">
          <select id="alarm-ampm"><option>오전</option><option selected>오후</option></select>
          <select id="alarm-hour">
            ${[...Array(12)].map((_,i)=>`<option ${i===8?'selected':''}>${String(i+1).padStart(2,'0')}</option>`).join('')}
          </select>
          <div class="tp-sep">:</div>
          <select id="alarm-min">
            ${['00','10','15','20','30','40','45','50'].map(v=>`<option>${v}</option>`).join('')}
          </select>
        </div>
      </div>
      <div>
        <div class="drawer-section-label">반복 요일</div>
        <div class="day-picker">
          ${dayNames.map((d,i)=>`<div class="day-btn on" data-day="${i}" onclick="this.classList.toggle('on')">${d}</div>`).join('')}
        </div>
      </div>
      <div>
        <div class="drawer-section-label">알람 이름</div>
        <input class="label-input" id="alarm-label-input" placeholder="예: 저녁 일기 작성" value="저녁 일기 알람" />
      </div>
      <button class="btn-primary" onclick="Settings.saveAlarm()">저장하기</button>
    `);
  }

  async function saveAlarm() {
    const ampm = document.getElementById('alarm-ampm')?.value;
    let h = parseInt(document.getElementById('alarm-hour')?.value || '9');
    const m = document.getElementById('alarm-min')?.value || '00';
    if (ampm === '오후' && h < 12) h += 12;
    if (ampm === '오전' && h === 12) h = 0;
    const time = `${String(h).padStart(2,'0')}:${m}`;
    const label = document.getElementById('alarm-label-input')?.value || '일기 알람';
    const days = [...document.querySelectorAll('.day-btn.on')].map(b => parseInt(b.dataset.day));
    if (!days.length) { alert('요일을 하나 이상 선택해주세요.'); return; }
    await Store.Alarms.add({ time, label, days, enabled: true });
    Notifications.scheduleAll();
    Drawer.close();
    await renderAlarms();
  }

  async function toggleAlarm(id) {
    await Store.Alarms.toggle(id);
    Notifications.scheduleAll();
    await renderAlarms();
  }

  async function deleteAlarm(id) {
    if (!confirm('이 알람을 삭제할까요?')) return;
    await Store.Alarms.remove(id);
    await renderAlarms();
  }

  function openQuestionDrawer() {
    const suggestions = [
      '오늘 감사한 일이 있었나요?',
      '경제적으로 신경 쓰이는 게 있나요?',
      '오늘 스스로 칭찬하고 싶은 게 있나요?',
      '요즘 마음에 걸리는 게 있나요?',
    ];
    Drawer.open('질문 추가', `
      <div>
        <div class="drawer-section-label">새 질문 입력</div>
        <textarea class="label-input" id="new-question" style="height:80px;resize:none" placeholder="예: 오늘 감사한 일이 있었나요?"></textarea>
      </div>
      <div>
        <div class="drawer-section-label">추천 질문 (탭해서 선택)</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${suggestions.map(s=>`<div style="background:#f5f5f5;border-radius:10px;padding:10px 12px;font-size:13px;cursor:pointer;color:#222" onclick="document.getElementById('new-question').value='${s}'">${s}</div>`).join('')}
        </div>
      </div>
      <button class="btn-primary" onclick="Settings.saveQuestion()">질문 추가하기</button>
    `);
  }

  async function saveQuestion() {
    const text = document.getElementById('new-question')?.value?.trim();
    if (!text) return;
    await Store.Questions.add(text);
    Drawer.close();
    await renderQuestions();
  }

  async function deleteQuestion(id) {
    if (!confirm('이 질문을 삭제할까요?')) return;
    await Store.Questions.remove(id);
    await renderQuestions();
  }

  async function setMode(mode, el) {
    await Store.Settings.set('mode', mode);
    document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
  }

  async function toggleDark() {
    const isDark = document.body.classList.contains('dark');
    document.body.classList.toggle('dark', !isDark);
    document.getElementById('toggle-dark').classList.toggle('on', !isDark);
    await Store.Settings.set('dark', !isDark);
  }

  async function toggleWeather() {
    const s = await Store.Settings.get();
    const next = !s.weatherEnabled;
    await Store.Settings.set('weatherEnabled', next);
    document.getElementById('toggle-weather').classList.toggle('on', next);
    const locEl = document.getElementById('location-label');
    if (next) {
      if (locEl) locEl.textContent = '위치 가져오는 중...';
      Weather.load();
    } else {
      if (locEl) locEl.textContent = '탭해서 위치 설정';
    }
  }




  function openApiKeyDrawer() {
    const current = localStorage.getItem('diary_api_key') || '';
    Drawer.open('Claude API 키 설정', `
      <div style="display:flex;flex-direction:column;gap:12px">
        <div style="font-size:13px;color:var(--color-text-secondary);line-height:1.6">
          AI 일기 정리, 건강 분석, 가민 파싱 기능에 필요해요.<br>
          <a href="https://console.anthropic.com" target="_blank" style="color:#2AADA3">console.anthropic.com</a>에서 무료로 발급받을 수 있어요.
        </div>
        <input class="label-input" id="api-key-input" type="password"
          placeholder="sk-ant-..." value="${current}"
          style="font-family:monospace;font-size:13px" />
        <button class="btn-primary" onclick="Settings.saveApiKey()">저장하기</button>
        ${current ? '<button onclick="Settings.clearApiKey()" style="width:100%;background:none;border:none;color:#E24B4A;font-size:13px;padding:8px;cursor:pointer;font-family:inherit">키 삭제</button>' : ''}
      </div>
    `);
  }

  function saveApiKey() {
    const key = document.getElementById('api-key-input')?.value?.trim();
    if (key) {
      localStorage.setItem('diary_api_key', key);
      // api.js의 ANTHROPIC_API_KEY 업데이트
      if (typeof API !== 'undefined') API.setApiKey(key);
      const el = document.getElementById('api-key-label');
      if (el) el.textContent = '키 설정 완료 ✓';
    }
    Drawer.close();
  }

  function clearApiKey() {
    if (!confirm('API 키를 삭제할까요?')) return;
    localStorage.removeItem('diary_api_key');
    const el = document.getElementById('api-key-label');
    if (el) el.textContent = '탭해서 키 입력';
    Drawer.close();
  }

  function openFeedbackStyleDrawer() {
    const styles = [
      { id: 'warm', icon: '🤗', title: '따뜻하고 공감적으로', desc: '감정에 공감하며 부드럽게 피드백해줘요.' },
      { id: 'coach', icon: '💪', title: '코치처럼 동기부여', desc: '성취에 집중하며 다음 행동을 제안해줘요.' },
      { id: 'analytical', icon: '🔍', title: '분석적이고 객관적으로', desc: '패턴과 데이터를 중심으로 분석해줘요.' },
      { id: 'friend', icon: '😊', title: '친구처럼 편하게', desc: '격식 없이 가볍고 친근하게 이야기해줘요.' },
      { id: 'mentor', icon: '🌱', title: '멘토처럼 깊이있게', desc: '삶의 방향과 성장을 중심으로 조언해줘요.' },
    ];
    Store.Settings.get().then(s => {
      const current = s.aiFeedbackStyle || 'warm';
      Drawer.open('AI 피드백 스타일', `
        <div style="display:flex;flex-direction:column;gap:8px">
          ${styles.map(st => `
            <div onclick="Settings.setFeedbackStyle('${st.id}', this.closest('[data-styles]'))"
              style="background:${current===st.id?'#E1F5EE':'var(--color-background-secondary)'};border-radius:12px;padding:14px;cursor:pointer;border:${current===st.id?'1.5px solid #3DCFC4':'1.5px solid transparent'}">
              <div style="display:flex;align-items:center;gap:10px">
                <span style="font-size:24px">${st.icon}</span>
                <div>
                  <div style="font-size:14px;font-weight:600;color:${current===st.id?'#0F6E56':'var(--color-text-primary)'}">${st.title}</div>
                  <div style="font-size:12px;color:var(--color-text-secondary);margin-top:2px">${st.desc}</div>
                </div>
                ${current===st.id?'<span style="margin-left:auto;color:#3DCFC4;font-size:18px">✓</span>':''}
              </div>
            </div>`).join('')}
        </div>
      `);
    });
  }

  async function setFeedbackStyle(styleId) {
    await Store.Settings.set('aiFeedbackStyle', styleId);
    const labels = { warm:'따뜻하고 공감적으로', coach:'코치처럼 동기부여', analytical:'분석적이고 객관적으로', friend:'친구처럼 편하게', mentor:'멘토처럼 깊이있게' };
    const subEl = document.querySelector('#screen-settings .st-sub[data-feedback]');
    if (subEl) subEl.textContent = labels[styleId] || '따뜻하고 공감적으로';
    Drawer.close();
    await render();
  }

  async function editProfile() {
    const s = await Store.Settings.get();
    const name = prompt('일기장 이름을 입력하세요:', s.username);
    if (name) {
      await Store.Settings.set('username', name);
      const el = document.getElementById('set-username');
      if (el) el.textContent = name;
    }
  }

  async function exportData() {
    Drawer.open('일기 내보내기', `
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="font-size:13px;color:var(--color-text-secondary);line-height:1.6;margin-bottom:4px">
          내보낼 기간을 선택하고 방법을 골라주세요.
        </div>
        <select id="export-period" style="background:var(--color-background-secondary);border:none;border-radius:10px;padding:10px 12px;font-size:13px;font-family:inherit;color:var(--color-text-primary);outline:none;width:100%">
          <option value="week">이번 주</option>
          <option value="month">이번 달</option>
          <option value="all">전체</option>
        </select>
        <button class="btn-primary" onclick="Settings.exportPDF()" style="width:100%">
          📄 PDF로 저장 / 인쇄
        </button>
        <button onclick="Settings.exportEmail()" style="width:100%;background:var(--color-background-secondary);border:none;border-radius:14px;padding:12px;font-size:14px;font-weight:500;color:var(--color-text-primary);font-family:inherit;cursor:pointer">
          📧 이메일로 보내기
        </button>
      </div>
    `);
  }

  async function exportPDF() {
    const period = document.getElementById('export-period')?.value || 'all';
    const entries = await getExportEntries(period);
    if (!entries.length) { alert('내보낼 일기가 없어요.'); return; }
    const html = buildExportHTML(entries, period);
    const win = window.open('', '_blank');
    if (!win) { alert('팝업을 허용해주세요.'); return; }
    win.document.write(html);
    win.document.close();
    Drawer.close();
  }

  async function exportEmail() {
    const period = document.getElementById('export-period')?.value || 'all';
    const entries = await getExportEntries(period);
    if (!entries.length) { alert('내보낼 일기가 없어요.'); return; }
    const text = entries.map(e => `[${e.date}] ${e.mood||''} ${e.summary||''}\n\n${e.diary||''}`).join('\n\n---\n\n');
    const periodLabel = { week:'이번 주', month:'이번 달', all:'전체' }[period];
    const subject = encodeURIComponent(`나의 일기장 ${periodLabel} 내보내기 — ${Store.today()}`);
    const body = encodeURIComponent(text.slice(0, 1800));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    Drawer.close();
  }

  async function getExportEntries(period) {
    const all = await Store.Entries.getAll();
    const now = new Date();
    const entries = Object.values(all).sort((a,b)=>a.date.localeCompare(b.date));
    if (period === 'all') return entries;
    if (period === 'month') {
      const prefix = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      return entries.filter(e => e.date.startsWith(prefix));
    }
    if (period === 'week') {
      const weekStart = new Date(now); weekStart.setDate(now.getDate()-now.getDay()+1); weekStart.setHours(0,0,0,0);
      return entries.filter(e => new Date(e.date) >= weekStart);
    }
    return entries;
  }

  function buildExportHTML(entries, period) {
    const periodLabel = { week:'이번 주', month:'이번 달', all:'전체' }[period] || '';
    const rows = entries.map(e => `
      <div style="margin-bottom:28px;padding-bottom:24px;border-bottom:1px solid #eee">
        <div style="font-size:13px;color:#888;margin-bottom:4px">${e.date} ${e.mood||''}</div>
        <div style="font-size:16px;font-weight:600;color:#222;margin-bottom:10px">${e.summary||''}</div>
        <div style="font-size:14px;color:#333;line-height:1.8">${(e.diary||'').replace(/\n/g,'<br>')}</div>
        ${e.tags?.length?`<div style="margin-top:10px">${e.tags.map(t=>`<span style="background:#E1F5EE;color:#0F6E56;border-radius:99px;padding:3px 10px;font-size:12px;margin:2px;display:inline-block">${t}</span>`).join('')}</div>`:''}
      </div>`).join('');
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>나의 일기장 ${periodLabel}</title>
    <style>body{font-family:-apple-system,sans-serif;max-width:640px;margin:0 auto;padding:32px 24px;color:#222}
    h1{color:#2AADA3;font-size:22px;margin-bottom:4px}.sub{color:#888;font-size:13px;margin-bottom:32px}
    @media print{button{display:none}}</style></head><body>
    <h1>📖 나의 일기장</h1>
    <div class="sub">${periodLabel} · ${Store.today()} 기준 · ${entries.length}개 항목</div>
    ${rows}
    <script>window.onload=()=>setTimeout(()=>window.print(),300);<\/script>
    </body></html>`;
  }

  return { render, openAlarmDrawer, saveAlarm, toggleAlarm, deleteAlarm, openQuestionDrawer, saveQuestion, deleteQuestion, setMode, toggleDark, toggleWeather, editProfile, exportData, exportPDF, exportEmail, openFeedbackStyleDrawer, setFeedbackStyle, openApiKeyDrawer, saveApiKey, clearApiKey };
})();

/* ── drawer.js ── */
const Drawer = (() => {
  function open(title, bodyHtml) {
    document.getElementById('drawer-title').textContent = title;
    document.getElementById('drawer-body').innerHTML = bodyHtml;
    document.getElementById('drawer-overlay').classList.add('show');
  }
  function close() { document.getElementById('drawer-overlay').classList.remove('show'); }

  async function showEntry(dateStr) {
    const entry = await Store.Entries.getByDate(dateStr);
    if (!entry) return;
    const d = new Date(dateStr);
    const days = ['일','월','화','수','목','금','토'];
    open(`${d.getMonth()+1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`, `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div style="font-size:36px">${entry.mood||'📖'}</div>
        <div>
          <div style="font-size:20px;font-weight:700;color:#222">${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일</div>
          <div style="font-size:12px;color:#999">${days[d.getDay()]}요일</div>
        </div>
      </div>
      <div class="tag-wrap">${(entry.tags||[]).map(t=>`<span class="tag tag-g">${escapeHtml(t)}</span>`).join('')}</div>
      <div class="card" style="margin-top:4px">
        <div style="font-size:11px;font-weight:600;color:#888;margin-bottom:8px">오늘의 일기</div>
        <div class="diary-text">${escapeHtml(entry.diary||entry.summary||'')}</div>
      </div>
      ${entry.health ? `
      <div>
        <div class="drawer-section-label">건강 데이터</div>
        <div class="health-mini">
          <div class="health-chip"><div class="hc-label">수면점수</div><div class="sc-val" style="color:#534AB7;font-size:17px;font-weight:600">${entry.health.sleep||'--'}</div></div>
          <div class="health-chip"><div class="hc-label">스트레스</div><div class="sc-val" style="color:#D85A30;font-size:17px;font-weight:600">${entry.health.stress||'--'}</div></div>
          <div class="health-chip"><div class="hc-label">러닝</div><div class="sc-val" style="color:#085041;font-size:13px;font-weight:600">${entry.health.pace||'--'}</div></div>
        </div>
      </div>` : ''}
    `);
  }

  return { open, close, showEntry };
})();

/* ── weather.js ── */
const Weather = (() => {
  async function load() {
    const s = await Store.Settings.get();
    if (!s.weatherEnabled) return;
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lon } = pos.coords;
      const data = await API.getWeather(lat, lon);
      if (!data) return;

      if (data.am) {
        const amEl = document.getElementById('w-am');
        const amDesc = document.getElementById('w-am-desc');
        if (amEl) amEl.textContent = `${data.am.temp}°C`;
        if (amDesc) amDesc.textContent = data.am.desc;
      }
      if (data.pm) {
        const pmEl = document.getElementById('w-pm');
        const pmDesc = document.getElementById('w-pm-desc');
        if (pmEl) pmEl.textContent = `${data.pm.temp}°C`;
        if (pmDesc) pmDesc.textContent = data.pm.desc;
      }

      const rain = document.getElementById('rain-alert');
      const rainMsg = document.getElementById('rain-msg');
      if (rain && rainMsg && data.hasRain) {
        rainMsg.textContent = `${data.rainTime}경 비 예보. 외출 시 우산 챙기세요.`;
        rain.style.display = 'flex';
      }

      // 위치명 저장
      const locLabel = `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
      await Store.Settings.set('location', locLabel);
      const locEl = document.getElementById('location-label');
      if (locEl) locEl.textContent = '위치 설정 완료 ✓';
    }, (err) => {
      console.log('위치 접근 거부:', err);
      const locEl = document.getElementById('location-label');
      if (locEl) locEl.textContent = '위치 접근 거부됨';
    });
  }

  return { load };
})();

/* ── notifications.js ── */
const Notifications = (() => {
  const timers = [];

  function requestPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  async function scheduleAll() {
    timers.forEach(t => clearTimeout(t));
    timers.length = 0;
    if (Notification.permission !== 'granted') return;
    const alarms = await Store.Alarms.getAll();
    alarms.filter(a => a.enabled).forEach(alarm => {
      const [h, m] = alarm.time.split(':').map(Number);
      const now = new Date();
      const target = new Date(now);
      target.setHours(h, m, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      const ms = target - now;
      if (ms < 24 * 60 * 60 * 1000) {
        const t = setTimeout(() => {
          new Notification('나의 일기장 ✍️', { body: alarm.label });
        }, ms);
        timers.push(t);
      }
    });
  }

  return { requestPermission, scheduleAll };
})();
