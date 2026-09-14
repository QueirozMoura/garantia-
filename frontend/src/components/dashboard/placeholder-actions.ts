// Ações da Dashboard que dependem de funcionalidades ainda NÃO implementadas no
// frontend. O importador de XML/NF-e não existe no projeto: não há página,
// rota nem endpoint. Mantemos o botão visível (a UI já o anuncia), porém
// explicitamente NÃO interativo, em vez de simular um clique sem efeito.
//
// Quando o importador for implementado, basta conectar o CTA à rota real e
// remover este aviso.
export const XML_IMPORT_UNAVAILABLE_HINT = 'Importação de XML/NF-e ainda não disponível.'
