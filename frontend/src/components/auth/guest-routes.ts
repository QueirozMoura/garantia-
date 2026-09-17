/**
 * Fonte única do que pode ser acessado no modo visitante.
 *
 * Usado para decidir o destino após o logout: se a rota atual é visitável por
 * guest, permanecemos nela (re-renderizando em estado visitante); caso contrário
 * enviamos ao login. A lista aqui é deliberadamente conservadora — é o espelho
 * das rotas públicas registradas em `App.tsx` (que NÃO usam `RequireAuth`).
 */
const GUEST_SAFE_PATTERNS: RegExp[] = [
  /^\/dashboard$/,
  /^\/purchases$/,
  // O formulário de compra é acessível a guest (rascunho local), mas as demais
  // rotas de `/purchases/...` (:id, :id/edit, new/confirm) seguem protegidas.
  /^\/purchases\/new$/,
  /^\/warranties$/,
  /^\/documents$/,
  /^\/alerts$/,
]

/**
 * `true` quando a rota atual pode continuar montada depois do logout.
 * Comparamos apenas o `pathname` (ignorando query string e hash).
 */
export function isGuestAccessiblePath(pathname: string): boolean {
  return GUEST_SAFE_PATTERNS.some((pattern) => pattern.test(pathname))
}
