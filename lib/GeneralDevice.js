'use strict';

const Homey = require('homey');

module.exports = class GeneralDevice extends Homey.Device {
	onInit() {
		this.setUnavailable(Homey.__("waiting_for_unit"));

		this.setAvailable = this.setAvailable.bind(this);
		this.setUnavailable = this.setUnavailable.bind(this);
		this._onUnitUpdate = this._onUnitUpdate.bind(this);
		this.onUnitStateChange = this.onUnitStateChange.bind(this);
		this.updateUptime = this.updateUptime.bind(this);

		this.upgradeCapabilities();

		this.unit = Homey.app.units.getUnit(
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

	upgradeCapabilities() {
		this.migrateCapability("custom_heartbeat", "device_heartbeat");

		if (this.hasCapability("device_heartbeat") && !this.hasCapability("measure_idle_time")) {
			this.addCapability("measure_idle_time");
			this.setCapabilityOptions("device_heartbeat", {
				"preventInsights": true,
				"preventTag ": true
			});
		}
	}

	onDeleted() {
		this.unit.removeListener('settingsUpdate', this._onUnitUpdate);
		this.unit.removeListener('stateChange', this.onUnitStateChange);
		if (this.uptimeInterval)
			clearInterval(this.uptimeInterval);
	}

	updateUptime() {
		if (!this.uptimeInterval)
			return;

		if (this.getAvailable()) {

			const idleTime = Math.floor((new Date().getTime() - this.lastEvent.getTime()) / 60);
			if (this.getCapabilityValue("measure_idle_time") != idleTime) {
				this.setCapabilityValue("device_heartbeat", this.lastEvent.toLocaleString());
				this.setCapabilityValue("measure_idle_time", idleTime);
			}
		} else {
			this.setCapabilityValue("measure_idle_time", null);
		}
	}

	updateHeartbeat() {
		this.lastEvent = new Date();
		this.updateUptime();
	}

	onUnitStateChange(unit, state) {
		state ? this.setAvailable() : this.setUnavailable(Homey.__("waiting_for_unit"));
	}

	_onUnitUpdate(unit, newSettings) {
		this.setSettings({
			"host": newSettings.host + ":" + newSettings.port,
			"idx": newSettings.idx.toString()
		});
	}

	migrateCapability(oldCapability, newCapability) {
		if (this.hasCapability(oldCapability)) {
			this.log("Migrate capability", oldCapability, newCapability);
			this.removeCapability(oldCapability);
			this.addCapability(newCapability);
		}
	}
}
