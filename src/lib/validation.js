import { estimateCalories, EXERCISE_TYPES, todayKey } from './utils.js'

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}格式不正确`)
}

export function validateDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('日期格式不正确')
  const date = new Date(`${value}T12:00:00`)
  if (!Number.isFinite(date.getTime()) || todayKey(date) !== value) throw new Error('日期不存在')
  if (value > todayKey()) throw new Error('日期不能晚于今天')
  return value
}

function number(value, label, min, max, { coerce = false, fallback, integer = false } = {}) {
  if (value === null || value === undefined || value === '') {
    if (fallback !== undefined) return fallback
    throw new Error(`请填写${label}`)
  }
  if (coerce && typeof value === 'string' && value.trim()) value = Number(value)
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label}必须是有效数字`)
  if (value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`${label}须为 ${min}～${max} 之间的${integer ? '整数' : '数值'}`)
  }
  return value
}

function note(value = '') {
  if (typeof value !== 'string' || value.length > 200) throw new Error('备注须为不超过 200 字的文本')
  return value
}

export function validateCheckin(entry, { coerce = false } = {}) {
  record(entry, '打卡记录')
  const optional = { coerce, fallback: null }
  return {
    date: validateDate(entry.date),
    water: number(entry.water, '饮水量', 0, 10000, { coerce, fallback: 0 }),
    sleep: number(entry.sleep, '睡眠时长', 0, 24, optional),
    mood: number(coerce && entry.mood === 0 ? null : entry.mood, '心情', 1, 5, { ...optional, integer: true }),
    weight: number(entry.weight, '体重', 20, 300, optional),
    steps: number(entry.steps, '步数', 0, 200000, { ...optional, integer: true }),
    note: note(entry.note),
    updatedAt: number(entry.updatedAt, '更新时间', 0, Number.MAX_SAFE_INTEGER, { fallback: 0, integer: true })
  }
}

export function validateExercise(entry, { coerce = false, calculate = false, weight = 60 } = {}) {
  record(entry, '运动记录')
  const type = EXERCISE_TYPES.find((item) => item.name === entry.type)
  if (!type) throw new Error('运动类型不正确')
  const intensity = entry.intensity ?? '中'
  if (!['低', '中', '高'].includes(intensity)) throw new Error('运动强度不正确')
  const duration = number(entry.duration, '运动时长', 1, 1440, { coerce, integer: true })
  const clean = {
    date: validateDate(entry.date),
    type: type.name,
    duration,
    intensity,
    calories: calculate
      ? estimateCalories(type.met, number(weight, '体重', 20, 300, { coerce }), duration)
      : number(entry.calories, '热量', 0, 1000000),
    note: note(entry.note)
  }
  if (entry.id !== undefined) clean.id = number(entry.id, '记录编号', 1, Number.MAX_SAFE_INTEGER, { integer: true })
  return clean
}

/** 在开启写事务前生成只含合法字段的独立副本。 */
export function validateData(data) {
  record(data, '备份数据')
  if (!Array.isArray(data.checkins) || !Array.isArray(data.exercises)) throw new Error('备份必须包含打卡和运动记录数组')
  const checkins = data.checkins.map((entry) => validateCheckin(entry))
  const dates = new Set(checkins.map((entry) => entry.date))
  if (dates.size !== checkins.length) throw new Error('备份包含重复日期的打卡记录')
  return { checkins, exercises: data.exercises.map((entry) => validateExercise(entry)) }
}

export function validateBackup(payload) {
  record(payload, '备份文件')
  if (payload.version !== 1) throw new Error('不支持的备份版本')
  return validateData(payload.data)
}
