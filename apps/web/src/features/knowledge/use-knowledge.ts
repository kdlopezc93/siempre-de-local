import type { ExamInProgress, ExamResponse, StartExamRequest } from '@sdl/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  answerExam,
  fetchCertPositions,
  fetchExam,
  fetchMyExams,
  finishExam,
  startExam,
} from '../../shared/api/certification';

const examKey = (examId: string) => ['cert-exam', examId] as const;

export function useCertPositions() {
  return useQuery({ queryKey: ['cert-positions'], queryFn: fetchCertPositions });
}

export function useMyExams() {
  return useQuery({ queryKey: ['me', 'cert-exams'], queryFn: fetchMyExams });
}

export function useStartExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: StartExamRequest) => startExam(request),
    onSuccess: (exam) => {
      queryClient.setQueryData<ExamResponse>(examKey(exam.examId), exam);
      void queryClient.invalidateQueries({ queryKey: ['cert-positions'] });
    },
  });
}

/** El examen en curso o su resultado. No se refresca solo: el reloj corre en el celular. */
export function useExam(examId: string) {
  return useQuery({
    queryKey: examKey(examId),
    queryFn: () => fetchExam(examId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/**
 * Guarda una respuesta. Se marca en pantalla al instante (optimista) y se envía; si falla,
 * se vuelve a intentar y, al final, se avisa.
 */
export function useAnswer(examId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, optionId }: { itemId: string; optionId: string }) =>
      answerExam(examId, itemId, optionId),
    retry: 3,
    onMutate: ({ itemId, optionId }) => {
      queryClient.setQueryData<ExamResponse>(examKey(examId), (exam) =>
        exam?.state === 'in_progress' ? withAnswer(exam, itemId, optionId) : exam,
      );
    },
  });
}

function withAnswer(exam: ExamInProgress, itemId: string, optionId: string): ExamInProgress {
  return {
    ...exam,
    items: exam.items.map((i) => (i.id === itemId ? { ...i, answerOptionId: optionId } : i)),
  };
}

/** Entregar o abandonar: el resultado reemplaza al examen en curso. */
export function useFinishExam(examId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (how: 'submit' | 'abandon') => finishExam(examId, how),
    onSuccess: (result) => {
      queryClient.setQueryData<ExamResponse>(examKey(examId), result);
      void queryClient.invalidateQueries({ queryKey: ['cert-positions'] });
      void queryClient.invalidateQueries({ queryKey: ['me', 'cert-exams'] });
    },
  });
}

/** Al vencer el plazo, el servidor lo cierra al consultarlo: se pide de nuevo. */
export function useRefreshExam(examId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: examKey(examId) });
}
