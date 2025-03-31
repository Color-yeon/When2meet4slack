"use client"

import type * as React from "react"
import { format } from "date-fns"
import { Input } from "@/components/ui/input"

interface SimpleDatePickerProps {
  date?: Date
  onSelect: (date: Date | undefined) => void
  placeholder?: string
}

export function SimpleDatePicker({ date, onSelect, placeholder = "날짜 선택" }: SimpleDatePickerProps) {
  // 날짜를 YYYY-MM-DD 형식으로 변환
  const formatDateForInput = (date?: Date): string => {
    if (!date) return ""
    return format(date, "yyyy-MM-dd")
  }

  // 입력 변경 처리
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (!value) {
      onSelect(undefined)
      return
    }

    try {
      const newDate = new Date(value)
      // 유효한 날짜인지 확인
      if (!isNaN(newDate.getTime())) {
        onSelect(newDate)
      }
    } catch (error) {
      console.error("날짜 변환 오류:", error)
    }
  }

  return (
    <Input
      type="date"
      value={formatDateForInput(date)}
      onChange={handleChange}
      placeholder={placeholder}
      className="w-full"
    />
  )
}

