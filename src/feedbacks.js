import { OidOption, DisplayStringOption } from './actions.js'

export default async function (self) {
	const feedbackDefs = {}
	feedbackDefs['getOID'] = {
		name: 'OID value',
		type: 'value',
		options: [OidOption, DisplayStringOption],
		callback: async (feedback, _context) => {
			self.oidTracker.updateFeedback(feedback.id, feedback.options.oid)
			if (!self.oidValues.has(feedback.options.oid)) {
				self.log('info', `Feedback OID not cached yet for ${feedback.id}, retrieving: ${feedback.options.oid}`)
				await self.getOid(feedback.options.oid, '', feedback.options.displaystring, null)
			}
			return self.oidValues.get(feedback.options.oid) ?? null
		},
		subscribe: async (feedback, context) => {
			self.oidTracker.addFeedback(feedback.id, feedback.options.oid)
			await self.getOid(feedback.options.oid, '', feedback.options.displaystring, context)
		},
		learn: async (feedback, context) => {
			self.oidTracker.addFeedback(feedback.id, feedback.options.oid)
			await self.getOid(feedback.options.oid, '', feedback.options.displaystring, context)
			return undefined
		},
		unsubscrbe: (feedback) => {
			self.oidTracker.removeFeedback(feedback.id)
		},
	}

	feedbackDefs['listenOIDTrap'] = {
		name: 'OID Trap Value',
		type: 'value',
		options: [OidOption],
		callback: async (feedback, _context) => {
			self.oidTracker.updateFeedback(feedback.id, feedback.options.oid)
			return self.oidValues.get(feedback.options.oid) ?? null
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
