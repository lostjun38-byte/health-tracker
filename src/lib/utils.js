/** 日期与数值的小工具,不依赖任何第三方库 */

export function todayKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(key, delta) {
  const [y, m, d] = key.split('-').map(Number)
  return todayKey(new Date(y, m - 1, d + delta))
}

/** 最近 n 天的日期主键数组,旧的在前 */
export function lastNDays(n, endKey = todayKey()) {
  const keys = []
  for (let i = n - 1; i >= 0; i--) keys.push(addDays(endKey, -i))
  return keys
}

export function weekdayLabel(key) {
  const [y, m, d] = key.split('-').map(Number)
  return '日一二三四五六'[new Date(y, m - 1, d).getDay()]
}

export function shortLabel(key) {
  return key.slice(5).replace('-', '/')
}

export function fmtDuration(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} 分钟`
  return m ? `${h} 小时 ${m} 分` : `${h} 小时`
}

/**
 * 根据运动类型与体重估算热量(MET 简化公式):
 * kcal ≈ MET × 体重(kg) × 时长(h)
 */
export function estimateCalories(met, weightKg, minutes) {
  return Math.round(met * weightKg * (minutes / 60))
}

export const EXERCISE_TYPES = [
  { name: '快走', met: 4.3, icon: '🚶' },
  { name: '跑步', met: 9.8, icon: '🏃' },
  { name: '骑行', met: 7.5, icon: '🚴' },
  { name: '游泳', met: 8.3, icon: '🏊' },
  { name: '力量训练', met: 6.0, icon: '🏋️' },
  { name: '瑜伽', met: 3.0, icon: '🧘' },
  { name: '球类', met: 6.5, icon: '🏀' },
  { name: '跳绳', met: 11.0, icon: '🤸' },
  { name: '其他', met: 4.0, icon: '🧗' }
]
