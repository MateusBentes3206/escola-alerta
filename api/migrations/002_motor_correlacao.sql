-- 002_motor_correlacao.sql
-- Ajustes para o motor de correlação temporal (Sprint 2/3).

-- Nova causa raiz: saídas antecipadas (RF06). Mostra a extensão do motor por Strategy:
-- uma regra nova entra sem alterar as existentes.
ALTER TABLE alertas DROP CONSTRAINT alertas_causa_raiz_check;
ALTER TABLE alertas ADD CONSTRAINT alertas_causa_raiz_check
  CHECK (causa_raiz IN ('NOTAS', 'FALTAS', 'OCORRENCIAS', 'SAIDAS'));

-- true quando o nível foi elevado pela convergência de dois ou mais sinais (correlação).
ALTER TABLE alertas ADD COLUMN correlacao BOOLEAN NOT NULL DEFAULT false;

-- Sugestão rastreável à causa que a originou (RNF07).
ALTER TABLE sugestoes ADD COLUMN causa VARCHAR(20)
  CHECK (causa IN ('NOTAS', 'FALTAS', 'OCORRENCIAS', 'SAIDAS'));
