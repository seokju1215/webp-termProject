# 기술 아키텍처

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | Vanilla HTML / CSS / JavaScript |
| 백엔드 | Node.js + Express |
| 패키지 매니저 | npm |
| DB | PostgreSQL |

---

## 전체 아키텍처

```
┌─────────────────────────────────────────────┐
│         우리 서비스 (Vanilla HTML/CSS/JS)      │
│                                             │
│  ┌──────────────┐    ┌──────────────────┐  │
│  │  QA 툴바     │    │  사이드바/대시보드  │  │
│  │  (오버레이)   │    │  기획자/개발자 UI  │  │
│  └──────┬───────┘    └──────────────────┘  │
│         │                                   │
│  ┌──────▼───────────────────────────────┐  │
│  │     iframe (개발자 프로젝트)            │  │
│  │                                      │  │
│  │   ┌─────────────────────────────┐   │  │
│  │   │  Agentation (외부 API)      │   │  │
│  │   │  - DOM 선택 처리             │   │  │
│  │   │  - 어노테이션 UI 레이어       │   │  │
│  │   └─────────────────────────────┘   │  │
│  └──────────────────────────────────────┘  │
└──────────────────┬──────────────────────────┘
                   │ REST API (Express)
         ┌─────────▼─────────┐
         │  Node.js + Express │
         └─────────┬─────────┘
         ┌─────────▼─────────┐
         │   PostgreSQL DB    │
         │  (댓글, DOM 위치,  │
         │   테스트케이스 등)  │
         └─────────┬─────────┘
                   │
         ┌─────────▼─────────┐
         │    MCP Server      │
         │  댓글 + DOM 정보   │
         │  → 개발자 AI 도구  │
         └───────────────────┘
```

---

## Agentation 연동 흐름

```
[사전 설정 — 개발자]
대상 프로젝트에 npm install agentation 설치
→ Agentation 초기화 코드 추가 (우리 서비스 webhook URL 포함)
→ X-Frame-Options 헤더 제거

[QA 진행 — 기획자]
1. iframe으로 대상 프로젝트 로드
   → 대상 사이트에 설치된 Agentation 스크립트 활성화
   → 브라우저 우측 하단에 Agentation 아이콘 표시

3. 기획자가 DOM 요소에 마우스 오버 → 요소 하이라이트

4. 요소 클릭 → Agentation 주석 UI 표시
   → CSS selector, 소스 파일 경로, 컴포넌트 계층 자동 캡처

5. 기획자가 피드백 내용 작성 후 제출
   → Agentation이 Webhook으로 우리 백엔드에 POST
   { selector, feedback, cssInfo, componentTree, pageUrl }

6. 우리 백엔드가 Webhook 수신
   → projectId + pageUrl 기준으로 Comment로 DB 저장
```

---

## MCP 서버 연동 흐름

```
1. 개발자가 우리 서비스에서 API 키 발급
2. AI 도구(Claude, Cursor 등)에 MCP 서버 연결
3. 개발자가 AI에게 "QA 피드백 반영해줘" 요청
4. MCP 서버가 DB에서 댓글 + DOM 위치 정보 조회
5. AI가 해당 정보를 컨텍스트로 참고해 코드 수정
```

---

## 프로젝트 등록 요구사항

- 로컬 개발 서버: ngrok / cloudflare tunnel 등으로 HTTPS URL 발급 필수
- 스테이징/프로덕션: URL 직접 등록
- Agentation 연동 설정 및 X-Frame-Options 헤더 제거 필수
