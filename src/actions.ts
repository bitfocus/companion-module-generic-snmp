import { type CompanionActionDefinitions, type JsonValue } from '@companion-module/base'
import type Generic_SNMP from './index.js'
import { isValidSnmpOid, prepareVarbindForVariableAssignment, trimOid } from './oidUtils.js'
import {
	ValueOption,
	DivisorOption,
	NumberObjectTypeHints,
	DisplayStringOption,
	TrapOrInformOption,
	TrapOrOidOption,
	EncodingOption,
	EnterpriseOidOption,
	VarbindOidOption,
	ObjectTypeOptions,
	ObjectValueOption,
	ObjectTypeHints,
	TrapTypeHints,
	OidDropdownOptions,
	OidOption,
} from './options.js'
import snmp from 'net-snmp'

export enum ActionId {
	SetString = 'setString',
	SetNumber = 'setNumber',
	SetBoolean = 'setBoolean',
	SetIpAddress = 'setIpAddress',
	SetOpaque = 'setOpaque',
	SetOID = 'setOID',
	GetOID = 'getOID',
	WalkOID = 'walkOID',
	TrapOrInform = 'trapOrInform',
}

export type ActionSchema = {
	[ActionId.SetString]: {
		options: {
			oid: string
			value: string
			encoding: BufferEncoding
		}
	}
	[ActionId.SetOpaque]: {
		options: {
			oid: string
			value: string
			encoding: BufferEncoding
		}
	}
	[ActionId.SetNumber]: {
		options: {
			oid: string
			type: snmp.ObjectType
			value: number
			hint_integer: never
			hint_counter: never
			hint_gauge: never
			hint_timeticks: never
		}
	}
	[ActionId.SetBoolean]: {
		options: {
			oid: string
			value: boolean | JsonValue
		}
	}
	[ActionId.SetIpAddress]: {
		options: {
			oid: string
			value: string
		}
	}
	[ActionId.SetOID]: {
		options: {
			oid: string
			value: string
		}
	}
	[ActionId.GetOID]: {
		options: {
			oid: string
			variable: string
			update: boolean
			displaystring: boolean
			div: number
			encoding: BufferEncoding
		}
	}
	[ActionId.WalkOID]: {
		options: {
			oid: string
		}
	}
	[ActionId.TrapOrInform]: {
		options: {
			messageType: 'trap' | 'inform'
			trapType: snmp.TrapType
			hint_inform_v1: never
			oidEnterprise: string
			oidVarbind: string
			objectType: snmp.ObjectType
			objectValue: string
			encoding: BufferEncoding
			hint_boolean: never
			hint_integer: never
			hint_counter: never
			hint_gauge: never
			hint_timeticks: never
			hint_counter64: never
			hint_octetstring: never
			hint_oid: never
			hint_ipaddress: never
			hint_opaque: never
			hint_coldstart: never
			hint_warmstart: never
			hint_linkdown: never
			hint_linkup: never
			hint_authfailure: never
			hint_egpneighborloss: never
		}
	}
}

export default function (self: Generic_SNMP): CompanionActionDefinitions<ActionSchema> {
	const actionDefs = {} as CompanionActionDefinitions<ActionSchema>
	actionDefs[ActionId.SetString] = {
		name: 'Set OID value to an OctetString',
		learnTimeout: 6000,
		optionsToMonitorForSubscribe: ['oid'],
		options: [
			{
				...OidDropdownOptions,
				choices: self.getOidChoices(snmp.ObjectType.OctetString),
				default: self.getOidChoices(snmp.ObjectType.OctetString)[0]?.id ?? '',
			},
			{ ...ValueOption, multiline: true },
			EncodingOption,
		],
		callback: async ({ id, options }, _context) => {
			const oid = trimOid(options.oid)
			if (!isValidSnmpOid(oid)) throw new Error(`Invalid OID supplied to action: ${id}`)
			await self.setOid(oid, snmp.ObjectType.OctetString, Buffer.from(options.value, options.encoding))
		},
		subscribe: async ({ id, options }, _context) => {
			const oid = trimOid(options.oid)
			if (!isValidSnmpOid(oid)) throw new Error(`Invalid OID supplied to action: ${id}`)
			await self.getOid(oid)
		},
		learn: async ({ id, options }, _context) => {
			const oid = trimOid(options.oid)
			if (!isValidSnmpOid(oid)) throw new Error(`Invalid OID supplied to action: ${id}`)
			await self.getOid(oid)
			if (self.oidValues.has(oid)) {
				const type = self.oidValues.get(oid)?.type
				if (type == snmp.ObjectType.OctetString) {
					const OctetString = Buffer.isBuffer(self.oidValues.get(oid)?.value)
						? (self.oidValues.get(oid)?.value as Buffer).toString(options.encoding)
						: String(self.oidValues.get(oid)?.value)
					return {
						value: OctetString,
					}
				}
			}
			return undefined
		},
	}
	actionDefs[ActionId.SetOpaque] = {
		name: 'Set OID value to an Opaque',
		learnTimeout: 6000,
		optionsToMonitorForSubscribe: ['oid'],
		options: [
			{
				...OidDropdownOptions,
				choices: self.getOidChoices(snmp.ObjectType.Opaque),
				default: self.getOidChoices(snmp.ObjectType.Opaque)[0]?.id ?? '',
			},
			{
				...ValueOption,
			},
			EncodingOption,
		],
		callback: async ({ id, options }, _context) => {
			const oid = trimOid(options.oid)
			let opaqueBuffer: Buffer
			if (!isValidSnmpOid(oid)) throw new Error(`Invalid OID supplied to action: ${id}`)

			try {
				opaqueBuffer = Buffer.from(options.value, options.encoding)
			} catch {
				throw new Error(`Value "${options.value}" is not valid for encoding ${options.encoding}`)
			}
			await self.setOid(oid, snmp.ObjectType.Opaque, opaqueBuffer)
		},
		subscribe: async ({ id, options }, _context) => {
			const oid = trimOid(options.oid)
			if (!isValidSnmpOid(oid)) throw new Error(`Invalid OID supplied to action: ${id}`)
			await self.getOid(oid)
		},
	}
	actionDefs[ActionId.SetNumber] = {
		name: 'Set OID value to a Number',
		learnTimeout: 6000,
		optionsToMonitorForSubscribe: ['oid'],
		options: [
			{
				...OidDropdownOptions,
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
			},
			{
				type: 'dropdown',
				label: 'Type',
				id: 'type',
				choices: [
					{ id: snmp.ObjectType.Integer, label: 'Integer' },
					{ id: snmp.ObjectType.Counter, label: 'Counter' },
					{ id: snmp.ObjectType.Gauge, label: 'Gauge' },
					{ id: snmp.ObjectType.TimeTicks, label: 'TimeTicks' },
				],
				default: snmp.ObjectType.Integer,
				disableAutoExpression: true,
			},
			{
				...ValueOption,
				type: 'number',
				min: -2147483648,
				max: 4294967295,
				default: 0,
				step: 1,
				expressionDescription: `Number will be rounded to nearest integer`,
			},
			...NumberObjectTypeHints,
		],
		callback: async ({ id, options }, _context) => {
			const oid = trimOid(options.oid)
			if (!isValidSnmpOid(oid)) throw new Error(`Invalid OID supplied to action: ${id}`)
			const intValue = Math.round(options.value)

			if (Number.isNaN(intValue)) {
				throw new Error(`Value "${intValue}" is not an number. SNMP message not sent.`)
			}

			await self.setOid(oid, options.type, intValue)
		},
		subscribe: async ({ id, options }, _context) => {
			const oid = trimOid(options.oid)
			if (!isValidSnmpOid(oid)) throw new Error(`Invalid OID supplied to action: ${id}`)
			await self.getOid(oid)
		},
		learn: async ({ id, options }, _context) => {
			const oid = trimOid(options.oid)
			if (!isValidSnmpOid(oid)) throw new Error(`Invalid OID supplied to action: ${id}`)
			await self.getOid(oid)
			if (self.oidValues.has(oid)) {
				const type = self.oidValues.get(oid)?.type
				if (
					type == snmp.ObjectType.Integer ||
					type == snmp.ObjectType.Gauge ||
					type == snmp.ObjectType.Counter ||
					type == snmp.ObjectType.TimeTicks
				)
					return {
						value: Number(self.oidValues.get(oid)?.value),
					}
			}
			return undefined
		},
	}

	actionDefs[ActionId.SetBoolean] = {
		name: 'Set OID value to a Boolean',
		learnTimeout: 6000,
		optionsToMonitorForSubscribe: ['oid'],
		options: [
			{
				...OidDropdownOptions,
				choices: self.getOidChoices(snmp.ObjectType.Boolean),
				default: self.getOidChoices(snmp.ObjectType.Boolean)[0]?.id ?? '',
			},
			{
				type: 'checkbox',
				label: 'Value',
				id: 'value',
				default: true,
				expressionDescription: 'true/false, yes/no, on/off, 1/0',
				allowInvalidValues: true,
			},
		],
		callback: async ({ id, options }, _context) => {
			const oid = trimOid(options.oid)
			if (!isValidSnmpOid(oid)) throw new Error(`Invalid OID supplied to action: ${id}`)
			const parsedValue = typeof options.value == 'object' ? JSON.stringify(options.value) : options.value
			let booleanValue = typeof parsedValue == 'boolean' ? parsedValue : false

			switch (String(parsedValue).trim().toLocaleLowerCase()) {
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
		subscribe: async ({ id, options }, _context) => {
			const oid = trimOid(options.oid)
			if (!isValidSnmpOid(oid)) throw new Error(`Invalid OID supplied to action: ${id}`)
			await self.getOid(oid)
		},
		learn: async ({ id, options }, _context) => {
			const oid = trimOid(options.oid)
			if (!isValidSnmpOid(oid)) throw new Error(`Invalid OID supplied to action: ${id}`)
			await self.getOid(oid)
			if (self.oidValues.has(oid)) {
				const type = self.oidValues.get(oid)?.type
				if (type == snmp.ObjectType.Boolean)
					return {
						value: Boolean(self.oidValues.get(oid)?.value),
					}
			}
			return undefined
		},
	}

	actionDefs[ActionId.SetIpAddress] = {
		name: 'Set OID value to an IP Address',
		optionsToMonitorForSubscribe: ['oid'],
		learnTimeout: 6000,
		options: [
			{
				...OidDropdownOptions,
				choices: self.getOidChoices(snmp.ObjectType.IpAddress),
				default: self.getOidChoices(snmp.ObjectType.IpAddress)[0]?.id ?? '',
			},
			{
				...ValueOption,
				regex:
					'/^(?:\\$\\([a-zA-Z0-9_.\\-]+:[a-zA-Z0-9_.\\-]+\\)|(?:(?:\\d{1,3}|\\$\\([a-zA-Z0-9_.\\-]+:[a-zA-Z0-9_.\\-]+\\))\\.){3}(?:\\d{1,3}|\\$\\([a-zA-Z0-9_.\\-]+:[a-zA-Z0-9_.\\-]+\\)))$/',
			},
		],
		callback: async ({ id, options }, _context) => {
			const oid = trimOid(options.oid)
			if (!isValidSnmpOid(oid)) throw new Error(`Invalid OID supplied to action: ${id}`)
			const value = options.value
			await self.setOid(oid, snmp.ObjectType.IpAddress, value)
		},
		subscribe: async ({ id, options }, _context) => {
			const oid = trimOid(options.oid)
			if (!isValidSnmpOid(oid)) throw new Error(`Invalid OID supplied to action: ${id}`)
			await self.getOid(oid)
		},
		learn: async ({ id, options }, _context) => {
			const oid = trimOid(options.oid)
			if (!isValidSnmpOid(oid)) throw new Error(`Invalid OID supplied to action: ${id}`)
			await self.getOid(oid)
			if (self.oidValues.has(oid)) {
				const type = self.oidValues.get(oid)?.type
				if (type == snmp.ObjectType.IpAddress)
					return {
						value: String(self.oidValues.get(oid)?.value),
					}
			}
			return undefined
		},
	}

	actionDefs[ActionId.SetOID] = {
		name: 'Set OID value to an OID',
		optionsToMonitorForSubscribe: ['oid'],
		learnTimeout: 6000,
		options: [
			{
				...OidDropdownOptions,
				choices: self.getOidChoices(snmp.ObjectType.OID),
				default: self.getOidChoices(snmp.ObjectType.OID)[0]?.id ?? '',
			},
			{
				...ValueOption,
				regex:
					'/^(?:\\$\\([a-zA-Z0-9\\-_.]+:[a-zA-Z0-9\\-_.]+\\)|(?:\\d+|\\$\\([a-zA-Z0-9\\-_.]+:[a-zA-Z0-9\\-_.]+\\))(?:\\.(?:\\d+|\\$\\([a-zA-Z0-9\\-_.]+:[a-zA-Z0-9\\-_.]+\\)))*)$/',
			},
		],
		callback: async ({ id, options }, _context) => {
			const oid = trimOid(options.oid)
			if (!isValidSnmpOid(oid)) throw new Error(`Invalid OID supplied to action: ${id}`)
			const value = options.value
			await self.setOid(oid, snmp.ObjectType.OID, value)
		},
		subscribe: async ({ id, options }, _context) => {
			const oid = trimOid(options.oid)
			if (!isValidSnmpOid(oid)) throw new Error(`Invalid OID supplied to action: ${id}`)
			await self.getOid(oid)
		},
		learn: async ({ id, options }, _context) => {
			const oid = trimOid(options.oid)
			if (!isValidSnmpOid(oid)) throw new Error(`Invalid OID supplied to action: ${id}`)
			await self.getOid(oid)
			if (self.oidValues.has(oid)) {
				const type = self.oidValues.get(oid)?.type
				if (type == snmp.ObjectType.OID)
					return {
						value: String(self.oidValues.get(oid)?.value),
					}
			}
			return undefined
		},
	}

	actionDefs[ActionId.GetOID] = {
		name: 'Get OID value',
		learnTimeout: 6000,
		optionsToMonitorForSubscribe: ['oid'],
		options: [
			{
				...OidDropdownOptions,
				choices: self.getOidChoices(),
				default: self.getOidChoices()[0]?.id ?? '',
			},
			{
				type: 'custom-variable',
				label: 'Variable',
				id: 'variable',
				description: 'Custom Variable that OID value is returned to',
				disableAutoExpression: true,
			},
			{
				type: 'checkbox',
				label: 'Update',
				id: 'update',
				description: 'Update each poll interval',
				default: false,
			},
			DisplayStringOption,
			DivisorOption,
			EncodingOption,
		],
		callback: async (action, context) => {
			if (!action.options.variable) throw new Error(`No variable selected: ${action.id}`)
			const oid = trimOid(action.options.oid)
			if (!isValidSnmpOid(oid)) throw new Error(`Invalid OID supplied to action: ${action.id}`)
			await self.getOid(oid)
			const varbind = self.oidValues.get(oid)
			if (varbind == undefined || varbind.value === undefined)
				throw new Error(`Varbind not found, can't update custom variable ${action.options.variable}`)
			const value =
				prepareVarbindForVariableAssignment(
					varbind,
					action.options.displaystring,
					action.options.div,
					action.options.encoding,
				) ?? ''
			context.setCustomVariableValue(action.options.variable, value)
		},
		subscribe: async (action, _context) => {
			const oid = trimOid(action.options.oid)
			if (!isValidSnmpOid(oid)) throw new Error(`Invalid OID supplied to action: ${action.id}`)
			if (action.options.update) {
				self.oidTracker.addToPollGroup(oid, action.id)
			} else self.oidTracker.removeFromPollGroup(oid, action.id)
			await self.getOid(oid)
		},
		learn: async (action, _context) => {
			const oid = trimOid(action.options.oid)
			if (!isValidSnmpOid(oid)) throw new Error(`Invalid OID supplied to action: ${action.id}`)
			await self.getOid(oid)
			return undefined
		},
	}

	actionDefs[ActionId.WalkOID] = {
		name: 'Walk MIB starting from OID',
		options: [
			{
				...OidOption,
				description: `Walk MIB from this OID. Returned Varbinds cached.`,
			},
		],
		callback: async ({ id, options }, _context) => {
			const oid = trimOid(options.oid)
			if (!isValidSnmpOid(oid)) throw new Error(`Invalid OID supplied to action: ${id}`)
			await self.walk(oid)
		},
	}

	actionDefs[ActionId.TrapOrInform] = {
		name: 'Send Trap or Inform message',
		learnTimeout: 6000,
		options: [
			TrapOrInformOption,
			{
				type: 'static-text',
				id: 'hint_inform_v1',
				label: 'Warning',
				value: 'Inform not allowed for SNMP `v1`. Please select `Trap` message type or change to SNMP `v2c` or `v3`.',
				isVisibleExpression: `$(options:messageType) == 'inform' && ${self.config.version == 'v1'}`,
				disableAutoExpression: true,
			},
			TrapOrOidOption,
			EnterpriseOidOption,
			VarbindOidOption,
			ObjectTypeOptions,
			ObjectValueOption,
			{
				...EncodingOption,
				isVisibleExpression: `$(options:trapType) == ${snmp.TrapType.EnterpriseSpecific} && ($(options:objectType) == ${snmp.ObjectType.Opaque} || $(options:objectType) == ${snmp.ObjectType.OctetString})`,
			},
			...ObjectTypeHints,
			...TrapTypeHints,
		],
		callback: async ({ id, options }, _context) => {
			const { messageType, trapType, oidEnterprise, oidVarbind, objectType, objectValue, encoding } = options
			if (trapType !== snmp.TrapType.EnterpriseSpecific) {
				switch (messageType) {
					case 'inform':
						await self.sendInform(trapType)
						return
					case 'trap':
						await self.sendTrap(trapType)
						return
				}
			}
			const oid = trimOid(oidVarbind)
			if (!isValidSnmpOid(oid)) throw new Error(`Invalid OID supplied to action: ${id}`)
			const varbindValue =
				objectType == snmp.ObjectType.Opaque || objectType == snmp.ObjectType.OctetString
					? Buffer.from(objectValue, encoding)
					: objectValue
			const VarBind: snmp.Varbind = {
				oid: trimOid(oidVarbind),
				type: objectType,
				value: varbindValue,
			}
			switch (messageType) {
				case 'inform':
					await self.sendInform(trimOid(oidEnterprise), VarBind)
					return
				case 'trap':
					await self.sendTrap(trimOid(oidEnterprise), VarBind)
					return
			}
		},
		learn: async ({ id, options }, _context) => {
			const oid = trimOid(options.oidVarbind)
			const isV1 = self.config.version == 'v1'
			if (!isValidSnmpOid(oid)) throw new Error(`Invalid OID supplied to action: ${id}`)
			//await self.getOid(oid)
			const retunedOptions: Partial<ActionSchema[ActionId.TrapOrInform]['options']> = {}
			if (self.oidValues.has(oid)) {
				const type = self.oidValues.get(oid)?.type
				if (type) retunedOptions.objectType = type
			}
			// Force to Trap message type if configured for SNMP v1 as Informs aren't supported in v1.
			if (isV1) retunedOptions.messageType = 'trap'
			return Object.keys(retunedOptions).length > 0 ? retunedOptions : undefined
		},
	}

	return actionDefs
}
