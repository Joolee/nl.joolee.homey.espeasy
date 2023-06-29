'use strict';

const GPIODevice = require('../../lib/GPIODevice.js');

module.exports = class GPIO_Bool_Device extends GPIODevice {

	onPinUpdate(pinStatus) {
		let homeyStatus = !!this.getCapabilityValue(this.capability);

		if (this.getSetting('invert')) {
			homeyStatus = !homeyStatus;
		}

		if ((pinStatus.state === 1) != homeyStatus) {
			this.log('Pin', this.id, 'Updating state from ESP unit:', pinStatus.state);
			this.setCapabilityValue(
					this.capability,
					(pinStatus.state == 1),
					this.setAvailable
				)
				.catch(this.error.bind(this, `Error setting capability [${this.capability}] value to ${pinStatus.state == 1} for gpio_output_bool device`));;
		}

		if (!this.getAvailable()) {
			this.setAvailable();
		}
	}

	initPin() {
		let homeyStatus = !!this.getCapabilityValue(this.capability);
		this.set(homeyStatus);
	}

	set(newState, options = {}, callback = () => {}) {
		this.log('Turn pin', this.id, newState ? 'on' : 'off');

		if (this.getSetting('invert')) {
			newState = !newState;
		}

		if (this.properties.commands.bool) {
			this.unit.sendCommand([
				this.properties.commands.bool,
				this.properties.pin,
				newState === true ? 1 : 0
			], false, callback);
		} else {
			this.log('Pin', pin.id, 'does not have boolean output capability!');
		}
	}
}
