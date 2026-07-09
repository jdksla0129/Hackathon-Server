# MEMORY.md

이 파일은 프로젝트의 항상 참인 사실과 중요한 기술적 의사결정을 기록하는 공간입니다. 에이전트는 작업을 시작하기 전 이 내용을 먼저 파악해야 합니다.

## 핵심 사실 (Always True Facts)
- **프로젝트 성격**: AI 에이전트의 규칙/도구/템플릿(하네스)을 설계하고 관리하는 전용 프로젝트입니다.
- **Git 미사용 환경**: 현재 이 디렉터리는 Git 저장소(`.git`)가 아닙니다. 따라서 `git status`나 `git diff` 등 Git 관련 명령어를 호출하지 않도록 주의해야 합니다.
- **기술 스택 및 구조**: `.agents` 폴더 아래에 개별 스킬(`skills`) 및 훅/권한 설정(`hooks.json`, `settings.json`)을 구축하여 확장하는 구조를 따릅니다. 백엔드 서버는 Express.js, TypeScript, MySQL, Google OAuth를 핵심 기술 스택으로 사용합니다. 관련 세부 설계 및 계획은 `docs/development_plan.md`를 준수하며, 로컬 환경 변수 관리는 루트의 `.env` 파일을 활용합니다.
- **환경 설정 파일**: 민감한 크레덴셜 정보(Google OAuth, DB 연결, JWT Secret)를 안전하게 관리하기 위해 `.env` 파일과 구성 가이드용 `.env.example` 파일이 루트에 배치되어 있습니다.
- **개발 환경 구성**: `package.json`, `tsconfig.json`, `src/` 디렉토리 아래의 레이어드 아키텍처(Layered Architecture) 기반 기본 서버 로직 구축이 완료되었습니다. (`npm run build` 확인 완료)
- **샌드박스(Mock) 로그인 지원**: `.env` 설정이 미비하거나 로컬 DB 연동이 아직 되지 않았더라도 서버가 문제없이 실행되고 테스트할 수 있도록, 인증 서비스(`authService.ts`)에 모의 사용자(Mock Sandbox) 지원 로직이 탑재되어 있습니다.
- **프로덕션 수준 보안 및 최적화**: `helmet` 도입으로 HTTP 헤더를 차단 및 보호하고, `express-rate-limit` 적용으로 인증 엔드포인트 브루트포스 해킹을 차단합니다. `CORS_ORIGIN` 환경변수 세팅과 싱글턴 패턴(의존성 제어)을 구현하였으며, JWT 페이로드에 ID만 보관하고 매 요청 시 DB 조회(`findById`)를 수행하여 회원의 최신 프로필 상태를 동적으로 매핑합니다.

