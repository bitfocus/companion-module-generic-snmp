import { Regex } from '@companion-module/base'
import snmp from 'net-snmp'

export default async function (self) {
	let actionDefs = []
	actionDefs['setString'] = {
		name: 'Set OID value to an OctetString',
		options: [
			{
				type: 'textinput',
				label: 'OID',
				id: 'oid',
				default: '',
				required: true,
				regex: Regex.SOMETHING,
				useVariables: true,
			},
			{
				type: 'textinput',
				label: 'Value',
				id: 'value',
				default: '',
				required: true,
				regex: Regex.SOMETHING,
				useVariables: true,
			},
		],
		callback: async ({ options }) => {
			const oid = await self.parseVariablesInString(options.oid)
			const value = await self.parseVariablesInString(options.value)
			self.setOid(oid, snmp.ObjectType.OctetString, value)
		},
	}

	actionDefs['setNumber'] = {
		name: 'Set OID value to a Number',
		options: [
			{
				type: 'textinput',
				label: 'OID',
				id: 'oid',
				default: '',
				required: true,
				regex: Regex.SOMETHING,
				useVariables: true,
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
				type: 'textinput',
				label: 'Value',
				id: 'value',
				default: '0',
				useVariables: true,
			},
		],
		callback: async ({ options }) => {
			const oid = await self.parseVariablesInString(options.oid)
			const intValue = parseInt(await self.parseVariablesInString(options.value))

			if (Number.isNaN(intValue)) {
				self.log('warn', `Value "${intValue}" is not an number. SNMP message not sent.`)
				return
			}

			self.setOid(oid, options.type, intValue)
		},
	}

	actionDefs['setBoolean'] = {
		name: 'Set OID value to a Boolean',
		options: [
			{
				type: 'textinput',
				label: 'OID',
				id: 'oid',
				default: '',
				required: true,
				useVariables: true,
				regex: Regex.SOMETHING,
			},
			{
				type: 'textinput',
				label: 'Value (true/false, yes/no)',
				id: 'value',
				default: 'true',
				useVariables: true,
			},
		],
		callback: async ({ options }) => {
			const oid = await self.parseVariablesInString(options.oid)
			const parsedValue = await self.parseVariablesInString(options.value)
			let booleanValue = false

			switch (parsedValue.trim().toLocaleLowerCase()) {
				case 'true':
				case 'yes': {
					booleanValue = true
					break
				}
				case 'false':
				case 'no': {
					booleanValue = false
					break
				}
				default: {
					self.log('warn', `Value "${parsedValue}" is not an boolean. SNMP message not sent.`)
					return
				}
			}

			self.setOid(oid, snmp.ObjectType.Boolean, booleanValue)
		},
	}

	actionDefs['setIpAddress'] = {
		name: 'Set OID value to an IP Address',
		options: [
			{
				type: 'textinput',
				label: 'OID',
				id: 'oid',
				default: '',
				required: true,
				useVariables: true,
				regex: Regex.SOMETHING,
			},
			{
				type: 'textinput',
				label: 'Value',
				id: 'value',
				default: '',
				required: true,
				useVariables: true,
				regex: Regex.SOMETHING,
			},
		],
		callback: async ({ options }) => {
			const oid = await self.parseVariablesInString(options.oid)
			const value = await self.parseVariablesInString(options.value)
			self.setOid(oid, snmp.ObjectType.IpAddress, value)
		},
	}

	actionDefs['setOID'] = {
		name: 'Set OID value to an OID',
		options: [
			{
				type: 'textinput',
				label: 'OID',
				id: 'oid',
				default: '',
				required: true,
				useVariables: true,
				regex: Regex.SOMETHING,
			},
			{
				type: 'textinput',
				label: 'Value',
				id: 'value',
				default: '',
				required: true,
				useVariables: true,
				regex: Regex.SOMETHING,
			},
		],
		callback: async ({ options }) => {
			const oid = await self.parseVariablesInString(options.oid)
			const value = await self.parseVariablesInString(options.value)
			self.setOid(oid, snmp.ObjectType.oid, value)
		},
	}

	self.setActionDefinitions(actionDefs)
}
