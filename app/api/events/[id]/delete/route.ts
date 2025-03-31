import { NextResponse } from "next/server"
import { getRedisClient } from "@/lib/redis"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  // 캐시 방지 헤더 설정
  const headers = new Headers()
  headers.set("Cache-Control", "no-store, max-age=0")
  headers.set("Pragma", "no-cache")
  headers.set("Expires", "0")

  try {
    const eventId = params.id
    const { searchParams } = new URL(request.url)
    const phoneNumber = searchParams.get("phoneNumber")

    console.log("삭제 요청 받음 (GET):", { eventId, phoneNumber })

    if (!eventId || !phoneNumber) {
      console.error("필수 파라미터 누락:", { eventId, phoneNumber })
      return NextResponse.json(
        {
          error: "이벤트 ID와 전화번호가 필요합니다",
          success: false,
        },
        { status: 400, headers },
      )
    }

    // Redis 클라이언트 초기화
    const redis = getRedisClient()

    // 이벤트 존재 여부 확인
    const eventKey = `event:${eventId}`
    let exists
    try {
      exists = await redis.exists(eventKey)
      console.log("이벤트 존재 여부:", exists)
    } catch (existsError) {
      console.error("이벤트 존재 확인 오류:", existsError)
      return NextResponse.json(
        {
          error: "이벤트 존재 여부 확인 중 오류가 발생했습니다",
          success: false,
        },
        { status: 500, headers },
      )
    }

    if (exists !== 1) {
      return NextResponse.json(
        {
          error: "이벤트를 찾을 수 없습니다",
          success: false,
        },
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
        {
          error: "이벤트 데이터를 가져오는 중 오류가 발생했습니다",
          success: false,
        },
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
    } catch (parseError) {
      console.error("이벤트 데이터 파싱 오류:", parseError)
      return NextResponse.json(
        {
          error: "이벤트 데이터 파싱에 실패했습니다",
          success: false,
        },
        { status: 500, headers },
      )
    }

    // 권한 확인 (이벤트 생성자만 삭제 가능)
    if (event.creatorPhoneNumber !== phoneNumber) {
      console.error("권한 오류:", {
        creatorPhone: event.creatorPhoneNumber,
        requestPhone: phoneNumber,
      })
      return NextResponse.json(
        {
          error: "이벤트 삭제 권한이 없습니다",
          success: false,
        },
        { status: 403, headers },
      )
    }

    // 이벤트 삭제 작업 시작
    console.log("이벤트 삭제 시작:", eventId)

    // 1. 이벤트 삭제
    try {
      await redis.del(eventKey)
    } catch (delError) {
      console.error("이벤트 삭제 오류:", delError)
      return NextResponse.json(
        {
          error: "이벤트 삭제 중 오류가 발생했습니다",
          success: false,
        },
        { status: 500, headers },
      )
    }

    // 2. 생성자의 생성 이벤트 목록에서 제거
    try {
      await redis.srem(`user_created:${event.creatorPhoneNumber}`, eventId)
    } catch (sremError) {
      console.error("생성자 목록 업데이트 오류:", sremError)
      // 계속 진행 (비치명적 오류)
    }

    // 3. 초대된 사용자들의 초대 이벤트 목록에서 제거
    if (event.invitedPhoneNumbers && event.invitedPhoneNumbers.length > 0) {
      for (const invitedPhone of event.invitedPhoneNumbers) {
        try {
          await redis.srem(`user_invited:${invitedPhone}`, eventId)
        } catch (inviteError) {
          console.error(`초대 목록 업데이트 오류 (${invitedPhone}):`, inviteError)
          // 계속 진행 (비치명적 오류)
        }
      }
    }

    // 4. 이벤트 관련 가용성 데이터 삭제
    try {
      const availabilityIds = await redis.smembers(`event:${eventId}:availabilities`)
      if (availabilityIds && availabilityIds.length > 0) {
        for (const availId of availabilityIds) {
          await redis.del(`availability:${availId}`)
        }
      }
      await redis.del(`event:${eventId}:availabilities`)
      await redis.del(`event:${eventId}:availabilities:list`)
      await redis.del(`event:${eventId}:participants`)
    } catch (cleanupError) {
      console.error("관련 데이터 정리 오류:", cleanupError)
      // 계속 진행 (비치명적 오류)
    }

    console.log("이벤트 삭제 완료:", eventId)
    return NextResponse.json(
      {
        success: true,
        message: "이벤트가 성공적으로 삭제되었습니다",
      },
      { headers },
    )
  } catch (error) {
    console.error("이벤트 삭제 처리 중 예외 발생:", error)
    return NextResponse.json(
      {
        error: "이벤트 삭제 중 오류가 발생했습니다",
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

