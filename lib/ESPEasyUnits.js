const Homey = require('homey');
const ESPEasyUnit = require('./ESPEasyUnit.js');

module.exports = class ESPEasyUnits {
	constructor() {
		this.units = [];
	}

	// Called from api.js
	inbound(args, callback) {
		if (args.m && args.i && args.x && args.t && args.k && args.v) {
			const unit = this.getUnit(args.m, args.i, 80, true);

			const event = {
				"mac": args.m,
				"ip": args.i,
				"idx": args.x,
				"task": args.t,
				"key": args.k,
				"value": args.v,
			}

			if (unit) {
				unit.newEvent(event);
				callback(null, { 'response': 'ok' });
			} else {
				Homey.app.log("Event for unknown unit", event);
				callback({ 'response': 'unknown unit' });
			}
		} else {
			Homey.app.log("Invalid event", args);
			callback({ 'response': 'invalid event. Need arguments: mac, id, ip, task , key and value' });
		}
	}

	listUnregistered() {
		return this.units.filter(unit => !unit.isRegistered() && unit.isOnline());
	}

	listOnline() {
		return this.units.filter(unit => unit.isOnline());
	}

	getUnit(mac, host = null, port = 80, autoInitialize = true, callback = () => { }) {
		let unit = null;

		if (mac) {
			unit = this.units.find(value => value.mac == mac);
		}

		if (!unit && host) {
			unit = this.units.find(value => value.isHost(host, port));

			if (!unit && autoInitialize) {
				// Looking for new unit
				Homey.app.log('Initialising new unit', host)
				const unit = new ESPEasyUnit(host, port, (err, unit) => {
					callback(err, unit, true);
				});
				this.units.push(unit);

				return unit;
			}
		}

		if (unit) {
			callback(null, unit, false);
			return unit;
		} else {
			return null;
		}
	}

	removeUnit(unit) {
		for (let i = 0; i < this.units.length; i++) {
			if (this.units[i] == unit) {
				Homey.app.log('Removing unit', unit.hostname);
				this.units.splice(i, 1);
				return
			}
		}
	}
}