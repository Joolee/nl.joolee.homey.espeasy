'use strict';

const Homey = require('homey');
const TelemetryDimensions = require('../assets/json/telemetryDimensions.json');
const http = require('http.min');
const util = require('util');

/*
	/assets/json/telemetryDimensions.json must contain at least:
	["-"
		"App version",
		"Homey firmware version",
		"Debug mode"
	]

	These value locations (in this case, 1, 2 and 3) must also be defined as Matomo Custom Dimensions (type 'Visit') with corresponding ID's.
*/

module.exports = class Telemetry extends Homey.SimpleClass {
	constructor({
		host,
		path = '/matomo.php',
		siteId,
		pingTick = 8600,
		updateInterval = [604000, 'Weekly'],
		initialTimeout = 120000,
		enabled = true,
		app
	}) {

		super();
		[this.host, this.path, this.siteId, this.pingTick, this.app] = [host, path.replace(/^\//, ''), siteId, pingTick, app];
		[this.updateInterval, this.initialTimeout, this.enabled] = [updateInterval, initialTimeout, enabled];

		// 'enabled' disables loading any telemetry for whole app run (Disabled by programmer)
		// 'userDisabled' disables sending telemetry and can be changed on-the-fly (Disabled by user)
		this.userDisabled = this.disabledByUser();

		// Preserve original console.error
		this.console = console;

		// This parameter is still unset during instance construction. Force it
		this.app.telemetry = this;

		this.on('__log', this.app.log.bind(this, `[${this.constructor.name}]`))
			.on('__error', this.app.error.bind(this, `[${this.constructor.name}]`));

		try {
			this._setupDebugging();

			if (!host || !path || !siteId) {
				this.error('Disabled: no endpoint options found');
				this.enabled = false;
				return false;
			} else if (!enabled || this.env['TELEMETRY_ENABLED'] === "false") {
				this.log('Disabled by programmer');
				this.enabled = false;
				return;
			}

			this.sendQueue = [];
			this.sending = false;

			this.sendError = this.sendError.bind(this);
			this.fatalError = this.fatalError.bind(this);
			this.send = this.send.bind(this);

			this.log(`ID: ${this.uid}, Server: ${host}`);

			let metrics = {
				// Start a 'new session' when the app starts
				'new_visit': 1,
				'App version': this.app.homey.manifest.version,
				'Homey firmware version': this.app.homey.version,
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
		let uid = this.app.homey.settings.get('telemetryId');

		if (!uid) {
			// 16 semi-random hexadecimal nibbles
			uid = ((new Date()).getTime().toString(16) + Math.random().toString(16).slice(2)).slice(0, 16);
			this.app.homey.settings.set('telemetryId', uid);
		}

		// A smart developer can set their own 'username' but cid must be 16 char hex
		if (!this.cid) {
			this.cid = uid;
			if (!/^[0-9a-zA-Z]{16}$/.test(this.cid)) {
				this.cid = Array.from(this.uid).reduce((p, c) => p + c.charCodeAt(0).toString(16), '').slice(0, 16).padEnd(16, 0);
			}
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
				this.app.updateTelemetry.call(this.app, 'Initialize timeout', '/app/initialize-timeout', false);
			}
		}, this.initialTimeout);

		setInterval(this.app.updateTelemetry.bind(this.app), this.updateInterval[0] * 1000, `${this.updateInterval[1]} update`, '/app/weeklyupdate', true);
		setInterval(this.sendPing.bind(this), this.pingTick * 1000);

		this.app.homey.on('cpuwarn', data => this.sendError('App error', 'CPU Warning', `cpuwarn/${data.limit}/${data.count}`, data));
		this.app.homey.on('memwarn', data => this.sendError('App error', 'Memory Warning', `memwarn/${data.limit}/${data.count}`, data));
		this.app.homey.on('unload', () => this.send('App', 'Unload', `/app/unload`, {}));
	}

	_setupDebugging() {
		this.env = {};
		try {
			this.env = require('../env.json');
		} catch (e) {}

		Homey.SimpleClass.prototype.isDebugging = function() {
			let env = {};
			try {
				env = require('../env.json');
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
		this.sendErrors = process.env.DEBUG !== '1' || this.env['TELEMETRY_FORCE_ERRORS'] === 'true';

		// Catch console.error messages
		console.error = function(app, error) {
			// Remove the 'app' argument from the argument array on copy
			const realargs = Array.prototype.slice.call(arguments, 1);

			if (!realargs[0] || realargs[0].includes('INSPECTOR_ASYNC_STACK_TRACES_NOT_AVAILABLE')) {
				return;
			}

			this.call(console, ...realargs);
			if (app.telemetry.sendErrors) {
				// Strip date, [err], 'device uuid' and IP addresses from message
				const error = Array.from(realargs).filter(arg => {
					return !/^[0-9-]{10} [0-9:]{8}$/.test(String(arg)) &&
						String(arg) != '[err]' &&
						!/^\[[a-f0-9-]{36}\]$/.test(String(arg))
				}).map(err => String(err).replace(/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/g, '[ip]'));

				this.app.telemetry.sendError('App', 'Console error', 'console', error);
			}
		}.bind(console.error, this.app);

		// Catch application errors
		if (this.sendErrors) {
			process.on('uncaughtException', (err, origin) => this.fatalError('Unhandled Exception', 'uncaughtException', [err, origin]))
				.on('unhandledRejection', (reason, promise) => this.fatalError('Unhandled Rejection', 'unhandledRejection', [reason, promise]));
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

	disabledByUser() {
		return (typeof(this.app.telemetryEnabled) === 'function' && !this.app.telemetryEnabled())
	}

	send(source, reason, url, metrics, forceSend = false) {
		const origMetrics = metrics;
		if (!this.enabled || this.disabledByUser()) {
			this.log(this.enabled ? '[Disabled by user]' : '[Disabled by programmer]', `${source} / ${reason}`, url);

			// If telemetry is just disabled, send notice and stop all Telemetry after
			if (this.enabled && !this.userDisabled) {
				source = 'App';
				reason = 'Telemetry disabled';
				url = '/app/telemetry/disabled';
				metrics = {
					e_c: source,
					e_a: reason
				};
				forceSend = true;
				this.userDisabled = true;
			} else {
				return;
			}
		} else if (this.userDisabled) {
			// If telemetry just enabled, send notice
			this.userDisabled = false;
			this.send('App', 'Telemetry enabled', '/app/telemetry/enabled', {
				e_c: 'App',
				e_a: 'Telemetry enabled'
			}, true);
		}

		// Makes sure there is a minimum amount of time between 'send' calls
		// Prevents server from messing up the order of messages
		if (this.sending && !forceSend) {
			if (this.sendQueue.length < 100) {
				this.sendQueue.push([source, reason, url, metrics]);
			}
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
				cid: this.cid,
				idsite: this.siteId,

				lang: this.app.homey.i18n.getLanguage(),
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
				this.debug(`Sending '${metrics['action_name']}'`, metrics, query);
			} else {
				this.log(`Sending '${metrics['action_name']}':`, url);
			}

			http.get({
				uri: `https://${this.host}/${this.path}`,
				query: query
			}).then(() => {
				clearTimeout(this.queueTimeout);
				this.queueTimeout = setTimeout(this._sendNextQueued.bind(this), 500);
			}).catch((error) => {
				this.log('Telemetry http error', error.code);
				if (this.sendQueue.length < 100) {
					this.sendQueue.unshift([source, reason, url, origMetrics]);
					clearTimeout(this.queueTimeout);
					this.queueTimeout = setTimeout(this._sendNextQueued.bind(this), 50000);
				} else {
					this.console.error('Telemetry HTTP error, queue now >100', error.code);
					this.enabled = false;
					setTimeout(() => {
						this.log('Re-enabling telemetry. Might work now');
						this.enabled = true
					}, 3600 * 6);
				}
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
