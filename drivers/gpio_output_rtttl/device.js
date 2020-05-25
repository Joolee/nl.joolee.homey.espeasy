'use strict';

const GPIODevice = require('/lib/GPIODevice.js');

module.exports = class GPIO_RTTTL_Device extends GPIODevice {

	initPin() {
		if (this.properties.output.bool) {
			this.unit.sendCommand([
				this.properties.output.bool,
				this.properties.pin,
				0
			]);
		} else {
			this.log('Pin', pin.id, 'does not have boolean output capability! This is recommended for pin initialization.');
		}
	}

	set(newState, options = {}, callback = () => { }) {
		if (this.properties.output.rtttl) {
			let melody = this.getSetting('melody');
			this.log('Play RTTTL melody on pin', this.id);

			this.unit.sendCommand([
				this.properties.output.rtttl,
				this.properties.pin,
				melody
			], callback);
		} else {
			this.log('Pin', pin.id, 'does not have RTTTL output capability!');
		}
	}
}