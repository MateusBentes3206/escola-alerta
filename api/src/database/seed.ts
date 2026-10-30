import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { servicoDeRisco } from '../container';
import { DadosIndicador } from '../domain/indicador';
import { hojeIso, somarDias } from '../motor/datas';

// Dados 100% fictícios (RNF02 / LGPD). Os mesmos nomes do protótipo React,
// para a demonstração continuar coerente depois da integração.
export const SENHA_PADRAO_SEED = 'senha123';

// Telefones fictícios: +55 92 90000-xxxx é uma faixa sem celulares atribuídos, então nada chega a uma pessoa real.
export const USUARIOS_SEED = [
  { nome: 'Camila Duarte', email: 'camila.duarte@escola.com.br', perfil: 'ORIENTADOR', telefone: null },
  { nome: 'Beatriz Lima', email: 'beatriz.lima@email.com', perfil: 'RESPONSAVEL', telefone: '+5592900000001' },
  { nome: 'Marcos Souza', email: 'marcos.souza@email.com', perfil: 'RESPONSAVEL', telefone: '+5592900000002' },
  { nome: 'Sandra Matos', email: 'sandra.matos@email.com', perfil: 'RESPONSAVEL', telefone: '+5592900000003' },
  { nome: 'Paulo Ferreira', email: 'paulo.ferreira@email.com', perfil: 'RESPONSAVEL', telefone: '+5592900000004' },
  { nome: 'Luciana Alves', email: 'luciana.alves@email.com', perfil: 'RESPONSAVEL', telefone: '+5592900000005' },
  { nome: 'Fernanda Rocha', email: 'fernanda.rocha@email.com', perfil: 'RESPONSAVEL', telefone: '+5592900000006' },
  { nome: 'Roberto Nunes', email: 'roberto.nunes@email.com', perfil: 'RESPONSAVEL', telefone: '+5592900000007' },
  { nome: 'Carla Mendes', email: 'carla.mendes@email.com', perfil: 'RESPONSAVEL', telefone: '+5592900000008' },
  { nome: 'Marta Costa', email: 'marta.costa@email.com', perfil: 'RESPONSAVEL', telefone: '+5592900000009' },
  { nome: 'Ricardo Carvalho', email: 'ricardo.carvalho@email.com', perfil: 'RESPONSAVEL', telefone: '+5592900000010' },
  { nome: 'Patrícia Santos', email: 'patricia.santos@email.com', perfil: 'RESPONSAVEL', telefone: '+5592900000011' },
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
const saida = (motivo: string, dias: number, horario = '10:30'): DadosIndicador =>
  ({ ...vazio, tipo: 'SAIDA', data: diaLetivoAntes(dias), horario, descricao: motivo });

/** N faltas em dias letivos seguidos, terminando no dia letivo de N dias atrás. */
function faltasSeguidas(n: number, aPartirDe = 1): DadosIndicador[] {
  const datas = [diaLetivoAntes(aPartirDe)];
  while (datas.length < n) {
    let d = somarDias(datas[datas.length - 1], -1);
    while ([0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay())) d = somarDias(d, -1);
    datas.push(d);
  }
  return datas.map((data) => ({ ...vazio, tipo: 'FALTA', data, justificada: false }));
}

// Datas relativas a hoje: a demonstração não "envelhece" para fora das janelas do motor.
// 19 alunos em 4 turmas, com perfis variados para o painel por turma e os grupos parecidos:
//  - Notas: Gabriel, Larissa (8º B, os dois com Equações do 1º grau baixa, como o Rafael), Mateus, Helena
//  - Faltas: Lucas, Pedro (3 dias seguidos), Júlia
//  - Notas + Faltas (correlação): Rafael, Thiago
//  - Ocorrências: Diego, Vinícius (grave), Enzo
//  - Faltas + Ocorrências (correlação): Kaio
//  - Saídas antecipadas: Sofia
//  - Sinais leves: Felipe. Sem sinais: Ana, Isabela, Marina
// Irmãos (mesmo responsável): Rafael e Vinícius; Lucas e Thiago; Pedro e Isabela; Júlia e Mateus;
// Gabriel e Sofia; Enzo e Felipe; Kaio e Marina.
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
  // --- Notas
  {
    nome: 'Gabriel Nunes', turma: '8º ano B', responsavel: 'roberto.nunes@email.com',
    indicadores: () => [
      nota('Matemática', 'Equações do 1º grau', 5.0, '3º bimestre', 9), nota('Ciências', 'Sistema solar', 5.5, '3º bimestre', 12),
      nota('Português', 'Concordância verbal', 7.2, '3º bimestre', 11),
    ],
  },
  {
    nome: 'Larissa Mendes', turma: '8º ano B', responsavel: 'carla.mendes@email.com',
    indicadores: () => [
      nota('Matemática', 'Frações', 6.8, '2º bimestre', 70), nota('Matemática', 'Equações do 1º grau', 4.5, '3º bimestre', 9),
      nota('História', 'Brasil Império', 8.0, '3º bimestre', 14),
    ],
  },
  {
    nome: 'Mateus Rocha', turma: '7º ano A', responsavel: 'fernanda.rocha@email.com',
    indicadores: () => [nota('Português', 'Concordância verbal', 3.8, '3º bimestre', 8), nota('Matemática', 'Números inteiros', 6.5, '3º bimestre', 15)],
  },
  {
    nome: 'Helena Costa', turma: '6º ano A', responsavel: 'marta.costa@email.com',
    indicadores: () => [nota('Matemática', 'Frações', 5.5, '3º bimestre', 10), nota('Português', 'Interpretação de texto', 5.0, '3º bimestre', 12)],
  },
  // --- Faltas
  {
    nome: 'Lucas Ferreira', turma: '6º ano A', responsavel: 'paulo.ferreira@email.com',
    indicadores: () => [falta(22), falta(15), falta(9), falta(2), nota('Ciências', 'Água e seus estados', 7.5, '3º bimestre', 10)],
  },
  {
    nome: 'Pedro Alves', turma: '8º ano B', responsavel: 'luciana.alves@email.com',
    indicadores: () => [...faltasSeguidas(3, 2), nota('Geografia', 'Clima do Brasil', 7.0, '3º bimestre', 12)],
  },
  {
    nome: 'Júlia Rocha', turma: '9º ano C', responsavel: 'fernanda.rocha@email.com',
    indicadores: () => [falta(18), falta(11), falta(4), falta(25, true, 'Consulta médica')],
  },
  // --- Notas + Faltas (correlação)
  {
    nome: 'Thiago Ferreira', turma: '9º ano C', responsavel: 'paulo.ferreira@email.com',
    indicadores: () => [
      nota('Matemática', 'Funções do 1º grau', 5.0, '3º bimestre', 10), nota('História', 'Brasil Império', 5.5, '3º bimestre', 13),
      falta(19), falta(12), falta(5),
    ],
  },
  // --- Ocorrências
  {
    nome: 'Vinícius Costa Lima', turma: '7º ano A', responsavel: 'beatriz.lima@email.com',
    indicadores: () => [ocorrencia('Agressão física a colega no intervalo', 'grave', 6), nota('Matemática', 'Números inteiros', 7.0, '3º bimestre', 10)],
  },
  {
    nome: 'Enzo Carvalho', turma: '6º ano A', responsavel: 'ricardo.carvalho@email.com',
    indicadores: () => [ocorrencia('Uso de celular durante a aula', 'leve', 4), ocorrencia('Conversa excessiva após advertência', 'leve', 11)],
  },
  // --- Faltas + Ocorrências (correlação)
  {
    nome: 'Kaio Santos', turma: '9º ano C', responsavel: 'patricia.santos@email.com',
    indicadores: () => [falta(21), falta(14), falta(7), ocorrencia('Desrespeito ao professor', 'moderada', 5)],
  },
  // --- Saídas antecipadas
  {
    nome: 'Sofia Nunes', turma: '7º ano A', responsavel: 'roberto.nunes@email.com',
    indicadores: () => [saida('Dor de cabeça', 3), saida('Consulta odontológica', 8, '09:40'), saida('Mal-estar', 15), saida('Compromisso familiar', 20, '11:00')],
  },
  // --- Sinais leves e sem sinais
  {
    nome: 'Felipe Carvalho', turma: '9º ano C', responsavel: 'ricardo.carvalho@email.com',
    indicadores: () => [falta(6), nota('Português', 'Gêneros textuais', 7.8, '3º bimestre', 10)],
  },
  {
    nome: 'Isabela Alves', turma: '6º ano A', responsavel: 'luciana.alves@email.com',
    indicadores: () => [nota('Matemática', 'Frações', 9.0, '3º bimestre', 10), nota('Português', 'Interpretação de texto', 8.5, '3º bimestre', 12)],
  },
  {
    nome: 'Marina Santos', turma: '8º ano B', responsavel: 'patricia.santos@email.com',
    indicadores: () => [nota('Matemática', 'Equações do 1º grau', 8.2, '3º bimestre', 9), nota('Ciências', 'Sistema solar', 9.1, '3º bimestre', 12)],
  },
];

/**
 * Contatos reais para a demonstração ao vivo (e-mail e WhatsApp chegando de verdade).
 * Ficam em api/contatos-demo.local.json, que o git ignora: dado real nunca vai para o repositório (LGPD).
 * Nunca é usado nos testes automáticos.
 *  - cenario "nota":  filho com Matemática 5,0; uma nota vermelha em OUTRA disciplina leva a risco alto.
 *  - cenario "falta": filho com 4 faltas sem justificativa; mais uma falta leva a risco alto.
 */
interface ContatoDemo {
  nome: string; email: string; telefone: string;
  filho: { nome: string; turma: string; cenario: 'nota' | 'falta' };
}

function contatosReaisDaDemo(): ContatoDemo[] {
  if (process.env.NODE_ENV === 'test') return [];
  const arquivo = path.resolve(__dirname, '../../contatos-demo.local.json');
  if (!fs.existsSync(arquivo)) return [];
  return (JSON.parse(fs.readFileSync(arquivo, 'utf8')).responsaveis ?? []) as ContatoDemo[];
}

const INDICADORES_DO_CENARIO: Record<ContatoDemo['filho']['cenario'], () => DadosIndicador[]> = {
  nota: () => [nota('Matemática', 'Equações do 1º grau', 5.0, '3º bimestre', 9), nota('Ciências', 'Sistema solar', 7.5, '3º bimestre', 12)],
  falta: () => [falta(22), falta(15), falta(9), falta(2)],
};

export async function rodarSeed(pool: Pool) {
  const hash = await bcrypt.hash(SENHA_PADRAO_SEED, 10);
  const ids: Record<string, string> = {};

  for (const u of USUARIOS_SEED) {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil, telefone) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome, telefone = EXCLUDED.telefone
       RETURNING id`,
      [u.nome, u.email, hash, u.perfil, u.telefone],
    );
    ids[u.email] = rows[0].id;
  }

  // Responsáveis com contato real (só na demonstração local, se o arquivo existir)
  const alunosDaDemo = [...ALUNOS_SEED];
  for (const c of contatosReaisDaDemo()) {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil, telefone) VALUES ($1, $2, $3, 'RESPONSAVEL', $4)
       ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome, telefone = EXCLUDED.telefone
       RETURNING id`,
      [c.nome, c.email.toLowerCase(), hash, c.telefone],
    );
    ids[c.email.toLowerCase()] = rows[0].id;
    alunosDaDemo.push({ nome: c.filho.nome, turma: c.filho.turma, responsavel: c.email.toLowerCase(), indicadores: INDICADORES_DO_CENARIO[c.filho.cenario] });
  }

  const orientadorId = ids['camila.duarte@escola.com.br'];
  for (const a of alunosDaDemo) {
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
