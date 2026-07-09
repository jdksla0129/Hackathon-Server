import { Response, Request } from 'express';
import { authService } from '../services/authService';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { config } from '../config/env';

export class AuthController {
  private authService = authService;

  /**
   * [POST] /api/auth/google
   * 클라이언트가 보낸 구글 id_token을 통해 로그인/회원가입 처리
   */
  loginWithGoogle = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { idToken } = req.body;

      if (!idToken) {
        res.status(400).json({
          success: false,
          message: 'idToken 필드가 누락되었습니다. Google OAuth id_token을 전송해야 합니다.'
        });
        return;
      }

      const result = await this.authService.verifyGoogleIdTokenAndLogin(idToken);
      
      res.status(200).json({
        success: true,
        message: result.isMock ? 'Mock 로그인 성공 (Sandbox)' : 'Google OAuth 로그인 성공',
        data: {
          token: result.token,
          user: result.user
        }
      });
    } catch (error: any) {
      console.error(`[AuthController] loginWithGoogle 실패 세부로그: ${error.stack || error.message}`);
      
      // [R-6] production 모드일 때는 세부 에러 메시지(구글 라이브러리 예외 등)를 노출하지 않고 보편적인 응답을 줍니다.
      const responseMessage = 
        config.nodeEnv === 'production'
          ? '구글 인증 및 로그인 처리에 실패했습니다.'
          : (error.message || '인증 처리에 실패했습니다.');

      res.status(401).json({
        success: false,
        message: responseMessage
      });
    }
  };

  /**
   * B. [GET] /api/auth/google/login
   * 웹 브라우저 로그인 연동을 위해 구글 동의 화면(Consent URL)으로 302 리다이렉트
   */
  redirectToGoogleConsent = async (req: Request, res: Response): Promise<void> => {
    try {
      const authUrl = this.authService.generateGoogleAuthUrl();
      res.redirect(302, authUrl);
    } catch (error: any) {
      console.error(`[AuthController] redirectToGoogleConsent 에러: ${error.message}`);
      res.status(500).json({
        success: false,
        message: '구글 인증 페이지를 생성하는 도중 오류가 발생했습니다.'
      });
    }
  };

  /**
   * C. [GET] /api/auth/google/callback
   * 구글 콜백 코드를 교환하고 최종 세션 발급 완료 처리
   */
  handleGoogleLoginCallback = async (req: Request, res: Response): Promise<void> => {
    try {
      const { code, state } = req.query;

      if (!code || !state) {
        res.status(400).json({
          success: false,
          message: '인증 인자(code, state)가 누락되어 로그인 처리를 진행할 수 없습니다.'
        });
        return;
      }

      const result = await this.authService.handleCallbackAndLogin(code as string, state as string);

      // 성공 시 200 JSON 기존 형태 완벽 유지 및 프론트 리다이렉트 대비책 기재
      // 추후 프론트 주소가 정해지면: res.redirect(`${FRONTEND_URL}?token=${result.token}`); 형태로 교체
      res.status(200).json({
        success: true,
        message: 'Google OAuth 로그인 성공',
        data: {
          token: result.token,
          user: result.user
        }
      });
    } catch (error: any) {
      console.error(`[AuthController] handleGoogleLoginCallback 실패 세부로그: ${error.stack || error.message}`);

      // [R-6] production 모드일 때는 세부 에러 노출을 금지하고 일률 은폐 메시지 반환
      const responseMessage = 
        config.nodeEnv === 'production'
          ? '구글 로그인 콜백 처리에 실패했습니다.'
          : (error.message || '인증 처리에 실패했습니다.');

      res.status(401).json({
        success: false,
        message: responseMessage
      });
    }
  };

  /**
   * [GET] /api/auth/profile
   * 현재 JWT 인증을 완료한 유저의 세션 프로필 데이터 로드
   */
  getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: '로그인이 필요합니다.'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: '유저 프로필 조회 성공',
        data: {
          user: req.user
        }
      });
    } catch (error: any) {
      console.error(`[AuthController] getProfile 실패 세부로그: ${error.stack || error.message}`);
      res.status(500).json({
        success: false,
        message: '서버 내부 오류가 발생했습니다.'
      });
    }
  };

  /**
   * [PATCH] /api/auth/nationality
   * 로그인한 유저의 국적(nationality)을 선택/저장
   */
  updateNationality = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({
          success: false,
          message: '로그인이 필요합니다.'
        });
        return;
      }

      const { nationality } = req.body;

      if (!nationality) {
        res.status(400).json({
          success: false,
          message: 'nationality 필드가 누락되었습니다.'
        });
        return;
      }

      // 서비스 레이어 호출
      const updatedUser = await this.authService.updateNationality(req.user.id, nationality);

      res.status(200).json({
        success: true,
        message: '국적 저장 성공',
        data: {
          user: updatedUser
        }
      });
    } catch (error: any) {
      console.error(`[AuthController] updateNationality 실패 세부로그: ${error.stack || error.message}`);

      // [R-6] production 모드일 때는 세부 에러 노출을 금지하고 보편적인 에러 메시지 반환
      const responseMessage =
        config.nodeEnv === 'production'
          ? '국적 정보를 저장하는 데 실패했습니다.'
          : (error.message || '국적 정보를 저장하는 데 실패했습니다.');

      res.status(400).json({
        success: false,
        message: responseMessage
      });
    }
  };
}

// 싱글턴 인스턴스 주입 및 Export
export const authController = new AuthController();
