-- 005_matriz_editavel.sql
-- Matriz de sugestões pedagógicas editável pelo orientador (a escola adapta à própria realidade).
-- Sem linhas para um orientador = vale a matriz padrão do sistema.
-- Planos já gerados não mudam: as sugestões ficam copiadas em "sugestoes" no momento do alerta.
CREATE TABLE matriz_sugestoes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orientador_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  causa          VARCHAR(20) NOT NULL CHECK (causa IN ('NOTAS', 'FALTAS', 'OCORRENCIAS', 'SAIDAS')),
  texto          TEXT NOT NULL CHECK (char_length(texto) BETWEEN 5 AND 300),
  ordem          SMALLINT NOT NULL,
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_matriz_orientador ON matriz_sugestoes(orientador_id, causa, ordem);
