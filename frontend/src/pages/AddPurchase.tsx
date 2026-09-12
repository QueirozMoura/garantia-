import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { PurchaseForm } from '../components/purchases/PurchaseForm.tsx'
import { EMPTY_PURCHASE_FIELDS } from '../components/purchases/purchase-form.ts'
import { createPurchase, AuthenticationError, ApiError } from '../lib/api.ts'
import { useAuth } from '../contexts/auth-context.ts'
import type { CreatePurchaseInput } from '../types/purchase.ts'

const FALLBACK_ERROR = 'Não foi possível cadastrar a compra. Tente novamente.'

export function AddPurchase() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  async function handleSubmit(payload: CreatePurchaseInput) {
    setFormError(null)
    setIsSubmitting(true)
    try {
      await createPurchase(payload)
      // Só considera a compra criada após resposta bem-sucedida da API.
      setIsSuccess(true)
      navigate('/purchases', { replace: true })
    } catch (error) {
      if (error instanceof AuthenticationError) {
        // Token inválido/expirado: segue o padrão global e volta ao login.
        setUser(null)
        navigate('/login', { replace: true })
        return
      }
      // Mensagem amigável; nunca expõe stack trace ou detalhes internos.
      const message = error instanceof ApiError ? error.message : FALLBACK_ERROR
      setFormError(message)
      setIsSubmitting(false)
    }
  }
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header do conteúdo */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Adicionar compra
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Cadastre os dados do produto para acompanhar a garantia depois.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/purchases')}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:text-sm"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Voltar</span>
        </button>
      </section>

      <div className="rounded-xl border-slate-200 bg-white p-5 sm:p-6">
        {isSuccess && (
          <div
            role="status"
            className="mb-5 flex items-start gap-2.5 rounded-lg border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-700"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Compra cadastrada com sucesso! Redirecionando…</span>
          </div>
        )}

        <PurchaseForm
          initialFields={EMPTY_PURCHASE_FIELDS}
          submitLabel="Salvar compra"
          formError={formError}
          isSubmitting={isSubmitting}
          isSuccess={isSuccess}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/purchases')}
        />
      </div>
    </div>
  )
}
