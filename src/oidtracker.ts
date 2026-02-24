import { trimOid, isValidSnmpOid } from './oidUtils.js'

/**
 * Manages bidirectional mapping between OIDs and feedback IDs for SNMP trap monitoring.
 * Allows efficient lookup of which feedbacks are watching which OIDs and vice versa.
 */
export class FeedbackOidTracker {
	/** Map of OID to Set of feedback IDs watching that OID */
	oidToFeedbacks: Map<string, Set<string>> = new Map()
	/** Map of feedback ID to the OID it's watching */
	feedbackToOid: Map<string, string> = new Map()

	constructor() {}

	/**
	 * Register a feedback to watch a specific OID
	 *
	 * @param feedbackId - The feedback instance ID
	 * @param oid - The SNMP OID to watch
	 */
	addFeedback(feedbackId: string, oid: string): void {
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
		this.oidToFeedbacks.get(oid)?.add(feedbackId)

		// Map feedback ID to OID
		this.feedbackToOid.set(feedbackId, oid)
	}

	/**
	 * Update a feedback's OID (removes old mapping and creates new one)
	 *
	 * @param feedbackId - The feedback instance ID
	 * @param newOid - The new SNMP OID to watch
	 */
	updateFeedback(feedbackId: string, newOid: string): void {
		this.addFeedback(feedbackId, newOid)
	}

	/**
	 * Remove a feedback from tracking
	 *
	 * @param feedbackId - The feedback instance ID to remove
	 */
	removeFeedback(feedbackId: string): void {
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
	 * @param oid - The SNMP OID
	 * @returns Set of feedback IDs (empty set if none)
	 */
	getFeedbacksForOid(oid: string): Readonly<Set<string>> {
		return this.oidToFeedbacks.get(oid) || new Set()
	}

	/**
	 * Get the OID that a feedback is watching
	 *
	 * @param feedbackId - The feedback instance ID
	 * @returns The OID being watched, or undefined if not found
	 */
	getOidForFeedback(feedbackId: string): string | undefined {
		return this.feedbackToOid.get(feedbackId)
	}

	/**
	 * Check if any feedbacks are watching a specific OID
	 *
	 * @param oid - The SNMP OID
	 * @returns True if at least one feedback is watching this OID
	 */
	hasWatchersForOid(oid: string): boolean {
		const feedbacks = this.oidToFeedbacks.get(oid)
		return feedbacks ? feedbacks.size > 0 : false
	}

	/**
	 * Get all OIDs currently being watched
	 *
	 * @returns Array of all OIDs that have at least one watcher
	 */
	getAllWatchedOids(): string[] {
		return Array.from(this.oidToFeedbacks.keys())
	}

	/**
	 * Get total number of feedbacks being tracked
	 *
	 * @returns Total number of feedbacks
	 */
	getFeedbackCount(): number {
		return this.feedbackToOid.size
	}

	/**
	 * Get all feedback IDs watching a specific OID as an array
	 *
	 * @param oid - The SNMP OID
	 * @returns Array of feedback IDs (empty array if none)
	 */
	getFeedbackIdsForOid(oid: string): string[] {
		const feedbackSet = this.oidToFeedbacks.get(oid)
		return feedbackSet ? Array.from(feedbackSet) : []
	}

	/**
	 * Clear all mappings
	 *
	 */
	clear(): void {
		this.oidToFeedbacks.clear()
		this.feedbackToOid.clear()
	}
}
