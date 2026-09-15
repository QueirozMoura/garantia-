import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { WarrantiesSummary } from '../components/warranties/WarrantiesSummary.tsx'
import { WarrantyCard } from '../components/warranties/WarrantyCard.tsx'
import { WarrantiesSkeleton } from '../components/warranties/WarrantiesSkeleton.tsx'
import { WarrantiesEmptyState } from '../components/warranties/WarrantiesEmptyState.tsx'
import { WarrantiesErrorState } from '../components/warranties/WarrantiesErrorState.tsx'
import { getWarranties, AuthenticationError, ApiError } from '../lib/api.ts'
import { useAuth } from '../contexts/auth-context.ts'
import { GuestAccessState } from '../components/auth/GuestAccessState.tsx'
import type { WarrantyWithPurchase } from '../types/warranty.ts'
import { ShieldCheck, Shield } from 'lucide-react'

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; warranties: WarrantyWithPurchase[] }

const TITLE = 'Garantias'
const FALLBACK_ERROR = 'Não foi possível carregar suas garantias.'

export function Warranties() {
  const navigate = useNavigate()
  const { status, setUser } = useAuth()
  const [state, setState] = useState<FetchState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let isActive = true
    const load = async () => {
      if (status !== 'authenticated') return
      try {
        const warranties = await getWarranties()
        if (isActive) setState({ status: 'success', warranties })
      } catch (error) {
        if (!isActive) return
        if (error instanceof AuthenticationError) {
          // Token inválido/expirado: encerra a sessão global e volta ao login.
          setUser(null)
          navigate('/login', { replace: true })
          return
        }
        const message = error instanceof ApiError ? error.message : FALLBACK_ERROR
        setState({ status: 'error', message })
      }
    }

    void load()

    return () => {
      isActive = false
    }
  }, [reloadKey, navigate, setUser, status])

  const handleRetry = useCallback(() => {
    setState({ status: 'loading' })
    setReloadKey((key) => key + 1)
  }, [])

  if (status === 'guest') {
    return (
      <div className="space-y-8 sm:space-y-10">
        <section className="relative isolate overflow-hidden rounded-[2rem] border-slate-800 bg-slate-950 px-6 py-7 text-white shadow-[0_24px_60px_-38px_rgb(15_23_42/0.75)] sm:px-9 sm:py-9">
          <p className="text-[10px] font-bold tracking-[0.18em] text-emerald-200 uppercase">
            Central de proteção
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            Garantias
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
            Acompanhe prazos e proteções importantes depois de entrar na sua conta.
          </p>
        </section>
        <GuestAccessState
          icon={ShieldCheck}
          title="Suas garantias ficam aqui."
          description="Entre ou crie uma conta para cadastrar compras e acompanhar prazos de garantia sem perder nenhuma data importante."
        />
      </div>
    )
  }

  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="relative isolate overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950 px-6 py-7 text-white shadow-[0_24px_60px_-38px_rgb(15_23_42/0.75)] sm:px-9 sm:py-9">
        <div className="surface-grid absolute inset-0 -z-10 opacity-20 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="absolute -right-20 -top-24 -z-10 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute bottom-[-5rem] right-[18%] -z-10 h-40 w-40 rounded-full border border-emerald-300/10" />
        <div className="absolute bottom-[-6rem] right-[10%] -z-10 h-56 w-56 rounded-full border border-white/5" />

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-bold tracking-[0.18em] text-emerald-200 uppercase">
              <Shield className="h-3.5 w-3.5" aria-hidden="true" />
              Central de proteção
            </div>
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              {TITLE}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
              Acompanhe tudo que ainda está protegido e saiba quando agir para não perder
              nenhum prazo.
            </p>
          </div>
          {state.status === 'success' && (
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
              <ShieldCheck className="h-5 w-5 text-emerald-300" aria-hidden="true" />
              <div>
                <p className="text-2xl font-semibold leading-none text-white">
                  {state.warranties.length}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {state.warranties.length === 1
                    ? 'garantia cadastrada'
                    : 'garantias cadastradas'}
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="relative mt-8 flex items-center gap-3 border-t border-white/10 pt-4 text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
          <span>Seus prazos importantes, organizados em um só lugar.</span>
        </div>
      </section>

      {state.status === 'loading' && <WarrantiesSkeleton />}

      {state.status === 'error' && (
        <WarrantiesErrorState message={state.message} onRetry={handleRetry} />
      )}

      {state.status === 'success' &&
        (state.warranties.length === 0 ? (
          <WarrantiesEmptyState />
        ) : (
          <>
            <WarrantiesSummary warranties={state.warranties} />

            <section aria-label="Lista de garantias" className="space-y-4">
              {state.warranties.map((warranty) => (
                <WarrantyCard key={warranty.id} warranty={warranty} />
              ))}
            </section>
          </>
        ))}
    </div>
  )
}
