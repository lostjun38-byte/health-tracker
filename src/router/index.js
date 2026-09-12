import { createRouter, createWebHashHistory } from 'vue-router'

/**
 * 使用 hash 路由:部署到任意静态目录(甚至无服务器环境的本地文件)
 * 都不需要服务端做 history 回退配置。
 * 各页面均懒加载,首屏只下载"今日打卡"页所需代码。
 */
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue')
    },
    {
      path: '/exercise',
      name: 'exercise',
      component: () => import('../views/ExerciseView.vue')
    },
    {
      path: '/stats',
      name: 'stats',
      component: () => import('../views/StatsView.vue')
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue')
    },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})
