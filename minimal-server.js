const express = require("express")
const app = express()

// JSON 파싱
app.use(express.json())

// 모든 요청에 대한 로깅
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
  if (req.method === "POST") {
    console.log("Headers:", JSON.stringify(req.headers))
    console.log("Body:", JSON.stringify(req.body))
  }
  next()
})

// 모든 POST 요청에 대해 challenge 응답
app.post("*", (req, res) => {
  console.log("Received POST request:", req.body)

  if (req.body && req.body.type === "url_verification") {
    console.log("Responding with challenge:", req.body.challenge)
    return res.json({ challenge: req.body.challenge })
  }

  res.status(200).send("OK")
})

// 상태 확인
app.get("*", (req, res) => {
  res.send("Server is running!")
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

