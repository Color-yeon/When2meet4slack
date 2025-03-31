"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useAuth } from "./auth-provider"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Menu, Calendar, Plus, LogOut, User } from "lucide-react"
import { useMobile } from "@/hooks/use-mobile"

export function Navbar() {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const isMobile = useMobile()

  const closeMenu = () => {
    setIsMenuOpen(false)
  }

  const isActive = (path: string) => {
    return pathname === path
  }

  const handleLogout = () => {
    logout()
    router.push("/dashboard")
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12 flex h-14 items-center">
        <div className="mr-4 flex">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="font-bold text-sm sm:text-base">"아니 그래서 언제 만날건데"</span>
          </Link>
        </div>

        {/* 모바일 메뉴 */}
        {isMobile ? (
          <div className="flex flex-1 items-center justify-end space-x-2">
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" type="button">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">메뉴 열기</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>"아니 그래서 언제 만날건데"</SheetTitle>
                  <SheetDescription>
                    여러명이 약속에 참석할 수 있는 되는 시간을 설정하고 최종적으로 만날 수 있는 시간을 확정합니다
                  </SheetDescription>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-4">
                  {user ? (
                    <>
                      <div className="flex items-center gap-2 py-2">
                        <User className="h-4 w-4" />
                        <span>{user.phoneNumber}</span>
                      </div>
                      <Link
                        href="/dashboard"
                        className={`flex items-center gap-2 py-2 ${isActive("/dashboard") ? "font-bold" : ""}`}
                        onClick={closeMenu}
                      >
                        <Calendar className="h-4 w-4" />내 약속 목록
                      </Link>
                      <Link
                        href="/events/new"
                        className={`flex items-center gap-2 py-2 ${isActive("/events/new") ? "font-bold" : ""}`}
                        onClick={closeMenu}
                      >
                        <Plus className="h-4 w-4" />새 약속 만들기
                      </Link>
                      <Button
                        variant="ghost"
                        className="justify-start px-2"
                        onClick={() => {
                          handleLogout()
                          closeMenu()
                        }}
                        type="button"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        로그아웃
                      </Button>
                    </>
                  ) : (
                    <div className="p-4">
                      <Link
                        href="/dashboard"
                        className="flex items-center justify-center w-full py-2 px-4 bg-primary text-primary-foreground rounded-md"
                        onClick={closeMenu}
                      >
                        로그인
                      </Link>
                    </div>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        ) : (
          /* 데스크톱 메뉴 */
          <>
            <nav className="flex flex-1 items-center justify-end space-x-4">
              {user ? (
                <>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>{user.phoneNumber}</span>
                  </div>
                  <Link
                    href="/dashboard"
                    className={`flex items-center gap-2 ${isActive("/dashboard") ? "font-bold" : ""}`}
                  >
                    <Calendar className="h-4 w-4" />내 약속 목록
                  </Link>
                  <Link
                    href="/events/new"
                    className={`flex items-center gap-2 ${isActive("/events/new") ? "font-bold" : ""}`}
                  >
                    <Plus className="h-4 w-4" />새 약속 만들기
                  </Link>
                  <Button variant="ghost" size="sm" onClick={handleLogout} type="button">
                    <LogOut className="mr-2 h-4 w-4" />
                    로그아웃
                  </Button>
                </>
              ) : (
                <Link
                  href="/dashboard"
                  className="flex items-center justify-center py-2 px-4 bg-primary text-primary-foreground rounded-md"
                >
                  로그인
                </Link>
              )}
            </nav>
          </>
        )}
      </div>
    </header>
  )
}

