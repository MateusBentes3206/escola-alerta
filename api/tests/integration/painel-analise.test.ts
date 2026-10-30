import request from 'supertest';
import { app } from '../../src/app';
import { pool } from '../../src/config/db';
import { rodarMigrations } from '../../src/database/migrator';
import { rodarSeed, SENHA_PADRAO_SEED } from '../../src/database/seed';
import { MATRIZ_DE_SUGESTOES } from '../../src/motor/GeradorDePlanoDeAcao';

// Painel do orientador: alunos por turma, grupos de perfil parecido e reforço em grupo.

let token: string;
let analise: any; // eslint-disable-line @typescript-eslint/no-explicit-any
const nomes = (lista: { nome: string }[]) => lista.map((a) => a.nome.split(' ')[0]).sort();
const grupo = (chave: string) => analise.grupos.find((g: { chave: string }) => g.chave === chave);

beforeAll(async () => {
  await rodarMigrations(pool, { reset: true, log: false });
  await rodarSeed(pool);
  token = (await request(app).post('/auth/login').send({ email: 'camila.duarte@escola.com.br', senha: SENHA_PADRAO_SEED })).body.token;
  analise = (await request(app).get('/painel/analise').set('Authorization', `Bearer ${token}`)).body;
});

afterAll(async () => {
  await pool.end();
});

describe('Painel de análise da turma', () => {
  it('só o orientador acessa', async () => {
    const familia = (await request(app).post('/auth/login').send({ email: 'beatriz.lima@email.com', senha: SENHA_PADRAO_SEED })).body.token;
    expect((await request(app).get('/painel/analise').set('Authorization', `Bearer ${familia}`)).status).toBe(403);
  });

  it('divide os 18 alunos por turma e por nível de risco', () => {
    expect(analise.totalAlunos).toBe(18);
    expect(analise.turmas.map((t: { turma: string }) => t.turma)).toEqual(['6º ano A', '7º ano A', '8º ano B', '9º ano C']);
    const oitavo = analise.turmas.find((t: { turma: string }) => t.turma === '8º ano B');
    expect(oitavo.niveis).toEqual({ ALTO: 3, MODERADO: 1, BAIXO: 1 });
    const soma = analise.turmas.reduce((s: number, t: { total: number }) => s + t.total, 0);
    expect(soma).toBe(18);
  });

  it('agrupa alunos de perfil parecido', () => {
    expect(nomes(grupo('NOTAS').alunos)).toEqual(['Gabriel', 'Helena', 'Larissa', 'Mateus']);
    expect(nomes(grupo('FALTAS').alunos)).toEqual(['Júlia', 'Lucas', 'Pedro']);
    expect(nomes(grupo('FALTAS+NOTAS').alunos)).toEqual(['Rafael', 'Thiago']);
    expect(nomes(grupo('OCORRENCIAS').alunos)).toEqual(['Diego', 'Enzo', 'Vinícius']);
    expect(nomes(grupo('SEM_SINAIS').alunos)).toEqual(['Ana', 'Isabela', 'Marina']);
    // grupos com risco alto vêm primeiro; "sem sinais" fica por último
    expect(analise.grupos.at(-1).chave).toBe('SEM_SINAIS');
  });

  it('mostra o que o grupo tem em comum', () => {
    expect(grupo('NOTAS').emComum).toEqual(expect.arrayContaining([
      'Matemática abaixo de 6: 3 de 4 alunos',
      'Mesmo assunto em baixa: Equações do 1º grau (Matemática), 2 alunos',
    ]));
    expect(grupo('FALTAS+NOTAS').emComum).toEqual(expect.arrayContaining([
      'Média de 3,0 faltas sem justificativa nos últimos 30 dias',
      'Todos com sinais combinados (correlação), o que elevou o risco',
    ]));
    expect(grupo('FALTAS').emComum).toContain('1 de 3 com 3 ou mais dias letivos seguidos de falta');
  });

  it('traz as ações da matriz da escola para as causas de cada grupo', () => {
    expect(grupo('FALTAS+NOTAS').acoesDaMatriz).toEqual([
      { causa: 'FALTAS', titulo: 'Frequência', sugestoes: MATRIZ_DE_SUGESTOES.FALTAS },
      { causa: 'NOTAS', titulo: 'Notas', sugestoes: MATRIZ_DE_SUGESTOES.NOTAS },
    ]);
    expect(grupo('SEM_SINAIS').acoesDaMatriz).toEqual([]);
  });

  it('acha assuntos que vários alunos precisam reforçar (pior nota primeiro)', () => {
    const equacoes = analise.reforcosEmGrupo.find((r: { assunto: string }) => r.assunto === 'Equações do 1º grau');
    expect(equacoes.alunos.map((a: { nome: string; nota: number }) => `${a.nome.split(' ')[0]} ${a.nota}`)).toEqual(['Larissa 4.5', 'Gabriel 5', 'Rafael 5.2']);
    expect(equacoes.ensino[0]).toMatch(/Equações do 1º grau/);
  });
});
