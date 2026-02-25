import snmp from 'net-snmp'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import UpdateFeedbacks, { FeedbackId } from './feedbacks.js'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@companion-module/base', () => ({}))

vi.mock('./options.js', () => ({
	OidDropdownOptions: { type: 'textinput', id: 'oid', label: 'OID' },
	DivisorOption: { type: 'number', id: 'div', label: 'Divisor', default: 1 },
	DisplayStringOption: { type: 'checkbox', id: 'displaystring', label: 'Display String', default: false },
	UpdateOption: { type: 'checkbox', id: 'update', label: 'Update', default: false },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSelf() {
	return {
		oidValues: new Map<string, snmp.Varbind>(),
		oidTracker: {
			updateFeedback: vi.fn(),
			removeFeedback: vi.fn(),
			removeFromPollGroup: vi.fn(),
		},
		getOidChoices: vi.fn().mockReturnValue([]),
		getOid: vi.fn().mockResolvedValue(undefined),
		log: vi.fn(),
	}
}

type Self = ReturnType<typeof makeSelf>

function getFeedback(self: Self) {
	const defs = UpdateFeedbacks(self as any)
	const feedback = defs[FeedbackId.GetOID]
	if (!feedback) throw new Error('Feedback not found or disabled')
	return feedback
}

const FEEDBACK_ID = 'fb-test-1'
const VALID_OID = '1.3.6.1.2.1'
const INVALID_OID = 'not-an-oid'

function makeOptions(overrides: Partial<{ oid: string; div: number; displaystring: boolean; update: boolean }> = {}) {
	return { oid: VALID_OID, div: 1, displaystring: false, update: false, ...overrides }
}

async function runCallback(self: Self, options = makeOptions(), id = FEEDBACK_ID) {
	const feedback = getFeedback(self)
	return feedback.callback({ id, options } as any, {} as any)
}

async function runLearn(self: Self, options = makeOptions(), id = FEEDBACK_ID) {
	const feedback = getFeedback(self)
	return feedback.learn?.({ id, options } as any, {} as any)
}

function runUnsubscribe(self: Self, options = makeOptions(), id = FEEDBACK_ID) {
	const feedback = getFeedback(self)
	return (feedback as any).unsubscribe?.({ id, options } as any)
}

// ---------------------------------------------------------------------------
// UpdateFeedbacks — top level
// ---------------------------------------------------------------------------

describe('UpdateFeedbacks', () => {
	it('returns a definition for GetOID', () => {
		const self = makeSelf()
		const defs = UpdateFeedbacks(self as any)
		expect(defs).toHaveProperty(FeedbackId.GetOID)
	})

	it('calls getOidChoices to populate the OID dropdown', () => {
		const self = makeSelf()
		UpdateFeedbacks(self as any)
		expect(self.getOidChoices).toHaveBeenCalled()
	})

	it('feedback type is "value"', () => {
		const self = makeSelf()
		const feedback = getFeedback(self)
		expect(feedback.type).toBe('value')
	})
})

// ---------------------------------------------------------------------------
// callback
// ---------------------------------------------------------------------------

describe(`${FeedbackId.GetOID} callback`, () => {
	let self: Self

	beforeEach(() => {
		self = makeSelf()
	})

	it('calls oidTracker.updateFeedback with the correct arguments', async () => {
		self.oidValues.set(VALID_OID, { oid: VALID_OID, type: snmp.ObjectType.Integer, value: 5 } as any)
		await runCallback(self)
		expect(self.oidTracker.updateFeedback).toHaveBeenCalledWith(FEEDBACK_ID, VALID_OID, false)
	})

	it('passes the update flag through to updateFeedback', async () => {
		self.oidValues.set(VALID_OID, { oid: VALID_OID, type: snmp.ObjectType.Integer, value: 5 } as any)
		await runCallback(self, makeOptions({ update: true }))
		expect(self.oidTracker.updateFeedback).toHaveBeenCalledWith(FEEDBACK_ID, VALID_OID, true)
	})

	it('returns the varbind value when already cached', async () => {
		self.oidValues.set(VALID_OID, { oid: VALID_OID, type: snmp.ObjectType.Integer, value: 42 } as any)
		const result = await runCallback(self)
		expect(result).toBe(42)
	})

	it('calls getOid and logs when OID is not yet cached', async () => {
		// getOid won't populate oidValues by itself in the mock, so we simulate it
		self.getOid = vi.fn().mockImplementation(async () => {
			self.oidValues.set(VALID_OID, { oid: VALID_OID, type: snmp.ObjectType.Integer, value: 7 } as any)
		})
		await runCallback(self)
		expect(self.getOid).toHaveBeenCalledWith(VALID_OID)
		expect(self.log).toHaveBeenCalledWith('info', expect.stringContaining(VALID_OID))
	})

	it('does not call getOid when OID is already cached', async () => {
		self.oidValues.set(VALID_OID, { oid: VALID_OID, type: snmp.ObjectType.Integer, value: 1 } as any)
		await runCallback(self)
		expect(self.getOid).not.toHaveBeenCalled()
	})

	it('applies the divisor when returning a numeric value', async () => {
		self.oidValues.set(VALID_OID, { oid: VALID_OID, type: snmp.ObjectType.Integer, value: 100 } as any)
		const result = await runCallback(self, makeOptions({ div: 4 }))
		expect(result).toBe(25)
	})

	it('strips a leading dot from the OID before lookup', async () => {
		self.oidValues.set(VALID_OID, { oid: VALID_OID, type: snmp.ObjectType.Integer, value: 3 } as any)
		await runCallback(self, makeOptions({ oid: `.${VALID_OID}` }))
		expect(self.oidTracker.updateFeedback).toHaveBeenCalledWith(FEEDBACK_ID, VALID_OID, false)
	})

	it('throws when varbind is not found after getOid', async () => {
		// getOid resolves but nothing gets added to oidValues
		await expect(runCallback(self)).rejects.toThrow(/Varbind not found/)
	})

	it('throws on an invalid OID', async () => {
		await expect(runCallback(self, makeOptions({ oid: INVALID_OID }))).rejects.toThrow(/Invalid OID/)
	})

	it('does not call updateFeedback before throwing on invalid OID', async () => {
		await expect(runCallback(self, makeOptions({ oid: INVALID_OID }))).rejects.toThrow()
		expect(self.oidTracker.updateFeedback).not.toHaveBeenCalled()
	})
})

// ---------------------------------------------------------------------------
// learn
// ---------------------------------------------------------------------------

describe(`${FeedbackId.GetOID} learn`, () => {
	let self: Self

	beforeEach(() => {
		self = makeSelf()
	})

	it('calls updateFeedback', async () => {
		await runLearn(self)
		expect(self.oidTracker.updateFeedback).toHaveBeenCalledWith(FEEDBACK_ID, VALID_OID, false)
	})

	it('calls getOid', async () => {
		await runLearn(self)
		expect(self.getOid).toHaveBeenCalledWith(VALID_OID)
	})

	it('always returns undefined', async () => {
		self.oidValues.set(VALID_OID, { oid: VALID_OID, type: snmp.ObjectType.Integer, value: 1 } as any)
		const result = await runLearn(self)
		expect(result).toBeUndefined()
	})

	it('throws on an invalid OID', async () => {
		await expect(runLearn(self, makeOptions({ oid: INVALID_OID }))).rejects.toThrow(/Invalid OID/)
	})

	it('does not call updateFeedback before throwing on invalid OID', async () => {
		await expect(runLearn(self, makeOptions({ oid: INVALID_OID }))).rejects.toThrow()
		expect(self.oidTracker.updateFeedback).not.toHaveBeenCalled()
	})
})

// ---------------------------------------------------------------------------
// unsubscribe
// ---------------------------------------------------------------------------

describe(`${FeedbackId.GetOID} unsubscribe`, () => {
	let self: Self

	beforeEach(() => {
		self = makeSelf()
	})

	it('calls oidTracker.removeFeedback with the feedback ID', () => {
		runUnsubscribe(self)
		expect(self.oidTracker.removeFeedback).toHaveBeenCalledWith(FEEDBACK_ID)
	})

	it('calls oidTracker.removeFromPollGroup with the trimmed OID and feedback ID', () => {
		runUnsubscribe(self)
		expect(self.oidTracker.removeFromPollGroup).toHaveBeenCalledWith(VALID_OID, FEEDBACK_ID)
	})

	it('trims a leading dot from the OID before removing from poll group', () => {
		runUnsubscribe(self, makeOptions({ oid: `.${VALID_OID}` }))
		expect(self.oidTracker.removeFromPollGroup).toHaveBeenCalledWith(VALID_OID, FEEDBACK_ID)
	})

	it('calls both removeFeedback and removeFromPollGroup', () => {
		runUnsubscribe(self)
		expect(self.oidTracker.removeFeedback).toHaveBeenCalledOnce()
		expect(self.oidTracker.removeFromPollGroup).toHaveBeenCalledOnce()
	})
})
