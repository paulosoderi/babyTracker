// include the library code:
#include "arduino_secrets.h"
#include <SPI.h>
#include <WiFiNINA.h>
#include <ArduinoBearSSL.h>
#include <ArduinoECCX08.h>
#include <ArduinoMqttClient.h>
#include <ArduinoJson.h>

//***********************************************************
//**********          COMMON              ********************
//**********************************************************
 long audioRecordingMillis = 0;

//***********************************************************
//**********          WIFI              ********************
//**********************************************************
    //*****wifi information - For securitu reasons it's taken from arduino secret file.
    char  ssid[] = SECRET_SSID;
    char  pass[] = SECRET_PASS;
    int status = WL_IDLE_STATUS;

    unsigned long getTime() {
      return WiFi.getTime();
    }

    void wifiInit(){
      // check for the WiFi module:
      if (WiFi.status() == WL_NO_MODULE) {
        Serial.println("Communication with WiFi module failed!");
        // don't continue
        while (true);
      }
      // attempt to connect to WiFi network:
      while (status != WL_CONNECTED) {  
        Serial.print("Attempting to connect to Network named: "); Serial.println(ssid); // print the network name (SSID);

        // Connect to WPA/WPA2 network. Change this line if using open or WEP network:
        status = WiFi.begin(ssid, pass);
        // wait 10 seconds for connection:
        delay(10000);
      }
      printWifiStatus();       
    }

    void printWifiStatus() {
      // print the SSID of the network you're attached to:
      Serial.print("SSID: ");  Serial.println(WiFi.SSID());
      // print the received signal strength:
      long rssi = WiFi.RSSI();
      Serial.print("signal strength (RSSI):"); Serial.print(rssi); Serial.println(" dBm");
    }


//***********************************************************
//**********          MQTT              ********************
//**********************************************************
    //**api information
    const char broker[]      = SECRET_BROKER;
    const char* certificate  = SECRET_CERTIFICATE;

    WiFiClient    wifiClient;            // Used for the TCP socket connection
    BearSSLClient sslClient(wifiClient); // Used for SSL/TLS connection, integrates with ECC508
    MqttClient    mqttClient(sslClient);

    void mqttInit(){
      if (!ECCX08.begin()) {
          Serial.println("No ECCX08 present!");
          while (1);
        }

        // Set a callback to get the current time
        // used to validate the servers certificate
        ArduinoBearSSL.onGetTime(getTime);

        // Set the ECCX08 slot to use for the private key
        // and the accompanying public certificate for it
        sslClient.setEccSlot(0, certificate);
        
        if (!mqttClient.connected()) {
          // MQTT client is disconnected, connect
          connectMQTT();
        }
    }

    void connectMQTT() {
      Serial.print("Attempting to MQTT broker: "); Serial.print(broker); Serial.println(" ");
      while (!mqttClient.connect(broker, 8883)) {
        Serial.print(mqttClient.connectError()); Serial.print("\t"); Serial.print(".");// failed, retry
        delay(1000);
      }
      Serial.println(); Serial.println("You're connected to the MQTT broker"); Serial.println();
    }

    void publishMessage(char* _activityLevel1, char* _activityLevel2, char* _activityLevel3, long duration) {
            if (!mqttClient.connected()) {
        // MQTT client is disconnected, connect
        connectMQTT();
      }

      // Define JSON data
      StaticJsonDocument<200> doc;
      doc["activity_log_source"] = "ARDUINO";
      doc["activity_type_lvl1"] = _activityLevel1;
      doc["activity_type_lvl2"] = _activityLevel2;
      doc["activity_type_lvl3"] = _activityLevel3;
      doc["duration"] = duration;

      char jsonBuffer[256];
      serializeJson(doc, jsonBuffer);

      Serial.println("Publishing message: ");  Serial.println(jsonBuffer);

      // send message, the Print interface can be used to set the message contents
      mqttClient.beginMessage("arduino/baby_tracker/incoming");
      mqttClient.print(jsonBuffer);
      mqttClient.endMessage();
    }


//**********************************************************
//*****  CLASS FOR MANAGING BUTTON TO LOG ACTIVITY **********
//**********************************************************
  class ButtonLogActivity{
      // Class Member Variables
      char* buttonType; //button type can be: ONE_TIME (it will log an activity that doesnt track time), or it can be TIME_TRACK 
      int ledPin;      // Digital port of the led
      int buttonPin;   //digital port of the button
      long buttonMillis;     // milliseconds of when button os fired
      unsigned long debounceDurationButton;
      char* activityLevel1;
      char* activityLevel2;
      char* activityLevel3;
      byte lastButtonTimeTrackState; //USED ONLY WHEN TIME TRACK IS NEEDED
      byte ledTimeTrackState;//USED ONLY WHEN TIME TRACK IS NEEDED
      long startTime;//USED ONLY WHEN TIME TRACK IS NEEDED
      long endTime;//USED ONLY WHEN TIME TRACK IS NEEDED
      long duration;//USED ONLY WHEN TIME TRACK IS NEEDED

      public:
      ButtonLogActivity(char* _buttonType, int _ledPin, int _buttonPin, int _debounceDurationButton, char* _activityLevel1, char* _activityLevel2, char* _activityLevel3){
        buttonType = _buttonType;
        ledPin = _ledPin;
        buttonPin = _buttonPin;
        pinMode(ledPin, OUTPUT); 
        pinMode(buttonPin, OUTPUT);  
        buttonMillis = 0;
        debounceDurationButton = _debounceDurationButton;
        activityLevel1 = _activityLevel1;
        activityLevel2 = _activityLevel2;
        activityLevel3 = _activityLevel3;

        lastButtonTimeTrackState= LOW;
        ledTimeTrackState = LOW;
      }

      void UpdateOneTime(){
        //IF BUTTON IS TRACK TIME, IT needs to check button state and log the activity after the second click
        if (millis() - buttonMillis > debounceDurationButton){
          //LOGIC FOR BUTTON WITHOUT TIME TRACK (ONTE TIME LOGGING)
            byte buttonOneTimeState = digitalRead(buttonPin);
            // check if the pushbutton is pressed. If it is, the buttonState is HIGH:
            if (buttonOneTimeState == HIGH) {
              buttonMillis = millis();
              Serial.print ("\n One time pressed...");
              // turn LED on:
              digitalWrite(ledPin, HIGH);

              // poll for new MQTT messages and send keep alives
              mqttClient.poll();   
              //publishMessage(activityLevel1,activityLevel2,activityLevel3, NULL);       
            } else {
              // turn LED off:
              digitalWrite(ledPin, LOW);
            }
        }
      }

      void UpdateTimeTrack(){
        //IF BUTTON IS TRACK TIME, IT needs to check button state and log the activity after the second click
        if (millis() - buttonMillis > debounceDurationButton) {
            byte buttonTimeTrackState = digitalRead(buttonPin);
            if (buttonTimeTrackState != lastButtonTimeTrackState) {
              buttonMillis = millis();
              lastButtonTimeTrackState = buttonTimeTrackState;
              if (buttonTimeTrackState == LOW ) {
                  if (ledTimeTrackState == HIGH) {
                      ledTimeTrackState = LOW;
                      endTime = millis();
                      duration = endTime - startTime;
                      Serial.print ("\n Duration Button pressed: ");  Serial.println (duration);
                      if (activityLevel1 == "SLEEP"){
                        isSleepActivityRunning = false;
                      }
                      // publishMessage(activityLevel1,activityLevel2,activityLevel3, duration);  
                  } else {
                     
                      ledTimeTrackState = HIGH;                
                      startTime = millis();
                      isSleepActivityRunning = true;
                  }
                  digitalWrite(ledPin, ledTimeTrackState);          
              }
            }
          }
      }
  };

ButtonLogActivity activityDiapperDirty("ONE_TIME", 8, 7, 500, "DIAPPER", "DIRTY", NULL);
ButtonLogActivity activityDiapperWet("ONE_TIME", 3, 4, 500, "DIAPPER", "WET", NULL);
ButtonLogActivity activitySleep("TIME_TRACK", 10, 9, 500, "SLEEP", NULL, NULL);



//**********          SETUP              ********************
//**********************************************************
    void setup() {
      Serial.begin(9600);
      pinMode(LED_BUILTIN, OUTPUT);
      wifiInit();
      mqttInit();
      digitalWrite(LED_BUILTIN, HIGH);
    }

//**********          LOOP              ********************
//**********************************************************
    void loop() {
      activitySleep.UpdateTimeTrack();
      activityDiapperDirty.UpdateOneTime();
      activityDiapperWet.UpdateOneTime();
  }