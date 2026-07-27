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
  const val = localStorage.getItem(ADMIN_SESSION_KEY)
  // #region agent log
  fetch('http://127.0.0.1:7542/ingest/63a7cef4-3441-4b2c-b41f-ae792e84b7b4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d394df'},body:JSON.stringify({sessionId:'d394df',location:'user.ts:isAdmin',message:'isAdmin check',data:{rawVal:val,isAdmin:val==='true'},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
  // #endregion
  return val === 'true'
}

export function adminLogin(pin: string): boolean {
  const success = pin === ADMIN_PIN
  if (success) {
    localStorage.setItem(ADMIN_SESSION_KEY, 'true')
  }
  // #region agent log
  fetch('http://127.0.0.1:7542/ingest/63a7cef4-3441-4b2c-b41f-ae792e84b7b4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d394df'},body:JSON.stringify({sessionId:'d394df',location:'user.ts:adminLogin',message:'adminLogin attempt',data:{pinLength:pin.length,success,storageAfter:localStorage.getItem(ADMIN_SESSION_KEY)},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
  // #endregion
  return success
}

export function adminLogout(): void {
  localStorage.removeItem(ADMIN_SESSION_KEY)
  // #region agent log
  fetch('http://127.0.0.1:7542/ingest/63a7cef4-3441-4b2c-b41f-ae792e84b7b4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d394df'},body:JSON.stringify({sessionId:'d394df',location:'user.ts:adminLogout',message:'adminLogout called',data:{storageAfter:localStorage.getItem(ADMIN_SESSION_KEY)},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
  // #endregion
}

export function getUserIdShort(): string {
  const id = getUserId()
  return id.slice(0, 8)
}
