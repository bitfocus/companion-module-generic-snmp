import { trimOid, isValidSnmpOid } from './oidUtils.js'

/**
 * Manages bidirectional mapping between OIDs and feedback IDs for SNMP trap monitoring.
 * Allows efficient lookup of which feedbacks are watching which OIDs and vice versa.
 */
export class FeedbackOidTracker {
	constructor() {
		/** @type {Map<string, Set<string>>} Map of OID to Set of feedback IDs watching that OID */
		this.oidToFeedbacks = new Map()

		/** @type {Map<string, string>} Map of feedback ID to the OID it's watching */
		this.feedbackToOid = new Map()
	}

	/**
	 * Register a feedback to watch a specific OID
	 *
	 * @param {string} feedbackId - The feedback instance ID
	 * @param {string} oid - The SNMP OID to watch
	 * @returns {void}
	 */
	addFeedback(feedbackId, oid) {
		// Remove any existing mapping for this feedback first
		this.removeFeedback(feedbackId)
		oid = trimOid(oid)
		if (!isValidSnmpOid(oid) || oid.length == 0) {
			throw new Error(`Invalid OID: ${oid}`)
		}

		// Add feedback to OID's set
		if (!this.oidToFeedbacks.has(oid)) {
			this.oidToFeedbacks.set(oid, new Set())
		}
		this.oidToFeedbacks.get(oid).add(feedbackId)

		// Map feedback ID to OID
		this.feedbackToOid.set(feedbackId, oid)
	}

	/**
	 * Update a feedback's OID (removes old mapping and creates new one)
	 *
	 * @param {string} feedbackId - The feedback instance ID
	 * @param {string} newOid - The new SNMP OID to watch
	 * @returns {void}
	 */
	updateFeedback(feedbackId, newOid) {
		this.addFeedback(feedbackId, newOid)
	}

	/**
	 * Remove a feedback from tracking
	 *
	 * @param {string} feedbackId - The feedback instance ID to remove
	 * @returns {void}
	 */
	removeFeedback(feedbackId) {
		// Get the OID this feedback was watching
		const oldOid = this.feedbackToOid.get(feedbackId)

		if (oldOid) {
			// Remove feedback from the OID's set
			const feedbackSet = this.oidToFeedbacks.get(oldOid)
			if (feedbackSet) {
				feedbackSet.delete(feedbackId)

				// Clean up empty sets
				if (feedbackSet.size === 0) {
					this.oidToFeedbacks.delete(oldOid)
				}
			}

			// Remove feedback to OID mapping
			this.feedbackToOid.delete(feedbackId)
		}
	}

	/**
	 * Get all feedback IDs watching a specific OID
	 *
	 * @param {string} oid - The SNMP OID
	 * @returns {Set<string>} Set of feedback IDs (empty set if none)
	 */
	getFeedbacksForOid(oid) {
		return this.oidToFeedbacks.get(oid) || new Set()
	}

	/**
	 * Get the OID that a feedback is watching
	 *
	 * @param {string} feedbackId - The feedback instance ID
	 * @returns {string | undefined} The OID being watched, or undefined if not found
	 */
	getOidForFeedback(feedbackId) {
		return this.feedbackToOid.get(feedbackId)
	}

	/**
	 * Check if any feedbacks are watching a specific OID
	 *
	 * @param {string} oid - The SNMP OID
	 * @returns {boolean} True if at least one feedback is watching this OID
	 */
	hasWatchersForOid(oid) {
		const feedbacks = this.oidToFeedbacks.get(oid)
		return feedbacks ? feedbacks.size > 0 : false
	}

	/**
	 * Get all OIDs currently being watched
	 *
	 * @returns {string[]} Array of all OIDs that have at least one watcher
	 */
	getAllWatchedOids() {
		return Array.from(this.oidToFeedbacks.keys())
	}

	/**
	 * Get total number of feedbacks being tracked
	 *
	 * @returns {number} Total number of feedbacks
	 */
	getFeedbackCount() {
		return this.feedbackToOid.size
	}

	/**
	 * Get all feedback IDs watching a specific OID as an array
	 *
	 * @param {string} oid - The SNMP OID
	 * @returns {string[]} Array of feedback IDs (empty array if none)
	 */
	getFeedbackIdsForOid(oid) {
		const feedbackSet = this.oidToFeedbacks.get(oid)
		return feedbackSet ? Array.from(feedbackSet) : []
	}

	/**
	 * Clear all mappings
	 *
	 * @returns {void}
	 */
	clear() {
		this.oidToFeedbacks.clear()
		this.feedbackToOid.clear()
	}
}
