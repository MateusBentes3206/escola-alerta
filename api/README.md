# EscolaAlerta · API

API REST do EscolaAlerta (TCC FAMETRO), em camadas **Controller → Service → Repository → PostgreSQL**, conforme o Eixo 2 (Arquitetura de Software).

**Status:** Sprint 1 concluída: setup, banco completo, login com JWT + bcrypt e testes UT07, IT03 e IT04.

---

## Pré-requisitos

- Node.js 20 ou superior
- Docker Desktop (para o PostgreSQL)

## Como rodar (primeira vez)

```bash
# 1. Dependências
npm install

# 2. Variáveis de ambiente
cp .env.example .env
#    Gere um JWT_SECRET forte e cole no .env:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. Sobe os bancos (dev na 5432, teste na 5433)
docker compose up -d

# 4. Cria as tabelas e os usuários de demonstração
npm run db:migrate
npm run db:seed

# 5. Sobe a API (reinicia sozinha ao salvar arquivo)
npm run dev
```

Abra http://localhost:3333/health: deve aparecer `{"status":"ok","banco":"ok"}`.

### Usuários de demonstração (senha: `senha123`)

| Perfil | E-mail |
|---|---|
| Orientador | camila.duarte@escola.com.br |
| Responsável | beatriz.lima@email.com |
| Responsável | marcos.souza@email.com |
| Responsável | sandra.matos@email.com |

Todos os dados são fictícios (RNF02 / LGPD).

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | API em modo desenvolvimento |
| `npm test` | Todos os testes (precisa do `db_test` rodando) |
| `npm run test:unit` | Só unitários (não precisa de banco) |
| `npm run db:migrate` | Aplica migrations novas |
| `npm run db:reset` | **Apaga tudo**, recria e roda o seed |
| `npm run build && npm start` | Versão de produção |

## Endpoints disponíveis

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/health` | não | API e banco no ar |
| POST | `/auth/login` | não | `{ email, senha }` → `{ token, usuario }` |
| GET | `/auth/me` | Bearer | Usuário do token |

Erros sempre no formato `{ "erro": "mensagem", "detalhes": [...] }`.

```bash
curl -X POST http://localhost:3333/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"camila.duarte@escola.com.br","senha":"senha123"}'
```

## Conectando o front

Os arquivos ficam na pasta `../front/` (raiz do repositório):

- **`api.js`**: cliente HTTP. Guarda o token, envia `Authorization: Bearer`, devolve a mensagem de erro da API e volta para o login se a sessão expirar.
- **`teste-conexao.html`**: página mínima para testar health, login e rota protegida.
- **`login-integracao.jsx`**: os 3 passos para ligar o login real no protótipo.

**O HTML precisa ser aberto por um servidor, não com duplo clique.** Aberto como `file://`, o navegador manda `Origin: null` e o CORS bloqueia. Use a extensão **Live Server** do VS Code (porta 5500, já liberada no `.env`) ou:

```bash
cd ../front && npx serve -l 5500
```

Se usar outra porta, inclua a origem em `FRONT_URL` no `.env` e reinicie a API.

## Estrutura

```
migrations/          SQL versionado (001_init.sql = todas as tabelas do diagrama de classes)
scripts/             migrate e seed via linha de comando
src/
  config/            env e pool do PostgreSQL
  domain/            tipos de domínio (Usuario, Perfil)
  repositories/      ÚNICA camada que escreve SQL (padrão Repository)
  services/          regras de negócio (AuthService, hash, token)
  controllers/       HTTP <-> Service, validação com Zod
  middlewares/       autenticar, exigirPerfil, tratarErros
  routes/
tests/
  unit/              sem banco (UT07 + AuthService com repositório falso)
  integration/       Supertest contra o banco de teste (IT03, IT04)
```

## Decisões de segurança (para a banca)

- **Senha:** bcrypt com custo 10 e salt aleatório; o hash nunca sai na resposta (UT07, IT03).
- **Login:** mesma mensagem e mesmo tempo de resposta para "e-mail inexistente" e "senha errada", para não revelar quais e-mails estão cadastrados.
- **IDs em UUID:** não dá para adivinhar o id de outro aluno trocando um número na URL.
- **SQL:** sempre parametrizado (`$1`), nunca concatenado.
- **CORS:** só as origens do `FRONT_URL`.
- **Token no front:** em `sessionStorage`, some ao fechar a aba (computadores compartilhados da escola).

## Próximas sprints

| Sprint | Entrega | Testes |
|---|---|---|
| 2 | CRUD de alunos e indicadores + controle de acesso por responsável | UT06, IT01, IT02, ST04 |
| 3 | Motor de regras (Strategy), portado de `classificarRisco()` do protótipo | UT01–UT05, IT05, IT06 |
| 4 | Plano de ação, feedback e Observer | UT08, IT07, ST03 |
| 5 | Integração completa do front e matriz de confusão | ST01, ST02 |
