/* ── store.js: 로컬스토리지 기반 데이터 관리 ── */
const Store = (() => {

  const KEYS = {
    ENTRIES: 'diary_entries',
    TODOS: 'diary_todos',
    SETTINGS: 'diary_settings',
    ALARMS: 'diary_alarms',
    QUESTIONS: 'diary_questions',
    HEALTH: 'diary_health',
    STREAK: 'diary_streak',
  };

  function get(key) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch { return null; }
  }

  function set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  // ── 일기 항목 ──
  const Entries = {
    getAll() { return get(KEYS.ENTRIES) || {}; },
    getByDate(dateStr) { return this.getAll()[dateStr] || null; },
    save(dateStr, entry) {
      const all = this.getAll();
      all[dateStr] = { ...entry, date: dateStr, updatedAt: Date.now() };
      set(KEYS.ENTRIES, all);
      Streak.recalc();
    },
    getRecent(n = 5) {
      const all = this.getAll();
      return Object.values(all)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, n);
    },
    getByMonth(year, month) {
      const prefix = `${year}-${String(month).padStart(2,'0')}`;
      const all = this.getAll();
      return Object.entries(all)
        .filter(([k]) => k.startsWith(prefix))
        .map(([, v]) => v);
    },
    getByWeek(year, week) {
      const all = this.getAll();
      const start = getWeekStart(year, week);
      const end = new Date(start); end.setDate(end.getDate() + 6);
      return Object.values(all).filter(e => {
        const d = new Date(e.date);
        return d >= start && d <= end;
      });
    },
  };

  // ── 할 일 ──
  const Todos = {
    getAll() { return get(KEYS.TODOS) || []; },
    save(todos) { set(KEYS.TODOS, todos); },
    add(text) {
      const todos = this.getAll();
      todos.push({ id: Date.now(), text, done: false, createdAt: Date.now() });
      this.save(todos);
      return todos;
    },
    toggle(id) {
      const todos = this.getAll().map(t => t.id === id ? { ...t, done: !t.done } : t);
      this.save(todos); return todos;
    },
    remove(id) {
      const todos = this.getAll().filter(t => t.id !== id);
      this.save(todos); return todos;
    },
  };

  // ── 설정 ──
  const Settings = {
    defaults: {
      mode: 'question',
      dark: false,
      weatherEnabled: false,
      username: '내 일기장',
      aiFeedbackStyle: 'warm',
    },
    get() { return { ...this.defaults, ...(get(KEYS.SETTINGS) || {}) }; },
    set(key, value) {
      const s = this.get(); s[key] = value; set(KEYS.SETTINGS, s);
    },
    save(obj) { set(KEYS.SETTINGS, { ...this.get(), ...obj }); },
  };

  // ── 알람 ──
  const Alarms = {
    defaults: [
      { id: 1, time: '21:00', label: '저녁 일기 알람', days: [0,1,2,3,4,5,6], enabled: true },
      { id: 2, time: '07:30', label: '아침 점검 알람', days: [1,2,3,4,5], enabled: true },
    ],
    getAll() { return get(KEYS.ALARMS) || this.defaults; },
    save(alarms) { set(KEYS.ALARMS, alarms); },
    add(alarm) {
      const all = this.getAll();
      alarm.id = Date.now();
      all.push(alarm);
      this.save(all); return all;
    },
    remove(id) {
      const all = this.getAll().filter(a => a.id !== id);
      this.save(all); return all;
    },
    toggle(id) {
      const all = this.getAll().map(a => a.id === id ? { ...a, enabled: !a.enabled } : a);
      this.save(all); return all;
    },
  };

  // ── 질문 ──
  const Questions = {
    defaults: [
      { id: 1, text: '오늘 하루 전반적으로 어떠셨나요?' },
      { id: 2, text: '오늘 특별히 기억에 남는 순간이 있었나요?' },
      { id: 3, text: '업무나 커리어와 관련해 떠오르는 게 있나요?' },
      { id: 4, text: '아이 또는 가족과 있었던 일이 있나요?' },
      { id: 5, text: '내일 하고 싶거나 해야 할 일이 있나요?' },
    ],
    getAll() { return get(KEYS.QUESTIONS) || this.defaults; },
    save(qs) { set(KEYS.QUESTIONS, qs); },
    add(text) {
      const qs = this.getAll();
      qs.push({ id: Date.now(), text });
      this.save(qs); return qs;
    },
    remove(id) {
      const qs = this.getAll().filter(q => q.id !== id);
      this.save(qs); return qs;
    },
  };

  // ── 건강 데이터 ──
  const Health = {
    getByDate(dateStr) { return (get(KEYS.HEALTH) || {})[dateStr] || null; },
    save(dateStr, data) {
      const all = get(KEYS.HEALTH) || {};
      all[dateStr] = data;
      set(KEYS.HEALTH, all);
    },
  };

  // ── 스트릭 ──
  const Streak = {
    get() { return get(KEYS.STREAK) || { current: 0, longest: 0, lastDate: null }; },
    recalc() {
      const entries = Entries.getAll();
      const dates = Object.keys(entries).sort();
      if (!dates.length) { set(KEYS.STREAK, { current: 0, longest: 0, lastDate: null }); return; }
      let current = 1, longest = 1, prev = new Date(dates[0]);
      for (let i = 1; i < dates.length; i++) {
        const curr = new Date(dates[i]);
        const diff = (curr - prev) / 86400000;
        if (diff === 1) { current++; longest = Math.max(longest, current); }
        else if (diff > 1) { current = 1; }
        prev = curr;
      }
      const today = new Date().toISOString().split('T')[0];
      const lastDate = dates[dates.length - 1];
      const daysSinceLast = (new Date(today) - new Date(lastDate)) / 86400000;
      if (daysSinceLast > 1) current = 0;
      set(KEYS.STREAK, { current, longest, lastDate });
    },
  };

  // ── 날짜 유틸 ──
  function today() { return new Date().toISOString().split('T')[0]; }
  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return `${d.getMonth()+1}월 ${d.getDate()}일`;
  }
  function getWeekStart(year, week) {
    const d = new Date(year, 0, 1);
    const dayOfWeek = d.getDay();
    d.setDate(d.getDate() - dayOfWeek + (week - 1) * 7);
    return d;
  }
  function getWeekNumber(d) {
    const date = new Date(d);
    date.setHours(0,0,0,0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  }

  return { Entries, Todos, Settings, Alarms, Questions, Health, Streak, today, formatDate, getWeekNumber };
})();
