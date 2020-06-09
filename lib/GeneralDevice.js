'use strict';

const Homey = require('homey');

module.exports = class GeneralDevice extends Homey.Device {
	onInit() {
		this.setUnavailable("Waiting for unit");

		this.setAvailable = this.setAvailable.bind(this);
		this.setUnavailable = this.setUnavailable.bind(this);
		this._onUnitUpdate = this._onUnitUpdate.bind(this);

		this.unit = Homey.app.units.getUnit(
			this.getData().mac,
			this.getSetting('host').split(':').shift(),
			this.getSetting('host').split(':').pop()
		);

		this.unit.on('settingsUpdate', this._onUnitUpdate);
	}

	_onUnitUpdate(unit, newSettings) {
		this.setSettings({
			"host": newSettings.host + ":" + newSettings.port,
			"idx": newSettings.idx.toString()
		});
	}
}