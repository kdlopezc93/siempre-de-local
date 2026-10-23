# Bancos del examen de conocimiento: hojas de revisión

Cada archivo es la **hoja de revisión** de un banco de preguntas (`02` §6): todas las preguntas con la respuesta correcta marcada y su explicación, agrupadas por área. Sirven para que el entrenador revisor (D10) las lea cómodo, en GitHub o impresas.

**Cómo revisar**
1. Lee cada pregunta como si fueras a responderla en un partido de tu liga, no del fútbol profesional.
2. Anota al lado del código (p. ej. `DFC-AER-03`) lo que cambiarías:
   - la correcta no es la mejor respuesta;
   - otra opción también podría valer (una pregunta con dos respuestas defendibles no sirve);
   - la explicación es floja o discutible;
   - la pregunta sobra, es muy fácil o no se entiende.
3. Manda las notas (comentarios en el PR, un documento o fotos de la hoja marcada).

**Después de la revisión**, las correcciones se pasan al archivo del banco (`apps/api/src/modules/certification/infrastructure/seed/banks/`) y se llena `review` con quién revisó y la fecha. Recién ahí `db:seed` lo publica.

Las preguntas de pizarra traen su dibujo en `pizarras/` (un SVG por pregunta): la correcta va con el anillo lleno.

Estas hojas y los dibujos se generan con `pnpm bank:lint -- --md ../../docs/bancos`: no se editan a mano.
