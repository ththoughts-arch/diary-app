/* ── firebase.js: Firebase 초기화 ── */

const firebaseConfig = {
  apiKey: "AIzaSyB8Fyz8VkkLVWH0j22JipTNpJNVb69as8o",
  authDomain: "diary-app-33e4a.firebaseapp.com",
  projectId: "diary-app-33e4a",
  storageBucket: "diary-app-33e4a.firebasestorage.app",
  messagingSenderId: "637574544337",
  appId: "1:637574544337:web:6c6cb8da5ae2cba56ebef0"
};

// Firebase SDK (compat 버전 — 일반 script 태그로 로드)
let db, auth, currentUser = null;

function initFirebase() {
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();

  auth.onAuthStateChanged((user) => {
    currentUser = user;
    if (user) {
      document.getElementById('auth-screen')?.remove();
      document.getElementById('app').style.display = 'flex';
      App.init();
    } else {
      document.getElementById('app').style.display = 'none';
      showAuthScreen();
    }
  });
}

function showAuthScreen() {
  if (document.getElementById('auth-screen')) return;
  const el = document.createElement('div');
  el.id = 'auth-screen';
  el.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-logo">📖</div>
      <div class="auth-title">나의 일기장</div>
      <div class="auth-sub">AI가 정리해주는 음성 일기</div>
      <div class="auth-tabs">
        <button class="auth-tab active" id="tab-login" onclick="FB.switchTab('login')">로그인</button>
        <button class="auth-tab" id="tab-signup" onclick="FB.switchTab('signup')">회원가입</button>
      </div>
      <input class="auth-input" id="auth-email" type="email" placeholder="이메일" />
      <input class="auth-input" id="auth-pw" type="password" placeholder="비밀번호 (6자 이상)" />
      <div class="auth-error" id="auth-error"></div>
      <button class="auth-btn" id="auth-submit-btn" onclick="FB.submit()">로그인</button>
    </div>
  `;
  document.body.appendChild(el);
}

function switchTab(mode) {
  const btn = document.getElementById('auth-submit-btn');
  document.getElementById('tab-login').classList.toggle('active', mode === 'login');
  document.getElementById('tab-signup').classList.toggle('active', mode === 'signup');
  btn.textContent = mode === 'login' ? '로그인' : '회원가입';
  document.getElementById('auth-error').textContent = '';
}

async function submit() {
  const email = document.getElementById('auth-email')?.value?.trim();
  const pw = document.getElementById('auth-pw')?.value?.trim();
  const errEl = document.getElementById('auth-error');
  const isSignup = document.getElementById('auth-submit-btn')?.textContent === '회원가입';
  if (!email || !pw) { errEl.textContent = '이메일과 비밀번호를 입력해주세요.'; return; }
  try {
    if (isSignup) await auth.createUserWithEmailAndPassword(email, pw);
    else await auth.signInWithEmailAndPassword(email, pw);
  } catch (e) {
    const msgs = {
      'auth/email-already-in-use': '이미 사용 중인 이메일이에요.',
      'auth/invalid-email': '이메일 형식이 올바르지 않아요.',
      'auth/weak-password': '비밀번호는 6자 이상이어야 해요.',
      'auth/user-not-found': '등록된 이메일이 없어요.',
      'auth/wrong-password': '비밀번호가 틀렸어요.',
      'auth/invalid-credential': '이메일 또는 비밀번호가 틀렸어요.',
    };
    errEl.textContent = msgs[e.code] || '오류가 발생했어요. 다시 시도해주세요.';
  }
}

async function logout() {
  if (!confirm('로그아웃 할까요?')) return;
  await auth.signOut();
}

function uid() { return currentUser?.uid; }

// ── Firestore CRUD ──
async function saveEntry(dateStr, entry) {
  if (!uid()) return;
  await db.collection('users').doc(uid()).collection('entries').doc(dateStr).set(entry);
}
async function getEntries() {
  if (!uid()) return {};
  const snap = await db.collection('users').doc(uid()).collection('entries').get();
  const result = {};
  snap.forEach(d => { result[d.id] = d.data(); });
  return result;
}
async function getEntry(dateStr) {
  if (!uid()) return null;
  const snap = await db.collection('users').doc(uid()).collection('entries').doc(dateStr).get();
  return snap.exists ? snap.data() : null;
}
async function saveSettings(s) {
  if (!uid()) return;
  await db.collection('users').doc(uid()).collection('settings').doc('main').set(s);
}
async function getSettings() {
  if (!uid()) return null;
  const snap = await db.collection('users').doc(uid()).collection('settings').doc('main').get();
  return snap.exists ? snap.data() : null;
}
async function saveTodos(todos) {
  if (!uid()) return;
  await db.collection('users').doc(uid()).collection('todos').doc('main').set({ todos });
}
async function getTodos() {
  if (!uid()) return [];
  const snap = await db.collection('users').doc(uid()).collection('todos').doc('main').get();
  return snap.exists ? (snap.data().todos || []) : [];
}
async function saveHealth(dateStr, data) {
  if (!uid()) return;
  await db.collection('users').doc(uid()).collection('health').doc(dateStr).set(data);
}
async function getHealth(dateStr) {
  if (!uid()) return null;
  const snap = await db.collection('users').doc(uid()).collection('health').doc(dateStr).get();
  return snap.exists ? snap.data() : null;
}
async function saveAlarms(alarms) {
  if (!uid()) return;
  await db.collection('users').doc(uid()).collection('alarms').doc('main').set({ alarms });
}
async function getAlarms() {
  if (!uid()) return null;
  const snap = await db.collection('users').doc(uid()).collection('alarms').doc('main').get();
  return snap.exists ? (snap.data().alarms || []) : null;
}
async function saveQuestions(questions) {
  if (!uid()) return;
  await db.collection('users').doc(uid()).collection('questions').doc('main').set({ questions });
}
async function getQuestions() {
  if (!uid()) return null;
  const snap = await db.collection('users').doc(uid()).collection('questions').doc('main').get();
  return snap.exists ? (snap.data().questions || []) : null;
}

const FB = { switchTab, submit, logout, saveEntry, getEntries, getEntry, saveSettings, getSettings, saveTodos, getTodos, saveHealth, getHealth, saveAlarms, getAlarms, saveQuestions, getQuestions, currentUser: () => currentUser };
