<script setup>
import { reactive, ref, computed, watch } from 'vue'
import { state, addExercise, updateExercise, removeExercise, weightAtDate } from '../stores/health.js'
import { EXERCISE_TYPES, estimateCalories, fmtDuration, weekdayLabel } from '../lib/utils.js'
import { currentDay, refreshDay } from '../lib/day.js'

const typeMeta = (name) => EXERCISE_TYPES.find((type) => type.name === name) || EXERCISE_TYPES[0]
const defaultForm = () => ({ date: currentDay.value, type: '快走', duration: 30, intensity: '中', note: '' })
const form = reactive(defaultForm())
const editingId = ref(null)
const showForm = ref(false)
const busy = ref(false)
const feedback = ref({ text: '', error: false })
const estimate = computed(() => {
  const duration = Number(form.duration)
  if (!Number.isInteger(duration) || duration < 1 || duration > 1440) return null
  return estimateCalories(typeMeta(form.type).met, weightAtDate(form.date), duration)
})
function openNew() {
  refreshDay()
  Object.assign(form, defaultForm())
  editingId.value = null
  showForm.value = true
  feedback.value = { text: '', error: false }
}
function openEdit(item) {
  Object.assign(form, { date: item.date, type: item.type, duration: item.duration, intensity: item.intensity, note: item.note })
  editingId.value = item.id
  showForm.value = true
  feedback.value = { text: '', error: false }
}
async function submit() {
  if (busy.value || !state.loaded) return
  busy.value = true
  try {
    if (editingId.value === null) await addExercise({ ...form })
    else await updateExercise(editingId.value, { ...form })
    showForm.value = false
    feedback.value = { text: '运动记录已保存', error: false }
  } catch (error) {
    feedback.value = { text: '保存失败：' + (error?.message || '请重试'), error: true }
  } finally { busy.value = false }
}
async function del(item) {
  if (busy.value || !confirm(`删除 ${item.date} 的「${item.type}」记录？`)) return
  busy.value = true
  try {
    await removeExercise(item.id)
    feedback.value = { text: '运动记录已删除', error: false }
  } catch (error) {
    feedback.value = { text: '删除失败：' + (error?.message || '请重试'), error: true }
  } finally { busy.value = false }
}
const PAGE = 20
const filterType = ref('全部')
const shown = ref(PAGE)
watch(filterType, () => { shown.value = PAGE })
const filtered = computed(() => filterType.value === '全部' ? state.exercises : state.exercises.filter((entry) => entry.type === filterType.value))
const visible = computed(() => filtered.value.slice(0, shown.value))
const totalSummary = computed(() => filtered.value.reduce((sum, entry) => ({
  minutes: sum.minutes + entry.duration, calories: sum.calories + entry.calories, count: sum.count + 1
}), { minutes: 0, calories: 0, count: 0 }))
const labelOf = (key) => `${key.slice(5).replace('-', '/')} 周${weekdayLabel(key)}`
</script>

<template>
  <div>
    <h1 class="page-title">运动记录</h1>
    <p class="page-sub">共 {{ totalSummary.count }} 次 · {{ fmtDuration(totalSummary.minutes) }} · 约 {{ totalSummary.calories }} 千卡</p>
    <p class="feedback" :class="{ 'feedback-error': feedback.error }" :role="feedback.error ? 'alert' : 'status'">{{ feedback.text }}</p>
    <form v-if="showForm" class="card" @submit.prevent="submit">
      <div class="card-title"><span>{{ editingId === null ? '➕ 新增运动' : '✏️ 编辑运动' }}</span></div>
      <fieldset class="form-grid form-fields" :disabled="busy || !state.loaded">
        <legend class="sr-only">运动详情</legend>
        <div class="field">
          <label for="exercise-date">日期</label>
          <input id="exercise-date" v-model="form.date" type="date" :max="currentDay" required />
        </div>
        <div class="field">
          <label for="exercise-type">运动类型</label>
          <select id="exercise-type" v-model="form.type">
            <option v-for="type in EXERCISE_TYPES" :key="type.name" :value="type.name">{{ type.icon }} {{ type.name }}</option>
          </select>
        </div>
        <div class="field">
          <label for="exercise-duration">时长 (分钟)</label>
          <input id="exercise-duration" v-model.number="form.duration" type="number" min="1" max="1440" step="1" required />
        </div>
        <div class="field">
          <span id="intensity-label" class="field-label">强度</span>
          <div class="seg" role="group" aria-labelledby="intensity-label">
            <button v-for="intensity in ['低', '中', '高']" :key="intensity" type="button" class="seg-btn" :class="{ active: form.intensity === intensity }" :aria-pressed="form.intensity === intensity" @click="form.intensity = intensity">{{ intensity }}</button>
          </div>
        </div>
        <div class="field note-field">
          <label for="exercise-note">备注 (选填)</label>
          <input id="exercise-note" v-model="form.note" type="text" maxlength="200" placeholder="地点、感受、搭档等" />
        </div>
      </fieldset>
      <div class="submit-row">
        <button type="submit" class="btn" :disabled="busy || !state.loaded">{{ busy ? '保存中…' : '保存' }}</button>
        <button type="button" class="btn btn-ghost" :disabled="busy" @click="showForm = false">取消</button>
        <span class="est-hint">预计消耗 ≈ {{ estimate ?? '—' }} 千卡</span>
      </div>
    </form>
    <div v-else class="toolbar">
      <select v-model="filterType" class="filter-select" aria-label="筛选运动类型">
        <option>全部</option>
        <option v-for="type in EXERCISE_TYPES" :key="type.name" :value="type.name">{{ type.name }}</option>
      </select>
      <button class="btn" :disabled="busy || !state.loaded" @click="openNew">➕ 记录一次运动</button>
    </div>
    <div class="card" style="padding: 6px 0">
      <div v-if="!visible.length" class="empty">{{ state.loaded ? '还没有运动记录，点击上方按钮开始吧' : '等待本地数据加载…' }}</div>
      <TransitionGroup name="list" tag="div">
        <div v-for="item in visible" :key="item.id" class="record">
          <div class="rec-icon" :style="{ background: 'var(--brand-soft)' }">{{ typeMeta(item.type).icon }}</div>
          <div class="rec-main">
            <div class="rec-top"><strong>{{ item.type }}</strong><span class="chip" :class="item.intensity">{{ item.intensity }}强度</span></div>
            <div class="rec-sub">{{ labelOf(item.date) }} · {{ fmtDuration(item.duration) }} · ≈{{ item.calories }} 千卡<span v-if="item.note" class="rec-note">「{{ item.note }}」</span></div>
          </div>
          <div class="rec-actions">
            <button class="btn btn-ghost btn-sm" :disabled="busy || !state.loaded" @click="openEdit(item)">编辑</button>
            <button class="btn btn-danger btn-sm" :disabled="busy || !state.loaded" @click="del(item)">删除</button>
          </div>
        </div>
      </TransitionGroup>
      <div v-if="filtered.length > shown" class="more-row"><button class="btn btn-ghost btn-sm" @click="shown += PAGE">加载更多(还有 {{ filtered.length - shown }} 条)</button></div>
    </div>
  </div>
</template>

<style scoped>
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 14px 18px;
}
.note-field { grid-column: 1 / -1; }

.seg { display: flex; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
.seg-btn {
  position: relative;
  overflow: hidden;
  flex: 1;
  border: none;
  background: rgba(255, 255, 255, 0.55);
  padding: 8px 0;
  color: var(--ink-soft);
  transition: background 0.2s, color 0.2s;
}
.seg-btn:hover { background: rgba(255, 255, 255, 0.85); }
.seg-btn + .seg-btn { border-left: 1px solid var(--line); }
.seg-btn.active {
  background: var(--brand-grad);
  color: #fff;
  font-weight: 650;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
}

.submit-row { display: flex; align-items: center; gap: 10px; margin-top: 16px; }
.est-hint { font-size: 12.5px; color: var(--ink-faint); }

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.filter-select {
  border: 1px solid var(--line);
  border-radius: 9px;
  padding: 7px 10px;
  background: #fff;
}

.record {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 13px 20px;
  border-bottom: 1px solid var(--line-soft);
  transition: background 0.2s, transform 0.2s;
}
.record:hover { background: rgba(255, 255, 255, 0.55); }
.record:hover .rec-icon { transform: scale(1.12) rotate(-8deg); }
.record:hover { transform: translateX(3px); }
.record:last-of-type { border-bottom: none; }
.rec-icon {
  transition: transform 0.25s var(--ease-spring);
  width: 42px;
  height: 42px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  font-size: 20px;
  flex-shrink: 0;
}
.rec-main { flex: 1; min-width: 0; }
.rec-top { display: flex; align-items: center; gap: 8px; }
.rec-sub { font-size: 12.5px; color: var(--ink-soft); margin-top: 2px; }
.rec-note { color: var(--ink-faint); }
.chip {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 20px;
  background: #eef3f1;
  color: var(--ink-soft);
}
.chip.高 { background: #fdece4; color: #b05a20; }
.chip.低 { background: #e8f1fa; color: #3f6a96; }
.rec-actions { display: flex; gap: 6px; flex-shrink: 0; }
.more-row { text-align: center; padding: 12px 0 14px; }

.list-enter-active, .list-leave-active { transition: all 0.2s; }
.list-enter-from, .list-leave-to { opacity: 0; transform: translateY(-6px); }

@media (max-width: 560px) {
  .rec-actions { flex-direction: column; gap: 4px; }
  .toolbar { flex-direction: column; align-items: stretch; }
}
</style>
