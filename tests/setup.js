import 'fake-indexeddb/auto'
import { afterEach, beforeEach, vi } from 'vitest'
import { refreshDay } from '../src/lib/day.js'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-12T12:00:00'))
  refreshDay()
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
