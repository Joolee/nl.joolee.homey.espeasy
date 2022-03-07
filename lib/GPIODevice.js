'use strict';

const Homey = require('homey');
const GeneralDevice = require('/lib/GeneralDevice.js');

module.exports = class GPIODevice extends GeneralDevice {
	onInit() {
		super.onInit();
		this.id = this.getData().pin;
		this.capability = this.getCapabilities()[0];
		this.capabilityProperties = Homey.app.getCapability(this.capability);
		this.pinType = this.getDriver().pinType;

		this.unit.addGPIO(this);

		this.removeAllListeners('__log').removeAllListeners('__error');
		this.on('__log', (...props) => {
			this.getDriver().log.bind(this, `[${this.unit.name}/${this.id}]`)(...props);
		}).on('__error', (...props) => {
			this.getDriver().error.bind(this, `[${this.unit.name}/${this.id}]`)(...props);
		});

		this.set = this.set.bind(this);
		this._onPinUpdate = this._onPinUpdate.bind(this);
		this._onBoardTypeChanged = this._onBoardTypeChanged.bind(this);
		this._initialize = this._initialize.bind(this);

		this.unit.on('pinUpdate', this._onPinUpdate);
		this.unit.on('boardTypeChanged', this._onBoardTypeChanged);

		// Defer further initialization until the board is on-line
		this.unit.updateJSON(true, this._initialize);
	}

	_initialize() {
		this._onBoardTypeChanged()
		this.log('Init:', this.unit.name, this.id);
		this.unit.getPinStatus(this.id);
		this.startPoller();
		this.registerCapabilityListener(this.capability, this.set);
	}

	startPoller() {
		let pollInterval = this.getSetting('pollInterval');
		if (!pollInterval || pollInterval < 5) {
			pollInterval = 60;
		}
		pollInterval += Math.random() - 0.5;
		this.poller = setInterval(() => {
			this.unit.getPinStatus(this.id, true);
		}, pollInterval * 1000);
	}

	updateTelemetry(reason, recurse) {
		try {
			let metrics = {
				"Task plugin": 'GPIO',
				"Task driver": this.getDriver().id,
				"Task capabilities": this.capability
			};

			Homey.app.telemetry.send('GPIO', reason, '/device/gpio/' + this.getDriver().id, metrics);
		} catch (error) {
			this.error('Error sending GPIO telemetry:', error);
		}
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

	_onBoardTypeChanged() {
		this.properties = this.unit.getPinList().find(pin => pin.id == this.id);
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
			this.log(`Pin ${this.id} has no previous state, initializing as ${this.pinType}`);
			this.initPin();
		} else if (!this.getDriver().pinModes[this.pinType].includes(pinStatus.mode.toLowerCase())) {
			this.log(`Pin ${this.id} was ${pinStatus.mode} initializing to ${Homey.__('gpio.names.' + this.pinType)}`);
			new Homey.Notification({
					"excerpt": Homey.__('gpio.pinmodewarning', {
						"pin": this.unit.name + " - " + this.id,
						"frommode": pinStatus.mode,
						"tomode": Homey.__('gpio.names.' + this.pinType)
					})
				})
				.register()
				.catch(e => {
					// User might have disabled notifications
					this.log('Failed to create notification', e);
				});
			this.initPin();
		} else if (typeof(this.onPinUpdate) == 'function') {
			this.onPinUpdate(pinStatus);
		}
	}
}
