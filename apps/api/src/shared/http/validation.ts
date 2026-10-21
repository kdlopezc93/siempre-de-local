import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

/** Valida una entrada con su esquema de @sdl/contracts; 400 con el detalle si no cumple. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new BadRequestException(`Datos inválidos: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}
