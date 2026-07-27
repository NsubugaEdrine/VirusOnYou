import { useState, useCallback, createContext, useContext, ReactNode } from 'react'

interface SnackbarMessage {
  id: number
  message: string
  action?: { label: string; onClick: () => void }
}

interface SnackbarContextValue {
  showSnackbar: (message: string, action?: { label: string; onClick: () => void }) => void
}

const SnackbarContext = createContext<SnackbarContextValue>({ showSnackbar: () => {} })

let snackbarId = 0

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<SnackbarMessage[]>([])

  const showSnackbar = useCallback((message: string, action?: { label: string; onClick: () => void }) => {
    const id = ++snackbarId
    setMessages((prev) => [...prev, { id, message, action }])
    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== id))
    }, 4000)
  }, [])

  return (
    <SnackbarContext.Provider value={{ showSnackbar }}>
      {children}
      <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-2 pointer-events-none">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className="pointer-events-auto animate-md3-fade-in"
            style={{
              position: 'relative',
              bottom: 'auto',
              left: 'auto',
              transform: 'none',
              opacity: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              minWidth: '320px',
              maxWidth: '560px',
              padding: '14px 16px',
              borderRadius: '12px',
              backgroundColor: 'rgb(var(--color-inverse-surface))',
              color: 'rgb(var(--color-inverse-on-surface))',
              fontSize: '14px',
              fontWeight: 500,
              boxShadow: '0 3px 5px rgba(0,0,0,0.2), 0 6px 10px rgba(0,0,0,0.14)',
            }}
          >
            <span>{msg.message}</span>
            {msg.action && (
              <button
                className="md3-snackbar-action"
                onClick={() => {
                  msg.action!.onClick()
                  setMessages((prev) => prev.filter((m) => m.id !== msg.id))
                }}
              >
                {msg.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </SnackbarContext.Provider>
  )
}

export function useSnackbar() {
  return useContext(SnackbarContext)
}
