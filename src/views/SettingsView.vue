<script setup>
import { reactive, ref, computed } from 'vue'
import { state, init } from '../stores/health.js'
import { clearAll, importAll } from '../lib/db.js'

const EXPORT_VERSION = 1

/* ---------- 存储概况 ---------- */
const recordCount = computed(
  () => `${state.checkins.length} 条打卡 · ${state.exercises.length} 条运动`
)

/* ---------- 导出(可选加密) ---------- */
const exportEncrypted = ref(false)
const exportPass = ref('')
const busy = ref(false)
const toast = ref('')

function notify(msg) {
  toast.value = msg
  setTimeout(() => (toast.value = ''), 3500)
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** PBKDF2 + AES-GCM:密码不落盘,只用于本次加解密 */
async function deriveKey(password, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

async function doExport() {
  if (exportEncrypted.value && exportPass.value.length < 6) {
    notify('加密密码至少 6 位')
    return
  }
  busy.value = true
  try {
    const payload = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      data: { checkins: state.checkins, exercises: state.exercises }
    }
    if (!exportEncrypted.value) {
      download(`health-backup-${todayStr()}.json`, JSON.stringify(payload))
      notify('已导出明文 JSON,请妥善保管')
    } else {
      const salt = crypto.getRandomValues(new Uint8Array(16))
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const key = await deriveKey(exportPass.value, salt)
      const cipher = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(JSON.stringify(payload))
      )
      // 转成 base64 便于保存为文本文件
      const b64 = btoa(String.fromCharCode(...new Uint8Array(cipher)))
      download(
        `health-backup-${todayStr()}-enc.json`,
        JSON.stringify({ encrypted: true, kdf: 'PBKDF2-150k-SHA256', salt: toB64(salt), iv: toB64(iv), data: b64 })
      )
      notify('已导出加密备份')
    }
  } catch (err) {
    notify('导出失败:' + err.message)
  } finally {
    busy.value = false
  }
}

const toB64 = (bytes) => btoa(String.fromCharCode(...bytes))
const fromB64 = (s) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0))
const todayStr = () => new Date().toISOString().slice(0, 10)

/* ---------- 导入 ---------- */
const importPass = ref('')

async function onImportFile(ev) {
  const file = ev.target.files[0]
  ev.target.value = ''
  if (!file) return
  busy.value = true
  try {
    const text = await file.text()
    let payload = JSON.parse(text)
    if (payload.encrypted) {
      if (!importPass.value) {
        notify('这是加密备份,请先填写解密密码')
        return
      }
      const key = await deriveKey(importPass.value, fromB64(payload.salt))
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: fromB64(payload.iv) },
        key,
        fromB64(payload.data)
      )
      payload = JSON.parse(new TextDecoder().decode(plain))
    }
    const { checkins = [], exercises = [] } = payload.data || {}
    if (!Array.isArray(checkins) && !Array.isArray(exercises)) {
      notify('文件格式不正确')
      return
    }
    if (!confirm(`将导入 ${checkins.length} 条打卡、${exercises.length} 条运动记录(同名数据会被覆盖),继续?`)) return
    await importAll({ checkins, exercises })
    state.loaded = false
    await init()
    notify('导入完成')
  } catch (err) {
    notify('导入失败:' + (err.name === 'OperationError' ? '密码错误或文件已损坏' : err.message))
  } finally {
    busy.value = false
  }
}

/* ---------- 清除 ---------- */
const confirmText = reactive({ step1: false })

async function doClear() {
  if (!confirmText.step1) {
    confirmText.step1 = true
    setTimeout(() => (confirmText.step1 = false), 5000)
    return
  }
  if (confirm('再次确认:将删除本机全部健康与运动数据,且无法恢复!')) {
    await clearAll()
    state.loaded = false
    await init()
    notify('已清空所有本地数据')
  }
  confirmText.step1 = false
}
</script>

<template>
  <div>
    <h1 class="page-title">隐私与数据</h1>
    <p class="page-sub">你的数据,只属于你</p>

    <div class="card privacy-card">
      <div class="card-title"><span>🛡️ 隐私说明</span></div>
      <ul class="privacy-list">
        <li>所有打卡与运动数据仅保存在<strong>本机浏览器的 IndexedDB</strong> 中,不上传、不同步到任何服务器。</li>
        <li>应用<strong>没有后端、没有统计埋点、没有第三方脚本</strong>,页面加载后不会发出任何网络请求。</li>
        <li>清除浏览器站点数据会删除记录,建议定期使用下方"导出备份"。</li>
        <li>导出备份时可选 <strong>AES-256-GCM 加密</strong>,密码基于 PBKDF2(15 万次迭代)派生,密码本身不保存在文件中,忘记密码将无法恢复数据。</li>
      </ul>
    </div>

    <div class="card">
      <div class="card-title"><span>📦 导出备份</span>
        <span class="muted">{{ recordCount }}</span>
      </div>
      <label class="check-row">
        <input v-model="exportEncrypted" type="checkbox" />
        使用密码加密备份文件
      </label>
      <div v-if="exportEncrypted" class="field pass-field">
        <label>加密密码(至少 6 位,请务必牢记)</label>
        <input v-model="exportPass" type="password" placeholder="导出密码" autocomplete="new-password" />
      </div>
      <button class="btn" :disabled="busy" @click="doExport">
        {{ exportEncrypted ? '导出加密备份' : '导出 JSON 备份' }}
      </button>
    </div>

    <div class="card">
      <div class="card-title"><span>📥 导入备份</span></div>
      <div class="field pass-field">
        <label>解密密码(仅导入加密备份时需要)</label>
        <input v-model="importPass" type="password" placeholder="备份加密时使用的密码" autocomplete="off" />
      </div>
      <label class="btn btn-ghost file-btn" :class="{ disabled: busy }">
        选择备份文件…
        <input type="file" accept=".json,application/json" hidden @change="onImportFile" />
      </label>
      <p class="hint">导入时同名日期的打卡会被覆盖,运动记录主键会重新分配。</p>
    </div>

    <div class="card danger-card">
      <div class="card-title"><span>🗑️ 清除全部数据</span></div>
      <p class="hint">将删除本机保存的所有打卡与运动记录,操作不可恢复。</p>
      <button class="btn btn-danger" :disabled="busy" @click="doClear">
        {{ confirmText.step1 ? '再点一次确认删除!' : '清除所有本地数据' }}
      </button>
    </div>

    <Transition name="fade">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.privacy-card { border-left: 4px solid var(--brand); }
.privacy-list {
  margin: 0;
  padding-left: 18px;
  color: var(--ink-soft);
  display: flex;
  flex-direction: column;
  gap: 9px;
  font-size: 14px;
}
.privacy-list strong { color: var(--ink); }

.check-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: var(--ink-soft);
  cursor: pointer;
}
.check-row input { accent-color: var(--brand); width: 16px; height: 16px; }

.pass-field { max-width: 340px; margin-bottom: 14px; }

.muted { font-size: 12.5px; color: var(--ink-faint); font-weight: 400; }

.file-btn { display: inline-block; }
.file-btn.disabled { opacity: 0.5; pointer-events: none; }

.hint { font-size: 12.5px; color: var(--ink-faint); margin: 10px 0; }

.danger-card { border-left: 4px solid var(--danger); }

.toast {
  position: fixed;
  bottom: 84px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--ink);
  color: #fff;
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 13.5px;
  box-shadow: var(--shadow);
  z-index: 50;
}
@media (min-width: 721px) {
  .toast { bottom: 36px; }
}
</style>
