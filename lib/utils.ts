import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { isValid } from "date-fns"

// 클래스 이름 결합 유틸리티
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 날짜 캐싱을 위한 맵
const dateCache = new Map<string, Date | null>()
const DATE_CACHE_MAX_SIZE = 100

// 날짜 객체를 안전하게 변환하는 유틸리티 (null 반환 가능)
export function safeDateOrNull(date: Date | string | number | null | undefined): Date | null {
  if (!date) return null

  // Date 객체는 바로 반환
  if (date instanceof Date) return isValid(date) ? date : null

  // 문자열/숫자 날짜는 캐싱
  const cacheKey = String(date)
  if (dateCache.has(cacheKey)) {
    return dateCache.get(cacheKey)
  }

  const parsedDate = new Date(date)
  const result = isValid(parsedDate) ? parsedDate : null

  // 캐시에 저장 (캐시 크기 제한)
  if (dateCache.size >= DATE_CACHE_MAX_SIZE) {
    const firstKey = dateCache.keys().next().value
    dateCache.delete(firstKey)
  }
  dateCache.set(cacheKey, result)

  return result
}

// 날짜 객체를 안전하게 변환하는 유틸리티 (기본값 반환)
export function safeDate(date: Date | string | number | null | undefined): Date {
  const result = safeDateOrNull(date)
  return result || new Date()
}

// 날짜 범위 생성 유틸리티 (최적화)
export function generateDateRange(startDate: Date, endDate: Date, maxDays = 30): Date[] {
  const dates: Date[] = []
  const start = new Date(startDate)
  const end = new Date(endDate)

  // 최대 날짜 수 제한
  let dayCount = 0
  const currentDate = new Date(start)

  while (currentDate <= end && dayCount < maxDays) {
    dates.push(new Date(currentDate))
    currentDate.setDate(currentDate.getDate() + 1)
    dayCount++
  }

  return dates
}

// 이벤트 데이터 파싱 유틸리티
export function parseEventData(eventJson: any, eventId: string) {
  try {
    let event
    if (typeof eventJson === "string") {
      event = JSON.parse(eventJson)
    } else if (Buffer.isBuffer(eventJson)) {
      event = JSON.parse(eventJson.toString("utf-8"))
    } else {
      event = eventJson
    }

    // ID 필드 추가
    event.id = eventId

    // 날짜 문자열을 Date 객체로 변환 - 필요한 경우에만 변환
    if (event.startDate && typeof event.startDate === "string") {
      event.startDate = safeDate(event.startDate)
    }
    if (event.endDate && typeof event.endDate === "string") {
      event.endDate = safeDate(event.endDate)
    }
    if (event.createdAt && typeof event.createdAt === "string") {
      event.createdAt = safeDate(event.createdAt)
    }

    return event
  } catch (error) {
    console.error(`이벤트 데이터 파싱 오류: ${eventId}`, error)
    return null
  }
}

// 디바운스 유틸리티
export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// 스로틀 유틸리티
export function throttle<T extends (...args: any[]) => any>(func: T, limit: number): (...args: Parameters<T>) => void {
  let inThrottle = false

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

// 이벤트 형식 변환 함수
export function formatEventData(eventData: any) {
  if (!eventData) return null

  try {
    // 날짜를 안전하게 변환
    const startDate = safeDate(eventData.startDate)
    const endDate = safeDate(eventData.endDate)

    // 시작일부터 종료일까지의 모든 날짜 생성
    const dates = generateDateRange(startDate, endDate)

    // 기존 이벤트 데이터에 dates 속성 추가
    return {
      ...eventData,
      dates,
      startTime: eventData.startTime || "00:00",
      endTime: eventData.endTime || "24:00",
    }
  } catch (error) {
    console.error("이벤트 데이터 형식 변환 오류:", error)
    return eventData
  }
}

