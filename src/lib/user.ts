const ANON_ID_KEY = 'voy-user-id'
const ADMIN_SESSION_KEY = 'voy-admin-session'
const ADMIN_PIN = '3690'

export function getUserId(): string {
  let id = localStorage.getItem(ANON_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(ANON_ID_KEY, id)
  }
  return id
}

export function isAdmin(): boolean {
  return localStorage.getItem(ADMIN_SESSION_KEY) === 'true'
}

export function adminLogin(pin: string): boolean {
  if (pin === ADMIN_PIN) {
    localStorage.setItem(ADMIN_SESSION_KEY, 'true')
    return true
  }
  return false
}

export function adminLogout(): void {
  localStorage.removeItem(ADMIN_SESSION_KEY)
}

export function getUserIdShort(): string {
  const id = getUserId()
  return id.slice(0, 8)
}
