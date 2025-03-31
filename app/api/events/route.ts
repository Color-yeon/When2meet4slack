import { NextResponse } from "next/server"
import { getRedisClient, batchRedisOperations } from "@/lib/redis"
import { parseEventData } from "@/lib/utils"

// Redis 클라이언트 초기화
const redis = getRedisClient()

// 캐시 제어 헤더 설정 함수
function setCacheHeaders(headers: Headers) {
  headers.set("Cache-Control", "no-store, max-age=0")
  headers.set("Pragma", "no-cache")
  headers.set("Expires", "no-store, max-age=0")
  headers.set("Pragma", "no-cache")
  headers.set("Expires", "0")
}

// GET 메서드 최적화

export async function GET(request: Request) {
  // 캐시 제어 헤더 설정
  const headers = new Headers()
  setCacheHeaders(headers)

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") // 'created' 또는 'invited'
    const phoneNumber = searchParams.get("phoneNumber")

    if (!phoneNumber) {
      return NextResponse.json({ error: "전화번호가 필요합니다", events: [] }, { status: 400, headers })
    }

    // 타입에 따라 이벤트 ID 가져오기 - 병렬 처리 최적화
    let eventIds: string[] = []

    if (type === "created") {
      eventIds = (await redis.smembers(`user_created:${phoneNumber}`)) || []
    } else if (type === "invited") {
      eventIds = (await redis.smembers(`user_invited:${phoneNumber}`)) || []
    } else {
      // 타입이 지정되지 않은 경우 모든 이벤트 가져오기 (병렬 처리)
      const [createdIds, invitedIds] = await Promise.all([
        redis.smembers(`user_created:${phoneNumber}`),
        redis.smembers(`user_invited:${phoneNumber}`),
      ])

      // 중복 제거
      eventIds = [...new Set([...(createdIds || []), ...(invitedIds || [])])]
    }

    if (!eventIds || eventIds.length === 0) {
      return NextResponse.json({ events: [] }, { headers })
    }

    // 이벤트 데이터 가져오기 - 병렬 처리 최적화
    const eventPromises = eventIds.map(async (eventId) => {
      try {
        const eventJson = await redis.get(`event:${eventId}`)
        if (eventJson) {
          return parseEventData(eventJson, eventId)
        }
        return null
      } catch (error) {
        console.error(`이벤트 ID ${eventId} 조회 오류:`, error)
        return null
      }
    })

    const events = (await Promise.all(eventPromises)).filter(Boolean)

    return NextResponse.json({ events }, { headers })
  } catch (error) {
    console.error("이벤트 데이터 가져오기 오류:", error)
    return NextResponse.json(
      {
        error: "이벤트 데이터를 가져오는 중 오류가 발생했습니다",
        message: error instanceof Error ? error.message : String(error),
        events: [],
      },
      { status: 500, headers },
    )
  }
}

export async function POST(request: Request) {
  // 캐시 방지 헤더 설정
  const headers = new Headers()
  setCacheHeaders(headers)

  try {
    const eventData = await request.json()

    // 필수 필드 검증
    if (!eventData.title || !eventData.startDate || !eventData.endDate || !eventData.creatorPhoneNumber) {
      return NextResponse.json({ error: "필수 필드가 누락되었습니다", success: false }, { status: 400, headers })
    }

    // 이벤트 ID 생성 - 더 짧고 효율적인 ID 생성
    const timestamp = Date.now()
    const randomPart = Math.random().toString(36).substring(2, 8) // 더 짧은 랜덤 문자열
    const eventId = `e_${timestamp}_${randomPart}`

    // 병렬 처리를 위한 작업 배열
    const operations = [
      // 1. 이벤트 데이터 저장
      () => redis.set(`event:${eventId}`, JSON.stringify(eventData)),

      // 2. 생성자의 생성 이벤트 목록에 추가
      () => redis.sadd(`user_created:${eventData.creatorPhoneNumber}`, eventId),

      // 3. 생성자를 참여자 목록에 추가
      () => redis.sadd(`event:${eventId}:participants`, eventData.creatorPhoneNumber),
    ]

    // 4. 초대된 사용자들의 초대 이벤트 목록에 추가
    if (eventData.invitedPhoneNumbers && eventData.invitedPhoneNumbers.length > 0) {
      for (const phoneNumber of eventData.invitedPhoneNumbers) {
        operations.push(() => redis.sadd(`user_invited:${phoneNumber}`, eventId))
      }
    }

    // 모든 Redis 작업을 병렬로 실행
    await batchRedisOperations(operations)

    return NextResponse.json(
      {
        success: true,
        eventId,
        message: "이벤트가 성공적으로 생성되었습니다",
      },
      { headers },
    )
  } catch (error) {
    console.error("이벤트 생성 오류:", error)
    return NextResponse.json(
      {
        error: "이벤트 생성 중 오류가 발생했습니다",
        message: error instanceof Error ? error.message : String(error),
        success: false,
      },
      { status: 500, headers },
    )
  }
}

