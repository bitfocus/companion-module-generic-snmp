import {
	type CompanionInputFieldCheckbox,
	type CompanionInputFieldDropdown,
	type CompanionInputFieldStaticText,
	type CompanionInputFieldTextInput,
	type CompanionInputFieldNumber,
} from '@companion-module/base'
import snmp from 'net-snmp'

export const OidRegex =
	'/^(?:\\d+|\\$\\([a-zA-Z0-9\\-_.]+:[a-zA-Z0-9\\-_.]+\\))(?:\\.(?:\\d+|\\$\\([a-zA-Z0-9\\-_.]+:[a-zA-Z0-9\\-_.]+\\)))*$/'

export const OidOption = {
	type: 'textinput',
	label: 'OID',
	id: 'oid',
	default: '',
	regex: OidRegex,
	useVariables: true,
} as const satisfies CompanionInputFieldTextInput

export const OidDropdownOptions = {
	type: 'dropdown',
	id: 'oid',
	label: 'OID',
	choices: [],
	default: '',
	regex: '/^\\d+(?:\\.\\d+)*$/',
	allowCustom: true,
} as const satisfies CompanionInputFieldDropdown
export const ValueOption = {
	type: 'textinput',
	label: 'Value',
	id: 'value',
	default: '',
	minLength: 0,
	useVariables: true,
} as const satisfies CompanionInputFieldTextInput

export const DisplayStringOption = {
	type: 'checkbox',
	label: 'DisplayString',
	id: 'displaystring',
	description: 'Convert OctetString (array of numbers) to DisplayString (text)',
	default: true,
} as const satisfies CompanionInputFieldCheckbox

export const UpdateOption = {
	type: 'checkbox',
	label: 'Update',
	id: 'update',
	description: 'Update each poll interval',
	default: false,
} as const satisfies CompanionInputFieldCheckbox

export const DivisorOption = {
	type: 'number',
	id: 'div',
	label: 'Scaling Divisor',
	default: 1,
	min: 1,
	max: Number.MAX_SAFE_INTEGER,
	step: 1,
	description:
		'If OID returns a number, value will be divided by this value. Ie use `100` to achieve 2 decimal precision. Does not work with Counter64 type VarBinds.',
} as const satisfies CompanionInputFieldNumber

export const TrapOrInformOption = {
	type: 'dropdown',
	id: 'messageType',
	label: 'Message Type',
	choices: [
		{ id: 'trap', label: 'Trap' },
		{ id: 'inform', label: 'Inform' },
	],
	default: 'trap',
	disableAutoExpression: true,
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
	disableAutoExpression: true,
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
		disableAutoExpression: true,
	},
	{
		type: 'static-text',
		id: 'hint_warmstart',
		label: 'Warm Start',
		value:
			'Signifies that the sending protocol entity is reinitializing itself such that neither the agent configuration nor the protocol entity implementation is altered.',
		isVisibleExpression: trapTypeVisible(snmp.TrapType.WarmStart),
		disableAutoExpression: true,
	},
	{
		type: 'static-text',
		id: 'hint_linkdown',
		label: 'Link Down',
		value:
			"Signifies that the sending protocol entity recognizes a failure in one of the communication links represented in the agent's configuration. Should include <code>ifIndex</code> in varbinds.",
		isVisibleExpression: trapTypeVisible(snmp.TrapType.LinkDown),
		disableAutoExpression: true,
	},
	{
		type: 'static-text',
		id: 'hint_linkup',
		label: 'Link Up',
		value:
			"Signifies that the sending protocol entity recognizes that one of the communication links represented in the agent's configuration has come up. Should include <code>ifIndex</code> in varbinds.",
		isVisibleExpression: trapTypeVisible(snmp.TrapType.LinkUp),
		disableAutoExpression: true,
	},
	{
		type: 'static-text',
		id: 'hint_authfailure',
		label: 'Authentication Failure',
		value:
			'Signifies that the sending protocol entity is the addressee of a protocol message that is not properly authenticated.',
		isVisibleExpression: trapTypeVisible(snmp.TrapType.AuthenticationFailure),
		disableAutoExpression: true,
	},
	{
		type: 'static-text',
		id: 'hint_egpneighborloss',
		label: 'EGP Neighbor Loss',
		value:
			'Signifies that an EGP neighbor for whom the sending protocol entity was an EGP peer has been marked down and the peer relationship no longer obtains. Should include <code>egpNeighAddr</code> in varbinds.',
		isVisibleExpression: trapTypeVisible(snmp.TrapType.EgpNeighborLoss),
		disableAutoExpression: true,
	},
] as const satisfies CompanionInputFieldStaticText[]

export const EnterpriseOidOption = {
	type: 'textinput',
	label: 'OID',
	id: 'oidEnterprise',
	default: '1.3.6.1.4.1.63849.1',
	minLength: 1,
	regex: OidRegex,
	useVariables: true,
	isVisibleExpression: `$(options:trapType) == ${snmp.TrapType.EnterpriseSpecific}`,
	description: 'Enterprise, Inform or Trap OID depending on configuration',
} as const satisfies CompanionInputFieldTextInput

export const VarbindOidOption = {
	type: 'textinput',
	label: 'VarBind OID',
	id: 'oidVarbind',
	default: '1.3.6.1.4.1.63849.1',
	minLength: 1,
	regex: OidRegex,
	useVariables: true,
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
	disableAutoExpression: true,
} as const satisfies CompanionInputFieldDropdown

export const ObjectValueOption = {
	type: 'textinput',
	id: 'objectValue',
	label: 'VarBind Value',
	default: '',
	useVariables: true,
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
		disableAutoExpression: true,
	},
	{
		type: 'static-text',
		id: 'hint_integer',
		label: 'Accepted values',
		value:
			'Signed 32-bit integer in range [-2147483648, 2147483647]. Decimal (e.g. 42) or hex (e.g. 0x2A) format accepted.',
		isVisibleExpression: `${enterpriseSpecific} && $(options:objectType) == ${snmp.ObjectType.Integer}`,
		disableAutoExpression: true,
	},
	{
		type: 'static-text',
		id: 'hint_counter',
		label: 'Accepted values',
		value: 'Unsigned 32-bit integer in range [0, 4294967295]. Decimal (e.g. 42) or hex (e.g. 0x2A) format accepted.',
		isVisibleExpression: `${enterpriseSpecific} && $(options:objectType) == ${snmp.ObjectType.Counter}`,
		disableAutoExpression: true,
	},
	{
		type: 'static-text',
		id: 'hint_gauge',
		label: 'Accepted values',
		value: 'Unsigned 32-bit integer in range [0, 4294967295]. Decimal (e.g. 42) or hex (e.g. 0x2A) format accepted.',
		isVisibleExpression: `${enterpriseSpecific} && $(options:objectType) == ${snmp.ObjectType.Gauge}`,
		disableAutoExpression: true,
	},
	{
		type: 'static-text',
		id: 'hint_timeticks',
		label: 'Accepted values',
		value:
			'Unsigned 32-bit integer in range [0, 4294967295], representing hundredths of a second. Decimal (e.g. 42) or hex (e.g. 0x2A) format accepted.',
		isVisibleExpression: `${enterpriseSpecific} && $(options:objectType) == ${snmp.ObjectType.TimeTicks}`,
		disableAutoExpression: true,
	},
	{
		type: 'static-text',
		id: 'hint_counter64',
		label: 'Accepted values',
		value:
			'Unsigned 64-bit integer in range [0, 18446744073709551615]. Decimal (e.g. 42) or hex (e.g. 0x2A) format accepted.',
		isVisibleExpression: `${enterpriseSpecific} && $(options:objectType) == ${snmp.ObjectType.Counter64}`,
		disableAutoExpression: true,
	},
	{
		type: 'static-text',
		id: 'hint_octetstring',
		label: 'Accepted values',
		value: 'Any string.',
		isVisibleExpression: `${enterpriseSpecific} && $(options:objectType) == ${snmp.ObjectType.OctetString}`,
		disableAutoExpression: true,
	},
	{
		type: 'static-text',
		id: 'hint_oid',
		label: 'Accepted values',
		value:
			'A valid OID in dotted numeric notation (e.g. 1.3.6.1.2.1.1.1.0). Leading dots will be trimmed automatically.',
		isVisibleExpression: `${enterpriseSpecific} && $(options:objectType) == ${snmp.ObjectType.OID}`,
		disableAutoExpression: true,
	},
	{
		type: 'static-text',
		id: 'hint_ipaddress',
		label: 'Accepted values',
		value: 'A valid IPv4 address in dotted decimal notation (e.g. 192.168.1.1).',
		isVisibleExpression: `${enterpriseSpecific} && $(options:objectType) == ${snmp.ObjectType.IpAddress}`,
		disableAutoExpression: true,
	},
	{
		type: 'static-text',
		id: 'hint_opaque',
		label: 'Accepted values',
		value: 'Buffer encoded as Base64 string. Will be padded as necessary.',
		isVisibleExpression: `${enterpriseSpecific} && $(options:objectType) == ${snmp.ObjectType.Opaque}`,
		disableAutoExpression: true,
	},
] as const satisfies CompanionInputFieldStaticText[]

export const NumberObjectTypeHints = [
	{
		type: 'static-text',
		id: 'hint_integer',
		label: 'Accepted values',
		value: 'Signed 32-bit integer in range [-2147483648, 2147483647].',
		isVisibleExpression: `$(options:type) == ${snmp.ObjectType.Integer}`,
		disableAutoExpression: true,
	},
	{
		type: 'static-text',
		id: 'hint_counter',
		label: 'Accepted values',
		value: 'Unsigned 32-bit integer in range [0, 4294967295].',
		isVisibleExpression: `$(options:type) == ${snmp.ObjectType.Counter}`,
		disableAutoExpression: true,
	},
	{
		type: 'static-text',
		id: 'hint_gauge',
		label: 'Accepted values',
		value: 'Unsigned 32-bit integer in range [0, 4294967295].',
		isVisibleExpression: `$(options:type) == ${snmp.ObjectType.Gauge}`,
		disableAutoExpression: true,
	},
	{
		type: 'static-text',
		id: 'hint_timeticks',
		label: 'Accepted values',
		value: 'Unsigned 32-bit integer in range [0, 4294967295], representing hundredths of a second.',
		isVisibleExpression: `$(options:type) == ${snmp.ObjectType.TimeTicks}`,
		disableAutoExpression: true,
	},
] as const satisfies CompanionInputFieldStaticText[]
