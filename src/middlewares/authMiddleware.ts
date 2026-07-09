import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { userRepository } from '../repositories/userRepository';
import { isTokenBlacklisted } from '../services/authService';

// Express Request 인터페이스 확장하여 req.user 타입 정의 (실시간 최신 상태 프로필 포함)
export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    name: string;
    picture?: string;
    nationality?: string | null;
  };
  token?: string; // 로그아웃 등에서 원본 JWT가 필요할 때 사용
}

export const authenticateJwt = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: '인증 토큰이 누락되었습니다. Headers에 Bearer [Token] 형식으로 전달해 주세요.'
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  // 로그아웃으로 블랙리스트에 등록된 토큰은 유효기간이 남아도 거부
  if (isTokenBlacklisted(token)) {
    res.status(401).json({
      success: false,
      message: '로그아웃 처리된 토큰입니다. 다시 로그인해 주세요.'
    });
    return;
  }

  try {
    // JWT에서는 오직 고유 id만 복호화 (프로필 변경에 실시간 대처 가능)
    const decoded = jwt.verify(token, config.jwtSecret) as { id: number };
    
    // 복호화된 고유 ID로 데이터베이스(MySQL)에서 실시간 최신 정보 조회 (findById 활용)
    const user = await userRepository.findById(decoded.id);

    if (!user) {
      res.status(401).json({
        success: false,
        message: '해당 토큰의 사용자 정보를 데이터베이스에서 찾을 수 없습니다.'
      });
      return;
    }

    // 복호화 후 실시간으로 DB에서 적재된 완벽한 사용자 상태 데이터 바인딩
    req.user = {
      id: user.id!,
      email: user.email,
      name: user.name,
      picture: user.picture,
      nationality: user.nationality
    };
    req.token = token;

    next();
  } catch (error: any) {
    console.error(`[AuthMiddleware] JWT Token 검증 오류: ${error.message}`);
    res.status(403).json({
      success: false,
      message: '유효하지 않거나 만료된 토큰입니다.'
    });
  }
};
