const Homey = require('homey');

module.exports = class UnitDevice extends Homey.Device {
	// Homey function
	onInit() {
		this.setUnavailable("Initializing");
		this.unit = Homey.app.units.getUnit(
			this.getData().mac,
			this.getSetting('host'),
			this.getSetting('port'));
		this.unit.addDriver(this);

		// Fix updated capabilities
		if (!this.getCapabilities().includes("measure_signal_strength"))
			this.addCapability("measure_signal_strength");

		this.migrateCapability("custom_heartbeat", "device_heartbeat");
		this.migrateCapability("custom_uptime", "unit_uptime");
		this.migrateCapability("custom_heap", "measure_heap");
		this.migrateCapability("custom_load", "measure_load");
		this.migrateCapability("custom_ram", "measure_ram");

		// Permanent binds for functions that get passed around :)
		this.onRawMessage = this.onRawMessage.bind(this);
		this.onJSONUpdate = this.onJSONUpdate.bind(this);
		this.onUnitUpdate = this.onUnitUpdate.bind(this);
		this.onUnitStateChange = this.onUnitStateChange.bind(this);
		this.unit.on('rawMessage', this.onRawMessage);
		this.unit.on('jsonUpdate', this.onJSONUpdate);
		this.unit.on('settingsUpdate', this.onUnitUpdate);
		this.unit.on('stateChange', this.onUnitStateChange);

		this.unit.setPollInterval(this.getSetting('pollInterval'));
		this.log('Init:', this.getName());
		this.unit.updateJSON();
	}

	onUnitStateChange(unit, state) {
		state ? this.setAvailable() : this.setUnavailable(Homey.__("offline"));
	}

	onUnitUpdate(unit, newSettings) {
		this.updateHostname(unit, newSettings.host, newSettings.port);
		this.setSettings({
			"idx": newSettings.idx.toString()
		}).catch(error => this.log('Settings update failed', error, newSettings.idx));
	}


	updateHostname(unit, hostname, port) {
		if (hostname != this.getSetting('host') || port != this.getSetting('port')) {
			this.log(`Changing hostname to ${hostname}`);
			this.setSettings({
				"host": hostname,
				"port": port
			});
		}
	}

	onSettings(oldSettingsObj, newSettingsObj, changedKeysArr, callback) {
		callback();
		if (changedKeysArr.includes('host') || changedKeysArr.includes('port')) {
			this.unit.updateHost(newSettingsObj.host, newSettingsObj.port);
		}

		if (changedKeysArr.includes('pollInterval')) {
			this.unit.setPollInterval(newSettingsObj.pollInterval);
		}
	}

	// Homey function
	onDeleted() {
		this.log("Device deleted", this.unit.mac, this.unit.name);
		this.unit.removeListener('rawMessage', this.onRawMessage);
		this.unit.removeListener('jsonUpdate', this.onJSONUpdate);
		this.unit.removeListener('settingsUpdate', this.onUnitUpdate);
		this.unit.removeListener('stateChange', this.onUnitStateChange);
		clearInterval(this.poller);
		this.unit.removeDriver();
	}

	onRawMessage() {
		this.setCapabilityValue('heartbeat', this.unit.lastEvent.toLocaleString());
	}

	onJSONUpdate(unit, json) {
		if (!this.getAvailable()) {
			this.log('Initialized with json data from ESP unit');
			this.setAvailable();
		}

		this.setValue("measure_load", json.System['Load']);
		this.setValue("measure_ram", json.System['Free RAM']);
		this.setValue("measure_heap", json.System['Heap Max Free Block']);

		unit.driver.setCapabilityValue('unit_uptime', json.System['Uptime'] + " " + Homey.__('minutes'));

		this.setValue("measure_signal_strength", json.WiFi['RSSI']);

		unit.driver.setCapabilityValue('device_heartbeat', unit.lastEvent.toLocaleString())
			.catch(this.log);
	}

	setValue(key, value) {
		if (this.getCapabilityValue(key) != value) {
			this.setCapabilityValue(key, value)
				.catch(this.log);
		}
	}

	migrateCapability(oldCapability, newCapability) {
		if (this.getCapabilities().includes(oldCapability)) {
			this.log("Migrate capability", oldCapability, newCapability);
			this.removeCapability(oldCapability);
			this.addCapability(newCapability);
		}
	}
}