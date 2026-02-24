import snmp from 'net-snmp'
import { randomBytes } from 'node:crypto'

const INT32_MIN = -2147483648
const INT32_MAX = 2147483647
const UINT32_MAX = 4294967295
const UINT64_MAX = 18446744073709551615n

/**
 * Remove leading dots from an OID string and trim whitespace
 * @param {string} oid - The OID string to trim
 * @returns {string} The trimmed OID string
 */

export const trimOid = (oid: string): string => {
	while (oid.startsWith('.')) {
		oid = oid.substring(1)
	}
	return oid.trim()
}

/**
 * Validate if a string is a valid SNMP OID format
 * @param {string} value - The string to validate as an OID
 * @returns {boolean} True if the value is a valid SNMP OID
 */

export const isValidSnmpOid = (value: string): boolean => /^(0|1|2)(\.(0|[1-9]\d*))+$/u.test(value)

/**
 * Convert a buffer to a BigInt
 * @param buffer - The buffer to convert
 * @param start - Starting position in the buffer
 * @param end - Ending position in the buffer
 * @returns The buffer converted to a BigInt
 */
export const bufferToBigInt = (buffer: Buffer, start = 0, end = buffer.length): bigint => {
	const bufferAsHexString = buffer.slice(start, end).toString('hex')
	return BigInt(`0x${bufferAsHexString}`)
}

/**
 * Validates and converts a string value to the appropriate type for an SNMP varbind,
 * then validates the OID.
 *
 * @param varbind - The varbind to validate and convert
 * @returns The validated and converted varbind
 * @throws {Error} If the OID is invalid, the value cannot be converted, or is out of range
 */
export const validateAndConvertVarbind = (varbind: snmp.Varbind): snmp.Varbind => {
	const oid = trimOid(varbind.oid)
	if (!isValidSnmpOid(oid)) {
		throw new Error(`Invalid OID: "${varbind.oid}"`)
	}

	const { type } = varbind
	let raw = varbind.value?.toString() ?? ''

	let value

	switch (type) {
		case snmp.ObjectType.Boolean: {
			raw = raw.toLowerCase().trim()
			if (raw === 'true' || raw === '1' || raw === 'on' || raw === 'yes') value = true
			else if (raw === 'false' || raw === '0' || raw === 'off' || raw === 'no') value = false
			else throw new Error(`Cannot convert "${raw}" to Boolean — expected true/false, 1/0, on/off, yes/no`)
			break
		}

		case snmp.ObjectType.Integer: {
			const isHex = /^-?0x[0-9a-fA-F]+$/i.test(raw.trim())
			const n = isHex ? Number.parseInt(raw, 16) : Number.parseInt(raw, 10)
			if (Number.isNaN(n) || (!isHex && String(n) !== raw.trim())) throw new Error(`Cannot convert "${raw}" to Integer`)
			if (n < INT32_MIN || n > INT32_MAX)
				throw new Error(`Integer value ${n} is out of range [${INT32_MIN}, ${INT32_MAX}]`)
			value = n
			break
		}

		case snmp.ObjectType.BitString:
		case snmp.ObjectType.OctetString: {
			value = raw
			break
		}
		case snmp.ObjectType.Opaque: {
			const padded = raw.trim().padEnd(Math.ceil(raw.trim().length / 4) * 4, '=')
			if (!/^[A-Za-z0-9+/]*={0,2}$/.test(padded)) {
				throw new Error(`Cannot convert "${raw}" to Opaque — invalid base64 string`)
			}
			value = Buffer.from(padded, 'base64')
			break
		}

		case snmp.ObjectType.Null: {
			value = null
			break
		}

		case snmp.ObjectType.OID: {
			const trimmed = trimOid(raw)
			if (!isValidSnmpOid(trimmed)) throw new Error(`Cannot convert "${raw}" to OID — invalid OID format`)
			value = trimmed
			break
		}

		case snmp.ObjectType.IpAddress: {
			const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
			const match = raw.match(ipv4)
			if (!match) throw new Error(`Cannot convert "${raw}" to IpAddress — invalid IPv4 format`)
			const octets = match.slice(1).map(Number)
			if (octets.some((o) => o > 255)) throw new Error(`IpAddress "${raw}" has an octet out of range [0, 255]`)
			value = raw
			break
		}

		case snmp.ObjectType.Counter:
		case snmp.ObjectType.Gauge:
		case snmp.ObjectType.TimeTicks: {
			const isHex = /^0x[0-9a-fA-F]+$/i.test(raw.trim())
			const n = isHex ? Number.parseInt(raw, 16) : Number.parseInt(raw, 10)
			if (Number.isNaN(n) || (!isHex && String(n) !== raw.trim()))
				throw new Error(`Cannot convert "${raw}" to unsigned 32-bit integer`)
			if (n < 0 || n > UINT32_MAX) throw new Error(`Value ${n} is out of range [0, ${UINT32_MAX}] for type ${type}`)
			value = n
			break
		}

		case snmp.ObjectType.Counter64: {
			let n
			try {
				n = BigInt(raw)
			} catch {
				throw new Error(`Cannot convert "${raw}" to Counter64 — expected a 64-bit integer`)
			}
			if (n < 0n || n > UINT64_MAX) throw new Error(`Counter64 value ${n} is out of range [0, ${UINT64_MAX}]`)
			const hex = n.toString(16).padStart(16, '0')
			value = Buffer.from(hex, 'hex')
			break
		}

		default:
			throw new Error(`Unsupported ObjectType: ${type}`)
	}

	return { oid, type, value }
}

/**
 * Validates and converts an array of varbinds, ensuring each OID is valid
 * and each value is converted to the appropriate type.
 *
 * @param {Array<{ oid: string, type: number, value: string }>} varbinds - The varbinds to validate
 * @returns {Array<{ oid: string, type: number, value: * }>} The validated and converted varbinds
 * @throws {Error} If any varbind has an invalid OID, unconvertible value, or out-of-range value
 */
export const validateVarbinds = (varbinds: snmp.Varbind[]): snmp.Varbind[] => {
	return varbinds.map((varbind, index) => {
		try {
			return validateAndConvertVarbind(varbind)
		} catch (error) {
			if (error instanceof Error) throw new Error(`Varbind at index ${index}: ${error.message}`)
			throw error
		}
	})
}

export function prepareVarbindForVariableAssignment(
	varbind: snmp.Varbind,
	displayString = false,
	divisor = 1,
): string | number | boolean | null {
	const value = varbind.value
	if (typeof value == 'number') return value / divisor
	if (varbind.type == snmp.ObjectType.OctetString && displayString) return value?.toLocaleString() ?? ''
	if (varbind.type == snmp.ObjectType.Counter64 && Buffer.isBuffer(value)) return bufferToBigInt(value).toString()
	if (typeof value == 'bigint') return value.toString()
	if (varbind.type == snmp.ObjectType.Opaque && Buffer.isBuffer(value)) return value.toString('base64')
	if (Buffer.isBuffer(value)) return value.toString('base64')

	return value || null
}

/**
 * Generates a random valid SNMP Engine ID
 * Format: 4 bytes enterprise OID + 1 format byte + 8 random bytes
 * @param enterpriseOid  - The enterprise OID number to use. Defaults to 63849 (Bitfocus)
 * @returns The engine ID as a hex string
 */
export const generateEngineId = (enterpriseOid = 63849): string => {
	const enterpriseBytes = Buffer.alloc(4)
	enterpriseBytes.writeUInt32BE((enterpriseOid | 0x80000000) >>> 0)

	const formatByte = Buffer.from([0x05])

	const randomBytesSeq = Buffer.from(randomBytes(8))

	return Buffer.concat([enterpriseBytes, formatByte, randomBytesSeq]).toString('hex')
}
