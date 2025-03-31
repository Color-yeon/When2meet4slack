"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

interface User {
  phoneNumber: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (phoneNumber: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 로컬 스토리지에서 사용자 정보 로드
  useEffect(() => {
    const loadUser = () => {
      try {
        const storedUser = localStorage.getItem("user")
        if (storedUser) {
          setUser(JSON.parse(storedUser))
        }
      } catch (error) {
        console.error("사용자 정보 로드 오류:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadUser()
  }, [])

  // 로그인 함수
  const login = async (phoneNumber: string) => {
    try {
      // 실제 인증 로직은 여기에 구현
      // 현재는 간단히 전화번호만 저장
      const user = { phoneNumber }
      localStorage.setItem("user", JSON.stringify(user))
      setUser(user)
    } catch (error) {
      console.error("로그인 오류:", error)
      throw error
    }
  }

  // 로그아웃 함수
  const logout = () => {
    localStorage.removeItem("user")
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, isLoading, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

