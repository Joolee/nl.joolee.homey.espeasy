'use strict';

const GPIODevice = require('../../lib/GPIODevice.js');

module.exports = class GPIO_PWM_Device extends GPIODevice {

	onPinUpdate(pinStatus) {
		// Current builds of ESP Easy always return '0' for PWM value so I can't use it
		// If you know a version where it works, let me know
		let homeyStatus = this.getCapabilityValue(this.capability);
		if (homeyStatus === null) {
			homeyStatus = 0;
		}
		this.set(homeyStatus, {
			'silent': true
		});
	}

	initPin() {
		this.onPinUpdate(null);
	}

	set(newState, options = {}, callback = () => {}) {
		// Normalize value to percentage
		let cap = this.capabilityProperties;
		newState = (newState - cap.min) / (cap.max - cap.min);

		if (!options.silent)
			this.log('PWM value for pin', this.id, 'changed:', newState);

		if (this.properties.commands.pwm) {
			this.unit.sendCommand([
				this.properties.commands.pwm,
				this.properties.pin,
				Math.round(newState * 1024)
			], !!options.silent, callback);
		} else {
			this.log('Pin', pin.id, 'does not have pwm output capability!');
		}
	}
}
