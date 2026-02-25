import snmp from 'net-snmp'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import UpdateActions, { ActionId } from './actions.js'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@companion-module/base', () => ({}))

vi.mock('./options.js', () => ({
	ValueOption: { type: 'textinput', id: 'value', label: 'Value' },
	DivisorOption: { type: 'number', id: 'div', label: 'Divisor', default: 1 },
	NumberObjectTypeHints: [],
	DisplayStringOption: { type: 'checkbox', id: 'displaystring', label: 'Display String', default: false },
	TrapOrInformOption: { type: 'dropdown', id: 'messageType', label: 'Message Type', choices: [], default: 'trap' },
	TrapOrOidOption: { type: 'dropdown', id: 'trapType', label: 'Trap Type', choices: [], default: 0 },
	EnterpriseOidOption: { type: 'textinput', id: 'oidEnterprise', label: 'Enterprise OID' },
	VarbindOidOption: { type: 'textinput', id: 'oidVarbind', label: 'Varbind OID' },
	ObjectTypeOptions: { type: 'dropdown', id: 'objectType', label: 'Object Type', choices: [], default: 0 },
	ObjectValueOption: { type: 'textinput', id: 'objectValue', label: 'Value' },
	ObjectTypeHints: [],
	TrapTypeHints: [],
	OidDropdownOptions: { type: 'textinput', id: 'oid', label: 'OID' },
	OidOption: { type: 'textinput', id: 'oid', label: 'OID' },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSelf(overrides: Partial<ReturnType<typeof makeBaseSelf>> = {}) {
	return { ...makeBaseSelf(), ...overrides }
}

function makeBaseSelf() {
	return {
		config: { version: 'v2c' as const },
		oidValues: new Map<string, snmp.Varbind>(),
		oidTracker: {
			addToPollGroup: vi.fn(),
			removeFromPollGroup: vi.fn(),
		},
		getOidChoices: vi.fn().mockReturnValue([]),
		setOid: vi.fn().mockResolvedValue(undefined),
		getOid: vi.fn().mockResolvedValue(undefined),
		walk: vi.fn().mockResolvedValue(undefined),
		sendInform: vi.fn().mockResolvedValue(undefined),
		sendTrap: vi.fn().mockResolvedValue(undefined),
	}
}

function makeContext(overrides = {}) {
	return {
		setCustomVariableValue: vi.fn(),
		...overrides,
	}
}

/** Build the action map and return a specific action definition */
function getAction(self: ReturnType<typeof makeSelf>, actionId: ActionId) {
	const defs = UpdateActions(self as any)
	const action = defs[actionId]
	if (!action) throw new Error(`Action ${actionId} not found or disabled`)
	return action
}

/** Invoke a callback with sensible defaults for non-tested fields */
async function runCallback(
	self: ReturnType<typeof makeSelf>,
	actionId: ActionId,
	options: Record<string, unknown>,
	context = makeContext(),
) {
	const action = getAction(self, actionId)
	return action.callback({ id: actionId, options } as any, context as any)
}

async function runLearn(
	self: ReturnType<typeof makeSelf>,
	actionId: ActionId,
	options: Record<string, unknown>,
	context = makeContext(),
) {
	const action = getAction(self, actionId)
	return action.learn?.({ id: actionId, options } as any, context as any)
}

async function runSubscribe(
	self: ReturnType<typeof makeSelf>,
	actionId: ActionId,
	options: Record<string, unknown>,
	context = makeContext(),
) {
	const action = getAction(self, actionId)
	return (action as any).subscribe?.({ id: actionId, options } as any, context as any)
}

const VALID_OID = '1.3.6.1.2.1'
const INVALID_OID = 'not-an-oid'

// ---------------------------------------------------------------------------
// UpdateActions — top level
// ---------------------------------------------------------------------------

describe('UpdateActions', () => {
	it('returns definitions for all expected action IDs', () => {
		const self = makeSelf()
		const defs = UpdateActions(self as any)
		Object.values(ActionId).forEach((id) => {
			expect(defs).toHaveProperty(id)
		})
	})

	it('calls getOidChoices to populate dropdowns', () => {
		const self = makeSelf()
		UpdateActions(self as any)
		expect(self.getOidChoices).toHaveBeenCalled()
	})
})

// ---------------------------------------------------------------------------
// SetString
// ---------------------------------------------------------------------------

describe(`${ActionId.SetString} callback`, () => {
	let self: ReturnType<typeof makeSelf>
	beforeEach(() => {
		self = makeSelf()
	})

	it('calls setOid with OctetString type', async () => {
		await runCallback(self, ActionId.SetString, { oid: VALID_OID, value: 'hello' })
		expect(self.setOid).toHaveBeenCalledWith(VALID_OID, snmp.ObjectType.OctetString, 'hello')
	})

	it('strips leading dot from OID', async () => {
		await runCallback(self, ActionId.SetString, { oid: `.${VALID_OID}`, value: 'x' })
		expect(self.setOid).toHaveBeenCalledWith(VALID_OID, expect.anything(), expect.anything())
	})

	it('throws on invalid OID', async () => {
		await expect(runCallback(self, ActionId.SetString, { oid: INVALID_OID, value: 'x' })).rejects.toThrow(/Invalid OID/)
	})
})

describe(`${ActionId.SetString} learn`, () => {
	let self: ReturnType<typeof makeSelf>
	beforeEach(() => {
		self = makeSelf()
	})

	it('returns the current value when OID exists with OctetString type', async () => {
		self.oidValues.set(VALID_OID, { oid: VALID_OID, type: snmp.ObjectType.OctetString, value: 'current' } as any)
		const result = await runLearn(self, ActionId.SetString, { oid: VALID_OID })
		expect(result).toEqual({ value: 'current' })
	})

	it('returns undefined when OID type does not match', async () => {
		self.oidValues.set(VALID_OID, { oid: VALID_OID, type: snmp.ObjectType.Integer, value: 1 } as any)
		const result = await runLearn(self, ActionId.SetString, { oid: VALID_OID })
		expect(result).toBeUndefined()
	})

	it('returns undefined when OID is not cached', async () => {
		const result = await runLearn(self, ActionId.SetString, { oid: VALID_OID })
		expect(result).toBeUndefined()
	})

	it('throws on invalid OID', async () => {
		await expect(runLearn(self, ActionId.SetString, { oid: INVALID_OID })).rejects.toThrow(/Invalid OID/)
	})
})

// ---------------------------------------------------------------------------
// SetOpaque
// ---------------------------------------------------------------------------

describe(`${ActionId.SetOpaque} callback`, () => {
	let self: ReturnType<typeof makeSelf>
	beforeEach(() => {
		self = makeSelf()
	})

	it('calls setOid with Opaque type', async () => {
		await runCallback(self, ActionId.SetOpaque, { oid: VALID_OID, value: 'SGVsbG8=' })
		expect(self.setOid).toHaveBeenCalledWith(VALID_OID, snmp.ObjectType.Opaque, 'SGVsbG8=')
	})

	it('throws on invalid OID', async () => {
		await expect(runCallback(self, ActionId.SetOpaque, { oid: INVALID_OID, value: 'x' })).rejects.toThrow(/Invalid OID/)
	})
})

// ---------------------------------------------------------------------------
// SetNumber
// ---------------------------------------------------------------------------

describe(`${ActionId.SetNumber} callback`, () => {
	let self: ReturnType<typeof makeSelf>
	beforeEach(() => {
		self = makeSelf()
	})

	it('calls setOid with the specified numeric type and rounded value', async () => {
		await runCallback(self, ActionId.SetNumber, { oid: VALID_OID, type: snmp.ObjectType.Integer, value: 3.7 })
		expect(self.setOid).toHaveBeenCalledWith(VALID_OID, snmp.ObjectType.Integer, 4)
	})

	it('rounds fractional values', async () => {
		await runCallback(self, ActionId.SetNumber, { oid: VALID_OID, type: snmp.ObjectType.Gauge, value: 1.2 })
		expect(self.setOid).toHaveBeenCalledWith(VALID_OID, snmp.ObjectType.Gauge, 1)
	})

	it('throws on invalid OID', async () => {
		await expect(
			runCallback(self, ActionId.SetNumber, { oid: INVALID_OID, type: snmp.ObjectType.Integer, value: 1 }),
		).rejects.toThrow(/Invalid OID/)
	})
})

describe(`${ActionId.SetNumber} learn`, () => {
	let self: ReturnType<typeof makeSelf>
	beforeEach(() => {
		self = makeSelf()
	})

	it.each([snmp.ObjectType.Integer, snmp.ObjectType.Gauge, snmp.ObjectType.Counter, snmp.ObjectType.TimeTicks])(
		'returns current value for type %s',
		async (type) => {
			self.oidValues.set(VALID_OID, { oid: VALID_OID, type, value: 42 } as any)
			const result = await runLearn(self, ActionId.SetNumber, { oid: VALID_OID })
			expect(result).toEqual({ value: 42 })
		},
	)

	it('returns undefined when type does not match', async () => {
		self.oidValues.set(VALID_OID, { oid: VALID_OID, type: snmp.ObjectType.OctetString, value: 'x' } as any)
		const result = await runLearn(self, ActionId.SetNumber, { oid: VALID_OID })
		expect(result).toBeUndefined()
	})
})

// ---------------------------------------------------------------------------
// SetBoolean
// ---------------------------------------------------------------------------

describe(`${ActionId.SetBoolean} callback`, () => {
	let self: ReturnType<typeof makeSelf>
	beforeEach(() => {
		self = makeSelf()
	})

	it.each([['true'], ['on'], ['1'], ['yes']])('treats "%s" as true', async (val) => {
		await runCallback(self, ActionId.SetBoolean, { oid: VALID_OID, value: val })
		expect(self.setOid).toHaveBeenCalledWith(VALID_OID, snmp.ObjectType.Boolean, true)
	})

	it.each([['false'], ['off'], ['0'], ['no']])('treats "%s" as false', async (val) => {
		await runCallback(self, ActionId.SetBoolean, { oid: VALID_OID, value: val })
		expect(self.setOid).toHaveBeenCalledWith(VALID_OID, snmp.ObjectType.Boolean, false)
	})

	it('passes through a native boolean true', async () => {
		await runCallback(self, ActionId.SetBoolean, { oid: VALID_OID, value: true })
		expect(self.setOid).toHaveBeenCalledWith(VALID_OID, snmp.ObjectType.Boolean, true)
	})

	it('passes through a native boolean false', async () => {
		await runCallback(self, ActionId.SetBoolean, { oid: VALID_OID, value: false })
		expect(self.setOid).toHaveBeenCalledWith(VALID_OID, snmp.ObjectType.Boolean, false)
	})

	it('serializes an object value before parsing', async () => {
		// object values are JSON.stringify'd before the switch
		await expect(runCallback(self, ActionId.SetBoolean, { oid: VALID_OID, value: {} })).rejects.toThrow(
			/not an boolean/,
		)
	})

	it('throws on an unrecognised string value', async () => {
		await expect(runCallback(self, ActionId.SetBoolean, { oid: VALID_OID, value: 'maybe' })).rejects.toThrow(
			/not an boolean/,
		)
	})

	it('throws on invalid OID', async () => {
		await expect(runCallback(self, ActionId.SetBoolean, { oid: INVALID_OID, value: true })).rejects.toThrow(
			/Invalid OID/,
		)
	})
})

describe(`${ActionId.SetBoolean} learn`, () => {
	let self: ReturnType<typeof makeSelf>
	beforeEach(() => {
		self = makeSelf()
	})

	it('returns the current boolean value', async () => {
		self.oidValues.set(VALID_OID, { oid: VALID_OID, type: snmp.ObjectType.Boolean, value: true } as any)
		const result = await runLearn(self, ActionId.SetBoolean, { oid: VALID_OID })
		expect(result).toEqual({ value: true })
	})

	it('returns undefined when type does not match', async () => {
		self.oidValues.set(VALID_OID, { oid: VALID_OID, type: snmp.ObjectType.Integer, value: 1 } as any)
		const result = await runLearn(self, ActionId.SetBoolean, { oid: VALID_OID })
		expect(result).toBeUndefined()
	})
})

// ---------------------------------------------------------------------------
// SetIpAddress
// ---------------------------------------------------------------------------

describe(`${ActionId.SetIpAddress} callback`, () => {
	let self: ReturnType<typeof makeSelf>
	beforeEach(() => {
		self = makeSelf()
	})

	it('calls setOid with IpAddress type', async () => {
		await runCallback(self, ActionId.SetIpAddress, { oid: VALID_OID, value: '10.0.0.1' })
		expect(self.setOid).toHaveBeenCalledWith(VALID_OID, snmp.ObjectType.IpAddress, '10.0.0.1')
	})

	it('throws on invalid OID', async () => {
		await expect(runCallback(self, ActionId.SetIpAddress, { oid: INVALID_OID, value: '10.0.0.1' })).rejects.toThrow(
			/Invalid OID/,
		)
	})
})

describe(`${ActionId.SetIpAddress} learn`, () => {
	let self: ReturnType<typeof makeSelf>
	beforeEach(() => {
		self = makeSelf()
	})

	it('returns the current IP address value', async () => {
		self.oidValues.set(VALID_OID, { oid: VALID_OID, type: snmp.ObjectType.IpAddress, value: '10.0.0.1' } as any)
		const result = await runLearn(self, ActionId.SetIpAddress, { oid: VALID_OID })
		expect(result).toEqual({ value: '10.0.0.1' })
	})

	it('returns undefined when type does not match', async () => {
		self.oidValues.set(VALID_OID, { oid: VALID_OID, type: snmp.ObjectType.Integer, value: 1 } as any)
		const result = await runLearn(self, ActionId.SetIpAddress, { oid: VALID_OID })
		expect(result).toBeUndefined()
	})
})

// ---------------------------------------------------------------------------
// SetOID
// ---------------------------------------------------------------------------

describe(`${ActionId.SetOID} callback`, () => {
	let self: ReturnType<typeof makeSelf>
	beforeEach(() => {
		self = makeSelf()
	})

	it('calls setOid with OID type', async () => {
		await runCallback(self, ActionId.SetOID, { oid: VALID_OID, value: '1.3.6.1.9' })
		expect(self.setOid).toHaveBeenCalledWith(VALID_OID, snmp.ObjectType.OID, '1.3.6.1.9')
	})

	it('throws on invalid OID', async () => {
		await expect(runCallback(self, ActionId.SetOID, { oid: INVALID_OID, value: '1.3.6.1' })).rejects.toThrow(
			/Invalid OID/,
		)
	})
})

describe(`${ActionId.SetOID} learn`, () => {
	let self: ReturnType<typeof makeSelf>
	beforeEach(() => {
		self = makeSelf()
	})

	it('returns the current OID value as a string', async () => {
		self.oidValues.set(VALID_OID, { oid: VALID_OID, type: snmp.ObjectType.OID, value: '1.3.6.1.9' } as any)
		const result = await runLearn(self, ActionId.SetOID, { oid: VALID_OID })
		expect(result).toEqual({ value: '1.3.6.1.9' })
	})

	it('returns undefined when type does not match', async () => {
		self.oidValues.set(VALID_OID, { oid: VALID_OID, type: snmp.ObjectType.Integer, value: 1 } as any)
		const result = await runLearn(self, ActionId.SetOID, { oid: VALID_OID })
		expect(result).toBeUndefined()
	})
})

// ---------------------------------------------------------------------------
// GetOID
// ---------------------------------------------------------------------------

describe(`${ActionId.GetOID} callback`, () => {
	let self: ReturnType<typeof makeSelf>
	let context: ReturnType<typeof makeContext>

	beforeEach(() => {
		self = makeSelf()
		context = makeContext()
	})

	it('calls getOid and sets the custom variable', async () => {
		self.oidValues.set(VALID_OID, { oid: VALID_OID, type: snmp.ObjectType.Integer, value: 7 } as any)
		await runCallback(
			self,
			ActionId.GetOID,
			{
				oid: VALID_OID,
				variable: 'myVar',
				update: false,
				displaystring: false,
				div: 1,
			},
			context,
		)
		expect(self.getOid).toHaveBeenCalledWith(VALID_OID)
		expect(context.setCustomVariableValue).toHaveBeenCalledWith('myVar', 7)
	})

	it('applies the divisor when setting the variable', async () => {
		self.oidValues.set(VALID_OID, { oid: VALID_OID, type: snmp.ObjectType.Integer, value: 100 } as any)
		await runCallback(
			self,
			ActionId.GetOID,
			{
				oid: VALID_OID,
				variable: 'myVar',
				update: false,
				displaystring: false,
				div: 4,
			},
			context,
		)
		expect(context.setCustomVariableValue).toHaveBeenCalledWith('myVar', 25)
	})

	it('does not call setCustomVariableValue when variable is empty', async () => {
		self.oidValues.set(VALID_OID, { oid: VALID_OID, type: snmp.ObjectType.Integer, value: 1 } as any)
		await runCallback(
			self,
			ActionId.GetOID,
			{
				oid: VALID_OID,
				variable: '',
				update: false,
				displaystring: false,
				div: 1,
			},
			context,
		)
		expect(context.setCustomVariableValue).not.toHaveBeenCalled()
	})

	it('throws when varbind is not found after get', async () => {
		// getOid resolves but nothing is added to oidValues
		await expect(
			runCallback(
				self,
				ActionId.GetOID,
				{
					oid: VALID_OID,
					variable: 'myVar',
					update: false,
					displaystring: false,
					div: 1,
				},
				context,
			),
		).rejects.toThrow(/Varbind not found/)
	})

	it('throws on invalid OID', async () => {
		await expect(
			runCallback(self, ActionId.GetOID, {
				oid: INVALID_OID,
				variable: 'myVar',
				update: false,
				displaystring: false,
				div: 1,
			}),
		).rejects.toThrow(/Invalid OID/)
	})
})

describe(`${ActionId.GetOID} subscribe`, () => {
	let self: ReturnType<typeof makeSelf>
	beforeEach(() => {
		self = makeSelf()
	})

	it('adds to poll group when update is true', async () => {
		await runSubscribe(self, ActionId.GetOID, { oid: VALID_OID, update: true })
		expect(self.oidTracker.addToPollGroup).toHaveBeenCalledWith(VALID_OID, ActionId.GetOID)
	})

	it('removes from poll group when update is false', async () => {
		await runSubscribe(self, ActionId.GetOID, { oid: VALID_OID, update: false })
		expect(self.oidTracker.removeFromPollGroup).toHaveBeenCalledWith(VALID_OID, ActionId.GetOID)
	})

	it('throws on invalid OID', async () => {
		await expect(runSubscribe(self, ActionId.GetOID, { oid: INVALID_OID, update: false })).rejects.toThrow(
			/Invalid OID/,
		)
	})
})

// ---------------------------------------------------------------------------
// WalkOID
// ---------------------------------------------------------------------------

describe(`${ActionId.WalkOID} callback`, () => {
	let self: ReturnType<typeof makeSelf>
	beforeEach(() => {
		self = makeSelf()
	})

	it('calls walk with the correct OID', async () => {
		await runCallback(self, ActionId.WalkOID, { oid: VALID_OID })
		expect(self.walk).toHaveBeenCalledWith(VALID_OID)
	})

	it('strips leading dots', async () => {
		await runCallback(self, ActionId.WalkOID, { oid: `.${VALID_OID}` })
		expect(self.walk).toHaveBeenCalledWith(VALID_OID)
	})

	it('throws on invalid OID', async () => {
		await expect(runCallback(self, ActionId.WalkOID, { oid: INVALID_OID })).rejects.toThrow(/Invalid OID/)
	})
})

// ---------------------------------------------------------------------------
// TrapOrInform — generic trap types
// ---------------------------------------------------------------------------

describe(`${ActionId.TrapOrInform} callback — generic trap types`, () => {
	let self: ReturnType<typeof makeSelf>
	beforeEach(() => {
		self = makeSelf()
	})

	it('calls sendTrap with the trap type when messageType is "trap"', async () => {
		await runCallback(self, ActionId.TrapOrInform, {
			messageType: 'trap',
			trapType: snmp.TrapType.ColdStart,
			oidEnterprise: VALID_OID,
			oidVarbind: VALID_OID,
			objectType: snmp.ObjectType.Integer,
			objectValue: '1',
		})
		expect(self.sendTrap).toHaveBeenCalledWith(snmp.TrapType.ColdStart)
		expect(self.sendInform).not.toHaveBeenCalled()
	})

	it('calls sendInform with the trap type when messageType is "inform"', async () => {
		await runCallback(self, ActionId.TrapOrInform, {
			messageType: 'inform',
			trapType: snmp.TrapType.LinkUp,
			oidEnterprise: VALID_OID,
			oidVarbind: VALID_OID,
			objectType: snmp.ObjectType.Integer,
			objectValue: '1',
		})
		expect(self.sendInform).toHaveBeenCalledWith(snmp.TrapType.LinkUp)
		expect(self.sendTrap).not.toHaveBeenCalled()
	})
})

// ---------------------------------------------------------------------------
// TrapOrInform — enterprise-specific trap types
// ---------------------------------------------------------------------------

describe(`${ActionId.TrapOrInform} callback — enterprise-specific`, () => {
	let self: ReturnType<typeof makeSelf>
	beforeEach(() => {
		self = makeSelf()
	})

	const enterpriseOptions = {
		trapType: snmp.TrapType.EnterpriseSpecific,
		oidEnterprise: '1.3.6.1.4.1.999',
		oidVarbind: VALID_OID,
		objectType: snmp.ObjectType.Integer,
		objectValue: '42',
	}

	it('calls sendTrap with enterprise OID and varbind', async () => {
		await runCallback(self, ActionId.TrapOrInform, { messageType: 'trap', ...enterpriseOptions })
		expect(self.sendTrap).toHaveBeenCalledWith(
			'1.3.6.1.4.1.999',
			expect.objectContaining({ oid: VALID_OID, type: snmp.ObjectType.Integer }),
		)
	})

	it('calls sendInform with enterprise OID and varbind', async () => {
		await runCallback(self, ActionId.TrapOrInform, { messageType: 'inform', ...enterpriseOptions })
		expect(self.sendInform).toHaveBeenCalledWith(
			'1.3.6.1.4.1.999',
			expect.objectContaining({ oid: VALID_OID, type: snmp.ObjectType.Integer }),
		)
	})

	it('throws when varbind OID is invalid', async () => {
		await expect(
			runCallback(self, ActionId.TrapOrInform, {
				messageType: 'trap',
				...enterpriseOptions,
				oidVarbind: INVALID_OID,
			}),
		).rejects.toThrow(/Invalid OID/)
	})
})

// ---------------------------------------------------------------------------
// TrapOrInform — learn
// ---------------------------------------------------------------------------

describe(`${ActionId.TrapOrInform} learn`, () => {
	let self: ReturnType<typeof makeSelf>
	beforeEach(() => {
		self = makeSelf()
	})

	it('returns the object type when OID exists in cache', async () => {
		self.oidValues.set(VALID_OID, { oid: VALID_OID, type: snmp.ObjectType.Integer, value: 1 } as any)
		const result = await runLearn(self, ActionId.TrapOrInform, {
			oidVarbind: VALID_OID,
			objectType: snmp.ObjectType.Integer,
			objectValue: '1',
		})
		expect(result).toEqual({ objectType: snmp.ObjectType.Integer })
	})

	it('returns undefined when OID is not in cache', async () => {
		const result = await runLearn(self, ActionId.TrapOrInform, {
			oidVarbind: VALID_OID,
			objectType: snmp.ObjectType.Integer,
			objectValue: '1',
		})
		expect(result).toBeUndefined()
	})

	it('throws on invalid varbind OID', async () => {
		await expect(runLearn(self, ActionId.TrapOrInform, { oidVarbind: INVALID_OID })).rejects.toThrow(/Invalid OID/)
	})
})
