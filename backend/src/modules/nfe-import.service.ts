import { XMLParser, XMLValidator } from 'fast-xml-parser';

import { badRequest } from '../utils/http-error.js';

/**
 * Leitura e extração dos dados de uma NF-e (padrão brasileiro, modelo 55/65).
 *
 * O parsing usa `fast-xml-parser` (biblioteca madura, sem dependências
 * nativas). Segurança do parsing:
 *   - `processEntities: false` — nenhuma entidade é expandida;
 *   - `htmlEntities: false` — nenhum mapeamento de entidades HTML;
 *   - DOCTYPE/ENTITY são rejeitados antes de chegar ao parser (anti-XXE).
 *
 * Nada aqui persiste dados, cria compra/garantia ou chama IA: apenas lê o
 * conteúdo em memória e devolve um objeto normalizado.
 */
export interface NfeInvoiceItem {
  code: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  ncm: string | null;
}

export interface NfeInvoiceIssuer {
  name: string;
  tradeName: string | null;
  cnpj: string;
}

export interface NfeInvoice {
  accessKey: string | null;
  number: string;
  series: string;
  issuedAt: string;
  issuer: NfeInvoiceIssuer;
  total: number;
  items: NfeInvoiceItem[];
}

type XmlNode = Record<string, unknown>;

const isObject = (value: unknown): value is XmlNode =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Converte um valor extraído pelo parser em string segura. O parser roda com
 * `parseTagValue: false`/`parseAttributeValue: false`, então os valores são
 * strings; ainda assim normalizamos números por robustez.
 */
const asText = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};

/** Retorna o nó filho como objeto, ou `null` se não existir/não for objeto. */
const child = (node: XmlNode | null, key: string): XmlNode | null => {
  if (!node) return null;
  const value = node[key];
  return isObject(value) ? value : null;
};

/** Normaliza um campo que pode vir como objeto único ou array (`det`). */
const asArray = (value: unknown): XmlNode[] => {
  if (Array.isArray(value)) return value.filter(isObject);
  if (isObject(value)) return [value];
  return [];
};

/**
 * Converte um valor monetário/quantidade em número. Aceita ponto ou vírgula
 * como separador decimal; rejeita valores não numéricos em vez de inventar.
 */
const asNumber = (value: unknown, field: string): number => {
  const raw = asText(value);
  if (raw === null) {
    throw badRequest(`NF-e field "${field}" is missing or invalid`, 'INVALID_NFE_DATA');
  }

  const parsed = Number(raw.replace(/\s/g, '').replace(',', '.'));

  if (!Number.isFinite(parsed)) {
    throw badRequest(`NF-e field "${field}" is not a valid number`, 'INVALID_NFE_DATA');
  }

  return parsed;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  // Mantém TODOS os valores como string: evita perder zeros à direita em
  // preços/quantidades e evita que o CNPJ vire número (perdendo zeros à esquerda).
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  removeNSPrefix: true,
  // Segurança: sem expansão de entidades (anti-XXE / Billion Laughs).
  processEntities: false,
  htmlEntities: false,
});

/** Rejeita DOCTYPE/ENTITY antes do parser (defesa em profundidade contra XXE). */
const rejectDoctype = (text: string) => {
  if (/<!DOCTYPE/i.test(text) || /<!ENTITY/i.test(text)) {
    throw badRequest('XML with DTD/entity declarations is not supported', 'INVALID_NFE_CONTENT');
  }
};

/**
 * Navega até o nó `infNFe`, aceitando variações reais da estrutura:
 *   - `infNFe` como raiz (trecho isolado);
 *   - `NFe > infNFe` (NF-e sem protocolo);
 *   - `nfeProc > NFe > infNFe` (NF-e processada, com protocolo).
 * O parser roda com `removeNSPrefix`, então namespaces já foram removidos.
 */
const findInfNFe = (root: XmlNode): XmlNode | null => {
  const direct = child(root, 'infNFe');
  if (direct) return direct;

  const fromNfe = child(child(root, 'NFe'), 'infNFe');
  if (fromNfe) return fromNfe;

  const nfeProc = child(root, 'nfeProc');
  const fromProc = child(child(nfeProc, 'NFe'), 'infNFe');
  if (fromProc) return fromProc;

  return null;
};

const buildIssuer = (infNFe: XmlNode): NfeInvoiceIssuer => {
  const emit = child(infNFe, 'emit');
  const name = asText(emit?.xNome);
  const cnpj = asText(emit?.CNPJ);

  if (!name || !cnpj) {
    throw badRequest('NF-e issuer (emit) is missing required fields', 'INVALID_NFE_DATA');
  }

  return { name, tradeName: asText(emit?.xFant), cnpj };
};

const buildItems = (infNFe: XmlNode): NfeInvoiceItem[] => {
  const items = asArray(infNFe.det).map((det) => {
    const prod = child(det, 'prod');

    if (!prod) {
      throw badRequest('NF-e item is missing its product data', 'INVALID_NFE_DATA');
    }

    const code = asText(prod.cProd);
    const description = asText(prod.xProd);

    if (!code || !description) {
      throw badRequest('NF-e item is missing required fields (cProd/xProd)', 'INVALID_NFE_DATA');
    }

    return {
      code,
      description,
      quantity: asNumber(prod.qCom, 'qCom'),
      unit: asText(prod.uCom) ?? '',
      unitPrice: asNumber(prod.vUnCom, 'vUnCom'),
      totalPrice: asNumber(prod.vProd, 'vProd'),
      ncm: asText(prod.NCM),
    };
  });

  if (items.length === 0) {
    throw badRequest('NF-e has no items (det)', 'INVALID_NFE_DATA');
  }

  return items;
};

const buildTotal = (infNFe: XmlNode): number => {
  const icmsTot = child(child(infNFe, 'total'), 'ICMSTot');

  if (icmsTot?.vNF === undefined) {
    throw badRequest('NF-e total (total.ICMSTot.vNF) is missing', 'INVALID_NFE_DATA');
  }

  return asNumber(icmsTot.vNF, 'vNF');
};

/**
 * Valida o buffer como XML e extrai os dados da NF-e.
 *
 * Lança `badRequest` em todos os casos de entrada inválida:
 *   - arquivo vazio → `EMPTY_NFE_FILE`;
 *   - conteúdo não é XML bem formado → `INVALID_NFE_CONTENT`;
 *   - XML válido, mas sem estrutura de NF-e → `UNSUPPORTED_NFE_DOCUMENT`;
 *   - NF-e reconhecida, mas com dados obrigatórios ausentes/inválidos →
 *     `INVALID_NFE_DATA`.
 */
export const extractNfeInvoice = (buffer: Buffer): NfeInvoice => {
  if (!buffer || buffer.length === 0) {
    throw badRequest('XML file is empty', 'EMPTY_NFE_FILE');
  }

  const text = buffer.toString('utf8');

  if (text.trim().length === 0) {
    throw badRequest('XML file is empty', 'EMPTY_NFE_FILE');
  }

  rejectDoctype(text);

  if (XMLValidator.validate(text) !== true) {
    throw badRequest('File content is not a valid XML', 'INVALID_NFE_CONTENT');
  }

  let parsed: unknown;
  try {
    parsed = parser.parse(text);
  } catch {
    // Configuração sem entidades: entradas exóticas são rejeitadas como conteúdo
    // inválido em vez de vazar detalhes internos do parser.
    throw badRequest('File content is not a valid XML', 'INVALID_NFE_CONTENT');
  }

  if (!isObject(parsed)) {
    throw badRequest(
      'The document does not look like a supported NF-e',
      'UNSUPPORTED_NFE_DOCUMENT',
    );
  }

  const infNFe = findInfNFe(parsed);

  if (!infNFe) {
    // XML válido, mas sem a estrutura de NF-e esperada.
    throw badRequest(
      'The document does not look like a supported NF-e',
      'UNSUPPORTED_NFE_DOCUMENT',
    );
  }

  const ide = child(infNFe, 'ide');
  const idAttribute = asText(infNFe.Id);

  // A chave de acesso vem no atributo Id como "NFe<44 dígitos>". É opcional.
  const accessKey = idAttribute ? idAttribute.replace(/^NFe/i, '').trim() || null : null;

  const number = asText(ide?.nNF) ?? '';
  const series = asText(ide?.serie) ?? '';
  const issuedAt = asText(ide?.dhEmi) ?? asText(ide?.dEmi) ?? '';

  if (!number) {
    throw badRequest('NF-e number (ide.nNF) is missing', 'INVALID_NFE_DATA');
  }

  if (!issuedAt) {
    throw badRequest('NF-e issue date (ide.dhEmi/dEmi) is missing', 'INVALID_NFE_DATA');
  }

  return {
    accessKey,
    number,
    series,
    issuedAt,
    issuer: buildIssuer(infNFe),
    total: buildTotal(infNFe),
    items: buildItems(infNFe),
  };
};
