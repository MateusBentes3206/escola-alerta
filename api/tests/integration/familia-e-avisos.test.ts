import request from 'supertest';
import { app } from '../../src/app';
import { pool } from '../../src/config/db';
import { rodarMigrations } from '../../src/database/migrator';
import { rodarSeed, SENHA_PADRAO_SEED } from '../../src/database/seed';
import { hojeIso, somarDias } from '../../src/motor/datas';

// Aviso de risco alto por WhatsApp e e-mail, e cadastro do responsável com os filhos.

const tokens: Record<string, string> = {};
const ORIENTADORA = 'camila.duarte@escola.com.br';
const como = (email: string) => ({ Authorization: `Bearer ${tokens[email]}` });
const entrar = async (email: string, senha = SENHA_PADRAO_SEED) => {
  tokens[email] = (await request(app).post('/auth/login').send({ email, senha })).body.token;
};
const id = async (nome: string) => (await pool.query('SELECT id FROM alunos WHERE nome LIKE $1', [`${nome}%`])).rows[0].id;
const mensagens = (alunoId: string) => pool.query('SELECT canal, destino, status, conteudo FROM mensagens_externas WHERE aluno_id = $1 ORDER BY canal', [alunoId]);

function diaLetivoAntes(dias: number) {
  let d = somarDias(hojeIso(), -dias);
  while ([0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay())) d = somarDias(d, -1);
  return d;
}

beforeAll(async () => {
  await rodarMigrations(pool, { reset: true, log: false });
  await rodarSeed(pool);
  await entrar(ORIENTADORA);
  await entrar('beatriz.lima@email.com');
});

afterAll(async () => {
  await pool.end();
});

describe('Aviso externo quando o aluno entra em risco alto', () => {
  it('o risco alto do Rafael gerou WhatsApp e e-mail para a mãe (simulados no ambiente de teste)', async () => {
    const { rows } = await mensagens(await id('Rafael'));
    expect(rows.map((r) => [r.canal, r.destino, r.status])).toEqual([
      ['EMAIL', 'beatriz.lima@email.com', 'SIMULADA'],
      ['WHATSAPP', '+5592900000001', 'SIMULADA'],
    ]);
    expect(rows[0].conteudo).toMatch(/Rafael \(8º ano B\) está com risco ALTO/);
    expect(rows[0].conteudo).not.toMatch(/5,2|Matemática/); // LGPD: sem notas na mensagem externa
  });

  it('risco moderado não manda aviso externo', async () => {
    expect((await mensagens(await id('Diego'))).rows).toEqual([]);
  });

  it('quando um aluno PASSA para alto, a família é avisada uma vez; continuar alto não repete', async () => {
    const lucas = await id('Lucas'); // 4 faltas: moderado
    expect((await mensagens(lucas)).rows).toEqual([]);
    await request(app).post(`/alunos/${lucas}/indicadores`).set(como(ORIENTADORA)).send({ tipo: 'FALTA', data: diaLetivoAntes(12) });
    expect((await mensagens(lucas)).rows.map((r) => r.canal)).toEqual(['EMAIL', 'WHATSAPP']);

    await request(app).post(`/alunos/${lucas}/indicadores`).set(como(ORIENTADORA)).send({ tipo: 'FALTA', data: diaLetivoAntes(16) });
    expect((await mensagens(lucas)).rows).toHaveLength(2);
  });

  it('responsável sem celular cadastrado: o WhatsApp fica registrado como SEM_CONTATO', async () => {
    await pool.query("UPDATE usuarios SET telefone = NULL WHERE email = 'fernanda.rocha@email.com'");
    const julia = await id('Júlia'); // 3 faltas: moderado
    for (const d of [8, 15]) await request(app).post(`/alunos/${julia}/indicadores`).set(como(ORIENTADORA)).send({ tipo: 'FALTA', data: diaLetivoAntes(d) });
    const { rows } = await mensagens(julia);
    expect(rows.map((r) => [r.canal, r.status])).toEqual([['EMAIL', 'SIMULADA'], ['WHATSAPP', 'SEM_CONTATO']]);
  });

  it('a escola vê os avisos enviados com o contato mascarado; a família não acessa essa rota', async () => {
    const res = await request(app).get(`/alunos/${await id('Rafael')}/mensagens`).set(como(ORIENTADORA));
    expect(res.body.map((m: { destino: string }) => m.destino).sort()).toEqual(['(92) 9****-0001', 'b***********@email.com']);
    expect((await request(app).get(`/alunos/${await id('Rafael')}/mensagens`).set(como('beatriz.lima@email.com'))).status).toBe(403);
  });
});

describe('Cadastro do responsável com os filhos', () => {
  const NOVO = 'joana.prado@email.com';
  let orientadorId: string;
  const cadastro = (extra: object = {}) => ({
    nome: 'Joana Prado', email: NOVO, senha: 'minhasenha123', telefone: '(92) 99123-4567',
    filhos: [
      { nome: 'Caio Prado', turma: '6º ano A', orientadorId },
      { nome: 'Lia Prado', turma: '8º ano B', orientadorId },
    ],
    ...extra,
  });

  beforeAll(async () => {
    const res = await request(app).get('/auth/orientadores');
    expect(res.body).toEqual([{ id: expect.any(String), nome: 'Camila Duarte' }]); // só id e nome
    orientadorId = res.body[0].id;
  });

  it('valida celular, filhos e orientador', async () => {
    const enviar = (extra: object) => request(app).post('/auth/cadastro').send(cadastro(extra));
    expect((await enviar({ telefone: '(92) 3232-1234' })).body.erro).toBe('Informe um celular com DDD, por exemplo (92) 99123-4567.');
    expect((await enviar({ filhos: [] })).body.erro).toBe('Cadastre pelo menos um filho.');
    expect((await enviar({ senha: '123' })).body.erro).toBe('A senha precisa ter pelo menos 8 caracteres.');
    const outro = '00000000-0000-4000-8000-000000000000';
    expect((await enviar({ filhos: [{ nome: 'Caio Prado', turma: '6º A', orientadorId: outro }] })).body.erro).toBe('Escolha um orientador escolar da lista.');
  });

  it('cria a conta e os filhos de uma vez, já entra logado e os filhos aguardam confirmação', async () => {
    const res = await request(app).post('/auth/cadastro').send(cadastro());
    expect(res.status).toBe(201);
    expect(res.body.usuario).toMatchObject({ nome: 'Joana Prado', perfil: 'RESPONSAVEL', telefone: '+5592991234567' });
    tokens[NOVO] = res.body.token;

    const filhos = (await request(app).get('/alunos').set(como(NOVO))).body;
    expect(filhos.map((f: { nome: string; vinculoConfirmado: boolean }) => [f.nome, f.vinculoConfirmado])).toEqual([['Caio Prado', false], ['Lia Prado', false]]);

    await entrar(NOVO, 'minhasenha123');
    expect(tokens[NOVO]).toBeTruthy(); // login normal funciona com a senha criada
  });

  it('antes da confirmação a família não vê dados da escola, mesmo que a escola já tenha registrado algo', async () => {
    const caio = await id('Caio');
    await request(app).post(`/alunos/${caio}/indicadores`).set(como(ORIENTADORA)).send({ tipo: 'OCORRENCIA', descricao: 'Briga no recreio', gravidade: 'grave' });
    const det = (await request(app).get(`/alunos/${caio}`).set(como(NOVO))).body;
    expect(det).toMatchObject({ nome: 'Caio Prado', vinculoConfirmado: false, indicadores: [], planoAtual: null });
    expect(det.risco.nivel).toBe('BAIXO');
    expect((await request(app).get(`/alertas/${caio}`).set(como(NOVO))).status).toBe(404);
    expect((await mensagens(caio)).rows).toEqual([]); // nem WhatsApp, nem e-mail
    const avisos = (await request(app).get('/notificacoes').set(como(NOVO))).body.map((n: { mensagem: string }) => n.mensagem).join('\n');
    expect(avisos).not.toMatch(/Caio está com risco/);
    // a escola vê normalmente
    expect((await request(app).get(`/alunos/${caio}`).set(como(ORIENTADORA))).body.risco.nivel).toBe('ALTO');
  });

  it('e-mail já usado -> 409', async () => {
    expect((await request(app).post('/auth/cadastro').send(cadastro())).status).toBe(409);
  });

  it('a orientadora é avisada, confirma um filho e recusa o outro', async () => {
    const avisos = (await request(app).get('/notificacoes').set(como(ORIENTADORA))).body.map((n: { mensagem: string }) => n.mensagem).join('\n');
    expect(avisos).toMatch(/Joana Prado cadastrou Caio Prado \(6º ano A\) como filho\(a\)/);

    const caio = await id('Caio');
    const lia = await id('Lia');
    expect((await request(app).patch(`/alunos/${caio}/vinculo`).set(como(NOVO)).send({ confirmar: true })).status).toBe(403);
    expect((await request(app).patch(`/alunos/${caio}/vinculo`).set(como(ORIENTADORA)).send({ confirmar: true })).body).toEqual({ confirmado: true });
    expect((await request(app).patch(`/alunos/${caio}/vinculo`).set(como(ORIENTADORA)).send({ confirmar: true })).status).toBe(409);
    expect((await request(app).patch(`/alunos/${lia}/vinculo`).set(como(ORIENTADORA)).send({ confirmar: false })).status).toBe(200);

    const filhos = (await request(app).get('/alunos').set(como(NOVO))).body;
    expect(filhos.map((f: { nome: string; vinculoConfirmado: boolean }) => [f.nome, f.vinculoConfirmado])).toEqual([['Caio Prado', true]]);
    const avisosFamilia = (await request(app).get('/notificacoes').set(como(NOVO))).body.map((n: { mensagem: string }) => n.mensagem).join('\n');
    expect(avisosFamilia).toMatch(/confirmou o cadastro de Caio Prado/);
    expect(avisosFamilia).toMatch(/não reconheceu Lia Prado/);
  });
});
