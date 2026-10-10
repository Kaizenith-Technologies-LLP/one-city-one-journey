# One Journey (Flutter app)

"One City, One Journey": a multimodal transit journey planner for Ahmedabad and Gandhinagar.

## Building and installing the Android APK

The API address is fixed at build time (`--dart-define=API_BASE=...`, see `lib/config.dart`),
so the APK must be built for the PC that runs the backend.

### 1. Build

```powershell
cd clients\app
.\build-apk.ps1                                   # auto-detects this PC's LAN IP
.\build-apk.ps1 -ApiBase http://192.168.1.70:4000/api   # or set it explicitly
.\build-apk.ps1 -Emulator                         # emulator build, uses http://10.0.2.2:4000/api
```

The APK is copied to `dist\one-journey-lan-<ip>.apk` (or `dist\one-journey-emulator.apk`).
If `flutter` is not on PATH the script uses `C:\src\flutter\bin\flutter.bat` (override with `-Flutter <path>`).
If the PC's IP changes (different Wi-Fi, DHCP lease), rebuild.

### 2. Run the backend

```powershell
cd backend
npm run dev        # listens on port 4000
```

### 3. Allow port 4000 through Windows Firewall (once, in an elevated PowerShell)

```powershell
netsh advfirewall firewall add rule name="One Journey API 4000" dir=in action=allow protocol=TCP localport=4000 profile=private
```

Use `profile=any` if your Wi-Fi network is marked Public. Remove it later with
`netsh advfirewall firewall delete rule name="One Journey API 4000"`.

### 4. Install on the phone

- Put the phone and the PC on the **same Wi-Fi** network (guest networks with client isolation will not work).
- Check from the phone's browser that `http://<PC-IP>:4000/api` responds.
- Copy the APK to the phone (USB, Drive, etc.) and open it; allow "Install unknown apps" when prompted.
  Or with USB debugging: `adb install -r dist\one-journey-lan-<ip>.apk`.
- The release APK is signed with the debug key (fine for a demo). Uninstall any earlier build signed with a different key first.

Map tiles come from `tile.openstreetmap.org`, so the phone also needs internet access.

### Launcher icon

Source PNGs live in `assets/icon/` and are drawn by `assets/icon/generate_icon.ps1`.
To change the icon, edit and rerun that script, then run `dart run flutter_launcher_icons`.
