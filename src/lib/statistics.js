import { EXERCISE_TYPES } from './utils.js'

/** 一次遍历生成阶段图表与小结，不依赖记录排列顺序。 */
export function summarizePeriod(checkins, exercises, keys) {
  const dates = new Set(keys)
  const byDate = new Map(checkins.filter((entry) => dates.has(entry.date)).map((entry) => [entry.date, entry]))
  const byDay = new Map()
  const byType = new Map()
  const palette = ['#0f9d76', '#3f6a96', '#e07a3f', '#8e6bb5', '#d4574e', '#2f9e44', '#c2a11c', '#5c7f8a', '#999']
  let minutes = 0, calories = 0, times = 0
  for (const entry of exercises) {
    if (!dates.has(entry.date)) continue
    byDay.set(entry.date, (byDay.get(entry.date) || 0) + entry.duration)
    byType.set(entry.type, (byType.get(entry.type) || 0) + 1)
    minutes += entry.duration
    calories += entry.calories
    times++
  }
  let water = 0, sleep = 0, sleepDays = 0
  for (const entry of byDate.values()) {
    water += entry.water
    if (entry.sleep !== null && entry.sleep !== undefined) { sleep += entry.sleep; sleepDays++ }
  }
  return {
    waterData: keys.map((key) => ({ key, value: byDate.get(key)?.water ?? 0 })),
    sleepData: keys.map((key) => ({ key, value: byDate.get(key)?.sleep ?? 0 })),
    exerciseData: keys.map((key) => ({ key, value: byDay.get(key) || 0 })),
    typeDist: EXERCISE_TYPES.map((type, index) => ({ label: type.name, value: byType.get(type.name) || 0, color: palette[index] })).filter((item) => item.value).sort((a, b) => b.value - a.value),
    summary: {
      checkinRate: keys.length ? Math.round(byDate.size / keys.length * 100) : 0,
      avgWater: byDate.size ? Math.round(water / byDate.size) : 0,
      avgSleep: sleepDays ? Math.round(sleep / sleepDays * 10) / 10 : null,
      minutes, calories, times
    }
  }
}
