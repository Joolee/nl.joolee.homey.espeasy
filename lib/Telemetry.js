'use strict';

const Homey = require('homey');
const TelemetryDimensions = require('/assets/json/telemetryDimensions.json');
const http = require('http.min');
const util = require('util');

module.exports = class Telemetry extends Homey.SimpleClass {
	constructor({
		host,
		path = '/matomo.php',
		siteId,
		pingTick = 8600,
		updateInterval = [604000, 'Weekly'],
		initialTimeout = 120000
	}) {

		super();
		[this.host, this.path, this.siteId, this.pingTick] = [host, path.replace(/^\//, ''), siteId, pingTick];
		[this.updateInterval, this.initialTimeout] = [updateInterval, initialTimeout];

		// This parameter is still unset during instance construction. Force it
		Homey.app.telemetry = this;

		this.on('__log', Homey.app.log.bind(this, `[${this.constructor.name}]`))
			.on('__error', Homey.app.error.bind(this, `[${this.constructor.name}]`));

		try {
			this._setupDebugging();

			if (!host || !path || !siteId) {
				this.error('Telemetry disabled: no endpoint options found');
				return false;
			}

			this.sendQueue = [];
			this.sending = false;

			this.sendError = this.sendError.bind(this);
			this.fatalError = this.fatalError.bind(this);
			this.send = this.send.bind(this);

			this.log('Using telemetry ID:', this.uid);

			let metrics = {
				// Start a 'new session' when the app starts
				'new_visit': 1,
				'App version': Homey.manifest.version,
				'Homey firmware version': Homey.version,
				'Debug mode': process.env.DEBUG === '1' ? 'true' : 'false'
			}

			this.send('App', 'Started', '/app/start', metrics);

			this._registerErrorHandling();

			this._setupEvents();
		} catch (error) {
			this.error('Error starting app telemetry:', error);
		}
	}

	get uid() {
		let uid = Homey.ManagerSettings.get('telemetryId');

		if (!uid) {
			// 16 semi-random hexadecimal nibbles
			uid = ((new Date()).getTime().toString(16) + Math.random().toString(16).slice(2)).slice(16);
			Homey.ManagerSettings.set('telemetryId', uid);
		}
		return uid;
	}

	_setupEvents() {
		Homey.App.prototype.updateTelemetry = () => {
			this.error("App method 'updateTelemetry' not implemented");
		}

		// Update the telemetry if the app failed to reached 'initialized' status for two minutes
		setTimeout(() => {
			if (!this.appInitialized) {
				this.appInitialized = true;
				Homey.app.updateTelemetry.call(Homey.app, 'Initialize timeout', '/app/initialize-timeout', false);
			}
		}, this.initialTimeout);

		setInterval(Homey.app.updateTelemetry.bind(Homey.app), this.updateInterval[0] * 1000, `${this.updateInterval[1]} update`, '/app/weeklyupdate', true);
		setInterval(this.sendPing.bind(this), this.pingTick * 1000);

		Homey.on('cpuwarn', data => this.sendError('App error', 'CPU Warning', `cpuwarn/${data.limit}/${data.count}`, data));
		Homey.on('memwarn', data => this.sendError('App error', 'Memory Warning', `memwarn/${data.limit}/${data.count}`, data));
		Homey.on('unload', () => this.send('App', 'Unload', `/app/unload`, {}));
	}

	_setupDebugging() {
		Homey.SimpleClass.prototype.isDebugging = function() {
			let env = {};
			try {
				env = require('/env.json');
			} catch (e) {}

			return this.enableDebugging || env['DEBUG_ALL'] === 'true' || env[`DEBUG_${this.constructor.name.toUpperCase()}`] === 'true';
		}

		Homey.SimpleClass.prototype.debug = function(...args) {
			if (this.isDebugging()) {
				this.log('\x1b[33mDebug:\x1b[0m', ...args.map((arg, i) => arg === Object(arg) ? '{' + typeof(arg) + i + '}' : arg));
				args.forEach((arg, i) => arg === Object(arg) ? console.log(typeof(arg) + i + ':', arg) : null);
			}
		}
	}

	_registerErrorHandling() {
		this.sendErrors = process.env.DEBUG !== '1' || Homey.env.TELEMETRY_FORCE_ERRORS === 'true';

		// Preserve original console.error
		this.console = console;

		// Catch console.error messages
		console.error = function(error) {
			if (!arguments[0] || arguments[0].includes('INSPECTOR_ASYNC_STACK_TRACES_NOT_AVAILABLE')) {
				return;
			}

			this.call(console, ...arguments);
			if (Homey.app.telemetry.sendErrors) {
				Homey.app.telemetry.sendError('App', 'Console error', 'console', Array.from(arguments));
			}
		}.bind(console.error);

		// Catch application errors
		if (this.sendErrors) {
			process.on('uncaughtException', (err, origin) => this.fatalError('Unhandled Exception', 'uncaughtException', [err, origin]))
				.on('unhandledRejection', (reason, promise) => this.fatalError('Unhandled Rejectionn', 'unhandledRejection', [reason, promise]));
		}
	}

	fatalError(reason, name, errors) {
		this.console.error('Fatal Error: ', ...arguments);
		this.sendError('Fatal Error', ...arguments);
		setTimeout(() => process.exit(1), 1500).unref();
	}

	sendError(source, reason, name, errors) {
		return this.send(source, reason, `/error/${name}`, {
			e_c: source,
			e_a: reason,
			e_n: util.inspect(errors, false, 3)
		}, true);
	}

	sendPing() {
		return this.send('App', 'Daily Ping', '/ping', {
			ping: 1
		}, true);
	}

	_sendNextQueued() {
		const item = this.sendQueue.shift();
		if (item) {
			item.push(true); // set forceSend parameter to true
			this.send(...item);
		} else {
			this.sending = false;
		}
	}

	send(source, reason, url, metrics, forceSend = false) {
		// Makes sure there is a minimum amount of time between 'send' calls
		// Prevents server from messing up the order of messages
		if (this.sending && !forceSend) {
			this.sendQueue.push([source, reason, url, metrics]);
			return;
		}

		this.sending = true;
		const now = new Date();
		try {
			url = url.replace(/^\//, '');
			metrics = {
				// url is needed for a ping request, action is simply ignored!
				action_name: `${source} / ${reason}`,
				url: `https://${this.host}/${url}`,
				...metrics,
				uid: this.uid,
				idsite: this.siteId,

				lang: Homey.ManagerI18n.getLanguage(),
				rec: 1,
				bots: 1,
				apiv: 1,
				send_image: 0,
				h: now.getHours(),
				m: now.getMinutes(),
				s: now.getSeconds()
			};

			const query = this._mapDimensions(metrics);
			if (this.isDebugging()) {
				this.debug(`Sending telemetry '${metrics['action_name']}'`, metrics, query);
			} else {
				this.log(`Sending telemetry '${metrics['action_name']}'`, source, reason);
			}

			http.get({
				uri: `https://${this.host}/${this.path}`,
				query: query
			}).catch((result) => {
				this.console.error('Telemetry http error', result);
			}).finally(() => {
				setTimeout(this._sendNextQueued.bind(this), 500);
			});
		} catch (error) {
			this.console.error('Error sending telemetry:', error);
		}
	}

	// Uses the assets/json/telemetryDimensions.json file to map dimension names to numbers
	_mapDimensions(metrics) {
		let query = {};
		for (const [key, value] of Object.entries(metrics)) {
			const dimensionKey = TelemetryDimensions.indexOf(key);
			if (dimensionKey > -1) {
				query[`dimension${dimensionKey}`] = value;
			} else if (String(key).indexOf(' ') !== -1) {
				this.error('Unsupported metric', key);
			} else {
				query[key] = value;
			}
		}
		return query;
	}
}
