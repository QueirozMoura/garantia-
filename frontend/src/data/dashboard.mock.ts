export interface DashboardSummary {
  totalPurchases: {
    label: string
    value: string
    change?: string
  }
  activeWarranties: {
    label: string
    value: string
    subtitle?: string
  }
  expiringSoon: {
    label: string
    value: string
    subtitle?: string
    isWarning?: boolean
  }
  totalSpent: {
    label: string
    value: string
    subtitle?: string
  }
}

export interface ExpiringWarranty {
  id: string
  productName: string
  brandModel?: string
  expiresAt: string // DD/MM/AAAA formatado
  daysRemaining: number
  category?: string
}

export interface RecentPurchase {
  id: string
  productName: string
  store: string
  purchaseDate: string // DD/MM/AAAA
  amount: string
  warrantyStatus: 'active' | 'expiring' | 'expired'
  warrantyLabel: string
}

export interface DashboardData {
  userName: string
  greeting: string
  subtitle: string
  summary: DashboardSummary
  expiringWarranties: ExpiringWarranty[]
  recentPurchases: RecentPurchase[]
  tip: {
    title: string
    content: string
  }
}

export const DASHBOARD_MOCK: DashboardData = {
  userName: 'Gustavo',
  greeting: 'Bom dia, Gustavo',
  subtitle: 'Acompanhe suas compras e garantias em um só lugar.',
  summary: {
    totalPurchases: {
      label: 'Compras cadastradas',
      value: '12',
      change: '+3 este mês',
    },
    activeWarranties: {
      label: 'Garantias ativas',
      value: '8',
      subtitle: 'Com cobertura vigente',
    },
    expiringSoon: {
      label: 'Vencendo em breve',
      value: '2',
      subtitle: 'Próximos 30 dias',
      isWarning: true,
    },
    totalSpent: {
      label: 'Total gasto',
      value: 'R$ 8.450,90',
      subtitle: 'Em bens sob garantia',
    },
  },
  expiringWarranties: [
    {
      id: 'w-1',
      productName: 'Notebook Dell XPS',
      brandModel: 'Dell XPS 13 Plus (i7, 32GB)',
      expiresAt: '25/09/2026',
      daysRemaining: 14,
      category: 'Informática',
    },
    {
      id: 'w-2',
      productName: 'Geladeira Brastemp',
      brandModel: 'Brastemp Frost Free Duplex 375L',
      expiresAt: '12/10/2026',
      daysRemaining: 31,
      category: 'Eletrodomésticos',
    },
    {
      id: 'w-3',
      productName: 'Máquina de lavar Electrolux',
      brandModel: 'Electrolux Premium Care 11kg',
      expiresAt: '04/11/2026',
      daysRemaining: 54,
      category: 'Eletrodomésticos',
    },
  ],
  recentPurchases: [
    {
      id: 'p-1',
      productName: 'Notebook Dell XPS',
      store: 'Dell Store Oficial',
      purchaseDate: '25/09/2025',
      amount: 'R$ 4.999,90',
      warrantyStatus: 'expiring',
      warrantyLabel: '14 dias restantes',
    },
    {
      id: 'p-2',
      productName: 'Geladeira Brastemp',
      store: 'Fast Shop',
      purchaseDate: '12/10/2025',
      amount: 'R$ 2.899,00',
      warrantyStatus: 'active',
      warrantyLabel: 'Garantia ativa',
    },
    {
      id: 'p-3',
      productName: 'Máquina de lavar Electrolux',
      store: 'Magazine Luiza',
      purchaseDate: '04/11/2025',
      amount: 'R$ 1.799,90',
      warrantyStatus: 'active',
      warrantyLabel: 'Garantia ativa',
    },
    {
      id: 'p-4',
      productName: 'Monitor LG UltraGear',
      store: 'Kabum!',
      purchaseDate: '15/01/2026',
      amount: 'R$ 1.249,90',
      warrantyStatus: 'active',
      warrantyLabel: 'Garantia ativa',
    },
  ],
  tip: {
    title: 'Dica do Garantia+',
    content:
      'Guarde suas notas fiscais. Elas podem ser necessárias para acionar a garantia ou solicitar assistência.',
  },
}
