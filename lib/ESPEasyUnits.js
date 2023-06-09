const Homey = require('homey');
const ESPEasyUnit = require('./ESPEasyUnit.js');

module.exports = class ESPEasyUnits extends Homey.SimpleClass {
	constructor(app) {
		super();
		this._units = [];
		this.app = app;
		this.on('__log', this.app.log.bind(this, `[${this.constructor.name}]`))
			.on('__error', this.app.error.bind(this, `[${this.constructor.name}]`));
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

			const unit = this.findUnit(event.mac, event.ip, 80, true);

			if (unit) {
				unit.emit('event', event);
				callback(null, {
					'response': 'ok'
				});
			} else {
				this.log("Event for unknown unit", event);
				callback({
					'response': 'unknown unit'
				});
			}
		} else if (args.m && args.i && args.x && args.t && !args.k && args.v) {
			const message = `Invalid event from ${args.i}, task ${args.t} (${args.x}). Using empty key name!`;
			this.log(message);
			callback({
				'response': message
			});
		} else {
			this.log("Invalid event", args);
			callback({
				'response': 'invalid event. Need arguments: mac, id, ip, task , key and value'
			});
		}
	}

	getAll() {
		return this._units;
	}

	getUnregistered() {
		return this._units.filter(unit => !unit.isRegistered() && unit.isOnline);
	}

	getOnline() {
		return this._units.filter(unit => unit.isOnline);
	}

	findUnit(mac, host = null, port = 80, autoInitialize = true, callback = () => {}) {
		let unit = null;

		// When changing ESP Easy IP, it might send this before rebooting
		if (["(IP unset)", "0.0.0.0"].includes(host))
			host = null;

		if (mac) {
			unit = this._units.find(value => value.mac == mac);

			if (unit && host) {
				unit.tryHost(host);
			}
		}

		if (!unit && host) {
			unit = this._units.find(value => value.isHost(host, port));

			if (!unit && autoInitialize) {
				// Looking for new unit
				this.log('Initialising new unit', mac, host)
				const unit = new ESPEasyUnit(mac, host, port, (err, unit) => {
					callback(err, unit, true);
				});
				this._units.push(unit);

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
		for (let i = 0; i < this._units.length; i++) {
			if (this._units[i] == unit) {
				this.log('Removing unit', unit.hostname);
				this._units.splice(i, 1);
				return
			}
		}
	}
}
