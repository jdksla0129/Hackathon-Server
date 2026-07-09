import { Router } from 'express';
import { scheduleController } from '../controllers/scheduleController';
import { authenticateJwt } from '../middlewares/authMiddleware';

const router = Router();

// 모든 스케줄(일정) API는 로그인된 사용자만 호출 가능하므로 authenticateJwt 적용

// 1. 새로운 스케줄 일정 개별 등록
router.post('/', authenticateJwt, scheduleController.create);

// 2. 로그인된 사용자 본인의 스케줄 일정 전체 목록 조회 (마감순 정렬)
router.get('/', authenticateJwt, scheduleController.list);

// 3. 서류 기준일에 따른 법적 마감일정 일괄 자동 생성 (예: 이사일 기준 전입신고, 확정일자 등)
router.post('/auto-generate', authenticateJwt, scheduleController.autoGenerate);

// 4. 단일 스케줄 일정 상세 조회 (본인 소유 여부 검증)
router.get('/:id', authenticateJwt, scheduleController.detail);

// 5. 스케줄 일정 부분 수정 (완료 상태 변경, 상세 정보 수정 등)
router.patch('/:id', authenticateJwt, scheduleController.update);

// 6. 스케줄 일정 삭제
router.delete('/:id', authenticateJwt, scheduleController.delete);

export default router;
