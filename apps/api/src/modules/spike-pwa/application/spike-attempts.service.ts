import { Injectable } from '@nestjs/common';
import type { SpikeAttemptRequest, SpikeAttemptResponse } from '@sdl/contracts';

export interface ReceivedAttempt {
  attempt: SpikeAttemptResponse;
  /** false si el `clientAttemptId` ya se había recibido (reenvío de la cola). */
  created: boolean;
}

/**
 * Recepción idempotente de intentos. En memoria porque es un spike; el real
 * guardará en `attempt` con unicidad por (user_id, client_attempt_id).
 */
@Injectable()
export class SpikeAttempts {
  private readonly received = new Map<string, SpikeAttemptResponse>();

  receive(userId: string, request: SpikeAttemptRequest, now = new Date()): ReceivedAttempt {
    // La clave incluye al usuario: otro usuario no puede leer un intento ajeno adivinando el id.
    const key = `${userId}:${request.clientAttemptId}`;
    const existing = this.received.get(key);
    if (existing) return { attempt: existing, created: false };

    const attempt: SpikeAttemptResponse = {
      clientAttemptId: request.clientAttemptId,
      receivedAt: now.toISOString(),
      answerCount: request.answers.length,
    };
    this.received.set(key, attempt);
    return { attempt, created: true };
  }
}
