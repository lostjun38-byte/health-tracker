/** 内存缓存仅在本地事务提交成功后更新。 */
import { reactive, computed } from 'vue'
import * as db from '../lib/db.js'
import { addDays } from '../lib/utils.js'
import { currentDay } from '../lib/day.js'
import { validateCheckin, validateData, validateExercise } from '../lib/validation.js'

export const state = reactive({ checkins: [], exercises: [], loaded: false, error: '' })
let initialization = null
const sortCheckins = (items) => items.sort((a, b) => a.date.localeCompare(b.date))
const sortExercises = (items) => items.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)

export function init({ force = false } = {}) {
  if (initialization) return initialization
  if (state.loaded && !force) return Promise.resolve()
  initialization = (async () => {
    try {
      const [checkins, exercises] = await Promise.all([db.getAllCheckins(), db.getAllExercises()])
      const clean = validateData({ checkins, exercises })
      state.checkins = sortCheckins(clean.checkins)
      state.exercises = sortExercises(clean.exercises)
      state.error = ''
      state.loaded = true
    } catch (error) {
      state.error = '本地数据读取失败：' + (error?.message || '请重试')
      state.loaded = false
      throw error
    }
  })().finally(() => { initialization = null })
  return initialization
}

export async function saveCheckin(entry) {
  const clean = validateCheckin({ ...entry, updatedAt: Date.now() }, { coerce: true })
  await db.putCheckin(clean)
  const idx = state.checkins.findIndex((item) => item.date === clean.date)
  if (idx >= 0) state.checkins[idx] = clean
  else state.checkins.push(clean)
  sortCheckins(state.checkins)
  return clean
}

export function weightAtDate(date = currentDay.value) {
  for (let i = state.checkins.length - 1; i >= 0; i--) {
    const item = state.checkins[i]
    if (item.date <= date && item.weight !== null) return item.weight
  }
  return 60
}

function normalizeExercise(entry) {
  return validateExercise({ ...entry, date: entry.date ?? currentDay.value }, {
    coerce: true,
    calculate: true,
    weight: entry.weight ?? weightAtDate(entry.date ?? currentDay.value)
  })
}

export async function addExercise(entry) {
  const clean = normalizeExercise(entry)
  const id = await db.putExercise(clean)
  state.exercises.push({ ...clean, id })
  sortExercises(state.exercises)
}

export async function updateExercise(id, entry) {
  const clean = normalizeExercise(entry)
  await db.putExercise({ ...clean, id })
  const idx = state.exercises.findIndex((item) => item.id === id)
  if (idx >= 0) state.exercises[idx] = { ...clean, id }
  sortExercises(state.exercises)
}

export async function removeExercise(id) {
  await db.deleteExercise(id)
  state.exercises = state.exercises.filter((item) => item.id !== id)
}

export const checkinMap = computed(() => Object.fromEntries(state.checkins.map((item) => [item.date, item])))
export const todayCheckin = computed(() => checkinMap.value[currentDay.value])

export const streak = computed(() => {
  let key = currentDay.value
  const map = checkinMap.value
  if (!map[key]) key = addDays(key, -1)
  let count = 0
  while (map[key]) { count++; key = addDays(key, -1) }
  return count
})

export const todayExerciseSummary = computed(() => {
  let minutes = 0
  let calories = 0
  let count = 0
  for (const entry of state.exercises) {
    if (entry.date !== currentDay.value) continue
    minutes += entry.duration
    calories += entry.calories
    count++
  }
  return { minutes, calories, count }
})

export const latestWeight = computed(() => {
  for (let i = state.checkins.length - 1; i >= 0; i--) {
    const item = state.checkins[i]
    if (item.date <= currentDay.value && item.weight !== null) return item
  }
  return null
})
