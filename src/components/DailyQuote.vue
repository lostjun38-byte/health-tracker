<script setup>
import { ref } from 'vue'
import { getQuote } from '../lib/quotes.js'

/** 每日名言:按日期确定性选取,"换一句"在本地数组里轮换 */
const quote = ref(getQuote())
let offset = 0

function next() {
  quote.value = getQuote(++offset)
}
</script>

<template>
  <div class="card quote-card">
    <div class="quote-head">
      <span class="quote-label">✨ 今日一句</span>
      <button class="quote-next" title="换一句" @click="next">🔄 换一句</button>
    </div>
    <Transition name="quote" mode="out-in">
      <p :key="quote.text" class="quote-text">"{{ quote.text }}"</p>
    </Transition>
    <p class="quote-from">—— {{ quote.from }}</p>
  </div>
</template>

<style scoped>
.quote-card {
  padding: 16px 20px 14px;
}
.quote-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.quote-label {
  font-size: 12.5px;
  font-weight: 650;
  color: var(--brand-deep);
  letter-spacing: 1px;
}
.quote-next {
  border: none;
  background: transparent;
  color: var(--ink-faint);
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 8px;
  transition: all 0.18s;
  position: relative;
  overflow: hidden;
}
.quote-next:hover {
  color: var(--brand-deep);
  background: rgba(255, 255, 255, 0.7);
}
.quote-text {
  font-size: 15.5px;
  font-weight: 550;
  line-height: 1.75;
  color: var(--ink);
  margin: 0;
}
.quote-from {
  margin-top: 6px;
  font-size: 12.5px;
  color: var(--ink-faint);
  text-align: right;
}

.quote-enter-active, .quote-leave-active { transition: all 0.28s ease; }
.quote-enter-from { opacity: 0; transform: translateY(8px); }
.quote-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
