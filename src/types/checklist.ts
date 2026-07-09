export interface DocumentItem {
  name_ko: string;
  name_en: string;
  issuer_ko: string;
  apostille_required: boolean;
  translation_required: boolean;
  validity_months: number;
  required_for: 'all' | 'family_only' | 'main_applicant';
  official_link: string;
  notes: string;
}

export interface ChecklistResponse {
  from: string;
  to: string;
  visaType: string;
  source: 'seed' | 'gemini';
  generatedAt: string; // ISO8601
  documents: DocumentItem[];
  sources: string[];
  disclaimer: string;
}
