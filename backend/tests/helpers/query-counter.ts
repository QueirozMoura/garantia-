import { PrismaClient } from '@prisma/client';

/**
 * Conta os statements SQL emitidos pelo client Prisma REAL que o service usa.
 *
 * O service de documentos importa `{ prisma }` de `config/prisma.js`. Para medir
 * a produção de verdade (e não uma cópia do `select`), o arquivo de teste troca
 * esse módulo por este client instrumentado via `vi.doMock` e carrega o service
 * com `await import(...)` DEPOIS do mock. Assim `listAllDocuments` roda o
 * caminho real e cada query emitida é registrada — um N+1 introduzido no
 * service passa a ser detectável, em vez de passar por vacuidade.
 *
 * O `vi.doMock` fica no arquivo de teste de propósito: o specifier relativo é
 * resolvido a partir do módulo que o chama, então precisa ser o próprio teste.
 */

type QueryEvent = { query: string };

let statements: string[] = [];
let client: PrismaClient | null = null;

/** Cria (uma vez) o client observador e aquece a conexão. */
export async function createCountingClient(): Promise<PrismaClient> {
  if (!client) {
    client = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
    client.$on('query', (event: QueryEvent) => {
      statements.push(event.query);
    });
    // Handshake inicial fora da contagem.
    await client.$queryRaw`SELECT 1`;
  }
  return client;
}

/**
 * Executa `run` e devolve o resultado junto do número de statements emitidos
 * durante a execução (zerando o contador antes).
 */
export async function countStatementsFor<T>(run: () => Promise<T>): Promise<{
  result: T;
  statements: number;
}> {
  statements = [];
  const result = await run();
  return { result, statements: statements.length };
}

/** Desconecta o client observador. */
export async function disconnectQueryCounter(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}
