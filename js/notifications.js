/* ── notifications.js: 모바일 알람 ── */
const Notifications = (() => {
  const timers = [];

  async function requestPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      const result = await Notification.requestPermission();
      console.log('알림 권한:', result);
    }
  }

  async function scheduleAll() {
    // 기존 타이머 전부 취소
    timers.forEach(t => clearTimeout(t));
    timers.length = 0;

    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') {
      console.log('알림 권한 없음. 설정에서 허용해주세요.');
      return;
    }

    const alarms = await Store.Alarms.getAll();
    const now = new Date();
    const todayDow = now.getDay(); // 0=일 1=월 ...

    alarms.filter(a => a.enabled).forEach(alarm => {
      const [h, m] = alarm.time.split(':').map(Number);

      // 오늘 포함 7일 내 해당 요일 알람 등록
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() + dayOffset);
        targetDate.setHours(h, m, 0, 0);
        const targetDow = targetDate.getDay();

        if (!alarm.days.includes(targetDow)) continue;
        if (targetDate <= now) continue; // 이미 지난 시간 스킵

        const ms = targetDate - now;
        if (ms > 7 * 24 * 60 * 60 * 1000) continue; // 7일 초과 스킵

        const t = setTimeout(() => {
          if (Notification.permission === 'granted') {
            new Notification('📖 나의 일기장', {
              body: alarm.label,
              icon: '/diary-app/icon-192.png',
              badge: '/diary-app/icon-192.png',
              tag: `diary-alarm-${alarm.id}`,
              requireInteraction: true, // 모바일에서 알림 유지
            });
          }
          // 반복 알람 재등록 (다음 주 같은 요일)
          scheduleAll();
        }, ms);
        timers.push(t);
        console.log(`알람 등록: ${alarm.label} → ${targetDate.toLocaleString()} (${ms/1000/60}분 후)`);
      }
    });
  }

  return { requestPermission, scheduleAll };
})();
