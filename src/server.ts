import app from './app';
import { config, checkEnvVariables } from './config/env';
import { initializeDatabase, dbPool } from './config/db';

const startServer = async () => {
  console.log('🚀 서버 기동 프로세스를 시작합니다...');
  
  // 1. 환경 변수 체크 및 경고 출력
  checkEnvVariables();
  
  // 2. 데이터베이스 초기화 및 테이블 구조 자동 생성
  await initializeDatabase();
  
  // 3. Express 포트 연결 기동
  app.listen(config.port, () => {
    console.log(`
==================================================
  🟢 Server is successfully listening on port: ${config.port}
  🟢 Active Mode: [${config.nodeEnv}]
  🟢 Check health via: http://localhost:${config.port}/health
==================================================
    `);
  });
};

// [R-5] uncaughtException 감증 시 무조건 로그 후 프로세스 강제 종료 (exit 1)
process.on('uncaughtException', (error) => {
  console.error('⚠️  [Fatal Uncaught Exception] 즉시 종료됩니다:', error);
  process.exit(1);
});

// 프로세스 유연 전파 에러 로깅
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️  Unhandled Rejection detected:', reason);
});

// [R-5] SIGTERM / SIGINT 시 DB 커넥션 종료 후 Graceful Shutdown 안전 종료 처리
const gracefulShutdown = async (signal: string) => {
  console.log(`\n🛑 [${signal}] 신호가 감지되었습니다. Graceful Shutdown을 개시합니다...`);
  try {
    await dbPool.end();
    console.log('✅ MySQL 커넥션 풀을 정상적으로 정리했습니다.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Shutdown 도중 에러가 발생했습니다:', err);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

startServer();
