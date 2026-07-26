import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getUserId, isAdmin as checkAdmin, getUserIdShort } from './user'

interface UserContextValue {
  userId: string
  userIdShort: string
  admin: boolean
  refreshAdmin: () => void
}

const UserContext = createContext<UserContextValue>({
  userId: '',
  userIdShort: '',
  admin: false,
  refreshAdmin: () => {},
})

export function UserProvider({ children }: { children: ReactNode }) {
  const [userId] = useState(getUserId)
  const [userIdShort] = useState(getUserIdShort)
  const [admin, setAdmin] = useState(checkAdmin)

  function refreshAdmin() {
    setAdmin(checkAdmin())
  }

  return (
    <UserContext.Provider value={{ userId, userIdShort, admin, refreshAdmin }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}
