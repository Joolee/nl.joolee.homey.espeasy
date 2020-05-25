const http = require('http.min');
const EventEmitter = require('events');
const Homey = require('homey');
const pinList = require('/lib/pinList.json');

module.exports = class ESPEasyUnit extends EventEmitter {

	constructor(host, port = 80, callback = () => { }) {
		super();
		this.onInit = this.onInit.bind(this);

		this.hostname = host;
		this.port = port;
		// Todo: Make device offline on failures
		this.online = false;
		this.eventCount = 0;
		this.lastEvent = null;
		this.json = null;
		this.driver = null;
		this.gpios = [];
		this.updateJSON(false, () => {
			this.onInit(callback);
		});
	}

	onInit(callback) {
		var mac = this.json.WiFi['STA MAC'];
		var existing = Homey.app.units.getUnit(mac);
		if (existing != this) {
			Homey.app.log("Trying to initialize existing device!", mac);
			Homey.app.units.removeUnit(this);
			callback(null, existing);
		} else {
			Homey.app.log('First json fetched', this.name, this.ip);
			callback(this);
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

	hasStaticIP() {
		return this.json ? this.json.WiFi['IP Config'] == "Static" : null;
	}

	get ip() {
		return this.json ? this.json.WiFi['IP Address'] : this.hostname;
	}

	get mac() {
		return this.json ? this.json.WiFi['STA MAC'] : null;
	}

	get name() {
		if (this.driver)
			return this.driver.getName();
		else if (this.json)
			return this.json.System['Unit Name'];
		else
			return this.ip;
	}

	get id() {
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
		Homey.app.log('Event', this.eventCount, 'from', this.name + '(' + args.idx + '):', args.task, args.key, args.value);
		this.emit("rawevent", this, args.task, args.key, args.value);
	}

	sendCommand(commandList, callback = () => { }, silent = false) {
		if (!silent)
			Homey.app.log('Fetching http://' + this.ip + ':' + this.port + '/control?cmd=' + commandList.join());

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
		if (!silent)
			Homey.app.log('Fetching http://' + this.ip + ':' + this.port + '/json');

		http.get({
			protocol: 'http:',
			hostname: this.ip,
			port: this.port,
			path: '/json',
			json: true,
		}).then((response) => {
			this.lastEvent = new Date();
			this.json = response.data;
			this.online = true;
			callback(null, this);
			this.emit("jsonUpdate", this, response.data);

		}).catch((error) => {
			console.log('Error in updating json', error);
			this.online = false;

			if (!this.json) {
				Homey.app.log('Could not initialize', this.ip + ':' + this.port, error);
				('Could not reach device', null);
				Homey.app.units.removeUnit(this);
			}
		});
	}
}