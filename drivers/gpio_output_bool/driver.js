'use strict';

const GPIODriver = require('../../lib/GPIODriver.js');

module.exports = class GPIO_Bool_Driver extends GPIODriver {
	onInit() {
		this.pinType = 'bool';
		this.primaryCapability = 'onoff';
		super.onInit();
	}

	isValidCapability(capability) {
		return capability.setable && capability.getable && capability.type == 'boolean';
	}
}
