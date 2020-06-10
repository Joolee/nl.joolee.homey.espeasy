'use strict';

const SensorDriver = require('/lib/SensorDriver.js');
const Homey = require('homey');

module.exports = class Sensor_Switch extends SensorDriver {
	onInit() {
		this.taskTypes = [
			{
				"name": 'Communication - P1 Wifi Gateway',
				"plugin": 44
			}
		]

		this.values = [
		]

		super.onInit();
	}
}