'use strict';

const GPIODriver = require('../../lib/GPIODriver.js');

module.exports = class GPIO_Pulse_Driver extends GPIODriver {
	onInit() {
		this.pinType = 'pulse';
		this.primaryCapability = 'button';
		super.onInit();

		this.addActionFlow("send_custom_pulse", "onActionCustomPulse");
	}

	isValidCapability(capability) {
		return capability.setable && !capability.getable && capability.type == 'boolean';
	}
}
