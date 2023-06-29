'use strict';

const SensorDriver = require('../../lib/SensorDriver.js');
const Homey = require('homey');

module.exports = class Input_Analog_Driver extends SensorDriver {
	taskTypes = [{
			"name": "Analog input - internal",
			"plugin": 2
		},
		{
			"name": "Analog input - MCP3221",
			"plugin": 60
		},
		{
			"name": "Analog input - ADS1115",
			"plugin": 25
		},
		{
			"name": "Analog input - PCF8591",
			"plugin": 7
		},
		{
			"name": "Generic - Dummy Device",
			"plugin": 33,
		}
	];

	onInit() {
		this.values = [{
			"name": "Analog",
			"capability": cap =>
				!cap.setable && cap.getable && cap.type == "number",
			"modifier": function(value) {
				// Use full blown function because I need "this" from it's caller
				return Number(this.getSetting("value_multiplier")) * value
			}
		}]

		super.onInit();
	}
}
