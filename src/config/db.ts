import mysql from 'mysql2/promise';
import { config } from './env';

// MySQL Connection Pool 생성
export const dbPool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 데이터베이스 연결 테스트 및 초기 스키마 마이그레이션 함수
export const initializeDatabase = async () => {
  try {
    // 1. 커넥션 풀 연결 테스트
    const connection = await dbPool.getConnection();
    console.log('✅ MySQL 연결에 성공했습니다.');
    
    // 2. 초기 유저 테이블 생성
    const createUsersTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        google_id VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        picture VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    
    await connection.query(createUsersTableQuery);
    console.log('✅ MySQL "users" 테이블 스키마 초기화가 완료되었습니다.');
    
    connection.release();
  } catch (error: any) {
    console.error('\x1b[31m%s\x1b[0m', '❌ Database 연결 또는 초기 스키마 마이그레이션 실패:');
    console.error('\x1b[31m%s\x1b[0m', `   이유: ${error.message}`);
    console.warn('\x1b[33m%s\x1b[0m', '⚠️  데이터베이스가 기동되지 않았거나 세팅이 올바르지 않아도, 서버 로직은 우선 구동됩니다.');
  }
};
