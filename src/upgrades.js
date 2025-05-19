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
	function v210(_context, props) {
		const result = {
			updatedActions: [],
			updatedConfig: null,
			updatedFeedbacks: [],
		}
		if (props.config !== null) {
			let config = props.config
			if (config.interval == undefined || config.interval == null) {
				config.interval = 0
				result.updatedConfig = config
			}
		}

		return result
	},
	function v220(_context, props) {
		const result = {
			updatedActions: [],
			updatedConfig: null,
			updatedFeedbacks: [],
		}
		for (const action of props.actions) {
			if (action.actionId === 'getOID') {
				action.displaystring ??= false
				result.updatedActions.push(action)
			}
		}
		if (props.config !== null) {
			let config = props.config
			if (config.verbose == undefined || config.verbose == null) {
				config.verbose = false
				result.updatedConfig = config
			}
		}

		return result
	},
]
