# 국적(Nationality) 선택/저장 기능

> 작성일: 2026-07-09

Google 로그인 완료 후 사용자가 국적을 선택하면 서버에 저장하고, 이후 로그인/프로필 응답에서 해당 국적을 반환하는 기능입니다.

## 개요

- 로그인 응답의 `user.nationality`가 `null`이면 클라이언트는 **국적 선택 화면**으로 유도합니다.
- 국적은 **ISO 3166-1 alpha-2** 국가 코드(예: `KR`, `US`)로 저장됩니다.
- 재로그인해도 저장된 국적은 유지됩니다 (로그인 upsert 쿼리가 nationality를 건드리지 않음).

## API

### [PATCH] /api/auth/nationality

로그인한 유저의 국적을 저장합니다. JWT 인증 필수.

**요청**

```bash
curl -X PATCH http://localhost:3000/api/auth/nationality \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"nationality": "KR"}'
```

- 소문자 입력(`"kr"`)은 서버에서 대문자로 정규화됩니다.
- 형식 검증: `/^[A-Z]{2}$/` (2글자 알파벳). 실제 존재하는 국가 코드인지는 검증하지 않으므로, 클라이언트는 드롭다운 등 제한된 목록에서 선택하도록 구현하는 것을 권장합니다.

**응답 (200)**

```json
{
  "success": true,
  "message": "국적 저장 성공",
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "홍길동",
      "nationality": "KR",
      "...": "..."
    }
  }
}
```

**에러**

| 코드 | 조건 |
|------|------|
| 400 | `nationality` 누락 또는 형식 오류 (ISO alpha-2 아님) |
| 401 | JWT 누락 |
| 403 | JWT 무효/만료 |

### 기존 API 영향

- `POST /api/auth/google`, `GET /api/auth/google/callback` (로그인): 응답 `user` 객체에 `nationality` 필드 포함 (미설정 시 `null`)
- `GET /api/auth/profile`: 응답 `user` 객체에 `nationality` 필드 포함

## DB 스키마 변경

`users` 테이블에 컬럼 추가:

```sql
nationality VARCHAR(2) DEFAULT NULL
```

- 신규 환경: `CREATE TABLE` 문에 포함되어 자동 생성
- 기존 환경: 서버 기동 시 `initializeDatabase()`가 `information_schema.columns`를 조회하여 컬럼이 없으면 `ALTER TABLE`로 자동 추가 (별도 수동 마이그레이션 불필요)

## 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/config/db.ts` | 스키마에 `nationality` 컬럼 추가 + 조건부 ALTER 마이그레이션 |
| `src/types/user.ts` | `User` 인터페이스에 `nationality?: string \| null` 추가 |
| `src/repositories/userRepository.ts` | `updateNationality(userId, nationality)` 추가 (UPDATE 후 재조회 반환) |
| `src/services/authService.ts` | `updateNationality` 추가 (정규화 + ISO alpha-2 형식 검증) |
| `src/controllers/authController.ts` | `updateNationality` 핸들러 추가 (기존 응답/에러 패턴 유지) |
| `src/routes/authRoutes.ts` | `PATCH /api/auth/nationality` 라우트 등록 (`authenticateJwt` 적용) |
| `src/middlewares/authMiddleware.ts` | `req.user`에 `nationality` 바인딩 추가 |

## 설계 결정

- **별도 테이블 없이 `users` 컬럼으로 저장**: 국적은 유저당 1개 값이므로 nullable 컬럼이 가장 단순합니다.
- **upsert에서 nationality 제외**: 로그인 시마다 실행되는 upsert에 nationality를 포함하면 재로그인 때 저장값이 `null`로 덮어써지므로 의도적으로 제외했습니다. 국적 변경은 오직 `PATCH /api/auth/nationality`로만 가능합니다.
- **PATCH 메서드 사용**: 유저 리소스의 단일 필드 부분 수정이므로 PATCH가 적합합니다.
