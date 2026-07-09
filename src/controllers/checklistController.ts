import { Request, Response, NextFunction } from 'express';
import { validateChecklistRequest } from '../utils/validate';
import { checklistService } from '../services/checklistService';
import { GeminiRateLimitError, GeminiParsingError, GeminiTimeoutError } from '../services/geminiChecklistService';

export class ChecklistController {
  /**
   * [POST] /api/checklist
   * 이민 서류 준비 체크리스트 정보를 생성 혹은 조회하여 반환합니다.
   */
  public getChecklist = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. 요청 유효성 검증
      const validation = validateChecklistRequest(req.body);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          message: validation.message || '요청 정보가 올바르지 않습니다.',
        });
        return;
      }

      const { from, to, visaType, family } = req.body;
      const isFamily = family === true; // 기본값 false 처리

      // 2. 서비스 호출 (시드 -> Gemini -> 캐시 오케스트레이션)
      const checklist = await checklistService.getChecklist(
        from,
        to,
        visaType,
        isFamily
      );

      // 3. 정상 반환
      res.status(200).json({
        success: true,
        data: checklist,
      });
    } catch (error: any) {
      console.error('[ChecklistController] getChecklist 에러 감지:', error);

      // 4. 에러 패턴별 특화 응답 처리
      if (error.message === 'GEMINI_API_KEY_NOT_FOUND') {
        res.status(400).json({
          success: false,
          message: '현재는 시드 국가(US/CA/AU)만 지원 중입니다. 추가 국가 조회를 위한 Gemini API 키가 누락되었습니다.',
        });
        return;
      }

      if (error instanceof GeminiRateLimitError) {
        console.warn(`⚠️ [ChecklistController] 429 Rate Limit에 따른 503 응답 처리`);
        res.status(503).json({
          success: false,
          message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
        });
        return;
      }

      if (error instanceof GeminiTimeoutError) {
        res.status(504).json({
          success: false,
          message: '서류 정보를 수집하는 과정에서 시간 초과가 발생했습니다. 잠시 후 다시 시도해 주세요.',
        });
        return;
      }

      if (error instanceof GeminiParsingError) {
        res.status(502).json({
          success: false,
          message: `AI 응답 데이터 구조화에 실패했습니다: ${error.message}`,
        });
        return;
      }

      // 일반 도메인 에러나 시스템 예외는 전역 에러 핸들러로 위임 (production 메시지 은폐 정책 준수)
      next(error);
    }
  };
}

export const checklistController = new ChecklistController();
