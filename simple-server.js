const http = require("http")

// 디버깅을 위한 로깅 함수
function log(message, data = {}) {
  console.log(`[${new Date().toISOString()}] ${message}`, JSON.stringify(data))
}

// 요청 처리 함수
const handleRequest = (req, res) => {
  log("요청 받음", {
    method: req.method,
    url: req.url,
    headers: req.headers,
  })

  // CORS 헤더 설정
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  // OPTIONS 요청 처리 (CORS preflight)
  if (req.method === "OPTIONS") {
    log("OPTIONS 요청 처리")
    res.writeHead(200)
    res.end()
    return
  }

  // Slack Events API 엔드포인트 처리
  if (req.method === "POST") {
    log("Slack Events 요청 처리 시작")

    let body = ""

    // 요청 본문 수집
    req.on("data", (chunk) => {
      body += chunk.toString()
    })

    // 요청 본문 처리 완료
    req.on("end", () => {
      log("요청 본문 수신 완료", { body })

      try {
        // 본문이 비어있지 않은지 확인
        if (!body) {
          log("요청 본문이 비어있음")
          res.writeHead(400, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ error: "요청 본문이 비어있습니다" }))
          return
        }

        // JSON 파싱
        const data = JSON.parse(body)
        log("JSON 파싱 완료", { data })

        // URL 검증 요청 처리
        if (data.type === "url_verification") {
          log("URL 검증 요청 감지", { challenge: data.challenge })

          // 응답 헤더 설정
          res.writeHead(200, { "Content-Type": "application/json" })

          // challenge 값 반환
          const response = { challenge: data.challenge }
          log("URL 검증 응답 전송", { response })
          res.end(JSON.stringify(response))
        } else {
          // 다른 이벤트 타입 처리
          log("URL 검증이 아닌 이벤트 타입", { type: data.type })
          res.writeHead(200, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ success: true }))
        }
      } catch (error) {
        // 오류 처리
        log("요청 처리 중 오류 발생", { error: error.message, stack: error.stack })
        res.writeHead(500, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "서버 오류", details: error.message }))
      }
    })
  } else {
    // GET 요청에 대한 응답
    log("GET 요청 처리")
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" })
    res.end("Slack Events API Server is running. Send POST requests to this endpoint.")
  }
}

// 서버리스 함수 환경에서 실행
module.exports = (req, res) => {
  try {
    handleRequest(req, res)
  } catch (error) {
    console.error("서버리스 함수 오류:", error)
    res.status(500).send("Internal Server Error")
  }
}

// 로컬 개발 환경에서 실행
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000
  http.createServer(handleRequest).listen(PORT, () => {
    log(`서버가 포트 ${PORT}에서 실행 중입니다`)
  })
}

