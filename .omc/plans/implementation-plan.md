# QA 협업 플랫폼 — 3단계 구현 계획

> 마감: 2026-06-10 | 오늘: 2026-05-31 | 남은 기간: 약 10일

---

## 현재 상태

- **구현된 것**: Express 서버(12줄), 빈 HTML/CSS/JS, 기획 문서만 완비
- **미구현**: DB, 라우팅, 인증, 모든 기능 0%
- **문서**: `plan/features.md`, `plan/data-model.md` 완비 — 구현 기준으로 사용

---

## 목표 파일 구조

```
webp-termProject/
├── public/
│   ├── index.html              ← 랜딩/로그인 (SPA entry)
│   ├── pages/
│   │   ├── signup.html
│   │   ├── dashboard.html
│   │   ├── projects.html
│   │   ├── project-detail.html
│   │   ├── qa.html             ← iframe fullscreen
│   │   ├── testcase.html
│   │   ├── comments.html
│   │   ├── feedback.html
│   │   ├── me.html
│   │   ├── 404.html / 401.html / 500.html
│   ├── css/
│   │   ├── style.css           ← CSS 변수 + 다크모드 + 글로벌
│   │   ├── components.css      ← 토스트/모달/스피너/사이드바
│   │   └── qa.css              ← QA 화면 전용
│   └── js/
│       ├── api.js              ← fetch wrapper (에러 통일)
│       ├── auth.js             ← 토큰 관리, 로그인 상태 확인
│       ├── router.js           ← 페이지 이동 + 권한 가드
│       ├── components/
│       │   ├── toast.js
│       │   ├── modal.js
│       │   ├── spinner.js
│       │   └── sidebar.js
│       └── pages/
│           ├── login.js, signup.js
│           ├── dashboard.js
│           ├── projects.js, project-detail.js
│           ├── qa.js
│           ├── comments.js, feedback.js
│           └── me.js
├── routes/
│   ├── auth.js                 ← POST /api/auth/signup, /login, /logout, /me
│   ├── teams.js                ← CRUD /api/teams/:teamId/...
│   ├── projects.js             ← CRUD /api/teams/:teamId/projects
│   ├── testcases.js            ← CRUD /api/projects/:projectId/testcases
│   ├── comments.js             ← CRUD /api/testcases/:testCaseId/comments
│   └── users.js                ← GET/PATCH /api/users/me, bookmarks, activity
├── middleware/
│   ├── auth.js                 ← JWT 검증 미들웨어
│   └── error.js                ← 글로벌 에러 핸들러
├── db/
│   ├── index.js                ← pg Pool 싱글턴
│   └── schema.sql              ← 8개 테이블 DDL
├── uploads/                    ← multer 이미지 저장 경로
└── server.js                   ← 라우터 마운트 + 정적 파일 서빙
```

---

## Phase 1 — 기반 구축 (5/31 ~ 6/2, 3일)

### 목표
서버 재시작 후에도 데이터 유지, 로그인/회원가입 동작, 기본 화면 3개 진입 가능

### Day 1: DB + Backend 골격

**작업 목록**
- [ ] `npm install pg bcryptjs jsonwebtoken express-session multer` 설치
- [ ] `db/schema.sql` — 8개 테이블 DDL (UUID, ENUM, FK, INDEX)
  ```sql
  -- users, teams, team_members, team_invitations
  -- projects, test_cases, comments, mcp_api_keys
  ```
- [ ] `db/index.js` — pg Pool + query 헬퍼 (`db.query(sql, params)`)
- [ ] `server.js` 재구성 — 라우터 마운트, `express.json()`, 정적 파일, 에러 핸들러
- [ ] `middleware/auth.js` — JWT Bearer 토큰 검증 (`req.user` 주입)
- [ ] `middleware/error.js` — 중앙 에러 핸들러 (`{ error, message }` 응답)
- [ ] `routes/auth.js`
  - `POST /api/auth/signup` — 이메일 중복 체크, bcrypt 해시, JWT 발급
  - `POST /api/auth/login` — 이메일/비번 검증, JWT 발급
  - `GET /api/auth/me` — 토큰으로 본인 정보 조회

**완료 기준**
- `curl -X POST /api/auth/signup` 후 DB `users` 테이블에 행 생성 확인
- `curl /api/auth/me -H "Authorization: Bearer <token>"` 200 응답

---

### Day 2: 팀/프로젝트 API + 에러 페이지

**작업 목록**
- [ ] `routes/teams.js`
  - `POST /api/teams` — 팀 생성 + 생성자 자동 멤버 등록
  - `GET /api/teams` — 내 소속 팀 목록
  - `POST /api/teams/:teamId/invite` — 이메일 초대 (TeamInvitation 생성)
  - `POST /api/teams/invitations/:token/accept` — 초대 수락
  - `GET /api/teams/:teamId/members` — 팀 멤버 목록
- [ ] `routes/projects.js`
  - `GET/POST /api/teams/:teamId/projects` — 목록/생성
  - `GET/PUT/DELETE /api/teams/:teamId/projects/:projectId` — 상세/수정/삭제
  - 권한: 팀 멤버만 접근 가능, 아니면 403
- [ ] `routes/testcases.js`
  - `GET/POST /api/projects/:projectId/testcases`
  - `GET/PUT/DELETE /api/projects/:projectId/testcases/:id`
  - `PATCH /api/projects/:projectId/testcases/:id/status` — 상태 변경
- [ ] 에러 페이지: `public/pages/404.html`, `401.html`, `500.html` (HTML + CSS)

**완료 기준**
- API 목록 모두 Postman/curl로 CRUD 동작 확인
- 비멤버가 `/api/teams/:teamId/projects` 호출 시 403 반환

---

### Day 3: 프론트엔드 기반 + 인증 화면

**작업 목록**
- [ ] `public/css/style.css` — CSS 변수 시스템
  ```css
  :root { --color-bg: #fff; --color-text: #222; ... }
  [data-theme="dark"] { --color-bg: #1a1a1a; --color-text: #eee; ... }
  ```
- [ ] `public/css/components.css` — 토스트, 모달, 스피너, 버튼, 카드 공통 스타일
- [ ] `public/js/api.js` — fetch wrapper
  ```js
  // 자동으로 Authorization 헤더, { data, error, message } 파싱
  export async function api(path, options) { ... }
  ```
- [ ] `public/js/auth.js` — localStorage JWT 관리, `requireAuth()` 가드
- [ ] `public/js/components/toast.js` — `showToast(msg, type)` 전역 함수
- [ ] `public/js/components/modal.js` — `openModal(content)`, `closeModal()`
- [ ] `public/js/components/spinner.js` — `showSpinner()`, `hideSpinner()`
- [ ] `public/index.html` + `public/js/pages/login.js` — 로그인 폼 → API 연동
- [ ] `public/pages/signup.html` + `public/js/pages/signup.js` — 회원가입

**완료 기준**
- 브라우저에서 회원가입 → 로그인 → JWT 저장 확인
- 미로그인 상태에서 `/pages/dashboard.html` 접근 시 로그인 페이지로 리다이렉트
- 다크모드 토글 버튼 클릭 시 전체 색상 변환

---

## Phase 2 — 핵심 기능 (6/3 ~ 6/6, 4일)

### 목표
팀/프로젝트/테스트케이스 전체 UI 완성, QA iframe + DOM 선택 + 댓글 작성 동작

### Day 4: 대시보드 + 프로젝트 목록 UI

**작업 목록**
- [ ] `public/pages/dashboard.html` + `dashboard.js`
  - 내 소속 팀 목록 표시, 팀 생성 모달
  - 팀 선택 → 프로젝트 목록 페이지 이동
- [ ] `public/pages/projects.html` + `projects.js`
  - 프로젝트 카드 목록 (이름, URL, 생성일)
  - 프로젝트 생성 모달 (이름 + URL 입력)
  - 키워드 검색 (프론트 필터 또는 `?q=` 쿼리 파라미터)
  - 북마크 토글 버튼 (하트 아이콘)
- [ ] `public/pages/project-detail.html` + `project-detail.js`
  - 테스트케이스 현황 파이차트 (Chart.js CDN 사용)
  - 최근 댓글 5개 미리보기
  - QA 화면 진입 버튼

**완료 기준**
- 대시보드 → 팀 선택 → 프로젝트 목록 → 프로젝트 상세 화면 진입 플로우 동작
- 파이차트에 IN_PROGRESS / DONE / FAILED 비율 표시

---

### Day 5: QA 화면 (iframe + DOM 선택 + 툴바)

**작업 목록**
- [ ] `public/pages/qa.html` + `public/css/qa.css`
  - iframe이 `100vw × 100vh` 점유
  - QA 툴바 (floating, 반투명): 햄버거, DOM선택 토글, 케이스 이름 뱃지
  - 슬라이드 사이드바 (왼쪽 오버레이)
- [ ] `public/js/pages/qa.js`
  - 툴바 DOM 선택 모드 ON/OFF
  - iframe에 `postMessage({ type: 'toggleSelect', enabled: true })` 전송
  - iframe에서 `{ type: 'elementSelected', selector, boundingRect, tagName, textContent }` 수신
  - 요소 클릭 시 댓글 작성 모달 오픈
- [ ] `routes/comments.js`
  - `POST /api/testcases/:testCaseId/comments` — selector, boundingRect, tagName, content, imageUrl
  - `GET /api/testcases/:testCaseId/comments?page=&q=&sort=` — 목록 + 검색/정렬/페이지네이션
  - `PUT/DELETE /api/testcases/:testCaseId/comments/:id` — 수정/삭제 (본인만)
- [ ] 이미지 업로드: `multer` 설정, `POST /api/upload` → `/uploads/{filename}` 저장

**완료 기준**
- QA 화면에서 DOM 선택 모드 ON → iframe 요소 클릭 → 댓글 모달 팝업
- 댓글 작성 후 사이드바 댓글 목록 갱신
- 비본인 댓글 수정/삭제 버튼 비표시

---

### Day 6: 댓글 목록 + 필터/검색/페이지네이션

**작업 목록**
- [ ] `public/pages/comments.html` + `comments.js` — 댓글 모아보기
  - URL 계층 구조 (아코디언 그룹핑)
  - 키워드 검색, 상태 필터, 테스트케이스 필터, 정렬
  - 페이지네이션 (10개/페이지)
  - 댓글 카드: 내용 truncate, DOM 선택자, 상태 뱃지, 썸네일
- [ ] `public/pages/feedback.html` + `feedback.js` — 개발자 피드백 목록
  - 같은 댓글 데이터, 다른 뷰 (개발자 시점)
  - 테스트케이스 필터, 상태 필터, 날짜순 정렬
  - 페이지네이션
- [ ] Backend: `GET /api/teams/:teamId/comments` — 팀 전체 댓글 목록 (URL 그룹핑 포함)

**완료 기준**
- 댓글 10개 이상 생성 후 페이지네이션 동작 확인
- 키워드 검색으로 필터링 동작
- URL 그룹 아코디언 펼치기/닫기

---

### Day 7: 팀 초대 + 테스트케이스 상세

**작업 목록**
- [ ] `public/pages/testcase.html` + `testcase.js`
  - 테스트케이스 상세 뷰 (댓글 목록 + 상태 변경 버튼)
  - 테스트케이스 수정/삭제
- [ ] 팀 초대 UI (이메일 입력 → 초대 토큰 생성)
- [ ] 초대 수락 페이지 (`/invite/:token`)
- [ ] `POST /api/teams/:teamId/mcp-keys` — MCP API 키 발급
- [ ] `GET /api/teams/:teamId/mcp-keys` — 발급된 키 목록

**완료 기준**
- 이메일 초대 → 수락 → 팀 멤버 목록에 추가 확인
- MCP API 키 발급 및 표시

---

## Phase 3 — 완성 + 고도화 (6/7 ~ 6/10, 4일)

### 목표
Google OAuth, 마이페이지, CSV/PDF 내보내기, 반응형, 권한 완성, 발표 준비

### Day 8: Google OAuth + 마이페이지

**작업 목록**
- [ ] `npm install passport passport-google-oauth20`
- [ ] `routes/auth.js` — Google OAuth 콜백 (`/api/auth/google`, `/api/auth/google/callback`)
  - 기존 계정 있으면 연결, 없으면 자동 가입
- [ ] 로그인 페이지에 Google 로그인 버튼 추가
- [ ] `public/pages/me.html` + `me.js`
  - 프로필 수정 (이름 변경)
  - 소속 팀 목록
  - 내 댓글 수 + 최근 활동 이력 (최신 10개)
  - 계정 삭제 버튼 (확인 모달)
- [ ] `routes/users.js`
  - `GET /api/users/me/activity` — 최근 활동 이력
  - `POST /api/users/me/bookmarks/:projectId` — 북마크 추가/제거
  - `GET /api/users/me/bookmarks` — 북마크 목록
  - `DELETE /api/users/me` — 계정 삭제

**완료 기준**
- Google 로그인 → JWT 발급 → 동일한 인증 플로우
- 마이페이지에서 이름 수정 후 반영 확인
- 북마크 추가/제거 + 프로젝트 목록에서 북마크 강조 표시

---

### Day 9: CSV/PDF 내보내기 + 이미지 업로드 UI

**작업 목록**
- [ ] `npm install pdfkit csv-writer`
- [ ] `GET /api/projects/:projectId/export?format=csv` — CSV 내보내기
  - 테스트케이스별 댓글 리포트 (케이스명, 상태, 댓글내용, 선택자, 날짜)
- [ ] `GET /api/projects/:projectId/export?format=pdf` — PDF 내보내기
  - 프로젝트명 헤더, 테스트케이스별 섹션, 댓글 목록
- [ ] 피드백 목록 페이지에 내보내기 버튼 (CSV / PDF 선택)
- [ ] 댓글 작성 모달 — 이미지 첨부 UI (파일 선택 → 미리보기 썸네일 → 업로드)
- [ ] 댓글 카드에서 이미지 클릭 시 원본 확대 모달

**완료 기준**
- CSV 내보내기 버튼 클릭 → `.csv` 파일 다운로드
- PDF 내보내기 버튼 클릭 → `.pdf` 파일 다운로드
- 이미지 첨부 댓글 저장 후 썸네일 표시

---

### Day 10: 반응형 + 권한 완성 + 마무리

**작업 목록**
- [ ] 반응형 UI 적용 (QA 화면 제외 모든 페이지)
  - 브레이크포인트: `768px` (태블릿), `480px` (모바일)
  - 사이드바 모바일에서 햄버거 메뉴로 전환
- [ ] 권한 완성
  - `middleware/auth.js` — 모든 `/api/*` 라우트에 JWT 검증 적용
  - 팀 멤버십 체크 미들웨어 (`requireTeamMember`)
  - 본인 리소스 체크 (댓글 수정/삭제)
- [ ] 입력 유효성 검사 완성
  - 이메일 형식, 필수값, 비밀번호 최소 길이
  - 백엔드 + 프론트 모두 검증
- [ ] 로딩 상태 UX 완성 (모든 API 요청에 스피너 적용)
- [ ] 에러 상태 UX 완성 (네트워크 오류, 서버 오류 토스트)
- [ ] `plan/agent-log-w2.md`, `plan/agent-log-w3.md` 작성
- [ ] README: 실행 방법 (`npm install`, DB 설정, `npm start`)

**완료 기준**
- 모바일(480px)에서 주요 페이지 깨짐 없음 확인
- 비멤버 팀 접근 → 401 에러 페이지 표시
- 전체 CLAUDE.md 체크리스트 90% 이상 완료

---

## 우선순위 요약

| 우선순위 | 항목 | 이유 |
|---------|------|------|
| P0 (필수) | DB + Auth + CRUD | Layer 1 — 데이터 유지, 인증 없으면 모든 기능 불가 |
| P0 (필수) | QA iframe + DOM 선택 + 댓글 | 이 프로젝트의 핵심 기능 |
| P1 (중요) | 파이차트, 검색/필터/페이지네이션 | Layer 2 — 데이터 처리 |
| P1 (중요) | 반응형, 다크모드, 토스트/모달 | Layer 3 — UX |
| P2 (고도화) | Google OAuth, CSV/PDF 내보내기 | 차별화 기능 |
| P3 (여유시) | MCP 설정 UI, 팀 초대 플로우 | 보너스 기능 |

---

## 패키지 설치 명령

```bash
npm install pg bcryptjs jsonwebtoken multer pdfkit
npm install passport passport-google-oauth20
npm install --save-dev nodemon
```

## 환경 변수 (.env)

```
PORT=3000
DATABASE_URL=postgresql://localhost:5432/qa_platform
JWT_SECRET=your-secret-key
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SESSION_SECRET=...
```
