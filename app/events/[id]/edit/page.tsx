"use client"

import type React from "react"

import { useState, useEffect } from "react"
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
import { Loader2, Plus, Trash2, ArrowLeft } from "lucide-react"

export default function EditEventPage({ params }: { params: { id: string } }) {
  const { user, isLoading: isAuthLoading } = useAuth()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 폼 상태
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [startDate, setStartDate] = useState<Date | undefined>(new Date())
  const [endDate, setEndDate] = useState<Date | undefined>(new Date())
  const [invitedPhoneNumbers, setInvitedPhoneNumbers] = useState<string[]>([])
  const [newPhoneNumber, setNewPhoneNumber] = useState("")
  const [creatorPhoneNumber, setCreatorPhoneNumber] = useState("")

  // 이벤트 데이터 로드
  useEffect(() => {
    const loadEventData = async () => {
      if (!user || !params.id) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch(`/api/events/${params.id}`)
        if (!response.ok) {
          throw new Error("이벤트 데이터를 가져오는데 실패했습니다")
        }

        const result = await response.json()
        if (!result.data) {
          throw new Error("이벤트를 찾을 수 없습니다")
        }

        const eventData = result.data

        // 이벤트 생성자만 편집 가능
        if (eventData.creatorPhoneNumber !== user.phoneNumber) {
          router.push(`/events/${params.id}`)
          toast({
            title: "접근 권한이 없습니다",
            description: "이벤트 생성자만 편집할 수 있습니다.",
            variant: "destructive",
          })
          return
        }

        // 폼 상태 설정
        setTitle(eventData.title || "")
        setDescription(eventData.description || "")
        setStartDate(eventData.startDate ? new Date(eventData.startDate) : undefined)
        setEndDate(eventData.endDate ? new Date(eventData.endDate) : undefined)
        setInvitedPhoneNumbers(eventData.invitedPhoneNumbers || [])
        setCreatorPhoneNumber(eventData.creatorPhoneNumber || "")
      } catch (err) {
        console.error("이벤트 로딩 오류:", err)
        setError(err instanceof Error ? err.message : "이벤트 로딩 중 오류가 발생했습니다")
        toast({
          title: "이벤트 로딩 실패",
          description: err instanceof Error ? err.message : "이벤트 로딩 중 오류가 발생했습니다",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadEventData()
  }, [user, params.id, router])

  // 초대할 전화번호 추가
  const addPhoneNumber = () => {
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

    setInvitedPhoneNumbers([...invitedPhoneNumbers, newPhoneNumber])
    setNewPhoneNumber("")
  }

  // 전화번호 삭제
  const removePhoneNumber = (phoneNumber: string) => {
    setInvitedPhoneNumbers(invitedPhoneNumbers.filter((pn) => pn !== phoneNumber))
  }

  // 약속 수정 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) {
      toast({
        title: "로그인이 필요합니다",
        description: "약속을 수정하려면 로그인해주세요.",
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
        invitedPhoneNumbers,
        updatedAt: new Date().toISOString(),
      }

      const response = await fetch(`/api/events/${params.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "약속 수정에 실패했습니다")
      }

      const result = await response.json()

      if (result.success) {
        toast({
          title: "약속이 수정되었습니다",
          description: "약속 상세 페이지로 이동합니다.",
        })

        // 약속 상세 페이지로 이동
        router.push(`/events/${params.id}`)
      } else {
        throw new Error("약속 수정에 실패했습니다")
      }
    } catch (error) {
      console.error("약속 수정 오류:", error)
      toast({
        title: "약속 수정 실패",
        description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // 뒤로 가기
  const goBack = () => {
    router.push(`/events/${params.id}`)
  }

  if (isAuthLoading || isLoading) {
    return (
      <div className="mx-auto py-8 flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p>로딩 중...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="mx-auto py-8">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">로그인이 필요합니다</h1>
          <p className="text-muted-foreground mb-6">약속을 수정하려면 로그인해주세요.</p>
          <Link
            href={`/login?redirect=/events/${params.id}/edit`}
            className="flex items-center justify-center w-full py-2 px-4 bg-primary text-primary-foreground rounded-md"
          >
            로그인 페이지로 이동
          </Link>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto py-8">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">오류가 발생했습니다</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={goBack} type="button">
            약속 상세 페이지로 돌아가기
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center mb-6">
          <Button variant="ghost" size="sm" onClick={goBack} className="mr-4" type="button">
            <ArrowLeft className="h-4 w-4 mr-2" />
            뒤로 가기
          </Button>
          <h1 className="text-3xl font-bold">약속 수정하기</h1>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>약속 정보</CardTitle>
              <CardDescription>약속에 대한 정보를 수정해주세요.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">약속 제목</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 팀 회의, 친구 모임 등"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">약속 설명 (선택사항)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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
                <Label>참여자 초대</Label>
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
            <CardFooter className="flex justify-between">
              <Button type="button" variant="outline" onClick={goBack}>
                취소
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    수정 중...
                  </>
                ) : (
                  "약속 수정하기"
                )}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </div>
  )
}

