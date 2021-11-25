const snmp = require('net-snmp')

module.exports = {
	initActions() {
		const actions = {}

		actions.setString = {
			label: 'Set OID value to an OctetString',
			options: [
				{
					type: 'textwithvariables',
					label: 'OID',
					id: 'oid',
					default: '',
					required: true,
				},
				{
					type: 'textwithvariables',
					label: 'Value',
					id: 'value',
					default: '',
					required: true,
				},
			],
			callback: ({ options: { oid, value } }) => {
				this.setOid(this.parse(oid), snmp.ObjectType.OctetString, this.parse(value))
			},
		}

		actions.setNumber = {
			label: 'Set OID value to a Number',
			options: [
				{
					type: 'textwithvariables',
					label: 'OID',
					id: 'oid',
					default: '',
					required: true,
				},
				{
					type: 'dropdown',
					label: 'Type',
					id: 'type',
					choices: [
						{ id: snmp.ObjectType.Integer, label: 'Integer' },
						{ id: snmp.ObjectType.Counter, label: 'Counter' },
						{ id: snmp.ObjectType.Counter32, label: 'Counter32' },
						{ id: snmp.ObjectType.Gauge, label: 'Gauge' },
						{ id: snmp.ObjectType.Gauge32, label: 'Gauge32' },
						{ id: snmp.ObjectType.TimeTicks, label: 'TimeTicks' },
						{ id: snmp.ObjectType.Unsigned32, label: 'Unsigned32' },
					],
					default: 'Integer',
				},
				{
					type: 'textwithvariables',
					label: 'Value',
					id: 'value',
					default: '0',
				},
			],
			callback: ({ options: { oid, type, value } }) => {
				const intValue = parseInt(this.parse(value))

				if (Number.isNaN(intValue)) {
					this.log('warn', `Value "${intValue}" is not an number. SNMP message not sent.`)
					return
				}

				this.setOid(this.parse(oid), type, intValue)
			},
		}

		actions.setBoolean = {
			label: 'Set OID value to a Boolean',
			options: [
				{
					type: 'textwithvariables',
					label: 'OID',
					id: 'oid',
					default: '',
					required: true,
				},
				{
					type: 'textwithvariables',
					label: 'Value (true/false, yes/no)',
					id: 'value',
					default: 'true',
				},
			],
			callback: ({ options: { oid, value } }) => {
				const parsedValue = this.parse(value).trim().toLocaleLowerCase()
				let booleanValue = false

				switch (parsedValue) {
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
						this.log('warn', `Value "${parsedValue}" is not an boolean. SNMP message not sent.`)
						return
					}
				}

				this.setOid(this.parse(oid), snmp.ObjectType.Boolean, booleanValue)
			},
		}

		actions.setIpAddress = {
			label: 'Set OID value to an IP Address',
			options: [
				{
					type: 'textwithvariables',
					label: 'OID',
					id: 'oid',
					default: '',
					required: true,
				},
				{
					type: 'textwithvariables',
					label: 'Value',
					id: 'value',
					default: '',
					required: true,
				},
			],
			callback: ({ options: { oid, value } }) => {
				this.setOid(this.parse(oid), snmp.ObjectType.IpAddress, this.parse(value))
			},
		}

		actions.setOID = {
			label: 'Set OID value to an OID',
			options: [
				{
					type: 'textwithvariables',
					label: 'OID',
					id: 'oid',
					default: '',
					required: true,
				},
				{
					type: 'textwithvariables',
					label: 'Value',
					id: 'value',
					default: '',
					required: true,
				},
			],
			callback: ({ options: { oid, value } }) => {
				this.setOid(this.parse(oid), snmp.ObjectType.OID, this.parse(value))
			},
		}

		this.setActions(actions)
	},
}
