import { useEffect, ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { isAdmin } from '../lib/user'

export default function AdminRoute({ children }: { children: ReactNode }) {
  if (!isAdmin()) return <Navigate to="/admin/login" replace />
  return <>{children}</>
}
