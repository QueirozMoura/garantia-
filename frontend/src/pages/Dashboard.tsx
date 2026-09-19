import { useCallback, useEffect, useState } from 'react'
import {
  Link,
  type Location as RouterLocation,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import {
  ShoppingBag,
  ShieldCheck,
  AlertTriangle,
  Receipt,
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
import { FeedbackMessage } from '../components/ui'
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
  const location = useLocation()
  const { user, status, expireSession } = useAuth()
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
      // Sem sessão (guest/loading): nada de fetch privado e nenhum dado antigo
      // do usuário anterior pode permanecer na tela.
      if (status !== 'authenticated') {
        setState({ status: 'loading' })
        return
      }
      try {
        const data = await getDashboard()
        if (isActive) setState({ status: 'success', data })
      } catch (error) {
        if (!isActive) return
        if (error instanceof AuthenticationError) {
          // Token inválido/expirado: consolida o estado visitante e volta ao login.
          expireSession()
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
  }, [reloadKey, navigate, expireSession, status])

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

  if (status === 'guest') {
    return <GuestDashboard from={location} />
  }

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
          <FileText className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
          <span className="min-w-0 flex-1 break-words">
            Seus documentos e prazos importantes, sempre à vista.
          </span>
          <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        </div>
      </section>

      {importSuccess && (
        <FeedbackMessage
          variant="success"
          message="Compra cadastrada a partir da NF-e com sucesso!"
        />
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

function GuestDashboard({ from }: { from: RouterLocation }) {
  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="dashboard-hero relative isolate overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950 px-6 py-8 text-white shadow-[0_24px_60px_-36px_rgb(15_23_42/0.7)] sm:px-9 sm:py-10">
        <div className="surface-grid absolute inset-0 -z-10 opacity-20 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="absolute -right-20 -top-24 -z-10 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative max-w-2xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-bold tracking-[0.18em] text-emerald-200 uppercase">
            <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
            Exploração segura
          </p>
          <h2 className="max-w-xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            Organize suas compras. Proteja suas garantias.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
            Conheça o Garantia+ e explore o produto como visitante. Entre ou crie uma
            conta quando quiser acessar seus dados e recursos pessoais.
          </p>
          <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              to="/login"
              state={{ from }}
              className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:w-auto"
            >
              Entrar
            </Link>
            <Link
              to="/register"
              state={{ from }}
              className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border-white/15 bg-white/[0.06] px-4 text-sm font-semibold text-white transition-colors hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:w-auto"
            >
              Criar conta
            </Link>
          </div>
        </div>
      </section>
      <section aria-label="Recursos do Garantia+" className="grid gap-4 md:grid-cols-3">
        <GuestFeature
          icon={ShoppingBag}
          title="Compras organizadas"
          text="Mantenha produtos, valores e datas reunidos em um só lugar."
        />
        <GuestFeature
          icon={ShieldCheck}
          title="Garantias sob controle"
          text="Acompanhe prazos importantes antes que eles passem."
        />
        <GuestFeature
          icon={FileText}
          title="Documentos acessíveis"
          text="Tenha notas fiscais e comprovantes disponíveis quando precisar."
        />
      </section>
    </div>
  )
}

function GuestFeature({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof ShoppingBag
  title: string
  text: string
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_16px_40px_-32px_rgb(15_23_42/0.55)] transition-[border-color,box-shadow] duration-200 hover:border-emerald-100 hover:shadow-[0_20px_42px_-32px_rgb(15_23_42/0.45)]">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
    </article>
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
          className="lg:col-span-3"
        />
        <SummaryCard
          title="Garantias ativas"
          value={String(summary.activeWarranties)}
          subtitle={`${summary.totalWarranties} garantias no total`}
          icon={ShieldCheck}
          variant="protection"
          className="lg:col-span-3"
        />
        <SummaryCard
          title="Vencendo em breve"
          value={String(expiringWarranties.length)}
          subtitle="Próximos 30 dias"
          icon={AlertTriangle}
          variant="warning"
          className="lg:col-span-3"
        />
        <SummaryCard
          title="Total gasto"
          value={formatCurrencyBRL(summary.totalSpent)}
          subtitle="Em bens sob garantia"
          icon={Receipt}
          variant="spending"
          className="lg:col-span-3"
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
