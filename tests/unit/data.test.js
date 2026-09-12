import { beforeEach, describe, expect, test, vi } from 'vitest'
import * as db from '../../src/lib/db.js'
import * as health from '../../src/stores/health.js'
import { validateBackup } from '../../src/lib/validation.js'
import { refreshDay } from '../../src/lib/day.js'
import { backup, checkin, exercise } from '../fixtures.js'

beforeEach(async () => {
  await db.clearAll()
  await health.init({ force: true })
})

describe('备份校验与事务', () => {
  test.each([
    ['错误版本', { ...backup({ checkins: [], exercises: [] }), version: 999 }],
    ['缺少数组', backup({ checkins: [] })],
    ['单个数组类型错误', backup({ checkins: {}, exercises: [] })],
    ['无效日期', backup({ checkins: [checkin({ date: '2026-02-30' })], exercises: [] })],
    ['非字符串日期', backup({ checkins: [], exercises: [exercise({ date: 42 })] })],
    ['未来日期', backup({ checkins: [checkin({ date: '2026-09-13' })], exercises: [] })],
    ['非数字饮水量', backup({ checkins: [checkin({ water: '1000' })], exercises: [] })],
    ['负睡眠时长', backup({ checkins: [checkin({ sleep: -1 })], exercises: [] })],
    ['错误心情', backup({ checkins: [checkin({ mood: 99 })], exercises: [] })],
    ['无穷热量', backup({ checkins: [], exercises: [exercise({ calories: Infinity })] })],
    ['重复打卡日期', backup({ checkins: [checkin(), checkin()], exercises: [] })]
  ])('%s 会被拒绝', (_label, payload) => {
    expect(() => validateBackup(payload)).toThrow()
  })

  test('含错误记录的备份不会覆盖任何原数据', async () => {
    await health.saveCheckin(checkin())
    await expect(db.importAll({ checkins: [checkin({ water: 9999 }), { water: 100 }], exercises: [] })).rejects.toThrow()
    expect((await db.getAllCheckins())[0].water).toBe(1000)
    expect(health.todayCheckin.value.water).toBe(1000)
  })

  test('覆盖恢复中途写入失败时，两张表都完整回滚', async () => {
    await db.putCheckin(checkin())
    await db.putExercise(exercise())
    const original = IDBObjectStore.prototype.put
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (entry, ...args) {
      if (entry.date === '2026-09-11') throw new DOMException('模拟写入失败', 'DataError')
      return original.call(this, entry, ...args)
    })
    await expect(db.importAll({ checkins: [checkin({ water: 9999 }), checkin({ date: '2026-09-11' })], exercises: [] }, { mode: 'replace' })).rejects.toThrow('模拟写入失败')
    expect((await db.getAllCheckins())[0].water).toBe(1000)
    expect(await db.getAllExercises()).toHaveLength(1)
  })

  test('重复合并不累加，并保留备份中的两次相同运动', async () => {
    await db.putExercise(exercise())
    const data = { checkins: [checkin()], exercises: [exercise({ id: 1 }), exercise({ id: 2 })] }
    await db.importAll(data)
    await db.importAll(data)
    expect(await db.getAllCheckins()).toHaveLength(1)
    expect(await db.getAllExercises()).toHaveLength(2)
  })

  test('合并保留较新的打卡，覆盖恢复则完整替换', async () => {
    await db.putCheckin(checkin({ updatedAt: 3000 }))
    await db.putExercise(exercise())
    await db.importAll({ checkins: [checkin({ water: 500, updatedAt: 2000 })], exercises: [] })
    expect((await db.getAllCheckins())[0].water).toBe(1000)
    await db.importAll({ checkins: [checkin({ date: '2026-09-11', water: 500 })], exercises: [] }, { mode: 'replace' })
    expect((await db.getAllCheckins()).map((entry) => entry.date)).toEqual(['2026-09-11'])
    expect(await db.getAllExercises()).toEqual([])
  })
})

describe('持久化与统计状态', () => {
  test('事务失败时不显示新打卡，也不修改旧记录', async () => {
    const original = IDBDatabase.prototype.transaction
    const stub = vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (...args) {
      const tx = original.apply(this, args)
      if (args[1] === 'readwrite') queueMicrotask(() => tx.abort())
      return tx
    })
    await expect(health.saveCheckin(checkin())).rejects.toThrow()
    expect(health.todayCheckin.value).toBeUndefined()
    expect(await db.getAllCheckins()).toEqual([])
    stub.mockRestore()
    await health.saveCheckin(checkin())
    vi.spyOn(db, 'putCheckin').mockRejectedValue(new Error('空间不足'))
    await expect(health.saveCheckin(checkin({ water: 9999 }))).rejects.toThrow('空间不足')
    expect(health.todayCheckin.value.water).toBe(1000)
  })

  test('未填写的心情和睡眠保持为空，真实零步数得到保留', async () => {
    await health.saveCheckin({ date: '2026-09-12', water: 500, mood: 0, steps: 0 })
    expect((await db.getAllCheckins())[0]).toMatchObject({ mood: null, sleep: null, steps: 0 })
  })

  test.each([0, -10, 2000, Infinity, 'abc', 1.5])('拒绝非法运动时长 %s', async (duration) => {
    await expect(health.addExercise(exercise({ duration }))).rejects.toThrow()
    expect(await db.getAllExercises()).toHaveLength(0)
  })

  test('补录与编辑后仍正确排序、汇总，热量使用运动日期的体重', async () => {
    await health.saveCheckin(checkin({ date: '2026-09-01', weight: 60 }))
    await health.saveCheckin(checkin({ weight: 80 }))
    await health.addExercise(exercise())
    await health.addExercise(exercise({ date: '2026-09-02', duration: 20 }))
    expect(health.todayExerciseSummary.value).toEqual({ minutes: 30, calories: 392, count: 1 })
    expect(health.state.exercises.map((entry) => entry.date)).toEqual(['2026-09-12', '2026-09-02'])
    expect(health.state.exercises[1].calories).toBe(196)
    const id = health.state.exercises[0].id
    await health.updateExercise(id, exercise({ date: '2026-09-01' }))
    expect(health.state.exercises.map((entry) => entry.date)).toEqual(['2026-09-02', '2026-09-01'])
    expect(health.todayExerciseSummary.value.minutes).toBe(0)
  })

  test('跨天后派生数据使用新日期，即使记录未变化', async () => {
    await health.saveCheckin(checkin())
    await health.addExercise(exercise())
    expect(health.todayCheckin.value).toBeDefined()
    expect(health.todayExerciseSummary.value.minutes).toBe(30)
    vi.setSystemTime(new Date('2026-09-13T12:00:00'))
    refreshDay()
    expect(health.todayCheckin.value).toBeUndefined()
    expect(health.todayExerciseSummary.value.minutes).toBe(0)
    expect(health.streak.value).toBe(1)
  })

  test('读取失败向调用者报错，重试成功后清除错误', async () => {
    const stub = vi.spyOn(db, 'getAllExercises').mockRejectedValue(new Error('暂时无法读取'))
    await expect(health.init({ force: true })).rejects.toThrow('暂时无法读取')
    expect(health.state.loaded).toBe(false)
    expect(health.state.error).toContain('暂时无法读取')
    stub.mockRestore()
    await health.init({ force: true })
    expect(health.state.loaded).toBe(true)
    expect(health.state.error).toBe('')
  })
})
