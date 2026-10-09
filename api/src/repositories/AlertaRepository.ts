import { Pool } from 'pg';
import { Alerta, Classificacao, PlanoDeAcao, Sugestao } from '../domain/risco';

export interface Feedback {
  id: string;
  alertaId: string;
  responsavelId: string;
  status: 'em_andamento' | 'resolvido';
  observacao: string | null;
  criadoEm: string;
}

export interface IAlertaRepository {
  ultimoDoAluno(alunoId: string): Promise<Alerta | null>;
  listarPorAluno(alunoId: string): Promise<Alerta[]>;
  buscarPorId(id: string): Promise<Alerta | null>;
  /** Grava alerta + plano + sugestões numa transação só. */
  criarComPlano(alunoId: string, classificacao: Classificacao, plano: PlanoDeAcao | null): Promise<Alerta>;
  sugestoesDoAlerta(alertaId: string): Promise<Sugestao[]>;
  criarFeedback(dados: { alertaId: string; responsavelId: string; status: Feedback['status']; observacao: string | null }): Promise<Feedback>;
  feedbacksDoAluno(alunoId: string): Promise<Feedback[]>;
}

interface AlertaRow {
  id: string;
  aluno_id: string;
  nivel: Alerta['nivel'];
  causa_raiz: Alerta['causaRaiz'];
  regra_origem: string | null;
  correlacao: boolean;
  detalhes: Alerta['detalhes'];
  criado_em: Date;
}

const mapear = (r: AlertaRow): Alerta => ({
  id: r.id,
  alunoId: r.aluno_id,
  nivel: r.nivel,
  causaRaiz: r.causa_raiz,
  regraOrigem: r.regra_origem,
  correlacao: r.correlacao,
  detalhes: r.detalhes,
  criadoEm: r.criado_em.toISOString(),
});

interface FeedbackRow {
  id: string;
  alerta_id: string;
  responsavel_id: string;
  status: Feedback['status'];
  observacao: string | null;
  criado_em: Date;
}

const mapearFeedback = (r: FeedbackRow): Feedback => ({
  id: r.id,
  alertaId: r.alerta_id,
  responsavelId: r.responsavel_id,
  status: r.status,
  observacao: r.observacao,
  criadoEm: r.criado_em.toISOString(),
});

const COLUNAS = 'id, aluno_id, nivel, causa_raiz, regra_origem, correlacao, detalhes, criado_em';

export class PgAlertaRepository implements IAlertaRepository {
  constructor(private readonly pool: Pool) {}

  async ultimoDoAluno(alunoId: string) {
    const { rows } = await this.pool.query<AlertaRow>(
      `SELECT ${COLUNAS} FROM alertas WHERE aluno_id = $1 ORDER BY criado_em DESC, id DESC LIMIT 1`,
      [alunoId],
    );
    return rows[0] ? mapear(rows[0]) : null;
  }

  async listarPorAluno(alunoId: string) {
    const { rows } = await this.pool.query<AlertaRow>(
      `SELECT ${COLUNAS} FROM alertas WHERE aluno_id = $1 ORDER BY criado_em, id`,
      [alunoId],
    );
    return rows.map(mapear);
  }

  async buscarPorId(id: string) {
    const { rows } = await this.pool.query<AlertaRow>(`SELECT ${COLUNAS} FROM alertas WHERE id = $1`, [id]);
    return rows[0] ? mapear(rows[0]) : null;
  }

  async criarComPlano(alunoId: string, c: Classificacao, plano: PlanoDeAcao | null) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<AlertaRow>(
        `INSERT INTO alertas (aluno_id, nivel, causa_raiz, regra_origem, correlacao, detalhes)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLUNAS}`,
        [alunoId, c.nivel, c.causaRaiz, c.regraOrigem, c.correlacao, JSON.stringify({ sinais: c.sinais, dataReferencia: c.dataReferencia })],
      );
      if (plano) {
        const { rows: p } = await client.query<{ id: string }>('INSERT INTO planos_acao (alerta_id) VALUES ($1) RETURNING id', [rows[0].id]);
        for (const s of plano.sugestoes) {
          await client.query(
            'INSERT INTO sugestoes (plano_id, texto, ordem, causa, tipo, disciplina, assunto) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [p[0].id, s.texto, s.ordem, s.causa, s.tipo, s.disciplina, s.assunto],
          );
        }
      }
      await client.query('COMMIT');
      return mapear(rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async sugestoesDoAlerta(alertaId: string) {
    const { rows } = await this.pool.query<Sugestao>(
      `SELECT s.texto, s.ordem, s.causa, s.tipo, s.disciplina, s.assunto FROM sugestoes s
       JOIN planos_acao p ON p.id = s.plano_id
       WHERE p.alerta_id = $1 ORDER BY s.ordem`,
      [alertaId],
    );
    return rows;
  }

  async criarFeedback(d: { alertaId: string; responsavelId: string; status: Feedback['status']; observacao: string | null }) {
    const { rows } = await this.pool.query<FeedbackRow>(
      `INSERT INTO feedbacks (alerta_id, responsavel_id, status, observacao) VALUES ($1, $2, $3, $4)
       RETURNING id, alerta_id, responsavel_id, status, observacao, criado_em`,
      [d.alertaId, d.responsavelId, d.status, d.observacao],
    );
    return mapearFeedback(rows[0]);
  }

  async feedbacksDoAluno(alunoId: string) {
    const { rows } = await this.pool.query<FeedbackRow>(
      `SELECT f.id, f.alerta_id, f.responsavel_id, f.status, f.observacao, f.criado_em
       FROM feedbacks f JOIN alertas a ON a.id = f.alerta_id
       WHERE a.aluno_id = $1 ORDER BY f.criado_em`,
      [alunoId],
    );
    return rows.map(mapearFeedback);
  }
}
