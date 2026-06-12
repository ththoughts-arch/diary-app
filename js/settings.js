/* ====================================================
   calendar.js — 캘린더 화면
   ==================================================== */
const Calendar = (() => {
  let year  = new Date().getFullYear();
  let month = new Date().getMonth() + 1;

  async function render() {
    _header(); await _grid(); await _stats(); await _list();
  }

  function _header() {
    const el = $('cal-title'); if(el) el.textContent=`${year}년 ${month}월`;
  }

  async function _grid() {
    const grid = $('cal-grid'); if (!grid) return;
    const all = await Store.Entries.getAll();
    const today = Store.today();
    const first = new Date(year,month-1,1).getDay();
    const daysInMonth = new Date(year,month,0).getDate();
    let html = '';
    for (let i=0;i<first;i++) html+='<div></div>';
    for (let d=1;d<=daysInMonth;d++) {
      const ds = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const entry = all[ds];
      const isToday = ds===today, isFuture = ds>today;
      html+=`<div class="cal-day${entry?' clickable':''}" ${entry?`onclick="Drawer.showEntry('${ds}')"`:''}">
        <div class="cd-num ${isToday?'today':''}">${d}</div>
        <div class="cd-bar ${entry?'done':isFuture?'':''}"></div>
        <div class="cd-mood">${entry?.mood||''}</div>
      </div>`;
    }
    grid.innerHTML = html;
    const cnt = $('cal-month-count');
    if (cnt) cnt.textContent = `${Object.keys(all).filter(k=>k.startsWith(`${year}-${String(month).padStart(2,'0')}`)).length}일`;
  }

  async function _stats() {
    const el = $('cal-stats'); if (!el) return;
    const entries = await Store.Entries.getByMonth(year,month);
    const moods = entries.map(e=>e.mood).filter(Boolean);
    const top = moods.length ? moods.sort((a,b)=>moods.filter(v=>v===b).length-moods.filter(v=>v===a).length)[0] : '😊';
    const runs = entries.filter(e=>e.health?.pace).length;
    el.innerHTML = `
      <div class="stat-chip"><div class="sc-label">기록 완료</div><div class="sc-val" style="color:#2AADA3">${entries.length}일</div></div>
      <div class="stat-chip"><div class="sc-label">평균 기분</div><div class="sc-val">${top}</div></div>
      <div class="stat-chip"><div class="sc-label">러닝</div><div class="sc-val" style="color:#085041">${runs}회</div></div>`;
  }

  async function _list() {
    const el = $('cal-entry-list'); if (!el) return;
    const entries = (await Store.Entries.getByMonth(year,month)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
    if (!entries.length) { el.innerHTML='<div style="text-align:center;padding:20px;color:#bbb;font-size:13px">이번 달 기록이 없어요</div>'; return; }
    const days=['일','월','화','수','목','금','토'];
    el.innerHTML = entries.map(e=>{
      const d=new Date(e.date);
      return `<div class="entry-row" onclick="Drawer.showEntry('${e.date}')">
        <div class="entry-dot" style="background:linear-gradient(135deg,#3DCFC4,#B5E857);flex-direction:column;gap:0">
          <span style="font-size:15px;font-weight:700;color:white">${d.getDate()}</span>
          <span style="font-size:9px;color:rgba(255,255,255,0.8)">${days[d.getDay()]}</span>
        </div>
        <div class="entry-meta">
          <div class="entry-title">${esc(e.summary||e.diary?.slice(0,30)||'오늘의 일기')}</div>
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

/* ====================================================
   Settings — 설정 화면
   ==================================================== */
const Settings = (() => {

  async function render() {
    const s = await Store.Settings.get();
    const streak = Store.Streak.get();

    // 프로필
    const nm=$('set-username'); if(nm)nm.textContent=s.username||'내 일기장';
    const si=$('set-streak-info'); if(si)si.textContent=`연속 ${streak.current}일째 🔥`;

    // 토글 동기화 (DB값 기준 — 오작동 방지)
    const isDark = document.body.classList.contains('dark');
    const tw=$('toggle-dark'); if(tw)tw.classList.toggle('on',isDark);
    const wt=$('toggle-weather'); if(wt)wt.classList.toggle('on',!!s.weatherEnabled);

    // 위치 라벨
    const loc=$('location-label'); if(loc)loc.textContent=s.location||'탭해서 위치 설정';

    // API 키 상태
    const ak=$('api-key-label'); if(ak)ak.textContent=localStorage.getItem('diary_api_key')?'키 설정 완료 ✓':'탭해서 키 입력';

    // 피드백 스타일 라벨
    const fbLabels={warm:'따뜻하고 공감적으로',coach:'코치처럼 동기부여',analytical:'분석적이고 객관적으로',friend:'친구처럼 편하게',mentor:'멘토처럼 깊이있게'};
    const fbl=$('feedback-style-label'); if(fbl)fbl.textContent=fbLabels[s.aiFeedbackStyle||'warm'];

    await renderAlarms();
    await renderQuestions();
  }

  async function renderAlarms() {
    const el=$('alarm-list'); if(!el)return;
    const alarms=await Store.Alarms.getAll();
    const dayNames=['일','월','화','수','목','금','토'];
    el.innerHTML=alarms.length
      ?alarms.map(a=>`
        <div class="alarm-item">
          <div class="alarm-time">${a.time}</div>
          <div class="alarm-meta">
            <div class="alarm-label">${esc(a.label)}</div>
            <div class="alarm-days">${a.days.length===7?'매일':a.days.map(d=>dayNames[d]).join(', ')}</div>
          </div>
          <div class="toggle ${a.enabled?'on':''}" onclick="Settings.toggleAlarm(${a.id})"><div class="toggle-knob"></div></div>
          <button class="alarm-del" onclick="Settings.deleteAlarm(${a.id})">✕</button>
        </div>`).join('')
      :'<div style="padding:14px;text-align:center;color:#bbb;font-size:13px">등록된 알람이 없어요</div>';
  }

  async function renderQuestions() {
    const el=$('question-list'); if(!el)return;
    const qs=await Store.Questions.getAll();
    el.innerHTML=qs.map(q=>`
      <div class="q-item">
        <span class="q-handle">⠿</span>
        <span class="q-text">${esc(q.text)}</span>
        <button class="q-edit-btn" onclick="Settings.deleteQuestion(${q.id})">✕</button>
      </div>`).join('');
  }

  /* ── 알람 ── */
  function openAlarmDrawer() {
    const dayNames=['일','월','화','수','목','금','토'];
    Drawer.open('알람 추가', `
      <div>
        <div class="drawer-label">시간 설정</div>
        <div class="time-picker">
          <select id="alarm-ampm"><option>오전</option><option selected>오후</option></select>
          <select id="alarm-hour">${[...Array(12)].map((_,i)=>`<option ${i===8?'selected':''}>${String(i+1).padStart(2,'0')}</option>`).join('')}</select>
          <div class="tp-sep">:</div>
          <select id="alarm-min">${['00','10','15','20','30','40','45','50'].map(v=>`<option>${v}</option>`).join('')}</select>
        </div>
      </div>
      <div>
        <div class="drawer-label">반복 요일</div>
        <div class="day-picker">${dayNames.map((d,i)=>`<button class="day-btn on" data-day="${i}" onclick="this.classList.toggle('on')">${d}</button>`).join('')}</div>
      </div>
      <div>
        <div class="drawer-label">알람 이름</div>
        <input class="label-input" id="alarm-label-input" placeholder="예: 저녁 일기 작성" value="저녁 일기 알람">
      </div>
      <button class="btn-primary" onclick="Settings.saveAlarm()">저장하기</button>`);
  }

  async function saveAlarm() {
    const ampm=$('alarm-ampm')?.value;
    let h=parseInt($('alarm-hour')?.value||'9');
    const m=$('alarm-min')?.value||'00';
    if(ampm==='오후'&&h<12)h+=12; if(ampm==='오전'&&h===12)h=0;
    const time=`${String(h).padStart(2,'0')}:${m}`;
    const label=$('alarm-label-input')?.value||'일기 알람';
    const days=[...$('drawer-body').querySelectorAll('.day-btn.on')].map(b=>parseInt(b.dataset.day));
    if(!days.length){alert('요일을 하나 이상 선택해주세요.');return;}
    await Store.Alarms.add({time,label,days,enabled:true});
    Notifications.scheduleAll();
    Drawer.close();
    await renderAlarms();
  }

  async function toggleAlarm(id) { await Store.Alarms.toggle(id); Notifications.scheduleAll(); await renderAlarms(); }
  async function deleteAlarm(id) { if(!confirm('이 알람을 삭제할까요?'))return; await Store.Alarms.remove(id); await renderAlarms(); }

  /* ── 질문 ── */
  function openQuestionDrawer() {
    const suggestions=['오늘 감사한 일이 있었나요?','경제적으로 신경 쓰이는 게 있나요?','오늘 스스로 칭찬하고 싶은 게 있나요?','요즘 마음에 걸리는 게 있나요?'];
    Drawer.open('질문 추가', `
      <div>
        <div class="drawer-label">새 질문 입력</div>
        <textarea class="label-input" id="new-question" style="height:80px;resize:none" placeholder="예: 오늘 감사한 일이 있었나요?"></textarea>
      </div>
      <div>
        <div class="drawer-label">추천 질문</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${suggestions.map(s=>`<div style="background:#f5f5f5;border-radius:10px;padding:10px 12px;font-size:13px;cursor:pointer;color:#222" onclick="document.getElementById('new-question').value='${s}'">${s}</div>`).join('')}
        </div>
      </div>
      <button class="btn-primary" onclick="Settings.saveQuestion()">질문 추가하기</button>`);
  }

  async function saveQuestion() { const t=$('new-question')?.value?.trim(); if(!t)return; await Store.Questions.add(t); Drawer.close(); await renderQuestions(); }
  async function deleteQuestion(id) { if(!confirm('이 질문을 삭제할까요?'))return; await Store.Questions.remove(id); await renderQuestions(); }

  /* ── 앱 설정 ── */
  async function toggleDark() {
    const isDark = document.body.classList.contains('dark');
    document.body.classList.toggle('dark', !isDark);
    $('toggle-dark').classList.toggle('on', !isDark);
    await Store.Settings.set('dark', !isDark);
  }

  async function toggleWeather() {
    const s = await Store.Settings.get();
    const next = !s.weatherEnabled;
    await Store.Settings.set('weatherEnabled', next);
    $('toggle-weather').classList.toggle('on', next);
    const loc=$('location-label');
    if (next) { if(loc)loc.textContent='위치 가져오는 중...'; Weather.load(); }
    else { if(loc)loc.textContent='탭해서 위치 설정'; }
  }

  async function editProfile() {
    const s=await Store.Settings.get();
    const name=prompt('일기장 이름을 입력하세요:', s.username);
    if(name){await Store.Settings.set('username',name); const el=$('set-username');if(el)el.textContent=name;}
  }

  /* ── Claude API 키 ── */
  function openApiKeyDrawer() {
    const cur=localStorage.getItem('diary_api_key')||'';
    Drawer.open('Claude API 키 설정', `
      <div style="font-size:13px;color:#888;line-height:1.6">
        AI 일기 정리, 가민 파싱 기능에 필요해요.<br>
        <a href="https://console.anthropic.com" target="_blank" style="color:#2AADA3">console.anthropic.com</a>에서 무료 발급
      </div>
      <input class="label-input" id="api-key-input" type="password" placeholder="sk-ant-..." value="${cur}" style="font-family:monospace;font-size:13px">
      <button class="btn-primary" onclick="Settings.saveApiKey()">저장하기</button>
      ${cur?`<button onclick="Settings.clearApiKey()" style="width:100%;background:none;border:none;color:#E24B4A;font-size:13px;padding:8px;cursor:pointer;font-family:inherit">키 삭제</button>`:''}
    `);
  }

  function saveApiKey() {
    const key=$('api-key-input')?.value?.trim();
    if(key){localStorage.setItem('diary_api_key',key);API.setKey(key);}
    const el=$('api-key-label');if(el)el.textContent=key?'키 설정 완료 ✓':'탭해서 키 입력';
    Drawer.close();
  }

  function clearApiKey() {
    if(!confirm('API 키를 삭제할까요?'))return;
    localStorage.removeItem('diary_api_key');
    const el=$('api-key-label');if(el)el.textContent='탭해서 키 입력';
    Drawer.close();
  }

  /* ── AI 피드백 스타일 ── */
  function openFeedbackDrawer() {
    const styles=[
      {id:'warm',icon:'🤗',title:'따뜻하고 공감적으로',desc:'감정에 공감하며 부드럽게 피드백해줘요.'},
      {id:'coach',icon:'💪',title:'코치처럼 동기부여',desc:'성취에 집중하며 다음 행동을 제안해줘요.'},
      {id:'analytical',icon:'🔍',title:'분석적이고 객관적으로',desc:'패턴과 데이터를 중심으로 분석해줘요.'},
      {id:'friend',icon:'😊',title:'친구처럼 편하게',desc:'격식 없이 가볍고 친근하게 이야기해줘요.'},
      {id:'mentor',icon:'🌱',title:'멘토처럼 깊이있게',desc:'삶의 방향과 성장을 중심으로 조언해줘요.'},
    ];
    Store.Settings.get().then(s=>{
      const cur=s.aiFeedbackStyle||'warm';
      Drawer.open('AI 피드백 스타일',
        styles.map(st=>`
          <div class="feedback-option ${cur===st.id?'active':''}" onclick="Settings.setFeedbackStyle('${st.id}')">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:24px">${st.icon}</span>
              <div>
                <div style="font-size:14px;font-weight:600;color:${cur===st.id?'#0F6E56':'#222'}">${st.title}</div>
                <div style="font-size:12px;color:#888;margin-top:2px">${st.desc}</div>
              </div>
              ${cur===st.id?'<span style="margin-left:auto;color:#3DCFC4;font-size:18px">✓</span>':''}
            </div>
          </div>`).join('')
      );
    });
  }

  async function setFeedbackStyle(id) {
    await Store.Settings.set('aiFeedbackStyle',id);
    const labels={warm:'따뜻하고 공감적으로',coach:'코치처럼 동기부여',analytical:'분석적이고 객관적으로',friend:'친구처럼 편하게',mentor:'멘토처럼 깊이있게'};
    const el=$('feedback-style-label');if(el)el.textContent=labels[id]||'따뜻하고 공감적으로';
    Drawer.close();
    render();
  }

  /* ── 데이터 내보내기 ── */
  function openExportDrawer() {
    Drawer.open('일기 내보내기',`
      <div style="font-size:13px;color:#888;line-height:1.6;margin-bottom:4px">내보낼 기간을 선택하고 방법을 골라주세요.</div>
      <select id="export-period" style="background:#f5f5f5;border:none;border-radius:10px;padding:10px 12px;font-size:13px;font-family:inherit;color:#222;outline:none;width:100%">
        <option value="week">이번 주</option>
        <option value="month">이번 달</option>
        <option value="all">전체</option>
      </select>
      <button class="btn-primary" onclick="Settings.exportPDF()">📄 PDF로 저장 / 인쇄</button>
      <button style="width:100%;background:#f5f5f5;border:none;border-radius:14px;padding:12px;font-size:14px;font-weight:500;color:#222;font-family:inherit;cursor:pointer" onclick="Settings.exportEmail()">📧 이메일로 보내기</button>
    `);
  }

  async function _getExportEntries() {
    const p=$('export-period')?.value||'all';
    const all=await Store.Entries.getAll();
    const now=new Date();
    const entries=Object.values(all).sort((a,b)=>a.date.localeCompare(b.date));
    if(p==='all')return entries;
    if(p==='month'){const pr=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;return entries.filter(e=>e.date.startsWith(pr));}
    const ws=new Date(now);ws.setDate(now.getDate()-now.getDay()+1);ws.setHours(0,0,0,0);
    return entries.filter(e=>new Date(e.date)>=ws);
  }

  async function exportPDF() {
    const entries=await _getExportEntries();
    if(!entries.length){alert('내보낼 일기가 없어요.');return;}
    const p=$('export-period')?.value||'all';
    const pLabel={week:'이번 주',month:'이번 달',all:'전체'}[p];
    const rows=entries.map(e=>`
      <div style="margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid #eee">
        <div style="font-size:13px;color:#888;margin-bottom:4px">${e.date} ${e.mood||''}</div>
        <div style="font-size:15px;font-weight:600;margin-bottom:8px">${e.summary||''}</div>
        <div style="font-size:14px;color:#333;line-height:1.8">${(e.diary||'').replace(/\n/g,'<br>')}</div>
      </div>`).join('');
    const win=window.open('','_blank');
    if(!win){alert('팝업을 허용해주세요.');return;}
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>나의 일기장 ${pLabel}</title>
      <style>body{font-family:-apple-system,sans-serif;max-width:640px;margin:0 auto;padding:32px 24px}h1{color:#2AADA3}@media print{button{display:none}}</style>
      </head><body><h1>📖 나의 일기장 ${pLabel}</h1>
      <p style="color:#888;margin-bottom:32px">${new Date().toLocaleDateString('ko-KR')} · ${entries.length}개</p>
      ${rows}<script>window.onload=()=>setTimeout(()=>window.print(),300);<\/script></body></html>`);
    win.document.close();
    Drawer.close();
  }

  async function exportEmail() {
    const entries=await _getExportEntries();
    if(!entries.length){alert('내보낼 일기가 없어요.');return;}
    const p=$('export-period')?.value||'all';
    const pLabel={week:'이번 주',month:'이번 달',all:'전체'}[p];
    const text=entries.map(e=>`[${e.date}] ${e.mood||''} ${e.summary||''}\n\n${e.diary||''}`).join('\n\n---\n\n');
    const subject=encodeURIComponent(`나의 일기장 ${pLabel} 내보내기 — ${new Date().toLocaleDateString('ko-KR')}`);
    const body=encodeURIComponent(text.slice(0,1800));
    window.location.href=`mailto:?subject=${subject}&body=${body}`;
    Drawer.close();
  }

  return {
    render, renderAlarms, renderQuestions,
    openAlarmDrawer, saveAlarm, toggleAlarm, deleteAlarm,
    openQuestionDrawer, saveQuestion, deleteQuestion,
    toggleDark, toggleWeather, editProfile,
    openApiKeyDrawer, saveApiKey, clearApiKey,
    openFeedbackDrawer, setFeedbackStyle,
    openExportDrawer, exportPDF, exportEmail,
  };
})();
