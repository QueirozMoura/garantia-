import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShoppingBag,
  ShieldCheck,
  AlertTriangle,
  Receipt,
  CheckCircle2,
  ArrowRight,
  FileText,
  LockKeyhole,
} from 'lucide-react'
import { SummaryCard } from '../components/dashboard/SummaryCard.tsx'
import { ExpiringWarrantyCard } from '../components/dashboard/ExpiringWarrantyCard.tsx'
import { RecentPurchases } from '../components/dashboard/RecentPurchases.tsx'
import { GuaranteeTip } from '../components/dashboard/GuaranteeTip.tsx'
import { DashboardActions } from '../components/dashboard/DashboardActions.tsx'
import { DashboardSkeleton } from '../components/dashboard/DashboardSkeleton.tsx'
import { DashboardErrorState } from '../components/dashboard/DashboardErrorState.tsx'
import { DashboardEmptyState } from '../components/dashboard/DashboardEmptyState.tsx'
import { XmlImportDialog } from '../components/dashboard/XmlImportDialog.tsx'
import { DashboardImportCard } from '../components/dashboard/DashboardImportCard.tsx'
import { getDashboard, AuthenticationError, ApiError } from '../lib/api.ts'
import { useAuth } from '../contexts/auth-context.ts'
import { formatCurrencyBRL } from '../lib/formatters.ts'
import type { DashboardResponse } from '../types/dashboard.ts'

type DashboardData = DashboardResponse['dashboard']

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; message: string; isAuthError: boolean }
  | { status: 'success'; data: DashboardData }

const SUBTITLE = 'Tenha controle das suas compras, garantias e documentos em um só lugar.'

function isEmptyDashboard(data: DashboardData): boolean {
  const { summary, expiringWarranties, recentPurchases } = data
  return (
    summary.totalPurchases === 0 &&
    summary.totalWarranties === 0 &&
    summary.activeWarranties === 0 &&
    expiringWarranties.length === 0 &&
    recentPurchases.length === 0
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function Dashboard() {
  const navigate = useNavigate()
  const { user, setUser } = useAuth()
  const greetingName = user?.name?.trim() || user?.email?.trim() || ''
  const greeting = getGreeting()
  const [state, setState] = useState<FetchState>({ status: 'loading' })

  const [reloadKey, setReloadKey] = useState(0)
  const [isXmlImportOpen, setIsXmlImportOpen] = useState(false)
  // Confirmação exibida após cadastrar uma compra via importação de NF-e.
  const [importSuccess, setImportSuccess] = useState(false)

  useEffect(() => {
    let isActive = true
    const load = async () => {
      try {
        const data = await getDashboard()
        if (isActive) setState({ status: 'success', data })
      } catch (error) {
        if (!isActive) return
        if (error instanceof AuthenticationError) {
          // Token inválido/expirado: encerra a sessão global e volta ao login.
          setUser(null)
          navigate('/login', { replace: true })
          return
        }
        const message =
          error instanceof ApiError
            ? error.message
            : 'Não foi possível carregar seus dados. Tente novamente em instantes.'
        setState({ status: 'error', message, isAuthError: false })
      }
    }

    void load()

    return () => {
      isActive = false
    }
  }, [reloadKey, navigate, setUser])

  const handleRetry = useCallback(() => {
    setState({ status: 'loading' })
    setReloadKey((key) => key + 1)
  }, [])

  // Após cadastrar a compra pelo modal de NF-e: revalida a Dashboard (o efeito
  // roda de novo via reloadKey) e mostra a confirmação de sucesso.
  const handlePurchaseCreated = useCallback(() => {
    setImportSuccess(true)
    setReloadKey((key) => key + 1)
  }, [])

  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="dashboard-hero relative isolate overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950 px-6 py-7 text-white shadow-[0_24px_60px_-36px_rgb(15_23_42/0.7)] sm:px-9 sm:py-9">
        <div className="surface-grid absolute inset-0 -z-10 opacity-20 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="absolute -right-20 -top-24 -z-10 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute bottom-[-5rem] right-[18%] -z-10 h-40 w-40 rounded-full border border-emerald-300/10" />
        <div className="absolute bottom-[-6rem] right-[10%] -z-10 h-56 w-56 rounded-full border border-white/5" />

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-bold tracking-[0.18em] text-emerald-200 uppercase">
              <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
              Controle protegido
            </div>
            <h2 className="max-w-xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              {greetingName ? `${greeting}, ${greetingName}` : greeting}
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-slate-300 sm:text-base">
              {SUBTITLE}
            </p>
          </div>
          <DashboardActions onImportXml={() => setIsXmlImportOpen(true)} />
        </div>

        <div className="relative mt-8 flex items-center gap-3 border-t border-white/10 pt-4 text-xs text-slate-400">
          <FileText className="h-4 w-4 text-emerald-300" aria-hidden="true" />
          <span>Seus documentos e prazos importantes, sempre à vista.</span>
          <ArrowRight className="ml-auto h-4 w-4 text-slate-500" aria-hidden="true" />
        </div>
      </section>

      {importSuccess && (
        <div
          role="status"
          className="animate-slide-up flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800 shadow-sm"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Compra cadastrada a partir da NF-e com sucesso!</span>
        </div>
      )}

      {state.status === 'loading' && <DashboardSkeleton />}

      {state.status === 'error' && (
        <DashboardErrorState
          message={state.message}
          isAuthError={state.isAuthError}
          onRetry={handleRetry}
        />
      )}

      {state.status === 'success' &&
        (isEmptyDashboard(state.data) ? (
          <DashboardEmptyState onImportXml={() => setIsXmlImportOpen(true)} />
        ) : (
          <DashboardContent
            data={state.data}
            onImportXml={() => setIsXmlImportOpen(true)}
          />
        ))}

      {isXmlImportOpen && (
        <XmlImportDialog
          onClose={() => setIsXmlImportOpen(false)}
          onCreated={handlePurchaseCreated}
        />
      )}
    </div>
  )
}

function DashboardContent({
  data,
  onImportXml,
}: {
  data: DashboardData
  onImportXml: () => void
}) {
  const { summary, expiringWarranties, recentPurchases } = data
  return (
    <>
      {/* 2. Grid de 4 Cards de Resumo */}
      <section
        aria-label="Indicadores principais"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12"
      >
        <SummaryCard
          title="Compras cadastradas"
          value={String(summary.totalPurchases)}
          subtitle="Total de itens registrados"
          icon={ShoppingBag}
          className="lg:col-span-2"
        />
        <SummaryCard
          title="Garantias ativas"
          value={String(summary.activeWarranties)}
          subtitle={`${summary.totalWarranties} garantias no total`}
          icon={ShieldCheck}
          variant="protection"
          className="lg:col-span-2"
        />
        <SummaryCard
          title="Vencendo em breve"
          value={String(expiringWarranties.length)}
          subtitle="Próximos 30 dias"
          icon={AlertTriangle}
          variant="warning"
          className="lg:col-span-2"
        />
        <SummaryCard
          title="Total gasto"
          value={formatCurrencyBRL(summary.totalSpent)}
          subtitle="Em bens sob garantia"
          icon={Receipt}
          variant="spending"
          className="lg:col-span-6"
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section aria-label="Garantias próximas" className="lg:col-span-5">
          <ExpiringWarrantyCard warranties={expiringWarranties} />
        </section>
        <section aria-label="Compras recentes" className="lg:col-span-7">
          <RecentPurchases purchases={recentPurchases} />
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section aria-label="Importação de nota fiscal" className="lg:col-span-7">
          <DashboardImportCard onImportXml={onImportXml} />
        </section>
        <section aria-label="Dica de garantia" className="lg:col-span-5">
          <GuaranteeTip />
        </section>
      </div>
    </>
  )
}
