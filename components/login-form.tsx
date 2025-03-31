"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useAuth } from "./auth-provider"
import { Loader2 } from "lucide-react"

const formSchema = z.object({
  phoneNumber: z
    .string()
    .min(10, {
      message: "전화번호는 최소 10자리 이상이어야 합니다.",
    })
    .max(11, {
      message: "전화번호는 최대 11자리까지 입력 가능합니다.",
    })
    .regex(/^[0-9]+$/, {
      message: "전화번호는 숫자만 입력 가능합니다.",
    }),
})

export function LoginForm({ redirectUrl }: { redirectUrl?: string }) {
  const { login } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      phoneNumber: "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsLoading(true)
      await login(values.phoneNumber)

      // 리디렉션 URL 처리
      const redirect = redirectUrl || searchParams.get("redirect") || "/dashboard"
      router.push(redirect)
    } catch (error) {
      console.error("로그인 오류:", error)
      form.setError("phoneNumber", {
        type: "manual",
        message: "로그인에 실패했습니다. 다시 시도해주세요.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="phoneNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>전화번호</FormLabel>
              <FormControl>
                <Input placeholder="01012345678" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              로그인 중...
            </>
          ) : (
            "로그인"
          )}
        </Button>
      </form>
    </Form>
  )
}

