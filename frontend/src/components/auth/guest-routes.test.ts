import { describe, expect, it } from 'vitest'
import { isGuestAccessiblePath } from './guest-routes.ts'

describe('isGuestAccessiblePath', () => {
  it.each([
    '/dashboard',
    '/purchases',
    '/purchases/new',
    '/warranties',
    '/documents',
    '/alerts',
  ])('considera %s acessível a guest', (path) => {
    expect(isGuestAccessiblePath(path)).toBe(true)
  })

  it.each([
    '/purchases/purchase-42',
    '/purchases/purchase-42/edit',
    '/purchases/new/confirm',
    '/login',
    '/register',
  ])('considera %s NÃO acessível a guest', (path) => {
    expect(isGuestAccessiblePath(path)).toBe(false)
  })

  it('não confunde uma compra específica com a rota `new`', () => {
    expect(isGuestAccessiblePath('/purchases/new')).toBe(true)
    expect(isGuestAccessiblePath('/purchases/newest')).toBe(false)
  })
})
