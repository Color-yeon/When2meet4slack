"use client"

import { useState } from "react"
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
import { deleteEvent } from "@/lib/event-actions"

export function EventDeleteForm({ eventId, phoneNumber }: { eventId: string; phoneNumber: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)

    // 폼 데이터 생성
    const formData = new FormData()
    formData.append("eventId", eventId)
    formData.append("phoneNumber", phoneNumber)

    try {
      // 서버 액션 호출 (자동으로 리디렉션됨)
      await deleteEvent(formData)
    } catch (error) {
      console.error("이벤트 삭제 오류:", error)
      toast({
        title: "이벤트 삭제 실패",
        description: error instanceof Error ? error.message : "다시 시도해주세요.",
        variant: "destructive",
      })
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
          <form action={deleteEvent}>
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="phoneNumber" value={phoneNumber} />
            <Button
              type="submit"
              className="bg-red-500 hover:bg-red-600 text-white"
              disabled={isDeleting}
              onClick={(e) => {
                if (isDeleting) {
                  e.preventDefault()
                }
              }}
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
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

