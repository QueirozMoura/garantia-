import { Skeleton, SkeletonCard, SkeletonText, SkeletonIcon } from '../ui'

export function PurchaseDetailsSkeleton() {
  return (
    <div
      className="space-y-6 sm:space-y-8"
      aria-busy="true"
      aria-label="Carregando detalhes da compra"
    >
      {/* Product Card Skeleton */}
      <SkeletonCard className="h-auto p-6 bg-white border-slate-200">
        <div className="flex items-start gap-5 border-b border-slate-100 pb-6">
          <SkeletonIcon className="h-16 w-16 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2 mt-2">
            <SkeletonText className="h-6 w-1/3" />
            <SkeletonText className="h-4 w-1/4" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 pt-6 md:grid-cols-2">
          {/* Compra */}
          <div className="space-y-4">
            <SkeletonText className="h-4 w-24 mb-2" />
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4"
              >
                <SkeletonText className="h-3 w-20" />
                <SkeletonText className="h-4 w-32" />
              </div>
            ))}
          </div>

          {/* Produto */}
          <div className="space-y-4">
            <SkeletonText className="h-4 w-24 mb-2" />
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4"
              >
                <SkeletonText className="h-3 w-20" />
                <SkeletonText className="h-4 w-32" />
              </div>
            ))}
          </div>
        </div>
      </SkeletonCard>

      {/* Warranty Skeleton */}
      <section className="space-y-5">
        <div className="flex items-start justify-between">
          <SkeletonText className="h-6 w-32" />
        </div>
        <SkeletonCard className="h-auto p-6 bg-white border-slate-200">
          <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <SkeletonIcon className="h-12 w-12 rounded-xl" />
              <SkeletonText className="h-6 w-24 rounded-full" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-24 rounded-lg" />
              <Skeleton className="h-9 w-24 rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-1">
                <SkeletonText className="h-3 w-16" />
                <SkeletonText className="h-4 w-28" />
              </div>
            ))}
          </div>
        </SkeletonCard>
      </section>

      {/* Assistance Skeleton */}
      <section className="space-y-5">
        <div className="flex items-start justify-between">
          <SkeletonText className="h-6 w-32" />
        </div>
        <SkeletonCard className="h-auto p-6 bg-white border-slate-200">
          <div className="flex flex-col gap-4">
            <SkeletonText className="h-4 w-64" />
            <SkeletonText className="h-4 w-48" />
          </div>
        </SkeletonCard>
      </section>
    </div>
  )
}
