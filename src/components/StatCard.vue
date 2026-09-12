<script setup>
import { ref, watch, onMounted } from 'vue'

const props = defineProps({
  icon: String,
  label: String,
  value: [String, Number],
  unit: String,
  hint: String
})

/* 数字值挂载时从 0 滚动到目标值(easeOut),之后的变化即时显示 */
const display = ref(typeof props.value === 'number' ? 0 : props.value)

onMounted(() => {
  if (typeof props.value !== 'number') return
  const target = props.value
  const start = performance.now()
  const dur = 750
  const step = (t) => {
    const p = Math.min(1, (t - start) / dur)
    const eased = 1 - Math.pow(1 - p, 3)
    const v = target * eased
    display.value = Number.isInteger(target) ? Math.round(v) : Math.round(v * 10) / 10
    if (p < 1) requestAnimationFrame(step)
    else display.value = target
  }
  requestAnimationFrame(step)
})

watch(() => props.value, (v) => { display.value = v })
</script>

<template>
  <div class="card stat-card">
    <div class="stat-icon">{{ icon }}</div>
    <div class="stat-body">
      <div class="stat-value">
        {{ display }}<span v-if="unit" class="stat-unit">{{ unit }}</span>
      </div>
      <div class="stat-label">{{ label }}<template v-if="hint"> · {{ hint }}</template></div>
    </div>
  </div>
</template>

<style scoped>
.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
}
.stat-card:hover { transform: translateY(-3px); }
.stat-icon {
  font-size: 24px;
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  background: var(--brand-soft);
  border-radius: 13px;
  flex-shrink: 0;
  transition: transform 0.3s var(--ease-spring);
}
.stat-card:hover .stat-icon { transform: scale(1.12) rotate(-6deg); }
.stat-value {
  font-size: 22px;
  font-weight: 750;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.stat-unit {
  font-size: 12px;
  font-weight: 500;
  color: var(--ink-faint);
  margin-left: 3px;
}
.stat-label {
  font-size: 12.5px;
  color: var(--ink-soft);
  margin-top: 2px;
}
</style>
