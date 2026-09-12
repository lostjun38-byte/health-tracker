<script setup>
import { reactive, ref, computed } from 'vue'
import { state, addExercise, updateExercise, removeExercise, latestWeight } from '../stores/health.js'
import { EXERCISE_TYPES, estimateCalories, fmtDuration, todayKey, weekdayLabel } from '../lib/utils.js'

const typeMeta = (name) => EXERCISE_TYPES.find((t) => t.name === name) || EXERCISE_TYPES[0]

const defaultForm = () => ({
  date: todayKey(),
  type: '快走',
  duration: 30,
  intensity: '中',
  note: ''
})

const form = reactive(defaultForm())
const editingId = ref(null) // null = 新增;数字 = 编辑某条
const showForm = ref(false)

const estimate = computed(() =>
  estimateCalories(typeMeta(form.type).met, latestWeight.value?.weight || 60, form.duration || 0)
)

function openNew() {
  Object.assign(form, defaultForm())
  editingId.value = null
  showForm.value = true
}

function openEdit(item) {
  Object.assign(form, {
    date: item.date,
    type: item.type,
    duration: item.duration,
    intensity: item.intensity,
    note: item.note
  })
  editingId.value = item.id
  showForm.value = true
}

async function submit() {
  if (!form.duration || form.duration < 1) return
  if (editingId.value === null) await addExercise({ ...form })
  else await updateExercise(editingId.value, { ...form })
  showForm.value = false
}

function cancel() {
  showForm.value = false
}

async function del(item) {
  if (confirm(`删除 ${item.date} 的「${item.type}」记录?`)) {
    await removeExercise(item.id)
  }
}

/* 筛选 + 分页渲染:记录再多也只渲染 PAGE 条,滚动加载 */
const PAGE = 20
const filterType = ref('全部')
const shown = ref(PAGE)

const filtered = computed(() =>
  filterType.value === '全部'
    ? state.exercises
    : state.exercises.filter((e) => e.type === filterType.value)
)

const visible = computed(() => filtered.value.slice(0, shown.value))

const totalSummary = computed(() => {
  let minutes = 0
  let calories = 0
  for (const e of filtered.value) {
    minutes += e.duration
    calories += e.calories
  }
  return { minutes, calories, count: filtered.value.length }
})

function labelOf(key) {
  return `${key.slice(5).replace('-', '/')} 周${weekdayLabel(key)}`
}
</script>

<template>
  <div>
    <h1 class="page-title">运动记录</h1>
    <p class="page-sub">共 {{ totalSummary.count }} 次 · {{ fmtDuration(totalSummary.minutes) }} · 约 {{ totalSummary.calories }} 千卡</p>

    <div class="card" v-if="showForm">
      <div class="card-title">
        <span>{{ editingId === null ? '➕ 新增运动' : '✏️ 编辑运动' }}</span>
      </div>
      <div class="form-grid">
        <div class="field">
          <label>日期</label>
          <input v-model="form.date" type="date" :max="todayKey()" />
        </div>
        <div class="field">
          <label>运动类型</label>
          <select v-model="form.type">
            <option v-for="t in EXERCISE_TYPES" :key="t.name" :value="t.name">{{ t.icon }} {{ t.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>时长 (分钟)</label>
          <input v-model.number="form.duration" type="number" min="1" max="1440" step="5" />
        </div>
        <div class="field">
          <label>强度</label>
          <div class="seg">
            <button
              v-for="i in ['低', '中', '高']"
              :key="i"
              type="button"
              class="seg-btn"
              :class="{ active: form.intensity === i }"
              @click="form.intensity = i"
            >{{ i }}</button>
          </div>
        </div>
        <div class="field note-field">
          <label>备注 (选填)</label>
          <input v-model="form.note" type="text" maxlength="200" placeholder="地点、感受、搭档等" />
        </div>
      </div>
      <div class="submit-row">
        <button class="btn" @click="submit">保存</button>
        <button class="btn btn-ghost" @click="cancel">取消</button>
        <span class="est-hint">预计消耗 ≈ {{ estimate }} 千卡</span>
      </div>
    </div>

    <div class="toolbar" v-else>
      <select v-model="filterType" class="filter-select">
        <option>全部</option>
        <option v-for="t in EXERCISE_TYPES" :key="t.name" :value="t.name">{{ t.name }}</option>
      </select>
      <button class="btn" @click="openNew">➕ 记录一次运动</button>
    </div>

    <div class="card" style="padding: 6px 0">
      <div v-if="!visible.length" class="empty">
        {{ state.loaded ? '还没有运动记录,点击上方按钮开始吧' : '加载中…' }}
      </div>
      <TransitionGroup name="list" tag="div">
        <div v-for="item in visible" :key="item.id" class="record">
          <div class="rec-icon" :style="{ background: 'var(--brand-soft)' }">{{ typeMeta(item.type).icon }}</div>
          <div class="rec-main">
            <div class="rec-top">
              <strong>{{ item.type }}</strong>
              <span class="chip" :class="item.intensity">{{ item.intensity }}强度</span>
            </div>
            <div class="rec-sub">
              {{ labelOf(item.date) }} · {{ fmtDuration(item.duration) }} · ≈{{ item.calories }} 千卡
              <span v-if="item.note" class="rec-note">「{{ item.note }}」</span>
            </div>
          </div>
          <div class="rec-actions">
            <button class="btn btn-ghost btn-sm" @click="openEdit(item)">编辑</button>
            <button class="btn btn-danger btn-sm" @click="del(item)">删除</button>
          </div>
        </div>
      </TransitionGroup>
      <div v-if="filtered.length > shown" class="more-row">
        <button class="btn btn-ghost btn-sm" @click="shown += PAGE">
          加载更多(还有 {{ filtered.length - shown }} 条)
        </button>
      </div>
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
