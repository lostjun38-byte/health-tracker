import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router/index.js'
import { init } from './stores/health.js'
import './styles/main.css'

const app = createApp(App)
app.use(router)

// 先把本地数据读进内存,再挂载,避免首屏闪"空状态"
init().finally(() => app.mount('#app'))
