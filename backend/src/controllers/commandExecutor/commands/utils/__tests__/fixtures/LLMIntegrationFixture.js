import {DatabaseFixtures} from './DatabaseFixtures'
import {IntegrationDocBuilder} from './IntegrationDocBuilder'
import {loadUserAliases} from '../../../aliases/loadUserAliases'
import {resolveCommand} from '../../queryTypeResolver'
import {runCommand} from '../../runCommand'
import Store from '../../Store'
import ProgressReporter from '../../../../ProgressReporter'
import {getIntegrationSettings} from '../../langchain/getLLM'

const CELL_ID = 'llm-cell'
const ROOT_ID = 'root'

export class LLMIntegrationFixture {
  constructor(userId, dbUri) {
    this.userId = userId
    this.dbFixtures = new DatabaseFixtures(dbUri)
  }

  async connect() {
    await this.dbFixtures.connect()
  }

  async teardown() {
    await this.dbFixtures.cleanup()
  }

  async insertProviders(providers) {
    const builder = Object.entries(providers).reduce(
      (b, [family, config]) => b.addLLMProvider(family, config),
      new IntegrationDocBuilder(this.userId),
    )
    await this.dbFixtures.insertIntegration(builder.build())
  }

  async executeCell(command, {prompt, children = []} = {}) {
    const aliases = await loadUserAliases(this.userId, null)
    const {queryType, mcpAlias, rpcAlias} = resolveCommand(command, aliases)

    const cellNode = {
      id: CELL_ID,
      title: command,
      command,
      parent: ROOT_ID,
      children: children.map(c => c.id),
    }

    const childNodes = children.reduce((acc, {id, command: cmd}) => {
      acc[id] = {id, title: cmd, command: cmd, parent: CELL_ID}
      return acc
    }, {})

    const rootNode = {id: ROOT_ID, title: 'Workflow', children: [CELL_ID]}

    const store = new Store({
      userId: this.userId,
      workflowId: null,
      nodes: {[ROOT_ID]: rootNode, [CELL_ID]: cellNode, ...childNodes},
      aliases,
    })

    const progress = new ProgressReporter({title: 'llm-integration-test', outputInterval: 600000})

    try {
      await runCommand({queryType, cell: cellNode, store, mcpAlias, rpcAlias, prompt: prompt || command}, progress)
    } finally {
      progress.dispose()
    }

    return {
      output: store.getOutput(),
      cellTitle: store._nodes[CELL_ID]?.title ?? null,
      childTitles: children.reduce((acc, {id}) => {
        acc[id] = store._nodes[id]?.title ?? null
        return acc
      }, {}),
    }
  }

  async getSettings() {
    return getIntegrationSettings(this.userId)
  }
}
