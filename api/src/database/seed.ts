import bcrypt from 'bcryptjs';
import { Pool } from 'pg';

// Dados 100% fictícios (RNF02 / LGPD). Os mesmos nomes do protótipo React,
// para a demonstração continuar coerente depois da integração.
export const SENHA_PADRAO_SEED = 'senha123';

export const USUARIOS_SEED = [
  { nome: 'Camila Duarte', email: 'camila.duarte@escola.com.br', perfil: 'ORIENTADOR' },
  { nome: 'Beatriz Lima', email: 'beatriz.lima@email.com', perfil: 'RESPONSAVEL' },
  { nome: 'Marcos Souza', email: 'marcos.souza@email.com', perfil: 'RESPONSAVEL' },
  { nome: 'Sandra Matos', email: 'sandra.matos@email.com', perfil: 'RESPONSAVEL' },
] as const;

const ALUNOS_SEED = [
  { nome: 'Rafael Costa Lima', turma: '8º ano B', responsavel: 'beatriz.lima@email.com' },
  { nome: 'Ana Beatriz Souza', turma: '7º ano A', responsavel: 'marcos.souza@email.com' },
  { nome: 'Diego Matos Pereira', turma: '9º ano C', responsavel: 'sandra.matos@email.com' },
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
    await pool.query(
      `INSERT INTO alunos (nome, turma, orientador_id, responsavel_id)
       SELECT $1::varchar, $2::varchar, $3::uuid, $4::uuid
       WHERE NOT EXISTS (SELECT 1 FROM alunos WHERE nome = $1::varchar)`,
      [a.nome, a.turma, orientadorId, ids[a.responsavel]],
    );
  }
}
