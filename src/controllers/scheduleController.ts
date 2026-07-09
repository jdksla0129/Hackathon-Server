import { Response, Request } from 'express';
import { scheduleService } from '../services/scheduleService';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { config } from '../config/env';

export class ScheduleController {
  private scheduleService = scheduleService;

  /**
   * [POST] /api/schedules
   * 새로운 개인 행정 일정을 생성합니다. JWT 인증 필수.
   */
  create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
        return;
      }

      const { title, description, dueDate, documentType, completed } = req.body;

      const newSchedule = await this.scheduleService.createSchedule({
        user_id: userId,
        title,
        description,
        due_date: dueDate,
        document_type: documentType,
        completed: !!completed
      });

      res.status(201).json({
        success: true,
        message: '새로운 행정 일정이 성공적으로 등록되었습니다.',
        data: { schedule: newSchedule }
      });
    } catch (error: any) {
      console.error('[ScheduleController] create 에러:', error);
      res.status(400).json({
        success: false,
        message: error.message || '일정을 생성하는 도중 에러가 발생했습니다.'
      });
    }
  };

  /**
   * [GET] /api/schedules
   * 로그인한 유저의 전체 행정 일정을 마감 기한 순으로 조회합니다. JWT 인증 필수.
   */
  list = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
        return;
      }

      const list = await this.scheduleService.getSchedulesByUser(userId);

      res.status(200).json({
        success: true,
        message: '전체 행정 일정 조회가 성공적으로 완료되었습니다.',
        data: { schedules: list }
      });
    } catch (error: any) {
      console.error('[ScheduleController] list 에러:', error);
      res.status(500).json({
        success: false,
        message: '일정 목록을 조회하는 도중 오류가 발생했습니다.'
      });
    }
  };

  /**
   * [GET] /api/schedules/:id
   * 단일 일정의 상세정보를 조회합니다. JWT 인증 필수. (소유권 체크 포함)
   */
  detail = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const scheduleId = parseInt(req.params.id, 10);

      if (!userId) {
        res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
        return;
      }

      if (isNaN(scheduleId)) {
        res.status(400).json({ success: false, message: '올바르지 않은 일정 ID 형식입니다.' });
        return;
      }

      const schedule = await this.scheduleService.getScheduleById(scheduleId, userId);

      res.status(200).json({
        success: true,
        message: '일정 상세 정보 조회가 성공적으로 완료되었습니다.',
        data: { schedule }
      });
    } catch (error: any) {
      console.error('[ScheduleController] detail 에러:', error);
      res.status(400).json({
        success: false,
        message: error.message || '일정을 조회하는 도중 오류가 발생했습니다.'
      });
    }
  };

  /**
   * [PATCH] /api/schedules/:id
   * 특정 일정을 부분 수정합니다 (예: 완료 상태 토글, 기한 연장 등). JWT 인증 필수. (소유권 체크 포함)
   */
  update = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const scheduleId = parseInt(req.params.id, 10);

      if (!userId) {
        res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
        return;
      }

      if (isNaN(scheduleId)) {
        res.status(400).json({ success: false, message: '올바르지 않은 일정 ID 형식입니다.' });
        return;
      }

      const { title, description, dueDate, completed, documentType } = req.body;

      const updated = await this.scheduleService.updateSchedule(scheduleId, userId, {
        title,
        description,
        due_date: dueDate,
        completed,
        document_type: documentType
      });

      res.status(200).json({
        success: true,
        message: '행정 일정이 성공적으로 수정되었습니다.',
        data: { schedule: updated }
      });
    } catch (error: any) {
      console.error('[ScheduleController] update 에러:', error);
      res.status(400).json({
        success: false,
        message: error.message || '일정을 수정하는 도중 오류가 발생했습니다.'
      });
    }
  };

  /**
   * [DELETE] /api/schedules/:id
   * 특정 일정을 삭제합니다. JWT 인증 필수. (소유권 체크 포함)
   */
  delete = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const scheduleId = parseInt(req.params.id, 10);

      if (!userId) {
        res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
        return;
      }

      if (isNaN(scheduleId)) {
        res.status(400).json({ success: false, message: '올바르지 않은 일정 ID 형식입니다.' });
        return;
      }

      await this.scheduleService.deleteSchedule(scheduleId, userId);

      res.status(200).json({
        success: true,
        message: '행정 일정이 정상적으로 삭제되었습니다.'
      });
    } catch (error: any) {
      console.error('[ScheduleController] delete 에러:', error);
      res.status(400).json({
        success: false,
        message: error.message || '일정을 삭제하는 도중 오류가 발생했습니다.'
      });
    }
  };

  /**
   * [POST] /api/schedules/auto-generate
   * 서류 분석 완료 후, 선택한 기준일자(이사일 등)를 바탕으로 필요한 모든 법적 기한 일정을 일괄 자동 가입 및 생성합니다. JWT 인증 필수.
   */
  autoGenerate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
        return;
      }

      const { documentType, baseDate } = req.body;

      if (!documentType) {
        res.status(400).json({ success: false, message: '서류 종류(documentType)가 누락되었습니다.' });
        return;
      }

      if (!baseDate) {
        res.status(400).json({ success: false, message: '기준 날짜(baseDate)가 누락되었습니다.' });
        return;
      }

      const generatedList = await this.scheduleService.autoGenerateSchedules(
        userId,
        documentType,
        baseDate
      );

      res.status(201).json({
        success: true,
        message: `총 ${generatedList.length}개의 관련 법적 마감 행정 일정이 캘린더에 성공적으로 자동 생성되었습니다.`,
        data: { schedules: generatedList }
      });
    } catch (error: any) {
      console.error('[ScheduleController] autoGenerate 에러:', error);
      res.status(400).json({
        success: false,
        message: error.message || '법적 마감 일정을 생성하는 데 실패했습니다.'
      });
    }
  };
}

export const scheduleController = new ScheduleController();
