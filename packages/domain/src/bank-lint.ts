import { boardIssues, type ExamBoard } from './exam-board.js';
import { difficultyQuotas, type Difficulty, type ExamConfig } from './knowledge.js';

/** Un banco tal como se escribe (antes de publicarlo). */
export interface BankDraft {
  areas: readonly { code: string; name: string }[];
  items: readonly {
    code: string;
    area: string;
    difficulty: Difficulty;
    text: string;
    options: readonly { label: string; correct?: boolean }[];
    explanation: string;
    /** Pregunta tipo pizarra (Fase 8): la jugada dibujada y, si se responde tocando, un punto por opción. */
    board?: ExamBoard;
  }[];
}

export interface LintIssue {
  /** `error` impide publicar; `warning` hay que mirarlo, pero no bloquea. */
  level: 'error' | 'warning';
  rule: string;
  /** Código del ítem, o null si es del banco entero. */
  item: string | null;
  message: string;
}

/** Absolutos que delatan a un distractor ("siempre", "nunca"…): 02 §6.5. */
const ABSOLUTES = /\b(siempre|nunca|jam[aá]s|todos|todas|ninguno|ninguna|nada|nadie)\b/i;

/**
 * Si la correcta es la más larga (o la más corta) en más de esta proporción de ítems, se nota
 * el patrón. Con cuatro opciones, por azar sería una de cada cuatro.
 */
const LENGTH_PATTERN_MAX = 0.4;

/**
 * Reglas de calidad para publicar un banco (02 §6.5). Errores: estructura y tamaño.
 * Avisos: patrones de redacción que regalan la respuesta.
 */
export function lintBank(bank: BankDraft, cfg: ExamConfig): LintIssue[] {
  const issues: LintIssue[] = [];
  const error = (rule: string, item: string | null, message: string) =>
    issues.push({ level: 'error', rule, item, message });
  const warning = (rule: string, item: string | null, message: string) =>
    issues.push({ level: 'warning', rule, item, message });

  if (bank.items.length < cfg.minItemsToPublish) {
    error(
      'min-items',
      null,
      `Tiene ${bank.items.length} ítems; se necesitan al menos ${cfg.minItemsToPublish} para publicar.`,
    );
  }

  const areaCodes = new Set(bank.areas.map((a) => a.code));
  const codes = new Set<string>();
  const texts = new Set<string>();
  let longestCorrect = 0;
  let shortestCorrect = 0;

  for (const item of bank.items) {
    if (codes.has(item.code)) error('duplicate-code', item.code, 'Código repetido.');
    codes.add(item.code);
    const text = item.text.trim().toLowerCase();
    if (texts.has(text)) error('duplicate-text', item.code, 'Enunciado repetido.');
    texts.add(text);

    if (!areaCodes.has(item.area))
      error('unknown-area', item.code, `Área desconocida: ${item.area}.`);
    if (![1, 2, 3].includes(item.difficulty)) {
      error('difficulty', item.code, 'La dificultad va de 1 a 3.');
    }
    if (!item.text.trim()) error('empty-text', item.code, 'Falta el enunciado.');
    if (!item.explanation.trim()) error('empty-explanation', item.code, 'Falta la explicación.');
    if (item.options.length !== 4) {
      error('four-options', item.code, `Tiene ${item.options.length} opciones; van 4.`);
    }
    const correct = item.options.filter((o) => o.correct);
    if (correct.length !== 1) {
      error('one-correct', item.code, `Tiene ${correct.length} correctas; va exactamente 1.`);
    }
    const labels = item.options.map((o) => o.label.trim().toLowerCase());
    if (new Set(labels).size !== labels.length) {
      error('duplicate-option', item.code, 'Hay opciones repetidas.');
    }
    if (labels.some((l) => !l)) error('empty-option', item.code, 'Hay una opción vacía.');
    if (item.board) {
      for (const problem of boardIssues(item.board, item.options.length)) {
        error('board', item.code, problem);
      }
    }

    const right = correct[0];
    if (right) {
      const others = item.options.filter((o) => o !== right);
      if (others.every((o) => right.label.trim().length > o.label.trim().length)) longestCorrect++;
      if (others.every((o) => right.label.trim().length < o.label.trim().length)) shortestCorrect++;
      const giveaway = others.find((o) => ABSOLUTES.test(o.label) && !ABSOLUTES.test(right.label));
      if (giveaway) {
        warning(
          'absolute-distractor',
          item.code,
          `Un distractor usa un absoluto ("${giveaway.label}"): delata que es falso.`,
        );
      }
    }
  }

  if (bank.items.length > 0 && longestCorrect / bank.items.length > LENGTH_PATTERN_MAX) {
    warning(
      'longest-correct',
      null,
      `La correcta es la opción más larga en ${longestCorrect} de ${bank.items.length} ítems: el patrón se nota.`,
    );
  }
  // El patrón contrario: al acortar correctas para que no sean las más largas, se puede pasar.
  if (bank.items.length > 0 && shortestCorrect / bank.items.length > LENGTH_PATTERN_MAX) {
    warning(
      'shortest-correct',
      null,
      `La correcta es la opción más corta en ${shortestCorrect} de ${bank.items.length} ítems: el patrón se nota.`,
    );
  }

  for (const area of bank.areas) {
    const count = bank.items.filter((i) => i.area === area.code).length;
    if (count === 0) error('empty-area', null, `El área "${area.name}" no tiene ítems.`);
    else if (count < 3) {
      warning('thin-area', null, `El área "${area.name}" tiene solo ${count} ítems.`);
    }
  }

  // Cada dificultad debe alcanzar para su cupo en un examen.
  const quotas = difficultyQuotas(cfg);
  for (const d of [1, 2, 3] as const) {
    const count = bank.items.filter((i) => i.difficulty === d).length;
    if (count < quotas[d]) {
      error(
        'difficulty-mix',
        null,
        `Dificultad ${d}: hay ${count} ítems y cada examen pide ${quotas[d]}.`,
      );
    }
  }
  return issues;
}
