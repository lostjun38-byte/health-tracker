<script setup>
import { reactive, computed } from 'vue'
import { state, saveCheckin, streak, todayCheckin, todayExerciseSummary, latestWeight } from '../stores/health.js'
import { todayKey, weekdayLabel, fmtDuration, lastNDays } from '../lib/utils.js'
import StatCard from '../components/StatCard.vue'
import DailyQuote from '../components/DailyQuote.vue'

const MOODS = [
  { v: 1, e: '😣', t: '很差' },
  { v: 2, e: '😕', t: '偏差' },
  { v: 3, e: '😐', t: '一般' },
  { v: 4, e: '🙂', t: '不错' },
  { v: 5, e: '😄', t: '很好' }
]

const today = todayKey()
const dateLabel = computed(() => {
  const [y, m, d] = today.split('-')
  return `${y} 年 ${+m} 月 ${+d} 日 · 星期${weekdayLabel(today)}`
})

// 表单初值来自今日已有打卡,便于修改后重新保存
const form = reactive({
  water: todayCheckin.value?.water ?? 0,
  sleep: todayCheckin.value?.sleep ?? null,
  mood: todayCheckin.value?.mood ?? 0,
  weight: todayCheckin.value?.weight ?? null,
  steps: todayCheckin.value?.steps ?? null,
  note: todayCheckin.value?.note ?? ''
})

const saved = computed(() => !!todayCheckin.value)

async function submit() {
  if (!form.water && !form.sleep && !form.mood) return
  await saveCheckin({ date: today, ...form })
}

function addWater(ml) {
  form.water = Math.min(10000, (Number(form.water) || 0) + ml)
}

const week = computed(() => {
  const map = {}
  for (const c of state.checkins) map[c.date] = c
  return lastNDays(7).map((key) => ({
    key,
    done: !!map[key],
    isToday: key === today
  }))
})

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
      <StatCard icon="😴" label="今日睡眠" :value="form.sleep || '—'" unit="小时" />
      <StatCard
        icon="🏃"
        label="今日运动"
        :value="summary.minutes ? fmtDuration(summary.minutes) : '—'"
        :hint="summary.count ? summary.count + ' 次' : ''"
      />
    </div>

    <DailyQuote />

    <div class="card">
      <div class="card-title">
        <span>{{ saved ? '✅ 今日已打卡,可随时修改' : '📝 完成今日健康打卡' }}</span>
      </div>

      <div class="form-grid">
        <div class="field water-field">
          <label>💧 饮水量 (ml)</label>
          <div class="water-row">
            <button type="button" class="btn-ghost btn btn-sm" @click="addWater(-250)">−250</button>
            <input v-model.number="form.water" type="number" min="0" max="10000" step="50" />
            <button type="button" class="btn-ghost btn btn-sm" @click="addWater(250)">+250</button>
            <button type="button" class="btn-ghost btn btn-sm" @click="addWater(500)">+500</button>
          </div>
        </div>

        <div class="field">
          <label>😴 睡眠时长 (小时)</label>
          <input v-model.number="form.sleep" type="number" min="0" max="24" step="0.5" placeholder="如 7.5" />
        </div>

        <div class="field">
          <label>⚖️ 体重 (kg,选填)</label>
          <input v-model.number="form.weight" type="number" min="20" max="300" step="0.1" placeholder="如 62.5" />
        </div>

        <div class="field">
          <label>👟 步数 (选填)</label>
          <input v-model.number="form.steps" type="number" min="0" step="100" placeholder="如 8000" />
        </div>

        <div class="field mood-field">
          <label>😀 今日状态</label>
          <div class="mood-row">
            <button
              v-for="m in MOODS"
              :key="m.v"
              type="button"
              class="mood"
              :class="{ active: form.mood === m.v }"
              :title="m.t"
              @click="form.mood = m.v"
            >{{ m.e }}</button>
          </div>
        </div>

        <div class="field note-field">
          <label>🗒️ 备注 (选填)</label>
          <input v-model="form.note" type="text" maxlength="200" placeholder="今天的状态、心情等" />
        </div>
      </div>

      <div class="submit-row">
        <button class="btn" :disabled="!form.water && !form.sleep && !form.mood" @click="submit">
          {{ saved ? '更新打卡' : '保存打卡' }}
        </button>
        <span v-if="weight" class="weight-hint">最近体重 {{ weight.weight }} kg({{ weight.date.slice(5) }})</span>
      </div>
    </div>

    <div class="card">
      <div class="card-title"><span>最近 7 天</span></div>
      <div class="week-row">
        <div v-for="d in week" :key="d.key" class="week-day" :class="{ today: d.isToday }">
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
