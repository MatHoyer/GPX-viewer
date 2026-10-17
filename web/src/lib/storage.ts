import { createJSONStorage } from 'zustand/middleware'

// localStorage can throw (private mode, blocked storage); fall back to in-memory.
export const safeStorage = createJSONStorage(() => {
  try {
    localStorage.setItem('__probe', '1')
    localStorage.removeItem('__probe')
    return localStorage
  } catch {
    const mem = new Map<string, string>()
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    }
  }
})
