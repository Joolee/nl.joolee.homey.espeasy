'use strict';

const SensorDriver = require('../../lib/SensorDriver.js');
const Homey = require('homey');

module.exports = class Energy_Driver extends SensorDriver {
	taskTypes = [{
			"name": 'Energy (DC) - INA219',
			"plugin": 27,
			"values": ["Voltage", "Current", "Power"]
		},
		{
			"name": 'Energy (AC) - HLW8012/BL0937',
			"plugin": 76,
			"values": ["Voltage", "Current", "Power", "PowerFactor"]
		},
		{
			"name": 'Energy (AC) - CSE7766 (POW r2)',
			"plugin": 77,
			"values": ["Voltage", "Power", "Current", "Pulses"]
		},
		{
			"name": 'Energy (AC) - Eastron SDM120C/220T/230/630',
			"plugin": 78,
			"values": ["Voltage", "Current", "Power", "PowerFactor"]
		},
		{
			"name": 'Energy - AccuEnergy AcuDC24x',
			"plugin": 85,
			"values": ["Voltage", "Current", "Power", "PowerFactor"]
		}
	];

	onInit() {
		this.values = [{
				"name": "Voltage",
				"capability": "measure_voltage"
			},
			{
				"name": "Current",
				"capability": "measure_current"
			},
			{
				"name": "Power",
				"capability": "measure_power"
			},
			{
				"name": "PowerFactor",
				"capability": "measure_powerfactor"
			},
			{
				"name": "Pulses",
				"capability": "measure_unknown"
			}
		]

		super.onInit();
	}
}
