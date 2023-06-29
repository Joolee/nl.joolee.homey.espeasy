const Homey = require('homey');
const http = require('http.min');
const GeneralDriver = require('../../lib/GeneralDriver.js');

module.exports = class UnitDriver extends GeneralDriver {
	onInit() {
		super.onInit();

		// Find local subnet as user hint for pairing screen
		this.homeyIp = null;
		this.homey.cloud.getLocalAddress((error, address) => {
			if (!error && address) {
				this.homeyIp = address;
			}
		});

		this.addActionFlow("send_custom_command", "onActionCustomCommand");
		this.addActionFlow("start_event", "onActionStartEvent");
		this.addActionFlow("start_event_with_parameter", "onActionStartEvent");
		this.addActionFlow("set_task_value", "onActionSetTaskValue", {
			"task_value_name": "autoCompleteTaskValueName"
		});
		this.addActionFlow("run_task", "onActionRunTask", {
			"task_name": "autoCompleteTaskName"
		});

		this.addTriggerFlow("unit_rebooted");
		this.addTriggerFlow("unit_reconnected");
	}

	onPair(socket) {
		let unit = null;

		// Received when a view has changed
		socket.on('showView', (viewId, callback) => {
			if (viewId == "setup_controller") {
				if (unit) {
					unit.on("event", updateEventCount);
				} else {
					this.log("Clicked next too soon!");
				}
			}
			callback();
			this.log('Loading view: ' + viewId);
		});

		socket.on('getHomeyIP', (data, callback) => {
			callback(null, this.homeyIp);
		});

		socket.on('getUnregisteredUnits', (data, callback) => {
			this.log('Unregistered units list requested by pairing wizard');
			const unregisteredUnits = [];

			for (const unit of this.homey.app.units.getUnregistered()) {
				unregisteredUnits.push({
					"name": unit.name,
					"idx": unit.idx,
					"host": unit.hostname,
					"port": unit.port,
					"mac": unit.mac
				});
			}

			callback(null, unregisteredUnits);
		});

		const updateEventCount = (unit, task, key, value) => {
			socket.emit("updateEventCount", unit.eventCount);
		}

		socket.on('connect', (data, callback) => {
			if (unit) {
				unit.removeListener("event", updateEventCount);
				unit = null;
			}

			this.log(`User requested connection to: ${data[0]}:${data[1]}`);
			unit = this.homey.app.units.findUnit(null, data[0], data[1], true, (error, unit, newlyFound) => {
				if (error) {
					// Can't get the error message back to the client so I'll send it as data
					callback(null, error);
				} else {
					this.log("Requested unit found: '" + unit.name + "'")
					const unitFound = (unit) => {
						unit.on("event", updateEventCount);

						callback(null, {
							"name": unit.name,
							"idx": (unit.idx ? unit.idx.toString() : 'unknown'),
							"uptime": unit.uptime + ' ' + this.homey.__("minutes"),
							"eventCount": unit.eventCount,
							"staticIP": unit.hasStaticIP(),
							"host": unit.hostname,
							"port": unit.port,
							"numSensors": unit.json.Sensors.length,
							"mac": unit.mac
						});
					}

					if (newlyFound) {
						unitFound(unit);
					} else {
						unit.updateJSON(false, () => {
							unitFound(unit)
						});
					}
				}
			});
		});
	}
}
