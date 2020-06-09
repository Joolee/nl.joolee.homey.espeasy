'use strict';

const Homey = require('homey');
const HomeyLib = require('homey-lib');

module.exports = class GeneralDriver extends Homey.Driver {
	onInit() {
	}

	expandCapabilities(fnValidate = this.isValidCapability) {
		let capabilities = {};
		let allCapabilities = {};

		if (typeof fnValidate == "string") {
			allCapabilities[fnValidate] = HomeyLib.getCapability(fnValidate)
			fnValidate = () => true;
		} else {
			allCapabilities = HomeyLib.getCapabilities()
		}

		for (let [key, value] of Object.entries(allCapabilities)) {
			if (fnValidate(value)) {
				// Prepend primary capability
				if (this.primaryCapability && key == this.primaryCapability) {
					capabilities = Object.assign({ [key]: Homey.app.getI18nString(value.title) }, capabilities);
				} else {
					capabilities[key] = Homey.app.getI18nString(value.title);
				}
			}
		}

		return capabilities;
	}
}