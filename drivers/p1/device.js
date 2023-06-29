'use strict';

const GeneralDevice = require('../../lib/GeneralDevice.js');
const net = require('net');
const Homey = require('homey');
const parsePacket = require('../../lib/p1-parsePacket.js');

module.exports = class P1_Device extends GeneralDevice {
	onInit() {
		super.onInit();
		this.removeAllListeners('__log').removeAllListeners('__error');
		this.on('__log', (...props) => {
			this.driver.log.bind(this, `[${this.unit.ip}]`)(...props);
		}).on('__error', (...props) => {
			this.driver.error.bind(this, `[${this.unit.ip}]`)(...props);
		});

		this.migrateCapability("custom_active_tariff", "alarm_active_tariff");

		this.errorMsg = null

		this.unit.addSensor(this);
		this.log("Init:", this.unit.name, this.constructor.name, this.port);
		this.socket = new net.Socket();

		this.socket.on("connect", this.onConnected.bind(this));
		this.socket.on("timeout", this.onTimeout.bind(this));
		this.socket.on("close", this.onClosed.bind(this));
		this.socket.on("end", this.onClosed.bind(this));
		this.socket.on("data", this.onData.bind(this));
		this.socket.on("error", this.onError.bind(this));
		this.socket.setTimeout(60000);
		this.homey.on("unload", this.destroy.bind(this));

		this.onUnitUpdate = this.onUnitUpdate.bind(this);
		this.unit.on('settingsUpdate', this.onUnitUpdate);

		this.datagramCount = 0;

		this.connect();
		this.keepAlive = setInterval(this.detectProblems.bind(this), 60000);
	}

	detectProblems() {
		// If connected but no datagram received in 180s
		const lastActivity = this.lastDatagram ? this.lastDatagram : this.connected;

		if (
			this.connected &&
			(new Date().getTime() - lastActivity.getTime()) > 120000
		) {
			this.log("Problem detected");
			this.onTimeout();
		}
	}

	updateTelemetry(reason, recurse) {
		try {
			// Find out which dynamic capabilities are used
			const defaultCaps = this.driver.manifest.capabilities;
			const capabilities = this.getCapabilities().filter(cap => !defaultCaps.includes(cap));

			let metrics = {
				"Task plugin": '44 - Communication - P1 Wifi Gateway',
				"Task driver": 'p1',
				"Task capabilities": capabilities.sort().join(', ')
			};

			this.homey.app.telemetry.send('Sensor', reason, '/device/sensor/p1', metrics);
		} catch (error) {
			this.error('Error sending P1 telemetry:', error);
		}
	}

	onTimeout() {
		// Reconnect
		this.log("Not receiving any datagrams, trying to reconnect");
		this.socket.end();
	}

	// Override GeneralDevice function
	onUnitStateChange(state) {
		// Ignore
	}

	// New IP address for unit
	onUnitUpdate(unit, newSettings) {
		this.socket.end();
	}

	destroy() {
		this.log("Destroying all connections");
		this.connected = null;
		this.socket.removeAllListeners("close", this.onClosed);
		this.socket.destroy();
	}

	// New port number for this device
	onSettings({ changedKeys }) {
		callback();
		if (changedKeys.includes('p1port')) {
			this.errorMSg = null;
			this.socket.end();
		}
	}

	onDeleted() {
		super.onDeleted();
		this.log("Sensor deleted", this.unit.name, this.constructor.name, this.port);

		this.unit.removeListener('settingsUpdate', this.onUnitUpdate);
		this.unit.deleteSensor(this);

		this.homey.removeListener("unload", this.destroy)

		clearInterval(this.keepAlive);

		this.destroy();
	}

	connect() {
		if (!this.socket.connecting) {
			this.log("Connecting to P1 server at", this.unit.ip, this.port);
			this.setUnavailable(this.errorMsg ? this.errorMsg : this.homey.__("p1.connecting", {
				"port": this.port
			}));
			this.socket.connect({
				"host": this.unit.ip,
				"port": this.port
			});
		}
	}

	onConnected() {
		const server = this.socket.address();
		this.log("Connected to P1 server at", server.address, server.port);
		this.setUnavailable(this.errorMsg ? this.errorMsg : this.homey.__("p1.waiting"));

		this.connected = new Date();
		this.lastDatagram = null;

		// To test if the user entered the HTTP port...
		this.socket.write("GET / HTTP");
	}

	onClosed() {
		this.log("Connection lost");
		this.setUnavailable(this.errorMsg ? this.errorMsg : this.homey.__("p1.connection_lost"));
		this.connected = null;
		setTimeout(this.connect.bind(this), 5000);
	}

	onData(data) {
		if (data.toString().substr(0, 4) == "HTTP") {
			this.log("Connected to HTTP server...");
			this.errorMsg = this.homey.__("p1.connected_to_http_server", {
				"port": this.port
			});
			this.setUnavailable(this.errorMsg);
			this.socket.end();
			return;
		} else {
			this.errorMsg = null;
		}

		try {
			const dg = this.parseDatagram(data);

			if (!this.datagramCount) {
				this.debug("First datagram received:\n", dg, dg);
			}
			this.datagramCount = this.homey.app.safeIncrement(this.datagramCount);

			dg.version = (dg.version / 10).toString();

			if (this.getSetting("meterType") != dg.meterType || this.getSetting("DSMRVersion") != dg.version) {
				this.log('P1 properties changed', dg.meterType, dg.version);
				this.setSettings({
					"meterType": dg.meterType,
					"DSMRVersion": dg.version
				});
			}

			// Total power usage
			this.setValue("measure_power", dg.electricity.received.actual.reading * 1000);
			this.setValue("meter_power.received1", dg.electricity.received.tariff1.reading);
			this.setValue("meter_power.received2", dg.electricity.received.tariff2.reading);

			// Total power surplus
			this.setValue("measure_power.delivery", 0 - dg.electricity.delivered.actual * 1000);
			this.setValue("meter_power.delivered1", dg.electricity.delivered.tariff1.reading);
			this.setValue("meter_power.delivered2", dg.electricity.delivered.tariff2.reading);

			// Power usage per phase
			// Only if phase 2 is not null
			if (dg.electricity.instantaneous.power.positive.L2.reading) {
				for (let i = 1; i < 4; i++) {
					this.setValue('measure_power.received_l' + i, dg.electricity.instantaneous.power.positive['L' + i].reading * 1000);
					this.setValue('measure_power.delivered_l' + i, dg.electricity.instantaneous.power.negative['L' + i].reading * 1000);
				}
			}

			// Active tariff
			if (dg.electricity.tariffIndicator) {
				this.setValue("alarm_active_tariff", dg.electricity.tariffIndicator.toString());
			}

			// Gas meter
			this.setValue("meter_gas", dg.gas.reading);

		} catch (error) {
			// It's a soft error as we'll receive more datagrams ㄟ( ▔, ▔ )ㄏ
			this.log('Datagram error', this.dgCount, error);
			this.setUnavailable(this.homey.__("p1.invalid_datagram", {
				"port": this.port
			}));
			return;
		}

		this.updateHeartbeat();
		this.lastDatagram = new Date();
		this.setAvailable();
	}

	parseDatagram(data) {
		// Multiple datagrams might have been received for some reason
		// Split on lines beginning with /, keep de /
		let dgs = data.toString().split(/^(?=\/)/mg).filter(n => n);

		if (dgs.length == 0) {
			throw new Error('Received empty datagram?');
		} else if (dgs.length > 1) {
			this.log('Received multiple datagrams, looking for last valid datagram', dgs.length);
		}

		// Find last valid datagram from array.
		// First line must start with /, second line empty and last line must be !{CRC16}
		const dg = dgs.reverse().find(dg => {
			let lines = dg.replace(/\r/g, '').split('\n');
			const valid = lines[1] == '';
			lines = lines.filter(l => l); // Remove all empty lines
			return valid && lines[0].charAt(0) == '/' && /^![0-9A-F]{4}$/.test(lines[lines.length - 1]);
		});

		if (!dg) {
			throw new Error(`Received corrupt datagrams ${dgs.toString()}`);
		}

		// Remove CRC16 line because the parser will throw a warning
		// The ESP should have checked this already anyway
		return parsePacket(dg.replace(/^![0-9A-F]{4}$/m, ''));
	}

	onError(error) {
		console.log(typeof error);
		if (typeof error == "string" && (
				error.slice(0, 22) == "Error: write after end" ||
				error.includes('ERR_STREAM_WRITE_AFTER_END')))
			return;

		if ((error.errno && error.errno == "ECONNRESET") || (error.code && error.code == "ECONNRESET")) {
			this.log("Connection reset. Previous connection had probably not been closed correctly");
		} else if (error.errno && error.errno == "EHOSTUNREACH" || error.errno == "ECONNREFUSED") {
			this.log("P1 device unreachable");
			this.setUnavailable(`P1 device unreachable: ${error.errno}`);
		} else {
			this.error("Unknown error received:", error);
		}
	}

	setValue(capability, value) {
		if (value === undefined) {
			return;
		}

		let hasCapability = this.hasCapability(capability);
		if (!hasCapability && value !== undefined && value > 0) {
			this.addCapability(capability)
				.catch(this.error.bind(this, `Error adding capability [${capability}] for P1 device`));;
			hasCapability = true;
		}

		if (hasCapability && value !== undefined && this.getCapabilityValue(capability) != value) {
			this.setCapabilityValue(capability, value)
				.catch(this.error.bind(this, `Error setting capability [${capability}] value to ${value} for p1 device`));
		}
	}

	get port() {
		return this.getSetting('p1port');
	}

}
