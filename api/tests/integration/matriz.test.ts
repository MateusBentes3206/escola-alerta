import request from 'supertest';
import { app } from '../../src/app';
import { pool } from '../../src/config/db';
import { rodarMigrations } from '../../src/database/migrator';
import { rodarSeed, SENHA_PADRAO_SEED } from '../../src/database/seed';
import { MATRIZ_DE_SUGESTOES } from '../../src/motor/GeradorDePlanoDeAcao';
import { hojeIso, somarDias } from '../../src/motor/datas';

// Matriz de sugestões editável pela escola: vale para planos novos, não muda os antigos.

const tokens: Record<string, string> = {};
const ORIENTADORA = 'camila.duarte@escola.com.br';
const BEATRIZ = 'beatriz.lima@email.com';
const como = (email: string) => ({ Authorization: `Bearer ${tokens[email]}` });

const MINHA_ACAO = 'Ligar para a família no mesmo dia da terceira falta e combinar um bilhete de presença diário.';
const matrizEditada = { ...MATRIZ_DE_SUGESTOES, FALTAS: [MINHA_ACAO, 'Acionar a busca ativa escolar da secretaria municipal.'] };

function diaLetivoAntes(dias: number) {
  let d = somarDias(hojeIso(), -dias);
  while ([0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay())) d = somarDias(d, -1);
  return d;
}

beforeAll(async () => {
  await rodarMigrations(pool, { reset: true, log: false });
  await rodarSeed(pool);
  for (const email of [ORIENTADORA, BEATRIZ]) {
    tokens[email] = (await request(app).post('/auth/login').send({ email, senha: SENHA_PADRAO_SEED })).body.token;
  }
});

afterAll(async () => {
  await pool.end();
});

describe('Matriz de sugestões editável', () => {
  it('começa com a matriz padrão', async () => {
    const res = await request(app).get('/matriz').set(como(ORIENTADORA));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ personalizada: false, matriz: MATRIZ_DE_SUGESTOES });
  });

  it('só o orientador acessa', async () => {
    expect((await request(app).get('/matriz').set(como(BEATRIZ))).status).toBe(403);
    expect((await request(app).put('/matriz').set(como(BEATRIZ)).send(matrizEditada)).status).toBe(403);
  });

  it('valida: causa sem sugestão, texto curto ou repetido -> 400', async () => {
    const vazia = await request(app).put('/matriz').set(como(ORIENTADORA)).send({ ...MATRIZ_DE_SUGESTOES, NOTAS: [] });
    expect(vazia.body.erro).toBe('Mantenha pelo menos uma sugestão em Notas.');
    const curta = await request(app).put('/matriz').set(como(ORIENTADORA)).send({ ...MATRIZ_DE_SUGESTOES, SAIDAS: ['ok'] });
    expect(curta.body.erro).toBe('Cada sugestão precisa ter pelo menos 5 caracteres.');
    const repetida = await request(app).put('/matriz').set(como(ORIENTADORA)).send({ ...MATRIZ_DE_SUGESTOES, FALTAS: [MINHA_ACAO, MINHA_ACAO] });
    expect(repetida.body.erro).toBe('Há sugestões repetidas em Frequência.');
  });

  it('salva a matriz da escola', async () => {
    const res = await request(app).put('/matriz').set(como(ORIENTADORA)).send(matrizEditada);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ personalizada: true, matriz: { FALTAS: matrizEditada.FALTAS } });
  });

  it('planos novos usam a matriz da escola; o plano antigo do Rafael não muda', async () => {
    const rafael = (await pool.query("SELECT id FROM alunos WHERE nome LIKE 'Rafael%'")).rows[0].id;
    const antes = (await request(app).get(`/alunos/${rafael}`).set(como(ORIENTADORA))).body.planoAtual.sugestoes;

    const ana = (await pool.query("SELECT id FROM alunos WHERE nome LIKE 'Ana%'")).rows[0].id;
    for (const d of [20, 12, 4]) {
      await request(app).post(`/alunos/${ana}/indicadores`).set(como(ORIENTADORA)).send({ tipo: 'FALTA', data: diaLetivoAntes(d) });
    }
    const plano = (await request(app).get(`/alunos/${ana}`).set(como(ORIENTADORA))).body.planoAtual;
    expect(plano.causaRaiz).toBe('FALTAS');
    expect(plano.sugestoes.map((s: { texto: string }) => s.texto)).toEqual(matrizEditada.FALTAS);

    const depois = (await request(app).get(`/alunos/${rafael}`).set(como(ORIENTADORA))).body.planoAtual.sugestoes;
    expect(depois).toEqual(antes); // histórico preservado
  });

  it('restaurar volta para a matriz padrão', async () => {
    const res = await request(app).delete('/matriz').set(como(ORIENTADORA));
    expect(res.body).toMatchObject({ personalizada: false, matriz: MATRIZ_DE_SUGESTOES });
  });
});
