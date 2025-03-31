import { Redis } from "@upstash/redis"

// Redis 클라이언트 싱글톤 인스턴스
let redisInstance: Redis | null = null

// 연결 상태 캐싱
let isConnectedCache: boolean | null = null
let lastConnectionCheck = 0
const CONNECTION_CACHE_TTL = 60000 // 1분

// Redis 클라이언트 초기화 함수
export function getRedisClient(): Redis {
  if (!redisInstance) {
    // 여러 가능한 환경 변수 이름 확인
    const url = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL || process.env.KV_URL || ""
    const token = process.env.UPSTASH_REDIS_TOKEN || process.env.KV_REST_API_TOKEN || ""

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
        automaticDeserialization: false, // 자동 역직렬화 비활성화로 성능 향상
      })
    } catch (error) {
      console.error("Redis 클라이언트 초기화 오류:", error)
      throw new Error("Redis 클라이언트를 초기화할 수 없습니다")
    }
  }

  return redisInstance
}

// Redis 연결 확인 함수 (캐싱 적용)
export async function checkRedisConnection(): Promise<boolean> {
  const now = Date.now()

  // 캐시된 연결 상태가 있고 TTL이 만료되지 않았으면 캐시된 값 반환
  if (isConnectedCache !== null && now - lastConnectionCheck < CONNECTION_CACHE_TTL) {
    return isConnectedCache
  }

  try {
    const redis = getRedisClient()
    const pong = await redis.ping()
    isConnectedCache = pong === "PONG"
    lastConnectionCheck = now
    return isConnectedCache
  } catch (error) {
    console.error("Redis 연결 확인 오류:", error)
    isConnectedCache = false
    lastConnectionCheck = now
    return false
  }
}

// 결과 캐싱을 위한 맵
const redisDataCache = new Map<string, { data: any; timestamp: number }>()
const REDIS_CACHE_TTL = 30000 // 30초
const REDIS_CACHE_MAX_SIZE = 200

// 안전한 Redis 데이터 가져오기 함수 (캐싱 적용)
export async function safeGetRedisData(key: string, skipCache = false): Promise<any> {
  const now = Date.now()

  // 캐시 확인 (skipCache가 false이고 캐시가 유효한 경우)
  if (!skipCache && redisDataCache.has(key)) {
    const cached = redisDataCache.get(key)!
    if (now - cached.timestamp < REDIS_CACHE_TTL) {
      return cached.data
    }
  }

  try {
    const redis = getRedisClient()
    const data = await redis.get(key)

    // 캐시에 저장
    if (!skipCache) {
      // 캐시 크기 제한
      if (redisDataCache.size >= REDIS_CACHE_MAX_SIZE) {
        // 가장 오래된 항목 제거
        let oldestKey = null
        let oldestTime = Number.POSITIVE_INFINITY

        for (const [cacheKey, entry] of redisDataCache.entries()) {
          if (entry.timestamp < oldestTime) {
            oldestTime = entry.timestamp
            oldestKey = cacheKey
          }
        }

        if (oldestKey) {
          redisDataCache.delete(oldestKey)
        }
      }

      redisDataCache.set(key, { data, timestamp: now })
    }

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

// 배치 작업 처리 함수
export async function batchRedisOperations(operations: (() => Promise<any>)[]): Promise<any[]> {
  return Promise.all(
    operations.map((op) =>
      op().catch((err) => {
        console.error("배치 작업 오류:", err)
        return null
      }),
    ),
  )
}

// 기존 코드와의 호환성을 위해 redis 인스턴스 직접 내보내기
export const redis = getRedisClient()

