const express = require("express")
const bodyParser = require("body-parser")

const app = express()

// raw body 저장을 위한 미들웨어
app.use(
  bodyParser.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString()
    },
  }),
)

// 로깅 미들웨어 추가
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
  console.log("Headers:", JSON.stringify(req.headers))
  if (req.body) console.log("Body:", JSON.stringify(req.body))
  next()
})

// Slack 이벤트 처리 엔드포인트
app.post("/slack/events", (req, res) => {
  console.log("Received Slack event:", req.body)

  // URL 검증 요청 처리
  if (req.body && req.body.type === "url_verification") {
    console.log("Challenge received:", req.body.challenge)
    return res.status(200).json({ challenge: req.body.challenge })
  }

  // 다른 모든 요청에 대해 200 OK 응답
  res.status(200).send()
})

// 루트 경로에도 동일한 처리 추가 (라우팅 문제 해결)
app.post("/", (req, res) => {
  console.log("Received request at root:", req.body)

  // URL 검증 요청 처리
  if (req.body && req.body.type === "url_verification") {
    console.log("Challenge received at root:", req.body.challenge)
    return res.status(200).json({ challenge: req.body.challenge })
  }

  // 다른 모든 요청에 대해 200 OK 응답
  res.status(200).send()
})

// 상태 확인 엔드포인트
app.get("/", (req, res) => {
  res.send("Server is running!")
})

// 서버 시작
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

