<script setup>
import { reactive, ref, computed, watch } from 'vue'
import { state, saveCheckin, streak, todayCheckin, todayExerciseSummary, latestWeight, checkinMap } from '../stores/health.js'
import { weekdayLabel, fmtDuration, lastNDays } from '../lib/utils.js'
import { currentDay, refreshDay } from '../lib/day.js'
import StatCard from '../components/StatCard.vue'
import DailyQuote from '../components/DailyQuote.vue'

const MOODS = [
  { v: 1, e: '😣', t: '很差' }, { v: 2, e: '😕', t: '偏差' },
  { v: 3, e: '😐', t: '一般' }, { v: 4, e: '🙂', t: '不错' }, { v: 5, e: '😄', t: '很好' }
]
const valuesOf = (entry) => ({
  water: entry?.water ?? 0, sleep: entry?.sleep ?? null, mood: entry?.mood ?? null,
  weight: entry?.weight ?? null, steps: entry?.steps ?? null, note: entry?.note ?? ''
})
const form = reactive(valuesOf(todayCheckin.value))
const baseline = ref(JSON.stringify(form))
const formDay = ref(currentDay.value)
const previousDrafts = ref([])
const saving = ref(false)
const feedback = ref({ text: '', error: false })
const dirty = computed(() => JSON.stringify(form) !== baseline.value)
const filled = (value) => value !== null && value !== undefined && value !== ''
const hasEntry = computed(() => Number(form.water) > 0 || ['sleep', 'mood', 'weight', 'steps'].some((key) => filled(form[key])) || !!form.note.trim())
const saved = computed(() => !!todayCheckin.value)
const dateLabel = computed(() => {
  const [y, m, d] = currentDay.value.split('-')
  return `${y} 年 ${+m} 月 ${+d} 日 · 星期${weekdayLabel(currentDay.value)}`
})

function loadForm(entry) {
  Object.assign(form, valuesOf(entry))
  baseline.value = JSON.stringify(form)
}
watch(currentDay, (day) => {
  if (dirty.value && hasEntry.value) {
    const draft = { date: formDay.value, ...form }
    const index = previousDrafts.value.findIndex((item) => item.date === draft.date)
    if (index < 0) previousDrafts.value.push(draft)
    else previousDrafts.value[index] = draft
  }
  formDay.value = day
  loadForm(checkinMap.value[day])
  feedback.value = { text: '日期已更新，请填写今天的打卡。', error: false }
}, { flush: 'sync' })
watch(todayCheckin, (entry) => { if (!dirty.value) loadForm(entry) })

async function submit() {
  if (saving.value || !state.loaded) return
  refreshDay()
  if (!hasEntry.value) return
  const entry = { date: formDay.value, ...form }
  saving.value = true
  feedback.value = { text: '', error: false }
  try {
    const clean = await saveCheckin(entry)
    if (formDay.value === clean.date) loadForm(clean)
    previousDrafts.value = previousDrafts.value.filter((draft) => draft.date !== clean.date || JSON.stringify(valuesOf(draft)) !== JSON.stringify(valuesOf(entry)))
    feedback.value = { text: `${clean.date} 的打卡已保存`, error: false }
  } catch (error) {
    feedback.value = { text: '保存失败：' + (error?.message || '请重试'), error: true }
  } finally { saving.value = false }
}

async function saveDraft(draft) {
  if (saving.value || !state.loaded) return
  saving.value = true
  try {
    await saveCheckin({ ...draft })
    previousDrafts.value = previousDrafts.value.filter((item) => item !== draft)
    feedback.value = { text: '已补存前一天的草稿', error: false }
  } catch (error) {
    feedback.value = { text: '草稿保存失败：' + (error?.message || '请重试'), error: true }
  } finally { saving.value = false }
}
function addWater(ml) {
  form.water = Math.max(0, Math.min(10000, (Number(form.water) || 0) + ml))
}
const week = computed(() => lastNDays(7, currentDay.value).map((key) => ({
  key, done: !!checkinMap.value[key], isToday: key === currentDay.value
})))
const summary = todayExerciseSummary
const weight = latestWeight
</script>

<template>
  <div>
    <h1 class="page-title">今日打卡</h1>
    <p class="page-sub">{{ dateLabel }}</p>
    <div class="stat-grid">
      <StatCard icon="🔥" label="连续打卡" :value="streak" unit="天" />
      <StatCard icon="💧" label="今日饮水" :value="form.water || 0" unit="ml" />
      <StatCard icon="😴" label="今日睡眠" :value="form.sleep ?? '—'" unit="小时" />
      <StatCard icon="🏃" label="今日运动" :value="summary.minutes ? fmtDuration(summary.minutes) : '—'" :hint="summary.count ? summary.count + ' 次' : ''" />
    </div>
    <DailyQuote />
    <div v-for="draft in previousDrafts" :key="draft.date" class="card draft-notice" role="status">
      <p>{{ draft.date }} 的未保存草稿已保留。今天的打卡请填写下方表单。</p>
      <div class="submit-row">
        <button class="btn btn-sm" :disabled="saving || !state.loaded" @click="saveDraft(draft)">补存这份草稿</button>
        <button class="btn btn-ghost btn-sm" :disabled="saving" @click="previousDrafts = previousDrafts.filter(item => item.date !== draft.date)">放弃草稿</button>
      </div>
    </div>
    <form class="card" @submit.prevent="submit">
      <div class="card-title"><span>{{ saved ? '✅ 今日已打卡,可随时修改' : '📝 完成今日健康打卡' }}</span></div>
      <fieldset class="form-grid form-fields" :disabled="saving || !state.loaded">
        <legend class="sr-only">今日健康记录</legend>
        <div class="field water-field">
          <label for="checkin-water">💧 饮水量 (ml)</label>
          <div class="water-row">
            <button type="button" class="btn-ghost btn btn-sm" aria-label="减少 250 毫升饮水" @click="addWater(-250)">−250</button>
            <input id="checkin-water" v-model.number="form.water" type="number" min="0" max="10000" step="1" />
            <button type="button" class="btn-ghost btn btn-sm" aria-label="增加 250 毫升饮水" @click="addWater(250)">+250</button>
            <button type="button" class="btn-ghost btn btn-sm" aria-label="增加 500 毫升饮水" @click="addWater(500)">+500</button>
          </div>
        </div>
        <div class="field">
          <label for="checkin-sleep">😴 睡眠时长 (小时)</label>
          <input id="checkin-sleep" v-model.number="form.sleep" type="number" min="0" max="24" step="0.1" placeholder="如 7.5" />
        </div>
        <div class="field">
          <label for="checkin-weight">⚖️ 体重 (kg,选填)</label>
          <input id="checkin-weight" v-model.number="form.weight" type="number" min="20" max="300" step="0.1" placeholder="如 62.5" />
        </div>
        <div class="field">
          <label for="checkin-steps">👟 步数 (选填)</label>
          <input id="checkin-steps" v-model.number="form.steps" type="number" min="0" max="200000" step="1" placeholder="如 8000" />
        </div>
        <div class="field mood-field">
          <span id="mood-label" class="field-label">😀 今日状态 (选填)</span>
          <div class="mood-row" role="group" aria-labelledby="mood-label">
            <button v-for="m in MOODS" :key="m.v" type="button" class="mood" :class="{ active: form.mood === m.v }" :title="m.t" :aria-label="m.t" :aria-pressed="form.mood === m.v" @click="form.mood = form.mood === m.v ? null : m.v">{{ m.e }}</button>
          </div>
        </div>
        <div class="field note-field">
          <label for="checkin-note">🗒️ 备注 (选填)</label>
          <input id="checkin-note" v-model="form.note" type="text" maxlength="200" placeholder="今天的状态、心情等" />
        </div>
      </fieldset>
      <div class="submit-row">
        <button type="submit" class="btn" :disabled="saving || !state.loaded || !hasEntry">{{ saving ? '保存中…' : saved ? '更新打卡' : '保存打卡' }}</button>
        <span v-if="dirty" class="weight-hint">有未保存的修改</span>
        <span v-else-if="weight" class="weight-hint">最近体重 {{ weight.weight }} kg({{ weight.date.slice(5) }})</span>
      </div>
      <p class="feedback" :class="{ 'feedback-error': feedback.error }" :role="feedback.error ? 'alert' : 'status'">{{ feedback.text }}</p>
    </form>
    <div class="card">
      <div class="card-title"><span>最近 7 天</span></div>
      <div class="week-row">
        <div v-for="d in week" :key="d.key" class="week-day" :class="{ today: d.isToday }" :aria-label="`${d.key} ${d.done ? '已打卡' : '未打卡'}`">
          <span class="dot" :class="{ on: d.done }">{{ d.done ? '✓' : '' }}</span>
          <span class="wd">周{{ weekdayLabel(d.key) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px 18px;
}
.water-field, .mood-field, .note-field { grid-column: 1 / -1; }

.water-row { display: flex; gap: 6px; align-items: center; }
.water-row input { flex: 1; min-width: 0; }

.mood-row { display: flex; gap: 8px; }
.mood {
  position: relative;
  overflow: hidden;
  flex: 1;
  min-width: 0;
  font-size: 24px;
  height: 44px;
  border-radius: 11px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.55);
  filter: grayscale(0.7);
  opacity: 0.65;
  transition: all 0.2s var(--ease-spring);
}
.mood:hover {
  filter: none;
  opacity: 1;
  transform: translateY(-3px) scale(1.06);
  background: rgba(255, 255, 255, 0.9);
}
.mood.active {
  filter: none;
  opacity: 1;
  border-color: var(--brand);
  background: var(--brand-soft);
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(15, 157, 118, 0.22);
}

.submit-row {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 18px;
}
.submit-row .btn:disabled { opacity: 0.45; cursor: not-allowed; }
.weight-hint { font-size: 12.5px; color: var(--ink-faint); }

.week-row {
  display: flex;
  justify-content: space-around;
  gap: 6px;
}
.week-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--ink-soft);
}
.week-day.today .wd { color: var(--brand-deep); font-weight: 650; }
.dot {
  width: clamp(20px, 8.5vw, 32px);
  aspect-ratio: 1;
  border-radius: 50%;
  border: 1.5px dashed var(--line);
  display: grid;
  place-items: center;
  font-size: 14px;
  color: #fff;
}
.dot.on {
  background: var(--brand-grad);
  border: none;
  box-shadow: 0 3px 10px rgba(13, 143, 104, 0.35);
}
.week-day.today .dot { animation: dot-glow 2.2s ease-out infinite; }
@keyframes dot-glow {
  0% { box-shadow: 0 0 0 0 rgba(15, 157, 118, 0.45); }
  70% { box-shadow: 0 0 0 10px rgba(15, 157, 118, 0); }
  100% { box-shadow: 0 0 0 0 rgba(15, 157, 118, 0); }
}
.dot { transition: transform 0.2s var(--ease-spring); }
.week-day:hover .dot { transform: scale(1.15); }

@media (max-width: 720px) {
  .mood { height: 40px; font-size: 21px; }
}
</style>
