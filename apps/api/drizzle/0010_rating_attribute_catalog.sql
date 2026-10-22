-- Catálogo de atributos de la tarjeta (03 §7). Debe coincidir con RATING_ATTRIBUTES de
-- @sdl/domain (lo comprueba ratings.catalog.test.ts).
INSERT INTO "rating_attribute" ("code", "name_es", "group") VALUES
  ('PAC', 'Ritmo', 'outfield'),
  ('SHO', 'Tiro', 'outfield'),
  ('PAS', 'Pase', 'outfield'),
  ('DRI', 'Regate', 'outfield'),
  ('DEF', 'Defensa', 'outfield'),
  ('PHY', 'Físico', 'outfield'),
  ('GK_DIV', 'Estirada', 'goalkeeper'),
  ('GK_HAN', 'Manejo', 'goalkeeper'),
  ('GK_KIC', 'Saque', 'goalkeeper'),
  ('GK_REF', 'Reflejos', 'goalkeeper'),
  ('GK_SPD', 'Velocidad de reacción', 'goalkeeper'),
  ('GK_POS', 'Colocación', 'goalkeeper')
ON CONFLICT ("code") DO NOTHING;
