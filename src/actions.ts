import {
	CompanionActionDefinition,
	type CompanionInputFieldCheckbox,
	type CompanionInputFieldDropdown,
	type CompanionInputFieldStaticText,
	type CompanionInputFieldTextInput,
	Regex,
} from '@companion-module/base'
import type { Generic_SNMP } from './index.js'
import { prepareVarbindForVariableAssignment } from './oidUtils.js'
import { DivisorOption } from './feedbacks.js'
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
} as const satisfies CompanionInputFieldTextInput

const ValueOption = {
	type: 'textinput',
	label: 'Value',
	id: 'value',
	default: '',
	required: true,
	regex: Regex.SOMETHING,
	useVariables: { local: true },
} as const satisfies CompanionInputFieldTextInput

export const DisplayStringOption = {
	type: 'checkbox',
	label: 'DisplayString',
	id: 'displaystring',
	tooltip: 'Convert OctetString (array of numbers) to DisplayString (text)',
	default: true,
} as const satisfies CompanionInputFieldCheckbox

export const UpdateOption = {
	type: 'checkbox',
	label: 'Update',
	id: 'update',
	tooltip: 'Update each poll interval',
	default: false,
} as const satisfies CompanionInputFieldCheckbox

export const TrapOrInformOption = {
	type: 'dropdown',
	id: 'messageType',
	label: 'Message Type',
	choices: [
		{ id: 'trap', label: 'Trap' },
		{ id: 'inform', label: 'Inform' },
	],
	default: 'trap',
} as const satisfies CompanionInputFieldDropdown

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
} as const satisfies CompanionInputFieldDropdown
const trapTypeVisible = (trapType: snmp.TrapType): string => `$(options:trapType) == ${trapType}`

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
] as const satisfies CompanionInputFieldStaticText[]

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
} as const satisfies CompanionInputFieldTextInput

export const VarbindOidOption = {
	type: 'textinput',
	label: 'VarBind OID',
	id: 'oidVarbind',
	default: '1.3.6.1.4.1.63849.1',
	required: true,
	regex: OidRegex,
	useVariables: { local: true },
	isVisibleExpression: `$(options:trapType) == ${snmp.TrapType.EnterpriseSpecific}`,
} as const satisfies CompanionInputFieldTextInput

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
} as const satisfies CompanionInputFieldDropdown

export const ObjectValueOption = {
	type: 'textinput',
	id: 'objectValue',
	label: 'VarBind Value',
	default: '',
	useVariables: { local: true },
	isVisibleExpression: `$(options:trapType) == ${snmp.TrapType.EnterpriseSpecific} && $(options:objectType) != ${snmp.ObjectType.Null}`,
} as const satisfies CompanionInputFieldTextInput

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
] as const satisfies CompanionInputFieldStaticText[]

export enum ActionId {
	SetString = 'setString',
	SetNumber = 'setNumber',
	SetBoolean = 'setBoolean',
	SetIpAddress = 'setIpAddress',
	SetOpaque = 'setOpaque',
	SetOID = 'setOID',
	GetOID = 'getOID',
	TrapOrInform = 'trapOrInform',
}

export default function (self: Generic_SNMP): void {
	const actionDefs = {} as Record<ActionId, CompanionActionDefinition>
	actionDefs[ActionId.SetString] = {
		name: 'Set OID value to an OctetString',
		options: [
			{
				type: 'dropdown',
				id: 'oid',
				label: 'OID',
				choices: self.getOidChoices(snmp.ObjectType.OctetString),
				default: self.getOidChoices(snmp.ObjectType.OctetString)[0]?.id ?? '',
				regex: '/^\\d+(?:\\.\\d+)*$/',
			},
			ValueOption,
		],
		callback: async ({ options }, _context) => {
			const oid = String(options.oid)
			const value = String(options.value)
			await self.setOid(oid, snmp.ObjectType.OctetString, value)
		},
	}
	actionDefs[ActionId.SetOpaque] = {
		name: 'Set OID value to an Opaque',
		options: [
			{
				type: 'dropdown',
				id: 'oid',
				label: 'OID',
				choices: self.getOidChoices(snmp.ObjectType.Opaque),
				default: self.getOidChoices(snmp.ObjectType.Opaque)[0]?.id ?? '',
				regex: '/^\\d+(?:\\.\\d+)*$/',
			},
			{
				...ValueOption,
				regex: '/^(?:\\$\\([a-zA-Z0-9\\-_.]+:[a-zA-Z0-9\\-_.]+\\)|[A-Za-z0-9+/]*={0,2})$/',
				description: 'Enter the value as a base64 encoded string (e.g. SGVsbG8gV29ybGQ=)',
			},
		],
		callback: async ({ options }, _context) => {
			const oid = String(options.oid)
			const value = String(options.value)
			await self.setOid(oid, snmp.ObjectType.Opaque, value)
		},
	}
	actionDefs[ActionId.SetNumber] = {
		name: 'Set OID value to a Number',
		options: [
			{
				type: 'dropdown',
				id: 'oid',
				label: 'OID',
				choices: self.getOidChoices(
					snmp.ObjectType.Counter,
					snmp.ObjectType.Gauge,
					snmp.ObjectType.Integer,
					snmp.ObjectType.TimeTicks,
				),
				default:
					self.getOidChoices(
						snmp.ObjectType.Counter,
						snmp.ObjectType.Gauge,
						snmp.ObjectType.Integer,
						snmp.ObjectType.TimeTicks,
					)[0]?.id ?? '',
				regex: '/^\\d+(?:\\.\\d+)*$/',
			},
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
			const oid = String(options.oid)
			const intValue = parseInt(options.value?.toString() ?? '')

			if (Number.isNaN(intValue)) {
				throw new Error(`Value "${intValue}" is not an number. SNMP message not sent.`)
			}

			await self.setOid(oid, options.type as snmp.ObjectType, intValue)
		},
		learn: async ({ options }, _context) => {
			await self.getOid(String(options.oid))
			if (self.oidValues.has(options.oid?.toString() ?? '')) {
				return {
					...options,
					value: self.oidValues.get(options.oid?.toString() ?? '')?.value?.toLocaleString(),
				}
			}
			return undefined
		},
	}

	actionDefs[ActionId.SetBoolean] = {
		name: 'Set OID value to a Boolean',
		options: [
			{
				type: 'dropdown',
				id: 'oid',
				label: 'OID',
				choices: self.getOidChoices(snmp.ObjectType.Boolean),
				default: self.getOidChoices(snmp.ObjectType.Boolean)[0]?.id ?? '',
				regex: '/^\\d+(?:\\.\\d+)*$/',
			},
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
			const oid = options.oid?.toString() ?? ''
			const parsedValue = options.value?.toString() ?? ''
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
			const oid = options.oid?.toString() ?? ''
			await self.getOid(oid)
			if (self.oidValues.has(oid)) {
				return {
					...options,
					value: self.oidValues.get(oid)?.value?.toLocaleString(),
				}
			}
			return undefined
		},
	}

	actionDefs[ActionId.SetIpAddress] = {
		name: 'Set OID value to an IP Address',
		options: [
			{
				type: 'dropdown',
				id: 'oid',
				label: 'OID',
				choices: self.getOidChoices(snmp.ObjectType.IpAddress),
				default: self.getOidChoices(snmp.ObjectType.IpAddress)[0]?.id ?? '',
				regex: '/^\\d+(?:\\.\\d+)*$/',
			},
			{
				...ValueOption,
				regex:
					'/^(?:\\$\\([a-zA-Z0-9_.\\-]+:[a-zA-Z0-9_.\\-]+\\)|(?:(?:\\d{1,3}|\\$\\([a-zA-Z0-9_.\\-]+:[a-zA-Z0-9_.\\-]+\\))\\.){3}(?:\\d{1,3}|\\$\\([a-zA-Z0-9_.\\-]+:[a-zA-Z0-9_.\\-]+\\)))$/',
			},
		],
		callback: async ({ options }, _context) => {
			const oid = options.oid?.toString() ?? ''
			const value = String(options.value)
			await self.setOid(oid, snmp.ObjectType.IpAddress, value)
		},
		learn: async ({ options }, _context) => {
			const oid = options.oid?.toString() ?? ''
			await self.getOid(oid)
			if (self.oidValues.has(oid)) {
				return {
					...options,
					value: self.oidValues.get(oid)?.value?.toLocaleString(),
				}
			}
			return undefined
		},
	}

	actionDefs[ActionId.SetOID] = {
		name: 'Set OID value to an OID',
		options: [
			{
				type: 'dropdown',
				id: 'oid',
				label: 'OID',
				choices: self.getOidChoices(snmp.ObjectType.OID),
				default: self.getOidChoices(snmp.ObjectType.OID)[0]?.id ?? '',
				regex: '/^\\d+(?:\\.\\d+)*$/',
			},
			{
				...ValueOption,
				regex:
					'/^(?:\\$\\([a-zA-Z0-9\\-_.]+:[a-zA-Z0-9\\-_.]+\\)|(?:\\d+|\\$\\([a-zA-Z0-9\\-_.]+:[a-zA-Z0-9\\-_.]+\\))(?:\\.(?:\\d+|\\$\\([a-zA-Z0-9\\-_.]+:[a-zA-Z0-9\\-_.]+\\)))*)$/',
			},
		],
		callback: async ({ options }, _context) => {
			const oid = String(options.oid)
			const value = String(options.value)
			await self.setOid(oid, snmp.ObjectType.OID, value)
		},
		learn: async ({ options }, _context) => {
			const oid = options.oid?.toString() ?? ''
			await self.getOid(oid)
			if (self.oidValues.has(oid)) {
				return {
					...options,
					value: self.oidValues.get(oid)?.value?.toLocaleString(),
				}
			}
			return undefined
		},
	}

	actionDefs[ActionId.GetOID] = {
		name: 'Get OID value',
		options: [
			{
				type: 'dropdown',
				id: 'oid',
				label: 'OID',
				choices: self.getOidChoices(),
				default: self.getOidChoices()[0]?.id ?? '',
				regex: '/^\\d+(?:\\.\\d+)*$/',
			},
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
			DivisorOption,
		],
		callback: async ({ options }, context) => {
			const oid = options.oid?.toString() ?? ''
			await self.getOid(oid)
			const varbind = self.oidValues.get(oid)
			if (varbind == undefined || varbind.value === undefined)
				throw new Error(`Varbind not found, can't update custom variable ${options.variable}`)
			if (options.variable)
				context.setCustomVariableValue(
					options.variable.toString(),
					prepareVarbindForVariableAssignment(varbind, Boolean(options.displaystring), Number(options.div)) ?? '',
				)
		},
		subscribe: async ({ options }, _context) => {
			if (options.update) {
				const oid = options.oid?.toString() ?? ''
				self.pendingOids.add(oid)
				self.throttledBatchGet()
			}
		},
		learn: async ({ options }, _context) => {
			await self.getOid(String(options.oid))
			return undefined
		},
	}

	actionDefs[ActionId.TrapOrInform] = {
		name: 'Send Trap or Inform message',
		options: [
			TrapOrInformOption,
			{
				type: 'static-text',
				id: 'hint_inform_v1',
				label: 'Warning',
				value: 'Inform not allowed for SNMP `v1`. Please select `Trap` message type or change to SNMP `v2c` or `v3`.',
				isVisibleExpression: `$(options:messageType) == 'inform' && ${self.config.version == 'v1'}`,
			},
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
						await self.sendInform(trapType as snmp.TrapType)
						return
					case 'trap':
						await self.sendTrap(trapType as snmp.TrapType)
						return
				}
			}
			const VarBind: snmp.Varbind = {
				oid: String(oidVarbind),
				type: objectType as snmp.ObjectType,
				value: objectValue as snmp.VarbindValue,
			}
			switch (messageType) {
				case 'inform':
					await self.sendInform(String(oidEnterprise), VarBind)
					return
				case 'trap':
					await self.sendTrap(String(oidEnterprise), VarBind)
					return
			}
		},
	}

	self.setActionDefinitions(actionDefs)
}
