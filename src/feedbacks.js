import { OidOption } from './actions.js'

const DivisorOption = {
	type: 'number',
	id: 'div',
	label: 'Scaling Divisor',
	default: 1,
	min: 1,
	step: 1,
	description:
		'If OID returns a number, value will be divided by this value. Ie use `100` to achieve 2 decimal precision. Does not work with Counter64 type VarBinds.',
}

/** @typedef {InstanceType<typeof import('./index.js').Generic_SNMP>} Generic_SNMP */

/**
 * @param {Generic_SNMP} self
 */

export default async function (self) {
	const feedbackDefs = {}
	feedbackDefs['getOID'] = {
		name: 'OID value',
		type: 'value',
		options: [OidOption, DivisorOption],
		callback: async (feedback, _context) => {
			self.oidTracker.updateFeedback(feedback.id, feedback.options.oid)
			if (!self.oidValues.has(feedback.options.oid)) {
				self.log('info', `Feedback OID not cached yet for ${feedback.id}, retrieving: ${feedback.options.oid}`)
				await self.getOid(feedback.options.oid)
			}
			const value = self.oidValues.get(feedback.options.oid) ?? null
			if (typeof value == 'number') return value / feedback.options.div
			return value
		},
		subscribe: async (feedback, _context) => {
			self.oidTracker.addFeedback(feedback.id, feedback.options.oid)
			self.pendingOids.add(feedback.options.oid)
			self.throttledBatchGet()
		},
		learn: async (feedback, _context) => {
			self.oidTracker.updateFeedback(feedback.id, feedback.options.oid)
			await self.getOid(feedback.options.oid)
			return undefined
		},
		unsubscrbe: (feedback) => {
			self.oidTracker.removeFeedback(feedback.id)
		},
	}

	feedbackDefs['getOIDKnown'] = {
		name: 'OID value (known OIDs)',
		type: 'value',
		options: [
			{
				type: 'dropdown',
				id: 'oid',
				label: 'OID',
				choices: self.getOidChoices(),
				default: self.getOidChoices()[0]?.id ?? '',
			},
			DivisorOption,
		],
		callback: async (feedback, _context) => {
			self.oidTracker.updateFeedback(feedback.id, feedback.options.oid)
			const value = self.oidValues.get(feedback.options.oid) ?? null
			if (typeof value == 'number') return value / feedback.options.div
			return value
		},
		subscribe: async (feedback, _context) => {
			self.oidTracker.addFeedback(feedback.id, feedback.options.oid)
			self.pendingOids.add(feedback.options.oid)
			self.throttledBatchGet()
		},
		unsubscrbe: (feedback) => {
			self.oidTracker.removeFeedback(feedback.id)
		},
	}

	feedbackDefs['listenOIDTrap'] = {
		name: 'OID Trap value',
		type: 'value',
		options: [OidOption, DivisorOption],
		callback: async (feedback, _context) => {
			self.oidTracker.updateFeedback(feedback.id, feedback.options.oid)
			const value = self.oidValues.get(feedback.options.oid) ?? null
			if (typeof value == 'number') return value / feedback.options.div
			return value
		},
		subscribe: async (feedback, _context) => {
			self.oidTracker.addFeedback(feedback.id, feedback.options.oid)
		},
		unsubscrbe: (feedback) => {
			self.oidTracker.removeFeedback(feedback.id)
		},
	}

	self.setFeedbackDefinitions(feedbackDefs)
}
