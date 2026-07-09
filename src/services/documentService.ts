import fs from 'fs';
import path from 'path';
import { config } from '../config/env';
import { DocumentAnalysisResult, FileExportResult } from '../types/document';

export class DocumentService {
  /**
   * Gemini API를 활용하여 이민자가 업로드한 구글 렌즈 OCR 서류 본문을 분석합니다.
   * 서류 유형 감지, 실천 지침(Action Plan), 법적 의무 및 위반 규정(Legal Obligations), 연계 후속 서류 로드맵(Next Steps)을 생성합니다.
   * API Key가 없는 경우 Sandbox Mock 데이터로 우회 동작합니다.
   */
  analyzeDocument = async (
    text: string,
    targetLanguage: string = 'ko',
    sourceLanguage: string = 'auto'
  ): Promise<DocumentAnalysisResult> => {
    // 1. Gemini API Key 누락 시 Sandbox Mock 대응
    if (!config.geminiApiKey || config.geminiApiKey === 'your_gemini_api_key_here') {
      console.warn('⚠️ [DocumentService] GEMINI_API_KEY가 비어있거나 기본값입니다. 개발 편의를 위해 Mock 모드로 가동합니다.');
      
      const langName = this.getLanguageName(targetLanguage);

      let mockDocType = '기타 일반 행정 문서 (General Document)';
      let mockActionPlan = [
        '문서의 핵심 일정을 확인하고 캘린더에 등록하세요.',
        '필요시 사본을 복사하여 안전한 곳에 보관하세요.',
        '관련 행정 기관에 제출해야 하는 서류인지 확인해 보세요.'
      ];
      let mockLegalObligations = [
        '대한민국 출입국관리법에 따라 체류지 정보 변경 및 신상정보 변경 시 반드시 14일 이내에 신고해야 합니다.',
        '규정 위반 시 최대 100만 원 이하의 과태료가 부과될 수 있으므로 유의하십시오.'
      ];
      let mockNextRoadmap = {
        currentStep: '일반 행정 문서 접수 및 번역 단계',
        nextSteps: [
          {
            documentName: '체류지 변경신고서 (Report of Change of Residence)',
            description: '한국에서 거주지를 이동한 경우, 이사 후 거주지가 적법하게 변경되었음을 알리는 가장 중요한 서류입니다.',
            deadline: '전입(이사) 완료 후 14일 이내',
            howToApply: '관할 동 주민센터 또는 출입국사무소 방문, 또는 하이코리아(HiKorea) 및 정부24 온라인 신청'
          },
          {
            documentName: '외국인등록사항 변경신고서 (Report of Change in Registered Information)',
            description: '여권번호, 성명, 성별, 국적 또는 소속 기관 등이 변경된 경우 제출해야 합니다.',
            deadline: '변경 사유 발생일로부터 14일 이내',
            howToApply: '관할 출입국·외국인관서 방문 또는 하이코리아 온라인 접수'
          }
        ]
      };

      // 텍스트 매칭을 통한 정교한 Mock 분기 (한국어/영어 대응)
      const cleanText = text.replace(/\s+/g, '').toLowerCase();
      if (
        cleanText.includes('임대') || 
        cleanText.includes('월세') || 
        cleanText.includes('전세') || 
        cleanText.includes('계약서') || 
        cleanText.includes('lease') || 
        cleanText.includes('contract') || 
        cleanText.includes('deposit')
      ) {
        mockDocType = '부동산 임대차 계약서 (Housing Lease Agreement)';
        mockActionPlan = [
          '계약서 상의 보증금 및 월세 금액, 납부일을 다시 한 번 검토하세요.',
          '임대인(집주인)과 임차인(본인)의 신원 정보가 신분증과 일치하는지 대조하십시오.',
          '계약 잔금을 납부하고 열쇠를 수령한 당일, 반드시 주민센터나 인터넷등기소에서 확정일자를 받으십시오.'
        ];
        mockLegalObligations = [
          '주택임대차보호법에 따라 임대차 계약 체결일(계약금 가계약 포함)로부터 30일 이내에 주택 임대차 신고(전월세 신고)를 해야 합니다. (지연 시 과태료 발생)',
          '출입국관리법 제36조에 따라, 이사 후 반드시 **14일 이내**에 체류지 변경 신고를 마쳐야 합니다. 기한 초과 시 출입국관리법 위반으로 최대 100만 원 이하의 과태료가 부과됩니다.'
        ];
        mockNextRoadmap = {
          currentStep: '주거 계약 완료 및 한국 내 주소지 확정 단계',
          nextSteps: [
            {
              documentName: '체류지 변경신고서 (Report of Change of Residence)',
              description: '임대차 계약서 사본과 외국인등록증을 제출하여 법적인 거주지 등록을 완료하는 행정 절차입니다.',
              deadline: '이사 입주 완료일로부터 14일 이내',
              howToApply: '거주지 관할 주민센터 방문(동주민센터 추천), 관할 출입국사무소 방문, 또는 하이코리아(Hikorea.go.kr)에서 온라인 신청'
            },
            {
              documentName: '주택 임대차 계약 확정일자 부여 신청 (Application for Fixed Date)',
              description: '임대인 사정으로 집이 경매에 넘어갈 경우 보증금을 우선적으로 보호받기 위한(우선변제권 확보) 법적 장치입니다.',
              deadline: '잔금 지급 및 입주 완료 당일 즉시 처리 권장',
              howToApply: '관할 동 주민센터 방문(계약서 원본 지참 필수) 또는 대법원 인터넷등기소 홈페이지 온라인 신청'
            }
          ]
        };
      } else if (
        cleanText.includes('외국인') || 
        cleanText.includes('등록증') || 
        cleanText.includes('alien') || 
        cleanText.includes('registration') || 
        cleanText.includes('arc') || 
        cleanText.includes('nationality')
      ) {
        mockDocType = '외국인등록증 (Alien Registration Card / ARC)';
        mockActionPlan = [
          '외국인등록번호 및 영문 성명, 체류자격(비자 코드)에 오기가 없는지 꼼꼼하게 검사하세요.',
          '카드 뒷면에 기재되는 체류 만료일(Date of Expiration)을 확인하고 캘린더에 저장하여 연장 타이밍을 놓치지 않도록 관리하세요.'
        ];
        mockLegalObligations = [
          '출입국관리법 제31조에 따라, 대한민국에 90일을 초과하여 체류하려는 모든 외국인은 입국일로부터 **90일 이내**에 외국인등록을 하고 외국인등록증을 발급받아야 합니다. (미등록 체류 시 형사 처벌 및 강제 퇴거 대상)',
          '여권 사항(번호, 발급일, 만료일), 체류지(거주지), 소속 학교 또는 직장 등이 변경된 경우 변경일로부터 **14일 이내**에 출입국사무소에 자진 신고해야 합니다. 기한 미준수 시 위반 일수에 비례해 과태료가 차등 부과됩니다.'
        ];
        mockNextRoadmap = {
          currentStep: '대한민국 법적 체류 신분 및 고유 식별번호 확보 완료',
          nextSteps: [
            {
              documentName: '체류기간 연장허가 신청서 (Application for Extension of Stay)',
              description: '현재 부여받은 체류 기한이 만료되기 전에 지속적인 체류 자격을 확보하기 위해 사전에 연장 신청을 해야 합니다.',
              deadline: '체류기간 만료일 4개월 전부터 만료 당일까지 신청 가능',
              howToApply: '하이코리아(HiKorea) 홈페이지를 통한 사전 방문 예약 후 관할 출입국·외국인관서 방문, 또는 일부 자격에 대해 전자민원(온라인) 신청'
            },
            {
              documentName: '국민건강보험 외국인 지역가입 (National Health Insurance)',
              description: '외국인등록을 완료한 외국인은 법령에 따라 건강보험 가입이 의무화됩니다. (비자 유형에 따라 자동 연동 혹은 수동 신청 가능)',
              deadline: '외국인등록증 발급 즉시 또는 최초 입국일로부터 6개월 경과 시점',
              howToApply: '국민건강보험공단 외국인 전용 고객센터(033-811-2000)를 통한 가입 상태 확인 및 지사 방문 신청'
            }
          ]
        };
      }

      return {
        correctedText: text
          .replace(/[\r\n]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim() + ' (AI 보정 완료)',
        translatedText: `[Mock Translation - ${langName}] 이 결과는 GEMINI_API_KEY가 등록되지 않아 가상으로 분석된 모의 번역 텍스트입니다. 원본 일부: "${text.substring(0, 50)}..."`,
        documentType: mockDocType,
        explanation: `이 모의 응답은 Sandbox 개발 및 테스트용입니다. 실제로 작동하려면 .env에 유효한 구글 AI API 키를 입력해 주세요. 타겟 언어: ${targetLanguage}, 감지 소스: ${sourceLanguage}`,
        actionPlan: mockActionPlan,
        legalObligations: mockLegalObligations,
        nextRoadmap: mockNextRoadmap
      };
    }

    // 2. Gemini API 호출 준비
    const model = 'gemini-1.5-flash';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.geminiApiKey}`;

    const langName = this.getLanguageName(targetLanguage);
    const sourceLangDesc = sourceLanguage === 'auto' ? '자동 감지' : this.getLanguageName(sourceLanguage);

    const systemInstruction = `
You are a highly professional translation, administrative process, and OCR correction expert specialized in immigrant services.
The user will provide a raw text extracted from an image using Google Lens (OCR). This text is usually a legal or administrative document (e.g., Alien Registration Card, Lease Agreement, Employment Contract, Visa Document, Tax Certificate, etc.) from Korea or other countries, and it may contain various OCR errors, typos, missing spaces, bad line breaks, and formatting inconsistencies.

Your task is to:
1. "correctedText": Clean up and correct all OCR errors, typos, spelling mistakes, spacing, and broken line-breaks in the original source language. Retain paragraphs and keep the original meaning.
2. "translatedText": Translate the corrected text into the target language (${langName}) with natural, polished, and contextually accurate phrasing.
3. "documentType": Detect and identify the type of the administrative document (e.g., "부동산 임대차 계약서 (Housing Lease Agreement)", "외국인등록증 (Alien Registration Card)", "표준근로계약서 (Standard Labor Contract)", etc.). Be specific and include both Korean and English if possible.
4. "explanation": Provide a brief explanation (in Korean) detailing the main corrections made (such as OCR typos fixed, line breaks joined, or translation notes).
5. "actionPlan": Based on the detected document type and local situation (especially Korean administrative procedures), list step-by-step practical action items the immigrant must take with this document in chronological order. Write each step clearly in Korean.
6. "legalObligations": Extract and list any legal obligations, deadlines, and potential penalties/fines associated with this document under local laws (e.g., "Must report address change within 14 days, failure to do so results in a fine up to 1 million KRW under Article 36 of the Immigration Act"). Write in Korean.
7. "nextRoadmap": Provide a roadmap mapping the next sequential documents or administrative steps the immigrant must prepare after completing this document, to ensure they do not miss critical steps in their immigrant journey. It must include:
   - "currentStep": Describe the significance of the current document in their administrative timeline.
   - "nextSteps": An array of next steps/documents. Each entry should have:
     - "documentName": Name of the next document or procedure to prepare.
     - "description": Why this document is required next in the sequence.
     - "deadline": The legal or recommended deadline for this next step.
     - "howToApply": Detailed instructions on where and how to apply (e.g., online portals like HiKorea/Gov24, or physical offices like local community centers/immigration offices).

You must return your output strictly in JSON format matching the following JSON Schema:
{
  "correctedText": "string (the cleaned-up and corrected original text)",
  "translatedText": "string (the translated text in the target language)",
  "documentType": "string (detected document type with English abbreviation in parentheses if applicable)",
  "explanation": "string (brief explanation in Korean about OCR correction and translation notes)",
  "actionPlan": ["string (step 1)", "string (step 2)", ...],
  "legalObligations": ["string (legal obligation 1 with deadlines and fines if any)", ...],
  "nextRoadmap": {
    "currentStep": "string (timeline context of this current document)",
    "nextSteps": [
      {
        "documentName": "string (name of next document)",
        "description": "string (why it is needed next)",
        "deadline": "string (legal deadline or recommended timeline)",
        "howToApply": "string (how and where to submit/apply)"
      }
    ]
  }
}

Do not include any markdown code blocks (such as \`\`\`json) in the raw response. Return only the raw JSON object.
`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Original Extracted Text (Source Language: ${sourceLangDesc}):\n${text}`
                }
              ]
            }
          ],
          systemInstruction: {
            parts: [
              {
                text: systemInstruction
              }
            ]
          },
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.3,
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Gemini API 호출에 실패했습니다. (상태 코드: ${response.status}) - ${JSON.stringify(errorData)}`
        );
      }

      const responseData = (await response.json()) as any;
      const rawText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        throw new Error('Gemini API로부터 올바른 텍스트 응답을 수신하지 못했습니다.');
      }

      // JSON 파싱 및 최종 병합
      const parsedResult: DocumentAnalysisResult = JSON.parse(rawText.trim());
      return {
        correctedText: parsedResult.correctedText || text,
        translatedText: parsedResult.translatedText || '',
        documentType: parsedResult.documentType || '미확인 행정 서류 (Unidentified Document)',
        explanation: parsedResult.explanation || '',
        actionPlan: parsedResult.actionPlan || [],
        legalObligations: parsedResult.legalObligations || [],
        nextRoadmap: parsedResult.nextRoadmap || { currentStep: '문서 분석', nextSteps: [] }
      };
    } catch (error: any) {
      console.error('[DocumentService] analyzeDocument 에러:', error);
      throw new Error(`AI 행정 서류 분석 처리 중 오류가 발생했습니다: ${error.message}`);
    }
  };

  /**
   * 행정 서류 분석 결과를 로컬 Static 디렉토리에 파일로 익스포트합니다.
   */
  exportToDocument = async (
    result: DocumentAnalysisResult,
    targetLanguage: string,
    format: 'md' | 'txt' = 'md',
    hostUrl: string
  ): Promise<FileExportResult> => {
    const publicDir = path.join(__dirname, '../../public');
    const downloadsDir = path.join(publicDir, 'downloads');

    // 1. 폴더 생성 자동화
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const uniqueId = Math.random().toString(36).substring(2, 8);
    const extension = format === 'txt' ? 'txt' : 'md';
    const fileName = `document_analysis_${timestamp}_${uniqueId}.${extension}`;
    const filePath = path.join(downloadsDir, fileName);

    const langName = this.getLanguageName(targetLanguage);
    const dateStr = new Date().toLocaleString('ko-KR');

    // 2. 포맷별 문서 생성
    let content = '';
    if (format === 'txt') {
      content = `============================================================
🌐 AI 행정 서류 종합 분석 및 로드맵 보고서
📅 생성일시: ${dateStr}
🎯 번역언어: ${langName}
📄 문서유형: ${result.documentType}
============================================================

1. 🔍 보정된 원본 텍스트 (Corrected Original Text)
------------------------------------------------------------
${result.correctedText}

------------------------------------------------------------
2. 📝 번역된 텍스트 (Translated Text)
------------------------------------------------------------
${result.translatedText}

------------------------------------------------------------
3. 💡 AI 보정 및 번역 노트 (AI Notes)
------------------------------------------------------------
${result.explanation || '특이사항 없음'}

------------------------------------------------------------
4. 📋 단계별 조치 사항 (Action Plan)
------------------------------------------------------------
${result.actionPlan.map((step, idx) => `${idx + 1}. ${step}`).join('\n')}

------------------------------------------------------------
5. ⚠️ 필수 법적 의무 및 규정 (Legal Obligations)
------------------------------------------------------------
${result.legalObligations.map(item => `- ${item}`).join('\n')}

------------------------------------------------------------
6. 🗺️ 다음 서류 준비 로드맵 (Next Document Roadmap)
------------------------------------------------------------
📍 현재 행정 위치: ${result.nextRoadmap.currentStep}

[다음에 연계하여 작성/신고해야 할 서류들]
${result.nextRoadmap.nextSteps.map((step, idx) => `
[Step ${idx + 1}] ${step.documentName}
- 용도 및 필요 이유: ${step.description}
- 법적/권장 기한: ${step.deadline || '없음'}
- 신청 및 접수 방법: ${step.howToApply}
`).join('\n')}
============================================================
`;
    } else {
      // Markdown Format (기본값)
      content = `# 🌐 AI 행정 서류 종합 분석 및 로드맵 보고서
> **📅 생성 일시**: \`${dateStr}\`
> **🎯 번역 언어**: \`${langName}\`
> **📄 문서 유형**: \`${result.documentType}\`

---

## 🔍 1. 보정된 원본 텍스트 (Corrected Original Text)
*구글 렌즈에서 추출할 때 파손된 단어, 띄어쓰기, 무의미한 줄바꿈 등을 Gemini AI가 원본 맥락에 맞게 보정한 텍스트입니다.*

\`\`\`text
${result.correctedText}
\`\`\`

---

## 📝 2. 번역된 텍스트 (Translated Text)
*보정 완료된 텍스트를 기준으로 정밀하고 유려하게 번역된 결과물입니다.*

### ✏️ 번역 본문:
${result.translatedText}

---

## 💡 3. AI 보정 및 번역 노트 (AI Notes)
${result.explanation || '특이사항 없음'}

---

## 🏃‍♂️ 4. 서류 조치 사항 및 법적 의무 (Action Plan & Legal Obligations)

### 📋 단계별 조치 사항 (Action Plan)
${result.actionPlan.map((step, idx) => `${idx + 1}. ${step}`).join('\n')}

### ⚠️ 필수 법적 의무 및 규정 (Legal Obligations)
${result.legalObligations.map(item => `- **${item}**`).join('\n')}

---

## 🗺️ 5. 다음 서류 준비 로드맵 (Next Document Roadmap)
*이민자 행정 처리를 빠뜨리지 않도록 현재 단계 이후에 연계하여 준비해야 할 서류들입니다.*

> **📍 현재 행정 위치**: \`${result.nextRoadmap.currentStep}\`

### 📋 다음에 작성/신고해야 할 서류들 (Next Steps):
${result.nextRoadmap.nextSteps.map((step, idx) => `
### 🔹 [Step ${idx + 1}] ${step.documentName}
- **💡 용도 및 필요 이유**: ${step.description}
- **⏰ 법적/권장 기한**: \`${step.deadline || '없음'}\`
- **🏛️ 신청 및 접수 방법**: ${step.howToApply}
`).join('\n')}
`;
    }

    // 3. 파일 저장
    fs.writeFileSync(filePath, content, 'utf-8');

    // 4. 익스포트 결과 구성
    const downloadUrl = `${hostUrl}/downloads/${fileName}`;

    return {
      fileName,
      filePath,
      downloadUrl
    };
  };

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
}

export const documentService = new DocumentService();
