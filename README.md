# 🌐 이민 행정 및 서류 체크리스트 API 서버 (Hackathon-Server)

본 프로젝트는 해외 이민 준비생을 위해 **이민 체크리스트 자동 생성**, **비자 종류 조회**, 그리고 캐나다 이민부(IRCC) 공식 데이터를 활용한 **실시간 서류 처리 기간 조회** 등의 백엔드 API 기능을 Express + TypeScript 스택으로 제공합니다.

---

## 🚀 추가된 핵심 기능 및 엔드포인트 목록

### 1. 🗺️ 이민 체크리스트 지원 국가 목록 조회
* **[GET] `/api/countries`**
  * **설명**: 체크리스트 생성을 지원하는 국가 코드(ISO-2) 및 시드 데이터 적재 여부를 반환합니다.
  * **cURL 예시**:
    ```bash
    curl -s http://localhost:3000/api/countries
    ```

### 2. 📑 특정 국가의 지원 비자 유형 목록 조회
* **[GET] `/api/countries/:code/visa-types`**
  * **설명**: 특정 국가에서 진행 가능한 이민 비자 유형 목록을 반환합니다. 로컬 시드가 마련되어 있는 국가(US, CA, AU)는 해당 시드에서 가용한 비자 목록을 선별하며, 비시드 국가는 기본 4종(`skilled`, `family`, `investor`, `student`)을 일괄 반환합니다.
  * **cURL 예시**:
    * *시드 국가 (캐나다)*:
      ```bash
      curl -s http://localhost:3000/api/countries/CA/visa-types
      ```
    * *비시드 국가 (뉴질랜드)*:
      ```bash
      curl -s http://localhost:3000/api/countries/NZ/visa-types
      ```

### 3. 📋 이민 필수 서류 체크리스트 생성 및 조회
* **[POST] `/api/checklist`**
  * **설명**: 출발 국가, 목적지 국가, 비자 종류, 그리고 동반 가족 여부에 부합하는 준비 서류 리스트를 통합하여 가공 및 캐싱 처리합니다.
  * **동작 순서**:
    1. 요청 데이터 무결성 검증 (ISO-2 국가 코드 및 비자 유형 검증)
    2. 캐시 키(`checklist:{from}:{to}:{visaType}:{family}`) 매칭 시 즉각 반환 (TTL 24h)
    3. 로컬 시드 파일 매칭 시 시드 자료 가공 및 반환 (`source: "seed"`)
       * *`family: true` 인 경우: 혼인관계증명서 등 `required_for: "family_only"` 서류 자동 병합*
       * *`family: false` 인 경우: `required_for: "family_only"` 서류 제외*
    4. 매칭되는 시드가 없는 타 국가의 경우, 실시간 **Gemini 2.5-flash 2단계 호출**을 수행하여 정보 수집 및 구조화 (`source: "gemini"`)
       * *1단계 (자유 검색 및 출처 수집)*: Google Search Grounding 도구를 사용하여 최신 공식 정보 수집
       * *2단계 (구조화)*: 획득한 텍스트 정보를 responseSchema를 강제하여 JSON 데이터로 정밀 변환
  * **cURL 예시**:
    * *동반 가족이 없는 캐나다 기술이민*:
      ```bash
      curl -s -X POST -H "Content-Type: application/json" -d '{"from":"KR", "to":"CA", "visaType":"skilled", "family":false}' http://localhost:3000/api/checklist
      ```
    * *배우자 동반하는 미국 가족이민*:
      ```bash
      curl -s -X POST -H "Content-Type: application/json" -d '{"from":"KR", "to":"US", "visaType":"family", "family":true}' http://localhost:3000/api/checklist
      ```

### 4. ⏱️ 캐나다 이민부(IRCC) 실시간 서류 처리 기간 조회
* **[GET] `/api/processing-time`**
  * **설명**: 캐나다 이민부 공식 JSON 프록시 서버들을 실시간 fetch하여, 한국인 지원자들의 관심이 가장 높은 핵심 이민/비자 프로그램(Express Entry, 학생 비자, 방문 비자, 동반 가족 초청 등)에 맞춰 데이터를 직관적으로 가공하고 캐싱(TTL 24h) 처리합니다. (현재 캐나다 CA만 지원, 타 국가 입력 시 501 Not Implemented 반환)
  * **cURL 예시**:
    * *정상 조회 (캐나다)*:
      ```bash
      curl -s "http://localhost:3000/api/processing-time?country=CA"
      ```
    * *미지원 국가 예외 (미국)*:
      ```bash
      curl -s -i "http://localhost:3000/api/processing-time?country=US"
      ```

---

## 🛠️ 기술 사양 및 아키텍처 컨벤션 준수 사항

* **TypeScript strict 모드**: `tsconfig.json` 의 엄격한 TS strict 검사를 에러 0으로 통과하도록 세밀하게 타이핑되었습니다.
* **3계층 구조**: `routes` ➡️ `controllers` ➡️ `services` 컴포넌트 아키텍처 구조를 빈틈없이 지켰습니다.
* **node-cache 싱글톤 적용**: 불필요한 반복 외부 API 및 AI 호출을 원천 차단하기 위해 24시간 만료 주기의 글로벌 인메모리 캐시 래퍼 유틸리티(`cache.ts`)를 설계 및 연동하였습니다.
* **안전한 환경변수 접근**: `process.env` 직독을 차단하고 기존 시스템 컨벤션인 `config.geminiApiKey` 객체를 상속해 호환성을 확보했습니다.
* **Swagger OpenAPI Spec 완벽 탑재**: `/api-docs` 상에서 신규 엔드포인트들을 대화식으로 바로 확인 및 테스트해볼 수 있도록 `swagger.ts` 명세 규격을 업데이트했습니다.
