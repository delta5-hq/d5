import { type FC } from 'react'

interface HamburgerIconProps {
  isOpen: boolean
  className?: string
}

export const HamburgerIcon: FC<HamburgerIconProps> = ({ isOpen, className = '' }) => {
  if (isOpen) {
    return (
      <svg
        className={className}
        fill="none"
        height="24"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        style={{ transition: 'all 0.2s ease' }}
        viewBox="0 0 24 24"
        width="24"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Shortened hamburger lines forming triangular gap on left */}
        <line x1="12" x2="20" y1="6" y2="6" />
        <line x1="12" x2="20" y1="12" y2="12" />
        <line x1="12" x2="20" y1="18" y2="18" />
        {/* Chevron pointing left (close/collapse indicator) */}
        <polyline points="9,9 5,12 9,15" />
      </svg>
    )
  }

  return (
    <svg
      className={className}
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      style={{ transition: 'all 0.2s ease' }}
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  )
}
