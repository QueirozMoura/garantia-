import type { HTMLAttributes } from 'react'
import { cn, visualTokens } from './utils.ts'

export type SkeletonProps = HTMLAttributes<HTMLDivElement>

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse bg-slate-200 motion-reduce:animate-none',
        visualTokens.radius,
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

export function SkeletonCard({ className, ...props }: SkeletonProps) {
  return (
    <Skeleton
      className={cn('h-32 w-full border-slate-200 bg-slate-100', className)}
      {...props}
    />
  )
}
