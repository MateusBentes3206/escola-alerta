# EscolaAlerta

Plataforma de alerta precoce de risco acadêmico e comportamental para famílias e escolas (6º ao 9º ano), com motor de correlação baseado em regras e plano de ação orientado.

TCC de Análise e Desenvolvimento de Sistemas, Centro Universitário FAMETRO.
**Autores:** Mateus Farias Bentes e Mariana Idalina Bezerra Vidinho.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| [`api/`](api/) | API REST em Node.js + TypeScript + Express + PostgreSQL |
| [`front/`](front/) | Protótipo React integrado à API (`index.html`), cliente HTTP e página de teste |
| [`escolaalerta-prototipo.html`](escolaalerta-prototipo.html) | Protótipo de front-end (React via CDN) |
| [`Documentação/`](Documentação/) | Pré-projeto, arquitetura (Eixo 2), UML, plano de testes, IHC/UX |
| [`Demonstração RF05-RF07-RF08/`](Demonstração%20RF05-RF07-RF08/) | Vídeo e prints do fluxo registro → motor de regras → alerta → plano de ação → feedback |

## Rodando localmente

Pré-requisitos: Node.js 20+, Docker e Python 3.

### Jeito rápido (um comando)

```bash
./iniciar.sh
```

Sobe o banco e o servidor de e-mail de teste (Docker), aplica migrations e seed, inicia a API em `:3333` e o front em `:5500`, e abre o navegador em **http://localhost:5500/**. Os e-mails que o sistema envia (avisos de risco alto) aparecem em **http://localhost:8025**. Na primeira vez cria o `api/.env` com um `JWT_SECRET` aleatório. `Ctrl+C` encerra API e front (o banco continua no Docker; `cd api && docker compose down` para parar).

Entre com `camila.duarte@escola.com.br` (orientador) ou `beatriz.lima@email.com` (responsável), senha `senha123`. A lista completa de contas está no [`api/README.md`](api/README.md).

Tudo na interface usa a API e o banco: alunos, indicadores, risco calculado pelo motor, plano de ação, feedback e avisos. Para recomeçar a demonstração do zero: `cd api && npm run db:reset`.

### Roteiro de demonstração (ST01–ST03)

1. **Orientadora** (Camila): os cards de resumo mostram quantos alunos (18, em 4 turmas) precisam de atenção e quantos estão em cada nível, e a lista traz o risco alto primeiro. Nas abas **Por turma** e **Grupos parecidos**, mostre os alunos de perfil igual, o que têm em comum, as ações da matriz para o grupo e os assuntos para reforço em grupo (ex.: Equações do 1º grau no 8º B). No botão **Matriz**, mostre que a escola pode editar as ações do plano.
2. Abra **Ana** (risco baixo) e registre 3 faltas sem justificativa em datas diferentes dos últimos 30 dias. Na 3ª falta, o motor gera um alerta e o nível passa para **moderado**.
3. Em "Como o risco é calculado?", aparecem as evidências que levaram ao nível.
4. Ainda na Ana, aba **Notas**: lance História, assunto "Brasil Colônia", nota 3,5. O nível vira **moderado** e aparece **"O que reforçar"** com as recomendações de ensino para aquele assunto.
5. Saia e entre como **Marcos** (pai da Ana): aparece o aviso do novo risco. Em "Ver plano de ação" estão a disciplina, o assunto e a orientação para casa. Envie um feedback.
   Ainda no plano, clique em **"Agendar conversa com o orientador"**, sugira 2 horários e envie.
6. Volte como **Camila**: o feedback do Marcos aparece nos avisos e na ficha da Ana, em **"Plano de ação e feedbacks"**, com o plano já "em andamento". Em **Solicitações** (no topo, com contador), confirme um horário ou proponha outro.
7. Na ficha da Ana, clique em **"Marcar como resolvido"**: a Ana sai da lista de atenção, e o Marcos é avisado.
8. Na ficha do Rafael, mostre **"Avisos enviados à família"** (e-mail enviado, WhatsApp simulado) e abra o e-mail em http://localhost:8025.
9. Saia e clique em **"Criar conta de responsável"**: cadastre-se com dois filhos. Entre como Camila e confirme o vínculo na ficha do aluno novo.
10. Entre como **Beatriz**: o Rafael está em risco alto por **correlação** entre notas e faltas. A frase-resumo cita as regras (RN04, RN05 e RN06), e o plano manda reforçar Equações do 1º grau (Matemática) e Concordância verbal (Português).

### Passo a passo (manual)

```bash
cd api
npm install
cp .env.example .env        # gere um JWT_SECRET (instruções no api/README.md)
docker compose up -d
npm run db:migrate && npm run db:seed
npm run dev                 # http://localhost:3333/health
# em outro terminal:
cd front && python3 -m http.server 5500   # http://localhost:5500/
```

Abra o front sempre por `http://localhost:5500` (não por duplo clique nem por `127.0.0.1`): a API só aceita as origens listadas em `FRONT_URL`.

Detalhes, endpoints e decisões de segurança: [`api/README.md`](api/README.md).

## Testes

```bash
cd api && npm test            # 147 testes: unitários, integração e controle de acesso
cd api && npm run avaliar:motor   # matriz de confusão do motor (RNF04: 97,4% de acerto)
```

Os testes também rodam automaticamente no GitHub Actions a cada push (aba **Actions**).

## Dados

Todos os dados do repositório são fictícios (RNF02 / LGPD). Nenhum dado real de aluno deve ser commitado.
