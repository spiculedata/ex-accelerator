import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { spawn } from 'child_process';
import * as path from 'path';

// Track the Jupyter process
let jupyterProcess: any = null;

export const POST: RequestHandler = async () => {
  try {
    // If Jupyter is already running, return success
    if (jupyterProcess !== null) {
      return json({
        success: true,
        message: 'JupyterLab is already running',
        url: 'http://localhost:8888'
      });
    }

    // Get the project root directory
    const projectRoot = path.resolve(process.cwd());

    // Start JupyterLab using poetry
    jupyterProcess = spawn('poetry', [
      'run',
      'jupyter',
      'lab',
      '--port=8888',
      '--no-browser',
      '--allow-root'
    ], {
      cwd: projectRoot,
      detached: true,
      stdio: 'ignore'
    });

    // Unref the process so it doesn't block the parent
    jupyterProcess.unref();

    // Handle process errors
    jupyterProcess.on('error', (error: Error) => {
      console.error('Failed to start JupyterLab:', error);
      jupyterProcess = null;
    });

    jupyterProcess.on('exit', (code: number) => {
      console.log(`JupyterLab process exited with code ${code}`);
      jupyterProcess = null;
    });

    return json({
      success: true,
      message: 'JupyterLab starting...',
      url: 'http://localhost:8888'
    });

  } catch (error) {
    console.error('Error starting JupyterLab:', error);
    return json(
      {
        success: false,
        error: 'Failed to start JupyterLab',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
};
