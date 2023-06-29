'use strict';

const Homey = require('homey');
const GeneralDevice = require('./GeneralDevice.js');

module.exports = class GPIODevice extends GeneralDevice {
	onInit() {
		super.onInit();
		this.id = this.getData().pin;
		this.capability = this.getCapabilities()[0];
		this.capabilityProperties = this.homey.app.getCapability(this.capability);
		this.pinType = this.driver.pinType;

		this.unit.addGPIO(this);

		this.removeAllListeners('__log').removeAllListeners('__error');
		this.on('__log', (...props) => {
			this.driver.log.bind(this, `[${this.unit.name}/${this.id}]`)(...props);
		}).on('__error', (...props) => {
			this.driver.error.bind(this, `[${this.unit.name}/${this.id}]`)(...props);
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
				"Task driver": this.driver.id,
				"Task capabilities": this.capability
			};

			this.homey.app.telemetry.send('GPIO', reason, '/device/gpio/' + this.driver.id, metrics);
		} catch (error) {
			this.error('Error sending GPIO telemetry:', error);
		}
	}

	onSettings({ changedKeys }) {
		if (changedKeys.includes('pollInterval')) {
			clearInterval(this.poller);
			this.startPoller();
		}

		this.initPin();
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
		} else if (!this.driver.pinModes[this.pinType].includes(pinStatus.mode.toLowerCase())) {
			this.log(`Pin ${this.id} was ${pinStatus.mode} initializing to ${this.homey.__('gpio.names.' + this.pinType)}`);
			new this.homey.notifications.createNotification({
					"excerpt": this.homey.__('gpio.pinmodewarning', {
						"pin": this.unit.name + " - " + this.id,
						"frommode": pinStatus.mode,
						"tomode": this.homey.__('gpio.names.' + this.pinType)
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
