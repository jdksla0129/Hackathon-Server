# API 명세서

Express + TypeScript 기반 Hackathon Server의 API 명세입니다.

- Base URL: `http://localhost:{PORT}`
- 인증 방식: JWT Bearer Token (`Authorization: Bearer <token>`)
- 공통 응답 형식: `{ "success": boolean, "message": string, "data"?: object }`
- Rate Limit: `/api/auth/google*` 경로는 IP당 15분에 최대 100회 요청 제한 (초과 시 429 응답)

### User 객체 구조

```json
{
  "id": 1,
  "google_id": "1234567890",
  "email": "user@example.com",
  "name": "홍길동",
  "picture": "https://lh3.googleusercontent.com/...",
  "nationality": "KR",
  "created_at": "2026-07-09T00:00:00.000Z",
  "updated_at": "2026-07-09T00:00:00.000Z"
}
```

---

### [GET] /health

**목적:** 서버 상태 확인용 헬스체크 (핑 테스트)

**요청 파라미터:** 없음

**응답 형식:**
```json
{
  "status": "ok",
  "timestamp": "2026-07-09T00:00:00.000Z",
  "message": "Express + TS Server is running smoothly!"
}
```

**에러 코드:** 없음 (항상 200)

**예시:**
```bash
curl http://localhost:3000/health
```

---

### [POST] /api/auth/google

**목적:** 클라이언트(안드로이드/앱)가 보낸 Google OAuth `id_token`을 검증하여 로그인/회원가입 처리 후 JWT 발급

**요청 파라미터:**

| 위치 | 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|------|
| Body | idToken | string | O | Google OAuth id_token |

**응답 형식:** (200)
```json
{
  "success": true,
  "message": "Google OAuth 로그인 성공",
  "data": {
    "token": "<JWT>",
    "user": { "...User 객체..." }
  }
}
```
> Sandbox 환경에서 Mock 로그인 시 message는 `"Mock 로그인 성공 (Sandbox)"`

**에러 코드:**

| 코드 | 조건 | 메시지 |
|------|------|--------|
| 400 | idToken 누락 | `idToken 필드가 누락되었습니다. Google OAuth id_token을 전송해야 합니다.` |
| 401 | 토큰 검증/로그인 실패 | production: `구글 인증 및 로그인 처리에 실패했습니다.` / 개발: 상세 에러 메시지 |
| 429 | Rate Limit 초과 | `단기간에 너무 많은 로그인 요청이 발생했습니다. 15분 후에 다시 시도해 주세요.` |

**예시:**
```bash
curl -X POST http://localhost:3000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken": "eyJhbGciOiJSUzI1NiIs..."}'
```

---

### [GET] /api/auth/google/login

**목적:** 웹 브라우저용 — Google 동의 화면(Consent URL)으로 302 리다이렉트

**요청 파라미터:** 없음

**응답 형식:** 302 리다이렉트 (`Location: https://accounts.google.com/o/oauth2/v2/auth?...`)

**에러 코드:**

| 코드 | 조건 | 메시지 |
|------|------|--------|
| 500 | 인증 URL 생성 실패 | `구글 인증 페이지를 생성하는 도중 오류가 발생했습니다.` |
| 429 | Rate Limit 초과 | `단기간에 너무 많은 로그인 요청이 발생했습니다. 15분 후에 다시 시도해 주세요.` |

**예시:**
```bash
curl -v http://localhost:3000/api/auth/google/login
# 브라우저에서는 그대로 접속: http://localhost:3000/api/auth/google/login
```

---

### [GET] /api/auth/google/callback

**목적:** Google 동의 후 콜백으로 전달된 `code`를 토큰과 교환하여 로그인/회원가입 처리 후 JWT 발급

**요청 파라미터:**

| 위치 | 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|------|
| Query | code | string | O | Google이 발급한 authorization code |
| Query | state | string | O | CSRF 방지용 state 값 |

**응답 형식:** (200)
```json
{
  "success": true,
  "message": "Google OAuth 로그인 성공",
  "data": {
    "token": "<JWT>",
    "user": { "...User 객체..." }
  }
}
```
> 추후 프론트 주소 확정 시 `FRONTEND_URL?token=...` 리다이렉트 방식으로 교체 예정

**에러 코드:**

| 코드 | 조건 | 메시지 |
|------|------|--------|
| 400 | code 또는 state 누락 | `인증 인자(code, state)가 누락되어 로그인 처리를 진행할 수 없습니다.` |
| 401 | code 교환/로그인 실패 | production: `구글 로그인 콜백 처리에 실패했습니다.` / 개발: 상세 에러 메시지 |
| 429 | Rate Limit 초과 | `단기간에 너무 많은 로그인 요청이 발생했습니다. 15분 후에 다시 시도해 주세요.` |

**예시:**
```bash
curl "http://localhost:3000/api/auth/google/callback?code=4/0AX...&state=abc123"
```

---

### [GET] /api/auth/profile

**목적:** JWT 인증을 완료한 유저의 프로필 조회

**요청 파라미터:**

| 위치 | 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|------|
| Header | Authorization | string | O | `Bearer <JWT>` |

**응답 형식:** (200)
```json
{
  "success": true,
  "message": "유저 프로필 조회 성공",
  "data": {
    "user": { "...User 객체..." }
  }
}
```

**에러 코드:**

| 코드 | 조건 | 메시지 |
|------|------|--------|
| 401 | 토큰 누락/무효 | `로그인이 필요합니다.` 등 인증 미들웨어 에러 |
| 500 | 서버 내부 오류 | `서버 내부 오류가 발생했습니다.` |

**예시:**
```bash
curl http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

---

### [PATCH] /api/auth/nationality

**목적:** 로그인한 유저의 국적(nationality) 선택 및 저장

**요청 파라미터:**

| 위치 | 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|------|
| Header | Authorization | string | O | `Bearer <JWT>` |
| Body | nationality | string | O | 저장할 국적 값 (예: `"KR"`) |

**응답 형식:** (200)
```json
{
  "success": true,
  "message": "국적 저장 성공",
  "data": {
    "user": { "...업데이트된 User 객체..." }
  }
}
```

**에러 코드:**

| 코드 | 조건 | 메시지 |
|------|------|--------|
| 400 | nationality 누락 | `nationality 필드가 누락되었습니다.` |
| 400 | 저장 실패 | production: `국적 정보를 저장하는 데 실패했습니다.` / 개발: 상세 에러 메시지 |
| 401 | 토큰 누락/무효 | `로그인이 필요합니다.` |

**예시:**
```bash
curl -X PATCH http://localhost:3000/api/auth/nationality \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{"nationality": "KR"}'
```

---

## 공통 에러 응답

### 404 Not Found
존재하지 않는 경로 요청 시:
```json
{
  "success": false,
  "message": "요청하신 경로 (/api/unknown)를 찾을 수 없습니다."
}
```

### 500 Internal Server Error (전역 에러 핸들러)
```json
{
  "success": false,
  "message": "서버 내부에서 에러가 발생했습니다. 지속 발생 시 관리자에게 문의하세요."
}
```
> production 모드에서는 상세 에러 메시지가 은폐되고 위와 같은 일반 메시지만 반환됩니다.
