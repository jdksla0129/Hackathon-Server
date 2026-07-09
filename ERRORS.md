# ERRORS.md

이 파일은 에이전트가 이 프로젝트에서 과거에 겪었던 실패 사례와 삽질, 그리고 이를 우회하는 방법을 기록하여 동일한 실수의 반복을 방지합니다.

## 실패 사례 및 예방책 (Failures & Prevention)

### 1. 존재하지 않는 Git 명령어 사용 실패
- **실패 상황**: 작업 현황을 파악하기 위해 관성적으로 `git status`나 `git diff` 등의 명령어를 실행했으나, `.git` 리포지토리가 아니라서 에러가 발생함.
- **예방책**: Git 명령어 대신 일반 파일 탐색기 수준의 명령어(`ls`, `find`)나 Antigravity의 리스트 도구(`list_dir`)를 사용해야 합니다.

### 2. 하네스 마크다운 필수 스키마 누락
- **실패 상황**: 하네스 마크다운 파일(예: `SKILL.md`)을 작성하거나 수정할 때, 상단의 YAML Frontmatter 등 필수 양식을 임의로 변형하거나 누락하여 에러를 일으킴.
- **예방책**: 파일 구조를 변경할 때 반드시 템플릿 가이드라인을 참조하고, Frontmatter 영역은 손상되지 않도록 보존해야 합니다.

### 3. @google/genai 신규 SDK의 response.text() 컴파일 실패
- **실패 상황**: `gemini-2.5-flash` 연동을 위해 설치한 신규 SDK `@google/genai`에서 관성적으로 `response.text()` 형태의 메서드 호출을 작성했으나, tsc 빌드 시 `get accessor`를 호출하려 했다는 이유로 strict 컴파일 에러 발생.
- **예방책**: 신규 SDK `@google/genai` 에서는 `.text`가 메서드가 아닌 일반 문자열 프로퍼티(`string | undefined`)로 노출되어 있습니다. 메서드 호출을 제거하고 `const text = response.text;` 로 바로 할당해 사용해야 합니다.

### 4. zsh 터미널에서 물음표(?) 기호 cURL 매칭 실패
- **실패 상황**: 실시간 비자 처리기간 조회를 위해 `curl http://localhost:3000/api/processing-time?country=CA` 형태로 직접 쿼리 파라미터를 요청했으나, zsh 쉘에서 물음표(?)를 특수 패턴 매칭 문자로 처리해 `no matches found` 에러와 함께 전송 실패.
- **예방책**: 쉘에서 특수문자가 포함된 URL로 cURL을 보낼 때는, 반드시 주소 양옆을 따옴표로 묶어(`curl "URL"`) 이스케이프해야 합니다.
