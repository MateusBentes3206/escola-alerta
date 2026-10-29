import { Pool } from 'pg';

export type FormatoConversa = 'PRESENCIAL' | 'LIGACAO' | 'VIDEO';
export type StatusSolicitacao = 'PENDENTE' | 'CONFIRMADA' | 'REMARCADA' | 'RECUSADA' | 'CONCLUIDA';

export interface Solicitacao {
  id: string;
  alunoId: string;
  alunoNome: string;
  turma: string;
  orientadorId: string;
  alertaId: string | null;
  responsavelId: string;
  responsavelNome: string;
  motivo: string;
  opcoes: string[];
  formato: FormatoConversa;
  observacao: string | null;
  status: StatusSolicitacao;
  horarioDefinido: string | null;
  resposta: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface NovaSolicitacao {
  alunoId: string;
  alertaId: string | null;
  responsavelId: string;
  motivo: string;
  opcoes: string[];
  formato: FormatoConversa;
  observacao: string | null;
}

export interface ISolicitacaoRepository {
  criar(dados: NovaSolicitacao): Promise<Solicitacao>;
  buscarPorId(id: string): Promise<Solicitacao | null>;
  listar(filtro: { orientadorId?: string; responsavelId?: string; alunoId?: string; status?: StatusSolicitacao[] }): Promise<Solicitacao[]>;
  existeEmAberto(alunoId: string): Promise<boolean>;
  atualizar(id: string, dados: { status: StatusSolicitacao; horarioDefinido?: string | null; resposta?: string | null }): Promise<Solicitacao>;
}

interface Row {
  id: string; aluno_id: string; aluno_nome: string; turma: string; orientador_id: string; alerta_id: string | null;
  responsavel_id: string; responsavel_nome: string; motivo: string; opcoes: string[]; formato: FormatoConversa;
  observacao: string | null; status: StatusSolicitacao; horario_definido: string | null; resposta: string | null;
  criado_em: Date; atualizado_em: Date;
}

const SELECT = `
  SELECT s.*, a.nome AS aluno_nome, a.turma, a.orientador_id, r.nome AS responsavel_nome
  FROM solicitacoes_conversa s
  JOIN alunos a ON a.id = s.aluno_id
  JOIN usuarios r ON r.id = s.responsavel_id`;

const mapear = (r: Row): Solicitacao => ({
  id: r.id, alunoId: r.aluno_id, alunoNome: r.aluno_nome, turma: r.turma, orientadorId: r.orientador_id,
  alertaId: r.alerta_id, responsavelId: r.responsavel_id, responsavelNome: r.responsavel_nome, motivo: r.motivo,
  opcoes: r.opcoes, formato: r.formato, observacao: r.observacao, status: r.status, horarioDefinido: r.horario_definido,
  resposta: r.resposta, criadoEm: r.criado_em.toISOString(), atualizadoEm: r.atualizado_em.toISOString(),
});

export class PgSolicitacaoRepository implements ISolicitacaoRepository {
  constructor(private readonly pool: Pool) {}

  async criar(d: NovaSolicitacao) {
    const { rows } = await this.pool.query<{ id: string }>(
      `INSERT INTO solicitacoes_conversa (aluno_id, alerta_id, responsavel_id, motivo, opcoes, formato, observacao)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [d.alunoId, d.alertaId, d.responsavelId, d.motivo, JSON.stringify(d.opcoes), d.formato, d.observacao],
    );
    return (await this.buscarPorId(rows[0].id))!;
  }

  async buscarPorId(id: string) {
    const { rows } = await this.pool.query<Row>(`${SELECT} WHERE s.id = $1`, [id]);
    return rows[0] ? mapear(rows[0]) : null;
  }

  async listar(f: { orientadorId?: string; responsavelId?: string; alunoId?: string; status?: StatusSolicitacao[] }) {
    const { rows } = await this.pool.query<Row>(
      `${SELECT}
       WHERE ($1::uuid IS NULL OR a.orientador_id = $1)
         AND ($2::uuid IS NULL OR s.responsavel_id = $2)
         AND ($3::uuid IS NULL OR s.aluno_id = $3)
         AND ($4::varchar[] IS NULL OR s.status = ANY($4))
       ORDER BY s.criado_em DESC`,
      [f.orientadorId ?? null, f.responsavelId ?? null, f.alunoId ?? null, f.status ?? null],
    );
    return rows.map(mapear);
  }

  async existeEmAberto(alunoId: string) {
    const { rowCount } = await this.pool.query(
      `SELECT 1 FROM solicitacoes_conversa WHERE aluno_id = $1 AND status IN ('PENDENTE', 'REMARCADA')`,
      [alunoId],
    );
    return (rowCount ?? 0) > 0;
  }

  async atualizar(id: string, d: { status: StatusSolicitacao; horarioDefinido?: string | null; resposta?: string | null }) {
    await this.pool.query(
      `UPDATE solicitacoes_conversa
       SET status = $2,
           horario_definido = CASE WHEN $3::boolean THEN $4 ELSE horario_definido END,
           resposta = CASE WHEN $5::boolean THEN $6 ELSE resposta END,
           atualizado_em = now()
       WHERE id = $1`,
      [id, d.status, d.horarioDefinido !== undefined, d.horarioDefinido ?? null, d.resposta !== undefined, d.resposta ?? null],
    );
    return (await this.buscarPorId(id))!;
  }
}
