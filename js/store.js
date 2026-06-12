/* ====================================================
   store.js — 데이터 레이어 (Firebase + 메모리 캐시)
   ==================================================== */
const Store = (() => {

  /* ── 유틸 ── */
  const today = () => new Date().toISOString().split('T')[0];

  const getWeekNumber = (d = new Date()) => {
    const dt = new Date(d);
    dt.setHours(0,0,0,0);
    dt.setDate(dt.getDate() + 3 - (dt.getDay() + 6) % 7);
    const w1 = new Date(dt.getFullYear(), 0, 4);
    return 1 + Math.round(((dt - w1) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
  };

  /* ── 캐시 ── */
  const _c = { entries: null, todos: null, settings: null, alarms: null, questions: null, health: {} };
  const invalidate = (key) => { if (key) _c[key] = null; else { _c.entries=_c.todos=_c.settings=_c.alarms=_c.questions=null; _c.health={}; } };

  /* ── 일기 항목 ── */
  const Entries = {
    async getAll() {
      if (!_c.entries) { _c.entries = (await FB.getEntries()) || {}; Streak.recalc(_c.entries); }
      return _c.entries;
    },
    async getByDate(dateStr) { return (await this.getAll())[dateStr] || null; },
    async getRecent(n = 5) {
      const all = await this.getAll();
      return Object.values(all).sort((a,b) => b.date.localeCompare(a.date)).slice(0, n);
    },
    async getByMonth(year, month) {
      const prefix = `${year}-${String(month).padStart(2,'0')}`;
      const all = await this.getAll();
      return Object.values(all).filter(e => e.date.startsWith(prefix));
    },
    async save(dateStr, entry) {
      const data = { ...entry, date: dateStr, updatedAt: Date.now() };
      await FB.saveEntry(dateStr, data);
      if (!_c.entries) _c.entries = {};
      _c.entries[dateStr] = data;
      Streak.recalc(_c.entries);
    },
  };

  /* ── 할 일 ── */
  const Todos = {
    async getAll() { if (!_c.todos) _c.todos = (await FB.getTodos()) || []; return _c.todos; },
    async _write(todos) { _c.todos = todos; await FB.saveTodos(todos); },
    async add(text) { const t = await this.getAll(); t.push({ id: Date.now(), text, done: false }); await this._write(t); return t; },
    async toggle(id) { const t = (await this.getAll()).map(x => x.id===id ? {...x,done:!x.done} : x); await this._write(t); return t; },
    async remove(id) { const t = (await this.getAll()).filter(x => x.id!==id); await this._write(t); return t; },
  };

  /* ── 설정 ── */
  const _SETTING_DEFAULTS = { dark: false, weatherEnabled: true, username: '내 일기장', aiFeedbackStyle: 'warm' };
  const Settings = {
    async get() { if (!_c.settings) { const r=await FB.getSettings(); _c.settings={..._SETTING_DEFAULTS,...(r||{})}; } return _c.settings; },
    async set(key, val) { const s=await this.get(); s[key]=val; await FB.saveSettings(s); },
    async save(obj) { const s=await this.get(); Object.assign(s,obj); await FB.saveSettings(s); },
  };

  /* ── 알람 ── */
  const _ALARM_DEFAULTS = [
    { id:1, time:'21:00', label:'저녁 일기 알람', days:[0,1,2,3,4,5,6], enabled:true },
    { id:2, time:'07:30', label:'아침 점검 알람', days:[1,2,3,4,5], enabled:true },
  ];
  const Alarms = {
    async getAll() { if (!_c.alarms) _c.alarms=(await FB.getAlarms())||_ALARM_DEFAULTS; return _c.alarms; },
    async _write(a) { _c.alarms=a; await FB.saveAlarms(a); },
    async add(alarm) { const a=await this.getAll(); alarm.id=Date.now(); a.push(alarm); await this._write(a); return a; },
    async remove(id) { const a=(await this.getAll()).filter(x=>x.id!==id); await this._write(a); return a; },
    async toggle(id) { const a=(await this.getAll()).map(x=>x.id===id?{...x,enabled:!x.enabled}:x); await this._write(a); return a; },
  };

  /* ── 질문 ── */
  const _Q_DEFAULTS = [
    { id:1, text:'오늘 하루 전반적으로 어떠셨나요?' },
    { id:2, text:'오늘 특별히 기억에 남는 순간이 있었나요?' },
    { id:3, text:'업무나 커리어와 관련해 떠오르는 게 있나요?' },
    { id:4, text:'아이 또는 가족과 있었던 일이 있나요?' },
    { id:5, text:'내일 하고 싶거나 해야 할 일이 있나요?' },
  ];
  const Questions = {
    async getAll() { if (!_c.questions) _c.questions=(await FB.getQuestions())||_Q_DEFAULTS; return _c.questions; },
    async _write(q) { _c.questions=q; await FB.saveQuestions(q); },
    async add(text) { const q=await this.getAll(); q.push({id:Date.now(),text}); await this._write(q); return q; },
    async remove(id) { const q=(await this.getAll()).filter(x=>x.id!==id); await this._write(q); return q; },
  };

  /* ── 건강 ── */
  const Health = {
    async getByDate(dateStr) {
      if (_c.health[dateStr]===undefined) _c.health[dateStr]=await FB.getHealth(dateStr);
      return _c.health[dateStr];
    },
    async save(dateStr, data) { _c.health[dateStr]=data; await FB.saveHealth(dateStr,data); },
  };

  /* ── 스트릭 ── */
  const Streak = {
    _d: { current:0, longest:0 },
    get() { return this._d; },
    recalc(entries) {
      const dates = Object.keys(entries||{}).sort();
      if (!dates.length) { this._d={current:0,longest:0}; return; }
      let cur=1, max=1, prev=new Date(dates[0]);
      for (let i=1;i<dates.length;i++) {
        const diff=(new Date(dates[i])-prev)/86400000;
        if (diff===1) { cur++; max=Math.max(max,cur); } else if (diff>1) cur=1;
        prev=new Date(dates[i]);
      }
      const last=dates[dates.length-1];
      if ((new Date(today())-new Date(last))/86400000>1) cur=0;
      this._d={current:cur,longest:max};
    },
  };

  return { today, getWeekNumber, Entries, Todos, Settings, Alarms, Questions, Health, Streak, invalidate };
})();
