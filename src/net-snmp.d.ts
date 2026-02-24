import 'net-snmp'

declare module 'net-snmp' {
	interface ReceiverOptions {
		port?: number
		disableAuthorization?: boolean
		includeAuthentication?: boolean
		engineID?: string
		address?: string | null
		transport?: string
	}

	interface Authorizer {
		addUser(user: {
			name: string
			level: SecurityLevel
			authProtocol?: AuthProtocols
			authKey?: string
			privProtocol?: PrivProtocols
			privKey?: string
		}): void
		addCommunity(community: string): void
	}

	interface ReceiverSession {
		on(event: 'message', listener: (error: Error | null, notification: Notification, rinfo: RemoteInfo) => void): this
		getAuthorizer(): Authorizer
		close(): void
	}

	interface TrapPdu {
		id: number
		scoped?: boolean
		community?: string
		varbinds: snmp.VarBind[]
		type: snmp.PduType
	}

	interface Notification {
		pdu: TrapPdu
		rinfo: RemoteInfo
	}

	interface RemoteInfo {
		address: string
		family: 'IPv4' | 'IPv6'
		port: number
		size: number
	}

	function createReceiver(
		options: ReceiverOptions,
		callback: (error: Error | null, notification: Notification) => void,
	): ReceiverSession
}
