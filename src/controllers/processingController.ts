import { Request, Response, NextFunction } from 'express';
import { irccService } from '../services/irccService';

export class ProcessingController {
  /**
   * [GET] /api/processing-time
   * 특정 국가의 이민/비자 프로그램 처리 기간 정보를 반환합니다. (현재는 캐나다 'CA'만 지원)
   */
  public getProcessingTime = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { country } = req.query;

      if (!country || typeof country !== 'string') {
        res.status(400).json({
          success: false,
          message: '국가 코드(country)는 필수 쿼리 파라미터입니다. (예: ?country=CA)',
        });
        return;
      }

      const uppercaseCountry = country.toUpperCase();

      // 캐나다 'CA' 이외의 국가는 501 "지원 예정" 상태 및 메시지 반환
      if (uppercaseCountry !== 'CA') {
        res.status(501).json({
          success: false,
          message: '해당 국가의 실시간 처리 기간 정보는 지원 예정입니다. 현재는 캐나다(CA) 정보만 지원합니다.',
        });
        return;
      }

      // IRCC 서비스 호출
      const data = await irccService.getProcessingTime(uppercaseCountry);

      res.status(200).json(data);
    } catch (error: any) {
      console.error('[ProcessingController] getProcessingTime 에러:', error);
      res.status(500).json({
        success: false,
        message: error.message || '처리 기간 정보를 조회하는 과정에서 내부 서버 오류가 발생했습니다.',
      });
    }
  };
}

export const processingController = new ProcessingController();
