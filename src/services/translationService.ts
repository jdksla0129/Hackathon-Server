import fs from 'fs';
import path from 'path';
import { config } from '../config/env';

export interface ActionItem {
  action: string;
  deadline: string | null;
  priority: 'high' | 'medium' | 'low';
  details: string;
}

export interface TranslationResult {
  correctedText: string;
  translatedText: string;
  explanation: string;
  documentType?: string;
  summary?: string;
  actionItems?: ActionItem[];
  warnings?: string[];
}

export interface FileExportResult {
  fileName: string;
  filePath: string;
  downloadUrl: string;
}

export class TranslationService {
  /**
   * Gemini 2.5 Pro 기반의 3단계 파이프라인 (보정/번역 -> RAG/액션추출 -> Grounding 보강)을 실행합니다.
   * API Key가 없는 경우 Sandbox Mock 데이터로 우회 동작합니다.
   */
  translateAndCorrect = async (
    text: string,
    targetLanguage: string = 'ko',
    sourceLanguage: string = 'auto'
  ): Promise<TranslationResult> => {
    // 1. Gemini API Key 누락 시 Sandbox Mock 대응
    if (!config.geminiApiKey || config.geminiApiKey === 'your_gemini_api_key_here') {
      console.warn('⚠️ [TranslationService] GEMINI_API_KEY가 비어있거나 기본값입니다. 개발 편의를 위해 지능형 Mock 모드로 가동합니다.');
      return this.getMockDataByKeyword(text, targetLanguage, sourceLanguage);
    }

    const langName = this.getLanguageName(targetLanguage);
    const sourceLangDesc = sourceLanguage === 'auto' ? '자동 감지' : this.getLanguageName(sourceLanguage);

    // =========================================================================
    // STEP 1 — 보정 + 번역 (기존 로직 유지 및 모델 업그레이드)
    // =========================================================================
    console.log('[TranslationService] >>> STEP 1: 보정 및 번역 시작 (gemini-2.5-pro)');
    const step1Model = 'gemini-2.5-pro'; // v1beta 404 회피를 위해 gemini-1.5-pro -> gemini-2.5-pro 업그레이드
    const step1ApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${step1Model}:generateContent?key=${config.geminiApiKey}`;

    const step1SystemInstruction = `
You are a highly professional translation and OCR correction expert.
The user will provide a raw text extracted from an image using Google Lens (OCR). The text might contain various OCR errors, typos, missing spaces, bad line breaks, and formatting inconsistencies.

Your task is to:
1. "correctedText": Clean up and correct all OCR errors, typos, spelling mistakes, spacing, and broken line-breaks in the original source language. Retain paragraphs and keep the original meaning.
2. "translatedText": Translate the corrected text into the target language (${langName}) with natural, polished, and contextually accurate phrasing.
3. "explanation": Provide a brief explanation (in Korean) detailing the main corrections made.

You must return your output strictly in JSON format matching the following JSON Schema:
{
  "correctedText": "string",
  "translatedText": "string",
  "explanation": "string"
}

Do not include any markdown code blocks (such as \`\`\`json) in the raw response. Return only the JSON object.
`;

    let step1Result: { correctedText: string; translatedText: string; explanation: string };

    try {
      const response = await fetch(step1ApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `Original Extracted Text (Source Language: ${sourceLangDesc}):\n${text}` }]
            }
          ],
          systemInstruction: {
            parts: [{ text: step1SystemInstruction }]
          },
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1, // 정확도를 위해 0.2 이하 적용
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Gemini API STEP 1 호출 실패. (상태 코드: ${response.status}) - ${JSON.stringify(errorData)}`);
      }

      const responseData = (await response.json()) as any;
      const rawText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        throw new Error('Gemini API로부터 STEP 1 올바른 응답을 수신하지 못했습니다.');
      }

      const parsed = this.cleanAndParseJson(rawText);
      step1Result = {
        correctedText: parsed.correctedText || text,
        translatedText: parsed.translatedText || '',
        explanation: parsed.explanation || ''
      };
      console.log('[TranslationService] <<< STEP 1 완료');
    } catch (error: any) {
      console.error('[TranslationService] STEP 1 에러:', error);
      // STEP 1 실패는 파이프라인 전체 오류로 전파
      throw new Error(`AI 보정 및 번역 처리(STEP 1) 중 치명적 오류가 발생했습니다: ${error.message}`);
    }

    // =========================================================================
    // RAG — 로컬 지식베이스 매칭 및 컨텍스트 주입
    // =========================================================================
    console.log('[TranslationService] >>> RAG 로컬 지식베이스 검색');
    const ragContext = this.getLocalKnowledgeGuide(step1Result.correctedText);

    // =========================================================================
    // STEP 2 — 문서 분석 및 액션 추출
    // =========================================================================
    console.log('[TranslationService] >>> STEP 2: 문서 분석 및 액션 추출 시작 (gemini-2.5-pro)');
    const step2Model = 'gemini-2.5-pro'; // v1beta 404 회피를 위해 gemini-1.5-pro -> gemini-2.5-pro 업그레이드
    const step2ApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${step2Model}:generateContent?key=${config.geminiApiKey}`;

    const step2SystemInstruction = `
You are an advanced administrative analyst specializing in South Korean public administration, legal systems, and daily life guidebooks for foreign residents.
Your task is to analyze the provided CORRECTED TEXT (which is a Korean administrative/daily document or notice) and extract visual, actionable advice.

${ragContext ? `Below is local domain knowledge base content matching this document type. Refer to this guide to enrich your understanding, standard procedures, and warning details:\n${ragContext}\n` : ''}

You must extract and return the following items as a JSON object:
1. "documentType": The classification of the document. Choose from: "공과금 고지서", "출입국 및 외국인 등록 안내문", "주택 임대차 계약서", "근로 계약서", "세금 고지서", "교통 범칙금 및 과태료 고지서", "국민건강보험 및 건강검진 안내문", "법원 및 행정 송달 문서", "일반 텍스트", or any other relevant type.
2. "summary": A brief, clear executive summary of the document's core message. **This must be written in the target language (${langName})**.
3. "actionItems": An array of concrete, urgent tasks the recipient must perform. If there are no clear actions, return an empty array.
   Each action item must have:
   - "action": What needs to be done. Formulate it as a clear, polite, imperative command **written in the target language (${langName})**.
   - "deadline": The deadline or timeline mentioned in the text. Must be formatted as YYYY-MM-DD or the literal expression from the original text (e.g., "Within 15 days of moving"). If none is found, return null.
   - "priority": Must be either "high", "medium", or "low". (High for legal penalties/water-power cutoffs, Medium for standard appointments/recommendations, Low for trivial checks)
   - "details": Specific step-by-step guidance on how, where, or what to prepare (e.g., bank transfer, payment methods, community center visits). **Written in the target language (${langName})**.
4. "warnings": An array of strings representing legal disadvantages, late fees, or administrative penalties if the action items are not fulfilled. Return an empty array if none. **Written in the target language (${langName})**.

⚠️ CRITICAL SAFETY RULE (HALLUCINATION PREVENTION):
Do NOT invent or hallucinate any facts not present in the document.
If you need to make reasonable assumptions (e.g., standard payment methods like 편의점, ATM based on the document type), you MUST explicitly prefix or include "추정" (Estimated / Assumed) in the "details" field. Do not present assumptions as verified facts.

Your output must strictly match the following JSON Schema:
{
  "documentType": "string",
  "summary": "string",
  "actionItems": [
    {
      "action": "string",
      "deadline": "string | null",
      "priority": "high" | "medium" | "low",
      "details": "string"
    }
  ],
  "warnings": ["string"]
}

Do not include any markdown code blocks (such as \`\`\`json) in the raw response. Return only the JSON object.
`;

    let step2Result: { documentType: string; summary: string; actionItems: ActionItem[]; warnings: string[] } | null = null;

    try {
      const response = await fetch(step2ApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `CORRECTED ORIGINAL TEXT:\n${step1Result.correctedText}` }]
            }
          ],
          systemInstruction: {
            parts: [{ text: step2SystemInstruction }]
          },
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          }
        }),
      });

      if (response.ok) {
        const responseData = (await response.json()) as any;
        const rawText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          step2Result = this.cleanAndParseJson(rawText);
          console.log('[TranslationService] <<< STEP 2 완료');
        }
      } else {
        console.warn(`⚠️ [TranslationService] STEP 2 API 호출 실패. 상태코드: ${response.status}`);
      }
    } catch (error) {
      console.error('⚠️ [TranslationService] STEP 2 처리 중 오류 발생:', error);
    }

    // 만약 STEP 2가 실패하거나 비정상 응답이면 우아한 저하(Graceful Degradation) 적용
    if (!step2Result) {
      console.warn('⚠️ [TranslationService] STEP 2 분석 결과를 얻지 못해 기본값으로 우아한 저하를 시작합니다.');
      return {
        ...step1Result,
        documentType: '일반 텍스트',
        summary: `이 문서는 행동 분석을 거치지 못했습니다. 번역문과 원문을 대조하여 필요한 행동 사항을 직접 체크하십시오.`,
        actionItems: [],
        warnings: [],
        explanation: step1Result.explanation + '\n\n[행동 분석 실패] 인프라나 형식 오류로 인해 인접한 행동 안내(Action Guidance) 추출을 완료하지 못했습니다. 상세 행동 수칙은 번역문 자체를 참고하시기 바랍니다.'
      };
    }

    // =========================================================================
    // STEP 3 — 검색 기반 근거 보강 (Grounding)
    // =========================================================================
    console.log('[TranslationService] >>> STEP 3: 검색 기반 보강(Grounding) 시작 (gemini-2.5-flash)');
    const step3Model = 'gemini-2.5-flash';
    const step3ApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${step3Model}:generateContent?key=${config.geminiApiKey}`;

    const step3SystemInstruction = `
You are an expert fact-checker and administrative assistant for Korean laws, taxes, and immigration systems.
You will receive the document type and a list of action items extracted from an administrative/daily life notice in South Korea.

Your task is to:
1. Conduct google searches regarding the "documentType" and "actionItems" (e.g. how to pay this tax, what is the official deadline/penalty, convenient payment options like internet giro, wetax, or convenient stores).
2. Validate and enrich the action items and warnings. Specifically, add details such as:
   - Official administrative portal URLs (WeTax, Hometax, HiKorea, etc.) if applicable.
   - Standard available payment/filing methods (convenience store barcode, ATM, virtual bank account) based on Korean administrative standards.
   - Confirming if the penalties/warnings are legally accurate under current South Korean laws.
3. Return the FINAL, validated and enriched JSON output strictly matching the same JSON Schema.
4. Keep the output language for summary, action items, details, and warnings strictly in the target language (${langName}).
5. Extremely important: Return ONLY a valid raw JSON object. Do NOT wrap the response in markdown code blocks like \`\`\`json. Your response must be clean and parseable by JSON.parse.

Your output must strictly match the following JSON Schema:
{
  "documentType": "string",
  "summary": "string",
  "actionItems": [
    {
      "action": "string",
      "deadline": "string | null",
      "priority": "high" | "medium" | "low",
      "details": "string"
    }
  ],
  "warnings": ["string"]
}
`;

    const step3Prompt = `
Here is the analyzed document data that needs validation and enrichment:
- Document Type: ${step2Result.documentType}
- Draft Summary: ${step2Result.summary}
- Draft Action Items: ${JSON.stringify(step2Result.actionItems, null, 2)}
- Draft Warnings: ${JSON.stringify(step2Result.warnings, null, 2)}

Please perform Google searches to confirm the official procedures, deadlines, payment networks, or penalties in South Korea related to this. Return the ultimate, polished and grounded JSON data.
`;

    let finalResult = { ...step1Result, ...step2Result };

    try {
      const response = await fetch(step3ApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: step3Prompt }]
            }
          ],
          systemInstruction: {
            parts: [{ text: step3SystemInstruction }]
          },
          tools: [
            {
              google_search: {} // Google Search Grounding 기능 활성화
            }
          ],
          generationConfig: {
            temperature: 0.2 // responseMimeType 제거 (Grounding 도구와 JSON 모드 동시 지원 불가)
          }
        })
      });

      if (response.ok) {
        const responseData = (await response.json()) as any;
        const parts = responseData.candidates?.[0]?.content?.parts || [];
        const rawText = parts.map((p: any) => p.text || '').join('');

        if (rawText) {
          const step3Parsed = this.cleanAndParseJson(rawText);
          finalResult = {
            ...step1Result,
            documentType: step3Parsed.documentType || step2Result.documentType,
            summary: step3Parsed.summary || step2Result.summary,
            actionItems: step3Parsed.actionItems || step2Result.actionItems,
            warnings: step3Parsed.warnings || step2Result.warnings
          };
          console.log('[TranslationService] <<< STEP 3 Grounding 완료');
        } else {
          console.warn('⚠️ [TranslationService] STEP 3 응답에서 유효한 텍스트를 찾지 못해 STEP 2 결과를 복원합니다.');
        }
      } else {
        const errorBody = await response.json().catch(() => ({}));
        console.warn(`⚠️ [TranslationService] STEP 3 Grounding API 호출 실패. 상태코드: ${response.status}. 에러: ${JSON.stringify(errorBody)}. STEP 2 분석 결과로 Fallback 진행.`);
      }
    } catch (error) {
      console.error('⚠️ [TranslationService] STEP 3 Grounding 처리 중 오류 발생 (STEP 2 결과로 우아하게 저하):', error);
      // STEP 3 실패 시 STEP 2 결과 사용 (Graceful Degradation)
    }

    return finalResult;
  };

  /**
   * 번역 및 보정 결과를 로컬 Static 디렉토리에 파일로 익스포트합니다.
   * "📌 해야 할 일" 섹션을 포함하여 고도화된 보고서 문서를 작성합니다.
   */
  exportToDocument = async (
    result: TranslationResult,
    targetLanguage: string,
    format: 'md' | 'txt' = 'md',
    hostUrl: string
  ): Promise<FileExportResult> => {
    const publicDir = path.join(__dirname, '../../public');
    const downloadsDir = path.join(publicDir, 'downloads');

    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const uniqueId = Math.random().toString(36).substring(2, 8);
    const extension = format === 'txt' ? 'txt' : 'md';
    const fileName = `translation_${timestamp}_${uniqueId}.${extension}`;
    const filePath = path.join(downloadsDir, fileName);

    const langName = this.getLanguageName(targetLanguage);
    const dateStr = new Date().toLocaleString('ko-KR');

    // 우선순위 이모지 매핑 (priority가 undefined/null인 경우 방어 처리)
    const getPriorityEmoji = (priority: any) => {
      const p = (priority || '').toLowerCase();
      switch (p) {
        case 'high': return '🔴 (중요/긴급)';
        case 'medium': return '🟡 (보통)';
        case 'low': return '🟢 (낮음)';
        default: return '⚪';
      }
    };

    let content = '';
    if (format === 'txt') {
      content = `============================================================
🌐 AI 구글 렌즈 번역 및 행동 수칙 보고서 (Action Guidance Report)
📅 생성일시: ${dateStr}
🎯 대상언어: ${langName}
🗂️ 문서유형: ${result.documentType || '일반 텍스트'}
============================================================

[요약]
${result.summary || '문서의 요약 정보가 없습니다.'}

------------------------------------------------------------
1. 🔍 보정된 원본 텍스트 (Corrected Original Text)
------------------------------------------------------------
${result.correctedText}

------------------------------------------------------------
2. 📝 번역된 텍스트 (Translated Text)
------------------------------------------------------------
${result.translatedText}

------------------------------------------------------------
📌 3. 해야 할 일 안내 (Action Items)
------------------------------------------------------------
${result.actionItems && result.actionItems.length > 0 
  ? result.actionItems.map((item, idx) => 
      `${idx + 1}. [${getPriorityEmoji(item.priority)}] ${item.action}\n` +
      `   ⏰ 기한: ${item.deadline || '없음(상시)'}\n` +
      `   ℹ️ 세부 안내: ${item.details}`
    ).join('\n\n')
  : '해당 문서에 특별히 취해야 할 즉각적인 행동 지침이 없습니다.'
}

${result.warnings && result.warnings.length > 0 
  ? `------------------------------------------------------------\n⚠️ 4. 주의사항 및 미이행 시 불이익 (Warnings)\n------------------------------------------------------------\n` +
    result.warnings.map(warning => `• ${warning}`).join('\n')
  : ''
}

============================================================
${result.explanation ? `💡 5. AI 보정 및 번역 노트 (AI Notes)\n------------------------------------------------------------\n${result.explanation}\n============================================================` : ''}
`;
    } else {
      content = `# 🌐 AI 구글 렌즈 번역 및 행동 수칙 보고서
> **📅 생성 일시**: \`${dateStr}\`
> **🎯 대상 언어**: \`${langName}\`
> **🗂️ 문서 유형**: \`${result.documentType || '일반 텍스트'}\`

---

## 📌 문서 핵심 요약 (Summary)
> ${result.summary || '문서의 요약 정보가 없습니다.'}

---

## 🔍 1. 보정된 원본 텍스트 (Corrected Original Text)
\`\`\`text
${result.correctedText}
\`\`\`

---

## 📝 2. 번역된 텍스트 (Translated Text)
### ✏️ 번역 본문:
${result.translatedText}

---

## 📌 3. 해야 할 일 안내 (Action Items)
${result.actionItems && result.actionItems.length > 0
  ? `| 우선순위 | 해야 할 일 (Action) | 기한 (Deadline) | 구체적 안내 (Details) |
| :---: | :--- | :--- | :--- |
` + result.actionItems.map(item => 
      `| ${getPriorityEmoji(item.priority)} | **${item.action}** | ${item.deadline ? `\`${item.deadline}\`` : '`-`'} | ${item.details} |`
    ).join('\n')
  : '* 이 문서에서는 구체적으로 이행해야 할 긴급 행동 조치 사항이 발견되지 않았습니다.'
}

${result.warnings && result.warnings.length > 0
  ? `\n### ⚠️ 4. 주의사항 및 불이익 (Warnings)\n` +
    result.warnings.map(warning => `- **${warning}**`).join('\n')
  : ''
}

---

${result.explanation ? `## 💡 5. AI 보정 및 번역 노트 (AI Notes)\n${result.explanation}` : ''}
`;
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    const downloadUrl = `${hostUrl}/downloads/${fileName}`;

    return {
      fileName,
      filePath,
      downloadUrl
    };
  };

  /**
   * correctedText 내부의 키워드를 분석하여 적절한 표준 대응 지침을 documentGuides.json에서 조회합니다 (RAG).
   */
  private getLocalKnowledgeGuide(text: string): string {
    try {
      const guidesPath = path.join(__dirname, '../knowledge/documentGuides.json');
      if (!fs.existsSync(guidesPath)) {
        console.warn(`⚠️ [TranslationService] 로컬 지식베이스 파일이 존재하지 않습니다: ${guidesPath}`);
        return '';
      }
      const rawData = fs.readFileSync(guidesPath, 'utf-8');
      const guides = JSON.parse(rawData);

      const matchedGuides: string[] = [];
      for (const item of guides) {
        // 대소문자 구분 없이 키워드 매칭
        const hasKeyword = item.keywords.some((keyword: string) =>
          text.toLowerCase().includes(keyword.toLowerCase())
        );
        if (hasKeyword) {
          matchedGuides.push(`[참고 가이드북: ${item.displayName}]\n${item.guide}`);
        }
      }

      if (matchedGuides.length > 0) {
        return matchedGuides.join('\n\n');
      }
    } catch (error) {
      console.warn('⚠️ [TranslationService] 로컬 RAG 검색 중 오류 발생 (무시하고 계속 진행):', error);
    }
    return '';
  }

  /**
   * Gemini API의 응답 중 JSON 코드 블록 마크다운 등을 제거하고 안정적으로 파싱합니다.
   * 첫 '{'부터 마지막 '}'까지 잘라내는 강력한 방어 로직을 추가했습니다.
   */
  private cleanAndParseJson(rawText: string): any {
    let cleaned = rawText.trim();
    
    // 첫 '{'의 위치와 마지막 '}'의 위치를 찾아 그 사이만 자르기
    const startIdx = cleaned.indexOf('{');
    const endIdx = cleaned.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
      cleaned = cleaned.substring(startIdx, endIdx + 1);
    } else {
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.substring(7);
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.substring(3);
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.substring(0, cleaned.length - 3);
      }
    }
    
    return JSON.parse(cleaned.trim());
  }

  /**
   * 언어 코드를 사람이 읽기 쉬운 한글 텍스트 명칭으로 변환합니다.
   */
  private getLanguageName(code: string): string {
    const languages: Record<string, string> = {
      ko: '한국어 (Korean)',
      en: '영어 (English)',
      ja: '일본어 (Japanese)',
      zh: '중국어 (Chinese - Simplified)',
      'zh-TW': '중국어 번체 (Chinese - Traditional)',
      es: '스페인어 (Spanish)',
      fr: '프랑스어 (French)',
      de: '독일어 (German)',
      vi: '베트남어 (Vietnamese)',
      th: '태국어 (Thai)',
      ru: '러시아어 (Russian)',
    };
    return languages[code.toLowerCase()] || code.toUpperCase();
  }

  /**
   * API Key 누락 시, 지능적으로 그럴듯한 모의 ActionItem 데이터를 반환하는 Sandbox Mock 분기입니다.
   */
  private getMockDataByKeyword(text: string, targetLanguage: string, sourceLanguage: string): TranslationResult {
    const langName = this.getLanguageName(targetLanguage);
    const lowerText = text.toLowerCase();

    let documentType = '일반 텍스트';
    let summary = `[Mock Summary] 이 문서는 일반 안내문 혹은 텍스트 문서입니다. 대상 언어(${langName})로 번역 및 보정이 완료되었습니다.`;
    let actionItems: ActionItem[] = [];
    let warnings: string[] = [];

    // 키워드 분석에 기반한 지능적 Mock
    if (
      lowerText.includes('전기') ||
      lowerText.includes('수도') ||
      lowerText.includes('가스') ||
      lowerText.includes('고지서') ||
      lowerText.includes('electric') ||
      lowerText.includes('water') ||
      lowerText.includes('gas') ||
      lowerText.includes('utility') ||
      lowerText.includes('지로')
    ) {
      documentType = '공과금 고지서';
      summary = `[Mock Summary] 대한민국 공과금 납부 고지서입니다. 전기, 수도, 가스 등 자원 이용에 따른 당월 요금 청구 내역입니다.`;
      actionItems = [
        {
          action: '청구 요금을 납부 마감 기한 내에 지불하십시오.',
          deadline: 'YYYY-MM-DD (고지서 기한)',
          priority: 'high',
          details: '편의점 계산대에 고지서 바코드를 제시하여 현금/카드로 지불하거나, 명시된 가상계좌(Virtual Account)로 은행 이체할 수 있습니다. 위택스나 카카오페이 등 모바일 결제도 지원됩니다.'
        }
      ];
      warnings = [
        '기한 내에 납부하지 않으면 약 2~3%의 연체 가산금이 부과됩니다.',
        '체납이 수개월 지속될 시 전력, 가스, 수도 등 공급망 차단 조치가 이루어질 수 있습니다.'
      ];
    } else if (
      lowerText.includes('외국인') ||
      lowerText.includes('등록') ||
      lowerText.includes('비자') ||
      lowerText.includes('체류') ||
      lowerText.includes('출입국') ||
      lowerText.includes('visa') ||
      lowerText.includes('alien') ||
      lowerText.includes('immigration') ||
      lowerText.includes('arc')
    ) {
      documentType = '출입국 및 외국인 등록 안내문';
      summary = `[Mock Summary] 출입국관리법에 따른 외국인 관리 행정 안내문입니다. 외국인 등록, 체류지 변경 신고의 법적 의무를 고지하고 있습니다.`;
      actionItems = [
        {
          action: '신규 이사 후 15일 이내에 체류지 변경 신고를 진행하십시오.',
          deadline: '이사 완료일로부터 15일 이내',
          priority: 'high',
          details: '관할 읍면동 주민센터에 직접 방문하거나, 정부 포털 하이코리아(hicorea.go.kr) 또는 정부24 사이트를 통해 온라인으로 체류지 변경을 신고할 수 있습니다. 여권, 외국인등록증, 임대차계약서가 필요합니다.'
        },
        {
          action: '체류 기간이 만료되기 전에 비자 연장 신청을 접수하십시오.',
          deadline: '체류 기간 만료일 이전',
          priority: 'high',
          details: '비자 만료 4개월 전부터 예약이 가능하며 하이코리아(HiKorea)를 통한 방문 예약 혹은 온라인 연장 신청으로 필요 서류를 제출해야 합니다.'
        }
      ];
      warnings = [
        '체류지 변경 신고 기한(15일)을 넘길 경우 출입국관리법 제36조 위반으로 최대 100만 원 이하의 과태료가 부과됩니다.',
        '체류 만료일까지 연장 절차를 밟지 않으면 불법 체류로 규정되어 벌금 부과 및 강제 퇴거 처분을 받을 수 있습니다.'
      ];
    } else if (
      lowerText.includes('임대') ||
      lowerText.includes('전세') ||
      lowerText.includes('월세') ||
      lowerText.includes('보증금') ||
      lowerText.includes('확정일자') ||
      lowerText.includes('주민센터') ||
      lowerText.includes('lease') ||
      lowerText.includes('rent') ||
      lowerText.includes('deposit')
    ) {
      documentType = '주택 임대차 계약서';
      summary = `[Mock Summary] 대한민국 주택 임차 계약서입니다. 임차인의 보증금 회수 권리를 지키기 위해 주민등록 및 확정일자 확보가 요구됩니다.`;
      actionItems = [
        {
          action: '주택 입주 당일, 관할 주민센터에 방문하여 전입신고 및 계약서 확정일자를 받으십시오.',
          deadline: '이사 완료 당일 즉시',
          priority: 'high',
          details: '임대차계약서 원본과 외국인등록증을 소지하고 전입 주민센터에 직접 내방하십시오. 이는 주택임대차보호법상 보증금 최우선변제 권리를 얻기 위한 필수 요건입니다.'
        }
      ];
      warnings = [
        '주민등록(체류지신고)과 확정일자가 미완비 상태라면 주택이 경매나 공매에 부쳐질 때 보증금을 전액 돌려받지 못하는 우선변제권을 박탈당합니다.'
      ];
    } else if (
      lowerText.includes('근로') ||
      lowerText.includes('고용') ||
      lowerText.includes('임금') ||
      lowerText.includes('월급') ||
      lowerText.includes('급여') ||
      lowerText.includes('최저임금') ||
      lowerText.includes('contract') ||
      lowerText.includes('salary') ||
      lowerText.includes('wage')
    ) {
      documentType = '근로 계약서';
      summary = `[Mock Summary] 고용주와 근로자 간에 체결하는 근로 조건, 근무 시간, 임금 정산 명세를 확정하는 근로계약 문서입니다.`;
      actionItems = [
        {
          action: '체결된 근로계약서 1부를 교부받아 안전한 곳에 소장하십시오.',
          deadline: '근무 개시 이전',
          priority: 'high',
          details: '근로기준법에 따라 모든 근로계약은 계약서 작성 후 근로자에게 1부 서면 교부되는 것이 의무입니다. 분쟁 발생 시 권리 구제의 핵심 근거가 됩니다.'
        },
        {
          action: '주휴수당 및 퇴직금 지급 자격을 점검하십시오.',
          deadline: '매월 임금 지급일',
          priority: 'medium',
          details: '소정 근로시간 주 15시간 이상 개근 시 주당 1일분 유급수당(주휴수당)이 기본 부과되어야 합니다. 1년 이상 상시 근로 시 퇴직금 청구 대상이 됩니다.'
        }
      ];
      warnings = [
        '근로계약서를 서면으로 체결 및 제공하지 않은 고용주는 근로기준법 위반으로 500만 원 이하의 벌금에 처해질 수 있습니다.'
      ];
    } else if (
      lowerText.includes('세금') ||
      lowerText.includes('주민세') ||
      lowerText.includes('자동차세') ||
      lowerText.includes('재산세') ||
      lowerText.includes('tax') ||
      lowerText.includes('세무')
    ) {
      documentType = '세금 고지서';
      summary = `[Mock Summary] 국가 혹은 지방자치단체에서 부과하는 공공 납세 고지 문서입니다.`;
      actionItems = [
        {
          action: '부과된 세금을 공식 세금 수납망을 이용해 완납하십시오.',
          deadline: 'YYYY-MM-DD (고지서 지정 납기일)',
          priority: 'high',
          details: '위택스(wetax.go.kr) 또는 국세청 홈택스(hometax.go.kr) 웹사이트 및 앱에 로그인하여 카드/계좌 납부하거나 지로 가상계좌 이체를 수행하십시오.'
        }
      ];
      warnings = [
        '기한 초과 시 3% 수준의 납부지연 가산세가 즉시 적용됩니다.',
        '체납 상태가 누적되면 법적 독촉에 이어 은행 계좌 가압류 또는 보유 재산(차량 번호판 영치 등) 처분이 강제 집행됩니다.'
      ];
    } else if (
      lowerText.includes('과태료') ||
      lowerText.includes('범칙금') ||
      lowerText.includes('위반') ||
      lowerText.includes('주차') ||
      lowerText.includes('fine') ||
      lowerText.includes('penalty')
    ) {
      documentType = '교통 범칙금 및 과태료 고지서';
      summary = `[Mock Summary] 주정차 위반, 신호 및 속도 초과 등 교통 질서 위반에 대한 과태료 청구서입니다.`;
      actionItems = [
        {
          action: '의견제출 및 자진 납부 기한 이내에 자진 납부하여 20%의 감경 혜택을 받으십시오.',
          deadline: '의견제출 마감 기한 전까지',
          priority: 'high',
          details: '법규에 따라 의견제출 기간 중 과태료를 즉시 내면 정가에서 20% 자동 감면 처리를 해 줍니다. 경찰청 교통민원24 이파인(efine.go.kr)에서 결제할 수 있습니다.'
        }
      ];
      warnings = [
        '기한 내에 미납된 과태료는 최대 77%까지 무서운 중가산금이 중첩되어 부과됩니다.',
        '체납 고액 누적 시 소유 차량이 강제 압류되거나 공매 처분될 위험이 도사립니다.'
      ];
    } else if (
      lowerText.includes('건강보험') ||
      lowerText.includes('보험료') ||
      lowerText.includes('검진') ||
      lowerText.includes('nhis') ||
      lowerText.includes('health') ||
      lowerText.includes('insurance')
    ) {
      documentType = '국민건강보험 및 건강검진 안내문';
      summary = `[Mock Summary] 국민건강보험 공단에서 제공하는 건강보험 유지 세칙 및 전 국민 정기 종합건강검진 지원에 대한 정보지입니다.`;
      actionItems = [
        {
          action: '해당 연도 대상자인지 조회 후 무료 종합 건강검진을 예약하십시오.',
          deadline: '해당 연도 12월 31일까지',
          priority: 'medium',
          details: '건강보험공단 지정 전국 검진 가능 병원에 전화를 걸어 검진 일정을 확인하고 예약하십시오. 본인 부담금 0% 또는 10% 미만의 저렴한 비용으로 수십 만원 상당의 건강 점검을 받을 수 있습니다.'
        }
      ];
      warnings = [
        '건강보험료를 연체할 경우 병원에 가서 진료를 받을 때 건보 적용을 받지 못해 비싼 100% 진료비를 직접 수납해야 합니다.',
        '외국인이 건강보험료 체납을 해결하지 않으면 법무부 출입국 외국인청 비자 만료 연장 시 연장 거부 및 제약이 가해집니다.'
      ];
    } else if (
      lowerText.includes('법원') ||
      lowerText.includes('소송') ||
      lowerText.includes('송달') ||
      lowerText.includes('판결') ||
      lowerText.includes('court') ||
      lowerText.includes('lawsuit')
    ) {
      documentType = '법원 및 행정 송달 문서';
      summary = `[Mock Summary] 사법 행정부 및 공무소에서 송부한 공식 우편 등기 서류입니다. 수령일로부터의 대응 일수가 명명백백하게 결정됩니다.`;
      actionItems = [
        {
          action: '소장 수령일로부터 30일 이내에 항변서 및 답변서를 서면 법원에 도달시키십시오.',
          deadline: '소장 송달 수령 후 30일 이내',
          priority: 'high',
          details: '상대방 청구 사항에 반대하고 이의를 제기하려는 피고는 30일 내에 정밀하게 반박을 담은 민사 답변서를 법원 소송 담당 부서에 접수해야 합니다.'
        }
      ];
      warnings = [
        '30일 법정 기한 내에 답변서를 보내지 않으면 변론할 권리를 포기하고 원고의 일방적 주장만을 인정하는 자백간주 규정이 발동하여, 즉각 피고 무변론 패소 판결이 하달됩니다.'
      ];
    } else {
      // 일반/기타 텍스트 문서
      actionItems = [
        {
          action: '번역된 서류 명세를 참고하여 필요한 대처가 필요한지 여부를 확인해 보십시오.',
          deadline: null,
          priority: 'low',
          details: '이 문서는 특수한 행정 고지서가 아닌 표준 문서로 파악되었습니다. 번역된 텍스트의 주의 권고사항을 꼼꼼히 검수하고 개별 대처 계획을 검토하세요.'
        }
      ];
    }

    return {
      correctedText: text
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() + ' (AI 보정 완료 - Mock)',
      translatedText: `[Mock Translation - ${langName}] (API Key 누락으로 인한 가상 번역)\n원본: "${text.substring(0, 80)}..."\n\n이 텍스트는 대한민국 행정 절차 가이드라인 및 번역 기능 Sandbox용 시뮬레이션 번역본입니다. 실제 API Key가 제공되면 1.5 Pro 모델을 통해 정확하게 변역 가동됩니다.`,
      explanation: `[Mock AI Note - ${sourceLanguage} -> ${targetLanguage}]\n- 원문의 구문 형식을 자동 파악해 [${documentType}] 양식으로 감지했습니다.\n- 번역과 함께 사용자가 기한 내 이행해야 할 할 일을 추출하여 제공합니다.`,
      documentType,
      summary,
      actionItems,
      warnings
    };
  }
}

export const translationService = new TranslationService();
