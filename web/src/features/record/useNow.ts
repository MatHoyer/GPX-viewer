import { useEffect, useState } from 'react'

/** The current time in epoch ms, refreshed every `everyMs` while `active`. */
export function useNow(everyMs: number, active = true) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(id)
  }, [everyMs, active])
  return now
}
