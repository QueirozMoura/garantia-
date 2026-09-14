import type { SVGProps } from 'react'

/**
 * Identidade visual do Garantia+.
 *
 * O símbolo combina três ideias em uma forma única e legível em tamanhos
 * pequenos (sidebar e favicon): um ESCUDO (proteção), um DOCUMENTO com a dobra
 * no canto superior direito (organização de compras/garantias) e um CHECK
 * (confirmação). Tudo desenhado em um único traço, sem gradientes complexos,
 * usando `currentColor` para adotar a cor do contexto.
 */

export type BrandMarkSize = 'sm' | 'md' | 'lg'

const MARK_BOX: Record<BrandMarkSize, string> = {
  sm: 'h-8 w-8 rounded-lg',
  md: 'h-9 w-9 rounded-lg',
  lg: 'h-12 w-12 rounded-xl',
}

const MARK_ICON: Record<BrandMarkSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
}

export interface BrandSymbolProps extends SVGProps<SVGSVGElement> {
  /** Título acessível; quando omitido o SVG é decorativo (`aria-hidden`). */
  title?: string
}

/**
 * Símbolo da marca em SVG puro (sem imagem externa). Usa `currentColor`, então
 * herda a cor do elemento pai. Escudo com a dobra de documento e o check.
 */
export function BrandSymbol({ title, ...props }: BrandSymbolProps) {
  const decorative = title === undefined
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={title}
      {...props}
    >
      {title !== undefined && <title>{title}</title>}
      {/* Escudo: proteção que envolve o documento. */}
      <path
        d="M12 2.4 4.75 5.3v5.05c0 4.62 3.01 8.9 7.25 10.2 4.24-1.3 7.25-5.58 7.25-10.2V5.3L12 2.4Z"
        fill="currentColor"
        fillOpacity="0.18"
      />
      <path
        d="M12 2.4 4.75 5.3v5.05c0 4.62 3.01 8.9 7.25 10.2 4.24-1.3 7.25-5.58 7.25-10.2V5.3L12 2.4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Documento com dobra no canto (organização), contido no escudo. */}
      <path
        d="M9.9 8.4h2.5l2.5 2.5v4.2a.7.7 0 0 1-.7.7H9.9a.7.7 0 0 1-.7-.7V9.1a.7.7 0 0 1 .7-.7Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M12.4 8.4v2.5h2.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      {/* Check: confirmação/garantia efetivada, dentro do documento. */}
      <path
        d="m10.65 12.7 1.15 1.15 2.05-2.05"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export interface BrandMarkProps {
  size?: BrandMarkSize
  /** Cor do quadrado (fundo). Padrão: emerald da identidade atual. */
  boxClassName?: string
  className?: string
}

/**
 * Quadrado arredondado com o símbolo da marca — o "app icon" usado na sidebar,
 * no header mobile e nas telas de autenticação.
 */
export function BrandMark({
  size = 'md',
  boxClassName = 'bg-emerald-600 text-white shadow-xs',
  className = '',
}: BrandMarkProps) {
  return (
    <div
      className={`flex items-center justify-center ${MARK_BOX[size]} ${boxClassName} ${className}`}
    >
      <BrandSymbol className={MARK_ICON[size]} />
    </div>
  )
}

export interface BrandLogoProps {
  size?: BrandMarkSize
  /** Classes do texto da marca (permite ajustar tamanho por contexto). */
  textClassName?: string
  /** Orientação do conjunto símbolo + nome. */
  orientation?: 'horizontal' | 'vertical'
  className?: string
}

const TEXT_SIZE: Record<BrandMarkSize, string> = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-2xl',
}

/**
 * Assinatura completa da marca: símbolo + "Garantia+" com o "+" em destaque.
 * Reutilizada na sidebar, no header (mobile) e nas telas de login/registro,
 * preservando o layout existente de cada contexto.
 */
export function BrandLogo({
  size = 'md',
  textClassName,
  orientation = 'horizontal',
  className = '',
}: BrandLogoProps) {
  const layout =
    orientation === 'vertical'
      ? 'flex flex-col items-center text-center'
      : 'flex items-center gap-3'

  return (
    <span className={`${layout} ${className}`}>
      <BrandMark size={size} />
      <span
        className={`font-bold tracking-tight text-slate-900 ${TEXT_SIZE[size]} ${
          textClassName ?? ''
        }`}
      >
        Garantia
        <span className="text-emerald-600">+</span>
      </span>
    </span>
  )
}
