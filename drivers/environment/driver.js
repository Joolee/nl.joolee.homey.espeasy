'use strict';

const SensorDriver = require('/lib/SensorDriver.js');
const Homey = require('homey');

module.exports = class Sensor_Switch extends SensorDriver {
	onInit() {
		this.taskTypes = [
			{
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
				"name": 'Environment - DHT11/12/22 SONOFF2301/7021',
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
			}
		]

		this.values = [
			{
				"name": "Temperature",
				"capability": "measure_temperature"
			},
			{
				"name": "Pressure",
				"capability": "measure_pressure"
			},
			{
				"name": "Humidity",
				"capability": "measure_humidity"
			}
		]

		super.onInit();
	}

	getValues(task) {
		const type = this.taskTypes.find(tt => tt.name == task.Type);
		return type.values.map(value => {
			return this.values.find(val => val.name == value)
		});
	}
}