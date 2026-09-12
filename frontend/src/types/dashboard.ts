export interface DashboardSummary {
  totalPurchases: number
  totalWarranties: number
  activeWarranties: number
  totalSpent: string // Formato decimal com duas casas decimais: "0.00"
}

export interface ExpiringWarranty {
  purchaseId: string
  productName: string
  brand: string | null
  model: string | null
  startDate: string | Date
  endDate: string | Date
  daysRemaining: number
}

export interface RecentPurchase {
  id: string
  productName: string
  brand: string | null
  model: string | null
  store: string | null
  purchaseDate: string | Date
  price: string // Formato decimal: "4999.90"
  category: string | null
}

export interface DashboardResponse {
  dashboard: {
    summary: DashboardSummary
    expiringWarranties: ExpiringWarranty[]
    recentPurchases: RecentPurchase[]
  }
}
