import {
	InstanceBase,
	InstanceStatus,
	SomeCompanionConfigField,
	SharedUdpSocket,
	DropdownChoice,
} from '@companion-module/base'
import snmp from 'net-snmp'
import PQueue from 'p-queue'
import GetConfigFields from './configs.js'
import type { ModuleConfig, ModuleSecrets } from './configs.js'
import UpdateActions from './actions.js'
import UpdateFeedbacks, { FeedbackId } from './feedbacks.js'
import UpgradeScripts from './upgrades.js'
import { StatusManager } from './status.js'
import type { InstanceBaseExt, ModuleTypes } from './types.js'
import { SharedUDPSocketWrapper } from './wrapper.js'
import { FeedbackOidTracker } from './oidtracker.js'
import { trimOid, isValidSnmpOid, validateVarbinds } from './oidUtils.js'
import { throttle, debounce } from 'es-toolkit'
import dns from 'dns'
import os from 'os'

export { UpgradeScripts }

export default class Generic_SNMP extends InstanceBase<ModuleTypes> implements InstanceBaseExt {
	public config!: ModuleConfig
	private secrets!: ModuleSecrets

	private statusManager = new StatusManager(this, { status: InstanceStatus.Connecting, message: 'Initialising' }, 2000)
	/** Map of OIDs with their values, uses OID string as key */
	public oidValues: Map<string, snmp.Varbind> = new Map()
	/** Set of Feedback IDs to be checked after throttle interval */
	private feedbackIdsToCheck: Set<string> = new Set()
	public oidTracker = new FeedbackOidTracker()
	private snmpQueue = new PQueue({ concurrency: 1, interval: 10, intervalCap: 1 })
	private agentAddress = '127.0.0.1'

	private pollTimer: NodeJS.Timeout | undefined

	private session: snmp.Session | null = null

	private receiver: snmp.ReceiverSession | null = null
	private socketWrapper!: SharedUDPSocketWrapper
	private listeningSocket!: SharedUdpSocket

	public checkFeedbacks(...feedbackTypes: FeedbackId[]): void {
		super.checkFeedbacks(...(feedbackTypes as [FeedbackId]))
	}

	constructor(internal: unknown) {
		super(internal)
	}

	public async init(config: ModuleConfig, _isFirstInit: boolean, secrets: ModuleSecrets): Promise<void> {
		this.config = config
		this.secrets = secrets
		this.updateActions()
		this.updateFeedbacks()
		await this.initializeConnection()
		await this.setAgentAddress()
	}

	public async configUpdated(config: ModuleConfig, secrets: ModuleSecrets): Promise<void> {
		this.snmpQueue.clear()
		this.closeListener()

		if (this.pollTimer) {
			clearTimeout(this.pollTimer)
			delete this.pollTimer
		}

		this.config = config
		this.secrets = secrets

		this.updateActions()
		this.updateFeedbacks()

		await this.initializeConnection()
		await this.setAgentAddress()
	}

	public async destroy(): Promise<void> {
		this.log('debug', `destroy ${this.id}:${this.label}`)
		this.statusManager.destroy()
		this.snmpQueue.clear()
		this.throttledFeedbackIdCheck.cancel()
		this.debouncedUpdateDefinitions.cancel()
		if (this.pollTimer) {
			clearTimeout(this.pollTimer)
			delete this.pollTimer
		}
		this.disconnectAgent()
		this.closeListener()
	}

	private async setAgentAddress(): Promise<void> {
		return new Promise<void>((resolve) => {
			dns.lookup(os.hostname(), (err, addr) => {
				if (err) resolve()
				this.agentAddress = addr
				resolve()
			})
		})
	}

	/**
	 * Initialize SNMP agent connection, trap listener, and polling
	 *
	 */
	private async initializeConnection(): Promise<void> {
		this.connectAgent()

		if (this.config.traps) {
			try {
				await this.createListener()
			} catch (err) {
				if (err instanceof Error) this.log('error', `Could not initialize SNMP Trap listener: ${err.message}`)
				else this.log('error', `Could not initialize SNMP Trap listener: ${err}`)
			}
		}
		if (this.config.walk) {
			const walkPaths = this.config.walk.split(',').map((oid) => oid.trim())
			walkPaths.forEach((oid) => {
				try {
					this.log('info', `Walking ${oid}...`)
					this.walk(oid).catch(() => {})
					this.log('info', `Walk of ${oid} complete!`)
				} catch (err) {
					this.log('warn', `Walk failed - ${err instanceof Error ? err.message : String(err)}`)
				}
			})
		}

		if (this.config.interval > 0) {
			this.pollOids().catch(() => {})
		}
	}

	public getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	private connectAgent(): void {
		this.disconnectAgent()

		if (this.config.ip === undefined || this.config.ip === '') {
			this.log('warn', 'Please configure your instance')
			this.statusManager.updateStatus(InstanceStatus.BadConfig, 'Missing configuration')
			return
		}

		// create v1/v2c session
		if (this.config.version === 'v1' || this.config.version === 'v2c') {
			const options = {
				port: this.config.port,
				version: this.config.version === 'v1' ? snmp.Version1 : snmp.Version2c,
				trapPort: this.config.trapPort ?? 162,
				timeout: 5000,
			}

			if (this.config.community === undefined || this.config.community === '') {
				this.log('warn', 'When using SNMP v1 or v2c please specify a community.')
				this.statusManager.updateStatus(InstanceStatus.BadConfig, 'Missing community')
				return
			}

			this.session = snmp.createSession(this.config.ip, this.config.community, options)
			this.statusManager.updateStatus(InstanceStatus.Ok)
			return
		}

		// create v3 session
		if (this.config.engineID === undefined || this.config.engineID === '') {
			this.log('warn', 'When using SNMP v3 please specify an Engine ID.')
			this.statusManager.updateStatus(InstanceStatus.BadConfig, 'Missing Engine ID')
			return
		}

		if (this.config.username === undefined || this.config.username === '') {
			this.log('warn', 'When using SNMP v3 please specify a User Name.')
			this.statusManager.updateStatus(InstanceStatus.BadConfig, 'Missing User Name')
			return
		}

		const options = {
			port: this.config.port,
			engineID: this.config.engineID,
			version: snmp.Version3,
			timeout: 5000,
		}
		const user: {
			name: string
			level: snmp.SecurityLevel
			authProtocol?: snmp.AuthProtocols
			authKey?: string
			privProtocol?: snmp.PrivProtocols
			privKey?: string
		} = {
			name: this.config.username,
			level: snmp.SecurityLevel[this.config.securityLevel],
		}

		if (this.config.securityLevel !== 'noAuthNoPriv') {
			if (this.secrets.authKey === undefined || this.secrets.authKey === '') {
				this.log('warn', 'please specify an Auth Key when Security level is authNoPriv or authPriv.')
				this.statusManager.updateStatus(InstanceStatus.BadConfig, 'Missing Auth Key')
				return
			}

			user.authProtocol = snmp.AuthProtocols[this.config.authProtocol]
			user.authKey = this.secrets.authKey

			if (this.config.securityLevel == 'authPriv') {
				if (this.secrets.privKey === undefined || this.secrets.privKey === '') {
					this.log('warn', 'Please specify a Priv Key when Security level is authPriv.')
					this.statusManager.updateStatus(InstanceStatus.BadConfig, 'Missing Priv Key')
					return
				}
				if (!process.execArgv.includes('--openssl-legacy-provider') && this.config.privProtocol == 'des') {
					this.log(
						'error',
						`Process running without --openssl-legacy-provider flag.\nDES priv protocol cannot be used. Note: Only supported in Companion v4.2.5 or later`,
					)
					this.statusManager.updateStatus(InstanceStatus.BadConfig, 'Insufficient Permissions')
					return
				}
				user.privProtocol = snmp.PrivProtocols[this.config.privProtocol]
				user.privKey = this.secrets.privKey
			}
		}

		this.session = snmp.createV3Session(this.config.ip, user, options)
		this.statusManager.updateStatus(InstanceStatus.Ok)
	}

	private disconnectAgent(): void {
		if (this.session) {
			this.session.close()
		}
		this.statusManager.updateStatus(InstanceStatus.Disconnected)
	}

	private closeListener(): void {
		if (this.receiver) {
			this.receiver.close()
			this.receiver = null
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
	 * @throws If the binding fails
	 */

	private async createListener(): Promise<void> {
		this.closeListener()
		return new Promise<void>((resolve, reject) => {
			this.listeningSocket = this.createSharedUdpSocket('udp4')

			const errorHandler = (err: Error) => {
				this.log('error', `Listener error: ${err.message}`)
				if (this.listeningSocket) this.listeningSocket.removeAllListeners()
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
					dgramModule: this.socketWrapper,
					includeAuthentication: true,
					engineID: this.config.engineID,
				}
				this.receiver = snmp.createReceiver(receiverOptions, (error: Error | null, trap: snmp.Notification) => {
					if (error) {
						if (error instanceof Error) this.log('warn', `SNMP trap error: ${error.message}`)
					} else {
						this.processTrap(trap)
					}
				}) as snmp.ReceiverSession
				this.log('info', `Listening on Port ${this.config.portBind} for Traps from ${this.config.ip}`)
				if (this.config.version === 'v3') {
					this.receiver.getAuthorizer().addUser({
						name: this.config.username,
						level: snmp.SecurityLevel[this.config.securityLevel],
						authProtocol: snmp.AuthProtocols[this.config.authProtocol],
						authKey: this.secrets.authKey,
						privProtocol: snmp.PrivProtocols[this.config.privProtocol],
						privKey: this.secrets.privKey,
					})
				}
				this.receiver.getAuthorizer().addCommunity(this.config.community)
				resolve()
			})

			this.listeningSocket.bind(this.config.portBind || 162, this.config.ip)
		})
	}

	/**
	 * Process a recieved SNMP Trap
	 *
	 * @param trap - The trap or inform to process
	 */
	private processTrap(trap: snmp.Notification): void {
		try {
			if (this.config.verbose) this.log(`debug`, `${snmp.PduType[trap.pdu.type]} recieved`)
			if (this.config.verbose) this.log('debug', JSON.stringify(trap))
			if (Array.isArray(trap.pdu.varbinds)) {
				trap.pdu.varbinds.forEach((varbind, index) => {
					this.handleVarbind(varbind, index)
				})
			}
		} catch (error) {
			this.log('error', `processTrap error: ${error instanceof Error ? error.message : error}`)
		}
	}

	/**
	 * Processes a single SNMP varbind, checks the type of
	 * and storing it in the OID value cache. Triggers feedback checks for any
	 * feedbacks watching the varbind's OID.
	 *
	 *
	 * @param varbind - The varbind to process
	 * @param index - The index of the varbind in its parent array, used for logging
	 */

	private handleVarbind(varbind: snmp.Varbind, index: number): void {
		if (snmp.isVarbindError(varbind)) {
			this.log('warn', snmp.varbindError(varbind))
			return
		}
		if ('value' in varbind && 'type' in varbind && varbind.type !== undefined) {
			if (
				varbind.type == snmp.ObjectType.NoSuchObject ||
				varbind.type == snmp.ObjectType.EndOfMibView ||
				varbind.type == snmp.ObjectType.NoSuchInstance
			) {
				// We don't want to cache these value types
				this.log(
					'debug',
					`VarBind [${index}] OID: ${varbind.oid} type: ${snmp.ObjectType[varbind.type]}\nNot caching varbind`,
				)
				return
			}
			this.log(
				'info',
				`VarBind [${index}] OID: ${varbind.oid} type: ${snmp.ObjectType[varbind.type]} value: ${varbind.value}`,
			)
			const isNew = !this.oidValues.has(varbind.oid)
			this.oidValues.set(varbind.oid, varbind)
			if (isNew) this.debouncedUpdateDefinitions()
			this.oidTracker.getFeedbackIdsForOid(varbind.oid).forEach((id) => this.feedbackIdsToCheck.add(id))
			if (this.feedbackIdsToCheck.size > 0) this.throttledFeedbackIdCheck()
		}
	}

	/**
	 * Set an SNMP OID value on the target device
	 *
	 * @param oid - The SNMP OID to set
	 * @param type - The SNMP data type (e.g., snmp.ObjectType.Integer, snmp.ObjectType.OctetString)
	 * @param value - The value to set
	 * @throws If the OID is invalid or the SNMP set operation fails
	 */

	public async setOid(oid: string, type: snmp.ObjectType, value: snmp.VarbindValue): Promise<void> {
		oid = trimOid(oid)
		if (!isValidSnmpOid(oid) || oid.length == 0) {
			throw new Error(`Invalid OID: ${oid}`)
		}
		await this.snmpQueue.add(
			async () => {
				return new Promise<void>((resolve, reject) => {
					if (this.session == null) reject(new Error('SNMP session not initialized'))
					else {
						this.session.set([{ oid, type, value }], (error) => {
							if (error) {
								reject(error)
							} else {
								if (this.config.verbose) this.log('debug', `Set OID: ${oid} type: ${type} value: ${value}`)
								resolve()
							}
						})
					}
				})
			},
			{ priority: 1 },
		)
	}

	/**
	 * Get an SNMP OID value from the target device
	 *
	 * @param oids - The SNMP OID or array of OIDs to get
	 * @throws If the OID is invalid or the SNMP get operation fails
	 */

	public async getOid(...oids: string[]): Promise<void> {
		oids = oids.reduce((acc: string[], oid) => {
			oid = trimOid(oid)
			if (!isValidSnmpOid(oid) || oid.length == 0) {
				this.log('warn', `Invalid OID skipped: ${oid}`)
				return acc
			}
			acc.push(oid)
			return acc
		}, [])

		if (oids.length === 0) return
		return await this.snmpQueue.add(
			async () => {
				return new Promise<void>((resolve, reject) => {
					if (this.session == null) reject(new Error('SNMP session not initialized'))
					else {
						this.session.get(oids, (error, varbinds) => {
							if (error) {
								reject(error)
							}
							if (Array.isArray(varbinds)) {
								varbinds.forEach((varbind, index) => {
									this.handleVarbind(varbind, index)
								})
							}
							resolve()
						})
					}
				})
			},
			{ priority: 0 },
		)
	}

	/**
	 * Walk the MIB tree from specified OID
	 *
	 * @param oid - The SNMP OID to walk from
	 * @throws {Error} If the OID is invalid or the SNMP walk operation fails
	 */

	public async walk(oid: string): Promise<void> {
		oid = trimOid(oid)
		if (!isValidSnmpOid(oid) || oid.length == 0) {
			this.log('warn', `Invalid OID: ${oid}, walk cancelled`)
			return
		}
		return await this.snmpQueue.add(
			async () => {
				return new Promise<void>((resolve, reject) => {
					const feedCb = (varbinds: snmp.Varbind[]) => {
						varbinds.forEach((varbind, index) => this.handleVarbind(varbind, index))
					}
					const doneCb = (error: Error | null) => {
						if (error) reject(error)
						else resolve()
					}
					if (this.session == null) reject(new Error('SNMP session not initialized'))
					else this.session.walk(oid, feedCb, doneCb)
				})
			},
			{ priority: 0 },
		)
	}

	/**
	 * Sends an SNMP INFORM notification.
	 *
	 * @param typeOrOid - Either a numeric {@link snmp.TrapType} value
	 *   for a generic inform, or an OID string for an enterprise-specific inform.
	 * @param varbinds - Optional list of variable bindings to include
	 *   with the inform. Only used when `typeOrOid` is an OID string.
	 * @returns Resolves when the inform is acknowledged, or rejects on error.
	 */

	public async sendInform(typeOrOid: snmp.TrapType | string, ...varbinds: snmp.Varbind[]): Promise<void> {
		return await this.snmpQueue.add(
			async () => {
				return new Promise<void>((resolve, reject) => {
					if (typeof typeOrOid === 'string') {
						typeOrOid = trimOid(typeOrOid)
						if (!isValidSnmpOid(typeOrOid)) {
							reject(new Error(`Invalid Enterprise OID: ${typeOrOid}`))
							return
						}
					}
					if (this.session == null) reject(new Error('SNMP session not initalized'))
					else {
						const validatedVarBinds = validateVarbinds(varbinds)

						this.session.inform(typeOrOid, validatedVarBinds, (error) => {
							if (error) {
								reject(error)
								return
							}
							this.log(
								'info',
								`Inform sent: ${typeof typeOrOid === 'number' ? snmp.TrapType[typeOrOid] : typeOrOid}${validatedVarBinds.length > 0 ? `\n${JSON.stringify(validatedVarBinds)}` : ''}`,
							)
							resolve()
						})
					}
				})
			},
			{ priority: 2 },
		)
	}
	/**
	 * Sends an SNMP TRAP notification.
	 *
	 * @param typeOrOid - Either a numeric {@link snmp.TrapType} value
	 *   for a generic inform, or an OID string for an enterprise-specific inform.
	 * @param varbinds - Optional list of variable bindings
	 *   to include with the trap. Only used when `typeOrOid` is an OID string.
	 * @returns Resolves when the trap is sent, or rejects on error.
	 */
	public async sendTrap(typeOrOid: snmp.TrapType | string, ...varbinds: snmp.Varbind[]): Promise<void> {
		return await this.snmpQueue.add(
			async () => {
				return new Promise<void>((resolve, reject) => {
					if (typeof typeOrOid === 'string') {
						typeOrOid = trimOid(typeOrOid)
						if (!isValidSnmpOid(typeOrOid)) {
							reject(new Error(`Invalid Enterprise OID: ${typeOrOid}`))
							return
						}
					}
					if (this.session == null) reject(new Error('SNMP session not initalized'))
					else {
						const validatedVarBinds = validateVarbinds(varbinds)

						this.session.trap(typeOrOid, validatedVarBinds, this.agentAddress, (error) => {
							if (error) {
								reject(error)
								return
							}
							this.log(
								'info',
								`Trap sent: ${typeof typeOrOid === 'number' ? snmp.TrapType[typeOrOid] : typeOrOid}${validatedVarBinds.length > 0 ? `\n${JSON.stringify(validatedVarBinds)}` : ''}`,
							)
							resolve()
						})
					}
				})
			},
			{ priority: 3 },
		)
	}

	/**
	 * Returns a list of dropdown choices from the cached OID values map,
	 * one entry per OID key.
	 * @param types snmp Object types to include in the returned dropdown. If empty all types included
	 */
	public getOidChoices(...types: snmp.ObjectType[]): DropdownChoice[] {
		return Array.from(this.oidValues.entries())
			.filter(([, varbind]) => types.length === 0 || (varbind.type !== undefined && types.includes(varbind.type)))
			.map(([oid, varbind]) => ({
				id: oid,
				label: types.length === 1 ? oid : `${oid} (${snmp.ObjectType[varbind.type!]})`,
			}))
	}

	private async pollOids(): Promise<void> {
		const oids = this.oidTracker.getOidsToPoll
		if (oids.length > 0) await this.getOid(...oids)
		if (this.config.interval > 0) {
			this.pollTimer = setTimeout(() => {
				this.pollOids().catch(() => {})
			}, this.config.interval * 1000)
		}
	}

	private throttledFeedbackIdCheck = throttle(
		() => {
			if (this.config.verbose)
				this.log('debug', `Checking feedbacks for IDs: ${[...this.feedbackIdsToCheck].join(', ')}`)
			this.checkFeedbacksById(...this.feedbackIdsToCheck)
			this.feedbackIdsToCheck.clear()
		},
		30,
		{ edges: ['trailing'] },
	)

	private updateActions(): void {
		this.setActionDefinitions(UpdateActions(this))
	}

	private updateFeedbacks(): void {
		this.setFeedbackDefinitions(UpdateFeedbacks(this))
	}

	/**
	 * Debounced function that updates action and feedback definitions.
	 */

	private debouncedUpdateDefinitions = debounce(() => {
		this.updateActions()
		this.updateFeedbacks()
	}, 1000)
}
