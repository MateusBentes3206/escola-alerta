import { Pool } from 'pg';
import { DadosIndicador, Indicador, TipoIndicador } from '../domain/indicador';

export interface IIndicadorRepository {
  listarPorAluno(alunoId: string, tipo?: TipoIndicador): Promise<Indicador[]>;
  buscarPorId(id: string): Promise<Indicador | null>;
  criar(alunoId: string, dados: DadosIndicador, registradoPor: string): Promise<Indicador>;
  atualizar(id: string, dados: DadosIndicador): Promise<Indicador>;
  excluir(id: string): Promise<void>;
}

interface IndicadorRow {
  id: string;
  aluno_id: string;
  tipo: TipoIndicador;
  data: string;
  disciplina: string | null;
  valor: number | null;
  periodo: string | null;
  assunto: string | null;
  justificada: boolean | null;
  gravidade: Indicador['gravidade'];
  horario: string | null;
  descricao: string | null;
}

const COLUNAS = 'id, aluno_id, tipo, data, disciplina, valor, periodo, assunto, justificada, gravidade, horario, descricao';

function mapear(row: IndicadorRow): Indicador {
  return {
    id: row.id,
    alunoId: row.aluno_id,
    tipo: row.tipo,
    data: row.data,
    disciplina: row.disciplina,
    valor: row.valor,
    periodo: row.periodo,
    assunto: row.assunto,
    justificada: row.justificada,
    gravidade: row.gravidade,
    horario: row.horario ? row.horario.slice(0, 5) : null, // '14:30:00' -> '14:30'
    descricao: row.descricao,
  };
}

function valores(d: DadosIndicador) {
  return [d.tipo, d.data, d.disciplina, d.valor, d.periodo, d.justificada, d.gravidade, d.horario, d.descricao, d.assunto];
}

export class PgIndicadorRepository implements IIndicadorRepository {
  constructor(private readonly pool: Pool) {}

  async listarPorAluno(alunoId: string, tipo?: TipoIndicador) {
    const { rows } = await this.pool.query<IndicadorRow>(
      `SELECT ${COLUNAS} FROM indicadores
       WHERE aluno_id = $1 AND ($2::varchar IS NULL OR tipo = $2)
       ORDER BY data, criado_em`,
      [alunoId, tipo ?? null],
    );
    return rows.map(mapear);
  }

  async buscarPorId(id: string) {
    const { rows } = await this.pool.query<IndicadorRow>(`SELECT ${COLUNAS} FROM indicadores WHERE id = $1`, [id]);
    return rows[0] ? mapear(rows[0]) : null;
  }

  async criar(alunoId: string, dados: DadosIndicador, registradoPor: string) {
    const { rows } = await this.pool.query<IndicadorRow>(
      `INSERT INTO indicadores (aluno_id, registrado_por, tipo, data, disciplina, valor, periodo, justificada, gravidade, horario, descricao, assunto)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING ${COLUNAS}`,
      [alunoId, registradoPor, ...valores(dados)],
    );
    return mapear(rows[0]);
  }

  async atualizar(id: string, dados: DadosIndicador) {
    const { rows } = await this.pool.query<IndicadorRow>(
      `UPDATE indicadores SET tipo = $2, data = $3, disciplina = $4, valor = $5, periodo = $6,
         justificada = $7, gravidade = $8, horario = $9, descricao = $10, assunto = $11
       WHERE id = $1
       RETURNING ${COLUNAS}`,
      [id, ...valores(dados)],
    );
    return mapear(rows[0]);
  }

  async excluir(id: string) {
    await this.pool.query('DELETE FROM indicadores WHERE id = $1', [id]);
  }
}
