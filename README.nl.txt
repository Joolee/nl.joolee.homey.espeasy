ESP Easy is een firmware voor ESP8266 ontwikkelbordjes zoals de WeMos D1 en NodeMCU. Met deze bordjes kun je snel en eenvoudig je eigen domoticaaparatuur maken en met deze app kun je ze ook nog eens koppelen met Homey!

Deze app is ontwikkeld en getest op een NodeMCU V3 bord. Als je problemen ervaart met andere ontwikkelbordjes of de pin-layout getoond wil hebben in de GPIO pairing wizzard, laat het weten op Github!

Ondersteuning voor GPIO output apparaten (boolean, pulse, pwm, rtttl and tone) en invoerapparaten:
	- Switch Input (Alleen in "Switch" mode, type "Normal switch" en geen speciale events)
		- P001 Switch input - Switch
		- P009 Switch input - MCP23017
		- P019 Switch input - PCF8574
		- P033 Generic - Dummy Device (Mogelijke waarden -1, 0 and 1)
	- Analog Input
		- P002 Analog input - internal
		- P060 Analog input - MCP3221
		- P025 Analog input - ADS1115
		- P007 Analog input - PCF8591
	- Pulse Counter
		- P003 Generic - Pulse counter
	- Environment (temperatuur, luchtdruk, vochtigheid) (Grotendeels ongetest!)
		- P006 Environment - BMP085/180
		- P028 Environment - BMx280
		- P005 Environment - DHT11/12/22 SONOFF2301/7021
		- P034 Environment - DHT12 (I2C)
		- P004 Environment - DS18b20
		- P024 Environment - MLX90614
		- P032 Environment - MS5611 (GY-63)
		- P031 Environment - SHT1X
		- P014 Environment - SI7021/HTU21D
		- P039 Environment - Thermocouple
	- P1 Energy Meter (http://www.esp8266thingies.nl/wp/)
		- P044 Communication - P1 Wifi Gateway

Mijn eigen use-cases zijn beperkt dus ik heb jouw input nodig om meer borjes en apparaten te kunnen ondersteunen. Je kunt helpen op Github door informatie over jouw set-up op te sturen of direct code aan te dragen.