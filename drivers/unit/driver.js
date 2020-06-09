const Homey = require('homey');
const http = require('http.min');

module.exports = class Unit extends Homey.Driver {
	onInit() {
		// Find local subnet as user hint for pairing screen
		this.homeyIp = null;
		Homey.ManagerCloud.getLocalAddress((error, address) => {
			if (!error && address) {
				this.homeyIp = address;
			}
		});
	}

	onPair(socket) {
		let unit = null;

		// Received when a view has changed
		socket.on('showView', (viewId, callback) => {
			if (viewId == "setup_controller") {
				if (unit) {
					unit.on("rawevent", updateEventCount);
				}
				else {
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
			this.log('Unregistered units requested');
			const unregisteredUnits = [];

			for (const unit of Homey.app.units.listUnregistered()) {
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
				unit.removeListener("rawevent", updateEventCount);
				unit = null;
			}

			this.log('User requested connection to: ' + data[0] + ':' + data[1]);
			unit = Homey.app.units.getUnit(null, data[0], data[1], true, (err, unit, newlyFound) => {
				if (err) {
					callback(err, null);
				}
				else {
					this.log('Unit found', unit.name)
					const unitFound = (unit) => {
						unit.on("rawevent", updateEventCount);

						callback(null, {
							"name": unit.name,
							"idx": unit.idx.toString(),
							"uptime": unit.uptime + ' ' + Homey.__('minutes'),
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
					}
					else {
						unit.updateJSON(false, () => { unitFound(unit) });
					}
				}
			});
		});
	}
}