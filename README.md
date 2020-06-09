# ESP Easy
ESP Easy is a firmware for ESP8266 boards like the WeMos D1 and NodeMCU. It allows you to quickly make custom devices with switches, sensors and other hardware. This app adds support to Homey for connecting with ESP Easy units.

The app has been developed and tested on a NodeMCU V3 board, if you run into any problems with other boards or want to have the pin-layout displayed in the GPIO pairing wizard, let me know in a feature request!

Support for GPIO output devices (boolean, pulse, pwm, rtttl and tone) and input devices:
* Switch Input (Only in "Switch" mode, type "Normal switch" and no special events)
	* P001 Switch input - Switch
	* P009 Switch input - MCP23017
	* P019 Switch input - PCF8574

As my own use cases are limited, I need your input for Supporting more boards, devices and languages. Please help me on Github by sending information about your setup or contributing code.