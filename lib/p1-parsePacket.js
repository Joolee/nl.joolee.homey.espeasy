/**
 * Note by Joolee:
 *  Taken from https://www.npmjs.com/package/p1-reader / https://github.com/ruudverheijden/node-p1-reader
 *  Need only the package parser, using it this way instead of as an NPM dependency prevents downloading a lot of sub-dependancies
 * Parse P1 packet
 *
 * @param packet : P1 packet according to DSMR 2.2 or 4.0 specification
 */
function parsePacket(packet) {
    const lines = packet.split(/\r\n|\n|\r/);
    let parsedPacket = {
        meterType: lines[0].substring(1),
        version: null,
        timestamp: null,
        equipmentId: null,
        textMessage: {
            codes: null,
            message: null
        },
        electricity: {
            received: {
                tariff1: {
                    reading: null,
                    unit: null
                },
                tariff2: {
                    reading: null,
                    unit: null
                },
                actual: {
                    reading: null,
                    unit: null
                }
            },
            delivered: {
                tariff1: {
                    reading: null,
                    unit: null
                },
                tariff2: {
                    reading: null,
                    unit: null
                },
                actual: {
                    reading: null,
                    unit: null
                }
            },
            tariffIndicator: null,
            threshold: null,
            fuseThreshold: null,
            switchPosition: null,
            numberOfPowerFailures: null,
            numberOfLongPowerFailures: null,
            longPowerFailureLog: null,
            voltageSags: {
                L1: null,
                L2: null,
                L3: null
            },
            voltageSwell: {
                L1: null,
                L2: null,
                L3: null
            },
            instantaneous: {
                current: {
                    L1: {
                        reading: null,
                        unit: null
                    },
                    L2: {
                        reading: null,
                        unit: null
                    },
                    L3: {
                        reading: null,
                        unit: null
                    }
                },
                voltage: {
                    L1: {
                        reading: null,
                        unit: null
                    },
                    L2: {
                        reading: null,
                        unit: null
                    },
                    L3: {
                        reading: null,
                        unit: null
                    }
                },
                power: {
                    positive: {
                        L1: {
                            reading: null,
                            unit: null
                        },
                        L2: {
                            reading: null,
                            unit: null
                        },
                        L3: {
                            reading: null,
                            unit: null
                        }
                    },
                    negative: {
                        L1: {
                            reading: null,
                            unit: null
                        },
                        L2: {
                            reading: null,
                            unit: null
                        },
                        L3: {
                            reading: null,
                            unit: null
                        }
                    }
                }
            }
        },
        gas: {
            deviceType: null,
            equipmentId: null,
            timestamp: null,
            reading: null,
            unit: null,
            valvePosition: null
        }
    };

    // Start parsing at line 3 since first two lines contain the header and an empty row
    for (let i = 1; i < lines.length; i++) {
        // Ignore empty lines (by removing the newline breaks and trimming spaces)
        if (lines[i].replace(/(\r\n|\n|\r)/gm, "").trim() != "") {
            const line = _parseLine(lines[i]);

            switch (line.obisCode) {
                case "1-3:0.2.8":
                case "0-0:96.1.4":
                    parsedPacket.version = line.value;
                    break;

                case "0-0:1.0.0":
                    parsedPacket.timestamp = _parseTimestamp(line.value);
                    break;

                case "0-0:96.1.1":
                    parsedPacket.equipmentId = line.value;
                    break;

                case "0-0:96.13.1":
                    parsedPacket.textMessage.codes = line.value;
                    break;

                case "0-0:96.13.0":
                    parsedPacket.textMessage.message = _convertHexToAscii(line.value);
                    break;

                case "1-0:1.8.1":
                    parsedPacket.electricity.received.tariff1.reading = parseFloat(line.value);
                    parsedPacket.electricity.received.tariff1.unit = line.unit;
                    break;

                case "1-0:1.8.2":
                    parsedPacket.electricity.received.tariff2.reading = parseFloat(line.value);
                    parsedPacket.electricity.received.tariff2.unit = line.unit;
                    break;

                case "1-0:2.8.1":
                    parsedPacket.electricity.delivered.tariff1.reading = parseFloat(line.value);
                    parsedPacket.electricity.delivered.tariff1.unit = line.unit;
                    break;

                case "1-0:2.8.2":
                    parsedPacket.electricity.delivered.tariff2.reading = parseFloat(line.value);
                    parsedPacket.electricity.delivered.tariff2.unit = line.unit;
                    break;

                case "0-0:96.14.0":
                    parsedPacket.electricity.tariffIndicator = parseInt(line.value);
                    break;

                case "1-0:1.7.0":
                    parsedPacket.electricity.received.actual.reading = parseFloat(line.value);
                    parsedPacket.electricity.received.actual.unit = line.unit;
                    break;

                case "1-0:2.7.0":
                    parsedPacket.electricity.delivered.actual.reading = parseFloat(line.value);
                    parsedPacket.electricity.delivered.actual.unit = line.unit;
                    break;

                case "0-0:17.0.0":
                    parsedPacket.electricity.threshold = {};
                    parsedPacket.electricity.threshold.value = parseFloat(line.value);
                    parsedPacket.electricity.threshold.unit = line.unit;
                    break;

                case "0-0:96.3.10":
                    parsedPacket.electricity.switchPosition = line.value;
                    break;

                case "0-0:96.7.21":
                    parsedPacket.electricity.numberOfPowerFailures = parseInt(line.value);
                    break;

                case "0-0:96.7.9":
                    parsedPacket.electricity.numberOfLongPowerFailures = parseInt(line.value);
                    break;

                case "1-0:99.97.0":
                    const powerFailureEventLog = _parsePowerFailureEventLog(line.value);

                    parsedPacket.electricity.longPowerFailureLog = {};
                    parsedPacket.electricity.longPowerFailureLog.count = powerFailureEventLog.count;
                    parsedPacket.electricity.longPowerFailureLog.log = [];

                    for (let j = 0; j < powerFailureEventLog.log.length; j++) {
                        let logItem = {};

                        // The datetime of the start of the failure can be easily calculated since the duration is
                        // always specified in seconds according to the DSMR 4.0 specification.
                        logItem.startOfFailure = _subtractNumberOfSecondsFromDate(powerFailureEventLog.log[j].endOfFailure, powerFailureEventLog.log[j].duration);
                        logItem.endOfFailure = powerFailureEventLog.log[j].endOfFailure;
                        logItem.duration = powerFailureEventLog.log[j].duration;
                        logItem.unit = powerFailureEventLog.log[j].unit;

                        parsedPacket.electricity.longPowerFailureLog.log.push(logItem);
                    }

                    break;

                case "1-0:32.32.0":
                    parsedPacket.electricity.voltageSags.L1 = parseInt(line.value);
                    break;

                case "1-0:52.32.0":
                    parsedPacket.electricity.voltageSags.L2 = parseInt(line.value);
                    break;

                case "1-0:72.32.0":
                    parsedPacket.electricity.voltageSags.L3 = parseInt(line.value);
                    break;

                case "1-0:32.36.0":
                    parsedPacket.electricity.voltageSwell.L1 = parseInt(line.value);
                    break;

                case "1-0:52.36.0":
                    parsedPacket.electricity.voltageSwell.L2 = parseInt(line.value);
                    break;

                case "1-0:72.36.0":
                    parsedPacket.electricity.voltageSwell.L3 = parseInt(line.value);
                    break;

                case "1-0:31.7.0":
                    parsedPacket.electricity.instantaneous.current.L1.reading = parseInt(line.value);
                    parsedPacket.electricity.instantaneous.current.L1.unit = line.unit;
                    break;

                case "1-0:51.7.0":
                    parsedPacket.electricity.instantaneous.current.L2.reading = parseInt(line.value);
                    parsedPacket.electricity.instantaneous.current.L2.unit = line.unit;
                    break;

                case "1-0:71.7.0":
                    parsedPacket.electricity.instantaneous.current.L3.reading = parseInt(line.value);
                    parsedPacket.electricity.instantaneous.current.L3.unit = line.unit;
                    break;

                case "1-0:21.7.0":
                    parsedPacket.electricity.instantaneous.power.positive.L1.reading = parseFloat(line.value);
                    parsedPacket.electricity.instantaneous.power.positive.L1.unit = line.unit;
                    break;

                case "1-0:41.7.0":
                    parsedPacket.electricity.instantaneous.power.positive.L2.reading = parseFloat(line.value);
                    parsedPacket.electricity.instantaneous.power.positive.L2.unit = line.unit;
                    break;

                case "1-0:61.7.0":
                    parsedPacket.electricity.instantaneous.power.positive.L3.reading = parseFloat(line.value);
                    parsedPacket.electricity.instantaneous.power.positive.L3.unit = line.unit;
                    break;

                case "1-0:22.7.0":
                    parsedPacket.electricity.instantaneous.power.negative.L1.reading = parseFloat(line.value);
                    parsedPacket.electricity.instantaneous.power.negative.L1.unit = line.unit;
                    break;

                case "1-0:42.7.0":
                    parsedPacket.electricity.instantaneous.power.negative.L2.reading = parseFloat(line.value);
                    parsedPacket.electricity.instantaneous.power.negative.L2.unit = line.unit;
                    break;

                case "1-0:62.7.0":
                    parsedPacket.electricity.instantaneous.power.negative.L3.reading = parseFloat(line.value);
                    parsedPacket.electricity.instantaneous.power.negative.L3.unit = line.unit;
                    break;

                    /**
                     * The Smart Meter has 4 M-Bus interfaces which allow to connect external devices like a Gas, Thermal,
                     * Water or slave Electricity meter. The Obis code of external devices starts with 0-n (where n is a number from 1 to 4)
                     *
                     * However, the way to correctly determine the type of external device that is connected to each M-Bus is very poorly documented.
                     * At the moment only Gas meters are being installed by the grid companies as far as I know.
                     * So we make the assumption that a gas meter is attached to M-Bus 1.
                     */
                case "0-1:24.1.0":
                case "0-2:24.1.0":
                case "0-3:24.1.0":
                case "0-4:24.1.0":
                    parsedPacket.gas.deviceType = line.value;
                    break;

                case "0-1:96.1.0":
                case "0-2:96.1.0":
                case "0-3:96.1.0":
                case "0-4:96.1.0":
                case "0-1:96.1.1":
                    parsedPacket.gas.equipmentId = line.value;
                    break;

                case "0-1:24.2.1":
                case "0-2:24.2.1":
                case "0-3:24.2.1":
                case "0-4:24.2.1":
                    const hourlyReading = _parseHourlyReading(line.value);

                    parsedPacket.gas.timestamp = _parseTimestamp(hourlyReading.timestamp);
                    parsedPacket.gas.reading = parseFloat(hourlyReading.value);
                    parsedPacket.gas.unit = hourlyReading.unit;
                    break;

                case "0-1:24.2.3":

                    const instantValue = line.value.substr(15, 9);
                    const instantUnit = line.value.substr(25, 2);
                    parsedPacket.gas.reading = parseFloat(instantValue);
                    parsedPacket.gas.unit = instantUnit;
                    break;

                case "0-1:24.4.0":
                case "0-2:24.4.0":
                case "0-3:24.4.0":
                case "0-4:24.4.0":
                    parsedPacket.gas.valvePosition = line.value;
                    break;

                    /*
                     * DSMR 2.2 specific mappings
                     */

                case "0-1:24.3.0":
                    const split = line.value.split(')(');
                    parsedPacket.gas.timestamp = _parseTimestamp(split[0]);
                    parsedPacket.gas.unit = split[5];
                    break;

                    /*
                     * DSMR 5.0 specific mappings
                     */

                case "1-0:32.7.0":
                    parsedPacket.electricity.instantaneous.voltage.L1.reading = parseInt(line.value);
                    parsedPacket.electricity.instantaneous.voltage.L1.unit = line.unit;
                    break;

                case "1-0:52.7.0":
                    parsedPacket.electricity.instantaneous.voltage.L2.reading = parseInt(line.value);
                    parsedPacket.electricity.instantaneous.voltage.L2.unit = line.unit;
                    break;

                case "1-0:72.7.0":
                    parsedPacket.electricity.instantaneous.voltage.L3.reading = parseInt(line.value);
                    parsedPacket.electricity.instantaneous.voltage.L3.unit = line.unit;
                    break;

                    /*
                     * eMUCs 1.4 specific mappings
                     */

                case "0-0:96.1.4":
                    parsedPacket.version = line.value;
                    break;

                case "1-0:31.4.0":
                    parsedPacket.electricity.fuseThreshold = {};
                    parsedPacket.electricity.fuseThreshold.value = parseFloat(line.value);
                    parsedPacket.electricity.fuseThreshold.unit = 'A';
                    break;

                    /*
                     * Handling anything not matched so far
                     */

                default:
                    // Due to a 'bug' in DSMR2.2 the gas reading value is put on a separate line, so we catch it here with a regex
                    // Format of the line containing that reading is: "(012345.678)"
                    if (lines[i].match(/\([0-9]{5}\.[0-9]{3}\)/)) {
                        parsedPacket.gas.reading = parseFloat(lines[i].substring(1, 10));
                    } else {
                        console.error('Unable to parse line: ' + lines[i]);
                    }
                    break;
            }
        }
    }

    /*
     * DSMR 2.2 specific logic
     */

    // If we could not find a version number we assume it's DSMR version 2.2 and add server timestamp, since these are not contained in the packet
    if (parsedPacket.version === null) {
        parsedPacket.version = "22";

        // Take the current time but ignore the milliseconds
        const now = new Date();
        now.setMilliseconds(0);
        parsedPacket.timestamp = now.toISOString();
    }

    return parsedPacket;
}

/**
 * Parse a single line of the P1 packet
 *
 * @param line : Single line of format: obisCode(value*unit), example: 1-0:2.8.1(123456.789*kWh)
 */
function _parseLine(line) {
    let output = {};
    const split = line.split(/\((.+)?/); // Split only on first occurence of "("

    if (split[0] && split[1]) {
        const value = split[1].substring(0, split[1].length - 1);

        output.obisCode = split[0];

        if (value.indexOf("*") > -1 && value.indexOf(")(") === -1) {
            output.value = value.split("*")[0];
            output.unit = value.split("*")[1];
        } else {
            output.value = value;
        }
    }

    return output;
}

/**
 * Parse timestamp
 *
 * @param timestamp : Timestamp of format: YYMMDDhhmmssX
 */
function _parseTimestamp(timestamp) {
    const parsedTimestamp = new Date();

    parsedTimestamp.setUTCFullYear(parseInt(timestamp.substring(0, 2)) + 2000);
    parsedTimestamp.setUTCMonth(parseInt(timestamp.substring(2, 4)) - 1);
    parsedTimestamp.setUTCDate(parseInt(timestamp.substring(4, 6)));
    parsedTimestamp.setUTCHours(parseInt(timestamp.substring(6, 8)));
    parsedTimestamp.setUTCMinutes(parseInt(timestamp.substring(8, 10)));
    parsedTimestamp.setUTCSeconds(parseInt(timestamp.substring(10, 12)));
    parsedTimestamp.setUTCMilliseconds(0);

    return parsedTimestamp.toISOString();
}

/**
 * Parse power failure event log
 *
 * @param value : Power failure event log of format: 1)(0-0:96.7.19)(timestamp end)(duration)(timestamp end)(duration...
 */
function _parsePowerFailureEventLog(value) {
    const split = value.split(")(0-0:96.7.19)(");

    let output = {
        count: parseInt(split[0]) || 0,
        log: []
    };

    if (split[1]) {
        const log = split[1].split(")(");

        // Loop the log structure: timestamp)(duration)(timestamp)(duration...
        for (let i = 0; i <= log.length; i = i + 2) {
            if (log[i] && log[i + 1]) {
                const logEntry = {
                    endOfFailure: _parseTimestamp(log[i]),
                    duration: parseInt(log[i + 1].split("*")[0]),
                    unit: log[i + 1].split("*")[1]
                };

                output.log.push(logEntry);
            }
        }
    }

    return output;
}

/**
 * Parse hourly readings, which is used for gas, water, heat, cold and slave electricity meters
 *
 * @param reading : Reading of format: (value)(value)
 */
function _parseHourlyReading(reading) {
    let output = {
        timestamp: null,
        value: null,
        unit: null
    };

    const split = reading.split(")(");

    if (split[0] && split[1]) {
        output.timestamp = split[0];
        output.value = split[1].split("*")[0];
        output.unit = split[1].split("*")[1];
    }

    return output;
}

/**
 * Subtract a number of seconds from a date
 *
 * @param {string} date : A valid date that can be parsed by the javascript Date() function
 * @param {number} seconds : Number of seconds that need to be substracted from the date
 */
function _subtractNumberOfSecondsFromDate(date, seconds) {
    let output = new Date(date);
    output.setSeconds(output.getSeconds() - seconds);

    return output.toISOString();
}

/**
 * Convert a hexadecimal encoded string to readable ASCII characters
 *
 * @param string : Hexadecimal encoded string
 */
function _convertHexToAscii(string) {
    let output = '';

    for (i = 0; i < string.length; i = i + 2) {
        output = output + String.fromCharCode(parseInt(string.substr(i, 2), 16));
    }
    return output;
}

module.exports = parsePacket;