import { NextResponse } from "next/server"
import { Redis } from "@upstash/redis"

// Redis 클라이언트 초기화
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL || "",
  token: process.env.UPSTASH_REDIS_TOKEN || "",
})

function parseAvailabilityData(availabilityJson: any) {
  try {
    if (typeof availabilityJson === "string") {
      return JSON.parse(availabilityJson)
    } else if (Buffer.isBuffer(availabilityJson)) {
      return JSON.parse(availabilityJson.toString("utf-8"))
    } else {
      return availabilityJson
    }
  } catch (parseError) {
    console.error(`가용성 데이터 파싱 오류`, parseError)
    return null
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("eventId")
    const phoneNumber = searchParams.get("phoneNumber")

    if (!eventId || !phoneNumber) {
      return NextResponse.json({ error: "이벤트 ID와 전화번호가 필요합니다", availability: null }, { status: 400 })
    }

    // 이벤트의 모든 가용성 ID 가져오기
    const availabilityIds = await redis.smembers(`event:${eventId}:availabilities`)

    if (!availabilityIds || availabilityIds.length === 0) {
      return NextResponse.json({ availability: null })
    }

    // 각 가용성 정보를 확인하여 해당 사용자의 것 찾기
    for (const id of availabilityIds) {
      try {
        const availabilityJson = await redis.get(`availability:${id}`)
        if (availabilityJson) {
          const availability = parseAvailabilityData(availabilityJson)
          if (availability && typeof availability === "object" && availability.phoneNumber === phoneNumber) {
            return NextResponse.json({ availability })
          }
        }
      } catch (error) {
        console.error(`가용성 ID ${id} 조회 오류:`, error)
      }
    }

    return NextResponse.json({ availability: null })
  } catch (error) {
    console.error("가용성 데이터 가져오기 오류:", error)
    return NextResponse.json(
      {
        error: "가용성 데이터를 가져오는 중 오류가 발생했습니다",
        message: error instanceof Error ? error.message : String(error),
        availability: null,
      },
      { status: 500 },
    )
  }
}

