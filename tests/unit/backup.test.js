import { expect, test } from 'vitest'
import { encodeBackup, decodeBackup } from '../../src/lib/backup.js'
import { checkin, exercise, backup } from '../fixtures.js'

test('现有版本 1 明文备份可以恢复', async () => {
  const data = { checkins: [checkin()], exercises: [exercise()] }
  expect(await decodeBackup(JSON.stringify(backup(data)))).toEqual(data)
})

test('超过参数展开上限的加密备份能完整往返', async () => {
  const data = { checkins: [checkin()], exercises: Array.from({ length: 1000 }, (_, index) => exercise({ id: index + 1, note: '日常运动记录'.repeat(20) })) }
  const text = await encodeBackup(data, { password: 'test-password' })
  expect(text.length).toBeGreaterThan(200000)
  expect(JSON.parse(text).encrypted).toBe(true)
  expect(text).not.toContain('日常运动记录')
  expect(await decodeBackup(text, 'test-password')).toEqual(data)
})

test('错误密码或篡改密文不会产生可导入数据', async () => {
  const text = await encodeBackup({ checkins: [], exercises: [exercise()] }, { password: 'test-password' })
  await expect(decodeBackup(text, 'wrong-password')).rejects.toThrow('密码错误或文件已损坏')
  const corrupt = JSON.parse(text)
  corrupt.data = (corrupt.data[0] === 'A' ? 'B' : 'A') + corrupt.data.slice(1)
  await expect(decodeBackup(JSON.stringify(corrupt), 'test-password')).rejects.toThrow('密码错误或文件已损坏')
})

test('损坏格式和弱密码均有明确错误', async () => {
  await expect(decodeBackup('{')).rejects.toThrow('JSON')
  await expect(encodeBackup({ checkins: [], exercises: [] }, { password: '123' })).rejects.toThrow('至少 6 位')
  await expect(decodeBackup(JSON.stringify({ encrypted: true, kdf: 'unknown' }), 'password')).rejects.toThrow('加密格式')
})
