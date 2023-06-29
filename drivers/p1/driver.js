'use strict';

const SensorDriver = require('../../lib/SensorDriver.js');
const Homey = require('homey');

module.exports = class P1_Driver extends SensorDriver {
	taskTypes = [{
		"name": 'Communication - P1 Wifi Gateway',
		"plugin": 44
	}];

	onInit() {
		this.values = []

		super.onInit();
	}
}
