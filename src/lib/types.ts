export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface JobInput {
  keyword: string;
  location: string;
  budget: string;
}

export interface AnalysisResult {
  problem: string;
  target_users: string;
  why_it_matters: string;
  existing_bad_solutions: string;
  mvp_idea: string;
  why_it_can_work_in_location: string;
  estimated_budget_range: string;
  revenue_model: string;
  first_3_steps: string[];
}

export interface Job {
  jobId: string;
  status: JobStatus;
  input: JobInput;
  result: AnalysisResult | null;
  progress: number; // 0-100
  error: string | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
}

export interface JobStatusResponse {
  jobId: string;
  status: JobStatus;
  progress: number;
  result: AnalysisResult | null;
  error: string | null;
}

export interface Problem {
  problem: string;
  causes: string[];
  effects: string[];
  solutions: Solution[];
}

export interface Solution {
  solution: string;
  mvp: string;
  cost_estimation: string;
}

export interface BusinessIdea {
  idea: string;
  why_it_works: string;
  mvp: string;
  estimated_cost: string;
}

export interface ResearchResponse {
  keyword: string;
  problems: Problem[];
  business_ideas: BusinessIdea[];
}

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  content?: string;
}
