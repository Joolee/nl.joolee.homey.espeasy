'use strict';

const GPIODevice = require('/lib/GPIODevice.js');

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

	set(newState, options = {}, callback = () => { }) {
		if (this.properties.commands.tone) {
			let duration = this.getSetting('duration');
			let frequency = this.getSetting('frequency');
			this.log('Play tone on pin', this.id, 'for', duration, 'ms on', frequency, 'hz');

			this.unit.sendCommand([
				this.properties.commands.tone,
				this.properties.pin,
				frequency,
				duration
			], callback);
		} else {
			this.log('Pin', pin.id, 'does not have tone output capability!');
		}
	}
}