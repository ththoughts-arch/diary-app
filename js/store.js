/* ── store.js: Firebase + LocalStorage 하이브리드 저장소 ── */
const Store = (() => {

  // ── 날짜 유틸 ──
  function today() { return new Date().toISOString().split('T')[0]; }
  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return `${d.getMonth()+1}월 ${d.getDate()}일`;
  }
  function getWeekNumber(d) {
    const date = new Date(d);
    date.setHours(0,0,0,0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  }

  // ── 로컬 캐시 (빠른 렌더링용) ──
  const cache = { entries: null, todos: null, settings: null, alarms: null, questions: null, health: {} };

  // ── 일기 항목 ──
  const Entries = {
    async getAll() {
      if (cache.entries) return cache.entries;
      try {
        const data = await FB.getEntries();
        cache.entries = data || {};
        return cache.entries;
      } catch { return {}; }
    },
    async getByDate(dateStr) {
      const all = await this.getAll();
      return all[dateStr] || null;
    },
    async save(dateStr, entry) {
      const data = { ...entry, date: dateStr, updatedAt: Date.now() };
      await FB.saveEntry(dateStr, data);
      if (!cache.entries) cache.entries = {};
      cache.entries[dateStr] = data;
      Streak.recalc(cache.entries);
    },
    async getRecent(n = 5) {
      const all = await this.getAll();
      return Object.values(all)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, n);
    },
    async getByMonth(year, month) {
      const prefix = `${year}-${String(month).padStart(2,'0')}`;
      const all = await this.getAll();
      return Object.values(all).filter(e => e.date.startsWith(prefix));
    },
    clearCache() { cache.entries = null; },
  };

  // ── 할 일 ──
  const Todos = {
    async getAll() {
      if (cache.todos) return cache.todos;
      try {
        const data = await FB.getTodos();
        cache.todos = data || [];
        return cache.todos;
      } catch { return []; }
    },
    async save(todos) {
      cache.todos = todos;
      await FB.saveTodos(todos);
    },
    async add(text) {
      const todos = await this.getAll();
      todos.push({ id: Date.now(), text, done: false, createdAt: Date.now() });
      await this.save(todos);
      return todos;
    },
    async toggle(id) {
      const todos = (await this.getAll()).map(t => t.id === id ? { ...t, done: !t.done } : t);
      await this.save(todos);
      return todos;
    },
    async remove(id) {
      const todos = (await this.getAll()).filter(t => t.id !== id);
      await this.save(todos);
      return todos;
    },
  };

  // ── 설정 ──
  const Settings = {
    defaults: { mode: 'question', dark: false, weatherEnabled: false, username: '내 일기장' },
    async get() {
      if (cache.settings) return cache.settings;
      try {
        const data = await FB.getSettings();
        cache.settings = { ...this.defaults, ...(data || {}) };
        return cache.settings;
      } catch { return this.defaults; }
    },
    async set(key, value) {
      const s = await this.get();
      s[key] = value;
      cache.settings = s;
      await FB.saveSettings(s);
    },
    async save(obj) {
      const s = await this.get();
      const updated = { ...s, ...obj };
      cache.settings = updated;
      await FB.saveSettings(updated);
    },
  };

  // ── 알람 ──
  const Alarms = {
    defaults: [
      { id: 1, time: '21:00', label: '저녁 일기 알람', days: [0,1,2,3,4,5,6], enabled: true },
      { id: 2, time: '07:30', label: '아침 점검 알람', days: [1,2,3,4,5], enabled: true },
    ],
    async getAll() {
      if (cache.alarms) return cache.alarms;
      try {
        const data = await FB.getAlarms();
        cache.alarms = data || this.defaults;
        return cache.alarms;
      } catch { return this.defaults; }
    },
    async save(alarms) {
      cache.alarms = alarms;
      await FB.saveAlarms(alarms);
    },
    async add(alarm) {
      const all = await this.getAll();
      alarm.id = Date.now();
      all.push(alarm);
      await this.save(all);
      return all;
    },
    async remove(id) {
      const all = (await this.getAll()).filter(a => a.id !== id);
      await this.save(all);
      return all;
    },
    async toggle(id) {
      const all = (await this.getAll()).map(a => a.id === id ? { ...a, enabled: !a.enabled } : a);
      await this.save(all);
      return all;
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
    async getAll() {
      if (cache.questions) return cache.questions;
      try {
        const data = await FB.getQuestions();
        cache.questions = data || this.defaults;
        return cache.questions;
      } catch { return this.defaults; }
    },
    async save(qs) {
      cache.questions = qs;
      await FB.saveQuestions(qs);
    },
    async add(text) {
      const qs = await this.getAll();
      qs.push({ id: Date.now(), text });
      await this.save(qs);
      return qs;
    },
    async remove(id) {
      const qs = (await this.getAll()).filter(q => q.id !== id);
      await this.save(qs);
      return qs;
    },
  };

  // ── 건강 데이터 ──
  const Health = {
    async getByDate(dateStr) {
      if (cache.health[dateStr] !== undefined) return cache.health[dateStr];
      try {
        const data = await FB.getHealth(dateStr);
        cache.health[dateStr] = data;
        return data;
      } catch { return null; }
    },
    async save(dateStr, data) {
      cache.health[dateStr] = data;
      await FB.saveHealth(dateStr, data);
    },
  };

  // ── 스트릭 ──
  const Streak = {
    _data: { current: 0, longest: 0, lastDate: null },
    recalc(entries) {
      const dates = Object.keys(entries || {}).sort();
      if (!dates.length) { this._data = { current: 0, longest: 0, lastDate: null }; return; }
      let current = 1, longest = 1;
      let prev = new Date(dates[0]);
      for (let i = 1; i < dates.length; i++) {
        const curr = new Date(dates[i]);
        const diff = (curr - prev) / 86400000;
        if (diff === 1) { current++; longest = Math.max(longest, current); }
        else if (diff > 1) { current = 1; }
        prev = curr;
      }
      const todayStr = new Date().toISOString().split('T')[0];
      const lastDate = dates[dates.length - 1];
      const daysSinceLast = (new Date(todayStr) - new Date(lastDate)) / 86400000;
      if (daysSinceLast > 1) current = 0;
      this._data = { current, longest, lastDate };
    },
    get() { return this._data; },
  };

  return { Entries, Todos, Settings, Alarms, Questions, Health, Streak, today, formatDate, getWeekNumber };
})();
