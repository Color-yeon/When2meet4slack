import { NextResponse } from "next/server"
import { getRedisClient, checkRedisConnection } from "@/lib/redis"

export async function GET() {
  try {
    // 환경 변수 확인
    const redisUrl = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL || process.env.KV_URL || "설정되지 않음"
    const redisToken = process.env.UPSTASH_REDIS_TOKEN || process.env.KV_REST_API_TOKEN || "설정되지 않음"

    // URL과 토큰의 일부만 표시 (보안상의 이유로)
    const maskedUrl =
      redisUrl !== "설정되지 않음"
        ? `${redisUrl.substring(0, 15)}...${redisUrl.substring(redisUrl.length - 10)}`
        : "설정되지 않음"

    const maskedToken =
      redisToken !== "설정되지 않음"
        ? `${redisToken.substring(0, 5)}...${redisToken.substring(redisToken.length - 5)}`
        : "설정되지 않음"

    // Redis 연결 확인
    let isConnected = false
    try {
      isConnected = await checkRedisConnection()
    } catch (error) {
      console.error("Redis 연결 확인 중 오류:", error)
      return NextResponse.json(
        {
          status: "error",
          message: "Redis 연결 확인 중 오류가 발생했습니다",
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
          connection: {
            url: maskedUrl,
            token: maskedToken,
            connected: false,
          },
        },
        { status: 500 },
      )
    }

    if (isConnected) {
      // 추가 테스트: 간단한 키-값 쓰기/읽기 테스트
      try {
        const redis = getRedisClient()
        const testKey = "redis_status_test"
        const testValue = `test_${Date.now()}`

        await redis.set(testKey, testValue)
        const retrievedValue = await redis.get(testKey)
        const readWriteSuccess = testValue === retrievedValue

        return NextResponse.json({
          status: "ok",
          message: "Redis 서버가 정상적으로 작동 중입니다",
          timestamp: new Date().toISOString(),
          connection: {
            url: maskedUrl,
            token: maskedToken,
            connected: true,
          },
          tests: {
            ping: "PONG",
            readWrite: readWriteSuccess ? "성공" : "실패",
          },
        })
      } catch (testError) {
        console.error("Redis 테스트 중 오류:", testError)
        return NextResponse.json(
          {
            status: "error",
            message: "Redis 연결은 성공했지만 테스트 중 오류가 발생했습니다",
            error: testError instanceof Error ? testError.message : String(testError),
            timestamp: new Date().toISOString(),
            connection: {
              url: maskedUrl,
              token: maskedToken,
              connected: true,
            },
          },
          { status: 500 },
        )
      }
    } else {
      return NextResponse.json(
        {
          status: "error",
          message: "Redis 서버에 연결할 수 없습니다",
          timestamp: new Date().toISOString(),
          connection: {
            url: maskedUrl,
            token: maskedToken,
            connected: false,
          },
        },
        { status: 503 },
      )
    }
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "알 수 없는 오류",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

