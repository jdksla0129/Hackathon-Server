export interface RoadmapStep {
  documentName: string;
  description: string;
  deadline?: string;
  howToApply: string;
}

export interface NextRoadmap {
  currentStep: string;
  nextSteps: RoadmapStep[];
}

export interface DocumentAnalysisResult {
  correctedText: string;
  translatedText: string;
  documentType: string;
  explanation: string;
  actionPlan: string[];
  legalObligations: string[];
  nextRoadmap: NextRoadmap;
}

export interface FileExportResult {
  fileName: string;
  filePath: string;
  downloadUrl: string;
}
