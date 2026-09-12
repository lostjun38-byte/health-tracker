<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { state, init } from '../stores/health.js'
import { clearAll, importAll } from '../lib/db.js'
import { encodeBackup, decodeBackup } from '../lib/backup.js'
import { todayKey } from '../lib/utils.js'

const recordCount = computed(() => `${state.checkins.length} 条打卡 · ${state.exercises.length} 条运动`)
const exportEncrypted = ref(false)
const exportPass = ref('')
const importPass = ref('')
const importMode = ref('merge')
const fileInput = ref(null)
const busy = ref(false)
const toast = ref('')
const toastError = ref(false)
const clearStep = ref(false)
let toastTimer
let clearTimer
let downloadTimer
let downloadUrl
function notify(message, error = false) {
  clearTimeout(toastTimer)
  toast.value = message
  toastError.value = error
  toastTimer = setTimeout(() => { toast.value = '' }, error ? 7000 : 4500)
}
function releaseDownload() {
  clearTimeout(downloadTimer)
  if (downloadUrl) URL.revokeObjectURL(downloadUrl)
  downloadUrl = null
}
function download(filename, text) {
  releaseDownload()
  downloadUrl = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  downloadTimer = setTimeout(releaseDownload, 1000)
}
async function doExport() {
  if (busy.value || !state.loaded) return
  busy.value = true
  try {
    const text = await encodeBackup({ checkins: state.checkins, exercises: state.exercises }, { password: exportEncrypted.value ? exportPass.value : null })
    download(`health-backup-${todayKey()}${exportEncrypted.value ? '-enc' : ''}.json`, text)
    notify(exportEncrypted.value ? '已导出加密备份' : '已导出 JSON 备份，请妥善保管')
  } catch (error) { notify('导出失败：' + error.message, true) }
  finally { busy.value = false }
}
async function onImportFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file || busy.value) return
  busy.value = true
  let committed = false
  try {
    const data = await decodeBackup(await file.text(), importPass.value)
    const action = importMode.value === 'replace'
      ? '覆盖恢复会替换当前全部记录'
      : '合并去重会保留较新的同日打卡，并合并相同运动的记录次数'
    if (!confirm(`${action}。备份包含 ${data.checkins.length} 条打卡、${data.exercises.length} 条运动，继续？`)) return
    await importAll(data, { mode: importMode.value })
    committed = true
    await init({ force: true })
    notify('恢复完成')
  } catch (error) {
    notify((committed ? '数据已恢复，但刷新失败，请重试读取：' : '导入失败，原数据未变更：') + error.message, true)
  } finally { busy.value = false }
}
async function doClear() {
  if (busy.value) return
  if (!clearStep.value) {
    clearStep.value = true
    clearTimer = setTimeout(() => { clearStep.value = false }, 5000)
    return
  }
  clearTimeout(clearTimer)
  clearStep.value = false
  if (!confirm('再次确认：将删除本机全部健康与运动数据，且无法恢复！')) return
  busy.value = true
  let committed = false
  try {
    await clearAll()
    committed = true
    await init({ force: true })
    notify('已清空所有本地数据')
  } catch (error) {
    notify((committed ? '已清空，但刷新失败，请重试读取：' : '清空失败：') + error.message, true)
  } finally { busy.value = false }
}
onBeforeUnmount(() => {
  clearTimeout(toastTimer)
  clearTimeout(clearTimer)
  releaseDownload()
})
</script>

<template>
  <div>
    <h1 class="page-title">隐私与数据</h1>
    <p class="page-sub">你的数据,只属于你</p>
    <div class="card privacy-card">
      <div class="card-title"><span>🛡️ 隐私说明</span></div>
      <ul class="privacy-list">
        <li>所有打卡与运动数据仅保存在<strong>本机浏览器</strong>中，不上传、不同步到任何服务器。</li>
        <li>应用<strong>没有后端、没有统计埋点</strong>，不会发送健康数据。</li>
        <li>清除浏览器站点数据会删除记录，建议定期使用下方“导出备份”。</li>
        <li>备份可选<strong>密码加密</strong>。密码不保存在备份中，忘记密码将无法恢复数据。</li>
      </ul>
    </div>
    <div class="card">
      <div class="card-title"><span>📦 导出备份</span><span class="muted">{{ recordCount }}</span></div>
      <label class="check-row"><input v-model="exportEncrypted" type="checkbox" :disabled="busy" />使用密码加密备份文件</label>
      <div v-if="exportEncrypted" class="field pass-field">
        <label for="export-password">加密密码 (至少 6 位，请务必牢记)</label>
        <input id="export-password" v-model="exportPass" type="password" placeholder="导出密码" autocomplete="new-password" :disabled="busy" />
      </div>
      <button class="btn" :disabled="busy || !state.loaded" @click="doExport">{{ busy ? '处理中…' : exportEncrypted ? '导出加密备份' : '导出 JSON 备份' }}</button>
    </div>
    <div class="card">
      <div class="card-title"><span>📥 导入备份</span></div>
      <div class="field pass-field">
        <label for="import-mode">恢复方式</label>
        <select id="import-mode" v-model="importMode" :disabled="busy">
          <option value="merge">合并去重（推荐）</option>
          <option value="replace">覆盖恢复（替换当前全部记录）</option>
        </select>
      </div>
      <p id="import-mode-hint" class="hint">{{ importMode === 'merge' ? '同日打卡保留更新时间较新的记录；相同运动按记录次数合并，重复导入不会累加。' : '使用备份替换当前全部数据。只有完整校验并恢复成功后，替换才会生效。' }}</p>
      <div class="field pass-field">
        <label for="import-password">解密密码 (仅导入加密备份时需要)</label>
        <input id="import-password" v-model="importPass" type="password" placeholder="备份加密时使用的密码" autocomplete="off" :disabled="busy" />
      </div>
      <button class="btn btn-ghost" :disabled="busy" aria-describedby="import-mode-hint" @click="fileInput?.click()">{{ busy ? '处理中…' : '选择备份文件…' }}</button>
      <input ref="fileInput" type="file" accept=".json,application/json" hidden :disabled="busy" @change="onImportFile" />
    </div>
    <div class="card danger-card">
      <div class="card-title"><span>🗑️ 清除全部数据</span></div>
      <p class="hint">将删除本机保存的所有打卡与运动记录，操作不可恢复。</p>
      <button class="btn btn-danger" :disabled="busy" @click="doClear">{{ clearStep ? '再点一次确认删除！' : '清除所有本地数据' }}</button>
    </div>
    <Transition name="fade">
      <div v-if="toast" class="toast" :class="{ 'toast-error': toastError }" :role="toastError ? 'alert' : 'status'">{{ toast }}</div>
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
