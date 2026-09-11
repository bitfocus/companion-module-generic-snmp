import snmp from 'net-snmp'
import { describe, it, expect } from 'vitest'
import { GetVariableDefinitions, GetVariableValues, VariableDivisor, VariableEncoding } from '../variables.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Minimal stand in for the instance. GetVariableDefinitions and GetVariableValues
 * only read config.variables and oidValues, so a plain object is enough and no
 * Companion host is needed.
 */
function makeSelf(variables: boolean, entries: [string, snmp.Varbind][] = []) {
	return {
		config: { variables },
		oidValues: new Map<string, snmp.Varbind>(entries),
	} as any
}

const varbind = (oid: string, type: snmp.ObjectType, value: unknown): snmp.Varbind =>
	({ oid, type, value }) as snmp.Varbind

/**
 * Varbinds as returned by net-snmp from a walk of 1.3.6.1.2.1.1 (the SNMPv2-MIB
 * system group) against a Net-SNMP agent on a Debian host, freshly booted, with
 * the stock snmpd.conf sysLocation/sysContact still in place. OctetString values
 * arrive as Buffers, sysUpTime as a TimeTicks number, sysServices as an Integer.
 */
const SYSTEM_GROUP: [string, snmp.Varbind][] = [
	[
		'1.3.6.1.2.1.1.1.0',
		varbind(
			'1.3.6.1.2.1.1.1.0',
			snmp.ObjectType.OctetString,
			Buffer.from('Linux debian 6.1.0-18-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.76-1 x86_64'),
		),
	],
	['1.3.6.1.2.1.1.3.0', varbind('1.3.6.1.2.1.1.3.0', snmp.ObjectType.TimeTicks, 34172)],
	['1.3.6.1.2.1.1.4.0', varbind('1.3.6.1.2.1.1.4.0', snmp.ObjectType.OctetString, Buffer.from('Me <me@example.org>'))],
	['1.3.6.1.2.1.1.5.0', varbind('1.3.6.1.2.1.1.5.0', snmp.ObjectType.OctetString, Buffer.from('debian'))],
	['1.3.6.1.2.1.1.7.0', varbind('1.3.6.1.2.1.1.7.0', snmp.ObjectType.Integer, 72)],
]

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------

describe('GetVariableDefinitions', () => {
	it('returns nothing when the option is off, even with a populated cache', () => {
		expect(GetVariableDefinitions(makeSelf(false, SYSTEM_GROUP))).toStrictEqual({})
	})

	it('returns nothing when the cache is empty', () => {
		expect(GetVariableDefinitions(makeSelf(true))).toStrictEqual({})
	})

	it('defines one variable per cached OID, keyed and named by dotted decimal OID', () => {
		expect(GetVariableDefinitions(makeSelf(true, SYSTEM_GROUP))).toStrictEqual({
			'1.3.6.1.2.1.1.1.0': { name: '1.3.6.1.2.1.1.1.0' },
			'1.3.6.1.2.1.1.3.0': { name: '1.3.6.1.2.1.1.3.0' },
			'1.3.6.1.2.1.1.4.0': { name: '1.3.6.1.2.1.1.4.0' },
			'1.3.6.1.2.1.1.5.0': { name: '1.3.6.1.2.1.1.5.0' },
			'1.3.6.1.2.1.1.7.0': { name: '1.3.6.1.2.1.1.7.0' },
		})
	})
})

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

describe('GetVariableValues', () => {
	it('returns nothing when the option is off, even with a populated cache', () => {
		expect(GetVariableValues(makeSelf(false, SYSTEM_GROUP))).toStrictEqual({})
	})

	it('decodes OctetStrings as text and passes numbers through unscaled', () => {
		expect(GetVariableValues(makeSelf(true, SYSTEM_GROUP))).toStrictEqual({
			'1.3.6.1.2.1.1.1.0': 'Linux debian 6.1.0-18-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.76-1 x86_64',
			'1.3.6.1.2.1.1.3.0': 34172,
			'1.3.6.1.2.1.1.4.0': 'Me <me@example.org>',
			'1.3.6.1.2.1.1.5.0': 'debian',
			'1.3.6.1.2.1.1.7.0': 72,
		})
	})

	it('uses UTF-8, so a multi byte sysName is not mangled into base64', () => {
		const oid = '1.3.6.1.2.1.1.5.0'
		const self = makeSelf(true, [[oid, varbind(oid, snmp.ObjectType.OctetString, Buffer.from('café-switch'))]])
		expect(GetVariableValues(self)[oid]).toBe('café-switch')
	})

	it('never scales integers, there is no per OID divisor', () => {
		const oid = '1.3.6.1.2.1.1.7.0'
		const self = makeSelf(true, [[oid, varbind(oid, snmp.ObjectType.Integer, 72)]])
		expect(GetVariableValues(self)[oid]).toBe(72)
	})

	it('renders a Counter64 buffer as a decimal string rather than a Buffer', () => {
		const oid = '1.3.6.1.2.1.31.1.1.1.6.1'
		const self = makeSelf(true, [
			[oid, varbind(oid, snmp.ObjectType.Counter64, Buffer.from('00000000499602d2', 'hex'))],
		])
		expect(GetVariableValues(self)[oid]).toBe('1234567890')
	})

	it('substitutes an empty string for a null value rather than omitting the variable', () => {
		const oid = '1.3.6.1.2.1.1.6.0'
		const self = makeSelf(true, [[oid, varbind(oid, snmp.ObjectType.Null, null)]])
		const values = GetVariableValues(self)
		expect(oid in values).toBe(true)
		expect(values[oid]).toBe('')
	})
})

// ---------------------------------------------------------------------------
// Fixed options
// ---------------------------------------------------------------------------

describe('fixed option values', () => {
	it('matches the EncodingOption dropdown default so variables agree with actions', () => {
		expect(VariableEncoding).toBe('utf8')
	})

	it('never scales', () => {
		expect(VariableDivisor).toBe(1)
	})
})
