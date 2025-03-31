"use client"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-4">약속 일정 서비스</h1>
      <p className="text-xl mb-8">
        여러명이 약속에 참석할 수 있는 시간을 설정하고 최종적으로 만날 수 있는 시간을 확정합니다.
      </p>
      <a href="/dashboard" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
        대시보드로 이동
      </a>
    </main>
  )
}

