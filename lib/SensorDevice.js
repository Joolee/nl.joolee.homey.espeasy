'use strict';

const Homey = require('homey');
const GeneralDevice = require('/lib/GeneralDevice.js');

module.exports = class SensorDevice extends GeneralDevice {
	onInit() {
		super.onInit();

		this.removeAllListeners('__log').removeAllListeners('__error');
		this.on('__log', (...props) => {
			this.getDriver().log.bind(this, `[${this.unit.name}/${this.idx}]`)(...props);
		}).on('__error', (...props) => {
			this.getDriver().error.bind(this, `[${this.unit.name}/${this.idx}]`)(...props);
		});

		this.updateTelemetry = this.updateTelemetry.bind(this);

		this.onEvent = this.onEvent.bind(this);
		this.onJSONUpdate = this.onJSONUpdate.bind(this);
		this.unit.addSensor(this);
		this.unit.on("jsonUpdate", this.onJSONUpdate)
		this.unit.on("event", this.onEvent)
		this.log("Init:", this.unit.name, this.constructor.name, this.idx);

		if (this.unit.isOnline)
			this.onJSONUpdate();
	}

	updateTelemetry(reason, recurse) {
		try {
			if (!this.task) {
				return;
			}

			let metrics = {
				"Task plugin": `${this.task.TaskDeviceNumber} - ${this.task.Type.replace('/', '-')}`,
				"Task driver": this.getDriver().id,
			};

			// Get selectable capabilities from settings when applicable
			const settings = this.getSettings();
			const capabilities = Object.keys(settings).filter(key => key.slice(0, 11) == "capability-").map(key => settings[key]);
			if (capabilities.length > 0) {
				metrics["Task capabilities"] = capabilities.sort().join(', ')
			}

			Homey.app.telemetry.send('Sensor', reason, `/device/sensor/${metrics["Task driver"]}/${metrics["Task plugin"]}`, metrics);
		} catch (error) {
			this.error('Error sending sensor telemetry:', error);
		}
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

	onEvent(event) {
		if (this.task && this.task.TaskName == event.task) {
			this.updateHeartbeat();
			this.setValue(event.key, event.value, 'event');
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
			this.setValue(value.Name, value.Value, 'json');
		});
	}

	getValueInfo(task, key) {
		const taskValue = task.TaskValues.find(t => t.Name == key);
		if (!taskValue) {
			throw new Error('Could not find task value named', task, key);
		}

		const taskSettings = this.getDriver().taskTypes.find(t => t.name == task.normalizedType);
		if (!taskSettings) {
			throw new Error('No settings found for this task', task, key);
		}

		return [taskValue, taskSettings]
	}

	setValue(key, value, source = 'unknown') {
		if (value === undefined) {
			return;
		}

		try {
			const [taskValue, taskSettings] = this.getValueInfo(this.task, key);
		} catch (error) {
			this.log('Failed to process new value for task', error);
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
			this.log(`No capability configured for value ${key}, received from ${source}`, key);
			return false;
		}

		if (typeof(capabilitySettings.validate) == "function") {
			const response = capabilitySettings.validate(taskValue, value);
			if (typeof(response) == "string") {
				this.log(`Value ${value} from ${source} did not validate:`, response);
				this.setUnavailable(response);
				return false;
			} else if (!response) {
				this.log(`Value did not validate: ${value} from ${source}`);
				this.setUnavailable("Invalid value received");
				return false;
			}
		}

		let capability = capabilitySettings.capability;
		if (typeof(capability) == "function") {
			capability = this.getSetting('capability-' + (taskValue.ValueNumber - 1));
		}

		const capabilityProperties = Homey.app.getCapability(capability);
		const rawValue = value;
		switch (capabilityProperties.type) {
			case "boolean":
				value = value == 1;
				break;

			case "number":
				value = Number(value);
				if (this.hasCapability("measure_raw_number")) {
					this.setCapabilityValue("measure_raw_number", value)
						.catch(this.error.bind(this, `Error setting capability [measure_raw_number] value to '${value}' for sensor ${this.constructor.name}`));
				}
				break;
		}

		const oldValue = this.getCapabilityValue(capability);
		if (typeof(capabilitySettings.modifier) == "function") {
			value = capabilitySettings.modifier.call(this, value, rawValue, oldValue, capability);
		}

		if (value == "nan") {
			this.log(`Got invalid value for '${key}' (${capability}): nan from ${source}`);
			value = null;
		}

		if (value === null) {
			this.log(`Ignoring value '${key}' from ${source} (${capability}): null`);
		} else if (oldValue != value) {
			this.log(`Value '${key}' (${capability}) set by ${source} from ${oldValue} to ${value}`)
			this.setCapabilityValue(capability, value)
				.catch((...args) => {
					if (args[0].message && args[0].message == "invalid_type") {
						this.error(`Invalid value type for capability '${capability}'. Got value '${value}' (${typeof value}) from ${source} but expected type ${capabilityProperties.type} for ${this.constructor.name}`);
					} else {
						args.push(capability, value);
						this.error.apply(this, `Error setting capability [${capability}] value to ${value} for sensor device ${this.constructor.name}`, args);
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
