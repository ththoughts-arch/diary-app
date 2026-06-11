/* ── report.js ── */
const Report = (() => {
  let period = 'weekly';

  function setPeriod(p, btn) {
    period = p;
    document.querySelectorAll('.pt-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    render();
  }

  async function render() { // fixed
    const body = document.getElementById('report-body');
    if (!body) return;

    const now = new Date();
    let entries = [];
    let periodLabel = '';

    if (period === 'weekly') {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() + 1);
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
      const all = await Store.Entries.getAll();
      entries = Object.values(all).filter(e => {
        const d = new Date(e.date);
        return d >= weekStart && d <= weekEnd;
      }).sort((a,b) => a.date.localeCompare(b.date));
      const weekNum = Store.getWeekNumber(now);
      periodLabel = `${now.getMonth()+1}월 ${weekNum}주차`;
      document.getElementById('rpt-period').textContent = `${periodLabel} · ${weekStart.getMonth()+1}/${weekStart.getDate()} ~ ${weekEnd.getMonth()+1}/${weekEnd.getDate()}`;
    } else if (period === 'monthly') {
      entries = Store.Entries.getByMonth(now.getFullYear(), now.getMonth()+1);
      periodLabel = `${now.getFullYear()}년 ${now.getMonth()+1}월`;
      document.getElementById('rpt-period').textContent = periodLabel;
    } else {
      const all = await Store.Entries.getAll();
      entries = Object.values(all).filter(e => e.date.startsWith(String(now.getFullYear())));
      document.getElementById('rpt-period').textContent = `${now.getFullYear()}년`;
    }

    if (!entries.length) {
      body.innerHTML = `<div style="text-align:center;padding:48px 20px;color:#bbb;font-size:14px">아직 일기 기록이 없어요.<br>기록을 시작하면 리포트가 생성돼요 📊</div>`;
      return;
    }

    body.innerHTML = `<div class="loading"><div class="spinner"></div> AI가 리포트를 생성 중이에요...</div>`;

    const report = await API.generateWeeklyReport(entries);
    const moods = entries.map(e => e.mood || '😊');
    const tags = [...new Set(entries.flatMap(e => e.tags || []))].slice(0, 8);
    const healthEntries = entries.map(e => e.health).filter(Boolean);
    const avgSleep = healthEntries.length ? Math.round(healthEntries.reduce((s,h) => s + (h.sleep||0), 0) / healthEntries.length) : null;
    const avgStress = healthEntries.length ? Math.round(healthEntries.reduce((s,h) => s + (h.stress||0), 0) / healthEntries.length) : null;
    const runCount = healthEntries.filter(h => h.pace).length;

    const dayLabels = ['일','월','화','수','목','금','토'];
    const moodColors = { '😊':'#E1F5EE','😄':'#E1F5EE','😤':'#FAEEDA','😌':'#EEEDFE','🙂':'#EEEDFE','💛':'#FAEEDA','✨':'#E1F5EE','🌧':'#f5f5f5' };
    const weekDays = period === 'weekly' ? dayLabels : [];
    const moodRow = period === 'weekly' ? `
      <div class="mood-row">
        ${weekDays.map((d,i) => {
          const entry = entries.find(e => new Date(e.date).getDay() === (i===0?0:i));
          const mood = entry?.mood || '';
          return `<div class="mood-day">
            <div class="mood-emoji" style="background:${mood ? (moodColors[mood]||'#f5f5f5') : '#f5f5f5'}">${mood}</div>
            <div class="md-label">${d}</div>
          </div>`;
        }).join('')}
      </div>
      <div style="font-size:12px;color:#888;line-height:1.5">${report?.moodSummary || '감정 흐름을 분석 중이에요.'}</div>
    ` : '';

    const lifeData = report?.lifeSummary || {};
    const lifeCards = [
      { key:'work', icon:'💼', label:'업무 · 커리어', val: lifeData.work?.highlight || '--', sub: lifeData.work?.detail || '' },
      { key:'family', icon:'👨‍👧', label:'육아 · 가족', val: lifeData.family?.highlight || '--', sub: lifeData.family?.detail || '' },
      { key:'health', icon:'🏃', label:'운동 · 건강', val: lifeData.health?.highlight || `러닝 ${runCount}회`, sub: lifeData.health?.detail || '' },
      { key:'money', icon:'💰', label:'경제 · 재무', val: lifeData.money?.highlight || '--', sub: lifeData.money?.detail || '' },
    ];

    const tagColors = ['tag-p','tag-g','tag-a','tag-g','tag-p','tag-a','tag-c','tag-g'];

    body.innerHTML = `
      <div class="section">
        <div class="section-label">AI 총평</div>
        <div class="ai-narrative">
          <div class="an-label">✨ AI가 읽은 나의 ${period === 'weekly' ? '한 주' : period === 'monthly' ? '한 달' : '올해'}</div>
          <div class="an-title">"${escapeHtml(report?.title || '기록을 분석 중이에요')}"</div>
          <div class="an-body">${escapeHtml(report?.narrative || '')}</div>
        </div>
      </div>

      ${period === 'weekly' ? `
      <div class="section">
        <div class="section-label">감정 흐름</div>
        <div class="card">${moodRow}</div>
      </div>` : ''}

      <div class="section">
        <div class="section-label">삶의 영역별 · 탭해서 자세히 보기</div>
        <div class="life-grid">
          ${lifeCards.map(c => `
            <div class="life-card" onclick="Report.openLifeDrawer('${c.key}')">
              <div class="lc-icon">${c.icon}</div>
              <div class="lc-label">${c.label}</div>
              <div class="lc-val">${escapeHtml(c.val)}</div>
              <div class="lc-sub">${escapeHtml(c.sub.slice(0,30))}${c.sub.length>30?'...':''}</div>
              <span class="lc-arrow">›</span>
            </div>
          `).join('')}
        </div>
      </div>

      ${report?.bestMoment ? `
      <div class="section">
        <div class="section-label">가장 기억에 남는 순간</div>
        <div class="card">
          <div class="moment-item" style="border:none;padding:0">
            <div class="moment-icon" style="background:#E1F5EE">✨</div>
            <div class="moment-meta">
              <div class="moment-desc">${escapeHtml(report.bestMoment)}</div>
            </div>
          </div>
        </div>
      </div>` : ''}

      ${report?.bestQuote ? `
      <div class="section">
        <div class="section-label">이 기간 내가 한 말</div>
        <div class="quote-block">
          <div class="qb-text">"${escapeHtml(report.bestQuote)}"</div>
        </div>
      </div>` : ''}

      ${avgSleep || avgStress ? `
      <div class="section">
        <div class="section-label">건강 요약 (보조지표)</div>
        <div class="card">
          <div class="health-mini">
            <div class="health-chip"><div class="hc-label">평균 수면</div><div class="sc-val" style="color:#534AB7;font-size:18px;font-weight:600">${avgSleep||'--'}</div></div>
            <div class="health-chip"><div class="hc-label">평균 스트레스</div><div class="sc-val" style="color:#D85A30;font-size:18px;font-weight:600">${avgStress||'--'}</div></div>
            <div class="health-chip"><div class="hc-label">러닝</div><div class="sc-val" style="color:#085041;font-size:18px;font-weight:600">${runCount}회</div></div>
          </div>
        </div>
      </div>` : ''}

      ${report?.nextWeekTips?.length ? `
      <div class="section">
        <div class="section-label">다음 ${period === 'weekly' ? '주' : '달'} 나에게</div>
        <div class="next-box">
          <div class="nb-label">→ AI 제안</div>
          ${report.nextWeekTips.map(t => `<div class="nb-item">${escapeHtml(t)}</div>`).join('')}
        </div>
      </div>` : ''}

      <div class="section">
        <div class="section-label">이번 ${period === 'weekly' ? '주' : '달'} 일기 목록</div>
        <div class="card">
          ${entries.slice().reverse().map(e => `
            <div class="entry-row" onclick="Drawer.showEntry('${e.date}')">
              <div class="entry-dot" style="background:#EEEDFE">📖</div>
              <div class="entry-meta">
                <div class="entry-title">${escapeHtml(e.summary || e.diary?.slice(0,30) || '일기')}</div>
                <div class="entry-preview">${e.date} ${e.mood || ''}</div>
              </div>
              <div class="entry-date">${new Date(e.date).getMonth()+1}/${new Date(e.date).getDate()}</div>
            </div>
          `).join('')}
        </div>
      </div>

      ${tags.length ? `
      <div class="section">
        <div class="section-label">키워드</div>
        <div class="tag-wrap">
          ${tags.map((t,i) => `<span class="tag ${tagColors[i%tagColors.length]}">${escapeHtml(t)}</span>`).join('')}
        </div>
      </div>` : ''}
    `;

    // 드로어 데이터 저장
    Report._lifeCards = lifeCards;
    Report._period = period;
    Report._entries = entries;
    Report._report = report;
  }

  function openLifeDrawer(key) {
    const lifeCards = Report._lifeCards || [];
    const entries = Report._entries || [];
    const report = Report._report;
    const card = lifeCards.find(c => c.key === key);
    if (!card) return;

    const keyEntries = entries.filter(e => {
      const text = (e.diary || '') + (e.answers || []).map(a => a.answer).join(' ');
      const keywords = { work: ['업무','회사','미팅','발표','팀'], family: ['아이','가족','육아','아내','남편'], health: ['러닝','운동','수면','스트레스'], money: ['지출','투자','수입','재무','돈'] };
      return (keywords[key] || []).some(k => text.includes(k));
    });

    Drawer.open(card.label, `
      <div class="ai-summary-box">
        <div class="as-label">✨ AI 요약</div>
        <div class="as-text">${escapeHtml(card.sub || card.val)}</div>
      </div>
      <div>
        <div class="drawer-section-label">이 기간 기록</div>
        <div class="card">
          ${keyEntries.length ? keyEntries.map(e => `
            <div class="entry-row" onclick="Drawer.showEntry('${e.date}')">
              <div class="entry-dot" style="background:#EEEDFE">📖</div>
              <div class="entry-meta">
                <div class="entry-title">${escapeHtml(e.summary || e.diary?.slice(0,30) || '일기')}</div>
                <div class="entry-preview">${e.date}</div>
              </div>
              <div class="entry-mood">${e.mood || ''}</div>
            </div>
          `).join('') : '<div style="padding:12px;text-align:center;color:#bbb;font-size:13px">관련 기록이 없어요</div>'}
        </div>
      </div>
      ${report?.lifeSummary?.[key]?.detail ? `
      <div class="insight-box">
        <div class="ib-label">💡 AI 인사이트</div>
        <div class="ib-text">${escapeHtml(report.lifeSummary[key].detail)}</div>
      </div>` : ''}
    `);
  }

  return { render, setPeriod, openLifeDrawer, exportPDF, shareEmail };
})();

// ── PDF 저장 (브라우저 print 활용) ──
function exportPDF() {
  const body = document.getElementById('report-body');
  if (!body) return;
  const periodLabels = { weekly: '주간', monthly: '월간', yearly: '연간' };
  const label = periodLabels[Report._period || 'weekly'];
  const printWin = window.open('', '_blank');
  printWin.document.write(`
    <!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>나의 일기장 ${label} 리포트</title>
    <style>
      body { font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #222; }
      h1 { color: #2AADA3; font-size: 20px; margin-bottom: 4px; }
      .sub { color: #888; font-size: 13px; margin-bottom: 20px; }
      .section { margin-bottom: 20px; }
      .section-title { font-size: 12px; font-weight: 700; color: #888; letter-spacing: 0.05em; margin-bottom: 8px; }
      .card { background: #f9f9f9; border-radius: 10px; padding: 14px; margin-bottom: 8px; }
      .tag { background: #E1F5EE; color: #0F6E56; border-radius: 99px; padding: 3px 10px; font-size: 11px; margin: 2px; display: inline-block; }
      @media print { body { padding: 0; } }
    </style>
    </head><body>
    <h1>나의 일기장 ${label} 리포트</h1>
    <div class="sub">${new Date().toLocaleDateString('ko-KR')} 기준</div>
    ${body.innerHTML}
    <script>window.onload=()=>{ window.print(); }<\/script>
    </body></html>`);
  printWin.document.close();
}

// ── 이메일로 보내기 ──
function shareEmail() {
  const body = document.getElementById('report-body');
  if (!body) return;
  const text = body.innerText.slice(0, 2000);
  const periodLabels = { weekly: '주간', monthly: '월간', yearly: '연간' };
  const label = periodLabels[Report._period || 'weekly'];
  const subject = encodeURIComponent(`나의 일기장 ${label} 리포트 - ${new Date().toLocaleDateString('ko-KR')}`);
  const body2 = encodeURIComponent(text);
  window.location.href = `mailto:?subject=${subject}&body=${body2}`;
}
