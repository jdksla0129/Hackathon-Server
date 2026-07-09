import { Router } from 'express';
import { countryController } from '../controllers/countryController';

const router = Router();

/**
 * @swagger
 * /api/countries:
 *   get:
 *     tags:
 *       - Countries
 *     summary: 지원 국가 목록 조회
 *     description: 체크리스트를 지원하는 국가 목록 및 시드 데이터 보유 여부를 반환합니다.
 *     responses:
 *       200:
 *         description: 조회 성공
 */
router.get('/', countryController.getCountries);

/**
 * @swagger
 * /api/countries/{code}/visa-types:
 *   get:
 *     tags:
 *       - Countries
 *     summary: 특정 국가의 지원 비자 유형 조회
 *     description: 특정 국가의 체크리스트 지원 비자 유형 목록을 반환합니다. 시드 국가는 시드 파일의 목록, 그 외는 기본 4개를 반환합니다.
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: ISO-2 국가 코드 (예: CA, US, AU)
 *     responses:
 *       200:
 *         description: 조회 성공
 *       400:
 *         description: 잘못된 요청
 */
router.get('/:code/visa-types', countryController.getVisaTypes);

export default router;
