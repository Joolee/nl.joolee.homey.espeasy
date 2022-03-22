function find_unit() {
	Homey.showLoadingOverlay();

	$(document).ready(() => {
		Homey.setTitle(__("pair.unit.find_title"));
		let loaded = () => {
			if (++loaded.counter == 2)
				Homey.hideLoadingOverlay();
		};
		loaded.counter = 0;

		Homey.emit("getUnregisteredUnits", null, (err, unregisteredUnits) => {
			console.log("Units", unregisteredUnits);
			for (const unregisteredUnit of unregisteredUnits) {

				$("#unitList").append(
					$("<option>")
					.text(unregisteredUnit.idx + ": " + unregisteredUnit.name)
					.data("unit", unregisteredUnit)
					.attr("selected", unregisteredUnits.length == 1)
				);

				$("#unitListContainer").show();
			}

			if (unregisteredUnits.length == 1) {
				$("#host").val(unregisteredUnits[0].host).data("override", true);
			}

			loaded();
		});

		$("#unitList").on("change", (event) => {
			const unit = $('#unitList :selected').data("unit");
			if (!unit) return;

			$("#host").val(unit.host);
			$("#port").val(unit.port);
		});

		Homey.emit("getHomeyIP", null, (err, ip) => {
			if (ip) {
				window.homeyIP = ip.substr(0, ip.lastIndexOf(':'));
				window.homeyPort = ip.substr(ip.lastIndexOf(':') + 1);

				if (!$("#host").data("override")) {
					$("#host").val(ip.substr(0, ip.lastIndexOf(".")) + ".");
				}
			}
			loaded();
		});
	});

	// Override "next" button. This can break!
	document.body.addEventListener("click", (event) => {
		let targets = ['hy-nav-next', 'hy-nav-continue'];
		if (Homey.getCurrentView() != "find_unit" || (!targets.includes(event.target.id) && !targets.includes(event.target.parentNode.id))) {
			return;
		}

		event.stopImmediatePropagation();

		const host = $("#host").val();
		const port = $("#port").val();
		if (!host) {
			Homey.alert(Homey.__('pair.unit.error_no_host'), "error");
			return false;
		}

		Homey.showLoadingOverlay();
		Homey.emit('connect', [host, port], (error, data) => {
			// Can't seem to get the actual error message so I get it as data
			if (typeof data == "string") {
				Homey.alert(data, "error");
				Homey.hideLoadingOverlay();
				return;
			}

			if (data.staticIP) {
				Homey.confirm(Homey.__("pair.unit.warning_dhcp"), "warning", (error, cont) => {
					if (cont) {
						next(data);
					} else {
						Homey.hideLoadingOverlay();
					}
				});
				return;
			} else {
				next(data);
			}
		});
	}, true);

	function next(unit) {
		if (unit.eventCount > 0) {
			console.log("Got enough information, adding unit", unit);
			addUnit(unit);
		} else {
			window.unit = unit;
			Homey.nextView();
		}
	}
}

function setup_controller() {
	$(document).ready(() => {
		const unit = window.unit;

		console.log(unit);
		$("#homeyIP").html(window.homeyIP);
		$("#homeyPort").html(window.homeyPort);

		$("#controllerLogin").html(Homey.__("pair.unit.controller_login", {
			"url": "http://" + unit.host + "/controllers"
		}));

		$("#trymanual").on("click", () => {
			$("#technical").toggle();
		});

		window.numEvents = 0;
		Homey.on('updateEventCount', (eventCount) => {
			$("#controllerTip").hide();
			$("#waiting").hide();
			$("#controllerSuccess").show();
			window.numEvents = eventCount;
		});
	})


	// Override "next" button. This can break!
	document.body.addEventListener("click", (event) => {
		let targets = ['hy-nav-next', 'hy-nav-continue'];
		if (Homey.getCurrentView() != "setup_controller" || (!targets.includes(event.target.id) && !targets.includes(event.target.parentNode.id))) {
			return;
		}

		event.stopImmediatePropagation();

		if (window.numEvents > 0) {
			addUnit(window.unit);
		} else if ($("#configureFirst").is(":visible")) {
			$("#technical").hide();
			$("#configureFirst").hide();
			$("#status").show();
		} else {
			Homey.confirm(Homey.__("pair.unit.warning_no_events"), "warning", (error, cont) => {
				if (cont) {
					addUnit(window.unit);
				}
			});
			return;
		}
	}, true);
}

function addUnit(unit) {
	Homey.showLoadingOverlay();
	Homey.addDevice({
		"name": unit.name,
		"data": {
			"mac": unit.mac
		},
		"settings": {
			"idx": unit.idx,
			"host": unit.host,
			"port": parseInt(unit.port),
			"mac": unit.mac,
			"pollInterval": 60
		}
	}, (error, result) => {
		console.log(error, result);
		if (error) {
			Homey.alert(error, "error", () => {
				Homey.hideLoadingOverlay();
			});
		} else {
			Homey.done();
		}
	});
}

switch (Homey.getCurrentView()) {
	case "find_unit":
		find_unit();
		break;

	case "setup_controller":
		setup_controller();
		break;
}
