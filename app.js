'use strict';

const Homey = require('homey');
const ESPEasyUnits = require('./lib/ESPEasyUnits.js');

class ESPEasy extends Homey.App {

	onInit() {
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

}

module.exports = ESPEasy;