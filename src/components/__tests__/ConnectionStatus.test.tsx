import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConnectionStatus } from '../ConnectionStatus'

describe('ConnectionStatus', () => {
  it('renders with connected state', () => {
    render(<ConnectionStatus status="connected" />)

    const statusText = screen.getByText('Connected')
    expect(statusText).toBeInTheDocument()

    const statusContainer = statusText.closest('.connection-status')
    expect(statusContainer).toHaveClass('connected')
  })

  it('renders with disconnected state', () => {
    render(<ConnectionStatus status="disconnected" />)

    const statusText = screen.getByText('Disconnected')
    expect(statusText).toBeInTheDocument()

    const statusContainer = statusText.closest('.connection-status')
    expect(statusContainer).toHaveClass('disconnected')
  })

  it('renders with connecting state', () => {
    render(<ConnectionStatus status="connecting" />)

    const statusText = screen.getByText('Connecting...')
    expect(statusText).toBeInTheDocument()

    const statusContainer = statusText.closest('.connection-status')
    expect(statusContainer).toHaveClass('connecting')
  })
})