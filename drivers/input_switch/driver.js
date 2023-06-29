'use strict';

const SensorDriver = require('../../lib/SensorDriver.js');
const Homey = require('homey');

module.exports = class Input_Switch_Driver extends SensorDriver {
	taskTypes = [{
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
	];

	onInit() {
		this.addTriggerFlow("switch_long_press");
		this.addTriggerFlow("switch_double_click");

		this.values = [{
			"name": "State",
			"capability": cap =>
				!cap.setable && cap.getable && cap.type == "boolean",
			"validate": (taskVal, value) => {
				value = Number(value);
				if (value == -1)
					return this.homey.__("sensor.io_board_offline")
				else if ([0, 1, 3, 10, 11].includes(value))
					return true;
				else
					return false;
			},
			// Use full blown function because I need "this" from it's caller
			"modifier": function(value, rawValue, oldValue, capability) {
				switch (Number(rawValue)) {
					case 10:
					case 11:
						// Handle long click
						this.driver.triggerFlow(this, "switch_long_press", {
							"switch_event": rawValue
						});
						return null;

					case 3:
						// Handle doubleclick
						this.driver.triggerFlow(this, "switch_double_click");
						return null;

					case 1:
					case 0:
						// Normal state change
						return this.getSetting('invert') ? !value : value;
					default:
						this.error('input_switch/driver.js switch default reached with values:', value, rawValue, oldValue, capability);
						return value;
				}
			}
		}]

		super.onInit();
	}
}
