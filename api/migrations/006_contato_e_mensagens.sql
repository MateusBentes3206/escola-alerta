-- 006_contato_e_mensagens.sql
-- Telefone (WhatsApp) do responsável e registro dos avisos enviados por canais externos.

ALTER TABLE usuarios ADD COLUMN telefone VARCHAR(20)
  CHECK (telefone IS NULL OR telefone ~ '^\+55[0-9]{10,11}$');   -- formato E.164 brasileiro: +55 DDD número

-- Toda mensagem externa (e-mail, WhatsApp) fica registrada: o que foi enviado, para quem e se deu certo.
-- status: ENVIADA (saiu de verdade), SIMULADA (canal sem credenciais configuradas), FALHOU, SEM_CONTATO.
CREATE TABLE mensagens_externas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  aluno_id    UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  alerta_id   UUID REFERENCES alertas(id) ON DELETE SET NULL,
  canal       VARCHAR(10) NOT NULL CHECK (canal IN ('EMAIL', 'WHATSAPP')),
  destino     VARCHAR(160),
  assunto     VARCHAR(200),
  conteudo    TEXT NOT NULL,
  status      VARCHAR(12) NOT NULL CHECK (status IN ('ENVIADA', 'SIMULADA', 'FALHOU', 'SEM_CONTATO')),
  erro        TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mensagens_aluno ON mensagens_externas(aluno_id, criado_em);

-- Cadastro feito pela família: o filho entra "aguardando confirmação" até o orientador confirmar o vínculo.
-- Alunos cadastrados pela escola já nascem confirmados.
ALTER TABLE alunos ADD COLUMN vinculo_confirmado BOOLEAN NOT NULL DEFAULT true;
