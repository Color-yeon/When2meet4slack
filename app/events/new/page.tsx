"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft } from "lucide-react"

// 로컬 스토리지에서 이벤트 데이터 가져오기
const getLocalEvents = () => {
  if (typeof window === "undefined") return []

  try {
    const events = localStorage.getItem("events")
    return events ? JSON.parse(events) : []
  } catch (error) {
    console.error("로컬 스토리지에서 이벤트 가져오기 오류:", error)
    return []
  }
}

// 로컬 스토리지에 이벤트 데이터 저장하기
const saveLocalEvents = (events) => {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem("events", JSON.stringify(events))
  } catch (error) {
    console.error("로컬 스토리지에 이벤트 저장 오류:", error)
  }
}

export default function NewEvent() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    participants: "",
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // 참여자 목록 파싱
      const participants = formData.participants
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)

      // 날짜와 시간 결합
      const dateTime = formData.date && formData.time ? new Date(`${formData.date}T${formData.time}`) : new Date()

      // 새 이벤트 객체 생성
      const newEvent = {
        id: `event_${Date.now()}`,
        title: formData.title,
        description: formData.description,
        date: dateTime.toISOString(),
        participants,
      }

      // 로컬 스토리지에 저장
      const events = getLocalEvents()
      const updatedEvents = [...events, newEvent]
      saveLocalEvents(updatedEvents)

      // 성공 후 대시보드로 리다이렉트
      router.push("/dashboard")
    } catch (error) {
      console.error("이벤트 생성 오류:", error)
      alert("이벤트 생성 중 오류가 발생했습니다.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto p-4">
      <Button variant="ghost" className="mb-4" onClick={() => router.push("/dashboard")}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        대시보드로 돌아가기
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>새 약속 만들기</CardTitle>
          <CardDescription>새로운 약속을 생성하고 참여자를 초대하세요.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">약속 제목</Label>
              <Input
                id="title"
                name="title"
                placeholder="약속 제목을 입력하세요"
                value={formData.title}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">설명 (선택사항)</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="약속에 대한 설명을 입력하세요"
                value={formData.description}
                onChange={handleChange}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">날짜</Label>
                <Input id="date" name="date" type="date" value={formData.date} onChange={handleChange} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="time">시간</Label>
                <Input id="time" name="time" type="time" value={formData.time} onChange={handleChange} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="participants">참여자 (쉼표로 구분)</Label>
              <Textarea
                id="participants"
                name="participants"
                placeholder="010-1234-5678, 010-9876-5432"
                value={formData.participants}
                onChange={handleChange}
              />
              <p className="text-sm text-muted-foreground">참여자의 전화번호를 쉼표로 구분하여 입력하세요.</p>
            </div>
          </CardContent>

          <CardFooter>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "생성 중..." : "약속 생성하기"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

