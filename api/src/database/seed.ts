import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { servicoDeRisco } from '../container';
import { DadosIndicador } from '../domain/indicador';
import { hojeIso, somarDias } from '../motor/datas';

// Dados 100% fictícios (RNF02 / LGPD). Os mesmos nomes do protótipo React,
// para a demonstração continuar coerente depois da integração.
export const SENHA_PADRAO_SEED = 'senha123';

export const USUARIOS_SEED = [
  { nome: 'Camila Duarte', email: 'camila.duarte@escola.com.br', perfil: 'ORIENTADOR' },
  { nome: 'Beatriz Lima', email: 'beatriz.lima@email.com', perfil: 'RESPONSAVEL' },
  { nome: 'Marcos Souza', email: 'marcos.souza@email.com', perfil: 'RESPONSAVEL' },
  { nome: 'Sandra Matos', email: 'sandra.matos@email.com', perfil: 'RESPONSAVEL' },
] as const;

/** Dia letivo N dias antes de hoje (recua para sexta se cair no fim de semana). */
function diaLetivoAntes(dias: number): string {
  let d = somarDias(hojeIso(), -dias);
  while ([0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay())) d = somarDias(d, -1);
  return d;
}

const vazio = { disciplina: null, valor: null, periodo: null, assunto: null, justificada: null, gravidade: null, horario: null, descricao: null };
const nota = (disciplina: string, assunto: string, valor: number, periodo: string, dias: number): DadosIndicador =>
  ({ ...vazio, tipo: 'NOTA', data: diaLetivoAntes(dias), disciplina, assunto, valor, periodo });
const falta = (dias: number, justificada = false, descricao: string | null = null): DadosIndicador =>
  ({ ...vazio, tipo: 'FALTA', data: diaLetivoAntes(dias), justificada, descricao });
const ocorrencia = (descricao: string, gravidade: 'leve' | 'moderada' | 'grave', dias: number): DadosIndicador =>
  ({ ...vazio, tipo: 'OCORRENCIA', data: diaLetivoAntes(dias), descricao, gravidade });

// Datas relativas a hoje: a demonstração não "envelhece" para fora das janelas do motor.
// Rafael: alto por notas (2 disciplinas abaixo de 6, com queda em Matemática) + faltas -> correlação.
// Ana: sem sinais. Diego: falta justificada (não conta) + ocorrência moderada -> moderado.
const ALUNOS_SEED: { nome: string; turma: string; responsavel: string; indicadores: () => DadosIndicador[] }[] = [
  {
    nome: 'Rafael Costa Lima', turma: '8º ano B', responsavel: 'beatriz.lima@email.com',
    indicadores: () => [
      nota('Matemática', 'Frações', 7.0, '2º bimestre', 70), nota('Português', 'Interpretação de texto', 6.5, '2º bimestre', 70),
      nota('Matemática', 'Equações do 1º grau', 5.2, '3º bimestre', 10), nota('Português', 'Concordância verbal', 5.8, '3º bimestre', 10),
      falta(20), falta(13), falta(6),
      ocorrencia('Não entregou trabalho em grupo', 'leve', 8),
    ],
  },
  {
    nome: 'Ana Beatriz Souza', turma: '7º ano A', responsavel: 'marcos.souza@email.com',
    indicadores: () => [nota('Ciências', 'Sistema digestório', 8.4, '3º bimestre', 10)],
  },
  {
    nome: 'Diego Matos Pereira', turma: '9º ano C', responsavel: 'sandra.matos@email.com',
    indicadores: () => [
      falta(5, true, 'Atestado médico entregue na secretaria'),
      ocorrencia('Discussão com colega no intervalo', 'moderada', 3),
    ],
  },
];

export async function rodarSeed(pool: Pool) {
  const hash = await bcrypt.hash(SENHA_PADRAO_SEED, 10);
  const ids: Record<string, string> = {};

  for (const u of USUARIOS_SEED) {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome
       RETURNING id`,
      [u.nome, u.email, hash, u.perfil],
    );
    ids[u.email] = rows[0].id;
  }

  const orientadorId = ids['camila.duarte@escola.com.br'];
  for (const a of ALUNOS_SEED) {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO alunos (nome, turma, orientador_id, responsavel_id)
       SELECT $1::varchar, $2::varchar, $3::uuid, $4::uuid
       WHERE NOT EXISTS (SELECT 1 FROM alunos WHERE nome = $1::varchar)
       RETURNING id`,
      [a.nome, a.turma, orientadorId, ids[a.responsavel]],
    );
    if (rows.length === 0) continue; // aluno já existia: não duplica o histórico

    for (const d of a.indicadores()) {
      await pool.query(
        `INSERT INTO indicadores (aluno_id, registrado_por, tipo, data, disciplina, valor, periodo, assunto, justificada, gravidade, horario, descricao)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [rows[0].id, orientadorId, d.tipo, d.data, d.disciplina, d.valor, d.periodo, d.assunto, d.justificada, d.gravidade, d.horario, d.descricao],
      );
    }
    // O motor avalia o histórico inicial: gera o primeiro alerta, o plano e as notificações.
    await servicoDeRisco.reavaliar(rows[0].id);
  }
}
