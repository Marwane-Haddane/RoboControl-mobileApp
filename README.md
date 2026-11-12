# RoboContol

<p align="center">
  <img src="public/assets/brand/robocontrol-mascot.png" alt="RoboContol robot mascot" width="180" />
</p>

<p align="center"><strong>One Android app for your robots, vehicles, and Bluetooth projects.</strong></p>

<p align="center">
  <a href="https://github.com/Marwane-Haddane/RoboControl-mobileApp/releases/latest"><img alt="Latest Android release" src="https://img.shields.io/github/v/release/Marwane-Haddane/RoboControl-mobileApp?label=Android%20APK&color=4167c8"></a>
  <a href="https://github.com/Marwane-Haddane/RoboControl-mobileApp/blob/main/LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-4167c8.svg"></a>
</p>

RoboContol is an Android-first remote-control app built by **Marwane Haddane**. It brings a Freenove hexapod controller together with a two-handed car remote, voice commands, a Bluetooth terminal, and configurable smart buttons. The interface uses a clean light palette and keeps each controller in its own focused screen.

## RoboContol in one minute

Choose what you want to control, connect using the matching transport, then use only the controls for that mode. The hexapod connects over the robot's Wi-Fi TCP protocol. Car, terminal, and smart-button modes use Bluetooth Classic SPP text commands. Voice commands use the speech recognition service available on the Android phone.

## Install in two minutes

1. Open [the latest RoboContol release](https://github.com/Marwane-Haddane/RoboControl-mobileApp/releases/latest) on your Android phone.
2. Download **RoboContol-1.5.0-android.apk** from the release assets.
3. Open the downloaded APK. If Android asks, allow your browser or file manager to install unknown apps, then return to the installer and finish.
4. Open RoboContol and choose a controller.

This is an Android sideload APK. It is not distributed through Google Play. The attached release build is debug-signed for direct installation and testing; it is not a Play Store signing build.

## What works today

| Controller | Connection | Current behavior and boundary |
| --- | --- | --- |
| **Hexapod** | Robot Wi-Fi, native TCP | Drive, turn, stop future gait requests, sleep/activate, body pose, connection settings, and auxiliary outputs. Uses the existing Freenove firmware protocol and does not change calibration or firmware. |
| **Car remote** | Bluetooth Classic SPP | Landscape two-hand layout with a D-pad and four configurable face buttons. Bind each button to the text command your device expects. |
| **Voice** | Android speech service + selected controller | English, French, and Arabic command phrases. Offline recognition depends on the installed Android speech service and its language packs. RoboContol does not download or install recognition models. |
| **Terminal** | Bluetooth Classic SPP | Send text commands and see the local send/receive log. |
| **Smart buttons** | Bluetooth Classic SPP | Configure button names and ON/OFF text commands for compatible devices. |

Bluetooth support is for paired Bluetooth Classic serial devices that expose the SPP profile. BLE/GATT devices, proprietary Bluetooth protocols, and arbitrary devices are not universal plug-and-play targets; they need a compatible protocol or a future device-specific integration. The app does not rename the hexapod Wi-Fi network or change its password.

## Connect to the Freenove hexapod

1. Power on the calibrated robot and join its **Freenove Hexapod Robot** Wi-Fi network from Android. The default password is **Freenove**.
2. If Android reports that this Wi-Fi network has no internet, choose to remain connected.
3. In RoboContol, choose **Hexapod**, open connection settings, and connect to the robot. The default address is `192.168.4.1` and port `65535`.
4. Return to the drive screen. Hold a direction to request movement; release to stop sending additional movement requests.

The firmware completes an in-progress gait before it can accept another command. The Stop control cancels future requests; it is not an immediate motor power cut. No physical robot or phone was connected during app development, so verify the connection and commands with your own hardware.

## Build from source

### Requirements

- Node.js 22 or later
- JDK 17
- Android SDK 36
- Android 8 (API 26) or later to install the app

### Build the Android APK

From the repository root, run:

```powershell
npm ci
npm run check:runtime
npm run build:android-ui
cd android
.\gradlew.bat assembleDebug
```

The APK is created at `android/app/build/outputs/apk/debug/app-debug.apk`. A Windows helper script is also provided at `scripts/build-android.ps1`.

To run the interactive browser preview instead:

```powershell
npm ci
npm run dev -- --port 4173
```

The browser preview clearly uses demo transport and cannot connect to the robot's raw TCP socket. Use the Android APK for real Wi-Fi TCP and Bluetooth Classic connections.

## Project layout

- `src/` — mode screens, controller logic, and robot protocol
- `android/` — Android host app and native Wi-Fi/Bluetooth bridges
- `public/assets/` — app illustrations, icons, and visual assets
- `scripts/` — runtime checks and Android asset/build helpers
- `tests/` — protocol and interaction tests
- `docs/` — design references and asset notes

## Safety and compatibility

RoboContol sends commands to physical devices. Confirm the selected device and its command mapping before moving it. The hexapod app keeps your existing firmware and calibration unchanged. Communication and voice behavior depend on the connected hardware, its firmware, Android permissions, and installed speech services.

Freenove protocol and firmware references are credited in [FREENOVE-LICENSE.txt](FREENOVE-LICENSE.txt). The app repository is distributed under the [MIT License](LICENSE); bundled third-party assets and dependencies retain their respective terms.

---

<p align="center">Built by <strong>Marwane Haddane</strong></p>
