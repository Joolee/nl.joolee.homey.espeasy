'use strict';

const GPIODevice = require('../../lib/GPIODevice.js');
const util = require('util');

module.exports = class GPIO_Tone_Device extends GPIODevice {

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
		if (this.properties.commands.tone) {
			let duration = this.getSetting('duration');
			if (options.tone_duration) {
				duration = options.tone_duration;
			}

			let frequency = this.getSetting('frequency');
			if (options.tone_frequency) {
				frequency = options.tone_frequency;
			}

			this.log('Play tone on pin', this.id, 'for', duration, 'ms on', frequency, 'hz');

			this.unit.sendCommand([
				this.properties.commands.tone,
				this.properties.pin,
				frequency,
				duration
			], false, callback);
		} else {
			this.log('Pin', pin.id, 'does not have tone output capability!');
		}
	}

	async onActionCustomTone(args) {
		this.log("Action custom tone:", args.tone_duration, args.tone_frequency);
		return util.promisify(this.set)(null, {
			"tone_duration": args.tone_duration,
			"tone_frequency": args.tone_frequency
		});
	}
}
