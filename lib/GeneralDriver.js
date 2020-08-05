'use strict';

const Homey = require('homey');

module.exports = class GeneralDriver extends Homey.Driver {
	onInit() {
		this.actions = {};
	}

	expandCapabilities(fnValidate = this.isValidCapability, onlyVisible = false) {
		let capabilities = {};
		let allCapabilities = {};

		if (typeof fnValidate == "string") {
			allCapabilities[fnValidate] = Homey.app.getCapability(fnValidate);
			fnValidate = () => true;
		} else {
			allCapabilities = Homey.app.getCapabilities();
		}

		for (let [key, value] of Object.entries(allCapabilities)) {
			if (fnValidate(value) && (!onlyVisible || value.uiComponent !== null)) {
				// Prepend primary capability
				if (this.primaryCapability && key == this.primaryCapability) {
					capabilities = Object.assign({
						[key]: Homey.app.getI18nString(value.title)
					}, capabilities);
				} else {
					capabilities[key] = Homey.app.getI18nString(value.title);
				}
			}
		}

		return capabilities;
	}

	addActionFlow(action, fnName, autocompletes = {}) {
		this.actions[action] = new Homey.FlowCardAction(action);
		this.actions[action]
			.register()
			.registerRunListener(async (args, state) => {
				if (typeof args.device === "undefined") {
					return Promise.reject(Homey.__("offline"));
				} else if (typeof args.device[fnName] == "function") {
					return args.device[fnName](args, state);
				} else {
					return Promise.reject("Could not find function '" + fnName + "' in device.js");
				}
			});

		for (const [argName, fnName] of Object.entries(autocompletes)) {
			this.log("Register", argName, fnName);
			this.actions[action]
				.getArgument(argName)
				.registerAutocompleteListener(async (query, args) => {
					if (typeof args.device === "undefined") {
						this.log("AutocompleteListener: Device not available");
						return Promise.reject(Homey.__("offline"));
					} else if (typeof args.device[fnName] == "function") {
						return args.device[fnName](args, query);
					} else {
						this.log("Could not find function '" + fnName + "' in device.js");
						return Promise.reject("Could not find function '" + fnName + "' in device.js");
					}
				})
		}
	}
}