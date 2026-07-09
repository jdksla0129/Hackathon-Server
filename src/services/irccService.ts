import { cacheService } from '../utils/cache';

export interface IRCCProgramTime {
  program_id: string;
  name_ko: string;
  name_en: string;
  processing_time: string;
}

export interface IRCCProcessingTimeResponse {
  success: boolean;
  country: string;
  countryName: string;
  generatedAt: string;
  source: string;
  programs: IRCCProgramTime[];
}

export class IRCCService {
  private ptimeUrl = 'https://www.canada.ca/content/dam/ircc/documents/json/data-ptime-en.json';
  private countryNameUrl = 'https://www.canada.ca/content/dam/ircc/documents/json/data-country-name-en.json';

  /**
   * 캐나다 IRCC 처리 기간 데이터를 가져와 주요 프로그램별로 정리하여 반환합니다.
   * 캐시 TTL: 24시간
   */
  public getProcessingTime = async (country: string): Promise<IRCCProcessingTimeResponse> => {
    const uppercaseCountry = country.toUpperCase();

    // 1. 캐시 조회
    const cacheKey = `ircc:processing-time:${uppercaseCountry}`;
    const cachedData = cacheService.get<IRCCProcessingTimeResponse>(cacheKey);

    if (cachedData) {
      console.log(`[IRCCService] 캐시 히트! (Key: ${cacheKey})`);
      return cachedData;
    }

    console.log(`[IRCCService] 캐시 미스 (Key: ${cacheKey}). IRCC API 데이터를 호출합니다.`);

    try {
      // 두 개의 API 병렬 fetch (타임아웃 15초 적용)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const [ptimeRes, countryRes] = await Promise.all([
        fetch(this.ptimeUrl, { signal: controller.signal }),
        fetch(this.countryNameUrl, { signal: controller.signal }),
      ]);

      clearTimeout(timeoutId);

      if (!ptimeRes.ok || !countryRes.ok) {
        throw new Error('IRCC 공식 데이터 서버로부터 정보를 받아오는 데 실패했습니다.');
      }

      const ptimeData = (await ptimeRes.json()) as any;
      const countryData = (await countryRes.json()) as any;

      // 국가명 매핑 정보 획득
      const countryNames = countryData[0]?.['country-name'] || {};
      const targetCountryFullName = countryNames[uppercaseCountry] || 'Canada';

      // 한국(KR) 출발 기준 처리시간을 조회하므로 'KR' 키의 데이터를 사용합니다.
      const fromCountry = 'KR';

      // 주요 프로그램을 추려 정리합니다.
      // - 취업 비자 (work)
      // - 학생 비자 (study)
      // - 슈퍼 비자 (supervisa)
      // - 동반 자녀 초청 (child_dependent)
      // - 입양 자녀 초청 (child_adopted)
      // - 관광/방문 비자 (visitor-outside-canada)
      const programMappings = [
        {
          id: 'express_entry_work',
          name_ko: '취업 비자 (Express Entry 연계 등)',
          name_en: 'Work Permit (Outside Canada)',
          category: 'work',
        },
        {
          id: 'study_permit',
          name_ko: '학생 비자 (Study Permit)',
          name_en: 'Study Permit (Outside Canada)',
          category: 'study',
        },
        {
          id: 'super_visa',
          name_ko: '부모 및 조부모 슈퍼 비자 (Super Visa)',
          name_en: 'Super Visa (Parents and Grandparents)',
          category: 'supervisa',
        },
        {
          id: 'child_dependent',
          name_ko: '자녀 및 부양가족 초청',
          name_en: 'Sponsorship of Dependent Child',
          category: 'child_dependent',
        },
        {
          id: 'child_adopted',
          name_ko: '입양 자녀 초청',
          name_en: 'Sponsorship of Adopted Child',
          category: 'child_adopted',
        },
        {
          id: 'visitor_visa',
          name_ko: '방문 비자 (Visitor Visa)',
          name_en: 'Visitor Visa (Outside Canada)',
          category: 'visitor-outside-canada',
        },
      ];

      const programs: IRCCProgramTime[] = programMappings.map((mapping) => {
        const categoryData = ptimeData[mapping.category] || {};
        const processingTime = categoryData[fromCountry] || 'No processing time available';

        return {
          program_id: mapping.id,
          name_ko: mapping.name_ko,
          name_en: mapping.name_en,
          processing_time: processingTime,
        };
      });

      const response: IRCCProcessingTimeResponse = {
        success: true,
        country: uppercaseCountry,
        countryName: targetCountryFullName,
        generatedAt: new Date().toISOString(),
        source: 'IRCC Live JSON API',
        programs,
      };

      // 캐시 저장 (TTL 24h = 86400초)
      cacheService.set(cacheKey, response, 86400);
      console.log(`[IRCCService] 캐시 저장 성공 (Key: ${cacheKey})`);

      return response;
    } catch (error: any) {
      console.error('[IRCCService] getProcessingTime 에러:', error);
      throw new Error(`IRCC 처리기간 정보를 조회하는 데 실패했습니다: ${error.message}`);
    }
  };
}

export const irccService = new IRCCService();
