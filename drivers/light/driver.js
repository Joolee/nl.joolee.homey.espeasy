'use strict';

const SensorDriver = require('../../lib/SensorDriver.js');
const Homey = require('homey');

module.exports = class Light_Driver extends SensorDriver {
	taskTypes = [{
			"name": 'Light/Lux - BH1750',
			"plugin": 10,
			"values": ["Lux"]
		},
		{
			"name": 'Light/Lux - TSL2561',
			"plugin": 15,
			"values": ["Lux", "Lux_Infrared", "Lux_Broadband"]
		},
		{
			"name": 'Light/Lux - TSL2591',
			"plugin": 74,
			"values": ["Lux", "Lux_Broadband", "Lux_Visible", "Lux_Infrared"]
		},
	];

	onInit() {
		this.values = [{
				"name": "Lux",
				"capability": "measure_luminance"
			},
			{
				"name": "Lux_Infrared",
				"capability": "measure_luminance_ir"
			},
			{
				"name": "Lux_Broadband",
				"capability": "measure_luminance_full"
			},
			{
				"name": "Lux_Visible",
				"capability": "measure_luminance_visible"
			}
		]

		super.onInit();
	}
}
