import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Redis 연결 확인 로직
    let connected = false

    try {
      // Redis 모듈 동적 임포트
      const { checkRedisConnection } = await import("@/lib/redis")
      connected = await checkRedisConnection()
    } catch (error) {
      console.error("Redis 연결 확인 중 오류:", error)
      connected = false
    }

    // 결과 반환
    return NextResponse.json({ connected })
  } catch (error) {
    console.error("Redis 상태 API 오류:", error)
    return NextResponse.json({ connected: false, error: "Redis 상태를 확인할 수 없습니다" })
  }
}

