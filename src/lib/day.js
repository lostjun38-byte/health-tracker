import { ref } from 'vue'
import { todayKey } from './utils.js'

export const currentDay = ref(todayKey())

export function refreshDay() {
  currentDay.value = todayKey()
}

/** 跨零点、浏览器恢复前台或时区变化后，刷新所有页面共享的日期。 */
export function startDayClock() {
  let timer
  function schedule() {
    clearTimeout(timer)
    refreshDay()
    const now = new Date()
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    timer = setTimeout(schedule, midnight.getTime() - now.getTime() + 50)
  }
  function onVisible() {
    if (!document.hidden) schedule()
  }
  schedule()
  window.addEventListener('focus', schedule)
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    clearTimeout(timer)
    window.removeEventListener('focus', schedule)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
