import { type CompanionActionDefinitions, type JsonValue } from '@companion-module/base'
import type Generic_SNMP from './index.js'
import { prepareVarbindForVariableAssignment, trimOid } from './oidUtils.js'
import {
	ValueOption,
	DivisorOption,
	NumberObjectTypeHints,
	DisplayStringOption,
	TrapOrInformOption,
	TrapOrOidOption,
	EnterpriseOidOption,
	VarbindOidOption,
	ObjectTypeOptions,
	ObjectValueOption,
	ObjectTypeHints,
	TrapTypeHints,
	OidDropdownOptions,
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
	TrapOrInform = 'trapOrInform',
}

export type ActionSchema = {
	[ActionId.SetString]: {
		options: {
			oid: string
			value: string
		}
	}
	[ActionId.SetOpaque]: {
		options: {
			oid: string
			value: string
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
		options: [
			{
				...OidDropdownOptions,
				choices: self.getOidChoices(snmp.ObjectType.OctetString),
				default: self.getOidChoices(snmp.ObjectType.OctetString)[0]?.id ?? '',
			},
			ValueOption,
		],
		callback: async ({ options }, _context) => {
			const oid = trimOid(options.oid)
			await self.setOid(oid, snmp.ObjectType.OctetString, options.value)
		},
		learn: async ({ options }, _context) => {
			const oid = trimOid(options.oid)
			await self.getOid(oid)
			if (self.oidValues.has(oid)) {
				const type = self.oidValues.get(oid)?.type
				if (type == snmp.ObjectType.OctetString)
					return {
						value: String(self.oidValues.get(oid)?.value),
					}
			}
			return undefined
		},
	}
	actionDefs[ActionId.SetOpaque] = {
		name: 'Set OID value to an Opaque',
		options: [
			{
				...OidDropdownOptions,
				choices: self.getOidChoices(snmp.ObjectType.Opaque),
				default: self.getOidChoices(snmp.ObjectType.Opaque)[0]?.id ?? '',
			},
			{
				...ValueOption,
				regex: '/^(?:\\$\\([a-zA-Z0-9\\-_.]+:[a-zA-Z0-9\\-_.]+\\)|[A-Za-z0-9+/]*={0,2})$/',
				description: 'Enter the value as a base64 encoded string (e.g. SGVsbG8gV29ybGQ=)',
			},
		],
		callback: async ({ options }, _context) => {
			const oid = trimOid(options.oid)
			await self.setOid(oid, snmp.ObjectType.Opaque, options.value)
		},
	}
	actionDefs[ActionId.SetNumber] = {
		name: 'Set OID value to a Number',
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
		callback: async ({ options }, _context) => {
			const oid = trimOid(options.oid)
			const intValue = Math.round(options.value)

			if (Number.isNaN(intValue)) {
				throw new Error(`Value "${intValue}" is not an number. SNMP message not sent.`)
			}

			await self.setOid(oid, options.type, intValue)
		},
		learn: async ({ options }, _context) => {
			const oid = trimOid(options.oid)
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
		callback: async ({ options }, _context) => {
			const oid = trimOid(options.oid)
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
		learn: async ({ options }, _context) => {
			const oid = trimOid(options.oid)
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
		callback: async ({ options }, _context) => {
			const oid = trimOid(options.oid)
			const value = options.value
			await self.setOid(oid, snmp.ObjectType.IpAddress, value)
		},
		learn: async ({ options }, _context) => {
			const oid = trimOid(options.oid)
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
		callback: async ({ options }, _context) => {
			const oid = trimOid(options.oid)
			const value = options.value
			await self.setOid(oid, snmp.ObjectType.OID, value)
		},
		learn: async ({ options }, _context) => {
			const oid = trimOid(options.oid)
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
		],
		callback: async (action, context) => {
			const oid = trimOid(action.options.oid)
			await self.getOid(oid)
			const varbind = self.oidValues.get(oid)
			if (varbind == undefined || varbind.value === undefined)
				throw new Error(`Varbind not found, can't update custom variable ${action.options.variable}`)
			if (action.options.variable)
				context.setCustomVariableValue(
					action.options.variable,
					prepareVarbindForVariableAssignment(varbind, action.options.displaystring, action.options.div) ?? '',
				)
		},
		subscribe: async (action, _context) => {
			const oid = trimOid(action.options.oid)
			if (action.options.update) {
				self.oidTracker.addToPollGroup(oid, action.id)
			} else self.oidTracker.removeFromPollGroup(oid, action.id)
		},
		learn: async ({ options }, _context) => {
			await self.getOid(trimOid(options.oid))
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
				disableAutoExpression: true,
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
						await self.sendInform(trapType)
						return
					case 'trap':
						await self.sendTrap(trapType)
						return
				}
			}
			const VarBind: snmp.Varbind = {
				oid: trimOid(oidVarbind),
				type: objectType,
				value: objectValue,
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
		learn: async ({ options }, _context) => {
			const oid = trimOid(options.oidVarbind)
			await self.getOid(oid)
			if (self.oidValues.has(oid)) {
				const type = self.oidValues.get(oid)?.type
				if (type)
					return {
						objectType: type,
					}
			}
			return undefined
		},
	}

	return actionDefs
}
