export function formatCurrencyBRL(value: string | number): string {
  const numericValue = typeof value === 'string' ? parseFloat(value) : value
  if (Number.isNaN(numericValue)) {
    return 'R$ 0,00'
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numericValue)
}

export function formatDateBR(dateInput: string | Date): string {
  if (!dateInput) return '-'
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  // Utiliza UTC para datas ISO (YYYY-MM-DD ou YYYY-MM-DDT00:00:00Z) para evitar drift de fuso
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}
