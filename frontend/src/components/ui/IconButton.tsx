import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Button } from './Button.tsx'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

export function IconButton({
  label,
  size = 'md',
  children,
  className,
  ...props
}: IconButtonProps) {
  return (
    <Button
      {...props}
      size={size}
      variant="ghost"
      aria-label={label}
      className={`aspect-square !px-0 ${className ?? ''}`}
    >
      {children}
    </Button>
  )
}
