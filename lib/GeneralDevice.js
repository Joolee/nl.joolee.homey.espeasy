'use strict';

const Homey = require('homey');

module.exports = class GeneralDevice extends Homey.Device {
	onInit() {
		this.setUnavailable(this.homey.__("waiting_for_unit"));

		this.setAvailable = this.setAvailable.bind(this);
		this.setUnavailable = this.setUnavailable.bind(this);
		this._onUnitUpdate = this._onUnitUpdate.bind(this);
		this.onUnitStateChange = this.onUnitStateChange.bind(this);
		this.updateUptime = this.updateUptime.bind(this);

		this.upgradeCapabilities();

		this.unit = this.homey.app.units.findUnit(
			this.getData().mac,
			this.getSetting('host').split(':').shift(),
			this.getSetting('host').split(':').pop()
		);

		this.unit.on('settingsUpdate', this._onUnitUpdate);
		this.unit.on('stateChange', this.onUnitStateChange);

		if (this.hasCapability("device_heartbeat")) {
			this.uptimeInterval = setInterval(this.updateUptime, 60000);
		}
	}

	updateTelemetry(reason, recurse) {
		try {
			let metrics = {
				"Task plugin": 'Unknown',
				"Task driver": this.getDriver().id,
			};

			this.homey.telemetry.send('Unknown', reason, 'device/unknown', metrics);
		} catch (error) {
			this.error('Error sending device telemetry:', error);
		}
	}


	upgradeCapabilities() {
		this.migrateCapability("custom_heartbeat", "device_heartbeat");

		if (this.hasCapability("device_heartbeat") && !this.hasCapability("measure_idle_time")) {
			this.addCapability("measure_idle_time")
				.catch(this.error.bind(this, `Error adding capability [measure_idle_time] for general device ${this.constructor.name}`));;
			this.setCapabilityOptions("device_heartbeat", {
					"preventInsights": true,
					"preventTag ": true
				})
				.catch(this.error.bind(this, `Error setting capability values [measure_uptime] for unit`));
		}
	}

	onDeleted() {
		this.updateTelemetry('Deleted');
		this.unit.removeListener('settingsUpdate', this._onUnitUpdate);
		this.unit.removeListener('stateChange', this.onUnitStateChange);
		if (this.uptimeInterval)
			clearInterval(this.uptimeInterval);
	}

	onAdded() {
		this.updateTelemetry('Added');
	}

	updateUptime() {
		if (!this.uptimeInterval)
			return;

		if (this.getAvailable()) {

			const idleTime = Math.floor((new Date().getTime() - this.lastEvent.getTime()) / 60);
			if (this.getCapabilityValue("measure_idle_time") != idleTime) {
				this.setCapabilityValue("device_heartbeat", this.lastEvent.toLocaleString())
					.catch(this.error.bind(this, `Error setting capability [device_heartbeat] value to '${this.lastEvent.toLocaleString()}' for general_device ${this.constructor.name}`));
				this.setCapabilityValue("measure_idle_time", idleTime)
					.catch(this.error.bind(this, `Error setting capability [measure_idle_time] value to '${idleTime}' for general_device ${this.constructor.name}`));
			}
		} else {
			this.setCapabilityValue("measure_idle_time", null)
				.catch(this.error.bind(this, `Error setting capability [measure_idle_time] value to 'null' for general_device ${this.constructor.name}`));
		}
	}

	updateHeartbeat() {
		this.lastEvent = new Date();
		this.updateUptime();
	}

	onUnitStateChange(unit, state) {
		state ? this.setAvailable() : this.setUnavailable(this.homey.__("waiting_for_unit"));
	}

	_onUnitUpdate(unit, newSettings) {
		this.setSettings({
			"host": newSettings.host + ":" + newSettings.port,
			"idx": newSettings.idx ? newSettings.idx.toString() : 'unknown'
		});
	}

	migrateCapability(oldCapability, newCapability) {
		if (this.hasCapability(oldCapability)) {
			this.log("Migrate capability", oldCapability, newCapability);
			this.removeCapability(oldCapability)
				.catch(this.error.bind(this, `Error removing old capability [${oldCapability}] for general device ${this.constructor.name}`));
			this.addCapability(newCapability)
				.catch(this.error.bind(this, `Error adding new capability [${newCapability}] for unit ${this.constructor.name}`));
		}
	}
}
