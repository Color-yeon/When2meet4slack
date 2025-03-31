"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/components/auth-provider"
import { LoginForm } from "@/components/login-form"
import { format, isValid } from "date-fns"
import { ko } from "date-fns/locale"
import { Loader2, Plus, Calendar, Users } from "lucide-react"

// 날짜 객체를 안전하게 변환하는 함수
function safeDate(date: Date | string | number | null | undefined): Date | null {
  if (!date) return null

  const parsedDate = date instanceof Date ? date : new Date(date)
  return isValid(parsedDate) ? parsedDate : null
}

// 날짜 형식화 함수
function formatDate(date: Date | string | number | null | undefined): string {
  const parsedDate = safeDate(date)
  if (!parsedDate) return "날짜 없음"
  return format(parsedDate, "yyyy년 M월 d일 (E)", { locale: ko })
}

export default function DashboardPage() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const router = useRouter()
  const [createdEvents, setCreatedEvents] = useState<any[]>([])
  const [invitedEvents, setInvitedEvents] = useState<any[]>([])
  const [isLoadingEvents, setIsLoadingEvents] = useState(true)
  const [activeTab, setActiveTab] = useState("created")

  // 이벤트 데이터 로드
  useEffect(() => {
    const loadEvents = async () => {
      if (!user) {
        setIsLoadingEvents(false)
        return
      }

      try {
        setIsLoadingEvents(true)

        // 생성한 이벤트 로드
        const createdResponse = await fetch(`/api/events?type=created&phoneNumber=${user.phoneNumber}`)
        if (createdResponse.ok) {
          const createdData = await createdResponse.json()
          setCreatedEvents(createdData.events || [])
        }

        // 초대받은 이벤트 로드
        const invitedResponse = await fetch(`/api/events?type=invited&phoneNumber=${user.phoneNumber}`)
        if (invitedResponse.ok) {
          const invitedData = await invitedResponse.json()
          setInvitedEvents(invitedData.events || [])
        }
      } catch (error) {
        console.error("이벤트 로드 오류:", error)
      } finally {
        setIsLoadingEvents(false)
      }
    }

    loadEvents()
  }, [user])

  // 이벤트 카드 컴포넌트
  const EventCard = ({ event, isCreator = false }: { event: any; isCreator?: boolean }) => {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl">{event.title}</CardTitle>
          <CardDescription>{isCreator ? "내가 만든 약속" : "초대받은 약속"}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 mt-1 text-muted-foreground" />
              <div>
                <div>{formatDate(event.startDate)}</div>
                <div>{formatDate(event.endDate)}</div>
              </div>
            </div>
            {event.description && <div className="text-sm text-muted-foreground mt-2">{event.description}</div>}
            <div className="flex items-center gap-2 mt-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm">
                {isCreator ? `${event.invitedPhoneNumbers?.length || 0}명 초대됨` : "참여자 목록 보기"}
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="default" className="w-full" onClick={() => router.push(`/events/${event.id}`)} type="button">
            약속 상세 보기
          </Button>
        </CardFooter>
      </Card>
    )
  }

  if (isAuthLoading) {
    return (
      <div className="container mx-auto px-4 py-12 flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p>로딩 중...</p>
      </div>
    )
  }

  // 로그인하지 않은 경우 로그인 폼 표시
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">"아니 그래서 언제 만날건데"</h1>
          <p className="text-xl text-muted-foreground mb-8">여러 사람들과 쉽게 약속 시간을 정해보세요!</p>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">로그인</CardTitle>
              <CardDescription>약속 일정을 관리하려면 로그인해주세요.</CardDescription>
            </CardHeader>
            <CardContent>
              <LoginForm redirectUrl="/dashboard" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto py-8">
      {/* 페이지 제목 크기 축소 */}
      <div className="text-center mb-6">
        <h1 className="text-xl sm:text-2xl font-bold mb-1">"아니 그래서 언제 만날건데"</h1>
        <p className="text-sm sm:text-base text-muted-foreground">여러 사람들과 쉽게 약속 시간을 정해보세요!</p>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        {/* 섹션 제목 크기도 조정 */}
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">내 약속 관리</h2>
          <p className="text-muted-foreground mt-1">생성한 약속과 초대받은 약속을 관리할 수 있습니다.</p>
        </div>
        <Button onClick={() => router.push("/events/new")} type="button">
          <Plus className="mr-2 h-4 w-4" />새 약속 만들기
        </Button>
      </div>

      <Tabs defaultValue="created" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="created">내가 만든 약속</TabsTrigger>
          <TabsTrigger value="invited">초대받은 약속</TabsTrigger>
        </TabsList>

        <TabsContent value="created" className="mt-0">
          {isLoadingEvents ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <p>약속 정보를 불러오는 중...</p>
            </div>
          ) : createdEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {createdEvents.map((event) => (
                <EventCard key={event.id} event={event} isCreator={true} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium mb-2">아직 만든 약속이 없습니다</h3>
              <p className="text-muted-foreground mb-6">새로운 약속을 만들어 친구들을 초대해보세요.</p>
              <Button onClick={() => router.push("/events/new")} type="button">
                <Plus className="mr-2 h-4 w-4" />새 약속 만들기
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="invited" className="mt-0">
          {isLoadingEvents ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <p>약속 정보를 불러오는 중...</p>
            </div>
          ) : invitedEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {invitedEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium">아직 초대받은 약속이 없습니다</h3>
              <p className="text-muted-foreground">친구가 당신을 약속에 초대하면 여기에 표시됩니다.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

