import { dbPool } from '../config/db';
import { Schedule } from '../types/schedule';

export class ScheduleRepository {
  /**
   * 새로운 일정(스케줄)을 생성하고 생성된 ID를 반환합니다.
   */
  create = async (schedule: Schedule): Promise<number> => {
    const query = `
      INSERT INTO schedules (user_id, title, description, due_date, completed, document_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const params = [
      schedule.user_id,
      schedule.title,
      schedule.description || null,
      schedule.due_date,
      schedule.completed ? 1 : 0,
      schedule.document_type || null
    ];

    const [result] = await dbPool.query<any>(query, params);
    return result.insertId;
  };

  /**
   * 특정 사용자의 모든 일정을 최신 마감일 순(혹은 임박순)으로 조회합니다.
   */
  findByUserId = async (userId: number): Promise<Schedule[]> => {
    const query = `
      SELECT id, user_id, title, description, due_date, completed, document_type, created_at, updated_at
      FROM schedules
      WHERE user_id = ?
      ORDER BY due_date ASC
    `;
    const [rows] = await dbPool.query<any[]>(query, [userId]);

    return rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      description: row.description || '',
      due_date: row.due_date,
      completed: !!row.completed,
      document_type: row.document_type,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  };

  /**
   * 단일 일정 상세정보를 조회합니다.
   */
  findById = async (id: number): Promise<Schedule | null> => {
    const query = `
      SELECT id, user_id, title, description, due_date, completed, document_type, created_at, updated_at
      FROM schedules
      WHERE id = ?
    `;
    const [rows] = await dbPool.query<any[]>(query, [id]);

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      description: row.description || '',
      due_date: row.due_date,
      completed: !!row.completed,
      document_type: row.document_type,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  };

  /**
   * 특정 일정을 업데이트하고 업데이트된 최신 객체를 반환합니다.
   * 소유자(userId) 검증을 쿼리 수준에서 처리하여 보안을 강화합니다.
   */
  update = async (id: number, userId: number, updates: Partial<Schedule>): Promise<Schedule | null> => {
    // 1. 동적 UPDATE 쿼리 조립
    const fields: string[] = [];
    const params: any[] = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      params.push(updates.title);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      params.push(updates.description);
    }
    if (updates.due_date !== undefined) {
      fields.push('due_date = ?');
      params.push(updates.due_date);
    }
    if (updates.completed !== undefined) {
      fields.push('completed = ?');
      params.push(updates.completed ? 1 : 0);
    }
    if (updates.document_type !== undefined) {
      fields.push('document_type = ?');
      params.push(updates.document_type);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    const query = `
      UPDATE schedules
      SET ${fields.join(', ')}
      WHERE id = ? AND user_id = ?
    `;
    params.push(id, userId);

    const [result] = await dbPool.query<any>(query, params);
    if (result.affectedRows === 0) return null;

    return this.findById(id);
  };

  /**
   * 일정을 삭제하고 성공 여부를 반환합니다.
   * 소유자(userId) 검증 포함.
   */
  delete = async (id: number, userId: number): Promise<boolean> => {
    const query = `
      DELETE FROM schedules
      WHERE id = ? AND user_id = ?
    `;
    const [result] = await dbPool.query<any>(query, [id, userId]);
    return result.affectedRows > 0;
  };
}

export const scheduleRepository = new ScheduleRepository();
