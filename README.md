# 🏫 ESCOLAALERTA - PLATAFORMA DE ALERTA PRECOCE DE RISCO ACADÊMICO E COMPORTAMENTAL PARA FAMÍLIAS E ESCOLAS

Este projeto é uma plataforma web que ajuda escolas e famílias a identificar **cedo** os alunos do 6º ao 9º ano em risco acadêmico ou comportamental. A escola registra notas, faltas, ocorrências e saídas antecipadas; um **motor de correlação baseado em regras** calcula o nível de risco, gera alertas e monta um **plano de ação** que a família acompanha e responde.

Trabalho de Conclusão de Curso de **Análise e Desenvolvimento de Sistemas** — Centro Universitário FAMETRO (Manaus), alinhado ao **ODS 4 (Educação de Qualidade)**.

**Autores:** Mateus Farias Bentes e Mariana Idalina Bezerra Vidinho
**Orientadora:** Profa. Luana Leal

🔗 **Protótipo online:** https://escolaalerta.lovable.app/

---

## 🎥 Vídeo de Apresentação do Projeto

📌 Demonstração do fluxo completo (registro → motor de regras → alerta → plano de ação → feedback):

![Vídeo de demonstração do EscolaAlerta](Demonstração%20RF05-RF07-RF08/EscolaAlerta-demo.gif)

👉 Vídeo em alta qualidade (MP4): [`EscolaAlerta-RF05-RF07-RF08.mp4`](Demonstração%20RF05-RF07-RF08/EscolaAlerta-RF05-RF07-RF08.mp4)

---

## 📸 Capturas de Tela

### Painel da Escola (aluna em risco baixo)
![Painel da escola](Demonstração%20RF05-RF07-RF08/01-painel-escola-ana-risco-baixo.png)

### Alerta Automático (risco passa para moderado)
![Alerta automático](Demonstração%20RF05-RF07-RF08/02-alerta-automatico-risco-moderado.png)

### Explicação do Risco ("Como o risco é calculado?")
![Explicação do risco](Demonstração%20RF05-RF07-RF08/03-explicacao-do-risco.png)

### Painel da Escola Atualizado
![Painel atualizado](Demonstração%20RF05-RF07-RF08/04-painel-escola-ana-risco-moderado.png)

### Família Recebe o Alerta
![Família recebe alerta](Demonstração%20RF05-RF07-RF08/05-familia-recebe-alerta.png)

### Plano de Ação
![Plano de ação](Demonstração%20RF05-RF07-RF08/06-plano-de-acao.png)

### Feedback da Família
![Feedback da família](Demonstração%20RF05-RF07-RF08/07-feedback-da-familia.png)

### Escola Recebe o Feedback
![Escola recebe feedback](Demonstração%20RF05-RF07-RF08/08-escola-recebe-feedback.png)

---

## 🚀 Funcionalidades

✅ Login com dois perfis: **Orientador escolar** e **Responsável**
✅ Autenticação segura com JWT e senhas criptografadas (bcrypt)
✅ Cadastro de alunos e registro de indicadores (notas, faltas, ocorrências e saídas antecipadas)
✅ Motor de regras que calcula o risco (baixo, moderado, alto) e explica as evidências
✅ Correlação entre indicadores (ex.: notas baixas + faltas = risco alto)
✅ Alertas automáticos para a família, com aviso por e-mail no risco alto
✅ Plano de ação com disciplina, assunto e orientação para casa
✅ Feedback do responsável e marcação de caso resolvido pela escola
✅ Agendamento de conversa entre responsável e orientador
✅ Análise por turma e por grupos de alunos com perfil parecido
✅ Matriz de ações editável pela escola
✅ Gráfico de evolução do risco semana a semana
✅ Autocadastro de responsável com confirmação de vínculo pela escola
✅ Proteção de rotas por perfil (o responsável só vê os próprios filhos)

---

## 🛠 Tecnologias Utilizadas

| Tecnologia | Descrição |
|---|---|
| Node.js + TypeScript | Linguagem e ambiente da API |
| Express 5 | Framework da API REST |
| PostgreSQL 16 | Banco de dados relacional |
| JWT + bcryptjs | Autenticação e criptografia de senhas |
| Zod | Validação dos dados recebidos |
| Nodemailer + Mailpit | Envio de e-mails (Mailpit captura os e-mails em ambiente de teste) |
| React 18 (via CDN) | Interface do front-end |
| Jest + Supertest | Testes unitários e de integração |
| Docker Compose | Banco e servidor de e-mail locais |
| GitHub Actions | Testes automáticos a cada push |

---

## 🧩 Estrutura do Projeto

```
escola-alerta/
├── api/                          # API REST (Node.js + TypeScript)
│   ├── migrations/               # Scripts SQL de criação do banco
│   ├── scripts/                  # migrate, seed e teste de envio de avisos
│   ├── avaliacao/                # Matriz de confusão do motor de regras
│   ├── tests/                    # Testes unitários e de integração
│   ├── src/
│   │   ├── config/               # Variáveis de ambiente e conexão com o banco
│   │   ├── controllers/          # Recebem as requisições HTTP
│   │   ├── services/             # Regras de negócio
│   │   ├── repositories/         # Acesso ao banco de dados
│   │   ├── domain/               # Entidades (aluno, indicador, risco, usuário)
│   │   ├── motor/                # Motor de regras e gerador do plano de ação
│   │   │   └── regras/           # RegraNotas, RegraFaltas, RegraOcorrencias, RegraSaidas
│   │   ├── eventos/              # Publicação de alertas (padrão Observer)
│   │   ├── canais/               # Canais de aviso externo (e-mail)
│   │   ├── middlewares/          # Autenticação e tratamento de erros
│   │   ├── routes/               # Rotas da API
│   │   └── server.ts             # Ponto de entrada
│   ├── docker-compose.yml        # Banco, banco de testes e Mailpit
│   └── .env.example              # Modelo das variáveis de ambiente
├── front/
│   ├── index.html                # Front-end integrado à API
│   ├── api.js                    # Cliente HTTP
│   └── img/                      # Imagens da interface
├── Documentação/                 # Pré-projeto, arquitetura, UML, testes, IHC/UX
├── Demonstração RF05-RF07-RF08/  # Vídeo e prints da demonstração
├── escolaalerta-prototipo.html   # Protótipo inicial de front-end
├── iniciar.sh                    # Sobe tudo com um comando
└── README.md                     # Este arquivo
```

---

## ☁️ Deploy (Render)

O sistema roda hospedado em **um único serviço**: a API Express também entrega o front (`front/`), então tudo fica na mesma URL.

1. No [Render](https://render.com), clique em **New → Blueprint** e escolha este repositório.
2. O `render.yaml` cria o serviço web (API + front) e o PostgreSQL, ambos no plano gratuito.
3. Com `AUTO_SETUP=true`, o servidor aplica as migrations e os dados fictícios de demonstração ao iniciar (sem duplicar nada em reinícios).

Login de demonstração (senha `senha123`): orientadora `camila.duarte@escola.com.br`, responsável `beatriz.lima@email.com`.

> Plano gratuito: o serviço "dorme" após 15 min sem acesso (o primeiro acesso leva ~1 min) e o PostgreSQL gratuito do Render expira em 30 dias.

---

## ⚙️ Pré-requisitos

Antes de começar, você precisará ter:

- Node.js 20 ou superior
- Docker e Docker Compose
- Python 3 (para servir o front-end)
- Navegador web moderno
- Editor de código (recomendado: VS Code)

---

## ⚙️ Configuração

1. Copie o arquivo de exemplo das variáveis de ambiente:

```bash
cd api
cp .env.example .env
```

2. Gere um `JWT_SECRET` forte e coloque no `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> Usando o `./iniciar.sh` esse passo é automático na primeira execução.

---

## 🚦 Como Executar o Projeto

### Opção 1: Um comando só

```bash
# Clone o repositório
git clone https://github.com/MateusBentes3206/escola-alerta.git

# Navegue até a pasta
cd escola-alerta

# Suba tudo (banco, e-mail de teste, API e front)
./iniciar.sh
```

Acesse **http://localhost:5500** no navegador. Os e-mails enviados pelo sistema aparecem em **http://localhost:8025**.
`Ctrl+C` encerra API e front (o banco continua no Docker; para parar: `cd api && docker compose down`).

### Opção 2: Passo a passo (manual)

```bash
# Clone o repositório
git clone https://github.com/MateusBentes3206/escola-alerta.git
cd escola-alerta/api

# Instale as dependências
npm install

# Configure o .env (veja a seção Configuração)
cp .env.example .env

# Suba o banco e crie as tabelas com dados de exemplo
docker compose up -d
npm run db:migrate && npm run db:seed

# Inicie a API
npm run dev                 # http://localhost:3333/health

# Em outro terminal, inicie o front
cd front && python3 -m http.server 5500
```

> Abra o front sempre por `http://localhost:5500` (não por duplo clique nem por `127.0.0.1`): a API só aceita as origens listadas em `FRONT_URL`.

### 🔑 Contas de Teste

| Perfil | E-mail | Senha |
|---|---|---|
| Orientadora | `camila.duarte@escola.com.br` | `senha123` |
| Responsável | `beatriz.lima@email.com` | `senha123` |

A lista completa de contas está no [`api/README.md`](api/README.md). Para recomeçar a demonstração do zero: `cd api && npm run db:reset`.

---

## 📋 Funcionalidades Detalhadas

### Autenticação
- Login com e-mail e senha, retornando token JWT
- Senhas salvas com hash bcrypt
- Rotas protegidas por perfil (orientador x responsável)
- Autocadastro de responsável, com vínculo confirmado pela escola

### Motor de Regras
- Quatro regras independentes: notas, faltas, ocorrências e saídas antecipadas
- Correlação entre regras para elevar o nível de risco
- Explicação das evidências que levaram ao nível ("Como o risco é calculado?")
- Reavaliação periódica e histórico semana a semana
- Escolhido no lugar de Machine Learning por ser explicável, auditável e funcionar com pouco volume de dados

### Alertas e Plano de Ação
- Alerta gerado automaticamente quando o nível muda
- Aviso por e-mail para a família no risco alto
- Plano de ação com disciplina, assunto e orientação para casa ("O que reforçar")
- Matriz de ações editável pela escola
- Status do plano: aberto, em andamento e resolvido

### Família-Escola
- Feedback do responsável sobre o plano
- Solicitação de conversa com o orientador (presencial, ligação ou vídeo), com sugestão de horários
- Caixa de solicitações do orientador, com contador

### Análise por Turma
- Resumo de quantos alunos precisam de atenção e em que nível
- Agrupamento de alunos com perfil parecido
- Sugestão de assuntos para reforço em grupo

---

## 🎬 Roteiro de Demonstração (ST01–ST03)

1. **Orientadora** (Camila): os cards de resumo mostram quantos alunos (18, em 4 turmas) precisam de atenção e quantos estão em cada nível, e a lista traz o risco alto primeiro. Nas abas **Por turma** e **Grupos parecidos**, mostre os alunos de perfil igual, o que têm em comum, as ações da matriz para o grupo e os assuntos para reforço em grupo (ex.: Equações do 1º grau no 8º B). No botão **Matriz**, mostre que a escola pode editar as ações do plano.
2. Abra **Ana** (risco baixo) e registre 3 faltas sem justificativa em datas diferentes dos últimos 30 dias. Na 3ª falta, o motor gera um alerta e o nível passa para **moderado**.
3. Em "Como o risco é calculado?", aparecem as evidências que levaram ao nível.
4. Ainda na Ana, aba **Notas**: lance História, assunto "Brasil Colônia", nota 3,5. O nível vira **moderado** e aparece **"O que reforçar"** com as recomendações de ensino para aquele assunto.
5. Saia e entre como **Marcos** (pai da Ana): aparece o aviso do novo risco. Em "Ver plano de ação" estão a disciplina, o assunto e a orientação para casa. Envie um feedback. Ainda no plano, clique em **"Agendar conversa com o orientador"**, sugira 2 horários e envie.
6. Volte como **Camila**: o feedback do Marcos aparece nos avisos e na ficha da Ana, em **"Plano de ação e feedbacks"**, com o plano já "em andamento". Em **Solicitações** (no topo, com contador), confirme um horário ou proponha outro.
7. Na ficha da Ana, clique em **"Marcar como resolvido"**: a Ana sai da lista de atenção, e o Marcos é avisado.
8. Na ficha do Rafael, mostre **"Avisos enviados à família"** (o e-mail enviado) e abra o e-mail em http://localhost:8025.
9. Saia e clique em **"Criar conta de responsável"**: cadastre-se com dois filhos. Entre como Camila e confirme o vínculo na ficha do aluno novo.
10. Entre como **Beatriz**: o Rafael está em risco alto por **correlação** entre notas e faltas. A frase-resumo cita as regras (RN04, RN05 e RN06), e o plano manda reforçar Equações do 1º grau (Matemática) e Concordância verbal (Português).

---

## 🧪 Testes

```bash
cd api && npm test               # 154 testes: unitários, integração e controle de acesso
cd api && npm run avaliar:motor  # matriz de confusão do motor (RNF04: 97,4% de acerto)
```

Os testes também rodam automaticamente no **GitHub Actions** a cada push (aba **Actions**).

---

## 📚 Documentação

Na pasta [`Documentação/`](Documentação/) estão o pré-projeto, o artigo, a arquitetura da solução e padrões de projeto (Eixo 2), os diagramas UML, o plano e execução de testes, a documentação de IHC/UX e o pitch.
Detalhes dos endpoints e das decisões de segurança: [`api/README.md`](api/README.md).

---

## 🔒 Dados e LGPD

Todos os dados do repositório são fictícios (RNF02 / LGPD). Nenhum dado real de aluno deve ser commitado.
