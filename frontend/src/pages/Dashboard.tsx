import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShoppingBag,
  ShieldCheck,
  AlertTriangle,
  Receipt,
  CheckCircle2,
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
import { getDashboard, AuthenticationError, ApiError } from '../lib/api.ts'
import { useAuth } from '../contexts/auth-context.ts'
import { formatCurrencyBRL } from '../lib/formatters.ts'
import type { DashboardResponse } from '../types/dashboard.ts'
import { PageHeader } from '../components/ui'

type DashboardData = DashboardResponse['dashboard']

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; message: string; isAuthError: boolean }
  | { status: 'success'; data: DashboardData }

const SUBTITLE = 'Acompanhe suas compras e garantias em um só lugar.'

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
    <div className="space-y-6 sm:space-y-8">
      {/* 1. Header do conteúdo com Saudação e Ações Rápidas */}
      <PageHeader
        title={greetingName ? `${greeting}, ${greetingName}` : greeting}
        description={SUBTITLE}
        actions={<DashboardActions onImportXml={() => setIsXmlImportOpen(true)} />}
      />

      {importSuccess && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
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
          <DashboardContent data={state.data} />
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

function DashboardContent({ data }: { data: DashboardData }) {
  const { summary, expiringWarranties, recentPurchases } = data
  return (
    <>
      {/* 2. Grid de 4 Cards de Resumo */}
      <section
        aria-label="Indicadores principais"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <SummaryCard
          title="Compras cadastradas"
          value={String(summary.totalPurchases)}
          subtitle="Total de itens registrados"
          icon={ShoppingBag}
        />
        <SummaryCard
          title="Garantias ativas"
          value={String(summary.activeWarranties)}
          subtitle={`${summary.totalWarranties} garantias no total`}
          icon={ShieldCheck}
        />
        <SummaryCard
          title="Vencendo em breve"
          value={String(expiringWarranties.length)}
          subtitle="Próximos 30 dias"
          icon={AlertTriangle}
          variant="warning"
        />
        <SummaryCard
          title="Total gasto"
          value={formatCurrencyBRL(summary.totalSpent)}
          subtitle="Em bens sob garantia"
          icon={Receipt}
        />
      </section>

      {/* 3. Área Central: Compras recentes (coluna maior) + Garantias próximas & Dica (coluna lateral) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Coluna principal (2/3 em desktop) */}
        <section aria-label="Compras recentes" className="lg:col-span-2">
          <RecentPurchases purchases={recentPurchases} />
        </section>

        {/* Coluna lateral (1/3 em desktop) */}
        <section
          aria-label="Garantias próximas e dicas"
          className="space-y-6 lg:col-span-1"
        >
          <ExpiringWarrantyCard warranties={expiringWarranties} />
          <GuaranteeTip />
        </section>
      </div>
    </>
  )
}
