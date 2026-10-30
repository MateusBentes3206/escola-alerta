import { Pool } from 'pg';
import { Aluno } from '../domain/aluno';

export interface IAlunoRepository {
  listarIds(): Promise<string[]>;
  listarPorOrientador(orientadorId: string): Promise<Aluno[]>;
  listarPorResponsavel(responsavelId: string): Promise<Aluno[]>;
  buscarPorId(id: string): Promise<Aluno | null>;
  criar(dados: { nome: string; turma: string; orientadorId: string; responsavelId: string | null }): Promise<Aluno>;
  confirmarVinculo(id: string): Promise<void>;
  excluir(id: string): Promise<void>;
}

interface AlunoRow {
  id: string;
  nome: string;
  turma: string;
  orientador_id: string;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  vinculo_confirmado: boolean;
}

const SELECT = `
  SELECT a.id, a.nome, a.turma, a.orientador_id, a.responsavel_id, a.vinculo_confirmado, r.nome AS responsavel_nome
  FROM alunos a LEFT JOIN usuarios r ON r.id = a.responsavel_id`;

function mapear(row: AlunoRow): Aluno {
  return {
    id: row.id,
    nome: row.nome,
    turma: row.turma,
    orientadorId: row.orientador_id,
    responsavelId: row.responsavel_id,
    responsavelNome: row.responsavel_nome,
    vinculoConfirmado: row.vinculo_confirmado,
  };
}

export class PgAlunoRepository implements IAlunoRepository {
  constructor(private readonly pool: Pool) {}

  async listarIds() {
    const { rows } = await this.pool.query<{ id: string }>('SELECT id FROM alunos');
    return rows.map((r) => r.id);
  }

  async listarPorOrientador(orientadorId: string) {
    const { rows } = await this.pool.query<AlunoRow>(`${SELECT} WHERE a.orientador_id = $1 ORDER BY a.nome`, [orientadorId]);
    return rows.map(mapear);
  }

  async listarPorResponsavel(responsavelId: string) {
    const { rows } = await this.pool.query<AlunoRow>(`${SELECT} WHERE a.responsavel_id = $1 ORDER BY a.nome`, [responsavelId]);
    return rows.map(mapear);
  }

  async buscarPorId(id: string) {
    const { rows } = await this.pool.query<AlunoRow>(`${SELECT} WHERE a.id = $1`, [id]);
    return rows[0] ? mapear(rows[0]) : null;
  }

  async criar(dados: { nome: string; turma: string; orientadorId: string; responsavelId: string | null }) {
    const { rows } = await this.pool.query<{ id: string }>(
      'INSERT INTO alunos (nome, turma, orientador_id, responsavel_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [dados.nome, dados.turma, dados.orientadorId, dados.responsavelId],
    );
    return (await this.buscarPorId(rows[0].id))!;
  }

  async confirmarVinculo(id: string) {
    await this.pool.query('UPDATE alunos SET vinculo_confirmado = true WHERE id = $1', [id]);
  }

  async excluir(id: string) {
    await this.pool.query('DELETE FROM alunos WHERE id = $1', [id]);
  }
}
