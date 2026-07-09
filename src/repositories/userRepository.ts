import { RowDataPacket } from 'mysql2';
import { dbPool } from '../config/db';
import { User } from '../types/user';

export class UserRepository {
  /**
   * 구글 ID로 기존 회원 검색
   */
  async findByGoogleId(googleId: string): Promise<User | null> {
    const [rows] = await dbPool.query<RowDataPacket[]>(
      'SELECT * FROM users WHERE google_id = ? LIMIT 1',
      [googleId]
    );
    
    if (rows.length === 0) {
      return null;
    }
    
    return rows[0] as User;
  }

  /**
   * 유저 ID(PK)로 회원 검색
   */
  async findById(id: number): Promise<User | null> {
    const [rows] = await dbPool.query<RowDataPacket[]>(
      'SELECT * FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    
    if (rows.length === 0) {
      return null;
    }
    
    return rows[0] as User;
  }

  /**
   * 유저 ID(PK)로 국적 정보 업데이트 후 최신 사용자 조회하여 반환
   */
  async updateNationality(userId: number, nationality: string): Promise<User> {
    await dbPool.query(
      'UPDATE users SET nationality = ? WHERE id = ?',
      [nationality, userId]
    );

    const updatedUser = await this.findById(userId);
    if (!updatedUser) {
      throw new Error(`[UserRepository] updateNationality 실패: ID ${userId} 인 사용자를 찾을 수 없습니다.`);
    }
    return updatedUser;
  }

  /**
   * 구글 유저 정보 업서트 (가입 시 Race Condition 방지 단일 원자적 쿼리)
   */
  async upsert(user: User): Promise<User> {
    await dbPool.query(
      `INSERT INTO users (google_id, email, name, picture)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         email = VALUES(email),
         name = VALUES(name),
         picture = VALUES(picture)`,
      [user.google_id, user.email, user.name, user.picture || null]
    );

    // 저장 및 동기화 직후 최신 레코드를 재조회하여 반환 (id / created_at 누락 방지 보장)
    const updatedUser = await this.findByGoogleId(user.google_id);
    if (!updatedUser) {
      throw new Error('[UserRepository] upsert 반영 실패: 데이터를 찾을 수 없습니다.');
    }
    return updatedUser;
  }
}

// 싱글턴 인스턴스 주입 및 Export
export const userRepository = new UserRepository();
