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

		this.upgradeCapabilities();

		// Permanent binds for functions that get passed around :)
		this.updateUptime = this.updateUptime.bind(this);
		this.onJSONUpdate = this.onJSONUpdate.bind(this);
		this.onUnitUpdate = this.onUnitUpdate.bind(this);
		this.onUnitStateChange = this.onUnitStateChange.bind(this);
		this.unit.on('rawMessage', this.updateUptime);
		this.unit.on('jsonUpdate', this.onJSONUpdate);
		this.unit.on('settingsUpdate', this.onUnitUpdate);
		this.unit.on('stateChange', this.onUnitStateChange);

		this.unit.setPollInterval(this.getSetting('pollInterval'));
		this.log('Init:', this.getName());
		this.unit.updateJSON();

		this.uptimeInterval = setInterval(this.updateUptime, 60000);
	}

	upgradeCapabilities() {
		// Fix updated capabilities
		this.migrateCapability("custom_heartbeat", "device_heartbeat");
		this.migrateCapability("custom_uptime", "unit_uptime");
		this.migrateCapability("custom_heap", "measure_heap");
		this.migrateCapability("custom_load", "measure_load");
		this.migrateCapability("custom_ram", "measure_ram");

		if (!this.getCapabilities().includes("measure_signal_strength"))
			this.addCapability("measure_signal_strength");

		if (!this.getCapabilities().includes("measure_uptime")) {
			this.addCapability("measure_uptime");
			this.setCapabilityOptions("unit_uptime", {
				"preventInsights": true,
				"preventTag ": true
			});
		}

		if (!this.getCapabilities().includes("measure_idle_time")) {
			this.addCapability("measure_idle_time");
			this.setCapabilityOptions("device_heartbeat", {
				"preventInsights": true,
				"preventTag ": true
			});
		}
	}

	updateUptime() {
		if (this.getAvailable()) {

			const idleTime = Math.floor((new Date().getTime() - this.unit.lastEvent.getTime()) / 60);
			if (this.getCapabilityValue("measure_idle_time") != idleTime) {
				this.setCapabilityValue("device_heartbeat", this.unit.lastEvent.toLocaleString());
				this.setCapabilityValue("measure_idle_time", idleTime);
			}

			const uptime = this.unit.json.System["Uptime"];
			if (this.getCapabilityValue("measure_uptime") != uptime) {
				this.setCapabilityValue("unit_uptime", uptime + " " + Homey.__("minutes"));
				this.setCapabilityValue("measure_uptime", uptime);
			}
		} else {
			this.setCapabilityValue("measure_idle_time", null);
			this.setCapabilityValue("measure_uptime", null);
		}
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
		this.unit.removeListener('rawMessage', this.updateUptime);
		this.unit.removeListener('jsonUpdate', this.onJSONUpdate);
		this.unit.removeListener('settingsUpdate', this.onUnitUpdate);
		this.unit.removeListener('stateChange', this.onUnitStateChange);
		clearInterval(this.poller);
		clearInterval(this.uptimeInterval);
		this.unit.removeDriver();
	}

	onJSONUpdate(unit, json) {
		if (!this.getAvailable()) {
			this.log('Initialized with json data from ESP unit');
			this.setAvailable();
		}

		this.setValue("measure_load", json.System['Load']);
		this.setValue("measure_ram", json.System['Free RAM']);
		this.setValue("measure_heap", json.System['Heap Max Free Block']);

		this.setValue("measure_signal_strength", json.WiFi['RSSI']);

		this.updateUptime();
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