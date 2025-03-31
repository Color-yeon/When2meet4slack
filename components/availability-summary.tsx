"use client"
import { useMemo, useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format, addDays, startOfWeek, isWithinInterval } from "date-fns"
import { ko } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

export function AvailabilitySummary({ event, availabilities }: { event: any; availabilities: any[] }) {
  // 데이터가 없는 경우 처리
  if (!event || !event.dates || event.dates.length === 0 || !availabilities || availabilities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>참여자 가능 시간</CardTitle>
        </CardHeader>
        <CardContent>
          <p>아직 제출된 가능한 시간 정보가 없습니다.</p>
        </CardContent>
      </Card>
    )
  }

  // 현재 표시 중인 주의 시작일
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    if (event.dates.length > 0) {
      return startOfWeek(new Date(event.dates[0]), { weekStartsOn: 1 }) // 월요일부터 시작
    }
    return startOfWeek(new Date(), { weekStartsOn: 1 })
  })

  // 현재 주의 날짜들 계산 - 메모이제이션 적용
  const currentWeekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i))
  }, [currentWeekStart])

  // 이벤트 기간 내의 날짜인지 확인 - 메모이제이션 적용
  const isDateInRange = useCallback(
    (date: Date) => {
      if (!event.dates || event.dates.length === 0) return false

      const firstDate = new Date(event.dates[0])
      const lastDate = new Date(event.dates[event.dates.length - 1])

      return isWithinInterval(date, {
        start: new Date(firstDate.setHours(0, 0, 0, 0)),
        end: new Date(lastDate.setHours(23, 59, 59, 999)),
      })
    },
    [event.dates],
  )

  // 이전/다음 주 버튼 활성화 여부 - 메모이제이션 적용
  const { hasPreviousWeek, hasNextWeek } = useMemo(() => {
    // 현재 주에 이벤트 기간 내 날짜가 있는지 확인
    const hasCurrentWeekDates = currentWeekDates.some((date) => isDateInRange(date))

    // 이전 주에 이벤트 기간 내 날짜가 있는지 확인
    const previousWeekStart = addDays(currentWeekStart, -7)
    const previousWeekDates = Array.from({ length: 7 }, (_, i) => addDays(previousWeekStart, i))
    const hasPreviousWeekDates = previousWeekDates.some((date) => isDateInRange(date))

    // 다음 주에 이벤트 기간 내 날짜가 있는지 확인
    const nextWeekStart = addDays(currentWeekStart, 7)
    const nextWeekDates = Array.from({ length: 7 }, (_, i) => addDays(nextWeekStart, i))
    const hasNextWeekDates = nextWeekDates.some((date) => isDateInRange(date))

    return {
      hasPreviousWeek: hasPreviousWeekDates,
      hasNextWeek: hasNextWeekDates,
    }
  }, [currentWeekStart, isDateInRange, currentWeekDates])

  // 이전 주로 이동
  const goToPreviousWeek = useCallback(() => {
    setCurrentWeekStart((prevStart) => addDays(prevStart, -7))
  }, [])

  // 다음 주로 이동
  const goToNextWeek = useCallback(() => {
    setCurrentWeekStart((prevStart) => addDays(prevStart, 7))
  }, [])

  // 모바일 여부 확인
  const [isMobile, setIsMobile] = useState(false)

  const checkMobile = useCallback(() => {
    setIsMobile(window.innerWidth < 640)
  }, [])

  useEffect(() => {
    checkMobile()

    window.addEventListener("resize", checkMobile)

    return () => {
      window.removeEventListener("resize", checkMobile)
    }
  }, [checkMobile])

  // 시간대 옵션 생성 (00시부터 23시까지)
  const hours = Array.from({ length: 24 }, (_, i) => i)

  // 날짜별 가용성 데이터 집계 - 메모이제이션 적용
  const availabilityCountByTime = useMemo(() => {
    const countMap = new Map<string, number>()

    for (const date of event.dates) {
      const dateStr = format(new Date(date), "yyyy-MM-dd")

      for (const hour of hours) {
        const hourStr = `${hour.toString().padStart(2, "0")}:00`
        const key = `${dateStr}-${hourStr}`

        const count = availabilities.filter(
          (avail) =>
            avail.availableTimes && avail.availableTimes[dateStr] && avail.availableTimes[dateStr].includes(hourStr),
        ).length

        if (count > 0) {
          countMap.set(key, count)
        }
      }
    }

    return countMap
  }, [event.dates, availabilities, hours])

  // 가장 많은 사람이 가능한 시간 찾기 - 메모이제이션 적용
  const bestTimes = useMemo(() => {
    const allTimeCounts = []

    for (const date of event.dates) {
      const dateObj = new Date(date)
      const dateStr = format(dateObj, "yyyy-MM-dd")

      for (const hour of hours) {
        const hourStr = `${hour.toString().padStart(2, "0")}:00`
        const key = `${dateStr}-${hourStr}`
        const count = availabilityCountByTime.get(key) || 0

        if (count > 0) {
          allTimeCounts.push({
            date: dateObj,
            dateStr,
            hour,
            time: hourStr,
            count,
            participants: availabilities
              .filter(
                (avail) =>
                  avail.availableTimes &&
                  avail.availableTimes[dateStr] &&
                  avail.availableTimes[dateStr].includes(hourStr),
              )
              .map((avail) => avail.name || "익명"),
          })
        }
      }
    }

    // 참여자 수로 정렬
    return allTimeCounts.sort((a, b) => b.count - a.count)
  }, [event.dates, availabilities, availabilityCountByTime, hours])

  // 모든 사람이 가능한 시간 찾기 - 메모이제이션 적용
  const allAvailableTimes = useMemo(() => {
    const totalParticipants = availabilities.length

    return bestTimes
      .filter((time) => time.count === totalParticipants)
      .sort((a, b) => {
        // 먼저 날짜로 정렬
        const dateCompare = a.date.getTime() - b.date.getTime()
        if (dateCompare !== 0) return dateCompare
        // 날짜가 같으면 시간으로 정렬
        return a.hour - b.hour
      })
  }, [bestTimes, availabilities.length])

  // 최대 참여자 수 계산
  const maxCount = bestTimes.length > 0 ? bestTimes[0].count : 0

  // 날짜별 가용성 데이터 집계 함수
  const getAvailabilityCountByTime = useCallback(
    (dateStr: string, hour: number) => {
      const hourStr = `${hour.toString().padStart(2, "0")}:00`
      const key = `${dateStr}-${hourStr}`
      return availabilityCountByTime.get(key) || 0
    },
    [availabilityCountByTime],
  )

  const formatDate = useCallback((date: Date) => {
    return format(date, "MM/dd", { locale: ko })
  }, [])

  const formatDay = useCallback((date: Date) => {
    return format(date, "E", { locale: ko })
  }, [])

  // 현재 주에 이벤트 기간 내 날짜가 없는 경우
  if (!currentWeekDates.some((date) => isDateInRange(date))) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>참여자 가능 시간</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <Button variant="outline" size="sm" onClick={goToPreviousWeek} disabled={!hasPreviousWeek} type="button">
              <ChevronLeft className="h-4 w-4 mr-1" /> 이전 주
            </Button>
            <div className="font-medium text-sm sm:text-base text-center">
              {format(currentWeekStart, "yyyy년 MM월 dd일", { locale: ko })} ~
              {format(addDays(currentWeekStart, 6), " MM월 dd일", { locale: ko })}
            </div>
            <Button variant="outline" size="sm" onClick={goToNextWeek} disabled={!hasNextWeek} type="button">
              다음 주 <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          <div className="text-center p-4 border rounded-md bg-muted/20">
            <p>현재 주에 약속 날짜가 없습니다.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>참여자 가능 시간</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex justify-between items-center mb-4">
            <Button variant="outline" size="sm" onClick={goToPreviousWeek} disabled={!hasPreviousWeek} type="button">
              <ChevronLeft className="h-4 w-4 mr-1" /> 이전 주
            </Button>
            <div className="font-medium text-sm sm:text-base text-center">
              {format(currentWeekStart, "yyyy년 MM월 dd일", { locale: ko })} ~
              {format(addDays(currentWeekStart, 6), " MM월 dd일", { locale: ko })}
            </div>
            <Button variant="outline" size="sm" onClick={goToNextWeek} disabled={!hasNextWeek} type="button">
              다음 주 <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          <div className="overflow-auto border rounded-lg shadow-sm">
            <table className="min-w-full border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-background border p-1 min-w-[30px] sm:min-w-[60px] text-[10px] sm:text-xs">
                    시간
                  </th>
                  {currentWeekDates.map((date, index) => {
                    const isSelectable = isDateInRange(date)
                    return (
                      <th
                        key={index}
                        className={cn(
                          "border p-1 min-w-[35px] sm:min-w-[80px] text-center text-[10px] sm:text-xs",
                          !isSelectable && "bg-gray-100 text-gray-400 dark:bg-gray-800",
                        )}
                      >
                        <div>{formatDate(date)}</div>
                        <div className="text-[8px] sm:text-xs font-normal">{formatDay(date)}</div>
                        {!isSelectable && <div className="text-[8px] text-gray-500">선택불가</div>}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {hours.map((hour) => (
                  <tr key={hour}>
                    <td className="sticky left-0 z-10 bg-background border p-1 text-center text-[10px] sm:text-xs">
                      {hour.toString().padStart(2, "0")}
                    </td>
                    {currentWeekDates.map((date, dateIndex) => {
                      const isSelectable = isDateInRange(date)
                      const dateStr = format(date, "yyyy-MM-dd")
                      const count = isSelectable ? getAvailabilityCountByTime(dateStr, hour) : 0
                      const percentage = availabilities.length > 0 ? (count / availabilities.length) * 100 : 0
                      const isBestTime = count > 0 && count === maxCount
                      const isAllAvailable = count === availabilities.length && count > 0

                      return (
                        <td
                          key={dateIndex}
                          className={cn(
                            "border p-0 h-4 sm:h-10 relative",
                            !isSelectable && "bg-gray-100 dark:bg-gray-800",
                          )}
                        >
                          {isSelectable && count > 0 && (
                            <div
                              className={cn(
                                "absolute inset-0 flex items-center justify-center text-[10px] sm:text-sm",
                                isAllAvailable ? "bg-green-500" : isBestTime ? "bg-blue-500" : "bg-blue-400",
                                "text-white font-medium",
                              )}
                              style={{ opacity: (percentage / 100) * 0.8 + 0.2 }}
                            >
                              {count}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6">
            <h3 className="font-medium mb-2">참여자 목록 ({availabilities.length}명)</h3>
            <ul className="list-disc pl-5 space-y-1">
              {availabilities.map((avail, index) => (
                <li key={index}>{avail.name || "익명"}</li>
              ))}
            </ul>
          </div>

          {allAvailableTimes.length > 0 ? (
            <div className="mt-6">
              <h3 className="font-medium mb-2">모든 사람이 가능한 시간</h3>
              <div className="space-y-2">
                {allAvailableTimes.slice(0, 10).map((time, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-900"
                  >
                    <div>
                      <span className="font-medium">{format(time.date, "MM월 dd일 (E)", { locale: ko })}</span>
                      <span className="ml-2">{time.time}</span>
                    </div>
                    <div className="text-sm font-medium text-green-600 dark:text-green-400">
                      {time.count}명 모두 가능
                    </div>
                  </div>
                ))}
                {allAvailableTimes.length > 10 && (
                  <div className="text-center text-sm text-muted-foreground">
                    외 {allAvailableTimes.length - 10}개 시간대 더 있음
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-6">
              <h3 className="font-medium mb-2">모든 사람이 가능한 시간</h3>
              <div className="p-4 bg-muted/20 rounded-md text-center">
                <p>모든 참여자가 동시에 가능한 시간이 없습니다.</p>
                <p className="text-sm text-muted-foreground mt-2">가장 많은 사람이 가능한 시간을 확인해보세요.</p>
              </div>
            </div>
          )}

          {bestTimes.length > 0 && (
            <div className="mt-6">
              <h3 className="font-medium mb-2">가장 많은 사람이 가능한 시간</h3>
              <div className="space-y-2">
                {bestTimes.slice(0, 5).map((time, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted/20 rounded-md">
                    <div>
                      <span className="font-medium">{format(time.date, "MM월 dd일 (E)", { locale: ko })}</span>
                      <span className="ml-2">{time.time}</span>
                    </div>
                    <div className="text-sm font-medium">{time.count}명 가능</div>
                  </div>
                ))}
                {bestTimes.length > 5 && (
                  <div className="text-center text-sm text-muted-foreground">
                    외 {bestTimes.length - 5}개 시간대 더 있음
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

