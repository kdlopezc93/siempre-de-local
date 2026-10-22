import {
  CertPositionsResponseSchema,
  ExamInProgressSchema,
  ExamResponseSchema,
  ExamResultSchema,
  MyExamsResponseSchema,
  type CertPositionsResponse,
  type ExamInProgress,
  type ExamResponse,
  type ExamResult,
  type StartExamRequest,
} from '@sdl/contracts';

import { apiFetch, apiRequest } from './http';

export function fetchCertPositions(): Promise<CertPositionsResponse> {
  return apiRequest('/api/v1/certification/positions', CertPositionsResponseSchema);
}

export function startExam(request: StartExamRequest): Promise<ExamInProgress> {
  return apiRequest('/api/v1/cert-exams', ExamInProgressSchema, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function fetchExam(examId: string): Promise<ExamResponse> {
  return apiRequest(`/api/v1/cert-exams/${examId}`, ExamResponseSchema);
}

export async function answerExam(examId: string, itemId: string, optionId: string) {
  await apiFetch(`/api/v1/cert-exams/${examId}/answers/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify({ optionId }),
  });
}

export function finishExam(examId: string, how: 'submit' | 'abandon'): Promise<ExamResult> {
  return apiRequest(`/api/v1/cert-exams/${examId}/${how}`, ExamResultSchema, { method: 'POST' });
}

export async function fetchMyExams(): Promise<ExamResult[]> {
  const { items } = await apiRequest('/api/v1/me/cert-exams', MyExamsResponseSchema);
  return items;
}
