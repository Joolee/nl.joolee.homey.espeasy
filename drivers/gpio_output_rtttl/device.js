'use strict';

const GPIODevice = require('../../lib/GPIODevice.js');
const util = require('util');

module.exports = class GPIO_RTTTL_Device extends GPIODevice {

	initPin() {
		if (this.properties.commands.bool) {
			this.unit.sendCommand([
				this.properties.commands.bool,
				this.properties.pin,
				0
			]);
		} else {
			this.log('Pin', pin.id, 'does not have boolean output capability! This is recommended for pin initialization.');
		}
	}

	set(newState, options = {}, callback = () => {}) {
		if (this.properties.commands.rtttl) {
			let melody = this.getSetting('melody');

			if (options.melody_string) {
				melody = options.melody_string;
			}

			this.log('Play RTTTL melody on pin', this.id);

			this.unit.sendCommand([
				this.properties.commands.rtttl,
				this.properties.pin,
				melody
			], false, callback);
		} else {
			this.log('Pin', pin.id, 'does not have RTTTL output capability!');
		}
	}

	async onActionCustomMelody(args) {
		this.log("Action custom melody:", args.melody_string);
		return util.promisify(this.set)(null, {
			"melody_string": args.melody_string
		});
	}
}
