<script setup>
import { ref, computed } from 'vue'
import { state } from '../stores/health.js'
import { lastNDays, fmtDuration, shortLabel } from '../lib/utils.js'
import { currentDay } from '../lib/day.js'
import { summarizePeriod } from '../lib/statistics.js'
import BarChart from '../components/BarChart.vue'
import DonutChart from '../components/DonutChart.vue'

const range = ref(7)
const keys = computed(() => lastNDays(range.value, currentDay.value))
const stats = computed(() => summarizePeriod(state.checkins, state.exercises, keys.value))
const dateRangeLabel = computed(() => `${shortLabel(keys.value[0])} ~ ${shortLabel(keys.value[keys.value.length - 1])}`)
</script>

<template>
  <div>
    <h1 class="page-title">数据统计</h1>
    <p class="page-sub">{{ dateRangeLabel }}</p>

    <div class="range-toggle">
      <button :class="{ active: range === 7 }" :aria-pressed="range === 7" @click="range = 7">最近 7 天</button>
      <button :class="{ active: range === 30 }" :aria-pressed="range === 30" @click="range = 30">最近 30 天</button>
    </div>

    <div class="card">
      <div class="card-title"><span>💧 每日饮水量 (ml)</span></div>
      <BarChart :data="stats.waterData" color="#3f8fd6" unit="ml" />
    </div>

    <div class="card">
      <div class="card-title"><span>😴 每日睡眠 (小时)</span></div>
      <BarChart :data="stats.sleepData" color="#8e6bb5" unit="小时" />
    </div>

    <div class="two-col">
      <div class="card">
        <div class="card-title"><span>🏃 每日运动时长 (分钟)</span></div>
        <BarChart :data="stats.exerciseData" color="#0f9d76" unit="分钟" />
      </div>
      <div class="card">
        <div class="card-title"><span>🥗 运动类型分布</span></div>
        <div v-if="!stats.typeDist.length" class="empty">该时间段还没有运动记录</div>
        <div v-else class="donut-wrap">
          <DonutChart :items="stats.typeDist" :size="140" />
          <ul class="legend">
            <li v-for="s in stats.typeDist" :key="s.label">
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
        <div class="sum-item"><b>{{ stats.summary.checkinRate }}%</b><span>打卡率</span></div>
        <div class="sum-item"><b>{{ stats.summary.avgWater }}</b><span>日均饮水 ml</span></div>
        <div class="sum-item"><b>{{ stats.summary.avgSleep ?? '—' }}</b><span>日均睡眠 h</span></div>
        <div class="sum-item"><b>{{ fmtDuration(stats.summary.minutes) }}</b><span>运动总时长</span></div>
        <div class="sum-item"><b>{{ stats.summary.times }}</b><span>运动次数</span></div>
        <div class="sum-item"><b>{{ stats.summary.calories }}</b><span>总消耗 kcal</span></div>
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
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
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
