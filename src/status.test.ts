import { InstanceStatus } from '@companion-module/base'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StatusManager, type Status } from './status.js'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@companion-module/base', () => ({
	InstanceStatus: {
		Ok: 'ok',
		Disconnected: 'disconnected',
		BadConfig: 'bad_config',
		Error: 'error',
		Warning: 'warning',
		Connecting: 'connecting',
		Unknown: 'unknown',
	},
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSelf() {
	return {
		updateStatus: vi.fn(),
	}
}

type Self = ReturnType<typeof makeSelf>

const THROTTLE_MS = 100

/** Create a StatusManager and advance timers so the init status is applied */
async function makeManager(self: Self, initStatus?: Status, throttle = THROTTLE_MS): Promise<StatusManager> {
	const manager = new StatusManager(self as any, initStatus, throttle)
	// Flush the trailing-edge throttle from the constructor call
	await vi.runAllTimersAsync()
	return manager
}

// ---------------------------------------------------------------------------

describe('StatusManager', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	// -------------------------------------------------------------------------
	// Constructor
	// -------------------------------------------------------------------------

	describe('constructor', () => {
		it('applies the initial status after the throttle interval', async () => {
			const self = makeSelf()
			await makeManager(self, { status: InstanceStatus.Ok, message: 'ready' })
			expect(self.updateStatus).toHaveBeenCalledWith(InstanceStatus.Ok, 'ready')
		})

		it('defaults to Disconnected with null message when no initStatus provided', async () => {
			const self = makeSelf()
			await makeManager(self)
			expect(self.updateStatus).toHaveBeenCalledWith(InstanceStatus.Disconnected, null)
		})

		it('exposes the initial status via the status getter', async () => {
			const self = makeSelf()
			const manager = await makeManager(self, { status: InstanceStatus.Ok, message: 'hi' })
			expect(manager.status.status).toBe(InstanceStatus.Ok)
			expect(manager.status.message).toBe('hi')
		})

		it('isDestroyed is false on creation', async () => {
			const manager = await makeManager(makeSelf())
			expect(manager.isDestroyed).toBe(false)
		})
	})

	// -------------------------------------------------------------------------
	// updateStatus — deduplication
	// -------------------------------------------------------------------------

	describe('updateStatus — deduplication', () => {
		it('calls parent updateStatus when status changes', async () => {
			const self = makeSelf()
			const manager = await makeManager(self)
			self.updateStatus.mockClear()

			manager.updateStatus(InstanceStatus.Ok, 'connected')
			await vi.runAllTimersAsync()

			expect(self.updateStatus).toHaveBeenCalledWith(InstanceStatus.Ok, 'connected')
		})

		it('does not call parent updateStatus when status and message are unchanged', async () => {
			const self = makeSelf()
			const manager = await makeManager(self, { status: InstanceStatus.Ok, message: 'same' })
			self.updateStatus.mockClear()

			manager.updateStatus(InstanceStatus.Ok, 'same')
			await vi.runAllTimersAsync()

			expect(self.updateStatus).not.toHaveBeenCalled()
		})

		it('calls parent updateStatus when only the message changes', async () => {
			const self = makeSelf()
			const manager = await makeManager(self, { status: InstanceStatus.Ok, message: 'old' })
			self.updateStatus.mockClear()

			manager.updateStatus(InstanceStatus.Ok, 'new')
			await vi.runAllTimersAsync()

			expect(self.updateStatus).toHaveBeenCalledWith(InstanceStatus.Ok, 'new')
		})

		it('calls parent updateStatus when only the status changes', async () => {
			const self = makeSelf()
			const manager = await makeManager(self, { status: InstanceStatus.Ok, message: 'msg' })
			self.updateStatus.mockClear()

			manager.updateStatus(InstanceStatus.UnknownError, 'msg')
			await vi.runAllTimersAsync()

			expect(self.updateStatus).toHaveBeenCalledWith(InstanceStatus.UnknownError, 'msg')
		})

		it('defaults message to null when not provided', async () => {
			const self = makeSelf()
			const manager = await makeManager(self)
			self.updateStatus.mockClear()

			manager.updateStatus(InstanceStatus.Ok)
			await vi.runAllTimersAsync()

			expect(self.updateStatus).toHaveBeenCalledWith(InstanceStatus.Ok, null)
		})
	})

	// -------------------------------------------------------------------------
	// updateStatus — object messages
	// -------------------------------------------------------------------------

	describe('updateStatus — object messages', () => {
		it('JSON.stringifies an object message before passing to parent', async () => {
			const self = makeSelf()
			const manager = await makeManager(self)
			self.updateStatus.mockClear()

			manager.updateStatus(InstanceStatus.UnknownWarning, { code: 42, reason: 'oops' })
			await vi.runAllTimersAsync()

			expect(self.updateStatus).toHaveBeenCalledWith(
				InstanceStatus.UnknownWarning,
				JSON.stringify({ code: 42, reason: 'oops' }),
			)
		})

		it('updates #currentStatus with the raw object (not the stringified form)', async () => {
			const self = makeSelf()
			const manager = await makeManager(self)

			const msg = { detail: 'error detail' }
			manager.updateStatus(InstanceStatus.ConnectionFailure, msg)
			await vi.runAllTimersAsync()

			expect(manager.status.message).toEqual(msg)
		})
	})

	// -------------------------------------------------------------------------
	// updateStatus — throttle behaviour
	// -------------------------------------------------------------------------

	describe('updateStatus — throttle', () => {
		it('applies only the latest status when called multiple times within the throttle window', async () => {
			const self = makeSelf()
			const manager = await makeManager(self)
			self.updateStatus.mockClear()

			manager.updateStatus(InstanceStatus.BadConfig, 'first')
			manager.updateStatus(InstanceStatus.ConnectionFailure, 'second')
			manager.updateStatus(InstanceStatus.Ok, 'third')

			await vi.runAllTimersAsync()

			// The trailing-edge throttle should deliver the last queued status
			const calls = self.updateStatus.mock.calls
			const lastCall = calls[calls.length - 1]
			expect(lastCall).toEqual([InstanceStatus.Ok, 'third'])
		})

		it('does not call parent updateStatus before the throttle interval elapses', async () => {
			const self = makeSelf()
			const manager = await makeManager(self)
			self.updateStatus.mockClear()

			manager.updateStatus(InstanceStatus.Ok, 'msg')
			// Don't advance timers — trailing edge hasn't fired yet
			expect(self.updateStatus).not.toHaveBeenCalled()
		})

		it('calls parent updateStatus after the throttle interval elapses', async () => {
			const self = makeSelf()
			const manager = await makeManager(self)
			self.updateStatus.mockClear()

			manager.updateStatus(InstanceStatus.Ok, 'msg')
			await vi.runAllTimersAsync()

			expect(self.updateStatus).toHaveBeenCalledWith(InstanceStatus.Ok, 'msg')
		})
	})

	// -------------------------------------------------------------------------
	// isDestroyed guard
	// -------------------------------------------------------------------------

	describe('isDestroyed guard', () => {
		it('does not call parent updateStatus after destroy', async () => {
			const self = makeSelf()
			const manager = await makeManager(self)
			manager.destroy()
			await vi.runAllTimersAsync()
			self.updateStatus.mockClear()

			manager.updateStatus(InstanceStatus.Ok, 'after destroy')
			await vi.runAllTimersAsync()

			expect(self.updateStatus).not.toHaveBeenCalled()
		})

		it('logs to console when updateStatus is called after destroy', async () => {
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
			const self = makeSelf()
			const manager = await makeManager(self)
			manager.destroy()

			manager.updateStatus(InstanceStatus.Ok, 'after destroy')
			await vi.runAllTimersAsync()

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('destroyed'))
			consoleSpy.mockRestore()
		})
	})

	// -------------------------------------------------------------------------
	// destroy
	// -------------------------------------------------------------------------

	describe('destroy', () => {
		it('sets isDestroyed to true', async () => {
			const manager = await makeManager(makeSelf())
			manager.destroy()
			expect(manager.isDestroyed).toBe(true)
		})

		it('calls parent updateStatus with Disconnected and "Destroyed" message', async () => {
			const self = makeSelf()
			const manager = await makeManager(self)
			self.updateStatus.mockClear()

			manager.destroy()
			await vi.runAllTimersAsync()

			expect(self.updateStatus).toHaveBeenCalledWith(InstanceStatus.Disconnected, 'Destroyed')
		})

		it('flushes any pending throttled update before setting destroyed status', async () => {
			const self = makeSelf()
			const manager = await makeManager(self)

			// Queue a status update that hasn't fired yet
			manager.updateStatus(InstanceStatus.Ok, 'pending')
			self.updateStatus.mockClear()

			manager.destroy()
			await vi.runAllTimersAsync()

			const calls = self.updateStatus.mock.calls.map((c) => c[0])
			// The pending update should have been flushed before the Destroyed status
			expect(calls).toContain(InstanceStatus.Disconnected)
		})

		it('updates the current status to Disconnected after destroy', async () => {
			const self = makeSelf()
			const manager = await makeManager(self, { status: InstanceStatus.Ok, message: 'live' })
			manager.destroy()
			await vi.runAllTimersAsync()

			expect(manager.status.status).toBe(InstanceStatus.Disconnected)
		})
	})

	// -------------------------------------------------------------------------
	// status getter
	// -------------------------------------------------------------------------

	describe('status getter', () => {
		it('reflects the most recently applied status', async () => {
			const self = makeSelf()
			const manager = await makeManager(self, { status: InstanceStatus.Ok, message: 'initial' })

			manager.updateStatus(InstanceStatus.AuthenticationFailure, 'problem')
			await vi.runAllTimersAsync()

			expect(manager.status).toEqual({ status: InstanceStatus.AuthenticationFailure, message: 'problem' })
		})

		it('does not reflect a pending status before the throttle fires', async () => {
			const self = makeSelf()
			const manager = await makeManager(self, { status: InstanceStatus.Ok, message: 'initial' })

			manager.updateStatus(InstanceStatus.Disconnected, 'problem')
			// Don't advance timers

			expect(manager.status.status).toBe(InstanceStatus.Ok)
		})
	})
})
