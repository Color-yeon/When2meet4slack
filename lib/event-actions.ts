"use server"

import { getRedisClient } from "@/lib/redis"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

/**
 * 이벤트를 삭제하는 서버 액션
 */
export async function deleteEvent(formData: FormData) {
  const eventId = formData.get("eventId") as string
  const phoneNumber = formData.get("phoneNumber") as string

  console.log("서버 액션: 이벤트 삭제 시작", { eventId, phoneNumber })

  if (!eventId || !phoneNumber) {
    console.error("필수 파라미터 누락:", { eventId, phoneNumber })
    return {
      success: false,
      error: "이벤트 ID와 전화번호가 필요합니다",
    }
  }

  try {
    // Redis 클라이언트 초기화
    const redis = getRedisClient()

    // 이벤트 존재 여부 확인
    const eventKey = `event:${eventId}`
    const exists = await redis.exists(eventKey)

    console.log("이벤트 존재 여부:", exists)

    if (exists !== 1) {
      return {
        success: false,
        error: "이벤트를 찾을 수 없습니다",
      }
    }

    // 이벤트 데이터 가져오기
    const eventJson = await redis.get(eventKey)
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
      return {
        success: false,
        error: "이벤트 데이터 파싱에 실패했습니다",
      }
    }

    // 권한 확인 (이벤트 생성자만 삭제 가능)
    if (event.creatorPhoneNumber !== phoneNumber) {
      console.error("권한 오류:", {
        creatorPhone: event.creatorPhoneNumber,
        requestPhone: phoneNumber,
      })
      return {
        success: false,
        error: "이벤트 삭제 권한이 없습니다",
      }
    }

    // 이벤트 삭제 작업 시작
    console.log("이벤트 삭제 시작:", eventId)

    // 1. 이벤트 삭제
    await redis.del(eventKey)

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

    // 캐시 무효화 및 리디렉션
    revalidatePath("/dashboard")
    redirect("/dashboard")
  } catch (error) {
    console.error("이벤트 삭제 처리 중 예외 발생:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "이벤트 삭제 중 오류가 발생했습니다",
    }
  }
}

