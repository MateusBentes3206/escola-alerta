-- 004_plano_status_e_agendamento.sql
-- Status do plano de ação e solicitações de conversa entre família e orientador.

-- Plano: ABERTO (alerta novo) -> EM_ANDAMENTO (família respondeu ou escola assumiu) -> RESOLVIDO (orientador).
-- Plano resolvido tira o aluno da lista de atenção até surgir um alerta novo.
ALTER TABLE planos_acao
  ADD COLUMN status VARCHAR(12) NOT NULL DEFAULT 'ABERTO' CHECK (status IN ('ABERTO', 'EM_ANDAMENTO', 'RESOLVIDO')),
  ADD COLUMN atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN resolvido_por UUID REFERENCES usuarios(id);

-- Solicitação de conversa: a família propõe de 1 a 3 horários; o orientador confirma um,
-- propõe outro (remarca) ou recusa com justificativa. Depois da conversa, marca como concluída.
CREATE TABLE solicitacoes_conversa (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id           UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  alerta_id          UUID REFERENCES alertas(id) ON DELETE SET NULL,
  responsavel_id     UUID NOT NULL REFERENCES usuarios(id),
  motivo             VARCHAR(120) NOT NULL,
  opcoes             JSONB NOT NULL,              -- ["2026-11-03T14:00", ...] horários propostos (hora local)
  formato            VARCHAR(12) NOT NULL CHECK (formato IN ('PRESENCIAL', 'LIGACAO', 'VIDEO')),
  observacao         TEXT,
  status             VARCHAR(12) NOT NULL DEFAULT 'PENDENTE'
                       CHECK (status IN ('PENDENTE', 'CONFIRMADA', 'REMARCADA', 'RECUSADA', 'CONCLUIDA')),
  horario_definido   VARCHAR(16),                 -- horário confirmado ou proposto na remarcação (AAAA-MM-DDTHH:MM)
  resposta           TEXT,                        -- justificativa da recusa ou mensagem da remarcação
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_solicitacoes_aluno ON solicitacoes_conversa(aluno_id, status);
