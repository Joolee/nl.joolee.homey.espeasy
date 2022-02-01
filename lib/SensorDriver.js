'use strict';

const GeneralDriver = require('/lib/GeneralDriver.js');
const Homey = require('homey');

module.exports = class SensorDriver extends GeneralDriver {
	onInit() {
		super.onInit();
	}

	isValidTask(task) {
		return this.taskTypes.find(type => type.name == task.Type);
	}

	getDefaultCapabilities() {
		return this.getManifest().capabilities;
	}

	getFullTaskValue(valName) {
		let fullValue = this.values.find(val => val.name == valName);

		if (!fullValue) {
			this.error(`Could not find value ${valName} in this.values in driver.js`);
			throw new Error(`Unable to find value definition for ${valName}`);
		}

		return fullValue;
	}

	getTaskValues(task, variant = null) {
		const type = this.taskTypes.find(tt => tt.name == task.Type);

		this.log(`Device matches type ${type.name} ${type.values.length} values`);

		// Override this.values order/picks per device type
		if (type.values) {
			return type.values.map(this.getFullTaskValue, this);
		}
		// Override this.values order/picks in device variants
		else if (type.variants && variant) {
			return type.variants[variant].values.map(this.getFullTaskValue, this);
		}
		// Just return default values
		else {
			return this.values;
		}
	}

	onPair(socket) {
		socket.on('list_devices', (data, callback) => {
			let unitsTodo = Homey.app.units.units.length;
			this.tasks = [];
			Homey.app.units.listOnline().forEach(unit => {
				unit.updateJSON(false, (error, unit) => {
					if (error) {
						this.log(`No tasks from ${unit.name}: ${error}`);
						return;
					}

					const newTasks = unit.getFreeTasks().filter(task => this.isValidTask(task));

					this.tasks.push(...newTasks.map(task => {
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
							this.error(`Failed to enumerate extra capabilities from driver.js for task ${task.TaskName}: ${error}`);
							callback(new Error(`Failed to enumerate value types for task ${task.TaskName}`));
						}

						if (capabilities)
							device.data.capabilities = capabilities;

						const type = this.taskTypes.find(tt => tt.name == task.Type);
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

					}));

					// No more units?
					if (--unitsTodo) {
						socket.emit('list_devices', this.tasks);
					} else {
						callback(null, this.tasks);
					}
				})
			});
		});
	}
}