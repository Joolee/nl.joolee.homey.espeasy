'use strict';

const Homey = require('homey');
const ESPEasyUnits = require('./lib/ESPEasyUnits.js');
const HomeyLib = require('homey-lib');

class ESPEasy extends Homey.App {

	onInit() {
		this.actions = {};
		this.units = new ESPEasyUnits();
		this.log('App started');

		process.on('unhandledRejection', (reason, p) => {
			this.log("Unhandled Rejection at:", p);
			this.log("Rejection reason:", reason);
			this.log("Rejection stack:", reason.stack);
		});
	}

	getI18nString(i18n) {
		const lang = Homey.ManagerI18n.getLanguage();
		if (i18n[lang])
			return i18n[lang];
		else
			return i18n['en'];
	}

	// Re-implement Homeylib.getCapability to include custom capabilities
	getCapability(capability) {
		try {
			return HomeyLib.getCapability(capability);
		} catch (error) {
			// Resolve custom capability
			return require("/app.json")["capabilities"][capability];
		}
	}

	// Re-implement Homeylib.getCapabilities to include custom capabilities
	getCapabilities() {
		const defaultCapabilities = HomeyLib.getCapabilities();
		const customCapabilities = require("/app.json")["capabilities"];

		return { ...defaultCapabilities, ...customCapabilities };
	}
}

module.exports = ESPEasy;