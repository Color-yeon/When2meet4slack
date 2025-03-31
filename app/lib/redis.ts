import { Redis } from "@upstash/redis"

// Redis 클라이언트 싱글톤 인스턴스
let redisInstance: Redis | null = null

// Redis 클라이언트 초기화 함수
export function getRedisClient(): Redis {
  if (!redisInstance) {
    // 여러 가능한 환경 변수 이름 확인
    const url = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL || process.env.KV_URL || ""
    const token = process.env.UPSTASH_REDIS_TOKEN || process.env.KV_REST_API_TOKEN || ""

    console.log("Redis URL 사용:", url ? "설정됨" : "설정되지 않음")
    console.log("Redis Token 사용:", token ? "설정됨" : "설정되지 않음")

    if (!url || !token) {
      throw new Error("Redis 환경 변수가 설정되지 않았습니다")
    }

    try {
      redisInstance = new Redis({
        url,
        token,
        retry: {
          retries: 3,
          backoff: (retryCount) => Math.min(Math.exp(retryCount) * 50, 1000),
        },
      })
    } catch (error) {
      console.error("Redis 클라이언트 초기화 오류:", error)
      throw new Error("Redis 클라이언트를 초기화할 수 없습니다")
    }
  }

  return redisInstance
}

// Redis 연결 확인 함수
export async function checkRedisConnection(): Promise<boolean> {
  try {
    const redis = getRedisClient()
    const pong = await redis.ping()
    console.log("Redis 연결 확인 결과:", pong)
    return pong === "PONG"
  } catch (error) {
    console.error("Redis 연결 확인 오류:", error)
    return false
  }
}

// 안전한 Redis 데이터 가져오기 함수
export async function safeGetRedisData(key: string): Promise<any> {
  try {
    const redis = getRedisClient()
    const data = await redis.get(key)
    return data
  } catch (error) {
    console.error(`Redis 데이터 가져오기 오류 (${key}):`, error)
    throw error
  }
}

// 안전한 Redis 데이터 파싱 함수
export function parseRedisData(data: any): any {
  if (!data) return null

  try {
    if (typeof data === "string") {
      return JSON.parse(data)
    } else if (Buffer.isBuffer(data)) {
      return JSON.parse(data.toString("utf-8"))
    } else {
      return data
    }
  } catch (error) {
    console.error("Redis 데이터 파싱 오류:", error)
    return null
  }
}

// 기존 코드와의 호환성을 위해 redis 인스턴스 직접 내보내기
export const redis = getRedisClient()

