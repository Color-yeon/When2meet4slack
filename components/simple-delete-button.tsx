"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Trash2, Loader2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "@/components/ui/use-toast"

export function SimpleDeleteButton({ eventId, phoneNumber }: { eventId: string; phoneNumber: string }) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const handleDelete = async () => {
    if (!eventId || !phoneNumber) {
      toast({
        title: "삭제 실패",
        description: "필요한 정보가 누락되었습니다.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsDeleting(true)
      console.log("삭제 요청 준비:", { eventId, phoneNumber })

      // 대체 접근법: 쿼리 파라미터 사용
      const url = `/api/delete-event?id=${encodeURIComponent(eventId)}&phone=${encodeURIComponent(phoneNumber)}`

      console.log("삭제 요청 URL:", url)

      const response = await fetch(url, {
        method: "GET", // DELETE 대신 GET 사용
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      })

      console.log("삭제 응답 상태:", response.status)

      if (!response.ok) {
        let errorMessage = "이벤트 삭제 실패"
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
          console.error("삭제 오류 응답:", errorData)
        } catch (jsonError) {
          console.error("삭제 응답 파싱 오류:", jsonError)
          // 응답 텍스트 확인 시도
          const text = await response.text().catch(() => "응답 내용을 읽을 수 없습니다")
          console.error("응답 텍스트:", text)
          errorMessage = `삭제 실패 (${response.status}): ${text.substring(0, 100)}`
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()
      console.log("삭제 성공 응답:", result)

      toast({
        title: "약속이 삭제되었습니다",
        description: "대시보드로 이동합니다.",
      })

      // 대시보드로 리디렉션
      router.push("/dashboard")
      router.refresh()
    } catch (error) {
      console.error("이벤트 삭제 오류:", error)
      toast({
        title: "이벤트 삭제 실패",
        description: error instanceof Error ? error.message : "다시 시도해주세요.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setIsOpen(false)
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-red-500 hover:text-red-700 hover:bg-red-50 w-full sm:w-auto"
          type="button"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          삭제
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>약속을 삭제하시겠습니까?</AlertDialogTitle>
          <AlertDialogDescription>
            이 작업은 되돌릴 수 없습니다. 약속과 관련된 모든 데이터가 영구적으로 삭제됩니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" type="button">
              취소
            </Button>
          </AlertDialogCancel>
          <Button
            onClick={handleDelete}
            className="bg-red-500 hover:bg-red-600 text-white"
            disabled={isDeleting}
            type="button"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                삭제 중...
              </>
            ) : (
              "삭제"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

