<script setup>
import { computed } from 'vue'
import { shortLabel } from '../lib/utils.js'

const props = defineProps({
  /** [{ key: '2026-09-01', value: 1500 }] */
  data: { type: Array, default: () => [] },
  color: { type: String, default: '#0f9d76' },
  unit: { type: String, default: '' },
  height: { type: Number, default: 150 }
})

const max = computed(() => Math.max(1, ...props.data.map((d) => d.value)))

const bars = computed(() =>
  props.data.map((d) => ({
    ...d,
    hPct: d.value > 0 ? Math.max(2, (d.value / max.value) * 100) : 0,
    label: shortLabel(d.key)
  }))
)

const tip = (d) => `${d.key}\n${d.value}${props.unit}`
</script>

<!--
  纯 SVG/CSS 柱状图:不引入任何图表库,
  30 根柱子用 div 渲染,浏览器合成层即可处理,交互零 JS 开销。
-->
<template>
  <div class="barchart" :style="{ height: height + 'px' }">
    <div
      v-for="(d, i) in bars"
      :key="d.key"
      class="col"
      :title="tip(d)"
    >
      <div class="bar-wrap">
        <div
          class="bar"
          :style="{ height: d.hPct + '%', background: color, animationDelay: i * 24 + 'ms' }"
        ></div>
      </div>
      <div class="tick">{{ d.label.slice(3) }}</div>
    </div>
  </div>
</template>

<style scoped>
.barchart {
  display: flex;
  align-items: stretch;
  gap: 3px;
  overflow-x: auto;
}
.col {
  flex: 1;
  min-width: 14px;
  display: flex;
  flex-direction: column;
}
.bar-wrap {
  flex: 1;
  display: flex;
  align-items: flex-end;
}
.bar {
  width: 100%;
  border-radius: 4px 4px 2px 2px;
  opacity: 0.85;
  transform-origin: bottom;
  animation: bar-grow 0.65s var(--ease-spring) backwards;
  transition: opacity 0.15s, filter 0.15s;
}
@keyframes bar-grow {
  from { transform: scaleY(0); }
}
.col:hover .bar { opacity: 1; filter: brightness(1.08) saturate(1.1); }
.tick {
  font-size: 9.5px;
  color: var(--ink-faint);
  text-align: center;
  padding-top: 4px;
  white-space: nowrap;
}
</style>
