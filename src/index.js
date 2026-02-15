import { InstanceBase, runEntrypoint, InstanceStatus } from '@companion-module/base'
import snmp from 'net-snmp'
import PQueue from 'p-queue'
import GetConfigFields from './configs.js'
import UpdateActions from './actions.js'
import UpdateFeedbacks from './feedbacks.js'
import UpgradeScripts from './upgrades.js'
import { SharedUDPSocketWrapper } from './wrapper.js'
import { FeedbackOidTracker } from './oidtracker.js'
import { throttle } from 'es-toolkit'

/**
 * SNMP varbind value types
 * - number: Integer32, Counter32, Counter64, Gauge32, TimeTicks, Unsigned32
 * - string: OctetString, IpAddress (formatted as string)
 * - Buffer: OctetString (raw bytes)
 * - null: Null
 * - Array<number>: OID (array of integers)
 * - boolean: Boolean (rare, but possible)
 * @typedef {number | string | Buffer | null | Array<number> | boolean} SNMPValue
 */

/**
 * Remove leading dots from an OID string and trim whitespace
 * @param {string} oid - The OID string to trim
 * @returns {string} The trimmed OID string
 */

export const trimOid = (oid) => {
	while (oid.startsWith('.')) {
		oid = oid.substring(1)
	}
	return oid.trim()
}

/**
 * Validate if a string is a valid SNMP OID format
 * @param {string} value - The string to validate as an OID
 * @returns {boolean} True if the value is a valid SNMP OID
 */

export const isValidSnmpOid = (value) => /^(0|1|2)(\.(0|[1-9]\d*))+$/u.test(value)

/**
 * Convert a buffer to a BigInt
 * @param {Buffer} buffer - The buffer to convert
 * @param {number} [start=0] - Starting position in the buffer
 * @param {number} [end=buffer.length] - Ending position in the buffer
 * @returns {bigint} The buffer converted to a BigInt
 */
const bufferToBigInt = (buffer, start = 0, end = buffer.length) => {
	const bufferAsHexString = buffer.slice(start, end).toString('hex')
	return BigInt(`0x${bufferAsHexString}`)
}

class Generic_SNMP extends InstanceBase {
	constructor(internal) {
		super(internal)
		/** @type {Map<string, SNMPValue>} Map of OIDs with their values */
		this.oidValues = new Map()
		/** @type {Set<string>} Set of Feedback IDs to be checked after throttle interval */
		this.feedbackIdsToCheck = new Set()
		this.session = null
		/** @type {FeedbackOidTracker} */
		this.oidTracker = new FeedbackOidTracker()
		this.snmpQueue = new PQueue({ concurrency: 1, interval: 10, intervalCap: 1 })
	}

	async init(config, _isFirstInit, secrets) {
		this.config = config
		this.secrets = secrets
		this.updateActions()
		this.updateFeedbacks()
		await this.initializeConnection()
	}

	async configUpdated(config, secrets) {
		this.snmpQueue.clear()
		this.closeListener()

		if (this.pollTimer) {
			clearTimeout(this.pollTimer)
			delete this.pollTimer
		}

		this.config = config
		this.secrets = secrets
		await this.initializeConnection()
	}

	/**
	 * Initialize SNMP agent connection, trap listener, and polling
	 *
	 * @returns {Promise<void>}
	 */
	async initializeConnection() {
		this.connectAgent()

		if (this.config.traps) {
			try {
				await this.createListener()
			} catch (err) {
				this.log('error', `Could not initialize SNMP Trap listener: ${err.message}`)
			}
		}

		if (this.config.interval > 0) {
			this.pollOids()
		}
	}

	getConfigFields() {
		return GetConfigFields()
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

	closeListener() {
		if (this.receiver) {
			this.receiver.close()
		}

		if (this.socketWrapper) {
			this.socketWrapper.close()
			this.socketWrapper.removeAllListeners()
		}

		if (this.listeningSocket) {
			this.listeningSocket.close()
			this.listeningSocket.removeAllListeners()
		}
	}

	/**
	 * Binds to shared UDP socket, creates SNMP Trap reciever
	 *
	 * @returns {Promise<void>}
	 * @throws {Error} If the binding fails
	 */

	async createListener() {
		this.closeListener()
		return new Promise((resolve, reject) => {
			this.listeningSocket = this.createSharedUdpSocket('udp4')

			const errorHandler = (err) => {
				this.log('error', `Listener error: ${err.message}`)
				this.listeningSocket.removeAllListeners()
				reject(err)
			}
			this.listeningSocket.addListener('error', errorHandler)

			this.listeningSocket.addListener('listening', () => {
				this.listeningSocket.removeListener('error', errorHandler)

				this.socketWrapper = new SharedUDPSocketWrapper(
					this.listeningSocket,
					this.config.portBind || 162,
					this.config.ip, // Only accept traps from this IP
				)
				const receiverOptions = {
					port: this.config.portBind || 162,
					transport: this.socketWrapper,
				}
				if (this.config.version === 'v3') {
					receiverOptions.engineID = this.config.engineID

					// User security model
					receiverOptions.user = {
						name: this.config.username,
						level: snmp.SecurityLevel[this.config.securityLevel],
						authProtocol: snmp.AuthProtocols[this.config.authProtocol],
						authKey: this.secrets.authKey,
						privProtocol: snmp.PrivProtocols[this.config.privProtocol],
						privKey: this.secrets.privKey,
					}
				}
				this.receiver = snmp.createReceiver(receiverOptions, (error, trap) => {
					if (error) {
						this.log('warn', `SNMP trap error: ${error.message}`)
					} else {
						this.processTrap(trap)
					}
				})
				this.log('info', `Listening to Port ${this.config.portBind} for Traps from ${this.config.ip}`)
				resolve()
			})

			this.listeningSocket.bind(this.config.portBind || 162, this.config.ip)
		})
	}

	/**
	 * @typedef {Object} SnmpVarbind
	 * @property {string} oid - The SNMP OID
	 * @property {number} type - The SNMP data type
	 * @property {SNMPValue} value - The varbind value
	 */

	/**
	 * @typedef {Object} SnmpTrap
	 * @property {Object} pdu - The Protocol Data Unit
	 * @property {string} [pdu.community] - SNMP community string (v1/v2c only)
	 * @property {SnmpVarbind[]} pdu.varbinds - Array of variable bindings
	 */

	processTrap(trap) {
		if (this.config.version !== 'v3' && trap.pdu.community !== this.config.community) {
			this.log(
				'warn',
				`SNMP Trap. Expected community: ${this.config.community} Recieved community: ${trap.pdu.community}`,
			)
			return
		}
		if (Array.isArray(trap.pdu.varbinds)) {
			trap.pdu.varbinds.forEach((varbind) => {
				if (snmp.isVarbindError(varbind)) {
					this.log('debug', `Trap Varbind error: ${snmp.varbindError(varbind)}`)
					return
				}
				if ('type' in varbind && 'value' in varbind) {
					let value
					if (varbind.type == snmp.ObjectType.Counter64) {
						value = bufferToBigInt(varbind.value).toString()
					} else if (varbind.type == snmp.ObjectType.OctetString) {
						value = varbind.value.toString()
					} else value = varbind.value
					if (this.config.verbose)
						this.log('debug', `Trap OID: ${varbind.oid} type: ${snmp.ObjectType[varbind.type]} value: ${value}`)
					this.oidValues.set(varbind.oid, value)
					const affectedFeedbackIds = this.feedbackTracker.getFeedbackIdsForOid(varbind.oid)
					affectedFeedbackIds.forEach((id) => this.feedbackIdsToCheck.add(id))
				}
			})
			if (this.feedbackIdsToCheck.size > 0) this.throttledFeedbackIdCheck()
		}
	}

	/**
	 * Set an SNMP OID value on the target device
	 *
	 * @param {string} oid - The SNMP OID to set
	 * @param {number} type - The SNMP data type (e.g., snmp.ObjectType.Integer, snmp.ObjectType.OctetString)
	 * @param {SNMPValue} value - The value to set
	 * @returns {Promise<void>}
	 * @throws {Error} If the OID is invalid or the SNMP set operation fails
	 */

	async setOid(oid, type, value) {
		oid = trimOid(oid)
		if (!isValidSnmpOid(oid) || oid.length == 0) {
			throw new Error(`Invalid OID: ${oid}`)
		}
		await this.snmpQueue.add(
			() => {
				return new Promise((resolve, reject) => {
					this.session.set([{ oid, type, value }], (error) => {
						if (error) {
							reject(error)
						} else {
							if (this.config.verbose) this.log('debug', `Set OID: ${oid} type: ${type} value: ${value}`)
							resolve()
						}
					})
				})
			},
			{ priority: 1 },
		)
	}

	/**
	 * Get an SNMP OID value from the target device
	 *
	 * @param {string} oid - The SNMP OID to get
	 * @param {string} customVariable - Optional custom variable name to update with the value
	 * @param {boolean} displaystring - If true, convert value to string; if false, use raw value
	 * @param {import('@companion-module/base').CompanionActionContext | null} context - Companion context for setting custom variables (or null)
	 * @returns {Promise<SNMPValue>}
	 * @throws {Error} If the OID is invalid or the SNMP get operation fails
	 */

	async getOid(oid, customVariable, displaystring, context) {
		oid = trimOid(oid)
		if (!isValidSnmpOid(oid) || oid.length == 0) {
			throw new Error(`Invalid OID: ${oid}`)
		}
		return await this.snmpQueue.add(
			() => {
				return new Promise((resolve, reject) => {
					this.session.get(
						[oid],
						((error, varbinds) => {
							if (error) {
								reject(error)
							}
							if (snmp.isVarbindError(varbinds[0])) {
								reject(`Get OID: ${oid} Varbind error: ${snmp.varbindError(varbinds[0])}`)
							}
							/** @type {SNMPValue} */
							let value
							if (varbinds[0].type == snmp.ObjectType.Counter64) {
								value = bufferToBigInt(varbinds[0].value).toString()
							} else value = displaystring ? varbinds[0].value.toString() : varbinds[0].value
							if (this.config.verbose)
								this.log('debug', `OID: ${varbinds[0].oid} type: ${snmp.ObjectType[varbinds[0].type]} value: ${value}`)
							this.oidValues.set(varbinds[0].oid, value)
							if (customVariable && context !== null) context.setCustomVariableValue(customVariable, value)
							const affectedFeedbackIds = this.feedbackTracker.getFeedbackIdsForOid(varbinds[0].oid)
							affectedFeedbackIds.forEach((id) => this.feedbackIdsToCheck.add(id))
							if (this.feedbackIdsToCheck.size > 0) this.throttledFeedbackIdCheck()
							resolve(value)
						}).bind(this),
					)
				})
			},
			{ priority: 0 },
		)
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
			if (this.config.verbose)
				this.log('debug', `Checking feedbacks for IDs: ${[...this.feedbackIdsToCheck].join(', ')}`)
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
		this.closeListener()
	}

	updateActions() {
		UpdateActions(this)
	}

	updateFeedbacks() {
		UpdateFeedbacks(this)
	}
}

runEntrypoint(Generic_SNMP, UpgradeScripts)
