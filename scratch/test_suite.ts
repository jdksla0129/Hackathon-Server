import { translationService } from '../src/services/translationService';
import { documentService } from '../src/services/documentService';
import { scheduleService } from '../src/services/scheduleService';
import { scheduleRepository } from '../src/repositories/scheduleRepository';
import { Schedule } from '../src/types/schedule';

// ANSI 컬러 탈출 문자 정의 (터미널 출력용)
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, errorMessage?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ${GREEN}✓ [PASS]${RESET} ${testName}`);
  } else {
    console.error(`  ${RED}✗ [FAIL]${RESET} ${testName}`);
    if (errorMessage) {
      console.error(`    ${RED}이유:${RESET} ${errorMessage}`);
    }
  }
}

async function runTestSuite() {
  console.log(`\n============================================================`);
  console.log(`🚀 ${BOLD}${CYAN}이민자 서류 분석(Documents) 및 일정 연동 테스트 스위트 구동${RESET}`);
  console.log(`============================================================`);

  // -------------------------------------------------------------------------
  // 1. TranslationService (순수 일반 번역) 테스트
  // -------------------------------------------------------------------------
  console.log(`\n${BOLD}${YELLOW}[1단계] TranslationService 순수 일반 문장 번역 및 오타 교정 검사${RESET}`);
  try {
    const rawText = '안녕하셔요 반갑습네다 오늘 날시가 참 조내요';
    console.log(`  🔎 일반 문장 번역 실행 중...`);
    const translationResult = await translationService.translateAndCorrect(rawText, 'en');
    
    assert(
      translationResult.correctedText.includes('AI 보정 완료'),
      '일반 번역 수행 시 오타 보정이 시뮬레이션되어 결과에 명시되는가?'
    );
    assert(
      translationResult.translatedText.includes('[Mock Translation'),
      'Gemini API Key 누락 시 번역결과가 Mock 데이터로 정상 우회 처리되는가?'
    );
  } catch (error: any) {
    console.error(`  ${RED}✗ [ERROR]${RESET} 순수 번역 검증 중 예외 발생:`, error.message);
  }

  // -------------------------------------------------------------------------
  // 2. DocumentService (이민자 행정 서류 전용 분석) 테스트
  // -------------------------------------------------------------------------
  console.log(`\n${BOLD}${YELLOW}[2단계] DocumentService 행정 서류 전용 심층 분석 및 법적 가이드 검사${RESET}`);
  
  try {
    // A. 부동산 임대차 계약서 키워드 감지 테스트
    console.log(`  🔎 부동산 계약 서류 입력 분석 중...`);
    const rentResult = await documentService.analyzeDocument(
      '보증금 1000만원 월세 50만원 전세 계약서입니다. 임대인과 임차인 계약 완료',
      'en'
    );

    assert(
      rentResult.documentType === '부동산 임대차 계약서 (Housing Lease Agreement)',
      '임대차/월세 키워드 입력 시 문서 종류를 "부동산 임대차 계약서"로 올바르게 식별하는가?',
      `결과: ${rentResult.documentType}`
    );
    assert(
      rentResult.actionPlan.length > 0,
      '임대차 문서에 대한 조치 사항(Action Plan)이 올바르게 생성되는가?',
      `Action Plan 개수: ${rentResult.actionPlan.length}`
    );
    assert(
      rentResult.legalObligations.some(item => item.includes('14일 이내') || item.includes('체류지')),
      '출입국관리법 제36조에 부합하는 체류지 변경 신고(14일 이내) 법적 의무가 명시되는가?'
    );
    assert(
      rentResult.nextRoadmap.nextSteps.some(step => step.documentName.includes('체류지')),
      '후속 로드맵에 체류지 변경신고서가 연계하여 제시되는가?'
    );

    // B. 외국인등록증 키워드 감지 테스트
    console.log(`\n  🔎 외국인등록증 서류 입력 분석 중...`);
    const arcResult = await documentService.analyzeDocument(
      'My Alien Registration Card (ARC) has nationality of United States',
      'ko'
    );

    assert(
      arcResult.documentType === '외국인등록증 (Alien Registration Card / ARC)',
      '외국인등록/ARC 키워드 입력 시 문서 종류를 "외국인등록증"으로 올바르게 식별하는가?',
      `결과: ${arcResult.documentType}`
    );
    assert(
      arcResult.legalObligations.some(item => item.includes('90일 이내')),
      '출입국관리법 제31조에 부합하는 신규 외국인등록(90일 이내) 의무가 추출되는가?'
    );
    assert(
      arcResult.nextRoadmap.nextSteps.some(step => step.documentName.includes('체류기간 연장')),
      '체류 신분 확보 후 다음 단계로 체류기간 연장허가 신청서가 로드맵에 제안되는가?'
    );

  } catch (error: any) {
    console.error(`  ${RED}✗ [ERROR]${RESET} 서류 분석 서비스 검증 중 예외 발생:`, error.message);
  }

  // -------------------------------------------------------------------------
  // 3. ScheduleService (일정 자동생성 수학 및 날짜 연산) 테스트
  // -------------------------------------------------------------------------
  console.log(`\n\n${BOLD}${YELLOW}[3단계] ScheduleService 일정 연동 및 데드라인 생성 검사 (Mock Repository 적용)${RESET}`);

  // DB 에러를 우회하고 순수 일정 자동 연산 수학을 증명하기 위해 scheduleRepository.create 및 findById 모킹
  const originalCreate = scheduleRepository.create;
  const originalFindById = scheduleRepository.findById;

  const mockDbStorage: Schedule[] = [];
  let idCounter = 100;

  scheduleRepository.create = async (schedule: Schedule): Promise<number> => {
    idCounter++;
    const mockRecord = { ...schedule, id: idCounter, created_at: new Date(), updated_at: new Date() };
    mockDbStorage.push(mockRecord);
    return idCounter;
  };

  scheduleRepository.findById = async (id: number): Promise<Schedule | null> => {
    return mockDbStorage.find(item => item.id === id) || null;
  };

  try {
    const userId = 1;
    const baseDateStr = '2026-07-10'; // 기준일자 설정

    // A. 부동산 계약 기반 일정 일괄 가입 생성 테스트
    console.log(`\n  📅 임대차 계약 체결일(2026-07-10) 기준 일정 일괄 연동 중...`);
    const generatedRentSchedules = await scheduleService.autoGenerateSchedules(
      userId,
      '부동산 임대차 계약서',
      baseDateStr
    );

    assert(
      generatedRentSchedules.length === 3,
      '임대차 서류 자동 일정 생성 시 확정일자, 체류지변경, 전월세신고 총 3가지 핵심 일정이 생성되는가?',
      `생성된 개수: ${generatedRentSchedules.length}`
    );

    // 구체적인 데드라인 날짜 연산 계산 검증 (14일 뒤, 30일 뒤 산식 검증)
    const changeResidenceEvent = generatedRentSchedules.find(s => s.title.includes('체류지 변경'));
    const rentReportEvent = generatedRentSchedules.find(s => s.title.includes('주택 임대차 계약 신고'));

    if (changeResidenceEvent) {
      const dueDate = new Date(changeResidenceEvent.due_date);
      // 7월 10일 + 14일 = 7월 24일이어야 함
      const expectedDay = 24;
      assert(
        dueDate.getDate() === expectedDay && dueDate.getMonth() === 6, // 0-indexed 6 is July
        '이사일(7/10) 기준 체류지 변경 신고 마감 기한이 정확히 14일 뒤인 7월 24일로 생성되는가?',
        `연산된 마감일: ${changeResidenceEvent.due_date}`
      );
    } else {
      assert(false, '체류지 변경 신고 스케줄을 찾을 수 없습니다.');
    }

    if (rentReportEvent) {
      const dueDate = new Date(rentReportEvent.due_date);
      // 7월 10일 + 30일 = 8월 9일이어야 함 (7월은 31일까지 있음)
      const expectedDay = 9;
      assert(
        dueDate.getDate() === expectedDay && dueDate.getMonth() === 7, // 0-indexed 7 is August
        '계약일(7/10) 기준 전월세 임대차 신고 마감 기한이 정확히 30일 뒤인 8월 9일로 생성되는가?',
        `연산된 마감일: ${rentReportEvent.due_date}`
      );
    } else {
      assert(false, '주택 임대차 신고 스케줄을 찾을 수 없습니다.');
    }

    // B. 외국인등록증 기반 일정 일괄 가입 생성 테스트
    console.log(`\n  📅 대한민국 입국일(2026-07-10) 기준 외국인등록 일정 일괄 연동 중...`);
    const generatedArcSchedules = await scheduleService.autoGenerateSchedules(
      userId,
      '외국인등록증',
      baseDateStr
    );

    assert(
      generatedArcSchedules.length === 2,
      '외국인등록증 자동 일정 생성 시 외국인등록 및 건강보험 연동 총 2가지 핵심 기한 일정이 등록되는가?',
      `생성된 개수: ${generatedArcSchedules.length}`
    );

    const arcRegistrationEvent = generatedArcSchedules.find(s => s.title.includes('신규 외국인등록'));
    if (arcRegistrationEvent) {
      const dueDate = new Date(arcRegistrationEvent.due_date);
      // 7월 10일 + 90일 = 10월 8일 (7월 31일, 8월 31일, 9월 30일 고려시 90일 계산)
      // 7월 남은일 21일 + 8월 31일(52일) + 9월 30일(82일) + 10월 8일 = 90일
      const expectedMonth = 9; // 0-indexed 9 is October
      const expectedDay = 8;
      assert(
        dueDate.getDate() === expectedDay && dueDate.getMonth() === expectedMonth,
        '입국일(7/10) 기준 신규 외국인등록증 발급 완료 법적 데드라인이 정확히 90일 뒤인 10월 8일로 연산되는가?',
        `연산된 마감일: ${arcRegistrationEvent.due_date}`
      );
    }

  } catch (error: any) {
    console.error(`  ${RED}✗ [ERROR]${RESET} 일정 서비스 검증 중 예외 발생:`, error.message);
  } finally {
    // 모킹 복구
    scheduleRepository.create = originalCreate;
    scheduleRepository.findById = originalFindById;
  }

  // -------------------------------------------------------------------------
  // 종합 리포트
  // -------------------------------------------------------------------------
  console.log(`\n============================================================`);
  console.log(`📊 ${BOLD}${CYAN}최종 테스트 종합 결과 리포트 (Test Suite Summary)${RESET}`);
  console.log(`============================================================`);
  const successRate = ((passedTests / totalTests) * 100).toFixed(1);
  console.log(`  - 실행한 전체 단위 검증 케이스: ${totalTests}개`);
  console.log(`  - 통과(Passed) 검증 케이스: ${GREEN}${passedTests}개${RESET}`);
  console.log(`  - 실패(Failed) 검증 케이스: ${passedTests === totalTests ? GREEN : RED}${totalTests - passedTests}개${RESET}`);
  console.log(`  - 최종 검증 성공률: ${successRate === '100.0' ? GREEN : YELLOW}${successRate}%${RESET}`);
  console.log(`============================================================\n`);
}

runTestSuite();
