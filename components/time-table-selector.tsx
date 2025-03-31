"use client"

import { useState, useRef, useEffect } from "react"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { cn } from "@/lib/utils"

interface TimeTableSelectorProps {
  dates: Date[]
  value: Record<string, string[]>
  onChange: (value: Record<string, string[]>) => void
}

export function TimeTableSelector({ dates, value, onChange }: TimeTableSelectorProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [startCell, setStartCell] = useState<{ date: string; hour: number } | null>(null)
  const [lastHoveredCell, setLastHoveredCell] = useState<{ date: string; hour: number } | null>(null)
  const [selectionType, setSelectionType] = useState<"select" | "deselect">("select")
  const tableRef = useRef<HTMLDivElement>(null)

  // 시간 슬롯 생성 (00시부터 23시까지)
  const timeSlots = Array.from({ length: 24 }, (_, i) => i)

  // 셀이 선택되었는지 확인
  const isCellSelected = (dateStr: string, hour: number) => {
    const hourStr = `${hour.toString().padStart(2, "0")}:00`
    return value[dateStr]?.includes(hourStr) || false
  }

  // 드래그 중인 셀인지 확인
  const isInDragSelection = (dateStr: string, hour: number) => {
    if (!isDragging || !startCell || !lastHoveredCell) return false

    const dateIndex = dates.findIndex((d) => format(d, "yyyy-MM-dd") === dateStr)
    const startDateIndex = dates.findIndex((d) => format(d, "yyyy-MM-dd") === startCell.date)
    const endDateIndex = dates.findIndex((d) => format(d, "yyyy-MM-dd") === lastHoveredCell.date)

    const minDateIndex = Math.min(startDateIndex, endDateIndex)
    const maxDateIndex = Math.max(startDateIndex, endDateIndex)

    const minHour = Math.min(startCell.hour, lastHoveredCell.hour)
    const maxHour = Math.max(startCell.hour, lastHoveredCell.hour)

    return dateIndex >= minDateIndex && dateIndex <= maxDateIndex && hour >= minHour && hour <= maxHour
  }

  // 마우스 다운 핸들러
  const handleMouseDown = (dateStr: string, hour: number) => {
    setIsDragging(true)
    setStartCell({ date: dateStr, hour })
    setLastHoveredCell({ date: dateStr, hour })

    // 현재 셀의 상태에 따라 선택 또는 해제 모드 결정
    const isSelected = isCellSelected(dateStr, hour)
    setSelectionType(isSelected ? "deselect" : "select")
  }

  // 마우스 이동 핸들러
  const handleMouseOver = (dateStr: string, hour: number) => {
    if (isDragging) {
      setLastHoveredCell({ date: dateStr, hour })
    }
  }

  // 마우스 업 핸들러
  const handleMouseUp = () => {
    if (isDragging && startCell && lastHoveredCell) {
      const startDateIndex = dates.findIndex((d) => format(d, "yyyy-MM-dd") === startCell.date)
      const endDateIndex = dates.findIndex((d) => format(d, "yyyy-MM-dd") === lastHoveredCell.date)

      const minDateIndex = Math.min(startDateIndex, endDateIndex)
      const maxDateIndex = Math.max(startDateIndex, endDateIndex)

      const minHour = Math.min(startCell.hour, lastHoveredCell.hour)
      const maxHour = Math.max(startCell.hour, lastHoveredCell.hour)

      // 새로운 가용성 데이터 생성
      const newValue = { ...value }

      // 선택된 날짜 범위에 대해 처리
      for (let dateIndex = minDateIndex; dateIndex <= maxDateIndex; dateIndex++) {
        const dateStr = format(dates[dateIndex], "yyyy-MM-dd")

        if (!newValue[dateStr]) {
          newValue[dateStr] = []
        }

        // 선택된 시간 범위에 대해 처리
        for (let hour = minHour; hour <= maxHour; hour++) {
          const hourStr = `${hour.toString().padStart(2, "0")}:00`

          if (selectionType === "select") {
            // 선택 모드: 시간 추가
            if (!newValue[dateStr].includes(hourStr)) {
              newValue[dateStr] = [...newValue[dateStr], hourStr].sort()
            }
          } else {
            // 해제 모드: 시간 제거
            newValue[dateStr] = newValue[dateStr].filter((time) => time !== hourStr)
          }
        }
      }

      onChange(newValue)
    }

    setIsDragging(false)
    setStartCell(null)
    setLastHoveredCell(null)
  }

  // 마우스 이벤트 리스너 추가
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp()
      }
    }

    document.addEventListener("mouseup", handleGlobalMouseUp)
    return () => {
      document.removeEventListener("mouseup", handleGlobalMouseUp)
    }
  }, [isDragging, startCell, lastHoveredCell])

  return (
    <div className="overflow-auto border rounded-md" ref={tableRef} onMouseLeave={handleMouseUp}>
      <div className="min-w-max">
        {/* 헤더 행 */}
        <div className="flex">
          <div className="w-16 shrink-0 p-2 font-medium bg-muted border-r border-b">시간</div>
          {dates.map((date) => (
            <div
              key={date.toISOString()}
              className="w-24 shrink-0 p-2 font-medium text-center bg-muted border-r border-b"
            >
              {format(date, "M/d (E)", { locale: ko })}
            </div>
          ))}
        </div>

        {/* 시간 행 */}
        {timeSlots.map((hour) => (
          <div key={hour} className="flex">
            <div className="w-16 shrink-0 p-2 border-r border-b text-center">{hour.toString().padStart(2, "0")}:00</div>
            {dates.map((date) => {
              const dateStr = format(date, "yyyy-MM-dd")
              const isSelected = isCellSelected(dateStr, hour)
              const isInSelection = isInDragSelection(dateStr, hour)

              return (
                <div
                  key={`${dateStr}-${hour}`}
                  className={cn(
                    "w-24 shrink-0 h-8 border-r border-b cursor-pointer transition-colors",
                    isSelected ? "bg-primary" : "bg-background hover:bg-primary/20",
                    isDragging && isInSelection && selectionType === "select" && "bg-primary/60",
                    isDragging && isInSelection && selectionType === "deselect" && "bg-background",
                  )}
                  onMouseDown={() => handleMouseDown(dateStr, hour)}
                  onMouseOver={() => handleMouseOver(dateStr, hour)}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

