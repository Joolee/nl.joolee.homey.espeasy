'use strict';

const SensorDriver = require('/lib/SensorDriver.js');
const Homey = require('homey');

module.exports = class Sensor_Switch extends SensorDriver {
	onInit() {
		this.taskTypes = [
			{
				"name": "Switch input - Switch",
				"plugin": 1
			},
			{
				"name": "Switch input - MCP23017",
				"plugin": 9
			},
			{
				"name": "Switch input - PCF8574",
				"plugin": 19
			},
			{
				"name": "Generic - Dummy Device",
				"plugin": 33
			}
		]

		this.values = [
			{
				"name": "State",
				"capability": cap =>
					!cap.setable && cap.getable && cap.type == "boolean",
				"validate": (taskVal, value) => {
					if (value == -1)
						return Homey.__("sensor.io_board_offline")
					else
						return true;
				}
			}
		]

		super.onInit();
	}
}