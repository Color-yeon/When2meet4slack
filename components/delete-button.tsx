"use client"

import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

export function DeleteButton({ eventId, className }: { eventId: string; className?: string }) {
  const router = useRouter()

  const handleClick = () => {
    // 삭제 페이지로 이동
    router.push(`/events/${eventId}/delete`)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      className={cn("text-red-500 hover:text-red-700 hover:bg-red-50", className)}
      type="button"
    >
      <Trash2 className="h-4 w-4 mr-2" />
      삭제
    </Button>
  )
}

