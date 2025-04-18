import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

// Escape command-line arguments to prevent injection
function escapeArg(arg: string): string {
  if (process.platform === 'win32') {
    // For Windows
    return `"${arg.replace(/"/g, '\\"')}"`;
  }
  // For UNIX-like systems
  return `'${arg.replace(/'/g, "\\'")}'`;
}

class Vault {
  private pythonPath: string;
  private vaultScriptPath: string;
  private callerName: string;

  constructor() {
    // Path to your Python script
    this.pythonPath = process.env.PYTHON_PATH || 'python';
    this.vaultScriptPath = path.join(process.cwd(), 'src/core/vault.py');
    this.callerName = 'api_server';
    
    // Check if vault.py exists
    if (!fs.existsSync(this.vaultScriptPath)) {
      console.error(`Vault script not found at ${this.vaultScriptPath}`);
    }
  }

  private async executeCommand(args: string[]): Promise<string> {
    const command = `${this.pythonPath} ${this.vaultScriptPath} ${args.join(' ')}`;
    
    try {
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr) {
        console.error('Vault stderr:', stderr);
      }
      
      return stdout.trim();
    } catch (error) {
      console.error('Vault execution error:', error);
      throw new Error(`Vault operation failed: ${(error as Error).message}`);
    }
  }

  async setUserKey(userId: string, keyName: string, keyValue: string): Promise<boolean> {
    try {
      const args = [
        `--action set-user`,
        `--user-id ${escapeArg(userId)}`,
        `--key ${escapeArg(keyName)}`,
        `--value ${escapeArg(keyValue)}`,
        `--caller ${escapeArg(this.callerName)}`
      ];

      const result = await this.executeCommand(args);
      return result === 'success';
    } catch (error) {
      console.error('Vault setUserKey error:', error);
      throw new Error(`Failed to set key: ${keyName}`);
    }
  }

  async getUserKey(userId: string, keyName: string): Promise<string> {
    try {
      const args = [
        `--action get-user`,
        `--user-id ${escapeArg(userId)}`,
        `--key ${escapeArg(keyName)}`,
        `--caller ${escapeArg(this.callerName)}`
      ];

      return await this.executeCommand(args);
    } catch (error) {
      console.error('Vault getUserKey error:', error);
      throw new Error(`Failed to get key: ${keyName}`);
    }
  }

  async deleteUserKey(userId: string, keyName: string): Promise<boolean> {
    try {
      const args = [
        `--action delete-user`,
        `--user-id ${escapeArg(userId)}`,
        `--key ${escapeArg(keyName)}`,
        `--caller ${escapeArg(this.callerName)}`
      ];

      const result = await this.executeCommand(args);
      return result === 'success';
    } catch (error) {
      console.error('Vault deleteUserKey error:', error);
      throw new Error(`Failed to delete key: ${keyName}`);
    }
  }

  // Base methods
  async setKey(keyName: string, keyValue: string): Promise<boolean> {
    try {
      const args = [
        `--action set`,
        `--key ${escapeArg(keyName)}`,
        `--value ${escapeArg(keyValue)}`,
        `--caller ${escapeArg(this.callerName)}`
      ];

      const result = await this.executeCommand(args);
      return result === 'success';
    } catch (error) {
      console.error('Vault setKey error:', error);
      throw new Error(`Failed to set key: ${keyName}`);
    }
  }

  async getKey(keyName: string): Promise<string> {
    try {
      const args = [
        `--action get`,
        `--key ${escapeArg(keyName)}`,
        `--caller ${escapeArg(this.callerName)}`
      ];

      return await this.executeCommand(args);
    } catch (error) {
      console.error('Vault getKey error:', error);
      throw new Error(`Failed to get key: ${keyName}`);
    }
  }

  async deleteKey(keyName: string): Promise<boolean> {
    try {
      const args = [
        `--action delete`,
        `--key ${escapeArg(keyName)}`,
        `--caller ${escapeArg(this.callerName)}`
      ];

      const result = await this.executeCommand(args);
      return result === 'success';
    } catch (error) {
      console.error('Vault deleteKey error:', error);
      throw new Error(`Failed to delete key: ${keyName}`);
    }
  }
}

// Export a singleton instance
const vault = new Vault();
export default vault;