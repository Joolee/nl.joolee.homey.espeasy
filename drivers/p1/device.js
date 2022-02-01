'use strict';

const GeneralDevice = require('/lib/GeneralDevice.js');
const net = require('net');
const Homey = require('homey');
const parsePacket = require('/lib/p1-parsePacket.js');

module.exports = class P1_Device extends GeneralDevice {
	onInit() {
		super.onInit();

		this.migrateCapability("custom_active_tariff", "alarm_active_tariff");

		this.errorMsg = null

		this.unit.addSensor(this);
		this.log("Init:", this.unit.name, this.constructor.name, this.port);
		this.p1 = new net.Socket();

		this.onUnitUpdate = this.onUnitUpdate.bind(this);
		this.connect = this.connect.bind(this);
		this.detectProblems = this.detectProblems.bind(this);
		this.onConnected = this.onConnected.bind(this);
		this.onClosed = this.onClosed.bind(this);
		this.onData = this.onData.bind(this);
		this.onError = this.onError.bind(this);
		this.destroy = this.destroy.bind(this);
		this.onTimeout = this.onTimeout.bind(this);

		this.p1.on("connect", this.onConnected);
		this.p1.on("timeout", this.onTimeout);
		this.p1.on("close", this.onClosed);
		this.p1.on("end", this.onClosed);
		this.p1.on("data", this.onData);
		this.p1.on("error", this.onError);
		this.p1.setTimeout(60000);
		Homey.on("unload", this.destroy);

		this.unit.on('settingsUpdate', this.onUnitUpdate);

		this.datagrams = 0;

		this.connect();
		this.keepAlive = setInterval(this.detectProblems, 60000);
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

	onTimeout() {
		// Reconnect
		this.log("Not receiving any datagrams, trying to reconnect");
		this.p1.end();
	}

	// Override GeneralDevice function
	onUnitStateChange(state) {
		// Ignore
	}

	// New IP address for unit
	onUnitUpdate(unit, newSettings) {
		this.p1.end();
	}

	destroy() {
		this.log("Destroying all connections");
		this.connected = null;
		this.p1.removeAllListeners("close", this.onClosed);
		this.p1.destroy();
	}

	// New port number for this device
	onSettings(oldSettings, newSettings, changedKeys, callback) {
		callback();
		if (changedKeys.includes('p1port')) {
			this.errorMSg = null;
			this.p1.end();
		}
	}

	onDeleted() {
		super.onDeleted();
		this.log("Sensor deleted", this.unit.name, this.constructor.name, this.port);

		this.unit.removeListener('settingsUpdate', this.onUnitUpdate);
		this.unit.deleteSensor(this);

		Homey.removeListener("unload", this.destroy)

		clearInterval(this.keepAlive);

		this.destroy();
	}

	connect() {
		if (!this.p1.connecting) {
			this.log("Connecting to P1 server at", this.unit.ip, this.port);
			this.setUnavailable(this.errorMsg ? this.errorMsg : Homey.__("p1.connecting", {
				"port": this.port
			}));
			this.p1.connect({
				"host": this.unit.ip,
				"port": this.port
			});
		}
	}

	onConnected() {
		const server = this.p1.address();
		this.log("Connected to P1 server at", this.unit.ip, this.port);
		this.setUnavailable(this.errorMsg ? this.errorMsg : Homey.__("p1.waiting"));

		this.connected = new Date();
		this.lastDatagram = null;

		// To test if the user entered the HTTP port...
		this.p1.write("GET / HTTP");
	}

	onClosed() {
		this.log("Connection lost");
		this.setUnavailable(this.errorMsg ? this.errorMsg : Homey.__("p1.connection_lost"));
		this.connected = null;
		setTimeout(this.connect, 5000);
	}

	onData(data) {
		if (data.toString().substr(0, 4) == "HTTP") {
			this.log("Connected to HTTP server...");
			this.errorMsg = Homey.__("p1.connected_to_http_server", {
				"port": this.port
			});
			this.setUnavailable(this.errorMsg);
			this.p1.end();
			return;
		} else {
			this.errorMsg = null;
		}

		// Remove CRC16 line because the parser will throw a warning
		// The ESP should have checked this already anyway
		const dg = parsePacket(data.toString().replace(/^![0-9A-F]{4}$/m, ''));

		if (!dg.electricity.received.actual.reading) {
			this.log("Invalid datagram received...", data.toString());
			this.setUnavailable(Homey.__("p1.invalid_datagram", {
				"port": this.port
			}));
			return;
		}

		this.updateHeartbeat();
		this.lastDatagram = new Date();

		if (!this.datagrams++) {
			this.log("First datagram received:\n", data.toString());
		}

		dg.version = (dg.version / 10).toString();

		if (this.getSetting("meterType") != dg.meterType || this.getSetting("P1Version") != dg.version)
			this.setSettings({
				"meterType": dg.meterType,
				"DSMRVersion": dg.version
			});

		// Power usage
		this.setValue("measure_power", dg.electricity.received.actual.reading * 1000);
		this.setValue("meter_power.received1", dg.electricity.received.tariff1.reading);
		this.setValue("meter_power.received2", dg.electricity.received.tariff2.reading);

		// Power surplus
		this.setValue("measure_power.delivery", 0 - dg.electricity.delivered.actual * 1000);
		this.setValue("meter_power.delivered1", dg.electricity.delivered.tariff1.reading);
		this.setValue("meter_power.delivered2", dg.electricity.delivered.tariff2.reading);

		// Active tariff
		this.setValue("alarm_active_tariff", dg.electricity.tariffIndicator.toString());

		// Gas meter
		this.setValue("meter_gas", dg.gas.reading);

		this.setAvailable();
	}

	onError(error) {
		if (typeof error == "string" && error.substr(0, 22) == "Error: write after end")
			return;

		if (error.errno && error.errno == "ECONNRESET") {
			this.log("Connection reset. Previous connection had probably not been closed correctly");
		} else {
			this.log("Error received:", error);
		}
	}

	setValue(capability, value) {
		if (!this.getCapabilities().includes(capability) && value > 0)
			this.addCapability(capability);

		if (this.getCapabilities().includes(capability) && this.getCapabilityValue(capability) != value)
			this.setCapabilityValue(capability, value)
	}

	get port() {
		return this.getSetting('p1port');
	}

}
