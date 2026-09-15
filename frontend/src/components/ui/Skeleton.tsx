import type { HTMLAttributes } from 'react'
import { cn } from './utils.ts'

export type SkeletonProps = HTMLAttributes<HTMLDivElement>

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'rounded-xl',
        'skeleton-shimmer',
        'motion-reduce:animate-none motion-reduce:bg-slate-200',
        className,
      )}
      {...props}
    />
  )
}

export function SkeletonText({ className, ...props }: SkeletonProps) {
  return <Skeleton className={cn('h-3 w-full rounded-md', className)} {...props} />
}

export function SkeletonCircle({ className, ...props }: SkeletonProps) {
  return <Skeleton className={cn('h-10 w-10 rounded-full', className)} {...props} />
}

export function SkeletonIcon({ className, ...props }: SkeletonProps) {
  return <Skeleton className={cn('h-9 w-9 rounded-lg', className)} {...props} />
}

export function SkeletonCard({ className, children, ...props }: SkeletonProps) {
  if (children) {
    return (
      <div
        aria-hidden="true"
        className={cn('rounded-xl border border-slate-100 bg-slate-50/60 p-5', className)}
        {...props}
      >
        {children}
      </div>
    )
  }
  return (
    <Skeleton
      className={cn('h-32 w-full border border-slate-100 bg-slate-100', className)}
      {...props}
    />
  )
}
