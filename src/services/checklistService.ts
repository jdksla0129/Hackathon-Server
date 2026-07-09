import usSeed from '../data/seed/US.json';
import caSeed from '../data/seed/CA.json';
import auSeed from '../data/seed/AU.json';
import { cacheService } from '../utils/cache';
import { geminiChecklistService } from './geminiChecklistService';
import { ChecklistResponse, DocumentItem } from '../types/checklist';

// 시드 데이터를 국가 코드로 매핑
const seeds: Record<string, any> = {
  US: usSeed,
  CA: caSeed,
  AU: auSeed,
};

export class ChecklistService {
  /**
   * 이민 체크리스트 오케스트레이션 서비스
   */
  public getChecklist = async (
    from: string,
    to: string,
    visaType: string,
    family: boolean
  ): Promise<ChecklistResponse> => {
    const uppercaseFrom = from.toUpperCase();
    const uppercaseTo = to.toUpperCase();
    const normalizedVisaType = visaType.toLowerCase();

    // 1. 캐시 키 조회: checklist:{from}:{to}:{visaType}:{family}
    const cacheKey = `checklist:${uppercaseFrom}:${uppercaseTo}:${normalizedVisaType}:${family}`;
    const cachedData = cacheService.get<ChecklistResponse>(cacheKey);

    if (cachedData) {
      console.log(`[ChecklistService] 캐시 히트! (Key: ${cacheKey})`);
      return cachedData;
    }

    console.log(`[ChecklistService] 캐시 미스 (Key: ${cacheKey}). 데이터 조회 시작.`);

    let result: ChecklistResponse;

    // 2. 시드 파일 조회 (US, CA, AU 및 지정된 visaType)
    const seedData = seeds[uppercaseTo];
    if (seedData && seedData.documents && seedData.documents[normalizedVisaType]) {
      console.log(`[ChecklistService] 시드 데이터 매칭 성공 (Target: ${uppercaseTo}, VisaType: ${normalizedVisaType})`);
      
      const allDocs: DocumentItem[] = seedData.documents[normalizedVisaType];
      
      // family 여부에 따라 서류 필터링 및 병합
      // family === false이면, required_for가 'family_only'인 서류는 제외합니다.
      // family === true이면, required_for가 'family_only'인 서류를 포함합니다.
      const filteredDocs = allDocs.filter((doc) => {
        if (!family && doc.required_for === 'family_only') {
          return false;
        }
        return true;
      });

      result = {
        from: uppercaseFrom,
        to: uppercaseTo,
        visaType: normalizedVisaType,
        source: 'seed',
        generatedAt: new Date().toISOString(),
        documents: filteredDocs,
        sources: seedData.sources || [],
        disclaimer: seedData.disclaimer || '본 정보는 참고용이며, 최신 요건은 반드시 공식 기관에서 확인하세요.',
      };
    } else {
      // 3. 시드가 없는 경우 Gemini 2단계 호출을 통한 체크리스트 생성
      console.log(`[ChecklistService] 시드 데이터 매칭 불가 또는 타겟 외부 국가. Gemini API를 호출합니다.`);
      
      try {
        const geminiResult = await geminiChecklistService.generateChecklist(
          uppercaseFrom,
          uppercaseTo,
          normalizedVisaType,
          family
        );

        result = {
          from: uppercaseFrom,
          to: uppercaseTo,
          visaType: normalizedVisaType,
          source: 'gemini',
          generatedAt: new Date().toISOString(),
          documents: geminiResult.documents,
          sources: geminiResult.sources,
          disclaimer: geminiResult.disclaimer,
        };
      } catch (error: any) {
        // API 키가 없거나 다른 사유로 인한 에러를 컨트롤러로 상신
        throw error;
      }
    }

    // 4. 캐시 저장 (TTL 24시간 = 86400초)
    cacheService.set(cacheKey, result, 86400);
    console.log(`[ChecklistService] 캐시 저장 완료 (Key: ${cacheKey})`);

    return result;
  };
}

export const checklistService = new ChecklistService();
