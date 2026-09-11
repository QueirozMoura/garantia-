# Testes de integração (HTTP)

Suíte de testes de integração HTTP usando **Vitest** + **Supertest**.

## Requisitos

- Node >= 20
- Um banco **PostgreSQL separado do banco de desenvolvimento**.

## Variáveis de ambiente

Os testes **não** usam `backend/.env` (desenvolvimento). É necessário um arquivo
**`backend/.env.test`** (não versionado) com, no mínimo:

```
TEST_DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/garantia_test
ACCESS_TOKEN_SECRET=<segredo-exclusivo-de-teste>
REFRESH_TOKEN_SECRET=<segredo-exclusivo-de-teste>
```

Regras aplicadas automaticamente em `tests/setup/load-test-env.ts`:

- Se `backend/.env.test` não existir, a suíte falha com erro explicativo.
- `TEST_DATABASE_URL` é obrigatório.
- Se `TEST_DATABASE_URL` for igual ao `DATABASE_URL` de desenvolvimento, a suíte falha.
- `process.env.DATABASE_URL` é reescrito para `TEST_DATABASE_URL` **antes** de a
  aplicação (`src/app.ts` → `src/config/env.ts`) ser importada.

> Não é criado nenhum banco automaticamente. O banco de testes deve existir e ter o
> schema aplicado. Prepare-o uma vez (ex.: `prisma migrate deploy` / `prisma db push`,
> sem alterar o banco de desenvolvimento) apontando para o banco de teste.

## Estrutura

```
tests/
  setup/
    load-test-env.ts   # carrega .env.test e protege contra uso do banco de dev
  helpers/
    db.ts              # Prisma de teste + cleanDatabase/disconnectDatabase
    http.ts            # app via supertest, criação de usuário/token, purchase+document
  *.test.ts            # casos de teste (a serem adicionados)
```

## Comandos

```
npm run test        # executa a suíte uma vez
npm run test:watch  # modo watch
```
