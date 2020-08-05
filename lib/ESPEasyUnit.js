const http = require('http.min');
const EventEmitter = require('events');
const Homey = require('homey');
const testJSON = null;

module.exports = class ESPEasyUnit extends Homey.SimpleClass {

	constructor(mac, host, port = 80, callback = () => { }) {
		super();
		this.onInit = this.onInit.bind(this);
		this.updateHost = this.updateHost.bind(this);
		this.updateJSON = this.updateJSON.bind(this);
		this.sendCommand = this.sendCommand.bind(this);

		this.on('__log', (...args) => {
			Homey.app.log.apply(this, Array.prototype.concat.apply([`[Unit: ${this.hostname}]`], args))
		});

		this.hostname = host;
		this.port = port;
		// Todo: Make device offline on failures
		this.online = false;
		this.eventCount = 0;
		this.lastEvent = null;
		this.timeouts = 0;
		this._json = null;
		this.driver = null;
		this.gpios = [];
		this.sensors = [];
		this.mac = mac;
		this.updateJSON(false, (error) => {
			this.onInit(error, callback);
		});
	}

	set json(json) {
		const oldIDX = this.idx;
		this.controllersMarked = false;

		this._json = json;

		// Detect new unit IDX
		if (json.System['Unit Number'] != oldIDX) {
			if (oldIDX !== null)
				this.log(`Unit ID changed from ${oldIDX} to ${json.System['Unit Number']}`);

			this.emit("settingsUpdate", this, {
				"host": this.hostname,
				"port": this.port,
				"idx": json.System['Unit Number']
			});
		}
	}

	get json() {
		return this._json
	}

	get timeout() {
		let timeout = null;
		if (this.driver)
			timeout = this.driver.getSetting("timeout") * 1000;

		return timeout ? timeout : 10000;
	}

	setPollInterval(interval) {
		if (interval == 'auto' && this.poller)
			return;

		if (interval == 'auto' || !interval || interval < 5)
			interval = this.json.TTL / 1000;

		if (interval != this.pollInterval || !this.poller) {
			// Make the interval a little bit random so in a few minutes, the updates for different units will not be at the same time
			clearInterval(this.poller);
			this.log(`Set unit poller to ~${interval} seconds`);
			interval += Math.random() - 0.5;
			this.pollInterval = interval;
			this.poller = setInterval(this.updateJSON, interval * 1000, true);
		}
	}

	onInit(error, callback) {
		if (error) {
			this.log('Could not initialize', this.ip + ':' + this.port);
			callback('Could not reach device', null);
			if (!this.mac) {
				Homey.app.units.removeUnit(this);
				return;
			}
		} else {
			this.log(
				'Device info:',
				this.json.System['Git Build'],
				this.json.System['System Libraries']
			);

			this.mac = this.json.WiFi['STA MAC'];
			var existing = Homey.app.units.getUnit(this.mac);
			if (existing && existing != this) {
				this.log("Device already exists, updating IP address of", this.mac);
				Homey.app.units.removeUnit(this);
				existing.updateHost(this.hostname, this.port);
				callback(null, existing);
				return;
			} else {
				this.log('First json fetched', this.name, this.ip);
				this.setPollInterval('auto');
				callback(null, this);
			}
		}
	}

	tryHost(hostname, callback = () => { }) {
		if (this.hostname == hostname) {
			callback(null);
			return true;
		} else {
			this.log('Trying new hostname', hostname);
			Homey.app.units.getUnit(null, hostname, 80, true, callback);
		}
	}

	updateHost(hostname, port) {
		if (this.hostname != hostname) {
			this.log(`Changing hostname from ${this.hostname} to ${hostname}`);
			this.hostname = hostname;
			this.port = port;

			this.emit("settingsUpdate", this, {
				"host": this.hostname,
				"port": this.port,
				"idx": this.idx
			});
			this.updateJSON();
		}
	}

	addDriver(driver) {
		this.driver = driver;
	}

	removeDriver() {
		this.driver = null;
	}

	addGPIO(gpio) {
		this.gpios.push(gpio);
	}

	deleteGPIO(gpio) {
		this.gpios = this.gpios.filter(item => item != gpio);
	}

	getGPIO(id) {
		return this.gpios.find(item => item.id == id);
	}

	addSensor(sensor) {
		this.sensors.push(sensor);
	}

	deleteSensor(sensor) {
		this.sensors = this.sensors.filter(item => item != sensor);
	}

	getSensor(idx) {
		return this.sensors.find(item => item.idx == idx);
	}

	isHost(name) {
		if (name == this.hostname)
			return true;
		else if (this.ip && name == this.ip)
			return true;
		else
			return false;
	}

	isRegistered() {
		return Boolean(this.driver);
	}

	get online() {
		return this._online;
	}

	set online(state = null) {
		if (state !== null && state != this._online) {
			this._online = state;
			this.emit("stateChange", this, state);
		}

		if (
			this.lastEvent &&
			!this.driver &&
			!this.sensors &&
			!this.gpios &&
			state == false &&
			(new Date().getTime() - this.lastEvent.getTime()) > 3600
		) {
			this.log("Unit not in use and offline for > 1h, removing from cache");
			Homey.app.units.removeUnit(this);
		}
	}

	hasStaticIP() {
		return this.json ? this.json.WiFi['IP Config'] == "Static" : null;
	}

	get ip() {
		return this.hostname;
	}

	get name() {
		if (this.driver)
			return this.driver.getName();
		else if (this.json)
			return this.json.System['Unit Name'];
		else
			return this.ip;
	}

	get idx() {
		return this.json ? this.json.System['Unit Number'] : null;
	}

	get uptime() {
		return this.json ? this.json.System['Uptime'] : null;
	}

	get tasks() {
		if (!this.json) {
			return null
		}

		this._markControllers();
		return this.json.Sensors.filter(task => task.TaskEnabled == "true");
	}

	_markControllers() {
		// Only do this once every json update
		if (!this.controllersMarked) {
			// Remove disabled controllers from tasks and mark duplicate IDX's
			this._json.Sensors.forEach(task => {
				task.DataAcquisition = task.DataAcquisition
					.filter(c => c.Enabled == "true");

				task.DataAcquisition.forEach(controller => {
					controller.duplicate = false;
				})
			});

			this._json.Sensors.forEach((task, taskI) => {
				task.DataAcquisition.forEach((con, conI) => {
					this._json.Sensors.forEach((dupeTask, dupeTaskI) => {
						if (dupeTaskI <= taskI)
							return;

						dupeTask.DataAcquisition.forEach((dupeCon, dupeConI) => {
							if (dupeConI != conI)
								return;

							if (dupeCon.IDX == con.IDX) {
								dupeCon.duplicate = true;
								con.duplicate = true;
							}
						});
					});
				});
			});
			this.controllersMarked = true;
		}
	}

	getFreeTasks() {
		return this.tasks.filter(task =>
			!this.sensors.some(sensor =>
				task.DataAcquisition.find(con => con.Controller == sensor.controller && con.IDX == sensor.idx
				)
			)
		);
	}

	newEvent(args) {
		// I don't want a crash because of an app that runs too long :)
		if (this.eventCount >= 1000000)
			this.eventCount = 0;

		this.eventCount++;
		this.lastEvent = new Date();
		this.log('Event', this.eventCount, 'from', this.name + '(' + args.idx + '):', args.task, args.key, args.value);
		this.emit("rawevent", this, args.task, args.key, args.value);
		this.emit("event", this, args.task, args.key, args.value)
	}

	sendCommand(commandList, silent = false, callback = () => { }) {
		if (!silent)
			this.log('Fetching http://' + this.ip + ':' + this.port + '/control?cmd=' + commandList.join());

		http.get({
			protocol: 'http:',
			hostname: this.ip,
			port: this.port,
			path: '/control',
			timeout: this.timeout,
			query: {
				cmd: commandList.join()
			}
		})
			.then((response) => {
				if (response.data.charAt(0) == '{') {
					try {
						const strippedData = response.data.substr(0, response.data.lastIndexOf('}') + 1);
						const json = JSON.parse(strippedData);
						callback(null, json, response.data);
					}
					catch (error) {
						callback(error, null, response.data);
					}
				} else if (response.data.charAt(0) == '?' || response.data.trim().toUpperCase() == "OK") {
					// ? seems to happen when a pin is uninitialized
					// Only 'Ok' happens when the command ran fine but there is no output
					callback(null, null, response.data);
				} else {
					this.log(`Weird response for call to: http://${this.ip}: ${this.port}/control?cmd=${commandList.join()}`);
					console.log(`#${response.data}#`);

					callback(response.data, null, response.data);
				}
			}).catch((error) => {
				callback(error, null, null);
			});
	}

	getPinList(group = false) {
		const board = require("/lib/pinlists/boards.json")
		[this.detectBoardType()];

		const boardLabel = " (" + Homey.app.getI18nString(board.name) + ")";

		const pinList = [{
			"name": Homey.__("unit.on_board_pins") + boardLabel,
			"pins": require(`/lib/pinlists/${board.pinlist}.json`)
		}];

		if (this.driver) {
			for (let i = 20; i < 28; i++) {
				const list = this.makeMCP23017List(i);
				if (list) {
					pinList.push(list);
				}
			}
		}

		if (group) {
			return pinList;
		} else {
			let lists = pinList.map(group => group.pins);
			return [].concat(...lists);
		}
	}

	makeMCP23017List(address) {
		if (this.driver.getSetting("mcp23017-0x" + address)) {
			const mcp23017 = {
				"name": "MCP23017 0x" + address,
				pins: []
			}

			for (let p = 1; p < 17; p++) {
				const oPin = require("/lib/pinlists/mcp23017.json");
				const pin = { ...oPin }
				pin.id = `mcp23017-0x${address}-${p}`;
				pin.name = "Pin " + p;
				pin.pin = (((address - 20) * 16) + p);
				pin.description = "Port " + pin.pin;
				mcp23017.pins.push(pin);
			}

			return mcp23017;
		} else {
			return null;
		}
	}

	detectBoardType() {
		if (this.driver) {
			let boardType = this.driver.getSetting('boardType');
			if (boardType != "detect") {
				return boardType;
			}
		}

		if (this.json && typeof this.json.System["Heap Max Free Block"] == "undefined") {
			return "nodemcu-esp32";
		} else {
			return "nodemcu-v3";
		}
	}

	getPinStatus(pinId, silent = false, callback = () => { }) {
		const pin = this.getPinList().find(pin => pin.id == pinId);

		if (typeof pin == "undefined" || !pin.enabled) {
			this.log("Could not find pin " + pinId);
			callback(Homey.__("gpio.pin_not_found"));
			this.emit("pinUpdate", this, pinId, Homey.__("gpio.pin_not_found"), null);
			return
		}

		if (!pin.commands.status) {
			let message = "Pin does not have commands.status property " + pinId;
			this.log(message);
			callback(message);
			this.emit("pinUpdate", this, pinId, message, null);
			return
		}

		this.sendCommand([pin.commands.status, pin.pin], silent, (error, json, rawData) => {
			if (!error && !json && rawData.trim() == "Ok") {
				error = Homey.__("sensor.io_board_offline");
			}

			this.emit("pinUpdate", this, pinId, error, json);
			callback(error, json);
		});
	}

	updateJSON(silent = false, callback = () => { }) {
		if (!this.updateJSONCallbacks)
			this.updateJSONCallbacks = [];

		this.updateJSONCallbacks.push(callback);
		if (this.updateJSONCallbacks.length > 1) {
			return;
		}

		if (!silent)
			this.log(`Fetching http://${this.ip}:${this.port}/json Timeout: ${this.timeout}`);

		http.get({
			protocol: "http:",
			hostname: this.ip,
			port: this.port,
			path: "/json",
			json: true,
			timeout: this.timeout
		}).then((response) => {
			let esp = response.data;
			this.lastEvent = new Date();

			if (testJSON && esp.WiFi.Hostname == "Test") {
				this.log("Using testing JSON");
				testJSON.System["Uptime"] = esp.System["Uptime"];
				testJSON.WiFi["IP Address"] = esp.WiFi["IP Address"];
				testJSON.WiFi["STA MAC"] = esp.WiFi["STA MAC"];
				esp = testJSON;
			}

			this.json = esp;
			this.online = true;
			this.timeouts = 0;
			this.updateJSONCallbacks.forEach(fn => {
				try {
					fn(null, this)
				} catch (error) {
					this.log("Failed running callback", fn, error);
				}
			});
			this.updateJSONCallbacks = [];
			this.emit("jsonUpdate", this, esp);
		}).catch((error) => {
			this.log("Error in updating json: ", error.message ? error.message : error);

			if (error.message && error.message == "timeout") {
				if (this.timeouts++ > 5) {
					this.online = false;
				}
			} else {
				this.online = false;
			}

			this.updateJSONCallbacks.forEach(fn => fn(Homey.__("unit.error_connecting"), this));
			this.updateJSONCallbacks = [];
		}).then(() => { // Doesn't seem to support finally but this should work the same
			if (this.updateJSONCallbacks.length) {
				this.log("Error updating json. Reached 'Finally' statement in some way.");

				this.updateJSONCallbacks.forEach(fn => fn("Reached 'finally' in some way", this));
				this.updateJSONCallbacks = [];
			}
		});
	}
}