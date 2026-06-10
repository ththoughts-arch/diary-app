/* ── app.js: 앱 초기화 및 화면 전환 ── */
const App = (() => {

  const SCREENS = ['home', 'record', 'report', 'calendar', 'settings'];
  let current = 'home';

  function go(name) {
    if (!SCREENS.includes(name)) return;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${name}`).classList.add('active');
    current = name;
    onEnter(name);
  }

  function onEnter(name) {
    if (name === 'home') Home.render();
    if (name === 'record') Record.init();
    if (name === 'report') Report.render();
    if (name === 'calendar') Calendar.render();
    if (name === 'settings') Settings.render();
  }

  async function init() {
    // 날짜/인사말
    const now = new Date();
    const h = now.getHours();
    const greeting = h < 12 ? '좋은 아침이에요 ☀️' : h < 18 ? '좋은 오후예요 🌤' : '좋은 저녁이에요 🌙';
    const greetEl = document.getElementById('home-greeting');
    if (greetEl) greetEl.textContent = greeting;

    const days = ['일','월','화','수','목','금','토'];
    const dateEl = document.getElementById('home-date');
    if (dateEl) dateEl.textContent = `${now.getFullYear()}년 ${now.getMonth()+1}월 ${now.getDate()}일 ${days[now.getDay()]}요일`;

    // 다크모드
    const settings = await Store.Settings.get();
    if (settings.dark) document.body.classList.add('dark');

    // 홈 렌더
    Home.render();

    // 알림
    Notifications.requestPermission();
    Notifications.scheduleAll();

    // 날씨
    Weather.load();
  }

  return { go, init, current: () => current };
})();

/* ── Home ── */
const Home = (() => {

  async function render() {
    renderStreak();
    renderTodos();
    renderRecent();
    renderTags();
    renderHealth();
  }

  async function renderStreak() {
    const entries = await Store.Entries.getAll();
    Store.Streak.recalc(entries);
    const s = Store.Streak.get();
    const el = document.getElementById('home-streak');
    if (el) el.textContent = `${s.current}일째`;
  }

  async function renderTodos() {
    const todos = await Store.Todos.getAll();
    const list = document.getElementById('todo-list');
    if (!list) return;
    if (!todos.length) {
      list.innerHTML = '<li style="text-align:center;padding:12px;color:#bbb;font-size:13px">오늘 할 일이 없어요 ✓</li>';
      return;
    }
    list.innerHTML = todos.map(t => `
      <li class="todo-item">
        <div class="todo-check ${t.done ? 'done' : ''}" onclick="Todo.toggle(${t.id})"></div>
        <span class="todo-text ${t.done ? 'done' : ''}">${escapeHtml(t.text)}</span>
        <button class="todo-del" onclick="Todo.remove(${t.id})">✕</button>
      </li>
    `).join('');
  }

  async function renderRecent() {
    const el = document.getElementById('recent-entries');
    if (!el) return;
    const entries = await Store.Entries.getRecent(4);
    if (!entries.length) {
      el.innerHTML = '<div style="text-align:center;padding:16px;color:#bbb;font-size:13px">아직 기록이 없어요.<br>오늘 첫 일기를 써보세요! 📖</div>';
      return;
    }
    el.innerHTML = entries.map(e => `
      <div class="entry-row" onclick="Drawer.showEntry('${e.date}')">
        <div class="entry-dot" style="background:#EEEDFE">📖</div>
        <div class="entry-meta">
          <div class="entry-title">${escapeHtml(e.summary || e.diary?.slice(0,30) || '오늘의 일기')}</div>
          <div class="entry-preview">${escapeHtml(e.preview || '')}</div>
        </div>
        <div class="entry-date">${formatRelative(e.date)}</div>
      </div>`).join('');
  }

  async function renderTags() {
    const el = document.getElementById('home-tags');
    if (!el) return;
    const entries = await Store.Entries.getRecent(7);
    const tagMap = {};
    entries.forEach(e => (e.tags || []).forEach(t => { tagMap[t] = (tagMap[t] || 0) + 1; }));
    const tags = Object.entries(tagMap).sort((a,b) => b[1]-a[1]).slice(0,8).map(([t]) => t);
    const colors = ['tag-p','tag-g','tag-a','tag-g','tag-p','tag-a','tag-c','tag-g'];
    el.innerHTML = tags.map((t,i) => `<span class="tag ${colors[i%colors.length]}">${escapeHtml(t)}</span>`).join('');
  }

  async function renderHealth() {
    const today = Store.today();
    const health = await Store.Health.getByDate(today);
    if (!health) return;
    const setVal = (id, v, subId, sub) => {
      const el = document.getElementById(id); if (el) el.textContent = v || '--';
      if (subId) { const s = document.getElementById(subId); if(s) s.textContent = sub || '--'; }
    };
    setVal('h-sleep', health.sleep, 'h-sleep-sub', health.sleepHours || '--');
    setVal('h-stress', health.stress, 'h-stress-sub', health.stressLabel || '--');
    setVal('h-run', health.pace, 'h-run-sub', health.runDetails || '--');
    setVal('h-kcal', health.calories);
    const recEl = document.getElementById('ai-health-rec');
    if (recEl && health.aiRec) {
      document.getElementById('ahr-text').textContent = health.aiRec;
      recEl.style.display = 'block';
    }
  }

  function formatRelative(dateStr) {
    const today = Store.today();
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
    const yStr = yesterday.toISOString().split('T')[0];
    if (dateStr === today) return '오늘';
    if (dateStr === yStr) return '어제';
    const d = new Date(dateStr);
    return `${d.getMonth()+1}/${d.getDate()}`;
  }

  return { render, renderTodos };
})();

// 공용 유틸
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
