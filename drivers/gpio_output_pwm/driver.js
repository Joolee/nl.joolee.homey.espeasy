'use strict';

const GPIODriver = require('../../lib/GPIODriver.js');

module.exports = class GPIO_PWM_Driver extends GPIODriver {
	onInit() {
		this.pinType = 'pwm';
		this.primaryCapability = 'dim';
		super.onInit();
	}

	isValidCapability(capability) {
		return capability.setable && capability.getable && capability.type == 'number';
	}
}
