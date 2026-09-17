// Contrato atual do POST /auth/google: rejeita o que não pode ser verificado.
//
// Esta suíte foi da Etapa 1 (rota ainda um stub, que ignorava o body). Com a
// micro-etapa 5a o body passou a ser validado ANTES da consulta ao Google, então
// o que se prova aqui é que entradas inválidas morrem na validação — nunca
// autenticando a partir de dados enviados pelo cliente.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { api } from './helpers/http.js';
import { cleanDatabase, disconnectDatabase } from './helpers/db.js';

describe('POST /auth/google — não configurado', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  it('rejeita body sem credential antes de qualquer verificação', async () => {
    const response = await api().post('/auth/google').send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('NÃO autentica mesmo recebendo email/nome/email_verified no body', async () => {
    const response = await api().post('/auth/google').send({
      email: 'atacante@example.test',
      name: 'Atacante',
      credential: 'id-token-forjado',
      email_verified: true,
    });

    // Campos de identidade enviados pelo cliente são rejeitados pelo schema
    // estrito: nenhum token de sessão e nada de "confiar no email".
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.accessToken).toBeUndefined();
    expect(response.body.user).toBeUndefined();
    expect(response.body.verified).toBeUndefined();
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('credential sem verificação válida continua não autenticando ninguém', async () => {
    // Sem GOOGLE_CLIENT_ID no ambiente de teste, o serviço devolve erro de
    // configuração: a rota não emite sessão em nenhum caso nesta etapa.
    const response = await api().post('/auth/google').send({ credential: 'id-token-qualquer' });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.body.accessToken).toBeUndefined();
    expect(response.body.user).toBeUndefined();
    expect(response.headers['set-cookie']).toBeUndefined();
  });
});
