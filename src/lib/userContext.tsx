import { createContext, useContext, useState, ReactNode } from 'react'
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
    const next = checkAdmin()
    // #region agent log
    fetch('http://127.0.0.1:7542/ingest/63a7cef4-3441-4b2c-b41f-ae792e84b7b4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d394df'},body:JSON.stringify({sessionId:'d394df',location:'userContext.tsx:refreshAdmin',message:'refreshAdmin',data:{prevAdmin:admin,nextAdmin:next},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
    setAdmin(next)
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
