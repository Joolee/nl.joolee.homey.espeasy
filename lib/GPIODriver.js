'use strict';

const GeneralDriver = require('./GeneralDriver.js');
const Homey = require('homey');

module.exports = class GPIODriver extends GeneralDriver {
	onInit() {
		super.onInit();
		// Pre-bind functions that get passed around
		this.pair_getOnlineUnits = this.pair_getOnlineUnits.bind(this);
		this.pair_getUnitPins = this.pair_getUnitPins.bind(this);
		this.pair_getPinProperties = this.pair_getPinProperties.bind(this);
		this.pair_getCapabilities = this.pair_getCapabilities.bind(this);

		// Modes we can expect pins to be in for certain types
		// https://github.com/letscontrolit/ESPEasy/blob/9538a7198aa07a64ce53bf6e35a1d7bd35dea817/src/Misc.ino#L690
		this.pinModes = {
			'bool': ['output'],
			'pulse': ['output'],
			'pwm': ['pwm'],
			'servo': ['servo'],
			'tone': ['output'],
			'rtttl': ['output'],
			'input': ['input', 'input pullup']
		}
	}

	onPair(socket) {
		socket.on('getOnlineUnits', this.pair_getOnlineUnits);
		socket.on('getUnitPins', this.pair_getUnitPins);
		socket.on('getPinProperties', this.pair_getPinProperties);
		socket.on('getCapabilities', this.pair_getCapabilities)
	}

	pair_getOnlineUnits(data, callback) {
		this.log('Online units requested');
		const onlineUnits = [];

		for (const onlineUnit of this.homey.app.units.getOnline()) {
			onlineUnits.push({
				"name": onlineUnit.name,
				"idx": onlineUnit.idx,
				"host": onlineUnit.hostname,
				"port": onlineUnit.port,
				"mac": onlineUnit.mac
			});
		}

		callback(null, onlineUnits);
	}

	pair_getUnitPins(data, callback) {
		const unit = this.homey.app.units.findUnit(data.unit.mac, data.unit.host, data.unit.port);
		this.log('PinList requested for unit', unit.name, 'type', data.pinType);

		// Shallow clone the individual objects to prevent making changes to the original 
		let pinList = [];

		for (let oGroup of unit.getPinList(true)) {
			let group = {
				"name": oGroup.name,
				"pins": []
			};

			for (let oPin of oGroup.pins) {
				let pin = {
					...oPin
				};

				if (unit.getGPIO(pin.id)) {
					pin.enabled = false;
				} else if (!pin.commands[data.pinType]) {
					pin.enabled = false;
				}
				group.pins.push(pin);
			}
			pinList.push(group);
		}

		callback(null, pinList);
	}

	pair_getPinProperties(data, callback) {
		this.log('Pin properties requested', data.unit.name, data.pin);
		const unit = this.homey.app.units.findUnit(data.unit.mac, data.unit.host, data.unit.port, false);

		if (!unit) {
			callback('Unit not found');
			return
		}

		unit.getPinStatus(data.pin, false, (error, pinStatus) => {
			if (error) {
				this.log('getPinStatus failed', error);
				callback(error);
				return
			}
			if (pinStatus == null) {
				pinStatus = {
					"mode": "default",
					"typeWarning": false
				}
			} else {
				// Give warning when pin is not of expected type
				pinStatus.typeWarning = !this.pinModes[this.pinType].includes(pinStatus.mode);
			}

			callback(null, pinStatus);
		});
	}

	pair_getCapabilities(data, callback) {
		callback(null, this.expandCapabilities(this.isValidCapability, true));
	}
}
