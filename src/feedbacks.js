import { OidOption, DisplayStringOption } from './actions.js'

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
		options: [OidOption, DisplayStringOption, DivisorOption],
		callback: async (feedback, _context) => {
			self.oidTracker.updateFeedback(feedback.id, feedback.options.oid)
			if (!self.oidValues.has(feedback.options.oid)) {
				self.log('info', `Feedback OID not cached yet for ${feedback.id}, retrieving: ${feedback.options.oid}`)
				await self.getOid(feedback.options.oid, '', feedback.options.displaystring, null)
			}
			const value = self.oidValues.get(feedback.options.oid) ?? null
			if (typeof value == 'number') return value / feedback.options.div
			return value
		},
		subscribe: async (feedback, context) => {
			self.oidTracker.addFeedback(feedback.id, feedback.options.oid)
			await self.getOid(feedback.options.oid, '', feedback.options.displaystring, context)
		},
		learn: async (feedback, context) => {
			self.oidTracker.updateFeedback(feedback.id, feedback.options.oid)
			await self.getOid(feedback.options.oid, '', feedback.options.displaystring, context)
			return undefined
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
