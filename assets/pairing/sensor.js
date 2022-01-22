Homey.showLoadingOverlay();
Homey.setTitle(__('pair.sensor.title'));

$(document).ready(() => {
    window.device = null;
    // Fetch selected device in undocumented way. This can break!
    if (window.selected_devices[0]) {
        window.device = JSON.parse(window.selected_devices[0]);
    }

    if (!window.device) {
        Homey.alert(Homey.__('pair.sensor.device_not_found'), 'error');
        Homey.done();
        return;
    }

    console.dir("Device:", window.device);

    // When all controllers have an error, just pick the first and display the error
    if (window.device.controllers.length && window.device.controllers.every(c => c.IDX == 0 || c.duplicate)) {
        let controller = window.device.controllers[0];
        if (controller.IDX == 0) {
            Homey.alert(Homey.__('pair.sensor.idx0'), 'error');
            Homey.done();
            return;
        } else if (controller.duplicate) {
            Homey.alert(Homey.__('pair.sensor.duplicate'), 'error');
            Homey.done();
            return;
        }
    }

    if (window.device.controllers.length == 1) {
        let controller = window.device.controllers[0];
        $('#controllerID').html(controller.Controller);
        $('#taskIDX').html(controller.IDX);
        $('#oneController').show();
    } else if (window.device.controllers.length > 1) {
        for (const [key, controller] of Object.entries(window.device.controllers)) {
            let error = controller.IDX == 0 || controller.duplicate;
            let text = error ? '⚠ ' : '';
            text += "Controller: " + controller.Controller + "; IDX: " + controller.IDX;
            $('#controllerList').append(
                $('<option>')
                .text(text)
                .prop("disabled", error)
                .data("controller", controller)
            );
        }

        if (window.device.controllers.some(c => c.IDX == 0)) {
            $('#idxWarning')
                .show();
        }
        if (window.device.controllers.some(c => c.duplicate)) {
            $('#duplicateWarning')
                .show();
        }

        $('#selectController').show();
    } else {
        Homey.alert(Homey.__('pair.sensor.noController'), 'error');
        Homey.done();
        return;
    }

    if (window.device.variants) {
        $("#selectVariant label").html(Homey.__("pair.sensor.select_variant", {
            "variant-title": window.device.variantTitle
        }));

        numEnabled = Object.values(window.device.variants).filter(value => value.enabled).length;

        for (const [key, variant] of Object.entries(window.device.variants)) {
            $('#variantList').append(
                $('<option>')
                .text(variant.name)
                .prop("selected", variant.enabled && numEnabled == 1)
                .prop("disabled", !variant.enabled)
                .data("variant", variant)
            );
        }

        $("#selectVariant").show();
    }

    let capabilityList = null;
    if (window.device.capabilities) {
        for (const value of window.device.capabilities) {
            if (typeof(value.capabilities) == 'string' || Object.entries(value.capabilities).length == 1)
                continue;

            capabilityList = $('<select>')
                .attr('id', "capabilityList" + value.index)
                .data('value', value);

            $('#capabilities').append($('<p>')
                .append(
                    $('<label>')
                    .attr("for", "capabilityList" + value.index)
                    .html(Homey.__('pair.sensor.select_capability', {
                        "name": value.name
                    }))
                    .append(capabilityList)
                )
            );


            for (const [capability, title] of Object.entries(value.capabilities)) {
                $(capabilityList).append(
                    $('<option>')
                    .text(title)
                    .val(capability)
                );
            }
        }
    }

    if (window.device.id) {
        $("#taskNumber").html(window.device.id);
    }

    Homey.hideLoadingOverlay();
});


// Override "next" button. This can break!
document.body.addEventListener('click', (event) => {
    if (Homey.getCurrentView() != "settings" || (event.target.id != "hy-nav-next" && event.target.parentNode.id != "hy-nav-next")) {
        return;
    }

    event.stopImmediatePropagation();

    let controller = null;
    if (window.device.controllers.length == 1) {
        controller = window.device.controllers[0];
    } else {
        controller = $('#controllerList :selected').data('controller');
    }
    if (!controller) {
        Homey.alert(Homey.__('pair.sensor.no_controller_selected'), "error");
        return false;
    }

    if (window.device.variants) {
        variant = $('#variantList :selected').data('variant');

        if (!variant) {
            Homey.alert(Homey.__('pair.sensor.no_variant_selected'), "error");
            return false;
        }
    }

    Homey.showLoadingOverlay();

    let device = {
        "name": window.device.name,
        "data": {
            "unit": window.device.unit.mac,
            "idx": controller.IDX
        },
        "settings": {
            "mac": window.device.unit.mac,
            "host": window.device.unit.host + ':' + window.device.unit.port,
            "idx": window.device.unit.idx.toString(),
            "taskIDX": controller.IDX.toString(),
            "controller": controller.Controller
        },
        capabilities: []
    }

    deviceCapabilities = window.device.capabilities;

    if (typeof variant != "undefined") {
        device.settings.variant = variant.key;

        const basicCapabilities = window.device.capabilities.filter(cap => !cap.hasOwnProperty("index"));
        const variantCapabilities = window.device.capabilities.filter(cap => cap.hasOwnProperty("index") && variant.values.includes(cap.name));

        deviceCapabilities = basicCapabilities.concat(variantCapabilities);
    }

    if (typeof deviceCapabilities != "undefined") {
        for (const value of deviceCapabilities) {
            if (typeof(value.capabilities) == 'string') {
                device.capabilities.push(value.capabilities);
            } else {
                if (Object.keys(value.capabilities).length == 1) {
                    capability = Object.keys(value.capabilities)[0];
                } else {
                    capability = $(`#capabilityList${value.index} :selected`).val();
                }
                device.capabilities.push(capability);
                device.settings['capability-' + value.index] = capability;
            }
        }
    }

    // Collect extra settings
    $('.hy-view.visible input').each((index, element) => {
        if (element.type == "number")
            device.settings[element.id] = parseInt(element.value);
        else
            device.settings[element.id] = element.value;
    });

    console.dir("Creating device:", device);

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