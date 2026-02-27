import snmp from 'net-snmp'
import { describe, expect, it } from 'vitest'

import {
	bufferToBigInt,
	generateEngineId,
	isValidSnmpOid,
	prepareVarbindForVariableAssignment,
	trimOid,
	validateAndConvertVarbind,
	validateVarbinds,
} from './oidUtils.js'

// ---------------------------------------------------------------------------
// trimOid
// ---------------------------------------------------------------------------
describe('trimOid', () => {
	it('removes a single leading dot', () => {
		expect(trimOid('.1.3.6.1')).toBe('1.3.6.1')
	})

	it('removes multiple leading dots', () => {
		expect(trimOid('...1.3.6.1')).toBe('1.3.6.1')
	})

	it('trims surrounding whitespace', () => {
		expect(trimOid('  1.3.6.1  ')).toBe('1.3.6.1')
	})

	it('handles a leading dot combined with whitespace', () => {
		expect(trimOid('  .1.3.6.1  ')).toBe('1.3.6.1')
	})

	it('leaves an OID without a leading dot unchanged', () => {
		expect(trimOid('1.3.6.1')).toBe('1.3.6.1')
	})

	it('returns an empty string unchanged', () => {
		expect(trimOid('')).toBe('')
	})
})

// ---------------------------------------------------------------------------
// isValidSnmpOid
// ---------------------------------------------------------------------------
describe('isValidSnmpOid', () => {
	it('accepts a valid OID starting with 1', () => {
		expect(isValidSnmpOid('1.3.6.1.2.1')).toBe(true)
	})

	it('accepts a valid OID starting with 0', () => {
		expect(isValidSnmpOid('0.1.2.3')).toBe(true)
	})

	it('accepts a valid OID starting with 2', () => {
		expect(isValidSnmpOid('2.16.840')).toBe(true)
	})

	it('rejects an OID starting with 3', () => {
		expect(isValidSnmpOid('3.6.1')).toBe(false)
	})

	it('rejects a leading dot', () => {
		expect(isValidSnmpOid('.1.3.6.1')).toBe(false)
	})

	it('rejects a trailing dot', () => {
		expect(isValidSnmpOid('1.3.6.1.')).toBe(false)
	})

	it('rejects letters', () => {
		expect(isValidSnmpOid('1.3.abc')).toBe(false)
	})

	it('rejects a leading zero in a multi-digit arc', () => {
		expect(isValidSnmpOid('1.03.6')).toBe(false)
	})

	it('rejects an empty string', () => {
		expect(isValidSnmpOid('')).toBe(false)
	})

	it('rejects a bare single digit without further arcs', () => {
		expect(isValidSnmpOid('1')).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// bufferToBigInt
// ---------------------------------------------------------------------------
describe('bufferToBigInt', () => {
	it('converts a simple buffer to the correct BigInt', () => {
		const buf = Buffer.from([0x00, 0x00, 0x00, 0x01])
		expect(bufferToBigInt(buf)).toBe(1n)
	})

	it('converts a multi-byte buffer correctly', () => {
		const buf = Buffer.from([0xff, 0xff, 0xff, 0xff])
		expect(bufferToBigInt(buf)).toBe(4294967295n)
	})

	it('respects start and end parameters', () => {
		const buf = Buffer.from([0x00, 0x00, 0x00, 0x01, 0x00, 0x02])
		expect(bufferToBigInt(buf, 4, 6)).toBe(2n)
	})

	it('handles a zero buffer', () => {
		const buf = Buffer.from([0x00, 0x00])
		expect(bufferToBigInt(buf)).toBe(0n)
	})

	it('handles an empty buffer', () => {
		const buf = Buffer.from([])
		expect(bufferToBigInt(buf)).toBe(0n)
	})
})

// ---------------------------------------------------------------------------
// validateAndConvertVarbind
// ---------------------------------------------------------------------------
describe('validateAndConvertVarbind', () => {
	// Helpers
	const varbind = (type: snmp.ObjectType, value: unknown, oid = '1.3.6.1'): snmp.Varbind =>
		({ oid, type, value }) as snmp.Varbind

	it('strips a leading dot from the OID', () => {
		const result = validateAndConvertVarbind(varbind(snmp.ObjectType.Null, null, '.1.3.6.1'))
		expect(result.oid).toBe('1.3.6.1')
	})

	it('throws on an invalid OID', () => {
		expect(() => validateAndConvertVarbind(varbind(snmp.ObjectType.Null, null, 'not.an.oid'))).toThrow(/Invalid OID/)
	})

	// Boolean
	describe('Boolean', () => {
		it.each([['true'], ['1'], ['on'], ['yes'], ['TRUE'], ['YES'], [true]])('converts "%s" to true', (raw) => {
			expect(validateAndConvertVarbind(varbind(snmp.ObjectType.Boolean, raw)).value).toBe(true)
		})

		it.each([['false'], ['0'], ['off'], ['no'], [false]])('converts "%s" to false', (raw) => {
			expect(validateAndConvertVarbind(varbind(snmp.ObjectType.Boolean, raw)).value).toBe(false)
		})

		it('throws on an invalid boolean string', () => {
			expect(() => validateAndConvertVarbind(varbind(snmp.ObjectType.Boolean, 'maybe'))).toThrow(
				/Cannot convert.*Boolean/,
			)
		})
	})

	// Integer
	describe('Integer', () => {
		it('converts a valid integer string', () => {
			expect(validateAndConvertVarbind(varbind(snmp.ObjectType.Integer, '42')).value).toBe(42)
		})

		it('converts a negative integer string', () => {
			expect(validateAndConvertVarbind(varbind(snmp.ObjectType.Integer, '-1')).value).toBe(-1)
		})

		it('converts a hex integer string', () => {
			expect(validateAndConvertVarbind(varbind(snmp.ObjectType.Integer, '0xFF')).value).toBe(255)
		})

		it('passes an integer', () => {
			expect(validateAndConvertVarbind(varbind(snmp.ObjectType.Integer, 2001)).value).toBe(2001)
		})

		it('throws when value is not a valid integer', () => {
			expect(() => validateAndConvertVarbind(varbind(snmp.ObjectType.Integer, '3.14'))).toThrow(
				/Cannot convert.*Integer/,
			)
		})

		it('throws when value exceeds INT32_MAX', () => {
			expect(() => validateAndConvertVarbind(varbind(snmp.ObjectType.Integer, '2147483648'))).toThrow(/out of range/)
		})

		it('throws when value is below INT32_MIN', () => {
			expect(() => validateAndConvertVarbind(varbind(snmp.ObjectType.Integer, '-2147483649'))).toThrow(/out of range/)
		})
	})

	// OctetString / BitString
	describe('OctetString', () => {
		it('passes the string value through unchanged', () => {
			expect(validateAndConvertVarbind(varbind(snmp.ObjectType.OctetString, 'hello')).value).toBe('hello')
		})
	})

	// Null
	describe('Null', () => {
		it('returns null as the value', () => {
			expect(validateAndConvertVarbind(varbind(snmp.ObjectType.Null, null)).value).toBeNull()
		})
	})

	// OID
	describe('OID', () => {
		it('converts a valid OID value', () => {
			expect(validateAndConvertVarbind(varbind(snmp.ObjectType.OID, '1.3.6.1')).value).toBe('1.3.6.1')
		})

		it('strips leading dot from OID value', () => {
			expect(validateAndConvertVarbind(varbind(snmp.ObjectType.OID, '.1.3.6.1')).value).toBe('1.3.6.1')
		})

		it('throws on an invalid OID value', () => {
			expect(() => validateAndConvertVarbind(varbind(snmp.ObjectType.OID, 'not-an-oid'))).toThrow(/Cannot convert.*OID/)
		})
	})

	// IpAddress
	describe('IpAddress', () => {
		it('accepts a valid IPv4 address', () => {
			expect(validateAndConvertVarbind(varbind(snmp.ObjectType.IpAddress, '192.168.1.1')).value).toBe('192.168.1.1')
		})

		it('throws on a non-IPv4 string', () => {
			expect(() => validateAndConvertVarbind(varbind(snmp.ObjectType.IpAddress, 'not-an-ip'))).toThrow(
				/Cannot convert.*IpAddress/,
			)
		})

		it('throws when an octet is out of range', () => {
			expect(() => validateAndConvertVarbind(varbind(snmp.ObjectType.IpAddress, '192.168.1.256'))).toThrow(
				/octet out of range/,
			)
		})
	})

	// Counter / Gauge / TimeTicks
	describe('Counter/Gauge/TimeTicks', () => {
		it('converts a valid unsigned 32-bit value', () => {
			expect(validateAndConvertVarbind(varbind(snmp.ObjectType.Counter, '100')).value).toBe(100)
		})

		it('passes a valid unsigned 32-bit value', () => {
			expect(validateAndConvertVarbind(varbind(snmp.ObjectType.Counter, 3030)).value).toBe(3030)
		})

		it('throws on a negative value', () => {
			expect(() => validateAndConvertVarbind(varbind(snmp.ObjectType.Gauge, '-1'))).toThrow(/out of range/)
		})

		it('throws when value exceeds UINT32_MAX', () => {
			expect(() => validateAndConvertVarbind(varbind(snmp.ObjectType.TimeTicks, '4294967296'))).toThrow(/out of range/)
		})
	})

	// Counter64
	describe('Counter64', () => {
		it('converts a valid 64-bit integer into a 8-byte Buffer', () => {
			const result = validateAndConvertVarbind(varbind(snmp.ObjectType.Counter64, '1'))
			expect(Buffer.isBuffer(result.value)).toBe(true)
			expect(bufferToBigInt(result.value as Buffer)).toBe(1n)
		})

		it('throws on a negative value', () => {
			expect(() => validateAndConvertVarbind(varbind(snmp.ObjectType.Counter64, '-1'))).toThrow(/out of range/)
		})

		it('throws on a non-numeric string', () => {
			expect(() => validateAndConvertVarbind(varbind(snmp.ObjectType.Counter64, 'abc'))).toThrow(
				/Cannot convert.*Counter64/,
			)
		})
	})

	// Unsupported type
	it('throws on an unsupported ObjectType', () => {
		expect(() => validateAndConvertVarbind(varbind(999 as snmp.ObjectType, 'x'))).toThrow(/Unsupported ObjectType/)
	})
})

// ---------------------------------------------------------------------------
// validateVarbinds
// ---------------------------------------------------------------------------
describe('validateVarbinds', () => {
	it('validates and returns an array of converted varbinds', () => {
		const varbinds = [
			{ oid: '1.3.6.1', type: snmp.ObjectType.Integer, value: '5' },
			{ oid: '1.3.6.2', type: snmp.ObjectType.OctetString, value: 'Since I cannot prove a lover…' },
			{ oid: '1.3.6.3', type: snmp.ObjectType.OctetString, value: Buffer.from('I am determined to prove a villain.') },
			{ oid: '1.3.6.4', type: snmp.ObjectType.Opaque, value: 'A thing devised by the enemy' },
		] as snmp.Varbind[]

		const result = validateVarbinds(varbinds)
		expect(result[0].value).toBe(5)
		expect(result[1].value).toBe('Since I cannot prove a lover…')
		expect(result[2].value).toStrictEqual(Buffer.from('I am determined to prove a villain.'))
		expect(result[3].value).toStrictEqual(Buffer.from('A thing devised by the enemy', 'base64'))
	})

	it('wraps errors with the varbind index', () => {
		const varbinds = [
			{ oid: '1.3.6.1', type: snmp.ObjectType.Integer, value: '5' },
			{ oid: 'bad-oid', type: snmp.ObjectType.Integer, value: '5' },
		] as snmp.Varbind[]

		expect(() => validateVarbinds(varbinds)).toThrow(/Varbind at index 1/)
	})
})

// ---------------------------------------------------------------------------
// prepareVarbindForVariableAssignment
// ---------------------------------------------------------------------------
describe('prepareVarbindForVariableAssignment', () => {
	const vb = (type: snmp.ObjectType, value: unknown): snmp.Varbind => ({ oid: '1.3.6.1', type, value }) as snmp.Varbind

	it('divides a numeric value by the divisor', () => {
		expect(prepareVarbindForVariableAssignment(vb(snmp.ObjectType.Integer, 100), false, 4)).toBe(25)
	})

	it('returns an OctetString as a locale string when displayString is true', () => {
		const result = prepareVarbindForVariableAssignment(vb(snmp.ObjectType.OctetString, 'hello'), true)
		expect(typeof result).toBe('string')
	})

	it('returns a Counter64 Buffer as a BigInt string', () => {
		const buf = Buffer.from('0000000000000001', 'hex')
		expect(prepareVarbindForVariableAssignment(vb(snmp.ObjectType.Counter64, buf))).toBe('1')
	})

	it('converts a bigint value to a string', () => {
		expect(prepareVarbindForVariableAssignment(vb(snmp.ObjectType.Counter64, 42n))).toBe('42')
	})

	it('returns an Opaque Buffer as a base64 string', () => {
		const buf = Buffer.from([0xde, 0xad, 0xbe, 0xef])
		const result = prepareVarbindForVariableAssignment(vb(snmp.ObjectType.Opaque, buf))
		expect(result).toBe(buf.toString('base64'))
	})

	it('returns an Opaque Buffer as a hex string', () => {
		const buf = Buffer.from([0xde, 0xad, 0xbe, 0xef])
		const result = prepareVarbindForVariableAssignment(vb(snmp.ObjectType.Opaque, buf), true, 1, 'hex')
		expect(result).toBe(buf.toString('hex'))
	})

	it('returns null when value is falsy and no other condition matches', () => {
		expect(prepareVarbindForVariableAssignment(vb(snmp.ObjectType.Null, null))).toBeNull()
	})
})

// ---------------------------------------------------------------------------
// generateEngineId
// ---------------------------------------------------------------------------
describe('generateEngineId', () => {
	it('returns a hex string of the correct length (13 bytes = 26 hex chars)', () => {
		const id = generateEngineId()
		expect(id).toHaveLength(26)
		expect(/^[0-9a-f]+$/i.test(id)).toBe(true)
	})

	it('encodes the enterprise OID in the first 4 bytes with the high bit set', () => {
		const id = generateEngineId(63849)
		const firstFourBytes = parseInt(id.slice(0, 8), 16)
		expect(firstFourBytes & 0x80000000).toBeTruthy()
		expect(firstFourBytes & 0x7fffffff).toBe(63849)
	})

	it('sets the format byte (5th byte) to 0x05', () => {
		const id = generateEngineId()
		expect(id.slice(8, 10)).toBe('05')
	})

	it('produces a different ID on each call (random tail)', () => {
		expect(generateEngineId()).not.toBe(generateEngineId())
	})

	it('accepts a custom enterprise OID', () => {
		const id = generateEngineId(12345)
		const firstFourBytes = parseInt(id.slice(0, 8), 16)
		expect(firstFourBytes & 0x7fffffff).toBe(12345)
	})
})
