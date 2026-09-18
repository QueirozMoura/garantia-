# Garantia+

**Cofre Fiscal & Garantias Seguras**

O Garantia+ centraliza compras, documentos fiscais e garantias em um único lugar, conectando
cadastros, alertas e assistência sem perder o controle sobre os dados originais.

<p align="center">
  <a href="https://garantia-two.vercel.app">Demo</a>
  ·
  <a href="https://github.com/QueirozMoura">GitHub</a>
  ·
  <a href="https://www.linkedin.com/in/gustavomoura-/">LinkedIn</a>
  ·
  <a href="https://gustavomoura.dev">Portfólio</a>
</p>

<p align="center">
  <code>React</code>
  <code>TypeScript</code>
  <code>Node.js</code>
  <code>PostgreSQL</code>
  <code>Prisma</code>
  <code>Vitest</code>
</p>

## Visão do produto

### O problema

Compras, notas fiscais, documentos e garantias acabam espalhados entre e-mails, pastas e
aplicativos diferentes.

### A solução

O Garantia+ relaciona compras, documentos e garantias em uma conta do usuário, com alertas
derivados e automações por IA onde elas realmente ajudam.

## Principais funcionalidades

| Funcionalidade | Descrição |
| --- | --- |
| Compras | Cadastro, listagem, edição e exclusão, com dados de produto, marca, modelo, loja, data, preço e categoria |
| Garantias | Cadastro e acompanhamento da cobertura associada a uma compra |
| Documentos | Upload, listagem, download, classificação e exclusão de documentos |
| NF-e | Importação de XML com validação, prévia e criação de compra a partir do primeiro item |
| Dashboard | Totais, compras recentes e garantias próximas do vencimento |
| Alertas | Garantias vencendo em até 30 dias e garantias vencidas |
| IA | Extração de dados de documentos e assistência baseada no problema informado |
| Google Login | Login e vinculação de conta quando a integração está configurada |
| Modo visitante | Rascunho local de compra por até sete dias antes do login |

Os documentos podem ser classificados como `INVOICE`, `RECEIPT`, `WARRANTY` ou `OTHER`. Os
formatos aceitos para documentos são PDF, JPG, JPEG e PNG.

## IA aplicada ao produto

A IA é uma camada de assistência, não a fonte de verdade do sistema.

### Extração de documentos

A IA sugere dados de documentos de compra para reduzir a entrada manual, incluindo produto,
marca, modelo, data, preço, loja, número da nota e duração da garantia. Os dados retornados são
revisados no frontend e só são aplicados após confirmação.

### Assistência

A IA analisa o problema informado e prepara um resumo, possíveis causas, próxima ação,
observação de segurança, documentos que podem ser solicitados e uma mensagem para contato com
assistência técnica, fabricante ou suporte.

> **Decisão de arquitetura:** a IA não determina o status da garantia. O backend calcula esse
> status a partir das datas registradas e fornece essa informação à camada de IA.

O código suporta três modos de provedor:

- `mock`, para desenvolvimento e testes;
- `http`, para um provedor HTTP compatível com o contrato interno;
- `gemini`, usando a API do Google Gemini e o modelo configurado no provider.

## Como funciona

```text
Compra
  ↓
Documento / NF-e
  ↓
Extração e revisão
  ↓
Compra + Garantia
  ↓
Dashboard
  ↓
Alertas / Assistência
```

O modo visitante permite iniciar uma compra antes do login. Os campos textuais são salvos no
`localStorage` para retomada posterior; arquivos não são persistidos nesse rascunho.

## Arquitetura

```text
┌─────────────────────────────┐
│           React             │
│ TypeScript + Vite + Router  │
└──────────────┬──────────────┘
               │ REST / JSON
               │ multipart/form-data
               │ cookies de sessão
               ▼
┌─────────────────────────────┐
│     Express 5 + Node.js     │
│    TypeScript + Zod         │
└───────┬──────────┬──────────┘
        │          │
        ▼          ▼
 PostgreSQL       IA
   + Prisma       Gemini / HTTP / Mock
```

O frontend é uma SPA. As páginas ficam em `frontend/src/pages`, os componentes são organizados
por domínio em `frontend/src/components` e o cliente HTTP centralizado fica em
`frontend/src/lib/api.ts`.

O backend é uma API REST em Express. As rotas são montadas em `backend/src/app.ts`; controllers
validam a entrada e delegam as regras de negócio aos services.

### Principais grupos de rotas

| Grupo | Responsabilidade |
| --- | --- |
| `/auth` | Cadastro, login, Google, refresh, logout e usuário atual |
| `/purchases` | CRUD de compras e recursos relacionados |
| `/purchases/:purchaseId/warranty` | Garantia de uma compra |
| `/purchases/:purchaseId/documents` | Documentos de uma compra |
| `/purchases/:purchaseId/assistance` | Preparação, análise e mensagem de assistência |
| `/dashboard` | Resumo e dados recentes do usuário |
| `/documents` | Listagem geral e operações por documento |
| `/nfe/import` | Validação e leitura de XML de NF-e |
| `/warranties` | Listagem geral de garantias |
| `/alerts` | Alertas derivados das garantias |
| `/health` | Verificação da API e da conexão com o banco |

O schema Prisma usa PostgreSQL e define `User`, `Account`, `Purchase`, `Document` e `Warranty`.
Os arquivos enviados são armazenados localmente em `backend/uploads/`; não há configuração de
storage externo no repositório.

## Stack

| Área | Tecnologias |
| --- | --- |
| Frontend | React 19 · TypeScript · Vite · React Router · Tailwind CSS · Lucide React |
| Backend | Node.js 20+ · Express 5 · TypeScript · Prisma |
| Database | PostgreSQL |
| Auth | JWT · `bcryptjs` · Cookies `HttpOnly` · Google Identity Services |
| AI | Google Gemini · HTTP Provider · Mock Provider |
| Testing | Vitest · Testing Library · Supertest · jsdom |
| Security | Helmet · CORS · Zod · Rate Limiting |
| Upload e parsing | Multer · `fast-xml-parser` · armazenamento local |

## Segurança

| Camada | Implementação |
| --- | --- |
| Senhas | Hash com `bcryptjs` |
| Sessão | Access token JWT e refresh token com secrets separados |
| Cookies | Refresh token em cookie `HttpOnly`, com política por ambiente |
| Validação | Schemas com Zod |
| Upload | Validação de extensão, MIME, tamanho e assinatura |
| XML | Parsing sem expansão de entidades e rejeição de `DOCTYPE`/`ENTITY` |
| API | Helmet, CORS com credenciais e desativação de `X-Powered-By` |
| Rate limit | Login/cadastro por IP e operações de IA por usuário |
| Ownership | Consultas filtradas pelo usuário autenticado |
| Armazenamento | Validação de caminhos para impedir saída do diretório de uploads |

Documentos têm limite de 10 MB e XML de NF-e tem limite de 5 MB. O access token é enviado pelo
frontend no header `Authorization`; o refresh token não é exposto ao JavaScript e fica em cookie
`HttpOnly`.

## Testes

Os números abaixo correspondem à validação realizada durante a revisão deste README:

| Área | Resultado |
| --- | --- |
| Frontend | **327 testes passando** em 23 arquivos |
| Backend | **373 testes passando** em 25 arquivos |

O frontend usa Vitest com `jsdom` e Testing Library. O backend usa Vitest com Supertest e um
banco PostgreSQL separado para testes de integração HTTP. A suíte do backend exige um arquivo
`backend/.env.test` não versionado e não cria o banco automaticamente.

## Estrutura do projeto

```text
.
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── layouts/
│   │   ├── lib/
│   │   ├── pages/
│   │   ├── services/
│   │   └── test/
│   ├── .env.example
│   ├── package.json
│   ├── vercel.json
│   └── vite.config.ts
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── config/
│   │   ├── middlewares/
│   │   ├── modules/
│   │   ├── services/
│   │   └── routes/
│   ├── tests/
│   ├── uploads/
│   ├── .env.example
│   └── package.json
└── README.md
```

## Como rodar

### Pré-requisitos

- Node.js 20 ou superior.
- npm.
- PostgreSQL acessível localmente ou por uma URL de conexão.
- Um banco separado para os testes de integração do backend.

### Backend

```bash
cd backend
npm install
cp .env.example .env
npx prisma migrate deploy
npm run dev
```

Preencha as variáveis do `.env` antes de iniciar a API. O servidor usa a porta definida em
`PORT` e, por padrão, a API local é consumida pelo frontend em `http://localhost:3000`.

Comandos disponíveis:

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test
npm run test:watch
npm run format
```

### Frontend

Em outro terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

O frontend usa `VITE_API_URL` para localizar a API. Com a configuração local padrão, acesse a
URL exibida pelo Vite.

Comandos disponíveis:

```bash
npm run dev
npm run build
npm run lint
npm run test
npm run test:watch
npm run format
npm run format:check
npm run preview
```

### Testes do backend

Crie `backend/.env.test` sem versioná-lo, usando um banco PostgreSQL separado do banco de
desenvolvimento. O carregamento dos testes exige `TEST_DATABASE_URL`,
`ACCESS_TOKEN_SECRET` e `REFRESH_TOKEN_SECRET`, e o schema do banco de testes deve ser aplicado
antes da execução.

```bash
cd backend
npx prisma migrate deploy
npm test
```

Ao usar um banco de teste, a URL usada pelo comando Prisma deve apontar para esse banco.

## Variáveis de ambiente

Somente os nomes das variáveis são listados abaixo. Os valores devem ser definidos localmente e
não devem ser commitados.

### Backend

`PORT` · `NODE_ENV` · `CLIENT_URL` · `DATABASE_URL` · `ACCESS_TOKEN_SECRET` ·
`REFRESH_TOKEN_SECRET` · `ACCESS_TOKEN_EXPIRES_IN` · `REFRESH_TOKEN_EXPIRES_IN` · `AI_PROVIDER` ·
`AI_API_KEY` · `AI_API_URL` · `GEMINI_API_KEY` · `GOOGLE_CLIENT_ID` · `RATE_LIMIT_AUTH_MAX` ·
`RATE_LIMIT_AI_MAX`

### Frontend

`VITE_API_URL` · `VITE_GOOGLE_CLIENT_ID`

### Testes do backend

`TEST_DATABASE_URL` · `ACCESS_TOKEN_SECRET` · `REFRESH_TOKEN_SECRET`

## Deploy

O repositório contém `frontend/vercel.json` com um rewrite de qualquer caminho para
`/index.html`, compatível com o roteamento da SPA no frontend.

Não há Dockerfile, workflow de CI/CD ou arquivo específico de deploy do backend versionado no
repositório. O deploy do backend e a infraestrutura de PostgreSQL não são documentados como
configurados pelo projeto.

## Decisões técnicas

- **Separação frontend/backend:** projetos independentes, contratos HTTP explícitos e variáveis
  de ambiente próprias.
- **IA fora da fonte de verdade:** a IA sugere dados e assistência; o backend calcula o status
  da garantia.
- **Confirmação dos dados extraídos:** o usuário revisa as sugestões antes da aplicação, que
  ocorre em uma transação.
- **Alertas derivados:** os alertas são calculados em tempo de consulta a partir das datas das
  garantias, sem tabela adicional.
- **Ownership:** consultas de compras, documentos, garantias e assistência são filtradas pelo
  usuário autenticado.
- **Refresh token HttpOnly:** o refresh token não é exposto ao JavaScript.
- **NF-e em memória:** o XML é validado e interpretado durante a requisição; não é persistido
  como uma entidade própria e os itens não são armazenados separadamente.
- **Upload controlado:** arquivos são recebidos em memória e gravados com nomes UUID em
  `backend/uploads/`.

## Roadmap

### Implementado

- Cadastro e autenticação por e-mail e senha.
- Login e vinculação de conta Google, quando configurados.
- Compras, garantias, documentos, dashboard e alertas.
- Upload e validação de documentos.
- Importação de XML de NF-e com prévia e criação de compra.
- Extração de dados de documentos e assistência orientada por IA.
- Modo visitante com rascunho local de compra.

### Próximos passos

- Persistir o número da NF-e como campo próprio da compra.
- Implementar a central de notificações do cabeçalho.
- Implementar a página de configurações.
- Adicionar armazenamento externo de documentos.
- Definir a infraestrutura de deploy do backend.

## Autor

**Gustavo Moura**

Estudante de Análise e Desenvolvimento de Sistemas e desenvolvedor do projeto.

<p>
  <a href="https://github.com/QueirozMoura">GitHub</a>
  ·
  <a href="https://www.linkedin.com/in/gustavomoura-/">LinkedIn</a>
  ·
  <a href="https://gustavomoura.dev">Portfólio</a>
</p>
