type BrandMarkProps = {
  className?: string
}

export function BrandMark({ className = '' }: BrandMarkProps) {
  return (
    <span className={`brand-mark ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path d="M11 31V10h10a7.5 7.5 0 0 1 0 15H11" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M29 19v12" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="29" cy="12" r="2.5" fill="#FFB37D" />
      </svg>
    </span>
  )
}
