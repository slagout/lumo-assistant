import * as vscode from 'vscode';

const SESSION_ID_KEY = 'lumo.session-id';

/**
 * LumoSecretVault wraps VS Code's SecretStorage API so the Proton
 * Session-Id cookie is never written to settings.json in plaintext.
 *
 * VS Code stores SecretStorage values in the OS key-chain:
 *   - Windows : Credential Manager (DPAPI-encrypted)
 *   - macOS   : Keychain
 *   - Linux   : libsecret / kwallet
 *
 * Usage:
 *   const vault = new LumoSecretVault(context.secrets);
 *   await vault.storeSessionId('your-session-id');
 *   const id = await vault.getSessionId();
 */
export class LumoSecretVault {
    constructor(private readonly secrets: vscode.SecretStorage) {}

    /** Store (or replace) the Session-Id in encrypted OS key-chain storage. */
    async storeSessionId(sessionId: string): Promise<void> {
        await this.secrets.store(SESSION_ID_KEY, sessionId.trim());
    }

    /** Retrieve the Session-Id, or undefined if not yet stored. */
    async getSessionId(): Promise<string | undefined> {
        return this.secrets.get(SESSION_ID_KEY);
    }

    /** Permanently remove the Session-Id from the vault. */
    async deleteSessionId(): Promise<void> {
        await this.secrets.delete(SESSION_ID_KEY);
    }

    /**
     * One-time migration: if a plaintext Session-Id exists in settings.json
     * it is moved to SecretStorage and erased from both global and workspace
     * settings.  Returns true when a value was migrated.
     */
    async migrateFromSettings(): Promise<boolean> {
        const config = vscode.workspace.getConfiguration('lumo');
        const plaintext = (config.get<string>('sessionId') ?? '').trim();
        if (!plaintext) return false;

        await this.storeSessionId(plaintext);

        // Erase from global and workspace settings so it leaves settings.json
        try { await config.update('sessionId', undefined, vscode.ConfigurationTarget.Global); } catch { /* ignore */ }
        try { await config.update('sessionId', undefined, vscode.ConfigurationTarget.Workspace); } catch { /* ignore */ }

        return true;
    }
}
