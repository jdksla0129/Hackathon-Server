import { Request, Response } from 'express';
import { documentService } from '../services/documentService';

export class DocumentController {
  private documentService = documentService;

  /**
   * [POST] /api/documents/analyze
   * 구글 렌즈로 획득한 이민 서류의 본문 텍스트를 정밀 분석합니다.
   * 서류 유형 식별, 실천 조치 사항(Action Plan), 법적 마감일 및 위반 규정(Legal Obligations), 연계 후속 서류 로드맵을 모두 반환합니다.
   */
  analyze = async (req: Request, res: Response): Promise<void> => {
    try {
      const { text, targetLanguage, sourceLanguage, format } = req.body;

      // 1. 필수 입력 항목 검증
      if (!text || text.trim() === '') {
        res.status(400).json({
          success: false,
          message: '분석할 서류 텍스트(text)는 필수 입력 항목입니다.'
        });
        return;
      }

      const targetLang = targetLanguage || 'ko';
      const sourceLang = sourceLanguage || 'auto';
      const fileFormat = format === 'txt' ? 'txt' : 'md';

      // 2. 서비스 레이어 분석 위임
      const analysisResult = await this.documentService.analyzeDocument(
        text,
        targetLang,
        sourceLang
      );

      // 3. 다운로드용 문서 파일(MD/TXT) 생성 자동 연계
      const protocol = req.secure ? 'https' : 'http';
      const hostUrl = `${protocol}://${req.get('host')}`;

      const fileResult = await this.documentService.exportToDocument(
        analysisResult,
        targetLang,
        fileFormat,
        hostUrl
      );

      // 4. 구조화된 최종 분석 응답 제공
      res.status(200).json({
        success: true,
        message: '구글 렌즈 이민 서류 분석 및 연계 로드맵 산출이 성공적으로 완료되었습니다.',
        data: {
          originalText: text,
          correctedText: analysisResult.correctedText,
          translatedText: analysisResult.translatedText,
          documentType: analysisResult.documentType,
          explanation: analysisResult.explanation,
          actionPlan: analysisResult.actionPlan,
          legalObligations: analysisResult.legalObligations,
          nextRoadmap: analysisResult.nextRoadmap,
          fileName: fileResult.fileName,
          downloadUrl: fileResult.downloadUrl
        }
      });
    } catch (error: any) {
      console.error('[DocumentController] analyze 에러:', error);
      res.status(500).json({
        success: false,
        message: error.message || '서류 분석 처리 중 서버 오류가 발생했습니다.'
      });
    }
  };
}

export const documentController = new DocumentController();
