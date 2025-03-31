"use client"

import { format, isValid } from "date-fns"
import { ko } from "date-fns/locale"
import { Calendar, Users, MapPin, Info } from "lucide-react"

// 날짜 객체를 안전하게 변환하는 함수
function safeDate(date: Date | string | number | null | undefined): Date | null {
  if (!date) return null

  const parsedDate = date instanceof Date ? date : new Date(date)
  return isValid(parsedDate) ? parsedDate : null
}

// 날짜 형식화 함수
function formatDate(date: Date | string | number | null | undefined): string {
  const parsedDate = safeDate(date)
  if (!parsedDate) return "날짜 없음"
  return format(parsedDate, "yyyy년 M월 d일 (E)", { locale: ko })
}

export function EventDetails({ event }: { event: any }) {
  if (!event) return null

  return (
    <div className="w-full">
      <h1 className="text-3xl font-bold mb-2">{event.title}</h1>

      <div className="flex flex-col gap-2 text-muted-foreground">
        <div className="flex items-start gap-2">
          <Calendar className="h-4 w-4 mt-1" />
          <div>
            <div>
              {formatDate(event.startDate)} ~ {formatDate(event.endDate)}
            </div>
          </div>
        </div>

        {event.location && (
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 mt-1" />
            <div>{event.location}</div>
          </div>
        )}

        <div className="flex items-start gap-2">
          <Users className="h-4 w-4 mt-1" />
          <div>
            주최자: {event.creatorName || event.creatorPhoneNumber}
            {event.invitedPhoneNumbers && event.invitedPhoneNumbers.length > 0 && (
              <span className="ml-2">(총 {event.invitedPhoneNumbers.length}명 초대됨)</span>
            )}
          </div>
        </div>

        {event.description && (
          <div className="flex items-start gap-2 mt-1">
            <Info className="h-4 w-4 mt-1" />
            <div>{event.description}</div>
          </div>
        )}
      </div>
    </div>
  )
}

