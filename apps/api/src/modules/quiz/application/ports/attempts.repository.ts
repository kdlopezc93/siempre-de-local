import type { MatchFormat, SubmitAttemptRequest } from '@sdl/contracts';
import type { RankingEntry } from '@sdl/domain';

export interface StoredAttempt {
  id: string;
  clientAttemptId: string;
  userId: string;
  teamId: string;
  format: MatchFormat;
  submittedAt: Date;
  result: {
    /** Ranking completo, de mayor a menor afinidad (el primero es la ganadora). */
    ranking: RankingEntry[];
  };
}

export interface NewAttempt {
  userId: string;
  request: SubmitAttemptRequest;
  scoringVersion: string;
  result: StoredAttempt['result'];
  receivedAt: Date;
}

export interface AttemptsRepository {
  findByClientId(userId: string, clientAttemptId: string): Promise<StoredAttempt | null>;
  /** 'duplicate' si otro envío con el mismo clientAttemptId ganó la carrera. */
  save(attempt: NewAttempt): Promise<StoredAttempt | 'duplicate'>;
  listByUser(userId: string): Promise<StoredAttempt[]>;
  findById(attemptId: string): Promise<StoredAttempt | null>;
}

export const ATTEMPTS_REPOSITORY = Symbol('ATTEMPTS_REPOSITORY');
