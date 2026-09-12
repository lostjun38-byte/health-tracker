import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js'],
    setupFiles: ['./tests/setup.js'],
    maxWorkers: 2,
    restoreMocks: true
  }
})
