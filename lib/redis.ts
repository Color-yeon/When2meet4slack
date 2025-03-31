import { Redis } from "@upstash/redis"

// Redis 클라이언트 인스턴스
let redisClient: Redis | null = null

// Redis 클라이언트 가져오기 (싱글톤 패턴)
export function getRedisClient() {
  if (!redisClient) {
    try {
      // 환경 변수 확인
      const url = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL || process.env.KV_URL
      const token =
        process.env.UPSTASH_REDIS_TOKEN || process.env.KV_REST_API_TOKEN || process.env.KV_REST_API_READ_ONLY_TOKEN

      if (!url || !token) {
        console.error("Redis 환경 변수가 설정되지 않았습니다.")
        throw new Error("Redis 환경 변수가 필요합니다")
      }

      // Redis 클라이언트 초기화
      redisClient = new Redis({
        url,
        token,
      })

      console.log("Redis 클라이언트가 초기화되었습니다.")
    } catch (error) {
      console.error("Redis 클라이언트 초기화 오류:", error)
      throw error
    }
  }

  return redisClient
}

// Redis 연결 확인
export async function checkRedisConnection(): Promise<boolean> {
  try {
    const redis = getRedisClient()
    // 간단한 PING 명령으로 연결 확인
    const result = await redis.ping()
    return result === "PONG"
  } catch (error) {
    console.error("Redis 연결 확인 오류:", error)
    return false
  }
}

// Redis 데이터 안전하게 가져오기
export async function safeGetRedisData(key: string): Promise<any> {
  try {
    const redis = getRedisClient()
    return await redis.get(key)
  } catch (error) {
    console.error(`Redis 데이터 가져오기 오류 (${key}):`, error)
    return null // 오류 발생 시 null 반환
  }
}

// Redis 데이터 안전하게 파싱하기
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
    return null // 오류 발생 시 null 반환
  }
}

// Redis 작업 일괄 처리
export async function batchRedisOperations(operations: (() => Promise<any>)[]): Promise<any[]> {
  try {
    return await Promise.all(
      operations.map((op) =>
        op().catch((err) => {
          console.error("배치 작업 오류:", err)
          return null
        }),
      ),
    )
  } catch (error) {
    console.error("Redis 일괄 작업 오류:", error)
    return operations.map(() => null) // 오류 발생 시 null 배열 반환
  }
}

// 기존 코드와의 호환성을 위해 redis 인스턴스 직접 내보내기
export const redis = (() => {
  try {
    return getRedisClient()
  } catch (error) {
    console.error("Redis 인스턴스 생성 오류:", error)
    // 더미 Redis 객체 반환 (모든 메서드가 오류를 반환)
    return {
      get: async () => null,
      set: async () => null,
      del: async () => null,
      ping: async () => null,
    } as unknown as Redis
  }
})()

