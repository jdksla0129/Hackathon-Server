import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import { config } from '../config/env';
import { userRepository } from '../repositories/userRepository';
import { User } from '../types/user';

// B & C. Google OAuth2Client 설정 (클라이언트 구성)
export const oauth2Client = new OAuth2Client(
  config.google.clientId,
  config.google.clientSecret,
  config.google.redirectUri
);

// B. CSRF 방지용 인메모리 state 저장소 설계 (세션 미사용)
interface StateData {
  createdAt: number;
}
const stateStore = new Map<string, StateData>();
const STATE_TTL = 10 * 60 * 1000; // 10분 TTL

/**
 * 인메모리 내 만료된 모든 state 정리 루틴
 */
const cleanExpiredStates = (): void => {
  const now = Date.now();
  for (const [state, data] of stateStore.entries()) {
    if (now - data.createdAt > STATE_TTL) {
      stateStore.delete(state);
    }
  }
};

// 로그아웃 처리된 JWT 인메모리 블랙리스트 (세션 미사용, state 저장소와 동일 설계)
const tokenBlacklist = new Map<string, number>(); // token -> 만료 시각(ms)

/**
 * 인메모리 내 만료된 블랙리스트 토큰 정리 루틴
 */
const cleanExpiredBlacklist = (): void => {
  const now = Date.now();
  for (const [token, expiresAt] of tokenBlacklist.entries()) {
    if (now > expiresAt) {
      tokenBlacklist.delete(token);
    }
  }
};

/**
 * 해당 토큰이 로그아웃 처리(블랙리스트 등록)되었는지 확인
 */
export const isTokenBlacklisted = (token: string): boolean => {
  cleanExpiredBlacklist();
  return tokenBlacklist.has(token);
};

export class AuthService {
  private userRepository = userRepository;

  /**
   * Google ID Token을 검증하고 사용자 가입/로그인 처리 후 백엔드 JWT 반환
   * @param idToken 구글 클라이언트에서 전달받은 id_token
   */
  async verifyGoogleIdTokenAndLogin(idToken: string): Promise<{ token: string; user: User; isMock?: boolean }> {
    // A. [DISABLED] Mock 로그인 경로 — 필요 시 주석 해제 (ALLOW_MOCK_AUTH 가드 유지된 코드)
    /*
    const isMockMode = 
      config.nodeEnv !== 'production' &&
      config.allowMockAuth &&
      (idToken === 'mock-google-token' || idToken.startsWith('mock_'));

    if (isMockMode) {
      console.log('🚧 [AuthService] Google OAuth Mock 샌드박스 모드로 작동 중입니다.');
      const mockGoogleId = idToken.startsWith('mock_') ? idToken : 'mock_google_user_12345';
      const mockUser: User = {
        google_id: mockGoogleId,
        email: 'sandbox-user@example.com',
        name: '샌드박스 개발자',
        picture: 'https://lh3.googleusercontent.com/a/default-user'
      };

      const user = await this.registerOrUpdateUser(mockUser);
      const token = this.generateJwtToken(user);
      return { token, user, isMock: true };
    }
    */

    try {
      // [R-4] google-auth-library를 사용한 보안 검증으로 변경
      const ticket = await oauth2Client.verifyIdToken({
        idToken: idToken,
        audience: config.google.clientId
      });

      const payload = ticket.getPayload();

      if (!payload) {
        throw new Error('Google ID 토큰의 페이로드를 읽을 수 없습니다.');
      }

      // [R-4] payload.email_verified 검증 실패 시 401 반환 처리
      if (!payload.email_verified) {
        throw new Error('이메일이 인증되지 않은 구글 계정입니다.');
      }

      const googleUser: User = {
        google_id: payload.sub, // 구글 고유 ID
        email: payload.email!,
        name: payload.name || '구글 사용자',
        picture: payload.picture
      };

      const user = await this.registerOrUpdateUser(googleUser);
      const token = this.generateJwtToken(user);
      return { token, user };
    } catch (error: any) {
      console.error(`[AuthService] verifyGoogleIdTokenAndLogin 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * B. 구글 동의 화면용 Authorization Redirect URL 생성 및 state 발급
   */
  generateGoogleAuthUrl(): string {
    cleanExpiredStates(); // 신규 생성 시점 만료 정리
    
    const state = crypto.randomBytes(16).toString('hex');
    stateStore.set(state, { createdAt: Date.now() });

    return oauth2Client.generateAuthUrl({
      access_type: 'online',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
        'openid'
      ],
      state: state
    });
  }

  /**
   * C. 구글 콜백 처리: state 검증 -> ID 토큰 교환 -> 로그인 통합 처리
   */
  async handleCallbackAndLogin(code: string, state: string): Promise<{ token: string; user: User }> {
    cleanExpiredStates(); // 검증 시점 만료 정리

    const savedState = stateStore.get(state);
    if (!savedState) {
      throw new Error('CSRF 위배 경고: 유효하지 않거나 만료된 state 검증값입니다.');
    }

    // 1회용이므로 검증 직후 무조건 즉시 파괴
    stateStore.delete(state);

    if (Date.now() - savedState.createdAt > STATE_TTL) {
      throw new Error('CSRF 위배 경고: state 검증 유효 시간이 만료되었습니다.');
    }

    try {
      // 1. 구글 인증 코드(code)를 이용해 토큰 획득
      const { tokens } = await oauth2Client.getToken(code);
      const idToken = tokens.id_token;

      if (!idToken) {
        throw new Error('구글로부터 id_token을 전달받을 수 없습니다.');
      }

      // 2. 기존 idToken 로그인 비즈니스 로직 전격 재사용 (코드 중복 일절 제거)
      const result = await this.verifyGoogleIdTokenAndLogin(idToken);
      return {
        token: result.token,
        user: result.user
      };
    } catch (error: any) {
      console.error(`[AuthService] handleCallbackAndLogin 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * 구글 로그인 유저 가입 또는 프로필 동기화 (원자적 Upsert 위임)
   */
  private async registerOrUpdateUser(googleUser: User): Promise<User> {
    try {
      // 가입 시 레이스 컨디션을 막기 위해 단일 원자적 upsert 호출로 단순화
      return await this.userRepository.upsert(googleUser);
    } catch (dbError: any) {
      // A. [DISABLED] Mock 로그인 경로 — 필요 시 주석 해제 (ALLOW_MOCK_AUTH 가드 유지된 코드)
      /*
      if (config.nodeEnv !== 'production' && config.allowMockAuth) {
        console.warn('⚠️ [AuthService] MySQL 데이터베이스 조회/등록이 실패했습니다. (개발 환경 모의 구동)');
        return {
          id: 999,
          ...googleUser
        };
      }
      */
      
      // 그 외(운영 환경 또는 모의 비활성화 상태)에는 가차없이 에러를 다시 상위로 전파
      console.error(`[AuthService] 데이터베이스 오류가 전파됩니다: ${dbError.message}`);
      throw dbError;
    }
  }

  /**
   * 백엔드 API 보안에 사용할 JWT 토큰 생성
   * (보안 모범 사례: 토큰 위조 및 프로필 동기화 지연 방지를 위해 오직 고유 id만 페이로드에 적재)
   */
  generateJwtToken(user: User): string {
    return jwt.sign(
      { id: user.id },
      config.jwtSecret,
      { expiresIn: '7d' } // 7일간 유지
    );
  }

  /**
   * 로그아웃: 전달받은 JWT를 만료 시각까지 블랙리스트에 등록하여 즉시 무효화
   * @param token 무효화할 JWT (Bearer 헤더에서 추출된 값)
   */
  logout(token: string): void {
    cleanExpiredBlacklist();

    // 토큰의 실제 만료 시각(exp)까지만 블랙리스트에 보관 (그 이후엔 자연 만료)
    const decoded = jwt.decode(token) as { exp?: number } | null;
    const expiresAt = decoded?.exp
      ? decoded.exp * 1000
      : Date.now() + 7 * 24 * 60 * 60 * 1000; // exp가 없으면 발급 유효기간(7일)만큼 보관

    tokenBlacklist.set(token, expiresAt);
  }

  /**
   * 사용자의 국적을 정규화/검증한 뒤 업데이트합니다.
   * @param userId 유저 ID
   * @param nationality 국적 코드 (예: "KR", "US")
   */
  async updateNationality(userId: number, nationality: string): Promise<User> {
    if (!nationality) {
      throw new Error('국적 코드(nationality)가 입력되지 않았습니다.');
    }

    // 1. 소문자 입력을 대문자로 정규화 및 공백 제거
    const normalized = nationality.trim().toUpperCase();

    // 2. ISO 3166-1 alpha-2 형식 (/^[A-Z]{2}$/) 유효성 검증
    const isoRegexp = /^[A-Z]{2}$/;
    if (!isoRegexp.test(normalized)) {
      throw new Error('국적 코드 형식이 유효하지 않습니다. ISO 3166-1 alpha-2 형식(예: KR, US)이어야 합니다.');
    }

    // 3. Repository를 통한 업데이트 및 최신 정보 조회 반환
    return await this.userRepository.updateNationality(userId, normalized);
  }
}

// 싱글턴 인스턴스 주입 및 Export
export const authService = new AuthService();
