import { describe, it, expect, beforeEach } from 'vitest'
import { FeedbackOidTracker } from './oidtracker.js'

const OID_A = '1.3.6.1.2.1'
const OID_B = '1.3.6.1.2.2'
const OID_C = '1.3.6.1.2.3'

describe('FeedbackOidTracker', () => {
	let tracker: FeedbackOidTracker

	beforeEach(() => {
		tracker = new FeedbackOidTracker()
	})

	// -------------------------------------------------------------------------
	// addFeedback
	// -------------------------------------------------------------------------

	describe('addFeedback', () => {
		it('registers a feedback and maps it to its OID', () => {
			tracker.addFeedback('fb1', OID_A, false)
			expect(tracker.getOidForFeedback('fb1')).toBe(OID_A)
			expect(tracker.getFeedbacksForOid(OID_A).has('fb1')).toBe(true)
		})

		it('strips leading dots from the OID before storing', () => {
			tracker.addFeedback('fb1', `.${OID_A}`, false)
			expect(tracker.getOidForFeedback('fb1')).toBe(OID_A)
		})

		it('allows multiple feedbacks to watch the same OID', () => {
			tracker.addFeedback('fb1', OID_A, false)
			tracker.addFeedback('fb2', OID_A, false)
			const feedbacks = tracker.getFeedbacksForOid(OID_A)
			expect(feedbacks.has('fb1')).toBe(true)
			expect(feedbacks.has('fb2')).toBe(true)
			expect(feedbacks.size).toBe(2)
		})

		it('re-registers a feedback to a new OID, removing the old mapping', () => {
			tracker.addFeedback('fb1', OID_A, false)
			tracker.addFeedback('fb1', OID_B, false)

			expect(tracker.getOidForFeedback('fb1')).toBe(OID_B)
			expect(tracker.getFeedbacksForOid(OID_B).has('fb1')).toBe(true)
			expect(tracker.getFeedbacksForOid(OID_A).has('fb1')).toBe(false)
		})

		it('cleans up the OID entry when the last feedback for it is re-registered', () => {
			tracker.addFeedback('fb1', OID_A, false)
			tracker.addFeedback('fb1', OID_B, false)

			expect(tracker.getAllWatchedOids()).not.toContain(OID_A)
		})

		it('throws on an invalid OID', () => {
			expect(() => tracker.addFeedback('fb1', 'not-an-oid', false)).toThrow(/Invalid OID/)
		})

		it('throws on an OID starting with 3', () => {
			expect(() => tracker.addFeedback('fb1', '3.6.1', false)).toThrow(/Invalid OID/)
		})

		it('adds to poll group when poll is true', () => {
			tracker.addFeedback('fb1', OID_A, true)
			expect(tracker.getOidsToPoll).toContain(OID_A)
		})

		it('does not add to poll group when poll is false', () => {
			tracker.addFeedback('fb1', OID_A, false)
			expect(tracker.getOidsToPoll).not.toContain(OID_A)
		})
	})

	// -------------------------------------------------------------------------
	// updateFeedback
	// -------------------------------------------------------------------------

	describe('updateFeedback', () => {
		it('moves a feedback to the new OID', () => {
			tracker.addFeedback('fb1', OID_A, false)
			tracker.updateFeedback('fb1', OID_B, false)

			expect(tracker.getOidForFeedback('fb1')).toBe(OID_B)
			expect(tracker.getFeedbacksForOid(OID_A).has('fb1')).toBe(false)
			expect(tracker.getFeedbacksForOid(OID_B).has('fb1')).toBe(true)
		})

		it('updates poll group membership', () => {
			tracker.addFeedback('fb1', OID_A, true)
			tracker.updateFeedback('fb1', OID_B, false)

			expect(tracker.getOidsToPoll).not.toContain(OID_A)
			expect(tracker.getOidsToPoll).not.toContain(OID_B)
		})
	})

	// -------------------------------------------------------------------------
	// removeFeedback
	// -------------------------------------------------------------------------

	describe('removeFeedback', () => {
		it('removes a feedback from tracking', () => {
			tracker.addFeedback('fb1', OID_A, false)
			tracker.removeFeedback('fb1')

			expect(tracker.getOidForFeedback('fb1')).toBeUndefined()
			expect(tracker.getFeedbacksForOid(OID_A).has('fb1')).toBe(false)
		})

		it('decrements the feedback count', () => {
			tracker.addFeedback('fb1', OID_A, false)
			tracker.addFeedback('fb2', OID_A, false)
			tracker.removeFeedback('fb1')

			expect(tracker.getFeedbackCount()).toBe(1)
		})

		it('removes the OID entry when the last watcher is removed', () => {
			tracker.addFeedback('fb1', OID_A, false)
			tracker.removeFeedback('fb1')

			expect(tracker.getAllWatchedOids()).not.toContain(OID_A)
			expect(tracker.hasWatchersForOid(OID_A)).toBe(false)
		})

		it('does not remove other feedbacks watching the same OID', () => {
			tracker.addFeedback('fb1', OID_A, false)
			tracker.addFeedback('fb2', OID_A, false)
			tracker.removeFeedback('fb1')

			expect(tracker.getFeedbacksForOid(OID_A).has('fb2')).toBe(true)
		})

		it('removes from poll group on removal', () => {
			tracker.addFeedback('fb1', OID_A, true)
			tracker.removeFeedback('fb1')

			expect(tracker.getOidsToPoll).not.toContain(OID_A)
		})

		it('is a no-op for an unknown feedback ID', () => {
			expect(() => tracker.removeFeedback('nonexistent')).not.toThrow()
		})
	})

	// -------------------------------------------------------------------------
	// getFeedbacksForOid
	// -------------------------------------------------------------------------

	describe('getFeedbacksForOid', () => {
		it('returns an empty set for an untracked OID', () => {
			expect(tracker.getFeedbacksForOid(OID_A).size).toBe(0)
		})

		it('returns all feedbacks watching the OID', () => {
			tracker.addFeedback('fb1', OID_A, false)
			tracker.addFeedback('fb2', OID_A, false)
			tracker.addFeedback('fb3', OID_B, false)

			const result = tracker.getFeedbacksForOid(OID_A)
			expect(result.size).toBe(2)
			expect(result.has('fb1')).toBe(true)
			expect(result.has('fb2')).toBe(true)
			expect(result.has('fb3')).toBe(false)
		})
	})

	// -------------------------------------------------------------------------
	// getOidForFeedback
	// -------------------------------------------------------------------------

	describe('getOidForFeedback', () => {
		it('returns the correct OID for a registered feedback', () => {
			tracker.addFeedback('fb1', OID_A, false)
			expect(tracker.getOidForFeedback('fb1')).toBe(OID_A)
		})

		it('returns undefined for an unregistered feedback', () => {
			expect(tracker.getOidForFeedback('unknown')).toBeUndefined()
		})
	})

	// -------------------------------------------------------------------------
	// hasWatchersForOid
	// -------------------------------------------------------------------------

	describe('hasWatchersForOid', () => {
		it('returns false for an untracked OID', () => {
			expect(tracker.hasWatchersForOid(OID_A)).toBe(false)
		})

		it('returns true when at least one feedback watches the OID', () => {
			tracker.addFeedback('fb1', OID_A, false)
			expect(tracker.hasWatchersForOid(OID_A)).toBe(true)
		})

		it('returns false after all watchers are removed', () => {
			tracker.addFeedback('fb1', OID_A, false)
			tracker.removeFeedback('fb1')
			expect(tracker.hasWatchersForOid(OID_A)).toBe(false)
		})
	})

	// -------------------------------------------------------------------------
	// getAllWatchedOids
	// -------------------------------------------------------------------------

	describe('getAllWatchedOids', () => {
		it('returns an empty array when nothing is tracked', () => {
			expect(tracker.getAllWatchedOids()).toEqual([])
		})

		it('returns all OIDs with at least one watcher', () => {
			tracker.addFeedback('fb1', OID_A, false)
			tracker.addFeedback('fb2', OID_B, false)
			tracker.addFeedback('fb3', OID_B, false)

			const oids = tracker.getAllWatchedOids()
			expect(oids).toContain(OID_A)
			expect(oids).toContain(OID_B)
			expect(oids).toHaveLength(2)
		})

		it('does not include an OID after its last watcher is removed', () => {
			tracker.addFeedback('fb1', OID_A, false)
			tracker.addFeedback('fb2', OID_B, false)
			tracker.removeFeedback('fb1')

			expect(tracker.getAllWatchedOids()).not.toContain(OID_A)
		})
	})

	// -------------------------------------------------------------------------
	// getFeedbackCount
	// -------------------------------------------------------------------------

	describe('getFeedbackCount', () => {
		it('returns 0 when nothing is tracked', () => {
			expect(tracker.getFeedbackCount()).toBe(0)
		})

		it('increments with each added feedback', () => {
			tracker.addFeedback('fb1', OID_A, false)
			tracker.addFeedback('fb2', OID_B, false)
			expect(tracker.getFeedbackCount()).toBe(2)
		})

		it('decrements when a feedback is removed', () => {
			tracker.addFeedback('fb1', OID_A, false)
			tracker.addFeedback('fb2', OID_B, false)
			tracker.removeFeedback('fb1')
			expect(tracker.getFeedbackCount()).toBe(1)
		})

		it('does not double-count when a feedback is re-registered', () => {
			tracker.addFeedback('fb1', OID_A, false)
			tracker.addFeedback('fb1', OID_B, false)
			expect(tracker.getFeedbackCount()).toBe(1)
		})
	})

	// -------------------------------------------------------------------------
	// getFeedbackIdsForOid
	// -------------------------------------------------------------------------

	describe('getFeedbackIdsForOid', () => {
		it('returns an empty array for an untracked OID', () => {
			expect(tracker.getFeedbackIdsForOid(OID_A)).toEqual([])
		})

		it('returns an array of all feedback IDs for the OID', () => {
			tracker.addFeedback('fb1', OID_A, false)
			tracker.addFeedback('fb2', OID_A, false)

			const ids = tracker.getFeedbackIdsForOid(OID_A)
			expect(ids).toHaveLength(2)
			expect(ids).toContain('fb1')
			expect(ids).toContain('fb2')
		})
	})

	// -------------------------------------------------------------------------
	// clear
	// -------------------------------------------------------------------------

	describe('clear', () => {
		it('removes all tracked feedbacks and OIDs', () => {
			tracker.addFeedback('fb1', OID_A, false)
			tracker.addFeedback('fb2', OID_B, false)
			tracker.clear()

			expect(tracker.getFeedbackCount()).toBe(0)
			expect(tracker.getAllWatchedOids()).toEqual([])
		})

		it('is safe to call on an empty tracker', () => {
			expect(() => tracker.clear()).not.toThrow()
		})
	})

	// -------------------------------------------------------------------------
	// addToPollGroup / removeFromPollGroup / getOidsToPoll
	// -------------------------------------------------------------------------

	describe('poll group', () => {
		it('adds an OID to the poll list', () => {
			tracker.addToPollGroup(OID_A, 'fb1')
			expect(tracker.getOidsToPoll).toContain(OID_A)
		})

		it('removes an OID from the poll list when the last member is removed', () => {
			tracker.addToPollGroup(OID_A, 'fb1')
			tracker.removeFromPollGroup(OID_A, 'fb1')
			expect(tracker.getOidsToPoll).not.toContain(OID_A)
		})

		it('keeps the OID in the poll list when other members still exist', () => {
			tracker.addToPollGroup(OID_A, 'fb1')
			tracker.addToPollGroup(OID_A, 'fb2')
			tracker.removeFromPollGroup(OID_A, 'fb1')
			expect(tracker.getOidsToPoll).toContain(OID_A)
		})

		it('throws on an invalid OID in addToPollGroup', () => {
			expect(() => tracker.addToPollGroup('bad-oid', 'fb1')).toThrow(/Invalid OID/)
		})

		it('strips leading dots from OIDs added to the poll group', () => {
			tracker.addToPollGroup(`.${OID_A}`, 'fb1')
			expect(tracker.getOidsToPoll).toContain(OID_A)
		})

		it('is safe to removeFromPollGroup for an OID that was never added', () => {
			expect(() => tracker.removeFromPollGroup(OID_C, 'fb1')).not.toThrow()
		})

		it('tracks multiple OIDs independently in the poll group', () => {
			tracker.addToPollGroup(OID_A, 'fb1')
			tracker.addToPollGroup(OID_B, 'fb2')
			tracker.removeFromPollGroup(OID_A, 'fb1')

			expect(tracker.getOidsToPoll).not.toContain(OID_A)
			expect(tracker.getOidsToPoll).toContain(OID_B)
		})
	})

	it('stores the full ID string as a single set member, not individual characters', () => {
		tracker.addToPollGroup(OID_A, 'fb1')
		tracker.removeFromPollGroup(OID_A, 'fb1')
		// If the bug is present, OID_A will still be in the poll list
		// because 'fb1' was never actually added as a member
		expect(tracker.getOidsToPoll).not.toContain(OID_A)
	})

	// -------------------------------------------------------------------------
	// Integration: combined scenarios
	// -------------------------------------------------------------------------

	describe('integration', () => {
		it('correctly tracks multiple feedbacks across multiple OIDs', () => {
			tracker.addFeedback('fb1', OID_A, false)
			tracker.addFeedback('fb2', OID_A, false)
			tracker.addFeedback('fb3', OID_B, false)
			tracker.addFeedback('fb4', OID_C, true)

			expect(tracker.getFeedbackCount()).toBe(4)
			expect(tracker.getAllWatchedOids()).toHaveLength(3)
			expect(tracker.getOidsToPoll).toContain(OID_C)
			expect(tracker.getOidsToPoll).not.toContain(OID_A)
		})

		it('leaves other OIDs intact when one OID loses all its watchers', () => {
			tracker.addFeedback('fb1', OID_A, false)
			tracker.addFeedback('fb2', OID_B, false)
			tracker.removeFeedback('fb1')

			expect(tracker.hasWatchersForOid(OID_B)).toBe(true)
			expect(tracker.getFeedbackCount()).toBe(1)
		})

		it('re-registers a feedback without affecting unrelated feedbacks', () => {
			tracker.addFeedback('fb1', OID_A, false)
			tracker.addFeedback('fb2', OID_A, false)
			tracker.updateFeedback('fb1', OID_B, false)

			expect(tracker.getFeedbacksForOid(OID_A).has('fb2')).toBe(true)
			expect(tracker.getFeedbacksForOid(OID_A).size).toBe(1)
			expect(tracker.getFeedbacksForOid(OID_B).has('fb1')).toBe(true)
		})
	})
})
