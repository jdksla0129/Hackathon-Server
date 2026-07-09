import fs from 'fs';
import path from 'path';
import { config } from '../config/env';

export interface TranslationResult {
  correctedText: string;
  translatedText: string;
  explanation: string;
}

export interface FileExportResult {
  fileName: string;
  filePath: string;
  downloadUrl: string;
}

export class TranslationService {
  /**
   * Gemini API를 활용하여 Google Lens OCR 원본 텍스트의 오타/줄바꿈을 보정한 후, 지정된 언어로 번역을 수행합니다.
   * API Key가 없는 경우 Sandbox Mock 데이터로 우회 동작합니다.
   */
  translateAndCorrect = async (
    text: string,
    targetLanguage: string = 'ko',
    sourceLanguage: string = 'auto'
  ): Promise<TranslationResult> => {
    // 1. Gemini API Key 누락 시 Sandbox Mock 대응
    if (!config.geminiApiKey || config.geminiApiKey === 'your_gemini_api_key_here') {
      console.warn('⚠️ [TranslationService] GEMINI_API_KEY가 비어있거나 기본값입니다. 개발 편의를 위해 Mock 모드로 가동합니다.');
      
      const langName = this.getLanguageName(targetLanguage);
      return {
        correctedText: text
          .replace(/[\r\n]+/g, ' ') // 줄바꿈 단순화 시뮬레이션
          .replace(/\s+/g, ' ')
          .trim() + " (AI 보정 완료)",
        translatedText: `[Mock Translation - ${langName}] 이 결과는 GEMINI_API_KEY가 .env 파일에 등록되지 않아 가상으로 생성된 모의 번역 텍스트입니다. 원본 텍스트 일부: "${text.substring(0, 50)}..."`,
        explanation: `이 모의 응답은 Sandbox 개발 전용입니다. 실제로 작동하려면 .env에 유효한 구글 AI API 키를 입력해 주세요. 타겟 언어: ${targetLanguage}, 감지 소스: ${sourceLanguage}`
      };
    }

    // 2. Gemini API 호출 준비
    const model = 'gemini-1.5-flash';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.geminiApiKey}`;

    const langName = this.getLanguageName(targetLanguage);
    const sourceLangDesc = sourceLanguage === 'auto' ? '자동 감지' : this.getLanguageName(sourceLanguage);

    const systemInstruction = `
You are a highly professional translation and OCR correction expert.
The user will provide a raw text extracted from an image using Google Lens (OCR). The text might contain various OCR errors, typos, missing spaces, bad line breaks, and formatting inconsistencies.

Your task is to:
1. "correctedText": Clean up and correct all OCR errors, typos, spelling mistakes, spacing, and broken line-breaks in the original source language. Retain paragraphs and keep the original meaning.
2. "translatedText": Translate the corrected text into the target language (${langName}) with natural, polished, and contextually accurate phrasing.
3. "explanation": Provide a brief explanation (in Korean) detailing the main corrections made (such as OCR typos fixed, line breaks joined, or translation notes).

You must return your output strictly in JSON format matching the following JSON Schema:
{
  "correctedText": "string (the cleaned-up and corrected original text)",
  "translatedText": "string (the translated text in the target language)",
  "explanation": "string (brief explanation in Korean about OCR correction and translation notes)"
}

Do not include any markdown code blocks (such as \`\`\`json) in the raw response. Return only the JSON object.
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

      // JSON 파싱
      const parsedResult: TranslationResult = JSON.parse(rawText.trim());
      return {
        correctedText: parsedResult.correctedText || text,
        translatedText: parsedResult.translatedText || '',
        explanation: parsedResult.explanation || ''
      };
    } catch (error: any) {
      console.error('[TranslationService] translateAndCorrect 에러:', error);
      throw new Error(`AI 보정 및 번역 처리 중 오류가 발생했습니다: ${error.message}`);
    }
  };

  /**
   * 번역 및 보정 결과를 로컬 Static 디렉토리에 파일로 익스포트합니다.
   */
  exportToDocument = async (
    result: TranslationResult,
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
    const fileName = `translation_${timestamp}_${uniqueId}.${extension}`;
    const filePath = path.join(downloadsDir, fileName);

    const langName = this.getLanguageName(targetLanguage);
    const dateStr = new Date().toLocaleString('ko-KR');

    // 2. 포맷별 문서 생성
    let content = '';
    if (format === 'txt') {
      content = `============================================================
🌐 AI 구글 렌즈 번역 및 오타 보정 보고서
📅 생성일시: ${dateStr}
🎯 대상언어: ${langName}
============================================================

1. 🔍 보정된 원본 텍스트 (Corrected Original Text)
------------------------------------------------------------
${result.correctedText}

------------------------------------------------------------
2. 📝 번역된 텍스트 (Translated Text)
------------------------------------------------------------
${result.translatedText}

============================================================
${result.explanation ? `3. 💡 AI 보정 및 번역 노트 (AI Notes)\n------------------------------------------------------------\n${result.explanation}\n============================================================` : ''}
`;
    } else {
      // Markdown Format (기본값)
      content = `# 🌐 AI 구글 렌즈 번역 및 오타 보정 보고서
> **📅 생성 일시**: \`${dateStr}\`
> **🎯 대상 언어**: \`${langName}\`

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

${
  result.explanation
    ? `## 💡 3. AI 보정 및 번역 노트 (AI Notes)
${result.explanation}
`
    : ''
}
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

export const translationService = new TranslationService();
