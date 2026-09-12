<script setup>
import { computed } from 'vue'

const props = defineProps({
  /** [{ label, value, color }] */
  items: { type: Array, default: () => [] },
  size: { type: Number, default: 150 }
})

const total = computed(() => props.items.reduce((s, i) => s + i.value, 0))

/** 生成 SVG 环形图的 stroke-dasharray 片段 */
const slices = computed(() => {
  const r = 40
  const c = 2 * Math.PI * r
  let offset = 0
  return props.items
    .filter((i) => i.value > 0 && total.value > 0)
    .map((i) => {
      const frac = i.value / total.value
      const seg = { ...i, dash: `${frac * c} ${c}`, offset: -offset * c, pct: Math.round(frac * 100) }
      offset += frac
      return seg
    })
})
</script>

<template>
  <div class="donut" :style="{ width: size + 'px', height: size + 'px' }">
    <svg viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="40" fill="none" stroke="#eef3f1" stroke-width="14" />
      <circle
        v-for="s in slices"
        :key="s.label"
        cx="50" cy="50" r="40"
        fill="none"
        :stroke="s.color"
        stroke-width="14"
        :stroke-dasharray="s.dash"
        :stroke-dashoffset="s.offset"
        stroke-linecap="butt"
      >
        <title>{{ s.label }} {{ s.pct }}%</title>
      </circle>
    </svg>
    <div class="center">
      <strong>{{ total }}</strong>
      <span>次</span>
    </div>
  </div>
</template>

<style scoped>
.donut {
  position: relative;
  animation: donut-in 0.55s var(--ease-spring) backwards;
}
@keyframes donut-in {
  from { opacity: 0; transform: scale(0.82) rotate(-14deg); }
}
svg { width: 100%; height: 100%; transform: rotate(-90deg); }
circle { transition: stroke-width 0.2s; }
svg:hover circle[stroke-dasharray]:not([stroke='#eef3f1']) { stroke-width: 16; }
.center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  line-height: 1.2;
}
.center strong { font-size: 20px; }
.center span { font-size: 11px; color: var(--ink-faint); }
</style>
