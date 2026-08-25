# Steam release checklist

- Replace the placeholder Steam App ID only after Valve assigns the real ID.
- Integrate the Steamworks SDK for native achievements and cloud saves.
- Map the 25 local achievement IDs to Steamworks achievement IDs.
- Enable Steam Cloud for the user data/save location used by the final native bridge.
- Complete the Steam Content Survey accurately and disclose simulated gambling.
- State clearly that there is no real-money gambling, cash-out, trading, or paid spins.
- Use only screenshots captured from the shipping build.
- List only features that are complete at launch.
- Test 640x480, 1280x720, 1920x1080, 2560x1440, 3440x1440, and 3840x2160.
- Test Windows display scaling at 100%, 125%, 150%, and 200%.
- Verify the music asset reports 48,000 Hz, 2 channels, PCM 16-bit.
- Test controller navigation through Steam Input.
- Test save migration, offline progress, export/import, prestige, and reset.
- Run npm test and confirm every test passes.
- Build with Build_Windows.bat and upload the unpacked win-unpacked folder as the Steam depot.
- Confirm the Steam overlay in a build launched through Steam.
- Submit the store page and build for Valve review before announcing a release date.
