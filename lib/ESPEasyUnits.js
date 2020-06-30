const Homey = require('homey');
const ESPEasyUnit = require('./ESPEasyUnit.js');

module.exports = class ESPEasyUnits extends Homey.SimpleClass {
	constructor() {
		super();
		this.units = [];
		this.on('__log', Homey.app.log.bind(this, '[Units]'));
	}

	// Called from api.js
	inbound(args, callback) {
		if (args.m && args.i && args.x && args.t && args.k && args.v) {
			const event = {
				"mac": args.m,
				"ip": args.i,
				"idx": args.x,
				"task": args.t,
				"key": args.k,
				"value": args.v,
			}

			const unit = this.getUnit(event.mac, event.ip, 80, true);

			if (unit) {
				unit.newEvent(event);
				callback(null, { 'response': 'ok' });
			} else {
				this.log("Event for unknown unit", event);
				callback({ 'response': 'unknown unit' });
			}
		} else if (args.m && args.i && args.x && args.t && !args.k && args.v) {
			const message = `Invalid event from ${args.i}, task ${args.t} (${args.x}). Using empty key name!`;
			this.log(message);
			callback({ 'response': message });
		} else {
			this.log("Invalid event", args);
			callback({ 'response': 'invalid event. Need arguments: mac, id, ip, task , key and value' });
		}
	}

	listUnregistered() {
		return this.units.filter(unit => !unit.isRegistered() && unit.online);
	}

	listOnline() {
		return this.units.filter(unit => unit.online);
	}

	getUnit(mac, host = null, port = 80, autoInitialize = true, callback = () => { }) {
		let unit = null;

		// When changing ESP Easy IP, it might send this before rebooting
		if (host == "(IP unset)")
			host = null;

		if (mac) {
			unit = this.units.find(value => value.mac == mac);

			if (unit && host) {
				unit.tryHost(host);
			}
		}

		if (!unit && host) {
			unit = this.units.find(value => value.isHost(host, port));

			if (!unit && autoInitialize) {
				// Looking for new unit
				this.log('Initialising new unit', mac, host)
				const unit = new ESPEasyUnit(mac, host, port, (err, unit) => {
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
				this.log('Removing unit', unit.hostname);
				this.units.splice(i, 1);
				return
			}
		}
	}
}