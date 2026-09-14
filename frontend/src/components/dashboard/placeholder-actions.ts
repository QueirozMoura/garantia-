// Ações da Dashboard que dependem de funcionalidades ainda NÃO implementadas no
// frontend. O importador de XML/NF-e não existe no projeto: não há página,
// rota nem endpoint. Em vez de simular um clique sem efeito, o CTA abre um aviso
// de "em breve" (XmlImportComingSoonDialog) compartilhado pelos dois pontos de
// entrada da Dashboard.
//
// Quando o importador for implementado, basta conectar o CTA à rota real e
// remover o aviso.
export const XML_IMPORT_COMING_SOON_MESSAGE =
  'Em breve você poderá importar suas notas fiscais em XML e cadastrar suas compras automaticamente no Garantia+.'
