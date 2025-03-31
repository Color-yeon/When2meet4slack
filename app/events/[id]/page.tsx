"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { isValid } from "date-fns"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"
import { Edit, Share, Loader2, RefreshCcw, AlertTriangle } from "lucide-react"
import Link from "next/link"

import { AvailabilityForm } from "@/components/availability-form"
import { AvailabilitySummary } from "@/components/availability-summary"
import { EventDetails } from "@/components/event-details"
import { toast } from "@/components/ui/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { DeleteButton } from "@/components/delete-button"

// 날짜 객체를 안전하게 변환하는 함수
function safeDate(date: Date | string | number | null | undefined): Date {
  if (!date) return new Date()

  const parsedDate = date instanceof Date ? date : new Date(date)
  return isValid(parsedDate) ? parsedDate : new Date()
}

// 이벤트 형식 변환 함수
function formatEventData(eventData: any) {
  if (!eventData) return null

  try {
    // 날짜를 안전하게 변환
    const startDate =
      eventData.startDate instanceof Date ? eventData.startDate : new Date(eventData.startDate || Date.now())

    const endDate = eventData.endDate instanceof Date ? eventData.endDate : new Date(eventData.endDate || Date.now())

    // 시작일부터 종료일까지의 모든 날짜 생성 - 최적화: 날짜가 많은 경우 성능 저하 방지
    const dates = []
    const currentDate = new Date(startDate)
    // 최대 30일까지만 생성 (성능 보호)
    let dayCount = 0
    const maxDays = 30

    while (currentDate <= endDate && dayCount < maxDays) {
      dates.push(new Date(currentDate))
      currentDate.setDate(currentDate.getDate() + 1)
      dayCount++
    }

    // 기존 이벤트 데이터에 dates 속성 추가
    return {
      ...eventData,
      dates,
      startTime: eventData.startTime || "00:00",
      endTime: eventData.endTime || "24:00",
    }
  } catch (error) {
    console.error("이벤트 데이터 형식 변환 오류:", error)
    return eventData
  }
}

// 최대 재시도 횟수
const MAX_RETRY_COUNT = 3
// 재시도 간격 (밀리초)
const RETRY_DELAY = 2000

export default function EventPage({
  params,
}: {
  params: { id: string }
}) {
  const { user, isLoading: isAuthLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [event, setEvent] = useState<any>(null)
  const [availabilities, setAvailabilities] = useState<any[]>([])
  const [isLoadingEvent, setIsLoadingEvent] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)
  const [isAddingUserToEvent, setIsAddingUserToEvent] = useState(false)
  const [userAddedToEvent, setUserAddedToEvent] = useState(false)
  const [connectionAttempts, setConnectionAttempts] = useState(0)
  const [loadingTimeout, setLoadingTimeout] = useState<NodeJS.Timeout | null>(null)
  const [isRedisError, setIsRedisError] = useState(false)

  // 로딩 타임아웃 설정 - 20초 후에도 로딩이 완료되지 않으면 오류 표시
  useEffect(() => {
    if (isLoadingEvent) {
      const timeout = setTimeout(() => {
        if (isLoadingEvent) {
          setError("데이터 로딩 시간이 너무 오래 걸립니다. 네트워크 연결을 확인하거나 나중에 다시 시도해주세요.")
          setIsLoadingEvent(false)
        }
      }, 20000) // 20초 타임아웃으로 증가

      setLoadingTimeout(timeout)
      return () => {
        if (timeout) clearTimeout(timeout)
      }
    }
  }, [isLoadingEvent])

  // 이벤트 데이터 로드 함수 최적화

  // 이벤트 데이터 로드 함수
  const loadEventData = useCallback(
    async (currentRetry = 0) => {
      if (!params.id) return

      try {
        setIsLoadingEvent(true)
        setError(null)
        setIsRetrying(false)
        setConnectionAttempts((prev) => prev + 1)
        setIsRedisError(false)

        // AbortController 생성 (타임아웃 처리)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000) // 15초 타임아웃

        try {
          // 이벤트 데이터와 가용성 데이터를 병렬로 요청
          const [eventResponse, availResponse] = await Promise.all([
            fetch(`/api/events/${params.id}`, {
              cache: "no-store",
              signal: controller.signal,
              headers: {
                Accept: "application/json",
                "Cache-Control": "no-cache",
              },
            }),
            fetch(`/api/events/${params.id}/availabilities`, {
              cache: "no-store",
              signal: controller.signal,
            }),
          ])

          clearTimeout(timeoutId)

          // 이벤트 데이터 처리
          if (!eventResponse.ok) {
            // 오류 처리 로직...
            throw new Error(`이벤트 데이터를 가져오는데 실패했습니다 (${eventResponse.status})`)
          }

          const eventResult = await eventResponse.json()

          if (!eventResult.data) {
            setError(`이벤트를 찾을 수 없습니다 (ID: ${params.id})`)
            setIsLoadingEvent(false)
            return
          }

          // 이벤트 데이터 형식 변환 후 설정
          const formattedEvent = formatEventData(eventResult.data)
          setEvent(formattedEvent)

          // 가용성 데이터 처리
          if (availResponse.ok) {
            const availResult = await availResponse.json()
            setAvailabilities(availResult.data || [])
          } else {
            // 가용성 데이터 로드 실패는 치명적이지 않으므로 빈 배열로 처리
            setAvailabilities([])
          }
        } catch (fetchError) {
          // fetch 자체가 실패한 경우 (네트워크 오류 등)
          clearTimeout(timeoutId)

          if (currentRetry < MAX_RETRY_COUNT - 1) {
            setTimeout(() => loadEventData(currentRetry + 1), RETRY_DELAY)
            return
          }

          throw fetchError
        }
      } catch (err) {
        console.error("이벤트 로딩 중 오류 발생:", err)

        // 최대 재시도 횟수에 도달하지 않았다면 재시도
        if (currentRetry < MAX_RETRY_COUNT - 1) {
          setTimeout(() => loadEventData(currentRetry + 1), RETRY_DELAY)
          return
        }

        setError(err instanceof Error ? err.message : "이벤트 로딩 중 오류가 발생했습니다")
      } finally {
        setIsLoadingEvent(false)
      }
    },
    [params.id],
  )

  // loadAvailabilities 함수 제거 (병렬 처리로 통합)

  // 경로 확인 및 리디렉션 처리
  useEffect(() => {
    // 경로가 "/events/new"인 경우 새 이벤트 생성 페이지로 리디렉션
    if (pathname === "/events/new") {
      router.push("/events/new")
      return
    }

    // "new"는 유효한 이벤트 ID가 아님
    if (params.id === "new") {
      router.push("/events/new")
      return
    }
  }, [pathname, params.id, router])

  // 이벤트 데이터 로드
  useEffect(() => {
    if (params.id && params.id !== "new") {
      loadEventData()
    }

    return () => {
      // 컴포넌트 언마운트 시 타임아웃 정리
      if (loadingTimeout) {
        clearTimeout(loadingTimeout)
      }
    }
  }, [params.id, retryCount, loadEventData, loadingTimeout])

  // 로그인 후 사용자를 약속 참여자로 추가 - 최적화: 불필요한 API 호출 방지
  useEffect(() => {
    let timer: NodeJS.Timeout | undefined
    let isMounted = true

    if (user && event && !userAddedToEvent && !isAddingUserToEvent) {
      // 약간의 지연 후 사용자 추가 시도 (페이지 로드 완료 후)
      timer = setTimeout(async () => {
        if (!isMounted) return

        try {
          setIsAddingUserToEvent(true)

          const response = await fetch(`/api/events/${params.id}/join`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ phoneNumber: user.phoneNumber }),
          })

          if (!response.ok) {
            throw new Error("사용자 추가 실패")
          }

          const result = await response.json()

          if (result && result.success && isMounted) {
            setUserAddedToEvent(true)

            // 이미 초대된 사용자가 아닌 경우에만 토스트 메시지 표시
            if (!result.alreadyInvited && !result.isCreator) {
              toast({
                title: "약속에 참여되었습니다",
                description: "이제 이 약속이 내 대시보드에 표시됩니다.",
              })
            }
          }
        } catch (error) {
          console.error("사용자 약속 참여자 추가 오류:", error)
          // 오류가 발생해도 사용자 경험을 방해하지 않도록 조용히 처리
        } finally {
          if (isMounted) {
            setIsAddingUserToEvent(false)
          }
        }
      }, 1000) // 1초로 지연 시간 증가
    }

    return () => {
      isMounted = false
      if (timer) clearTimeout(timer)
    }
  }, [user, event, userAddedToEvent, isAddingUserToEvent, params.id])

  // 메모이제이션을 통한 불필요한 계산 방지
  const isCreator = useMemo(() => {
    return user && event && user.phoneNumber === event.creatorPhoneNumber
  }, [user, event])

  const copyShareLink = () => {
    if (typeof window !== "undefined") {
      try {
        const url = `${window.location.origin}/events/${params.id}`
        navigator.clipboard.writeText(url)
        setIsCopied(true)
        toast({
          title: "링크가 복사되었습니다",
          description: "참여자에게 공유하세요.",
        })

        setTimeout(() => setIsCopied(false), 2000)
      } catch (error) {
        console.error("링크 복사 실패:", error)
        toast({
          title: "링크 복사 실패",
          description: "링크를 복사하는 데 실패했습니다. 수동으로 복사해주세요.",
          variant: "destructive",
        })
      }
    }
  }

  const handleRetry = () => {
    setIsRetrying(true)
    setRetryCount((prev) => prev + 1)
    setConnectionAttempts(0)
  }

  const goToDashboard = () => {
    router.push("/dashboard")
  }

  const createNewEvent = () => {
    router.push("/events/new")
  }

  // Redis 상태 확인 함수
  const checkRedisStatus = async () => {
    try {
      setIsRetrying(true)
      const response = await fetch("/api/redis-status")

      if (response.ok) {
        const result = await response.json()
        if (result.status === "ok") {
          toast({
            title: "Redis 서버 연결 성공",
            description: "데이터베이스 연결이 정상적으로 작동 중입니다.",
          })
          // 데이터 다시 로드
          setRetryCount((prev) => prev + 1)
        } else {
          toast({
            title: "Redis 서버 연결 실패",
            description: result.message || "데이터베이스 연결에 문제가 있습니다.",
            variant: "destructive",
          })
        }
      } else {
        let errorMessage = "서버 상태를 확인할 수 없습니다."
        try {
          const errorData = await response.json()
          errorMessage = errorData.message || errorMessage
        } catch (e) {
          // JSON 파싱 실패 시 기본 메시지 사용
        }

        toast({
          title: "서버 상태 확인 실패",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "서버 연결 오류",
        description: "서버에 연결할 수 없습니다.",
        variant: "destructive",
      })
    } finally {
      setIsRetrying(false)
    }
  }

  if (isAuthLoading || isLoadingEvent) {
    return (
      <div className="mx-auto py-6 sm:py-12 flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p>로딩 중...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto py-6 sm:py-12">
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>오류가 발생했습니다</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="max-w-md mx-auto text-center">
          <p className="text-muted-foreground mb-6">
            요청하신 이벤트를 찾을 수 없거나 접근할 수 없습니다. 다음과 같은 이유로 발생했을 수 있습니다:
          </p>
          <ul className="text-left text-muted-foreground mb-6 list-disc pl-5">
            <li>이벤트가 삭제되었거나 만료되었습니다</li>
            <li>잘못된 링크를 사용하고 있습니다</li>
            <li>서버 연결에 일시적인 문제가 있습니다</li>
            <li>데이터베이스 연결에 문제가 있습니다</li>
          </ul>

          {isRedisError && (
            <Alert className="mb-6 bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-900">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <AlertDescription className="text-yellow-600 dark:text-yellow-400">
                데이터베이스 연결에 문제가 감지되었습니다. Redis 서버 상태를 확인해보세요.
              </AlertDescription>
              <Button
                onClick={checkRedisStatus}
                variant="outline"
                size="sm"
                className="mt-2 border-yellow-300 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-800 dark:text-yellow-400 dark:hover:bg-yellow-900/50"
                type="button"
              >
                Redis 상태 확인
              </Button>
            </Alert>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={handleRetry} disabled={isRetrying} type="button">
              {isRetrying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  재시도 중...
                </>
              ) : (
                <>
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  다시 시도
                </>
              )}
            </Button>
            <Button variant="outline" onClick={goToDashboard} type="button">
              대시보드로 돌아가기
            </Button>
            <Button variant="default" onClick={createNewEvent} type="button">
              새 약속 만들기
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="mx-auto py-6 sm:py-12">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">이벤트를 찾을 수 없습니다</h1>
          <p className="text-muted-foreground mb-6">요청하신 이벤트가 존재하지 않거나 삭제되었을 수 있습니다.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={goToDashboard} type="button">
              대시보드로 돌아가기
            </Button>
            <Button variant="default" onClick={createNewEvent} type="button">
              새 약속 만들기
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // 로그인하지 않은 사용자를 위한 간단한 이벤트 정보 표시
  if (!user) {
    return (
      <div className="mx-auto py-6 sm:py-12">
        <div className="max-w-md mx-auto">
          <EventDetails event={event} />

          <div className="mt-8 text-center">
            <h2 className="text-xl font-bold mb-4">약속에 참여하려면 로그인이 필요합니다</h2>
            <p className="text-muted-foreground mb-6">로그인하시면 자동으로 이 약속에 참여자로 추가됩니다.</p>
            <Link
              href={`/login?redirect=/events/${params.id}`}
              className="flex items-center justify-center w-full py-2 px-4 bg-primary text-primary-foreground rounded-md"
            >
              로그인 페이지로 이동
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto py-6 sm:py-12">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
        <EventDetails event={event} />

        <div className="flex flex-row items-center gap-2 mt-4 md:mt-0">
          <Button variant="outline" size="sm" onClick={copyShareLink} className="w-24" type="button">
            <Share className="h-4 w-4 mr-2" />
            {isCopied ? "복사됨" : "공유"}
          </Button>

          {isCreator && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/events/${params.id}/edit`)}
                className="w-24"
                type="button"
              >
                <Edit className="h-4 w-4 mr-2" />
                편집
              </Button>
              <DeleteButton eventId={params.id} className="w-24" />
            </>
          )}
        </div>
      </div>

      <div className="mt-8 sm:mt-12">
        <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">가능한 시간 입력하기</h2>
        <AvailabilityForm event={event} />
      </div>

      {availabilities.length > 0 && (
        <div className="mt-8 sm:mt-12">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">참여자 가능 시간</h2>
          <AvailabilitySummary event={event} availabilities={availabilities} />
        </div>
      )}
    </div>
  )
}

