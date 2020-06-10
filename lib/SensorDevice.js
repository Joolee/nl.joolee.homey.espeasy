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
		parent.onDeleted();
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

		const settings = this.getDriver().values[taskValue.ValueNumber - 1];
		if (!settings) {
			this.log('No capability configured for value', key);
			return false;
		}

		if (typeof (settings.validate) == "function") {
			const response = settings.validate(taskValue, value);
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

		let capability = settings.capability;
		if (typeof (capability) == "function") {
			capability = this.getSetting('capability-' + (taskValue.ValueNumber - 1));
		}

		const capabilityProperties = HomeyLib.getCapability(capability);
		if (capabilityProperties.type == 'boolean') {
			value = value == 1;
		}

		const oldValue = this.getCapabilityValue(capability);
		if (oldValue != value) {
			this.log(`Value '${key}' (${capability}) set from ${oldValue} to ${value}`)
			this.setCapabilityValue(capability, value);
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