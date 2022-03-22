Homey.showLoadingOverlay();
Homey.setTitle(__('pair.p1.title'));

$(document).ready(() => {
	// Fetch selected device in undocumented way. This can break!
	if (window.selected_devices[0]) {
		window.device = JSON.parse(window.selected_devices[0]);
	}

	if (!window.device) {
		Homey.alert(Homey.__('pair.sensor.device_not_found'), 'error');
		Homey.done();
		return;
	}

	console.log(window.device);

	$("#p1description").html(Homey.__("pair.p1.description", {
		"esp-ip": window.device.unit.host
	}));

	Homey.hideLoadingOverlay();
});

// Override "next" button. This can break!
document.body.addEventListener('click', (event) => {
	let targets = ['hy-nav-next', 'hy-nav-continue'];
	if (Homey.getCurrentView() != "settings" || (!targets.includes(event.target.id) && !targets.includes(event.target.parentNode.id))) {
		return;
	}

	event.stopImmediatePropagation();

	Homey.showLoadingOverlay();

	let device = {
		"name": window.device.name,
		"data": {
			"unit": window.device.unit.mac,
			"taskid": window.device.taskid
		},
		"settings": {
			"mac": window.device.unit.mac,
			"host": window.device.unit.host + ':' + window.device.unit.port,
			"idx": window.device.unit.idx.toString(),
			"taskid": window.device.taskid.toString()
		}
	}

	// Collect extra settings
	$('.hy-view.visible input').each((index, element) => {
		if (element.type == "number")
			device.settings[element.id] = parseInt(element.value);
		else
			device.settings[element.id] = element.value;
	});

	console.log(device);

	Homey.createDevice(device, (error) => {
		if (error) {
			Homey.alert(error, "error");
			Homey.hideLoadingOverlay();
		} else {
			Homey.done();
		}
	});

	return false;
}, true);
