import request from 'supertest';
import { app } from '../../src/app';
import { pool } from '../../src/config/db';
import { rodarMigrations } from '../../src/database/migrator';
import { rodarSeed, SENHA_PADRAO_SEED } from '../../src/database/seed';
import { hojeIso, somarDias } from '../../src/motor/datas';

// Fluxo completo da API contra o banco de teste: cadastro, indicadores, motor, alertas,
// plano, Observer (notificações), feedback e controle de acesso.

const tokens: Record<string, string> = {};
const ORIENTADORA = 'camila.duarte@escola.com.br';
const BEATRIZ = 'beatriz.lima@email.com';  // responsável do Rafael
const MARCOS = 'marcos.souza@email.com';   // responsável da Ana

async function login(email: string) {
  const res = await request(app).post('/auth/login').send({ email, senha: SENHA_PADRAO_SEED });
  return res.body.token as string;
}
const como = (email: string) => ({ Authorization: `Bearer ${tokens[email]}` });

/** Dia letivo N dias antes de hoje (recua no fim de semana). */
function diaLetivoAntes(dias: number) {
  let d = somarDias(hojeIso(), -dias);
  while ([0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay())) d = somarDias(d, -1);
  return d;
}

let rafaelId: string;
let anaId: string;
let novoAlunoId: string;
let beatrizId: string;

beforeAll(async () => {
  await rodarMigrations(pool, { reset: true, log: false });
  await rodarSeed(pool);
  for (const e of [ORIENTADORA, BEATRIZ, MARCOS]) tokens[e] = await login(e);

  const { rows } = await pool.query<{ id: string; nome: string }>('SELECT id, nome FROM alunos');
  rafaelId = rows.find((r) => r.nome.startsWith('Rafael'))!.id;
  anaId = rows.find((r) => r.nome.startsWith('Ana'))!.id;
  beatrizId = (await pool.query('SELECT id FROM usuarios WHERE email = $1', [BEATRIZ])).rows[0].id;
});

afterAll(async () => {
  await pool.end();
});

describe('Seed avaliado pelo motor', () => {
  it('o orientador vê os 18 alunos com o risco calculado (Rafael alto, Diego moderado, Ana baixo)', async () => {
    const res = await request(app).get('/alunos').set(como(ORIENTADORA));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(18);
    const nivel = Object.fromEntries(res.body.map((a: { nome: string; risco: { nivel: string } }) => [a.nome.split(' ')[0], a.risco.nivel]));
    expect(nivel).toMatchObject({ Ana: 'BAIXO', Diego: 'MODERADO', Rafael: 'ALTO' });
  });

  it('o detalhe do Rafael explica o risco (sinais, evidências, plano com sugestões)', async () => {
    const res = await request(app).get(`/alunos/${rafaelId}`).set(como(BEATRIZ));
    expect(res.status).toBe(200);
    expect(res.body.risco).toMatchObject({ nivel: 'ALTO', causaRaiz: 'NOTAS', correlacao: true });
    expect(res.body.risco.sinais.map((s: { regra: string }) => s.regra)).toEqual(expect.arrayContaining(['RegraNotas', 'RegraFaltas']));
    expect(res.body.planoAtual.sugestoes.length).toBeGreaterThanOrEqual(3);
    expect(res.body.indicadores.length).toBe(8);
  });

  it('o plano do Rafael diz o que reforçar (disciplina + assunto) e como ensinar', async () => {
    const res = await request(app).get(`/alunos/${rafaelId}`).set(como(BEATRIZ));
    const reforcos = res.body.planoAtual.reforcos;
    expect(reforcos.map((r: { disciplina: string; assunto: string }) => `${r.disciplina}/${r.assunto}`))
      .toEqual(['Matemática/Equações do 1º grau', 'Português/Concordância verbal']); // pior nota primeiro
    expect(reforcos[0].resumo).toBe('Reforçar Equações do 1º grau em Matemática (caiu de 7,0 para 5,2 no 3º bimestre).');
    expect(reforcos[0].ensino.join(' ')).toMatch(/exemplos resolvidos passo a passo/);   // matriz de Matemática
    expect(reforcos[1].ensino.join(' ')).toMatch(/leitura guiada/);                     // matriz de Linguagens
    expect(reforcos[0].familia[0]).toMatch(/^Em casa:/);
    expect(res.body.reforcosAtuais.map((r: { assunto: string }) => r.assunto)).toEqual(['Equações do 1º grau', 'Concordância verbal']);
  });

  it('com risco baixo não há plano, mas a escola já vê o que reforçar', async () => {
    const res = await request(app).get(`/alunos/${anaId}`).set(como(ORIENTADORA));
    expect(res.body.risco.nivel).toBe('BAIXO');
    expect(res.body.planoAtual).toBeNull();
    expect(res.body.reforcosAtuais).toEqual([]); // Ana só tem 8,4 em Ciências
  });
});

describe('IT01 - POST /alunos', () => {
  it('cria aluno vinculado a um responsável e persiste no banco', async () => {
    const res = await request(app).post('/alunos').set(como(ORIENTADORA))
      .send({ nome: 'Lucas Teste Integração', turma: '6º ano A', responsavelId: beatrizId });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ nome: 'Lucas Teste Integração', turma: '6º ano A', responsavel: { id: beatrizId, nome: 'Beatriz Lima' } });
    novoAlunoId = res.body.id;

    const { rows } = await pool.query('SELECT responsavel_id FROM alunos WHERE id = $1', [novoAlunoId]);
    expect(rows[0].responsavel_id).toBe(beatrizId);
  });

  it('dados obrigatórios faltando -> 400 com o campo', async () => {
    const res = await request(app).post('/alunos').set(como(ORIENTADORA)).send({ nome: 'Lucas' });
    expect(res.status).toBe(400);
    expect(res.body.detalhes.map((d: { campo: string }) => d.campo)).toContain('turma');
  });

  it('responsável não pode cadastrar aluno -> 403', async () => {
    const res = await request(app).post('/alunos').set(como(BEATRIZ)).send({ nome: 'Fulano de Tal', turma: '6º A' });
    expect(res.status).toBe(403);
  });
});

describe('IT02 - POST nota + GET /alunos/:id/indicadores?tipo=NOTA', () => {
  it('nota registrada é recuperada com os mesmos valores', async () => {
    const post = await request(app).post(`/alunos/${novoAlunoId}/indicadores`).set(como(ORIENTADORA))
      .send({ tipo: 'NOTA', disciplina: 'Geografia', assunto: 'Relevo brasileiro', valor: 7.3, periodo: '3º bimestre' });
    expect(post.status).toBe(201);

    const get = await request(app).get(`/alunos/${novoAlunoId}/indicadores?tipo=NOTA`).set(como(ORIENTADORA));
    expect(get.status).toBe(200);
    expect(get.body).toHaveLength(1);
    expect(get.body[0]).toMatchObject({ tipo: 'NOTA', disciplina: 'Geografia', assunto: 'Relevo brasileiro', valor: 7.3, periodo: '3º bimestre' });
  });

  it('nota sem o assunto avaliado -> 400', async () => {
    const res = await request(app).post(`/alunos/${novoAlunoId}/indicadores`).set(como(ORIENTADORA))
      .send({ tipo: 'NOTA', disciplina: 'Geografia', valor: 7, periodo: '3º bimestre' });
    expect(res.status).toBe(400);
    expect(res.body.erro).toBe('Informe o assunto avaliado.');
  });

  it('nota fora da faixa ou data no futuro -> 400', async () => {
    const r1 = await request(app).post(`/alunos/${novoAlunoId}/indicadores`).set(como(ORIENTADORA)).send({ tipo: 'NOTA', disciplina: 'Artes', valor: 11 });
    expect(r1.status).toBe(400);
    const r2 = await request(app).post(`/alunos/${novoAlunoId}/indicadores`).set(como(ORIENTADORA)).send({ tipo: 'FALTA', data: somarDias(hojeIso(), 3) });
    expect(r2.status).toBe(400);
    expect(r2.body.erro).toMatch(/futuro/);
  });
});

describe('IT05 - Faltas recorrentes disparam alerta persistido', () => {
  const registrarFalta = (dias: number) =>
    request(app).post(`/alunos/${novoAlunoId}/indicadores`).set(como(ORIENTADORA)).send({ tipo: 'FALTA', data: diaLetivoAntes(dias), justificada: false });

  it('1ª e 2ª faltas: risco baixo, nenhum alerta', async () => {
    for (const d of [25, 19]) {
      const res = await registrarFalta(d);
      expect(res.status).toBe(201);
      expect(res.body.alertaGerado).toBeNull();
    }
  });

  it('3ª falta ultrapassa o limite: alerta MODERADO gravado pela RegraFaltas, com plano', async () => {
    const res = await registrarFalta(13);
    expect(res.body.risco.nivel).toBe('MODERADO');
    expect(res.body.alertaGerado).toMatchObject({ nivel: 'MODERADO', causaRaiz: 'FALTAS', regraOrigem: 'RegraFaltas' });

    const { rows } = await pool.query('SELECT a.nivel, count(s.id)::int AS sugestoes FROM alertas a JOIN planos_acao p ON p.alerta_id = a.id JOIN sugestoes s ON s.plano_id = p.id WHERE a.aluno_id = $1 GROUP BY a.id', [novoAlunoId]);
    expect(rows).toEqual([{ nivel: 'MODERADO', sugestoes: 2 }]);
  });

  it('4ª falta: mesmo nível, não repete o alerta', async () => {
    const res = await registrarFalta(7);
    expect(res.body.risco.nivel).toBe('MODERADO');
    expect(res.body.alertaGerado).toBeNull();
  });

  it('5ª falta: sobe para ALTO e gera novo alerta', async () => {
    const res = await registrarFalta(1);
    expect(res.body.alertaGerado).toMatchObject({ nivel: 'ALTO', causaRaiz: 'FALTAS' });
  });

  it('Observer: responsável e orientadora foram notificados', async () => {
    const familia = await request(app).get('/notificacoes').set(como(BEATRIZ));
    expect(familia.body.map((n: { mensagem: string }) => n.mensagem).join('\n')).toMatch(/Lucas está com risco alto/);

    const escola = await request(app).get('/notificacoes').set(como(ORIENTADORA));
    expect(escola.body.map((n: { mensagem: string }) => n.mensagem).join('\n')).toMatch(/Lucas Teste Integração .* passou para risco alto/);
  });
});

describe('IT06 - GET /alertas/:alunoId', () => {
  it('retorna a evolução do risco em ordem cronológica, com o plano de cada alerta', async () => {
    const res = await request(app).get(`/alertas/${novoAlunoId}`).set(como(BEATRIZ));
    expect(res.status).toBe(200);
    expect(res.body.map((a: { nivel: string }) => a.nivel)).toEqual(['MODERADO', 'ALTO']);
    const datas = res.body.map((a: { criadoEm: string }) => a.criadoEm);
    expect([...datas].sort()).toEqual(datas);
    expect(res.body[1].sugestoes.at(-1).texto).toMatch(/até 7 dias/);
  });
});

describe('IT07 - POST /alertas/:id/feedback', () => {
  it('registra o feedback do responsável e avisa a escola', async () => {
    const { body: alertas } = await request(app).get(`/alertas/${novoAlunoId}`).set(como(BEATRIZ));
    const ultimo = alertas.at(-1);

    const res = await request(app).post(`/alertas/${ultimo.id}/feedback`).set(como(BEATRIZ))
      .send({ status: 'em_andamento', observacao: 'Conversamos em casa sobre a rotina.' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'em_andamento', alertaId: ultimo.id });

    const detalhe = await request(app).get(`/alunos/${novoAlunoId}`).set(como(BEATRIZ));
    expect(detalhe.body.feedbacks).toHaveLength(1);

    const escola = await request(app).get('/notificacoes').set(como(ORIENTADORA));
    expect(escola.body[0].mensagem).toMatch(/Beatriz Lima marcou o plano de Lucas Teste Integração como "em andamento"/);
  });

  it('status inválido -> 400; orientador não registra feedback -> 403', async () => {
    const { body: alertas } = await request(app).get(`/alertas/${novoAlunoId}`).set(como(BEATRIZ));
    expect((await request(app).post(`/alertas/${alertas[0].id}/feedback`).set(como(BEATRIZ)).send({ status: 'talvez' })).status).toBe(400);
    expect((await request(app).post(`/alertas/${alertas[0].id}/feedback`).set(como(ORIENTADORA)).send({ status: 'resolvido' })).status).toBe(403);
  });
});

describe('Editar e excluir indicadores reavalia o risco', () => {
  it('justificar e excluir faltas faz o risco voltar para baixo e avisa a família', async () => {
    const { body: faltas } = await request(app).get(`/alunos/${novoAlunoId}/indicadores?tipo=FALTA`).set(como(ORIENTADORA));

    const editada = await request(app).patch(`/indicadores/${faltas[0].id}`).set(como(ORIENTADORA))
      .send({ tipo: 'FALTA', data: faltas[0].data, justificada: true, descricao: 'Atestado' });
    expect(editada.status).toBe(200);
    expect(editada.body.risco.nivel).toBe('MODERADO'); // 4 não justificadas

    for (const f of faltas.slice(1, 4)) {
      expect((await request(app).delete(`/indicadores/${f.id}`).set(como(ORIENTADORA))).status).toBe(200);
    }
    const detalhe = await request(app).get(`/alunos/${novoAlunoId}`).set(como(BEATRIZ));
    expect(detalhe.body.risco.nivel).toBe('BAIXO');
    expect(detalhe.body.planoAtual).toBeNull();
    expect(detalhe.body.evolucao.map((a: { nivel: string }) => a.nivel)).toEqual(['MODERADO', 'ALTO', 'MODERADO', 'BAIXO']);

    const familia = await request(app).get('/notificacoes').set(como(BEATRIZ));
    expect(familia.body[0].mensagem).toMatch(/Boa notícia/);
  });

  it('não permite trocar o tipo de um indicador', async () => {
    const { body: notas } = await request(app).get(`/alunos/${novoAlunoId}/indicadores?tipo=NOTA`).set(como(ORIENTADORA));
    const res = await request(app).patch(`/indicadores/${notas[0].id}`).set(como(ORIENTADORA)).send({ tipo: 'FALTA', data: hojeIso() });
    expect(res.status).toBe(400);
  });
});

describe('ST04 - Controle de acesso entre contas (LGPD)', () => {
  it('responsável só lista os próprios filhos', async () => {
    const res = await request(app).get('/alunos').set(como(MARCOS));
    expect(res.body.map((a: { id: string }) => a.id)).toEqual([anaId]);
  });

  it('responsável não vê aluno de outra conta: detalhe, indicadores e alertas -> 404', async () => {
    for (const rota of [`/alunos/${rafaelId}`, `/alunos/${rafaelId}/indicadores`, `/alertas/${rafaelId}`]) {
      const res = await request(app).get(rota).set(como(MARCOS));
      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).not.toContain('Rafael');
    }
  });

  it('responsável não registra feedback em alerta de outra família -> 404', async () => {
    const { rows } = await pool.query('SELECT id FROM alertas WHERE aluno_id = $1 LIMIT 1', [rafaelId]);
    const res = await request(app).post(`/alertas/${rows[0].id}/feedback`).set(como(MARCOS)).send({ status: 'resolvido' });
    expect(res.status).toBe(404);
  });

  it('responsável não registra indicadores -> 403', async () => {
    const res = await request(app).post(`/alunos/${anaId}/indicadores`).set(como(MARCOS)).send({ tipo: 'NOTA', disciplina: 'Artes', valor: 10 });
    expect(res.status).toBe(403);
  });

  it('id malformado responde 404, não erro interno', async () => {
    expect((await request(app).get('/alunos/nao-e-uuid').set(como(ORIENTADORA))).status).toBe(404);
    expect((await request(app).delete('/indicadores/123').set(como(ORIENTADORA))).status).toBe(404);
  });

  it('sem token -> 401', async () => {
    expect((await request(app).get('/alunos')).status).toBe(401);
  });
});
