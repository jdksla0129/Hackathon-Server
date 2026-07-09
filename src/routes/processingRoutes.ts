import { Router } from 'express';
import { processingController } from '../controllers/processingController';

const router = Router();

/**
 * @swagger
 * /api/processing-time:
 *   get:
 *     tags:
 *       - ProcessingTime
 *     summary: 캐나다 이민부(IRCC) 실시간 서류 처리 기간 조회
 *     description: 캐나다 이민부 공식 JSON 데이터를 프록싱 및 가공하여, 주요 이민/비자 프로그램별 처리 기간 정보를 반환합니다. (현재 캐나다 CA만 지원)
 *     parameters:
 *       - in: query
 *         name: country
 *         required: true
 *         schema:
 *           type: string
 *         example: CA
 *         description: 대상 국가 ISO-2 코드 (현재 'CA'만 지원)
 *     responses:
 *       200:
 *         description: 조회 성공
 *       400:
 *         description: 필수 파라미터 누락
 *       501:
 *         description: 미지원 국가 요청 (CA 외의 국가)
 *       500:
 *         description: 내부 서버 오류
 */
router.get('/', processingController.getProcessingTime);

export default router;
