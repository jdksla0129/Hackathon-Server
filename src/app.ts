import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import path from 'path';
import authRoutes from './routes/authRoutes';
import translationRoutes from './routes/translationRoutes';
import { config } from './config/env';

const app = express();

// 1. 보안 HTTP 헤더 보호 (Helmet 적용)
app.use(helmet());

// 2. CORS 제어 (CORS_ORIGIN 환경 변수 기반 제어, 기본값: '*' 전체 허용)
app.use(cors({
  origin: config.corsOrigin === '*' ? '*' : config.corsOrigin,
  credentials: true
}));

// 3. 바디 파서
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// 4. Rate Limiting 적용 (DDoS 및 구글 인증 쿼리 무작위 브루트포스 방어)
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100, // IP당 최대 100회 요청
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: '단기간에 너무 많은 로그인 요청이 발생했습니다. 15분 후에 다시 시도해 주세요.'
  }
});

// 5. 헬스체크 API (기본 핑 테스트용)
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Express + TS Server is running smoothly!'
  });
});

// 6. API 라우트 등록 (로그인 엔드포인트에 Rate Limit 우선 보안 수립)
app.use('/api/auth/google', authRateLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/translation', translationRoutes);

// 7. 존재하지 않는 엔드포인트 처리 (404 API)
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `요청하신 경로 (${req.originalUrl})를 찾을 수 없습니다.`
  });
});

// 8. 전역 에러 핸들러 미들웨어
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Global Error Handler] 상세 에러 로그:', err);
  
  // [R-6] production 모드일 때는 보안 위협 유출을 차단하기 위해 원본 error.message 은폐하고 일반 메시지만 리턴
  const responseMessage = 
    config.nodeEnv === 'production'
      ? '서버 내부에서 에러가 발생했습니다. 지속 발생 시 관리자에게 문의하세요.'
      : (err.message || '서버 내부에서 예상치 못한 오류가 발생했습니다.');

  res.status(err.status || 500).json({
    success: false,
    message: responseMessage
  });
});

export default app;
