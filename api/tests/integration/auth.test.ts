import request from 'supertest';
import { app } from '../../src/app';
import { pool } from '../../src/config/db';
import { rodarMigrations } from '../../src/database/migrator';
import { rodarSeed, SENHA_PADRAO_SEED } from '../../src/database/seed';

// Banco de teste recriado do zero antes da suíte: cada execução parte do mesmo estado.
beforeAll(async () => {
  await rodarMigrations(pool, { reset: true, log: false });
  await rodarSeed(pool);
});

afterAll(async () => {
  await pool.end();
});

const ORIENTADORA = 'camila.duarte@escola.com.br';
const RESPONSAVEL = 'beatriz.lima@email.com';

describe('IT03 - POST /auth/login com credenciais válidas', () => {
  it('retorna 200 com token JWT e dados públicos do usuário', async () => {
    const res = await request(app).post('/auth/login').send({ email: RESPONSAVEL, senha: SENHA_PADRAO_SEED });

    expect(res.status).toBe(200);
    expect(res.body.token.split('.')).toHaveLength(3);
    expect(res.body.usuario).toMatchObject({ email: RESPONSAVEL, perfil: 'RESPONSAVEL', nome: 'Beatriz Lima' });
    expect(res.body.usuario).not.toHaveProperty('senhaHash');
    expect(JSON.stringify(res.body)).not.toContain('$2'); // nenhum hash bcrypt vaza na resposta
  });

  it('aceita e-mail com maiúsculas e espaços', async () => {
    const res = await request(app).post('/auth/login').send({ email: `  ${ORIENTADORA.toUpperCase()} `, senha: SENHA_PADRAO_SEED });
    expect(res.status).toBe(200);
    expect(res.body.usuario.perfil).toBe('ORIENTADOR');
  });

  it('o token emitido dá acesso a GET /auth/me', async () => {
    const login = await request(app).post('/auth/login').send({ email: ORIENTADORA, senha: SENHA_PADRAO_SEED });
    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(ORIENTADORA);
  });
});

describe('IT04 - POST /auth/login com credenciais inválidas', () => {
  it('senha errada: 401 e nenhum token', async () => {
    const res = await request(app).post('/auth/login').send({ email: ORIENTADORA, senha: 'errada' });
    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty('token');
    expect(res.body.erro).toBe('E-mail ou senha inválidos.');
  });

  it('e-mail inexistente: 401 com a mesma mensagem', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'ninguem@escola.com.br', senha: 'qualquer' });
    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty('token');
    expect(res.body.erro).toBe('E-mail ou senha inválidos.');
  });

  it('body inválido: 400 com o campo que falhou', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'nao-e-email' });
    expect(res.status).toBe(400);
    expect(res.body.detalhes.map((d: { campo: string }) => d.campo)).toEqual(expect.arrayContaining(['email', 'senha']));
  });

  it('rota protegida sem token ou com token adulterado: 401', async () => {
    expect((await request(app).get('/auth/me')).status).toBe(401);
    const adulterado = await request(app).get('/auth/me').set('Authorization', 'Bearer abc.def.ghi');
    expect(adulterado.status).toBe(401);
  });
});
