'use strict';

const GPIODevice = require('/lib/GPIODevice.js');

module.exports = class GPIO_Pulse_Device extends GPIODevice {

	initPin() {
		if (this.properties.commands.bool) {
			this.unit.sendCommand([
				this.properties.commands.bool,
				this.properties.pin,
				this.getSetting('invert') === true ? 1 : 0
			]);
		} else {
			this.log('Pin', pin.id, 'does not have boolean output capability! This is recommended for pin initialization.');
		}
	}

	set(newState, options = {}, callback = () => { }) {
		if (this.properties.commands.pulse) {
			let duration = this.getSetting('duration');
			let command = this.properties.commands.pulse;
			let state = this.getSetting('invert') === true ? 0 : 1;
			this.log('Pulse pin', this.id, 'for', duration, 'ms to', state ? "'on'" : "'off'");

			if (duration > 1000 && this.properties.commands.longpulsems)
				command = this.properties.commands.longpulsems;

			this.unit.sendCommand([
				command,
				this.properties.pin,
				state,
				duration
			], callback);
		} else {
			this.log('Pin', pin.id, 'does not have pulse output capability!');
		}
	}
}