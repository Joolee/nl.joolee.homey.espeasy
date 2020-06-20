'use strict';

const Homey = require('homey');

module.exports = class GeneralDevice extends Homey.Device {
	onInit() {
		this.setUnavailable(Homey.__("waiting_for_unit"));

		this.setAvailable = this.setAvailable.bind(this);
		this.setUnavailable = this.setUnavailable.bind(this);
		this._onUnitUpdate = this._onUnitUpdate.bind(this);
		this.onUnitStateChange = this.onUnitStateChange.bind(this);

		this.migrateCapability("custom_heartbeat", "device_heartbeat");

		this.unit = Homey.app.units.getUnit(
			this.getData().mac,
			this.getSetting('host').split(':').shift(),
			this.getSetting('host').split(':').pop()
		);

		this.unit.on('settingsUpdate', this._onUnitUpdate);
		this.unit.on('stateChange', this.onUnitStateChange);
	}

	onDeleted() {
		this.unit.removeListener('settingsUpdate', this._onUnitUpdate);
		this.unit.removeListener('stateChange', this.onUnitStateChange);
	}

	updateHeartbeat() {
		if (this.getCapabilities().includes("device_heartbeat")) {
			this.setCapabilityValue("device_heartbeat", new Date().toLocaleString());
		}
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
		if (this.getCapabilities().includes(oldCapability)) {
			this.log("Migrate capability", oldCapability, newCapability);
			this.removeCapability(oldCapability);
			this.addCapability(newCapability);
		}
	}
}