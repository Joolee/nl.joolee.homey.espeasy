Homey.showLoadingOverlay();
$(document).ready(() => {
	pinType = $('#pinProperties').data('pintype');
	Homey.setTitle(__('pair.gpio.' + pinType + '.title'));

	Homey.emit('getOnlineUnits', null, (error, onlineUnits) => {
		if (error) {
			Homey.alert(error, 'error');
			Homey.hideLoadingOverlay();
			return;
		}

		for (const onlineUnit of onlineUnits) {
			$('#unitList').append(
				$('<option>')
				.text(onlineUnit.idx + ': ' + onlineUnit.name)
				.data('unit', onlineUnit)
			);
		}

		if (onlineUnits.length == 1) {
			$('#unitList').children('option').last().prop('selected', true).parent().change();
		} else {
			Homey.hideLoadingOverlay();
		}
	});

	// Only request capabilities if there is a selection list
	if ($('#capabilityList').length) {
		Homey.emit('getCapabilities', {
			'direction': 'output',
			'pinType': pinType
		}, (error, capabilities) => {
			if (error) {
				Homey.alert(error, 'error');
				return;
			}

			for (const [capability, title] of Object.entries(capabilities)) {
				$('#capabilityList').append(
					$('<option>')
					.text(title)
					.val(capability)
				);
			}
		});
	}

	$('#unitList').on("change", (event) => {
		const unit = $('#unitList :selected').data('unit');

		if (unit) {
			Homey.showLoadingOverlay();
			Homey.emit('getUnitPins', {
				'unit': unit,
				'pinType': $('#pinProperties').data('pintype')
			}, (error, pinGroups) => {
				if (error) {
					Homey.alert(error, 'error');
					Homey.hideLoadingOverlay();
					return;
				}

				$('#pinList optgroup').remove();

				for (let group of pinGroups) {
					let optGroup = $("<optgroup>")
						.attr("label", group.name)
						.appendTo("#pinList");

					for (let pin of group.pins) {
						console.log(pin);

						if (!pin.visible)
							continue;

						let name = pin.name;
						if (pin.description)
							name += " (" + pin.description + ")";
						if (pin.warning)
							name += ' ⚠';

						optGroup.append(
							$('<option>')
							.text(name)
							.data('pin', pin)
							.prop('disabled', !pin.enabled)
						);
					}
				}
				$('#pinProperties').show();
				Homey.hideLoadingOverlay();
			});
		}
	});

	$('#pinList').on("change", (event) => {
		const unit = $('#unitList :selected').data('unit');
		const pin = $('#pinList :selected').data('pin');
		const pinType = $('#pinProperties').data('pintype');

		if (pin) {
			Homey.emit('getPinProperties', {
				"unit": unit,
				"pin": pin.id
			}, (error, data) => {
				if (error) {
					console.log('Error getting Pin Properties:', error);
					return;
				}

				const mode = data.mode.toLowerCase();
				if (data.typeWarning) {
					$('#pinWarning')
						.show()
						.children(':not(.fa)')
						.text(Homey.__('pair.gpio.pin_warning', {
							'mode': mode
						}));
				} else {
					$('#pinWarning')
						.hide();
				}

				if (data.mode == 'default') {
					$('#pinHint')
						.show()
						.children(':not(.fa)')
						.text(Homey.__('pair.gpio.pin_mode_default'));
				} else {
					$('#pinHint').hide();
				}
			});
		} else {
			$('#pinHint').hide();
		}
	});
});

// Override "next" button. This can break!
document.body.addEventListener('click', (event) => {
	if (event.target.id != "hy-nav-next" && event.target.parentNode.id != "hy-nav-next") {
		return;
	}

	event.stopImmediatePropagation();

	const unit = $('#unitList :selected').data('unit');
	const pin = $('#pinList :selected').data('pin');
	if (!unit) {
		Homey.alert(Homey.__('pair.gpio.error.unit'), "error");
		return false;
	}
	if (!pin) {
		Homey.alert(Homey.__('pair.gpio.error.pin'), "error");
		return false;
	}

	Homey.showLoadingOverlay();

	let device = {
		"name": unit.name + ' - ' + pin.name,
		"data": {
			"unit": unit.mac,
			"pin": pin.id
		},
		"settings": {
			"mac": unit.mac,
			"host": unit.host + ':' + unit.port,
			"idx": unit.idx.toString()
		},
		capabilities: []
	}

	if ($('#capabilityList').length) {
		device.capabilities.push($('#capabilityList :selected').val());
	}

	// Collect extra settings
	$('input').each((index, element) => {
		if (element.type == "number")
			device.settings[element.id] = parseInt(element.value);
		else
			device.settings[element.id] = element.value;
	});

	if ($.isPlainObject(device)) {
		Homey.createDevice(device, (error) => {
			if (error) {
				Homey.alert(error, "error");
				Homey.hideLoadingOverlay();
			} else {
				Homey.done();
			}
		});
	} else {
		Homey.alert(device, "error");
		Homey.hideLoadingOverlay();
	}
	return false;
}, true);
