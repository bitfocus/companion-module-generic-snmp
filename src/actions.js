import { Regex } from '@companion-module/base'
import snmp from 'net-snmp'

export const OidOption = {
	type: 'textinput',
	label: 'OID',
	id: 'oid',
	default: '',
	required: true,
	regex: Regex.SOMETHING,
	useVariables: { local: true },
}

const ValueOption = {
	type: 'textinput',
	label: 'Value',
	id: 'value',
	default: '',
	required: true,
	regex: Regex.SOMETHING,
	useVariables: { local: true },
}

export const DisplayStringOption = {
	type: 'checkbox',
	label: 'DisplayString',
	id: 'displaystring',
	tooltip: 'Convert OctetString (array of numbers) to DisplayString (text)',
	default: true,
}

export default async function (self) {
	const actionDefs = {}
	actionDefs['setString'] = {
		name: 'Set OID value to an OctetString',
		options: [OidOption, ValueOption],
		callback: async ({ options }, _context) => {
			const oid = options.oid
			const value = options.value
			await self.setOid(oid, snmp.ObjectType.OctetString, value)
		},
	}

	actionDefs['setNumber'] = {
		name: 'Set OID value to a Number',
		options: [
			OidOption,
			{
				type: 'dropdown',
				label: 'Type',
				id: 'type',
				choices: [
					{ id: snmp.ObjectType.Integer, label: 'Integer' },
					{ id: snmp.ObjectType.Counter, label: 'Counter' },
					//{ id: snmp.ObjectType.Counter32, label: 'Counter32' },
					{ id: snmp.ObjectType.Gauge, label: 'Gauge' },
					//{ id: snmp.ObjectType.Gauge32, label: 'Gauge32' },
					{ id: snmp.ObjectType.TimeTicks, label: 'TimeTicks' },
					//{ id: snmp.ObjectType.Unsigned32, label: 'Unsigned32' },
				],
				default: snmp.ObjectType.Integer,
			},
			{
				...ValueOption,
				default: '0',
			},
		],
		callback: async ({ options }, _context) => {
			const oid = options.oid
			const intValue = parseInt(options.value)

			if (Number.isNaN(intValue)) {
				throw new Error(`Value "${intValue}" is not an number. SNMP message not sent.`)
			}

			await self.setOid(oid, options.type, intValue)
		},
		learn: async ({ options }, context) => {
			await self.getOid(options.oid, '', options.displaystring, context)
			if (self.oidValues.has(options.oid)) {
				return {
					...options,
					value: self.oidValues.get(options.oid).toString(),
				}
			}
			return undefined
		},
	}

	actionDefs['setBoolean'] = {
		name: 'Set OID value to a Boolean',
		options: [
			OidOption,
			{
				type: 'textinput',
				label: 'Value (true/false, yes/no, on/off, 1/0)',
				id: 'value',
				default: 'true',
				useVariables: { local: true },
			},
		],
		callback: async ({ options }, _context) => {
			const oid = options.oid
			const parsedValue = options.value
			let booleanValue = false

			switch (parsedValue.trim().toLocaleLowerCase()) {
				case 'true':
				case 'on':
				case '1':
				case 'yes': {
					booleanValue = true
					break
				}
				case 'false':
				case 'off':
				case '0':
				case 'no': {
					booleanValue = false
					break
				}
				default: {
					throw new Error(`Value "${parsedValue}" is not an boolean. SNMP message not sent.`)
				}
			}

			await self.setOid(oid, snmp.ObjectType.Boolean, booleanValue)
		},
		learn: async ({ options }, context) => {
			await self.getOid(options.oid, '', options.displaystring, context)
			if (self.oidValues.has(options.oid)) {
				return {
					...options,
					value: self.oidValues.get(options.oid).toString(),
				}
			}
			return undefined
		},
	}

	actionDefs['setIpAddress'] = {
		name: 'Set OID value to an IP Address',
		options: [OidOption, ValueOption],
		callback: async ({ options }, _context) => {
			const oid = options.oid
			const value = options.value
			await self.setOid(oid, snmp.ObjectType.IpAddress, value)
		},
		learn: async ({ options }, context) => {
			await self.getOid(options.oid, '', options.displaystring, context)
			if (self.oidValues.has(options.oid)) {
				return {
					...options,
					value: self.oidValues.get(options.oid).toString(),
				}
			}
			return undefined
		},
	}

	actionDefs['setOID'] = {
		name: 'Set OID value to an OID',
		options: [OidOption, ValueOption],
		callback: async ({ options }, _context) => {
			const oid = options.oid
			const value = options.value
			await self.setOid(oid, snmp.ObjectType.oid, value)
		},
		learn: async ({ options }, context) => {
			await self.getOid(options.oid, '', options.displaystring, context)
			if (self.oidValues.has(options.oid)) {
				return {
					...options,
					value: self.oidValues.get(options.oid).toString(),
				}
			}
			return undefined
		},
	}
	actionDefs['getOID'] = {
		name: 'Get OID value',
		options: [
			OidOption,
			{
				type: 'custom-variable',
				label: 'Variable',
				id: 'variable',
				tooltip: 'Custom Variable that OID value is returned to',
			},
			{
				type: 'checkbox',
				label: 'Update',
				id: 'update',
				tooltip: 'Update each poll interval',
				default: false,
			},
			DisplayStringOption,
		],
		callback: async ({ options }, context) => {
			await self.getOid(options.oid, options.variable, options.displaystring, context)
		},
		subscribe: async ({ options }, context) => {
			if (options.update) {
				await self.getOid(options.oid, options.variable, options.displaystring, context)
			}
		},
		learn: async ({ options }, context) => {
			await self.getOid(options.oid, options.variable, options.displaystring, context)
			return undefined
		},
	}

	self.setActionDefinitions(actionDefs)
}
