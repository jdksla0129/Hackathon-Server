import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authenticateJwt } from '../middlewares/authMiddleware';

const router = Router();

// 1. Google OAuth 로그인 API (Body: idToken 필요, 안드로이드/앱용)
router.post('/google', authController.loginWithGoogle);

// B. 웹 브라우저용 구글 동의 화면 리다이렉트 API
router.get('/google/login', authController.redirectToGoogleConsent);

// C. 웹 브라우저용 구글 로그인 콜백 수신 API
router.get('/google/callback', authController.handleGoogleLoginCallback);

// 2. JWT 로그인 성공 유저 전용 프로필 조회 API (Header: Bearer [Token] 필요)
router.get('/profile', authenticateJwt, authController.getProfile);

// 3. 국적 선택 및 저장 API (Header: Bearer [Token] 필요)
router.patch('/nationality', authenticateJwt, authController.updateNationality);

export default router;
