<script setup>
import { ref, computed } from 'vue'
import { state, checkinMap } from '../stores/health.js'
import { lastNDays, fmtDuration, shortLabel } from '../lib/utils.js'
import BarChart from '../components/BarChart.vue'
import DonutChart from '../components/DonutChart.vue'

const range = ref(7) // 7 或 30 天

const keys = computed(() => lastNDays(range.value))
const map = computed(() => checkinMap.value)

const waterData = computed(() =>
  keys.value.map((key) => ({ key, value: map.value[key]?.water || 0 }))
)

const sleepData = computed(() =>
  keys.value.map((key) => ({ key, value: map.value[key]?.sleep || 0 }))
)

const exerciseData = computed(() => {
  const byDay = {}
  for (const e of state.exercises) {
    if (e.date < keys.value[0]) break
    byDay[e.date] = (byDay[e.date] || 0) + e.duration
  }
  return keys.value.map((key) => ({ key, value: byDay[key] || 0 }))
})

const typeDist = computed(() => {
  const counts = {}
  const from = keys.value[0]
  const palette = ['#0f9d76', '#3f6a96', '#e07a3f', '#8e6bb5', '#d4574e', '#2f9e44', '#c2a11c', '#5c7f8a', '#999']
  let ci = 0
  for (const e of state.exercises) {
    if (e.date < from) break
    if (!counts[e.type]) counts[e.type] = { label: e.type, value: 0, color: palette[ci++ % palette.length] }
    counts[e.type].value++
  }
  return Object.values(counts).sort((a, b) => b.value - a.value)
})

const summary = computed(() => {
  const n = range.value
  const from = keys.value[0]
  let checkinDays = 0
  let water = 0
  let sleep = 0
  let sleepDays = 0
  for (const key of keys.value) {
    const c = map.value[key]
    if (c) {
      checkinDays++
      water += c.water
      if (c.sleep) {
        sleep += c.sleep
        sleepDays++
      }
    }
  }
  let minutes = 0
  let calories = 0
  let times = 0
  for (const e of state.exercises) {
    if (e.date < from) break
    minutes += e.duration
    calories += e.calories
    times++
  }
  return {
    checkinRate: Math.round((checkinDays / n) * 100),
    avgWater: checkinDays ? Math.round(water / checkinDays) : 0,
    avgSleep: sleepDays ? Math.round((sleep / sleepDays) * 10) / 10 : 0,
    minutes,
    calories,
    times
  }
})

const dateRangeLabel = computed(
  () => `${shortLabel(keys.value[0])} ~ ${shortLabel(keys.value[keys.value.length - 1])}`
)
</script>

<template>
  <div>
    <h1 class="page-title">数据统计</h1>
    <p class="page-sub">{{ dateRangeLabel }}</p>

    <div class="range-toggle">
      <button :class="{ active: range === 7 }" @click="range = 7">最近 7 天</button>
      <button :class="{ active: range === 30 }" @click="range = 30">最近 30 天</button>
    </div>

    <div class="card">
      <div class="card-title"><span>💧 每日饮水量 (ml)</span></div>
      <BarChart :data="waterData" color="#3f8fd6" unit="ml" />
    </div>

    <div class="card">
      <div class="card-title"><span>😴 每日睡眠 (小时)</span></div>
      <BarChart :data="sleepData" color="#8e6bb5" unit="小时" />
    </div>

    <div class="two-col">
      <div class="card">
        <div class="card-title"><span>🏃 每日运动时长 (分钟)</span></div>
        <BarChart :data="exerciseData" color="#0f9d76" unit="分钟" />
      </div>
      <div class="card">
        <div class="card-title"><span>🥗 运动类型分布</span></div>
        <div v-if="!typeDist.length" class="empty">该时间段还没有运动记录</div>
        <div v-else class="donut-wrap">
          <DonutChart :items="typeDist" :size="140" />
          <ul class="legend">
            <li v-for="s in typeDist" :key="s.label">
              <i :style="{ background: s.color }"></i>{{ s.label }}
              <b>{{ s.value }}</b>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title"><span>📌 阶段小结</span></div>
      <div class="sum-grid">
        <div class="sum-item"><b>{{ summary.checkinRate }}%</b><span>打卡率</span></div>
        <div class="sum-item"><b>{{ summary.avgWater }}</b><span>日均饮水 ml</span></div>
        <div class="sum-item"><b>{{ summary.avgSleep || '—' }}</b><span>日均睡眠 h</span></div>
        <div class="sum-item"><b>{{ fmtDuration(summary.minutes) }}</b><span>运动总时长</span></div>
        <div class="sum-item"><b>{{ summary.times }}</b><span>运动次数</span></div>
        <div class="sum-item"><b>{{ summary.calories }}</b><span>总消耗 kcal</span></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.range-toggle {
  display: inline-flex;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 16px;
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: var(--shadow);
}
.range-toggle button {
  position: relative;
  overflow: hidden;
  border: none;
  background: transparent;
  padding: 7px 18px;
  color: var(--ink-soft);
  transition: background 0.2s, color 0.2s;
}
.range-toggle button:hover { color: var(--ink); background: rgba(255, 255, 255, 0.5); }
.range-toggle button.active {
  background: var(--brand-grad);
  color: #fff;
  font-weight: 650;
}

.two-col {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
  margin-top: 16px;
}
.two-col .card + .card { margin-top: 0; }

.donut-wrap {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}
.legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
  font-size: 13.5px;
}
.legend i {
  display: inline-block;
  width: 11px;
  height: 11px;
  border-radius: 3px;
  margin-right: 8px;
}
.legend b { margin-left: 8px; color: var(--ink-soft); }

.sum-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 12px;
}
.sum-item {
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--line);
  border-radius: 12px;
  text-align: center;
  padding: 14px 6px;
  transition: transform 0.25s var(--ease-spring), box-shadow 0.25s, border-color 0.25s;
}
.sum-item:hover {
  transform: translateY(-4px);
  border-color: rgba(15, 157, 118, 0.4);
  box-shadow: 0 10px 24px rgba(30, 70, 55, 0.12);
}
.sum-item b {
  display: block;
  font-size: 18px;
  color: var(--brand-deep);
}
.sum-item span {
  font-size: 12px;
  color: var(--ink-faint);
}
</style>
