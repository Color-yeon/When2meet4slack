"use client"

import { useState, useEffect } from "react"

export function useMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // 초기 설정
    setIsMobile(window.innerWidth < 768)

    // 리사이즈 이벤트 리스너
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    window.addEventListener("resize", handleResize)

    // 클린업 함수
    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  return isMobile
}

