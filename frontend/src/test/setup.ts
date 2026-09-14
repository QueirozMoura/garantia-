import { afterEach, vi } from 'vitest'

// Estado limpo e isolado entre testes: nenhum teste deve herdar token, mock de
// fetch ou timers do teste anterior.
afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
