'use strict';

const SensorDriver = require('../../lib/SensorDriver.js');
const Homey = require('homey');

module.exports = class Gasses_Driver extends SensorDriver {
	taskTypes = [{
			"name": "Gases - CO2 MH-Z19",
			"plugin": 49,
			"values": ["CO2", "Temperature", "Unknown"]
		},
		{
			"name": "Gasses - SGP30 [TESTING]",
			"plugin": 83,
			"values": ["TVOC", "eCO2"]
		},
		{
			"name": "Gasses - SGP30",
			"plugin": 83,
			"values": ["TVOC", "eCO2"]
		},
		{
			"name": "Gases - CCS811 TVOC/eCO2",
			"plugin": 90,
			"values": ["TVOC", "eCO2"]
		},
		{
			"name": "Gases - CO2 Senseair",
			"plugin": 52,
			"values": ["CO2"]
		}
	];

	onInit() {
		this.values = [{
				"name": "Temperature",
				"capability": "measure_temperature"
			},
			{
				"name": "CO2",
				"capability": "measure_co2"
			},
			{
				"name": "TVOC",
				"capability": "measure_tvoc"
			},
			{
				"name": "eCO2",
				"capability": "measure_eco2"
			},
			{
				"name": "Unknown",
				"capability": "measure_unknown"
			}
		]

		super.onInit();
	}
}
