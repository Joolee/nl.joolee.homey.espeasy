'use strict';

const GPIODriver = require('../../lib/GPIODriver.js');

module.exports = class GPIO_Tone_Driver extends GPIODriver {
	onInit() {
		this.pinType = 'tone';
		this.primaryCapability = 'button';
		super.onInit();

		this.addActionFlow("send_custom_tone", "onActionCustomTone");
	}

	isValidCapability(capability) {
		return capability.setable && !capability.getable && capability.type == 'boolean';
	}
}
