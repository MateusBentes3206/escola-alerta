-- 001_init.sql
-- Modelo de dados do EscolaAlerta, derivado do diagrama de classes (Eixo 2, Figura 7).
-- IDs em UUID: não expõem a quantidade de registros nem permitem "adivinhar" o id de
-- outro aluno na URL (reforço ao controle de acesso do ST04 / LGPD).

-- ---------------------------------------------------------------------------
-- Usuários (classe abstrata Usuario -> Orientador | Responsavel)
-- ---------------------------------------------------------------------------
CREATE TABLE usuarios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        VARCHAR(120) NOT NULL,
  email       VARCHAR(160) NOT NULL UNIQUE,
  senha_hash  VARCHAR(100) NOT NULL,                 -- bcrypt; senha em texto puro nunca é salva (RNF01)
  perfil      VARCHAR(20)  NOT NULL CHECK (perfil IN ('ORIENTADOR', 'RESPONSAVEL')),
  criado_em   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Alunos: cadastrados por um orientador e acompanhados por um responsável
-- ---------------------------------------------------------------------------
CREATE TABLE alunos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            VARCHAR(120) NOT NULL,
  turma           VARCHAR(40)  NOT NULL,
  orientador_id   UUID NOT NULL REFERENCES usuarios(id),
  responsavel_id  UUID REFERENCES usuarios(id),      -- pode ser vinculado depois do cadastro
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alunos_orientador  ON alunos(orientador_id);
CREATE INDEX idx_alunos_responsavel ON alunos(responsavel_id);

-- ---------------------------------------------------------------------------
-- Indicadores (classe abstrata Indicador -> Nota | Frequencia | Ocorrencia | SaidaAntecipada)
-- Uma tabela única com "tipo": o motor de regras busca todo o histórico com uma query.
-- As CHECKs garantem que cada tipo tenha os campos obrigatórios dele.
-- ---------------------------------------------------------------------------
CREATE TABLE indicadores (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id     UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  tipo         VARCHAR(20) NOT NULL CHECK (tipo IN ('NOTA', 'FALTA', 'OCORRENCIA', 'SAIDA')),
  data         DATE NOT NULL DEFAULT CURRENT_DATE,

  -- NOTA
  disciplina   VARCHAR(80),
  valor        NUMERIC(4,2) CHECK (valor BETWEEN 0 AND 10),
  periodo      VARCHAR(20),

  -- FALTA
  justificada  BOOLEAN,

  -- OCORRENCIA
  gravidade    VARCHAR(10) CHECK (gravidade IN ('leve', 'moderada', 'grave')),

  -- SAIDA
  horario      TIME,

  -- descrição da ocorrência / motivo da saída / comprovante da falta
  descricao    TEXT,

  registrado_por UUID NOT NULL REFERENCES usuarios(id),
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_nota       CHECK (tipo <> 'NOTA'       OR (disciplina IS NOT NULL AND valor IS NOT NULL)),
  CONSTRAINT chk_falta      CHECK (tipo <> 'FALTA'      OR justificada IS NOT NULL),
  CONSTRAINT chk_ocorrencia CHECK (tipo <> 'OCORRENCIA' OR (descricao IS NOT NULL AND gravidade IS NOT NULL)),
  CONSTRAINT chk_saida      CHECK (tipo <> 'SAIDA'      OR descricao IS NOT NULL)
);
CREATE INDEX idx_indicadores_aluno_data ON indicadores(aluno_id, data);

-- ---------------------------------------------------------------------------
-- Alertas: resultado do motor de regras. regra_origem garante explicabilidade (RNF07).
-- ---------------------------------------------------------------------------
CREATE TABLE alertas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id      UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  nivel         VARCHAR(10) NOT NULL CHECK (nivel IN ('BAIXO', 'MODERADO', 'ALTO')),
  causa_raiz    VARCHAR(20) CHECK (causa_raiz IN ('NOTAS', 'FALTAS', 'OCORRENCIAS')),
  regra_origem  VARCHAR(60),                          -- ex.: 'RegraFaltas' (qual estratégia disparou)
  detalhes      JSONB,                                -- pesos calculados por regra, p/ auditoria
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alertas_aluno_data ON alertas(aluno_id, criado_em);

-- ---------------------------------------------------------------------------
-- Plano de ação + sugestões pedagógicas (matriz de sugestões por causa raiz)
-- ---------------------------------------------------------------------------
CREATE TABLE planos_acao (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alerta_id  UUID NOT NULL UNIQUE REFERENCES alertas(id) ON DELETE CASCADE,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sugestoes (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id  UUID NOT NULL REFERENCES planos_acao(id) ON DELETE CASCADE,
  texto     TEXT NOT NULL,
  ordem     SMALLINT NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------------------
-- Feedback de resolução registrado pelo responsável (RF13)
-- ---------------------------------------------------------------------------
CREATE TABLE feedbacks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alerta_id       UUID NOT NULL REFERENCES alertas(id) ON DELETE CASCADE,
  responsavel_id  UUID NOT NULL REFERENCES usuarios(id),
  status          VARCHAR(20) NOT NULL CHECK (status IN ('em_andamento', 'resolvido')),
  observacao      TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Notificações gravadas pelo Observer (substitui push real nesta fase)
-- ---------------------------------------------------------------------------
CREATE TABLE notificacoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  alerta_id   UUID REFERENCES alertas(id) ON DELETE CASCADE,
  mensagem    TEXT NOT NULL,
  lida        BOOLEAN NOT NULL DEFAULT false,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notificacoes_usuario ON notificacoes(usuario_id, lida);
