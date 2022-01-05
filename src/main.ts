import * as core from '@actions/core'
import {dict, getInclude} from './leaf'
import {existsSync, readFileSync, readdirSync, statSync} from 'fs'
import {join} from 'path'

async function run(): Promise<void> {
  try {
    const changePaths: string = core.getInput('change-paths')
    core.debug(`Chanages ${changePaths} `)
    const ignorePaths: string = core.getInput('ignore-paths')
    core.debug(`Ignores ${ignorePaths} `)
    const workspace: string = core.getInput('workspace')
    core.debug(`Workspace ${workspace}`)
    const ignores = ignorePaths.split(',')

    const dirs: string[] = []

    for (const e of readdirSync(workspace)) {
      if (statSync(join(workspace, e)).isDirectory() && !ignores.includes(e)) {
        dirs.push(e)
      }
    }

    const depsAll: dict = {}
    for (const p of dirs) {
      depsAll[p] = {}
      for (const pwd of dirs) {
        if (pwd === p) {
          continue
        }
        const settingsGradle: string = join(workspace, pwd, 'settings.gradle')
        if (!existsSync(settingsGradle)) {
          continue
        }
        const lter = readFileSync(settingsGradle, {encoding: 'utf8'}).matchAll(
          /includeBuild\s'([^']+)'/g
        )
        while (!lter.next().done) {
          const pathInclude = lter.next().value[1]
          if (pathInclude instanceof String) {
            if (
              pathInclude.split('/').length > 0 &&
              pathInclude.split('/')[1] === pwd
            ) {
              depsAll[pwd][p] = {}
            }
          }
        }
      }
    }

    let leaf: string[] = []
    const includeNodes: string[] = []

    for (const p of changePaths.split(',')) {
      const a = p.split('/')[0].trim()
      if (ignores.includes(a)) {
        return
      }
      if (statSync(join(workspace, a)).isDirectory()) {
        if (includeNodes.includes(a)) {
          return
        }
        if (Object.keys(depsAll[a]).length === 0) {
          leaf.push(a)
        } else {
          leaf.push(...getInclude(depsAll, a))
        }
      }
    }

    leaf = Array.from(new Set(leaf))

    core.setOutput('need_ci', leaf.length > 0)
    core.setOutput('leaf', leaf)

    // core.setOutput('time', new Date().toTimeString())
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
