import type { ReactNode } from 'react'
import styles from './angular-separator.module.scss'

interface AngularSeparatorProps {
  label?: ReactNode
  icon?: ReactNode
}

export const AngularSeparator = ({ label, icon }: AngularSeparatorProps) => (
  <div className={styles.angularSeparator}>
    {label ? (
      <div className={styles.label}>
        {icon}
        {label}
      </div>
    ) : null}
  </div>
)
