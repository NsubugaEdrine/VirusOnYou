import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useUser } from '../lib/userContext'

export default function AdminRoute({ children }: { children: ReactNode }) {
  const { admin } = useUser()
  if (!admin) return <Navigate to="/admin/login" replace />
  return <>{children}</>
}
