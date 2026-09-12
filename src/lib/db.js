import { validateCheckin, validateData, validateExercise } from './validation.js'

const DB_NAME = 'health-tracker'
const DB_VERSION = 1
let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    let blocked = false
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('checkins')) db.createObjectStore('checkins', { keyPath: 'date' })
      if (!db.objectStoreNames.contains('exercises')) {
        const store = db.createObjectStore('exercises', { keyPath: 'id', autoIncrement: true })
        store.createIndex('date', 'date', { unique: false })
      }
    }
    req.onblocked = () => {
      blocked = true
      reject(new Error('数据库被其他页面占用，请关闭其他应用标签页后重试'))
    }
    req.onsuccess = () => {
      const db = req.result
      if (blocked) { db.close(); return }
      db.onversionchange = () => { db.close(); dbPromise = null }
      db.onclose = () => { dbPromise = null }
      resolve(db)
    }
    req.onerror = () => reject(req.error || new Error('无法打开本地数据库'))
  }).catch((error) => { dbPromise = null; throw error })
  return dbPromise
}

/** 只在事务提交后返回；同步异常、请求失败均中止整个事务。 */
function transaction(names, mode, work) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(names, mode)
    let failure
    let result
    function abort(error) {
      failure = error
      try { tx.abort() } catch { reject(error) }
    }
    tx.oncomplete = () => resolve(result?.())
    tx.onerror = (event) => { if (!failure) failure = event.target.error || tx.error || new Error('本地数据库操作失败') }
    tx.onabort = () => reject(failure || tx.error || new Error('本地数据库事务被中止'))
    try { result = work(tx, abort) } catch (error) { abort(error) }
  }))
}

function request(store, mode, work) {
  return transaction(store, mode, (tx) => {
    const req = work(tx.objectStore(store))
    return () => req.result
  })
}

export const getAllCheckins = () => request('checkins', 'readonly', (store) => store.getAll())
export const getAllExercises = () => request('exercises', 'readonly', (store) => store.getAll())
export const deleteCheckin = (date) => request('checkins', 'readwrite', (store) => store.delete(date))
export const deleteExercise = (id) => request('exercises', 'readwrite', (store) => store.delete(id))
export async function putCheckin(entry) {
  const clean = validateCheckin(entry)
  return request('checkins', 'readwrite', (store) => store.put(clean))
}
export async function putExercise(entry) {
  const clean = validateExercise(entry)
  return request('exercises', 'readwrite', (store) => store.put(clean))
}

export function clearAll() {
  return transaction(['checkins', 'exercises'], 'readwrite', (tx) => {
    tx.objectStore('checkins').clear()
    tx.objectStore('exercises').clear()
  })
}

function fingerprint(item) {
  return JSON.stringify([item.date, item.type, item.duration, item.intensity, item.calories, item.note || ''])
}

export async function importAll(data, { mode = 'merge' } = {}) {
  const clean = validateData(data)
  if (!['merge', 'replace'].includes(mode)) throw new Error('请选择有效的恢复方式')
  return transaction(['checkins', 'exercises'], 'readwrite', (tx, abort) => {
    const checkins = tx.objectStore('checkins')
    const exercises = tx.objectStore('exercises')
    const counts = { checkins: 0, exercises: 0 }
    const addExercise = (item) => {
      const copy = { ...item }
      delete copy.id
      exercises.add(copy)
      counts.exercises++
    }
    if (mode === 'replace') {
      checkins.clear()
      exercises.clear()
      for (const item of clean.checkins) { checkins.put(item); counts.checkins++ }
      clean.exercises.forEach(addExercise)
    } else {
      const existingCheckins = checkins.getAll()
      existingCheckins.onsuccess = () => {
        try {
          const byDate = new Map(existingCheckins.result.map((item) => [item.date, item]))
          for (const item of clean.checkins) {
            const previous = byDate.get(item.date)
            if (!previous || item.updatedAt >= (previous.updatedAt || 0)) { checkins.put(item); counts.checkins++ }
          }
        } catch (error) { abort(error) }
      }
      const existingExercises = exercises.getAll()
      existingExercises.onsuccess = () => {
        try {
          // 按出现次数合并：重复导入不累加，同时保留备份中确有的两次相同运动。
          const remaining = new Map()
          for (const item of existingExercises.result) {
            const key = fingerprint(item)
            remaining.set(key, (remaining.get(key) || 0) + 1)
          }
          for (const item of clean.exercises) {
            const key = fingerprint(item)
            const count = remaining.get(key) || 0
            if (count) remaining.set(key, count - 1)
            else addExercise(item)
          }
        } catch (error) { abort(error) }
      }
    }
    return () => counts
  })
}
