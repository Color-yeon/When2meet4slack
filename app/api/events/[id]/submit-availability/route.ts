import { NextResponse } from "next/server"
import { Redis } from "@upstash/redis"

// Redis 클라이언트 초기화
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL || "",
  token: process.env.UPSTASH_REDIS_TOKEN || "",
})

// 파일 상단에 함수 추가
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

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const eventId = params.id
    const { name, phoneNumber, availableTimes } = await request.json()

    if (!eventId || !name || !availableTimes) {
      return NextResponse.json({ error: "필수 데이터가 누락되었습니다", success: false }, { status: 400 })
    }

    // 이벤트 존재 여부 확인
    const eventKey = `event:${eventId}`
    const eventExists = await redis.exists(eventKey)

    if (eventExists !== 1) {
      return NextResponse.json({ error: "이벤트를 찾을 수 없습니다", success: false }, { status: 404 })
    }

    // 전화번호가 제공된 경우, 이미 제출한 가용성이 있는지 확인
    let existingAvailabilityId = null
    if (phoneNumber) {
      // 이벤트의 모든 가용성 ID 가져오기
      const availabilityIds = await redis.smembers(`event:${eventId}:availabilities`)

      // 각 가용성 정보를 확인하여 해당 사용자의 것 찾기
      for (const id of availabilityIds) {
        try {
          const availabilityJson = await redis.get(`availability:${id}`)
          if (availabilityJson) {
            const availability = parseAvailabilityData(availabilityJson)
            if (availability && typeof availability === "object" && availability.phoneNumber === phoneNumber) {
              existingAvailabilityId = id
              break
            }
          }
        } catch (error) {
          console.error(`가용성 ID ${id} 조회 오류:`, error)
        }
      }
    }

    if (existingAvailabilityId) {
      console.log(`기존 가용성 업데이트: ${existingAvailabilityId}`)

      // 기존 가용성 업데이트
      const availability = {
        eventId,
        name,
        phoneNumber,
        availableTimes,
        submittedAt: new Date().toISOString(),
      }

      // Redis에 업데이트된 가용성 저장
      await redis.set(`availability:${existingAvailabilityId}`, JSON.stringify(availability))

      return NextResponse.json({
        success: true,
        message: "가능한 시간이 업데이트되었습니다",
        id: existingAvailabilityId,
      })
    }

    // 새 가용성 생성
    const id = `availability_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
    const availability = {
      id,
      eventId,
      name,
      phoneNumber,
      availableTimes,
      submittedAt: new Date().toISOString(),
    }

    // Redis에 가용성 저장
    await redis.set(`availability:${id}`, JSON.stringify(availability))

    // 이벤트의 가용성 목록에 추가
    await redis.sadd(`event:${eventId}:availabilities`, id)

    // 이벤트의 가용성 목록에 추가 (리스트 형태로도 저장)
    await redis.rpush(`event:${eventId}:availabilities:list`, JSON.stringify(availability))

    console.log(`새 가용성 생성 완료: ${id}`)
    return NextResponse.json({
      success: true,
      message: "가능한 시간이 성공적으로 제출되었습니다",
      id,
    })
  } catch (error) {
    console.error("가용성 제출 오류:", error)
    return NextResponse.json(
      {
        error: "가능한 시간 제출 중 오류가 발생했습니다",
        message: error instanceof Error ? error.message : String(error),
        success: false,
      },
      { status: 500 },
    )
  }
}

