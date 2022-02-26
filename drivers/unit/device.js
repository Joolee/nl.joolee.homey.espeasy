const Homey = require('homey');
const util = require('util');

module.exports = class UnitDevice extends Homey.Device {
	// Homey function
	onInit() {
		this.setUnavailable("Initializing");
		this.unit = Homey.app.units.findUnit(
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
		this.onUnitReboot = this.onUnitReboot.bind(this);
		this.onUnitReconnect = this.onUnitReconnect.bind(this);
		this.unit.on("rawMessage", this.updateUptime);
		this.unit.on("jsonUpdate", this.onJSONUpdate);
		this.unit.on("settingsUpdate", this.onUnitUpdate);
		this.unit.on("stateChange", this.onUnitStateChange);
		this.unit.on("reboot", this.onUnitReboot);
		this.unit.on("reconnect", this.onUnitReconnect);

		this.unit.setPollInterval(this.getSetting('pollInterval'));
		this.log("Initializing unit device: '" + this.getName() + "'");
		this.unit.updateJSON(false, () => {
			this.onUnitStateChange(this.unit, this.unit.isOnline)
		});

		this.uptimeInterval = setInterval(this.updateUptime, 60000);
	}

	onUnitReboot(unit, oldJson) {
		this.getDriver().triggerFlow(this, "unit_rebooted", {
			"reset_reason": unit.json.System["Reset Reason"],
			"boot_reason": unit.json.System["Last Boot Cause"]
		});
	}

	onUnitReconnect(unit, oldJson) {
		this.getDriver().triggerFlow(this, "unit_reconnected", {
			"milliseconds_ago": unit.json.WiFi["Connected msec"],
			"reconnects_number": unit.json.WiFi["Number Reconnects"],
			"disconnect_reason_number": unit.json.WiFi["Last Disconnect Reason"],
			"disconnect_reason_string": unit.json.WiFi["Last Disconnect Reason str"]
		});
	}

	upgradeCapabilities() {
		// Fix updated capabilities
		this.migrateCapability("custom_heartbeat", "device_heartbeat");
		this.migrateCapability("custom_uptime", "unit_uptime");
		this.migrateCapability("custom_heap", "measure_heap");
		this.migrateCapability("custom_load", "measure_load");
		this.migrateCapability("custom_ram", "measure_ram");

		if (!this.hasCapability("measure_signal_strength"))
			this.addCapability("measure_signal_strength");

		if (!this.hasCapability("measure_uptime")) {
			this.addCapability("measure_uptime");
			this.setCapabilityOptions("unit_uptime", {
				"preventInsights": true,
				"preventTag ": true
			});
		}

		if (!this.hasCapability("measure_idle_time")) {
			this.addCapability("measure_idle_time");
			this.setCapabilityOptions("device_heartbeat", {
				"preventInsights": true,
				"preventTag ": true
			});
		}
	}

	detectBoard() {
		let boardType = this.unit.detectBoardType();

		this.log("Set board type to:", boardType);
		this.setSettings({
			"boardType": boardType
		});
		return boardType;
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
		if (state != this.getAvailable()) {
			this.log("Change online state to", state);
			state ? this.setAvailable() : this.setUnavailable(Homey.__("offline"));
		}
	}

	onUnitUpdate(unit, newSettings) {
		this.updateHostname(unit, newSettings.host, newSettings.port);
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

		if (newSettingsObj["boardType"] == "detect") {
			newSettingsObj["boardType"] = this.detectBoard();
		}

		if (changedKeysArr.includes('boardType')) {
			this.unit.emit("boardTypeChanged", newSettingsObj["boardType"])
		}

		if (changedKeysArr.includes('pollInterval')) {
			this.unit.setPollInterval(newSettingsObj.pollInterval);
		}
	}

	// Homey function
	onDeleted() {
		this.log("Device deleted", this.unit.mac, this.unit.name);
		this.unit.removeListener("rawMessage", this.updateUptime);
		this.unit.removeListener("jsonUpdate", this.onJSONUpdate);
		this.unit.removeListener("settingsUpdate", this.onUnitUpdate);
		this.unit.removeListener("stateChange", this.onUnitStateChange);
		this.unit.removeListener("reboot", this.onUnitReboot);
		this.unit.removeListener("reconnect", this.onUnitReconnect);
		clearInterval(this.poller);
		clearInterval(this.uptimeInterval);
		this.unit.removeDriver();
	}

	onJSONUpdate(unit, json) {
		if (this.getSetting("boardType") == "detect") {
			this.detectBoard();
		}

		this.setValue("measure_load", json.System["Load"]);
		this.setValue("measure_ram", json.System["Free RAM"]);
		this.setValue("measure_signal_strength", json.WiFi["RSSI"]);

		// ESP32 chips don't supply this value
		if (!this.hasCapability("measure_heap") && json.System["Heap Max Free Block"]) {
			this.addCapability("measure_heap");
		}

		if (this.hasCapability("measure_heap")) {
			if (json.System["Heap Max Free Block"]) {
				this.setValue("measure_heap", json.System["Heap Max Free Block"]);
			} else {
				this.removeCapability("measure_heap");
			}
		}

		this.updateUptime();
	}

	setValue(key, value) {
		if (this.getCapabilityValue(key) != value) {
			this.setCapabilityValue(key, value)
				.catch(this.log);
		}
	}

	migrateCapability(oldCapability, newCapability) {
		if (this.hasCapability(oldCapability)) {
			this.log("Migrate capability", oldCapability, newCapability);
			this.removeCapability(oldCapability);
			this.addCapability(newCapability);
		}
	}

	async onActionCustomCommand(args) {
		this.log("Action custom command:", args.command_string);
		return util.promisify(this.unit.sendCommand)([args.command_string], false);
	}

	async onActionStartEvent(args) {
		this.log("Action start event:", args.event_name, args.event_parameter);
		let command = args.event_name;
		if (args.event_parameter) {
			command += "=" + args.event_parameter;
		}
		return util.promisify(this.unit.sendCommand)(["event", command], false);
	}

	async onActionSetTaskValue(args) {
		this.log("Action set task value:", args.task_value_name, args.task_new_value);

		return util.promisify(this.unit.sendCommand)([
			"taskvalueset",
			args.task_value_name.taskId,
			args.task_value_name.valueId,
			args.task_new_value
		], false);
	}

	async onActionRunTask(args) {
		this.log("Action run task:", args.task_name);

		return util.promisify(this.unit.sendCommand)([
			"TaskRun",
			args.task_name.taskId
		], false);
	}

	async autoCompleteTaskName(args, query) {
		if (!this.unit.json) {
			this.log("autoCompleteTaskName: Device offline");
			return Promise.reject(Homey.__("offline"));
		}

		const tasks = this.unit.tasks.map(task => ({
			"name": task.TaskNumber + ": " + task.TaskName,
			"description": task.Type,
			"taskId": task.TaskNumber
		}));

		return Promise.resolve(tasks);
	}

	async autoCompleteTaskValueName(args, query) {
		if (!this.unit.json) {
			this.log("autoCompleteTaskValueName: Device offline");
			return Promise.reject(Homey.__("offline"));
		}

		const valueNames = [];

		for (let task of this.unit.tasks) {
			for (let value of task.TaskValues) {
				this.log(value);
				let existing = valueNames.find(val => val.name == value.name);
				valueNames.push({
					"name": `${value.ValueNumber}: ${value.Name}`,
					"description": `Task: ${task.TaskNumber} - ${task.TaskName}`,
					"taskId": task.TaskNumber,
					"valueId": value.ValueNumber
				})
			}
		};

		return Promise.resolve(valueNames);
	}
}
