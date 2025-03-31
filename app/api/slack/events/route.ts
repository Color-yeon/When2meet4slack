import { type NextRequest, NextResponse } from "next/server"

// 디버깅을 위한 로깅 함수
function log(message: string, data: any = {}) {
  console.log(`[${new Date().toISOString()}] ${message}`, JSON.stringify(data))
}

export async function POST(request: NextRequest) {
  log("Slack Events 요청 처리 시작")

  try {
    // 요청 본문 파싱
    const body = await request.json()
    log("요청 본문 수신 완료", { body })

    // URL 검증 요청 처리
    if (body.type === "url_verification") {
      log("URL 검증 요청 감지", { challenge: body.challenge })

      // challenge 값 반환
      return NextResponse.json({ challenge: body.challenge })
    }

    // 다른 이벤트 타입 처리
    log("URL 검증이 아닌 이벤트 타입", { type: body.type })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    // 오류 처리
    log("요청 처리 중 오류 발생", { error: error.message, stack: error.stack })
    return NextResponse.json({ error: "서버 오류", details: error.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Slack Events API is ready. Send POST requests to this endpoint.",
  })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}

