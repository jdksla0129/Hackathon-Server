import { Router } from 'express';
import { translationController } from '../controllers/translationController';

const router = Router();

/**
 * 1. 구글 렌즈 번역 및 보정 API
 * [POST] /api/translation/translate
 * Body: { text: string, targetLanguage?: string, sourceLanguage?: string, format?: 'md' | 'txt' }
 */
router.post('/translate', translationController.translate);

export default router;
