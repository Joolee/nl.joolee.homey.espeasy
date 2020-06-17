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

		if (!this.getCapabilities().includes("custom_signal_strength"))
			this.addCapability("custom_signal_strength");

		this.triggers = [];
		this.addTrigger("custom_signal_strength_changed");

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

	addTrigger(name) {
		this.triggers[name] = new Homey.FlowCardTrigger(name).register();
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

		this.setValue("custom_load", json.System['Load']);
		this.setValue("custom_ram", json.System['Free RAM']);
		this.setValue("custom_heap", json.System['Heap Max Free Block']);

		unit.driver.setCapabilityValue('custom_uptime', json.System['Uptime'] + " " + Homey.__('minutes'));

		this.setValue("custom_signal_strength", json.WiFi['RSSI']);

		unit.driver.setCapabilityValue('custom_heartbeat', unit.lastEvent.toLocaleString())
			.catch(this.log);
	}

	setValue(key, value) {
		if (this.getCapabilityValue(key) != value) {
			this.setCapabilityValue(key, value)
				.catch(this.log);

			const trigger = this.triggers[key + "_changed"];
			if (trigger) {
				// Ignore invalid_flow_card_id errors that appear for some reason
				trigger.trigger({ [key]: value })
					.catch(() => { });
			}
		}
	}
}