import { NextResponse } from "next/server"
import { getRedisClient, checkRedisConnection, safeGetRedisData, parseRedisData } from "@/lib/redis"

// 캐시 제어 헤더 설정 함수
function setCacheHeaders(headers: Headers) {
  headers.set("Cache-Control", "no-store, max-age=0")
  headers.set("Pragma", "no-cache")
  headers.set("Expires", "0")
}

// 안전한 응답 생성 함수
function createSafeResponse(data: any, status = 200, headers: Headers = new Headers()) {
  setCacheHeaders(headers)

  try {
    return NextResponse.json(data, { status, headers })
  } catch (error) {
    console.error("응답 생성 오류:", error)
    // 최후의 수단으로 텍스트 응답 반환
    return new Response(JSON.stringify({ error: "서버 오류", data: [] }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(headers.entries()),
      },
    })
  }
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const headers = new Headers()
  setCacheHeaders(headers)

  try {
    const eventId = params.id

    if (!eventId) {
      return createSafeResponse({ error: "이벤트 ID가 필요합니다", data: [] }, 400, headers)
    }

    // Redis 연결 확인
    const isConnected = await checkRedisConnection()
    if (!isConnected) {
      console.error("Redis 연결 실패")
      return createSafeResponse(
        { error: "데이터베이스 연결에 실패했습니다. 잠시 후 다시 시도해주세요.", data: [] },
        503,
        headers,
      )
    }

    const redis = getRedisClient()

    // 가용성 데이터 가져오기 (리스트 형태)
    let availabilities = []
    try {
      const availabilityKey = `event:${eventId}:availabilities:list`
      availabilities = await redis.lrange(availabilityKey, 0, -1)
    } catch (listError) {
      console.error("가용성 리스트 가져오기 오류:", listError)
      // 리스트 가져오기 실패 시 세트에서 시도
    }

    if (!availabilities || availabilities.length === 0) {
      // 리스트에서 가져오기 실패한 경우, 세트에서 시도
      let availabilityIds = []
      try {
        availabilityIds = await redis.smembers(`event:${eventId}:availabilities`)
      } catch (setError) {
        console.error("가용성 세트 가져오기 오류:", setError)
        return createSafeResponse({ error: "가용성 데이터를 가져오는 중 오류가 발생했습니다", data: [] }, 500, headers)
      }

      if (!availabilityIds || availabilityIds.length === 0) {
        return createSafeResponse({ data: [] }, 200, headers)
      }

      // 각 가용성 ID에 대한 데이터 가져오기 - 최적화: 병렬 처리
      const availabilityPromises = availabilityIds.map(async (id) => {
        try {
          const availJson = await safeGetRedisData(`availability:${id}`)
          if (availJson) {
            return parseRedisData(availJson)
          }
          return null
        } catch (error) {
          console.error(`가용성 ID ${id} 조회 오류:`, error)
          return null
        }
      })

      try {
        const availabilityResults = await Promise.all(availabilityPromises)
        const availabilityData = availabilityResults.filter(Boolean)
        return createSafeResponse({ data: availabilityData }, 200, headers)
      } catch (promiseError) {
        console.error("가용성 데이터 병렬 처리 오류:", promiseError)
        return createSafeResponse({ error: "가용성 데이터 처리 중 오류가 발생했습니다", data: [] }, 500, headers)
      }
    }

    // 문자열을 객체로 변환 - 최적화: 병렬 처리 없이 직접 맵핑
    try {
      const parsedAvailabilities = availabilities.map((item) => parseRedisData(item)).filter(Boolean) // null 값 제거

      return createSafeResponse({ data: parsedAvailabilities }, 200, headers)
    } catch (parseError) {
      console.error("가용성 데이터 파싱 오류:", parseError)
      return createSafeResponse({ error: "가용성 데이터 파싱 중 오류가 발생했습니다", data: [] }, 500, headers)
    }
  } catch (error) {
    console.error("가용성 데이터 가져오기 오류:", error)

    // 오류 응답을 항상 안전하게 반환
    return createSafeResponse(
      {
        error: "가용성 데이터를 가져오는 중 오류가 발생했습니다",
        message: error instanceof Error ? error.message : String(error),
        data: [],
      },
      500,
      headers,
    )
  }
}

