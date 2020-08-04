'use strict';

const SensorDevice = require('/lib/SensorDevice.js');

module.exports = class Pulse_Counter_Device extends SensorDevice {
	onInit() {
		super.onInit();

		this.addRemoveTotalCapability = this.addRemoveTotalCapability.bind(this);

		this.addRemoveTotalCapability();
		this.setSettings({
			"set_total": 0
		});
	}

	onSettings(oldSettings, newSettings, changedKeys, callback) {
		if (changedKeys.includes("set_total")) {
			const capability = this.getSetting("capability-0");
			this.setCapabilityValue(capability, newSettings["set_total"]);

			const multiplier = Number(this.getSetting("value_multiplier"));
			const raw = newSettings["set_total"] / multiplier;
			this.setCapabilityValue("measure_raw_number", raw);

			this.log("Total value manually set to", newSettings["set_total"], raw);
		}

		if (changedKeys.includes("variant")) {
			this.addRemoveTotalCapability(newSettings["variant"]);
		}
		super.onSettings(oldSettings, newSettings, changedKeys, callback);

		this.setSettings({
			"set_total": 0
		});
	}

	addRemoveTotalCapability(variant = this.getSetting("variant")) {
		const needsTotal = ["delta_total", "delta_total_time"].includes(variant);
		const hasTotal = this.getCapabilities().includes("measure_sensor_value");
		if (needsTotal && !hasTotal) {
			this.log("Adding capability 'measure_sensor_value'");
			this.addCapability("measure_sensor_value");
		} else if (hasTotal && !needsTotal) {
			this.log("Removing capability 'measure_sensor_value'");
			this.removeCapability("measure_sensor_value");
		}
	}

	// Override from parent
	setValue(key, value) {
		const [taskValue, taskSettings] = this.getValueInfo(this.task, key);
		const variant = this.getSetting("variant");
		const capability = this.getSetting("capability-0");
		const oldValue = this.getCapabilityValue(capability);
		const oldRaw = this.getCapabilityValue("measure_raw_number");
		let total = null;

		switch (variant + '-' + taskValue.ValueNumber) {
			// Getting only delta
			case "delta-1":
			case "delta_total-1":
			case "delta_total_time-1":
				total = oldRaw + Number(value);
				break;

			// Total is the only thing I get so work with it
			case "total-2":
				total = Number(value);
				this.setCapabilityValue("measure_sensor_value", total);
				break;

			// If I get delta's, only use totals when wanted
			case "delta_total-2":
			case "delta_total_time-2":
				this.setCapabilityValue("measure_sensor_value", Number(value));
				if (this.getSetting("use_totals") || !oldValue) {
					total = Number(value);
				}
				break;

			case "delta_total_time-3":
				// Ignore for now
				break;

			default:
				this.log("Ignoring" + variant + '-' + taskValue.ValueNumber, value);
				break;
		}

		if (total === null) {
			return;
		}

		if (total != this.getCapabilityValue("measure_raw_number")) {
			this.setCapabilityValue("measure_raw_number", total);
		}

		value = Number(this.getSetting("value_multiplier")) * total;

		if (oldValue != value) {
			this.log(`Value '${key}' (${capability}) set from ${oldValue} to ${value} by ${key}, switch ${variant}-${taskValue.ValueNumber}`)
			this.setCapabilityValue(capability, value)
				.catch((...args) => {
					if (args[0].message && args[0].message == "invalid_type") {
						const capabilityProperties = Homey.app.getCapability(capability);
						this.log(`Invalid value type for capability '${capability}'. Got value '${value}' (${typeof value}) but expected type ${capabilityProperties.type}`);
					} else {
						args.push(capability, value);
						this.log.apply(this, args);
					}
				});
		}
	}
}