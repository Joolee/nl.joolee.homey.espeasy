'use strict';

const SensorDriver = require('../../lib/SensorDriver.js');
const Homey = require('homey');

module.exports = class Pulse_Counter_Driver extends SensorDriver {
	taskTypes = [{
		"name": "Generic - Pulse counter",
		"plugin": 3,
		"variantTitle": "Counter Type",
		"variants": {
			"delta": {
				"name": "Delta",
				"numValues": 1,
				"values": ["Total"]
			},
			"delta_total_time": {
				"name": "Delta / Total / Time",
				"numValues": 3,
				"values": ["Total"]
			},
			"total": {
				"name": "Total",
				"numValues": 1,
				"values": ["Total"]
			},
			"delta_total": {
				"name": "Delta / Total",
				"numValues": 2,
				"values": ["Total"]
			}
		}
	}];

	onInit() {
		this.values = [{
			"name": "Total",
			"capability": cap =>
				!cap.setable && cap.getable && cap.type == "number"
		}]

		super.onInit();
	}
}
