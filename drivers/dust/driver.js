'use strict';

const SensorDriver = require('/lib/SensorDriver.js');
const Homey = require('homey');

module.exports = class Environment_Driver extends SensorDriver {
	onInit() {
		this.taskTypes = [{
			"name": 'Dust - PMS5003',
			"plugin": 53,
			"values": ["pm1_0", "pm2_5", "pm10"]
		},
		{
			"name": 'Dust - PMSx003',
			"plugin": 53,
			"values": ["pm1_0", "pm2_5", "pm10"]
		},
		{
			"name": 'Dust - PMSx003 / PMSx003ST',
			"plugin": 53,
			"values": ["pm1_0", "pm2_5", "pm10"]
		},
		{
			"name": 'Dust - SDS011/018/198',
			"plugin": 56,
			"values": ["pm2_5", "pm10"]
		},
		{
			"name": 'Dust - Sharp GP2Y10',
			"plugin": 18,
			"values": ["dust"]
		}]

		this.values = [{
				"name": "pm1_0",
				"capability": "measure_pm1"
			},
			{
				"name": "pm2_5",
				"capability": "measure_pm25"
			},
			{
				"name": "pm10",
				"capability": "measure_pm10"
			},
			{
				"name": "dust",
				"capability": "measure_dust"
			}
		]

		super.onInit();
	}
}