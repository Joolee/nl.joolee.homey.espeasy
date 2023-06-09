module.exports = {
	async triggerEvent({homey, query}) {
		try {
			if (homey.app) {
				homey.app.units.inbound(args.query, callback);
			} else {
				console.log('Event received but ignoring because app has not initialized yet');
			}
		} catch (error) {
			console.log("Could not process event", args, error);
		}
	}	
}
