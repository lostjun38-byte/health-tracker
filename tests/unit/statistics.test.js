import { expect, test } from 'vitest'
import { summarizePeriod } from '../../src/lib/statistics.js'
import { lastNDays } from '../../src/lib/utils.js'
import { checkin, exercise } from '../fixtures.js'

test('乱序、过早和未来记录不会破坏当前时间段统计', () => {
  const dates = lastNDays(7, '2026-09-12')
  const entries = [exercise({ date: '2026-09-01', duration: 300 }), exercise(), exercise({ date: '2026-09-13', duration: 100 }), exercise({ date: '2026-09-06', duration: 20, calories: 196 })]
  const stats = summarizePeriod([checkin(), checkin({ date: '2026-09-13' })], entries, dates)
  expect(stats.summary).toMatchObject({ minutes: 50, calories: 490, times: 2, checkinRate: 14 })
  expect(stats.exerciseData.map((entry) => entry.value)).toEqual([20, 0, 0, 0, 0, 0, 30])
  expect(stats.typeDist).toHaveLength(1)
  expect(stats.typeDist[0].value).toBe(2)
})

test('未填写睡眠不参与平均，零小时则参与', () => {
  const stats = summarizePeriod([checkin({ sleep: 0 }), checkin({ date: '2026-09-11', sleep: 8 }), checkin({ date: '2026-09-10', sleep: null })], [], lastNDays(7, '2026-09-12'))
  expect(stats.summary.avgSleep).toBe(4)
  expect(summarizePeriod([], [], lastNDays(7, '2026-09-12')).summary.avgSleep).toBeNull()
})
