import { Request, Response } from 'express';
import { translationService } from '../services/translationService';
import { config } from '../config/env';

export class TranslationController {
  private translationService = translationService;

  /**
   * [POST] /api/translation/translate
   * 구글 렌즈에서 추출해 온 원본 텍스트를 받아서 보정 및 번역을 처리하고 다운로드 문서 링크를 제공합니다.
   */
  translate = async (req: Request, res: Response): Promise<void> => {
    try {
      const { text, targetLanguage = 'ko', sourceLanguage = 'auto', format = 'md' } = req.body;

      // 1. 유효성 검증
      if (!text || typeof text !== 'string' || text.trim() === '') {
        res.status(400).json({
          success: false,
          message: '보정 및 번역을 수행할 text 필드가 누락되었거나 비어있습니다.'
        });
        return;
      }

      // 포맷 검증
      if (format !== 'md' && format !== 'txt') {
        res.status(400).json({
          success: false,
          message: '지원하지 않는 파일 포맷입니다. "md" 또는 "txt" 포맷만 전송 가능합니다.'
        });
        return;
      }

      console.log(`[TranslationController] 번역 프로세스 가동 - 타겟 언어: ${targetLanguage}, 포맷: ${format}`);

      // 2. Gemini 보정 및 번역 의뢰
      const translationResult = await this.translationService.translateAndCorrect(
        text,
        targetLanguage,
        sourceLanguage
      );

      // 3. 동적 Host URL 획득 (로컬 / 원격에 유연 대응)
      const hostUrl = `${req.protocol}://${req.get('host')}`;

      // 4. 결과물 문서(.md / .txt) 디스크 익스포트 및 정적 URL 획득
      const fileResult = await this.translationService.exportToDocument(
        translationResult,
        targetLanguage,
        format as 'md' | 'txt',
        hostUrl
      );

      // 5. 최종 데이터 성공 응답 반환
      res.status(200).json({
        success: true,
        message: '구글 렌즈 텍스트 보정 및 번역 문서 생성이 성공적으로 완료되었습니다.',
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
      console.error(`[TranslationController] translate 실패 상세 로그: ${error.stack || error.message}`);

      // [R-6] 운영(production) 환경 보안 지침 준수
      const responseMessage =
        config.nodeEnv === 'production'
          ? '텍스트 보정 및 번역 서비스 수행 중 내부 오류가 발생했습니다.'
          : (error.message || '인증 및 번역 처리에 실패했습니다.');

      res.status(500).json({
        success: false,
        message: responseMessage
      });
    }
  };
}

export const translationController = new TranslationController();
