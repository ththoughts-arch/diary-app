/* ── firebase.js: Firebase 초기화 + Auth + Firestore ── */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc, query, orderBy }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Firebase 설정 (본인 설정값으로 교체됨) ──
const firebaseConfig = {
  apiKey: "AIzaSyB8Fyz8VkkLVWH0j22JipTNpJNVb69as8o",
  authDomain: "diary-app-33e4a.firebaseapp.com",
  projectId: "diary-app-33e4a",
  storageBucket: "diary-app-33e4a.firebasestorage.app",
  messagingSenderId: "637574544337",
  appId: "1:637574544337:web:6c6cb8da5ae2cba56ebef0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ── 현재 로그인 유저 ──
let currentUser = null;
onAuthStateChanged(auth, (user) => {
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

// ── 로그인 화면 표시 ──
function showAuthScreen() {
  let el = document.getElementById('auth-screen');
  if (el) return;
  el = document.createElement('div');
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
      <div class="auth-form">
        <input class="auth-input" id="auth-email" type="email" placeholder="이메일" />
        <input class="auth-input" id="auth-pw" type="password" placeholder="비밀번호 (6자 이상)" />
        <div class="auth-error" id="auth-error"></div>
        <button class="auth-btn" id="auth-submit-btn" onclick="FB.submit()">로그인</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
}

// ── 탭 전환 ──
function switchTab(mode) {
  const btn = document.getElementById('auth-submit-btn');
  const loginTab = document.getElementById('tab-login');
  const signupTab = document.getElementById('tab-signup');
  if (mode === 'login') {
    btn.textContent = '로그인';
    loginTab.classList.add('active');
    signupTab.classList.remove('active');
  } else {
    btn.textContent = '회원가입';
    signupTab.classList.add('active');
    loginTab.classList.remove('active');
  }
  document.getElementById('auth-error').textContent = '';
}

// ── 로그인/회원가입 제출 ──
async function submit() {
  const email = document.getElementById('auth-email')?.value?.trim();
  const pw = document.getElementById('auth-pw')?.value?.trim();
  const errEl = document.getElementById('auth-error');
  const isSignup = document.getElementById('auth-submit-btn')?.textContent === '회원가입';

  if (!email || !pw) { errEl.textContent = '이메일과 비밀번호를 입력해주세요.'; return; }

  try {
    if (isSignup) {
      await createUserWithEmailAndPassword(auth, email, pw);
    } else {
      await signInWithEmailAndPassword(auth, email, pw);
    }
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

// ── 로그아웃 ──
async function logout() {
  if (!confirm('로그아웃 할까요?')) return;
  await signOut(auth);
}

// ── Firestore CRUD ──
function uid() { return currentUser?.uid; }

// 일기 저장
async function saveEntry(dateStr, entry) {
  if (!uid()) return;
  await setDoc(doc(db, 'users', uid(), 'entries', dateStr), { ...entry, date: dateStr, updatedAt: Date.now() });
}

// 일기 불러오기 (전체)
async function getEntries() {
  if (!uid()) return {};
  const snap = await getDocs(collection(db, 'users', uid(), 'entries'));
  const result = {};
  snap.forEach(d => { result[d.id] = d.data(); });
  return result;
}

// 일기 불러오기 (단일)
async function getEntry(dateStr) {
  if (!uid()) return null;
  const snap = await getDoc(doc(db, 'users', uid(), 'entries', dateStr));
  return snap.exists() ? snap.data() : null;
}

// 설정 저장
async function saveSettings(settings) {
  if (!uid()) return;
  await setDoc(doc(db, 'users', uid(), 'settings', 'main'), settings);
}

// 설정 불러오기
async function getSettings() {
  if (!uid()) return null;
  const snap = await getDoc(doc(db, 'users', uid(), 'settings', 'main'));
  return snap.exists() ? snap.data() : null;
}

// 할 일 저장
async function saveTodos(todos) {
  if (!uid()) return;
  await setDoc(doc(db, 'users', uid(), 'todos', 'main'), { todos });
}

// 할 일 불러오기
async function getTodos() {
  if (!uid()) return [];
  const snap = await getDoc(doc(db, 'users', uid(), 'todos', 'main'));
  return snap.exists() ? (snap.data().todos || []) : [];
}

// 건강 데이터 저장
async function saveHealth(dateStr, data) {
  if (!uid()) return;
  await setDoc(doc(db, 'users', uid(), 'health', dateStr), data);
}

// 건강 데이터 불러오기
async function getHealth(dateStr) {
  if (!uid()) return null;
  const snap = await getDoc(doc(db, 'users', uid(), 'health', dateStr));
  return snap.exists() ? snap.data() : null;
}

// 알람 저장
async function saveAlarms(alarms) {
  if (!uid()) return;
  await setDoc(doc(db, 'users', uid(), 'alarms', 'main'), { alarms });
}

// 알람 불러오기
async function getAlarms() {
  if (!uid()) return null;
  const snap = await getDoc(doc(db, 'users', uid(), 'alarms', 'main'));
  return snap.exists() ? (snap.data().alarms || []) : null;
}

// 질문 저장
async function saveQuestions(questions) {
  if (!uid()) return;
  await setDoc(doc(db, 'users', uid(), 'questions', 'main'), { questions });
}

// 질문 불러오기
async function getQuestions() {
  if (!uid()) return null;
  const snap = await getDoc(doc(db, 'users', uid(), 'questions', 'main'));
  return snap.exists() ? (snap.data().questions || []) : null;
}

window.FB = { switchTab, submit, logout, saveEntry, getEntries, getEntry, saveSettings, getSettings, saveTodos, getTodos, saveHealth, getHealth, saveAlarms, getAlarms, saveQuestions, getQuestions, currentUser: () => currentUser };
