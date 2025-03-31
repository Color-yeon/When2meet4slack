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
    return new Response(JSON.stringify({ error: "서버 오류", data: null }), {
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
      return createSafeResponse({ error: "이벤트 ID가 필요합니다", data: null }, 400, headers)
    }

    // Redis 연결 확인
    let isConnected = false
    try {
      isConnected = await checkRedisConnection()
    } catch (connError) {
      console.error("Redis 연결 확인 중 오류:", connError)
      return createSafeResponse({ error: "데이터베이스 연결 확인 중 오류가 발생했습니다", data: null }, 503, headers)
    }

    if (!isConnected) {
      console.error("Redis 연결 실패")
      return createSafeResponse(
        { error: "데이터베이스 연결에 실패했습니다. 잠시 후 다시 시도해주세요.", data: null },
        503,
        headers,
      )
    }

    const redis = getRedisClient()

    // 이벤트 키 생성
    const eventKey = `event:${eventId}`

    // 이벤트 존재 여부 확인
    let exists
    try {
      exists = await redis.exists(eventKey)
    } catch (existsError) {
      console.error("이벤트 존재 확인 오류:", existsError)
      return createSafeResponse({ error: "이벤트 데이터 확인 중 오류가 발생했습니다", data: null }, 500, headers)
    }

    if (exists !== 1) {
      return createSafeResponse({ error: "이벤트를 찾을 수 없습니다", data: null }, 404, headers)
    }

    // 이벤트 데이터 가져오기
    let eventJson
    try {
      eventJson = await safeGetRedisData(eventKey)
    } catch (getError) {
      console.error("이벤트 데이터 가져오기 오류:", getError)
      return createSafeResponse({ error: "이벤트 데이터를 가져오는 중 오류가 발생했습니다", data: null }, 500, headers)
    }

    if (!eventJson) {
      return createSafeResponse({ error: "이벤트 데이터를 찾을 수 없습니다", data: null }, 404, headers)
    }

    // 이벤트 데이터 파싱
    let eventData
    try {
      eventData = parseRedisData(eventJson)
    } catch (parseError) {
      console.error("이벤트 데이터 파싱 오류:", parseError)
      return createSafeResponse({ error: "이벤트 데이터 파싱에 실패했습니다", data: null }, 500, headers)
    }

    if (!eventData) {
      return createSafeResponse({ error: "이벤트 데이터 파싱에 실패했습니다", data: null }, 500, headers)
    }

    // ID 필드 추가
    eventData.id = eventId

    // 날짜 문자열을 Date 객체로 변환
    try {
      if (eventData.startDate) {
        eventData.startDate = new Date(eventData.startDate)
      }
      if (eventData.endDate) {
        eventData.endDate = new Date(eventData.endDate)
      }
      if (eventData.createdAt) {
        eventData.createdAt = new Date(eventData.createdAt)
      }
    } catch (dateError) {
      console.error("날짜 변환 오류:", dateError)
      // 날짜 변환 오류는 치명적이지 않으므로 계속 진행
    }

    return createSafeResponse({ data: eventData }, 200, headers)
  } catch (error) {
    console.error("이벤트 데이터 가져오기 오류:", error)

    // 오류 응답을 항상 안전하게 반환
    return createSafeResponse(
      {
        error: "이벤트 데이터를 가져오는 중 오류가 발생했습니다",
        message: error instanceof Error ? error.message : String(error),
        data: null,
      },
      500,
      headers,
    )
  }
}

// PUT 메서드 정의
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const eventId = params.id
    const eventData = await request.json()

    if (!eventId) {
      return NextResponse.json({ error: "이벤트 ID가 필요합니다", success: false }, { status: 400 })
    }

    // Redis 클라이언트 초기화
    const redis = getRedisClient()

    // 이벤트 존재 여부 확인
    const eventKey = `event:${eventId}`
    const exists = await redis.exists(eventKey)

    if (exists !== 1) {
      return NextResponse.json({ error: "이벤트를 찾을 수 없습니다", success: false }, { status: 404 })
    }

    // 기존 이벤트 데이터 가져오기
    const existingEventJson = await redis.get(eventKey)
    let existingEvent

    try {
      if (typeof existingEventJson === "string") {
        existingEvent = JSON.parse(existingEventJson)
      } else if (Buffer.isBuffer(existingEventJson)) {
        existingEvent = JSON.parse(existingEventJson.toString("utf-8"))
      } else {
        existingEvent = existingEventJson
      }
    } catch (error) {
      console.error("기존 이벤트 데이터 파싱 오류:", error)
      return NextResponse.json({ error: "이벤트 데이터 파싱에 실패했습니다", success: false }, { status: 500 })
    }

    // 권한 확인 (이벤트 생성자만 수정 가능)
    if (existingEvent.creatorPhoneNumber !== eventData.creatorPhoneNumber) {
      return NextResponse.json({ error: "이벤트 수정 권한이 없습니다", success: false }, { status: 403 })
    }

    // 업데이트된 이벤트 데이터 생성
    const updatedEvent = {
      ...existingEvent,
      ...eventData,
      updatedAt: new Date().toISOString(),
    }

    // Redis에 업데이트된 이벤트 저장
    await redis.set(eventKey, JSON.stringify(updatedEvent))

    // 초대된 사용자 목록 업데이트
    if (eventData.invitedPhoneNumbers && Array.isArray(eventData.invitedPhoneNumbers)) {
      // 기존 초대 목록
      const existingInvited = existingEvent.invitedPhoneNumbers || []

      // 새로 추가된 사용자 찾기
      const newlyInvited = eventData.invitedPhoneNumbers.filter((phone: string) => !existingInvited.includes(phone))

      // 제거된 사용자 찾기
      const removedInvited = existingInvited.filter((phone: string) => !eventData.invitedPhoneNumbers.includes(phone))

      // 새로 추가된 사용자의 초대 이벤트 목록에 추가
      for (const phoneNumber of newlyInvited) {
        await redis.sadd(`user_invited:${phoneNumber}`, eventId)
      }

      // 제거된 사용자의 초대 이벤트 목록에서 제거
      for (const phoneNumber of removedInvited) {
        await redis.srem(`user_invited:${phoneNumber}`, eventId)
      }
    }

    return NextResponse.json({
      success: true,
      message: "이벤트가 성공적으로 업데이트되었습니다",
    })
  } catch (error) {
    console.error("이벤트 업데이트 오류:", error)
    return NextResponse.json(
      {
        error: "이벤트 업데이트 중 오류가 발생했습니다",
        message: error instanceof Error ? error.message : String(error),
        success: false,
      },
      { status: 500 },
    )
  }
}

// DELETE 메서드 정의
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  // 캐시 방지 헤더 설정
  const headers = new Headers()
  headers.set("Cache-Control", "no-store, max-age=0")
  headers.set("Pragma", "no-cache")
  headers.set("Expires", "0")

  console.log("DELETE 요청 시작:", params.id)

  try {
    const eventId = params.id

    // 요청 본문 파싱
    let phoneNumber
    try {
      const body = await request.json()
      phoneNumber = body.phoneNumber
      console.log("삭제 요청 받음 (DELETE):", { eventId, phoneNumber })
    } catch (parseError) {
      console.error("요청 본문 파싱 오류:", parseError)
      return NextResponse.json(
        {
          error: "요청 본문을 파싱할 수 없습니다",
          success: false,
        },
        { status: 400, headers },
      )
    }

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
      { status: 500, headers },
    )
  }
}

