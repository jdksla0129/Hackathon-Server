import { Request, Response, NextFunction } from 'express';
import countriesData from '../data/countries.json';
import usSeed from '../data/seed/US.json';
import caSeed from '../data/seed/CA.json';
import auSeed from '../data/seed/AU.json';

const seeds: Record<string, any> = {
  US: usSeed,
  CA: caSeed,
  AU: auSeed,
};

export class CountryController {
  /**
   * [GET] /api/countries
   * 지원 국가 목록을 반환합니다.
   */
  public getCountries = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json({
        success: true,
        data: countriesData,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * [GET] /api/countries/:code/visa-types
   * 특정 국가의 지원 가능한 비자 유형 목록을 반환합니다.
   */
  public getVisaTypes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { code } = req.params;
      if (!code || typeof code !== 'string') {
        res.status(400).json({
          success: false,
          message: '국가 코드(code)는 필수 입력 항목입니다.',
        });
        return;
      }

      const uppercaseCode = code.toUpperCase();
      const seedData = seeds[uppercaseCode];

      // 기본 비자 유형 4개 정의
      const defaultVisaTypes = [
        { code: 'skilled', name_ko: '기술이민', name_en: 'Skilled Migration' },
        { code: 'family', name_ko: '가족초청', name_en: 'Family Sponsorship' },
        { code: 'investor', name_ko: '투자이민', name_en: 'Investor Migration' },
        { code: 'student', name_ko: '유학 후 이민', name_en: 'Study to Immigrate' },
      ];

      if (seedData && seedData.visaTypes) {
        // 시드 국가의 경우, 시드 데이터에 명시된 비자 타입들만 선별해 매핑하여 반환
        const seededVisaTypes = defaultVisaTypes.filter((vt) =>
          seedData.visaTypes.includes(vt.code)
        );

        res.status(200).json({
          success: true,
          country: uppercaseCode,
          visaTypes: seededVisaTypes,
        });
      } else {
        // 그 외의 국가는 기본 4개 비자 유형 반환
        res.status(200).json({
          success: true,
          country: uppercaseCode,
          visaTypes: defaultVisaTypes,
        });
      }
    } catch (err) {
      next(err);
    }
  };
}

export const countryController = new CountryController();
