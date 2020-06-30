'use strict';

const Homey = require('homey');
const HomeyLib = require('homey-lib');
const GeneralDevice = require('/lib/GeneralDevice.js');

module.exports = class SensorDevice extends GeneralDevice {
	onInit() {
		super.onInit();

		this.onJSONUpdate = this.onJSONUpdate.bind(this);
		this.onEvent = this.onEvent.bind(this);

		this.unit.addSensor(this);
		this.unit.on("jsonUpdate", this.onJSONUpdate)
		this.unit.on("event", this.onEvent)
		this.log("Init:", this.unit.name, this.constructor.name, this.idx);

		if (this.unit.online)
			this.onJSONUpdate();
	}

	get idx() {
		return this.getSetting('taskIDX');
	}

	get controller() {
		return this.getSetting('controller');
	}

	onSettings(oldSettings, newSettings, changedKeys, callback) {
		this.unit.updateJSON();
		callback();
	}

	onDeleted() {
		super.onDeleted();
		this.log("Sensor deleted", this.unit.name, this.constructor.name, this.idx);
		this.unit.removeListener('jsonUpdate', this.onJSONUpdate);
		this.unit.removeListener('event', this.onEvent);
		this.unit.deleteSensor(this);
	}

	onEvent(unit, task, key, value) {
		if (this.task && this.task.TaskName == task) {
			this.updateHeartbeat();
			this.setValue(key, value);
		}
	}

	onJSONUpdate() {
		this._taskCache = null;

		if (this.task) {
			if (this.task.controller.duplicate) {
				this.log("Controller task has duplicate IDX", this.controller, this.idx, this.task);
				this.setUnavailable(Homey.__("sensor.duplicate_idx", {
					"controller": this.controller,
					"idx": this.idx
				}));
			} else if (!this.getDriver().isValidTask(this.task)) {
				this.log("Controller task is invalid device type", this.controller, this.idx, this.task);
				this.setUnavailable(Homey.__("sensor.invalid_task", {
					"controller": this.controller,
					"idx": this.idx,
					"type": this.task.Type
				}));
			} else {
				this.setAvailable();
				this.updateHeartbeat();
				this.valuesFromJson();
			}
		} else {
			this.log("Controller missing task for this sensor", this.controller, this.idx, this.unit.tasks);
			this.setUnavailable(Homey.__("sensor.task_not_found", {
				"controller": this.controller,
				"idx": this.idx
			}));
		}
	}

	valuesFromJson() {
		this.task.TaskValues.forEach(value => {
			this.setValue(value.Name, value.Value);
		});
	}

	setValue(key, value) {
		const taskValue = this.task.TaskValues.find(t => t.Name == key);
		if (!taskValue) {
			this.log('Could not find task value named', key);
			return false;
		}

		const taskSettings = this.getDriver().taskTypes.find(t => t.name == this.task.Type);
		if (!taskSettings) {
			this.log('No settings found for this task', key);
			return false;
		}

		let capabilityName = null;
		if (taskSettings.values) {
			capabilityName = taskSettings.values[taskValue.ValueNumber - 1];
		} else if (taskSettings.variants) {
			const variant = this.getSetting("variant");
			capabilityName = taskSettings.variants[variant].values[taskValue.ValueNumber - 1];
		} else {
			capabilityName = this.getDriver().values[0].name;
		}

		const capabilitySettings = this.getDriver().values.find(v => v.name == capabilityName);
		if (!capabilitySettings) {
			this.log('No capability configured for value', key);
			return false;
		}

		if (typeof (capabilitySettings.validate) == "function") {
			const response = capabilitySettings.validate(taskValue, value);
			if (typeof (response) == "string") {
				this.log("Value did not validate:", value, response);
				this.setUnavailable(response);
				return false;
			} else if (!response) {
				this.log("Value did not validate:", value);
				this.setUnavailable("Invalid value received");
				return false;
			}
		}

		let capability = capabilitySettings.capability;
		if (typeof (capability) == "function") {
			capability = this.getSetting('capability-' + (taskValue.ValueNumber - 1));
		}

		const capabilityProperties = HomeyLib.getCapability(capability);
		switch (capabilityProperties.type) {
			case "boolean": {
				value = value == 1;
			} break;

			case "number": {
				value = Number(value);
				if (this.getCapabilities().includes("measure_raw_number")) {
					this.setCapabilityValue("measure_raw_number", value);
				}
			} break;
		}

		if (typeof (capabilitySettings.modifier) == "function") {
			value = capabilitySettings.modifier.call(this, value);
		}

		if (value == "nan") {
			this.log(`Got invalid value for '${key}' (${capability}): nan`);
			value = null;
		}

		const oldValue = this.getCapabilityValue(capability);
		if (oldValue != value) {
			this.log(`Value '${key}' (${capability}) set from ${oldValue} to ${value}`)
			this.setCapabilityValue(capability, value)
				.catch((...args) => {
					if (args[0].message && args[0].message == "invalid_type") {
						this.log(`Invalid value type for capability '${capability}'. Got value '${value}' (${typeof value}) but expected type ${capabilityProperties.type}`);
					} else {
						args.push(capability, value);
						this.log.apply(this, args);
					}
				});
		}
	}

	get task() {
		if (!this._taskCache) {
			if (!this.unit.tasks) {
				this.log("Unit does not contain any tasks");
				this._taskCache = null;
			} else {
				this._taskCache = this.unit.tasks.find(task =>
					task.DataAcquisition.some(con => con.Controller == this.controller && con.IDX == this.idx)
				);
				if (this._taskCache) {
					this._taskCache.controller = this._taskCache.DataAcquisition.find(con => con.Controller == this.controller && con.IDX == this.idx);
				}
			}
		}

		return this._taskCache;
	}
}