'use strict';

const SensorDevice = require('../../lib/SensorDevice.js');

module.exports = class Pulse_Counter_Device extends SensorDevice {
	onInit() {
		super.onInit();

		this.addRemoveTotalCapability = this.addRemoveTotalCapability.bind(this);

		// Events can be distributed before the 'total' capability is fully added, we should ignore those
		this.totalCapabilityResolved = false;
		this.addRemoveTotalCapability();
		this.setSettings({
			"set_total": 0
		});
	}

	onSettings({ oldSettings, newSettings, changedKeys, callback }) {
		if (changedKeys.includes("set_total")) {
			const capability = this.getSetting("capability-0");
			this.setCapabilityValue(capability, newSettings["set_total"])
				.catch(this.error.bind(this, `Error setting capability [${capability}] value to new total '${newSettings["set_total"]}' for pulse_counter`));

			const multiplier = Number(this.getSetting("value_multiplier"));
			const raw = newSettings["set_total"] / multiplier;
			this.setCapabilityValue("measure_raw_number", raw)
				.catch(this.error.bind(this, `Error setting capability [measure_raw_number] value to new total '${raw}' for pulse_counter`));

			this.log("Total value manually set to", newSettings["set_total"], raw);
		}

		if (changedKeys.includes("variant")) {
			this.totalCapabilityResolved = false;
			this.addRemoveTotalCapability(newSettings["variant"]);
		}
		super.onSettings(...arguments);

		this.setSettings({
			"set_total": 0
		});
	}

	addRemoveTotalCapability(variant = this.getSetting("variant")) {
		this.totalCapabilityResolved = false;
		const needsTotal = variant.includes('total');
		const hasTotal = this.hasCapability("measure_sensor_value");
		if (needsTotal && !hasTotal) {
			this.log("Adding capability 'measure_sensor_value'");
			this.addCapability("measure_sensor_value")
				.then(() => {
					this.totalCapabilityResolved = true;
				})
				.catch(this.error.bind(this, `Error adding capability [measure_sensor_value] for pulse_counter`));
		} else if (hasTotal && !needsTotal) {
			this.log("Removing capability 'measure_sensor_value'");
			this.removeCapability("measure_sensor_value")
				.then(() => {
					this.totalCapabilityResolved = true;
				})
				.catch(this.error.bind(this, `Error removing capability [measure_sensor_value] for pulse_counter`));
		} else {
			this.totalCapabilityResolved = true;
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

		if (variant.includes('total') && !this.totalCapabilityResolved) {
			this.log('Total capability not yet fully resolved. Ignoring this event');
			return;
		}

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
				this.setCapabilityValue("measure_sensor_value", total)
					.catch(this.error.bind(this, `Error setting capability [measure_sensor_value:1] value to '${total}' for pulse_counter`));
				break;

				// If I get delta's, only use totals when wanted
			case "delta_total-2":
			case "delta_total_time-2":
				this.setCapabilityValue("measure_sensor_value", Number(value))
					.catch(this.error.bind(this, `Error setting capability [measure_sensor_value:2] value to '${Number(value)}' for pulse_counter`));
				if (this.getSetting("use_totals") || !oldValue) {
					total = Number(value);
				}
				break;

			case "delta_total_time-3":
				// Ignore for now
				break;
		}

		if (total === null || value === undefined) {
			return;
		}

		if (total != this.getCapabilityValue("measure_raw_number")) {
			this.setCapabilityValue("measure_raw_number", total)
				.catch(this.error.bind(this, `Error setting capability [measure_raw_number] value to '${Number(value)}' for pulse_counter`));
		}

		value = Number(this.getSetting("value_multiplier")) * total;

		if (oldValue != value) {
			this.log(`Value '${key}' (${capability}) set from ${oldValue} to ${value} by ${key}, switch ${variant}-${taskValue.ValueNumber}`)
			this.setCapabilityValue(capability, value)
				.catch((...args) => {
					if (args[0].message && args[0].message == "invalid_type") {
						const capabilityProperties = this.homey.app.getCapability(capability);
						this.error(`Invalid value type for capability '${capability}'. Got value '${value}' (${typeof value}) but expected type ${capabilityProperties.type}`);
					} else {
						args.push(capability, value);
						this.error.apply(this, `Error setting capability [${capability}] value to ${value} for pulse_counter device`, args);
					}
				});
		}
	}
}
