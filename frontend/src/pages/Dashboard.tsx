import { ShoppingBag, ShieldCheck, AlertTriangle, Receipt } from 'lucide-react'
import { DASHBOARD_MOCK } from '../data/dashboard.mock.ts'
import { SummaryCard } from '../components/dashboard/SummaryCard.tsx'
import { ExpiringWarrantyCard } from '../components/dashboard/ExpiringWarrantyCard.tsx'
import { RecentPurchases } from '../components/dashboard/RecentPurchases.tsx'
import { GuaranteeTip } from '../components/dashboard/GuaranteeTip.tsx'
import { DashboardActions } from '../components/dashboard/DashboardActions.tsx'

export function Dashboard() {
  const { greeting, subtitle, summary, expiringWarranties, recentPurchases, tip } =
    DASHBOARD_MOCK

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* 1. Header do conteúdo com Saudação e Ações Rápidas */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {greeting}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <DashboardActions />
      </section>

      {/* 2. Grid de 4 Cards de Resumo */}
      <section
        aria-label="Indicadores principais"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <SummaryCard
          title={summary.totalPurchases.label}
          value={summary.totalPurchases.value}
          subtitle={summary.totalPurchases.change}
          icon={ShoppingBag}
        />
        <SummaryCard
          title={summary.activeWarranties.label}
          value={summary.activeWarranties.value}
          subtitle={summary.activeWarranties.subtitle}
          icon={ShieldCheck}
        />
        <SummaryCard
          title={summary.expiringSoon.label}
          value={summary.expiringSoon.value}
          subtitle={summary.expiringSoon.subtitle}
          icon={AlertTriangle}
          variant="warning"
        />
        <SummaryCard
          title={summary.totalSpent.label}
          value={summary.totalSpent.value}
          subtitle={summary.totalSpent.subtitle}
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
          <GuaranteeTip title={tip.title} content={tip.content} />
        </section>
      </div>
    </div>
  )
}
