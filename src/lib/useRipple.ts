import { useCallback, MouseEvent } from 'react'

export function useRipple() {
  const handleRipple = useCallback((e: MouseEvent<HTMLElement>) => {
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    el.style.setProperty('--ripple-x', `${x}%`)
    el.style.setProperty('--ripple-y', `${y}%`)
    el.classList.add('rippling')

    setTimeout(() => {
      el.classList.remove('rippling')
    }, 400)
  }, [])

  return handleRipple
}
