<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { init, state } from './stores/health.js'
import { startDayClock } from './lib/day.js'
import AmbientBackground from './components/AmbientBackground.vue'

const navItems = [
  { to: '/', icon: '✅', label: '今日打卡' },
  { to: '/exercise', icon: '🏃', label: '运动记录' },
  { to: '/stats', icon: '📊', label: '数据统计' },
  { to: '/settings', icon: '🔒', label: '隐私与数据' }
]
const retrying = ref(false)
let stopClock = () => {}
let motion
let spotlightFrame = 0
let pointer
async function retryLoad() {
  if (retrying.value) return
  retrying.value = true
  try { await init({ force: true }) } catch { /* state.error 保留具体错误，允许再次恢复。 */ }
  finally { retrying.value = false }
}
function onSpotlight(event) {
  if (motion?.matches || event.pointerType === 'touch') return
  const card = event.target?.closest?.('.card')
  if (!card) return
  pointer = { card, x: event.clientX, y: event.clientY }
  if (spotlightFrame) return
  spotlightFrame = requestAnimationFrame(() => {
    spotlightFrame = 0
    if (!pointer.card.isConnected) return
    const rect = pointer.card.getBoundingClientRect()
    pointer.card.style.setProperty('--mx', `${pointer.x - rect.left}px`)
    pointer.card.style.setProperty('--my', `${pointer.y - rect.top}px`)
  })
}
function onRipple(event) {
  if (motion?.matches) return
  const host = event.target?.closest?.('.btn, .nav-item, .seg-btn, .mood, .quote-next')
  if (!host || host.matches(':disabled')) return
  const rect = host.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height) * 1.15
  const span = document.createElement('span')
  span.className = 'ripple'
  span.style.width = span.style.height = `${size}px`
  span.style.left = `${event.clientX - rect.left - size / 2}px`
  span.style.top = `${event.clientY - rect.top - size / 2}px`
  host.appendChild(span)
  span.addEventListener('animationend', () => span.remove(), { once: true })
}
onMounted(() => {
  stopClock = startDayClock()
  motion = matchMedia('(prefers-reduced-motion: reduce)')
  addEventListener('pointermove', onSpotlight, { passive: true })
  addEventListener('pointerdown', onRipple, { passive: true })
})
onBeforeUnmount(() => {
  stopClock()
  cancelAnimationFrame(spotlightFrame)
  removeEventListener('pointermove', onSpotlight)
  removeEventListener('pointerdown', onRipple)
})
</script>

<template>
  <AmbientBackground />

  <div class="app-root">
    <!-- 窄屏顶部标题 -->
    <div class="topbar">
      <div class="brand"><span>🌿</span><span class="brand-name">健康打卡</span></div>
      <span class="topbar-hint">本地存储 · 隐私安全</span>
    </div>

    <div class="shell">
      <aside class="sidebar" role="navigation" aria-label="主导航">
        <div class="brand"><span>🌿</span><span class="brand-name">健康打卡</span></div>
        <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" class="nav-item">
          <span class="icon">{{ item.icon }}</span>{{ item.label }}
        </RouterLink>
        <div class="sidebar-footer">
          <span><span class="status-dot"></span>本地运行中</span><br />
          数据仅存于本机<br />不上传任何服务器
        </div>
      </aside>

      <main class="content">
        <div v-if="state.error" class="card storage-error" role="alert">
          <p>{{ state.error }}</p>
          <div class="recovery-actions">
            <button class="btn btn-sm" :disabled="retrying" @click="retryLoad">{{ retrying ? '读取中…' : '重试读取' }}</button>
            <RouterLink class="btn btn-ghost btn-sm" to="/settings">恢复备份</RouterLink>
          </div>
        </div>
        <RouterView v-slot="{ Component }">
          <Transition name="fade" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </main>
    </div>

    <!-- 窄屏底部导航 -->
    <nav class="bottom-nav" aria-label="移动导航">
      <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" class="nav-item">
        <span class="icon">{{ item.icon }}</span>{{ item.label }}
      </RouterLink>
    </nav>
  </div>
</template>
