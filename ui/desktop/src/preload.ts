import Electron, { contextBridge, ipcRenderer, webUtils } from 'electron';
import { Recipe } from './recipe';
import { GooseApp } from './api';
import type { Settings, SettingKey } from './utils/settings';
import { defaultSettings } from './utils/settings';
import type {
  MatterEntry,
  NewMatterInput,
} from './components/oscar/matters/types';

// Sprint 20-M3 (ADR-083): right-pane MatterFacts/ProgrammeFacts IPC payload.
// Returned by `window.electron.rightPane.readMatterFacts`. Field shape is
// stable; labels are resolved on the renderer side via matterLabels.
export interface MatterFactsPayload {
  name: string;
  subject: { type: string; label: string } | null;
  counterparty: { role: string; name: string } | null;
  kind: string | null;
  stakeholder: string | null;
  privileged: boolean;
  extras: Record<string, string>;
  key_facts_md: string;
  tom_md: string | null;
}

// Mapping from settings keys to their old localStorage keys for lazy migration
const localStorageKeyMap: Partial<Record<SettingKey, string>> = {
  theme: 'theme',
  useSystemTheme: 'use_system_theme',
  responseStyle: 'response_style',
  showPricing: 'show_pricing',
  sessionSharing: 'session_sharing_config',
  seenAnnouncementIds: 'seenAnnouncementIds',
};

// Parse localStorage value based on the setting key
function parseLocalStorageValue<K extends SettingKey>(
  key: K,
  rawValue: string
): Settings[K] | null {
  try {
    switch (key) {
      case 'theme':
        return (rawValue === 'dark' || rawValue === 'light' ? rawValue : null) as Settings[K];
      case 'useSystemTheme':
        return (rawValue === 'true') as unknown as Settings[K];
      case 'responseStyle':
        return rawValue as Settings[K];
      case 'showPricing':
        return (rawValue === 'true') as unknown as Settings[K];
      case 'sessionSharing':
        return JSON.parse(rawValue) as Settings[K];
      case 'seenAnnouncementIds':
        return JSON.parse(rawValue) as Settings[K];
      default:
        return null;
    }
  } catch {
    return null;
  }
}

interface NotificationData {
  title: string;
  body: string;
}

interface MessageBoxOptions {
  type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  buttons?: string[];
  defaultId?: number;
  title?: string;
  message: string;
  detail?: string;
}

interface MessageBoxResponse {
  response: number;
  checkboxChecked?: boolean;
}

interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  message?: string;
  nameFieldLabel?: string;
  showsTagField?: boolean;
}

interface SaveDialogResponse {
  canceled: boolean;
  filePath?: string;
}

interface FileResponse {
  file: string;
  filePath: string;
  error: string | null;
  found: boolean;
}

const config = JSON.parse(process.argv.find((arg) => arg.startsWith('{')) || '{}');

// Sprint 10 (ADR-024): the bundled-resources root is detected in the main
// process (preload runs sandboxed and can't import node:fs / node:path) and
// flows through here via the additionalArguments config JSON above.
const oscarResourcesRoot: string | null =
  (config.OSCAR_RESOURCES_ROOT as string | null | undefined) ?? null;

// Sprint 12 (ADR-039): HOME_DIR also flows from main for Forge's recipe
// builder (no node:os in renderer).
const oscarHomeDir: string | null =
  (config.HOME_DIR as string | null | undefined) ?? null;

interface UpdaterEvent {
  event: string;
  data?: unknown;
}

export interface CreateChatWindowOptions {
  query?: string;
  dir?: string;
  version?: string;
  resumeSessionId?: string;
  viewType?: string;
  recipeId?: string;
}

// Define the API types in a single place
type ElectronAPI = {
  platform: string;
  arch: string;
  reactReady: () => void;
  getConfig: () => Record<string, unknown>;
  hideWindow: () => void;
  directoryChooser: () => Promise<Electron.OpenDialogReturnValue>;
  createChatWindow: (options?: CreateChatWindowOptions) => void;
  logInfo: (txt: string) => void;
  showNotification: (data: NotificationData) => void;
  showMessageBox: (options: MessageBoxOptions) => Promise<MessageBoxResponse>;
  showSaveDialog: (options: SaveDialogOptions) => Promise<SaveDialogResponse>;
  openInChrome: (url: string) => void;
  fetchMetadata: (url: string) => Promise<string>;
  reloadApp: () => void;
  checkForOllama: () => Promise<boolean>;
  checkMesh: () => Promise<{
    running: boolean;
    installed: boolean;
    models: string[];
    token?: string;
    peerCount?: number;
    nodeStatus?: string;
    binaryPath?: string;
  }>;
  startMesh: (args: string[]) => Promise<{ started: boolean; error?: string; pid?: number }>;
  stopMesh: () => Promise<{ stopped: boolean }>;
  selectFileOrDirectory: (defaultPath?: string) => Promise<string | null>;
  getBinaryPath: (binaryName: string) => Promise<string>;
  readFile: (directory: string) => Promise<FileResponse>;
  writeFile: (directory: string, content: string) => Promise<boolean>;
  ensureDirectory: (dirPath: string) => Promise<boolean>;
  listFiles: (dirPath: string, extension?: string) => Promise<string[]>;
  getAllowedExtensions: () => Promise<string[]>;
  getPathForFile: (file: File) => string;
  setMenuBarIcon: (show: boolean) => Promise<boolean>;
  getMenuBarIconState: () => Promise<boolean>;
  setDockIcon: (show: boolean) => Promise<boolean>;
  getDockIconState: () => Promise<boolean>;
  getSetting: <K extends SettingKey>(key: K) => Promise<Settings[K]>;
  setSetting: <K extends SettingKey>(key: K, value: Settings[K]) => Promise<void>;
  getSecretKey: () => Promise<string>;
  getGoosedHostPort: () => Promise<string | null>;
  setWakelock: (enable: boolean) => Promise<boolean>;
  getWakelockState: () => Promise<boolean>;
  setSpellcheck: (enable: boolean) => Promise<boolean>;
  getSpellcheckState: () => Promise<boolean>;
  openNotificationsSettings: () => Promise<boolean>;
  isAnyWindowFocused: () => Promise<boolean>;
  onMouseBackButtonClicked: (callback: () => void) => void;
  offMouseBackButtonClicked: (callback: () => void) => void;
  on: (
    channel: string,
    callback: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void
  ) => void;
  off: (
    channel: string,
    callback: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void
  ) => void;
  emit: (channel: string, ...args: unknown[]) => void;
  broadcastThemeChange: (themeData: {
    mode: string;
    useSystemTheme: boolean;
    theme: string;
    tokensUpdated?: boolean;
  }) => void;
  openExternal: (url: string) => Promise<void>;
  // Update-related functions
  getVersion: () => string;
  checkForUpdates: () => Promise<{ updateInfo: unknown; error: string | null }>;
  downloadUpdate: () => Promise<{ success: boolean; error: string | null }>;
  installUpdate: () => void;
  restartApp: () => void;
  onUpdaterEvent: (callback: (event: UpdaterEvent) => void) => void;
  getUpdateState: () => Promise<{ updateAvailable: boolean; latestVersion?: string } | null>;
  isUsingGitHubFallback: () => Promise<boolean>;
  // Recipe warning functions
  closeWindow: () => void;
  hasAcceptedRecipeBefore: (recipe: Recipe) => Promise<boolean>;
  recordRecipeHash: (recipe: Recipe) => Promise<boolean>;
  openDirectoryInExplorer: (directoryPath: string) => Promise<boolean>;
  launchApp: (app: GooseApp) => Promise<void>;
  refreshApp: (app: GooseApp) => Promise<void>;
  closeApp: (appName: string) => Promise<void>;
  addRecentDir: (dir: string) => Promise<boolean>;
  listRecentDirs: () => Promise<string[]>;
  listGitWorktreeDirs: (dir: string) => Promise<string[]>;
  // Oscar user profile (Sprint 6, ADR-011): reads ~/.config/oscar/profile.json,
  // returns the parsed object or null if absent.
  readOscarProfile: () => Promise<unknown | null>;
  // Oscar bundled-resources root (Sprint 10, ADR-024): absolute path to the
  // packaged resources dir when the app is installed (e.g. /opt/oscar-gc/resources),
  // null when running in dev. Recipe factories use this to resolve adeu/node/MCP paths.
  oscarResourcesRoot: string | null;
  // Sprint 12 (ADR-039): user home dir for Forge's oscar-fs allowed-directories.
  oscarHomeDir: string | null;
  // Oscar Matters (Sprint 12 ADRs 036/038/043/044, Sprint 14 ADR-047).
  // Registry-driven scoped containers per practice area; Zod-validated at
  // the IPC boundary in main.ts. Types imported from the matters module so
  // renderer code doesn't re-shadow them.
  matters: {
    list: (areaId: string) => Promise<MatterEntry[]>;
    get: (
      areaId: string,
      slug: string,
    ) => Promise<{ entry: MatterEntry; matter_md: string | null } | null>;
    create: (areaId: string, input: NewMatterInput) => Promise<MatterEntry>;
    bindSession: (areaId: string, slug: string, sessionId: string) => Promise<{ ok: boolean }>;
    archive: (areaId: string, slug: string) => Promise<{ ok: boolean }>;
    setActive: (
      areaId: string,
      slug: string,
    ) => Promise<{ ok: boolean; state_folder?: string; working_dir?: string }>;
    detachActive: () => Promise<{ ok: boolean }>;
    lookupSession: (sessionId: string) => Promise<{
      area_id: string;
      area_name: string;
      slug: string;
      name: string;
    } | null>;
  };
  // Sprint 17 (ADR-059, ADR-061): Integrations registry + per-area state.
  // listAvailable reads vendor .mcp.json files from skills/in-house-legal/;
  // list returns installed entries for one area; install appends an entry
  // (idempotent on duplicate id).
  integrations: {
    listAvailable: () => Promise<
      Array<{
        id: string;
        plugin_slug: string;
        type: string;
        url?: string;
        title: string;
        description: string;
      }>
    >;
    list: (
      areaId: string,
    ) => Promise<
      Array<{ id: string; added_at: string; trust_acknowledged: boolean }>
    >;
    install: (
      areaId: string,
      entryId: string,
      trustAcknowledged: boolean,
    ) => Promise<{ ok: boolean; already_installed?: boolean }>;
  };
  // Sprint 19 (ADR-066 D1): unscoped quick-chat working_dir. ensure-dir is
  // idempotent (mkdir recursive); get-dir is a pure getter for partitioning
  // the sidebar's Quick-chats vs matter-bound session groups.
  quickChats: {
    ensureDir: () => Promise<{ ok: boolean; path: string }>;
    getDir: () => Promise<string>;
  };
  // Sprint 20-M3 (ADR-083): right-pane section readers. Polled by section
  // components every 2 s; reads the same matter.md + Top of Mind file the
  // agent reads — no shadow store.
  rightPane: {
    readMatterFacts: (
      areaId: string,
      slug: string,
    ) => Promise<MatterFactsPayload | null>;
  };
  // Sprint 20-M4 (ADR-084, ADR-085): playbook subsystem. List/upload/toggle/
  // delete drive the PlaybooksSection; renderBlock is the recipe-builder's
  // Layer 1 injection helper (returns the `## Playbooks in scope` markdown
  // block or null when no always-on entries resolve to readable files).
  playbooks: {
    list: (areaId: string) => Promise<PlaybookEntry[]>;
    upload: (
      areaId: string,
      scope: 'global' | 'area',
      filename: string,
      bytes: Uint8Array,
    ) => Promise<UploadResult>;
    toggleAlwaysOn: (
      areaId: string,
      relPath: string,
      next: boolean,
    ) => Promise<ToggleAlwaysOnResult>;
    delete: (
      areaId: string,
      relPath: string,
    ) => Promise<{ ok: true } | { ok: false; code: string; message: string }>;
    renderBlock: (
      relPaths: readonly string[],
      charCap: number,
    ) => Promise<string | null>;
  };
  // Sprint 20-M5 (ADR-086): skills visibility + per-area scoping. List /
  // setMode / toggleSlug drive SkillsSection (right pane); renderBlock is
  // the recipe-builder's prompt-enumeration helper (returns the `## Skills
  // available in this area` block or null when no slugs resolve).
  skills: {
    list: (areaId: string) => Promise<SkillsListResult>;
    setMode: (
      areaId: string,
      mode: SkillMode,
    ) => Promise<
      | { ok: true; mode: SkillMode }
      | { ok: false; code: string; message: string }
    >;
    toggleSlug: (
      areaId: string,
      slug: string,
      included: boolean,
    ) => Promise<
      | { ok: true; slugs: string[] }
      | { ok: false; code: string; message: string }
    >;
    delete: (
      areaId: string,
      slug: string,
    ) => Promise<{ ok: true } | { ok: false; code: string; message: string }>;
    renderBlock: (areaId: string) => Promise<string | null>;
    // Sprint 20-M6 (ADR-087): stage a lawyer-uploaded SKILL.md into
    // ~/.agents/skills/<slug>/SKILL.md. Drop affordance in SkillsSection
    // deep-links Forge to #/forge?reviewSkill=<absPath> on success.
    stageForReview: (
      slug: string,
      content: string,
    ) => Promise<StageForReviewResult>;
  };
  // Sprint 20-M8 (ADR-090): Forge Mode E destructive-op renderer-confirm
  // bridges. Forge writes a marker file; the watcher in main.ts emits
  // `oscar:forge:delete-prepare` via `window.electron.on`; the modal
  // calls one of these on user click.
  forge: {
    confirmDeleteArea: (
      areaId: string,
      timestamp: string,
    ) => Promise<
      | { ok: true; archivedTo: string }
      | { ok: false; reason: string }
    >;
    cancelDeleteArea: (
      areaId: string,
    ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  };
};

export interface ForgeDeletePreparePayload {
  areaId: string;
  areaName: string;
  timestamp: string;
  impact: {
    matterCount: number;
    integrationCount: number;
    overrideKeys: string[];
  };
}

export interface PlaybookEntry {
  relPath: string;
  filename: string;
  scope: 'global' | 'area';
  sizeBytes: number;
  mtimeMs: number;
  alwaysOn: boolean;
}

export type UploadResult =
  | { ok: true; relPath: string }
  | { ok: false; code: string; message: string };

export type ToggleAlwaysOnResult =
  | { ok: true; alwaysOn: boolean; budgetCap: number }
  | { ok: false; code: string; message: string; extractedLength?: number; cap?: number };

export type SkillMode = 'all' | 'allow' | 'deny';

export interface SkillEntry {
  slug: string;
  name: string;
  description: string;
  source: 'bundled' | 'user';
  bundled: boolean;
  enabled: boolean;
}

export interface SkillsListResult {
  mode: SkillMode;
  skills: SkillEntry[];
}

// Sprint 20-M6 (ADR-087): result shape for window.electron.skills.stageForReview.
export type StageForReviewErrorCode =
  | 'EBADSLUG'
  | 'EBUNDLED_COLLISION'
  | 'EBADFRONTMATTER'
  | 'EEXIST'
  | 'EIO';

export type StageForReviewResult =
  | { ok: true; absPath: string }
  | { ok: false; code: StageForReviewErrorCode; message: string };

type AppConfigAPI = {
  get: (key: string) => unknown;
  getAll: () => Record<string, unknown>;
};

const electronAPI: ElectronAPI = {
  platform: process.platform,
  arch: process.arch,
  reactReady: () => ipcRenderer.send('react-ready'),
  getConfig: () => {
    if (!config || Object.keys(config).length === 0) {
      console.warn(
        'No config provided by main process. This may indicate an initialization issue.'
      );
    }
    return config;
  },
  hideWindow: () => ipcRenderer.send('hide-window'),
  directoryChooser: () => ipcRenderer.invoke('directory-chooser'),
  createChatWindow: (options?: CreateChatWindowOptions) =>
    ipcRenderer.send('create-chat-window', options || {}),
  logInfo: (txt: string) => ipcRenderer.send('logInfo', txt),
  showNotification: (data: NotificationData) => ipcRenderer.send('notify', data),
  showMessageBox: (options: MessageBoxOptions) => ipcRenderer.invoke('show-message-box', options),
  showSaveDialog: (options: SaveDialogOptions) => ipcRenderer.invoke('show-save-dialog', options),
  openInChrome: (url: string) => ipcRenderer.send('open-in-chrome', url),
  fetchMetadata: (url: string) => ipcRenderer.invoke('fetch-metadata', url),
  reloadApp: () => ipcRenderer.send('reload-app'),
  checkForOllama: () => ipcRenderer.invoke('check-ollama'),
  checkMesh: () => ipcRenderer.invoke('check-mesh'),
  startMesh: (args: string[]) => ipcRenderer.invoke('start-mesh', args),
  stopMesh: () => ipcRenderer.invoke('stop-mesh'),

  selectFileOrDirectory: (defaultPath?: string) =>
    ipcRenderer.invoke('select-file-or-directory', defaultPath),
  getBinaryPath: (binaryName: string) => ipcRenderer.invoke('get-binary-path', binaryName),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('write-file', filePath, content),
  ensureDirectory: (dirPath: string) => ipcRenderer.invoke('ensure-directory', dirPath),
  listFiles: (dirPath: string, extension?: string) =>
    ipcRenderer.invoke('list-files', dirPath, extension),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  getAllowedExtensions: () => ipcRenderer.invoke('get-allowed-extensions'),
  setMenuBarIcon: (show: boolean) => ipcRenderer.invoke('set-menu-bar-icon', show),
  getMenuBarIconState: () => ipcRenderer.invoke('get-menu-bar-icon-state'),
  setDockIcon: (show: boolean) => ipcRenderer.invoke('set-dock-icon', show),
  getDockIconState: () => ipcRenderer.invoke('get-dock-icon-state'),
  getSetting: async <K extends SettingKey>(key: K): Promise<Settings[K]> => {
    try {
      // Check for localStorage value first (lazy migration)
      const localStorageKey = localStorageKeyMap[key];
      if (localStorageKey) {
        const rawValue = localStorage.getItem(localStorageKey);
        if (rawValue !== null) {
          const parsed = parseLocalStorageValue(key, rawValue);
          if (parsed !== null) {
            return parsed;
          }
        }
      }
      return await ipcRenderer.invoke('get-setting', key);
    } catch (error) {
      console.error(`Failed to get setting '${key}', using default`, error);
      return defaultSettings[key];
    }
  },
  setSetting: async <K extends SettingKey>(key: K, value: Settings[K]): Promise<void> => {
    // Clear any localStorage version when writing
    const localStorageKey = localStorageKeyMap[key];
    if (localStorageKey) {
      localStorage.removeItem(localStorageKey);
    }
    return ipcRenderer.invoke('set-setting', key, value);
  },
  getSecretKey: () => ipcRenderer.invoke('get-secret-key'),
  getGoosedHostPort: () => ipcRenderer.invoke('get-goosed-host-port'),
  setWakelock: (enable: boolean) => ipcRenderer.invoke('set-wakelock', enable),
  getWakelockState: () => ipcRenderer.invoke('get-wakelock-state'),
  setSpellcheck: (enable: boolean) => ipcRenderer.invoke('set-spellcheck', enable),
  getSpellcheckState: () => ipcRenderer.invoke('get-spellcheck-state'),
  openNotificationsSettings: () => ipcRenderer.invoke('open-notifications-settings'),
  isAnyWindowFocused: () => ipcRenderer.invoke('is-any-window-focused'),
  onMouseBackButtonClicked: (callback: () => void) => {
    // Wrapper that ignores the event parameter.
    const wrappedCallback = (_event: Electron.IpcRendererEvent) => callback();
    ipcRenderer.on('mouse-back-button-clicked', wrappedCallback);
    return wrappedCallback;
  },
  offMouseBackButtonClicked: (callback: () => void) => {
    ipcRenderer.removeListener('mouse-back-button-clicked', callback);
  },
  on: (
    channel: string,
    callback: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void
  ) => {
    ipcRenderer.on(channel, callback);
  },
  off: (
    channel: string,
    callback: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void
  ) => {
    ipcRenderer.off(channel, callback);
  },
  emit: (channel: string, ...args: unknown[]) => {
    ipcRenderer.emit(channel, ...args);
  },
  broadcastThemeChange: (themeData: {
    mode: string;
    useSystemTheme: boolean;
    theme: string;
    tokensUpdated?: boolean;
  }) => {
    ipcRenderer.send('broadcast-theme-change', themeData);
  },
  openExternal: (url: string): Promise<void> => {
    return ipcRenderer.invoke('open-external', url);
  },
  getVersion: (): string => {
    return config.GOOSE_VERSION || ipcRenderer.sendSync('get-app-version') || '';
  },
  checkForUpdates: (): Promise<{ updateInfo: unknown; error: string | null }> => {
    return ipcRenderer.invoke('check-for-updates');
  },
  downloadUpdate: (): Promise<{ success: boolean; error: string | null }> => {
    return ipcRenderer.invoke('download-update');
  },
  installUpdate: (): void => {
    ipcRenderer.invoke('install-update');
  },
  restartApp: (): void => {
    ipcRenderer.send('restart-app');
  },
  onUpdaterEvent: (callback: (event: UpdaterEvent) => void): void => {
    ipcRenderer.on('updater-event', (_event, data) => callback(data));
  },
  getUpdateState: (): Promise<{ updateAvailable: boolean; latestVersion?: string } | null> => {
    return ipcRenderer.invoke('get-update-state');
  },
  isUsingGitHubFallback: (): Promise<boolean> => {
    return ipcRenderer.invoke('is-using-github-fallback');
  },
  closeWindow: () => ipcRenderer.send('close-window'),
  // Sprint 10 (ADR-029): bypass the trust-a-recipe dialog for recipes
  // bundled in the binary at packaging time (titles starting with "Oscar GC").
  // Bundled artefacts are trusted by definition — they shipped in the release
  // the user installed. The dialog gates user-installed-from-untrusted-source
  // recipes, which Oscar GC won't have until the community-skills tier opens
  // (Sprint 15+).
  hasAcceptedRecipeBefore: (recipe: Recipe) => {
    if (recipe?.title?.startsWith('Oscar GC')) {
      return Promise.resolve(true);
    }
    return ipcRenderer.invoke('has-accepted-recipe-before', recipe);
  },
  recordRecipeHash: (recipe: Recipe) => {
    if (recipe?.title?.startsWith('Oscar GC')) {
      return Promise.resolve(true);
    }
    return ipcRenderer.invoke('record-recipe-hash', recipe);
  },
  openDirectoryInExplorer: (directoryPath: string) =>
    ipcRenderer.invoke('open-directory-in-explorer', directoryPath),
  launchApp: (app: GooseApp) => ipcRenderer.invoke('launch-app', app),
  refreshApp: (app: GooseApp) => ipcRenderer.invoke('refresh-app', app),
  closeApp: (appName: string) => ipcRenderer.invoke('close-app', appName),
  addRecentDir: (dir: string) => ipcRenderer.invoke('add-recent-dir', dir),
  listRecentDirs: () => ipcRenderer.invoke('list-recent-dirs'),
  listGitWorktreeDirs: (dir: string) => ipcRenderer.invoke('list-git-worktree-dirs', dir),
  readOscarProfile: () => ipcRenderer.invoke('oscar:read-profile'),
  oscarResourcesRoot,
  oscarHomeDir,
  matters: {
    list: (areaId: string) => ipcRenderer.invoke('oscar:matters:list', areaId),
    get: (areaId: string, slug: string) =>
      ipcRenderer.invoke('oscar:matters:get', areaId, slug),
    create: (areaId: string, input: unknown) =>
      ipcRenderer.invoke('oscar:matters:create', areaId, input),
    bindSession: (areaId: string, slug: string, sessionId: string) =>
      ipcRenderer.invoke('oscar:matters:bind-session', areaId, slug, sessionId),
    archive: (areaId: string, slug: string) =>
      ipcRenderer.invoke('oscar:matters:archive', areaId, slug),
    setActive: (areaId: string, slug: string) =>
      ipcRenderer.invoke('oscar:matters:set-active', areaId, slug),
    detachActive: () => ipcRenderer.invoke('oscar:matters:detach-active'),
    lookupSession: (sessionId: string) =>
      ipcRenderer.invoke('oscar:matters:lookup-session', sessionId),
  },
  integrations: {
    listAvailable: () => ipcRenderer.invoke('oscar:integrations:list-available'),
    list: (areaId: string) => ipcRenderer.invoke('oscar:integrations:list', areaId),
    install: (areaId: string, entryId: string, trustAcknowledged: boolean) =>
      ipcRenderer.invoke(
        'oscar:integrations:install',
        areaId,
        entryId,
        trustAcknowledged,
      ),
  },
  quickChats: {
    ensureDir: () => ipcRenderer.invoke('oscar:quick-chats:ensure-dir'),
    getDir: () => ipcRenderer.invoke('oscar:quick-chats:get-dir'),
  },
  rightPane: {
    readMatterFacts: (areaId: string, slug: string) =>
      ipcRenderer.invoke('oscar:right-pane:read-matter-facts', areaId, slug),
  },
  playbooks: {
    list: (areaId: string) => ipcRenderer.invoke('oscar:playbooks:list', areaId),
    upload: (areaId: string, scope: 'global' | 'area', filename: string, bytes: Uint8Array) =>
      ipcRenderer.invoke('oscar:playbooks:upload', areaId, scope, filename, bytes),
    toggleAlwaysOn: (areaId: string, relPath: string, next: boolean) =>
      ipcRenderer.invoke('oscar:playbooks:toggle-always-on', areaId, relPath, next),
    delete: (areaId: string, relPath: string) =>
      ipcRenderer.invoke('oscar:playbooks:delete', areaId, relPath),
    renderBlock: (relPaths: readonly string[], charCap: number) =>
      ipcRenderer.invoke('oscar:playbooks:render-block', relPaths, charCap),
  },
  skills: {
    list: (areaId: string) => ipcRenderer.invoke('oscar:skills:list', areaId),
    setMode: (areaId: string, mode: SkillMode) =>
      ipcRenderer.invoke('oscar:skills:set-mode', areaId, mode),
    toggleSlug: (areaId: string, slug: string, included: boolean) =>
      ipcRenderer.invoke('oscar:skills:toggle-slug', areaId, slug, included),
    delete: (areaId: string, slug: string) =>
      ipcRenderer.invoke('oscar:skills:delete', areaId, slug),
    renderBlock: (areaId: string) =>
      ipcRenderer.invoke('oscar:skills:render-block', areaId),
    stageForReview: (slug: string, content: string) =>
      ipcRenderer.invoke('oscar:skills:stage-for-review', slug, content),
  },
  forge: {
    confirmDeleteArea: (areaId: string, timestamp: string) =>
      ipcRenderer.invoke('oscar:forge:confirm-delete-area', areaId, timestamp),
    cancelDeleteArea: (areaId: string) =>
      ipcRenderer.invoke('oscar:forge:cancel-delete-area', areaId),
  },
};

const appConfigAPI: AppConfigAPI = {
  get: (key: string) => config[key],
  getAll: () => config,
};

// Expose the APIs
contextBridge.exposeInMainWorld('electron', electronAPI);
contextBridge.exposeInMainWorld('appConfig', appConfigAPI);

// Type declaration for TypeScript
declare global {
  interface Window {
    electron: ElectronAPI;
    appConfig: AppConfigAPI;
  }
}
