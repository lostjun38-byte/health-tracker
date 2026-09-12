/**
 * IndexedDB 轻量封装:整个应用的唯一持久层。
 * 数据只写进浏览器本机的 IndexedDB,不产生任何网络请求。
 */
const DB_NAME = 'health-tracker'
const DB_VERSION = 1

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('checkins')) {
        // 健康打卡:一天一条,以日期为主键
        db.createObjectStore('checkins', { keyPath: 'date' })
      }
      if (!db.objectStoreNames.contains('exercises')) {
        const store = db.createObjectStore('exercises', {
          keyPath: 'id',
          autoIncrement: true
        })
        store.createIndex('date', 'date', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

/**
 * 执行一个事务,fn 返回 IDBRequest;事务提交后以 request.result 兑现。
 */
function tx(storeName, mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(storeName, mode)
        let result
        try {
          result = fn(t.objectStore(storeName))
        } catch (err) {
          reject(err)
          return
        }
        t.oncomplete = () => resolve(result?.result)
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error || new Error('事务被中止'))
      })
  )
}

/* ---------- 健康打卡(按日期存取) ---------- */

export const getAllCheckins = () => tx('checkins', 'readonly', (s) => s.getAll())

export const putCheckin = (entry) => tx('checkins', 'readwrite', (s) => s.put(entry))

export const deleteCheckin = (date) => tx('checkins', 'readwrite', (s) => s.delete(date))

/* ---------- 运动记录(自增主键) ---------- */

export const getAllExercises = () => tx('exercises', 'readonly', (s) => s.getAll())

export const putExercise = (entry) => tx('exercises', 'readwrite', (s) => s.put(entry))

export const deleteExercise = (id) => tx('exercises', 'readwrite', (s) => s.delete(id))

/* ---------- 全量操作(导入 / 清除) ---------- */

export function clearAll() {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(['checkins', 'exercises'], 'readwrite')
        t.objectStore('checkins').clear()
        t.objectStore('exercises').clear()
        t.oncomplete = resolve
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error || new Error('事务被中止'))
      })
  )
}

export function importAll({ checkins = [], exercises = [] }) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(['checkins', 'exercises'], 'readwrite')
        const c = t.objectStore('checkins')
        const e = t.objectStore('exercises')
        checkins.forEach((item) => c.put(item))
        exercises.forEach((item) => {
          // 导入时丢弃旧 id,让 IndexedDB 重新分配,避免主键冲突
          const { id, ...rest } = item
          e.put(rest)
        })
        t.oncomplete = resolve
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error || new Error('事务被中止'))
      })
  )
}
