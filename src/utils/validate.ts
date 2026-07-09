/**
 * ISO-2 국가 코드가 올바른 형식인지 검증합니다. (두 글자 영문)
 */
export const isValidCountryCode = (code: any): boolean => {
  if (typeof code !== 'string') return false;
  return /^[A-Za-z]{2}$/.test(code);
};

/**
 * 이민 비자 타입이 허용된 종류인지 검증합니다.
 */
export const isValidVisaType = (visaType: any): boolean => {
  const allowedTypes = ['skilled', 'family', 'investor', 'student'];
  if (typeof visaType !== 'string') return false;
  return allowedTypes.includes(visaType.toLowerCase());
};

/**
 * 체크리스트 POST 요청 바디를 전체 검증합니다.
 */
export const validateChecklistRequest = (body: any): { isValid: boolean; message?: string } => {
  const { from, to, visaType, family } = body;

  if (!from || !isValidCountryCode(from)) {
    return { isValid: false, message: '출발 국가 코드(from)가 올바르지 않거나 누락되었습니다. (예: KR)' };
  }

  if (!to || !isValidCountryCode(to)) {
    return { isValid: false, message: '대상 국가 코드(to)가 올바르지 않거나 누락되었습니다. (예: CA, US)' };
  }

  if (!visaType || !isValidVisaType(visaType)) {
    return { isValid: false, message: '비자 유형(visaType)이 올바르지 않거나 누락되었습니다. (skilled, family, investor, student 중 하나여야 합니다)' };
  }

  if (family !== undefined && typeof family !== 'boolean') {
    return { isValid: false, message: '동반 가족 여부(family)는 불리언(true/false) 형식이어야 합니다.' };
  }

  return { isValid: true };
};
