import { EventEmitter } from 'events'
import { RemoteInfo } from 'dgram'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SharedUDPSocketWrapper } from './wrapper.js'

// ---------------------------------------------------------------------------
// Minimal SharedUdpSocket mock
// ---------------------------------------------------------------------------

function createMockSocket() {
	const emitter = new EventEmitter()
	return {
		on: vi.fn((event, handler) => emitter.on(event, handler)),
		removeListener: vi.fn((event, handler) => emitter.removeListener(event, handler)),
		send: vi.fn(),
		// Helper to simulate an incoming UDP message in tests
		_emit: (msg: Buffer, rinfo: RemoteInfo) => emitter.emit('message', msg, rinfo),
	}
}

type MockSocket = ReturnType<typeof createMockSocket>

const VALID_ADDRESS = '192.168.1.100'
const OTHER_ADDRESS = '10.0.0.1'
const VALID_PORT = 162

function makeRinfo(address: string): RemoteInfo {
	return { address, family: 'IPv4', port: 12345, size: 0 }
}

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('SharedUDPSocketWrapper constructor', () => {
	let mockSocket: MockSocket

	beforeEach(() => {
		mockSocket = createMockSocket()
	})

	it('creates an instance with correct initial properties', () => {
		const wrapper = new SharedUDPSocketWrapper(mockSocket as any, VALID_PORT, VALID_ADDRESS)
		expect(wrapper.port).toBe(VALID_PORT)
		expect(wrapper.allowedAddress).toBe(VALID_ADDRESS)
		expect(wrapper.isShared).toBe(true)
	})

	it('registers the message handler on the shared socket', () => {
		new SharedUDPSocketWrapper(mockSocket as any, VALID_PORT, VALID_ADDRESS)
		expect(mockSocket.on).toHaveBeenCalledWith('message', expect.any(Function))
	})

	it('throws on a port below the valid range', () => {
		expect(() => new SharedUDPSocketWrapper(mockSocket as any, 0, VALID_ADDRESS)).toThrow(/Port out of range/)
	})

	it('throws on a port above the valid range', () => {
		expect(() => new SharedUDPSocketWrapper(mockSocket as any, 65536, VALID_ADDRESS)).toThrow(/Port out of range/)
	})

	it('throws on a non-integer port', () => {
		expect(() => new SharedUDPSocketWrapper(mockSocket as any, 80.5, VALID_ADDRESS)).toThrow(/Port out of range/)
	})

	it('throws on an invalid IP address', () => {
		expect(() => new SharedUDPSocketWrapper(mockSocket as any, VALID_PORT, 'not-an-ip')).toThrow(
			/Allowed Address must be a IPv4 address/,
		)
	})

	it('throws on an IPv6 address', () => {
		expect(() => new SharedUDPSocketWrapper(mockSocket as any, VALID_PORT, '::1')).toThrow(
			/Allowed Address must be a IPv4 address/,
		)
	})

	it('throws on an IP address with an out-of-range octet', () => {
		expect(() => new SharedUDPSocketWrapper(mockSocket as any, VALID_PORT, '192.168.1.256')).toThrow(
			/Allowed Address must be a IPv4 address/,
		)
	})
})

// ---------------------------------------------------------------------------
// messageHandler
// ---------------------------------------------------------------------------

describe('messageHandler', () => {
	let mockSocket: MockSocket
	let wrapper: SharedUDPSocketWrapper

	beforeEach(() => {
		mockSocket = createMockSocket()
		wrapper = new SharedUDPSocketWrapper(mockSocket as any, VALID_PORT, VALID_ADDRESS)
	})

	it('emits "message" when the source address matches allowedAddress', () => {
		const listener = vi.fn()
		wrapper.on('message', listener)

		const msg = Buffer.from('test')
		mockSocket._emit(msg, makeRinfo(VALID_ADDRESS))

		expect(listener).toHaveBeenCalledOnce()
	})

	it('does not emit "message" when the source address does not match', () => {
		const listener = vi.fn()
		wrapper.on('message', listener)

		mockSocket._emit(Buffer.from('test'), makeRinfo(OTHER_ADDRESS))

		expect(listener).not.toHaveBeenCalled()
	})

	it('emits a copy of the buffer, not the original reference', () => {
		let received: Buffer | undefined
		wrapper.on('message', (msg: Buffer) => {
			received = msg
		})

		const original = Buffer.from('hello')
		mockSocket._emit(original, makeRinfo(VALID_ADDRESS))

		expect(received).not.toBe(original)
		expect(received?.toString()).toBe('hello')
	})

	it('passes rinfo through to the listener', () => {
		let receivedRinfo: RemoteInfo | undefined
		wrapper.on('message', (_msg: Buffer, rinfo: RemoteInfo) => {
			receivedRinfo = rinfo
		})

		const rinfo = makeRinfo(VALID_ADDRESS)
		mockSocket._emit(Buffer.from('x'), rinfo)

		expect(receivedRinfo).toBe(rinfo)
	})
})

// ---------------------------------------------------------------------------
// setAllowedAddress
// ---------------------------------------------------------------------------

describe('setAllowedAddress', () => {
	let mockSocket: MockSocket
	let wrapper: SharedUDPSocketWrapper

	beforeEach(() => {
		mockSocket = createMockSocket()
		wrapper = new SharedUDPSocketWrapper(mockSocket as any, VALID_PORT, VALID_ADDRESS)
	})

	it('updates the allowed address', () => {
		wrapper.setAllowedAddress('10.0.0.1')
		expect(wrapper.allowedAddress).toBe('10.0.0.1')
	})

	it('filters by the new address after update', () => {
		const listener = vi.fn()
		wrapper.on('message', listener)

		wrapper.setAllowedAddress(OTHER_ADDRESS)

		// Old address should now be filtered out
		mockSocket._emit(Buffer.from('old'), makeRinfo(VALID_ADDRESS))
		expect(listener).not.toHaveBeenCalled()

		// New address should pass through
		mockSocket._emit(Buffer.from('new'), makeRinfo(OTHER_ADDRESS))
		expect(listener).toHaveBeenCalledOnce()
	})

	it('throws on an invalid IP address', () => {
		expect(() => wrapper.setAllowedAddress('bad')).toThrow(/Allowed Address must be a IPv4 address/)
	})

	it('does not change the address if the new value is invalid', () => {
		expect(() => wrapper.setAllowedAddress('999.999.999.999')).toThrow()
		expect(wrapper.allowedAddress).toBe(VALID_ADDRESS)
	})
})

// ---------------------------------------------------------------------------
// bind
// ---------------------------------------------------------------------------

describe('bind', () => {
	let wrapper: SharedUDPSocketWrapper

	beforeEach(() => {
		wrapper = new SharedUDPSocketWrapper(createMockSocket() as any, VALID_PORT, VALID_ADDRESS)
	})

	it('calls the callback asynchronously', async () =>
		new Promise<void>((resolve) => {
			wrapper.bind(VALID_PORT, '0.0.0.0', resolve)
		}))

	it('emits "listening"', async () =>
		new Promise<void>((resolve) => {
			wrapper.once('listening', resolve)
			wrapper.bind(VALID_PORT, '0.0.0.0')
		}))

	it('does not throw when no callback is provided', () => {
		expect(() => wrapper.bind(VALID_PORT, '0.0.0.0')).not.toThrow()
	})
})

// ---------------------------------------------------------------------------
// address
// ---------------------------------------------------------------------------

describe('address', () => {
	it('returns the correct address info', () => {
		const wrapper = new SharedUDPSocketWrapper(createMockSocket() as any, 514, VALID_ADDRESS)
		expect(wrapper.address()).toEqual({ address: '0.0.0.0', family: 'IPv4', port: 514 })
	})
})

// ---------------------------------------------------------------------------
// type
// ---------------------------------------------------------------------------

describe('type', () => {
	it('returns "udp4"', () => {
		const wrapper = new SharedUDPSocketWrapper(createMockSocket() as any, VALID_PORT, VALID_ADDRESS)
		expect(wrapper.type).toBe('udp4')
	})
})

// ---------------------------------------------------------------------------
// createSocket
// ---------------------------------------------------------------------------

describe('createSocket', () => {
	it('returns itself', () => {
		const wrapper = new SharedUDPSocketWrapper(createMockSocket() as any, VALID_PORT, VALID_ADDRESS)
		expect(wrapper.createSocket('udp4')).toBe(wrapper)
	})
})

// ---------------------------------------------------------------------------
// close
// ---------------------------------------------------------------------------

describe('close', () => {
	let mockSocket: MockSocket
	let wrapper: SharedUDPSocketWrapper

	beforeEach(() => {
		mockSocket = createMockSocket()
		wrapper = new SharedUDPSocketWrapper(mockSocket as any, VALID_PORT, VALID_ADDRESS)
	})

	it('removes the message listener from the shared socket', () => {
		wrapper.close()
		expect(mockSocket.removeListener).toHaveBeenCalledWith('message', wrapper.messageHandler)
	})

	it('calls the callback asynchronously', async () =>
		new Promise<void>((resolve) => {
			wrapper.close(resolve)
		}))

	it('stops forwarding messages after close', () => {
		const listener = vi.fn()
		wrapper.on('message', listener)

		wrapper.close()
		mockSocket._emit(Buffer.from('after close'), makeRinfo(VALID_ADDRESS))

		expect(listener).not.toHaveBeenCalled()
	})

	it('does not throw when no callback is provided', () => {
		expect(() => wrapper.close()).not.toThrow()
	})
})

// ---------------------------------------------------------------------------
// send
// ---------------------------------------------------------------------------

describe('send', () => {
	it('delegates to the shared socket send method with all arguments', () => {
		const mockSocket = createMockSocket()
		const wrapper = new SharedUDPSocketWrapper(mockSocket as any, VALID_PORT, VALID_ADDRESS)

		const msg = Buffer.from('payload')
		const cb = vi.fn()
		wrapper.send(msg, 0, msg.length, 162, VALID_ADDRESS, cb)

		expect(mockSocket.send).toHaveBeenCalledWith(msg, 0, msg.length, 162, VALID_ADDRESS, cb)
	})
})

// ---------------------------------------------------------------------------
// ref / unref
// ---------------------------------------------------------------------------

describe('ref and unref', () => {
	let wrapper: SharedUDPSocketWrapper

	beforeEach(() => {
		wrapper = new SharedUDPSocketWrapper(createMockSocket() as any, VALID_PORT, VALID_ADDRESS)
	})

	it('ref returns itself', () => {
		expect(wrapper.ref()).toBe(wrapper)
	})

	it('unref returns itself', () => {
		expect(wrapper.unref()).toBe(wrapper)
	})
})
