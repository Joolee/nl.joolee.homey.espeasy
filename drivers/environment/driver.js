'use strict';

const SensorDriver = require('../../lib/SensorDriver.js');
const Homey = require('homey');

module.exports = class Environment_Driver extends SensorDriver {
	taskTypes = [{
			"name": 'Environment - BMP085/180',
			"plugin": 6,
			"values": ["Temperature", "Pressure"]
		},
		{
			"name": 'Environment - BMx280',
			"plugin": 28,
			"values": ["Temperature", "Humidity", "Pressure"]
		},
		{
			"name": 'Environment - DHT11/12/22  SONOFF2301/7021',
			"plugin": 5,
			"values": ["Temperature", "Humidity"]
		},
		{
			"name": 'Environment - DHT12 (I2C)',
			"plugin": 34,
			"values": ["Temperature", "Humidity"]
		},
		{
			"name": 'Environment - DS18b20',
			"plugin": 4,
			"values": ["Temperature"]
		},
		{
			"name": 'Environment - MLX90614',
			"plugin": 24,
			"values": ["Temperature"]
		},
		{
			"name": 'Environment - MS5611 (GY-63)',
			"plugin": 32,
			"values": ["Temperature", "Pressure"]
		},
		{
			"name": 'Environment - SHT1X',
			"plugin": 31,
			"values": ["Temperature", "Humidity"]
		},
		{
			"name": 'Environment - SI7021/HTU21D',
			"plugin": 14,
			"values": ["Temperature", "Humidity"]
		},
		{
			"name": 'Environment - Thermocouple',
			"plugin": 39,
			"values": ["Temperature"]
		},
		{
			"name": 'Environment - BME680',
			"plugin": 16,
			"values": ["Temperature", "Humidity", "Pressure", "TVOC"]
		},
		{
			"name": 'Environment - SHT30/31/35',
			"plugin": 68,
			"values": ["Temperature", "Humidity"]
		},
		{
			"name": "Generic - Dummy Device",
			"plugin": 33,
			"variantTitle": "Output Data Type",
			"variants": {
				"single_temp": {
					"name": "Single (Temperature)",
					"numValues": 1,
					"values": ["Temperature"]
				},
				"single_hum": {
					"name": "Single (Humidity)",
					"numValues": 1,
					"values": ["Humidity"]
				},
				"single_baro": {
					"name": "Single (Pressure)",
					"numValues": 1,
					"values": ["Pressure"]
				},
				"temp_hum": {
					"name": "Temp / Hum",
					"numValues": 2,
					"values": ["Temperature", "Humidity"]
				},
				"temp_baro": {
					"name": "Temp / Baro",
					"numValues": 2,
					"values": ["Temperature", "Pressure"]
				},
				"temp_hum_baro": {
					"name": "Temp / Hum / Baro",
					"numValues": 3,
					"values": ["Temperature", "Humidity", "Pressure"]
				}
			}
		}
	];

	onInit() {
		this.values = [{
				"name": "Temperature",
				"capability": "measure_temperature"
			},
			{
				"name": "Humidity",
				"capability": "measure_humidity"
			},
			{
				"name": "Pressure",
				"capability": "measure_pressure"
			},
			{
				"name": "TVOC",
				"capability": "measure_tvoc"
			}
		]

		super.onInit();
	}
}
