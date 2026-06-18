/* ====================================================
   app.js — 앱 코어: 초기화 · 화면전환 · 홈 · Todo · Drawer
   ==================================================== */

/* ── 공용 유틸 ── */
const $ = id => document.getElementById(id);
const esc = s => s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : '';
const relDate = d => {
  const t = Store.today();
  const y = new Date(); y.setDate(y.getDate()-1);
  if (d===t) return '오늘';
  if (d===y.toISOString().split('T')[0]) return '어제';
  const dt = new Date(d); return `${dt.getMonth()+1}/${dt.getDate()}`;
};

/* ====================================================
   App
   ==================================================== */
const App = (() => {
  const SCREENS = ['home','record','report','calendar','settings'];
  const HANDLERS = {
    home:     () => Home.render(),
    record:   () => Record.init(),
    report:   () => Report.render(),
    calendar: () => Calendar.render(),
    settings: () => Settings.render(),
  };

  function go(name) {
    if (!SCREENS.includes(name)) return;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(`screen-${name}`).classList.add('active');
    history.replaceState(null, '', `#${name}`);
    HANDLERS[name]?.();
  }

  async function init() {
    // 인사말
    const h = new Date().getHours();
    const el = $('home-greeting');
    if (el) el.textContent = h<12 ? '좋은 아침이에요 ☀️' : h<18 ? '좋은 오후예요 🌤' : '좋은 저녁이에요 🌙';
    // 날짜
    const de = $('home-date');
    if (de) {
      const n = new Date(), days = ['일','월','화','수','목','금','토'];
      de.textContent = `${n.getFullYear()}년 ${n.getMonth()+1}월 ${n.getDate()}일 ${days[n.getDay()]}요일`;
    }
    // 다크모드 (DB값 기준)
    const s = await Store.Settings.get();
    document.body.classList.toggle('dark', !!s.dark);
    // 날씨
    Weather.load();
    // 알람
    Notifications.requestPermission();
    Notifications.scheduleAll();
    // 새로고침 시 현재 페이지 복원
    const hash = location.hash.replace('#','');
    go(SCREENS.includes(hash) ? hash : 'home');
  }

  return { go, init };
})();

/* ====================================================
   Home
   ==================================================== */
const Home = (() => {

  async function render() {
    await Promise.all([_streak(), _todos(), _recent(), _tags(), _health()]);
  }

  async function _streak() {
    const all = await Store.Entries.getAll();
    Store.Streak.recalc(all);
    const el = $('home-streak');
    if (el) el.textContent = `${Store.Streak.get().current}일째`;
  }

  async function renderTodos() {
    const todos = await Store.Todos.getAll();
    const list = $('todo-list');
    if (!list) return;
    list.innerHTML = todos.length
      ? todos.map(t => `
          <li class="todo-item">
            <div class="todo-check ${t.done?'done':''}" onclick="Todo.toggle(${t.id})"></div>
            <span class="todo-text ${t.done?'done':''}">${esc(t.text)}</span>
            <button class="todo-del" onclick="Todo.remove(${t.id})">✕</button>
          </li>`).join('')
      : '<li style="text-align:center;padding:12px;color:#bbb;font-size:13px">오늘 할 일이 없어요 ✓</li>';
  }
  const _todos = renderTodos;

  async function _recent() {
    const el = $('recent-entries');
    if (!el) return;
    const entries = await Store.Entries.getRecent(4);
    el.innerHTML = entries.length
      ? entries.map(e => `
          <div class="entry-row" onclick="Drawer.showEntry('${e.date}')">
            <div class="entry-dot" style="background:#EEEDFE">📖</div>
            <div class="entry-meta">
              <div class="entry-title">${esc(e.summary||e.diary?.slice(0,30)||'오늘의 일기')}</div>
              <div class="entry-preview">${e.date}</div>
            </div>
            <div class="entry-date">${relDate(e.date)}</div>
          </div>`).join('')
      : '<div style="text-align:center;padding:16px;color:#bbb;font-size:13px">아직 기록이 없어요.<br>오늘 첫 일기를 써보세요! 📖</div>';
  }

  async function _tags() {
    const el = $('home-tags');
    if (!el) return;
    const entries = await Store.Entries.getRecent(7);
    const map = {};
    entries.forEach(e => (e.tags||[]).forEach(t => { map[t]=(map[t]||0)+1; }));
    const tags = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([t])=>t);
    const cls = ['tag-p','tag-g','tag-a','tag-g','tag-p','tag-a','tag-c','tag-g'];
    el.innerHTML = tags.map((t,i)=>`<span class="tag ${cls[i%cls.length]}">${esc(t)}</span>`).join('');
  }

  async function _health() {
    const h = await Store.Health.getByDate(Store.today());
    if (!h) return;
    const sv = (id,v,sid,s) => { const e=$(id);if(e)e.textContent=v||'--'; const se=$(sid);if(se&&s!==undefined)se.textContent=s||'--'; };
    sv('h-sleep',h.sleep,'h-sleep-sub',h.sleepHours);
    sv('h-stress',h.stress,'h-stress-sub');
    sv('h-run',h.pace,'h-run-sub',h.duration);
    sv('h-kcal',h.calories);
  }

  return { render, renderTodos };
})();

/* ====================================================
   Todo
   ==================================================== */
const Todo = (() => {
  const refresh = () => Home.renderTodos();
  async function add() {
    const inp = $('todo-input'); const text = inp?.value?.trim();
    if (!text) return;
    await Store.Todos.add(text); inp.value=''; await refresh();
  }
  async function toggle(id) { await Store.Todos.toggle(id); await refresh(); }
  async function remove(id) { await Store.Todos.remove(id); await refresh(); }
  return { add, toggle, remove };
})();

/* ====================================================
   Drawer
   ==================================================== */
const Drawer = (() => {
  const open = (title, html) => {
    $('drawer-title').textContent = title;
    $('drawer-body').innerHTML = html;
    $('drawer-overlay').classList.add('show');
  };
  const close = () => $('drawer-overlay').classList.remove('show');

  async function showEntry(dateStr) {
    const e = await Store.Entries.getByDate(dateStr);
    if (!e) return;
    const d = new Date(dateStr);
    const days=['일','월','화','수','목','금','토'];
    open(`${d.getMonth()+1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`, `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div style="font-size:36px">${e.mood||'📖'}</div>
        <div>
          <div style="font-size:18px;font-weight:700;color:#222">${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일</div>
          <div style="font-size:12px;color:#999">${days[d.getDay()]}요일</div>
        </div>
      </div>
      <div class="tag-wrap" style="margin-bottom:10px">${(e.tags||[]).map(t=>`<span class="tag tag-g">${esc(t)}</span>`).join('')}</div>
      <div class="card">
        <div class="drawer-label">오늘의 일기</div>
        <div style="font-size:14px;color:#222;line-height:1.8">${esc(e.diary||e.summary||'')}</div>
      </div>
      ${e.categorized && Object.keys(e.categorized).length ? `
      <div>
        <div class="drawer-label">📂 카테고리별 원본 기록</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${Object.entries(e.categorized).map(([cid, items]) => {
            const cat = QuestionPool.getCategoryInfo(cid);
            return `<div class="cat-card">
              <div class="cat-badge" style="color:${cat.color};background:${cat.bg}">${cat.label}</div>
              ${items.map(i => `
                <div style="margin-bottom:7px">
                  <div class="cat-q">${esc(i.question)}</div>
                  <div class="cat-a">${esc(i.answer)}</div>
                </div>`).join('')}
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}
      ${e.health?`
      <div>
        <div class="drawer-label">건강 데이터</div>
        <div class="health-mini">
          <div class="health-chip"><div class="hc-label2">수면점수</div><div class="sc-val" style="color:#534AB7;font-size:17px">${e.health.sleep||'--'}</div></div>
          <div class="health-chip"><div class="hc-label2">스트레스</div><div class="sc-val" style="color:#D85A30;font-size:17px">${e.health.stress||'--'}</div></div>
          <div class="health-chip"><div class="hc-label2">러닝</div><div class="sc-val" style="color:#085041;font-size:13px">${e.health.pace||'--'}</div></div>
        </div>
      </div>`:''}
    `);
  }

  return { open, close, showEntry };
})();
