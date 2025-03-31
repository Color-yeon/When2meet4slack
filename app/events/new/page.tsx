"use client"

import type React from "react"
import { useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SimpleDatePicker } from "@/components/simple-date-picker"
import { PhoneNumberInput } from "@/components/phone-number-input"
import { toast } from "@/components/ui/use-toast"
import { Loader2, Plus, Trash2, Copy, Check, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { debounce } from "@/lib/utils"

export default function CreateEventPage() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [createdEventId, setCreatedEventId] = useState<string | null>(null)
  const [createdEventUrl, setCreatedEventUrl] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // 폼 상태
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [startDate, setStartDate] = useState<Date | undefined>(new Date())
  const [endDate, setEndDate] = useState<Date | undefined>(new Date())
  const [invitedPhoneNumbers, setInvitedPhoneNumbers] = useState<string[]>([])
  const [newPhoneNumber, setNewPhoneNumber] = useState("")

  // 초대할 전화번호 추가 - useCallback으로 최적화
  const addPhoneNumber = useCallback(() => {
    if (!newPhoneNumber) return

    // 전화번호 형식 검증 (간단한 검증)
    if (!/^[0-9]{10,11}$/.test(newPhoneNumber)) {
      toast({
        title: "유효하지 않은 전화번호",
        description: "10-11자리 숫자로 입력해주세요.",
        variant: "destructive",
      })
      return
    }

    // 중복 검사
    if (invitedPhoneNumbers.includes(newPhoneNumber)) {
      toast({
        title: "이미 추가된 전화번호입니다",
        description: "다른 전화번호를 입력해주세요.",
        variant: "destructive",
      })
      return
    }

    // 자기 자신 초대 방지
    if (user && newPhoneNumber === user.phoneNumber) {
      toast({
        title: "자기 자신은 초대할 수 없습니다",
        description: "다른 전화번호를 입력해주세요.",
        variant: "destructive",
      })
      return
    }

    setInvitedPhoneNumbers((prev) => [...prev, newPhoneNumber])
    setNewPhoneNumber("")
  }, [newPhoneNumber, invitedPhoneNumbers, user])

  // 전화번호 삭제 - useCallback으로 최적화
  const removePhoneNumber = useCallback((phoneNumber: string) => {
    setInvitedPhoneNumbers((prev) => prev.filter((pn) => pn !== phoneNumber))
  }, [])

  // 링크 복사 - useCallback으로 최적화
  const copyEventLink = useCallback(() => {
    if (!createdEventUrl) return

    navigator.clipboard.writeText(createdEventUrl)
    setIsCopied(true)

    toast({
      title: "링크가 복사되었습니다",
      description: "참여자에게 공유하세요.",
    })

    setTimeout(() => setIsCopied(false), 2000)
  }, [createdEventUrl])

  // 이벤트 상세 페이지로 이동 - useCallback으로 최적화
  const goToEventPage = useCallback(() => {
    if (createdEventId) {
      router.push(`/events/${createdEventId}`)
    }
  }, [createdEventId, router])

  // 약속 생성 제출 - useCallback으로 최적화
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setSubmitError(null)

      if (!user) {
        toast({
          title: "로그인이 필요합니다",
          description: "약속을 생성하려면 로그인해주세요.",
          variant: "destructive",
        })
        return
      }

      if (!title) {
        toast({
          title: "약속 제목을 입력해주세요",
          description: "약속 제목은 필수 항목입니다.",
          variant: "destructive",
        })
        return
      }

      if (!startDate || !endDate) {
        toast({
          title: "날짜를 선택해주세요",
          description: "시작일과 종료일은 필수 항목입니다.",
          variant: "destructive",
        })
        return
      }

      // 종료일이 시작일보다 이전인 경우
      if (startDate > endDate) {
        toast({
          title: "날짜 오류",
          description: "종료일은 시작일 이후여야 합니다.",
          variant: "destructive",
        })
        return
      }

      try {
        setIsSubmitting(true)

        const eventData = {
          title,
          description,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          creatorPhoneNumber: user.phoneNumber,
          creatorName: user.phoneNumber, // 기본값으로 전화번호 사용
          invitedPhoneNumbers,
          createdAt: new Date().toISOString(),
        }

        // AbortController 생성
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000) // 15초 타임아웃

        try {
          const response = await fetch("/api/events", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-cache",
            },
            body: JSON.stringify(eventData),
            signal: controller.signal,
          })

          clearTimeout(timeoutId)

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "약속 생성에 실패했습니다" }))
            throw new Error(errorData.error || "약속 생성에 실패했습니다")
          }

          const result = await response.json()

          if (result.success && result.eventId) {
            setCreatedEventId(result.eventId)

            // 이벤트 URL 생성
            const eventUrl = `${window.location.origin}/events/${result.eventId}`
            setCreatedEventUrl(eventUrl)

            toast({
              title: "약속이 생성되었습니다",
              description: "약속 링크를 공유하여 참여자를 초대하세요.",
            })
          } else {
            throw new Error("약속 생성에 실패했습니다")
          }
        } catch (fetchError) {
          clearTimeout(timeoutId)
          throw fetchError
        }
      } catch (error) {
        console.error("약속 생성 오류:", error)
        setSubmitError(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다")
        toast({
          title: "약속 생성 실패",
          description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
          variant: "destructive",
        })
      } finally {
        setIsSubmitting(false)
      }
    },
    [title, description, startDate, endDate, user, invitedPhoneNumbers],
  )

  // 디바운스된 제목 변경 핸들러
  const handleTitleChange = useMemo(
    () => debounce((e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value), 300),
    [],
  )

  // 디바운스된 설명 변경 핸들러
  const handleDescriptionChange = useMemo(
    () => debounce((e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value), 300),
    [],
  )

  // 로딩 중 UI
  if (isAuthLoading) {
    return (
      <div className="container mx-auto px-4 py-12 flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p>로딩 중...</p>
      </div>
    )
  }

  // 로그인 필요 UI
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold text-center mb-6">로그인이 필요합니다</h1>
          <p className="text-center text-muted-foreground mb-6">약속을 생성하려면 로그인해주세요.</p>
          <Link
            href="/login?redirect=/events/new"
            className="flex items-center justify-center w-full py-2 px-4 bg-primary text-primary-foreground rounded-md"
          >
            로그인 페이지로 이동
          </Link>
        </div>
      </div>
    )
  }

  // 약속 생성 완료 후 화면
  if (createdEventId && createdEventUrl) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>약속이 생성되었습니다</CardTitle>
            <CardDescription>아래 링크를 공유하여 참여자를 초대하세요.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 mb-4">
              <Input value={createdEventUrl} readOnly />
              <Button size="icon" variant="outline" onClick={copyEventLink} type="button">
                {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">이 링크를 받은 사람은 로그인 후 약속에 참여할 수 있습니다.</p>
          </CardContent>
          <CardFooter>
            <Button onClick={goToEventPage} className="w-full" type="button">
              약속 상세 페이지로 이동
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // 메인 폼 UI
  return (
    <div className="mx-auto py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl sm:text-3xl font-bold mb-4 sm:mb-6">새 약속 만들기</h1>

        {submitError && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">약속 정보</CardTitle>
              <CardDescription>약속에 대한 기본 정보를 입력해주세요.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">약속 제목</Label>
                <Input
                  id="title"
                  defaultValue={title}
                  onChange={handleTitleChange}
                  placeholder="예: 팀 회의, 친구 모임 등"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">약속 설명 (선택사항)</Label>
                <Textarea
                  id="description"
                  defaultValue={description}
                  onChange={handleDescriptionChange}
                  placeholder="약속에 대한 추가 정보를 입력하세요"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>시작일</Label>
                  <SimpleDatePicker date={startDate} onSelect={setStartDate} />
                </div>
                <div className="space-y-2">
                  <Label>종료일</Label>
                  <SimpleDatePicker date={endDate} onSelect={setEndDate} />
                </div>
              </div>

              <div className="space-y-2 pt-4">
                <Label>참여자 초대 (선택사항)</Label>

                <Alert className="mb-4 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-900">
                  <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertDescription className="text-blue-600 dark:text-blue-400 font-medium">
                    지금 참여자를 추가하지 않아도 링크로 사용자를 쉽게 초대할 수 있습니다.
                  </AlertDescription>
                </Alert>

                <div className="flex space-x-2">
                  <PhoneNumberInput
                    value={newPhoneNumber}
                    onChange={setNewPhoneNumber}
                    placeholder="전화번호 입력 (01012345678)"
                    onEnter={addPhoneNumber}
                  />
                  <Button type="button" onClick={addPhoneNumber} size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  참여자의 전화번호를 입력하고 추가 버튼을 클릭하세요.
                </p>
              </div>

              {invitedPhoneNumbers.length > 0 && (
                <div className="space-y-2">
                  <Label>초대된 참여자</Label>
                  <div className="border rounded-md p-3 space-y-2">
                    {invitedPhoneNumbers.map((phoneNumber) => (
                      <div key={phoneNumber} className="flex justify-between items-center">
                        <span>{phoneNumber}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removePhoneNumber(phoneNumber)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    약속 생성 중...
                  </>
                ) : (
                  "약속 생성하기"
                )}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </div>
  )
}

