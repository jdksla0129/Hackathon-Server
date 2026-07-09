import { Request, Response } from 'express';
import { translationService } from '../services/translationService';

export class TranslationController {
  private translationService = translationService;

  /**
   * [POST] /api/translation/translate
   * 구글 렌즈로 획득한 텍스트의 오타 및 행간을 교정하고 타겟 언어로 번역을 수행합니다. (순수 일반 번역 전용)
   */
  translate = async (req: Request, res: Response): Promise<void> => {
    try {
      const { text, targetLanguage, sourceLanguage, format } = req.body;

      // 1. 필수 인자값 검사
      if (!text || text.trim() === '') {
        res.status(400).json({
          success: false,
          message: '번역 및 교정할 원본 텍스트(text)는 필수 입력 항목입니다.'
        });
        return;
      }

      const targetLang = targetLanguage || 'ko';
      const sourceLang = sourceLanguage || 'auto';
      const fileFormat = format === 'txt' ? 'txt' : 'md';

      // 2. 번역 및 교정 수행
      const translationResult = await this.translationService.translateAndCorrect(
        text,
        targetLang,
        sourceLang
      );

      // 3. 다운로드용 문서 파일 자동 생성 연동
      const protocol = req.secure ? 'https' : 'http';
      const hostUrl = `${protocol}://${req.get('host')}`;

      const fileResult = await this.translationService.exportToDocument(
        translationResult,
        targetLang,
        fileFormat,
        hostUrl
      );

      // 4. 최종 데이터 성공 응답 반환
      res.status(200).json({
        success: true,
        message: '구글 렌즈 일반 텍스트 번역 및 오타 보정이 성공적으로 완료되었습니다.',
        data: {
          originalText: text,
          correctedText: translationResult.correctedText,
          translatedText: translationResult.translatedText,
          explanation: translationResult.explanation,
          fileName: fileResult.fileName,
          downloadUrl: fileResult.downloadUrl
        }
      });
    } catch (error: any) {
      console.error('[TranslationController] translate 에러:', error);
      res.status(500).json({
        success: false,
        message: error.message || '번역 처리 중 내부 서버 오류가 발생했습니다.'
      });
    }
  };
}

export const translationController = new TranslationController();
