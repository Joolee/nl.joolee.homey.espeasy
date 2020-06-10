'use strict';

const Homey = require('homey');

module.exports = class GeneralDevice extends Homey.Device {
	onInit() {
		this.setUnavailable(Homey.__("waiting_for_unit"));

		this.setAvailable = this.setAvailable.bind(this);
		this.setUnavailable = this.setUnavailable.bind(this);
		this._onUnitUpdate = this._onUnitUpdate.bind(this);
		this.onUnitStateChange = this.onUnitStateChange.bind(this);

		this.unit = Homey.app.units.getUnit(
			this.getData().mac,
			this.getSetting('host').split(':').shift(),
			this.getSetting('host').split(':').pop()
		);

		this.unit.on('settingsUpdate', this._onUnitUpdate);
		this.unit.on('stateChange', this.onUnitStateChange);
	}

	onDeleted() {
		this.unit.removeListener('settingsUpdate', this.onJSONUpdate);
		this.unit.removeListener('stateChange', this.onEvent);
	}

	updateHeartbeat() {
		if (this.getCapabilities().includes("custom_heartbeat")) {
			this.setCapabilityValue("custom_heartbeat", new Date().toLocaleString());
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
}