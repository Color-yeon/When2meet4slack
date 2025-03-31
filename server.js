require("dotenv").config()
const { app } = require("./app")
const express = require("express")
const bodyParser = require("body-parser")

const PORT = process.env.PORT || 3000

// Express 앱 생성
const expressApp = express()

// JSON 파싱 미들웨어 추가
expressApp.use(bodyParser.json())

// Slack의 challenge 요청 처리를 위한 라우트
expressApp.post("/slack/events", (req, res) => {
  // challenge 파라미터가 있으면 그대로 응답
  if (req.body.challenge) {
    console.log("Responding to Slack challenge")
    return res.json({ challenge: req.body.challenge })
  }

  // 그 외의 요청은 Bolt 앱으로 전달
  app.processEvent(req.body)
  res.sendStatus(200)
})

// 서버 시작
;(async () => {
  // Bolt 앱 시작
  await app.start()
  console.log(`⚡️ 약속 일정 Slack 앱이 실행 중입니다!`)

  // Express 서버 시작
  expressApp.listen(PORT, () => {
    console.log(`Express 서버가 포트 ${PORT}에서 실행 중입니다!`)
  })
})()

