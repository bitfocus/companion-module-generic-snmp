import { EventEmitter } from 'events'
import type { SharedUdpSocket } from '@companion-module/base'
import { RemoteInfo } from 'dgram'

const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/

/**
 * Wrapper for Companion's SharedUDPSocket that implements the dgram.Socket interface
 * for use with node-net-snmp library. Filters messages by source IP address.
 *
 * @extends EventEmitter
 */

export class SharedUDPSocketWrapper extends EventEmitter {
	sharedSocket!: SharedUdpSocket
	port = 162
	allowedAddress!: string
	isShared = false
	/**
	 * Create a SharedUDPSocket wrapper
	 *
	 * @param sharedSocket - The Companion SharedUDPSocket instance
	 * @param port - The UDP port number
	 * @param allowedAddress - IP address to filter messages by (only messages from this address are emitted)
	 */
	constructor(sharedSocket: SharedUdpSocket, port: number, allowedAddress: string) {
		super()

		/** @type {import('@companion-module/base').SharedUdpSocket} */
		this.sharedSocket = sharedSocket

		if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Port out of range: ${port}`)
		/** @type {number} */
		this.port = port

		if (!allowedAddress.match(ipRegex)) throw new Error(`Allowed Address must be a IPv4 address: ${allowedAddress}`)
		/** @type {string} */
		this.allowedAddress = allowedAddress // IP address to filter by

		/** @type {boolean} */
		this.isShared = true

		this.sharedSocket.on('message', this.messageHandler)
	}

	// Forward only matching messages

	messageHandler = (msg: Buffer, rinfo: RemoteInfo): void => {
		// Only emit if the source address matches
		if (rinfo.address === this.allowedAddress) {
			this.emit('message', Buffer.from(msg), rinfo)
		}
	}

	/**
	 * Update the allowed IP address filter
	 *
	 */
	setAllowedAddress(address: string): void {
		if (!address.match(ipRegex)) throw new Error(`Allowed Address must be a IPv4 address: ${address}`)
		this.allowedAddress = address
	}

	/**
	 * Bind the socket (no-op for SharedUDPSocket which is already bound)
	 *
	 */
	bind(_port: number, _address: string, callback?: () => void): void {
		if (callback) {
			process.nextTick(callback)
		}
		this.emit('listening')
	}

	/**
	 * Get socket address information
	 */
	address(): { address: string; family: string; port: number } {
		return {
			address: '0.0.0.0',
			family: 'IPv4',
			port: this.port,
		}
	}

	/**
	 * Get socket type
	 */

	get type(): string {
		return 'udp4'
	}

	/**
	 * Spoof createSocket, return self
	 */

	createSocket(_type: string): SharedUDPSocketWrapper {
		return this
	}

	/**
	 * Close the socket wrapper (removes listener but doesn't close shared socket)
	 *
	 */
	close(callback?: () => void): void {
		this.sharedSocket.removeListener('message', this.messageHandler)
		if (callback) {
			process.nextTick(callback)
		}
	}

	/**
	 * Send a message through the shared socket
	 *
	 */
	send(
		msg: Buffer | string | DataView<ArrayBufferLike>,
		offset: number,
		length: number,
		port: number,
		address: string,
		callback?: () => void,
	): void {
		this.sharedSocket.send(msg, offset, length, port, address, callback)
	}

	/**
	 * Add a reference to prevent the event loop from exiting
	 *
	 */
	ref(): SharedUDPSocketWrapper {
		return this
	}

	/**
	 * Remove reference to allow the event loop to exit
	 *
	 */
	unref(): SharedUDPSocketWrapper {
		return this
	}
}
