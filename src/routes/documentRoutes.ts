import { Router } from 'express';
import { documentController } from '../controllers/documentController';

const router = Router();

// [POST] /api/documents/analyze
// 구글 렌즈 OCR 텍스트 분석 및 행정 연계 로드맵 산출
router.post('/analyze', documentController.analyze);

export default router;
