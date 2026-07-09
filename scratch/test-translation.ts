import { translationService } from '../src/services/translationService';

async function run() {
  console.log('실제 API 3단계 파이프라인 (RAG + Pro + Flash 2.0 Grounding) 호출 테스트 시작...');
  try {
    const result = await translationService.translateAndCorrect(
      '체납된 수도요금 35,000원을 2026년 7월 25일까지 납부하지 않으면 단수 조치됩니다. 납부는 편의점이나 전용 가상계좌(신한은행 110-123-456789)로 가능합니다.',
      'en',
      'ko'
    );
    console.log('\n====================================');
    console.log('🎉 API 테스트 및 파이프라인 호출 전과정 성공!');
    console.log('🗂️ Document Type:', result.documentType);
    console.log('📝 Summary:', result.summary);
    console.log('📌 Action Items:', JSON.stringify(result.actionItems, null, 2));
    console.log('⚠️ Warnings:', JSON.stringify(result.warnings, null, 2));
    console.log('====================================\n');
  } catch (err) {
    console.error('❌ 테스트 중 에러 발생:', err);
  }
}

run();
