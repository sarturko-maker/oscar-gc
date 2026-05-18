# Installing Oscar GC on a Chromebook (Crostini)

Oscar GC ships as a single Debian package (`.deb`) bundled with everything it needs — the AI agent core, the redline tool, the Python and Node runtimes, the document handler. You don't need to install anything else; you don't need a terminal.

Time required: about three minutes for install + first-launch setup.

## What you need

- A Chromebook with **Linux (Crostini)** turned on. If not yet:
  Settings → "About ChromeOS" → "Developers" → "Linux development environment" → "Turn on".
- Your Linux container running **Debian 12 ("bookworm")**.
  - New Crostini containers ship Debian 12 by default. Older containers may still be on Debian 11; upgrade them via Settings → "Advanced" → "Developers" → "Linux Development Environment" → "Backup and restore" (creating a new container is the simplest path).
- A **MiniMax API key**. You'll paste this in on first launch.

## Install

1. **Download.** Open Chrome and go to https://github.com/sarturko-maker/goose/releases. Find the latest release and click `oscar-gc_<version>_amd64.deb`. Chrome saves it to your Downloads folder.
2. **Open the Files app** (Chrome's built-in file manager). In the left sidebar, click "Linux files". You should see the `.deb` you just downloaded — if it landed under "Downloads" in My files, drag it into "Linux files" first.
3. **Double-click the `.deb`.** ChromeOS prompts "Install with Linux?" — click **Install**. A small progress notification appears in the corner.
4. **Wait about 30 seconds.** The install copies Oscar GC into the container, then creates the redline tool's Python environment from bundled wheels (no internet required during this step). When it's done, you'll see "Installation succeeded."
5. **Launch.** Oscar GC appears in your Chromebook launcher (the circle at the bottom-left). Click it.

## First launch

6. **MiniMax API key.** The first screen asks you to configure your AI provider. Choose **MiniMax**, paste your API key, click confirm. Oscar saves the key in your system keyring; you won't need to paste it again.
7. **Onboarding.** Oscar's interview starts — a short conversation that captures your name, role, and the practice areas you actually work on. Answer in plain English. When it has what it needs, the sidebar populates with your practice areas.
8. **Click "Commercial"** in the sidebar.
9. **Paste a `.docx` path** (e.g., `/home/<your-user>/Documents/some-nda.docx`) and tell Oscar what redline you want — for example, *"Make this mutual."* Oscar reads the file, plans the changes, and writes a redlined version.
10. **Open the output.** Oscar tells you the path — usually `~/Documents/Oscar Redlines/<original>_redlined_<timestamp>.docx`. Find it in the Files app under "Linux files" → "Documents" → "Oscar Redlines", double-click to open.

That's the four-item flow.

## Troubleshooting

**The MiniMax key screen never appears, or asks me to set an environment variable.**
Some Crostini containers don't ship a keyring daemon, in which case Goose's stock provider setup may fall back to environment-variable-only mode. Workaround: open Crostini's Terminal app and run

```sh
echo 'export MINIMAX_API_KEY=<your-key>' >> ~/.profile
```

Then log out and back in (or close and reopen the Terminal), and launch Oscar GC again from the launcher.

**The install seems to finish but Oscar won't open from the launcher.**
The postinst step that builds the redline tool's Python environment can fail silently on a heavily-customised container. To check, open Terminal and run:

```sh
sudo dpkg --configure oscar-gc
```

This re-runs the postinst step and prints any error. The most common cause is missing `python3-venv` from the bundled Python — extremely unusual since we ship it ourselves. If you see an error, copy the output and send it to Arturs.

**I see "package not configured" or "missing dependency" during install.**
Run `sudo apt --fix-broken install` to let APT resolve any pending system libraries (`libgtk-3-0`, `libnss3`, etc.) that Crostini's base image happens to be missing.

**The redline output doesn't open / Files app says "no application".**
Crostini ships LibreOffice optionally; if you don't have it, install with `sudo apt install libreoffice`. Or use ChromeOS's built-in Office Editor by sharing the file out to Drive.

**I want to launch from a terminal (e.g., to see logs) and `oscar-gc` crashes with a Gtk widget assertion.**
The launcher in the ChromeOS App Drawer applies Crostini-specific flags automatically via the `.desktop` entry. From a terminal, run with the same flags:

```sh
env LIBGL_ALWAYS_SOFTWARE=1 oscar-gc --ozone-platform=x11 --disable-gpu --disable-software-rasterizer
```

ADR-025 in the repo (`docs/adr/025-crostini-launch-flags.md`) explains the flag choices.

## Uninstall

Open Crostini Terminal and run:

```sh
sudo apt remove oscar-gc
```

This removes the application and the bundled runtime. It leaves your data in `~/.config/oscar/`, `~/.local/share/oscar-memory/`, and `~/Documents/Oscar Redlines/` untouched — delete those manually if you want a clean slate.

## Reporting issues

Open an issue at https://github.com/sarturko-maker/goose/issues with:
- ChromeOS version (Settings → About ChromeOS).
- Container Debian version (`lsb_release -d` in Terminal).
- Output of `oscar-gc --version` if it launches; otherwise `dpkg -l oscar-gc`.
- The exact step that broke and the message you saw.
