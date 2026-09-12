export const TODAY = '2026-09-12'
export const checkin = (overrides = {}) => ({
  date: TODAY, water: 1000, sleep: 7, mood: 4, weight: null, steps: null,
  note: '', updatedAt: 1000, ...overrides
})
export const exercise = (overrides = {}) => ({
  date: TODAY, type: '跑步', duration: 30, intensity: '中', calories: 294, note: '', ...overrides
})
export const backup = (data) => ({ version: 1, exportedAt: '2026-09-12T04:00:00.000Z', data })
