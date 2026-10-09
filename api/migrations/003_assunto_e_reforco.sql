-- 003_assunto_e_reforco.sql
-- Nota passa a registrar o assunto avaliado; o plano de ação ganha itens de reforço
-- por disciplina/assunto e recomendações de ensino.

ALTER TABLE indicadores ADD COLUMN assunto VARCHAR(160);

-- Tipo do item do plano:
--   ACAO    = ação geral da matriz pedagógica (por causa raiz)
--   REFORCO = o que reforçar (disciplina + assunto + nota)
--   ENSINO  = recomendação de ensino para o professor sobre aquele assunto
--   FAMILIA = orientação de estudo em casa sobre aquele assunto
ALTER TABLE sugestoes
  ADD COLUMN tipo VARCHAR(10) NOT NULL DEFAULT 'ACAO' CHECK (tipo IN ('ACAO', 'REFORCO', 'ENSINO', 'FAMILIA')),
  ADD COLUMN disciplina VARCHAR(80),
  ADD COLUMN assunto VARCHAR(160);
