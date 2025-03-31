import { NextResponse } from "next/server"
import { Redis } from "@upstash/redis"

// Redis 클라이언트 초기화
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL || "",
  token: process.env.UPSTASH_REDIS_TOKEN || "",
})

export async function POST(request: Request, { params }: { params: { id: string } }) {
  // 캐시 방지 헤더 설정
  const headers = new Headers()
  headers.set("Cache-Control", "no-store, max-age=0")
  headers.set("Pragma", "no-cache")
  headers.set("Expires", "0")

  try {
    const eventId = params.id

    // 요청 본문 파싱
    let phoneNumber
    try {
      const body = await request.json()
      phoneNumber = body.phoneNumber
    } catch (parseError) {
      console.error("요청 본문 파싱 오류:", parseError)
      return NextResponse.json({ error: "요청 본문을 파싱할 수 없습니다", success: false }, { status: 400, headers })
    }

    if (!eventId || !phoneNumber) {
      return NextResponse.json({ error: "이벤트 ID와 전화번호가 필요합니다", success: false }, { status: 400, headers })
    }

    const eventKey = `event:${eventId}`
    const participantsKey = `event:${eventId}:participants`

    // 이벤트 존재 여부 확인
    let eventExists
    try {
      eventExists = await redis.exists(eventKey)
    } catch (existsError) {
      console.error("이벤트 존재 확인 오류:", existsError)
      return NextResponse.json(
        { error: "이벤트 존재 여부 확인 중 오류가 발생했습니다", success: false },
        { status: 500, headers },
      )
    }

    if (eventExists !== 1) {
      return NextResponse.json(
        { error: `이벤트 ${eventId}가 존재하지 않습니다`, success: false },
        { status: 404, headers },
      )
    }

    // 이벤트 데이터 가져오기
    let eventJson
    try {
      eventJson = await redis.get(eventKey)
    } catch (getError) {
      console.error("이벤트 데이터 가져오기 오류:", getError)
      return NextResponse.json(
        { error: "이벤트 데이터를 가져오는 중 오류가 발생했습니다", success: false },
        { status: 500, headers },
      )
    }

    let event
    try {
      if (typeof eventJson === "string") {
        event = JSON.parse(eventJson)
      } else if (Buffer.isBuffer(eventJson)) {
        event = JSON.parse(eventJson.toString("utf-8"))
      } else {
        event = eventJson
      }
    } catch (error) {
      console.error("이벤트 데이터 파싱 오류:", error)
      return NextResponse.json({ error: "이벤트 데이터 파싱에 실패했습니다", success: false }, { status: 500, headers })
    }

    const isCreator = phoneNumber === event.creatorPhoneNumber

    // 이미 참여자인지 확인
    let isParticipant
    try {
      isParticipant = await redis.sismember(participantsKey, phoneNumber)
    } catch (memberError) {
      console.error("참여자 확인 오류:", memberError)
      return NextResponse.json(
        { error: "참여자 확인 중 오류가 발생했습니다", success: false },
        { status: 500, headers },
      )
    }

    if (isParticipant !== 1) {
      // 참여자 추가
      try {
        await redis.sadd(participantsKey, phoneNumber)
        console.log(`사용자 ${phoneNumber}가 이벤트 ${eventId}에 추가되었습니다`)
      } catch (addError) {
        console.error("참여자 추가 오류:", addError)
        return NextResponse.json(
          { error: "참여자 추가 중 오류가 발생했습니다", success: false },
          { status: 500, headers },
        )
      }

      // 초대 목록에 추가 (이미 있는지 확인)
      if (!isCreator && !event.invitedPhoneNumbers?.includes(phoneNumber)) {
        try {
          const updatedEvent = {
            ...event,
            invitedPhoneNumbers: [...(event.invitedPhoneNumbers || []), phoneNumber],
            updatedAt: new Date().toISOString(),
          }

          await redis.set(eventKey, JSON.stringify(updatedEvent))
          await redis.sadd(`user_invited:${phoneNumber}`, eventId)
        } catch (updateError) {
          console.error("초대 목록 업데이트 오류:", updateError)
          // 비치명적 오류이므로 계속 진행
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        isCreator,
        alreadyInvited: isParticipant === 1,
      },
      { headers },
    )
  } catch (error) {
    console.error("사용자 이벤트 참여 오류:", error)
    return NextResponse.json(
      {
        error: "사용자를 이벤트에 추가하는 중 오류가 발생했습니다",
        message: error instanceof Error ? error.message : String(error),
        success: false,
      },
      {
        status: 500,
        headers: new Headers({
          "Cache-Control": "no-store, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
        }),
      },
    )
  }
}

