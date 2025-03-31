"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // 오류를 서버에 로깅
    console.error("애플리케이션 오류:", error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-red-600">오류가 발생했습니다</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">애플리케이션에서 오류가 발생했습니다. 다시 시도하거나 나중에 다시 방문해 주세요.</p>
          {error.digest && <p className="text-sm text-gray-500">오류 코드: {error.digest}</p>}
        </CardContent>
        <CardFooter>
          <Button onClick={reset} className="w-full">
            다시 시도
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

