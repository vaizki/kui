/*
 * Copyright 2017 The Kubernetes Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import Client from './client'

/* type SubWindowPrefs = {
  cwd?: string
  env?: Record<any, any>
  fullscreen?: boolean
  viewName?: string
  title?: string
  initialTabTitle?: string
  quietExecCommand?: boolean
  partialExec?: string
  noEcho?: boolean
  theme?: string
} */

export async function preinit() {
  // ugh, on macos, dock- and finder-launched apps have a cwd of /
  if (process.cwd() === '/') {
    try {
      process.chdir((await import('../../util/home')).default('~'))
      process.env.PWD = process.cwd()
    } catch (err) {
      console.error(err)
    }
  }

  let prefs = {}
  if (process.env.___IBM_FSH_FUZZ) {
    // for testing, we sometimes want to monkey patch out certain features
    try {
      prefs = await (await import('../../core/fuzz-testing')).default(process.env.___IBM_FSH_FUZZ)
    } catch (err) {
      // debug('fuzz testing raw', process.env.___IBM_FSH_FUZZ)
      console.error('Error parsing fuzz testing prefs', err)
    }
    // debug('parsed fuzz testing config', prefs)
  }

  try {
    const { extractSearchKey } = await import('../util/search')

    const prefsEnc = extractSearchKey('subwindow')
    const subwindow = prefsEnc ? JSON.parse(prefsEnc) : undefined

    // so that electron's "second window" protocol can pass through
    // the environment variables from second+ windows
    if (subwindow && subwindow.env) {
      process.env = subwindow.env
    }

    if (subwindow && subwindow.fullscreen === true) {
      const titleOverride = typeof subwindow === 'string' ? subwindow : subwindow.title
      if (titleOverride && typeof titleOverride === 'string') {
        document.title = titleOverride
      }

      // set the current mode, if we have one, so that back
      // button can inform the user of what they're going back
      // to
      if (subwindow.viewName) {
        document.body.setAttribute('data-view-name', subwindow.viewName)
      }

      // body styling
      document.body.classList.add('subwindow')
      if (subwindow.theme) document.body.classList.add(`theme-${subwindow.theme}`)

      return subwindow
    }
  } catch (err) {
    // debug('no electron', err)
    // NOTE: so far, we only know that we aren't running in electron;
    // subsequently, we will decide whether we are headless or browser
    // in ../electron-events, which is called by boot on domReady
  }

  return prefs
}

/** invoke the Client to render its body */
export async function render(client: Client, root: Element) {
  const { extractSearchKey } = await import('../util/search')

  const prefsEnc = extractSearchKey('subwindow')
  const prefs = prefsEnc ? JSON.parse(prefsEnc) : undefined

  const argvEnc = extractSearchKey('executeThisArgvPlease')
  const argv = argvEnc ? JSON.parse(argvEnc) : undefined

  const maybeExecuteThis = argv && argv.length > 0 ? argv : undefined
  const fullShell = maybeExecuteThis && maybeExecuteThis.length === 1 && maybeExecuteThis[0] === 'shell'

  if (prefs && prefs.title) {
    document.title = prefs.title
  }

  client(
    root,
    !!prefs && prefs.fullscreen,
    !fullShell ? maybeExecuteThis : undefined,
    prefs ? prefs.initialTabTitle : undefined,
    prefs ? prefs.quietExecCommand : undefined,
    prefs ? prefs.title : undefined
  )
}
