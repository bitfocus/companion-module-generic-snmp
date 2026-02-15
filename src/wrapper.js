const { EventEmitter } = require('events')

/**
 * Wrapper for Companion's SharedUDPSocket that implements the dgram.Socket interface
 * for use with node-net-snmp library. Filters messages by source IP address.
 *
 * @extends EventEmitter
 */

export class SharedUDPSocketWrapper extends EventEmitter {
	/**
	 * Create a SharedUDPSocket wrapper
	 *
	 * @param {import('@companion-module/base').SharedUdpSocket} sharedSocket - The Companion SharedUDPSocket instance
	 * @param {number} port - The UDP port number
	 * @param {string} allowedAddress - IP address to filter messages by (only messages from this address are emitted)
	 */
	constructor(sharedSocket, port, allowedAddress) {
		super()

		/** @type {import('@companion-module/base').SharedUdpSocket} */
		this.sharedSocket = sharedSocket

		/** @type {number} */
		this.port = port

		/** @type {string} */
		this.allowedAddress = allowedAddress // IP address to filter by

		/** @type {boolean} */
		this.isShared = true

		// Forward only matching messages
		/** @type {(msg: Buffer, rinfo: import('dgram').RemoteInfo) => void} */
		this.messageHandler = (msg, rinfo) => {
			// Only emit if the source address matches
			if (rinfo.address === this.allowedAddress) {
				this.emit('message', msg, rinfo)
			}
			// Otherwise silently drop
		}

		this.sharedSocket.on('message', this.messageHandler)
	}

	/**
	 * Update the allowed IP address filter
	 *
	 * @param {string} address - New IP address to filter by
	 * @returns {void}
	 */
	setAllowedAddress(address) {
		this.allowedAddress = address
	}

	/**
	 * Bind the socket (no-op for SharedUDPSocket which is already bound)
	 *
	 * @param {number} port - Port number
	 * @param {string} [address] - Address to bind to
	 * @param {() => void} [callback] - Callback function
	 * @returns {void}
	 */
	bind(port, address, callback) {
		if (callback) {
			process.nextTick(callback)
		}
		this.emit('listening')
	}

	/**
	 * Get socket address information
	 *
	 * @returns {{address: string, family: string, port: number}} Address info
	 */
	address() {
		return {
			address: '0.0.0.0',
			family: 'IPv4',
			port: this.port,
		}
	}

	/**
	 * Close the socket wrapper (removes listener but doesn't close shared socket)
	 *
	 * @param {() => void} [callback] - Callback function
	 * @returns {void}
	 */
	close(callback) {
		this.sharedSocket.removeListener('message', this.messageHandler)
		if (callback) {
			process.nextTick(callback)
		}
	}

	/**
	 * Send a message through the shared socket
	 *
	 * @param {Buffer | string | Uint8Array} msg - Message to send
	 * @param {number} offset - Offset in the buffer
	 * @param {number} length - Number of bytes to send
	 * @param {number} port - Destination port
	 * @param {string} address - Destination address
	 * @param {(error: Error | null, bytes: number) => void} [callback] - Callback function
	 * @returns {void}
	 */
	send(msg, offset, length, port, address, callback) {
		this.sharedSocket.send(msg, offset, length, port, address, callback)
	}

	/**
	 * Add a reference to prevent the event loop from exiting
	 *
	 * @returns {this}
	 */
	ref() {
		return this
	}

	/**
	 * Remove reference to allow the event loop to exit
	 *
	 * @returns {this}
	 */
	unref() {
		return this
	}
}
