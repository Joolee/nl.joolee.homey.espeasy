# ESP Easy
<img align="right" src="https://github.com/Joolee/nl.joolee.homey.espeasy/raw/master/assets/images/small.png">

[ESP Easy](https://www.letscontrolit.com/wiki/index.php?title=ESPEasy) is a firmware for ESP8266 boards like the WeMos D1 and NodeMCU. It allows you to quickly make custom devices with switches, sensors and other hardware for use in Domotica setups. [Homey](https://homey.app/) is a Domotica controller with support for a bunch of different protocols. This app binds them together by adding support to Homey for connecting with ESP Easy units.

# Usage
Follow these steps to start using ESP Easy together with Homey:
1. [Install ESP Easy](https://github.com/Joolee/nl.joolee.homey.espeasy/wiki/1.-Install-ESP-Easy)
2. [Install the Homey app](https://github.com/Joolee/nl.joolee.homey.espeasy/wiki/2.-Install-the-Homey-app)
3. [Configure Homey as controller](https://github.com/Joolee/nl.joolee.homey.espeasy/wiki/3.-Configure-Homey-as-controller)
4. [Add a "System info" device](https://github.com/Joolee/nl.joolee.homey.espeasy/wiki/4.-Add-a-"System-info"-device)
5. [Add unit to Homey](https://github.com/Joolee/nl.joolee.homey.espeasy/wiki/5.-Add-unit-to-Homey)
6. [Add sensor to Homey](https://github.com/Joolee/nl.joolee.homey.espeasy/wiki/6.-Add-sensor-to-Homey)
7. [Add GPIO device](https://github.com/Joolee/nl.joolee.homey.espeasy/wiki/7.-Add-GPIO-device)

# Get help
* You can read all about the using of this app in the [Wiki](https://github.com/Joolee/nl.joolee.homey.espeasy/wiki)
* Get support in the [Forum](https://community.athom.com/t/esp-easy/30381)
* Report issues or feature requests in the [bug tracker](https://github.com/Joolee/nl.joolee.homey.espeasy/issues)

# Supported boards
The app has been developed and tested on a NodeMCU V3 board, if you run into any problems with other boards or want to have the pin-layout displayed in the GPIO pairing wizard, let me know in a feature request!

# Supported devices
Support for GPIO output devices (boolean, pulse, pwm, rtttl and tone) and input devices:
* Switch Input (Only in "Switch" mode, type "Normal switch" and no special events)
	* P001 Switch input - Switch
	* P009 Switch input - MCP23017
	* P019 Switch input - PCF8574
	* P033 Generic - Dummy Device (Possible values -1, 0 and 1. See the [Wiki](https://github.com/Joolee/nl.joolee.homey.espeasy/wiki/6.-Add-sensor-to-Homey) for more information)
* Environment (Temperature, pressure, humidity) (Mostly untested!)
	* P006 Environment - BMP085/180
	* P028 Environment - BMx280
	* P005 Environment - DHT11/12/22 SONOFF2301/7021
	* P034 Environment - DHT12 (I2C)
	* P004 Environment - DS18b20
	* P024 Environment - MLX90614
	* P032 Environment - MS5611 (GY-63)
	* P031 Environment - SHT1X
	* P014 Environment - SI7021/HTU21D
	* P039 Environment - Thermocouple
* P1 Energy Meter (http://www.esp8266thingies.nl/wp/)
	* P044 Communication - P1 Wifi Gateway

As my own use cases are limited, I need your input for Supporting more boards, devices and languages. Please help me on Github by sending information about your setup or contributing code.