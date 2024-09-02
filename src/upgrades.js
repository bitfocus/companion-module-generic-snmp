import snmp from 'net-snmp'

export default [
	/*
	 * Place your upgrade scripts here
	 * Remember that once it has been added it cannot be removed!
	 */
	function pre200(_context, props) {
		const result = {
			updatedActions: [],
			updatedConfig: null,
			updatedFeedbacks: [],
		}

		for (const action of props.actions) {
			if (action.actionId === 'setNumber') {
				if (action.options.type === snmp.ObjectType.Counter32) {
					action.options.type = snmp.ObjectType.Counter
				}
				if (action.options.type === snmp.ObjectType.Gauge32) {
					action.options.type = snmp.ObjectType.Gauge
				}
				if (action.options.type === snmp.ObjectType.Unsigned32) {
					action.options.type = snmp.ObjectType.Gauge
				}
			}
			result.updatedActions.push(action)
		}
		return result
	},
]
