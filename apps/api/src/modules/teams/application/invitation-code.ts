import { createHash, randomInt } from 'node:crypto';

/** Sin 0/O, 1/I/L: se dicta y se copia a mano sin confusiones. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const LENGTH = 10;

/** Código de invitación: 10 caracteres de 31 posibles (~50 bits). */
export function generateInvitationCode(): string {
  return Array.from({ length: LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
}

/** Acepta el código como lo escriba la persona: minúsculas, espacios o guiones. */
export function normalizeInvitationCode(raw: string): string {
  return raw.toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/** Los códigos tienen entropía alta: basta un hash rápido, sin sal, para buscarlos. */
export function hashInvitationCode(code: string): string {
  return createHash('sha256').update(normalizeInvitationCode(code)).digest('hex');
}
