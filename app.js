'use strict';

const Homey = require('homey');
const ESPEasyUnits = require('./lib/ESPEasyUnits.js');

class ESPEasy extends Homey.App {

	onInit() {
		this.units = new ESPEasyUnits();
		this.log('App started');
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