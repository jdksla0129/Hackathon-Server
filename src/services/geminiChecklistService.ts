import { GoogleGenAI } from '@google/genai';
import { config } from '../config/env';
import { DocumentItem } from '../types/checklist';

export class GeminiRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiRateLimitError';
  }
}

export class GeminiParsingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiParsingError';
  }
}

export class GeminiTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiTimeoutError';
  }
}

export class GeminiChecklistService {
  private getAIInstance() {
    if (!config.geminiApiKey || config.geminiApiKey === 'your_gemini_api_key_here') {
      throw new Error('GEMINI_API_KEY_NOT_FOUND');
    }
    return new GoogleGenAI({ apiKey: config.geminiApiKey });
  }

  /**
   * Gemini 2단계 호출을 활용하여 이민 체크리스트를 생성합니다.
   * 1단계: Google Search Grounding 도구를 사용하여 자료 조사 수행
   * 2단계: 구조화된 출력을 활용하여 스키마에 맞게 응답 강제 및 JSON 변환
   */
  public generateChecklist = async (
    from: string,
    to: string,
    visaType: string,
    family: boolean
  ): Promise<{ documents: DocumentItem[]; sources: string[]; disclaimer: string }> => {
    const ai = this.getAIInstance();
    const model = 'gemini-2.5-flash';

    // 1단계: 조사 (Google Search Grounding 포함)
    console.log(`[GeminiChecklistService] 1단계 조사 시작... (Target: ${to}, VisaType: ${visaType})`);
    
    const step1Prompt = `
한국(출발 국가 코드: ${from})에서 출발하여 국가(대상 국가 코드: ${to})로 비자 유형(${visaType}) 이민을 가려고 합니다. 동반 가족이 있는 여부는 ${family} 입니다.
공식 정부 이민 사이트 및 신뢰할 수 있는 소스를 검색하여 해당 이민 과정에 필요한 모든 필수 서류 목록과 요구 조건(아포스티유 및 번역 여부, 발급처, 유효 기간 등)을 상세히 조사해 주세요.
특히, 한국 출발 기준의 공통 서류(여권, 기본증명서, 가족관계증명서, 범죄경력회보서 등)와 해당 국가(${to}) 비자별 필수 서류가 모두 누락 없이 포함되어야 합니다.
`;

    let step1ResponseText = '';
    let extractedSources: string[] = [];

    const callStep1 = async () => {
      const response = await ai.models.generateContent({
        model,
        contents: step1Prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error('1단계 조사에서 비어있는 응답을 수신했습니다.');
      }

      // Grounding Chunks에서 출처 URL 추출
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const urls = chunks
        .map((chunk) => chunk.web?.uri)
        .filter((uri): uri is string => typeof uri === 'string');
      
      // 중복 제거 및 최대 5개로 제한
      const uniqueUrls = Array.from(new Set(urls)).slice(0, 5);

      return { text, sources: uniqueUrls };
    };

    try {
      // 60초 타임아웃 적용
      const step1Result = await this.withTimeout(callStep1(), 60000);
      step1ResponseText = step1Result.text;
      extractedSources = step1Result.sources;
      console.log(`[GeminiChecklistService] 1단계 조사 완료. 출처 수: ${extractedSources.length}`);
    } catch (error: any) {
      this.handleGeminiError(error, '1단계 조사');
    }

    // 2단계: 구조화 (responseSchema 적용, 검색 도구 없음)
    console.log(`[GeminiChecklistService] 2단계 구조화 시작...`);

    const step2Prompt = `
다음은 ${to} 국가의 ${visaType} 이민에 필요한 서류 정보 조사 결과입니다.
---
${step1ResponseText}
---

위 자료와 출처를 바탕으로 다음 요구사항을 만족하는 정확한 JSON 객체를 생성해 주세요.
출처 URL 목록: ${JSON.stringify(extractedSources)}

1. "documents" 배열 내의 각 항목은 아래의 필드들을 정확하게 가져야 합니다:
   - "name_ko": 서류의 한국어 명칭 (예: "기본증명서 (상세)")
   - "name_en": 서류의 영어 명칭 (예: "Basic Certificate (Detailed)")
   - "issuer_ko": 발급 기관 (한국 발급 기준, 예: "대법원 전자가족관계등록시스템")
   - "apostille_required": 아포스티유 인증 필요 여부 (boolean, 한국 서류를 제출하는 경우 대부분 true)
   - "translation_required": 번역 및 번역공증 필요 여부 (boolean, 영어 이외의 한국 서류인 경우 true)
   - "validity_months": 발급일로부터 유효기간 (개월 수, 예: 6. 명확하지 않거나 무기한이면 0)
   - "required_for": 서류 제출 대상. 다음 중 하나여야 함: 'all', 'family_only', 'main_applicant'
   - "official_link": 발급처 혹은 공식 안내 웹사이트의 실제 URL (예: "https://efamily.scourt.go.kr")
   - "notes": 서류 준비 시 주의사항 혹은 추가 세부 설명 (한국어)

2. "sources" 배열에는 제공된 출처 URL 목록을 그대로 채워주세요.
3. "disclaimer"에는 사용자가 참고할 수 있는 면책 고지 문구를 한국어로 포함해 주세요.
`;

    const responseSchema = {
      type: 'OBJECT',
      properties: {
        documents: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              name_ko: { type: 'STRING' },
              name_en: { type: 'STRING' },
              issuer_ko: { type: 'STRING' },
              apostille_required: { type: 'BOOLEAN' },
              translation_required: { type: 'BOOLEAN' },
              validity_months: { type: 'INTEGER' },
              required_for: { type: 'STRING', enum: ['all', 'family_only', 'main_applicant'] },
              official_link: { type: 'STRING' },
              notes: { type: 'STRING' },
            },
            required: [
              'name_ko',
              'name_en',
              'issuer_ko',
              'apostille_required',
              'translation_required',
              'validity_months',
              'required_for',
              'official_link',
              'notes',
            ],
          },
        },
        sources: {
          type: 'ARRAY',
          items: { type: 'STRING' },
        },
        disclaimer: { type: 'STRING' },
      },
      required: ['documents', 'sources', 'disclaimer'],
    };

    const callStep2 = async () => {
      const response = await ai.models.generateContent({
        model,
        contents: step2Prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema as any,
          temperature: 0.1,
        },
      });

      const text = response.text;
      if (!text) {
        throw new GeminiParsingError('2단계 구조화에서 비어있는 응답을 수신했습니다.');
      }

      try {
        const parsed = JSON.parse(text.trim());
        // 최소한의 데이터 무결성 검사
        if (!parsed.documents || !Array.isArray(parsed.documents)) {
          throw new GeminiParsingError('JSON 결과에 "documents" 필드가 없거나 배열이 아닙니다.');
        }
        return parsed as { documents: DocumentItem[]; sources: string[]; disclaimer: string };
      } catch (e: any) {
        throw new GeminiParsingError(`JSON 파싱 실패: ${e.message}. 원본 텍스트: ${text}`);
      }
    };

    let attempts = 1;
    while (attempts <= 2) {
      try {
        console.log(`[GeminiChecklistService] 2단계 구조화 시도 #${attempts}...`);
        const result = await this.withTimeout(callStep2(), 60000);
        console.log(`[GeminiChecklistService] 2단계 구조화 성공! 생성된 서류 수: ${result.documents.length}`);
        return result;
      } catch (error: any) {
        if (error instanceof GeminiRateLimitError || this.isRateLimitError(error)) {
          // 429는 재시도하지 않고 바로 던짐
          throw new GeminiRateLimitError('Gemini API 요청 제한을 초과했습니다. 잠시 후 다시 시도해 주세요.');
        }

        console.warn(`[GeminiChecklistService] 2단계 구조화 시도 #${attempts} 실패: ${error.message}`);
        if (attempts === 2) {
          throw new GeminiParsingError(`2단계 파싱에 최종 실패했습니다: ${error.message}`);
        }
        attempts++;
      }
    }

    throw new GeminiParsingError('알 수 없는 이유로 구조화에 실패했습니다.');
  };

  /**
   * Promise에 타임아웃을 적용하는 헬퍼 함수
   */
  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new GeminiTimeoutError('요청이 지정된 제한 시간(60초)을 초과했습니다.'));
      }, ms);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timer!);
    }
  }

  /**
   * Gemini API 에러가 429 Rate Limit에 해당하는지 판별합니다.
   */
  private isRateLimitError(error: any): boolean {
    const errorMessage = error?.message || '';
    const errorStatus = error?.status || error?.statusCode || 0;
    return (
      errorStatus === 429 ||
      errorMessage.includes('429') ||
      errorMessage.includes('RESOURCE_EXHAUSTED') ||
      errorMessage.includes('Quota exceeded')
    );
  }

  /**
   * Gemini API 에러에 대응하여 커스텀 에러를 던지거나 분류합니다.
   */
  private handleGeminiError(error: any, context: string): never {
    console.error(`[GeminiChecklistService] ${context} 에러 상세:`, error);

    // 429 Rate Limit 감지
    if (this.isRateLimitError(error)) {
      console.warn(`⚠️ [GeminiChecklistService] 429 Rate Limit 감지!`);
      throw new GeminiRateLimitError('Gemini API 요청 제한을 초과했습니다. 잠시 후 다시 시도해 주세요.');
    }

    if (error instanceof GeminiTimeoutError) {
      throw error;
    }

    throw new Error(`[Gemini Check] ${context} 중 오류가 발생했습니다: ${error?.message || ''}`);
  }
}

export const geminiChecklistService = new GeminiChecklistService();
