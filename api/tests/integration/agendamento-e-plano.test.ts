import request from 'supertest';
import { app } from '../../src/app';
import { pool } from '../../src/config/db';
import { rodarMigrations } from '../../src/database/migrator';
import { rodarSeed, SENHA_PADRAO_SEED } from '../../src/database/seed';
import { ehDiaUtil } from '../../src/domain/calendario';

// Status do plano de ação e agendamento de conversa família-escola, contra o banco de teste.

const tokens: Record<string, string> = {};
const ORIENTADORA = 'camila.duarte@escola.com.br';
const BEATRIZ = 'beatriz.lima@email.com';  // responsável do Rafael (risco alto no seed)
const MARCOS = 'marcos.souza@email.com';   // responsável da Ana
const como = (email: string) => ({ Authorization: `Bearer ${tokens[email]}` });

const fmt = (d: Date, hora: string) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${hora}`;

/** N-ésimo dia útil a partir de amanhã, no formato do formulário (AAAA-MM-DDTHH:MM). */
function daquiA(diasUteis: number, hora = '14:00') {
  const d = new Date();
  for (let n = 0; n < diasUteis;) {
    d.setDate(d.getDate() + 1);
    if (ehDiaUtil(fmt(d, hora))) n++;
  }
  return fmt(d, hora);
}

/** Próximo sábado (sempre no futuro). */
function proximoSabado(hora = '10:00') {
  const d = new Date();
  do d.setDate(d.getDate() + 1); while (d.getDay() !== 6);
  return fmt(d, hora);
}

const ontem = () => { const d = new Date(); d.setDate(d.getDate() - 1); return fmt(d, '14:00'); };

const mensagens = async (email: string) =>
  (await request(app).get('/notificacoes').set(como(email))).body.map((n: { mensagem: string }) => n.mensagem).join('\n');

let rafaelId: string;
let alertaRafael: string;

beforeAll(async () => {
  await rodarMigrations(pool, { reset: true, log: false });
  await rodarSeed(pool);
  for (const email of [ORIENTADORA, BEATRIZ, MARCOS]) {
    tokens[email] = (await request(app).post('/auth/login').send({ email, senha: SENHA_PADRAO_SEED })).body.token;
  }
  rafaelId = (await pool.query("SELECT id FROM alunos WHERE nome LIKE 'Rafael%'")).rows[0].id;
  alertaRafael = (await request(app).get(`/alunos/${rafaelId}`).set(como(BEATRIZ))).body.planoAtual.alertaId;
});

afterAll(async () => {
  await pool.end();
});

describe('Status do plano de ação (Aberto -> Em andamento -> Resolvido)', () => {
  it('o plano nasce ABERTO e o Rafael está na lista de atenção da escola', async () => {
    const det = await request(app).get(`/alunos/${rafaelId}`).set(como(ORIENTADORA));
    expect(det.body.planoAtual.status).toBe('ABERTO');
    const lista = await request(app).get('/alunos').set(como(ORIENTADORA));
    expect(lista.body.find((a: { id: string }) => a.id === rafaelId)).toMatchObject({ atencao: true, planoStatus: 'ABERTO' });
  });

  it('o feedback da família passa o plano para EM_ANDAMENTO e a escola vê o feedback na ficha', async () => {
    await request(app).post(`/alertas/${alertaRafael}/feedback`).set(como(BEATRIZ)).send({ status: 'resolvido', observacao: 'Ele voltou a estudar.' });
    const det = await request(app).get(`/alunos/${rafaelId}`).set(como(ORIENTADORA));
    expect(det.body.planoAtual.status).toBe('EM_ANDAMENTO'); // "resolvido" da família não fecha sozinho
    expect(det.body.feedbacks).toEqual([expect.objectContaining({ status: 'resolvido', observacao: 'Ele voltou a estudar.' })]);
  });

  it('só o orientador marca como RESOLVIDO; o aluno sai da lista de atenção e a família é avisada', async () => {
    expect((await request(app).patch(`/alertas/${alertaRafael}/plano`).set(como(BEATRIZ)).send({ status: 'RESOLVIDO' })).status).toBe(403);
    expect((await request(app).patch(`/alertas/${alertaRafael}/plano`).set(como(ORIENTADORA)).send({ status: 'FECHADO' })).status).toBe(400);

    const res = await request(app).patch(`/alertas/${alertaRafael}/plano`).set(como(ORIENTADORA)).send({ status: 'RESOLVIDO' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('RESOLVIDO');

    const lista = await request(app).get('/alunos').set(como(ORIENTADORA));
    expect(lista.body.find((a: { id: string }) => a.id === rafaelId)).toMatchObject({ atencao: false, planoStatus: 'RESOLVIDO' });
    expect(await mensagens(BEATRIZ)).toMatch(/marcou o plano de ação de Rafael como resolvido/);
  });

  it('o resumo do risco explica o motivo sem códigos de regra (RNF07)', async () => {
    const det = await request(app).get(`/alunos/${rafaelId}`).set(como(BEATRIZ));
    expect(det.body.risco.resumo).toMatch(/^Risco alto porque: Matemática 5,2 e Português 5,8 no 3º bimestre \+ 3 faltas em \d+ dias/);
    expect(det.body.risco.resumo).not.toMatch(/RN\d/);
    expect(det.body.risco.sinais.map((s: { regraNegocio: string }) => s.regraNegocio)).toContain('RN04'); // segue nos dados
  });
});

describe('Agendamento de conversa com o orientador', () => {
  let solicitacaoId: string;

  it('a família pede uma conversa com 2 horários; o orientador é avisado', async () => {
    const res = await request(app).post(`/alunos/${rafaelId}/solicitacoes`).set(como(BEATRIZ))
      .send({ motivo: 'Notas', opcoes: [daquiA(3, '15:00'), daquiA(2, '09:30')], formato: 'PRESENCIAL', observacao: 'Prefiro de manhã.' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'PENDENTE', motivo: 'Notas', formato: 'PRESENCIAL', alunoNome: 'Rafael Costa Lima', nivelRisco: 'ALTO' });
    expect(res.body.opcoes).toEqual([daquiA(2, '09:30'), daquiA(3, '15:00')]); // ordenados
    solicitacaoId = res.body.id;
    expect(await mensagens(ORIENTADORA)).toMatch(/Beatriz Lima pediu uma conversa presencial sobre Rafael Costa Lima \(motivo: Notas\)/);
  });

  it('não deixa abrir outra solicitação enquanto a primeira está em aberto -> 409', async () => {
    const res = await request(app).post(`/alunos/${rafaelId}/solicitacoes`).set(como(BEATRIZ))
      .send({ motivo: 'Notas', opcoes: [daquiA(4)], formato: 'VIDEO' });
    expect(res.status).toBe(409);
  });

  it('valida horários: no passado, repetidos ou mais de 3 -> 400', async () => {
    const enviar = (opcoes: string[]) => request(app).post(`/alunos/${rafaelId}/solicitacoes`).set(como(BEATRIZ)).send({ motivo: 'Notas', opcoes, formato: 'VIDEO' });
    expect((await enviar([ontem()])).body.erro).toBe('Escolha um horário no futuro.');
    expect((await enviar([proximoSabado()])).body.erro).toBe('Escolha um dia útil (segunda a sexta, exceto feriados nacionais).');
    expect((await enviar([daquiA(2, '19:30')])).body.erro).toBe('Escolha um horário entre 07:00 e 17:00.');
    expect((await enviar([daquiA(2), daquiA(2)])).body.erro).toBe('Os horários propostos devem ser diferentes.');
    expect((await enviar([daquiA(1), daquiA(2), daquiA(3), daquiA(4)])).status).toBe(400);
  });

  it('controle de acesso: outra família não vê nem pede conversa sobre o Rafael', async () => {
    expect((await request(app).get('/solicitacoes').set(como(MARCOS))).body).toEqual([]);
    const res = await request(app).post(`/alunos/${rafaelId}/solicitacoes`).set(como(MARCOS)).send({ motivo: 'Notas', opcoes: [daquiA(2)], formato: 'VIDEO' });
    expect(res.status).toBe(404);
    expect((await request(app).patch(`/solicitacoes/${solicitacaoId}`).set(como(MARCOS)).send({ acao: 'aceitar' })).status).toBe(404);
  });

  it('caixa do orientador: filtro "pendentes" traz a solicitação com o risco do aluno', async () => {
    const res = await request(app).get('/solicitacoes?status=pendentes').set(como(ORIENTADORA));
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: solicitacaoId, responsavelNome: 'Beatriz Lima', nivelRisco: 'ALTO' });
    expect((await request(app).get('/solicitacoes?status=confirmadas').set(como(ORIENTADORA))).body).toEqual([]);
    expect((await request(app).get('/solicitacoes?status=xyz').set(como(ORIENTADORA))).status).toBe(400);
  });

  it('confirmar exige um dos horários propostos; a família não pode confirmar', async () => {
    const r1 = await request(app).patch(`/solicitacoes/${solicitacaoId}`).set(como(ORIENTADORA)).send({ acao: 'confirmar', horario: daquiA(9) });
    expect(r1.status).toBe(400);
    const r2 = await request(app).patch(`/solicitacoes/${solicitacaoId}`).set(como(BEATRIZ)).send({ acao: 'confirmar', horario: daquiA(2, '09:30') });
    expect(r2.status).toBe(403);
  });

  it('remarcar também só aceita dia útil', async () => {
    const r = await request(app).patch(`/solicitacoes/${solicitacaoId}`).set(como(ORIENTADORA)).send({ acao: 'remarcar', horario: proximoSabado() });
    expect(r.status).toBe(400);
    expect(r.body.erro).toMatch(/dia útil/);
  });

  it('remarcar -> a família recebe o novo horário e aceita -> CONFIRMADA', async () => {
    const r = await request(app).patch(`/solicitacoes/${solicitacaoId}`).set(como(ORIENTADORA))
      .send({ acao: 'remarcar', horario: daquiA(5, '10:00'), mensagem: 'Nesses dias estou em formação.' });
    expect(r.body).toMatchObject({ status: 'REMARCADA', horarioDefinido: daquiA(5, '10:00'), resposta: 'Nesses dias estou em formação.' });
    expect(await mensagens(BEATRIZ)).toMatch(/propôs outro horário para a conversa sobre Rafael Costa Lima/);

    const aceite = await request(app).patch(`/solicitacoes/${solicitacaoId}`).set(como(BEATRIZ)).send({ acao: 'aceitar' });
    expect(aceite.body.status).toBe('CONFIRMADA');
    expect(await mensagens(ORIENTADORA)).toMatch(/Beatriz Lima aceitou o novo horário/);
  });

  it('depois da conversa o orientador conclui; não dá para concluir duas vezes', async () => {
    const r = await request(app).patch(`/solicitacoes/${solicitacaoId}`).set(como(ORIENTADORA)).send({ acao: 'concluir' });
    expect(r.body.status).toBe('CONCLUIDA');
    const de_novo = await request(app).patch(`/solicitacoes/${solicitacaoId}`).set(como(ORIENTADORA)).send({ acao: 'concluir' });
    expect(de_novo.status).toBe(409);
  });

  it('recusar exige justificativa e avisa a família', async () => {
    const nova = await request(app).post(`/alunos/${rafaelId}/solicitacoes`).set(como(BEATRIZ))
      .send({ motivo: 'Frequência', opcoes: [daquiA(6)], formato: 'LIGACAO' });
    expect((await request(app).patch(`/solicitacoes/${nova.body.id}`).set(como(ORIENTADORA)).send({ acao: 'recusar' })).status).toBe(400);

    const r = await request(app).patch(`/solicitacoes/${nova.body.id}`).set(como(ORIENTADORA))
      .send({ acao: 'recusar', justificativa: 'O assunto já foi tratado na conversa de ontem.' });
    expect(r.body).toMatchObject({ status: 'RECUSADA', resposta: 'O assunto já foi tratado na conversa de ontem.' });
    expect(await mensagens(BEATRIZ)).toMatch(/não pôde ser atendido: O assunto já foi tratado/);
  });
});
