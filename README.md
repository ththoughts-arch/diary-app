# 나의 일기장 📖

AI가 정리해주는 음성 일기 웹앱

## 기술 스택

- **Frontend**: HTML + CSS + Vanilla JS (프레임워크 없음, 설치 불필요)
- **AI**: Claude API (Sonnet 4)
- **날씨**: OpenWeatherMap API
- **음성 입력**: Web Speech API (브라우저 기본)
- **데이터 저장**: LocalStorage
- **배포**: GitHub Pages / Firebase Hosting / Netlify (정적 파일)

## 파일 구조

```
diary-app/
├── index.html          # 앱 진입점 (전체 화면 구조)
├── manifest.json       # PWA 설정
├── css/
│   └── style.css       # 전체 스타일
└── js/
    ├── store.js        # 로컬스토리지 데이터 관리
    ├── api.js          # Claude API + 날씨 API 연동
    ├── app.js          # 앱 초기화, 화면 전환, 홈 렌더링
    ├── todo.js         # 할 일 관리
    ├── record.js       # 기록 화면 (음성 입력, 가민 파싱)
    ├── report.js       # 리포트 화면
    ├── settings.js     # 설정, 캘린더, 드로어, 날씨, 알림 (통합)
    └── drawer.js       # (settings.js 내 포함)
```

## 빠른 시작

### 1. 로컬 실행

```bash
# Python 서버 (Python 3)
cd diary-app
python3 -m http.server 3000

# 또는 Node.js
npx serve .
```

브라우저에서 `http://localhost:3000` 접속

### 2. API 키 설정

앱을 처음 실행하면 Claude API 키 입력 창이 나타납니다.

**Claude API 키 발급**: https://console.anthropic.com

> ⚠️ **보안 주의**: 클라이언트 사이드에서 API 키를 직접 사용하는 것은 개인 용도에만 권장합니다.
> 다른 사람과 공유하는 경우 반드시 서버 프록시를 통해 API를 호출하세요.

**OpenWeatherMap 키 설정** (`js/api.js` 파일의 `WEATHER_KEY` 변수):
```javascript
const WEATHER_KEY = 'YOUR_OPENWEATHERMAP_API_KEY';
```
발급: https://openweathermap.org/api (무료 플랜 사용 가능)

### 3. GitHub Pages 배포

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/diary-app.git
git push -u origin main
```

GitHub 저장소 Settings → Pages → Source: main branch 선택

## 주요 기능

| 기능 | 구현 방식 |
|------|----------|
| 음성 입력 (실시간 STT) | Web Speech API `SpeechRecognition` |
| 일기 AI 변환 | Claude API `claude-sonnet-4-20250514` |
| 가민 스크린샷 파싱 | Claude Vision API (base64 이미지) |
| 건강 AI 추천 | Claude API (수면/스트레스 분석) |
| 할 일 자동 추출 | Claude API (최근 일기 분석) |
| 주간/월간 리포트 | Claude API (일기 종합 분석) |
| 날씨 자동 입력 | OpenWeatherMap Forecast API |
| 우산 알림 | 날씨 데이터 조건부 표시 |
| 알람 | Web Notifications API + setTimeout |
| 오프라인 저장 | LocalStorage |
| PWA (홈 화면 추가) | manifest.json + Service Worker |
| 다크 모드 | CSS class 토글 |

## 다음 단계 (선택적 확장)

- **Firebase 인증**: 멀티 디바이스 동기화
- **Firestore**: 클라우드 데이터 저장
- **서버 프록시**: API 키 보안 강화
- **Service Worker**: 완전한 오프라인 지원 + 푸시 알림
- **Android WebView**: 앱스토어 등록용 래핑
- **iOS**: Capacitor 또는 PWA로 App Store 등록

## 브라우저 지원

- Chrome / Chromium (권장) - 음성 인식 완전 지원
- Safari (iOS) - 음성 인식 부분 지원 (`webkitSpeechRecognition`)
- Firefox - 음성 인식 미지원 (텍스트 입력만 가능)
