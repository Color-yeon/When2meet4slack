"use client"

import type React from "react"
import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "./auth-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { format } from "date-fns"
import { toast } from "@/components/ui/use-toast"
import { SimpleTimeTable } from "@/components/simple-time-table"

export function AvailabilityForm({ event }: { event: any }) {
  const { user } = useAuth()
  const router = useRouter()
  const [name, setName] = useState("")
  const [availableTimes, setAvailableTimes] = useState<Record<string, string[]>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [existingAvailability, setExistingAvailability] = useState<any>(null)
  const [isLoadingExisting, setIsLoadingExisting] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)

  // 기존 가용성 데이터 로드
  useEffect(() => {
    const loadExistingAvailability = async () => {
      if (!user || !event) return

      try {
        setIsLoadingExisting(true)
        setLoadingError(null)

        // 타임아웃 설정
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5초 타임아웃

        const response = await fetch(`/api/availability?eventId=${event.id}&phoneNumber=${user.phoneNumber}`, {
          signal: controller.signal,
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        })

        clearTimeout(timeoutId)

        if (response.ok) {
          try {
            const data = await response.json()
            if (data.availability) {
              setExistingAvailability(data.availability)
              setName(data.availability.name || user.phoneNumber)
              setAvailableTimes(data.availability.availableTimes || {})
            } else {
              setName(user.phoneNumber) // 기본값으로 전화번호 설정
            }
          } catch (jsonError) {
            console.error("가용성 데이터 JSON 파싱 오류:", jsonError)
            setName(user?.phoneNumber || "")
            throw new Error("가용성 데이터 형식이 올바르지 않습니다")
          }
        } else {
          // 응답이 JSON이 아닐 수 있으므로 안전하게 처리
          try {
            const errorData = await response.json()
            throw new Error(errorData.error || "가용성 데이터를 불러오는데 실패했습니다")
          } catch (jsonError) {
            const errorText = await response.text().catch(() => "응답 내용을 읽을 수 없습니다")
            throw new Error(`가용성 데이터 로드 오류: ${response.status} - ${errorText.substring(0, 100)}`)
          }
        }
      } catch (error) {
        console.error("기존 가용성 로드 오류:", error)
        setLoadingError(error instanceof Error ? error.message : "데이터 로딩 중 오류가 발생했습니다")
        // 오류가 발생해도 기본 상태로 계속 진행
        setName(user?.phoneNumber || "")
      } finally {
        setIsLoadingExisting(false)
      }
    }

    loadExistingAvailability()
  }, [user, event])

  // 날짜별 시간대 선택 상태 초기화 - 메모이제이션 적용
  const initialAvailableTimes = useMemo(() => {
    if (!event || !event.dates || existingAvailability || isLoadingExisting) {
      return {}
    }

    const initialTimes: Record<string, string[]> = {}
    // 최대 30일까지만 처리 (성능 보호)
    const maxDays = 30
    const datesToProcess = event.dates.slice(0, maxDays)

    datesToProcess.forEach((date: Date) => {
      const dateStr = format(new Date(date), "yyyy-MM-dd")
      initialTimes[dateStr] = []
    })

    return initialTimes
  }, [event, existingAvailability, isLoadingExisting])

  // 초기화 효과 분리
  useEffect(() => {
    if (Object.keys(initialAvailableTimes).length > 0 && Object.keys(availableTimes).length === 0) {
      setAvailableTimes(initialAvailableTimes)
    }
  }, [initialAvailableTimes, availableTimes])

  // 가용성 제출 함수 - useCallback으로 최적화
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!name.trim()) {
        toast({
          title: "이름을 입력해주세요",
          description: "이름은 필수 입력 항목입니다.",
          variant: "destructive",
        })
        return
      }

      try {
        setIsSubmitting(true)

        // AbortController 생성
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10초 타임아웃

        const response = await fetch(`/api/events/${event.id}/submit-availability`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
          },
          body: JSON.stringify({
            name,
            phoneNumber: user?.phoneNumber,
            availableTimes,
          }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "가능한 시간 제출 실패" }))
          throw new Error(errorData.error || "가능한 시간 제출 실패")
        }

        const result = await response.json()

        if (result.success) {
          toast({
            title: "가능한 시간이 제출되었습니다",
            description: "참여해 주셔서 감사합니다.",
          })

          // 페이지 새로고침하여 최신 데이터 표시
          router.refresh()
        } else {
          throw new Error(result.error || "가용성 제출 실패")
        }
      } catch (error) {
        console.error("가용성 제출 오류:", error)
        toast({
          title: "가능한 시간 제출 실패",
          description: "다시 시도해주세요.",
          variant: "destructive",
        })
      } finally {
        setIsSubmitting(false)
      }
    },
    [name, availableTimes, event.id, user, router],
  )

  // 시간 선택 변경 핸들러 - useCallback으로 최적화
  const handleAvailableTimesChange = useCallback((newTimes: Record<string, string[]>) => {
    setAvailableTimes(newTimes)
  }, [])

  if (isLoadingExisting) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  if (loadingError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>가능한 시간을 선택해주세요</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-red-500 mb-4">{loadingError}. 새로고침 후 다시 시도해주세요.</div>
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <Label htmlFor="name">이름</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                className="mt-1"
                required
              />
            </div>

            <div className="space-y-4">
              <Label>가능한 시간 선택</Label>
              <p className="text-sm text-muted-foreground mb-4">
                참석 가능한 시간을 드래그하여 선택하세요. 모바일에서는 터치로 선택할 수 있습니다.
              </p>

              {event.dates && (
                <SimpleTimeTable
                  dates={event.dates.map((date: string | Date) => new Date(date))}
                  value={availableTimes}
                  onChange={handleAvailableTimesChange}
                />
              )}
            </div>

            <CardFooter className="px-0 pt-6">
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    제출 중...
                  </>
                ) : existingAvailability ? (
                  "가능한 시간 업데이트"
                ) : (
                  "가능한 시간 제출"
                )}
              </Button>
            </CardFooter>
          </form>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>참석 가능한 시간을 선택해주세요</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <Label htmlFor="name">이름</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름을 입력하세요"
              className="mt-1"
              required
            />
          </div>

          <div className="space-y-4">
            <Label>가능한 시간 선택</Label>
            <p className="text-sm text-muted-foreground mb-4">
              참석 가능한 시간을 드래그하여 선택하세요. 모바일에서는 터치로 선택할 수 있습니다. 이미 선택된 시간을 다시
              드래그하면 선택이 취소됩니다.
            </p>

            {event.dates && (
              <SimpleTimeTable
                dates={event.dates.map((date: string | Date) => new Date(date))}
                value={availableTimes}
                onChange={handleAvailableTimesChange}
              />
            )}
          </div>

          <CardFooter className="px-0 pt-6">
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  제출 중...
                </>
              ) : existingAvailability ? (
                "가능한 시간 업데이트"
              ) : (
                "가능한 시간 제출"
              )}
            </Button>
          </CardFooter>
        </form>
      </CardContent>
    </Card>
  )
}

