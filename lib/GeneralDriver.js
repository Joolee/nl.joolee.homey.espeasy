'use strict';

const Homey = require('homey');

module.exports = class GeneralDriver extends Homey.Driver {
	onInit() {}

	expandCapabilities(fnValidate = this.isValidCapability, onlyVisible = false) {
		let capabilities = {};
		let allCapabilities = {};

		if (typeof fnValidate == "string") {
			let capability = this.homey.app.getCapability(fnValidate);
			if (!capability) {
				this.error(`Cannot find capability ${fnValidate}`);
			} else {
				allCapabilities[fnValidate] = capability;
				fnValidate = () => true;
			}
		} else {
			allCapabilities = this.homey.app.getCapabilities();
		}

		for (let [key, value] of Object.entries(allCapabilities)) {
			if (fnValidate(value) && (!onlyVisible || value.uiComponent !== null)) {
				// Prepend primary capability
				if (this.primaryCapability && key == this.primaryCapability) {
					capabilities = Object.assign({
						[key]: this.homey.app.getI18nString(value.title)
					}, capabilities);
				} else {
					capabilities[key] = this.homey.app.getI18nString(value.title);
				}
			}
		}

		return capabilities;
	}

	addTriggerFlow(trigger) {
		this.homey.app.triggers[trigger] = this.homey.flow.getDeviceTriggerCard(trigger);
	}

	triggerFlow(device, trigger, tokens = {}) {
		if (this.homey.app.triggers[trigger]) {
			this.log("Run trigger:", trigger, tokens);
			this.homey.app.triggers[trigger]
				.trigger(device, tokens)
				.catch(this.log);
		} else {
			this.log("Flow trigger not registered:", trigger);
		}
	}

	addActionFlow(action, fnName, autocompletes = {}) {
		this.homey.app.actions[action] = this.homey.flow.getActionCard(action);
		this.homey.app.actions[action]
			.registerRunListener(async (args, state) => {
				if (typeof args.device === "undefined") {
					return Promise.reject(this.homey.__("offline"));
				} else if (typeof args.device[fnName] == "function") {
					return args.device[fnName](args, state);
				} else {
					return Promise.reject("Could not find function '" + fnName + "' in device.js");
				}
			});

		for (const [argName, fnName] of Object.entries(autocompletes)) {
			this.homey.app.actions[action]
				.getArgument(argName)
				.registerAutocompleteListener(async (query, args) => {
					if (typeof args.device === "undefined") {
						this.log("AutocompleteListener: Device not available");
						return Promise.reject(this.homey.__("offline"));
					} else if (typeof args.device[fnName] == "function") {
						this.log("Run action:", fnName, args);
						return args.device[fnName](args, query);
					} else {
						this.log("Could not find function '" + fnName + "' in device.js");
						return Promise.reject("Could not find function '" + fnName + "' in device.js");
					}
				})
		}
	}
}
