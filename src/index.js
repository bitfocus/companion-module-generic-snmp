import { InstanceBase, runEntrypoint, InstanceStatus } from '@companion-module/base'
import snmp from 'net-snmp'
import PQueue from 'p-queue'
import * as config from './configs.js'
import UpdateActions from './actions.js'
import UpgradeScripts from './upgrades.js'

class Generic_SNMP extends InstanceBase {
	constructor(internal) {
		super(internal)

		Object.assign(this, {
			...config,
		})

		this.session = null
	}

	async init(config) {
		this.snmpQueue = new PQueue({ concurrency: 1, interval: 10, intervalCap: 1 })
		this.config = config
		this.updateActions()
		this.connectAgent()
		if (this.config.interval > 0) {
			this.pollOids()
		}
	}

	async configUpdated(config) {
		this.snmpQueue.clear()
		this.config = config
		if (this.pollTimer) {
			clearTimeout(this.pollTimer)
			delete this.pollTimer
		}
		this.connectAgent()
		if (this.config.interval > 0) {
			this.pollOids()
		}
	}

	connectAgent() {
		this.disconnectAgent()

		if (this.config.ip === undefined || this.config.ip === '') {
			this.log('warn', 'Please configure your instance')
			this.updateStatus(InstanceStatus.BadConfig, 'Missing configuration')
			return
		}

		// create v1/v2c session
		if (this.config.version === 'v1' || this.config.version === 'v2c') {
			const options = {
				port: this.config.port,
				version: this.config.version === 'v1' ? snmp.Version1 : snmp.Version2c,
			}

			if (this.config.community === undefined || this.config.community === '') {
				this.log('warn', 'When using SNMP v1 or v2c please specify a community.')
				this.updateStatus(InstanceStatus.BadConfig, 'Missing community')
				return
			}

			this.session = snmp.createSession(this.config.ip, this.config.community, options)
			this.updateStatus(InstanceStatus.Ok)
			return
		}

		// create v3 session
		if (this.config.engineID === undefined || this.config.engineID === '') {
			this.log('warn', 'When using SNMP v3 please specify an Engine ID.')
			this.updateStatus(InstanceStatus.BadConfig, 'Missing Engine ID')
			return
		}

		if (this.config.username === undefined || this.config.username === '') {
			this.log('warn', 'When using SNMP v3 please specify a User Name.')
			this.updateStatus(InstanceStatus.BadConfig, 'Missing User Name')
			return
		}

		const options = {
			port: this.config.port,
			engineID: this.config.engineID,
			version: snmp.Version3,
		}
		const user = {
			name: this.config.username,
			level: snmp.SecurityLevel[this.config.securityLevel],
		}

		if (this.config.securityLevel !== 'noAuthNoPriv') {
			if (this.config.authKey === undefined || this.config.authKey === '') {
				this.log('warn', 'please specify an Auth Key when Security level is authNoPriv or authPriv.')
				this.updateStatus(InstanceStatus.BadConfig, 'Missing Auth Key')
				return
			}

			user.authProtocol = snmp.AuthProtocols[this.config.authProtocol]
			user.authKey = this.config.authKey

			if (this.config.securityLevel == 'authPriv') {
				if (this.config.privKey === undefined || this.config.privKey === '') {
					this.log('warn', 'Please specify a Priv Key when Security level is authPriv.')
					this.updateStatus(InstanceStatus.BadConfig, 'Missing Priv Key')
					return
				}
				user.privProtocol = snmp.PrivProtocols[this.config.privProtocol]
				user.privKey = this.config.privKey
			}
		}

		this.session = snmp.createV3Session(this.config.ip, user, options)
		this.updateStatus(InstanceStatus.Ok)
	}

	disconnectAgent() {
		if (this.session) {
			this.session.close()
			delete this.session
		}
		this.updateStatus(InstanceStatus.Disconnected)
	}

	async setOid(oid, type, value) {
		await this.snmpQueue.add(() => {
			this.session.set([{ oid, type, value }], (error) => {
				if (error) {
					this.log('error', error.toString())
				} else {
					if (this.config.verbose) this.log('debug', `Set OID: ${oid} type: ${type} value: ${value}`)
				}
			})
		})
	}

	async getOid(oid, customVariable, displaystring) {
		await this.snmpQueue.add(() => {
			try {
				this.session.get(
					[oid],
					((error, varbinds) => {
						if (error) {
							this.log('warn', `getOid error: ${JSON.stringify(error)} cannot set ${customVariable}`)
							return
						}
						if (this.config.verbose)
							this.log(
								'debug',
								`OID: ${varbinds[0].oid} type: ${varbinds[0].type} value: ${varbinds[0].value} setting to: ${customVariable}`,
							)
						const value = displaystring ? varbinds[0].value.toString() : varbinds[0].value
						this.setCustomVariableValue(customVariable, value)
					}).bind(this),
				)
			} catch (e) {
				this.log('warn', `getOid error: ${JSON.stringify(e)} cannot set ${customVariable}`)
			}
		})
	}

	pollOids() {
		this.subscribeActions('getOID')
		if (this.config.interval > 0) {
			this.pollTimer = setTimeout(() => {
				this.pollOids()
			}, this.config.interval * 1000)
		}
	}

	async destroy() {
		this.log('debug', `destroy ${this.id}`)
		this.snmpQueue.clear()
		if (this.pollTimer) {
			clearTimeout(this.pollTimer)
			delete this.pollTimer
		}
		this.disconnectAgent()
	}

	updateActions() {
		UpdateActions(this)
	}
}

runEntrypoint(Generic_SNMP, UpgradeScripts)
