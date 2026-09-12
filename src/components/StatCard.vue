<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({ icon: String, label: String, value: [String, Number], unit: String, hint: String })
const display = ref(props.value)
let raf = 0
let motion
function stopAnimation() {
  cancelAnimationFrame(raf)
  raf = 0
  display.value = props.value
}
onMounted(() => {
  motion = matchMedia('(prefers-reduced-motion: reduce)')
  motion.addEventListener('change', stopAnimation)
  if (motion.matches || typeof props.value !== 'number' || !props.value) return
  const target = props.value
  const start = performance.now()
  display.value = 0
  const step = (time) => {
    const progress = Math.min(1, (time - start) / 750)
    const value = target * (1 - Math.pow(1 - progress, 3))
    display.value = Number.isInteger(target) ? Math.round(value) : Math.round(value * 10) / 10
    if (progress < 1) raf = requestAnimationFrame(step)
    else { display.value = props.value; raf = 0 }
  }
  raf = requestAnimationFrame(step)
})
watch(() => props.value, stopAnimation, { flush: 'sync' })
onBeforeUnmount(() => { cancelAnimationFrame(raf); motion?.removeEventListener('change', stopAnimation) })
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
