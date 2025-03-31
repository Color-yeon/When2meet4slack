import type React from "react"
import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "약속 일정 서비스",
  description: "여러명이 약속에 참석할 수 있는 시간을 설정하고 최종적으로 만날 수 있는 시간을 확정합니다",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}

