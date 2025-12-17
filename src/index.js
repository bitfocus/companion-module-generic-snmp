import { InstanceBase, runEntrypoint, InstanceStatus } from '@companion-module/base'
import snmp from 'net-snmp'
import PQueue from 'p-queue'
import * as config from './configs.js'
import UpdateActions from './actions.js'
import UpdateFeedbacks from './feedbacks.js'
import UpgradeScripts from './upgrades.js'
import { throttle } from 'es-toolkit'

const trimOid = (oid) => {
	while (oid.startsWith('.')) {
		oid = oid.substring(1)
	}
	return oid.trim()
}

class Generic_SNMP extends InstanceBase {
	constructor(internal) {
		super(internal)

		Object.assign(this, {
			...config,
		})
		this.oidValues = new Map()
		this.feedbackIdsToCheck = new Set()
		this.session = null
	}

	async init(config, _isFirstInit, secrets) {
		this.snmpQueue = new PQueue({ concurrency: 1, interval: 10, intervalCap: 1 })
		process.titie = this.label.replaceAll(/[^a-zA-Z0-9-_.]/gm, '')
		this.config = config
		this.secrets = secrets
		this.updateActions()
		this.updateFeedbacks()
		this.connectAgent()
		if (this.config.interval > 0) {
			this.pollOids()
		}
	}

	async configUpdated(config, secrets) {
		this.snmpQueue.clear()
		process.titie = this.label.replaceAll(/[^a-zA-Z0-9-_.]/gm, '')
		this.config = config
		this.secrets = secrets
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
			if (this.secrets.authKey === undefined || this.secrets.authKey === '') {
				this.log('warn', 'please specify an Auth Key when Security level is authNoPriv or authPriv.')
				this.updateStatus(InstanceStatus.BadConfig, 'Missing Auth Key')
				return
			}

			user.authProtocol = snmp.AuthProtocols[this.config.authProtocol]
			user.authKey = this.secrets.authKey

			if (this.config.securityLevel == 'authPriv') {
				if (this.secrets.privKey === undefined || this.secrets.privKey === '') {
					this.log('warn', 'Please specify a Priv Key when Security level is authPriv.')
					this.updateStatus(InstanceStatus.BadConfig, 'Missing Priv Key')
					return
				}
				user.privProtocol = snmp.PrivProtocols[this.config.privProtocol]
				user.privKey = this.secrets.privKey
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
		oid = trimOid(oid)
		if (oid.length == 0) return
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

	async getOid(oid, customVariable, displaystring, context, feedbackId = '') {
		const bufferToBigInt = (buffer, start = 0, end = buffer.length) => {
			const bufferAsHexString = buffer.slice(start, end).toString('hex')
			return BigInt(`0x${bufferAsHexString}`)
		}
		oid = trimOid(oid)
		if (oid.length == 0) return
		await this.snmpQueue.add(() => {
			try {
				this.session.get(
					[oid],
					((error, varbinds) => {
						if (error) {
							this.log('warn', `getOid error: ${JSON.stringify(error)} cannot set ${customVariable}`)
							return
						}
						let value
						if (varbinds[0].type == snmp.ObjectType.Counter64) {
							value = bufferToBigInt(varbinds[0].value).toString()
						} else value = displaystring ? varbinds[0].value.toString() : varbinds[0].value
						if (this.config.verbose)
							this.log(
								'debug',
								`OID: ${varbinds[0].oid} type: ${snmp.ObjectType[varbinds[0].type]} value: ${value} setting to: ${customVariable}`,
							)
						this.oidValues.set(varbinds[0].oid, value)
						if (customVariable) context.setCustomVariableValue(customVariable, value)
						if (feedbackId) {
							this.feedbackIdsToCheck.add(feedbackId)
							this.throttledFeedbackIdCheck()
						}
					}).bind(this),
				)
			} catch (e) {
				this.log('warn', `getOid error: ${JSON.stringify(e)} cannot set ${customVariable}`)
			}
		})
	}

	pollOids() {
		this.subscribeActions('getOID')
		this.subscribeFeedbacks('getOID')
		if (this.config.interval > 0) {
			this.pollTimer = setTimeout(() => {
				this.pollOids()
			}, this.config.interval * 1000)
		}
	}

	throttledFeedbackIdCheck = throttle(
		() => {
			this.checkFeedbacksById(...this.feedbackIdsToCheck)
			this.feedbackIdsToCheck.clear()
		},
		30,
		{ leading: false, trailing: true },
	)

	async destroy() {
		this.log('debug', `destroy ${this.id}:${this.label}`)
		this.snmpQueue.clear()
		this.throttledFeedbackIdCheck.cancel()
		if (this.pollTimer) {
			clearTimeout(this.pollTimer)
			delete this.pollTimer
		}
		this.disconnectAgent()
	}

	updateActions() {
		UpdateActions(this)
	}

	updateFeedbacks() {
		UpdateFeedbacks(this)
	}
}

runEntrypoint(Generic_SNMP, UpgradeScripts)
