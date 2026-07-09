import { scheduleRepository } from '../repositories/scheduleRepository';
import { Schedule } from '../types/schedule';

export class ScheduleService {
  private scheduleRepository = scheduleRepository;

  /**
   * 일정을 생성합니다.
   */
  createSchedule = async (scheduleData: Schedule): Promise<Schedule> => {
    // 유효성 검사
    if (!scheduleData.title || scheduleData.title.trim() === '') {
      throw new Error('일정 제목(title)은 필수 입력 항목입니다.');
    }
    if (!scheduleData.due_date) {
      throw new Error('일정 마감 기한(due_date)은 필수 입력 항목입니다.');
    }

    // 날짜 유효성 검사
    const parsedDate = new Date(scheduleData.due_date);
    if (isNaN(parsedDate.getTime())) {
      throw new Error('올바르지 않은 마감 기한(due_date) 날짜 형식입니다.');
    }

    const insertedId = await this.scheduleRepository.create(scheduleData);
    
    const newSchedule = await this.scheduleRepository.findById(insertedId);
    if (!newSchedule) {
      throw new Error('일정 생성 후 조회를 실패했습니다.');
    }
    return newSchedule;
  };

  /**
   * 특정 사용자의 모든 일정을 조회합니다.
   */
  getSchedulesByUser = async (userId: number): Promise<Schedule[]> => {
    return this.scheduleRepository.findByUserId(userId);
  };

  /**
   * 단일 일정을 상세 조회합니다. 소유자 보호 미들웨어 겸함.
   */
  getScheduleById = async (id: number, userId: number): Promise<Schedule> => {
    const schedule = await this.scheduleRepository.findById(id);
    if (!schedule) {
      throw new Error('요청하신 일정을 찾을 수 없습니다.');
    }
    if (schedule.user_id !== userId) {
      throw new Error('해당 일정에 접근할 권한이 없습니다.');
    }
    return schedule;
  };

  /**
   * 일정을 업데이트합니다. (완료 여부 토글, 날짜 수정 등)
   */
  updateSchedule = async (
    id: number,
    userId: number,
    updates: Partial<Schedule>
  ): Promise<Schedule> => {
    // 1. 소유권 및 일정 존재 사전 여부 검증
    await this.getScheduleById(id, userId);

    // 2. 날짜 업데이트 검증
    if (updates.due_date !== undefined) {
      const parsedDate = new Date(updates.due_date);
      if (isNaN(parsedDate.getTime())) {
        throw new Error('올바르지 않은 마감 기한(due_date) 날짜 형식입니다.');
      }
    }

    // 3. 리포지토리 반영
    const updated = await this.scheduleRepository.update(id, userId, updates);
    if (!updated) {
      throw new Error('일정을 업데이트하는 도중 오류가 발생했습니다.');
    }
    return updated;
  };

  /**
   * 일정을 삭제합니다.
   */
  deleteSchedule = async (id: number, userId: number): Promise<void> => {
    // 소유권 검증
    await this.getScheduleById(id, userId);
    
    const success = await this.scheduleRepository.delete(id, userId);
    if (!success) {
      throw new Error('일정을 삭제하는 도중 오류가 발생했습니다.');
    }
  };

  /**
   * 이민 서류 종류 및 기준 날짜(입국일, 이사일 등)를 기반으로 법적 일정 가이드를 데이터베이스에 일괄 자동 생성합니다.
   */
  autoGenerateSchedules = async (
    userId: number,
    documentType: string,
    baseDateStr: string
  ): Promise<Schedule[]> => {
    if (!documentType || !baseDateStr) {
      throw new Error('서류 종류(documentType)와 기준 날짜(baseDateStr)는 필수 입력 항목입니다.');
    }

    const baseDate = new Date(baseDateStr);
    if (isNaN(baseDate.getTime())) {
      throw new Error('올바르지 않은 기준 날짜(baseDateStr) 형식입니다.');
    }

    const generatedSchedules: Schedule[] = [];
    const cleanDocType = documentType.toLowerCase().replace(/\s+/g, '');

    // 1. 부동산 임대차 계약서 관련 자동 생성 템플릿
    if (
      cleanDocType.includes('임대차') || 
      cleanDocType.includes('계약서') || 
      cleanDocType.includes('lease') || 
      cleanDocType.includes('contract')
    ) {
      const templates = [
        {
          title: '임대차 계약 확정일자 부여 신청',
          description: '우선변제권(임대차 보증금 법적 보호 자격)을 확보하기 위해 이사일/입주 당일에 즉시 확정일자를 동 주민센터 방문 혹은 대법원 인터넷등기소에서 신청해야 합니다.',
          daysOffset: 0,
          docType: '부동산 임대차 계약서'
        },
        {
          title: '체류지 변경 신고 (전입신고)',
          description: '출입국관리법 제36조에 따라, 새로운 주소지로 이사한 이민자는 이사 완료일로부터 14일 이내에 새로운 체류지를 관할 동 주민센터 또는 출입국사무소에 신고해야 합니다. 미신고 시 최대 100만 원 이하의 과태료가 부과됩니다.',
          daysOffset: 14,
          docType: '부동산 임대차 계약서'
        },
        {
          title: '주택 임대차 계약 신고 (전월세 신고)',
          description: '주택임대차보호법에 의거, 전월세 금액이 일정 기준 이상일 경우 계약 체결일로부터 30일 이내에 임대차 주택 전월세 신고를 완료해야 합니다.',
          daysOffset: 30,
          docType: '부동산 임대차 계약서'
        }
      ];

      for (const t of templates) {
        const dueDate = new Date(baseDate);
        dueDate.setDate(baseDate.getDate() + t.daysOffset);
        
        generatedSchedules.push({
          user_id: userId,
          title: t.title,
          description: t.description,
          due_date: dueDate.toISOString().slice(0, 19).replace('T', ' '),
          completed: false,
          document_type: t.docType
        });
      }
    } 
    // 2. 외국인등록증 관련 자동 생성 템플릿
    else if (
      cleanDocType.includes('외국인') || 
      cleanDocType.includes('등록증') || 
      cleanDocType.includes('alien') || 
      cleanDocType.includes('registration') || 
      cleanDocType.includes('arc')
    ) {
      const templates = [
        {
          title: '대한민국 신규 외국인등록 및 등록증 신청 기한',
          description: '출입국관리법 제31조에 따라 대한민국에 90일을 초과하여 체류하려는 모든 외국인은 최초 입국일로부터 반드시 90일 이내에 외국인등록을 마치고 등록증을 수령해야 합니다. (지연 시 형사 처벌 대상)',
          daysOffset: 90,
          docType: '외국인등록증'
        },
        {
          title: '국민건강보험 외국인 지역가입 확인 및 납부 개시',
          description: '대한민국 법령에 따라 외국인등록을 마친 후 비자 자격에 따라 건강보험에 의무 가입하게 됩니다. 수동 가입 필요 비자의 경우 지사를 통해 가입 상태를 체크하세요.',
          daysOffset: 90,
          docType: '외국인등록증'
        }
      ];

      for (const t of templates) {
        const dueDate = new Date(baseDate);
        dueDate.setDate(baseDate.getDate() + t.daysOffset);
        
        generatedSchedules.push({
          user_id: userId,
          title: t.title,
          description: t.description,
          due_date: dueDate.toISOString().slice(0, 19).replace('T', ' '),
          completed: false,
          document_type: t.docType
        });
      }
    }
    // 3. 근로 계약서 관련 자동 생성 템플릿
    else if (
      cleanDocType.includes('근로') || 
      cleanDocType.includes('노동') || 
      cleanDocType.includes('employment') || 
      cleanDocType.includes('work') || 
      cleanDocType.includes('job')
    ) {
      const templates = [
        {
          title: '체류자격외 활동허가 및 근무처 변경신고 여부 검토',
          description: '이민자의 경우 특정 비자 소지자는 취업 전 반드시 출입국사무소에 자격외 활동허가 또는 근무처 변경/추가 허가를 완료한 상태여야 근로가 적법합니다. 계약 즉시 재차 검토하세요.',
          daysOffset: 0,
          docType: '표준근로계약서'
        },
        {
          title: '근로 조건 자가 점검 및 4대 보험 신고 모니터링',
          description: '적법하게 근로를 개시한 시점으로부터 고용주가 정상적으로 근로기준법을 준수하여 고용보험 및 국민연금 등 근로자용 4대 사회보험 신고를 진행하는지 급여 명세 및 관련 서류를 확인하세요.',
          daysOffset: 14,
          docType: '표준근로계약서'
        }
      ];

      for (const t of templates) {
        const dueDate = new Date(baseDate);
        dueDate.setDate(baseDate.getDate() + t.daysOffset);
        
        generatedSchedules.push({
          user_id: userId,
          title: t.title,
          description: t.description,
          due_date: dueDate.toISOString().slice(0, 19).replace('T', ' '),
          completed: false,
          document_type: t.docType
        });
      }
    } else {
      throw new Error(`지원하지 않는 문서 유형입니다. ('임대차계약서', '외국인등록증', '근로계약서' 중 하나를 전송해 주세요)`);
    }

    // 일괄 저장 및 조회
    const savedList: Schedule[] = [];
    for (const sched of generatedSchedules) {
      const savedId = await this.scheduleRepository.create(sched);
      const savedObj = await this.scheduleRepository.findById(savedId);
      if (savedObj) savedList.push(savedObj);
    }

    return savedList;
  };
}

export const scheduleService = new ScheduleService();
