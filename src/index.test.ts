import snmp from 'net-snmp'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock @companion-module/base BEFORE importing the module under test
// ---------------------------------------------------------------------------

vi.mock('@companion-module/base', () => {
	class InstanceBase {
		id = 'test-instance'
		label = 'test'
		log = vi.fn()
		updateStatus = vi.fn()
		checkFeedbacks = vi.fn()
		checkFeedbacksById = vi.fn()
		setActionDefinitions = vi.fn()
		setFeedbackDefinitions = vi.fn()
		createSharedUdpSocket = vi.fn()
		constructor(_internal: unknown) {}
	}
	return {
		InstanceBase,
		InstanceStatus: { Ok: 'ok', Disconnected: 'disconnected', BadConfig: 'bad_config' },
	}
})

vi.mock('./configs.js', () => ({
	default: () => [],
}))

vi.mock('./actions.js', () => ({ default: () => ({}) }))
vi.mock('./feedbacks.js', () => ({ default: () => ({}) }))
vi.mock('./upgrades.js', () => ({ default: [] }))

vi.mock('dns', () => ({
	default: { lookup: vi.fn((_host, cb) => cb(null, '127.0.0.1')) },
}))

import Generic_SNMP from './index.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const BASE_CONFIG = {
	ip: '192.168.1.1',
	port: 161,
	trapPort: 162,
	portBind: 162,
	version: 'v2c' as const,
	community: 'public',
	securityLevel: 'noAuthNoPriv',
	authProtocol: 'md5',
	privProtocol: 'des',
	engineID: '',
	username: '',
	traps: false,
	walk: '',
	interval: 0,
	verbose: false,
}

const BASE_SECRETS = { authKey: '', privKey: '' }

function makeInstance(): Generic_SNMP {
	return new Generic_SNMP(null)
}

/** Create a minimal valid varbind */
function makeVarbind(oid: string, type: snmp.ObjectType, value: unknown): snmp.Varbind {
	return { oid, type, value } as snmp.Varbind
}

/** Mock a session object with spies */
function makeMockSession() {
	return {
		close: vi.fn(),
		get: vi.fn(),
		set: vi.fn(),
		walk: vi.fn(),
		inform: vi.fn(),
		trap: vi.fn(),
	}
}

// ---------------------------------------------------------------------------
// getOidChoices
// ---------------------------------------------------------------------------

describe('getOidChoices', () => {
	let instance: Generic_SNMP

	beforeEach(() => {
		instance = makeInstance()
		instance.oidValues.set('1.3.6.1.1', makeVarbind('1.3.6.1.1', snmp.ObjectType.Integer, 1))
		instance.oidValues.set('1.3.6.1.2', makeVarbind('1.3.6.1.2', snmp.ObjectType.OctetString, 'hello'))
		instance.oidValues.set('1.3.6.1.3', makeVarbind('1.3.6.1.3', snmp.ObjectType.Integer, 42))
	})

	it('returns all OIDs when no type filter is provided', () => {
		expect(instance.getOidChoices()).toHaveLength(3)
	})

	it('filters by a single type and omits the type label', () => {
		const choices = instance.getOidChoices(snmp.ObjectType.Integer)
		expect(choices).toHaveLength(2)
		choices.forEach((c) => expect(c.label).toBe(c.id))
	})

	it('includes the type name in the label when multiple types are requested', () => {
		const choices = instance.getOidChoices(snmp.ObjectType.Integer, snmp.ObjectType.OctetString)
		const octetChoice = choices.find((c) => c.id === '1.3.6.1.2')
		expect(octetChoice?.label).toContain('OctetString')
	})

	it('includes the type name in the label when no filter is applied', () => {
		const choices = instance.getOidChoices()
		choices.forEach((c) => expect(c.label).toMatch(/\(.+\)/))
	})

	it('returns an empty array when no OIDs match the type filter', () => {
		expect(instance.getOidChoices(snmp.ObjectType.IpAddress)).toHaveLength(0)
	})

	it('returns correct id and label shape', () => {
		const [choice] = instance.getOidChoices(snmp.ObjectType.Integer)
		expect(choice).toHaveProperty('id')
		expect(choice).toHaveProperty('label')
		expect(choice.id).toMatch(/^1\.3\.6\.1/)
	})
})

// ---------------------------------------------------------------------------
// handleVarbind (tested via its observable side-effects)
// ---------------------------------------------------------------------------

describe('handleVarbind', () => {
	let instance: Generic_SNMP
	const handle = (inst: Generic_SNMP, varbind: snmp.Varbind, index = 0) => (inst as any).handleVarbind(varbind, index)

	beforeEach(() => {
		instance = makeInstance()
		;(instance as any).config = BASE_CONFIG
		;(instance as any).secrets = BASE_SECRETS
	})

	afterEach(() => {
		;(instance as any).throttledFeedbackIdCheck.cancel()
		vi.useRealTimers()
	})

	it('caches a valid varbind in oidValues', () => {
		handle(instance, makeVarbind('1.3.6.1.1', snmp.ObjectType.Integer, 5))
		expect(instance.oidValues.has('1.3.6.1.1')).toBe(true)
	})

	it('updates an existing OID entry', () => {
		handle(instance, makeVarbind('1.3.6.1.1', snmp.ObjectType.Integer, 1))
		handle(instance, makeVarbind('1.3.6.1.1', snmp.ObjectType.Integer, 99))
		expect((instance.oidValues.get('1.3.6.1.1') as snmp.Varbind).value).toBe(99)
	})

	it('does not cache NoSuchObject type', () => {
		handle(instance, makeVarbind('1.3.6.1.1', snmp.ObjectType.NoSuchObject, null))
		expect(instance.oidValues.has('1.3.6.1.1')).toBe(false)
	})

	it('does not cache NoSuchInstance type', () => {
		handle(instance, makeVarbind('1.3.6.1.1', snmp.ObjectType.NoSuchInstance, null))
		expect(instance.oidValues.has('1.3.6.1.1')).toBe(false)
	})

	it('does not cache EndOfMibView type', () => {
		handle(instance, makeVarbind('1.3.6.1.1', snmp.ObjectType.EndOfMibView, null))
		expect(instance.oidValues.has('1.3.6.1.1')).toBe(false)
	})

	it('queues feedback checks for registered watchers', () => {
		instance.oidTracker.addFeedback('fb1', '1.3.6.1.1', false)
		handle(instance, makeVarbind('1.3.6.1.1', snmp.ObjectType.Integer, 1))
		expect((instance as any).feedbackIdsToCheck.has('fb1')).toBe(true)
	})

	it('does not queue feedback check when no watchers are registered', () => {
		handle(instance, makeVarbind('1.3.6.1.9', snmp.ObjectType.Integer, 1))
		expect((instance as any).feedbackIdsToCheck.size).toBe(0)
	})

	it('logs a warning for a varbind error', () => {
		const errorVarbind = { oid: '1.3.6.1.1', type: snmp.ObjectType.NoSuchObject, value: null }
		vi.spyOn(snmp, 'isVarbindError').mockReturnValueOnce(true)
		vi.spyOn(snmp, 'varbindError').mockReturnValueOnce('some error')
		handle(instance, errorVarbind as snmp.Varbind)
		expect(instance.log).toHaveBeenCalledWith('warn', 'some error')
	})
})

// ---------------------------------------------------------------------------
// setOid
// ---------------------------------------------------------------------------

describe('setOid', () => {
	let instance: Generic_SNMP
	let session: ReturnType<typeof makeMockSession>

	beforeEach(() => {
		instance = makeInstance()
		session = makeMockSession()
		;(instance as any).config = BASE_CONFIG
		;(instance as any).secrets = BASE_SECRETS
		;(instance as any).session = session
	})

	it('calls session.set with the correct varbind', async () => {
		session.set.mockImplementation((_varbinds: snmp.Varbind[], cb: (err: Error | null) => void) => cb(null))
		await instance.setOid('1.3.6.1.1', snmp.ObjectType.Integer, 42)
		expect(session.set).toHaveBeenCalledWith(
			[{ oid: '1.3.6.1.1', type: snmp.ObjectType.Integer, value: 42 }],
			expect.any(Function),
		)
	})

	it('strips leading dots from the OID', async () => {
		session.set.mockImplementation((_varbinds: snmp.Varbind[], cb: (err: Error | null) => void) => cb(null))
		await instance.setOid('.1.3.6.1.1', snmp.ObjectType.Integer, 1)
		expect(session.set).toHaveBeenCalledWith(
			expect.arrayContaining([expect.objectContaining({ oid: '1.3.6.1.1' })]),
			expect.any(Function),
		)
	})

	it('rejects when the OID is invalid', async () => {
		await expect(instance.setOid('not-an-oid', snmp.ObjectType.Integer, 1)).rejects.toThrow(/Invalid OID/)
	})

	it('rejects when the session is null', async () => {
		;(instance as any).session = null
		await expect(instance.setOid('1.3.6.1.1', snmp.ObjectType.Integer, 1)).rejects.toThrow(/session not initialized/)
	})

	it('rejects when the session returns an error', async () => {
		session.set.mockImplementation((_varbinds: snmp.Varbind[], cb: (err: Error | null) => void) =>
			cb(new Error('network failure')),
		)
		await expect(instance.setOid('1.3.6.1.1', snmp.ObjectType.Integer, 1)).rejects.toThrow('network failure')
	})
})

// ---------------------------------------------------------------------------
// getOid
// ---------------------------------------------------------------------------

describe('getOid', () => {
	let instance: Generic_SNMP
	let session: ReturnType<typeof makeMockSession>

	beforeEach(() => {
		instance = makeInstance()
		session = makeMockSession()
		;(instance as any).session = session
	})

	it('calls session.get with the correct OIDs', async () => {
		session.get.mockImplementation((_oids: string[], cb: (err: Error | null, varbinds: snmp.Varbind[]) => void) =>
			cb(null, []),
		)
		await instance.getOid('1.3.6.1.1')
		expect(session.get).toHaveBeenCalledWith(['1.3.6.1.1'], expect.any(Function))
	})

	it('accepts an array of OIDs', async () => {
		session.get.mockImplementation((_oids: string[], cb: (err: Error | null, varbinds: snmp.Varbind[]) => void) =>
			cb(null, []),
		)
		await instance.getOid(['1.3.6.1.1', '1.3.6.1.2'])
		expect(session.get).toHaveBeenCalledWith(['1.3.6.1.1', '1.3.6.1.2'], expect.any(Function))
	})

	it('skips invalid OIDs and logs a warning', async () => {
		session.get.mockImplementation((_oids: string[], cb: (err: Error | null, varbinds: snmp.Varbind[]) => void) =>
			cb(null, []),
		)
		await instance.getOid(['1.3.6.1.1', 'bad-oid'])
		expect(session.get).toHaveBeenCalledWith(['1.3.6.1.1'], expect.any(Function))
		expect(instance.log).toHaveBeenCalledWith('warn', expect.stringContaining('bad-oid'))
	})

	it('returns early without calling session.get when all OIDs are invalid', async () => {
		await instance.getOid('not-valid')
		expect(session.get).not.toHaveBeenCalled()
	})

	it('caches the returned varbinds', async () => {
		const varbind = makeVarbind('1.3.6.1.1', snmp.ObjectType.Integer, 7)
		session.get.mockImplementation((_oids: string[], cb: (err: Error | null, varbinds: snmp.Varbind[]) => void) =>
			cb(null, [varbind]),
		)
		await instance.getOid('1.3.6.1.1')
		expect(instance.oidValues.has('1.3.6.1.1')).toBe(true)
	})

	it('rejects when the session is null', async () => {
		;(instance as any).session = null
		await expect(instance.getOid('1.3.6.1.1')).rejects.toThrow(/session not initialized/)
	})
})

// ---------------------------------------------------------------------------
// walk
// ---------------------------------------------------------------------------

describe('walk', () => {
	let instance: Generic_SNMP
	let session: ReturnType<typeof makeMockSession>

	beforeEach(() => {
		instance = makeInstance()
		session = makeMockSession()
		;(instance as any).session = session
	})

	it('calls session.walk with the correct OID', async () => {
		session.walk.mockImplementation(
			(_oid: string, _feedCb: (varbinds: snmp.Varbind[]) => void, doneCb: (err: Error | null) => void) => doneCb(null),
		)
		await instance.walk('1.3.6.1')
		expect(session.walk).toHaveBeenCalledWith('1.3.6.1', expect.any(Function), expect.any(Function))
	})

	it('caches varbinds received during the walk', async () => {
		const varbind = makeVarbind('1.3.6.1.1', snmp.ObjectType.Integer, 3)
		session.walk.mockImplementation(
			(_oid: string, feedCb: (varbinds: snmp.Varbind[]) => void, doneCb: (err: Error | null) => void) => {
				feedCb([varbind])
				doneCb(null)
			},
		)
		await instance.walk('1.3.6.1')
		expect(instance.oidValues.has('1.3.6.1.1')).toBe(true)
	})

	it('returns early and logs a warning for an invalid OID', async () => {
		await instance.walk('bad-oid')
		expect(session.walk).not.toHaveBeenCalled()
		expect(instance.log).toHaveBeenCalledWith('warn', expect.stringContaining('bad-oid'))
	})

	it('rejects when the session is null', async () => {
		;(instance as any).session = null
		await expect(instance.walk('1.3.6.1')).rejects.toThrow(/session not initialized/)
	})

	it('rejects when session.walk signals an error', async () => {
		session.walk.mockImplementation(
			(_oid: string, _feedCb: (varbinds: snmp.Varbind[]) => void, doneCb: (err: Error | null) => void) =>
				doneCb(new Error('walk failed')),
		)
		await expect(instance.walk('1.3.6.1')).rejects.toThrow('walk failed')
	})
})

// ---------------------------------------------------------------------------
// sendInform
// ---------------------------------------------------------------------------

describe('sendInform', () => {
	let instance: Generic_SNMP
	let session: ReturnType<typeof makeMockSession>

	beforeEach(() => {
		instance = makeInstance()
		session = makeMockSession()
		;(instance as any).session = session
	})

	it('calls session.inform with a numeric TrapType', async () => {
		session.inform.mockImplementation(
			(_type: snmp.TrapType, _varbinds: snmp.Varbind[], cb: (err: Error | null) => void) => cb(null),
		)
		await instance.sendInform(snmp.TrapType.ColdStart)
		expect(session.inform).toHaveBeenCalledWith(snmp.TrapType.ColdStart, [], expect.any(Function))
	})

	it('calls session.inform with a valid enterprise OID string', async () => {
		session.inform.mockImplementation((_oid: string, _varbinds: snmp.Varbind[], cb: (err: Error | null) => void) =>
			cb(null),
		)
		await instance.sendInform('1.3.6.1.4.1.999')
		expect(session.inform).toHaveBeenCalledWith('1.3.6.1.4.1.999', [], expect.any(Function))
	})

	it('rejects when the enterprise OID string is invalid', async () => {
		await expect(instance.sendInform('not-an-oid')).rejects.toThrow(/Invalid Enterprise OID/)
	})

	it('rejects when the session is null', async () => {
		;(instance as any).session = null
		await expect(instance.sendInform(snmp.TrapType.ColdStart)).rejects.toThrow(/session not init/)
	})

	it('rejects when session.inform returns an error', async () => {
		session.inform.mockImplementation(
			(_type: snmp.TrapType, _varbinds: snmp.Varbind[], cb: (err: Error | null) => void) =>
				cb(new Error('inform failed')),
		)
		await expect(instance.sendInform(snmp.TrapType.ColdStart)).rejects.toThrow('inform failed')
	})
})

// ---------------------------------------------------------------------------
// sendTrap
// ---------------------------------------------------------------------------

describe('sendTrap', () => {
	let instance: Generic_SNMP
	let session: ReturnType<typeof makeMockSession>

	beforeEach(() => {
		instance = makeInstance()
		session = makeMockSession()
		;(instance as any).session = session
	})

	it('calls session.trap with a numeric TrapType', async () => {
		session.trap.mockImplementation(
			(_type: snmp.TrapType, _varbinds: snmp.Varbind[], _agentAddr: string, cb: (err: Error | null) => void) =>
				cb(null),
		)
		await instance.sendTrap(snmp.TrapType.LinkUp)
		expect(session.trap).toHaveBeenCalledWith(snmp.TrapType.LinkUp, [], expect.any(String), expect.any(Function))
	})

	it('calls session.trap with a valid enterprise OID string', async () => {
		session.trap.mockImplementation(
			(_oid: string, _varbinds: snmp.Varbind[], _agentAddr: string, cb: (err: Error | null) => void) => cb(null),
		)
		await instance.sendTrap('1.3.6.1.4.1.999')
		expect(session.trap).toHaveBeenCalledWith('1.3.6.1.4.1.999', [], expect.any(String), expect.any(Function))
	})

	it('rejects when the enterprise OID string is invalid', async () => {
		await expect(instance.sendTrap('bad-oid')).rejects.toThrow(/Invalid Enterprise OID/)
	})

	it('rejects when the session is null', async () => {
		;(instance as any).session = null
		await expect(instance.sendTrap(snmp.TrapType.ColdStart)).rejects.toThrow(/session not init/)
	})

	it('rejects when session.trap returns an error', async () => {
		session.trap.mockImplementation(
			(_type: snmp.TrapType, _varbinds: snmp.Varbind[], _agentAddr: string, cb: (err: Error | null) => void) =>
				cb(new Error('trap failed')),
		)
		await expect(instance.sendTrap(snmp.TrapType.ColdStart)).rejects.toThrow('trap failed')
	})
})
