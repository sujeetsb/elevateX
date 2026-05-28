export interface InterviewQuestion {
  question: string;
  hint?: string;
  category?: 'behavioral' | 'technical' | 'hr' | 'scenario';
  difficulty?: 'easy' | 'medium' | 'hard';
  answerGuide?: string;
  starFramework?: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
}

export interface InterviewPrepPayload {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  behavioralQuestions: InterviewQuestion[];
  technicalQuestions: InterviewQuestion[];
  hrQuestions: InterviewQuestion[];
  scenarioQuestions: InterviewQuestion[];
  preparationTips: string[];
  importantSkills: string[];
  expectedTopics: string[];
  companyQuestions: InterviewQuestion[];
  salaryNegotiationTips: string[];
  keyStrengthsToHighlight: string[];
  createdAt: string;
}
