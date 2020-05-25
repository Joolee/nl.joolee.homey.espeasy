'use strict';

const GPIODriver = require('/lib/GPIODriver.js');

module.exports = class GPIO_RTTTL_Driver extends GPIODriver {
	onInit() {
		this.pinType = 'rtttl';
		this.primaryCapability = 'button';
		super.onInit();
	}

	isValidCapability(capability) {
		return capability.setable && !capability.getable && capability.type == 'boolean';
	}
}