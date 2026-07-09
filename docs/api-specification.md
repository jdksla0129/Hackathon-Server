# API 명세서

이민/행정 지원 백엔드 서버 (Express + TypeScript)

- Base URL: `http://localhost:{PORT}`
- 공통 응답 형식: `{ "success": boolean, "message"?: string, "data"?: object }`
- 인증: 🔒 표시된 API는 `Authorization: Bearer <JWT>` 헤더 필수
- Rate Limit: `/api/auth/google` 경로는 IP당 15분에 100회 제한 (초과 시 429)
- Swagger UI: `GET /api-docs`

---

## 헬스체크

### [GET] /health

**목적:** 서버 기동 상태 확인용 핑 테스트

**요청 파라미터:** 없음

**응답 형식:**
```json
{
  "status": "ok",
  "timestamp": "2026-07-10T00:00:00.000Z",
  "message": "Express + TS Server is running smoothly!"
}
```

**에러 코드:** 없음

**예시:**
```bash
curl http://localhost:3000/health
```

---

## 인증 (Auth)

### [POST] /api/auth/google

**목적:** 클라이언트(안드로이드/앱)가 획득한 Google `id_token`으로 로그인/회원가입 처리 후 백엔드 JWT 발급

**요청 파라미터:** (Body, JSON)
| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| idToken | string | ✅ | Google OAuth id_token |

**응답 형식:** (200)
```json
{
  "success": true,
  "message": "Google OAuth 로그인 성공",
  "data": {
    "token": "<JWT, 7일 유효>",
    "user": { "id": 1, "google_id": "...", "email": "...", "name": "...", "picture": "...", "nationality": "KR" },
    "hasNationality": true
  }
}
```

**에러 코드:**
| 코드 | 상황 |
|---|---|
| 400 | `idToken` 필드 누락 |
| 401 | 토큰 검증 실패, 이메일 미인증 계정 등 |
| 429 | Rate Limit 초과 (15분/100회) |

**예시:**
```bash
curl -X POST http://localhost:3000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken": "<google-id-token>"}'
```

---

### [GET] /api/auth/google/login

**목적:** 웹 브라우저용 — 구글 동의 화면(Consent URL)으로 302 리다이렉트 (CSRF 방지용 state 발급 포함)

**요청 파라미터:** 없음

**응답 형식:** 302 Redirect → Google OAuth 동의 화면

**에러 코드:**
| 코드 | 상황 |
|---|---|
| 500 | 인증 URL 생성 실패 |

**예시:** 브라우저에서 `http://localhost:3000/api/auth/google/login` 접속

---

### [GET] /api/auth/google/callback

**목적:** 구글 로그인 콜백 처리 — state 검증(CSRF 방지, 10분 TTL, 1회용) 후 code를 토큰으로 교환하고 JWT 발급

**요청 파라미터:** (Query)
| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| code | string | ✅ | 구글이 전달한 인증 코드 |
| state | string | ✅ | `/google/login`에서 발급된 state 값 |

**응답 형식:** (200) — `POST /api/auth/google`과 동일한 `data` 구조

**에러 코드:**
| 코드 | 상황 |
|---|---|
| 400 | code 또는 state 누락 |
| 401 | state 검증 실패(만료/불일치), 토큰 교환 실패 |

**예시:** 구글이 자동 호출 — `GET /api/auth/google/callback?code=...&state=...`

---

### [GET] /api/auth/profile 🔒

**목적:** JWT 인증된 사용자의 최신 프로필 조회 (DB 실시간 조회)

**요청 파라미터:** 없음 (Header: `Authorization: Bearer <token>`)

**응답 형식:** (200)
```json
{
  "success": true,
  "message": "유저 프로필 조회 성공",
  "data": {
    "user": { "id": 1, "email": "...", "name": "...", "picture": "...", "nationality": "KR" }
  }
}
```

**에러 코드:**
| 코드 | 상황 |
|---|---|
| 401 | 토큰 누락 / 로그아웃된 토큰 / 사용자 없음 |
| 403 | 유효하지 않거나 만료된 토큰 |
| 500 | 서버 내부 오류 |

**예시:**
```bash
curl http://localhost:3000/api/auth/profile -H "Authorization: Bearer <JWT>"
```

---

### [POST] /api/auth/logout 🔒

**목적:** 현재 JWT를 서버 측 블랙리스트에 등록하여 즉시 무효화 (토큰의 exp 시각까지 보관, 이후 자동 정리)

**요청 파라미터:** 없음 (Header: `Authorization: Bearer <token>`)

**응답 형식:** (200)
```json
{ "success": true, "message": "로그아웃 성공" }
```

**에러 코드:**
| 코드 | 상황 |
|---|---|
| 401 | 토큰 누락 / 이미 로그아웃된 토큰 |
| 403 | 유효하지 않거나 만료된 토큰 |
| 500 | 서버 내부 오류 |

**예시:**
```bash
curl -X POST http://localhost:3000/api/auth/logout -H "Authorization: Bearer <JWT>"
```

---

### [PATCH] /api/auth/nationality 🔒

**목적:** 로그인한 사용자의 국적(ISO 3166-1 alpha-2)을 저장

**요청 파라미터:** (Body, JSON)
| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| nationality | string | ✅ | 국적 코드 (예: "KR", "US"). 소문자 입력 시 자동 대문자 정규화 |

**응답 형식:** (200)
```json
{
  "success": true,
  "message": "국적 저장 성공",
  "data": { "user": { "id": 1, "email": "...", "nationality": "KR" } }
}
```

**에러 코드:**
| 코드 | 상황 |
|---|---|
| 400 | nationality 누락 또는 ISO alpha-2 형식 위반 |
| 401 | 인증 실패 |

**예시:**
```bash
curl -X PATCH http://localhost:3000/api/auth/nationality \
  -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" \
  -d '{"nationality": "KR"}'
```

---

## 번역 (Translation)

### [POST] /api/translation/translate

**목적:** 구글 렌즈 OCR 텍스트의 오타/행간 교정 및 타겟 언어 번역 (일반 텍스트 전용), 다운로드용 문서 파일(MD/TXT) 자동 생성

**요청 파라미터:** (Body, JSON)
| 필드 | 타입 | 필수 | 기본값 | 설명 |
|---|---|---|---|---|
| text | string | ✅ | - | 번역/교정할 원본 텍스트 |
| targetLanguage | string | ❌ | `ko` | 번역 대상 언어 |
| sourceLanguage | string | ❌ | `auto` | 원본 언어 |
| format | string | ❌ | `md` | 다운로드 파일 형식 (`md` / `txt`) |

**응답 형식:** (200)
```json
{
  "success": true,
  "message": "구글 렌즈 일반 텍스트 번역 및 오타 보정이 성공적으로 완료되었습니다.",
  "data": {
    "originalText": "...",
    "correctedText": "...",
    "translatedText": "...",
    "explanation": "...",
    "documentType": "일반 텍스트",
    "summary": "...",
    "actionItems": [],
    "warnings": [],
    "fileName": "...",
    "downloadUrl": "http://host/downloads/..."
  }
}
```

**에러 코드:**
| 코드 | 상황 |
|---|---|
| 400 | text 누락 또는 공백 |
| 500 | 번역 처리 중 내부 오류 |

**예시:**
```bash
curl -X POST http://localhost:3000/api/translation/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Notice of Assessment...", "targetLanguage": "ko"}'
```

---

## 서류 분석 (Documents)

### [POST] /api/documents/analyze

**목적:** 이민 서류 OCR 텍스트 정밀 분석 — 서류 유형 식별, 실천 조치(Action Plan), 법적 마감일/위반 규정, 연계 후속 서류 로드맵 산출 및 다운로드 파일 생성

**요청 파라미터:** (Body, JSON) — `/api/translation/translate`와 동일 (`text` 필수, `targetLanguage`, `sourceLanguage`, `format` 선택)

**응답 형식:** (200)
```json
{
  "success": true,
  "message": "구글 렌즈 이민 서류 분석 및 연계 로드맵 산출이 성공적으로 완료되었습니다.",
  "data": {
    "originalText": "...",
    "correctedText": "...",
    "translatedText": "...",
    "documentType": "...",
    "explanation": "...",
    "actionPlan": [],
    "legalObligations": [],
    "nextRoadmap": [],
    "fileName": "...",
    "downloadUrl": "..."
  }
}
```

**에러 코드:**
| 코드 | 상황 |
|---|---|
| 400 | text 누락 또는 공백 |
| 500 | 분석 처리 중 서버 오류 |

**예시:**
```bash
curl -X POST http://localhost:3000/api/documents/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "전입신고 안내문...", "targetLanguage": "ko"}'
```

---

## 일정 (Schedules) — 전체 🔒 JWT 필수

### [POST] /api/schedules 🔒

**목적:** 새로운 개인 행정 일정 등록

**요청 파라미터:** (Body, JSON)
| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| title | string | ✅ | 일정 제목 |
| description | string | ❌ | 상세 설명 |
| dueDate | string | ✅ | 마감일 (예: "2026-08-01") |
| documentType | string | ❌ | 관련 서류 종류 |
| completed | boolean | ❌ | 완료 여부 (기본 false) |

**응답 형식:** (201) `{ "success": true, "message": "...", "data": { "schedule": {...} } }`

**에러 코드:** 400 (유효성 실패), 401 (인증 실패)

**예시:**
```bash
curl -X POST http://localhost:3000/api/schedules \
  -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" \
  -d '{"title": "전입신고", "dueDate": "2026-08-01"}'
```

---

### [GET] /api/schedules 🔒

**목적:** 로그인 사용자 본인의 전체 일정을 마감 기한 순으로 조회

**요청 파라미터:** 없음

**응답 형식:** (200) `{ "success": true, "data": { "schedules": [...] } }`

**에러 코드:** 401 (인증 실패), 500 (서버 오류)

**예시:**
```bash
curl http://localhost:3000/api/schedules -H "Authorization: Bearer <JWT>"
```

---

### [POST] /api/schedules/auto-generate 🔒

**목적:** 서류 기준일(예: 이사일)을 바탕으로 관련 법적 마감 일정을 일괄 자동 생성 (전입신고, 확정일자 등)

**요청 파라미터:** (Body, JSON)
| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| documentType | string | ✅ | 서류 종류 |
| baseDate | string | ✅ | 기준 날짜 (예: "2026-07-15") |

**응답 형식:** (201) `{ "success": true, "message": "총 N개의 ... 자동 생성되었습니다.", "data": { "schedules": [...] } }`

**에러 코드:** 400 (필수값 누락), 401 (인증 실패)

**예시:**
```bash
curl -X POST http://localhost:3000/api/schedules/auto-generate \
  -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" \
  -d '{"documentType": "이사", "baseDate": "2026-07-15"}'
```

---

### [GET] /api/schedules/:id 🔒

**목적:** 단일 일정 상세 조회 (본인 소유 검증 포함)

**요청 파라미터:** (Path) `id` — 일정 고유 번호 (정수)

**응답 형식:** (200) `{ "success": true, "data": { "schedule": {...} } }`

**에러 코드:** 400 (ID 형식 오류, 미존재/소유권 위반), 401 (인증 실패)

**예시:**
```bash
curl http://localhost:3000/api/schedules/3 -H "Authorization: Bearer <JWT>"
```

---

### [PATCH] /api/schedules/:id 🔒

**목적:** 일정 부분 수정 (완료 상태 토글, 기한 연장 등, 본인 소유 검증 포함)

**요청 파라미터:** (Path) `id` / (Body, JSON — 모두 선택) `title`, `description`, `dueDate`, `completed`, `documentType`

**응답 형식:** (200) `{ "success": true, "data": { "schedule": {...} } }`

**에러 코드:** 400 (ID 형식 오류, 수정 실패), 401 (인증 실패)

**예시:**
```bash
curl -X PATCH http://localhost:3000/api/schedules/3 \
  -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" \
  -d '{"completed": true}'
```

---

### [DELETE] /api/schedules/:id 🔒

**목적:** 일정 삭제 (본인 소유 검증 포함)

**요청 파라미터:** (Path) `id` — 일정 고유 번호 (정수)

**응답 형식:** (200) `{ "success": true, "message": "행정 일정이 정상적으로 삭제되었습니다." }`

**에러 코드:** 400 (ID 형식 오류, 삭제 실패), 401 (인증 실패)

**예시:**
```bash
curl -X DELETE http://localhost:3000/api/schedules/3 -H "Authorization: Bearer <JWT>"
```

---

## 국가 (Countries)

### [GET] /api/countries

**목적:** 체크리스트 지원 국가 목록 및 시드 데이터 보유 여부 조회

**요청 파라미터:** 없음

**응답 형식:** (200) `{ "success": true, "data": [ { 국가 목록 } ] }`

**에러 코드:** 500 (전역 에러 핸들러)

**예시:**
```bash
curl http://localhost:3000/api/countries
```

---

### [GET] /api/countries/:code/visa-types

**목적:** 특정 국가의 지원 비자 유형 조회 — 시드 국가(US/CA/AU)는 시드에 명시된 유형만, 그 외 국가는 기본 4종(skilled/family/investor/student) 반환

**요청 파라미터:** (Path) `code` — ISO-2 국가 코드 (예: CA). 대소문자 무관

**응답 형식:** (200)
```json
{
  "success": true,
  "country": "CA",
  "visaTypes": [
    { "code": "skilled", "name_ko": "기술이민", "name_en": "Skilled Migration" }
  ]
}
```

**에러 코드:** 400 (code 누락)

**예시:**
```bash
curl http://localhost:3000/api/countries/CA/visa-types
```

---

## 체크리스트 (Checklist)

### [POST] /api/checklist

**목적:** 출발/대상 국가, 비자 유형, 동반 가족 여부에 맞는 이민 서류 체크리스트 생성/조회 (시드 → Gemini AI → 캐시 순 오케스트레이션)

**요청 파라미터:** (Body, JSON)
| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| from | string | ✅ | 출발 국가 ISO-2 코드 (예: KR) |
| to | string | ✅ | 대상 국가 ISO-2 코드 (예: CA) |
| visaType | string | ✅ | 비자 유형 (skilled / family / investor / student) |
| family | boolean | ❌ | 동반 가족 여부 (true 시 가족 서류 자동 병합, 기본 false) |

**응답 형식:** (200) `{ "success": true, "data": { 체크리스트 } }`

**에러 코드:**
| 코드 | 상황 |
|---|---|
| 400 | 필수 파라미터 누락 / 유효성 실패 / Gemini API 키 누락(비시드 국가) |
| 502 | AI 응답 데이터 구조화(파싱) 실패 |
| 503 | Gemini API 호출 제한(429) 초과 |
| 504 | AI 응답 시간 초과 |

**예시:**
```bash
curl -X POST http://localhost:3000/api/checklist \
  -H "Content-Type: application/json" \
  -d '{"from": "KR", "to": "CA", "visaType": "skilled", "family": true}'
```

---

## 처리 기간 (Processing Time)

### [GET] /api/processing-time

**목적:** 캐나다 이민부(IRCC) 공식 데이터를 프록싱하여 주요 이민/비자 프로그램별 실시간 처리 기간 조회 (현재 CA만 지원)

**요청 파라미터:** (Query)
| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| country | string | ✅ | 대상 국가 ISO-2 코드 (현재 'CA'만 지원, 대소문자 무관) |

**응답 형식:** (200) IRCC 서비스 가공 데이터(JSON)

**에러 코드:**
| 코드 | 상황 |
|---|---|
| 400 | country 파라미터 누락 |
| 501 | CA 이외 국가 요청 (지원 예정) |
| 500 | 내부 서버 오류 |

**예시:**
```bash
curl "http://localhost:3000/api/processing-time?country=CA"
```

---

## 공통 에러 응답

| 코드 | 상황 |
|---|---|
| 404 | 존재하지 않는 엔드포인트 — `{ "success": false, "message": "요청하신 경로 (...)를 찾을 수 없습니다." }` |
| 429 | Rate Limit 초과 (`/api/auth/google` 한정) |
| 500 | 전역 에러 핸들러 — production 모드에서는 세부 에러 메시지가 은폐됩니다 |
