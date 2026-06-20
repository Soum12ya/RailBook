import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserResponse } from '@/types'

interface AuthState {
  token: string | null
  user: UserResponse | null
  setAuth: (token: string, user: UserResponse) => void
  clearAuth: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null }),
      isAuthenticated: () => !!get().token,
    }),
    { name: 'train-auth' },
  ),
)
