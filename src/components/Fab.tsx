import { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

interface FabProps {
  icon: string
  to?: string
  onClick?: () => void
  label?: string
  className?: string
  ariaLabel?: string
}

export default function Fab({ icon, to, onClick, label, className = '', ariaLabel }: FabProps) {
  const navigate = useNavigate()

  function handleClick() {
    if (onClick) onClick()
    else if (to) navigate(to)
  }

  return (
    <button
      onClick={handleClick}
      aria-label={ariaLabel || label || icon}
      className={`md3-fab md3-ripple md3-state-layer ${label ? 'md3-fab-extended' : ''} ${className}`}
    >
      <span className="material-symbols-outlined text-[24px]">{icon}</span>
      {label && <span className="font-label-caps text-label-caps">{label}</span>}
    </button>
  )
}
