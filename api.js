const Homey = require('homey');

module.exports = [
    {
      method: 'GET',
      path: '/',
      public: true,
      fn: (args, callback) => {
		try {
			if (Homey.app) {
				Homey.app.units.inbound(args.query, callback);
			} else {
				console.log('Event received but ignoring because app has not initialized yet');
			}
		} catch(error) {
			console.log("Could not process event", args, error);
		}
      }
    }
]