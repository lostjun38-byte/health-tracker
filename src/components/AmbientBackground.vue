<script setup>
/**
 * 动态氛围背景:渐变底色 + 三个缓慢漂浮的模糊光斑。
 * 鼠标移动时整个光斑层做惯性视差(rAF + lerp),
 * 仅使用 transform,不触发重排;遵循 prefers-reduced-motion。
 */
import { onMounted, onBeforeUnmount, ref } from 'vue'

const layer = ref(null)
let raf = 0
let tx = 0, ty = 0, cx = 0, cy = 0

function onMove(e) {
  const nx = e.clientX / innerWidth - 0.5
  const ny = e.clientY / innerHeight - 0.5
  tx = nx * 36
  ty = ny * 26
}

function tick() {
  cx += (tx - cx) * 0.055
  cy += (ty - cy) * 0.055
  if (layer.value) layer.value.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0)`
  raf = requestAnimationFrame(tick)
}

onMounted(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  addEventListener('pointermove', onMove, { passive: true })
  raf = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  removeEventListener('pointermove', onMove)
  cancelAnimationFrame(raf)
})
</script>

<template>
  <div class="ambient" aria-hidden="true">
    <div ref="layer" class="ambient-layer">
      <div class="blob blob-a"></div>
      <div class="blob blob-b"></div>
      <div class="blob blob-c"></div>
    </div>
  </div>
</template>

<style scoped>
.ambient {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  background: linear-gradient(158deg, #e9f6f0 0%, #e6f0f8 46%, #efeaf8 100%);
}
.ambient-layer {
  position: absolute;
  inset: -70px;
  will-change: transform;
}
.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(72px);
  opacity: 0.55;
}
.blob-a {
  width: 46vmax; height: 46vmax;
  left: -14vmax; top: -16vmax;
  background: radial-gradient(circle at 32% 32%, #a5ead0, #55c79e 58%, transparent 72%);
  animation: drift-a 26s ease-in-out infinite alternate;
}
.blob-b {
  width: 40vmax; height: 40vmax;
  right: -12vmax; top: 4vmax;
  background: radial-gradient(circle at 60% 40%, #aad6f7, #6ba6e8 58%, transparent 72%);
  animation: drift-b 32s ease-in-out infinite alternate;
}
.blob-c {
  width: 36vmax; height: 36vmax;
  left: 24vw; bottom: -18vmax;
  background: radial-gradient(circle at 50% 50%, #d6c5f4, #a88fe2 58%, transparent 72%);
  animation: drift-c 38s ease-in-out infinite alternate;
}
@keyframes drift-a { to { transform: translate(6vmax, 5vmax) scale(1.16); } }
@keyframes drift-b { to { transform: translate(-6vmax, 7vmax) scale(0.88); } }
@keyframes drift-c { to { transform: translate(5vmax, -6vmax) scale(1.14); } }

@media (prefers-reduced-motion: reduce) {
  .blob { animation: none; }
}
</style>
