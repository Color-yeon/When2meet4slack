"use client"

import type * as React from "react"
import { Input } from "@/components/ui/input"

interface PhoneNumberInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onEnter?: () => void
}

export function PhoneNumberInput({ value, onChange, placeholder, onEnter }: PhoneNumberInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && onEnter) {
      e.preventDefault()
      onEnter()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 숫자만 입력 가능하도록 처리
    const newValue = e.target.value.replace(/[^0-9]/g, "")
    onChange(newValue)
  }

  return (
    <Input
      type="tel"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      onKeyDown={handleKeyDown}
      maxLength={11}
    />
  )
}

