import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

// .env 파일 로드
dotenv.config({ path: path.join(__dirname, '../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';

// [R-2] JWT_SECRET 환경변수 세팅 검증 및 폴백 처리
let jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret || jwtSecret === 'your_jwt_secret_key_minimum_32_characters') {
  if (nodeEnv === 'production') {
    console.error('\x1b[31m%s\x1b[0m', '❌ [Fatal Error] Production 환경에서 JWT_SECRET이 설정되지 않았거나 기본값입니다. 보안을 위해 서버 가동을 중단합니다.');
    process.exit(1);
  } else {
    // 개발 모드 시 하드코딩 대신 crypto.randomBytes 무작위 난수 키 생성 적용
    jwtSecret = crypto.randomBytes(32).toString('hex');
    console.warn('\x1b[33m%s\x1b[0m', '⚠️  [Environment Warning] JWT_SECRET이 정의되지 않아 임시 무작위 시크릿 키가 난수 생성되었습니다.');
  }
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  allowMockAuth: process.env.ALLOW_MOCK_AUTH === 'true', // [R-1, R-3] 용 플래그 추가
  
  // Database Configuration
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'test_db'
  },

  // Google OAuth Configuration
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || 'PENDING_GOOGLE_CLIENT_ID',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'PENDING_GOOGLE_CLIENT_SECRET',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback'
  },

  // JWT Configuration
  jwtSecret
};

// 필수 설정 누락 시 가이드 경고 로그 출력 (서버 크래시 방지 및 점진적 환경 구축 지원)
export const checkEnvVariables = () => {
  const warnings: string[] = [];
  
  if (!process.env.DB_PASSWORD || process.env.DB_PASSWORD === 'your_mysql_password') {
    warnings.push('DB_PASSWORD가 설정되지 않았거나 기본값입니다.');
  }
  if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === 'your_google_client_id') {
    warnings.push('GOOGLE_CLIENT_ID가 설정되지 않았습니다. Google OAuth 로그인이 정상 작동하지 않을 수 있습니다.');
  }
  if (!process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET === 'your_google_client_secret') {
    warnings.push('GOOGLE_CLIENT_SECRET이 설정되지 않았습니다.');
  }

  if (warnings.length > 0) {
    console.warn('\x1b[33m%s\x1b[0m', '⚠️  [Environment Warning] 아래 환경 변수 설정을 확인해 주세요:');
    warnings.forEach(warn => console.warn('\x1b[33m%s\x1b[0m', `  - ${warn}`));
  } else {
    console.log('✅ 모든 필수 환경 변수가 정상적으로 로드되었습니다.');
  }
};
