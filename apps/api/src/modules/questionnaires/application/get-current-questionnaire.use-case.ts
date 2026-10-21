import { Inject, Injectable } from '@nestjs/common';
import type { QuestionnaireResponse } from '@sdl/contracts';

import { NotFoundError } from '../../../shared/errors/application-errors.js';
import { QUESTIONNAIRE_READER, type QuestionnaireReader } from './ports/questionnaire.reader.js';

@Injectable()
export class GetCurrentQuestionnaire {
  constructor(@Inject(QUESTIONNAIRE_READER) private readonly reader: QuestionnaireReader) {}

  async execute(): Promise<QuestionnaireResponse> {
    const versionId = await this.reader.currentPublishedId();
    const content = versionId && (await this.reader.load(versionId));
    if (!content) throw new NotFoundError('Todavía no hay un test publicado', 'NO_QUESTIONNAIRE');

    // Se copia campo a campo: nada del contenido interno sale si no está en el contrato.
    return {
      versionId: content.versionId,
      label: content.label,
      positionItemsPerAttempt: content.positionItemsPerAttempt,
      positionItems: content.positionItems.map((item) => ({
        id: item.id,
        code: item.code,
        context: item.context,
        text: item.text,
        options: item.options.map(({ id, label, points }) => ({ id, label, points })),
      })),
    };
  }
}
