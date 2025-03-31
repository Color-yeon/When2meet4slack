"use client"

import type React from "react"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { format, addDays, startOfWeek, isWithinInterval } from "date-fns"
import { ko } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SimpleTimeTableProps {
  dates: Date[]
  value: Record<string, string[]>
  onChange: (value: Record<string, string[]>) => void
}

export function SimpleTimeTable({ dates, value, onChange }: SimpleTimeTableProps) {
  // 현재 표시 중인 주의 시작일
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    if (dates.length > 0) {
      return startOfWeek(dates[0], { weekStartsOn: 1 }) // 월요일부터 시작
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

  // 시간 슬롯 (00시부터 23시까지)
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), [])

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
  const [lastTouchedCell, setLastTouchedCell] = useState<{ dateIndex: number; hour: number } | null>(null)

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
    (dateIndex: number, hour: number, mode: "select" | "deselect") => {
      if (dateIndex < 0 || dateIndex >= currentWeekDates.length) return

      const date = currentWeekDates[dateIndex]
      if (!isDateInRange(date)) return // 이벤트 기간 외 날짜는 선택 불가

      const dateStr = format(date, "yyyy-MM-dd")
      const hourStr = `${hour.toString().padStart(2, "0")}:00`

      // 불변성을 유지하면서 상태 업데이트 최적화
      onChange((prevValue) => {
        const newValue = { ...prevValue }

        if (!newValue[dateStr]) {
          newValue[dateStr] = []
        }

        if (mode === "select") {
          // 선택 모드: 시간 추가 (중복 체크)
          if (!newValue[dateStr].includes(hourStr)) {
            newValue[dateStr] = [...newValue[dateStr], hourStr].sort()
          }
        } else {
          // 해제 모드: 시간 제거
          newValue[dateStr] = newValue[dateStr].filter((time) => time !== hourStr)
        }

        return newValue
      })
    },
    [currentWeekDates, isDateInRange, onChange],
  )

  // 셀 클릭/터치 핸들러
  const handleCellInteraction = useCallback(
    (dateIndex: number, hour: number) => {
      if (dateIndex < 0 || dateIndex >= currentWeekDates.length) return

      const date = currentWeekDates[dateIndex]
      if (!isDateInRange(date)) return // 이벤트 기간 외 날짜는 선택 불가

      const dateStr = format(date, "yyyy-MM-dd")
      const isSelected = isCellSelected(dateStr, hour)

      // 현재 셀의 상태에 따라 선택 또는 해제 모드 결정
      const mode = isSelected ? "deselect" : "select"

      // 셀 선택 상태 토글
      toggleCellSelection(dateIndex, hour, mode)

      // 선택 모드 설정
      setSelectionMode(mode)

      // 마지막으로 터치한 셀 정보 업데이트
      setLastTouchedCell({ dateIndex, hour })
    },
    [currentWeekDates, isDateInRange, isCellSelected, toggleCellSelection],
  )

  // 마우스 이동 핸들러
  const handleMouseMove = useCallback(
    (dateIndex: number, hour: number) => {
      if (selectionMode && lastTouchedCell) {
        const date = currentWeekDates[dateIndex]
        if (!isDateInRange(date)) return // 이벤트 기간 외 날짜는 선택 불가

        toggleCellSelection(dateIndex, hour, selectionMode)
        setLastTouchedCell({ dateIndex, hour })
      }
    },
    [selectionMode, lastTouchedCell, toggleCellSelection, currentWeekDates, isDateInRange],
  )

  // 터치 이동 핸들러
  const handleTouchMove = useCallback(
    (e: React.TouchEvent, dateIndex: number, hour: number) => {
      // 이미 선택 모드가 설정되어 있고, 마지막으로 터치한 셀과 다른 셀인 경우에만 처리
      if (
        selectionMode &&
        lastTouchedCell &&
        (lastTouchedCell.dateIndex !== dateIndex || lastTouchedCell.hour !== hour)
      ) {
        const date = currentWeekDates[dateIndex]
        if (!isDateInRange(date)) return // 이벤트 기간 외 날짜는 선택 불가

        // 이전 타이머가 있으면 취소
        if (touchTimerRef.current) {
          clearTimeout(touchTimerRef.current)
        }

        // 약간의 지연 후 셀 선택 상태 변경 (연속적인 터치 이벤트 방지)
        touchTimerRef.current = setTimeout(() => {
          toggleCellSelection(dateIndex, hour, selectionMode)
          setLastTouchedCell({ dateIndex, hour })
        }, 50)
      }
    },
    [selectionMode, lastTouchedCell, toggleCellSelection, currentWeekDates, isDateInRange],
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

  // 마우스 이벤트 리스너 추가
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setSelectionMode(null)
      setLastTouchedCell(null)
    }

    window.addEventListener("mouseup", handleGlobalMouseUp)
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp)
      if (touchTimerRef.current) {
        clearTimeout(touchTimerRef.current)
      }
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

  if (!dates || dates.length === 0) {
    return <div>날짜 정보가 없습니다.</div>
  }

  // 현재 주에 이벤트 기간 내 날짜가 없는 경우
  if (!currentWeekDates.some((date) => isDateInRange(date))) {
    return (
      <div className="text-center p-4 border rounded-md bg-muted/20">
        <p>현재 주에 약속 날짜가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
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
              <th className="sticky left-0 z-10 bg-background border p-1 min-w-[30px] sm:min-w-[60px] select-none">
                <span className="text-[10px] sm:text-xs">시간</span>
              </th>
              {currentWeekDates.map((date, index) => {
                const isSelectable = isDateInRange(date)
                return (
                  <th
                    key={index}
                    className={cn(
                      "border p-1 min-w-[35px] sm:min-w-[80px] text-center select-none",
                      !isSelectable && "bg-gray-100 text-gray-400 dark:bg-gray-800",
                    )}
                  >
                    <div className="text-[10px] sm:text-xs">{format(date, "MM/dd", { locale: ko })}</div>
                    <div className="text-[8px] font-normal">{format(date, "E", { locale: ko })}</div>
                    {!isSelectable && <div className="text-[8px] text-gray-500">선택불가</div>}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {hours.map((hour) => (
              <tr key={hour}>
                <td className="sticky left-0 z-10 bg-background border p-1 text-center text-[10px] sm:text-xs select-none pointer-events-none">
                  {hour.toString().padStart(2, "0")}
                </td>
                {currentWeekDates.map((date, dateIndex) => {
                  const isSelectable = isDateInRange(date)
                  const dateStr = format(date, "yyyy-MM-dd")
                  const isSelected = isSelectable && isCellSelected(dateStr, hour)

                  return (
                    <td
                      key={dateIndex}
                      className={cn(
                        "border p-0 h-4 sm:h-10",
                        isSelectable
                          ? isSelected
                            ? "bg-primary"
                            : "hover:bg-primary/10 cursor-pointer"
                          : "bg-gray-100 dark:bg-gray-800 cursor-not-allowed",
                      )}
                      onClick={isSelectable ? () => handleCellInteraction(dateIndex, hour) : undefined}
                      onMouseDown={isSelectable ? () => handleCellInteraction(dateIndex, hour) : undefined}
                      onMouseMove={isSelectable && selectionMode ? () => handleMouseMove(dateIndex, hour) : undefined}
                      onTouchStart={isSelectable ? () => handleCellInteraction(dateIndex, hour) : undefined}
                      onTouchMove={isSelectable ? (e) => handleTouchMove(e, dateIndex, hour) : undefined}
                      onTouchEnd={isSelectable ? handleTouchEnd : undefined}
                    />
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-muted-foreground">
        <p>
          셀을 터치하여 선택하거나 해제할 수 있습니다. 터치한 상태에서 움직이면 여러 시간을 한 번에 선택할 수 있습니다.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          회색으로 표시된 날짜는 약속 기간에 포함되지 않아 선택할 수 없습니다.
        </p>
      </div>
    </div>
  )
}

