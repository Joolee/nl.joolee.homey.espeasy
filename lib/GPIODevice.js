'use strict';

const Homey = require('homey');
const pinList = require('/lib/pinList.json');
const GeneralDevice = require('/lib/GeneralDevice.js');
const HomeyLib = require('homey-lib');

module.exports = class GPIODevice extends GeneralDevice {
	onInit() {
		super.onInit();
		this.id = this.getData().pin;
		this.properties = pinList[this.id];
		this.capability = this.getCapabilities()[0];
		this.capabilityProperties = HomeyLib.getCapability(this.capability);
		this.pinType = this.getDriver().pinType;

		this.unit.addGPIO(this);

		this._onPinUpdate = this._onPinUpdate.bind(this);
		this.unit.on('pinUpdate', this._onPinUpdate);
		this.unit.getPinStatus(this.id);

		this.set = this.set.bind(this);
		this.registerCapabilityListener(this.capability, this.set);

		this.log('Init:', this.unit.name, this.id);
		this.startPoller();
	}

	startPoller() {
		let pollInterval = this.getSetting('pollInterval');
		if (!pollInterval || pollInterval < 5) {
			pollInterval = 60;
		}
		this.poller = setInterval(() => {
			this.unit.getPinStatus(this.id, true);
		}, pollInterval * 1000);
	}

	onSettings(oldSettings, newSettings, changedKeys, callback) {
		if (changedKeys.includes('pollInterval')) {
			clearInterval(this.poller);
			this.startPoller();
		}

		this.initPin();
		callback();
	}

	onDeleted() {
		super.onDeleted();
		this.log("Device deleted", this.unit.name, this.id);
		clearInterval(this.poller);
		this.unit.removeListener('pinUpdate', this._onPinUpdate);
		this.unit.deleteGPIO(this);
	}

	_onPinUpdate(unit, pin, error, pinStatus) {
		if (pin != this.id)
			return;

		if (error) {
			this.setUnavailable(error);
			return;
		} else {
			this.setAvailable();
		}

		if (!pinStatus) {
			this.log('Pin', this.id, 'has no previous state, initializing as ' + this.pinType);
			this.initPin();
		} else if (!this.getDriver().pinModes[this.pinType].includes(pinStatus.mode.toLowerCase())) {
			this.log('Pin', this.id, 'was', pinStatus.mode, 'initializing to', Homey.__('gpio.names.' + this.pinType));
			new Homey.Notification({
				"excerpt": Homey.__('gpio.pinmodewarning', {
					"pin": this.unit.name + " - " + this.id,
					"frommode": pinStatus.mode,
					"tomode": Homey.__('gpio.names.' + this.pinType)
				})
			}).register();
			this.initPin();
		} else if (typeof (this.onPinUpdate) == 'function') {
			this.onPinUpdate(pinStatus);
		}
	}
}