import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { backup, checkin, exercise } from '../fixtures.js'

async function visit(page, route = '/') {
  await page.goto(route)
  await expect(page.locator('.page-title')).toBeVisible()
}
async function records(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('health-tracker', 1)
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      const tx = db.transaction(['checkins', 'exercises'], 'readonly')
      const checkins = tx.objectStore('checkins').getAll()
      const exercises = tx.objectStore('exercises').getAll()
      tx.oncomplete = () => { db.close(); resolve({ checkins: checkins.result, exercises: exercises.result }) }
      tx.onabort = () => { db.close(); reject(tx.error) }
    }
  }))
}
async function seed(page, data) {
  await visit(page)
  await page.evaluate((data) => new Promise((resolve, reject) => {
    const open = indexedDB.open('health-tracker', 1)
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      const tx = db.transaction(['checkins', 'exercises'], 'readwrite')
      const checkins = tx.objectStore('checkins')
      const exercises = tx.objectStore('exercises')
      checkins.clear()
      exercises.clear()
      data.checkins.forEach((entry) => checkins.put(entry))
      data.exercises.forEach((entry) => exercises.put(entry))
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onabort = () => { db.close(); reject(tx.error) }
    }
  }), data)
  await page.reload()
  await expect(page.locator('.page-title')).toBeVisible()
}
async function nav(page, name) {
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
}
async function upload(page, payload) {
  await page.locator('input[type=file]').setInputFiles({
    name: 'backup.json', mimeType: 'application/json',
    buffer: Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload))
  })
  await expect(page.getByRole('button', { name: '选择备份文件…', exact: true })).toBeEnabled()
}
async function saveWater(page, value) {
  await page.locator('#checkin-water').fill(String(value))
  await page.getByRole('button', { name: /^(保存打卡|更新打卡)$/ }).click()
  await expect(page.getByRole('status').filter({ hasText: '的打卡已保存' })).toBeVisible()
}
async function addRun(page, date, duration) {
  await page.getByRole('button', { name: /记录一次运动/ }).click()
  await page.locator('#exercise-date').fill(date)
  await page.locator('#exercise-type').selectOption('跑步')
  await page.locator('#exercise-duration').fill(String(duration))
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.locator('form.card')).toHaveCount(0)
}
async function nextDay(page) {
  await page.clock.setFixedTime(new Date('2026-09-13T12:00:00+08:00'))
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.locator('.page-sub')).toContainText('9 月 13 日')
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-12T12:00:00+08:00'))
})

test('打卡可保存、刷新恢复，未选择心情保持为空', async ({ page }) => {
  await visit(page)
  await page.getByRole('button', { name: '减少 250 毫升饮水' }).click()
  await expect(page.locator('#checkin-water')).toHaveValue('0')
  await saveWater(page, 500)
  expect((await records(page)).checkins[0]).toMatchObject({ water: 500, mood: null, sleep: null })
  await page.reload()
  await expect(page.locator('#checkin-water')).toHaveValue('500')
  await expect(page.locator('.card-title').filter({ hasText: '今日已打卡' })).toBeVisible()
})

test('数据库写入失败会提示错误，不显示假成功', async ({ page }) => {
  await visit(page)
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction
    IDBDatabase.prototype.transaction = function (...args) {
      const tx = original.apply(this, args)
      if (args[1] === 'readwrite') queueMicrotask(() => tx.abort())
      return tx
    }
  })
  await page.locator('#checkin-water').fill('500')
  await page.getByRole('button', { name: '保存打卡', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('保存失败')
  await expect(page.locator('.card-title').filter({ hasText: '今日已打卡' })).toHaveCount(0)
  expect((await records(page)).checkins).toHaveLength(0)
  await expect(page.locator('#checkin-water')).toHaveValue('500')
})

test('补录旧运动不会使今日和最近七天的统计消失', async ({ page }) => {
  await visit(page)
  await nav(page, '运动记录')
  await addRun(page, '2026-09-12', 30)
  await addRun(page, '2026-09-02', 20)
  await expect(page.locator('.record').first()).toContainText('09/12')
  await nav(page, '今日打卡')
  await expect(page.locator('.stat-card').filter({ hasText: '今日运动' })).toContainText('30 分钟')
  await nav(page, '数据统计')
  await expect(page.locator('.sum-item').filter({ hasText: '运动总时长' })).toContainText('30 分钟')
  await expect(page.locator('.sum-item').filter({ hasText: '运动次数' }).locator('b')).toHaveText('1')
})

test('越界运动时长在表单中被阻止，改正后可正常保存', async ({ page }) => {
  await visit(page, '/#/exercise')
  await page.getByRole('button', { name: /记录一次运动/ }).click()
  await page.locator('#exercise-duration').fill('2000')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  expect(await page.locator('#exercise-duration').evaluate((input) => input.validity.rangeOverflow)).toBe(true)
  expect((await records(page)).exercises).toHaveLength(0)
  await page.locator('#exercise-duration').fill('30')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.locator('form.card')).toHaveCount(0)
  expect((await records(page)).exercises[0]).toMatchObject({ duration: 30, calories: 129 })
})

test('错误备份被拒绝且原有记录保留', async ({ page }) => {
  await seed(page, { checkins: [checkin()], exercises: [] })
  await nav(page, '隐私与数据')
  await upload(page, backup({ checkins: [checkin({ water: 9999 }), { water: 100 }], exercises: [] }))
  await expect(page.getByRole('alert')).toContainText('原数据未变更')
  expect((await records(page)).checkins[0].water).toBe(1000)
  await page.reload()
  await expect(page.getByRole('heading', { name: '隐私与数据' })).toBeVisible()
})

test('合并恢复可重复操作，覆盖恢复替换原有数据', async ({ page }) => {
  await seed(page, { checkins: [checkin({ updatedAt: 3000 })], exercises: [] })
  await nav(page, '隐私与数据')
  page.on('dialog', (dialog) => dialog.accept())
  const payload = backup({ checkins: [checkin({ water: 500, updatedAt: 2000 })], exercises: [exercise({ id: 1 }), exercise({ id: 2 })] })
  await upload(page, payload)
  await upload(page, payload)
  const merged = await records(page)
  expect(merged.checkins[0].water).toBe(1000)
  expect(merged.exercises).toHaveLength(2)
  await page.locator('#import-mode').selectOption('replace')
  await upload(page, backup({ checkins: [checkin({ date: '2026-09-11' })], exercises: [] }))
  const replaced = await records(page)
  expect(replaced.checkins.map((entry) => entry.date)).toEqual(['2026-09-11'])
  expect(replaced.exercises).toHaveLength(0)
})

test('取消覆盖恢复不改动当前记录', async ({ page }) => {
  await seed(page, { checkins: [checkin()], exercises: [exercise()] })
  await nav(page, '隐私与数据')
  await page.locator('#import-mode').selectOption('replace')
  page.on('dialog', (dialog) => dialog.dismiss())
  await upload(page, backup({ checkins: [], exercises: [] }))
  expect((await records(page)).checkins).toHaveLength(1)
  expect((await records(page)).exercises).toHaveLength(1)
})

test('600 条带备注记录的加密备份可以下载和完整恢复', async ({ page }) => {
  await seed(page, { checkins: [checkin()], exercises: Array.from({ length: 600 }, (_, index) => exercise({ id: index + 1, note: '日常运动记录'.repeat(20) })) })
  await nav(page, '隐私与数据')
  await page.getByRole('checkbox', { name: '使用密码加密备份文件' }).check()
  await page.locator('#export-password').fill('test-password')
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出加密备份', exact: true }).click()
  const download = await downloaded
  const text = await readFile(await download.path(), 'utf8')
  expect(text.length).toBeGreaterThan(200000)
  expect(JSON.parse(text).encrypted).toBe(true)
  page.on('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '清除所有本地数据', exact: true }).click()
  await page.getByRole('button', { name: '再点一次确认删除！', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('已清空')
  await page.locator('#import-password').fill('test-password')
  await upload(page, text)
  expect((await records(page)).exercises).toHaveLength(600)
  expect((await records(page)).checkins).toHaveLength(1)
})

test('跨天后填写今天的数据不会覆盖昨天', async ({ page }) => {
  await visit(page)
  await saveWater(page, 250)
  await nextDay(page)
  await expect(page.locator('#checkin-water')).toHaveValue('0')
  await saveWater(page, 500)
  expect((await records(page)).checkins.map(({ date, water }) => ({ date, water }))).toEqual([
    { date: '2026-09-12', water: 250 }, { date: '2026-09-13', water: 500 }
  ])
})

test('跨天时未保存草稿被保留，用户可单独补存', async ({ page }) => {
  await visit(page)
  await page.locator('#checkin-water').fill('250')
  await nextDay(page)
  await expect(page.locator('.draft-notice')).toContainText('2026-09-12')
  await saveWater(page, 500)
  await page.getByRole('button', { name: '补存这份草稿', exact: true }).click()
  await expect(page.locator('.draft-notice')).toHaveCount(0)
  expect((await records(page)).checkins.map(({ date, water }) => ({ date, water }))).toEqual([
    { date: '2026-09-12', water: 250 }, { date: '2026-09-13', water: 500 }
  ])
})

test('读取坏数据后仍可进入恢复页面并覆盖恢复', async ({ page }) => {
  await seed(page, { checkins: [], exercises: [exercise({ date: 42 })] })
  await expect(page.locator('.storage-error')).toBeVisible()
  await expect(page.locator('#checkin-water')).toBeDisabled()
  await nav(page, '隐私与数据')
  await page.locator('#import-mode').selectOption('replace')
  page.on('dialog', (dialog) => dialog.accept())
  await upload(page, backup({ checkins: [checkin()], exercises: [] }))
  await expect(page.locator('.storage-error')).toHaveCount(0)
  await nav(page, '今日打卡')
  await expect(page.locator('#checkin-water')).toHaveValue('1000')
})

test('桌面与手机导航正确切换，表单有可访问名称', async ({ page }) => {
  await visit(page)
  await expect(page.locator('.sidebar')).toBeVisible()
  await expect(page.locator('.bottom-nav')).toBeHidden()
  for (const selector of ['#checkin-water', '#checkin-sleep', '#checkin-weight', '#checkin-steps', '#checkin-note']) {
    await expect(page.locator(selector)).toHaveAccessibleName(/.+/)
  }
  await page.setViewportSize({ width: 320, height: 800 })
  await expect(page.locator('.sidebar')).toBeHidden()
  await expect(page.locator('.bottom-nav')).toBeVisible()
  await nav(page, '数据统计')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await nav(page, '运动记录')
  await page.getByRole('button', { name: /记录一次运动/ }).click()
  for (const selector of ['#exercise-date', '#exercise-type', '#exercise-duration', '#exercise-note']) {
    await expect(page.locator(selector)).toHaveAccessibleName(/.+/)
  }
})

test('鼠标静止后停止动画帧，减少动态效果设置立即生效', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.addInitScript(() => {
    const request = window.requestAnimationFrame.bind(window)
    const cancel = window.cancelAnimationFrame.bind(window)
    window.pendingFrames = new Set()
    window.requestAnimationFrame = (callback) => {
      const id = request((time) => { window.pendingFrames.delete(id); callback(time) })
      window.pendingFrames.add(id)
      return id
    }
    window.cancelAnimationFrame = (id) => { window.pendingFrames.delete(id); cancel(id) }
  })
  await visit(page)
  await page.mouse.move(50, 50)
  await expect(page.locator('.ambient-layer')).toHaveAttribute('style', /translate3d/)
  await expect.poll(() => page.evaluate(() => window.pendingFrames.size)).toBe(0)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.ambient-layer')).toHaveCSS('transform', 'none')
  await expect(page.locator('.blob').first()).toHaveCSS('animation-name', 'none')
})


test('连续跨天会按日期保留多份未保存草稿', async ({ page }) => {
  await visit(page)
  await page.locator('#checkin-water').fill('250')
  await nextDay(page)
  await page.locator('#checkin-water').fill('500')
  await page.clock.setFixedTime(new Date('2026-09-14T12:00:00+08:00'))
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.locator('.draft-notice')).toHaveCount(2)
  await saveWater(page, 750)
  for (const date of ['2026-09-12', '2026-09-13']) {
    await page.locator('.draft-notice').filter({ hasText: date }).getByRole('button', { name: '补存这份草稿' }).click()
    await expect(page.locator('.draft-notice').filter({ hasText: date })).toHaveCount(0)
  }
  expect((await records(page)).checkins.map(({ date, water }) => ({ date, water }))).toEqual([
    { date: '2026-09-12', water: 250 }, { date: '2026-09-13', water: 500 }, { date: '2026-09-14', water: 750 }
  ])
})
