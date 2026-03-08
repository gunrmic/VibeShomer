export type Severity = 'critical' | 'warning' | 'info';
export type Category = 'security' | 'performance';
export type ProjectType =
  | 'nextjs'
  | 'express'
  | 'django'
  | 'fastapi'
  | 'rails'
  | 'go'
  | 'generic-js'
  | 'generic-python'
  | 'unknown';

export interface Issue {
  id: string;
  category: Category;
  severity: Severity;
  title: string;
  explanation: string;
  location?: string;
  badCode?: string;
  fix?: string;
}

export interface ReviewResult {
  projectType: ProjectType;
  language: string;
  score: {
    security: number;
    performance: number;
  };
  issues: Issue[];
  summary: string;
}
