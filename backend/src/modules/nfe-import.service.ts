import { badRequest } from '../utils/http-error.js';

/**
 * Validação de conteúdo do XML da NF-e.
 *
 * Esta etapa apenas RECEBE e VALIDA o XML: não há parsing semântico da nota,
 * nenhuma compra/garantia é criada e nenhuma persistência acontece. A validação
 * confirma que o buffer é texto XML bem formado; não confiamos na extensão nem
 * no MIME informados pelo cliente.
 */

// Caracteres nulos e de controle (exceto tab 0x09, LF 0x0A e CR 0x0D) não são
// válidos em XML. Usamos uma varredura por code point em vez de regex para não
// disparar a regra no-control-regex do ESLint.
const hasIllegalXmlChars = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    const isAllowedWhitespace = code === 0x09 || code === 0x0a || code === 0x0d;
    if (code < 0x20 && !isAllowedWhitespace) return true;
  }
  return false;
};

/**
 * Confere se o texto é XML bem formado usando uma verificação de estrutura de
 * tags (sem parser externo). Cobre os casos que importam aqui: raiz única,
 * tags balanceadas, atributos entre aspas e ausência de lixo fora dos elementos.
 */
const isWellFormedXml = (text: string): boolean => {
  const stack: string[] = [];
  let hasRoot = false;
  let index = 0;
  const length = text.length;

  while (index < length) {
    const open = text.indexOf('<', index);

    if (open === -1) {
      // Texto restante fora de tags: só espaços são permitidos.
      return stack.length === 0 && text.slice(index).trim().length === 0;
    }

    // Conteúdo de texto entre tags não pode conter `<` "soltos" — o indexOf já
    // garante isso; apenas checamos que o que sobra não é lixo após o fim.
    if (open > index) {
      const between = text.slice(index, open);
      if (stack.length === 0 && between.trim().length > 0) return false; // lixo antes da raiz
      if (hasIllegalXmlChars(between)) return false;
    }

    const close = text.indexOf('>', open);
    if (close === -1) return false; // tag não terminada

    const inner = text.slice(open + 1, close).trim();

    if (inner.length === 0) return false; // "<>"

    // Declaração XML `<?xml ... ?>` ou processing instruction `<?...?>`.
    if (inner.startsWith('?')) {
      if (!inner.endsWith('?')) return false;
      index = close + 1;
      continue;
    }

    // CDATA `<![CDATA[ ... ]]>`, DOCTYPE `<!DOCTYPE ...>` ou comentário.
    if (inner.startsWith('!')) {
      if (inner.startsWith('![CDATA[')) {
        const cdataEnd = text.indexOf(']]>', open + 9);
        if (cdataEnd === -1) return false;
        if (stack.length === 0) return false; // CDATA fora de um elemento
        index = cdataEnd + 3;
        continue;
      }

      // DOCTYPE e comentários são apenas pulados (não criam elementos).
      index = close + 1;
      continue;
    }

    if (inner.startsWith('/')) {
      // Tag de fechamento.
      const name = inner.slice(1).trim();
      if (!/^[^\s/]+$/.test(name)) return false; // "</a b>" inválido
      if (stack.pop() !== name) return false; // fechamento fora de ordem
      index = close + 1;
      continue;
    }

    // Tag de abertura: valida o nome e a forma dos atributos.
    const selfClosing = inner.endsWith('/');
    const tagBody = selfClosing ? inner.slice(0, -1).trim() : inner;
    const nameMatch = /^[^\s/>]+/.exec(tagBody);
    if (!nameMatch) return false;

    const name = nameMatch[0];
    if (name.startsWith('?') || name.startsWith('!') || name.startsWith('/')) return false;

    // Atributos precisam estar como nome="valor" (aspas simples ou duplas).
    const attributes = tagBody.slice(name.length).trim();
    if (attributes.length > 0) {
      const attributePattern = /^[^\s=]+="[^"]*"(\s+[^\s=]+="[^"]*")*$/;
      const singleQuotePattern = /^[^\s=]+='[^']*'(\s+[^\s=]+='[^']*')*$/;
      if (!attributePattern.test(attributes) && !singleQuotePattern.test(attributes)) return false;
    }

    if (stack.length === 0) {
      if (hasRoot) return false; // segunda raiz
      hasRoot = true;
    }

    if (!selfClosing) stack.push(name);
    index = close + 1;
  }

  return hasRoot && stack.length === 0;
};

/**
 * Valida o buffer recebido como XML bem formado e retorna o texto.
 *
 * Rejeita arquivo vazio, conteúdo que não é XML e XML malformado — sempre com o
 * padrão de erro da API (`badRequest`).
 */
export const validateNfeXml = (buffer: Buffer): string => {
  if (!buffer || buffer.length === 0) {
    throw badRequest('XML file is empty', 'EMPTY_NFE_FILE');
  }

  const text = buffer.toString('utf8');

  if (text.trim().length === 0) {
    throw badRequest('XML file is empty', 'EMPTY_NFE_FILE');
  }

  if (hasIllegalXmlChars(text)) {
    throw badRequest('File content is not a valid XML', 'INVALID_NFE_CONTENT');
  }

  // A verificação de estrutura já rejeita texto que não começa como XML.
  if (!isWellFormedXml(text)) {
    throw badRequest('File content is not a valid XML', 'INVALID_NFE_CONTENT');
  }

  return text;
};
