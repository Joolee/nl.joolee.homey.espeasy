'use strict';

const SensorDriver = require('../../lib/SensorDriver.js');
const Homey = require('homey');

module.exports = class Distance_Driver extends SensorDriver {
	taskTypes = [{
			"name": 'Distance - VL53L1X (400cm)',
			"plugin": 113,
			"values": ["distance_cm"]
		},
		{
			"name": 'Position - HC-SR04, RCW-0001, etc.',
			"variantTitle": "Measuring unit",
			"plugin": 13,
			"variants": {
				"metric": {
					"name": "Metric units (cm)",
					"numValues": 1,
					"values": ["distance_cm"]
				},
				"imperial": {
					"name": "Imperial units (inch)",
					"numValues": 1,
					"values": ["distance_inch"]
				}
			}
		},
		{
			"name": 'Distance - VL53L0X (200cm)',
			"plugin": 110,
			"values": ["distance_cm"]
		}
	];

	onInit() {
		this.values = [{
				"name": "distance_cm",
				"capability": "measure_distance_cm"
			},
			{
				"name": "distance_inch",
				"capability": "measure_distance_inch"
			}
		]

		super.onInit();
	}
}
