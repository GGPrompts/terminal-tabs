import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useUIStore } from '../useUIStore'

describe('useUIStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    const store = useUIStore.getState()
    act(() => {
      store.setSidebarOpen(true)
      store.setSidebarTab('terminals')
      store.setChatMinimized(false)
      store.setMinimapVisible(false)
    })
  })

  it('should have correct initial state', () => {
    const { result } = renderHook(() => useUIStore())

    expect(result.current.sidebarOpen).toBe(true)
    expect(result.current.sidebarTab).toBe('terminals')
    expect(result.current.chatMinimized).toBe(false)
    expect(result.current.minimapVisible).toBe(false)
  })

  it('should set sidebar open state', () => {
    const { result } = renderHook(() => useUIStore())

    act(() => {
      result.current.setSidebarOpen(false)
    })

    expect(result.current.sidebarOpen).toBe(false)

    act(() => {
      result.current.setSidebarOpen(true)
    })

    expect(result.current.sidebarOpen).toBe(true)
  })

  it('should set sidebar tab', () => {
    const { result } = renderHook(() => useUIStore())

    act(() => {
      result.current.setSidebarTab('agents')
    })

    expect(result.current.sidebarTab).toBe('agents')

    act(() => {
      result.current.setSidebarTab('prompts')
    })

    expect(result.current.sidebarTab).toBe('prompts')
  })

  it('should set chat minimized state', () => {
    const { result } = renderHook(() => useUIStore())

    act(() => {
      result.current.setChatMinimized(true)
    })

    expect(result.current.chatMinimized).toBe(true)

    act(() => {
      result.current.setChatMinimized(false)
    })

    expect(result.current.chatMinimized).toBe(false)
  })

  it('should set minimap visible state', () => {
    const { result } = renderHook(() => useUIStore())

    act(() => {
      result.current.setMinimapVisible(true)
    })

    expect(result.current.minimapVisible).toBe(true)

    act(() => {
      result.current.setMinimapVisible(false)
    })

    expect(result.current.minimapVisible).toBe(false)
  })

  it('should set chat position', () => {
    const { result } = renderHook(() => useUIStore())

    act(() => {
      result.current.setChatPosition({ x: 100, y: 200 })
    })

    expect(result.current.chatPosition).toEqual({ x: 100, y: 200 })
  })

  it('should set chat size', () => {
    const { result } = renderHook(() => useUIStore())

    act(() => {
      result.current.setChatSize({ width: 400, height: 600 })
    })

    expect(result.current.chatSize).toEqual({ width: 400, height: 600 })
  })

  it('should set sidebar width', () => {
    const { result } = renderHook(() => useUIStore())

    act(() => {
      result.current.setSidebarWidth(300)
    })

    expect(result.current.sidebarWidth).toBe(300)
  })
})