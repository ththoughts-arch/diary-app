/* ====================================================
   report.js — 리포트 화면 (주간/월간/연간)
   ==================================================== */
const Report = (() => {

  let period = 'weekly';

  function setPeriod(p, btn) {
    period = p;
    document.querySelectorAll('.pt-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    render();
  }

  async function render() {
    const body = $('report-body');
    if (!body) return;

    const now = new Date();
    let entries = [], label = '';

    if (period === 'weekly') {
      const ws = new Date(now); ws.setDate(now.getDate()-now.getDay()+1); ws.setHours(0,0,0,0);
      const we = new Date(ws); we.setDate(ws.getDate()+6);
      const all = await Store.Entries.getAll();
      entries = Object.values(all).filter(e => { const d=new Date(e.date); return d>=ws&&d<=we; }).sort((a,b)=>a.date.localeCompare(b.date));
      label = `${now.getMonth()+1}월 ${Store.getWeekNumber(now)}주차`;
      const pd = $('rpt-period');
      if (pd) pd.textContent = `${label} · ${ws.getMonth()+1}/${ws.getDate()} ~ ${we.getMonth()+1}/${we.getDate()}`;
    } else if (period === 'monthly') {
      entries = await Store.Entries.getByMonth(now.getFullYear(), now.getMonth()+1);
      label = `${now.getFullYear()}년 ${now.getMonth()+1}월`;
      const pd = $('rpt-period'); if (pd) pd.textContent = label;
    } else {
      const all = await Store.Entries.getAll();
      entries = Object.values(all).filter(e => e.date.startsWith(String(now.getFullYear())));
      const pd = $('rpt-period'); if (pd) pd.textContent = `${now.getFullYear()}년`;
    }

    if (!entries.length) {
      body.innerHTML = `<div style="text-align:center;padding:48px 20px;color:#bbb;font-size:14px">아직 일기 기록이 없어요.<br>기록을 시작하면 리포트가 생성돼요 📊</div>`;
      return;
    }

    body.innerHTML = `<div class="loading"><div class="spinner"></div> 리포트를 생성 중이에요...</div>`;

    // 데이터 수집
    let report = null;
    try { report = await API.generateReport(entries); } catch(e) { console.error(e); }

    const tags = [...new Set(entries.flatMap(e=>e.tags||[]))].slice(0,8);
    const healthArr = entries.map(e=>e.health).filter(Boolean);
    const avgSleep  = healthArr.length ? Math.round(healthArr.reduce((s,h)=>s+(h.sleep||0),0)/healthArr.length) : null;
    const avgStress = healthArr.length ? Math.round(healthArr.reduce((s,h)=>s+(h.stress||0),0)/healthArr.length) : null;
    const runCount  = healthArr.filter(h=>h.pace).length;

    const moodColors = {'😊':'#E1F5EE','😄':'#E1F5EE','😤':'#FAEEDA','😌':'#EEEDFE','🙂':'#EEEDFE','💛':'#FAEEDA','✨':'#E1F5EE','🌧':'#f5f5f5'};
    const days = ['일','월','화','수','목','금','토'];

    // 감정 흐름 (주간만)
    const moodRow = period==='weekly' ? `
      <div class="mood-row">
        ${days.map((d,i) => {
          const e = entries.find(e=>new Date(e.date).getDay()===i);
          const m = e?.mood||'';
          return `<div class="mood-day">
            <div class="mood-emoji" style="background:${m?(moodColors[m]||'#f5f5f5'):'#f5f5f5'}">${m}</div>
            <div class="md-label">${d}</div>
          </div>`;
        }).join('')}
      </div>
      <div style="font-size:12px;color:#888;line-height:1.5">${esc(report?.moodSummary||'이번 주 감정 흐름이에요.')}</div>
    ` : '';

    const lifeData = report?.lifeSummary || {};
    const lifeCards = [
      { key:'work',   icon:'💼', label:'업무 · 커리어', val:lifeData.work?.highlight||'--',   sub:lifeData.work?.detail||''   },
      { key:'family', icon:'👨‍👧', label:'육아 · 가족',   val:lifeData.family?.highlight||'--', sub:lifeData.family?.detail||'' },
      { key:'health', icon:'🏃', label:'운동 · 건강',   val:lifeData.health?.highlight||`러닝 ${runCount}회`, sub:lifeData.health?.detail||'' },
      { key:'money',  icon:'💰', label:'경제 · 재무',   val:lifeData.money?.highlight||'--',  sub:lifeData.money?.detail||''  },
    ];
    const tagCls = ['tag-p','tag-g','tag-a','tag-g','tag-p','tag-a','tag-c','tag-g'];
    const pLabel = period==='weekly'?'한 주':period==='monthly'?'한 달':'올해';

    body.innerHTML = `
      <div class="section">
        <div class="section-label">AI 총평</div>
        <div class="ai-narrative">
          <div class="an-label">✨ AI가 읽은 나의 ${pLabel}</div>
          <div class="an-title">"${esc(report?.title||'이번 기간의 기록이에요')}"</div>
          <div class="an-body">${esc(report?.narrative||entries.length+'개의 일기가 기록됐어요.')}</div>
        </div>
      </div>
      ${period==='weekly'?`<div class="section"><div class="section-label">감정 흐름</div><div class="card">${moodRow}</div></div>`:''}
      <div class="section">
        <div class="section-label">삶의 영역별 · 탭해서 자세히 보기</div>
        <div class="life-grid">
          ${lifeCards.map(c=>`
            <div class="life-card" onclick="Report.openLifeDrawer('${c.key}')">
              <div class="lc-icon">${c.icon}</div>
              <div class="lc-label">${c.label}</div>
              <div class="lc-val">${esc(c.val)}</div>
              <div class="lc-sub">${esc(c.sub.slice(0,30))}${c.sub.length>30?'...':''}</div>
              <span class="lc-arrow">›</span>
            </div>`).join('')}
        </div>
      </div>
      ${report?.bestMoment?`
      <div class="section">
        <div class="section-label">가장 기억에 남는 순간</div>
        <div class="card"><div style="font-size:13px;color:#222;line-height:1.7">✨ ${esc(report.bestMoment)}</div></div>
      </div>`:''}
      ${report?.bestQuote?`
      <div class="section">
        <div class="section-label">이 기간 내가 한 말</div>
        <div style="border-left:3px solid #3DCFC4;border-radius:0 10px 10px 0;padding:10px 14px;background:#f5f5f5">
          <div style="font-size:13px;color:#333;line-height:1.6;font-style:italic">"${esc(report.bestQuote)}"</div>
        </div>
      </div>`:''}
      ${avgSleep||avgStress?`
      <div class="section">
        <div class="section-label">건강 요약 (보조지표)</div>
        <div class="card">
          <div class="health-mini">
            <div class="health-chip"><div class="hc-label2">평균 수면</div><div class="sc-val" style="color:#534AB7;font-size:18px">${avgSleep||'--'}</div></div>
            <div class="health-chip"><div class="hc-label2">평균 스트레스</div><div class="sc-val" style="color:#D85A30;font-size:18px">${avgStress||'--'}</div></div>
            <div class="health-chip"><div class="hc-label2">러닝</div><div class="sc-val" style="color:#085041;font-size:18px">${runCount}회</div></div>
          </div>
        </div>
      </div>`:''}
      ${report?.nextTips?.length?`
      <div class="section">
        <div class="section-label">다음 ${period==='weekly'?'주':'달'} 나에게</div>
        <div class="next-box">
          <div class="nb-label">→ AI 제안</div>
          ${report.nextTips.map(t=>`<div class="nb-item">${esc(t)}</div>`).join('')}
        </div>
      </div>`:''}
      <div class="section">
        <div class="section-label">일기 목록</div>
        <div class="card">
          ${entries.slice().reverse().map(e=>`
            <div class="entry-row" onclick="Drawer.showEntry('${e.date}')">
              <div class="entry-dot" style="background:#EEEDFE">📖</div>
              <div class="entry-meta">
                <div class="entry-title">${esc(e.summary||e.diary?.slice(0,30)||'일기')}</div>
                <div class="entry-preview">${e.date} ${e.mood||''}</div>
              </div>
              <div class="entry-date">${new Date(e.date).getMonth()+1}/${new Date(e.date).getDate()}</div>
            </div>`).join('')}
        </div>
      </div>
      ${tags.length?`
      <div class="section">
        <div class="section-label">키워드</div>
        <div class="tag-wrap">${tags.map((t,i)=>`<span class="tag ${tagCls[i%tagCls.length]}">${esc(t)}</span>`).join('')}</div>
      </div>`:''}
    `;

    // PDF 버튼 (innerHTML += 대신 appendChild)
    const btn = document.createElement('div');
    btn.className = 'section';
    btn.style.paddingBottom = '24px';
    btn.innerHTML = `
      <button class="btn-primary" onclick="Report.exportPDF()" style="margin-bottom:8px">📄 PDF로 저장 / 인쇄</button>
      <button class="add-row-btn" onclick="Report.exportEmail()">📧 이메일로 보내기</button>`;
    body.appendChild(btn);

    // 드로어용 데이터 저장
    Report._data = { lifeCards, entries, report, period };
  }

  function openLifeDrawer(key) {
    const d = Report._data; if (!d) return;
    const card = d.lifeCards.find(c=>c.key===key); if (!card) return;
    const kws = { work:['업무','회사','미팅','발표','팀'], family:['아이','가족','육아','아내','남편'], health:['러닝','운동','수면','스트레스'], money:['지출','투자','수입','재무','돈'] };
    const rel = d.entries.filter(e => (kws[key]||[]).some(k=>(e.diary||'').includes(k)));
    Drawer.open(card.label, `
      <div style="background:linear-gradient(135deg,#E1F5EE,#EEEDFE);border-radius:12px;padding:13px 14px">
        <div style="font-size:10px;font-weight:600;color:#0F6E56;margin-bottom:5px">✨ AI 요약</div>
        <div style="font-size:13px;color:#085041;line-height:1.65">${esc(card.sub||card.val)}</div>
      </div>
      <div>
        <div class="drawer-label">관련 기록</div>
        <div class="card">
          ${rel.length?rel.map(e=>`
            <div class="entry-row" onclick="Drawer.showEntry('${e.date}')">
              <div class="entry-dot" style="background:#EEEDFE">📖</div>
              <div class="entry-meta"><div class="entry-title">${esc(e.summary||e.diary?.slice(0,30)||'일기')}</div><div class="entry-preview">${e.date}</div></div>
            </div>`).join(''):'<div style="padding:12px;text-align:center;color:#bbb;font-size:13px">관련 기록이 없어요</div>'}
        </div>
      </div>`);
  }

  /* ── PDF / 이메일 ── */
  async function exportPDF() {
    const d = Report._data; if (!d) return;
    const entries = d.entries; if (!entries.length) { alert('내보낼 일기가 없어요.'); return; }
    const pLabel = {weekly:'주간',monthly:'월간',yearly:'연간'}[d.period]||'';
    const rows = entries.map(e=>`
      <div style="margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid #eee">
        <div style="font-size:13px;color:#888;margin-bottom:4px">${e.date} ${e.mood||''}</div>
        <div style="font-size:15px;font-weight:600;margin-bottom:8px">${e.summary||''}</div>
        <div style="font-size:14px;color:#333;line-height:1.8">${(e.diary||'').replace(/\n/g,'<br>')}</div>
      </div>`).join('');
    const win = window.open('','_blank');
    if (!win) { alert('팝업을 허용해주세요.'); return; }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>나의 일기장 ${pLabel} 리포트</title>
      <style>body{font-family:-apple-system,sans-serif;max-width:640px;margin:0 auto;padding:32px 24px}h1{color:#2AADA3}@media print{button{display:none}}</style>
      </head><body><h1>📖 나의 일기장 ${pLabel} 리포트</h1>
      <p style="color:#888;margin-bottom:32px">${new Date().toLocaleDateString('ko-KR')} · ${entries.length}개 항목</p>
      ${rows}<script>window.onload=()=>setTimeout(()=>window.print(),300);<\/script></body></html>`);
    win.document.close();
  }

  async function exportEmail() {
    const d = Report._data; if (!d) return;
    const pLabel = {weekly:'주간',monthly:'월간',yearly:'연간'}[d.period]||'';
    const text = d.entries.map(e=>`[${e.date}] ${e.mood||''} ${e.summary||''}\n\n${e.diary||''}`).join('\n\n---\n\n');
    const subject = encodeURIComponent(`나의 일기장 ${pLabel} 리포트 — ${new Date().toLocaleDateString('ko-KR')}`);
    const body = encodeURIComponent(text.slice(0,1800));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  return { render, setPeriod, openLifeDrawer, exportPDF, exportEmail };
})();
