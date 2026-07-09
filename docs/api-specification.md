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

### [GET] /api/schedules

**목적:** 로그인한 유저의 모든 행정 일정 목록을 최신 임박(마감일 빠른)순으로 조회합니다. JWT 인증 필수.

**요청 파라미터:**
*   Header: `Authorization: Bearer <JWT>`

**응답 형식:** (200)
```json
{
  "success": true,
  "message": "전체 행정 일정 조회가 성공적으로 완료되었습니다.",
  "data": {
    "schedules": [
      {
        "id": 3,
        "user_id": 1,
        "title": "체류지 변경 신고 (전입신고)",
        "description": "이사 완료일로부터 14일 이내에 새로운 체류지를 전입 신고해야 합니다.",
        "due_date": "2026-07-23T00:00:00.000Z",
        "completed": false,
        "document_type": "부동산 임대차 계약서",
        "created_at": "2026-07-09T20:10:00.000Z",
        "updated_at": "2026-07-09T20:10:00.000Z"
      }
    ]
  }
}
```

---

### [POST] /api/schedules

**목적:** 개별 맞춤 행정 일정을 수동으로 생성합니다. JWT 인증 필수.

**요청 파라미터:**
*   Header: `Authorization: Bearer <JWT>`
*   Body:
    | 필드 | 타입 | 필수 | 설명 |
    |------|------|------|------|
    | title | string | O | 일정 제목 (예: "여권 갱신 예약") |
    | description | string | X | 일정 내용 상세 설명 |
    | dueDate | string | O | 마감 기한 및 일정 일시 (Date/Datetime 형태) |
    | documentType | string | X | 연관된 서류 명칭 |
    | completed | boolean | X | 일정 완료 여부 (기본값: false) |

**응답 형식:** (201)
```json
{
  "success": true,
  "message": "새로운 행정 일정이 성공적으로 등록되었습니다.",
  "data": {
    "schedule": {
      "id": 5,
      "user_id": 1,
      "title": "여권 갱신 예약",
      "description": "출입국관리무소 방문 전 여권 갱신 신청 접수",
      "due_date": "2026-08-01 10:00:00",
      "completed": false,
      "document_type": null,
      "created_at": "2026-07-09T20:12:00.000Z",
      "updated_at": "2026-07-09T20:12:00.000Z"
    }
  }
}
```

---

### [POST] /api/schedules/auto-generate

**목적:** 서류 분석 후, 입력한 기준 날짜(이사일, 입국일, 취업일 등)를 기반으로 법령상 기한이 있는 서류들의 스케줄을 일괄 자동 생성 및 DB에 등록합니다. JWT 인증 필수.

**요청 파라미터:**
*   Header: `Authorization: Bearer <JWT>`
*   Body:
    | 필드 | 타입 | 필수 | 설명 |
    |------|------|------|------|
    | documentType | string | O | 서류 타입 ('임대차계약서', '외국인등록증', '근로계약서' 중 하나) |
    | baseDate | string | O | 기준 날짜 (예: "2026-07-09") |

**응답 형식:** (201)
```json
{
  "success": true,
  "message": "총 3개의 관련 법적 마감 행정 일정이 캘린더에 성공적으로 자동 생성되었습니다.",
  "data": {
    "schedules": [
      {
        "id": 10,
        "user_id": 1,
        "title": "임대차 계약 확정일자 부여 신청",
        "description": "보증금 권리 확보(우선변제권 획득)를 위해 이사 당일 확정일자를 동 주민센터 또는 대법원 인터넷등기소에서 즉시 발급받으세요.",
        "due_date": "2026-07-09 00:00:00",
        "completed": false,
        "document_type": "부동산 임대차 계약서",
        "created_at": "2026-07-09T20:13:00.000Z",
        "updated_at": "2026-07-09T20:13:00.000Z"
      },
      {
        "id": 11,
        "user_id": 1,
        "title": "체류지 변경 신고 (전입신고)",
        "description": "출입국관리법 제36조에 따라, 전입완료 후 반드시 14일 이내 새로운 거주지를 등록해야 합니다. 불이행 시 최대 100만 원 과태료 대상.",
        "due_date": "2026-07-23 00:00:00",
        "completed": false,
        "document_type": "부동산 임대차 계약서",
        "created_at": "2026-07-09T20:13:00.000Z",
        "updated_at": "2026-07-09T20:13:00.000Z"
      }
    ]
  }
}
```

---

### [PATCH] /api/schedules/:id

**목적:** 등록된 일정의 내용, 마감기한, 완료여부 등을 수정합니다. 본인의 일정만 수정 가능. JWT 인증 필수.

**요청 파라미터:**
*   Header: `Authorization: Bearer <JWT>`
*   Path: `id` (일정 ID)
*   Body: 수정하고 싶은 필드만 전달 (`title`, `description`, `dueDate`, `completed`, `documentType` 중 선택)

**응답 형식:** (200)
```json
{
  "success": true,
  "message": "행정 일정이 성공적으로 수정되었습니다.",
  "data": {
    "schedule": {
      "id": 10,
      "user_id": 1,
      "title": "임대차 계약 확정일자 부여 신청",
      "description": "완료 및 증빙 보관 완료",
      "due_date": "2026-07-09 00:00:00",
      "completed": true,
      "document_type": "부동산 임대차 계약서",
      "created_at": "2026-07-09T20:13:00.000Z",
      "updated_at": "2026-07-09T20:15:00.000Z"
    }
  }
}
```

---

### [DELETE] /api/schedules/:id

**목적:** 특정 일정을 삭제합니다. 본인의 일정만 삭제 가능. JWT 인증 필수.

**요청 파라미터:**
*   Header: `Authorization: Bearer <JWT>`
*   Path: `id` (일정 ID)

**응답 형식:** (200)
```json
{
  "success": true,
  "message": "행정 일정이 정상적으로 삭제되었습니다."
}
```

---

### [POST] /api/translation/translate

**목적:** 일반적인 구글 렌즈 추출 날것의 텍스트 오타/줄바꿈을 보정하고 사용자가 원하는 특정 언어로 번역 및 교정 노트를 작성합니다. (순수 일반 문장 번역 전용)

**요청 파라미터:**

| 위치 | 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|------|
| Body | text | string | O | 구글 렌즈로 추출한 원본 다국어 텍스트 |
| Body | targetLanguage | string | X | 타겟 번역 언어 코드 (기본값: `"ko"`) |
| Body | sourceLanguage | string | X | 감지 소스 언어 코드 (기본값: `"auto"`) |
| Body | format | string | X | 보고서 파일 저장 아웃풋 형식 (`"md"` 또는 `"txt"`, 기본값: `"md"`) |

**응답 형식:** (200)
```json
{
  "success": true,
  "message": "구글 렌즈 일반 텍스트 번역 및 오타 보정이 성공적으로 완료되었습니다.",
  "data": {
    "originalText": "안녕하셔요 반갑습네다 오늘 날시가 참 조내요",
    "correctedText": "안녕하세요 반갑습니다 오늘 날씨가 참 좋네요 (AI 보정 완료)",
    "translatedText": "[Mock Translation - 영어 (English)] ... Hello, Nice to meet you. Today's weather is really good ...",
    "explanation": "이 모의 응답은 순수 번역 Sandbox용입니다. 타겟 언어: en, 감지 소스: auto",
    "fileName": "translation_1720567200000_abc123.md",
    "downloadUrl": "http://localhost:3000/downloads/translation_1720567200000_abc123.md"
  }
}
```

---

### [POST] /api/documents/analyze

**목적:** 이민자가 전송한 오타 가득한 행정 서류(임대차계약서, 외국인등록증, 근로계약서 등)의 핵심 정보를 감지하여 **서류 유형 식별, 구체적 실천 지침(Action Plan), 벌금 및 신고기한 가이드(Legal Obligations), 연계 후속 제출 서류 로드맵**을 일체로 종합 보고서 형태로 도출해 주는 특화 엔진입니다. (사용자 요구사항 구현 핵심 도메인)

**요청 파라미터:**

| 위치 | 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|------|
| Body | text | string | O | 구글 렌즈 등으로 획득한 오타 가득한 원본 서류 텍스트 내용 |
| Body | targetLanguage | string | X | 번역해서 전달받을 대상 언어 코드 (기본값: `"ko"`) |
| Body | sourceLanguage | string | X | 소스 언어 감지 코드 (기본값: `"auto"`) |
| Body | format | string | X | 종합 서류 보고서 파일 저장 확장자 (`"md"` 또는 `"txt"`, 기본값: `"md"`) |

**응답 형식:** (200)
```json
{
  "success": true,
  "message": "구글 렌즈 이민 서류 분석 및 연계 로드맵 산출이 성공적으로 완료되었습니다.",
  "data": {
    "originalText": "보증금 1000만원 월세 50만원 전세 계약서입니다. 임대인과 임차인 계약 완료",
    "correctedText": "보증금 1000만원 월세 50만원 전세 계약서입니다. 임대인과 임차인 계약 완료 (AI 보정 완료)",
    "translatedText": "[Mock Translation - 영어 (English)] ...",
    "documentType": "부동산 임대차 계약서 (Housing Lease Agreement)",
    "explanation": "이 모의 응답은 Sandbox 개발 및 테스트용입니다. 실제로 작동하려면 .env에 유효한 구글 AI API 키를 입력해 주세요. 타겟 언어: en, 감지 소스: auto",
    "actionPlan": [
      "계약서 상의 보증금 및 월세 금액, 납부일을 다시 한 번 검토하세요.",
      "임대인(집주인)과 임차인(본인)의 신원 정보가 신분증과 일치하는지 대조하십시오.",
      "계약 잔금을 납부하고 열쇠를 수령한 당일, 반드시 주민센터나 인터넷등기소에서 확정일자를 받으십시오."
    ],
    "legalObligations": [
      "주택임대차보호법에 따라 임대차 계약 체결일(계약금 가계약 포함)로부터 30일 이내에 주택 임대차 신고(전월세 신고)를 해야 합니다. (지연 시 과태료 발생)",
      "출입국관리법 제36조에 따라, 이사 후 반드시 **14일 이내**에 체류지 변경 신고를 마쳐야 합니다. 기한 초과 시 출입국관리법 위반으로 최대 100만 원 이하의 과태료가 부과됩니다."
    ],
    "nextRoadmap": {
      "currentStep": "주거 계약 완료 및 한국 내 주소지 확정 단계",
      "nextSteps": [
        {
          "documentName": "체류지 변경신고서 (Report of Change of Residence)",
          "description": "임대차 계약서 사본과 외국인등록증을 제출하여 법적인 거주지 등록을 완료하는 행정 절차입니다.",
          "deadline": "이사 입주 완료일로부터 14일 이내",
          "howToApply": "거주지 관할 주민센터 방문(동주민센터 추천), 관할 출입국사무소 방문, 또는 하이코리아(Hikorea.go.kr)에서 온라인 신청"
        },
        {
          "documentName": "주택 임대차 계약 확정일자 부여 신청 (Application for Fixed Date)",
          "description": "임대인 사정으로 집이 경매에 넘어갈 경우 보증금을 우선적으로 보호받기 위한(우선변제권 확보) 법적 장치입니다.",
          "deadline": "잔금 지급 및 입주 완료 당일 즉시 처리 권장",
          "howToApply": "관할 동 주민센터 방문(계약서 원본 지참 필수) 또는 대법원 인터넷등기소 홈페이지 온라인 신청"
        }
      ]
    },
    "fileName": "document_analysis_1720567210000_xyz789.md",
    "downloadUrl": "http://localhost:3000/downloads/document_analysis_1720567210000_xyz789.md"
  }
}
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
