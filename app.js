const { App } = require("@slack/bolt")
const { Redis } = require("@upstash/redis")

// Redis 클라이언트 초기화
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
})

// Slack 앱 초기화
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
})

// 앱 시작 로그
;(async () => {
  await app.start()
  console.log("⚡️ 약속 일정 Slack 앱이 실행 중입니다!")
})()

// 슬래시 명령어: /약속생성
app.command("/약속생성", async ({ command, ack, client, body }) => {
  await ack()

  try {
    // 모달 대신 메시지로 안내
    await client.chat.postMessage({
      channel: body.user_id,
      text: "약속 생성을 시작합니다",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*새 약속 만들기*\n약속 제목을 입력해주세요:",
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "약속 만들기",
              },
              action_id: "start_create_event",
              value: "start_create",
            },
          ],
        },
      ],
    })
  } catch (error) {
    console.error("약속 생성 메시지 오류:", error)

    // 오류 메시지 전송
    await client.chat.postMessage({
      channel: body.user_id,
      text: "약속 생성 중 오류가 발생했습니다. 다시 시도해주세요.",
    })
  }
})

// 약속 생성 모달 제출 처리
app.view("create_event_modal", async ({ ack, body, view, client }) => {
  await ack()

  try {
    // 입력값 추출
    const title = view.state.values.title_block.title_input.value
    const description = view.state.values.description_block.description_input.value
    const startDate = view.state.values.start_date_block.start_date_input.selected_date
    const endDate = view.state.values.end_date_block.end_date_input.selected_date

    // 사용자 정보 가져오기
    const creatorId = body.user.id
    const userInfo = await client.users.info({ user: creatorId })
    const creatorName = userInfo.user.real_name || userInfo.user.name

    // 이벤트 ID 생성
    const timestamp = Date.now()
    const randomPart = Math.random().toString(36).substring(2, 8)
    const eventId = `slack_e_${timestamp}_${randomPart}`

    // 이벤트 데이터 생성
    const eventData = {
      title,
      description,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      creatorId,
      creatorName,
      createdAt: new Date().toISOString(),
      platform: "slack",
    }

    // Redis에 이벤트 저장
    await redis.set(`event:${eventId}`, JSON.stringify(eventData))
    await redis.sadd(`user_created:${creatorId}`, eventId)

    // 생성자를 참여자 목록에 추가
    await redis.sadd(`event:${eventId}:participants`, creatorId)

    // 약속 생성 완료 메시지 전송
    await client.chat.postMessage({
      channel: body.user.id,
      text: `약속이 생성되었습니다! 🎉`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*약속이 성공적으로 생성되었습니다!* 🎉\n*제목:* ${title}`,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*시작일:* ${startDate}`,
            },
            {
              type: "mrkdwn",
              text: `*종료일:* ${endDate}`,
            },
          ],
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "참여자 초대하기",
              },
              action_id: "invite_participants",
              value: eventId,
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "가능한 시간 입력하기",
              },
              action_id: "select_availability",
              value: eventId,
            },
          ],
        },
      ],
    })
  } catch (error) {
    console.error("약속 생성 처리 오류:", error)

    // 오류 메시지 전송
    await client.chat.postMessage({
      channel: body.user.id,
      text: "약속 생성 중 오류가 발생했습니다. 다시 시도해주세요.",
    })
  }
})

// 참여자 초대 버튼 처리
app.action("invite_participants", async ({ body, ack, client }) => {
  await ack()

  const eventId = body.actions[0].value

  try {
    // 사용자 선택 모달 열기
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "invite_modal",
        private_metadata: eventId,
        title: {
          type: "plain_text",
          text: "참여자 초대하기",
        },
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "약속에 초대할 참여자를 선택하세요:",
            },
          },
          {
            type: "input",
            block_id: "users_block",
            element: {
              type: "multi_users_select",
              action_id: "users_select",
              placeholder: {
                type: "plain_text",
                text: "참여자 선택",
              },
            },
            label: {
              type: "plain_text",
              text: "참여자",
            },
          },
        ],
        submit: {
          type: "plain_text",
          text: "초대하기",
        },
      },
    })
  } catch (error) {
    console.error("참여자 초대 모달 오류:", error)
  }
})

// 참여자 초대 모달 제출 처리
app.view("invite_modal", async ({ ack, body, view, client }) => {
  await ack()

  try {
    const eventId = view.private_metadata
    const selectedUsers = view.state.values.users_block.users_select.selected_users

    // 이벤트 데이터 가져오기
    const eventJson = await redis.get(`event:${eventId}`)
    if (!eventJson) {
      throw new Error("이벤트를 찾을 수 없습니다")
    }

    const eventData = JSON.parse(eventJson)

    // 각 사용자를 이벤트에 초대
    for (const userId of selectedUsers) {
      // 이미 초대된 사용자인지 확인
      const isInvited = await redis.sismember(`event:${eventId}:participants`, userId)
      if (isInvited !== 1) {
        // 참여자 목록에 추가
        await redis.sadd(`event:${eventId}:participants`, userId)
        await redis.sadd(`user_invited:${userId}`, eventId)

        // 초대 메시지 전송
        await client.chat.postMessage({
          channel: userId,
          text: `새로운 약속에 초대되었습니다: ${eventData.title}`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*새로운 약속에 초대되었습니다!* 📅\n*제목:* ${eventData.title}`,
              },
            },
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                  text: `*주최자:* ${eventData.creatorName}`,
                },
                {
                  type: "mrkdwn",
                  text: `*기간:* ${new Date(eventData.startDate).toLocaleDateString()} ~ ${new Date(eventData.endDate).toLocaleDateString()}`,
                },
              ],
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "가능한 시간 입력하기",
                  },
                  action_id: "select_availability",
                  value: eventId,
                },
              ],
            },
          ],
        })
      }
    }

    // 초대 완료 메시지
    await client.chat.postMessage({
      channel: body.user.id,
      text: `${selectedUsers.length}명의 참여자가 초대되었습니다.`,
    })
  } catch (error) {
    console.error("참여자 초대 처리 오류:", error)

    // 오류 메시지 전송
    await client.chat.postMessage({
      channel: body.user.id,
      text: "참여자 초대 중 오류가 발생했습니다. 다시 시도해주세요.",
    })
  }
})

// 가능한 시간 입력 버튼 처리
app.action("select_availability", async ({ body, ack, client }) => {
  await ack()

  const eventId = body.actions[0].value

  try {
    // 이벤트 데이터 가져오기
    const eventJson = await redis.get(`event:${eventId}`)
    if (!eventJson) {
      throw new Error("이벤트를 찾을 수 없습니다")
    }

    const eventData = JSON.parse(eventJson)

    // 시작일과 종료일 사이의 날짜 생성
    const startDate = new Date(eventData.startDate)
    const endDate = new Date(eventData.endDate)
    const dates = []

    const currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      dates.push(new Date(currentDate).toISOString().split("T")[0])
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // 가능한 시간 선택 모달 열기
    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${eventData.title}*에 참여 가능한 시간을 선택해주세요.`,
        },
      },
    ]

    // 각 날짜별 시간 선택 블록 추가
    for (const dateStr of dates) {
      blocks.push(
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${dateStr}*`,
          },
        },
        {
          type: "actions",
          block_id: `time_select_${dateStr}`,
          elements: [
            {
              type: "checkboxes",
              action_id: `time_${dateStr}`,
              options: [
                { text: { type: "plain_text", text: "오전 (9:00-12:00)" }, value: "morning" },
                { text: { type: "plain_text", text: "오후 (12:00-18:00)" }, value: "afternoon" },
                { text: { type: "plain_text", text: "저녁 (18:00-22:00)" }, value: "evening" },
              ],
            },
          ],
        },
      )
    }

    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "availability_modal",
        private_metadata: eventId,
        title: {
          type: "plain_text",
          text: "가능한 시간 선택",
        },
        blocks,
        submit: {
          type: "plain_text",
          text: "제출하기",
        },
      },
    })
  } catch (error) {
    console.error("가능한 시간 선택 모달 오류:", error)
  }
})

// 가능한 시간 선택 모달 제출 처리
app.view("availability_modal", async ({ ack, body, view, client }) => {
  await ack()

  try {
    const eventId = view.private_metadata
    const userId = body.user.id

    // 사용자 정보 가져오기
    const userInfo = await client.users.info({ user: userId })
    const userName = userInfo.user.real_name || userInfo.user.name

    // 선택된 시간 추출
    const availableTimes = {}

    Object.entries(view.state.values).forEach(([blockId, blockValue]) => {
      if (blockId.startsWith("time_select_")) {
        const dateStr = blockId.replace("time_select_", "")
        const timeKey = `time_${dateStr}`

        if (blockValue[timeKey] && blockValue[timeKey].selected_options) {
          const selectedTimes = blockValue[timeKey].selected_options.map((option) => option.value)

          if (selectedTimes.length > 0) {
            // 시간대를 실제 시간으로 변환
            const times = []
            if (selectedTimes.includes("morning")) {
              for (let hour = 9; hour < 12; hour++) {
                times.push(`${hour.toString().padStart(2, "0")}:00`)
              }
            }
            if (selectedTimes.includes("afternoon")) {
              for (let hour = 12; hour < 18; hour++) {
                times.push(`${hour.toString().padStart(2, "0")}:00`)
              }
            }
            if (selectedTimes.includes("evening")) {
              for (let hour = 18; hour < 22; hour++) {
                times.push(`${hour.toString().padStart(2, "0")}:00`)
              }
            }

            availableTimes[dateStr] = times
          }
        }
      }
    })

    // 가용성 ID 생성
    const availabilityId = `availability_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`

    // 가용성 데이터 생성
    const availabilityData = {
      id: availabilityId,
      eventId,
      userId,
      name: userName,
      availableTimes,
      submittedAt: new Date().toISOString(),
    }

    // 기존 가용성 확인
    const availabilityIds = await redis.smembers(`event:${eventId}:availabilities`)
    let existingAvailabilityId = null

    for (const id of availabilityIds) {
      const availJson = await redis.get(`availability:${id}`)
      if (availJson) {
        const availability = JSON.parse(availJson)
        if (availability.userId === userId) {
          existingAvailabilityId = id
          break
        }
      }
    }

    if (existingAvailabilityId) {
      // 기존 가용성 업데이트
      await redis.set(`availability:${existingAvailabilityId}`, JSON.stringify(availabilityData))
    } else {
      // 새 가용성 저장
      await redis.set(`availability:${availabilityId}`, JSON.stringify(availabilityData))
      await redis.sadd(`event:${eventId}:availabilities`, availabilityId)
      await redis.rpush(`event:${eventId}:availabilities:list`, JSON.stringify(availabilityData))
    }

    // 제출 완료 메시지
    await client.chat.postMessage({
      channel: userId,
      text: "가능한 시간이 성공적으로 제출되었습니다.",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*가능한 시간이 성공적으로 제출되었습니다!* ✅",
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "약속 결과 확인하기",
              },
              action_id: "view_results",
              value: eventId,
            },
          ],
        },
      ],
    })
  } catch (error) {
    console.error("가용성 제출 처리 오류:", error)

    // 오류 메시지 전송
    await client.chat.postMessage({
      channel: body.user.id,
      text: "가능한 시간 제출 중 오류가 발생했습니다. 다시 시도해주세요.",
    })
  }
})

// 약속 결과 확인 버튼 처리
app.action("view_results", async ({ body, ack, client }) => {
  await ack()

  const eventId = body.actions[0].value

  try {
    // 이벤트 데이터 가져오기
    const eventJson = await redis.get(`event:${eventId}`)
    if (!eventJson) {
      throw new Error("이벤트를 찾을 수 없습니다")
    }

    const eventData = JSON.parse(eventJson)

    // 가용성 데이터 가져오기
    const availabilities = []
    const availabilityIds = await redis.smembers(`event:${eventId}:availabilities`)

    for (const id of availabilityIds) {
      const availJson = await redis.get(`availability:${id}`)
      if (availJson) {
        availabilities.push(JSON.parse(availJson))
      }
    }

    // 날짜별, 시간별 참여 가능한 인원 계산
    const availabilityCounts = {}
    const participants = {}

    availabilities.forEach((avail) => {
      Object.entries(avail.availableTimes).forEach(([dateStr, times]) => {
        if (!availabilityCounts[dateStr]) {
          availabilityCounts[dateStr] = {}
        }

        times.forEach((time) => {
          if (!availabilityCounts[dateStr][time]) {
            availabilityCounts[dateStr][time] = {
              count: 0,
              participants: [],
            }
          }

          availabilityCounts[dateStr][time].count += 1
          availabilityCounts[dateStr][time].participants.push(avail.name)

          // 참여자 정보 저장
          participants[avail.userId] = avail.name
        })
      })
    })

    // 가장 많은 사람이 참여 가능한 시간 찾기
    let bestTimes = []
    let maxCount = 0

    Object.entries(availabilityCounts).forEach(([dateStr, times]) => {
      Object.entries(times).forEach(([time, data]) => {
        if (data.count > maxCount) {
          maxCount = data.count
          bestTimes = [{ date: dateStr, time, count: data.count, participants: data.participants }]
        } else if (data.count === maxCount) {
          bestTimes.push({ date: dateStr, time, count: data.count, participants: data.participants })
        }
      })
    })

    // 결과 메시지 생성
    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*"${eventData.title}" 약속 결과*`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `총 ${Object.keys(participants).length}명이 참여했습니다.`,
        },
      },
      {
        type: "divider",
      },
    ]

    // 최적의 시간 표시
    if (bestTimes.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*가장 많은 ${maxCount}명이 참여 가능한 시간:*`,
        },
      })

      bestTimes.slice(0, 5).forEach((bestTime) => {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `• ${bestTime.date} ${bestTime.time} - ${bestTime.count}명 참여 가능\n  참여자: ${bestTime.participants.join(", ")}`,
          },
        })
      })

      if (bestTimes.length > 5) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `외 ${bestTimes.length - 5}개 시간대 더 있음`,
          },
        })
      }
    } else {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "아직 참여자가 없거나 가능한 시간을 제출하지 않았습니다.",
        },
      })
    }

    // 약속 확정 버튼 (생성자만 표시)
    if (body.user.id === eventData.creatorId && bestTimes.length > 0) {
      blocks.push(
        {
          type: "divider",
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "약속 확정하기",
              },
              style: "primary",
              action_id: "confirm_event",
              value: eventId,
            },
          ],
        },
      )
    }

    await client.chat.postMessage({
      channel: body.user.id,
      blocks,
    })
  } catch (error) {
    console.error("약속 결과 확인 오류:", error)

    // 오류 메시지 전송
    await client.chat.postMessage({
      channel: body.user.id,
      text: "약속 결과를 확인하는 중 오류가 발생했습니다. 다시 시도해주세요.",
    })
  }
})

// 약속 확정 버튼 처리
app.action("confirm_event", async ({ body, ack, client }) => {
  await ack()

  const eventId = body.actions[0].value

  try {
    // 이벤트 데이터 가져오기
    const eventJson = await redis.get(`event:${eventId}`)
    if (!eventJson) {
      throw new Error("이벤트를 찾을 수 없습니다")
    }

    const eventData = JSON.parse(eventJson)

    // 확정 모달 열기
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "confirm_event_modal",
        private_metadata: eventId,
        title: {
          type: "plain_text",
          text: "약속 확정하기",
        },
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*"${eventData.title}" 약속을 확정합니다.*`,
            },
          },
          {
            type: "input",
            block_id: "confirm_date_block",
            element: {
              type: "datepicker",
              action_id: "confirm_date_input",
              initial_date: new Date(eventData.startDate).toISOString().split("T")[0],
              placeholder: {
                type: "plain_text",
                text: "날짜 선택",
              },
            },
            label: {
              type: "plain_text",
              text: "확정 날짜",
            },
          },
          {
            type: "input",
            block_id: "confirm_time_block",
            element: {
              type: "static_select",
              action_id: "confirm_time_input",
              placeholder: {
                type: "plain_text",
                text: "시간 선택",
              },
              options: [
                { text: { type: "plain_text", text: "09:00" }, value: "09:00" },
                { text: { type: "plain_text", text: "10:00" }, value: "10:00" },
                { text: { type: "plain_text", text: "11:00" }, value: "11:00" },
                { text: { type: "plain_text", text: "12:00" }, value: "12:00" },
                { text: { type: "plain_text", text: "13:00" }, value: "13:00" },
                { text: { type: "plain_text", text: "14:00" }, value: "14:00" },
                { text: { type: "plain_text", text: "15:00" }, value: "15:00" },
                { text: { type: "plain_text", text: "16:00" }, value: "16:00" },
                { text: { type: "plain_text", text: "17:00" }, value: "17:00" },
                { text: { type: "plain_text", text: "18:00" }, value: "18:00" },
                { text: { type: "plain_text", text: "19:00" }, value: "19:00" },
                { text: { type: "plain_text", text: "20:00" }, value: "20:00" },
              ],
            },
            label: {
              type: "plain_text",
              text: "확정 시간",
            },
          },
          {
            type: "input",
            block_id: "location_block",
            element: {
              type: "plain_text_input",
              action_id: "location_input",
              placeholder: {
                type: "plain_text",
                text: "약속 장소를 입력하세요",
              },
            },
            label: {
              type: "plain_text",
              text: "약속 장소",
            },
            optional: true,
          },
        ],
        submit: {
          type: "plain_text",
          text: "확정하기",
        },
      },
    })
  } catch (error) {
    console.error("약속 확정 모달 오류:", error)
  }
})

// 약속 확정 모달 제출 처리
app.view("confirm_event_modal", async ({ ack, body, view, client }) => {
  await ack()

  try {
    const eventId = view.private_metadata

    // 입력값 추출
    const confirmDate = view.state.values.confirm_date_block.confirm_date_input.selected_date
    const confirmTime = view.state.values.confirm_time_block.confirm_time_input.selected_option.value
    const location = view.state.values.location_block.location_input.value

    // 이벤트 데이터 가져오기
    const eventJson = await redis.get(`event:${eventId}`)
    if (!eventJson) {
      throw new Error("이벤트를 찾을 수 없습니다")
    }

    const eventData = JSON.parse(eventJson)

    // 이벤트 업데이트
    const updatedEventData = {
      ...eventData,
      confirmedDate: confirmDate,
      confirmedTime: confirmTime,
      location: location || "",
      status: "confirmed",
      updatedAt: new Date().toISOString(),
    }

    await redis.set(`event:${eventId}`, JSON.stringify(updatedEventData))

    // 참여자 목록 가져오기
    const participants = await redis.smembers(`event:${eventId}:participants`)

    // 모든 참여자에게 확정 메시지 전송
    for (const userId of participants) {
      await client.chat.postMessage({
        channel: userId,
        text: `"${eventData.title}" 약속이 확정되었습니다!`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*"${eventData.title}" 약속이 확정되었습니다!* 🎉`,
            },
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*날짜:* ${confirmDate}`,
              },
              {
                type: "mrkdwn",
                text: `*시간:* ${confirmTime}`,
              },
            ],
          },
          location
            ? {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*장소:* ${location}`,
                },
              }
            : null,
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `주최자: ${eventData.creatorName}`,
              },
            ],
          },
        ].filter(Boolean),
      })
    }
  } catch (error) {
    console.error("약속 확정 처리 오류:", error)

    // 오류 메시지 전송
    await client.chat.postMessage({
      channel: body.user.id,
      text: "약속 확정 중 오류가 발생했습니다. 다시 시도해주세요.",
    })
  }
})

// 슬래시 명령어: /내약속
app.command("/약속확인", async ({ command, ack, client, body }) => {
  await ack()

  try {
    const userId = body.user_id

    // 사용자의 약속 목록 가져오기
    const createdEvents = await redis.smembers(`user_created:${userId}`)
    const invitedEvents = await redis.smembers(`user_invited:${userId}`)

    // 중복 제거
    const allEventIds = [...new Set([...createdEvents, ...invitedEvents])]

    if (allEventIds.length === 0) {
      await client.chat.postMessage({
        channel: userId,
        text: "참여 중인 약속이 없습니다.",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "*참여 중인 약속이 없습니다.*",
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "새로운 약속을 만들려면 `/약속생성` 명령어를 사용하세요.",
            },
          },
        ],
      })
      return
    }

    // 이벤트 데이터 가져오기
    const events = []

    for (const eventId of allEventIds) {
      const eventJson = await redis.get(`event:${eventId}`)
      if (eventJson) {
        const eventData = JSON.parse(eventJson)
        events.push({
          id: eventId,
          ...eventData,
          isCreator: createdEvents.includes(eventId),
        })
      }
    }

    // 날짜순으로 정렬
    events.sort((a, b) => new Date(a.startDate) - new Date(b.startDate))

    // 메시지 블록 생성
    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*내 약속 목록*",
        },
      },
      {
        type: "divider",
      },
    ]

    // 각 약속 정보 추가
    events.forEach((event) => {
      blocks.push(
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${event.title}*${event.status === "confirmed" ? " ✅" : ""}\n${event.isCreator ? "(내가 만든 약속)" : "(초대받은 약속)"}`,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*기간:* ${new Date(event.startDate).toLocaleDateString()} ~ ${new Date(event.endDate).toLocaleDateString()}`,
            },
            {
              type: "mrkdwn",
              text:
                event.status === "confirmed"
                  ? `*확정:* ${event.confirmedDate} ${event.confirmedTime}`
                  : "*상태:* 조율 중",
            },
          ],
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "상세 보기",
              },
              action_id: "view_event_details",
              value: event.id,
            },
            event.status !== "confirmed"
              ? {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "가능한 시간 입력",
                  },
                  action_id: "select_availability",
                  value: event.id,
                }
              : null,
          ].filter(Boolean),
        },
        {
          type: "divider",
        },
      )
    })

    await client.chat.postMessage({
      channel: userId,
      blocks,
    })
  } catch (error) {
    console.error("내 약속 목록 조회 오류:", error)

    // 오류 메시지 전송
    await client.chat.postMessage({
      channel: body.user_id,
      text: "약속 목록을 불러오는 중 오류가 발생했습니다. 다시 시도해주세요.",
    })
  }
})

// 약속 상세 보기 버튼 처리
app.action("view_event_details", async ({ body, ack, client }) => {
  await ack()

  const eventId = body.actions[0].value

  try {
    // 이벤트 데이터 가져오기
    const eventJson = await redis.get(`event:${eventId}`)
    if (!eventJson) {
      throw new Error("이벤트를 찾을 수 없습니다")
    }

    const eventData = JSON.parse(eventJson)

    // 참여자 목록 가져오기
    const participantIds = await redis.smembers(`event:${eventId}:participants`)
    const participants = []

    for (const userId of participantIds) {
      try {
        const userInfo = await client.users.info({ user: userId })
        participants.push(userInfo.user.real_name || userInfo.user.name)
      } catch (error) {
        participants.push(`<@${userId}>`)
      }
    }

    // 메시지 블록 생성
    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${eventData.title}*${eventData.status === "confirmed" ? " ✅" : ""}`,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*주최자:* ${eventData.creatorName}`,
          },
          {
            type: "mrkdwn",
            text: `*기간:* ${new Date(eventData.startDate).toLocaleDateString()} ~ ${new Date(eventData.endDate).toLocaleDateString()}`,
          },
        ],
      },
    ]

    // 확정된 약속 정보
    if (eventData.status === "confirmed") {
      blocks.push({
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*확정 날짜:* ${eventData.confirmedDate}`,
          },
          {
            type: "mrkdwn",
            text: `*확정 시간:* ${eventData.confirmedTime}`,
          },
        ],
      })

      if (eventData.location) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*장소:* ${eventData.location}`,
          },
        })
      }
    }

    // 설명 추가
    if (eventData.description) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*설명:*\n${eventData.description}`,
        },
      })
    }

    // 참여자 목록
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*참여자 (${participants.length}명):*\n${participants.join(", ")}`,
      },
    })

    // 액션 버튼
    const actionElements = []

    if (eventData.status !== "confirmed") {
      actionElements.push(
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "가능한 시간 입력",
          },
          action_id: "select_availability",
          value: eventId,
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "결과 확인",
          },
          action_id: "view_results",
          value: eventId,
        },
      )

      // 생성자인 경우 추가 버튼
      if (body.user.id === eventData.creatorId) {
        actionElements.push({
          type: "button",
          text: {
            type: "plain_text",
            text: "참여자 초대",
          },
          action_id: "invite_participants",
          value: eventId,
        })
      }
    }

    if (actionElements.length > 0) {
      blocks.push({
        type: "actions",
        elements: actionElements,
      })
    }

    await client.chat.postMessage({
      channel: body.user.id,
      blocks,
    })
  } catch (error) {
    console.error("약속 상세 정보 조회 오류:", error)

    // 오류 메시지 전송
    await client.chat.postMessage({
      channel: body.user.id,
      text: "약속 상세 정보를 불러오는 중 오류가 발생했습니다. 다시 시도해주세요.",
    })
  }
})

// 슬래시 명령어: /약속도움말
app.command("/약속도움말", async ({ command, ack, client, body }) => {
  await ack()

  try {
    await client.chat.postMessage({
      channel: body.user_id,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*약속 일정 관리 도움말*",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "다음 명령어를 사용하여 약속을 관리할 수 있습니다:",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "• `/약속생성` - 새로운 약속을 만듭니다.\n• `/약속확인` - 내가 참여 중인 약속 목록을 확인합니다.\n• `/약속도움말` - 이 도움말을 표시합니다.",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*약속 생성 과정*\n1. `/약속생성` 명령어로 약속 기본 정보 입력\n2. 참여자 초대\n3. 각 참여자가 가능한 시간 입력\n4. 결과 확인 후 약속 확정",
          },
        },
      ],
    })
  } catch (error) {
    console.error("도움말 표시 오류:", error)
  }
})

// 약속 만들기 버튼 처리 추가
app.action("start_create_event", async ({ body, ack, client }) => {
  await ack()

  try {
    await client.chat.postMessage({
      channel: body.user.id,
      text: "약속 정보를 입력해주세요",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*약속 정보 입력*\n다음 형식으로 약속 정보를 입력해주세요:\n\n`제목: 팀 회의\n설명: 주간 회의\n시작일: 2023-12-01\n종료일: 2023-12-01`",
          },
        },
      ],
    })
  } catch (error) {
    console.error("약속 생성 안내 오류:", error)
  }
})

// 메시지 이벤트 처리 추가 (DM으로 약속 정보 입력 받기)
app.message(async ({ message, client }) => {
  // DM 메시지만 처리
  if (message.channel_type !== "im") return

  const text = message.text

  // 약속 정보 형식 확인
  if (text.includes("제목:") && text.includes("시작일:")) {
    try {
      // 메시지에서 정보 추출
      const titleMatch = text.match(/제목:\s*(.+)/)
      const descMatch = text.match(/설명:\s*(.+)/)
      const startMatch = text.match(/시작일:\s*(.+)/)
      const endMatch = text.match(/종료일:\s*(.+)/)

      if (!titleMatch || !startMatch || !endMatch) {
        await client.chat.postMessage({
          channel: message.channel,
          text: "정보 형식이 올바르지 않습니다. 다시 입력해주세요.",
        })
        return
      }

      const title = titleMatch[1].trim()
      const description = descMatch ? descMatch[1].trim() : ""
      const startDate = startMatch[1].trim()
      const endDate = endMatch[1].trim()

      // 사용자 정보 가져오기
      const creatorId = message.user
      const userInfo = await client.users.info({ user: creatorId })
      const creatorName = userInfo.user.real_name || userInfo.user.name

      // 이벤트 ID 생성
      const timestamp = Date.now()
      const randomPart = Math.random().toString(36).substring(2, 8)
      const eventId = `slack_e_${timestamp}_${randomPart}`

      // 이벤트 데이터 생성
      const eventData = {
        title,
        description,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        creatorId,
        creatorName,
        createdAt: new Date().toISOString(),
        platform: "slack",
      }

      // Redis에 이벤트 저장
      const redis = require("@upstash/redis")
      const redisClient = new redis.Redis({
        url: process.env.UPSTASH_REDIS_URL,
        token: process.env.UPSTASH_REDIS_TOKEN,
      })

      await redisClient.set(`event:${eventId}`, JSON.stringify(eventData))
      await redisClient.sadd(`user_created:${creatorId}`, eventId)
      await redisClient.sadd(`event:${eventId}:participants`, creatorId)

      // 약속 생성 완료 메시지 전송
      await client.chat.postMessage({
        channel: message.channel,
        text: `약속이 생성되었습니다! 🎉`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*약속이 성공적으로 생성되었습니다!* 🎉\n*제목:* ${title}`,
            },
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*시작일:* ${startDate}`,
              },
              {
                type: "mrkdwn",
                text: `*종료일:* ${endDate}`,
              },
            ],
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "참여자 초대하기",
                },
                action_id: "invite_participants",
                value: eventId,
              },
            ],
          },
        ],
      })
    } catch (error) {
      console.error("약속 생성 처리 오류:", error)

      await client.chat.postMessage({
        channel: message.channel,
        text: "약속 생성 중 오류가 발생했습니다. 다시 시도해주세요.",
      })
    }
  }
})

module.exports = { app }

