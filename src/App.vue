<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { init, state } from './stores/health.js'
import AmbientBackground from './components/AmbientBackground.vue'

const navItems = [
  { to: '/', icon: '✅', label: '今日打卡' },
  { to: '/exercise', icon: '🏃', label: '运动记录' },
  { to: '/stats', icon: '📊', label: '数据统计' },
  { to: '/settings', icon: '🔒', label: '隐私与数据' }
]

/* 全局鼠标交互:卡片光晕跟随(写入 --mx/--my 供 CSS 使用) */
function onSpotlight(e) {
  const card = e.target?.closest?.('.card')
  if (!card) return
  const r = card.getBoundingClientRect()
  card.style.setProperty('--mx', `${e.clientX - r.left}px`)
  card.style.setProperty('--my', `${e.clientY - r.top}px`)
}

/* 全局鼠标交互:可点元素的涟漪反馈 */
function onRipple(e) {
  const host = e.target?.closest?.('.btn, .nav-item, .seg-btn, .mood, .quote-next')
  if (!host) return
  const rect = host.getBoundingClientRect()
  const d = Math.max(rect.width, rect.height) * 1.15
  const span = document.createElement('span')
  span.className = 'ripple'
  span.style.width = span.style.height = `${d}px`
  span.style.left = `${e.clientX - rect.left - d / 2}px`
  span.style.top = `${e.clientY - rect.top - d / 2}px`
  host.appendChild(span)
  span.addEventListener('animationend', () => span.remove(), { once: true })
}

onMounted(() => {
  addEventListener('pointermove', onSpotlight, { passive: true })
  addEventListener('pointerdown', onRipple, { passive: true })
})
onBeforeUnmount(() => {
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
      <aside class="sidebar">
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
        <div v-if="state.error" class="card" style="border-color:#f0cfcc;color:var(--danger)">
          {{ state.error }}
        </div>
        <RouterView v-else v-slot="{ Component }">
          <Transition name="fade" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </main>
    </div>

    <!-- 窄屏底部导航 -->
    <nav class="bottom-nav">
      <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" class="nav-item">
        <span class="icon">{{ item.icon }}</span>{{ item.label }}
      </RouterLink>
    </nav>
  </div>
</template>
