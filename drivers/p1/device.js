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

		this.p1.on("connect", this.onConnected.bind(this));
		this.p1.on("timeout", this.onTimeout.bind(this));
		this.p1.on("close", this.onClosed.bind(this));
		this.p1.on("end", this.onClosed.bind(this));
		this.p1.on("data", this.onData.bind(this));
		this.p1.on("error", this.onError.bind(this));
		this.p1.setTimeout(60000);
		Homey.on("unload", this.destroy.bind(this));

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
			// List of all 'optional' capabilities
			const measureCaps = ["measure_power",
				"meter_power.received1",
				"meter_power.received2",
				"measure_power.delivery",
				"meter_power.delivered1",
				"meter_power.delivered2",
				"alarm_active_tariff",
				"meter_gas"
			]
			// Find out which ones are used
			const capabilities = this.getCapabilities().filter(cap => measureCaps.includes(cap));

			let metrics = {
				"Task plugin": '44 - Communication - P1 Wifi Gateway',
				"Task driver": 'p1',
				"Task capabilities": capabilities.sort().join(', ')
			};

			Homey.app.telemetry.send('Sensor', reason, '/device/sensor/p1', metrics);
		} catch (error) {
			this.error('Error sending P1 telemetry:', error);
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
		this.log("Connected to P1 server at", server.address, server.port);
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
		setTimeout(this.connect.bind(this), 5000);
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

		// Multiple datagrams might have been received for some reason
		// Split on lines beginning with /
		let dg = data.toString().split(/^\//).filter(n => n);

		if (dg.length == 0) {
			this.error('Received empty');
			return;
		}

		if (dg.length > 1) {
			this.error('Received multiple datagrams, only using last one', dg.length);
		}
		dg = '/' + dg[dg.length - 1];

		if (!/^![0-9A-F]{4}$/m.test(dg)) {
			this.error('Received corrupt datagrams', dg);
		}

		// Remove CRC16 line because the parser will throw a warning
		// The ESP should have checked this already anyway
		const packet = parsePacket(dg.replace(/^![0-9A-F]{4}$/m, ''));

		if (!packet.electricity.received.actual.reading) {
			this.error("Invalid datagram received...", dg);
			this.setUnavailable(Homey.__("p1.invalid_datagram", {
				"port": this.port
			}));
			return;
		}

		this.updateHeartbeat();
		this.lastDatagram = new Date();

		if (!this.datagrams++) {
			this.debug("First datagram received:\n", packet, dg);
		}

		packet.version = (packet.version / 10).toString();

		if (this.getSetting("meterType") != packet.meterType || this.getSetting("DSMRVersion") != packet.version) {
			this.log('P1 properties changed', packet.meterType, packet.version);
			this.setSettings({
				"meterType": packet.meterType,
				"DSMRVersion": packet.version
			});
		}

		// Power usage
		this.setValue("measure_power", packet.electricity.received.actual.reading * 1000);
		this.setValue("meter_power.received1", packet.electricity.received.tariff1.reading);
		this.setValue("meter_power.received2", packet.electricity.received.tariff2.reading);

		// Power surplus
		this.setValue("measure_power.delivery", 0 - packet.electricity.delivered.actual * 1000);
		this.setValue("meter_power.delivered1", packet.electricity.delivered.tariff1.reading);
		this.setValue("meter_power.delivered2", packet.electricity.delivered.tariff2.reading);

		// Active tariff
		if (packet.electricity.tariffIndicator) {
			this.setValue("alarm_active_tariff", packet.electricity.tariffIndicator.toString());
		}

		// Gas meter
		this.setValue("meter_gas", packet.gas.reading);

		this.setAvailable();
	}

	onError(error) {
		if (typeof error == "string" && error.slice(0, 22) == "Error: write after end")
			return;

		if (error.errno && error.errno == "ECONNRESET") {
			this.log("Connection reset. Previous connection had probably not been closed correctly");
		} else {
			this.error("Error received:", error);
		}
	}

	setValue(capability, value) {
		let hasCapability = this.hasCapability(capability);
		if (!hasCapability && value !== undefined && value > 0) {
			this.addCapability(capability);
			hasCapability = true;
		}

		if (hasCapability && value !== undefined && this.getCapabilityValue(capability) != value)
			this.setCapabilityValue(capability, value)
	}

	get port() {
		return this.getSetting('p1port');
	}

}
