const http = require('http.min');
const EventEmitter = require('events');
const Homey = require('homey');
const pinList = require('/lib/pinList.json');

module.exports = class ESPEasyUnit extends Homey.SimpleClass {

	constructor(mac, host, port = 80, callback = () => { }) {
		super();
		this.onInit = this.onInit.bind(this);
		this.updateHost = this.updateHost.bind(this);
		this.updateJSON = this.updateJSON.bind(this);
		this.on('__log', (...args) => {
			Homey.app.log.apply(this, Array.prototype.concat.apply([`[Unit: ${this.hostname}]`], args))
		});

		this.hostname = host;
		this.port = port;
		// Todo: Make device offline on failures
		this.online = false;
		this.eventCount = 0;
		this.lastEvent = null;
		this.json = null;
		this.driver = null;
		this.gpios = [];
		this.mac = mac;
		this.updateJSON(false, (error) => {
			this.onInit(error, callback);
		});
	}

	set pollInterval(interval) {
		if (interval === null && this.poller)
			return;

		if (!interval || interval < 5)
			interval = 60;

		if (interval != this.pollInterval || !this.poller) {
			clearInterval(this.poller);
			this.log('Set unit poller to', interval);
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
			this.mac = this.json.WiFi['STA MAC'];
			var existing = Homey.app.units.getUnit(this.mac);
			if (existing != this) {
				this.log("Device already exists, updating IP address of", this.mac);
				Homey.app.units.removeUnit(this);
				existing.updateHost(this.hostname, this.port);
				callback(null, existing);
				return;
			} else {
				this.log('First json fetched', this.name, this.ip);
				callback(null, this);
			}
		}
		this.pollInterval = null;
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
			this.emit("newhostname", this, hostname, port);
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
		return this.gpios.filter(item => item.id == id)[0];
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

	isOnline() {
		return this.online;
	}

	setOnline(state = null) {
		if (state !== null) {
			this.online = state;
		}

		if (this.driver) {
			this.online ? this.driver.setAvailable() : this.driver.setUnavailable(Homey.__("offline"));
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

	newEvent(args) {
		// I don't want a crash because of an app that runs too long :)
		if (this.eventCount >= 1000000)
			this.eventCount = 0;

		this.eventCount++;
		this.lastEvent = new Date();
		this.log('Event', this.eventCount, 'from', this.name + '(' + args.idx + '):', args.task, args.key, args.value);
		this.emit("rawevent", this, args.task, args.key, args.value);
	}

	sendCommand(commandList, callback = () => { }, silent = false) {
		if (!silent)
			this.log('Fetching http://' + this.ip + ':' + this.port + '/control?cmd=' + commandList.join());

		http.get({
			protocol: 'http:',
			hostname: this.ip,
			port: this.port,
			path: '/control',
			query: {
				cmd: commandList.join()
			}
		})
			.then((response) => {
				if (response.data.charAt(0) == '{') {
					try {
						const strippedData = response.data.substr(0, response.data.lastIndexOf('}') + 1);
						const json = JSON.parse(strippedData);
						callback(null, json);
					}
					catch (error) {
						callback(error);
					}
				} else if (response.data.charAt(0) == '?') {
					callback(null, null);
				} else {
					callback(response.data);
				}
			}).catch((error) => {
				callback(error);
			});
	}

	getPinStatus(pinId, silent = false, callback = () => { }) {
		const pin = pinList[pinId];
		if (!pin)
			callback('Could not find pin ' + pinId);
		if (!pin.input.status)
			callback('Pin does not have input.status property ' + pinId);

		this.sendCommand([pin.input.status, pin.pin], (error, json) => {
			this.emit("pinUpdate", this, pinId, error, json);
			callback(error, json);
		}, silent);
	}

	updateJSON(silent = false, callback = () => { }) {
		if (!this.updateJSONCallbacks)
			this.updateJSONCallbacks = [];

		this.updateJSONCallbacks.push(callback);
		if (this.updateJSONCallbacks.length > 1) {
			this.log('Already updating JSON');
			return;
		}

		if (!silent)
			this.log('Fetching http://' + this.ip + ':' + this.port + '/json');

		http.get({
			protocol: 'http:',
			hostname: this.ip,
			port: this.port,
			path: '/json',
			json: true,
		}).then((response) => {
			if (response.data.System['Unit Number'] != this.idx) {
				this.log(`Unit ID changed from ${this.idx} to ${response.data.System['Unit Number']}`);
				this.emit("settingsUpdate", this, {
					"host": this.hostname,
					"port": this.port,
					"idx": response.data.System['Unit Number']
				});
			}
			this.lastEvent = new Date();
			this.json = response.data;
			this.setOnline(true);
			this.updateJSONCallbacks.forEach(fn => fn(null, this));
			this.updateJSONCallbacks = [];
			this.emit("jsonUpdate", this, response.data);


		}).catch((error) => {
			this.log('Error in updating json', error.code ? error.code : error);
			this.setOnline(false);
			this.updateJSONCallbacks.forEach(fn => fn('Could not reach device', null));
			this.updateJSONCallbacks = [];
		});
	}
}