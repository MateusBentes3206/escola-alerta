# EscolaAlerta

Plataforma de alerta precoce de risco acadêmico e comportamental para famílias e escolas (6º ao 9º ano), com motor de correlação baseado em regras e plano de ação orientado.

TCC de Análise e Desenvolvimento de Sistemas, Centro Universitário FAMETRO.
**Autores:** Mateus Farias Bentes e Mariana Idalina Bezerra Vidinho.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| [`api/`](api/) | API REST em Node.js + TypeScript + Express + PostgreSQL |
| [`front/`](front/) | Cliente HTTP e integração do protótipo React com a API |
| [`escolaalerta-prototipo.html`](escolaalerta-prototipo.html) | Protótipo de front-end (React via CDN) |
| [`Documentação/`](Documentação/) | Pré-projeto, arquitetura (Eixo 2), UML, plano de testes, IHC/UX |

## Rodando localmente

```bash
cd api
npm install
cp .env.example .env        # gere um JWT_SECRET (instruções no api/README.md)
docker compose up -d
npm run db:migrate && npm run db:seed
npm run dev                 # http://localhost:3333/health
```

Detalhes, endpoints e decisões de segurança: [`api/README.md`](api/README.md).

## Testes

```bash
cd api && npm test
```

Os testes também rodam automaticamente no GitHub Actions a cada push (aba **Actions**).

## Dados

Todos os dados do repositório são fictícios (RNF02 / LGPD). Nenhum dado real de aluno deve ser commitado.
