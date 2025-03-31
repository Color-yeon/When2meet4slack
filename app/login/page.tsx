"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { Loader2 } from "lucide-react"

export default function LoginPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get("redirect") || "/dashboard"

  useEffect(() => {
    // 로그인 페이지에 직접 접근한 경우 대시보드로 리디렉션
    if (!isLoading) {
      if (user) {
        router.push(redirectUrl)
      } else {
        router.push("/dashboard")
      }
    }
  }, [user, isLoading, router, redirectUrl])

  return (
    <div className="container mx-auto px-4 py-12 flex flex-col items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin mb-4" />
      <p>리디렉션 중...</p>
    </div>
  )
}

