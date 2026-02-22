import { Regex } from '@companion-module/base'
import snmp from 'net-snmp'

export const OidRegex =
	'/^(?:\\d+|\\$\\([a-zA-Z0-9\\-_.]+:[a-zA-Z0-9\\-_.]+\\))(?:\\.(?:\\d+|\\$\\([a-zA-Z0-9\\-_.]+:[a-zA-Z0-9\\-_.]+\\)))*$/'

export const OidOption = {
	type: 'textinput',
	label: 'OID',
	id: 'oid',
	default: '',
	required: true,
	regex: OidRegex,
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

export const TrapOrInformOption = {
	type: 'dropdown',
	id: 'messageType',
	label: 'Message Type',
	choices: [
		{ id: 'trap', label: 'Trap' },
		{ id: 'inform', label: 'Inform' },
	],
	default: 'trap',
}

export const TrapOrOidOption = {
	type: 'dropdown',
	id: 'trapType',
	label: 'Trap Type',
	choices: [
		{ id: snmp.TrapType.ColdStart, label: 'Cold Start' },
		{ id: snmp.TrapType.WarmStart, label: 'Warm Start' },
		{ id: snmp.TrapType.LinkDown, label: 'Link Down' },
		{ id: snmp.TrapType.LinkUp, label: 'Link Up' },
		{ id: snmp.TrapType.AuthenticationFailure, label: 'Authentication Failure' },
		{ id: snmp.TrapType.EgpNeighborLoss, label: 'EGP Neighbor Loss' },
		{ id: snmp.TrapType.EnterpriseSpecific, label: 'Enterprise-specific Trap' },
	],
	default: snmp.TrapType.EnterpriseSpecific,
}
const trapTypeVisible = (trapType) => `$(options:trapType) == ${trapType}`

export const TrapTypeHints = [
	{
		type: 'static-text',
		id: 'hint_coldstart',
		label: 'Cold Start',
		value:
			"Signifies that the sending protocol entity is reinitializing itself such that the agent's configuration or the protocol entity implementation may be altered.",
		isVisibleExpression: trapTypeVisible(snmp.TrapType.ColdStart),
	},
	{
		type: 'static-text',
		id: 'hint_warmstart',
		label: 'Warm Start',
		value:
			'Signifies that the sending protocol entity is reinitializing itself such that neither the agent configuration nor the protocol entity implementation is altered.',
		isVisibleExpression: trapTypeVisible(snmp.TrapType.WarmStart),
	},
	{
		type: 'static-text',
		id: 'hint_linkdown',
		label: 'Link Down',
		value:
			"Signifies that the sending protocol entity recognizes a failure in one of the communication links represented in the agent's configuration. Should include <code>ifIndex</code> in varbinds.",
		isVisibleExpression: trapTypeVisible(snmp.TrapType.LinkDown),
	},
	{
		type: 'static-text',
		id: 'hint_linkup',
		label: 'Link Up',
		value:
			"Signifies that the sending protocol entity recognizes that one of the communication links represented in the agent's configuration has come up. Should include <code>ifIndex</code> in varbinds.",
		isVisibleExpression: trapTypeVisible(snmp.TrapType.LinkUp),
	},
	{
		type: 'static-text',
		id: 'hint_authfailure',
		label: 'Authentication Failure',
		value:
			'Signifies that the sending protocol entity is the addressee of a protocol message that is not properly authenticated.',
		isVisibleExpression: trapTypeVisible(snmp.TrapType.AuthenticationFailure),
	},
	{
		type: 'static-text',
		id: 'hint_egpneighborloss',
		label: 'EGP Neighbor Loss',
		value:
			'Signifies that an EGP neighbor for whom the sending protocol entity was an EGP peer has been marked down and the peer relationship no longer obtains. Should include <code>egpNeighAddr</code> in varbinds.',
		isVisibleExpression: trapTypeVisible(snmp.TrapType.EgpNeighborLoss),
	},
]

export const EnterpriseOidOption = {
	type: 'textinput',
	label: 'OID',
	id: 'oidEnterprise',
	default: '1.3.6.1.4.1.63849.1',
	required: true,
	regex: OidRegex,
	useVariables: { local: true },
	isVisibleExpression: `$(options:trapType) == ${snmp.TrapType.EnterpriseSpecific}`,
	description: 'Enterprise, Inform or Trap OID depending on configuration',
}

export const VarbindOidOption = {
	type: 'textinput',
	label: 'VarBind OID',
	id: 'oidVarbind',
	default: '1.3.6.1.4.1.63849.1',
	required: true,
	regex: OidRegex,
	useVariables: { local: true },
	isVisibleExpression: `$(options:trapType) == ${snmp.TrapType.EnterpriseSpecific}`,
}

export const ObjectTypeOptions = {
	type: 'dropdown',
	id: 'objectType',
	label: 'VarBind Type',
	choices: [
		{ id: snmp.ObjectType.Boolean, label: 'Boolean' },
		{ id: snmp.ObjectType.Integer, label: 'Integer' },
		{ id: snmp.ObjectType.Counter, label: 'Counter' },
		{ id: snmp.ObjectType.Gauge, label: 'Gauge' },
		{ id: snmp.ObjectType.TimeTicks, label: 'Time Ticks' },
		{ id: snmp.ObjectType.Counter64, label: 'Counter 64' },
		{ id: snmp.ObjectType.OctetString, label: 'Octet String' },
		{ id: snmp.ObjectType.OID, label: 'OID' },
		{ id: snmp.ObjectType.IpAddress, label: 'Ip Address' },
		{ id: snmp.ObjectType.Opaque, label: 'Opaque' },
		{ id: snmp.ObjectType.Null, label: 'Null' },
	],
	default: snmp.ObjectType.Integer,
	isVisibleExpression: `$(options:trapType) == ${snmp.TrapType.EnterpriseSpecific}`,
}

export const ObjectValueOption = {
	type: 'textinput',
	id: 'objectValue',
	label: 'VarBind Value',
	default: '',
	useVariables: { local: true },
	isVisibleExpression: `$(options:trapType) == ${snmp.TrapType.EnterpriseSpecific} && $(options:objectType) != ${snmp.ObjectType.Null}`,
}

const enterpriseSpecific = `$(options:trapType) == ${snmp.TrapType.EnterpriseSpecific}`

export const ObjectTypeHints = [
	{
		type: 'static-text',
		id: 'hint_boolean',
		label: 'Accepted values',
		value: 'true/false, 1/0, yes/no, on/off',
		isVisibleExpression: `${enterpriseSpecific} && $(options:objectType) == ${snmp.ObjectType.Boolean}`,
	},
	{
		type: 'static-text',
		id: 'hint_integer',
		label: 'Accepted values',
		value:
			'Signed 32-bit integer in range [-2147483648, 2147483647]. Decimal (e.g. 42) or hex (e.g. 0x2A) format accepted.',
		isVisibleExpression: `${enterpriseSpecific} && $(options:objectType) == ${snmp.ObjectType.Integer}`,
	},
	{
		type: 'static-text',
		id: 'hint_counter',
		label: 'Accepted values',
		value: 'Unsigned 32-bit integer in range [0, 4294967295]. Decimal (e.g. 42) or hex (e.g. 0x2A) format accepted.',
		isVisibleExpression: `${enterpriseSpecific} && $(options:objectType) == ${snmp.ObjectType.Counter}`,
	},
	{
		type: 'static-text',
		id: 'hint_gauge',
		label: 'Accepted values',
		value: 'Unsigned 32-bit integer in range [0, 4294967295]. Decimal (e.g. 42) or hex (e.g. 0x2A) format accepted.',
		isVisibleExpression: `${enterpriseSpecific} && $(options:objectType) == ${snmp.ObjectType.Gauge}`,
	},
	{
		type: 'static-text',
		id: 'hint_timeticks',
		label: 'Accepted values',
		value:
			'Unsigned 32-bit integer in range [0, 4294967295], representing hundredths of a second. Decimal (e.g. 42) or hex (e.g. 0x2A) format accepted.',
		isVisibleExpression: `${enterpriseSpecific} && $(options:objectType) == ${snmp.ObjectType.TimeTicks}`,
	},
	{
		type: 'static-text',
		id: 'hint_counter64',
		label: 'Accepted values',
		value:
			'Unsigned 64-bit integer in range [0, 18446744073709551615]. Decimal (e.g. 42) or hex (e.g. 0x2A) format accepted.',
		isVisibleExpression: `${enterpriseSpecific} && $(options:objectType) == ${snmp.ObjectType.Counter64}`,
	},
	{
		type: 'static-text',
		id: 'hint_octetstring',
		label: 'Accepted values',
		value: 'Any string.',
		isVisibleExpression: `${enterpriseSpecific} && $(options:objectType) == ${snmp.ObjectType.OctetString}`,
	},
	{
		type: 'static-text',
		id: 'hint_oid',
		label: 'Accepted values',
		value:
			'A valid OID in dotted numeric notation (e.g. 1.3.6.1.2.1.1.1.0). Leading dots will be trimmed automatically.',
		isVisibleExpression: `${enterpriseSpecific} && $(options:objectType) == ${snmp.ObjectType.OID}`,
	},
	{
		type: 'static-text',
		id: 'hint_ipaddress',
		label: 'Accepted values',
		value: 'A valid IPv4 address in dotted decimal notation (e.g. 192.168.1.1).',
		isVisibleExpression: `${enterpriseSpecific} && $(options:objectType) == ${snmp.ObjectType.IpAddress}`,
	},
	{
		type: 'static-text',
		id: 'hint_opaque',
		label: 'Accepted values',
		value: 'Buffer encoded as Base64 string. Will be padded as necessary',
		isVisibleExpression: `${enterpriseSpecific} && $(options:objectType) == ${snmp.ObjectType.Opaque}`,
	},
]

/** @typedef {InstanceType<typeof import('./index.js').Generic_SNMP>} Generic_SNMP */

/**
 * @param {Generic_SNMP} self
 */

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
		learn: async ({ options }, _context) => {
			await self.getOid(options.oid)
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
				regex: '/^(?:true|false|yes|no|on|off|1|0|\\$\\([a-zA-Z0-9\\-_.]+:[a-zA-Z0-9\\-_.]+\\))$/i',
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
		learn: async ({ options }, _context) => {
			await self.getOid(options.oid)
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
		options: [
			OidOption,
			{
				...ValueOption,
				regex:
					'/^(?:\\$\\([a-zA-Z0-9_.\\-]+:[a-zA-Z0-9_.\\-]+\\)|(?:(?:\\d{1,3}|\\$\\([a-zA-Z0-9_.\\-]+:[a-zA-Z0-9_.\\-]+\\))\\.){3}(?:\\d{1,3}|\\$\\([a-zA-Z0-9_.\\-]+:[a-zA-Z0-9_.\\-]+\\)))$/',
			},
		],
		callback: async ({ options }, _context) => {
			const oid = options.oid
			const value = options.value
			await self.setOid(oid, snmp.ObjectType.IpAddress, value)
		},
		learn: async ({ options }, _context) => {
			await self.getOid(options.oid)
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
		options: [
			OidOption,
			{
				...ValueOption,
				regex:
					'/^(?:\\$\\([a-zA-Z0-9\\-_.]+:[a-zA-Z0-9\\-_.]+\\)|(?:\\d+|\\$\\([a-zA-Z0-9\\-_.]+:[a-zA-Z0-9\\-_.]+\\))(?:\\.(?:\\d+|\\$\\([a-zA-Z0-9\\-_.]+:[a-zA-Z0-9\\-_.]+\\)))*)$/',
			},
		],
		callback: async ({ options }, _context) => {
			const oid = options.oid
			const value = options.value
			await self.setOid(oid, snmp.ObjectType.oid, value)
		},
		learn: async ({ options }, _context) => {
			await self.getOid(options.oid)
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
			await self.getOid(options.oid)
			const value = self.oidValues.get(options.oid)
			context.setCustomVariableValue(options.variable, value)
		},
		subscribe: async ({ options }, _context) => {
			if (options.update) {
				self.pendingOids.add(options.oid)
				self.throttledBatchGet()
			}
		},
		learn: async ({ options }, _context) => {
			await self.getOid(options.oid)
			return undefined
		},
	}

	actionDefs['trapOrInform'] = {
		name: 'Send Trap or Inform message',
		options: [
			TrapOrInformOption,
			TrapOrOidOption,
			EnterpriseOidOption,
			VarbindOidOption,
			ObjectTypeOptions,
			ObjectValueOption,
			...ObjectTypeHints,
			...TrapTypeHints,
		],
		callback: async ({ options }, _context) => {
			const { messageType, trapType, oidEnterprise, oidVarbind, objectType, objectValue } = options
			if (trapType !== snmp.TrapType.EnterpriseSpecific) {
				switch (messageType) {
					case 'inform':
						return await self.sendInform(trapType)
					case 'trap':
						return await self.sendTrap(trapType)
				}
			}
			const VarBind = {
				oid: oidVarbind,
				type: objectType,
				value: objectValue,
			}
			switch (messageType) {
				case 'inform':
					return await self.sendInform(oidEnterprise, [VarBind])
				case 'trap':
					return await self.sendTrap(oidEnterprise, [VarBind])
			}
		},
	}

	self.setActionDefinitions(actionDefs)
}
