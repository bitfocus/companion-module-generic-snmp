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
		setVariableDefinitions = vi.fn()
		setVariableValues = vi.fn()
		createSharedUdpSocket = vi.fn()
		constructor(_internal: unknown) {}
	}
	return {
		InstanceBase,
		InstanceStatus: { Ok: 'ok', Disconnected: 'disconnected', BadConfig: 'bad_config' },
	}
})

vi.mock('../configs.js', () => ({
	default: () => [],
}))

vi.mock('../actions.js', () => ({ default: () => ({}) }))
vi.mock('../feedbacks.js', () => ({ default: () => ({}) }))
vi.mock('../upgrades.js', () => ({ default: [] }))

vi.mock('dns', () => ({
	default: { lookup: vi.fn((_host, cb) => cb(null, '127.0.0.1')) },
}))

import Generic_SNMP from '../index.js'

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
	variables: false,
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

	beforeEach(async () => {
		vi.useFakeTimers()
		instance = makeInstance()
		;(instance as any).config = BASE_CONFIG
		;(instance as any).secrets = BASE_SECRETS
		await vi.runAllTimersAsync()
		;(instance as any).statusManager['setNewStatus'].mock?.mockClear?.()
	})

	afterEach(() => {
		;(instance as any).throttledFeedbackIdCheck.cancel()
		;(instance as any).statusManager.setNewStatus.flush()
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
		handle(instance, errorVarbind)
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
		;(instance as any).config = BASE_CONFIG
		session = makeMockSession()
		;(instance as any).session = session
	})

	it('calls session.get with the correct OIDs', async () => {
		session.get.mockImplementation((_oids: string[], cb: (err: Error | null, varbinds: snmp.Varbind[]) => void) =>
			cb(null, []),
		)
		await instance.getOid(['1.3.6.1.1'])
		expect(session.get).toHaveBeenCalledWith(['1.3.6.1.1'], expect.any(Function))
	})

	it('accepts a spread array of OIDs', async () => {
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
		await instance.getOid(['not-valid'])
		expect(session.get).not.toHaveBeenCalled()
	})

	it('caches the returned varbinds', async () => {
		const varbind = makeVarbind('1.3.6.1.1', snmp.ObjectType.Integer, 7)
		session.get.mockImplementation((_oids: string[], cb: (err: Error | null, varbinds: snmp.Varbind[]) => void) =>
			cb(null, [varbind]),
		)
		await instance.getOid(['1.3.6.1.1'])
		expect(instance.oidValues.has('1.3.6.1.1')).toBe(true)
	})

	it('rejects when the session is null', async () => {
		;(instance as any).session = null
		await expect(instance.getOid(['1.3.6.1.1'])).rejects.toThrow(/session not initialized/)
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
		;(instance as any).config = BASE_CONFIG
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

	it('rejects when passed an invalid OID', async () => {
		await expect(instance.walk('bad-oid')).rejects.toThrow(/Invalid OID/)
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

// ---------------------------------------------------------------------------
// getOidsToPoll
// ---------------------------------------------------------------------------

describe('getOidsToPoll', () => {
	let instance: Generic_SNMP
	const oidsToPoll = (inst: Generic_SNMP): string[] => (inst as any).getOidsToPoll()

	beforeEach(() => {
		instance = makeInstance()
		;(instance as any).config = { ...BASE_CONFIG }
	})

	it('polls only the feedback watched OIDs when connection variables are off', () => {
		instance.oidValues.set('1.3.6.1.2.1.1.5.0', makeVarbind('1.3.6.1.2.1.1.5.0', snmp.ObjectType.Integer, 1))
		instance.oidTracker.addToPollGroup('1.3.6.1.2.1.1.3.0', 'feedback-1')
		expect(oidsToPoll(instance)).toStrictEqual(['1.3.6.1.2.1.1.3.0'])
	})

	it('polls every cached OID when connection variables are on', () => {
		;(instance as any).config.variables = true
		instance.oidValues.set('1.3.6.1.2.1.1.5.0', makeVarbind('1.3.6.1.2.1.1.5.0', snmp.ObjectType.Integer, 1))
		instance.oidValues.set('1.3.6.1.2.1.1.7.0', makeVarbind('1.3.6.1.2.1.1.7.0', snmp.ObjectType.Integer, 72))
		expect(oidsToPoll(instance).sort()).toStrictEqual(['1.3.6.1.2.1.1.5.0', '1.3.6.1.2.1.1.7.0'])
	})

	// A feedback can watch an OID that is not in oidValues: handleVarbind refuses to
	// cache NoSuchObject, NoSuchInstance and EndOfMibView, and an unreachable OID has
	// never been cached at all. Dropping it from the poll would strand the feedback.
	it('keeps polling a feedback watched OID that has never been cached', () => {
		;(instance as any).config.variables = true
		instance.oidValues.set('1.3.6.1.2.1.1.5.0', makeVarbind('1.3.6.1.2.1.1.5.0', snmp.ObjectType.Integer, 1))
		instance.oidTracker.addToPollGroup('1.3.6.1.2.1.1.3.0', 'feedback-1')
		expect(oidsToPoll(instance).sort()).toStrictEqual(['1.3.6.1.2.1.1.3.0', '1.3.6.1.2.1.1.5.0'])
	})

	it('does not request an OID twice when it is both cached and feedback watched', () => {
		;(instance as any).config.variables = true
		instance.oidValues.set('1.3.6.1.2.1.1.5.0', makeVarbind('1.3.6.1.2.1.1.5.0', snmp.ObjectType.Integer, 1))
		instance.oidTracker.addToPollGroup('1.3.6.1.2.1.1.5.0', 'feedback-1')
		expect(oidsToPoll(instance)).toStrictEqual(['1.3.6.1.2.1.1.5.0'])
	})
})

// ---------------------------------------------------------------------------
// connection variable definitions
// ---------------------------------------------------------------------------

describe('connection variable definitions', () => {
	let instance: Generic_SNMP
	const handle = (inst: Generic_SNMP, varbind: snmp.Varbind, index = 0) => (inst as any).handleVarbind(varbind, index)

	beforeEach(() => {
		vi.useFakeTimers()
		instance = makeInstance()
		;(instance as any).config = { ...BASE_CONFIG, variables: true }
		;(instance as any).secrets = BASE_SECRETS
	})

	afterEach(() => {
		;(instance as any).throttledFeedbackIdCheck.cancel()
		;(instance as any).debouncedUpdateDefinitions.cancel()
		;(instance as any).debouncedUpdateVariableDefinitions.cancel()
		vi.useRealTimers()
	})

	it('publishes definitions 500ms after a new OID is cached', async () => {
		handle(instance, makeVarbind('1.3.6.1.2.1.1.5.0', snmp.ObjectType.OctetString, Buffer.from('debian')))
		expect(instance.setVariableDefinitions).not.toHaveBeenCalled()

		await vi.advanceTimersByTimeAsync(500)
		expect(instance.setVariableDefinitions).toHaveBeenCalledWith({
			'1.3.6.1.2.1.1.5.0': { name: '1.3.6.1.2.1.1.5.0' },
		})
	})

	// The whole point of the debounce: a walk feeds varbinds in one at a time
	it('publishes once for a burst of new OIDs rather than once per varbind', async () => {
		for (const oid of ['1.3.6.1.2.1.1.1.0', '1.3.6.1.2.1.1.3.0', '1.3.6.1.2.1.1.5.0']) {
			handle(instance, makeVarbind(oid, snmp.ObjectType.Integer, 1))
		}
		await vi.advanceTimersByTimeAsync(500)
		expect(instance.setVariableDefinitions).toHaveBeenCalledTimes(1)
		expect(instance.setVariableDefinitions).toHaveBeenCalledWith({
			'1.3.6.1.2.1.1.1.0': { name: '1.3.6.1.2.1.1.1.0' },
			'1.3.6.1.2.1.1.3.0': { name: '1.3.6.1.2.1.1.3.0' },
			'1.3.6.1.2.1.1.5.0': { name: '1.3.6.1.2.1.1.5.0' },
		})
	})

	it('does not redefine when a known OID is refreshed with a new value', async () => {
		handle(instance, makeVarbind('1.3.6.1.2.1.1.3.0', snmp.ObjectType.TimeTicks, 34172))
		await vi.advanceTimersByTimeAsync(500)
		;(instance.setVariableDefinitions as any).mockClear()

		handle(instance, makeVarbind('1.3.6.1.2.1.1.3.0', snmp.ObjectType.TimeTicks, 34272))
		await vi.advanceTimersByTimeAsync(500)
		expect(instance.setVariableDefinitions).not.toHaveBeenCalled()
	})

	it('schedules nothing when the option is off', async () => {
		;(instance as any).config.variables = false
		handle(instance, makeVarbind('1.3.6.1.2.1.1.5.0', snmp.ObjectType.Integer, 1))
		await vi.advanceTimersByTimeAsync(500)
		expect(instance.setVariableDefinitions).not.toHaveBeenCalled()
	})
})
// ---------------------------------------------------------------------------
// resetConnectionState, via configUpdated and destroy
// ---------------------------------------------------------------------------

describe('resetConnectionState', () => {
	let instance: Generic_SNMP
	let session: ReturnType<typeof makeMockSession>

	beforeEach(() => {
		vi.useFakeTimers()
		instance = makeInstance()
		;(instance as any).config = { ...BASE_CONFIG, variables: true }
		;(instance as any).secrets = BASE_SECRETS
		session = makeMockSession()
		;(instance as any).session = session
	})

	afterEach(() => {
		;(instance as any).throttledFeedbackIdCheck.cancel()
		;(instance as any).debouncedUpdateDefinitions.cancel()
		;(instance as any).debouncedUpdateVariableDefinitions.cancel()
		vi.useRealTimers()
	})

	/** Put the instance into a state where every resource the reset drops is live */
	const dirty = (inst: Generic_SNMP) => {
		inst.oidValues.set('1.3.6.1.2.1.1.5.0', makeVarbind('1.3.6.1.2.1.1.5.0', snmp.ObjectType.Integer, 1))
		;(inst as any).debouncedUpdateDefinitions()
		;(inst as any).debouncedUpdateVariableDefinitions()
		;(inst as any).feedbackIdsToCheck.add('feedback-1')
		;(inst as any).throttledFeedbackIdCheck()
		;(inst as any).pollTimer = setTimeout(() => {}, 60_000)
	}

	const reset = (inst: Generic_SNMP) => (inst as any).resetConnectionState()

	it('clears the OID cache', () => {
		dirty(instance)
		reset(instance)
		expect(instance.oidValues.size).toBe(0)
	})

	it('bumps the poll generation so in flight requests bail out', () => {
		const before = (instance as any).pollGeneration
		reset(instance)
		expect((instance as any).pollGeneration).toBe(before + 1)
	})

	it('clears the poll timer', () => {
		dirty(instance)
		reset(instance)
		expect((instance as any).pollTimer).toBeUndefined()
	})

	// A pending debounce firing after the reset would repopulate definitions from a
	// cache that belongs to the previous configuration
	it('cancels the pending definition updates so they cannot fire afterwards', async () => {
		dirty(instance)
		reset(instance)
		;(instance.setVariableDefinitions as any).mockClear()
		;(instance.setActionDefinitions as any).mockClear()

		await vi.advanceTimersByTimeAsync(1000)
		expect(instance.setVariableDefinitions).not.toHaveBeenCalled()
		expect(instance.setActionDefinitions).not.toHaveBeenCalled()
	})

	it('cancels the pending feedback check', async () => {
		dirty(instance)
		reset(instance)
		;(instance.checkFeedbacksById as any).mockClear()

		await vi.advanceTimersByTimeAsync(1000)
		expect(instance.checkFeedbacksById).not.toHaveBeenCalled()
	})

	it('closes the trap listener', () => {
		const receiver = { close: vi.fn() }
		;(instance as any).receiver = receiver
		reset(instance)
		expect(receiver.close).toHaveBeenCalled()
		expect((instance as any).receiver).toBeNull()
	})

	it('leaves the SNMP session alone, configUpdated reconnects with it replaced', () => {
		reset(instance)
		expect(session.close).not.toHaveBeenCalled()
		expect((instance as any).session).toBe(session)
	})

	it('destroy closes the SNMP session as well', async () => {
		await instance.destroy()
		expect(session.close).toHaveBeenCalled()
		expect((instance as any).session).toBeNull()
	})

	it('destroy drops the cache', async () => {
		dirty(instance)
		await instance.destroy()
		expect(instance.oidValues.size).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// AbortSignal
// ---------------------------------------------------------------------------

describe('abort signal', () => {
	let instance: Generic_SNMP
	let session: ReturnType<typeof makeMockSession>
	let aborted: AbortSignal

	beforeEach(() => {
		instance = makeInstance()
		;(instance as any).config = { ...BASE_CONFIG }
		session = makeMockSession()
		;(instance as any).session = session
		const controller = new AbortController()
		controller.abort()
		aborted = controller.signal
	})

	// p-queue rejects an aborted entry with a DOMException named AbortError and never
	// runs the task, so the SNMP session is never touched
	it('getOid rejects and never reaches the session', async () => {
		await expect(instance.getOid(['1.3.6.1.2.1.1.5.0'], aborted)).rejects.toThrow(/aborted/i)
		expect(session.get).not.toHaveBeenCalled()
	})

	it('setOid rejects and never reaches the session', async () => {
		await expect(instance.setOid('1.3.6.1.2.1.1.5.0', snmp.ObjectType.Integer, 1, aborted)).rejects.toThrow(/aborted/i)
		expect(session.set).not.toHaveBeenCalled()
	})

	it('walk rejects and never reaches the session', async () => {
		await expect(instance.walk('1.3.6.1.2.1.1', aborted)).rejects.toThrow(/aborted/i)
		expect(session.walk).not.toHaveBeenCalled()
	})

	it('sendTrap rejects and never reaches the session', async () => {
		await expect(instance.sendTrap(snmp.TrapType.ColdStart, [], aborted)).rejects.toThrow(/aborted/i)
		expect(session.trap).not.toHaveBeenCalled()
	})

	it('sendInform rejects and never reaches the session', async () => {
		await expect(instance.sendInform(snmp.TrapType.ColdStart, [], aborted)).rejects.toThrow(/aborted/i)
		expect(session.inform).not.toHaveBeenCalled()
	})

	it('rejects with an AbortError rather than an SNMP error', async () => {
		await expect(instance.getOid(['1.3.6.1.2.1.1.5.0'], aborted)).rejects.toMatchObject({ name: 'AbortError' })
	})

	// Without a signal the queue entry must still run, the parameter is optional
	it('runs normally when no signal is passed', async () => {
		session.get.mockImplementation((_oids: string[], cb: (e: Error | null, v: snmp.Varbind[]) => void) => cb(null, []))
		await instance.getOid(['1.3.6.1.2.1.1.5.0'])
		expect(session.get).toHaveBeenCalledWith(['1.3.6.1.2.1.1.5.0'], expect.any(Function))
	})

	// getOid filters invalid OIDs before queueing, so an all invalid call returns early
	it('getOid returns without queueing when every OID is invalid', async () => {
		await expect(instance.getOid(['not-an-oid'], aborted)).resolves.toBeUndefined()
		expect(session.get).not.toHaveBeenCalled()
	})
})
