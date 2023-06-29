'use strict';

const GeneralDriver = require('./GeneralDriver.js');
const Homey = require('homey');

module.exports = class SensorDriver extends GeneralDriver {
	onInit() {
		super.onInit();
	}

	isValidTask(task) {
		return this.taskTypes.find(type => type.name == task.normalizedType);
	}

	getDefaultCapabilities() {
		return this.manifest.capabilities;
	}

	getFullTaskValue(valName) {
		let fullValue = this.values.find(val => val.name == valName);

		if (!fullValue) {
			this.error(`Could not find value ${valName} in this.values in driver.js`);
			throw new Error(`Unable to find value definition for ${valName}`);
		}

		return fullValue;
	}

	getTaskValues(task) {
		const type = this.taskTypes.find(tt => tt.name == task.normalizedType);

		this.log(`Device matches type ${type.name}`);

		// Resolve and filter values to capabilities applicable for this device type
		if (type.values) {
			return type.values.map(this.getFullTaskValue, this);
		}
		// Probably variants. The client-side script will figure it out
		else {
			return this.values;
		}
	}

	getUnitTasks(unit) {
		const newTasks = unit.getFreeTasks().filter(task => this.isValidTask(task));

		return newTasks.map(task => {
			this.log(`Found task: ${unit.name} - ${task.TaskName}`);
			let device = {
				"name": `${task.TaskName} (${unit.name})`,
				"data": {
					"name": task.TaskName,
					"controllers": task.DataAcquisition,
					"taskid": task.TaskNumber,
					"unit": {
						"name": unit.name,
						"idx": unit.idx,
						"mac": unit.mac,
						"host": unit.hostname,
						"port": unit.port
					}
				}
			}

			let capabilities = this.getDefaultCapabilities().map(cap => ({
				"capabilities": cap
			}));

			try {
				this.getTaskValues(task).forEach((value, index) => {
					capabilities.push({
						"index": index,
						"name": value.name,
						"capabilities": this.expandCapabilities(value.capability, true)
					});
				});
			} catch (error) {
				this.error(`Failed parsing driver.js for task ${unit.name} - ${task.TaskName}: ${error}`);
				throw new Error(`Internal failure for task ${unit.name} - ${task.TaskName}`);
			}

			if (capabilities)
				device.data.capabilities = capabilities;

			const type = this.taskTypes.find(tt => tt.name == task.normalizedType);
			if (type.variants) {
				const taskNumValues = task.TaskValues.filter(value => value.Name != "").length;
				device.data.variants = Object.keys(type.variants).map(key => {
					let variant = type.variants[key];
					variant.key = key;
					variant.enabled = variant.numValues <= taskNumValues;
					return variant;
				});
				device.data.variantTitle = type.variantTitle;
			}

			return device;

		});
	}

	onPair(socket) {
		socket.on('list_devices', (data, callback) => {
			let unitsTodo = this.homey.app.units.getAll().length;
			let tasks = [];
			let errors = [];

			this.homey.app.units.getOnline().forEach(unit => {
				// Return cached results quickly
				try {
					tasks.push(...this.getUnitTasks(unit));
					socket.emit('list_devices', tasks);
				} catch (error) {
					errors.push(error);
				}

				// Fetch possible new devices from the unit
				// (This is an asynchronous call)
				unit.updateJSON(false, (error, unit) => {
					if (error) {
						this.log(`No tasks from ${unit.name}: ${error}`);
						errors.push(`No tasks from ${unit.name}: ${error}`);
					} else {
						try {
							tasks.push(...this.getUnitTasks(unit));
							socket.emit('list_devices', tasks);
						} catch (error) {
							errors.push(error);
						}
					}

					// When the last unit is done, return the callback
					if (!--unitsTodo) {

						// If any errors have been collected, now is the time to return them
						if (errors.length > 0) {
							// Return unique errors
							callback(new Error(errors.join('; ')), tasks);
						} else {
							callback(null, tasks);
						}

					}
				})
			});
		});
	}
}
