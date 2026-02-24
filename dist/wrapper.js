import { EventEmitter } from 'events';
const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
/**
 * Wrapper for Companion's SharedUDPSocket that implements the dgram.Socket interface
 * for use with node-net-snmp library. Filters messages by source IP address.
 *
 * @extends EventEmitter
 */
export class SharedUDPSocketWrapper extends EventEmitter {
    sharedSocket;
    port = 162;
    allowedAddress;
    isShared = false;
    /**
     * Create a SharedUDPSocket wrapper
     *
     * @param sharedSocket - The Companion SharedUDPSocket instance
     * @param port - The UDP port number
     * @param allowedAddress - IP address to filter messages by (only messages from this address are emitted)
     */
    constructor(sharedSocket, port, allowedAddress) {
        super();
        /** @type {import('@companion-module/base').SharedUdpSocket} */
        this.sharedSocket = sharedSocket;
        if (!Number.isInteger(port) || port < 1 || port > 65535)
            throw new Error(`Port out of range: ${port}`);
        /** @type {number} */
        this.port = port;
        if (!allowedAddress.match(ipRegex))
            throw new Error(`Allowed Address must be a IPv4 address: ${allowedAddress}`);
        /** @type {string} */
        this.allowedAddress = allowedAddress; // IP address to filter by
        /** @type {boolean} */
        this.isShared = true;
        this.sharedSocket.on('message', this.messageHandler);
    }
    // Forward only matching messages
    messageHandler = (msg, rinfo) => {
        // Only emit if the source address matches
        if (rinfo.address === this.allowedAddress) {
            this.emit('message', Buffer.from(msg), rinfo);
        }
    };
    /**
     * Update the allowed IP address filter
     *
     */
    setAllowedAddress(address) {
        if (!address.match(ipRegex))
            throw new Error(`Allowed Address must be a IPv4 address: ${address}`);
        this.allowedAddress = address;
    }
    /**
     * Bind the socket (no-op for SharedUDPSocket which is already bound)
     *
     */
    bind(_port, _address, callback) {
        if (callback) {
            process.nextTick(callback);
        }
        this.emit('listening');
    }
    /**
     * Get socket address information
     */
    address() {
        return {
            address: '0.0.0.0',
            family: 'IPv4',
            port: this.port,
        };
    }
    /**
     * Get socket type
     */
    get type() {
        return 'udp4';
    }
    /**
     * Spoof createSocket, return self
     */
    createSocket(_type) {
        return this;
    }
    /**
     * Close the socket wrapper (removes listener but doesn't close shared socket)
     *
     */
    close(callback) {
        this.sharedSocket.removeListener('message', this.messageHandler);
        if (callback) {
            process.nextTick(callback);
        }
    }
    /**
     * Send a message through the shared socket
     *
     */
    send(msg, offset, length, port, address, callback) {
        this.sharedSocket.send(msg, offset, length, port, address, callback);
    }
    /**
     * Add a reference to prevent the event loop from exiting
     *
     */
    ref() {
        return this;
    }
    /**
     * Remove reference to allow the event loop to exit
     *
     */
    unref() {
        return this;
    }
}
//# sourceMappingURL=wrapper.js.map