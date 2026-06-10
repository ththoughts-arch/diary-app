/* ── calendar.js ── */
const Calendar = (() => {
  let year = new Date().getFullYear();
  let month = new Date().getMonth() + 1;

  function render() {
    renderHeader();
    renderGrid();
    renderStats();
    renderEntryList();
  }

  function renderHeader() {
    const el = document.getElementById('cal-title');
    if (el) el.textContent = `${year}년 ${month}월`;
    const entries = Store.Entries.getByMonth(year, month);
    const countEl = document.getElementById('cal-month-count');
    if (countEl) countEl.textContent = `${entries.length}일`;
  }

  function renderGrid() {
    const grid = document.getElementById('cal-grid');
    if (!grid) return;
    const entries = Store.Entries.getAll();
    const today = Store.today();
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();

    let html = '';
    for (let i = 0; i < firstDay; i++) html += '<div></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const entry = entries[dateStr];
      const isToday = dateStr === today;
      const isFuture = dateStr > today;
      html += `
        <div class="cal-day" onclick="${entry ? `Drawer.showEntry('${dateStr}')` : ''}">
          <div class="cd-num ${isToday ? 'today' : ''}">${d}</div>
          <div class="cd-bar ${entry ? 'done' : isFuture ? '' : 'partial'}"></div>
          <div class="cd-mood">${entry?.mood || (isFuture ? '' : '')}</div>
        </div>`;
    }
    grid.innerHTML = html;
  }

  function renderStats() {
    const el = document.getElementById('cal-stats');
    if (!el) return;
    const entries = Store.Entries.getByMonth(year, month);
    const moods = entries.map(e => e.mood).filter(Boolean);
    const dominantMood = moods.length ? moods.sort((a,b) => moods.filter(v=>v===b).length-moods.filter(v=>v===a).length)[0] : '😊';
    const runCount = entries.filter(e => e.health?.pace).length;
    el.innerHTML = `
      <div class="stat-chip"><div class="sc-label">기록 완료</div><div class="sc-val" style="color:#2AADA3">${entries.length}일</div></div>
      <div class="stat-chip"><div class="sc-label">평균 기분</div><div class="sc-val">${dominantMood}</div></div>
      <div class="stat-chip"><div class="sc-label">러닝</div><div class="sc-val" style="color:#085041">${runCount}회</div></div>
    `;
  }

  function renderEntryList() {
    const el = document.getElementById('cal-entry-list');
    if (!el) return;
    const entries = Store.Entries.getByMonth(year, month).sort((a,b) => b.date.localeCompare(a.date)).slice(0,8);
    if (!entries.length) {
      el.innerHTML = '<div style="text-align:center;padding:20px;color:#bbb;font-size:13px">이번 달 기록이 없어요</div>';
      return;
    }
    el.innerHTML = entries.map(e => {
      const d = new Date(e.date);
      const days = ['일','월','화','수','목','금','토'];
      return `<div class="entry-row" onclick="Drawer.showEntry('${e.date}')">
        <div class="entry-dot" style="background:linear-gradient(135deg,#3DCFC4,#B5E857);color:white;flex-direction:column;gap:0">
          <span style="font-size:15px;font-weight:700;color:white">${d.getDate()}</span>
          <span style="font-size:9px;color:rgba(255,255,255,0.8)">${days[d.getDay()]}</span>
        </div>
        <div class="entry-meta">
          <div class="entry-title">${escapeHtml(e.summary || e.diary?.slice(0,30) || '오늘의 일기')}</div>
          <div class="entry-preview">${e.health ? `수면${e.health.sleep||'--'} · 스트레스${e.health.stress||'--'}` : ''}</div>
        </div>
        <div class="entry-mood" style="font-size:20px">${e.mood || ''}</div>
      </div>`;
    }).join('');
  }

  function prevMonth() {
    if (month === 1) { year--; month = 12; } else month--;
    render();
  }
  function nextMonth() {
    if (month === 12) { year++; month = 1; } else month++;
    render();
  }

  return { render, prevMonth, nextMonth };
})();

/* ── settings.js ── */
const Settings = (() => {
  function render() {
    const s = Store.Settings.get();
    const streak = Store.Streak.get();
    const nameEl = document.getElementById('set-username');
    if (nameEl) nameEl.textContent = s.username || '내 일기장';
    const subEl = document.getElementById('set-streak-info');
    if (subEl) subEl.textContent = `연속 ${streak.current}일째 🔥`;

    renderAlarms();
    renderQuestions();

    const toggleDark = document.getElementById('toggle-dark');
    if (toggleDark) { if (s.dark) toggleDark.classList.add('on'); else toggleDark.classList.remove('on'); }
    const toggleWeather = document.getElementById('toggle-weather');
    if (toggleWeather) { if (s.weatherEnabled) toggleWeather.classList.add('on'); else toggleWeather.classList.remove('on'); }

    if (s.location) document.getElementById('location-label').textContent = s.location;

    // 모드
    document.querySelectorAll('.mode-card').forEach(c => {
      c.classList.toggle('active', c.dataset.mode === s.mode);
    });
  }

  function renderAlarms() {
    const el = document.getElementById('alarm-list');
    if (!el) return;
    const alarms = Store.Alarms.getAll();
    const dayNames = ['일','월','화','수','목','금','토'];
    el.innerHTML = alarms.map(a => `
      <div class="alarm-item">
        <div class="alarm-time">${a.time}</div>
        <div class="alarm-meta">
          <div class="alarm-label">${escapeHtml(a.label)}</div>
          <div class="alarm-days">${a.days.length === 7 ? '매일' : a.days.map(d => dayNames[d]).join(', ')}</div>
        </div>
        <div class="toggle ${a.enabled ? 'on' : ''}" onclick="Settings.toggleAlarm(${a.id})">
          <div class="toggle-knob"></div>
        </div>
        <button class="alarm-del" onclick="Settings.deleteAlarm(${a.id})">✕</button>
      </div>
    `).join('') || '<div style="padding:14px;text-align:center;color:#bbb;font-size:13px">알람이 없어요</div>';
  }

  function renderQuestions() {
    const el = document.getElementById('question-list');
    if (!el) return;
    const qs = Store.Questions.getAll();
    el.innerHTML = qs.map((q, i) => `
      <div class="q-item">
        <span class="q-handle">⠿</span>
        <span class="q-text">${escapeHtml(q.text)}</span>
        <button class="q-edit-btn" onclick="Settings.deleteQuestion(${q.id})">✕</button>
      </div>
    `).join('');
  }

  function openAlarmDrawer() {
    const dayNames = ['일','월','화','수','목','금','토'];
    let selectedDays = [1,2,3,4,5];
    Drawer.open('알람 추가', `
      <div>
        <div class="drawer-section-label">시간 설정</div>
        <div class="time-picker">
          <select id="alarm-ampm"><option>오전</option><option>오후</option></select>
          <select id="alarm-hour">${[...Array(12)].map((_,i)=>`<option>${String(i+1).padStart(2,'0')}</option>`).join('')}</select>
          <div class="tp-sep">:</div>
          <select id="alarm-min">${['00','10','15','20','30','40','45','50'].map(v=>`<option>${v}</option>`).join('')}</select>
        </div>
      </div>
      <div>
        <div class="drawer-section-label">반복 요일</div>
        <div class="day-picker">
          ${dayNames.map((d,i) => `<div class="day-btn ${selectedDays.includes(i)?'on':''}" data-day="${i}" onclick="this.classList.toggle('on')">${d}</div>`).join('')}
        </div>
      </div>
      <div>
        <div class="drawer-section-label">알람 이름</div>
        <input class="label-input" id="alarm-label-input" placeholder="예: 저녁 일기 작성" />
      </div>
      <button class="btn-primary" onclick="Settings.saveAlarm()">저장하기</button>
    `);
  }

  function saveAlarm() {
    const ampm = document.getElementById('alarm-ampm')?.value;
    let h = parseInt(document.getElementById('alarm-hour')?.value || '9');
    const m = document.getElementById('alarm-min')?.value || '00';
    if (ampm === '오후' && h < 12) h += 12;
    if (ampm === '오전' && h === 12) h = 0;
    const time = `${String(h).padStart(2,'0')}:${m}`;
    const label = document.getElementById('alarm-label-input')?.value || '알람';
    const days = [...document.querySelectorAll('.day-btn.on')].map(b => parseInt(b.dataset.day));
    Store.Alarms.add({ time, label, days, enabled: true });
    Notifications.scheduleAll();
    Drawer.close();
    renderAlarms();
  }

  function toggleAlarm(id) {
    Store.Alarms.toggle(id);
    Notifications.scheduleAll();
    renderAlarms();
  }
  function deleteAlarm(id) {
    Store.Alarms.remove(id);
    renderAlarms();
  }

  function openQuestionDrawer() {
    const suggestions = [
      '오늘 감사한 일이 있었나요?',
      '경제적으로 신경 쓰이는 게 있나요?',
      '몸 상태는 어땠나요?',
      '오늘 스스로 칭찬하고 싶은 게 있나요?',
    ];
    Drawer.open('질문 추가', `
      <div>
        <div class="drawer-section-label">새 질문 입력</div>
        <textarea class="label-input" id="new-question" style="height:80px;resize:none" placeholder="예: 오늘 감사한 일이 있었나요?"></textarea>
      </div>
      <div>
        <div class="drawer-section-label">추천 질문</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${suggestions.map(s => `<div style="background:#f5f5f5;border-radius:10px;padding:10px 12px;font-size:13px;cursor:pointer" onclick="document.getElementById('new-question').value='${s}'">${s}</div>`).join('')}
        </div>
      </div>
      <button class="btn-primary" onclick="Settings.saveQuestion()">질문 추가하기</button>
    `);
  }

  function saveQuestion() {
    const text = document.getElementById('new-question')?.value?.trim();
    if (!text) return;
    Store.Questions.add(text);
    Drawer.close();
    renderQuestions();
  }

  function deleteQuestion(id) {
    if (!confirm('이 질문을 삭제할까요?')) return;
    Store.Questions.remove(id);
    renderQuestions();
  }

  function setMode(mode, el) {
    Store.Settings.set('mode', mode);
    document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
  }

  function toggleDark() {
    const s = Store.Settings.get();
    Store.Settings.set('dark', !s.dark);
    document.body.classList.toggle('dark');
    document.getElementById('toggle-dark').classList.toggle('on');
  }

  function toggleWeather() {
    const s = Store.Settings.get();
    const next = !s.weatherEnabled;
    Store.Settings.set('weatherEnabled', next);
    document.getElementById('toggle-weather').classList.toggle('on');
    if (next) Weather.load();
  }

  function editProfile() {
    const name = prompt('일기장 이름을 입력하세요:', Store.Settings.get().username);
    if (name) {
      Store.Settings.set('username', name);
      document.getElementById('set-username').textContent = name;
    }
  }

  function exportData() {
    const data = { entries: Store.Entries.getAll(), todos: Store.Todos.getAll(), settings: Store.Settings.get() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `diary_backup_${Store.today()}.json`; a.click();
  }

  function clearData() {
    if (!confirm('모든 데이터를 삭제할까요? 이 작업은 복구가 불가능해요.')) return;
    if (!confirm('정말 삭제하시겠어요?')) return;
    localStorage.clear(); location.reload();
  }

  return { render, openAlarmDrawer, saveAlarm, toggleAlarm, deleteAlarm, openQuestionDrawer, saveQuestion, deleteQuestion, setMode, toggleDark, toggleWeather, editProfile, exportData, clearData };
})();

/* ── drawer.js ── */
const Drawer = (() => {
  function open(title, bodyHtml) {
    document.getElementById('drawer-title').textContent = title;
    document.getElementById('drawer-body').innerHTML = bodyHtml;
    document.getElementById('drawer-overlay').classList.add('show');
  }

  function close() {
    document.getElementById('drawer-overlay').classList.remove('show');
  }

  function showEntry(dateStr) {
    const entry = Store.Entries.getByDate(dateStr);
    if (!entry) return;
    const d = new Date(dateStr);
    const days = ['일','월','화','수','목','금','토'];
    open(`${d.getMonth()+1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`, `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
        <div style="font-size:32px">${entry.mood || '📖'}</div>
        <div>
          <div class="diary-drawer-date">${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일</div>
          <div class="diary-drawer-info">${days[d.getDay()]}요일</div>
        </div>
      </div>
      <div class="tag-wrap">${(entry.tags||[]).map(t => `<span class="tag tag-g">${escapeHtml(t)}</span>`).join('')}</div>
      <div class="card">
        <div style="font-size:11px;font-weight:600;color:#888;margin-bottom:8px">오늘의 일기</div>
        <div class="diary-text">${escapeHtml(entry.diary || entry.summary || '')}</div>
      </div>
      ${entry.health ? `
      <div>
        <div class="drawer-section-label">건강 데이터</div>
        <div class="health-mini">
          <div class="health-chip"><div class="hc-label">수면 점수</div><div class="sc-val" style="color:#534AB7;font-size:17px;font-weight:600">${entry.health.sleep||'--'}</div></div>
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
    const s = Store.Settings.get();
    if (!s.weatherEnabled) return;

    navigator.geolocation?.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lon } = pos.coords;
      const data = await API.getWeather(lat, lon);
      if (!data) return;

      const setWeather = (id, descId, temp, desc) => {
        const el = document.getElementById(id);
        if (el) el.textContent = `${temp}°C`;
        const del = document.getElementById(descId);
        if (del) del.textContent = desc;
      };

      if (data.am) setWeather('w-am', 'w-am-desc', data.am.temp, data.am.desc);
      if (data.pm) setWeather('w-pm', 'w-pm-desc', data.pm.temp, data.pm.desc);

      const rain = document.getElementById('rain-alert');
      const rainMsg = document.getElementById('rain-msg');
      if (rain && rainMsg && data.hasRain) {
        rainMsg.textContent = `${data.rainTime}경 비 예보가 있어요. 외출 시 우산을 꼭 챙기세요.`;
        rain.style.display = 'flex';
      }

      Store.Settings.save({ location: `위치 감지됨 (${lat.toFixed(1)}, ${lon.toFixed(1)})` });
    }, () => console.log('위치 접근 거부됨'));
  }

  return { load };
})();

/* ── notifications.js ── */
const Notifications = (() => {
  function requestPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  function scheduleAll() {
    if (!('serviceWorker' in navigator)) return;
    const alarms = Store.Alarms.getAll().filter(a => a.enabled);
    // Service Worker에 알람 정보 전달 (실제 구현 시 SW 등록 필요)
    navigator.serviceWorker.ready.then(sw => {
      sw.active?.postMessage({ type: 'SCHEDULE_ALARMS', alarms });
    }).catch(() => {});
    // 브라우저 알림 fallback (탭이 열려 있을 때만 동작)
    alarms.forEach(alarm => {
      const [h, m] = alarm.time.split(':').map(Number);
      const now = new Date();
      const target = new Date(now);
      target.setHours(h, m, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      const ms = target - now;
      if (ms < 24 * 60 * 60 * 1000) {
        setTimeout(() => {
          if (Notification.permission === 'granted') {
            new Notification('나의 일기장 ✍️', { body: alarm.label, icon: '/icon-192.png' });
          }
        }, ms);
      }
    });
  }

  return { requestPermission, scheduleAll };
})();
