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
				this.setOid(oid, 'OctetString', value)
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
						{ id: 'Integer', label: 'Integer' },
						{ id: 'Counter', label: 'Counter' },
						{ id: 'Counter32', label: 'Counter32' },
						{ id: 'Gauge', label: 'Gauge' },
						{ id: 'Gauge32', label: 'Gauge32' },
						{ id: 'TimeTicks', label: 'TimeTicks' },
						{ id: 'Unsigned32', label: 'Unsigned32' },
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
				this.setOid(oid, type, parseInt(value))
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
					type: 'dropdown',
					label: 'Value',
					id: 'value',
					choices: [{ false: 'False' }, { true: 'True' }],
					default: 'false',
				},
			],
			callback: ({ options: { oid, value } }) => {
				this.setOid(oid, 'Boolean', value === 'true')
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
				this.setOid(oid, 'IpAddress', value)
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
				this.setOid(oid, 'OID', value)
			},
		}

		this.setActions(actions)
	},
}
