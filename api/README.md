# EscolaAlerta · API

API REST do EscolaAlerta (TCC FAMETRO), em camadas **Controller → Service → Repository → PostgreSQL**, com os três padrões do documento de Arquitetura: **Strategy** (motor de regras), **Repository** (acesso a dados) e **Observer** (intervenção orientada).

**Status:** Sprints 1 a 4 implementadas e integradas ao front, com plano de ação por disciplina/assunto. A suíte tem 92 testes automatizados (UT01–UT08, IT01–IT07, ST04 e RNF04).

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

# 4. Cria as tabelas, os usuários, os alunos e o histórico de demonstração
npm run db:migrate
npm run db:seed

# 5. Sobe a API (reinicia sozinha ao salvar arquivo)
npm run dev
```

Abra http://localhost:3333/: aparecem o status e a lista de rotas.

Ou, da raiz do repositório, `./iniciar.sh` faz tudo isso e ainda sobe o front.

### Usuários de demonstração (senha: `senha123`)

| Perfil | E-mail | Aluno (situação inicial) |
|---|---|---|
| Orientador | camila.duarte@escola.com.br | os três abaixo |
| Responsável | beatriz.lima@email.com | Rafael: **alto** (notas + faltas, com correlação) |
| Responsável | marcos.souza@email.com | Ana: **baixo** |
| Responsável | sandra.matos@email.com | Diego: **moderado** (ocorrência moderada) |

As datas do histórico de demonstração são relativas ao dia do seed, então os alunos não "saem" da janela de 30 dias do motor. Para recomeçar a demonstração do zero: `npm run db:reset`.

Todos os dados são fictícios (RNF02 / LGPD).

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | API em modo desenvolvimento |
| `npm test` | Todos os testes (precisa do `db_test` rodando) |
| `npm run test:unit` | Só unitários (não precisa de banco) |
| `npm run avaliar:motor` | Matriz de confusão do motor sobre os cenários simulados (RNF04) |
| `npm run db:migrate` | Aplica migrations novas |
| `npm run db:reset` | **Apaga tudo**, recria e roda o seed |
| `npm run build && npm start` | Versão de produção |

## Motor de correlação temporal

Fluxo de um registro, por exemplo uma falta:

```
POST /alunos/:id/indicadores
  -> IndicadorService (valida com Zod e grava)
  -> ServicoDeRisco.reavaliar()
       -> MotorDeRegras.classificar(histórico)      [Strategy]
            RegraOcorrencias · RegraFaltas · RegraNotas · RegraSaidas
       -> o nível ou a causa mudaram? grava alerta + plano (GeradorDePlanoDeAcao)
       -> PublicadorDeAlertas.publicar()            [Observer]
            NotificarResponsavel · NotificarOrientador
```

| Regra | Critério | Peso |
|---|---|---|
| `RegraNotas` | Nota **mais recente** de cada disciplina. 2+ disciplinas abaixo de 6 = 3. Uma abaixo de 4, ou abaixo de 6 e em queda de 1,5+ ponto = 2. Uma abaixo de 6 = 1. Só queda forte = 1 | 1–3 |
| `RegraFaltas` | Faltas **não justificadas nos últimos 30 dias**. 5+ faltas, ou 3 dias letivos seguidos = 3. 3–4 faltas = 2. 1–2 faltas = 1 | 1–3 |
| `RegraOcorrencias` | Pontos de gravidade em 30 dias (leve 1, moderada 2, grave 3). 3+ pontos = 3. 2 = 2. 1 = 1 | 1–3 |
| `RegraSaidas` | Saídas antecipadas em 30 dias. 4+ = 2. 2–3 = 1. Nunca chega a alto sozinha | 1–2 |

- **Nível:** vale o maior peso (3 alto, 2 moderado, 1 baixo).
- **Correlação:** dois sinais de peso 2 ou mais ao mesmo tempo fazem o nível subir para **alto**. Três sinais de qualquer peso fazem o nível subir para pelo menos **moderado**.
- **Causa raiz:** o sinal de maior peso. Em caso de empate, vale a ordem das regras (a mesma do protótipo).
- **Explicabilidade (RNF07):** cada sinal traz a regra e frases de evidência. O alerta grava `regra_origem` e os sinais em `detalhes`, e cada sugestão do plano guarda a causa que a originou.
- **Histórico (RF08):** só é gravado um alerta novo quando o nível ou a causa mudam, então a tabela `alertas` registra a evolução do risco.
- **Tempo:** a `ReavaliacaoPeriodica` roda na subida da API e a cada 6 horas. Ela cobre o caso em que o risco muda só porque uma falta saiu da janela de 30 dias.
- **Parâmetros:** todos os limites estão em [`src/motor/parametros.ts`](src/motor/parametros.ts), e `GET /motor` expõe as regras e os limites em uso.

### Plano de ação: o que reforçar e como ensinar

Toda nota é lançada com a **disciplina** e o **assunto avaliado** (ex.: Matemática, "Equações do 1º grau"). Quando a nota mais recente fica abaixo de 6 ou cai 1,5 ponto ou mais, a `RegraNotas` devolve esse par como **foco de reforço**. O `GeradorDePlanoDeAcao` então monta, para cada foco ([`src/motor/RecomendacoesDeEnsino.ts`](src/motor/RecomendacoesDeEnsino.ts)):

- **O que reforçar:** "Reforçar Equações do 1º grau em Matemática (caiu de 7,0 para 5,2 no 3º bimestre)".
- **Recomendações de ensino para o professor:** duas estratégias da área da disciplina (Matemática, Linguagens, Ciências ou Humanas, como na BNCC), com o assunto no texto. Se a nota ficou abaixo de 4, entra antes um passo de "verificar os pré-requisitos". Se houve queda, entra "comparar com a avaliação anterior".
- **Orientação para a família:** estudo curto em casa sobre aquele assunto.

Os focos aparecem com a pior nota primeiro. Cada item é gravado em `sugestoes` com `tipo` (ACAO, REFORCO, ENSINO ou FAMILIA), `disciplina` e `assunto`, então continua rastreável (RNF07). A escola vê o reforço calculado na hora (`reforcosAtuais` em `GET /alunos/:id`), mesmo com risco baixo. A família vê o reforço dentro do plano de ação.

### Precisão (RNF04)

`npm run avaliar:motor` roda o motor sobre 36 cenários simulados ([`avaliacao/cenarios.ts`](avaliacao/cenarios.ts)). Em cada cenário, o nível esperado foi definido por critério pedagógico **antes** de rodar o motor e não foi ajustado depois.

```
               BAIXO  MODERADO      ALTO
     BAIXO        16         0         0
  MODERADO         1        10         0
      ALTO         0         0         9

Acurácia: 35/36 = 97.2%  (meta RNF04: 80%)
```

Nenhum caso de risco alto foi classificado como baixo, que é o erro mais grave.

**Histórico da avaliação:**
- **Versão 1:** 34/36 = 94,4%. As divergências foram C26 e C27.
- **Versão 2:** 35/36 = 97,2%. A C27 (nota 3,0 isolada) mostrou que a regra não diferenciava o quanto a nota estava abaixo de 6. Com o reforço por assunto, uma nota abaixo de 4 passou a valer peso 2. Essa mudança veio **depois** de ver o resultado da versão 1. Por isso, a melhora na C27 não deve ser lida como validação independente: o próximo passo é validar com cenários novos, de preferência definidos por professores.
- **Divergência que continua:** C26, uma falta com três saídas antecipadas. É um padrão de evasão que a soma de sinais fracos ainda não pega.

## Endpoints

| Método | Rota | Perfil | Descrição |
|---|---|---|---|
| GET | `/` | — | Status e lista de rotas |
| GET | `/health` | — | API e banco no ar |
| GET | `/motor` | — | Regras, observadores e parâmetros do motor |
| POST | `/auth/login` | — | `{ email, senha }` → `{ token, usuario }` |
| GET | `/auth/me` | qualquer | Usuário do token |
| GET | `/alunos` | qualquer | Alunos da conta, com o risco atual |
| POST | `/alunos` | orientador | `{ nome, turma, responsavelId? }` |
| GET | `/alunos/:id` | dono | Indicadores, risco com sinais e evidências, plano atual (ações + reforços), `reforcosAtuais`, feedbacks e evolução |
| GET | `/alunos/:id/indicadores?tipo=NOTA` | dono | Indicadores, com filtro opcional por tipo |
| POST | `/alunos/:id/indicadores` | orientador | Registra NOTA (com `disciplina` e `assunto` obrigatórios), FALTA, OCORRENCIA ou SAIDA → `{ indicador, risco, alertaGerado }` |
| PATCH | `/indicadores/:id` | orientador | Edita e reavalia o risco |
| DELETE | `/indicadores/:id` | orientador | Exclui e reavalia o risco |
| GET | `/alertas/:alunoId` | dono | Evolução do risco em ordem cronológica, com o plano de cada alerta |
| POST | `/alertas/:id/feedback` | responsável | `{ status: em_andamento \| resolvido, observacao? }` |
| GET | `/responsaveis` | orientador | Lista para o vínculo no cadastro |
| GET | `/notificacoes` | qualquer | Avisos gerados pelos observadores |
| PATCH | `/notificacoes/:id/lida` | dono | Marca o aviso como lido |

"Dono" significa: o orientador que cadastrou o aluno, ou o responsável vinculado a ele. Para qualquer outra conta, a resposta é **404**, para não revelar que o aluno existe (ST04).

Erros sempre no formato `{ "erro": "mensagem", "detalhes": [...] }`.

## Conectando o front

Os arquivos ficam na pasta `../front/` (raiz do repositório):

- **`index.html`**: a interface completa. Usa a API para tudo: login, alunos, indicadores, risco, plano, feedback e avisos.
- **`api.js`**: cliente HTTP. Guarda o token, envia `Authorization: Bearer`, devolve a mensagem de erro da API e volta para o login se a sessão expirar.
- **`teste-conexao.html`**: página mínima para testar health, login e rota protegida.
- **`login-integracao.jsx`**: registro dos passos da integração do login (Sprint 1).

**O HTML precisa ser aberto por um servidor, não com duplo clique.** Aberto como `file://`, o navegador manda `Origin: null` e o CORS bloqueia. Use `./iniciar.sh` na raiz, a extensão **Live Server** do VS Code (porta 5500) ou:

```bash
cd ../front && npx serve -l 5500
```

Se usar outra porta, inclua a origem em `FRONT_URL` no `.env` e reinicie a API.

## Estrutura

```
migrations/          SQL versionado (001 = tabelas do diagrama de classes, 002 = ajustes do motor, 003 = assunto e reforço)
scripts/             migrate e seed via linha de comando
avaliacao/           cenários simulados + matriz de confusão do motor (RNF04)
src/
  config/            env e pool do PostgreSQL
  domain/            tipos de domínio (Usuario, Aluno, Indicador, Alerta, Classificacao)
  motor/             MotorDeRegras, regras/ (Strategy), parametros, GeradorDePlanoDeAcao, RecomendacoesDeEnsino
  eventos/           PublicadorDeAlertas + observadores/ (Observer)
  repositories/      ÚNICA camada que escreve SQL (padrão Repository)
  services/          regras de negócio (Auth, Aluno, Indicador, Alerta, ServicoDeRisco)
  controllers/       HTTP <-> Service
  middlewares/       autenticar, exigirPerfil, tratarErros
  routes/
  container.ts       raiz de composição: monta as dependências (injeção manual)
tests/
  unit/              sem banco: UT01–UT08, Observer, RNF04
  integration/       Supertest contra o banco de teste: IT01–IT07, ST04
```

## Decisões de segurança (para a banca)

- **Senha:** bcrypt com custo 10 e salt aleatório; o hash nunca sai na resposta (UT07, IT03).
- **Login:** mesma mensagem e mesmo tempo de resposta para "e-mail inexistente" e "senha errada", para não revelar quais e-mails estão cadastrados.
- **Controle de acesso por registro (ST04):** cada consulta confere se o aluno pertence à conta. Além disso, o perfil limita as ações: só o orientador registra indicadores e só o responsável registra feedback.
- **IDs em UUID:** não dá para adivinhar o id de outro aluno trocando um número na URL, e um id malformado responde 404, não erro interno.
- **SQL:** sempre parametrizado (`$1`), nunca concatenado.
- **Validação:** Zod em toda entrada (nota de 0 a 10, data não pode estar no futuro, campos obrigatórios por tipo de indicador).
- **CORS:** só as origens do `FRONT_URL`.
- **Token no front:** em `sessionStorage`, some ao fechar a aba (computadores compartilhados da escola).

## Rastreabilidade (Plano de Testes)

| Caso | Onde | Status |
|---|---|---|
| UT01–UT05 | `tests/unit/motor.test.ts` | Aprovado |
| UT08 (reforço por assunto) | `tests/unit/reforco.test.ts` | Aprovado |
| UT06, UT08 | `tests/unit/plano-e-cadastro.test.ts` | Aprovado |
| UT07 | `tests/unit/senha.test.ts` | Aprovado |
| IT01, IT02, IT05, IT06, IT07, ST04 | `tests/integration/fluxo-risco.test.ts` | Aprovado |
| IT03, IT04 | `tests/integration/auth.test.ts` | Aprovado |
| RNF04 | `tests/unit/precisao-motor.test.ts` + `npm run avaliar:motor` | Aprovado (97,2%) |
| ST01–ST03 | Roteiro manual na interface (ver README da raiz) | Pendente de execução roteirizada |
| ST05 | Mobile/web via Flutter | Fora do escopo do protótipo React |
