"use client"

import type React from "react"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { format, addDays, startOfWeek, isWithinInterval } from "date-fns"
import { ko } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface WeeklyTimeTableProps {
  dates: Date[]
  value: Record<string, string[]>
  onChange: (value: Record<string, string[]>) => void
}

export function WeeklyTimeTable({ dates, value, onChange }: WeeklyTimeTableProps) {
  // 현재 표시 중인 주의 시작일
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    if (dates.length > 0) {
      return startOfWeek(dates[0], { weekStartsOn: 1 }) // 월요일부터 시작
    }
    return startOfWeek(new Date(), { weekStartsOn: 1 })
  })

  // 현재 주의 날짜들 계산
  const currentWeekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i))
  }, [currentWeekStart])

  // 이벤트 기간 내의 날짜인지 확인
  const isDateInRange = useCallback(
    (date: Date) => {
      if (dates.length === 0) return false

      const firstDate = new Date(dates[0])
      const lastDate = new Date(dates[dates.length - 1])

      return isWithinInterval(date, {
        start: new Date(firstDate.setHours(0, 0, 0, 0)),
        end: new Date(lastDate.setHours(23, 59, 59, 999)),
      })
    },
    [dates],
  )

  // 이벤트 기간 내의 날짜만 필터링
  const visibleDates = useMemo(() => {
    return currentWeekDates.filter((date) => isDateInRange(date))
  }, [currentWeekDates, isDateInRange])

  // 이전 주로 이동
  const goToPreviousWeek = useCallback(() => {
    setCurrentWeekStart((prevStart) => addDays(prevStart, -7))
  }, [])

  // 다음 주로 이동
  const goToNextWeek = useCallback(() => {
    setCurrentWeekStart((prevStart) => addDays(prevStart, 7))
  }, [])

  // 시간 슬롯 (00시부터 23시까지)
  const timeSlots = useMemo(() => Array.from({ length: 24 }, (_, i) => i), [])

  // 모바일 여부 확인
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)

    return () => {
      window.removeEventListener("resize", checkMobile)
    }
  }, [])

  // 선택 모드 상태
  const [selectionMode, setSelectionMode] = useState<"select" | "deselect" | null>(null)

  // 마지막으로 터치한 셀 정보
  const [lastTouchedCell, setLastTouchedCell] = useState<{ dateStr: string; hour: number } | null>(null)

  // 터치 이벤트 타이머 참조
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 셀이 선택되었는지 확인
  const isCellSelected = useCallback(
    (dateStr: string, hour: number) => {
      const hourStr = `${hour.toString().padStart(2, "0")}:00`
      return value[dateStr]?.includes(hourStr) || false
    },
    [value],
  )

  // 셀 선택 상태 토글 함수
  const toggleCellSelection = useCallback(
    (dateStr: string, hour: number, mode: "select" | "deselect") => {
      const hourStr = `${hour.toString().padStart(2, "0")}:00`

      const newValue = { ...value }

      if (!newValue[dateStr]) {
        newValue[dateStr] = []
      }

      if (mode === "select") {
        // 선택 모드: 시간 추가
        if (!newValue[dateStr].includes(hourStr)) {
          newValue[dateStr] = [...newValue[dateStr], hourStr].sort()
        }
      } else {
        // 해제 모드: 시간 제거
        newValue[dateStr] = newValue[dateStr].filter((time) => time !== hourStr)
      }

      onChange(newValue)
    },
    [value, onChange],
  )

  // 셀 클릭/터치 핸들러
  const handleCellInteraction = useCallback(
    (dateStr: string, hour: number) => {
      const isSelected = isCellSelected(dateStr, hour)

      // 현재 셀의 상태에 따라 선택 또는 해제 모드 결정
      const mode = isSelected ? "deselect" : "select"

      // 셀 선택 상태 토글
      toggleCellSelection(dateStr, hour, mode)

      // 선택 모드 설정
      setSelectionMode(mode)

      // 마지막으로 터치한 셀 정보 업데이트
      setLastTouchedCell({ dateStr, hour })
    },
    [isCellSelected, toggleCellSelection],
  )

  // 터치 이동 핸들러
  const handleTouchMove = useCallback(
    (e: React.TouchEvent, dateStr: string, hour: number) => {
      // 이미 선택 모드가 설정되어 있고, 마지막으로 터치한 셀과 다른 셀인 경우에만 처리
      if (selectionMode && lastTouchedCell && (lastTouchedCell.dateStr !== dateStr || lastTouchedCell.hour !== hour)) {
        // 이전 타이머가 있으면 취소
        if (touchTimerRef.current) {
          clearTimeout(touchTimerRef.current)
        }

        // 약간의 지연 후 셀 선택 상태 변경 (연속적인 터치 이벤트 방지)
        touchTimerRef.current = setTimeout(() => {
          toggleCellSelection(dateStr, hour, selectionMode)
          setLastTouchedCell({ dateStr, hour })
        }, 50)
      }
    },
    [selectionMode, lastTouchedCell, toggleCellSelection],
  )

  // 터치 종료 핸들러
  const handleTouchEnd = useCallback(() => {
    // 선택 모드 초기화
    setSelectionMode(null)
    setLastTouchedCell(null)

    // 타이머 정리
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current)
      touchTimerRef.current = null
    }
  }, [])

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (touchTimerRef.current) {
        clearTimeout(touchTimerRef.current)
      }
    }
  }, [])

  // 이벤트 기간 내 날짜가 없는 경우
  if (visibleDates.length === 0) {
    return (
      <div className="text-center p-4 border rounded-md bg-muted/20">
        <p>현재 주에 약속 날짜가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={goToPreviousWeek}
          disabled={!isDateInRange(addDays(currentWeekStart, -1))}
          type="button"
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> 이전 주
        </Button>
        <div className="font-medium text-sm sm:text-base text-center">
          {format(currentWeekStart, "yyyy년 MM월 dd일", { locale: ko })} ~
          {format(addDays(currentWeekStart, 6), " MM월 dd일", { locale: ko })}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={goToNextWeek}
          disabled={!isDateInRange(addDays(currentWeekStart, 7))}
          type="button"
        >
          다음 주 <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      <div className="overflow-auto border rounded-md shadow-sm">
        <div className="min-w-max">
          {/* 헤더 행 */}
          <div className="flex">
            <div className="w-6 sm:w-12 shrink-0 p-1 font-medium bg-muted/30 border-r border-b sticky left-0 z-10 select-none text-[10px] sm:text-sm">
              시간
            </div>
            {visibleDates.map((date) => (
              <div
                key={date.toISOString()}
                className="w-8 sm:w-16 shrink-0 p-1 font-medium text-center bg-muted/30 border-r border-b select-none text-[10px] sm:text-sm"
              >
                {format(date, "E", { locale: ko })}
                <div className="text-[8px] sm:text-xs">{format(date, "MM/dd", { locale: ko })}</div>
              </div>
            ))}
          </div>

          {/* 시간 행 */}
          {timeSlots.map((hour) => (
            <div key={hour} className="flex">
              <div className="w-6 sm:w-12 shrink-0 p-1 border-r border-b text-center sticky left-0 bg-background z-10 select-none pointer-events-none text-[10px] sm:text-sm">
                {hour.toString().padStart(2, "0")}
              </div>
              {visibleDates.map((date) => {
                const dateStr = format(date, "yyyy-MM-dd")
                const isSelected = isCellSelected(dateStr, hour)

                return (
                  <div
                    key={`${dateStr}-${hour}`}
                    className={cn(
                      "w-8 sm:w-16 shrink-0 h-4 sm:h-8 border-r border-b cursor-pointer transition-colors",
                      isSelected ? "bg-primary/80" : "bg-background hover:bg-primary/10",
                    )}
                    onClick={() => handleCellInteraction(dateStr, hour)}
                    onTouchStart={() => handleCellInteraction(dateStr, hour)}
                    onTouchMove={(e) => handleTouchMove(e, dateStr, hour)}
                    onTouchEnd={handleTouchEnd}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        <p>
          셀을 터치하여 선택하거나 해제할 수 있습니다. 터치한 상태에서 움직이면 여러 시간을 한 번에 선택할 수 있습니다.
        </p>
      </div>
    </div>
  )
}

