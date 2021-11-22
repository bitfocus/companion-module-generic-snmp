const instance_skel = require('../../../instance_skel')

const configs = require('./configs')
const actions = require('./actions')

const snmp = require('net-snmp')
class Instance extends instance_skel {
	constructor(system, id, config) {
		super(system, id, config)

		Object.assign(this, {
			...configs,
			...actions,
		})

		this.config = config
		this.session = null

		// instance state store
		this.state = {
			someState: 'default state',
		}
	}

	init() {
		this.initActions()
		this.connectAgent()
	}

	updateConfig(config) {
		this.config = config
		this.connectAgent()
	}

	connectAgent() {
		const { ip, port, version } = this.config

		this.disconnectAgent()

		if (ip === undefined) {
			this.log('warn', 'Please configure your instance')
			this.status(this.STATUS_UNKNOWN, 'Missing configuration')
			return
		}

		// create v1/v2c session
		if (version === 'v1' || version === 'v2c') {
			const { community } = this.config
			const options = {
				port,
				version: version === 'v1' ? snmp.Version1 : snmp.Version2c,
			}

			if (community === '') {
				this.log('warn', 'When using SNMP v1 or v2c please specify a community.')
				this.status(this.STATUS_UNKNOWN, 'Missing community')
				return
			}

			this.session = snmp.createSession(ip, community, options)
			this.status(this.STATUS_OK)
			return
		}

		// create v3 session
		const { engineID, username, securityLevel, authProtocol, authKey, privProtocol, privKey } = this.config

		if (engineID === '') {
			this.log('warn', 'When using SNMP v2 please specify an Engine ID.')
			this.status(this.STATUS_UNKNOWN, 'Missing Engine ID')
			return
		}

		if (username === '') {
			this.log('warn', 'When using SNMP v2 please specify an User Name.')
			this.status(this.STATUS_UNKNOWN, 'Missing User Name')
			return
		}

		const options = {
			port,
			engineID,
			version: snmp.Version3,
		}
		const user = {
			name: username,
			level: snmp.SecurityLevel[securityLevel],
		}

		if (securityLevel !== 'noAuthNoPriv') {
			if (authKey === '') {
				this.log('warn', 'please specify an Auth Key when Security level is authNoPriv or authPriv.')
				this.status(this.STATUS_UNKNOWN, 'Missing Auth Key')
				return
			}

			user.authProtocol = snmp.AuthProtocols[authProtocol]
			user.authKey = authKey

			if (securityLevel == 'authPriv') {
				if (privKey === '') {
					this.log('warn', 'Please specify a Priv Key when Security level is authPriv.')
					this.status(this.STATUS_UNKNOWN, 'Missing Priv Key')
					return
				}
				user.privProtocol = snmp.PrivProtocols[privProtocol]
				user.privKey = privKey
			}
		}

		this.session = snmp.createV3Session(ip, user, options)
		this.status(this.STATUS_OK)
	}

	disconnectAgent() {
		if (this.session) {
			this.session.close()
			this.session = null
		}
	}

	setOid(oid, type, value) {
		const varbinds = [
			{
				oid,
				type: snmp.ObjectType[type],
				value,
			},
		]

		this.session.set(varbinds, (error) => {
			if (error) {
				this.log('error', error.toString())
			}
		})
	}

	destroy() {
		this.disconnectAgent()
	}
}

module.exports = Instance
