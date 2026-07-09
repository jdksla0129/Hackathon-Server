import { Router } from 'express';
import { checklistController } from '../controllers/checklistController';

const router = Router();

/**
 * @swagger
 * /api/checklist:
 *   post:
 *     tags:
 *       - Checklist
 *     summary: 이민 서류 체크리스트 생성 및 조회
 *     description: 출발 국가, 대상 국가, 비자 유형 및 동반 가족 여부에 부합하는 이민 서류 체크리스트 정보를 반환합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - from
 *               - to
 *               - visaType
 *             properties:
 *               from:
 *                 type: string
 *                 example: KR
 *                 description: 출발 국가 ISO-2 코드
 *               to:
 *                 type: string
 *                 example: CA
 *                 description: 대상 국가 ISO-2 코드
 *               visaType:
 *                 type: string
 *                 example: skilled
 *                 description: 비자 유형 (skilled, family, investor, student)
 *               family:
 *                 type: boolean
 *                 example: true
 *                 description: 동반 가족 여부 (true인 경우 혼인관계증명서 등 가족 서류 자동 병합)
 *     responses:
 *       200:
 *         description: 생성 혹은 조회 성공
 *       400:
 *         description: 필수 파라미터 누락 혹은 미지원 국가 에러
 *       502:
 *         description: AI 응답 파싱 실패
 *       503:
 *         description: API 호출 제한 초과
 */
router.post('/', checklistController.getChecklist);

export default router;
