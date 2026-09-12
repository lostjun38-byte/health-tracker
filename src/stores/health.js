/**
 * 全局响应式 store:一次把数据读入内存,之后读写同步内存 + 异步落库。
 * 数据量是"个人打卡"级别(几百到几千条),常驻内存毫无压力,
 *换来的是所有页面渲染零查询延迟。
 */
import { reactive, computed } from 'vue'
import * as db from '../lib/db.js'
import { todayKey, estimateCalories, EXERCISE_TYPES } from '../lib/utils.js'

export const state = reactive({
  checkins: [], // 按 date 升序
  exercises: [], // 按 date 倒序,新记录在前
  loaded: false,
  error: ''
})

export async function init() {
  if (state.loaded) return
  try {
    const [checkins, exercises] = await Promise.all([
      db.getAllCheckins(),
      db.getAllExercises()
    ])
    checkins.sort((a, b) => a.date.localeCompare(b.date))
    exercises.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    state.checkins = checkins
    state.exercises = exercises
  } catch (err) {
    state.error = '本地数据库不可用:' + err.message
  } finally {
    state.loaded = true
  }
}

/* ---------- 打卡 ---------- */

export async function saveCheckin(entry) {
  const clean = {
    date: entry.date,
    water: clampNum(entry.water, 0, 10000),
    sleep: clampNum(entry.sleep, 0, 24, 1),
    mood: clampNum(entry.mood, 1, 5),
    weight: entry.weight ? clampNum(entry.weight, 20, 300, 1) : null,
    steps: entry.steps ? Math.round(clampNum(entry.steps, 0, 200000)) : null,
    note: (entry.note || '').slice(0, 200),
    updatedAt: Date.now()
  }
  const idx = state.checkins.findIndex((c) => c.date === clean.date)
  if (idx >= 0) state.checkins[idx] = clean
  else {
    state.checkins.push(clean)
    state.checkins.sort((a, b) => a.date.localeCompare(b.date))
  }
  await db.putCheckin(clean)
}

/* ---------- 运动 ---------- */

export async function addExercise(entry) {
  const clean = normalizeExercise(entry)
  const id = await db.putExercise(clean)
  state.exercises.unshift({ ...clean, id })
}

export async function updateExercise(id, entry) {
  const clean = normalizeExercise(entry)
  await db.putExercise({ ...clean, id })
  const idx = state.exercises.findIndex((e) => e.id === id)
  if (idx >= 0) state.exercises[idx] = { ...clean, id }
}

export async function removeExercise(id) {
  await db.deleteExercise(id)
  state.exercises = state.exercises.filter((e) => e.id !== id)
}

function normalizeExercise(entry) {
  const type = EXERCISE_TYPES.find((t) => t.name === entry.type) || EXERCISE_TYPES[0]
  // 热量估算优先使用用户最近一次记录的体重,没有则按 60kg
  let weight = entry.weight
  if (!weight) {
    for (let i = state.checkins.length - 1; i >= 0; i--) {
      if (state.checkins[i].weight) {
        weight = state.checkins[i].weight
        break
      }
    }
  }
  return {
    date: entry.date || todayKey(),
    type: type.name,
    duration: clampNum(entry.duration, 1, 1440),
    intensity: ['低', '中', '高'].includes(entry.intensity) ? entry.intensity : '中',
    calories: estimateCalories(type.met, weight || 60, entry.duration),
    note: (entry.note || '').slice(0, 200)
  }
}

function clampNum(v, min, max, decimals = 0) {
  const n = Number(v) || 0
  const clamped = Math.min(max, Math.max(min, n))
  return decimals ? Math.round(clamped * 10) / 10 : clamped
}

/* ---------- 派生数据 ---------- */

export const checkinMap = computed(() => {
  const map = {}
  for (const c of state.checkins) map[c.date] = c
  return map
})

export const todayCheckin = computed(() => checkinMap.value[todayKey()])

/** 连续打卡天数:从今天(或昨天)往前数连续有打卡记录的天数 */
export const streak = computed(() => {
  if (!state.checkins.length) return 0
  let key = todayKey()
  const map = checkinMap.value
  if (!map[key]) {
    const yest = new Date()
    key = todayKey(new Date(yest.getFullYear(), yest.getMonth(), yest.getDate() - 1))
    if (!map[key]) return 0
  }
  let count = 0
  while (map[key]) {
    count++
    const [y, m, d] = key.split('-').map(Number)
    key = todayKey(new Date(y, m - 1, d - 1))
  }
  return count
})

/** 今日运动合计 */
export const todayExerciseSummary = computed(() => {
  const key = todayKey()
  let minutes = 0
  let calories = 0
  let count = 0
  for (const e of state.exercises) {
    if (e.date !== key) break // 已按日期倒序,可以直接停
    minutes += e.duration
    calories += e.calories
    count++
  }
  return { minutes, calories, count }
})

export const latestWeight = computed(() => {
  for (let i = state.checkins.length - 1; i >= 0; i--) {
    if (state.checkins[i].weight) return state.checkins[i]
  }
  return null
})
