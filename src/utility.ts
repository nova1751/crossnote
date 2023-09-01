import * as path from 'path';
import { JsonObject } from 'type-fest';
import * as vm from 'vm';
import * as vscode from 'vscode';
import * as YAML from 'yaml';
import { BlockInfo } from './lib/block-info';

/**
 * Do nothing and sleep for `ms` milliseconds
 * @param ms
 */
export function sleep(ms: number) {
  return new Promise<void>(resolve => {
    setTimeout(() => {
      return resolve();
    }, ms);
  });
}

export function parseYAML(yaml: string = ''): JsonObject {
  // YAML doesn't work well with front-matter
  /*
  try {
    return YAML.parse(yaml)
  } catch(error) {
    return {}
  }
  */
  if (yaml.startsWith('---')) {
    yaml = yaml
      .trim()
      .replace(/^---\r?\n/, '')
      .replace(/\r?\n---$/, '');
  }
  try {
    return YAML.parse(yaml);
  } catch (error) {
    return {};
  }
}

/**
 * NOTE: The __dirname is actually the ./out/(esm|cjs) directory
 * get the directory path of this extension.
 */
let extensionDirectoryPath_ = (() => {
  if (typeof __dirname !== 'undefined') {
    return path.resolve(__dirname, '../');
  } else {
    return '';
    /*
    // esm
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    return path.resolve(__dirname, '../../');
    */
  }
})();

export function setExtentensionDirectoryPath(path: string) {
  extensionDirectoryPath_ = path;
}

/**
 * Get the directory path of this npm package with the following directory structure:
 * - out
 * - dependencies
 * - styles
 * @returns
 */
export function getExtensionDirectoryPath() {
  return extensionDirectoryPath_;
}

let _externalAddFileProtocolFunction:
  | ((filePath: string, vscodePreviewPanel: vscode.WebviewPanel) => string)
  | null = null;

export function useExternalAddFileProtocolFunction(
  func: (filePath: string, vscodePreviewPanel: vscode.WebviewPanel) => string,
) {
  _externalAddFileProtocolFunction = func;
}

/**
 * Add file:/// to file path
 * If it's for VSCode preview, add vscode-resource:/// to file path
 * @param filePath
 */
export function addFileProtocol(
  filePath: string,
  vscodePreviewPanel?: vscode.WebviewPanel | null,
): string {
  if (_externalAddFileProtocolFunction && vscodePreviewPanel) {
    return _externalAddFileProtocolFunction(filePath, vscodePreviewPanel);
  } else {
    if (!filePath.startsWith('file://')) {
      filePath = 'file:///' + filePath;
    }
    filePath = filePath.replace(/^file:\/+/, 'file:///');
  }
  return filePath;
}

/**
 * Remove file:// from file path
 * @param filePath
 */
export function removeFileProtocol(filePath: string): string {
  // See https://regex101.com/r/YlpEur/8/
  // - "file://///a///b//c/d"                   ---> "a///b//c/d"
  // - "vscode-resource://///file///a///b//c/d" ---> "file///a///b//c/d"
  const regex = /^(?:(?:file|(vscode)-(?:webview-)?resource|vscode--resource):\/+)(.*)/m;

  return filePath.replace(regex, (m, isVSCode, rest) => {
    if (isVSCode) {
      // For vscode urls -> Remove host: `file///C:/a/b/c` -> `C:/a/b/c`
      rest = rest.replace(/^file\/+/, '');
    }

    if (process.platform !== 'win32' && !rest.startsWith('/')) {
      // On Linux platform, add a slash at the front
      return '/' + rest;
    } else {
      return rest;
    }
  });
}

export { uploadImage } from './tools/image-uploader.js';

/**
 * Allow unsafed `eval` function
 * Referred from:
 *     https://github.com/atom/loophole/blob/master/src/loophole.coffee
 * @param fn
 */
export function allowUnsafeEval(fn) {
  const previousEval = global.eval;
  try {
    global.eval = source => {
      vm.runInThisContext(source);
    };
    return fn();
  } finally {
    global.eval = previousEval;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function allowUnsafeEvalAync(fn: () => Promise<any>) {
  const previousEval = global.eval;
  try {
    global.eval = source => {
      vm.runInThisContext(source);
    };
    return await fn();
  } finally {
    global.eval = previousEval;
  }
}

export function allowUnsafeNewFunction(fn) {
  const previousFunction = global.Function;
  try {
    global.Function = Function as FunctionConstructor;
    return fn();
  } finally {
    global.Function = previousFunction;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function allowUnsafeNewFunctionAsync(fn: () => Promise<any>) {
  const previousFunction = global.Function;
  try {
    global.Function = Function as FunctionConstructor;
    return await fn();
  } finally {
    global.Function = previousFunction;
  }
}

export async function allowUnsafeEvalAndUnsafeNewFunctionAsync(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: () => Promise<any>,
) {
  const previousFunction = global.Function;
  const previousEval = global.eval;
  try {
    global.Function = Function as FunctionConstructor;
    global.eval = source => {
      vm.runInThisContext(source);
    };
    return await fn();
  } finally {
    global.eval = previousEval;
    global.Function = previousFunction;
  }
}

export const loadDependency = (dependencyPath: string) =>
  allowUnsafeEval(() =>
    allowUnsafeNewFunction(() =>
      require(path.resolve(
        getExtensionDirectoryPath(),
        'dependencies',
        dependencyPath,
      )),
    ),
  );

export const extractCommandFromBlockInfo = (info: BlockInfo) =>
  info.attributes['cmd'] === true ? info.language : info.attributes['cmd'];

export function Function(...args: string[]) {
  let body = '';
  const paramLists: string[] = [];
  if (args.length) {
    body = args[args.length - 1];
    for (let i = 0; i < args.length - 1; i++) {
      paramLists.push(args[i]);
    }
  }

  const params = [];
  for (let j = 0, len = paramLists.length; j < len; j++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let paramList: any = paramLists[j];
    if (typeof paramList === 'string') {
      paramList = paramList.split(/\s*,\s*/);
    }
    // eslint-disable-next-line prefer-spread
    params.push.apply(params, paramList);
  }

  return vm.runInThisContext(`
    (function(${params.join(', ')}) {
      ${body}
    })
  `);
}
Function.prototype = global.Function.prototype;
