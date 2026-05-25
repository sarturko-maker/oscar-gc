import type { OpenDialogOptions, OpenDialogReturnValue } from 'electron';
import {
  app,
  App,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  MenuItem,
  net,
  Notification,
  powerSaveBlocker,
  screen,
  session,
  shell,
  Tray,
} from 'electron';
import { pathToFileURL, format as formatUrl, URLSearchParams } from 'node:url';
import { Buffer } from 'node:buffer';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import started from 'electron-squirrel-startup';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawn, execFile } from 'child_process';
import 'dotenv/config';
import { checkServerStatus } from './goosed';
import { startGoosed } from './goosed';
import { createClient, createConfig } from './api/client';
import { expandTilde } from './utils/pathUtils';
import log from './utils/logger';
import { ensureWinShims } from './utils/winShims';
import { addRecentDir, loadRecentDirs } from './utils/recentDirs';
import { formatAppName, errorMessage, formatErrorForLogging } from './utils/conversionUtils';
import type { Settings, SettingKey } from './utils/settings';
import { defaultSettings, getKeyboardShortcuts } from './utils/settings';
import * as crypto from 'crypto';
import * as yaml from 'yaml';
import windowStateKeeper from 'electron-window-state';
import {
  getUpdateAvailable,
  registerUpdateIpcHandlers,
  setTrayRef,
  setupAutoUpdater,
  updateTrayMenu,
} from './utils/autoUpdater';
import { UPDATES_ENABLED } from './updates';
import './utils/recipeHash';
import { Client } from './api/client';
import { type GooseApp, getSlashCommands } from './api';
import * as mesh from './mesh';
import installExtension, { REACT_DEVELOPER_TOOLS } from 'electron-devtools-installer';
import { BLOCKED_PROTOCOLS, WEB_PROTOCOLS } from './utils/urlSecurity';
import { buildCSP } from './utils/csp';

function shouldSetupUpdater(): boolean {
  // Setup updater if either the flag is enabled OR dev updates are enabled
  return UPDATES_ENABLED || process.env.ENABLE_DEV_UPDATES === 'true';
}

// =======================================================================
// Native menu localization
// -----------------------------------------------------------------------
// Electron's main process can't use react-intl (which runs in the renderer),
// so the native menu bar is translated here with a small hand-maintained
// dictionary. Only Simplified Chinese is filled in right now; other locales
// fall through to the original English labels. Keep the keys in sync with
// the raw label strings used below.
// =======================================================================

const MENU_TRANSLATIONS_ZH_CN: Record<string, string> = {
  // Top-level
  File: '文件',
  Edit: '编辑',
  View: '视图',
  Window: '窗口',
  Help: '帮助',
  // Context menu
  'Add to dictionary': '添加到词典',
  Cut: '剪切',
  Copy: '复制',
  Paste: '粘贴',
  // Goose-added items
  'New Window': '新建窗口',
  Settings: '设置',
  'Find…': '查找…',
  'Find Next': '查找下一个',
  'Find Previous': '查找上一个',
  'Use Selection for Find': '用所选内容查找',
  Find: '查找',
  'New Chat': '新建聊天',
  'New Chat Window': '新建聊天窗口',
  'Open Directory...': '打开目录…',
  'Recent Directories': '最近的目录',
  'Focus Goose Window': '聚焦 Goose 窗口',
  'Quick Launcher': '快速启动器',
  'Always on Top': '窗口置顶',
  'Toggle Navigation': '切换导航',
  'About Goose': '关于 Goose',
  // Electron's default role-based labels we want to translate as well.
  // (The menu role itself still provides the correct behaviour; only the
  // display string is overridden.)
  Undo: '撤销',
  Redo: '重做',
  'Select All': '全选',
  Delete: '删除',
  Speech: '语音',
  Reload: '重新加载',
  'Force Reload': '强制重新加载',
  'Toggle Developer Tools': '切换开发者工具',
  'Actual Size': '实际大小',
  'Reset Zoom': '重置缩放',
  'Zoom In': '放大',
  'Zoom Out': '缩小',
  'Toggle Full Screen': '切换全屏',
  'Toggle Fullscreen': '切换全屏',
  Minimize: '最小化',
  Close: '关闭',
  'Close Window': '关闭窗口',
  Quit: '退出',
  Exit: '退出',
  'Bring All to Front': '全部置于最前',
  'Emoji & Symbols': '表情符号',
  'Start Dictation…': '开始听写…',
  'Hide Goose': '隐藏 Goose',
  'Hide Others': '隐藏其他',
  'Show All': '全部显示',
  Services: '服务',
};

function detectMenuLocale(): string {
  const explicit = process.env.GOOSE_LOCALE;
  if (explicit) return explicit;
  try {
    return app.getSystemLocale() || 'en';
  } catch {
    return 'en';
  }
}

function menuT(label: string): string {
  // Normalize underscores to hyphens so POSIX-style tags like "zh_CN" work.
  const lower = detectMenuLocale().replace(/_/g, '-').toLowerCase();
  const isTraditional = /^zh-(hant|tw|hk|mo)\b/.test(lower);
  const isSimplifiedChinese = !isTraditional && (lower === 'zh' || lower.startsWith('zh-'));
  if (isSimplifiedChinese) {
    return MENU_TRANSLATIONS_ZH_CN[label] ?? label;
  }
  return label;
}

/**
 * Recursively translate `label` on every item in the given menu, including nested submenus.
 * Electron's default application menu comes with English labels that are not otherwise
 * configurable, so we post-process them here before calling `Menu.setApplicationMenu`.
 */
function translateMenuLabels(items: MenuItem[]): void {
  for (const item of items) {
    if (item.label) {
      const translated = menuT(item.label);
      if (translated !== item.label) {
        // MenuItem.label is a writable property on the main-process side, even though
        // the TS type sometimes claims otherwise. Cast through unknown for safety.
        (item as unknown as { label: string }).label = translated;
      }
    }
    if (item.submenu && item.submenu.items) {
      translateMenuLabels(item.submenu.items);
    }
  }
}

// Settings management
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
const STARTUP_LOGS_DIR = path.join(app.getPath('userData'), 'logs', 'startup');

function getSettings(): Settings {
  if (fsSync.existsSync(SETTINGS_FILE)) {
    let stored: Partial<Settings>;
    try {
      const data = fsSync.readFileSync(SETTINGS_FILE, 'utf8');
      stored = JSON.parse(data) as Partial<Settings>;
    } catch (err) {
      console.error('Failed to read settings.json, using defaults:', err);
      return defaultSettings;
    }
    return {
      ...defaultSettings,
      ...stored,
      externalGoosed: {
        ...defaultSettings.externalGoosed,
        ...(stored.externalGoosed ?? {}),
      },
      keyboardShortcuts: {
        ...defaultSettings.keyboardShortcuts,
        ...(stored.keyboardShortcuts ?? {}),
      },
      sessionSharing: {
        ...defaultSettings.sessionSharing,
        ...(stored.sessionSharing ?? {}),
      },
    };
  }
  return defaultSettings;
}

function updateSettings(modifier: (settings: Settings) => void): void {
  const settings = getSettings();
  modifier(settings);
  fsSync.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

function listGitWorktreeDirs(dir: string): Promise<string[]> {
  return new Promise((resolve) => {
    if (!dir?.trim()) {
      resolve([]);
      return;
    }

    execFile(
      'git',
      ['-C', dir, 'worktree', 'list', '--porcelain'],
      { timeout: 3000 },
      (error, stdout) => {
        if (error) {
          resolve([]);
          return;
        }

        const dirs = stdout
          .split('\n')
          .filter((line) => line.startsWith('worktree '))
          .map((line) => line.slice('worktree '.length).trim())
          .filter(Boolean)
          .filter((worktreeDir, index, allDirs) => allDirs.indexOf(worktreeDir) === index);

        resolve(dirs);
      }
    );
  });
}

async function configureProxy() {
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
  const noProxy = process.env.NO_PROXY || process.env.no_proxy || '';

  const proxyUrl = httpsProxy || httpProxy;

  if (proxyUrl) {
    console.log('[Main] Configuring proxy');
    await session.defaultSession.setProxy({
      proxyRules: proxyUrl,
      proxyBypassRules: noProxy,
    });
    console.log('[Main] Proxy configured successfully');
  }
}

if (started) app.quit();

// Certificate trust for goosed servers (local and external).
// Both certificate-error (renderer) and setCertificateVerifyProc (main-process
// net.fetch) pin to the exact cert fingerprint. For locally-spawned goosed the
// fingerprint comes from its stdout; for external backends we use Trust-On-First-Use
// (TOFU) — the first TLS handshake pins the cert for the lifetime of the process.
let pinnedCertFingerprint: string | null = null;

// Cached hostname of the configured external goosed server, updated when a
// chat is created so we don't hit the filesystem on every TLS handshake.
let trustedExternalHostname: string | null = null;

function isLocalhost(hostname: string): boolean {
  return hostname === '127.0.0.1' || hostname === 'localhost';
}

function isTrustedHost(hostname: string): boolean {
  if (isLocalhost(hostname)) return true;
  return trustedExternalHostname !== null && hostname === trustedExternalHostname;
}

function normalizeFingerprint(fp: string): string {
  if (fp.startsWith('sha256/')) {
    const b64 = fp.slice('sha256/'.length);
    const buf = Buffer.from(b64, 'base64');
    return Array.from(buf)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(':')
      .toUpperCase();
  }
  return fp.toUpperCase();
}

// Renderer requests: pin to the exact cert goosed generated once known.
// Before the fingerprint is available (during the health-check bootstrap
// window) any localhost cert is accepted so the server can come up.
app.on('certificate-error', (event, _webContents, url, _error, certificate, callback) => {
  const parsed = new URL(url);
  if (!isTrustedHost(parsed.hostname)) {
    callback(false);
    return;
  }
  if (pinnedCertFingerprint) {
    const match =
      normalizeFingerprint(certificate.fingerprint) === pinnedCertFingerprint.toUpperCase();
    event.preventDefault();
    callback(match);
  } else {
    // TOFU: pin the certificate from the first successful handshake.
    pinnedCertFingerprint = normalizeFingerprint(certificate.fingerprint);
    event.preventDefault();
    callback(true);
  }
});

// Fill in GOOSE_LOCALE from the OS region locale once Electron is ready.
// Kept separate from the initial appConfig assignment above because
// app.getSystemLocale() is only available after the app.ready event fires.
app.whenReady().then(() => {
  if (!appConfig.GOOSE_LOCALE) {
    try {
      const sysLocale = app.getSystemLocale();
      if (sysLocale) {
        appConfig.GOOSE_LOCALE = sysLocale;
      }
    } catch {
      // Locale detection is best-effort; renderer will fall back to navigator.language.
    }
  }
});

// Main-process net.fetch: pin to the exact cert goosed generated.
app.whenReady().then(() => {
  session.defaultSession.setCertificateVerifyProc((request, callback) => {
    if (!isTrustedHost(request.hostname)) {
      callback(-3);
      return;
    }
    if (!pinnedCertFingerprint) {
      // TOFU: pin the certificate from the first successful handshake.
      pinnedCertFingerprint = normalizeFingerprint(request.certificate.fingerprint);
      callback(0);
      return;
    }
    const match =
      normalizeFingerprint(request.certificate.fingerprint) === pinnedCertFingerprint.toUpperCase();
    callback(match ? 0 : -2);
  });
});

if (process.env.ENABLE_PLAYWRIGHT) {
  const debugPort = process.env.PLAYWRIGHT_DEBUG_PORT || '9222';
  console.log(`[Main] Enabling Playwright remote debugging on port ${debugPort}`);
  app.commandLine.appendSwitch('remote-debugging-port', debugPort);
}

// In development mode, force registration as the default protocol client
// In production, register normally
if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
  // Development mode - force registration
  console.log('[Main] Development mode: Forcing protocol registration for goose://');
  app.setAsDefaultProtocolClient('goose');

  if (process.platform === 'darwin') {
    try {
      // Reset the default handler to ensure dev version takes precedence
      spawn('open', ['-a', process.execPath, '--args', '--reset-protocol-handler', 'goose'], {
        detached: true,
        stdio: 'ignore',
      });
    } catch {
      console.warn('[Main] Could not reset protocol handler');
    }
  }
} else {
  // Production mode - normal registration
  app.setAsDefaultProtocolClient('goose');
}

// Apply single instance lock on Windows and Linux where it's needed for deep links
// macOS uses the 'open-url' event instead
let gotTheLock = true;
if (process.platform !== 'darwin') {
  gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    app.quit();
  } else {
    app.on('second-instance', (_event, commandLine) => {
      const protocolUrl = commandLine.find((arg) => arg.startsWith('goose://'));
      if (protocolUrl) {
        const parsedUrl = new URL(protocolUrl);
        // If it's a bot/recipe URL, handle it directly by creating a new window
        if (parsedUrl.hostname === 'bot' || parsedUrl.hostname === 'recipe') {
          app.whenReady().then(async () => {
            const recentDirs = loadRecentDirs();
            const openDir = recentDirs.length > 0 ? recentDirs[0] : null;

            const deeplinkData = parseRecipeDeeplink(protocolUrl);
            const scheduledJobId = parsedUrl.searchParams.get('scheduledJob');

            await createChat(app, {
              dir: openDir || undefined,
              recipeDeeplink: deeplinkData?.config,
              scheduledJobId: scheduledJobId || undefined,
              recipeParameters: deeplinkData?.parameters,
            });
          });
          return; // Skip the rest of the handler
        }

        // Handle new-session URL by creating a fresh chat window
        if (parsedUrl.hostname === 'new-session') {
          app.whenReady().then(async () => {
            const recentDirs = loadRecentDirs();
            const openDir = recentDirs.length > 0 ? recentDirs[0] : null;
            await createChat(app, { dir: openDir || undefined });
          });
          return;
        }

        // For non-bot URLs, continue with normal handling
        handleProtocolUrl(protocolUrl);
      }

      // Only focus existing windows for non-bot/recipe URLs
      const existingWindows = BrowserWindow.getAllWindows();
      if (existingWindows.length > 0) {
        const mainWindow = existingWindows[0];
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.focus();
      }
    });
  }

  // Handle protocol URLs on Windows and Linux startup
  const protocolUrl = process.argv.find((arg) => arg.startsWith('goose://'));
  if (protocolUrl) {
    app.whenReady().then(() => {
      handleProtocolUrl(protocolUrl);
    });
  }
}

let firstOpenWindow: BrowserWindow;
let pendingDeepLink: string | null = null;
let openUrlHandledLaunch = false;

async function handleProtocolUrl(url: string) {
  if (!url) return;

  pendingDeepLink = url;

  const parsedUrl = new URL(url);
  const recentDirs = loadRecentDirs();
  const openDir = recentDirs.length > 0 ? recentDirs[0] : null;

  if (parsedUrl.hostname === 'new-session') {
    await createChat(app, { dir: openDir || undefined });
    pendingDeepLink = null;
    return;
  } else if (parsedUrl.hostname === 'bot' || parsedUrl.hostname === 'recipe') {
    // For bot/recipe URLs, get existing window or create new one
    const existingWindows = BrowserWindow.getAllWindows();
    const targetWindow =
      existingWindows.length > 0
        ? existingWindows[0]
        : await createChat(app, { dir: openDir || undefined });
    await processProtocolUrl(parsedUrl, targetWindow);
  } else {
    // For other URL types, reuse existing window if available
    const existingWindows = BrowserWindow.getAllWindows();
    if (existingWindows.length > 0) {
      firstOpenWindow = existingWindows[0];
      if (firstOpenWindow.isMinimized()) {
        firstOpenWindow.restore();
      }
      firstOpenWindow.focus();
    } else {
      firstOpenWindow = await createChat(app, { dir: openDir || undefined });
    }

    if (firstOpenWindow) {
      const webContents = firstOpenWindow.webContents;
      if (webContents.isLoadingMainFrame()) {
        webContents.once('did-finish-load', async () => {
          await processProtocolUrl(parsedUrl, firstOpenWindow);
        });
      } else {
        await processProtocolUrl(parsedUrl, firstOpenWindow);
      }
    }
  }
}

async function processProtocolUrl(parsedUrl: URL, window: BrowserWindow) {
  const recentDirs = loadRecentDirs();
  const openDir = recentDirs.length > 0 ? recentDirs[0] : null;

  if (parsedUrl.hostname === 'extension') {
    window.webContents.send('add-extension', pendingDeepLink);
  } else if (parsedUrl.hostname === 'sessions') {
    window.webContents.send('open-shared-session', pendingDeepLink);
  } else if (parsedUrl.hostname === 'bot' || parsedUrl.hostname === 'recipe') {
    const deeplinkData = parseRecipeDeeplink(pendingDeepLink ?? parsedUrl.toString());
    const scheduledJobId = parsedUrl.searchParams.get('scheduledJob');

    // Create a new window and ignore the passed-in window
    await createChat(app, {
      dir: openDir || undefined,
      recipeDeeplink: deeplinkData?.config,
      scheduledJobId: scheduledJobId || undefined,
      recipeParameters: deeplinkData?.parameters,
    });
    pendingDeepLink = null;
  }
}

let windowDeeplinkURL: string | null = null;

app.on('open-url', async (_event, url) => {
  if (process.platform !== 'win32') {
    const parsedUrl = new URL(url);

    log.info('[Main] Received open-url event:', url.includes('key=') ? url.replace(/key=[^&]+/, 'key=REDACTED') : url);

    await app.whenReady();

    const recentDirs = loadRecentDirs();
    const openDir = recentDirs.length > 0 ? recentDirs[0] : null;

    // Handle new-session URL by creating a fresh chat window
    if (parsedUrl.hostname === 'new-session') {
      log.info('[Main] Detected new-session URL, creating new chat window');
      openUrlHandledLaunch = true;
      await createChat(app, { dir: openDir || undefined });
      return;
    }

    // Handle bot/recipe URLs by directly creating a new window
    if (parsedUrl.hostname === 'bot' || parsedUrl.hostname === 'recipe') {
      log.info('[Main] Detected bot/recipe URL, creating new chat window');
      openUrlHandledLaunch = true;
      const deeplinkData = parseRecipeDeeplink(url);
      if (deeplinkData) {
        windowDeeplinkURL = url;
      }
      const scheduledJobId = parsedUrl.searchParams.get('scheduledJob');

      await createChat(app, {
        dir: openDir || undefined,
        recipeDeeplink: deeplinkData?.config,
        scheduledJobId: scheduledJobId || undefined,
        recipeParameters: deeplinkData?.parameters,
      });
      windowDeeplinkURL = null;
      return;
    }

    // For extension/session URLs, store the deep link for processing after React is ready
    pendingDeepLink = url;
    log.info('[Main] Stored pending deep link for processing after React ready:', url.includes('key=') ? url.replace(/key=[^&]+/, 'key=REDACTED') : url);

    const existingWindows = BrowserWindow.getAllWindows();
    if (existingWindows.length > 0) {
      firstOpenWindow = existingWindows[0];
      if (firstOpenWindow.isMinimized()) firstOpenWindow.restore();
      firstOpenWindow.focus();
      if (parsedUrl.hostname === 'extension') {
        firstOpenWindow.webContents.send('add-extension', pendingDeepLink);
        pendingDeepLink = null;
      } else if (parsedUrl.hostname === 'sessions') {
        firstOpenWindow.webContents.send('open-shared-session', pendingDeepLink);
        pendingDeepLink = null;
      }
    } else {
      openUrlHandledLaunch = true;
      firstOpenWindow = await createChat(app, { dir: openDir || undefined });
    }
  }
});

// Handle macOS drag-and-drop onto dock icon
app.on('will-finish-launching', () => {
  if (process.platform === 'darwin') {
    app.setAboutPanelOptions({
      applicationName: 'Goose',
      applicationVersion: app.getVersion(),
    });
  }
});

// Handle drag-and-drop onto dock icon
app.on('open-file', async (event, filePath) => {
  event.preventDefault();
  await handleFileOpen(filePath);
});

// Handle multiple files/folders (macOS only)
if (process.platform === 'darwin') {
  // Use type assertion for non-standard Electron event
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.on('open-files' as any, async (event: any, filePaths: string[]) => {
    event.preventDefault();
    for (const filePath of filePaths) {
      await handleFileOpen(filePath);
    }
  });
}

async function handleFileOpen(filePath: string) {
  try {
    if (!filePath || typeof filePath !== 'string') {
      return;
    }

    const stats = fsSync.lstatSync(filePath);
    let targetDir = filePath;

    // If it's a file, use its parent directory
    if (stats.isFile()) {
      targetDir = path.dirname(filePath);
    }

    // Add to recent directories
    addRecentDir(targetDir);

    // Create new window for the directory
    const newWindow = await createChat(app, { dir: targetDir });

    // Focus the new window
    if (newWindow) {
      newWindow.show();
      newWindow.focus();
      newWindow.moveTop();
    }
  } catch (error) {
    console.error('Failed to handle file open:', error);

    // Show user-friendly error notification
    new Notification({
      title: 'Goose',
      body: `Could not open directory: ${path.basename(filePath)}`,
    }).show();
  }
}

declare var MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare var MAIN_WINDOW_VITE_NAME: string;

function getAppUrl(): URL {
  return MAIN_WINDOW_VITE_DEV_SERVER_URL
    ? new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
    : pathToFileURL(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
}

// Parse command line arguments
const parseArgs = () => {
  let dirPath = null;

  // Remove first two elements in dev mode (electron and script path)
  const args = !dirPath && app.isPackaged ? process.argv : process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir' && i + 1 < args.length) {
      dirPath = args[i + 1];
      break;
    }
  }

  return { dirPath };
};

interface BundledConfig {
  defaultProvider?: string;
  defaultModel?: string;
  predefinedModels?: string;
  baseUrlShare?: string;
  version?: string;
}

const getBundledConfig = (): BundledConfig => {
  //{env-macro-start}//
  //needed when goose is bundled for a specific provider
  //{env-macro-end}//
  return {
    defaultProvider: process.env.GOOSE_DEFAULT_PROVIDER,
    defaultModel: process.env.GOOSE_DEFAULT_MODEL,
    predefinedModels: process.env.GOOSE_PREDEFINED_MODELS,
    baseUrlShare: process.env.GOOSE_BASE_URL_SHARE,
    version: process.env.GOOSE_VERSION,
  };
};

const { defaultProvider, defaultModel, predefinedModels, baseUrlShare, version } =
  getBundledConfig();

const resolveGoosePathRoot = (): string | undefined => {
  const pathRoot = process.env.GOOSE_PATH_ROOT?.trim();
  if (pathRoot) {
    return expandTilde(pathRoot);
  }
  return undefined;
};

const GENERATED_SECRET = crypto.randomBytes(32).toString('hex');

const getServerSecret = (settings: Settings): string => {
  if (settings.externalGoosed?.enabled && settings.externalGoosed.secret) {
    return settings.externalGoosed.secret;
  }
  if (process.env.GOOSE_EXTERNAL_BACKEND) {
    if (!process.env.GOOSE_SERVER__SECRET_KEY) {
      throw new Error(
        'GOOSE_SERVER__SECRET_KEY must be set when using GOOSE_EXTERNAL_BACKEND. ' +
          'Set it to the same value on both the server and the desktop client.'
      );
    }
    return process.env.GOOSE_SERVER__SECRET_KEY;
  }
  return GENERATED_SECRET;
};

// Sprint 10 (ADR-024): resolve the Oscar bundled-resources root in the main
// process (which has unrestricted Node access). preload.js runs in a sandbox
// and cannot import node:fs/node:path, so detection must happen here and be
// passed through to the renderer via process.argv config below.
const resolveOscarResourcesRoot = (): string | null => {
  const override = process.env.OSCAR_RESOURCES_OVERRIDE;
  if (override && fsSync.existsSync(override)) {
    return override;
  }
  const resourcesPath = process.resourcesPath;
  if (
    resourcesPath &&
    fsSync.existsSync(path.join(resourcesPath, 'python', 'cpython', 'bin', 'python3'))
  ) {
    return resourcesPath;
  }
  return null;
};

// Sprint 11 (ADR-031): expose the bundled in-house-legal skill library to
// Goose's recursive skill walker at `~/.agents/skills/`. Done at app boot
// because the postinst hook runs as root and doesn't know which user will
// launch Oscar GC.
const ensureBundledSkillsLink = (resourcesRoot: string | null): void => {
  const source = resourcesRoot
    ? path.join(resourcesRoot, 'skills', 'in-house-legal')
    : '/srv/projects/goose/skills/in-house-legal';
  if (!fsSync.existsSync(source)) {
    log.warn('ensureBundledSkillsLink: source missing; skipping', { source });
    return;
  }
  const targetParent = path.join(os.homedir(), '.agents', 'skills');
  const target = path.join(targetParent, 'in-house-legal');
  try {
    fsSync.mkdirSync(targetParent, { recursive: true });
    const existing = fsSync.lstatSync(target, { throwIfNoEntry: false });
    if (existing) {
      if (existing.isSymbolicLink() && fsSync.readlinkSync(target) === source) {
        return;
      }
      if (existing.isSymbolicLink()) {
        fsSync.unlinkSync(target);
      } else {
        log.warn(
          'ensureBundledSkillsLink: target exists as non-symlink; leaving alone',
          { target },
        );
        return;
      }
    }
    fsSync.symlinkSync(source, target, 'dir');
    log.info('ensureBundledSkillsLink: symlink created', { source, target });
  } catch (err) {
    log.warn('ensureBundledSkillsLink: failed', {
      err: errorMessage(err, 'Unknown error'),
      source,
      target,
    });
  }
};

const oscarResourcesRoot = resolveOscarResourcesRoot();
ensureBundledSkillsLink(oscarResourcesRoot);

// Sprint 12 (ADR-042): point GOOSE_ALLOWLIST at the bundled local allowlist
// so the Extensions UI cannot install arbitrary MCPs (only Oscar GC's
// bundled MCPs ship — they register via recipes, not via the install flow).
// Set on process.env so the existing getAllowList() consumer (main.ts:3122)
// and goosed both see it.
if (!process.env.GOOSE_ALLOWLIST) {
  const allowlistFile = oscarResourcesRoot
    ? path.join(oscarResourcesRoot, 'allowlist.yaml')
    : path.resolve(__dirname, '..', 'src', 'resources', 'allowlist.yaml');
  if (fsSync.existsSync(allowlistFile)) {
    process.env.GOOSE_ALLOWLIST = `file://${allowlistFile}`;
  } else {
    log.warn('GOOSE_ALLOWLIST: bundled allowlist file missing', { allowlistFile });
  }
}

// Sprint 12 (ADR-044): Top of Mind matter-context file. Stable path under
// ~/.config/oscar/; matters IPC writes/truncates it on matter open/close.
// goosed's tom platform extension reads it on every turn via
// GOOSE_MOIM_MESSAGE_FILE (crates/goose/src/agents/platform_extensions/tom.rs:72-78).
const OSCAR_CONFIG_DIR = path.join(os.homedir(), '.config', 'oscar');
const OSCAR_TOM_ACTIVE_MATTER_FILE = path.join(OSCAR_CONFIG_DIR, 'tom-active-matter.md');

const ensureTomActiveMatterFile = (): void => {
  try {
    fsSync.mkdirSync(OSCAR_CONFIG_DIR, { recursive: true });
    if (!fsSync.existsSync(OSCAR_TOM_ACTIVE_MATTER_FILE)) {
      fsSync.writeFileSync(OSCAR_TOM_ACTIVE_MATTER_FILE, '', 'utf8');
    }
  } catch (err) {
    log.warn('ensureTomActiveMatterFile: failed', {
      err: errorMessage(err, 'Unknown error'),
      path: OSCAR_TOM_ACTIVE_MATTER_FILE,
    });
  }
};
ensureTomActiveMatterFile();

let appConfig = {
  GOOSE_DEFAULT_PROVIDER: defaultProvider,
  GOOSE_DEFAULT_MODEL: defaultModel,
  GOOSE_PREDEFINED_MODELS: predefinedModels,
  GOOSE_API_HOST: 'https://localhost',
  GOOSE_PATH_ROOT: resolveGoosePathRoot(),
  GOOSE_WORKING_DIR: '',
  // Start with the env-var override; the OS region locale is filled in after app.ready
  // (see updateLocaleFromSystem below) since getSystemLocale() cannot be called earlier.
  GOOSE_LOCALE: process.env.GOOSE_LOCALE || undefined,
  // If GOOSE_ALLOWLIST_WARNING env var is not set, defaults to false (strict blocking mode)
  GOOSE_ALLOWLIST_WARNING: process.env.GOOSE_ALLOWLIST_WARNING === 'true',
  OSCAR_RESOURCES_ROOT: oscarResourcesRoot,
  // Sprint 12 (ADR-039): Forge needs the user's home dir to compute the
  // oscar-fs allowed-directories (~/.agents/skills/ + ~/.config/oscar/).
  // The renderer cannot resolve $HOME (no node:os) so we pass it through.
  HOME_DIR: os.homedir(),
};

const windowMap = new Map<number, BrowserWindow>();
const goosedClients = new Map<number, Client>();
const appWindows = new Map<string, BrowserWindow>();

const windowPowerSaveBlockers = new Map<number, number>(); // windowId -> blockerId
// Track pending initial messages per window
const pendingInitialMessages = new Map<number, string>(); // windowId -> initialMessage

interface CreateChatOptions {
  initialMessage?: string;
  dir?: string;
  resumeSessionId?: string;
  viewType?: string;
  recipeDeeplink?: string;
  recipeId?: string;
  scheduledJobId?: string;
  recipeParameters?: Record<string, string>;
}

const createChat = async (app: App, options: CreateChatOptions = {}) => {
  const {
    initialMessage,
    dir,
    resumeSessionId,
    viewType,
    recipeDeeplink,
    recipeId,
    scheduledJobId,
    recipeParameters,
  } = options;
  const settings = getSettings();
  const serverSecret = getServerSecret(settings);

  // Update the cached trusted-external-hostname so the TLS handlers allow
  // connections to the configured remote backend.
  if (settings.externalGoosed?.enabled && settings.externalGoosed.url) {
    try {
      trustedExternalHostname = new URL(settings.externalGoosed.url).hostname;
    } catch {
      trustedExternalHostname = null;
    }
  } else {
    trustedExternalHostname = null;
  }

  // If the user provided a cert fingerprint for the external backend, pin it
  // directly (skips TOFU). Otherwise reset so the first handshake pins via TOFU.
  if (settings.externalGoosed?.enabled && settings.externalGoosed.certFingerprint) {
    pinnedCertFingerprint = normalizeFingerprint(settings.externalGoosed.certFingerprint);
  } else {
    pinnedCertFingerprint = null;
  }

  const goosedResult = await startGoosed({
    serverSecret,
    dir: dir || os.homedir(),
    env: {
      GOOSE_PATH_ROOT: appConfig.GOOSE_PATH_ROOT as string | undefined,
      // Sprint 12 (ADR-044): point tom platform extension at the per-session
      // active-matter file so matter context surfaces on every turn.
      GOOSE_MOIM_MESSAGE_FILE: OSCAR_TOM_ACTIVE_MATTER_FILE,
    },
    externalGoosed: settings.externalGoosed,
    isPackaged: app.isPackaged,
    resourcesPath: app.isPackaged ? process.resourcesPath : undefined,
    logger: log,
    diagnosticsDir: STARTUP_LOGS_DIR,
  });

  // For locally-spawned goosed, pin using the fingerprint from stdout.
  // For external backends the TOFU path in the cert handlers will pin
  // the fingerprint on the first successful TLS handshake.
  if (goosedResult.certFingerprint) {
    pinnedCertFingerprint = goosedResult.certFingerprint;
  }

  app.on('will-quit', async () => {
    log.info('App quitting, terminating goosed server');
    await goosedResult.cleanup();
  });

  const {
    baseUrl,
    workingDir,
    process: goosedProcess,
    errorLog,
    stopErrorLogCollection,
    startupDiagnosticsPath,
    getStartupDiagnostics,
    recordStartupEvent,
  } = goosedResult;

  const mainWindowState = windowStateKeeper({
    defaultWidth: 940,
    defaultHeight: 800,
  });

  const mainWindow = new BrowserWindow({
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
    trafficLightPosition: process.platform === 'darwin' ? { x: 20, y: 16 } : undefined,
    vibrancy: process.platform === 'darwin' ? 'window' : undefined,
    frame: process.platform !== 'darwin',
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    minWidth: 450,
    resizable: true,
    useContentSize: true,
    icon: path.join(__dirname, '../images/icon.icns'),
    webPreferences: {
      spellcheck: settings.spellcheckEnabled ?? true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      nodeIntegration: false,
      contextIsolation: true,
      additionalArguments: [
        JSON.stringify({
          ...appConfig,
          GOOSE_API_HOST: baseUrl,
          GOOSE_WORKING_DIR: workingDir,
          REQUEST_DIR: dir,
          GOOSE_BASE_URL_SHARE: baseUrlShare,
          GOOSE_VERSION: version,
          recipeDeeplink: recipeDeeplink,
          recipeId: recipeId,
          recipeParameters: recipeParameters,
          scheduledJobId: scheduledJobId,
          SECURITY_ML_MODEL_MAPPING: process.env.SECURITY_ML_MODEL_MAPPING,
        }),
      ],
      partition: 'persist:goose',
    },
  });

  if (!app.isPackaged) {
    installExtension(REACT_DEVELOPER_TOOLS, {
      loadExtensionOptions: { allowFileAccess: true },
      session: mainWindow.webContents.session,
    })
      .then(() => log.info('added react dev tools'))
      .catch((err) => log.info('failed to install react dev tools:', err));
  }

  // Re-create the client with Electron's net.fetch so requests to the local
  // self-signed HTTPS server go through the session's certificate handling.
  const goosedClient = createClient(
    createConfig({
      baseUrl,
      fetch: net.fetch as unknown as typeof globalThis.fetch,
      headers: {
        'Content-Type': 'application/json',
        'X-Secret-Key': serverSecret,
      },
    })
  );
  goosedClients.set(mainWindow.id, goosedClient);

  const serverReady = await checkServerStatus(goosedClient, errorLog, {
    onEvent: recordStartupEvent,
  });
  if (!serverReady) {
    const isUsingExternalBackend = settings.externalGoosed?.enabled;
    const diagnostics = getStartupDiagnostics();
    const stderrTail = diagnostics?.stderrTail ?? [];
    const failureDetailParts = [
      diagnostics?.childExitCode !== null || diagnostics?.childExitSignal
        ? `Child exit: code=${diagnostics?.childExitCode ?? 'null'} signal=${diagnostics?.childExitSignal ?? 'null'}`
        : 'Child exit: unavailable',
      diagnostics?.certFingerprintSeen
        ? 'TLS fingerprint observed: yes'
        : 'TLS fingerprint observed: no',
      diagnostics?.healthCheckSucceeded
        ? 'Health check observed: yes'
        : 'Health check observed: no',
      startupDiagnosticsPath ? `Startup diagnostics: ${startupDiagnosticsPath}` : '',
      errorLog.length > 0 ? `Startup errors:\n${errorLog.join('\n')}` : '',
      stderrTail.length > 0 ? `Captured startup stderr:\n${stderrTail.join('\n')}` : '',
    ].filter(Boolean);

    if (isUsingExternalBackend) {
      const response = dialog.showMessageBoxSync({
        type: 'error',
        title: 'External Backend Unreachable',
        message: `Could not connect to external backend at ${settings.externalGoosed?.url}`,
        detail: 'The external goosed server may not be running.',
        buttons: ['Disable External Backend & Retry', 'Quit'],
        defaultId: 0,
        cancelId: 1,
      });

      if (response === 0) {
        updateSettings((s) => {
          if (s.externalGoosed) {
            s.externalGoosed.enabled = false;
          }
        });
        mainWindow.destroy();
        return createChat(app, { initialMessage, dir });
      }
    } else {
      dialog.showMessageBoxSync({
        type: 'error',
        title: 'Goose Failed to Start',
        message: 'The backend server failed to start.',
        detail: failureDetailParts.join('\n\n'),
        buttons: ['OK'],
      });
    }
    app.quit();
  }

  // errorLog is only needed during startup to detect fatal errors.
  // Stop collecting stderr to avoid unbounded memory growth over long sessions.
  stopErrorLogCollection();
  errorLog.length = 0;

  // Nudge the user if mesh is their provider but isn't running.
  // Delay to let the renderer mount before sending the IPC event.
  setTimeout(() => {
    mesh
      .checkProviderRunning(goosedClient)
      .then((ok) => {
        if (!ok && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('mesh-not-running');
        }
      })
      .catch(() => {});
  }, 5000);

  // Let windowStateKeeper manage the window
  mainWindowState.manage(mainWindow);

  mainWindow.webContents.session.setSpellCheckerLanguages(['en-US', 'en-GB']);
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const menu = new Menu();
    const hasSpellingSuggestions = params.dictionarySuggestions.length > 0 || params.misspelledWord;

    if (hasSpellingSuggestions) {
      for (const suggestion of params.dictionarySuggestions) {
        menu.append(
          new MenuItem({
            label: suggestion,
            click: () => mainWindow.webContents.replaceMisspelling(suggestion),
          })
        );
      }

      if (params.misspelledWord) {
        menu.append(
          new MenuItem({
            label: menuT('Add to dictionary'),
            click: () =>
              mainWindow.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
          })
        );
      }

      if (params.selectionText) {
        menu.append(new MenuItem({ type: 'separator' }));
      }
    }
    if (params.selectionText) {
      menu.append(
        new MenuItem({
          label: menuT('Cut'),
          accelerator: 'CmdOrCtrl+X',
          role: 'cut',
        })
      );
      menu.append(
        new MenuItem({
          label: menuT('Copy'),
          accelerator: 'CmdOrCtrl+C',
          role: 'copy',
        })
      );
    }

    // Only show paste in editable fields (text inputs)
    if (params.isEditable) {
      menu.append(
        new MenuItem({
          label: menuT('Paste'),
          accelerator: 'CmdOrCtrl+V',
          role: 'paste',
        })
      );
    }

    if (menu.items.length > 0) {
      menu.popup();
    }
  });

  // Handle new window creation for links (fallback for any links not handled by onClick)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const protocol = new URL(url).protocol;
      if (BLOCKED_PROTOCOLS.includes(protocol)) {
        return { action: 'deny' };
      }
    } catch {
      return { action: 'deny' };
    }

    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Handle new-window events (alternative approach for external links)
  // Use type assertion for non-standard Electron event
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mainWindow.webContents.on('new-window' as any, function (event: any, url: string) {
    event.preventDefault();
    try {
      const protocol = new URL(url).protocol;
      if (BLOCKED_PROTOCOLS.includes(protocol)) {
        return;
      }
    } catch {
      return;
    }
    shell.openExternal(url);
  });

  const windowId = mainWindow.id;
  const url = getAppUrl();

  let appPath = '/';
  const routeMap: Record<string, string> = {
    chat: '/',
    pair: '/pair',
    settings: '/settings',
    sessions: '/sessions',
    schedules: '/schedules',
    recipes: '/recipes',
    skills: '/skills',
    permission: '/permission',
    ConfigureProviders: '/configure-providers',
    sharedSession: '/shared-session',
  };

  if (viewType) {
    appPath = routeMap[viewType] || '/';
  }
  if (
    appPath === '/' &&
    (recipeDeeplink !== undefined || recipeId !== undefined || initialMessage)
  ) {
    appPath = '/pair';
  }

  let searchParams = new URLSearchParams();
  if (resumeSessionId) {
    searchParams.set('resumeSessionId', resumeSessionId);
    if (appPath === '/') {
      appPath = '/pair';
    }
  }

  // Goose's react app uses HashRouter, so the path + search params follow a #/
  url.hash = `${appPath}?${searchParams.toString()}`;
  let formattedUrl = formatUrl(url);
  log.info('Opening URL: ', formattedUrl);
  mainWindow.loadURL(formattedUrl);

  // If we have an initial message, store it to send after React is ready
  if (initialMessage) {
    pendingInitialMessages.set(mainWindow.id, initialMessage);
  }

  // Set up local keyboard shortcuts that only work when the window is focused
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'r' && input.meta) {
      mainWindow.reload();
      event.preventDefault();
    }

    if (input.key === 'i' && input.alt && input.meta) {
      mainWindow.webContents.openDevTools();
      event.preventDefault();
    }
  });

  mainWindow.on('app-command', (e, cmd) => {
    if (cmd === 'browser-backward') {
      mainWindow.webContents.send('mouse-back-button-clicked');
      e.preventDefault();
    }
  });

  // Handle mouse back button (button 3)
  // Use type assertion for non-standard Electron event
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mainWindow.webContents.on('mouse-up' as any, function (_event: any, mouseButton: number) {
    // MouseButton 3 is the back button.
    if (mouseButton === 3) {
      mainWindow.webContents.send('mouse-back-button-clicked');
    }
  });

  windowMap.set(windowId, mainWindow);

  // Handle window closure
  mainWindow.on('closed', () => {
    windowMap.delete(windowId);

    // Clean up pending initial message
    pendingInitialMessages.delete(windowId);

    if (windowPowerSaveBlockers.has(windowId)) {
      const blockerId = windowPowerSaveBlockers.get(windowId)!;
      try {
        powerSaveBlocker.stop(blockerId);
        console.log(
          `[Main] Stopped power save blocker ${blockerId} for closing window ${windowId}`
        );
      } catch (error) {
        console.error(
          `[Main] Failed to stop power save blocker ${blockerId} for window ${windowId}:`,
          error
        );
      }
      windowPowerSaveBlockers.delete(windowId);
    }

    if (goosedProcess && typeof goosedProcess === 'object' && 'kill' in goosedProcess) {
      goosedProcess.kill();
    }
  });
  return mainWindow;
};

let activeLauncherWindow: BrowserWindow | null = null;

const createLauncher = () => {
  if (activeLauncherWindow && !activeLauncherWindow.isDestroyed()) {
    activeLauncherWindow.focus();
    return activeLauncherWindow;
  }

  const launcherWindow = new BrowserWindow({
    width: 600,
    height: 80,
    frame: false,
    transparent: process.platform === 'darwin',
    backgroundColor: process.platform === 'darwin' ? '#00000000' : '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      additionalArguments: [JSON.stringify(appConfig)],
      partition: 'persist:goose',
    },
    skipTaskbar: true,
    alwaysOnTop: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: true,
    vibrancy: process.platform === 'darwin' ? 'window' : undefined,
  });

  // Center on screen
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  const windowBounds = launcherWindow.getBounds();

  launcherWindow.setPosition(
    Math.round(width / 2 - windowBounds.width / 2),
    Math.round(height / 3 - windowBounds.height / 2)
  );

  // Load launcher window content
  const url = getAppUrl();

  url.hash = '/launcher';
  launcherWindow.loadURL(formatUrl(url));
  activeLauncherWindow = launcherWindow;

  launcherWindow.on('closed', () => {
    activeLauncherWindow = null;
  });

  // Destroy window when it loses focus
  launcherWindow.on('blur', () => {
    launcherWindow.destroy();
  });

  // Also destroy on escape key
  launcherWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape') {
      launcherWindow.destroy();
      event.preventDefault();
    }
  });

  return launcherWindow;
};

// Track tray instance
let tray: Tray | null = null;

const destroyTray = () => {
  if (tray) {
    tray.destroy();
    tray = null;
  }
};

const disableTray = () => {
  updateSettings((s) => {
    s.showMenuBarIcon = false;
  });
};

const createTray = () => {
  destroyTray();

  const possiblePaths = [
    path.join(process.resourcesPath, 'images', 'iconTemplate.png'),
    path.join(process.cwd(), 'src', 'images', 'iconTemplate.png'),
    path.join(__dirname, '..', 'images', 'iconTemplate.png'),
    path.join(__dirname, 'images', 'iconTemplate.png'),
    path.join(process.cwd(), 'images', 'iconTemplate.png'),
  ];

  const iconPath = possiblePaths.find((p) => fsSync.existsSync(p));

  if (!iconPath) {
    console.warn('[Main] Tray icon not found. App will continue without system tray.');
    disableTray();
    return;
  }

  try {
    tray = new Tray(iconPath);
    setTrayRef(tray);
    updateTrayMenu(getUpdateAvailable());

    if (process.platform === 'win32') {
      tray.on('click', showWindow);
    }
  } catch (error) {
    console.error('[Main] Tray creation failed. App will continue without system tray.', error);
    disableTray();
    tray = null;
  }
};

const showWindow = async () => {
  const windows = BrowserWindow.getAllWindows();

  if (windows.length === 0) {
    log.info('No windows are open, creating a new one...');
    const recentDirs = loadRecentDirs();
    const openDir = recentDirs.length > 0 ? recentDirs[0] : null;
    await createChat(app, { dir: openDir || undefined });
    return;
  }

  const initialOffsetX = 30;
  const initialOffsetY = 30;

  // Iterate over all windows
  windows.forEach((win, index) => {
    const currentBounds = win.getBounds();
    const newX = currentBounds.x + initialOffsetX * index;
    const newY = currentBounds.y + initialOffsetY * index;

    win.setBounds({
      x: newX,
      y: newY,
      width: currentBounds.width,
      height: currentBounds.height,
    });

    if (!win.isVisible()) {
      win.show();
    }

    win.focus();
  });
};

const buildRecentFilesMenu = () => {
  const recentDirs = loadRecentDirs();
  return recentDirs.map((dir) => ({
    label: dir,
    click: async () => {
      await createChat(app, { dir });
    },
  }));
};

const openDirectoryDialog = async (): Promise<OpenDialogReturnValue> => {
  // Get the current working directory from the focused window
  let defaultPath: string | undefined;
  const currentWindow = BrowserWindow.getFocusedWindow();

  if (currentWindow) {
    try {
      const currentWorkingDir = await currentWindow.webContents.executeJavaScript(
        `window.appConfig ? window.appConfig.get('GOOSE_WORKING_DIR') : null`
      );

      if (currentWorkingDir && typeof currentWorkingDir === 'string') {
        // Verify the directory exists before using it as default
        try {
          const stats = fsSync.lstatSync(currentWorkingDir);
          if (stats.isDirectory()) {
            defaultPath = currentWorkingDir;
          }
        } catch (error) {
          if (error && typeof error === 'object' && 'code' in error) {
            const fsError = error as { code?: string; message?: string };
            if (
              fsError.code === 'ENOENT' ||
              fsError.code === 'EACCES' ||
              fsError.code === 'EPERM'
            ) {
              console.warn(
                `Current working directory not accessible (${fsError.code}): ${currentWorkingDir}, falling back to home directory`
              );
              defaultPath = os.homedir();
            } else {
              console.warn(
                `Unexpected filesystem error (${fsError.code}) for directory ${currentWorkingDir}:`,
                fsError.message
              );
              defaultPath = os.homedir();
            }
          } else {
            console.warn(`Unexpected error checking directory ${currentWorkingDir}:`, error);
            defaultPath = os.homedir();
          }
        }
      }
    } catch (error) {
      console.warn('Failed to get current working directory from window:', error);
    }
  }

  if (!defaultPath) {
    defaultPath = os.homedir();
  }

  const result = (await dialog.showOpenDialog({
    properties: ['openFile', 'openDirectory', 'createDirectory'],
    defaultPath: defaultPath,
  })) as unknown as OpenDialogReturnValue;

  if (!result.canceled && result.filePaths.length > 0) {
    const selectedPath = result.filePaths[0];

    // If a file was selected, use its parent directory
    let dirToAdd = selectedPath;
    try {
      const stats = fsSync.lstatSync(selectedPath);

      // Reject symlinks for security
      if (stats.isSymbolicLink()) {
        console.warn(`Selected path is a symlink, using parent directory for security`);
        dirToAdd = path.dirname(selectedPath);
      } else if (stats.isFile()) {
        dirToAdd = path.dirname(selectedPath);
      }
    } catch {
      console.warn(`Could not stat selected path, using parent directory`);
      dirToAdd = path.dirname(selectedPath); // Fallback to parent directory
    }

    addRecentDir(dirToAdd);

    let deeplinkData: RecipeDeeplinkData | undefined = undefined;
    if (windowDeeplinkURL) {
      deeplinkData = parseRecipeDeeplink(windowDeeplinkURL);
    }
    await createChat(app, {
      dir: dirToAdd,
      recipeDeeplink: deeplinkData?.config,
      recipeParameters: deeplinkData?.parameters,
    });
  }
  return result;
};

interface RecipeDeeplinkData {
  config: string;
  parameters?: Record<string, string>;
}

function parseRecipeDeeplink(url: string): RecipeDeeplinkData | undefined {
  const parsedUrl = new URL(url);
  let recipeDeeplink = parsedUrl.searchParams.get('config');
  if (recipeDeeplink && !url.includes(recipeDeeplink)) {
    // URLSearchParams decodes + as space, which can break encoded configs
    // Parse raw query to preserve "+" characters in values like config
    const search = parsedUrl.search || '';
    const configMatch = search.match(/(?:[?&])config=([^&]*)/);
    let recipeDeeplinkTmp = configMatch ? configMatch[1] : null;
    if (recipeDeeplinkTmp) {
      try {
        recipeDeeplink = decodeURIComponent(recipeDeeplinkTmp);
      } catch (error) {
        console.error('[Main] parseRecipeDeeplink - Failed to decode:', errorMessage(error));
        return undefined;
      }
    }
  }
  if (!recipeDeeplink) {
    return undefined;
  }

  // Extract all query parameters except 'config' and 'scheduledJob' as recipe parameters
  // Use raw query string parsing to preserve '+' characters (consistent with config handling)
  const parameters: Record<string, string> = {};
  const search = parsedUrl.search || '';
  const paramMatches = search.matchAll(/[?&]([^=&]+)=([^&]*)/g);

  for (const match of paramMatches) {
    const key = match[1];
    const rawValue = match[2];

    if (key !== 'config' && key !== 'scheduledJob') {
      try {
        parameters[key] = decodeURIComponent(rawValue);
      } catch {
        // If decoding fails, use raw value
        parameters[key] = rawValue;
      }
    }
  }

  return {
    config: recipeDeeplink,
    parameters: Object.keys(parameters).length > 0 ? parameters : undefined,
  };
}

// Global error handler
const handleFatalError = (error: Error) => {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach((win) => {
    win.webContents.send('fatal-error', error.message || 'An unexpected error occurred');
  });
};

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', formatErrorForLogging(error));
  handleFatalError(error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', formatErrorForLogging(error));
  handleFatalError(error instanceof Error ? error : new Error(String(error)));
});

ipcMain.on('react-ready', (event) => {
  log.info('React ready event received');

  // Get the window that sent the react-ready event
  const window = BrowserWindow.fromWebContents(event.sender);
  const windowId = window?.id;

  // Send any pending initial message for this window
  if (windowId && pendingInitialMessages.has(windowId)) {
    const initialMessage = pendingInitialMessages.get(windowId)!;
    log.info('Sending pending initial message to window:', initialMessage);
    window.webContents.send('set-initial-message', initialMessage);
    pendingInitialMessages.delete(windowId);
  }

  if (pendingDeepLink && window) {
    log.info('Processing pending deep link:', pendingDeepLink);
    try {
      const parsedUrl = new URL(pendingDeepLink);
      if (parsedUrl.hostname === 'extension') {
        log.info('Sending add-extension IPC to ready window');
        window.webContents.send('add-extension', pendingDeepLink);
      } else if (parsedUrl.hostname === 'sessions') {
        log.info('Sending open-shared-session IPC to ready window');
        window.webContents.send('open-shared-session', pendingDeepLink);
      }
      pendingDeepLink = null;
    } catch (error) {
      log.error('Error processing pending deep link:', error);
      pendingDeepLink = null;
    }
  } else {
    log.info('No pending deep link to process');
  }

  log.info('React ready - window is prepared for deep links');
});

ipcMain.handle('open-external', async (_event, url: string) => {
  const parsedUrl = new URL(url);

  if (BLOCKED_PROTOCOLS.includes(parsedUrl.protocol)) {
    console.warn(`[Main] Blocked dangerous protocol: ${parsedUrl.protocol}`);
    return;
  }

  await shell.openExternal(url);
});

ipcMain.handle('directory-chooser', async () => {
  return dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: os.homedir(),
  });
});

ipcMain.handle('add-recent-dir', (_event, dir: string) => {
  if (dir) {
    addRecentDir(dir);
  }
});

ipcMain.handle('list-recent-dirs', () => {
  return loadRecentDirs();
});

ipcMain.handle('list-git-worktree-dirs', async (_event, dir: string) => {
  return await listGitWorktreeDirs(dir);
});

ipcMain.handle('get-setting', (_event, key: SettingKey) => {
  const settings = getSettings();
  return settings[key];
});

// Valid setting keys for runtime validation
const validSettingKeys: Set<string> = new Set([
  'showMenuBarIcon',
  'showDockIcon',
  'enableWakelock',
  'enableNotifications',
  'spellcheckEnabled',
  'externalGoosed',
  'globalShortcut',
  'keyboardShortcuts',
  'theme',
  'useSystemTheme',
  'responseStyle',
  'showPricing',
  'sessionSharing',
  'seenAnnouncementIds',
  'navExpandedWidth',
  // Sprint M1 (ADR-069): right-pane width + sticky toggle.
  'rightPaneWidth',
  'isRightPaneExpanded',
]);

ipcMain.handle('set-setting', (_event, key: SettingKey, value: unknown) => {
  // Validate key at runtime to prevent prototype pollution
  if (!validSettingKeys.has(key)) {
    console.error(`Invalid setting key rejected: ${key}`);
    return;
  }

  const settings = getSettings();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (settings as any)[key] = value;
  fsSync.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));

  // Re-register shortcuts if keyboard shortcuts changed
  if (key === 'keyboardShortcuts') {
    registerGlobalShortcuts();
  }
});

ipcMain.handle('get-secret-key', () => {
  const settings = getSettings();
  return getServerSecret(settings);
});

ipcMain.handle('get-goosed-host-port', async (event) => {
  const windowId = BrowserWindow.fromWebContents(event.sender)?.id;
  if (!windowId) {
    return null;
  }
  const client = goosedClients.get(windowId);
  if (!client) {
    return null;
  }
  return client.getConfig().baseUrl || null;
});

// Oscar user profile (Sprint 6, ADR-011).
// Reads ~/.config/oscar/profile.json (overridable via OSCAR_PROFILE_PATH).
// Returns the parsed object, or null if the file is absent.
// Renderer guards/hooks poll this short-interval during onboarding.
const oscarProfilePath =
  process.env.OSCAR_PROFILE_PATH ||
  path.join(os.homedir(), '.config', 'oscar', 'profile.json');

ipcMain.handle('oscar:read-profile', async () => {
  try {
    const raw = await fs.readFile(oscarProfilePath, 'utf8');
    return JSON.parse(raw) as unknown;
  } catch (err) {
    if ((err as { code?: string }).code === 'ENOENT') {
      return null;
    }
    log.warn('oscar:read-profile failed', { err: errorMessage(err, 'Unknown error') });
    return null;
  }
});

// Sprint 16 (ADR-057, ADR-058): the Tavily key is now resolved by Goose's
// own secret config (env var first, then keyring) at session-spawn via
// merge_environments() + substitute_env_vars(). First-launch key entry is
// handled by the generic RecipeSecretsModal that uses /recipes/scan_secrets.
// The Sprint 15 oscar:resolve-tavily-key IPC handler is intentionally
// removed; the renderer no longer touches the key.

// Sprint 12 (ADRs 036, 038, 043, 044) + Sprint 14 (ADR-047): Matters layer.
// Sprint 14 reshape — split disk layout:
//   - Operational state under ~/.config/oscar/state/<area-id>/
//     (registry matters.json + matters/<slug>/{history.md, notes.md})
//   - Content under ~/Documents/Oscar GC/<Area Name>/<Matter Name>/
//     (matter.md + outputs/ + user-droppable source docs)
// Schema v2 (subject + counterparty? + kind + extras + stakeholder +
// working_dir). v1 registries renamed to .bak on first read and treated as
// empty (pre-pilot; no automated migration).

import {
  MatterEntrySchema,
  MattersFileSchema,
  NewMatterInputSchema,
  UpdateMatterInputSchema,
  type MatterEntry,
  type MattersFile,
} from './components/oscar/matters/types';
import {
  InstalledIntegrationsFileSchema,
  type InstalledIntegrationsFile,
  type InstalledIntegration,
} from './components/oscar/integrations/types';
import { INTEGRATIONS_OVERLAY } from './components/oscar/integrations/registry';
import {
  partyRoleLabel,
  subjectTypeLabel,
  extrasKeyLabel,
} from './components/oscar/matters/matterLabels';
import { kindLabel } from './components/oscar/matters/practiceAreaShapes';
import {
  parseMatterMd,
  renderMatterMd,
} from './components/oscar/matters/matterMdSerde';
import {
  ComputerControllerClient,
  PLAYBOOKS_ROOT as PLAYBOOKS_ROOT_DIR,
  GLOBAL_SCOPE_DIR as PLAYBOOKS_GLOBAL_DIR,
  absPathForRel as playbookAbsPath,
  ensurePlaybookDirs,
  extractText as playbookExtractText,
  isAllowedExt as isPlaybookAllowedExt,
  isBinaryExt as isPlaybookBinaryExt,
  listPlaybooks,
  renderPlaybooksBlock as renderPlaybooksBlockMain,
  renderOnDemandPlaybooksBlock as renderOnDemandPlaybooksBlockMain,
  sanitiseFilename as sanitisePlaybookFilename,
  type PlaybookEntry,
  type PlaybookScope,
} from './components/oscar/playbooks/playbookStore';
import { findGoosedBinaryPath } from './goosed';
import {
  deleteUserSkillDir,
  joinSkills,
  readBundledInventory,
  readUserSkillSlugs,
  renderSkillsBlockMarkdown,
  resolveEnabledSlugs,
  type SkillMode,
  type SkillSlashCommand,
  type SkillsListResult,
} from './components/oscar/skills/skillStore';
import {
  stageUserSkill,
  type StageUserSkillResult,
} from './components/oscar/skills/stageUserSkill';
import { startProfileWriteWatcher } from './components/oscar/forge/profileWriteWatcher';
import { startForgeDeleteWatcher } from './components/oscar/forge/forgeDeleteWatcher';
import { PRACTICE_AREAS } from './components/oscar/practiceAreas';

const OSCAR_STATE_DIR = path.join(os.homedir(), '.config', 'oscar', 'state');
const OSCAR_DOCUMENTS_DIR = path.join(os.homedir(), 'Documents', 'Oscar GC');
// Sprint 19 (ADR-066 D1): dedicated working_dir for unscoped quick-chat
// sessions. Co-located with matter content (same volume) but dot-hidden so
// it's invisible in Finder/file-manager. Memory MCP only creates
// `.goose/memory/` on agent write; an unscoped session that never writes
// locally leaves this directory empty. Top of Mind stays empty for quick
// chats via the existing `oscar:matters:detach-active` IPC.
const OSCAR_QUICK_CHATS_DIR = path.join(OSCAR_DOCUMENTS_DIR, '.quick-chats');

// Sprint 21 (ADR-071) + Sprint 24-A rebrand (ADR-078): Oscar LLP firm-mode
// per-partner working_dir + state file. Each partner gets
// ~/Documents/Oscar GC/Oscar LLP/<slug>/ as their working_dir; Goose Memory's
// agent-working-dir meta scoping isolates memory per partner automatically.
// The state file at ~/.config/oscar/state/oscar-llp/partners.json binds
// partner slugs to session_ids so re-opening a partner from the roster
// resumes the prior chat (mirrors matters.json[slug].session_id pattern).
const OSCAR_LLP_DIR = path.join(OSCAR_DOCUMENTS_DIR, 'Oscar LLP');
const OSCAR_LLP_STATE_DIR = path.join(OSCAR_STATE_DIR, 'oscar-llp');
const OSCAR_LLP_REGISTRY_PATH = path.join(
  OSCAR_LLP_STATE_DIR,
  'partners.json',
);
const oscarLlpWorkingDir = (slug: string) => path.join(OSCAR_LLP_DIR, slug);

// Sprint 24-A (ADR-078): legacy Lavern-named paths from Sprint 21-23. Migrated
// read-time at first read (registry) / first ensure-dir per slug (working dir)
// via atomic fs.rename — mirrors ADR-047 matters-registry backup pattern and
// ADR-032 schema v1→v2 lazy migration. Idempotent + interrupt-safe. Sprint 25
// cleanup removes these constants + the migration helpers once we're confident
// no live host still has legacy data.
const LEGACY_LAVERN_REGISTRY_PATH = path.join(
  OSCAR_STATE_DIR,
  'lavern',
  'partners.json',
);
const LEGACY_LAVERN_DIR = path.join(OSCAR_DOCUMENTS_DIR, 'Lavern');

// area_id → display name. Kept here (small static table) rather than
// importing practiceAreas.ts from renderer code into the main bundle.
const AREA_DISPLAY_NAMES: Record<string, string> = {
  commercial: 'Commercial',
  'commercial-disputes': 'Commercial Disputes',
  corporate: 'Corporate',
  employment: 'Employment',
  'employment-disputes': 'Employment Disputes',
  privacy: 'Privacy',
  ip: 'IP',
  'ip-disputes': 'IP Disputes',
  regulatory: 'Regulatory',
  'regulatory-disputes': 'Regulatory Disputes',
  product: 'Product',
  'ai-governance': 'AI Governance',
  cosec: 'CoSec',
};
const displayAreaName = (areaId: string): string =>
  AREA_DISPLAY_NAMES[areaId] ?? areaId;

const safeAreaId = (raw: unknown): string | null => {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 64) return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw)) return null;
  return raw;
};

const safeSlug = (raw: unknown): string | null => {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 64) return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw)) return null;
  return raw;
};

const areaStateDir = (areaId: string) => path.join(OSCAR_STATE_DIR, areaId);
const mattersRegistryPath = (areaId: string) =>
  path.join(areaStateDir(areaId), 'matters.json');
const matterFolderPath = (areaId: string, slug: string) =>
  path.join(areaStateDir(areaId), 'matters', slug);
const archivedFolderPath = (areaId: string, slug: string) =>
  path.join(areaStateDir(areaId), 'matters', '_archived', slug);

// Filesystem-safe display name (the matter title can contain anything;
// strip / collapse anything that breaks file managers or oscar-fs scope-down).
const safeFilesystemName = (raw: string, fallback: string): string => {
  const cleaned = raw
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return cleaned.length > 0 ? cleaned : fallback;
};

const matterWorkingDir = (areaId: string, matterName: string, slug: string): string =>
  path.join(
    OSCAR_DOCUMENTS_DIR,
    displayAreaName(areaId),
    safeFilesystemName(matterName, slug),
  );

const readMattersRegistry = async (areaId: string): Promise<MattersFile> => {
  const registryPath = mattersRegistryPath(areaId);
  try {
    const raw = await fs.readFile(registryPath, 'utf8');
    const json = JSON.parse(raw) as unknown;
    const result = MattersFileSchema.safeParse(json);
    if (result.success) return result.data;
    // Schema mismatch — likely v1 carry-over from Sprint 12/13. Pre-pilot:
    // back up and start fresh (ADR-047 §migration).
    const bakPath = `${registryPath}.v1.bak`;
    await fs.rename(registryPath, bakPath);
    log.warn('oscar:matters registry v1 → backed up, fresh v2 registry', {
      areaId,
      bakPath,
      issues: result.error.issues.slice(0, 3),
    });
    return { schema_version: 2, matters: [] };
  } catch (err) {
    if ((err as { code?: string }).code === 'ENOENT') {
      return { schema_version: 2, matters: [] };
    }
    log.warn('oscar:matters registry read failed', {
      areaId,
      err: errorMessage(err, 'Unknown error'),
    });
    return { schema_version: 2, matters: [] };
  }
};

const writeMattersRegistry = async (
  areaId: string,
  registry: MattersFile,
): Promise<void> => {
  // Validate at the write boundary too — caller-bug or programmer-error
  // produces a parse failure here, not silently corrupted state on disk.
  MattersFileSchema.parse(registry);
  await fs.mkdir(areaStateDir(areaId), { recursive: true });
  await fs.writeFile(
    mattersRegistryPath(areaId),
    JSON.stringify(registry, null, 2),
    'utf8',
  );
};

const renderTomActiveMatter = (entry: MatterEntry, keyFacts: string): string => {
  const lines: string[] = [
    'You are currently working on this matter:',
    '',
    `- Slug: ${entry.slug}`,
    `- Name: ${entry.name}`,
    `- Practice area: ${displayAreaName(entry.area_id)}`,
    `- ${subjectTypeLabel(entry.subject.type)}: ${entry.subject.label}`,
  ];
  if (entry.counterparty) {
    lines.push(
      `- ${partyRoleLabel(entry.counterparty.role)}: ${entry.counterparty.name}`,
    );
  }
  lines.push(`- Kind: ${kindLabel(entry.area_id, entry.kind)}`);
  if (entry.stakeholder) {
    lines.push(`- Stakeholder: ${entry.stakeholder}`);
  }
  if (entry.extras) {
    for (const [k, v] of Object.entries(entry.extras)) {
      lines.push(`- ${extrasKeyLabel(k)}: ${v}`);
    }
  }
  lines.push(
    `- Privileged: ${entry.privileged ? 'yes' : 'no'}`,
    '',
    'Key facts:',
    keyFacts.trim(),
  );
  return lines.join('\n') + '\n';
};

ipcMain.handle('oscar:matters:list', async (_event, areaIdRaw: unknown) => {
  const areaId = safeAreaId(areaIdRaw);
  if (!areaId) return [];
  const registry = await readMattersRegistry(areaId);
  return [...registry.matters].sort((a, b) =>
    b.last_accessed_at.localeCompare(a.last_accessed_at),
  );
});

ipcMain.handle(
  'oscar:matters:get',
  async (_event, areaIdRaw: unknown, slugRaw: unknown) => {
    const areaId = safeAreaId(areaIdRaw);
    const slug = safeSlug(slugRaw);
    if (!areaId || !slug) return null;
    const registry = await readMattersRegistry(areaId);
    const entry = registry.matters.find((m) => m.slug === slug);
    if (!entry) return null;
    let matterMd: string | null = null;
    try {
      matterMd = await fs.readFile(path.join(entry.working_dir, 'matter.md'), 'utf8');
    } catch {
      matterMd = null;
    }
    return { entry, matter_md: matterMd };
  },
);

ipcMain.handle(
  'oscar:matters:create',
  async (_event, areaIdRaw: unknown, inputRaw: unknown) => {
    const areaId = safeAreaId(areaIdRaw);
    if (!areaId) throw new Error('invalid practice area id');
    // Validate at the IPC boundary per CLAUDE.md "trust internal, validate
    // at boundaries". Any malformed field surfaces here, not deeper.
    const input = NewMatterInputSchema.parse(inputRaw);
    if (fsSync.existsSync(matterFolderPath(areaId, input.slug))) {
      throw new Error(`matter slug '${input.slug}' already exists`);
    }
    if (fsSync.existsSync(archivedFolderPath(areaId, input.slug))) {
      throw new Error(`matter slug '${input.slug}' exists in _archived`);
    }
    const workingDir = matterWorkingDir(areaId, input.name, input.slug);
    if (fsSync.existsSync(workingDir)) {
      throw new Error(`working folder already exists at ${workingDir}`);
    }
    const now = new Date().toISOString();
    const entry: MatterEntry = {
      slug: input.slug,
      name: input.name,
      area_id: areaId,
      kind: input.kind,
      subject: input.subject,
      counterparty: input.counterparty,
      stakeholder: input.stakeholder,
      extras: input.extras,
      working_dir: workingDir,
      opened_at: now,
      last_accessed_at: now,
      status: 'active',
      privileged: input.privileged,
      session_id: null,
      schema_version: 2,
    };
    // Validate the constructed entry. Catches bugs in the constructor here,
    // not when something downstream reads a malformed entry from disk.
    MatterEntrySchema.parse(entry);

    // State folder: operational artefacts the user shouldn't touch directly.
    const stateFolder = matterFolderPath(areaId, input.slug);
    await fs.mkdir(stateFolder, { recursive: true });
    await fs.writeFile(
      path.join(stateFolder, 'history.md'),
      `# History: ${entry.name}\n\nAppend-only event log; most recent at top.\n\n---\n\n## ${now.slice(0, 10)} — Matter opened\n\nIntake completed. Slug: \`${input.slug}\`. Status: active.\n`,
      'utf8',
    );
    await fs.writeFile(
      path.join(stateFolder, 'notes.md'),
      `# Notes: ${entry.name}\n\n`,
      'utf8',
    );

    // Working folder: matter.md + outputs/ + user-droppable source docs.
    // Discoverable in Finder/Explorer; cloud-sync-friendly.
    await fs.mkdir(path.join(workingDir, 'outputs'), { recursive: true });
    await fs.writeFile(
      path.join(workingDir, 'matter.md'),
      renderMatterMd(entry, input.key_facts),
      'utf8',
    );

    const registry = await readMattersRegistry(areaId);
    registry.matters.push(entry);
    await writeMattersRegistry(areaId, registry);
    return entry;
  },
);

// Sprint 29 M5 (ADR-098): in-pane manual edit. Slug is immutable; the
// working dir name was set at create time and renaming it is out of scope.
// We re-render matter.md from the merged entry + new key_facts so the
// agent reads the updated facts on the next set-active. The bound session
// keeps its baked recipe (matter description / loadout caveats already
// carry the next-session-open semantics from ADR-085 / ADR-086).
ipcMain.handle(
  'oscar:matters:update',
  async (_event, areaIdRaw: unknown, slugRaw: unknown, inputRaw: unknown) => {
    const areaId = safeAreaId(areaIdRaw);
    const slug = safeSlug(slugRaw);
    if (!areaId) return { ok: false as const, message: 'invalid practice area id' };
    if (!slug) return { ok: false as const, message: 'invalid matter slug' };
    const parsed = UpdateMatterInputSchema.safeParse(inputRaw);
    if (!parsed.success) {
      return { ok: false as const, message: parsed.error.message };
    }
    const update = parsed.data;
    const registry = await readMattersRegistry(areaId);
    const entry = registry.matters.find((m) => m.slug === slug);
    if (!entry) return { ok: false as const, message: 'matter not found' };
    const next: MatterEntry = {
      ...entry,
      name: update.name,
      kind: update.kind,
      subject: update.subject,
      counterparty: update.counterparty,
      stakeholder: update.stakeholder,
      extras: update.extras,
      privileged: update.privileged,
      last_accessed_at: new Date().toISOString(),
    };
    MatterEntrySchema.parse(next);
    const idx = registry.matters.indexOf(entry);
    registry.matters[idx] = next;
    await writeMattersRegistry(areaId, registry);
    try {
      await fs.writeFile(
        path.join(entry.working_dir, 'matter.md'),
        renderMatterMd(next, update.key_facts),
        'utf8',
      );
    } catch (err) {
      log.warn('oscar:matters:update matter.md write failed', {
        areaId,
        slug,
        err: errorMessage(err, 'Unknown error'),
      });
      return { ok: false as const, message: errorMessage(err, 'matter.md write failed') };
    }
    return { ok: true as const, matter: next };
  },
);

ipcMain.handle(
  'oscar:matters:bind-session',
  async (_event, areaIdRaw: unknown, slugRaw: unknown, sessionIdRaw: unknown) => {
    const areaId = safeAreaId(areaIdRaw);
    const slug = safeSlug(slugRaw);
    if (!areaId || !slug || typeof sessionIdRaw !== 'string') return { ok: false };
    const registry = await readMattersRegistry(areaId);
    const entry = registry.matters.find((m) => m.slug === slug);
    if (!entry) return { ok: false };
    entry.session_id = sessionIdRaw;
    entry.last_accessed_at = new Date().toISOString();
    await writeMattersRegistry(areaId, registry);
    return { ok: true };
  },
);

ipcMain.handle(
  'oscar:matters:archive',
  async (_event, areaIdRaw: unknown, slugRaw: unknown) => {
    const areaId = safeAreaId(areaIdRaw);
    const slug = safeSlug(slugRaw);
    if (!areaId || !slug) return { ok: false };
    const active = matterFolderPath(areaId, slug);
    const archived = archivedFolderPath(areaId, slug);
    if (!fsSync.existsSync(active)) return { ok: false };
    await fs.mkdir(path.dirname(archived), { recursive: true });
    await fs.rename(active, archived);
    const registry = await readMattersRegistry(areaId);
    const entry = registry.matters.find((m) => m.slug === slug);
    if (entry) {
      entry.status = 'closed';
      entry.last_accessed_at = new Date().toISOString();
    }
    await writeMattersRegistry(areaId, registry);
    return { ok: true };
  },
);

ipcMain.handle(
  'oscar:matters:set-active',
  async (_event, areaIdRaw: unknown, slugRaw: unknown) => {
    const areaId = safeAreaId(areaIdRaw);
    const slug = safeSlug(slugRaw);
    if (!areaId || !slug) return { ok: false };
    const registry = await readMattersRegistry(areaId);
    const entry = registry.matters.find((m) => m.slug === slug);
    if (!entry) return { ok: false };
    // Sprint 14 (ADR-047): matter.md lives in the working folder
    // (~/Documents/Oscar GC/...), not the state folder.
    let matterMdBody = '';
    try {
      const md = await fs.readFile(path.join(entry.working_dir, 'matter.md'), 'utf8');
      const keyFactsMatch = md.match(/## Key facts\s*\n+([\s\S]*?)(?=\n## |$)/);
      matterMdBody = keyFactsMatch ? keyFactsMatch[1].trim() : '';
    } catch {
      matterMdBody = '';
    }
    await fs.writeFile(
      OSCAR_TOM_ACTIVE_MATTER_FILE,
      renderTomActiveMatter(entry, matterMdBody),
      'utf8',
    );
    entry.last_accessed_at = new Date().toISOString();
    await writeMattersRegistry(areaId, registry);
    return {
      ok: true,
      state_folder: matterFolderPath(areaId, slug),
      working_dir: entry.working_dir,
    };
  },
);

ipcMain.handle('oscar:matters:detach-active', async () => {
  try {
    await fs.writeFile(OSCAR_TOM_ACTIVE_MATTER_FILE, '', 'utf8');
    return { ok: true };
  } catch (err) {
    log.warn('oscar:matters:detach-active failed', {
      err: errorMessage(err, 'Unknown error'),
    });
    return { ok: false };
  }
});

// Sprint 19 (ADR-066 D1): quick-chat working_dir provisioning. ensure-dir
// is idempotent (mkdir recursive); get-dir is a pure getter for renderer
// filtering of session lists. The QuickChatButton calls ensure-dir before
// `createSession`; ChatHistoryTree calls get-dir to partition sessions
// into the Quick-chats vs matter-bound groups.
ipcMain.handle('oscar:quick-chats:ensure-dir', async () => {
  try {
    await fs.mkdir(OSCAR_QUICK_CHATS_DIR, { recursive: true });
    return { ok: true, path: OSCAR_QUICK_CHATS_DIR };
  } catch (err) {
    log.warn('oscar:quick-chats:ensure-dir failed', {
      err: errorMessage(err, 'Unknown error'),
    });
    return { ok: false, path: OSCAR_QUICK_CHATS_DIR };
  }
});

ipcMain.handle('oscar:quick-chats:get-dir', () => OSCAR_QUICK_CHATS_DIR);

// Sprint 21 (ADR-071) + Sprint 24-A rebrand (ADR-078) + Sprint 27 (ADR-092):
// Oscar LLP partner registry. v2 schema — { sessions: [{id, label?}, ...] }
// per partner, ordered most-recent first by insert order. Session metadata
// (name / created_at / updated_at) read from goosed via listSessions(); only
// the optional user-set label is owned here. v1 entries ({ session_id: "X" })
// are migrated lazily at read-time per ADR-092.
interface OscarLLPSessionEntry {
  id: string;
  label: string | null;
}
interface OscarLLPPartnerState {
  sessions: OscarLLPSessionEntry[];
}
type OscarLLPRegistry = Record<string, OscarLLPPartnerState>;

// Sprint 24-A (ADR-078): one-shot read-time migration from the legacy
// ~/.config/oscar/state/lavern/partners.json path. POSIX-atomic fs.rename;
// safe across interrupted boots. No-op when new path already exists or legacy
// is absent.
const migrateLegacyLavernRegistry = async (): Promise<void> => {
  try {
    await fs.access(OSCAR_LLP_REGISTRY_PATH);
    return;
  } catch {
    // new path missing; check legacy
  }
  try {
    await fs.access(LEGACY_LAVERN_REGISTRY_PATH);
  } catch {
    return;
  }
  try {
    await fs.mkdir(OSCAR_LLP_STATE_DIR, { recursive: true });
    await fs.rename(LEGACY_LAVERN_REGISTRY_PATH, OSCAR_LLP_REGISTRY_PATH);
    log.info('oscar:llp registry migrated from legacy lavern path', {
      from: LEGACY_LAVERN_REGISTRY_PATH,
      to: OSCAR_LLP_REGISTRY_PATH,
    });
  } catch (err) {
    log.warn('oscar:llp legacy registry migration failed', {
      err: errorMessage(err, 'Unknown error'),
    });
  }
};

const readOscarLlpRegistry = async (): Promise<OscarLLPRegistry> => {
  await migrateLegacyLavernRegistry();
  try {
    const raw = await fs.readFile(OSCAR_LLP_REGISTRY_PATH, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return {};
    const result: OscarLLPRegistry = {};
    for (const [slug, value] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      if (!safeSlug(slug)) continue;
      if (typeof value !== 'object' || value === null) continue;
      const v = value as Record<string, unknown>;

      // v2: { sessions: [{id, label?}, ...] }
      if (Array.isArray(v.sessions)) {
        const sessions: OscarLLPSessionEntry[] = [];
        const seen = new Set<string>();
        for (const s of v.sessions) {
          if (typeof s !== 'object' || s === null) continue;
          const entry = s as Record<string, unknown>;
          if (typeof entry.id !== 'string' || entry.id.length === 0) continue;
          if (seen.has(entry.id)) continue;
          seen.add(entry.id);
          sessions.push({
            id: entry.id,
            label: typeof entry.label === 'string' ? entry.label : null,
          });
        }
        result[slug] = { sessions };
        continue;
      }

      // v1 lazy upgrade per ADR-092: { session_id: "X" } →
      // { sessions: [{ id: "X", label: "(legacy)" }] }. Persisted on next
      // mutation; v1 entries with null session_id drop out (no useful info).
      if (typeof v.session_id === 'string' && v.session_id.length > 0) {
        result[slug] = {
          sessions: [{ id: v.session_id, label: '(legacy)' }],
        };
      }
    }
    return result;
  } catch (err) {
    if ((err as { code?: string }).code === 'ENOENT') return {};
    log.warn('oscar:llp registry read failed', {
      err: errorMessage(err, 'Unknown error'),
    });
    return {};
  }
};

// Sprint 27 (ADR-092): atomic write via .tmp + fs.rename. Interrupt-safety
// floor for the per-partner sessions array, which grows over time.
const writeOscarLlpRegistry = async (registry: OscarLLPRegistry): Promise<void> => {
  await fs.mkdir(OSCAR_LLP_STATE_DIR, { recursive: true });
  const tmp = OSCAR_LLP_REGISTRY_PATH + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(registry, null, 2), 'utf8');
  await fs.rename(tmp, OSCAR_LLP_REGISTRY_PATH);
};

// Sprint 24-A (ADR-078): one-shot per-slug migration of legacy
// ~/Documents/Oscar GC/Lavern/<slug>/ working dirs to the Oscar LLP path.
// fs.rename is atomic on the same volume and carries .goose/memory/ + any
// user-saved files with it as a single inode move. No-op when new exists or
// legacy is absent.
const migrateLegacyLavernWorkingDir = async (slug: string): Promise<void> => {
  const newDir = oscarLlpWorkingDir(slug);
  try {
    await fs.access(newDir);
    return;
  } catch {
    // new missing; check legacy
  }
  const legacyDir = path.join(LEGACY_LAVERN_DIR, slug);
  try {
    await fs.access(legacyDir);
  } catch {
    return;
  }
  try {
    await fs.mkdir(OSCAR_LLP_DIR, { recursive: true });
    await fs.rename(legacyDir, newDir);
    log.info('oscar:llp working dir migrated from legacy lavern path', {
      slug,
      from: legacyDir,
      to: newDir,
    });
  } catch (err) {
    log.warn('oscar:llp legacy working-dir migration failed', {
      slug,
      err: errorMessage(err, 'Unknown error'),
    });
  }
};

ipcMain.handle('oscar:llp:ensure-dir', async (_event, slugRaw: unknown) => {
  const slug = safeSlug(slugRaw);
  if (!slug) return { ok: false, path: '' };
  await migrateLegacyLavernWorkingDir(slug);
  const dir = oscarLlpWorkingDir(slug);
  try {
    await fs.mkdir(dir, { recursive: true });
    return { ok: true, path: dir };
  } catch (err) {
    log.warn('oscar:llp:ensure-dir failed', {
      slug,
      err: errorMessage(err, 'Unknown error'),
    });
    return { ok: false, path: dir };
  }
});

// Sprint 27 (ADR-092): bind-session PREPENDS to the partner's sessions array
// rather than overwriting a single binding. Dedupes by id — if the same
// session is bound twice, the first occurrence wins and the array is left
// in stable order. The optional label argument lets callers set a user-set
// override; null/undefined falls back to goosed's Session.name at render
// time.
ipcMain.handle(
  'oscar:llp:bind-session',
  async (
    _event,
    slugRaw: unknown,
    sessionIdRaw: unknown,
    labelRaw: unknown,
  ) => {
    const slug = safeSlug(slugRaw);
    if (
      !slug ||
      typeof sessionIdRaw !== 'string' ||
      sessionIdRaw.length === 0
    ) {
      return { ok: false };
    }
    const label = typeof labelRaw === 'string' ? labelRaw : null;
    const registry = await readOscarLlpRegistry();
    const existing = registry[slug]?.sessions ?? [];
    if (existing.some((s) => s.id === sessionIdRaw)) {
      return { ok: true };
    }
    registry[slug] = {
      sessions: [{ id: sessionIdRaw, label }, ...existing],
    };
    await writeOscarLlpRegistry(registry);
    return { ok: true };
  },
);

// Sprint 27 (ADR-092): reserved for a future "delete partner session" UI.
// Removes the entry from sessions[]; leaves the goosed session row alone
// (deletion of the underlying session is a separate concern owned by
// goosed's session API).
ipcMain.handle(
  'oscar:llp:unbind-session',
  async (_event, slugRaw: unknown, sessionIdRaw: unknown) => {
    const slug = safeSlug(slugRaw);
    if (
      !slug ||
      typeof sessionIdRaw !== 'string' ||
      sessionIdRaw.length === 0
    ) {
      return { ok: false };
    }
    const registry = await readOscarLlpRegistry();
    const existing = registry[slug]?.sessions ?? [];
    const next = existing.filter((s) => s.id !== sessionIdRaw);
    if (next.length === 0) {
      delete registry[slug];
    } else {
      registry[slug] = { sessions: next };
    }
    await writeOscarLlpRegistry(registry);
    return { ok: true };
  },
);

ipcMain.handle(
  'oscar:llp:lookup-state',
  async (_event, slugRaw: unknown) => {
    const slug = safeSlug(slugRaw);
    if (!slug) return null;
    const registry = await readOscarLlpRegistry();
    return registry[slug] ?? null;
  },
);

ipcMain.handle('oscar:llp:list-partner-states', async () =>
  readOscarLlpRegistry(),
);

// Sprint 24-B (ADR-079, ADR-080): Lavern Pipeline launch surface IPCs.
// The pipeline working dir is a sibling of per-partner working dirs under
// ~/Documents/Oscar GC/Oscar LLP/; users drop docs in there. The precedent-
// board state lives at ~/.config/oscar/state/lavern/ (ADR-080 per-user-per-
// area scope via oscar-baselines-mcp's OSCAR_BASELINES_DIR env override).
const LAVERN_PIPELINE_DIR = path.join(OSCAR_LLP_DIR, 'lavern-pipeline');
const LAVERN_STATE_DIR = path.join(OSCAR_STATE_DIR, 'lavern');
const LAVERN_PRECEDENTS_DIR = path.join(LAVERN_STATE_DIR, 'precedents');
const PIPELINE_DOC_EXTENSIONS = new Set(['.txt', '.md', '.pdf', '.docx', '.doc']);

ipcMain.handle('oscar:llp:pipeline:ensure-dir', async () => {
  try {
    await fs.mkdir(LAVERN_PIPELINE_DIR, { recursive: true });
    await fs.mkdir(LAVERN_PRECEDENTS_DIR, { recursive: true });
    return {
      ok: true,
      workingDir: LAVERN_PIPELINE_DIR,
      precedentsDir: LAVERN_PRECEDENTS_DIR,
    };
  } catch (err) {
    log.warn('oscar:llp:pipeline:ensure-dir failed', {
      err: errorMessage(err, 'Unknown error'),
    });
    return { ok: false, workingDir: '', precedentsDir: '' };
  }
});

ipcMain.handle('oscar:llp:pipeline:list-recent-docs', async () => {
  try {
    const entries = await fs.readdir(LAVERN_PIPELINE_DIR, { withFileTypes: true });
    const docs = entries
      .filter((e) => e.isFile())
      .filter((e) => PIPELINE_DOC_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
      .map((e) => ({ name: e.name, path: path.join(LAVERN_PIPELINE_DIR, e.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { docs };
  } catch (err) {
    if ((err as { code?: string }).code === 'ENOENT') return { docs: [] };
    log.warn('oscar:llp:pipeline:list-recent-docs failed', {
      err: errorMessage(err, 'Unknown error'),
    });
    return { docs: [] };
  }
});

// Sprint 14 (ADR-047): reverse lookup — given a session_id (from BaseChat),
// find the matter bound to it. Used by the matter back-button affordance to
// know which practice area to navigate back to. Returns null if the session
// isn't bound to any matter. Scans all area registries; the count is small
// (13 areas, dozens of matters per area in dogfood-scale use).
ipcMain.handle('oscar:matters:lookup-session', async (_event, sessionIdRaw: unknown) => {
  if (typeof sessionIdRaw !== 'string' || sessionIdRaw.length === 0) return null;
  try {
    const entries = await fs.readdir(OSCAR_STATE_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const areaId = entry.name;
      const registry = await readMattersRegistry(areaId);
      const match = registry.matters.find((m) => m.session_id === sessionIdRaw);
      if (match) {
        return {
          area_id: match.area_id,
          area_name: displayAreaName(match.area_id),
          slug: match.slug,
          name: match.name,
        };
      }
    }
    return null;
  } catch (err) {
    if ((err as { code?: string }).code === 'ENOENT') return null;
    log.warn('oscar:matters:lookup-session failed', {
      err: errorMessage(err, 'Unknown error'),
    });
    return null;
  }
});

// Sprint 20-M3 (ADR-083): right-pane MatterFacts/ProgrammeFacts reader.
// Reads the same matter.md the agent reads (ADR-047) + the same Top of
// Mind file the agent reads (ADR-044). The renderer polls every 2 s; this
// handler is the thin file-fetch + parse shim.
ipcMain.handle(
  'oscar:right-pane:read-matter-facts',
  async (_event, areaIdRaw: unknown, slugRaw: unknown) => {
    const areaId = safeAreaId(areaIdRaw);
    const slug = safeSlug(slugRaw);
    if (!areaId || !slug) return null;
    const registry = await readMattersRegistry(areaId);
    const entry = registry.matters.find((m) => m.slug === slug);
    if (!entry) return null;

    let matterMdRaw = '';
    try {
      matterMdRaw = await fs.readFile(
        path.join(entry.working_dir, 'matter.md'),
        'utf8',
      );
    } catch (err) {
      if ((err as { code?: string }).code !== 'ENOENT') {
        log.warn('oscar:right-pane:read-matter-facts: matter.md read failed', {
          areaId,
          slug,
          err: errorMessage(err, 'Unknown error'),
        });
      }
    }

    const parsed = parseMatterMd(matterMdRaw);

    // Top of Mind is renderer-visible only when it points at this matter.
    // setActive writes "- Slug: <slug>" into the file; detachActive truncates.
    let tomMd: string | null = null;
    try {
      const tomRaw = await fs.readFile(OSCAR_TOM_ACTIVE_MATTER_FILE, 'utf8');
      if (tomRaw.length > 0 && tomRaw.includes(`Slug: ${slug}`)) {
        tomMd = tomRaw;
      }
    } catch {
      tomMd = null;
    }

    return {
      name: entry.name,
      subject: parsed.subject,
      counterparty: parsed.counterparty,
      kind: parsed.kind,
      stakeholder: parsed.stakeholder,
      privileged: parsed.privileged,
      extras: parsed.extras,
      key_facts_md: parsed.key_facts_md,
      tom_md: tomMd,
    };
  },
);

// Sprint 20-M4 (ADR-084, ADR-085): playbooks subsystem. Five handlers
// mirror the M3 right-pane shape — list, upload, toggle-always-on, delete,
// and render-block (the recipe-build-time Layer 1 injection helper).
//
// Binary extraction goes through Goose's bundled computercontroller MCP
// (reuse per CLAUDE.md "Reuse over rebuild"); text formats are raw reads.
// profile.json writes use atomic temp+rename — same pattern Forge Mode B
// established via oscar-fs__write_file (ADR-039). The Sprint 12 "single-
// writer" comment below applies to v2-schema migrations only; M4's writes
// touch area_overrides.playbooks.always_on additively.

const OSCAR_PROFILE_PATH = path.join(os.homedir(), '.config', 'oscar', 'profile.json');
// Sprint 20-M7 (ADR-089): the watcher's rollback target — refreshed on
// every validated write; restored over profile.json on a rejected one.
const OSCAR_PROFILE_BACKUP_PATH = `${OSCAR_PROFILE_PATH}.bak`;
const PLAYBOOKS_ALWAYS_ON_CAP = 8000;

interface ProfileShape {
  schema_version: number;
  practice_areas?: Array<{
    id: string;
    area_overrides?: {
      playbooks?: { always_on?: string[]; on_demand?: string[] };
      enabled_skills?: { mode?: string; slugs?: string[] };
      enabled_mcps?: { mode?: string; ids?: string[] };
    } & Record<string, unknown>;
  } & Record<string, unknown>>;
}

const safeRelPath = (raw: unknown): string | null => {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 256) return null;
  // Must be "<scope>/<filename>", POSIX separator only.
  const parts = raw.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  if (parts[0].includes('..') || parts[1].includes('..') || raw.includes('\0')) return null;
  return raw;
};

const safeScope = (raw: unknown): PlaybookScope | null => {
  if (raw === 'global' || raw === 'area') return raw;
  return null;
};

async function readProfileFile(): Promise<ProfileShape | null> {
  try {
    const raw = await fs.readFile(OSCAR_PROFILE_PATH, 'utf8');
    return JSON.parse(raw) as ProfileShape;
  } catch {
    return null;
  }
}

async function writeProfileFile(profile: ProfileShape): Promise<void> {
  const tmp = `${OSCAR_PROFILE_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(profile, null, 2), { mode: 0o600 });
  await fs.rename(tmp, OSCAR_PROFILE_PATH);
}

function getAlwaysOnList(profile: ProfileShape | null, areaId: string): string[] {
  const area = profile?.practice_areas?.find((a) => a.id === areaId);
  return area?.area_overrides?.playbooks?.always_on ?? [];
}

async function mutateAlwaysOn(
  areaId: string,
  mutator: (list: string[]) => string[],
): Promise<string[]> {
  const profile = await readProfileFile();
  if (!profile) throw new Error('profile.json not found');
  const areas = profile.practice_areas ?? [];
  const idx = areas.findIndex((a) => a.id === areaId);
  if (idx < 0) throw new Error(`area ${areaId} not in profile`);
  const area = areas[idx];
  const overrides = area.area_overrides ?? {};
  const playbooks = overrides.playbooks ?? { always_on: [], on_demand: [] };
  const currentList = playbooks.always_on ?? [];
  const nextList = mutator([...currentList]);
  const newProfile: ProfileShape = {
    ...profile,
    practice_areas: [
      ...areas.slice(0, idx),
      {
        ...area,
        area_overrides: {
          ...overrides,
          playbooks: { always_on: nextList, on_demand: playbooks.on_demand ?? [] },
        },
      },
      ...areas.slice(idx + 1),
    ],
  };
  await writeProfileFile(newProfile);
  return nextList;
}

function resolveGoosedBin(): string {
  return findGoosedBinaryPath({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
  });
}

ipcMain.handle(
  'oscar:playbooks:list',
  async (_event, areaIdRaw: unknown): Promise<PlaybookEntry[]> => {
    const areaId = safeAreaId(areaIdRaw);
    if (!areaId) return [];
    const profile = await readProfileFile();
    const alwaysOn = getAlwaysOnList(profile, areaId);
    return listPlaybooks(areaId, alwaysOn);
  },
);

ipcMain.handle(
  'oscar:playbooks:upload',
  async (
    _event,
    areaIdRaw: unknown,
    scopeRaw: unknown,
    filenameRaw: unknown,
    bytesRaw: unknown,
  ): Promise<{ ok: true; relPath: string } | { ok: false; code: string; message: string }> => {
    const areaId = safeAreaId(areaIdRaw);
    if (!areaId) return { ok: false, code: 'EBADAREA', message: 'Invalid area id' };
    const scope = safeScope(scopeRaw);
    if (!scope) return { ok: false, code: 'EBADSCOPE', message: 'Invalid scope' };
    let filename: string;
    try {
      filename = sanitisePlaybookFilename(String(filenameRaw ?? ''));
    } catch (err) {
      const code = (err as { code?: string }).code ?? 'EBADNAME';
      return { ok: false, code, message: (err as Error).message };
    }
    if (!(bytesRaw instanceof Uint8Array || ArrayBuffer.isView(bytesRaw))) {
      return { ok: false, code: 'EBADBODY', message: 'Expected Uint8Array bytes' };
    }
    const bytes = Buffer.from(bytesRaw as Uint8Array);
    await ensurePlaybookDirs(areaId);
    const scopeDirName = scope === 'global' ? PLAYBOOKS_GLOBAL_DIR : areaId;
    const target = path.join(PLAYBOOKS_ROOT_DIR, scopeDirName, filename);
    try {
      // Open with wx flag (write-exclusive) so existing files don't get
      // silently clobbered — the pane surfaces an EEXIST toast.
      await fs.writeFile(target, bytes, { flag: 'wx', mode: 0o600 });
    } catch (err) {
      const code = (err as { code?: string }).code ?? 'EIO';
      return { ok: false, code, message: errorMessage(err, 'Upload failed') };
    }
    return { ok: true, relPath: `${scopeDirName}/${filename}` };
  },
);

ipcMain.handle(
  'oscar:playbooks:toggle-always-on',
  async (
    _event,
    areaIdRaw: unknown,
    relPathRaw: unknown,
    nextRaw: unknown,
  ): Promise<
    | { ok: true; alwaysOn: boolean; budgetCap: number }
    | { ok: false; code: string; message: string; extractedLength?: number; cap?: number }
  > => {
    const areaId = safeAreaId(areaIdRaw);
    const relPath = safeRelPath(relPathRaw);
    if (!areaId || !relPath) {
      return { ok: false, code: 'EBADNAME', message: 'Invalid area or playbook path' };
    }
    const next = nextRaw === true;
    if (next) {
      // Per-file budget check at toggle time: extract once and reject if a
      // single file alone exceeds the always-on cap. Multi-file budget is
      // redistributed proportionally at recipe-build time (per-file =
      // floor(cap / count)) so we don't need to check totals here.
      let absPath: string;
      try {
        absPath = playbookAbsPath(relPath);
      } catch (err) {
        return { ok: false, code: 'EBADNAME', message: (err as Error).message };
      }
      try {
        const stat = await fs.stat(absPath);
        if (!stat.isFile()) {
          return { ok: false, code: 'ENOENT', message: 'Playbook not found' };
        }
      } catch {
        return { ok: false, code: 'ENOENT', message: 'Playbook not found' };
      }
      const needsCc = isPlaybookBinaryExt(absPath);
      const cc = needsCc ? new ComputerControllerClient(resolveGoosedBin()) : null;
      let extracted = '';
      try {
        extracted = await playbookExtractText(absPath, cc);
      } catch (err) {
        await cc?.close();
        return {
          ok: false,
          code: 'EEXTRACT',
          message: errorMessage(err, 'Extraction failed'),
        };
      }
      await cc?.close();
      if (extracted.length > PLAYBOOKS_ALWAYS_ON_CAP) {
        return {
          ok: false,
          code: 'EBUDGET',
          message: `Exceeds the ${PLAYBOOKS_ALWAYS_ON_CAP / 1000}K always-on budget — kept on-demand instead.`,
          extractedLength: extracted.length,
          cap: PLAYBOOKS_ALWAYS_ON_CAP,
        };
      }
    }
    try {
      await mutateAlwaysOn(areaId, (list) => {
        const set = new Set(list);
        if (next) set.add(relPath);
        else set.delete(relPath);
        return Array.from(set).sort();
      });
    } catch (err) {
      return {
        ok: false,
        code: 'EWRITE',
        message: errorMessage(err, 'Profile write failed'),
      };
    }
    return { ok: true, alwaysOn: next, budgetCap: PLAYBOOKS_ALWAYS_ON_CAP };
  },
);

ipcMain.handle(
  'oscar:playbooks:delete',
  async (
    _event,
    areaIdRaw: unknown,
    relPathRaw: unknown,
  ): Promise<{ ok: true } | { ok: false; code: string; message: string }> => {
    const areaId = safeAreaId(areaIdRaw);
    const relPath = safeRelPath(relPathRaw);
    if (!areaId || !relPath) {
      return { ok: false, code: 'EBADNAME', message: 'Invalid area or playbook path' };
    }
    let absPath: string;
    try {
      absPath = playbookAbsPath(relPath);
    } catch (err) {
      return { ok: false, code: 'EBADNAME', message: (err as Error).message };
    }
    try {
      await fs.unlink(absPath);
    } catch (err) {
      if ((err as { code?: string }).code !== 'ENOENT') {
        return { ok: false, code: 'EIO', message: errorMessage(err, 'Delete failed') };
      }
      // File already gone — still scrub from always_on lists.
    }
    // Scrub the relPath from every area's always_on list so deletion doesn't
    // leave dangling references. Walk every practice_area for safety.
    const profile = await readProfileFile();
    if (profile?.practice_areas) {
      let mutated = false;
      const next: ProfileShape = {
        ...profile,
        practice_areas: profile.practice_areas.map((a) => {
          const list = a.area_overrides?.playbooks?.always_on ?? [];
          if (!list.includes(relPath)) return a;
          mutated = true;
          return {
            ...a,
            area_overrides: {
              ...(a.area_overrides ?? {}),
              playbooks: {
                always_on: list.filter((p) => p !== relPath),
                on_demand: a.area_overrides?.playbooks?.on_demand ?? [],
              },
            },
          };
        }),
      };
      if (mutated) await writeProfileFile(next);
    }
    return { ok: true };
  },
);

ipcMain.handle(
  'oscar:playbooks:render-block',
  async (
    _event,
    relPathsRaw: unknown,
    charCapRaw: unknown,
  ): Promise<string | null> => {
    if (!Array.isArray(relPathsRaw)) return null;
    const relPaths = (relPathsRaw as unknown[])
      .map((r) => safeRelPath(r))
      .filter((r): r is string => r !== null);
    if (relPaths.length === 0) return null;
    const cap =
      typeof charCapRaw === 'number' && charCapRaw > 0
        ? charCapRaw
        : PLAYBOOKS_ALWAYS_ON_CAP;
    try {
      return await renderPlaybooksBlockMain(relPaths, cap, resolveGoosedBin());
    } catch (err) {
      log.warn('oscar:playbooks:render-block failed', {
        err: errorMessage(err, 'Unknown error'),
      });
      return null;
    }
  },
);

// Sprint 29 M6 (ADR-099): on-demand playbook discovery block. Lists
// non-always-on playbooks for the area so the agent knows what to
// reach for. Empty list → null block → builder skips the slot.
ipcMain.handle(
  'oscar:playbooks:render-on-demand-block',
  async (
    _event,
    areaIdRaw: unknown,
    alwaysOnRaw: unknown,
  ): Promise<string | null> => {
    const areaId = safeAreaId(areaIdRaw);
    if (!areaId) return null;
    const alwaysOn = Array.isArray(alwaysOnRaw)
      ? (alwaysOnRaw as unknown[])
          .map((r) => safeRelPath(r))
          .filter((r): r is string => r !== null)
      : [];
    try {
      return await renderOnDemandPlaybooksBlockMain(areaId, alwaysOn);
    } catch (err) {
      log.warn('oscar:playbooks:render-on-demand-block failed', {
        err: errorMessage(err, 'Unknown error'),
      });
      return null;
    }
  },
);

// Suppress unused-import lint for narrow helpers used only by typed handlers.
void isPlaybookAllowedExt;

// Sprint 20-M5 (ADR-086): skills visibility + per-area scoping. Five
// handlers mirror the M4 right-pane shape — list, set-mode, toggle-slug,
// delete, render-block (the recipe-build-time prompt-enumeration helper).
//
// Skill name + description come from goosed's existing
// GET /config/slash_commands (CommandType === 'Skill'); the bundled-vs-user
// discrimination joins against fs.readdir of
// <inHouseLegalRoot>/<plugin>/skills/ and ~/.agents/skills/. No YAML parser
// (Goose did it server-side via serde_yaml); no new npm dep. Mirrors M4's
// computercontroller-reuse pivot.

const bundledSourcesForArea = (areaId: string): readonly string[] => {
  const entry = PRACTICE_AREAS.find((a) => a.id === areaId);
  return entry?.bundled_skill_sources ?? [];
};

const allBundledPlugins = (): readonly string[] => {
  const set = new Set<string>();
  for (const a of PRACTICE_AREAS) {
    for (const p of a.bundled_skill_sources ?? []) set.add(p);
  }
  return Array.from(set);
};

async function fetchSkillSlashCommands(
  client: Client | null,
): Promise<SkillSlashCommand[]> {
  if (!client) return [];
  try {
    const resp = await getSlashCommands({
      client,
      query: { working_dir: os.homedir() },
      throwOnError: true,
    });
    const commands = resp.data?.commands ?? [];
    return commands as SkillSlashCommand[];
  } catch (err) {
    log.warn('oscar:skills slash_commands fetch failed', {
      err: errorMessage(err, 'Unknown error'),
    });
    return [];
  }
}

function readEnabledSkillsOverride(
  profile: ProfileShape | null,
  areaId: string,
): { mode: SkillMode; slugs: string[] } {
  const area = profile?.practice_areas?.find((a) => a.id === areaId);
  const override = area?.area_overrides?.enabled_skills;
  const rawMode = override?.mode;
  const mode: SkillMode =
    rawMode === 'allow' || rawMode === 'deny' ? rawMode : 'all';
  const slugs = Array.isArray(override?.slugs)
    ? (override?.slugs as string[]).filter((s) => typeof s === 'string')
    : [];
  return { mode, slugs };
}

async function mutateEnabledSkills(
  areaId: string,
  mutator: (current: { mode: SkillMode; slugs: string[] }) => {
    mode: SkillMode;
    slugs: string[];
  },
): Promise<{ mode: SkillMode; slugs: string[] }> {
  const profile = await readProfileFile();
  if (!profile) throw new Error('profile.json not found');
  const areas = profile.practice_areas ?? [];
  const idx = areas.findIndex((a) => a.id === areaId);
  if (idx < 0) throw new Error(`area ${areaId} not in profile`);
  const area = areas[idx];
  const overrides = area.area_overrides ?? {};
  const current = readEnabledSkillsOverride(profile, areaId);
  const next = mutator(current);
  const newProfile: ProfileShape = {
    ...profile,
    practice_areas: [
      ...areas.slice(0, idx),
      {
        ...area,
        area_overrides: {
          ...overrides,
          enabled_skills: { mode: next.mode, slugs: next.slugs },
        },
      },
      ...areas.slice(idx + 1),
    ],
  };
  await writeProfileFile(newProfile);
  return next;
}

// Sprint 20-M8 (ADR-091 archive-don't-delete): area-level archive
// destination. One folder per delete event, suffix = ISO timestamp from
// the marker (with ':' replaced so filesystems on Windows / FAT-rooted
// volumes don't reject it). Disambiguated from the second ADR-091
// (pane-visibility-recovery, Sprint 28).
const OSCAR_ARCHIVE_DIR = path.join(OSCAR_STATE_DIR, '_archive');

const archiveSuffixFromIso = (iso: string): string =>
  iso.replace(/:/g, '-').replace(/\.\d{3}Z$/, 'Z');

async function archiveAreaState(
  areaId: string,
  timestamp: string,
): Promise<string> {
  const src = areaStateDir(areaId);
  const dst = path.join(
    OSCAR_ARCHIVE_DIR,
    `${areaId}-${archiveSuffixFromIso(timestamp)}`,
  );
  // Copy first, then remove. If copy fails, source survives untouched. If
  // rm fails after a successful cp, the archive has the data and we log —
  // data is in two places, not zero (ADR-091 caveat).
  try {
    await fs.access(src);
  } catch {
    // No state folder for this area — nothing to archive on disk. Still
    // return a destination string so the caller can record it; the dir
    // is not created.
    return dst;
  }
  await fs.mkdir(OSCAR_ARCHIVE_DIR, { recursive: true });
  await fs.cp(src, dst, { recursive: true });
  try {
    await fs.rm(src, { recursive: true, force: true });
  } catch (err) {
    log.warn('oscar:forge archive-area: rm source failed post-copy', {
      areaId,
      src,
      dst,
      err: errorMessage(err, 'rm failed'),
    });
  }
  return dst;
}

async function removePracticeArea(areaId: string): Promise<void> {
  const profile = await readProfileFile();
  if (!profile) throw new Error('profile.json not found');
  const areas = profile.practice_areas ?? [];
  const idx = areas.findIndex((a) => a.id === areaId);
  if (idx < 0) throw new Error(`area ${areaId} not in profile`);
  const newProfile: ProfileShape = {
    ...profile,
    practice_areas: [...areas.slice(0, idx), ...areas.slice(idx + 1)],
  };
  await writeProfileFile(newProfile);
}

const markerPathForArea = (areaId: string): string =>
  path.join(OSCAR_CONFIG_DIR, `_forge_request_delete_${areaId}.json`);

const unlinkMarkerIfPresent = async (areaId: string): Promise<void> => {
  try {
    await fs.unlink(markerPathForArea(areaId));
  } catch (err) {
    if ((err as { code?: string }).code !== 'ENOENT') {
      log.warn('oscar:forge unlink-marker failed', {
        areaId,
        err: errorMessage(err, 'unlink failed'),
      });
    }
  }
};

ipcMain.handle(
  'oscar:forge:confirm-delete-area',
  async (
    _event,
    areaIdRaw: unknown,
    timestampRaw: unknown,
  ): Promise<{ ok: true; archivedTo: string } | { ok: false; reason: string }> => {
    const areaId = safeAreaId(areaIdRaw);
    if (!areaId) return { ok: false, reason: 'invalid areaId' };
    const timestamp =
      typeof timestampRaw === 'string' && timestampRaw.length > 0
        ? timestampRaw
        : new Date().toISOString();
    try {
      const archivedTo = await archiveAreaState(areaId, timestamp);
      await removePracticeArea(areaId);
      await unlinkMarkerIfPresent(areaId);
      return { ok: true, archivedTo };
    } catch (err) {
      log.error('oscar:forge:confirm-delete-area failed', {
        areaId,
        err: errorMessage(err, 'confirm-delete failed'),
      });
      return { ok: false, reason: errorMessage(err, 'confirm-delete failed') };
    }
  },
);

ipcMain.handle(
  'oscar:forge:cancel-delete-area',
  async (
    _event,
    areaIdRaw: unknown,
  ): Promise<{ ok: true } | { ok: false; reason: string }> => {
    const areaId = safeAreaId(areaIdRaw);
    if (!areaId) return { ok: false, reason: 'invalid areaId' };
    await unlinkMarkerIfPresent(areaId);
    return { ok: true };
  },
);

ipcMain.handle(
  'oscar:skills:list',
  async (event, areaIdRaw: unknown): Promise<SkillsListResult> => {
    const areaId = safeAreaId(areaIdRaw);
    if (!areaId) return { mode: 'all', skills: [] };
    const profile = await readProfileFile();
    const { mode, slugs } = readEnabledSkillsOverride(profile, areaId);
    const windowId = BrowserWindow.fromWebContents(event.sender)?.id;
    const client = windowId ? (goosedClients.get(windowId) ?? null) : null;
    const slashCommands = await fetchSkillSlashCommands(client);
    const root = inHouseLegalRoot();
    const areaBundled = await readBundledInventory(
      root,
      bundledSourcesForArea(areaId),
    );
    const userSkills = await readUserSkillSlugs();
    const skills = joinSkills(slashCommands, areaBundled, userSkills, mode, slugs);
    return { mode, skills };
  },
);

// Sprint 29 M1 (ADR-094): toggle preserves the existing mode shape.
// Sprint 28's deny-shape coercion mishandled the 'allow' migration
// (current.slugs in allow-mode is the ENABLED set, not the disabled
// one), so flipping one skill on inverted every other slug's meaning.
// Read-path joinSkills already honours all three modes; only the write
// path needed to stop coercing.
ipcMain.handle(
  'oscar:skills:toggle',
  async (
    _event,
    areaIdRaw: unknown,
    slugRaw: unknown,
    enabledRaw: unknown,
  ): Promise<
    | { ok: true; enabled: boolean }
    | { ok: false; code: string; message: string }
  > => {
    const areaId = safeAreaId(areaIdRaw);
    if (!areaId) return { ok: false, code: 'EBADAREA', message: 'Invalid area id' };
    const slug = safeSlug(slugRaw);
    if (!slug) return { ok: false, code: 'EBADSLUG', message: 'Invalid skill slug' };
    const enabled = enabledRaw === true;
    try {
      await mutateEnabledSkills(areaId, (current) => {
        if (current.mode === 'all') {
          if (enabled) return { mode: 'all', slugs: [] };
          return { mode: 'deny', slugs: [slug] };
        }
        if (current.mode === 'allow') {
          const enabledSet = new Set(current.slugs);
          if (enabled) enabledSet.add(slug);
          else enabledSet.delete(slug);
          return { mode: 'allow', slugs: Array.from(enabledSet).sort() };
        }
        const disabledSet = new Set(current.slugs);
        if (enabled) disabledSet.delete(slug);
        else disabledSet.add(slug);
        return { mode: 'deny', slugs: Array.from(disabledSet).sort() };
      });
      return { ok: true, enabled };
    } catch (err) {
      return {
        ok: false,
        code: 'EWRITE',
        message: errorMessage(err, 'Profile write failed'),
      };
    }
  },
);

ipcMain.handle(
  'oscar:skills:delete',
  async (
    _event,
    _areaIdRaw: unknown,
    slugRaw: unknown,
  ): Promise<{ ok: true } | { ok: false; code: string; message: string }> => {
    const slug = safeSlug(slugRaw);
    if (!slug) return { ok: false, code: 'EBADSLUG', message: 'Invalid skill slug' };
    const root = inHouseLegalRoot();
    const globalBundled = await readBundledInventory(root, allBundledPlugins());
    const result = await deleteUserSkillDir(slug, globalBundled);
    if (!result.ok) {
      return {
        ok: false,
        code: result.code ?? 'EIO',
        message: result.message ?? 'Delete failed',
      };
    }
    // Cross-area scrub: drop the slug from every area's
    // enabled_skills.slugs so deletion doesn't leave dangling references.
    const profile = await readProfileFile();
    if (profile?.practice_areas) {
      let mutated = false;
      const nextProfile: ProfileShape = {
        ...profile,
        practice_areas: profile.practice_areas.map((a) => {
          const list = a.area_overrides?.enabled_skills?.slugs ?? [];
          if (!list.includes(slug)) return a;
          mutated = true;
          const overrides = a.area_overrides ?? {};
          const prev = overrides.enabled_skills ?? { mode: 'all', slugs: [] };
          return {
            ...a,
            area_overrides: {
              ...overrides,
              enabled_skills: {
                mode: prev.mode,
                slugs: list.filter((s) => s !== slug),
              },
            },
          };
        }),
      };
      if (mutated) await writeProfileFile(nextProfile);
    }
    return { ok: true };
  },
);

// Sprint 20-M6 (ADR-087): stage a lawyer-uploaded SKILL.md into
// ~/.agents/skills/<slug>/SKILL.md. Atomic via wx-flag (mirrors
// oscar:playbooks:upload at main.ts:2376). Renderer drop-zone deep-links
// Forge to #/forge?reviewSkill=<absPath> on success — Mode C reviews,
// enriches, and binds.
ipcMain.handle(
  'oscar:skills:stage-for-review',
  async (
    _event,
    slugRaw: unknown,
    contentRaw: unknown,
  ): Promise<StageUserSkillResult> => {
    if (typeof slugRaw !== 'string') {
      return { ok: false, code: 'EBADSLUG', message: 'Slug must be a string' };
    }
    if (typeof contentRaw !== 'string') {
      return {
        ok: false,
        code: 'EBADFRONTMATTER',
        message: 'SKILL.md content must be a string',
      };
    }
    const root = inHouseLegalRoot();
    const globalBundled = await readBundledInventory(root, allBundledPlugins());
    return stageUserSkill(slugRaw, contentRaw, globalBundled);
  },
);

ipcMain.handle(
  'oscar:skills:render-block',
  async (event, areaIdRaw: unknown): Promise<string | null> => {
    const areaId = safeAreaId(areaIdRaw);
    if (!areaId) return null;
    try {
      const profile = await readProfileFile();
      const { mode, slugs } = readEnabledSkillsOverride(profile, areaId);
      const windowId = BrowserWindow.fromWebContents(event.sender)?.id;
      const client = windowId ? (goosedClients.get(windowId) ?? null) : null;
      const slashCommands = await fetchSkillSlashCommands(client);
      const root = inHouseLegalRoot();
      const areaBundled = await readBundledInventory(
        root,
        bundledSourcesForArea(areaId),
      );
      const userSkills = await readUserSkillSlugs();
      const joined = joinSkills(
        slashCommands,
        areaBundled,
        userSkills,
        mode,
        slugs,
      );
      const allowed = resolveEnabledSlugs(joined);
      return renderSkillsBlockMarkdown(allowed);
    } catch (err) {
      log.warn('oscar:skills:render-block failed', {
        err: errorMessage(err, 'Unknown error'),
      });
      return null;
    }
  },
);

// Sprint 28 M2 (ADR-092): right-pane Tools section. Lists the MCPs the
// agent has access to for a matter — bundled-for-area (universal +
// commercial's redline) and per-area installed integrations. Toggle on
// installed-only persists to area_overrides.enabled_mcps using the same
// `{ mode: 'deny', ids: [...disabled] }` shape Skills will land on in M3;
// existing 'all' / 'allow' shapes are migrated on read.

interface BundledToolStatic {
  id: string;
  displayName: string;
  description: string;
}

const UNIVERSAL_BUNDLED_TOOLS: readonly BundledToolStatic[] = [
  {
    id: 'oscar-fs',
    displayName: 'Filesystem (matter scope)',
    description:
      'Read and write files in this matter folder only. Sibling matters are not visible.',
  },
  {
    id: 'computercontroller',
    displayName: 'Document extraction',
    description: 'Extracts text from PDF and DOCX files when the agent reads them.',
  },
  {
    id: 'Tavily',
    displayName: 'Web search (Tavily)',
    description:
      'Regulatory-currency lookups and open-web research. Queries leave the device.',
  },
];

const COMMERCIAL_BUNDLED_REDLINE: BundledToolStatic = {
  id: 'redline',
  displayName: 'Redlining (Adeu)',
  description: 'Generate tracked-change redlines on .docx files.',
};

function bundledToolsForArea(areaId: string): BundledToolStatic[] {
  if (areaId === 'commercial') {
    return [...UNIVERSAL_BUNDLED_TOOLS, COMMERCIAL_BUNDLED_REDLINE];
  }
  return [...UNIVERSAL_BUNDLED_TOOLS];
}

type McpMode = 'all' | 'allow' | 'deny';

function readEnabledMcpsOverride(
  profile: ProfileShape | null,
  areaId: string,
): { mode: McpMode; ids: string[] } {
  const area = profile?.practice_areas?.find((a) => a.id === areaId);
  const override = area?.area_overrides?.enabled_mcps;
  const rawMode = override?.mode;
  const mode: McpMode =
    rawMode === 'allow' || rawMode === 'deny' ? rawMode : 'all';
  const ids = Array.isArray(override?.ids)
    ? (override?.ids as string[]).filter((s) => typeof s === 'string')
    : [];
  return { mode, ids };
}

async function mutateEnabledMcps(
  areaId: string,
  mutator: (current: { mode: McpMode; ids: string[] }) => {
    mode: McpMode;
    ids: string[];
  },
): Promise<{ mode: McpMode; ids: string[] }> {
  const profile = await readProfileFile();
  if (!profile) throw new Error('profile.json not found');
  const areas = profile.practice_areas ?? [];
  const idx = areas.findIndex((a) => a.id === areaId);
  if (idx < 0) throw new Error(`area ${areaId} not in profile`);
  const area = areas[idx];
  const overrides = area.area_overrides ?? {};
  const current = readEnabledMcpsOverride(profile, areaId);
  const next = mutator(current);
  const newProfile: ProfileShape = {
    ...profile,
    practice_areas: [
      ...areas.slice(0, idx),
      {
        ...area,
        area_overrides: {
          ...overrides,
          enabled_mcps: { mode: next.mode, ids: next.ids },
        },
      },
      ...areas.slice(idx + 1),
    ],
  };
  await writeProfileFile(newProfile);
  return next;
}

interface ToolEntry {
  id: string;
  displayName: string;
  description: string;
  source: 'bundled' | 'installed';
  enabled: boolean;
}

ipcMain.handle('oscar:tools:list', async (_event, areaIdRaw: unknown): Promise<{
  tools: ToolEntry[];
}> => {
  const areaId = safeAreaId(areaIdRaw);
  if (!areaId) return { tools: [] };
  const bundled = bundledToolsForArea(areaId);
  const installed = await readInstalledIntegrations(areaId);
  const profile = await readProfileFile();
  const { mode, ids } = readEnabledMcpsOverride(profile, areaId);
  const isEnabled = (id: string): boolean => {
    if (mode === 'all') return true;
    if (mode === 'allow') return ids.includes(id);
    return !ids.includes(id);
  };
  const tools: ToolEntry[] = bundled.map((t) => ({
    ...t,
    source: 'bundled',
    enabled: true,
  }));
  for (const entry of installed.installed_integrations) {
    if (!entry.trust_acknowledged) continue;
    const overlay = INTEGRATIONS_OVERLAY[entry.id];
    tools.push({
      id: entry.id,
      displayName: overlay?.overlay_title ?? entry.id,
      description:
        overlay?.overlay_description ?? overlay?.facts_note ?? '',
      source: 'installed',
      enabled: isEnabled(entry.id),
    });
  }
  return { tools };
});

ipcMain.handle(
  'oscar:tools:toggle',
  async (
    _event,
    areaIdRaw: unknown,
    idRaw: unknown,
    enabledRaw: unknown,
  ): Promise<
    | { ok: true; enabled: boolean }
    | { ok: false; code: string; message: string }
  > => {
    const areaId = safeAreaId(areaIdRaw);
    if (!areaId) return { ok: false, code: 'EBADAREA', message: 'Invalid area id' };
    if (typeof idRaw !== 'string' || idRaw.length === 0 || idRaw.length > 128) {
      return { ok: false, code: 'EBADID', message: 'Invalid tool id' };
    }
    const toolId = idRaw;
    const enabled = enabledRaw === true;
    try {
      await mutateEnabledMcps(areaId, (current) => {
        // Normalize to the deny-shape on every write. The recipe filter
        // (MattersLanding) reads { mode, ids } so disabling = adding to
        // ids; enabling = removing from ids. Migration from older 'allow'
        // shapes: precompute the would-be-disabled set from the area's
        // current installed list and rewrite as deny. M3 takes the same
        // approach for skills.
        let disabled = new Set<string>();
        if (current.mode === 'deny') {
          disabled = new Set(current.ids);
        } else if (current.mode === 'allow') {
          // We don't have the full installed-set here; preserve the
          // explicit toggle and let the next read collapse correctly.
          disabled = new Set(current.ids);
        }
        if (enabled) disabled.delete(toolId);
        else disabled.add(toolId);
        return { mode: 'deny', ids: Array.from(disabled).sort() };
      });
      return { ok: true, enabled };
    } catch (err) {
      return {
        ok: false,
        code: 'EWRITE',
        message: errorMessage(err, 'Profile write failed'),
      };
    }
  },
);

// Sprint 17 (ADR-059, ADR-061): Integrations registry + per-area state.
// Vendor data read from skills/in-house-legal/<plugin>/.mcp.json files
// (the same source-of-truth the upstream claude-for-legal ships). The
// hand-curated INTEGRATIONS_OVERLAY in renderer-land joins on entry id.
//
// Path resolution mirrors ensureBundledSkillsLink above:
// - Packaged: <resourcesRoot>/skills/in-house-legal/<plugin>/.mcp.json
// - Dev:      /srv/projects/goose/skills/in-house-legal/<plugin>/.mcp.json

const inHouseLegalRoot = (): string =>
  oscarResourcesRoot
    ? path.join(oscarResourcesRoot, 'skills', 'in-house-legal')
    : '/srv/projects/goose/skills/in-house-legal';

interface VendorMcpEntry {
  id: string;
  plugin_slug: string;
  type: string;
  url?: string;
  title: string;
  description: string;
}

// Sibling state file alongside matters.json (ADR-061). Electron main owns
// reads + writes; profile.json stays single-writer (only oscar-onboarding-
// mcp::finalize_profile writes profile.json).
const installedIntegrationsPath = (areaId: string) =>
  path.join(areaStateDir(areaId), 'installed_integrations.json');

const readInstalledIntegrations = async (
  areaId: string,
): Promise<InstalledIntegrationsFile> => {
  const filePath = installedIntegrationsPath(areaId);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const json = JSON.parse(raw) as unknown;
    const result = InstalledIntegrationsFileSchema.safeParse(json);
    if (result.success) return result.data;
    log.warn('oscar:integrations registry read: schema mismatch', {
      areaId,
      filePath,
      issues: result.error.issues.slice(0, 3),
    });
    return { schema_version: 1, installed_integrations: [] };
  } catch (err) {
    if ((err as { code?: string }).code === 'ENOENT') {
      return { schema_version: 1, installed_integrations: [] };
    }
    log.warn('oscar:integrations registry read failed', {
      areaId,
      err: errorMessage(err, 'Unknown error'),
    });
    return { schema_version: 1, installed_integrations: [] };
  }
};

const writeInstalledIntegrations = async (
  areaId: string,
  file: InstalledIntegrationsFile,
): Promise<void> => {
  InstalledIntegrationsFileSchema.parse(file);
  await fs.mkdir(areaStateDir(areaId), { recursive: true });
  await fs.writeFile(
    installedIntegrationsPath(areaId),
    JSON.stringify(file, null, 2),
    'utf8',
  );
};

ipcMain.handle('oscar:integrations:list-available', async () => {
  const root = inHouseLegalRoot();
  const out: VendorMcpEntry[] = [];
  let pluginDirs: import('fs').Dirent[];
  try {
    pluginDirs = await fs.readdir(root, { withFileTypes: true });
  } catch (err) {
    if ((err as { code?: string }).code === 'ENOENT') {
      log.warn('oscar:integrations:list-available: skills root missing', {
        root,
      });
      return out;
    }
    log.warn('oscar:integrations:list-available: readdir failed', {
      err: errorMessage(err, 'Unknown error'),
      root,
    });
    return out;
  }
  for (const dirent of pluginDirs) {
    if (!dirent.isDirectory()) continue;
    const pluginSlug = dirent.name;
    const mcpPath = path.join(root, pluginSlug, '.mcp.json');
    let raw: string;
    try {
      raw = await fs.readFile(mcpPath, 'utf8');
    } catch (err) {
      if ((err as { code?: string }).code === 'ENOENT') continue;
      log.warn('oscar:integrations:list-available: read failed', {
        err: errorMessage(err, 'Unknown error'),
        mcpPath,
      });
      continue;
    }
    let parsed: { mcpServers?: Record<string, unknown> };
    try {
      parsed = JSON.parse(raw) as { mcpServers?: Record<string, unknown> };
    } catch (err) {
      log.warn('oscar:integrations:list-available: parse failed', {
        err: errorMessage(err, 'Unknown error'),
        mcpPath,
      });
      continue;
    }
    const servers = parsed.mcpServers ?? {};
    for (const [id, value] of Object.entries(servers)) {
      if (typeof value !== 'object' || value === null) continue;
      const v = value as { type?: unknown; url?: unknown; title?: unknown; description?: unknown };
      const type = typeof v.type === 'string' ? v.type : 'http';
      const url = typeof v.url === 'string' ? v.url : undefined;
      const title = typeof v.title === 'string' ? v.title : id;
      const description = typeof v.description === 'string' ? v.description : '';
      out.push({ id, plugin_slug: pluginSlug, type, url, title, description });
    }
  }
  return out;
});

ipcMain.handle('oscar:integrations:list', async (_event, areaIdRaw: unknown) => {
  const areaId = safeAreaId(areaIdRaw);
  if (!areaId) return [];
  const file = await readInstalledIntegrations(areaId);
  return file.installed_integrations;
});

ipcMain.handle(
  'oscar:integrations:install',
  async (
    _event,
    areaIdRaw: unknown,
    entryIdRaw: unknown,
    trustAcknowledgedRaw: unknown,
  ) => {
    const areaId = safeAreaId(areaIdRaw);
    if (!areaId) throw new Error('invalid practice area id');
    if (typeof entryIdRaw !== 'string' || entryIdRaw.length === 0) {
      throw new Error('invalid entry id');
    }
    // Reject ids not in the overlay — fail-closed per ADR-060. The
    // renderer's loadRegistry already filters to overlay-known entries;
    // this is defence-in-depth.
    if (!INTEGRATIONS_OVERLAY[entryIdRaw]) {
      throw new Error(`unknown integration id: ${entryIdRaw}`);
    }
    // Bundled entries are not installable (ADR-060): they're always-on.
    if (INTEGRATIONS_OVERLAY[entryIdRaw].security_tier === 'bundled') {
      throw new Error(
        `integration "${entryIdRaw}" is bundled and cannot be installed`,
      );
    }
    const trustAcknowledged = trustAcknowledgedRaw === true;
    const file = await readInstalledIntegrations(areaId);
    const existing = file.installed_integrations.find(
      (e) => e.id === entryIdRaw,
    );
    if (existing) {
      // Idempotent: no-op if already installed. UI flips to Installed
      // state and won't surface the Add button again, so this branch is
      // mostly defensive against double-clicks.
      return { ok: true, already_installed: true };
    }
    const entry: InstalledIntegration = {
      id: entryIdRaw,
      added_at: new Date().toISOString(),
      trust_acknowledged: trustAcknowledged,
    };
    file.installed_integrations.push(entry);
    await writeInstalledIntegrations(areaId, file);
    return { ok: true, already_installed: false };
  },
);

// Sprint 17 (ADR-062): one-shot startup log enumerating the runtime egress
// envelope. Walks all practice-area state dirs, resolves installed entry
// ids against INTEGRATIONS_OVERLAY, emits a single line:
//   "egress envelope: N integrations across M areas → host1, host2, ..."
// Hostnames only (no entry ids, no credentials). Useful for support when
// a pilot user reports a misbehaving agent: the log tells you which
// extensions are widening the outbound surface without reading profile.
// Fail-silent (the log is informational; it must never block app boot).
const logEgressEnvelope = async (): Promise<void> => {
  try {
    let areaDirs: import('fs').Dirent[];
    try {
      areaDirs = await fs.readdir(OSCAR_STATE_DIR, { withFileTypes: true });
    } catch (err) {
      if ((err as { code?: string }).code === 'ENOENT') return;
      throw err;
    }
    const hosts = new Set<string>();
    let entryCount = 0;
    let areaCount = 0;
    for (const dirent of areaDirs) {
      if (!dirent.isDirectory()) continue;
      const file = await readInstalledIntegrations(dirent.name);
      if (file.installed_integrations.length === 0) continue;
      areaCount += 1;
      for (const e of file.installed_integrations) {
        entryCount += 1;
        const overlay = INTEGRATIONS_OVERLAY[e.id];
        if (overlay?.service_endpoint_host) {
          hosts.add(overlay.service_endpoint_host);
        }
      }
    }
    if (entryCount === 0) return;
    log.info('egress envelope', {
      integration_count: entryCount,
      area_count: areaCount,
      hosts: [...hosts].sort(),
    });
  } catch (err) {
    log.warn('logEgressEnvelope failed', {
      err: errorMessage(err, 'Unknown error'),
    });
  }
};

// Fire-and-forget at module load; the log appears alongside other boot
// diagnostics. Not awaited so it never delays goosed spawn.
void logEgressEnvelope();

// Handle menu bar icon visibility
ipcMain.handle('set-menu-bar-icon', async (_event, show: boolean) => {
  updateSettings((s) => {
    s.showMenuBarIcon = show;
  });

  if (show) {
    createTray();
  } else {
    destroyTray();
  }
  return true;
});

ipcMain.handle('get-menu-bar-icon-state', () => {
  try {
    const settings = getSettings();
    return settings.showMenuBarIcon ?? true;
  } catch (error) {
    console.error('Error getting menu bar icon state:', error);
    return true;
  }
});

// Handle dock icon visibility (macOS only)
ipcMain.handle('set-dock-icon', async (_event, show: boolean) => {
  if (process.platform !== 'darwin') return false;

  const settings = getSettings();
  updateSettings((s) => {
    s.showDockIcon = show;
  });

  if (show) {
    app.dock?.show();
  } else {
    // Only hide the dock if we have a menu bar icon to maintain accessibility
    if (settings.showMenuBarIcon) {
      app.dock?.hide();
      setTimeout(() => {
        focusWindow();
      }, 50);
    }
  }
  return true;
});

ipcMain.handle('get-dock-icon-state', () => {
  try {
    if (process.platform !== 'darwin') return true;
    const settings = getSettings();
    return settings.showDockIcon ?? true;
  } catch (error) {
    console.error('Error getting dock icon state:', error);
    return true;
  }
});

// Handle opening system notifications preferences
ipcMain.handle('open-notifications-settings', async () => {
  try {
    if (process.platform === 'darwin') {
      spawn('open', ['x-apple.systempreferences:com.apple.preference.notifications']);
      return true;
    } else if (process.platform === 'win32') {
      // Windows: Open notification settings in Settings app
      spawn('ms-settings:notifications', { shell: true });
      return true;
    } else if (process.platform === 'linux') {
      // Linux: Try different desktop environments
      function canSpawn(cmd: string): boolean {
        try {
          execFileSync('which', [cmd], { stdio: 'ignore' });
          return true;
        } catch {
          return false;
        }
      }

      // GNOME
      if (canSpawn('gnome-control-center')) {
        spawn('gnome-control-center', ['notifications']);
        return true;
      }

      // KDE Plasma
      if (canSpawn('systemsettings5')) {
        spawn('systemsettings5', ['kcm_notifications']);
        return true;
      }

      // XFCE
      if (canSpawn('xfce4-settings-manager')) {
        spawn('xfce4-settings-manager', ['--socket-id=notifications']);
        return true;
      }

      console.warn('Could not find a suitable settings application for Linux');
      return false;
    } else {
      console.warn(
        `Opening notification settings is not supported on platform: ${process.platform}`
      );
      return false;
    }
  } catch (error) {
    console.error('Error opening notification settings:', error);
    return false;
  }
});

// Handle wakelock setting
ipcMain.handle('set-wakelock', async (_event, enable: boolean) => {
  updateSettings((s) => {
    s.enableWakelock = enable;
  });

  // Stop all existing power save blockers when disabling the setting
  if (!enable) {
    for (const [windowId, blockerId] of windowPowerSaveBlockers.entries()) {
      try {
        powerSaveBlocker.stop(blockerId);
        console.log(
          `[Main] Stopped power save blocker ${blockerId} for window ${windowId} due to wakelock setting disabled`
        );
      } catch (error) {
        console.error(
          `[Main] Failed to stop power save blocker ${blockerId} for window ${windowId}:`,
          error
        );
      }
    }
    windowPowerSaveBlockers.clear();
  }

  return true;
});

ipcMain.handle('get-wakelock-state', () => {
  try {
    const settings = getSettings();
    return settings.enableWakelock ?? false;
  } catch (error) {
    console.error('Error getting wakelock state:', error);
    return false;
  }
});

ipcMain.handle('set-spellcheck', async (_event, enable: boolean) => {
  updateSettings((s) => {
    s.spellcheckEnabled = enable;
  });
  return true;
});

ipcMain.handle('get-spellcheck-state', () => {
  try {
    const settings = getSettings();
    return settings.spellcheckEnabled ?? true;
  } catch (error) {
    console.error('Error getting spellcheck state:', error);
    return true;
  }
});

ipcMain.handle('is-any-window-focused', () => {
  return BrowserWindow.getFocusedWindow() !== null;
});

// Add file/directory selection handler
ipcMain.handle('select-file-or-directory', async (_event, defaultPath?: string) => {
  const dialogOptions: OpenDialogOptions = {
    properties: process.platform === 'darwin' ? ['openFile', 'openDirectory'] : ['openFile'],
  };

  // Set default path if provided
  if (defaultPath) {
    // Expand tilde to home directory
    const expandedPath = expandTilde(defaultPath);

    // Check if the path exists
    try {
      const stats = await fs.stat(expandedPath);
      if (stats.isDirectory()) {
        dialogOptions.defaultPath = expandedPath;
      } else {
        dialogOptions.defaultPath = path.dirname(expandedPath);
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // If path doesn't exist, fall back to home directory and log error
      console.error(`Default path does not exist: ${expandedPath}, falling back to home directory`);
      dialogOptions.defaultPath = os.homedir();
    }
  }

  const result = (await dialog.showOpenDialog(dialogOptions)) as unknown as OpenDialogReturnValue;

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// ── Mesh-LLM lifecycle (see mesh.ts) ────────────────────────────────

ipcMain.handle('check-mesh', () => mesh.check());
ipcMain.handle('start-mesh', (_event, args: string[]) => mesh.start(args));
ipcMain.handle('stop-mesh', () => mesh.stop());

ipcMain.handle('check-ollama', async () => {
  try {
    return new Promise((resolve) => {
      // Run `ps` and filter for "ollama"
      const ps = spawn('ps', ['aux']);
      const grep = spawn('grep', ['-iw', '[o]llama']);

      let output = '';
      let errorOutput = '';

      // Pipe ps output to grep
      ps.stdout.pipe(grep.stdin);

      grep.stdout.on('data', (data) => {
        output += data.toString();
      });

      grep.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      grep.on('close', (code) => {
        if (code !== null && code !== 0 && code !== 1) {
          // grep returns 1 when no matches found
          console.error('Error executing grep command:', errorOutput);
          return resolve(false);
        }

        const trimmedOutput = output.trim();

        const isRunning = trimmedOutput.length > 0;
        resolve(isRunning);
      });

      ps.on('error', (error) => {
        console.error('Error executing ps command:', error);
        resolve(false);
      });

      grep.on('error', (error) => {
        console.error('Error executing grep command:', error);
        resolve(false);
      });

      // Close ps stdin when done
      ps.stdout.on('end', () => {
        grep.stdin.end();
      });
    });
  } catch (err) {
    console.error('Error checking for Ollama:', err);
    return false;
  }
});

ipcMain.handle('read-file', async (_event, filePath) => {
  try {
    const expandedPath = expandTilde(filePath);
    if (process.platform === 'win32') {
      const buffer = await fs.readFile(expandedPath);
      return { file: buffer.toString('utf8'), filePath: expandedPath, error: null, found: true };
    }
    // Non-Windows: keep previous behavior via cat for parity
    return await new Promise((resolve) => {
      const cat = spawn('cat', [expandedPath]);
      let output = '';
      let errorOutput = '';

      cat.stdout.on('data', (data) => {
        output += data.toString();
      });

      cat.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      cat.on('close', (code) => {
        if (code !== 0) {
          resolve({ file: '', filePath: expandedPath, error: errorOutput || null, found: false });
          return;
        }
        resolve({ file: output, filePath: expandedPath, error: null, found: true });
      });

      cat.on('error', (error) => {
        console.error('Error reading file:', error);
        resolve({ file: '', filePath: expandedPath, error, found: false });
      });
    });
  } catch (error) {
    console.error('Error reading file:', error);
    return { file: '', filePath: expandTilde(filePath), error, found: false };
  }
});

ipcMain.handle('write-file', async (_event, filePath, content) => {
  try {
    // Expand tilde to home directory
    const expandedPath = expandTilde(filePath);
    await fs.writeFile(expandedPath, content, { encoding: 'utf8' });
    return true;
  } catch (error) {
    console.error('Error writing to file:', error);
    return false;
  }
});

// Enhanced file operations
ipcMain.handle('ensure-directory', async (_event, dirPath) => {
  try {
    // Expand tilde to home directory
    const expandedPath = expandTilde(dirPath);

    await fs.mkdir(expandedPath, { recursive: true });
    return true;
  } catch (error) {
    console.error('Error creating directory:', error);
    return false;
  }
});

ipcMain.handle('list-files', async (_event, dirPath, extension) => {
  try {
    // Expand tilde to home directory
    const expandedPath = expandTilde(dirPath);

    const files = await fs.readdir(expandedPath);
    if (extension) {
      return files.filter((file) => file.endsWith(extension));
    }
    return files;
  } catch (error) {
    console.error('Error listing files:', error);
    return [];
  }
});

ipcMain.handle('show-message-box', async (_event, options) => {
  return dialog.showMessageBox(options);
});

ipcMain.handle('show-save-dialog', async (_event, options) => {
  return dialog.showSaveDialog(options);
});

ipcMain.handle('get-allowed-extensions', async () => {
  return await getAllowList();
});

const createNewWindow = async (app: App, dir?: string | null) => {
  const recentDirs = loadRecentDirs();
  const openDir = dir || (recentDirs.length > 0 ? recentDirs[0] : undefined);
  return await createChat(app, { dir: openDir });
};

const focusWindow = () => {
  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 0) {
    windows.forEach((win) => {
      win.show();
    });
    windows[windows.length - 1].webContents.send('focus-input');
  } else {
    createNewWindow(app);
  }
};

const registerGlobalShortcuts = () => {
  globalShortcut.unregisterAll();

  const settings = getSettings();
  const shortcuts = getKeyboardShortcuts(settings);

  if (shortcuts.focusWindow) {
    try {
      globalShortcut.register(shortcuts.focusWindow, () => {
        focusWindow();
      });
    } catch (e) {
      console.error('Error registering focus window hotkey:', e);
    }
  }

  if (shortcuts.quickLauncher) {
    try {
      globalShortcut.register(shortcuts.quickLauncher, () => {
        createLauncher();
      });
    } catch (e) {
      console.error('Error registering launcher hotkey:', e);
    }
  }
};

async function appMain() {
  await configureProxy();

  // Ensure Windows shims are available before any MCP processes are spawned
  await ensureWinShims();

  registerUpdateIpcHandlers();

  // Sprint 20-M7 (ADR-089): start the defence-in-depth validator for
  // profile.json writes. Watches the parent directory (so it survives the
  // pre-onboarding case where profile.json doesn't yet exist) and reverts
  // any write whose area_overrides shape fails the local Zod schema.
  startProfileWriteWatcher({
    profilePath: OSCAR_PROFILE_PATH,
    backupPath: OSCAR_PROFILE_BACKUP_PATH,
  });

  // Sprint 20-M8 (ADR-090): start the Forge Mode E marker-file watcher.
  // Forge writes ~/.config/oscar/_forge_request_delete_<areaId>.json; we
  // emit `oscar:forge:delete-prepare` to all windows so the renderer
  // modal can fire. The watcher is read-only — confirm/cancel IPC
  // handlers own marker deletion.
  startForgeDeleteWatcher({
    configDir: OSCAR_CONFIG_DIR,
    onMarker: (marker) => {
      void (async () => {
        const profile = await readProfileFile();
        const area = profile?.practice_areas?.find((a) => a.id === marker.areaId);
        const rawName = (area as unknown as { name?: unknown } | undefined)?.name;
        const areaName =
          typeof rawName === 'string' && rawName.length > 0
            ? rawName
            : displayAreaName(marker.areaId);
        const payload = {
          areaId: marker.areaId,
          areaName,
          timestamp: marker.timestamp,
          impact: marker.impact,
        };
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send('oscar:forge:delete-prepare', payload);
        }
      })();
    },
  });

  // Handle microphone permission requests
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    console.log('Permission requested:', permission);
    // Allow microphone and media access
    if (permission === 'media') {
      callback(true);
    } else {
      // Default behavior for other permissions
      callback(true);
    }
  });

  // Add CSP headers to all sessions — recomputed on every response so that
  // changes to externalGoosed settings take effect without restarting the app.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const currentSettings = getSettings();
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': buildCSP(currentSettings.externalGoosed),
      },
    });
  });

  // Sprint 12 (ADR-042): renderer egress lockdown. The renderer's
  // legitimate outbound is goosed (localhost). Block data-modifying methods
  // (POST/PUT/PATCH/DELETE) to non-localhost destinations — these are the
  // load-bearing data-egress vectors. Allow GET to externals so chat-content
  // images can still render (CSP gates origin set; webRequest gates verb).
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const dataMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
    if (!dataMethods.has(details.method)) {
      callback({ cancel: false });
      return;
    }
    try {
      const url = new URL(details.url);
      const host = url.hostname;
      const isLocal =
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '::1' ||
        host.endsWith('.localhost');
      const isSafeProtocol =
        url.protocol === 'file:' ||
        url.protocol === 'data:' ||
        url.protocol === 'blob:' ||
        url.protocol === 'devtools:' ||
        url.protocol === 'chrome-extension:';
      if (isLocal || isSafeProtocol) {
        callback({ cancel: false });
        return;
      }
    } catch {
      // Malformed URL → fall through and block.
    }
    log.warn('Renderer outbound blocked by ADR-042 egress filter', {
      url: details.url,
      method: details.method,
    });
    callback({ cancel: true });
  });

  // Migrate old settings format if needed (one-time migration)
  const settings = getSettings();
  if (!settings.keyboardShortcuts && settings.globalShortcut !== undefined) {
    updateSettings((s) => {
      s.keyboardShortcuts = getKeyboardShortcuts(s);
      delete s.globalShortcut;
    });
  }

  // Register global shortcuts based on settings
  registerGlobalShortcuts();

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['Origin'] = 'http://localhost:5173';
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  if (settings.showMenuBarIcon) {
    createTray();
  }

  if (process.platform === 'darwin' && !settings.showDockIcon && settings.showMenuBarIcon) {
    app.dock?.hide();
  }

  const { dirPath } = parseArgs();

  if (!openUrlHandledLaunch) {
    await createNewWindow(app, dirPath);
  } else {
    log.info('[Main] Skipping window creation in appMain - open-url already handled launch');
  }

  // Setup auto-updater AFTER window is created and displayed (with delay to avoid blocking)
  setTimeout(() => {
    if (shouldSetupUpdater()) {
      log.info('Setting up auto-updater after window creation...');
      try {
        setupAutoUpdater();
      } catch (error) {
        log.error('Error setting up auto-updater:', error);
      }
    }
  }, 2000);

  if (process.platform === 'darwin') {
    const dockMenu = Menu.buildFromTemplate([
      {
        label: menuT('New Window'),
        click: () => {
          createNewWindow(app);
        },
      },
    ]);
    app.dock?.setMenu(dockMenu);
  }

  const menu = Menu.getApplicationMenu();

  const shortcuts = getKeyboardShortcuts(settings);

  const appMenu = menu?.items.find((item) => item.label === 'Goose');
  if (appMenu?.submenu) {
    appMenu.submenu.insert(1, new MenuItem({ type: 'separator' }));
    if (shortcuts.settings) {
      appMenu.submenu.insert(
        1,
        new MenuItem({
          label: menuT('Settings'),
          accelerator: shortcuts.settings,
          click() {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) focusedWindow.webContents.send('set-view', 'settings');
          },
        })
      );
    }
    appMenu.submenu.insert(1, new MenuItem({ type: 'separator' }));
  }

  const editMenu = menu?.items.find((item) => item.label === 'Edit');
  if (editMenu?.submenu) {
    const selectAllIndex = editMenu.submenu.items.findIndex((item) => item.label === 'Select All');

    const findSubmenu = Menu.buildFromTemplate([
      {
        label: menuT('Find…'),
        accelerator: shortcuts.find || undefined,
        click() {
          const focusedWindow = BrowserWindow.getFocusedWindow();
          if (focusedWindow) focusedWindow.webContents.send('find-command');
        },
      },
      {
        label: menuT('Find Next'),
        accelerator: shortcuts.findNext || undefined,
        click() {
          const focusedWindow = BrowserWindow.getFocusedWindow();
          if (focusedWindow) focusedWindow.webContents.send('find-next');
        },
      },
      {
        label: menuT('Find Previous'),
        accelerator: shortcuts.findPrevious || undefined,
        click() {
          const focusedWindow = BrowserWindow.getFocusedWindow();
          if (focusedWindow) focusedWindow.webContents.send('find-previous');
        },
      },
      {
        label: menuT('Use Selection for Find'),
        accelerator: process.platform === 'darwin' ? 'Command+E' : undefined,
        click() {
          const focusedWindow = BrowserWindow.getFocusedWindow();
          if (focusedWindow) focusedWindow.webContents.send('use-selection-find');
        },
        visible: process.platform === 'darwin', // Only show on Mac
      },
    ]);

    editMenu.submenu.insert(
      selectAllIndex + 1,
      new MenuItem({
        label: menuT('Find'),
        submenu: findSubmenu,
      })
    );
  }

  const fileMenu = menu?.items.find((item) => item.label === 'File');

  if (fileMenu?.submenu) {
    // Use a counter to track the actual insertion index
    let menuIndex = 0;

    if (shortcuts.newChat) {
      fileMenu.submenu.insert(
        menuIndex++,
        new MenuItem({
          label: menuT('New Chat'),
          accelerator: shortcuts.newChat,
          click() {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) focusedWindow.webContents.send('new-chat');
          },
        })
      );
    }

    if (shortcuts.newChatWindow) {
      fileMenu.submenu.insert(
        menuIndex++,
        new MenuItem({
          label: menuT('New Chat Window'),
          accelerator: shortcuts.newChatWindow,
          click() {
            ipcMain.emit('create-chat-window');
          },
        })
      );
    }

    if (shortcuts.openDirectory) {
      fileMenu.submenu.insert(
        menuIndex++,
        new MenuItem({
          label: menuT('Open Directory...'),
          accelerator: shortcuts.openDirectory,
          click: () => openDirectoryDialog(),
        })
      );
    }

    const recentFilesSubmenu = buildRecentFilesMenu();
    if (recentFilesSubmenu.length > 0) {
      fileMenu.submenu.insert(
        menuIndex++,
        new MenuItem({
          label: menuT('Recent Directories'),
          submenu: recentFilesSubmenu,
        })
      );
    }

    fileMenu.submenu.insert(menuIndex++, new MenuItem({ type: 'separator' }));

    if (shortcuts.focusWindow) {
      fileMenu.submenu.append(
        new MenuItem({
          label: menuT('Focus Goose Window'),
          accelerator: shortcuts.focusWindow,
          click() {
            focusWindow();
          },
        })
      );
    }

    if (shortcuts.quickLauncher) {
      fileMenu.submenu.append(
        new MenuItem({
          label: menuT('Quick Launcher'),
          accelerator: shortcuts.quickLauncher,
          click() {
            createLauncher();
          },
        })
      );
    }
  }

  if (menu) {
    let windowMenu = menu.items.find((item) => item.label === 'Window');

    if (!windowMenu) {
      windowMenu = new MenuItem({
        label: menuT('Window'),
        submenu: Menu.buildFromTemplate([]),
      });

      const helpMenuIndex = menu.items.findIndex((item) => item.label === 'Help');
      if (helpMenuIndex >= 0) {
        menu.items.splice(helpMenuIndex, 0, windowMenu);
      } else {
        menu.items.push(windowMenu);
      }
    }

    if (windowMenu.submenu) {
      if (shortcuts.alwaysOnTop) {
        windowMenu.submenu.append(
          new MenuItem({
            label: menuT('Always on Top'),
            type: 'checkbox',
            accelerator: shortcuts.alwaysOnTop,
            click(menuItem) {
              const focusedWindow = BrowserWindow.getFocusedWindow();
              if (focusedWindow) {
                const isAlwaysOnTop = menuItem.checked;

                if (process.platform === 'darwin') {
                  focusedWindow.setAlwaysOnTop(isAlwaysOnTop, 'floating');
                } else {
                  focusedWindow.setAlwaysOnTop(isAlwaysOnTop);
                }

                console.log(
                  `[Main] Set always-on-top to ${isAlwaysOnTop} for window ${focusedWindow.id}`
                );
              }
            },
          })
        );
      }
    }

    const viewMenu = menu.items.find((item) => item.label === 'View');
    if (viewMenu?.submenu && shortcuts.toggleNavigation) {
      viewMenu.submenu.append(new MenuItem({ type: 'separator' }));
      viewMenu.submenu.append(
        new MenuItem({
          label: menuT('Toggle Navigation'),
          accelerator: shortcuts.toggleNavigation,
          click() {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send('toggle-navigation');
            }
          },
        })
      );
    }
  }

  // on macOS, the topbar is hidden
  if (menu && process.platform !== 'darwin') {
    let helpMenu = menu.items.find((item) => item.label === 'Help');

    // If Help menu doesn't exist, create it and add it to the menu
    if (!helpMenu) {
      helpMenu = new MenuItem({
        label: menuT('Help'),
        submenu: Menu.buildFromTemplate([]), // Start with an empty submenu
      });
      // Find a reasonable place to insert the Help menu, usually near the end
      const insertIndex = menu.items.length > 0 ? menu.items.length - 1 : 0;
      menu.items.splice(insertIndex, 0, helpMenu);
    }

    // Ensure the Help menu has a submenu before appending
    if (helpMenu.submenu) {
      // Add a separator before the About item if the submenu is not empty
      if (helpMenu.submenu.items.length > 0) {
        helpMenu.submenu.append(new MenuItem({ type: 'separator' }));
      }

      // Create the About Goose menu item with a submenu
      const aboutGooseMenuItem = new MenuItem({
        label: menuT('About Goose'),
        submenu: Menu.buildFromTemplate([]), // Start with an empty submenu for About
      });

      // Add the Version menu item (display only) to the About Goose submenu
      if (aboutGooseMenuItem.submenu) {
        aboutGooseMenuItem.submenu.append(
          new MenuItem({
            label: `Version ${version || app.getVersion()}`,
            enabled: false,
          })
        );
      }

      helpMenu.submenu.append(aboutGooseMenuItem);
    }
  }

  if (menu) {
    // Translate labels (including Electron's default top-level entries
    // File/Edit/View/Window/Help and submenu items populated by roles) before
    // installing the menu. Called last so the lookups above that match on the
    // English labels still succeed.
    translateMenuLabels(menu.items);
    Menu.setApplicationMenu(menu);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createNewWindow(app);
    }
  });

  ipcMain.on('create-chat-window', (event, options = {}) => {
    const { query, dir, resumeSessionId, viewType, recipeId } = options;

    let resolvedDir = dir;
    if (!resolvedDir?.trim()) {
      const recentDirs = loadRecentDirs();
      resolvedDir = recentDirs.length > 0 ? recentDirs[0] : undefined;
    }

    const isFromLauncher = query && !resumeSessionId && !viewType && !recipeId;

    if (isFromLauncher) {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      const launcherWindowId = senderWindow?.id;
      const allWindows = BrowserWindow.getAllWindows();

      const existingWindows = allWindows.filter(
        (win) => !win.isDestroyed() && win.id !== launcherWindowId
      );

      if (existingWindows.length > 0) {
        const targetWindow = existingWindows[0];
        targetWindow.show();
        targetWindow.focus();
        targetWindow.webContents.send('set-initial-message', query);
        return;
      }
    }

    createChat(app, {
      initialMessage: query,
      dir: resolvedDir,
      resumeSessionId,
      viewType,
      recipeId,
    });
  });

  ipcMain.on('close-window', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && !window.isDestroyed()) {
      window.close();
    }
  });

  ipcMain.on('notify', (event, data) => {
    try {
      // Validate notification data
      if (!data || typeof data !== 'object') {
        console.error('Invalid notification data');
        return;
      }

      // Validate title and body
      if (typeof data.title !== 'string' || typeof data.body !== 'string') {
        console.error('Invalid notification title or body');
        return;
      }

      // Limit the length of title and body
      const MAX_LENGTH = 1000;
      if (data.title.length > MAX_LENGTH || data.body.length > MAX_LENGTH) {
        console.error('Notification title or body too long');
        return;
      }

      // Remove any HTML tags for security
      const sanitizeText = (text: string) => text.replace(/<[^>]*>/g, '');

      const notification = new Notification({
        title: sanitizeText(data.title),
        body: sanitizeText(data.body),
      });

      // Add click handler to focus the window
      notification.on('click', () => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window) {
          if (window.isMinimized()) {
            window.restore();
          }
          window.show();
          window.focus();
        }
      });

      notification.show();
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  });

  ipcMain.on('logInfo', (_event, info) => {
    try {
      // Validate log info
      if (info === undefined || info === null) {
        console.error('Invalid log info: undefined or null');
        return;
      }

      // Convert to string if not already
      const logMessage = String(info);

      // Limit log message length
      const MAX_LENGTH = 10000; // 10KB limit
      if (logMessage.length > MAX_LENGTH) {
        console.error('Log message too long');
        return;
      }

      // Log the sanitized message
      log.info('from renderer:', logMessage);
    } catch (error) {
      console.error('Error logging info:', error);
    }
  });

  ipcMain.on('broadcast-theme-change', (event, themeData) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    const allWindows = BrowserWindow.getAllWindows();

    allWindows.forEach((window) => {
      if (window.id !== senderWindow?.id) {
        window.webContents.send('theme-changed', themeData);
      }
    });
  });

  ipcMain.on('reload-app', (event) => {
    // Get the window that sent the event
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      window.reload();
    }
  });

  // Handle metadata fetching from main process
  ipcMain.handle('fetch-metadata', async (_event, url) => {
    try {
      // Validate URL
      const parsedUrl = new URL(url);

      // Only allow http and https protocols for fetching web content
      if (!WEB_PROTOCOLS.includes(parsedUrl.protocol)) {
        throw new Error('Invalid URL protocol. Only HTTP and HTTPS are allowed.');
      }

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Goose/1.0)',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Set a reasonable size limit (e.g., 10MB)
      const MAX_SIZE = 10 * 1024 * 1024; // 10MB
      const contentLength = parseInt(response.headers.get('content-length') || '0');
      if (contentLength > MAX_SIZE) {
        throw new Error('Response too large');
      }

      const text = await response.text();
      if (text.length > MAX_SIZE) {
        throw new Error('Response too large');
      }

      return text;
    } catch (error) {
      console.error('Error fetching metadata:', error);
      throw error;
    }
  });

  ipcMain.on('open-in-chrome', (_event, url) => {
    try {
      // Validate URL
      const parsedUrl = new URL(url);

      // Only allow http and https protocols for browser URLs
      if (!WEB_PROTOCOLS.includes(parsedUrl.protocol)) {
        console.error('Invalid URL protocol. Only HTTP and HTTPS are allowed.');
        return;
      }

      // On macOS, use the 'open' command with Chrome
      if (process.platform === 'darwin') {
        spawn('open', ['-a', 'Google Chrome', url]);
      } else if (process.platform === 'win32') {
        // On Windows, start is built-in command of cmd.exe
        spawn('cmd.exe', ['/c', 'start', '', 'chrome', url]);
      } else {
        // On Linux, use xdg-open with chrome
        spawn('xdg-open', [url]);
      }
    } catch (error) {
      console.error('Error opening URL in browser:', error);
    }
  });

  // Handle app restart
  ipcMain.on('restart-app', () => {
    app.relaunch();
    app.exit(0);
  });

  // Handler for getting app version
  ipcMain.on('get-app-version', (event) => {
    event.returnValue = app.getVersion();
  });

  ipcMain.handle('open-directory-in-explorer', async (_event, path: string) => {
    try {
      return !!(await shell.openPath(path));
    } catch (error) {
      console.error('Error opening directory in explorer:', error);
      return false;
    }
  });

  ipcMain.handle('launch-app', async (event, gooseApp: GooseApp) => {
    try {
      const launchingWindow = BrowserWindow.fromWebContents(event.sender);
      if (!launchingWindow) {
        throw new Error('Could not find launching window');
      }

      const launchingWindowId = launchingWindow.id;
      const launchingClient = goosedClients.get(launchingWindowId);
      if (!launchingClient) {
        throw new Error('No client found for launching window');
      }

      const appWindow = new BrowserWindow({
        title: formatAppName(gooseApp.name),
        width: gooseApp.width ?? 800,
        height: gooseApp.height ?? 600,
        resizable: gooseApp.resizable ?? true,
        useContentSize: true,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: true,
          partition: 'persist:goose',
        },
      });

      goosedClients.set(appWindow.id, launchingClient);
      appWindows.set(gooseApp.name, appWindow);

      appWindow.on('close', () => {
        goosedClients.delete(appWindow.id);
        appWindows.delete(gooseApp.name);
      });

      const workingDir = app.getPath('home');
      const extensionName = gooseApp.mcpServers?.[0] ?? '';

      const url = getAppUrl();

      const searchParams = new URLSearchParams();
      searchParams.set('resourceUri', gooseApp.uri);
      searchParams.set('extensionName', extensionName);
      searchParams.set('appName', gooseApp.name);
      searchParams.set('workingDir', workingDir);

      url.hash = `/standalone-app?${searchParams.toString()}`;
      await appWindow.loadURL(formatUrl(url));
      appWindow.show();
    } catch (error) {
      console.error('Failed to launch app:', error);
      throw error;
    }
  });

  ipcMain.handle('refresh-app', async (_event, gooseApp: GooseApp) => {
    try {
      const appWindow = appWindows.get(gooseApp.name);
      if (!appWindow || appWindow.isDestroyed()) {
        console.log(`App window for '${gooseApp.name}' not found or destroyed, skipping refresh`);
        return;
      }

      // Bring to front first
      if (appWindow.isMinimized()) {
        appWindow.restore();
      }
      appWindow.show();
      appWindow.focus();

      // Then reload
      await appWindow.webContents.reload();
    } catch (error) {
      console.error('Failed to refresh app:', error);
      throw error;
    }
  });

  ipcMain.handle('close-app', async (_event, appName: string) => {
    try {
      const appWindow = appWindows.get(appName);
      if (!appWindow || appWindow.isDestroyed()) {
        console.log(`App window for '${appName}' not found or destroyed, skipping close`);
        return;
      }

      appWindow.close();
    } catch (error) {
      console.error('Failed to close app:', error);
      throw error;
    }
  });
}

app.whenReady().then(async () => {
  try {
    await appMain();
  } catch (error) {
    dialog.showErrorBox('Goose Error', `Failed to create main window: ${error}`);
    app.quit();
  }
});

async function getAllowList(): Promise<string[]> {
  if (!process.env.GOOSE_ALLOWLIST) {
    return [];
  }

  const response = await fetch(process.env.GOOSE_ALLOWLIST);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch allowed extensions: ${response.status} ${response.statusText}`
    );
  }

  // Parse the YAML content
  const yamlContent = await response.text();
  const parsedYaml = yaml.parse(yamlContent);

  // Extract the commands from the extensions array
  if (parsedYaml && parsedYaml.extensions && Array.isArray(parsedYaml.extensions)) {
    const commands = parsedYaml.extensions.map(
      (ext: { id: string; command: string }) => ext.command
    );
    console.log(`Fetched ${commands.length} allowed extension commands`);
    return commands;
  } else {
    console.error('Invalid YAML structure:', parsedYaml);
    return [];
  }
}

app.on('will-quit', async () => {
  // Stop the mesh child process if we spawned one.
  mesh.cleanup();

  for (const [windowId, blockerId] of windowPowerSaveBlockers.entries()) {
    try {
      powerSaveBlocker.stop(blockerId);
      console.log(
        `[Main] Stopped power save blocker ${blockerId} for window ${windowId} during app quit`
      );
    } catch (error) {
      console.error(
        `[Main] Failed to stop power save blocker ${blockerId} for window ${windowId}:`,
        error
      );
    }
  }
  windowPowerSaveBlockers.clear();

  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // Only quit if we're not on macOS or don't have a tray icon
  if (process.platform !== 'darwin' || !tray) {
    app.quit();
  }
});
